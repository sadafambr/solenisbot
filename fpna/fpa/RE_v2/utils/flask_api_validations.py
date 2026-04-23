"""
Module Name: flask_api_validations.py

Description:

This module contains functions for validating API requests and request IDs for a Flask application. 

"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

# Standard library imports
import json

# Third-party imports
from flask import jsonify

# Local application imports
from connectors.snowflake_connector_v1 import execute_snowflake_query

# -----------------------------------------------------------------------------
# SECTION: User Request ID Validation
# -----------------------------------------------------------------------------

def validate_request_id(request_id):
    """
    Validate the given request ID by checking its presence in the database.

    Args:
        request_id (str): The request ID to validate.

    Returns:
        True: When the request_id already exists in the database
        False : When its a new request_id that does not exist in the database.
        Exception: The exception if an error occurs during execution.
    """
    
    sf_query = """
    SELECT 
        *
    FROM 
        DEV_INSEAME_AIML_DB.NIDHI.API_INGESTION_RESPONSE
    WHERE 
        REQUEST_ID = '{}';
    """.format(request_id)

    try:
        query_result = execute_snowflake_query(sf_query)
        query_result = json.loads(query_result)

        if query_result:
            return True
        else:
            return False

    except Exception as e:
        print("Error in validate_request_id:", e)
        return e
    
# -----------------------------------------------------------------------------
# SECTION: solenis-bot api validations
# -----------------------------------------------------------------------------

def validate_solenis_bot_api_request_data(data):
    print(data)
    """
    Validate the request data for the solenis-bot API.

    Args:
        data (dict): The request data to validate.

    Returns:
        Response: JSON response with an error message and HTTP status code if validation fails.
        None: If validation passes.
    """
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    # if 'request_id' not in data:
    #     return jsonify({"error": "Missing required parameter: request_id"}), 400

    if 'user_input' not in data:
        return jsonify({"error": "Missing required parameter: user_input"}), 400


    if 'conversation_history' not in data:
        return jsonify({"error": "Missing required parameter: conversation_history"}), 400

    return None  # No errors

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------