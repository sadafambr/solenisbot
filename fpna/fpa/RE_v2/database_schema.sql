-- SQLite Schema for RE_v2 Backend
-- Two separate databases: users.db and chat_history.db

-- ===========================================================================
-- DATABASE: users.db (User Authentication)
-- ===========================================================================

-- Users Table: Stores user login information.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================================================
-- DATABASE: chat_history.db (Chat History)
-- ===========================================================================

-- Chat Sessions Table: Stores metadata for each chat session.
CREATE TABLE IF NOT EXISTS chat_sessions (
    chat_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Chat',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat History Table: Stores individual messages within chat sessions.
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
);
