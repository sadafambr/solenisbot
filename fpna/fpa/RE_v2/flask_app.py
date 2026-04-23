"""
Module Name: flask_app.py

Description: This module sets up a Flask application to expose API endpoints.

Available Endpoints:

1. /get-static-user-questions [GET]
   - Fetches a static list of user questions for display on the frontend.

2. /solenis-bot [POST]
   - Handles the Solenis-bot workflow, processing user input and generating responses.

3. /chat/* [Various]
   - Endpoints for chat history management.
"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

# Standard library imports
import logging
import os
import yaml

# Third-party imports
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Local application imports
from static.static_user_queries_handler import get_static_user_questions_list, is_user_input_in_static_queries, execute_static_query_for_user_input
from utils.flask_api_validations import validate_solenis_bot_api_request_data
from utils.chat_history_handler import (
    initialize_chat_database,
    create_new_chat_session,
    save_chat_message,
    get_user_chat_sessions,
    get_chat_history,
)
from workflows.core_engine_workflow_graph import solenis_bot_workflow_graph
import utils.logger_config

# Load env vars early so config below can use them
load_dotenv()

# -----------------------------------------------------------------------------
# SECTION: Application Initialization and Configuration
# -----------------------------------------------------------------------------

app = Flask(__name__)

# Configure CORS
CORS(
    app,
    resources={r"/*": {"origins": "http://localhost:3000"}},
    supports_credentials=True,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "*"],
    expose_headers=["*"],
)

# Configuration
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY")
DEFAULT_USER_ID = 1

# -----------------------------------------------------------------------------
# SECTION: Logger Setup
# -----------------------------------------------------------------------------

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# SECTION: List of Static User Questions Endpoint
# -----------------------------------------------------------------------------

@app.route('/get-static-user-questions', methods=['GET'])
def get_static_user_questions():
    """
    API endpoint to get a list of static user questions
    and display them on chips in the frontend UI.
    """
    try:
        questions_list_for_chip_display = get_static_user_questions_list()

        with open('static/static_sidebar_user_queries.yaml', 'r') as file:
            yaml_data = yaml.safe_load(file)
            questions_list_for_side_bar = yaml_data.get('static_side_bar_user_questions', [])

        return jsonify({
            "chip_display_static_questions": questions_list_for_chip_display,
            "side_bar_static_questions": questions_list_for_side_bar
        }), 200

    except Exception as error:
        logger.error(f"Error in '/get-static-user-questions' endpoint: {str(error)}")
        return jsonify({
            "error": "An error occurred while processing the request.",
            "details": str(error)
        }), 500


# -----------------------------------------------------------------------------
# SECTION: Solenis-bot Workflow Endpoint
# -----------------------------------------------------------------------------

@app.route('/solenis-bot', methods=['POST'])
def solenis_bot():
    """API endpoint for the Solenis-bot workflow."""
    try:
        data = request.get_json()

        validation_error = validate_solenis_bot_api_request_data(data)
        if validation_error:
            return validation_error

        user_input = data.get("user_input")
        conversation_history = data.get("conversation_history")

        logger.info(f"Received data: {data}")

        if is_user_input_in_static_queries(user_input):
            static_response = execute_static_query_for_user_input(user_input, conversation_history)
            return jsonify(static_response), 200
        else:
            # Execute the Solenis-bot workflow graph for dynamic queries
            workflow_response = solenis_bot_workflow_graph(user_input, conversation_history)
            return jsonify(workflow_response), 200

    except Exception as error:
        logger.error(f"Error in '/solenis-bot' endpoint: {str(error)}")
        return jsonify({
            "error": "An error occurred while processing the request.",
            "details": str(error)
        }), 500


# -----------------------------------------------------------------------------
# SECTION: Chat History Endpoints
# -----------------------------------------------------------------------------

@app.route('/chat/chat_sessions', methods=['GET'])
def route_get_user_chat_sessions():
    sessions = get_user_chat_sessions(DEFAULT_USER_ID)
    if sessions is None:
        return jsonify({"status": "error", "message": "No chat sessions found"}), 404
    return jsonify({"status": "success", "sessions": sessions}), 200

@app.route('/chat/create_chat', methods=['POST'])
def route_create_chat_session():
    data = request.get_json() or {}
    title = data.get("title", "Untitled Chat")
    chat_id = create_new_chat_session(DEFAULT_USER_ID, title)
    if chat_id:
        return jsonify({"status": "success", "chat_id": chat_id}), 201
    else:
        return jsonify({"status": "error", "message": "Failed to create chat session"}), 500

@app.route('/chat/get_chat/<string:chat_id>', methods=['GET'])
def route_get_chat_history(chat_id):
    try:
        history_data = get_chat_history(DEFAULT_USER_ID, chat_id)
        if history_data is None:
            return jsonify({"error": "Chat history not found or access denied"}), 404
        return jsonify(history_data), 200
    except ValueError:
        return jsonify({"error": "Invalid chat ID format"}), 400
    except Exception as e:
        logger.error(f"Error in /chat/get_chat/<chat_id> endpoint: {e}")
        return jsonify({"error": "An unexpected error occurred"}), 500

@app.route('/chat/save_message', methods=['POST'])
def route_save_chat_message():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    chat_id = data.get("chat_id")
    question = data.get("question")

    if not chat_id or not question:
        return jsonify({"error": "Missing required fields: chat_id, question"}), 400

    response_content = data.get("response")
    response_graph = data.get("response_graph")
    graph_type = data.get("graph_type")
    insightful_questions = data.get("insightful_questions")

    save_status = save_chat_message(
        DEFAULT_USER_ID, chat_id, question, response_content, response_graph, graph_type, insightful_questions
    )

    if save_status == "SUCCESS":
        return jsonify({"status": "success"}), 200
    elif save_status == "INVALID_CHAT_ID":
        return jsonify({"error": "Invalid chat session ID.", "code": "INVALID_CHAT_ID"}), 404
    elif save_status == "DB_CONNECTION_ERROR":
        return jsonify({"error": "Database connection error. Failed to save message."}), 500
    elif save_status == "DB_ERROR":
        return jsonify({"error": "Failed to save message due to a database error."}), 500
    elif save_status == "UNEXPECTED_ERROR":
        return jsonify({"error": "Failed to save message due to an unexpected server error."}), 500
    else:
        logger.error(f"Unknown save_status from save_chat_message: {save_status}")
        return jsonify({"error": "An unknown error occurred while saving the message."}), 500


# -----------------------------------------------------------------------------
# SECTION: Application Entry Point
# -----------------------------------------------------------------------------

if __name__ == '__main__':
    HOST = os.getenv('FLASK_RUN_HOST', '0.0.0.0')
    PORT = int(os.getenv('FLASK_RUN_PORT', '5000'))
    DEBUG_MODE = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

    # FIX: Only initialize DBs once — not in the reloader child process
    # and not at module level where a hanging connection blocks startup.
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        print(f"Starting Flask app on {HOST}:{PORT} | Debug={DEBUG_MODE}")
        print("Initializing databases...")
        try:
            initialize_chat_database()
            print("Databases initialized successfully.")
        except Exception as e:
            print(f"ERROR: Database initialization failed: {e}")
            print("Check your DB connection settings in .env and ensure the DB server is running.")
            raise SystemExit(1)

    app.run(debug=DEBUG_MODE, host=HOST, port=PORT)