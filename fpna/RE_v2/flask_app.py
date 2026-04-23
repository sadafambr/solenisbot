"""
Module Name: flask_app.py
 
Description: This module sets up a Flask application to expose API endpoints for Auth, Chat, and Workflow.
"""
 
# ----------------------------------------------------------------------------- 
# SECTION: Imports 
# ----------------------------------------------------------------------------- 
 
import logging
import os
import yaml
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
 
# Local application imports
from utils.chat_history_handler import (
    initialize_chat_tables,
    create_new_chat_session, 
    save_chat_message, 
    get_user_chat_sessions, 
    get_chat_history
)
from workflows.core_engine_workflow_graph import solenis_bot_workflow_graph
import utils.logger_config
 
# ----------------------------------------------------------------------------- 
# SECTION: Application Initialization and Configuration
# ----------------------------------------------------------------------------- 
 
load_dotenv()
app = Flask(__name__)
 
# CORS Configuration - Allow all origins for dev, restrict in prod if needed
CORS(app, resources={r"/*": {"origins": "*"}})
 
# Initialize Database
with app.app_context():
    initialize_chat_tables()
 
# Configuration
EXP_TIME = int(os.getenv("TOKEN_EXPIRY_SECONDS", "3600"))
app.config['TOKEN_EXPIRY_SECONDS'] = EXP_TIME
 
# ----------------------------------------------------------------------------- 
# SECTION: Logger Setup
# ----------------------------------------------------------------------------- 
 
logger = logging.getLogger(__name__)
 
# ----------------------------------------------------------------------------- 
# SECTION: Chat & Session Endpoints
# ----------------------------------------------------------------------------- 
 
@app.route('/sessions', methods=['GET'])
def get_sessions():
    """Returns all chat sessions for a user."""
    user_id = int(request.args.get("user_id", 1))
    sessions = get_user_chat_sessions(user_id)
    if sessions is None:
        return jsonify({"error": "Failed to fetch sessions"}), 500
    return jsonify(sessions), 200
 
@app.route('/sessions/<chat_id>', methods=['GET'])
def get_session_history(chat_id):
    """Returns the message history for a specific chat ID and user."""
    user_id = int(request.args.get("user_id", 1))
    history = get_chat_history(user_id, chat_id)
    if history is None:
        return jsonify({"error": "Session not found or access denied"}), 404
    return jsonify(history), 200
 
@app.route('/sessions/new', methods=['POST'])
def start_new_session():
    """Creates a new chat session."""
    data = request.get_json() or {}
    user_id = int(data.get("user_id", 1))
    title = data.get("title", "Untitled Chat")
    chat_id = create_new_chat_session(user_id, title)
    if not chat_id:
        return jsonify({"error": "Failed to create session"}), 500
    return jsonify({"chat_id": chat_id, "title": title}), 201
 
# ----------------------------------------------------------------------------- 
# SECTION: Solenis Bot Workflow Endpoint
# ----------------------------------------------------------------------------- 
 
@app.route('/solenis-bot', methods=['POST'])
def solenis_bot():
    """
    API endpoint for the Solenis Bot workflow.
    """
    try:
        data = request.get_json() or {}
        user_id = int(data.get("user_id", 1))
 
        user_input = data.get("user_input")
        conversation_history = data.get("conversation_history", [])
        chat_id = data.get("chat_id")
 
        if not user_input:
            return jsonify({"error": "user_input is required"}), 400
 
        logger.info(f"User {user_id} in session {chat_id} asked: {user_input}")
 
        # Call the Workflow Graph
        workflow_response = solenis_bot_workflow_graph(user_input, conversation_history)
        
        # Extract results for saving
        # Note: solenis_bot_workflow_graph returns a dict with 'conversation' and other keys
        is_clarification = workflow_response.get("requires_clarification", False)
        
        if not is_clarification and chat_id:
            # Extract values for Snowflake storage
            res_conv = workflow_response.get("conversation", {}).get("present_conversation", [])
            last_msg = res_conv[-1] if res_conv else {}
            
            # Extract fields expected by Snowflake schema
            response_text = ""
            response_graph = None
            graph_type = ""
            insightful_questions = []
 
            # In the new structure, graph_and_summary_agent output contains summary and graph_output
            gas_output = last_msg.get("graph_and_summary_agent", {})
            if isinstance(gas_output, dict):
                response_text = gas_output.get("summary", "")
                response_graph = gas_output.get("graph_output", {}).get("parameters", {})
                graph_type = gas_output.get("graph_output", {}).get("function_name", "")
            
            insightful_questions = last_msg.get("insightful_questions", [])
 
            # Save to history
            save_chat_message(
                user_id=user_id,
                chat_id=chat_id,
                question=user_input,
                response=response_text,
                response_graph=response_graph,
                graph_type=graph_type,
                insightful_questions=insightful_questions
            )
 
        return jsonify(workflow_response), 200
 
    except Exception as error:
        logger.error(f"Error in '/solenis-bot' endpoint: {str(error)}", exc_info=True)
        return jsonify({
            "error": "An error occurred while processing the request.",
            "details": str(error)
        }), 500
 
# ----------------------------------------------------------------------------- 
# SECTION: Static Data Endpoints (Legacy support)
# ----------------------------------------------------------------------------- 
 
@app.route('/get-static-user-questions', methods=['GET'])
def get_static_user_questions():
    try:
        from static.static_user_queries_handler import get_static_user_questions_list
        questions_list_for_chip_display = get_static_user_questions_list()
        
        with open('static/static_sidebar_user_queries.yaml', 'r') as file:
            yaml_data = yaml.safe_load(file)
            questions_list_for_side_bar = yaml_data.get('static_side_bar_user_questions', [])
 
        return jsonify({
            "chip_display_static_questions": questions_list_for_chip_display,
            "side_bar_static_questions": questions_list_for_side_bar
        }), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
 
# ----------------------------------------------------------------------------- 
# SECTION: Application Entry Point
# ----------------------------------------------------------------------------- 
 
if __name__ == '__main__':
    # Running on fixed port 5000 to match frontend's expected API URL
    app.run(debug=True, host='0.0.0.0', port=5000)
 
# ----------------------------------------------------------------------------- 
# END OF MODULE 
# ----------------------------------------------------------------------------- 
