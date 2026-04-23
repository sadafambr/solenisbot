import uuid
import os
import time
import json
import logging
from utils.title_generator import generate_session_title
from connectors.snowflake_connector_v2 import SnowflakeConnector

# Load environment variables
DB_NAME = os.getenv("DB_NAME", "SNOWFLAKE_SAMPLE_DATA")
AUTH_SCHEMA = os.getenv("DB_SCHEMA", "PUBLIC")

CHAT_SESSIONS_TABLE = f"{DB_NAME}.{AUTH_SCHEMA}.CHAT_SESSIONS"
CHAT_HISTORY_TABLE = f"{DB_NAME}.{AUTH_SCHEMA}.CHAT_HISTORY"

logger = logging.getLogger(__name__)

def initialize_chat_tables():
    """Creates chat-related tables in Snowflake if they do not exist."""
    connector = SnowflakeConnector()
    create_sessions_sql = f"""
    CREATE TABLE IF NOT EXISTS {CHAT_SESSIONS_TABLE} (
        CHAT_ID STRING PRIMARY KEY,
        USER_ID INTEGER,
        TITLE STRING,
        CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    )
    """
    create_history_sql = f"""
    CREATE TABLE IF NOT EXISTS {CHAT_HISTORY_TABLE} (
        MESSAGE_ID INTEGER PRIMARY KEY,
        CHAT_ID STRING,
        USER_ID INTEGER,
        QUESTION STRING,
        RESPONSE STRING,
        RESPONSE_GRAPH STRING,
        GRAPH_TYPE STRING,
        INSIGHTFUL_QUESTIONS STRING,
        TIMESTAMP TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    )
    """
    connector.execute_query(create_sessions_sql)
    connector.execute_query(create_history_sql)

def execute_snowflake_query(query: str):
    """Executes a Snowflake query and returns results."""
    connector = SnowflakeConnector()
    try:
        result_json = connector.execute_query(query)
        result = json.loads(result_json)
        if isinstance(result, dict) and "error" in result:
            logger.error(f"Snowflake error: {result['error']}")
            return None
        return result
    except Exception as e:
        logger.error(f"Error executing Snowflake query: {e}")
        return None

def create_new_chat_session(user_id: int, title: str = "Untitled Chat") -> str | None:
    """Creates a new chat session for a user and returns the chat_id."""
    chat_id = str(uuid.uuid4())
    query = f"""
    INSERT INTO {CHAT_SESSIONS_TABLE} (CHAT_ID, USER_ID, TITLE, CREATED_AT)
    VALUES ('{chat_id}', {user_id}, '{title}', CURRENT_TIMESTAMP())
    """
    result = execute_snowflake_query(query)
    return chat_id if result is not None else None

