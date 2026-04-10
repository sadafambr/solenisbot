import uuid

import bcrypt
import snowflake.connector
from dotenv import load_dotenv
from flask import jsonify, request
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required

from utils.snowflake_env import snowflake_connect_kwargs, snowflake_fq_table

load_dotenv()


def get_snowflake_connection():
    return snowflake.connector.connect(**snowflake_connect_kwargs())


def execute_snowflake_query(query, params=None, fetchone=False, fetchall=True):
    """Runs a query. For DML with fetchall=False, returns True on success instead of None."""
    try:
        conn = get_snowflake_connection()
        cur = conn.cursor()
        cur.execute(query, params or [])
        if fetchone:
            result = cur.fetchone()
        elif fetchall:
            result = cur.fetchall()
        else:
            result = True
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Snowflake query execution error: {e}")
        return None


def _is_read_only_database() -> bool:
    """Returns True when configured database is Snowflake shared read-only sample data."""
    kwargs = snowflake_connect_kwargs()
    database = kwargs.get("database", "")
    return str(database).strip().upper() == "SNOWFLAKE_SAMPLE_DATA"


def initialize_database():
    """Creates required tables in Snowflake if they don't exist."""
    if _is_read_only_database():
        print("Snowflake initialization notice: Running against SNOWFLAKE_SAMPLE_DATA (read-only); skipping table creation.")
        return

    try:
        users_table = snowflake_fq_table("USERS")
        sessions_table = snowflake_fq_table("CHAT_SESSIONS")
        history_table = snowflake_fq_table("CHAT_HISTORY")

        conn = get_snowflake_connection()
        cur = conn.cursor()

        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {users_table} (
                id NUMBER PRIMARY KEY,
                email VARCHAR NOT NULL,
                password VARCHAR NOT NULL,
                first_name VARCHAR,
                last_name VARCHAR,
                created_at TIMESTAMP_LTZ
            )
            """
        )

        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {sessions_table} (
                chat_id VARCHAR PRIMARY KEY,
                user_id NUMBER NOT NULL,
                title VARCHAR,
                created_at TIMESTAMP_LTZ
            )
            """
        )

        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {history_table} (
                message_id NUMBER PRIMARY KEY,
                chat_id VARCHAR NOT NULL,
                user_id NUMBER NOT NULL,
                question VARCHAR NOT NULL,
                response VARCHAR,
                response_graph VARCHAR,
                graph_type VARCHAR,
                insightful_questions VARCHAR,
                timestamp TIMESTAMP_LTZ
            )
            """
        )

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Snowflake initialization error: {e}")


def register():
    data = request.json
    email = data.get("email")
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    password = data.get("password")

    if not email or not isinstance(email, str):
        return jsonify({"status": "error", "message": "Invalid email format"}), 400
    if not first_name or not isinstance(first_name, str):
        return jsonify({"status": "error", "message": "First name is required"}), 400
    if not last_name or not isinstance(last_name, str):
        return jsonify({"status": "error", "message": "Last name is required"}), 400
    if not password:
        return jsonify({"status": "error", "message": "Password is required"}), 400

    hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    query = f"SELECT email FROM {snowflake_fq_table('USERS')} WHERE email = %s"
    result = execute_snowflake_query(query, (email,))

    if result and len(result) > 0:
        return jsonify({"status": "error", "message": "User already exists"}), 400

    insert_q = f"""
    INSERT INTO {snowflake_fq_table('USERS')} (id, email, password, first_name, last_name, created_at)
    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP())
    """
    user_id = int(uuid.uuid4().int % 1e9)
    ok = execute_snowflake_query(insert_q, (user_id, email, hashed_password, first_name, last_name), fetchone=False, fetchall=False)

    if ok:
        return (
            jsonify(
                {
                    "status": "success",
                    "message": "User registered successfully",
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                }
            ),
            201,
        )
    return jsonify({"status": "error", "message": "An internal error occurred during registration."}), 500


@jwt_required(refresh=True)
def refresh():
    current_user = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user)
    return jsonify({"status": "success", "access_token": new_access_token}), 200


def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password are required"}), 400

    query = f"SELECT id, email, password, first_name, last_name FROM {snowflake_fq_table('USERS')} WHERE email = %s"
    result = execute_snowflake_query(query, (email,))

    if not result or len(result) == 0:
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401

    row = result[0]
    user_id, user_email, hashed_password, first_name, last_name = row

    if not bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8")):
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401

    access_token = create_access_token(identity=str(user_id))
    refresh_token = create_refresh_token(identity=str(user_id))
    return jsonify(
        {
            "status": "success",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user_id": user_id,
            "email": user_email,
            "first_name": first_name,
            "last_name": last_name,
        }
    )
