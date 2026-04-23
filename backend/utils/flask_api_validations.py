"""
Validate Flask API payloads for the ask / chat endpoints.
"""

import logging

from flask import jsonify

logger = logging.getLogger(__name__)


def validate_ask_ellis_api_request_data(data):
    """
    Validate the request body for ask endpoints.

    Returns:
        None if valid, or (jsonify(...), status_code) on error.
    """
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    if "user_input" not in data:
        return jsonify({"error": "Missing required parameter: user_input"}), 400

    logger.debug(
        "ask request keys: %s",
        list(data.keys()) if isinstance(data, dict) else type(data).__name__,
    )
    return None
