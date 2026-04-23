import json
import logging
import os
import sqlite3
import time
import uuid

import snowflake.connector
from dotenv import load_dotenv

from utils.snowflake_env import snowflake_connect_kwargs, snowflake_fq_table
from utils.title_generator import generate_session_title

load_dotenv()

logger = logging.getLogger(__name__)

_HANDLER_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_SQLITE_PATH = os.path.normpath(os.path.join(_HANDLER_DIR, "..", "data", "chat_sessions.db"))


def _sqlite_db_path() -> str:
    return os.getenv("CHAT_SQLITE_PATH") or _DEFAULT_SQLITE_PATH


def _snowflake_ready() -> bool:
    kw = snowflake_connect_kwargs()
    return all(kw.get(k) for k in ("user", "password", "account"))


def _storage_backend() -> str:
    """Where chat sessions/history are persisted.

    - ``CHAT_STORAGE=sqlite`` — file DB under ``backend/data`` (default; best for local dev).
    - ``CHAT_STORAGE=snowflake`` — requires Snowflake tables ``CHAT_SESSIONS`` / ``CHAT_HISTORY``
      and working credentials. Use this in production when those tables exist.

    Previously, any Snowflake-shaped .env would auto-select Snowflake for chat; that breaks when
    credentials exist but chat tables are missing or unauthorized, causing HTTP 500 on
    ``/api/chat/*``. Explicit opt-in avoids that.
    """
    explicit = os.getenv("CHAT_STORAGE", "").strip().lower()
    if explicit == "sqlite":
        return "sqlite"
    if explicit == "snowflake":
        if not _snowflake_ready():
            logger.warning("CHAT_STORAGE=snowflake but Snowflake env is incomplete; using sqlite")
            return "sqlite"
        return "snowflake"
    return "sqlite"


def get_chat_storage_backend() -> str:
    """``sqlite`` or ``snowflake`` — for logging and health checks."""
    return _storage_backend()


def _sqlite_connect():
    path = _sqlite_db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return sqlite3.connect(path)


def _sqlite_ensure_session_columns() -> None:
    """Add deleted_at / updated_at to chat_sessions when missing (SQLite)."""
    try:
        conn = _sqlite_connect()
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(chat_sessions)")
        cols = {row[1] for row in cur.fetchall()}
        if "deleted_at" not in cols:
            cur.execute("ALTER TABLE chat_sessions ADD COLUMN deleted_at TEXT")
        if "updated_at" not in cols:
            cur.execute("ALTER TABLE chat_sessions ADD COLUMN updated_at TEXT")
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning("SQLite session column migration: %s", e)


def _sqlite_execute(query: str, params=(), fetch: bool = False):
    try:
        conn = _sqlite_connect()
        cur = conn.cursor()
        cur.execute(query, params or [])
        if fetch:
            rows = cur.fetchall()
            cur.close()
            conn.close()
            return rows
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        logger.error("SQLite query error: %s", e)
        return None


