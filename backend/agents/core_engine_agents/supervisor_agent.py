# -----------------------------------------------------------------------------
# MODULE: supervisor_agent.py
# -----------------------------------------------------------------------------

"""
Module Name: supervisor_agent.py

Description:
This module contains the implementation of the Supervisor agent using LangChain components.
The Supervisor agent is responsible for analyzing user input and generating a structured response that
includes tasks, corresponding function calls, and dependencies between tasks.
"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

# Standard library imports
from typing import List, Optional, Tuple, Dict
import json

# Third-party imports
from langchain_community.callbacks import get_openai_callback
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field

# Local application imports
from models.azure_openai_model import model
from utils.helper_functions import load_prompt

# -----------------------------------------------------------------------------
# SECTION: Load Prompts
# -----------------------------------------------------------------------------

# Load prompts from files
supervisor_system_text = load_prompt("prompts/core_engine/supervisor_system_prompt.txt")
supervisor_example_text = load_prompt("prompts/core_engine/supervisor_example_prompt.txt")
supervisor_start_text = load_prompt("prompts/core_engine/supervisor_start_prompt.txt")

# Combine the loaded prompts into a single template using SystemMessagePromptTemplate and HumanMessagePromptTemplate
supervisor_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(supervisor_system_text),
    HumanMessagePromptTemplate.from_template(supervisor_example_text),
    HumanMessagePromptTemplate.from_template(supervisor_start_text)
])

# -----------------------------------------------------------------------------
# SECTION: Define Models and Chain
# -----------------------------------------------------------------------------

class QuestionIntent(BaseModel):
    """
    Pydantic model for a question intent.

    Attributes:
        question (str): User's question or request.
        function_name (str): Function name to be called based on user input.
        function_params (List[str]): List of function parameters.
        depends_on (Optional[int]): Index of the question this depends on, if any.
    """
    question: str = Field(description="User's question or request")
    function_name: str = Field(description="Function name to be called based on user input")
    function_params: List[str] = Field(description="List of function parameters")
    depends_on: Optional[int] = Field(None, description="Index of the question this depends on, if any")


class Supervisor(BaseModel):
    """
    Pydantic model for the supervisor's response.

    Attributes:
        tasks (List[QuestionIntent]): List of questions and their corresponding function names,
        params, and dependencies.
    """
    tasks: List[QuestionIntent] = Field(description="List of questions and their corresponding function names, params, and dependencies")


# Create the output parser
parser = JsonOutputParser(pydantic_object=Supervisor)

# Create the supervisor chain by combining the prompt, model, and parser
supervisor_chain = supervisor_prompt | model | parser

# -----------------------------------------------------------------------------
# SECTION: Supervisor Agent Function
# -----------------------------------------------------------------------------

def supervisor_agent(
    user_input: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    **kwargs  # Accepts any unexpected keyword arguments like 'retry_context'
) -> Tuple[Dict, int, int]:
    """
    Generate a supervisor response based on the user input.

    This function processes the user's input, generates a structured response using the
    Supervisor agent chain, and returns the response along with token usage statistics.

    Args:
        user_input (str): The user's input question or request.
        conversation_history (list): The conversation history leading up to the current input.

    Returns:
        tuple: A tuple containing:
            - dict: The AI-generated supervisor response.
            - int: The number of input tokens used.
            - int: The number of output tokens generated.
    """
    conversation_history = conversation_history or []

    try:
        with get_openai_callback() as cb:
            ai_response = supervisor_chain.invoke({
                "user_input": user_input,
                "conversation_history": conversation_history
            })

            input_tokens_count = cb.prompt_tokens
            output_tokens_count = cb.completion_tokens

        return ai_response, input_tokens_count, output_tokens_count

    except Exception as e:
        # Log and return a failure response
        error_message = {"error": str(e)}
        return error_message, 0, 0


# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------
