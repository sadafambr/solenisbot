"""
Module Name: snowflake_query_agent.py
 
Description:
This module contains the implementation of the Snowflake query agent using LangChain components.
It defines the pipeline for generating and executing Snowflake SQL queries based on user input.
The module also includes utility functions for loading prompts and processing responses.
"""
 
# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------
 
# Standard library imports
import json
import logging
import os
 
# Third-party imports
from langchain_community.callbacks import get_openai_callback
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain.prompts import PipelinePromptTemplate
from pydantic import BaseModel, Field
 
# Local application imports
from agents.snowflake_agents.snowflake_table_identification_agent import snowflake_table_identification_agent
from connectors.snowflake_connector_v2 import SnowflakeConnector
from models.azure_openai_model import model
from utils.helper_functions import load_prompt, load_dynamic_example_prompt
from agents.core_engine_agents.insightful_question_agent import generate_related_questions
 
# -----------------------------------------------------------------------------
# SECTION: Logger Setup
# -----------------------------------------------------------------------------
 
# Get a logger instance for this module
logger = logging.getLogger(__name__)
 
# -----------------------------------------------------------------------------
# SECTION: Load Prompts
# -----------------------------------------------------------------------------
 
# Load system and start prompts
snowflake_query_generation_system_text = load_prompt("prompts/snowflake/snowflake_query_generation_system_prompt.txt")
snowflake_query_generation_start_text = load_prompt("prompts/snowflake/snowflake_query_generation_start_prompt.txt")
 
# Create chat prompt templates from the loaded prompts
snowflake_query_generation_system_prompt = ChatPromptTemplate.from_template(snowflake_query_generation_system_text)
snowflake_query_generation_start_prompt = ChatPromptTemplate.from_template(snowflake_query_generation_start_text)
 
# -----------------------------------------------------------------------------
# SECTION: Define and Create Prompt Template
# -----------------------------------------------------------------------------
 
# Define a standard template for the prompts
standard_template = """
## System: {system}
## Example: {example}
## Start: {start}
"""
standard_template = PromptTemplate.from_template(standard_template)
 
# -----------------------------------------------------------------------------
# SECTION: Define Models and Chain
# -----------------------------------------------------------------------------
 
class SnowflakeQuery(BaseModel):
    """
    Pydantic model for Snowflake query response.
    """
    ai_response: str = Field(description="SQL query code based on user input")
 
 
# Create the output parser
parser = JsonOutputParser(pydantic_object=SnowflakeQuery)
 
# -----------------------------------------------------------------------------
# SECTION: Helper for Table Metadata
# -----------------------------------------------------------------------------
 
def generate_table_metadata_from_file(metadata_file_path: str) -> dict:
    """
    Parses a metadata text file to generate a dictionary of table schemas and descriptions.
    """
    metadata = {}
    try:
        if not os.path.exists(metadata_file_path):
            logger.warning(f"Metadata file not found at {metadata_file_path}")
            return metadata
            
        with open(metadata_file_path, "r", encoding="utf-8") as file:
            lines = file.readlines()
            current_table = None
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                if "(" in line and ")" in line:
                    current_table = line.split("(")[0].strip()
                    metadata[current_table] = {"fields": [], "descriptions": {}}
                elif ":" in line and current_table:
                    field_parts = line.split(":", 1)
                    if len(field_parts) == 2:
                        field_name, description = field_parts
                        field_name = field_name.strip()
                        description = description.strip()
                        metadata[current_table]["fields"].append(field_name)
                        metadata[current_table]["descriptions"][field_name] = description
    except Exception as e:
        logger.error(f"Error loading metadata from file: {str(e)}")
    return metadata
 
# -----------------------------------------------------------------------------
# SECTION: Snowflake Agent Function
# -----------------------------------------------------------------------------
 
