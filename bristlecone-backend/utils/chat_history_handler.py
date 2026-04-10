import snowflake.connector
import uuid
import os
import time
import json
from utils.title_generator import generate_session_title  # Add this import
 

# Load Snowflake environment variables
SNOWFLAKE_USER = os.getenv("SNOWFLAKE_USER")
SNOWFLAKE_PASSWORD = os.getenv("SNOWFLAKE_PASSWORD")
SNOWFLAKE_ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT")
SNOWFLAKE_DATABASE = os.getenv("SNOWFLAKE_DATABASE")
SNOWFLAKE_SCHEMA = os.getenv("SNOWFLAKE_SCHEMA")
SNOWFLAKE_WAREHOUSE = os.getenv("SNOWFLAKE_WAREHOUSE")

CHAT_SESSIONS_TABLE = f'"{SNOWFLAKE_DATABASE}"."{SNOWFLAKE_SCHEMA}"."CHAT_SESSIONS"'
CHAT_HISTORY_TABLE = f'"{SNOWFLAKE_DATABASE}"."{SNOWFLAKE_SCHEMA}"."CHAT_HISTORY"'

def get_snowflake_connection():
    return snowflake.connector.connect(
        user=SNOWFLAKE_USER,
        password=SNOWFLAKE_PASSWORD,
        account=SNOWFLAKE_ACCOUNT,
        warehouse=SNOWFLAKE_WAREHOUSE,
        database=SNOWFLAKE_DATABASE,
        schema=SNOWFLAKE_SCHEMA
    )
 

def execute_snowflake_query(query, params=None):
    """Executes a Snowflake query with optional parameters."""
    try:
        conn = get_snowflake_connection()
        cur = conn.cursor()
        cur.execute(query, params or [])
        result = cur.fetchall() if cur.description else None
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Snowflake query execution error: {e}")
        return None
 

def create_new_chat_session(user_id: int, title: str = "Untitled Chat") -> str | None:
    """Creates a new chat session for a user and returns the chat_id."""
    chat_id = str(uuid.uuid4())
    query = f"""
    INSERT INTO {CHAT_SESSIONS_TABLE} (chat_id, user_id, title, created_at)
    VALUES (%s, %s, %s, CURRENT_TIMESTAMP())
    """
    params = (chat_id, user_id, title)
    result = execute_snowflake_query(query, params)
    return chat_id if result is not None else None
 

def save_chat_message(user_id: int, chat_id: str, question: str, response: str | None, response_graph: dict | None, graph_type: str | None, insightful_questions: str | None) -> str:
    """Saves a message to a chat session."""
    message_id = int(time.time() * 1000)
    query = f"""
    INSERT INTO {CHAT_HISTORY_TABLE} (message_id, chat_id, user_id, question, response, response_graph, graph_type, insightful_questions, timestamp)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP())
    """
    if isinstance(insightful_questions, str):
        try:
            insightful_questions = json.loads(insightful_questions)
        except Exception:
            insightful_questions = [insightful_questions]
    params = (
        message_id,
        chat_id,
        user_id,
        question,
        response,
        json.dumps(response_graph) if response_graph else None,
        graph_type,
        json.dumps(insightful_questions) if insightful_questions else None,
    )
    result = execute_snowflake_query(query, params)
    print("Saving to DB:", response_graph, insightful_questions)

    # --- Title generation logic ---
    # Check if the session title is still "Untitled Chat"
    title_query = f"SELECT title FROM {CHAT_SESSIONS_TABLE} WHERE chat_id = %s AND user_id = %s"
    title_params = (chat_id, user_id)
    title_result = execute_snowflake_query(title_query, title_params)
    chat_title = None
    for row in title_result or []:
        chat_title = row[0] if isinstance(row, (list, tuple)) else row.get("title")

    if chat_title == "Untitled Chat":
        # Fetch all messages for this session
        msg_query = f"SELECT question, response FROM {CHAT_HISTORY_TABLE} WHERE chat_id = %s AND user_id = %s ORDER BY timestamp ASC"
        msg_params = (chat_id, user_id)
        msg_result = execute_snowflake_query(msg_query, msg_params)
        messages = []
        for row in msg_result or []:
            question = row[0] if isinstance(row, (list, tuple)) else row.get("question")
            response = row[1] if isinstance(row, (list, tuple)) else row.get("response")
            messages.append({"role": "user", "content": question})
            if response:
                messages.append({"role": "assistant", "content": response})

        # Generate a title using OpenAI
        try:
            new_title = generate_session_title(messages)
            # Update the session title in Snowflake
            update_query = f"UPDATE {CHAT_SESSIONS_TABLE} SET title = %s WHERE chat_id = %s"
            update_params = (new_title, chat_id)
            execute_snowflake_query(update_query, update_params)
        except Exception as e:
            print(f"Error generating/updating session title: {e}")

    return "SUCCESS" if result else "DB_ERROR"
 
def get_user_chat_sessions(user_id: int) -> list[dict] | None:
    """Gets all chat sessions for a user."""
    query = f"SELECT chat_id, created_at, title FROM {CHAT_SESSIONS_TABLE} WHERE user_id = %s ORDER BY created_at DESC"
    params = (user_id,)
    result = execute_snowflake_query(query, params)
    return [{"chat_id": row[0], "created_at": row[1], "title": row[2]} for row in result] if result else None
 
def get_chat_history(user_id: str, chat_id: str) -> dict | None:
    """Retrieves the message history for a specific chat session."""
    query_title = f"SELECT title FROM {CHAT_SESSIONS_TABLE} WHERE chat_id = %s AND user_id = %s"
    params_title = (chat_id, user_id)
    result_title = execute_snowflake_query(query_title, params_title)
    chat_title = None
    for row in result_title or []:
        chat_title = row[0] if isinstance(row, (list, tuple)) else row.get("title")
    if not chat_title:
        print(f"Chat session not found or access denied for user {user_id}, chat {chat_id}")
        return None

    # Get chat messages
    query = f"SELECT message_id, question, response, response_graph, graph_type, timestamp, insightful_questions FROM {CHAT_HISTORY_TABLE} WHERE chat_id = %s AND user_id = %s ORDER BY timestamp ASC"
    params = (chat_id, user_id)
    result = execute_snowflake_query(query, params)
    if not result:
        return None

    conversation = []
    for row in result:
        # Parse JSON fields
        try:
            response_graph = json.loads(row[3]) if row[3] else None
        except Exception:
            response_graph = None
        try:
            insightful_questions = json.loads(row["insightful_questions"]) if row["insightful_questions"] else []
        except Exception:
            insightful_questions = []
        conversation.append({
            "id": row["message_id"],
            "question": row["question"],
            "response": row["response"],
            "response_graph": response_graph,
            "graph_type": row["graph_type"],
            "timestamp": row["timestamp"],
            "insightful_questions": insightful_questions,
        })

    return {
        "chat_id": chat_id,
        "title": chat_title,
        "conversation_history": conversation
    }