def save_chat_message(user_id: int, chat_id: str, question: str, response: str | None, response_graph: dict | None, graph_type: str | None, insightful_questions: str | None) -> str:
    """Saves a message to a chat session."""
    message_id = int(time.time() * 1000)
    
    # Handle insightful_questions format (ensure it's a JSON string for Snowflake STRING column)
    if isinstance(insightful_questions, (list, dict)):
        insightful_questions_str = json.dumps(insightful_questions)
    elif isinstance(insightful_questions, str):
        try:
            # Check if it's already valid JSON
            json.loads(insightful_questions)
            insightful_questions_str = insightful_questions
        except Exception:
            insightful_questions_str = json.dumps([insightful_questions])
    else:
        insightful_questions_str = "[]"

    # Escape single quotes in strings for SQL
    question_esc = question.replace("'", "''")
    response_esc = response.replace("'", "''") if response else ""
    response_graph_esc = json.dumps(response_graph).replace("'", "''") if response_graph else ""
    insightful_questions_esc = insightful_questions_str.replace("'", "''")

    query = f"""
    INSERT INTO {CHAT_HISTORY_TABLE} (MESSAGE_ID, CHAT_ID, USER_ID, QUESTION, RESPONSE, RESPONSE_GRAPH, GRAPH_TYPE, INSIGHTFUL_QUESTIONS, TIMESTAMP)
    VALUES ({message_id}, '{chat_id}', {user_id}, '{question_esc}', '{response_esc}', '{response_graph_esc}', '{graph_type or ""}', '{insightful_questions_esc}', CURRENT_TIMESTAMP())
    """
    result = execute_snowflake_query(query)
    
    # --- Title generation logic ---
    if result is not None:
        # Check if the session title is still "Untitled Chat"
        title_query = f"SELECT TITLE FROM {CHAT_SESSIONS_TABLE} WHERE CHAT_ID = '{chat_id}' AND USER_ID = {user_id}"
        title_result = execute_snowflake_query(title_query)
        chat_title = title_result[0].get("TITLE") if title_result else None

        if chat_title == "Untitled Chat":
            msg_query = f"""
            SELECT QUESTION, RESPONSE FROM {CHAT_HISTORY_TABLE}
            WHERE CHAT_ID = '{chat_id}' AND USER_ID = {user_id}
            ORDER BY TIMESTAMP ASC
            """
            msg_result = execute_snowflake_query(msg_query)
            messages = []
            for row in msg_result or []:
                messages.append({"role": "user", "content": row["QUESTION"]})
                if row["RESPONSE"]:
                    messages.append({"role": "assistant", "content": row["RESPONSE"]})

            if messages:
                try:
                    new_title = generate_session_title(messages)
                    new_title_esc = new_title.replace("'", "''")
                    update_query = f"UPDATE {CHAT_SESSIONS_TABLE} SET TITLE = '{new_title_esc}' WHERE CHAT_ID = '{chat_id}' AND USER_ID = {user_id}"
                    execute_snowflake_query(update_query)
                except Exception as e:
                    logger.error(f"Error generating/updating session title: {e}")

        return "SUCCESS"
    else:
        return "DB_ERROR"

def get_user_chat_sessions(user_id: int) -> list[dict] | None:
    """Gets all chat sessions for a user."""
    query = f"SELECT CHAT_ID, CREATED_AT, TITLE FROM {CHAT_SESSIONS_TABLE} WHERE USER_ID = {user_id} ORDER BY CREATED_AT DESC"
    result = execute_snowflake_query(query)
    if result is None:
        return None
    return [{"chat_id": row["CHAT_ID"], "created_at": row["CREATED_AT"], "title": row["TITLE"]} for row in result]

def get_chat_history(user_id: int, chat_id: str) -> dict | None:
    """Retrieves the message history for a specific chat session."""
    query_title = f"SELECT TITLE FROM {CHAT_SESSIONS_TABLE} WHERE CHAT_ID = '{chat_id}' AND USER_ID = {user_id}"
    result_title = execute_snowflake_query(query_title)
    chat_title = result_title[0].get("TITLE") if result_title else None
    
    if not chat_title:
        return None

    query_msg = f"""
    SELECT MESSAGE_ID, QUESTION, RESPONSE, RESPONSE_GRAPH, GRAPH_TYPE, TIMESTAMP, INSIGHTFUL_QUESTIONS
    FROM {CHAT_HISTORY_TABLE}
    WHERE CHAT_ID = '{chat_id}' AND USER_ID = {user_id}
    ORDER BY TIMESTAMP ASC
    """
    result_msg = execute_snowflake_query(query_msg)
    if result_msg is None:
        return None

    conversation = []
    for row in result_msg:
        try:
            response_graph = json.loads(row["RESPONSE_GRAPH"]) if row["RESPONSE_GRAPH"] else None
        except Exception:
            response_graph = None
        try:
            insightful_questions = json.loads(row["INSIGHTFUL_QUESTIONS"]) if row["INSIGHTFUL_QUESTIONS"] else []
        except Exception:
            insightful_questions = []
            
        conversation.append({
            "id": row["MESSAGE_ID"],
            "question": row["QUESTION"],
            "response": row["RESPONSE"],
            "response_graph": response_graph,
            "graph_type": row["GRAPH_TYPE"],
            "timestamp": row["TIMESTAMP"],
            "insightful_questions": insightful_questions,
        })

    return {
        "chat_id": chat_id,
        "title": chat_title,
        "conversation_history": conversation
    }
