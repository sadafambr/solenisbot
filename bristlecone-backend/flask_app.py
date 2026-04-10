"""
Module Name: flask_app.py
 
Description: This module sets up a Flask application to expose API endpoints.
 
Available Endpoints:
 
1. /get-static-user-questions [GET]
   - Fetches a static list of user questions for display on the frontend.
 
2. /ask-operations [POST]
   - Handles the Ask Operations workflow, processing user input and generating responses.
 
3. /chat/* [Various]
   - Endpoints for chat history management.
 
"""
 
# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------
 
# Standard library imports
import os
import logging
# Third-party imports
from dotenv import load_dotenv
from datetime import timedelta
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
 
# Local application imports
# Import renamed validation function
from utils.flask_api_validations import validate_ask_operations_api_request_data
# Import renamed workflow graph function
from workflows.core_engine_workflow_graph import ask_algo_workflow_graph
from auth.auth_handler import register, login, refresh, initialize_database
# Import chat history functions
from utils.chat_history_handler import (
    create_new_chat_session,
    save_chat_message,
    get_user_chat_sessions,
    get_chat_history
)
 
# -----------------------------------------------------------------------------
# SECTION: Application Initialization and Configuration
# -----------------------------------------------------------------------------
 
# Initialize Flask app and load environment variables
app = Flask(__name__)

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.errorhandler(Exception)
def global_exception_handler(error):
    logger.exception("Unhandled exception in Flask app: %s", error)
    response = {
        "error": "Internal server error",
        "details": str(error)
    }
    return jsonify(response), 500
 
# Configure CORS - Allow specific frontend origin and credentials
# Adjust 'http://localhost:3000' if your frontend runs on a different port/domain
CORS(
    app,
    resources={r"/*": {"origins": "http://localhost:3000"}}, # Allows frontend origin
    supports_credentials=True,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "*"], # Allows necessary headers
    expose_headers=["*"]
)
 
load_dotenv()
 
# Configuration
SECRET_KEY = os.getenv("SECRET_KEY")
app.config['SECRET_KEY'] = SECRET_KEY
 
# --- JWT Configuration ---
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)  # Set access token to expire in 1 hour
jwt = JWTManager(app)
 
# --- Initialize Database ---
initialize_database()
 
 
@app.route('/auth/register', methods=['POST'])
def route_register():
    """
    API endpoint for user registration.
    """
    return register()
 
@app.route('/auth/login', methods=['POST'])
def route_login():
    """
    API endpoint for user login.
    """
    return login()
 
@app.route('/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def route_refresh():
    """
    API endpoint to refresh the access token.
    """
    return refresh()
 
 
# -----------------------------------------------------------------------------
# SECTION: Ask Operations Workflow Endpoint
# -----------------------------------------------------------------------------
 
@app.route('/ask-algo', methods=['POST'])
def ask_algo():
    """
    API endpoint for the Ask Algo workflow.
    """
    try:
        # Parse request body
        data = request.get_json()
 
        # Validate request data
        validation_error = validate_ask_operations_api_request_data(data)
        if validation_error:
            print("[ask-algo] validation_error:", validation_error)
            return validation_error
 
        # Extract required fields from API request body
        user_input = data.get("user_input")
        conversation_history = data.get("conversation_history")

        # Debug logging for visibility
        print("[ask-algo] Received request", {
            "user_input": user_input,
            "conversation_history_len": len(conversation_history) if isinstance(conversation_history, list) else 0,
            "conversation_history_preview": (conversation_history[-5:] if isinstance(conversation_history, list) else conversation_history),
        })

        # Enforce a hard conversation history cap to avoid context-length errors
        MAX_HISTORY_MESSAGES = int(os.getenv("MAX_ASK_ALGO_HISTORY_MESSAGES", 10))
        if isinstance(conversation_history, list):
            # Consider only minimal fields for the workflow (reduce token size)
            trimmed_history = conversation_history[-MAX_HISTORY_MESSAGES:]
            conversation_history = [
                {
                    "user_input": entry.get("user_input") or entry.get("content"),
                    "role": entry.get("role"),
                    "type": entry.get("type")
                }
                for entry in trimmed_history
                if isinstance(entry, dict)
            ]

        # Call the Ask Algo workflow
        algo_response = ask_algo_workflow_graph(user_input, conversation_history)

        print("[ask-algo] Workflow output:", {
            "type": type(algo_response),
            "keys": list(algo_response.keys()) if isinstance(algo_response, dict) else None,
            "conversation_preview": algo_response.get("conversation", {}).get("present_conversation", []) if isinstance(algo_response, dict) else None,
        })
 
        # --- Begin: Error propagation ---
        # If error is present in response, always include it in the top-level response
        error_msg = ""
        if isinstance(algo_response, dict):
            error_msg = algo_response.get("error", "")
            # If nested error in conversation
            if not error_msg and "conversation" in algo_response:
                conv = algo_response["conversation"]
                if isinstance(conv, dict) and "error" in conv:
                    error_msg = conv["error"]
        # Always include error field in response
        if error_msg:
            algo_response["error"] = error_msg
        # --- End: Error propagation ---
 
        return jsonify(algo_response), 200
 
    except Exception as error:
        logger.exception("Error in /ask-algo: %s", error)
        # Return structured error response (500) so frontend can render error details
        return jsonify({
            "error": "An error occurred while processing the request.",
            "details": str(error),
            "conversation": {
                "conversation_history": [],
                "present_conversation": [{
                    "user_input": data.get("user_input") if data else None,
                    "error": str(error)
                }]
            }
        }), 500
 
 
# -----------------------------------------------------------------------------
# SECTION: Chat History Endpoints
# -----------------------------------------------------------------------------
 
@app.route('/chat/chat_sessions', methods=['GET'])
def route_get_user_chat_sessions():
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"status": "error", "message": "Missing user_id"}), 400
    sessions = get_user_chat_sessions(user_id)
    if sessions is None:
        return jsonify({"status": "error", "message": "No chat sessions found"}), 404
    return jsonify({"status": "success", "sessions": sessions}), 200
 
