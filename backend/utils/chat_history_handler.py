import json
import time
import uuid

import snowflake.connector
from dotenv import load_dotenv

from utils.snowflake_env import snowflake_connect_kwargs, snowflake_fq_table
from utils.title_generator import generate_session_title

load_dotenv()


def _sessions_table():
    return snowflake_fq_table("CHAT_SESSIONS")


def _history_table():
    return snowflake_fq_table("CHAT_HISTORY")


def get_snowflake_connection():
    return snowflake.connector.connect(**snowflake_connect_kwargs())


def execute_snowflake_query(query, params=None):
    try:
        conn = get_snowflake_connection()
        cur = conn.cursor()
        cur.execute(query, params or [])
        if cur.description:
            result = cur.fetchall()
        else:
            result = True
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Snowflake query execution error: {e}")
        return None


def create_new_chat_session(user_id: int, title: str = "Untitled Chat") -> str | None:
    chat_id = str(uuid.uuid4())
    query = f"""
    INSERT INTO {_sessions_table()} (chat_id, user_id, title, created_at)
    VALUES (%s, %s, %s, CURRENT_TIMESTAMP())
    """
    result = execute_snowflake_query(query, (chat_id, user_id, title))
    return chat_id if result is not None else None


def _ensure_chat_session_row(user_id: int, chat_id: str, title: str = "Untitled Chat") -> bool:
    """Ensure a session exists for (user_id, chat_id) before inserting history (covers local fallback ids)."""
    sel = f"SELECT 1 FROM {_sessions_table()} WHERE chat_id = %s AND user_id = %s LIMIT 1"
    found = execute_snowflake_query(sel, (chat_id, user_id))
    if found:
        return True
    ins = f"""
    INSERT INTO {_sessions_table()} (chat_id, user_id, title, created_at)
    VALUES (%s, %s, %s, CURRENT_TIMESTAMP())
    """
    return execute_snowflake_query(ins, (chat_id, user_id, title)) is not None


def _normalize_response_graph_for_db(response_graph):
    if response_graph is None:
        return None
    if isinstance(response_graph, str):
        return response_graph
    return json.dumps(response_graph)


def _normalize_insightful_for_db(insightful_questions):
    if insightful_questions is None:
        return None
    if isinstance(insightful_questions, str):
        try:
            parsed = json.loads(insightful_questions)
            return json.dumps(parsed)
        except Exception:
            return json.dumps([insightful_questions])
    return json.dumps(insightful_questions)


def save_chat_message(
    user_id: int,
    chat_id: str,
    question: str,
    response: str | None,
    response_graph,
    graph_type: str | None,
    insightful_questions,
) -> str:
    if not _ensure_chat_session_row(user_id, chat_id):
        return "DB_ERROR"
    message_id = int(time.time() * 1000)
    query = f"""
    INSERT INTO {_history_table()} (message_id, chat_id, user_id, question, response, response_graph, graph_type, insightful_questions, timestamp)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP())
    """
    params = (
        message_id,
        chat_id,
        user_id,
        question,
        response,
        _normalize_response_graph_for_db(response_graph),
        graph_type,
        _normalize_insightful_for_db(insightful_questions),
    )
    result = execute_snowflake_query(query, params)

    title_query = f"SELECT title FROM {_sessions_table()} WHERE chat_id = %s AND user_id = %s"
    title_result = execute_snowflake_query(title_query, (chat_id, user_id))
    chat_title = None
    for row in title_result or []:
        chat_title = row[0] if isinstance(row, (list, tuple)) else row.get("title")

    if chat_title == "Untitled Chat":
        msg_query = f"SELECT question, response FROM {_history_table()} WHERE chat_id = %s AND user_id = %s ORDER BY timestamp ASC"
        msg_result = execute_snowflake_query(msg_query, (chat_id, user_id))
        messages = []
        for row in msg_result or []:
            q = row[0] if isinstance(row, (list, tuple)) else row.get("question")
            r = row[1] if isinstance(row, (list, tuple)) else row.get("response")
            messages.append({"role": "user", "content": q})
            if r:
                messages.append({"role": "assistant", "content": r})

        try:
            new_title = generate_session_title(messages)
            update_query = f"UPDATE {_sessions_table()} SET title = %s WHERE chat_id = %s"
            execute_snowflake_query(update_query, (new_title, chat_id))
        except Exception as e:
            print(f"Error generating/updating session title: {e}")

    return "SUCCESS" if result is not None else "DB_ERROR"