def snowflake_agent(input_text: str, conversation_history: str = "") -> tuple:
    """
    Generate and execute a Snowflake query based on the input text.
 
    Returns:
        tuple: (generated_query, result_json, follow_up_questions, input_tokens, output_tokens)
    """
    # Initialize token counts
    total_input_tokens_count = 0
    total_output_tokens_count = 0
    
    # Identify table names and count tokens
    table_names, input_tokens_count, output_tokens_count = snowflake_table_identification_agent(input_text)
    total_input_tokens_count += input_tokens_count
    total_output_tokens_count += output_tokens_count
    table_names = [name.lower() for name in table_names]
 
    print("*" * 50)
    print("Agent selected table names:", table_names)
    print("*" * 50)
 
    # Load dynamic example prompts based on identified table names
    snowflake_query_generation_example_text = load_dynamic_example_prompt(table_names)
    snowflake_query_generation_example_prompt = ChatPromptTemplate.from_template(snowflake_query_generation_example_text)
 
    # Compose the prompt
    prompt_vars = {
        "system": snowflake_query_generation_system_prompt.format(user_input=input_text),
        "example": snowflake_query_generation_example_prompt.format(user_input=input_text),
        "start": snowflake_query_generation_start_prompt.format(user_input=input_text)
    }
    final_prompt_text = (
        standard_template.format(**prompt_vars)
        + "\n\nIMPORTANT: Respond ONLY with a valid JSON object in the following format: {\"ai_response\": \"<SQL QUERY>\"}. Do not include any explanation or extra text."
    )
 
    generated_snowflake_query = None
    try:
        with get_openai_callback() as cb:
            ai_response = model.invoke(final_prompt_text)
            ai_response_text = getattr(ai_response, "content", ai_response)
            parsed = parser.parse(ai_response_text)
            generated_snowflake_query = parsed.get("ai_response") if isinstance(parsed, dict) else parsed.ai_response
            total_input_tokens_count += cb.prompt_tokens
            total_output_tokens_count += cb.completion_tokens
    except Exception as e:
        logger.error(f"Error in Snowflake query generation: {e}")
        return None, f"Error generating query: {str(e)}", [], total_input_tokens_count, total_output_tokens_count
 
    if not generated_snowflake_query:
        return None, "Failed to generate a valid SQL query.", [], total_input_tokens_count, total_output_tokens_count
 
    print("*" * 50)
    print("Generated Snowflake Query:")
    print(generated_snowflake_query)
    print("*" * 50)
 
    try:
        connector = SnowflakeConnector()
        query_result_str = connector.execute_query(generated_snowflake_query)
        query_result = json.loads(query_result_str)
        
        # Handle Snowflake results for No Data or Error
        if isinstance(query_result, dict) and "error" in query_result:
            friendly_msg = "Something went wrong while processing your request. Please try rephrasing your question."
            return generated_snowflake_query, friendly_msg, [], total_input_tokens_count, total_output_tokens_count
            
        if not query_result or (isinstance(query_result, list) and len(query_result) == 0):
            return generated_snowflake_query, "No data available for the requested period.", [], total_input_tokens_count, total_output_tokens_count
 
        # Load metadata and generate follow-up questions
        metadata_file_path = "metadata.txt"
        table_metadata = generate_table_metadata_from_file(metadata_file_path)
 
        follow_up_questions, question_input_tokens, question_output_tokens = generate_related_questions(
            user_input=input_text,
            llm_response=str(query_result),
            table_metadata=table_metadata
        )
        total_input_tokens_count += question_input_tokens
        total_output_tokens_count += question_output_tokens
 
        return generated_snowflake_query, query_result, follow_up_questions, total_input_tokens_count, total_output_tokens_count
        
    except Exception as db_err:
        logger.error(f"Error in Snowflake agent execution: {db_err}")
        return generated_snowflake_query, f"Error executing query: {str(db_err)}", [], total_input_tokens_count, total_output_tokens_count
 
# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------