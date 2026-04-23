import os
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_refresh_token, jwt_required, get_jwt_identity, create_access_token
from google.cloud import bigquery
from dotenv import load_dotenv
import bcrypt
import uuid
 
# Load environment variables from .env file
load_dotenv()
 
auth_blueprint = Blueprint("auth", __name__)
 
# BigQuery configuration
PROJECT_ID = os.getenv("BQ_PROJECT_ID", "bcone-sales-insights-dev-prj")
AUTH_DATASET = os.getenv("BQ_AUTH_DATASET", "auth_data")
USERS_TABLE = f"{PROJECT_ID}.{AUTH_DATASET}.users"
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
    query = f"SELECT email FROM `{USERS_TABLE}` WHERE email = @email"
    params = [bigquery.ScalarQueryParameter("email", "STRING", email)]
    result = execute_bigquery_query(query, params)
 
    if result and len(list(result)) > 0:
        return jsonify({"status": "error", "message": "User already exists"}), 400
 
    # Insert the new user into BigQuery
    query = f"""
    INSERT INTO `{USERS_TABLE}` (id, email, password, first_name, last_name, created_at)
    VALUES (@id, @email, @password, @first_name, @last_name, CURRENT_TIMESTAMP())
    """
    params = [
        bigquery.ScalarQueryParameter("id", "INT64", int(uuid.uuid4().int % 1e9)),  # Simulate auto-increment
        bigquery.ScalarQueryParameter("email", "STRING", email),
        bigquery.ScalarQueryParameter("password", "STRING", hashed_password),
        bigquery.ScalarQueryParameter("first_name", "STRING", first_name),
        bigquery.ScalarQueryParameter("last_name", "STRING", last_name),
    ]
    result = execute_bigquery_query(query, params)
 
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
 
# Login endpoint
@auth_blueprint.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")
 
    # Fetch user details from BigQuery
    query = f"SELECT id, email, password, first_name, last_name FROM `{USERS_TABLE}` WHERE email = @email"
    params = [bigquery.ScalarQueryParameter("email", "STRING", email)]
    result = execute_bigquery_query(query, params)
 
    user = list(result) if result else None
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
        else:
            return jsonify({"status": "error", "message": "Invalid email or password"}), 401
    else:
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401
 
# Refresh token endpoint
@auth_blueprint.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user_id)
    return jsonify({"access_token": new_access_token})
 
# --- Database Initialization ---
def initialize_database():
    """Creates required tables in BigQuery if they don't exist and adds initial users."""
    try:
        # Create users table
        users_schema = [
            bigquery.SchemaField("id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("email", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("password", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("first_name", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("last_name", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
        ]
        bigquery_client.create_table(bigquery.Table(f"{USERS_TABLE}", schema=users_schema), exists_ok=True)
        print("Users table checked/created successfully.")
 
        # Create chat_sessions table
        chat_sessions_schema = [
            bigquery.SchemaField("chat_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("user_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("title", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="NULLABLE"),
        ]
        bigquery_client.create_table(bigquery.Table(f"{CHAT_SESSIONS_TABLE}", schema=chat_sessions_schema), exists_ok=True)
        print("Chat sessions table checked/created successfully.")
 
        # Create chat_history table
        chat_history_schema = [
            bigquery.SchemaField("message_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("chat_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("user_id", "INTEGER", mode="REQUIRED"),
            bigquery.SchemaField("question", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("response", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("response_graph", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("graph_type", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("insightful_questions", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("timestamp", "TIMESTAMP", mode="NULLABLE"),
        ]
        bigquery_client.create_table(bigquery.Table(f"{CHAT_HISTORY_TABLE}", schema=chat_history_schema), exists_ok=True)
        print("Chat history table checked/created successfully.")
 
        # Add initial users to the users table
        initial_users = [
            {"email": "nraju@bcone.com", "password": "password123", "first_name": "Raju", "last_name": "Shetty"},
            {"email": "abrol.nitin@bristlecone.com", "password": "nitin@123", "first_name": "Nitin", "last_name": "Abrol"},
            {"email": "pankaj.dontamsetty@bristlecone.com", "password": "pankaj@123", "first_name": "Pankaj", "last_name": "Dontamsetty"},
            {"email": "arun.muraleedharan@bristlecone.com", "password": "arun@123", "first_name": "Arun", "last_name": "Muraleedharan"},
            {"email": "shantanu.rajan@bristlecone.com", "password": "shantanu@123", "first_name": "Shantanu", "last_name": "Rajan"},
            {"email": "mayur.kulkarni@bristlecone.com", "password": "mayur@123", "first_name": "Mayur", "last_name": "Kulkarni"},
            {"email": "vinay.chowdhary@bristlecone.com", "password": "vinay@123", "first_name": "Vinay", "last_name": "Chowdhary"}
        ]
        for user in initial_users:
            query = f"SELECT email FROM `{USERS_TABLE}` WHERE email = @email"
            params = [bigquery.ScalarQueryParameter("email", "STRING", user["email"])]
            result = execute_bigquery_query(query, params)
 
            if len(list(result)) == 0:
                hashed_password = bcrypt.hashpw(user["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                query = f"""
                INSERT INTO `{USERS_TABLE}` (id, email, password, first_name, last_name, created_at)
                VALUES (@id, @email, @password, @first_name, @last_name, CURRENT_TIMESTAMP())
                """
                params = [
                    bigquery.ScalarQueryParameter("id", "INTEGER", int(uuid.uuid4().int % 1e9)),  # Simulate auto-increment
                    bigquery.ScalarQueryParameter("email", "STRING", user["email"]),
                    bigquery.ScalarQueryParameter("password", "STRING", hashed_password),
                    bigquery.ScalarQueryParameter("first_name", "STRING", user["first_name"]),
                    bigquery.ScalarQueryParameter("last_name", "STRING", user["last_name"]),
                ]
                execute_bigquery_query(query, params)
                print(f"Added initial user: {user['email']}")
 
    except Exception as e:
        print(f"BigQuery initialization error: {e}")