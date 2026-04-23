from google.cloud import bigquery
import uuid
import os
import time
import json
from utils.title_generator import generate_session_title  # Add this import
 
# Load environment variables
PROJECT_ID = os.getenv("BQ_PROJECT_ID", "bcone-sales-insights-dev-prj")
AUTH_DATASET = os.getenv("BQ_AUTH_DATASET", "auth_data")
CHAT_SESSIONS_TABLE = f"{PROJECT_ID}.{AUTH_DATASET}.chat_sessions"
CHAT_HISTORY_TABLE = f"{PROJECT_ID}.{AUTH_DATASET}.chat_history"
 
# Initialize BigQuery client
bigquery_client = bigquery.Client.from_service_account_json(os.getenv("GCP_CREDENTIALS_PATH"))
 
def execute_bigquery_query(query, params=None):
    """Executes a BigQuery query with optional parameters."""
    try:
        job_config = bigquery.QueryJobConfig(query_parameters=params or [])
        query_job = bigquery_client.query(query, job_config=job_config)
        return query_job.result()
    except Exception as e:
        print(f"BigQuery query execution error: {e}")
        return None
 
def create_new_chat_session(user_id: int, title: str = "Untitled Chat") -> str | None:
    """Creates a new chat session for a user and returns the chat_id."""
    chat_id = str(uuid.uuid4())
    query = f"""
    INSERT INTO `{CHAT_SESSIONS_TABLE}` (chat_id, user_id, title, created_at)
    VALUES (@chat_id, @user_id, @title, CURRENT_TIMESTAMP())
    """
    params = [
        bigquery.ScalarQueryParameter("chat_id", "STRING", chat_id),
        bigquery.ScalarQueryParameter("user_id", "INT64", user_id),  # Ensure INT64 for BigQuery INTEGER
        bigquery.ScalarQueryParameter("title", "STRING", title),
    ]
    result = execute_bigquery_query(query, params)
    return chat_id if result else None
 
def save_chat_message(user_id: int, chat_id: str, question: str, response: str | None, response_graph: dict | None, graph_type: str | None, insightful_questions: str | None) -> str:
    """Saves a message to a chat session."""
    message_id = int(time.time() * 1000)
    query = f"""
    INSERT INTO `{CHAT_HISTORY_TABLE}` (message_id, chat_id, user_id, question, response, response_graph, graph_type, insightful_questions, timestamp)
    VALUES (@message_id, @chat_id, @user_id, @question, @response, @response_graph, @graph_type, @insightful_questions, CURRENT_TIMESTAMP())
    """
    if isinstance(insightful_questions, str):
        try:
            insightful_questions = json.loads(insightful_questions)
        except Exception:
            insightful_questions = [insightful_questions]
    params = [
        bigquery.ScalarQueryParameter("message_id", "INT64", message_id),
        bigquery.ScalarQueryParameter("chat_id", "STRING", chat_id),
        bigquery.ScalarQueryParameter("user_id", "INT64", user_id),
        bigquery.ScalarQueryParameter("question", "STRING", question),
        bigquery.ScalarQueryParameter("response", "STRING", response),
        bigquery.ScalarQueryParameter("response_graph", "STRING", json.dumps(response_graph) if response_graph else None),
        bigquery.ScalarQueryParameter("graph_type", "STRING", graph_type),
        bigquery.ScalarQueryParameter("insightful_questions", "STRING", json.dumps(insightful_questions) if insightful_questions else None),
    ]
    result = execute_bigquery_query(query, params)
    print("Saving to DB:", response_graph, insightful_questions)

    # --- Title generation logic ---
    # Check if the session title is still "Untitled Chat"
    title_query = f"SELECT title FROM `{CHAT_SESSIONS_TABLE}` WHERE chat_id = @chat_id AND user_id = @user_id"
    title_params = [
        bigquery.ScalarQueryParameter("chat_id", "STRING", chat_id),
        bigquery.ScalarQueryParameter("user_id", "INT64", user_id),
    ]
    title_result = execute_bigquery_query(title_query, title_params)
    chat_title = None
    for row in title_result or []:
        chat_title = row["title"]

    if chat_title == "Untitled Chat":
        # Fetch all messages for this session
        msg_query = f"""
        SELECT question, response FROM `{CHAT_HISTORY_TABLE}`
        WHERE chat_id = @chat_id AND user_id = @user_id
        ORDER BY timestamp ASC
        """
        msg_result = execute_bigquery_query(msg_query, title_params)
        messages = []
        for row in msg_result or []:
            messages.append({"role": "user", "content": row["question"]})
            if row["response"]:
                messages.append({"role": "assistant", "content": row["response"]})

        # Generate a title using OpenAI
        try:
            new_title = generate_session_title(messages)
            # Update the session title in BigQuery
            update_query = f"UPDATE `{CHAT_SESSIONS_TABLE}` SET title = @title WHERE chat_id = @chat_id"
            update_params = [
                bigquery.ScalarQueryParameter("title", "STRING", new_title),
                bigquery.ScalarQueryParameter("chat_id", "STRING", chat_id),
            ]
            execute_bigquery_query(update_query, update_params)
        except Exception as e:
            print(f"Error generating/updating session title: {e}")

    return "SUCCESS" if result else "DB_ERROR"
 
def get_user_chat_sessions(user_id: int) -> list[dict] | None:
    """Gets all chat sessions for a user."""
    query = f"SELECT chat_id, created_at, title FROM `{CHAT_SESSIONS_TABLE}` WHERE user_id = @user_id ORDER BY created_at DESC"
    params = [bigquery.ScalarQueryParameter("user_id", "INT64", user_id)]
    result = execute_bigquery_query(query, params)
    return [{"chat_id": row["chat_id"], "created_at": row["created_at"], "title": row["title"]} for row in result] if result else None
 
def get_chat_history(user_id: str, chat_id: str) -> dict | None:
    """Retrieves the message history for a specific chat session."""
    query_title = f"""
    SELECT title FROM `{CHAT_SESSIONS_TABLE}` WHERE chat_id = @chat_id AND user_id = @user_id
    """
    params_title = [
        bigquery.ScalarQueryParameter("chat_id", "STRING", chat_id),
        bigquery.ScalarQueryParameter("user_id", "INT64", user_id),
    ]
    result_title = execute_bigquery_query(query_title, params_title)
    chat_title = None
    for row in result_title or []:
        chat_title = row["title"]
    if not chat_title:
        print(f"Chat session not found or access denied for user {user_id}, chat {chat_id}")
        return None

    # Get chat messages
    query = f"""
    SELECT message_id, question, response, response_graph, graph_type, timestamp, insightful_questions
    FROM `{CHAT_HISTORY_TABLE}`
    WHERE chat_id = @chat_id AND user_id = @user_id
    ORDER BY timestamp ASC
    """
    params = [
        bigquery.ScalarQueryParameter("chat_id", "STRING", chat_id),
        bigquery.ScalarQueryParameter("user_id", "INT64", user_id),
    ]
    result = execute_bigquery_query(query, params)
    if not result:
        return None

    conversation = []
    for row in result:
        # Parse JSON fields
        try:
            response_graph = json.loads(row["response_graph"]) if row["response_graph"] else None
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