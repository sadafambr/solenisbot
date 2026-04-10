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
from connectors.bigquery_connector import execute_snowflake_query
 
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
    sf_query = f"""
    SELECT * FROM "DEV_INSEAME_AIML_DB"."NIDHI"."API_INGESTION_RESPONSE" WHERE REQUEST_ID = '{request_id}';
    """
 
    try:
        query_result_json = execute_snowflake_query(sf_query)
        query_result = json.loads(query_result_json)
 
        if query_result:
            return True
        else:
            return False
 
    except Exception as e:
        print("Error in validate_request_id:", e)
        return e
   
# -----------------------------------------------------------------------------
# SECTION: ask-operations api validations
# -----------------------------------------------------------------------------
 
def validate_ask_operations_api_request_data(data):
    """
    Validate the request data for the ask-operations API.
 
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
 