"""
Module Name: bigquery_query_agent_single_table.py

Description:
This module contains the implementation of the bigquery query agent using LangChain components.
It defines the pipeline for generating and executing bigquery SQL queries based on user input.
The module also includes utility functions for loading prompts and processing responses.

Note:
    - This module is specifically designed for generating bigquery queries for a single table.

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
from langchain.prompts.pipeline import PipelinePromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field

# Local application imports
from connectors.bigquery_connector import execute_bigquery_query
from models.openai_model import model
from utils.helper_functions import load_prompt

# -----------------------------------------------------------------------------
# SECTION: Load Prompts
# -----------------------------------------------------------------------------

# Load system and start prompts
bigquery_query_generation_system_text = load_prompt("prompts/bigquery/bigquery_query_generation_system_prompt.txt")
bigquery_query_generation_schema_text = load_prompt("prompts/bigquery/bigquery_query_generation_schema_prompt.txt")
bigquery_query_generation_example_text = load_prompt("prompts/bigquery/bigquery_query_generation_example_prompt.txt")
bigquery_query_generation_start_text = load_prompt("prompts/bigquery/bigquery_query_generation_start_prompt.txt")

# Create chat prompt templates from the loaded prompts
bigquery_query_generation_system_prompt = ChatPromptTemplate.from_template(bigquery_query_generation_system_text)
bigquery_query_generation_schema_prompt = ChatPromptTemplate.from_template(bigquery_query_generation_schema_text)
bigquery_query_generation_example_prompt = ChatPromptTemplate.from_template(bigquery_query_generation_example_text)
bigquery_query_generation_start_prompt = ChatPromptTemplate.from_template(bigquery_query_generation_start_text)

# -----------------------------------------------------------------------------
# SECTION: Define and Create Prompt Template
# -----------------------------------------------------------------------------

# Define a standard template for the prompts
standard_template = """
## System: {system}
## Schema: {schema}
## Example: {example}
## Start: {start}
"""
standard_template = PromptTemplate.from_template(standard_template)

# -----------------------------------------------------------------------------
# SECTION: Define Models and Chain
# -----------------------------------------------------------------------------

class bigqueryQuery(BaseModel):
    """
    Pydantic model for bigquery query response.

    Attributes:
        ai_response (str): SQL query code generated based on user input.
    """
    ai_response: str = Field(description="SQL query code based on user input")


# Create the output parser
parser = JsonOutputParser(pydantic_object=bigqueryQuery)

# -----------------------------------------------------------------------------
# SECTION: bigquery Agent Function
# -----------------------------------------------------------------------------

def bigquery_agent(input_text: str) -> tuple:
    """
    Generate and execute a bigquery query based on the input text.

    This function processes the user's input, generates a SQL query using the bigquery
    query chain, executes the query, and returns the result.

    Args:
        input_text (str): The user input text.

    Returns:
        tuple: A tuple containing:
            - str: The result of the executed bigquery query.
            - int: The number of input tokens used.
            - int: The number of output tokens generated.
    """

    # Create the bigquery template as a list of tuples
    bigquery_template = [
        ("system", bigquery_query_generation_system_prompt),
        ("schema", bigquery_query_generation_schema_prompt),
        ("example", bigquery_query_generation_example_prompt),
        ("start", bigquery_query_generation_start_prompt)
    ]

    # Create a pipeline prompt template for the bigquery agent
    bigquery_query_prompt = PipelinePromptTemplate(
        final_prompt=standard_template,
        pipeline_prompts=bigquery_template
    )

    # Create the bigquery query chain by combining the prompt, model, and parser
    bigquery_query_chain = bigquery_query_prompt | model | parser

    # Execute the query with token counting
    with get_openai_callback() as cb:
        ai_response = bigquery_query_chain.invoke({"user_input": input_text})
        generated_bigquery_query = ai_response["ai_response"]
        input_tokens_count = cb.prompt_tokens
        output_tokens_count = cb.completion_tokens

    # Print and execute the generated query
    print("*" * 50)
    print("Generated bigquery Query")
    print(generated_bigquery_query)
    print("*" * 50)

    query_result = execute_bigquery_query(generated_bigquery_query)
    query_result = json.loads(query_result)
    return generated_bigquery_query, query_result, input_tokens_count, output_tokens_count

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------