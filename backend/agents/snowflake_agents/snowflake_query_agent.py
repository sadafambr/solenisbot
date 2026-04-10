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

# Third-party imports
from langchain_community.callbacks import get_openai_callback
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain.prompts import PipelinePromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field

# Local application imports
from agents.snowflake_agents.snowflake_table_identification_agent import snowflake_table_identification_agent
from connectors.snowflake_connector_v2 import SnowflakeConnector
from models.azure_openai_model import model
from utils.helper_functions import load_prompt, load_dynamic_example_prompt

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

    Attributes:
        ai_response (str): SQL query code generated based on user input.
    """
    ai_response: str = Field(description="SQL query code based on user input")


# Create the output parser
parser = JsonOutputParser(pydantic_object=SnowflakeQuery)

# -----------------------------------------------------------------------------
# SECTION: Snowflake Agent Function
# -----------------------------------------------------------------------------

def snowflake_agent(input_text: str) -> tuple:
    """
    Generate and execute a Snowflake query based on the input text.

    This function processes the user's input, generates a SQL query using the Snowflake
    query chain, executes the query, and returns the result.

    Args:
        input_text (str): The user input text.

    Returns:
        tuple: A tuple containing:
            - str: The result of the executed Snowflake query.
            - int: The number of input tokens used.
            - int: The number of output tokens generated.
    """
    # Identify table names and count tokens
    table_names, input_tokens_count, output_tokens_count = snowflake_table_identification_agent(input_text)
    table_names = [name.lower() for name in table_names]

    print("*" * 50)
    print("Agent selected table names")
    print(table_names)
    print("*" * 50)

    # Load dynamic example prompts based on identified table names
    snowflake_query_generation_example_text = load_dynamic_example_prompt(table_names)
    snowflake_query_generation_example_prompt = ChatPromptTemplate.from_template(snowflake_query_generation_example_text)

    # Compose the prompt with explicit JSON output instruction
    prompt_vars = {
        "system": snowflake_query_generation_system_prompt.format(user_input=input_text),
        "example": snowflake_query_generation_example_prompt.format(user_input=input_text),
        "start": snowflake_query_generation_start_prompt.format(user_input=input_text)
    }
    final_prompt_text = (
        standard_template.format(**prompt_vars)
        + "\n\nIMPORTANT: Respond ONLY with a valid JSON object in the following format: {\"ai_response\": \"<SQL QUERY>\"}. Do not include any explanation or extra text."
    )

    # Use the model and parser directly, with robust error handling
    generated_snowflake_query = None
    raw_model_output = None
    try:
        with get_openai_callback() as cb:
            ai_response = model.invoke(final_prompt_text)
            ai_response_text = getattr(ai_response, "content", ai_response)
            raw_model_output = ai_response_text
            print("RAW MODEL OUTPUT:")
            print(ai_response)
            try:
                parsed = parser.parse(ai_response_text)
                if isinstance(parsed, dict):
                    generated_snowflake_query = parsed.get("ai_response")
                else:
                    generated_snowflake_query = parsed.ai_response

                if not isinstance(generated_snowflake_query, str) or not generated_snowflake_query.strip():
                    raise ValueError("Parsed 'ai_response' is missing or not a valid string.")
            except Exception as parse_err:
                logger.error("Failed to parse model output as JSON with 'ai_response' key.")
                logger.error(f"Raw model output: {ai_response_text}")
                logger.error(f"Parse error: {parse_err}")
                return {
                    "error": "Model output could not be parsed as valid JSON with 'ai_response' key.",
                    "raw_model_output": ai_response_text,
                    "parse_error": str(parse_err)
                }, None, input_tokens_count, output_tokens_count
            input_tokens_count += cb.prompt_tokens
            output_tokens_count += cb.completion_tokens
    except Exception as model_err:
        logger.error("Error invoking model:")
        logger.error(str(model_err))
        return {
            "error": "Error invoking model.",
            "exception": str(model_err),
            "raw_model_output": raw_model_output
        }, None, input_tokens_count, output_tokens_count

    # Print and execute the generated query
    print("*" * 50)
    print("Generated Snowflake Query")
    print(generated_snowflake_query)
    print("*" * 50)
    logger.info("*" * 50)
    logger.info("User Input for Snowflake Query Generator")
    logger.info(input_text)
    logger.info("*" * 50)
    logger.info("Agent selected table names")
    logger.info(table_names)
    logger.info("*" * 50)
    logger.info("Generated Snowflake Query")
    logger.info(generated_snowflake_query)
    logger.info("*" * 50)

    connector = SnowflakeConnector()
    try:
        query_result = connector.execute_query(generated_snowflake_query)
        query_result = json.loads(query_result)
    except Exception as db_err:
        logger.error("Error executing Snowflake query:")
        logger.error(str(db_err))
        return {
            "error": "Error executing Snowflake query.",
            "exception": str(db_err),
            "query": generated_snowflake_query
        }, None, input_tokens_count, output_tokens_count

    return generated_snowflake_query, query_result, input_tokens_count, output_tokens_count

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------