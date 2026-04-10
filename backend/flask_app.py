"""
Flask API for RE_v2: Ellis/Solenis workflow plus Bristlecone-style auth and chat history.
"""

import logging
import os
from datetime import timedelta

import yaml
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required

from auth.auth_handler import initialize_database, login, refresh, register
from static.static_user_queries_handler import (
    execute_static_query_for_user_input,
    get_static_user_questions_list,
    is_user_input_in_static_queries,
)
from utils.chat_history_handler import (
    create_new_chat_session,
    get_chat_history,
    get_user_chat_sessions,
    refresh_chat_session_title,
    save_chat_message,
)
from utils.flask_api_validations import validate_ask_ellis_api_request_data
from workflows.core_engine_workflow_graph import ask_ellis_workflow_graph
import utils.logger_config

app = Flask(__name__)

logger = logging.getLogger(__name__)

_frontend_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080",
).split(",")
logger.info("Configured CORS origins: %s", _frontend_origins)
CORS(
    app,
    resources={r"/*": {"origins": _frontend_origins}},
    supports_credentials=True,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "*"],
    expose_headers=["*"],
)

load_dotenv()

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-change-me")
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "jwt-dev-change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
JWTManager(app)

EXP_TIME = int(os.getenv("TOKEN_EXPIRY_SECONDS", "3600"))
app.config["TOKEN_EXPIRY_SECONDS"] = EXP_TIME

logger = logging.getLogger(__name__)

initialize_database()


def _process_ask_request():
    """Shared body for /Solenis-bot and /ask-algo."""
    data = request.get_json()
    validation_error = validate_ask_ellis_api_request_data(data)
    if validation_error:
        return validation_error

    user_input = data.get("user_input")
    conversation_history = data.get("conversation_history") or []
    logger.info("Received ask request: user_input present=%s history_len=%s", bool(user_input), len(conversation_history) if isinstance(conversation_history, list) else 0)

    # Force history trimming at request layer too to prevent token state explosion
    if isinstance(conversation_history, list):
        conversation_history = conversation_history[-10:]

    if is_user_input_in_static_queries(user_input):
        ellis_response = execute_static_query_for_user_input(user_input, conversation_history)
        return jsonify(ellis_response), 200

    ellis_response = ask_ellis_workflow_graph(user_input, conversation_history)

    error_msg = ""
    if isinstance(ellis_response, dict):
        error_msg = ellis_response.get("error", "")
        if not error_msg and "conversation" in ellis_response:
            conv = ellis_response["conversation"]
            if isinstance(conv, dict) and "error" in conv:
                error_msg = conv["error"]
    if error_msg:
        ellis_response["error"] = error_msg

    return jsonify(ellis_response), 200


@app.route("/auth/register", methods=["POST"])
def route_register():
    return register()


@app.route("/auth/login", methods=["POST"])
def route_login():
    return login()


@app.route("/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def route_refresh():
    return refresh()


@app.route("/get-static-user-questions", methods=["GET"])
def get_static_user_questions():
    try:
        questions_list_for_chip_display = get_static_user_questions_list()
        with open("static/static_sidebar_user_queries.yaml", "r") as file:
            yaml_data = yaml.safe_load(file)
            questions_list_for_side_bar = yaml_data.get("static_side_bar_user_questions", [])

        return (
            jsonify(
                {
                    "chip_display_static_questions": questions_list_for_chip_display,
                    "side_bar_static_questions": questions_list_for_side_bar,
                }
            ),
            200,
        )
    except Exception as error:
        logger.error("Error in '/get-static-user-questions': %s", error)
        return jsonify({"error": "An error occurred while processing the request.", "details": str(error)}), 500


@app.route("/Solenis-bot", methods=["POST"])
def ask_ellis():
    try:
        return _process_ask_request()
    except Exception as error:
        logger.error("Error in '/Solenis-bot': %s", error)
        return jsonify({"error": "An error occurred while processing the request.", "details": str(error)}), 500


@app.route("/ask-algo", methods=["POST"])
def ask_algo():
    """Alias expected by sales_insights-bristlecone-frontend (same contract as legacy backend)."""
    try:
        return _process_ask_request()
    except Exception as error:
        logger.error("Error in '/ask-algo': %s", error)
        return jsonify({"error": "An error occurred while processing the request.", "details": str(error)}), 500


@app.route("/ask-operations", methods=["POST"])
def ask_operations():
    """Legacy alias endpoint for some frontends."""
    return ask_algo()


@app.route("/chat/chat_sessions", methods=["GET"])
def route_get_user_chat_sessions():
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"status": "error", "message": "Missing user_id"}), 400
    sessions = get_user_chat_sessions(user_id)
    if sessions is None:
        return jsonify({"status": "success", "sessions": []}), 200
    return jsonify({"status": "success", "sessions": sessions}), 200


@app.route("/chat/create_chat", methods=["POST"])
def route_create_chat_session():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"status": "error", "message": "Missing user_id"}), 400

    title = data.get("title")
    if not title:
        initial = (data.get("initial_message_content") or "").strip()
        title = (initial[:77] + "…") if len(initial) > 80 else (initial or "Untitled Chat")

    chat_id = create_new_chat_session(int(user_id), title)
    if chat_id:
        return jsonify({"status": "success", "chat_id": chat_id}), 201
    return jsonify({"status": "error", "message": "Failed to create chat session"}), 500


@app.route("/chat/refresh_session_title", methods=["POST"])
def route_refresh_session_title():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    chat_id = data.get("chat_id")
    if not user_id or not chat_id:
        return jsonify({"status": "error", "message": "Missing user_id or chat_id"}), 400
    title = refresh_chat_session_title(int(user_id), str(chat_id))
    if title:
        return jsonify({"status": "success", "title": title}), 200
    return jsonify({"status": "skipped", "message": "No title update (no history or DB error)"}), 200


@app.route("/chat/get_chat/<string:chat_id>", methods=["GET"])
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
        logger.exception("Error in /chat/get_chat/%s: %s", chat_id, e)
        return jsonify({"error": "An unexpected error occurred"}), 500


@app.route("/health", methods=["GET"])
def route_health_check():
    return jsonify({"status": "ok", "message": "Backend is running"}), 200


@app.route("/chat/save_message", methods=["POST"])
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
        int(user_id),
        chat_id,
        question,
        response_content,
        response_graph,
        graph_type,
        insightful_questions,
    )

    if save_status == "SUCCESS":
        return jsonify({"status": "success"}), 200
    if save_status == "DB_ERROR":
        logger.error(
            "save_message DB_ERROR user_id=%s chat_id=%s (check Snowflake logs / session row / FK)",
            user_id,
            chat_id,
        )
        return jsonify({"error": "Failed to save message due to a database error."}), 500
    logger.error("save_message unexpected status=%s user_id=%s chat_id=%s", save_status, user_id, chat_id)
    return jsonify({"error": "Failed to save message."}), 500


if __name__ == "__main__":
    host = os.getenv("FLASK_RUN_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_RUN_PORT", "5000"))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    # Disable Werkzeug reloader in this mode to prevent connection resets on dependency file changes
    app.run(debug=debug, host=host, port=port, use_reloader=False)
