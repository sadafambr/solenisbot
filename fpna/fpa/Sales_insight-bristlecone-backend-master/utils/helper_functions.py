"""
Module Name: helper_functions.py

Description:
This module contains utility functions for loading prompt text from a file and 
loading email addresses into a list. These functions are designed to be used 
as helpers for reading and processing text data in various formats.

"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

# Standard library imports
from typing import Union, List, Dict


 
# -----------------------------------------------------------------------------
# SECTION: Compute Total Length of Output
# -----------------------------------------------------------------------------
 
def compute_total_length(output: Union[str, List[Dict]]) -> int:
    """
    Compute the total character length across the task output, which can either 
    be a string or a list of dictionaries containing string values.
 
    Args:
        output (Union[str, List[Dict]]): The task output to compute the length for. 
            It can be either a direct string or a list of dictionaries.
 
    Returns:
        int: The total character length of the task output.
    """
    total_length = 0
 
    if isinstance(output, str):
        # If the output is a string, return its length directly
        total_length = len(output)
    elif isinstance(output, list):
        # If the output is a list of dictionaries, sum the length of all string values
        for item in output:
            for value in item.values():
                total_length += len(value)
 
    return total_length

# -----------------------------------------------------------------------------
# SECTION: Load Prompt Text from File
# -----------------------------------------------------------------------------

def load_prompt(file_path: str) -> str:
    """
    Load prompt text from a file.

    Args:
        file_path (str): The path to the file containing the prompt text.

    Returns:
        str: The content of the file as a string.
    """
    # Open the specified file in read mode with UTF-8 encoding and return the content
    with open(file_path, "r", encoding="utf-8") as file:
        return file.read()

# -----------------------------------------------------------------------------
# SECTION: Dynamic Loading of Example Prompts based on bigquery Table Names
# -----------------------------------------------------------------------------

def load_dynamic_example_prompt(table_names):
    """
    Load and concatenate example prompts dynamically based on table names.

    Args:
        table_names (list): List of table names.

    Returns:
        str: Concatenated example prompt text.
    """
    example_texts = []
    for table_name in table_names:
        prompt_file = f"prompts/bigquery/bigquery_bc_data_tables/{table_name}.txt"  # Construct file path
        try:
            example_text = load_prompt(prompt_file)  # Load prompt from file
            example_texts.append(example_text)
        except FileNotFoundError:
            print(f"Warning: Prompt file {prompt_file} not found.")
    
    # Concatenate all example texts into a single string
    return "\n".join(example_texts)

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------