def refresh_chat_session_title(user_id: int, chat_id: str) -> str | None:
    """
    Recompute session title from full conversation (e.g. when user starts a new chat).
    Returns the new title if updated, else None.
    """
    msg_query = f"""
    SELECT question, response FROM {_history_table()}
    WHERE chat_id = %s AND user_id = %s ORDER BY timestamp ASC
    """
    msg_result = execute_snowflake_query(msg_query, (chat_id, user_id))
    if not msg_result:
        return None
    messages = []
    for row in msg_result:
        q = row[0] if isinstance(row, (list, tuple)) else row.get("question")
        r = row[1] if isinstance(row, (list, tuple)) else row.get("response")
        if q:
            messages.append({"role": "user", "content": str(q)})
        if r:
            messages.append({"role": "assistant", "content": str(r)})
    if not messages:
        return None
    try:
        new_title = generate_session_title(messages)
        if not new_title:
            return None
        upd = f"UPDATE {_sessions_table()} SET title = %s WHERE chat_id = %s AND user_id = %s"
        if execute_snowflake_query(upd, (new_title, chat_id, user_id)) is not None:
            return new_title
    except Exception as e:
        print(f"Error in refresh_chat_session_title: {e}")
    return None


def get_user_chat_sessions(user_id: int) -> list[dict] | None:
    query = f"SELECT chat_id, created_at, title FROM {_sessions_table()} WHERE user_id = %s ORDER BY created_at DESC"
    result = execute_snowflake_query(query, (user_id,))
    if result is None:
        return None
    if len(result) == 0:
        return []
    return [{"chat_id": row[0], "created_at": row[1], "title": row[2]} for row in result]


def get_chat_history(user_id: int, chat_id: str) -> dict | None:
    query_title = f"SELECT title FROM {_sessions_table()} WHERE chat_id = %s AND user_id = %s"
    result_title = execute_snowflake_query(query_title, (chat_id, user_id))
    chat_title = None
    if result_title:
        for row in result_title:
            chat_title = row[0] if isinstance(row, (list, tuple)) else row.get("title")
            break
    if not chat_title:
        print(f"Chat session not found or access denied for user {user_id}, chat {chat_id}")
        return None

    query = f"""
    SELECT message_id, question, response, response_graph, graph_type, timestamp, insightful_questions
    FROM {_history_table()} WHERE chat_id = %s AND user_id = %s ORDER BY timestamp ASC
    """
    result = execute_snowflake_query(query, (chat_id, user_id))
    if not result:
        return {
            "chat_id": chat_id,
            "title": chat_title,
            "conversation_history": [],
        }

    conversation = []
    for row in result:
        message_id = row[0]
        question = row[1]
        resp = row[2]
        response_graph_raw = row[3]
        graph_type = row[4]
        ts = row[5]
        insightful_raw = row[6]

        try:
            response_graph = json.loads(response_graph_raw) if response_graph_raw else None
        except Exception:
            response_graph = None

        insightful_questions = []
        if insightful_raw:
            try:
                insightful_questions = json.loads(insightful_raw)
                if not isinstance(insightful_questions, list):
                    insightful_questions = [str(insightful_questions)]
            except Exception:
                insightful_questions = [insightful_raw] if isinstance(insightful_raw, str) else []

        conversation.append(
            {
                "id": message_id,
                "question": question,
                "response": resp,
                "response_graph": response_graph,
                "graph_type": graph_type,
                "timestamp": ts,
                "insightful_questions": insightful_questions,
            }
        )

    return {"chat_id": chat_id, "title": chat_title, "conversation_history": conversation}
