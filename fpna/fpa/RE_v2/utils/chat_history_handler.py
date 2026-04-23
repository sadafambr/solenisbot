"""
Module Name: chat_history_handler.py

Description:
This module handles persistent chat session and message storage using SQLite.
It provides functions for creating chat sessions, saving messages, and
retrieving chat history.
"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

import os
import sqlite3
import uuid
import time
import json
import logging

from utils.title_generator import generate_session_title

# -----------------------------------------------------------------------------
# SECTION: Logger Setup
# -----------------------------------------------------------------------------

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# SECTION: Database Configuration
# -----------------------------------------------------------------------------

# Path to the SQLite database file for chat history
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chat_history.db")


def _get_db_connection():
    """Creates and returns a new SQLite connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# -----------------------------------------------------------------------------
# SECTION: Database Initialization
# -----------------------------------------------------------------------------

def initialize_chat_database():
    """
    Creates the chat_sessions and chat_history tables if they don't exist.
    Called once on application startup.
    """
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                chat_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT 'Untitled Chat',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                message_id INTEGER PRIMARY KEY,
                chat_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                response TEXT,
                response_graph TEXT,
                graph_type TEXT,
                insightful_questions TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chat_sessions(chat_id) ON DELETE CASCADE
            )
        """)

        conn.commit()
        logger.info("Chat database tables checked/created successfully.")

    except Exception as e:
        logger.error(f"Chat database initialization error: {e}")
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# SECTION: Chat Session Functions
# -----------------------------------------------------------------------------

def create_new_chat_session(user_id: int, title: str = "Untitled Chat") -> str:
    """
    Creates a new chat session for a user and returns the chat_id.

    Args:
        user_id (int): The ID of the user creating the session.
        title (str): The title of the chat session.

    Returns:
        str or None: The chat_id if created successfully, None otherwise.
    """
    chat_id = str(uuid.uuid4())
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO chat_sessions (chat_id, user_id, title) VALUES (?, ?, ?)",
            (chat_id, user_id, title),
        )
        conn.commit()
        return chat_id
    except Exception as e:
        logger.error(f"Error creating chat session: {e}")
        return None
    finally:
        conn.close()


def get_user_chat_sessions(user_id: int) -> list:
    """
    Gets all chat sessions for a user, ordered by most recent first.

    Args:
        user_id (int): The ID of the user.

    Returns:
        list or None: A list of session dicts, or None on error.
    """
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT chat_id, created_at, title FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        )
        rows = cursor.fetchall()
        return [
            {"chat_id": row["chat_id"], "created_at": row["created_at"], "title": row["title"]}
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error getting chat sessions: {e}")
        return None
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# SECTION: Chat Message Functions
# -----------------------------------------------------------------------------

def save_chat_message(
    user_id: int,
    chat_id: str,
    question: str,
    response: str = None,
    response_graph: dict = None,
    graph_type: str = None,
    insightful_questions: str = None,
) -> str:
    """
    Saves a message to a chat session.

    Args:
        user_id (int): The ID of the user.
        chat_id (str): The ID of the chat session.
        question (str): The user's question.
        response (str): The AI's text response.
        response_graph (dict): Graph data as a dict.
        graph_type (str): Type of graph.
        insightful_questions (str): Follow-up questions.

    Returns:
        str: Status string - SUCCESS, INVALID_CHAT_ID, DB_ERROR, etc.
    """
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()

        # Validate that the chat session exists
        cursor.execute(
            "SELECT chat_id FROM chat_sessions WHERE chat_id = ? AND user_id = ?",
            (chat_id, user_id),
        )
        if cursor.fetchone() is None:
            return "INVALID_CHAT_ID"

        message_id = int(time.time() * 1000)

        # Parse insightful_questions if it's a JSON string
        if isinstance(insightful_questions, str):
            try:
                insightful_questions = json.loads(insightful_questions)
            except Exception:
                insightful_questions = [insightful_questions]

        cursor.execute(
            """INSERT INTO chat_history
            (message_id, chat_id, user_id, question, response, response_graph, graph_type, insightful_questions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                message_id,
                chat_id,
                user_id,
                question,
                response,
                json.dumps(response_graph) if response_graph else None,
                graph_type,
                json.dumps(insightful_questions) if insightful_questions else None,
            ),
        )
        conn.commit()

        # --- Title generation logic ---
        # If the session title is still "Untitled Chat", generate a title
        cursor.execute(
            "SELECT title FROM chat_sessions WHERE chat_id = ? AND user_id = ?",
            (chat_id, user_id),
        )
        row = cursor.fetchone()
        chat_title = row["title"] if row else None

        if chat_title == "Untitled Chat":
            # Fetch all messages for this session
            cursor.execute(
                "SELECT question, response FROM chat_history WHERE chat_id = ? AND user_id = ? ORDER BY timestamp ASC",
                (chat_id, user_id),
            )
            messages = []
            for msg_row in cursor.fetchall():
                messages.append({"role": "user", "content": msg_row["question"]})
                if msg_row["response"]:
                    messages.append({"role": "assistant", "content": msg_row["response"]})

            try:
                new_title = generate_session_title(messages)
                cursor.execute(
                    "UPDATE chat_sessions SET title = ? WHERE chat_id = ?",
                    (new_title, chat_id),
                )
                conn.commit()
                logger.info(f"Updated chat title to: {new_title}")
            except Exception as e:
                logger.error(f"Error generating/updating session title: {e}")

        return "SUCCESS"

    except sqlite3.OperationalError as e:
        logger.error(f"DB connection error saving message: {e}")
        return "DB_CONNECTION_ERROR"
    except sqlite3.Error as e:
        logger.error(f"DB error saving message: {e}")
        return "DB_ERROR"
    except Exception as e:
        logger.error(f"Unexpected error saving message: {e}")
        return "UNEXPECTED_ERROR"
    finally:
        conn.close()


def get_chat_history(user_id: int, chat_id: str) -> dict:
    """
    Retrieves the message history for a specific chat session.

    Args:
        user_id (int): The ID of the user.
        chat_id (str): The ID of the chat session.

    Returns:
        dict or None: A dict with chat_id, title, and conversation_history.
    """
    conn = _get_db_connection()
    try:
        cursor = conn.cursor()

        # Get the chat session title
        cursor.execute(
            "SELECT title FROM chat_sessions WHERE chat_id = ? AND user_id = ?",
            (chat_id, user_id),
        )
        session_row = cursor.fetchone()
        if not session_row:
            logger.warning(f"Chat session not found or access denied for user {user_id}, chat {chat_id}")
            return None

        chat_title = session_row["title"]

        # Get chat messages
        cursor.execute(
            """SELECT message_id, question, response, response_graph, graph_type, timestamp, insightful_questions
            FROM chat_history
            WHERE chat_id = ? AND user_id = ?
            ORDER BY timestamp ASC""",
            (chat_id, user_id),
        )
        rows = cursor.fetchall()

        conversation = []
        for row in rows:
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
            "conversation_history": conversation,
        }

    except Exception as e:
        logger.error(f"Error getting chat history: {e}")
        return None
    finally:
        conn.close()

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------
