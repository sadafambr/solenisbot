"""
Module Name: snowflake_table_identification_agent.py

Description:
This module identifies appropriate Snowflake table names based on user input
using an LLM-powered query chain. It loads prompts, defines models, and sets up
the necessary components to generate, parse, and execute Snowflake SQL queries.

"""

# ---------------------------------------------------------------------------
# SECTION: Imports
# ---------------------------------------------------------------------------

# Standard library imports
from typing import List, Dict, Union

# Third-party imports
from langchain_community.callbacks import get_openai_callback
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts.chat import ChatPromptTemplate
from langchain.prompts.prompt import PromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field, ValidationError

# Local application imports
from models.azure_openai_model import model
from utils.helper_functions import load_prompt

# ---------------------------------------------------------------------------
# SECTION: Load Prompts
# ---------------------------------------------------------------------------

# Load prompts from files to be used in the query generation process
snowflake_system_text = load_prompt(
    "prompts/snowflake/snowflake_table_identification_system_prompt.txt"
)
snowflake_start_text = load_prompt(
    "prompts/snowflake/snowflake_table_identification_start_prompt.txt"
)

# Create chat prompt templates from the loaded prompt texts
system_snowflake_prompt = ChatPromptTemplate.from_template(snowflake_system_text)
start_snowflake_prompt = ChatPromptTemplate.from_template(snowflake_start_text)

# ---------------------------------------------------------------------------
# SECTION: Define and Create Prompt Template
# ---------------------------------------------------------------------------

# Define a standard template for system and start prompts
standard_template = """
## System: {system}
## Start: {start}
"""
standard_template = PromptTemplate.from_template(standard_template)

# Create a final combined prompt template
final_prompt = standard_template.format(
    system=snowflake_system_text,
    start=snowflake_start_text,
)

# ---------------------------------------------------------------------------
# SECTION: Define Models and Chain
# ---------------------------------------------------------------------------

class SnowflakeTable(BaseModel):
    """
    Pydantic model for parsing the response from Snowflake query execution.

    Attributes:
        table_names (List[str]): List of Snowflake table names identified from the query.
    """
    table_names: List[str] = Field(description="List of table names identified")

# Create the output parser to handle JSON responses from the model
parser = PydanticOutputParser(pydantic_object=SnowflakeTable)

# Create the complete Snowflake query chain by combining the prompt, model, and parser
snowflake_table_identification_chain = ChatPromptTemplate(
    messages=[
        system_snowflake_prompt.messages[0],
        start_snowflake_prompt.messages[0]
    ]
) | model | parser

# ---------------------------------------------------------------------------
# SECTION: Snowflake Table Identification Agent Function
# ---------------------------------------------------------------------------

def snowflake_table_identification_agent(input_text: str) -> tuple:
    """
    Generates appropriate Snowflake table names based on user input.

    This function processes the user's input text, generates a SQL query using the
    Snowflake query chain, executes the query, and returns the identified table names
    along with token counts.

    Args:
        input_text (str): The user input text for table identification.

    Returns:
        tuple: A tuple containing:
            - list: Identified table names.
            - int: Number of input tokens used.
            - int: Number of output tokens generated.
    """
    try:
        with get_openai_callback() as cb:
            # Invoke the chain and capture the AI response
            ai_response = snowflake_table_identification_chain.invoke({"user_input": input_text})
            
            # The parser should return a SnowflakeTable object
            table_names = ai_response.table_names
            
            # Calculate token counts
            input_tokens_count = cb.prompt_tokens
            output_tokens_count = cb.completion_tokens

            return table_names, input_tokens_count, output_tokens_count

    except ValidationError as e:
        error_message = f"Failed to parse SnowflakeTable from completion. Error: {e}"
        print(error_message)
        raise ValueError(error_message)

    except Exception as e:
        print(f"Error in Snowflake Table Identification Agent: {e}")
        raise

# ---------------------------------------------------------------------------
# END OF MODULE
# ---------------------------------------------------------------------------