@app.route('/chat/create_chat', methods=['POST'])
def route_create_chat_session():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"status": "error", "message": "Missing user_id"}), 400
    title = data.get("title", "Untitled Chat")
    chat_id = create_new_chat_session(int(user_id), title)
    if chat_id:
        return jsonify({"status": "success", "chat_id": chat_id}), 201
    else:
        return jsonify({"status": "error", "message": "Failed to create chat session"}), 500
 
@app.route('/chat/get_chat/<string:chat_id>', methods=['GET'])
def route_get_chat_history(chat_id):
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400
    try:
        history_data = get_chat_history(user_id, chat_id)
        if history_data is None:
            return jsonify({"error": "Chat history not found or access denied"}), 404
        return jsonify(history_data), 200
    except ValueError:
        return jsonify({"error": "Invalid chat ID format"}), 400
    except Exception as e:
        print(f"Error in /chat/get_chat/<chat_id> endpoint: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500
 
@app.route('/chat/save_message', methods=['POST'])
def route_save_chat_message():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400
 
    user_id = data.get("user_id")
    chat_id = data.get("chat_id")
    question = data.get("question")
 
    if not user_id or not chat_id or not question:
        return jsonify({"error": "Missing required fields: user_id, chat_id, question"}), 400
 
    response_content = data.get("response")
    response_graph = data.get("response_graph")
    graph_type = data.get("graph_type")
    insightful_questions = data.get("insightful_questions")
 
    save_status = save_chat_message(
        int(user_id), chat_id, question, response_content, response_graph, graph_type, insightful_questions
    )
 
    if save_status == "SUCCESS":
        return jsonify({"status": "success"}), 200
    elif save_status == "INVALID_CHAT_ID":
        return jsonify({"error": "Invalid chat session ID. The session may not exist or may have been deleted.", "code": "INVALID_CHAT_ID"}), 404
    elif save_status == "DB_CONNECTION_ERROR":
        return jsonify({"error": "Database connection error. Failed to save message."}), 500
    elif save_status == "DB_ERROR":
        return jsonify({"error": "Failed to save message due to a database error."}), 500
    elif save_status == "UNEXPECTED_ERROR":
        return jsonify({"error": "Failed to save message due to an unexpected server error."}), 500
    else:
        print(f"Unknown save_status from save_chat_message: {save_status}")
        return jsonify({"error": "An unknown error occurred while saving the message."}), 500
 
# -----------------------------------------------------------------------------
# SECTION: Application Entry Point
# -----------------------------------------------------------------------------
 
if __name__ == '__main__':
    # Ensure .env variables are loaded in this execution context
    load_dotenv()
   
    HOST = os.getenv('FLASK_RUN_HOST', '0.0.0.0')
    # Default to 5001 if not found in env, just to be safe
    PORT = int(os.getenv('FLASK_RUN_PORT', '5000'))
    # Read FLASK_DEBUG from env, default to True if not set
    DEBUG_MODE = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
 
    print(f"Attempting to start Flask app on {HOST}:{PORT} with Debug={DEBUG_MODE}")
    app.run(debug=DEBUG_MODE, host=HOST, port=PORT)
 
# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------