"""
Module Name: static_user_queries_handler.py
 
Description:
This module handles loading, formatting, and executing static user queries
from a Snowflake database. It reads queries from a YAML file, formats them
based on the user's input, and integrates the query execution with conversation
history management.
"""
 
# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------
 
# Standard library imports
from typing import Any, Dict
import json
import yaml
 
# Local application imports
from connectors.snowflake_connector import SnowflakeConnector
 
# -----------------------------------------------------------------------------
# SECTION: Static Query Handling Functions
# -----------------------------------------------------------------------------
 
def load_static_snowflake_queries() -> Dict[str, Any]:
    """
    Loads Snowflake queries from a YAML file.
 
    Returns:
        dict: A dictionary containing the queries loaded from the YAML file.
    """
    with open("static/static_snowflake_queries.yaml", 'r') as file:
        return yaml.safe_load(file)
 
 
def format_queries_with_table_and_column(table_name: str, column_name: str = None) -> Dict[str, Any]:
    """
    Formats the queries from the loaded YAML file with the specified table name
    and optionally a column name.
 
    Args:
        table_name (str): The name of the table to format the queries for.
        column_name (str, optional): The name of the column to use in formatting the queries.
 
    Returns:
        dict: A dictionary of formatted queries with the parameters specified.
    """
    queries_data = load_static_snowflake_queries()
    formatted_queries = {}
 
    for table in queries_data:
        if table["table_name"] == table_name:
            for query in table["queries"]:
                formatted_query = query["query"]
                if column_name:
                    formatted_query = formatted_query.replace("column_name", column_name)
                formatted_queries[query["key"]] = formatted_query
 
    return formatted_queries
 
 
def get_static_user_questions_list() -> list:
    """
    Retrieves only the keys from the loaded YAML file.
    Which are predefined static user questions.
 
    Returns:
        list: A list of keys present in the YAML file.
    """
    queries_data = load_static_snowflake_queries()
    questions = []
    for table in queries_data:
        for query in table["queries"]:
            questions.append(query["description"])
    return questions
 
 
def is_user_input_in_static_queries(user_input: str) -> bool:
    """
    Checks whether the user input matches any of the keys in the static
    queries dictionary.
 
    Args:
        user_input (str): The key to check in the static queries dictionary.
 
    Returns:
        bool: True if the key is present, False otherwise.
    """
    query_keys = get_static_user_questions_list()
    queries_data = load_static_snowflake_queries()
    if user_input in query_keys:
        print(queries_data)
    else:
        print("false")

 
# -----------------------------------------------------------------------------
# SECTION: Query Execution Functions
# -----------------------------------------------------------------------------
 
def execute_static_query_for_user_input(user_input: str, table_name: str, column_name: str = None, conversation_history: list = None) -> Dict[str, Any]:
    """
    Matches the user input with the corresponding key in the loaded queries,
    formats the query with the specified table and column names, and executes it.
 
    Args:
        user_input (str): The key to match in the queries dictionary.
        table_name (str): The name of the table to format the query for.
        column_name (str, optional): The name of the column to use in formatting the query.
        conversation_history (list, optional): The history of the conversation.
 
    Returns:
        dict: A dictionary containing conversation details and token counts.
    """
    conversation: Dict[str, Any] = {
        "conversation_history": conversation_history or [],
        "present_conversation": []
    }
    
    # Add user input to the current conversation
    conversation["present_conversation"].append({"user_input": user_input})
 
    # Format and execute the query based on user input
    queries = format_queries_with_table_and_column(table_name, column_name)
    query_to_execute = queries.get(user_input)
    if not query_to_execute:
        raise ValueError(f"No matching query found for user input: {user_input}")
 
    connector = SnowflakeConnector()
    query_result = connector.execute_query(query_to_execute)
    query_result = json.loads(query_result)
 
    # Append query results to the conversation
    conversation["present_conversation"].append({"news_agent": query_result})
 
    # Return final conversation details and token counts
    return {
        "conversation": conversation,
        "generated_snowflake_query": query_to_execute,
        "input_tokens_count": 0,
        "output_tokens_count": 0
    }
 
# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------