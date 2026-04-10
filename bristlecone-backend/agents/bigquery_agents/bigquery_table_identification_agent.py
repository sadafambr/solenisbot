"""
Module Name: bigquery_table_identification_agent.py

Description:
This module identifies appropriate bigquery table names based on user input
using an LLM-powered query chain. It loads prompts, defines models, and sets up
the necessary components to generate, parse, and execute bigquery SQL queries.

"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

# Standard library imports
from typing import List

# Third-party imports
from langchain_community.callbacks import get_openai_callback
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain.prompts.pipeline import PipelinePromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field

# Local application imports
from models.openai_model import model
from utils.helper_functions import load_prompt

# -----------------------------------------------------------------------------
# SECTION: Load Prompts
# -----------------------------------------------------------------------------

# Load prompts from files to be used in the query generation process
bigquery_system_text = load_prompt(
    "prompts/bigquery/bigquery_table_identification_system_prompt.txt"
)
bigquery_start_text = load_prompt(
    "prompts/bigquery/bigquery_table_identification_start_prompt.txt"
)

# Create chat prompt templates from the loaded prompt texts
system_bigquery_prompt = ChatPromptTemplate.from_template(bigquery_system_text)
start_bigquery_prompt = ChatPromptTemplate.from_template(bigquery_start_text)

# -----------------------------------------------------------------------------
# SECTION: Define and Create Prompt Template
# -----------------------------------------------------------------------------

# Define a standard template for system and start prompts
standard_template = """
## System: {system}
## Start: {start}
"""
standard_template = PromptTemplate.from_template(standard_template)

# Define the bigquery template as a list of tuples containing the prompt types
bigquery_template = [
    ("system", system_bigquery_prompt),
    ("start", start_bigquery_prompt)
]

# Create a pipeline prompt template for the bigquery query chain
bigquery_table_identification_prompt = PipelinePromptTemplate(
    final_prompt=standard_template,
    pipeline_prompts=bigquery_template
)

# -----------------------------------------------------------------------------
# SECTION: Define Models and Chain
# -----------------------------------------------------------------------------

class bigqueryTable(BaseModel):
    """
    Pydantic model for parsing the response from bigquery query execution.

    Attributes:
        table_names (List[str]): List of bigquery table names identified from the query.
    """
    table_names: List[str] = Field(description="List of table names identified")

# Create the output parser to handle JSON responses from the model
parser = JsonOutputParser(pydantic_object=bigqueryTable)

# Create the complete bigquery query chain by combining the prompt, model, and parser
bigquery_table_identification_chain = bigquery_table_identification_prompt | model | parser

# -----------------------------------------------------------------------------
# SECTION: bigquery Table Identification Agent Function
# -----------------------------------------------------------------------------

def bigquery_table_identification_agent(input_text: str) -> tuple:
    """
    Generates appropriate bigquery table names based on user input.

    This function processes the user's input text, generates a SQL query using the
    bigquery query chain, executes the query, and returns the identified table names
    along with token counts.

    Args:
        input_text (str): The user input text for table identification.

    Returns:
        tuple: A tuple containing:
            - list: Identified table names.
            - int: Number of input tokens used.
            - int: Number of output tokens generated.
    """
    with get_openai_callback() as cb:
        ai_response = bigquery_table_identification_chain.invoke({"user_input": input_text})
        table_names = ai_response["ai_response"]["table_names"]
        input_tokens_count = cb.prompt_tokens
        output_tokens_count = cb.completion_tokens

    return table_names, input_tokens_count, output_tokens_count

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------