def ensure_sqlite_chat_schema() -> None:
    """Create chat SQLite tables on first run so /api/chat/new does not fail on a fresh checkout."""
    if _storage_backend() != "sqlite":
        return
    path = _sqlite_db_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        conn = sqlite3.connect(path)
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_sessions (
                chat_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT,
                created_at TEXT,
                updated_at TEXT,
                deleted_at TEXT
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_history (
                message_id INTEGER NOT NULL PRIMARY KEY,
                chat_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                question TEXT,
                response TEXT,
                response_graph TEXT,
                graph_type TEXT,
                insightful_questions TEXT,
                timestamp TEXT
            )
            """
        )
        conn.commit()
        cur.close()
        conn.close()
        _sqlite_ensure_session_columns()
        logger.debug("SQLite chat schema ready at %s", path)
    except Exception as e:
        logger.exception("ensure_sqlite_chat_schema failed: %s", e)


def _sqlite_prepare() -> None:
    """Ensure SQLite tables/columns exist before chat queries (safe if already initialized)."""
    if _storage_backend() != "sqlite":
        return
    ensure_sqlite_chat_schema()


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
        logger.exception("Snowflake query execution error: %s", e)
        return None


def create_new_chat_session(user_id: int, title: str = "Untitled Chat") -> str | None:
    if _storage_backend() == "sqlite":
        _sqlite_prepare()
        chat_id = str(uuid.uuid4())
        q = """
        INSERT INTO chat_sessions (chat_id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
        """
        r = _sqlite_execute(q, (chat_id, user_id, title), fetch=False)
        return chat_id if r is not None else None

    chat_id = str(uuid.uuid4())
    query = f"""
    INSERT INTO {_sessions_table()} (chat_id, user_id, title, created_at)
    VALUES (%s, %s, %s, CURRENT_TIMESTAMP())
    """
    result = execute_snowflake_query(query, (chat_id, user_id, title))
    return chat_id if result is not None else None


def _ensure_chat_session_row(user_id: int, chat_id: str, title: str = "Untitled Chat") -> bool:
    """Ensure a session exists for (user_id, chat_id) before inserting history (covers local fallback ids)."""
    if _storage_backend() == "sqlite":
        _sqlite_prepare()
        sel = "SELECT 1 FROM chat_sessions WHERE chat_id = ? AND user_id = ? LIMIT 1"
        found = _sqlite_execute(sel, (chat_id, user_id), fetch=True)
        if found:
            return True
        ins = """
        INSERT INTO chat_sessions (chat_id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
        """
        return _sqlite_execute(ins, (chat_id, user_id, title), fetch=False) is not None

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


def _maybe_update_title_from_history(
    user_id: int, chat_id: str, chat_title: str | None, *, sqlite: bool
) -> None:
    if chat_title != "Untitled Chat":
        return
    if sqlite:
        msg_query = """
        SELECT question, response FROM chat_history
        WHERE chat_id = ? AND user_id = ? ORDER BY timestamp ASC
        """
        msg_result = _sqlite_execute(msg_query, (chat_id, user_id), fetch=True) or []
        upd = "UPDATE chat_sessions SET title = ? WHERE chat_id = ?"
        exec_upd = lambda nt: _sqlite_execute(upd, (nt, chat_id), fetch=False)
    else:
        msg_query = f"""
        SELECT question, response FROM {_history_table()} WHERE chat_id = %s AND user_id = %s ORDER BY timestamp ASC
        """
        msg_result = execute_snowflake_query(msg_query, (chat_id, user_id)) or []
        upd_tmpl = f"UPDATE {_sessions_table()} SET title = %s WHERE chat_id = %s"
        exec_upd = lambda nt: execute_snowflake_query(upd_tmpl, (nt, chat_id))

    messages = []
    for row in msg_result:
        q = row[0] if isinstance(row, (list, tuple)) else row.get("question")
        r = row[1] if isinstance(row, (list, tuple)) else row.get("response")
        messages.append({"role": "user", "content": q})
        if r:
            messages.append({"role": "assistant", "content": r})
    try:
        new_title = generate_session_title(messages)
        if new_title:
            exec_upd(new_title)
    except Exception as e:
        print(f"Error generating/updating session title: {e}")


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
    use_sqlite = _storage_backend() == "sqlite"
    # Must be unique per row: the frontend fires several save_message requests in parallel (multi-part responses).
    message_id = uuid.uuid4().int % (2**63 - 1) or int(time.time() * 1000)

    if use_sqlite:
        query = """
        INSERT INTO chat_history
        (message_id, chat_id, user_id, question, response, response_graph, graph_type, insightful_questions, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        result = _sqlite_execute(query, params, fetch=False)
        _sqlite_execute(
            "UPDATE chat_sessions SET updated_at = datetime('now') WHERE chat_id = ? AND user_id = ?",
            (chat_id, user_id),
            fetch=False,
        )
        title_query = "SELECT title FROM chat_sessions WHERE chat_id = ? AND user_id = ?"
        title_result = _sqlite_execute(title_query, (chat_id, user_id), fetch=True) or []
    else:
        query = f"""
        INSERT INTO {_history_table()}
        (message_id, chat_id, user_id, question, response, response_graph, graph_type, insightful_questions, timestamp)
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
        title_result = execute_snowflake_query(title_query, (chat_id, user_id)) or []

    chat_title = None
    for row in title_result:
        chat_title = row[0] if isinstance(row, (list, tuple)) else row.get("title")

    _maybe_update_title_from_history(user_id, chat_id, chat_title, sqlite=use_sqlite)

    return "SUCCESS" if result is not None else "DB_ERROR"


def refresh_chat_session_title(user_id: int, chat_id: str) -> str | None:
    """
    Recompute session title from full conversation (e.g. when user starts a new chat).
    Returns the new title if updated, else None.
    """
    if _storage_backend() == "sqlite":
        _sqlite_prepare()
        msg_query = """
        SELECT question, response FROM chat_history
        WHERE chat_id = ? AND user_id = ? ORDER BY timestamp ASC
        """
        msg_result = _sqlite_execute(msg_query, (chat_id, user_id), fetch=True)
    else:
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
        if _storage_backend() == "sqlite":
            upd = "UPDATE chat_sessions SET title = ? WHERE chat_id = ? AND user_id = ?"
            ok = _sqlite_execute(upd, (new_title, chat_id, user_id), fetch=False)
        else:
            upd = f"UPDATE {_sessions_table()} SET title = %s WHERE chat_id = %s AND user_id = %s"
            ok = execute_snowflake_query(upd, (new_title, chat_id, user_id))
        if ok is not None:
            return new_title
    except Exception as e:
        print(f"Error in refresh_chat_session_title: {e}")
    return None


def get_user_chat_sessions(user_id: int) -> list[dict] | None:
    if _storage_backend() == "sqlite":
        _sqlite_prepare()
        query = """
        SELECT s.chat_id, s.created_at, s.title, s.updated_at,
 (SELECT COUNT(*) FROM chat_history h WHERE h.chat_id = s.chat_id AND h.user_id = s.user_id)
        FROM chat_sessions s
        WHERE s.user_id = ? AND (s.deleted_at IS NULL OR s.deleted_at = '')
        ORDER BY datetime(COALESCE(s.updated_at, s.created_at)) DESC
        """
        result = _sqlite_execute(query, (user_id,), fetch=True)
        if result is None:
            return None
        if len(result) == 0:
            return []
        return [
            {
                "chat_id": row[0],
                "created_at": row[1],
                "title": row[2],
                "updated_at": row[3] or row[1],
                "message_count": row[4],
            }
            for row in result
        ]

    query = f"""
    SELECT s.chat_id, s.created_at, s.title, s.created_at,
           (SELECT COUNT(*) FROM {_history_table()} h WHERE h.chat_id = s.chat_id AND h.user_id = s.user_id)
    FROM {_sessions_table()} s
    WHERE s.user_id = %s
    ORDER BY s.created_at DESC
    """
    result = execute_snowflake_query(query, (user_id,))
    if result is None:
        return None
    if len(result) == 0:
        return []
    return [
        {
            "chat_id": row[0],
            "created_at": row[1],
            "title": row[2],
            "updated_at": row[3],
            "message_count": row[4],
        }
        for row in result
    ]


def get_chat_history(user_id: int, chat_id: str) -> dict | None:
    if _storage_backend() == "sqlite":
        _sqlite_prepare()
        query_title = (
            "SELECT title, deleted_at FROM chat_sessions WHERE chat_id = ? AND user_id = ?"
        )
        result_title = _sqlite_execute(query_title, (chat_id, user_id), fetch=True)
    else:
        query_title = f"SELECT title FROM {_sessions_table()} WHERE chat_id = %s AND user_id = %s"
        result_title = execute_snowflake_query(query_title, (chat_id, user_id))

    chat_title = None
    if result_title:
        for row in result_title:
            chat_title = row[0] if isinstance(row, (list, tuple)) else row.get("title")
            if _storage_backend() == "sqlite":
                deleted = row[1] if isinstance(row, (list, tuple)) else row.get("deleted_at")
                if deleted:
                    return None
            break
    if not chat_title:
        logger.info("Chat session not found or access denied for user %s, chat %s", user_id, chat_id)
        return None

    if _storage_backend() == "sqlite":
        query = """
        SELECT message_id, question, response, response_graph, graph_type, timestamp, insightful_questions
        FROM chat_history WHERE chat_id = ? AND user_id = ? ORDER BY timestamp ASC
        """
        result = _sqlite_execute(query, (chat_id, user_id), fetch=True)
    else:
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


def conversation_history_for_workflow(user_id: int, chat_id: str) -> list[dict] | None:
    """Build supervisor/workflow history from persisted turns (excludes the message not yet saved)."""
    pack = get_chat_history(user_id, chat_id)
    if not pack:
        return None
    out: list[dict] = []
    for item in pack.get("conversation_history") or []:
        q = item.get("question")
        if q:
            out.append({"user_input": str(q), "role": "user", "type": "text"})
        # Do not stuff assistant text into "user_input" (that poisons the supervisor
        # with prior large table outputs). For context, the model only needs prior user turns.
    return out


def soft_delete_chat_session(user_id: int, chat_id: str) -> bool:
    """Hide a session (SQLite) or remove rows (Snowflake fallback)."""
    if _storage_backend() == "sqlite":
        _sqlite_prepare()
        r = _sqlite_execute(
            "UPDATE chat_sessions SET deleted_at = datetime('now'), updated_at = datetime('now') "
            "WHERE chat_id = ? AND user_id = ? AND (deleted_at IS NULL OR deleted_at = '')",
            (chat_id, user_id),
            fetch=False,
        )
        return r is not None

    try:
        upd = f"UPDATE {_sessions_table()} SET deleted_at = CURRENT_TIMESTAMP() WHERE chat_id = %s AND user_id = %s"
        if execute_snowflake_query(upd, (chat_id, user_id)) is not None:
            return True
    except Exception as e:
        logger.warning("Snowflake soft-delete skipped: %s", e)
    execute_snowflake_query(
        f"DELETE FROM {_history_table()} WHERE chat_id = %s AND user_id = %s", (chat_id, user_id)
    )
    execute_snowflake_query(
        f"DELETE FROM {_sessions_table()} WHERE chat_id = %s AND user_id = %s", (chat_id, user_id)
    )
    return True
