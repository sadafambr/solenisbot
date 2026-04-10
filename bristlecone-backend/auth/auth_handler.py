# Database initialization function
def initialize_database():
    """Creates required tables in Snowflake if they don't exist and adds initial users."""
    try:
        conn = get_snowflake_connection()
        cur = conn.cursor()

        # Create USERS table
        cur.execute(f'''
            CREATE TABLE IF NOT EXISTS {USERS_TABLE} (
                id NUMBER PRIMARY KEY,
                email VARCHAR NOT NULL,
                password VARCHAR NOT NULL,
                first_name VARCHAR,
                last_name VARCHAR,
                created_at TIMESTAMP_LTZ
            )
        ''')
        print("USERS table checked/created successfully.")

        # Create CHAT_SESSIONS table
        cur.execute(f'''
            CREATE TABLE IF NOT EXISTS {CHAT_SESSIONS_TABLE} (
                chat_id VARCHAR PRIMARY KEY,
                user_id NUMBER NOT NULL,
                title VARCHAR,
                created_at TIMESTAMP_LTZ
            )
        ''')
        print("CHAT_SESSIONS table checked/created successfully.")

        # Create CHAT_HISTORY table
        cur.execute(f'''
            CREATE TABLE IF NOT EXISTS {CHAT_HISTORY_TABLE} (
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
        ''')
        print("CHAT_HISTORY table checked/created successfully.")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Snowflake initialization error: {e}")
# Refresh endpoint

import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_refresh_token, jwt_required, get_jwt_identity, create_access_token
import snowflake.connector
from dotenv import load_dotenv
import bcrypt
import uuid
 
# Load environment variables from .env file
load_dotenv()
 
auth_blueprint = Blueprint("auth", __name__)
 

# Snowflake configuration
SNOWFLAKE_USER = os.getenv("SNOWFLAKE_USER")
SNOWFLAKE_PASSWORD = os.getenv("SNOWFLAKE_PASSWORD")
SNOWFLAKE_ACCOUNT = os.getenv("SNOWFLAKE_ACCOUNT")
SNOWFLAKE_DATABASE = os.getenv("SNOWFLAKE_DATABASE")
SNOWFLAKE_SCHEMA = os.getenv("SNOWFLAKE_SCHEMA")
SNOWFLAKE_WAREHOUSE = os.getenv("SNOWFLAKE_WAREHOUSE")

USERS_TABLE = f'"{SNOWFLAKE_DATABASE}"."{SNOWFLAKE_SCHEMA}"."USERS"'
CHAT_SESSIONS_TABLE = f'"{SNOWFLAKE_DATABASE}"."{SNOWFLAKE_SCHEMA}"."CHAT_SESSIONS"'
CHAT_HISTORY_TABLE = f'"{SNOWFLAKE_DATABASE}"."{SNOWFLAKE_SCHEMA}"."CHAT_HISTORY"'

# Initialize Snowflake connection
def get_snowflake_connection():
    return snowflake.connector.connect(
        user=SNOWFLAKE_USER,
        password=SNOWFLAKE_PASSWORD,
        account=SNOWFLAKE_ACCOUNT,
        warehouse=SNOWFLAKE_WAREHOUSE,
        database=SNOWFLAKE_DATABASE,
        schema=SNOWFLAKE_SCHEMA
    )
 

def execute_snowflake_query(query, params=None, fetchone=False, fetchall=True):
    """Executes a Snowflake query with optional parameters."""
    try:
        conn = get_snowflake_connection()
        cur = conn.cursor()
        cur.execute(query, params or [])
        if fetchone:
            result = cur.fetchone()
        elif fetchall:
            result = cur.fetchall()
        else:
            result = None
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"Snowflake query execution error: {e}")
        return None
 
# Register endpoint
@auth_blueprint.route("/register", methods=["POST"])
def register():
    data = request.json
    email = data.get("email")
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    password = data.get("password")
 
    # Basic validation
    if not email or not isinstance(email, str):
        return jsonify({"status": "error", "message": "Invalid email format"}), 400
    if not first_name or not isinstance(first_name, str):
        return jsonify({"status": "error", "message": "First name is required"}), 400
    if not last_name or not isinstance(last_name, str):
        return jsonify({"status": "error", "message": "Last name is required"}), 400
    if not password:
        return jsonify({"status": "error", "message": "Password is required"}), 400
 
    # Hash the password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
 
    # Check if the user already exists

    query = f"SELECT email FROM {USERS_TABLE} WHERE email = %s"
    params = (email,)
    result = execute_snowflake_query(query, params)
 
    if result and len(result) > 0:
        return jsonify({"status": "error", "message": "User already exists"}), 400
 
    # Insert the new user into BigQuery

    query = f"""
    INSERT INTO {USERS_TABLE} (id, email, password, first_name, last_name, created_at)
    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP())
    """
    user_id = int(uuid.uuid4().int % 1e9)
    params = (user_id, email, hashed_password, first_name, last_name)
    result = execute_snowflake_query(query, params, fetchone=False, fetchall=False)
 
    if result:
        return jsonify({
            "status": "success",
            "message": "User registered successfully",
            "email": email,
            "first_name": first_name,
            "last_name": last_name
        }), 201
    else:
        return jsonify({"status": "error", "message": "An internal error occurred during registration."}), 500
@auth_blueprint.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    current_user = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user)
    return jsonify({
        "status": "success",
        "access_token": new_access_token
    }), 200

# Login endpoint
@auth_blueprint.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")
 
    # Fetch user details from BigQuery

    query = f"SELECT id, email, password, first_name, last_name FROM {USERS_TABLE} WHERE email = %s"
    params = (email,)
    result = execute_snowflake_query(query, params)
 

    user = result if result else None
    if user and len(user) > 0:
        user = user[0]
        user_id, _, hashed_password, first_name, last_name = user
 
        # Verify the password
        if bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8')):
            access_token = create_access_token(identity=user_id)
            refresh_token = create_refresh_token(identity=user_id)
            return jsonify({
                "status": "success",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user_id": user_id,
                "first_name": first_name,
                "last_name": last_name
            })