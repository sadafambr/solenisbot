"""
Module Name: graph_and_summary_agent.py
 
Description:
This module provides functionality to generate graphical representations
and summaries based on a user input question and responses from other agents.
It uses a pre-defined pipeline of prompts and a model to generate the outputs.
 
"""
 
# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------
 
# Standard library imports
from typing import Dict, Any
import json
 
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
# SECTION: Load Graph and Summary Prompts
# -----------------------------------------------------------------------------
 
# Load the system prompt from a file
graph_and_summary_system_text = load_prompt("prompts/graph_and_summary/graph_and_summary_agent_system_prompt.txt")
 
# -----------------------------------------------------------------------------
# SECTION: Create Prompt Templates
# -----------------------------------------------------------------------------
 
# Create ChatPromptTemplate objects from the loaded prompts
graph_and_summary_system_prompt = ChatPromptTemplate.from_template(graph_and_summary_system_text)
 
# Create a standard template for the graph and summary prompt
standard_template = """
## System: {system}
"""
standard_template = PromptTemplate.from_template(standard_template)
 
# Create a list of tuples containing the prompt type and the corresponding ChatPromptTemplate object
graph_and_summary_template = [
    ("system", graph_and_summary_system_prompt)
]
 
# Create a PipelinePromptTemplate object with the standard template and the graph-summary template
graph_and_summary_prompt = PipelinePromptTemplate(
    final_prompt=standard_template,
    pipeline_prompts=graph_and_summary_template
)
 
# -----------------------------------------------------------------------------
# SECTION: Define Output Parser Models & Chain
# -----------------------------------------------------------------------------
 
class GraphOutput(BaseModel):
    """
    Data model for the graph output.
    """
    function_name: str = Field(description="Name of the graph function to be used, e.g., 'bar_graph', 'line_graph', or ''.")
    parameters: Dict[str, Any] = Field(
        description=(
            "Parameters for the graph function. Includes 'data' (list of label-value pairs), "
            "'x_label' (x-axis label), 'y_label' (y-axis label), and 'title' (graph title)."
        )
    )
 
 
class GraphSummaryOutput(BaseModel):
    """
    Data model for the generated graph and summary.
    """
    graph_output: GraphOutput = Field(description="Graphical representation details.")
    summary: str = Field(description="A concise summary of the data, or an empty string if not applicable.")
 
# Create an instance of the JsonOutputParser class
parser = JsonOutputParser(pydantic_object=GraphSummaryOutput)
 
# Create the Graph and Summary chain by combining the prompt, model, and parser
graph_and_summary_chain = graph_and_summary_prompt | model | parser
 
# -----------------------------------------------------------------------------
# SECTION: Graph and Summary Function
# -----------------------------------------------------------------------------
 
def graph_and_summary_agent(user_input: str, other_agents_response: Dict[str, Any]) -> tuple:
    """
    Generates a graph and summary based on user input and responses from other agents.
    Returns empty summary and graph if error or no data is present in agent output.
    """
    # Default empty response
    empty_response = {
        "graph_output": {
            "function_name": "",
            "parameters": {"data": [], "x_label": "", "y_label": "", "title": ""}
        },
        "summary": "No data available for the requested period.",
        "error": "No data available for the requested period."
    }

    # Handle case where other_agents_response is a string (likely an error message)
    if isinstance(other_agents_response, str):
        if "no data available" in other_agents_response.lower() or "error" in other_agents_response.lower():
            empty_response["summary"] = other_agents_response
            empty_response["error"] = other_agents_response
            return empty_response, 0, 0
    
    # Case 1: Pipeline provided a dict-like structure
    if isinstance(other_agents_response, dict):
        # Check for no data or error in the response
        if "status" in other_agents_response and other_agents_response["status"] == "no_data":
            empty_response["summary"] = other_agents_response.get("message", "No data available for the requested period.")
            empty_response["error"] = other_agents_response.get("message", "No data available for the requested period.")
            return empty_response, 0, 0
            
        # Check for error in response
        if "error" in other_agents_response:
            error_msg = other_agents_response.get("error", "An error occurred while processing your request.")
            empty_response["summary"] = error_msg
            empty_response["error"] = error_msg
            return empty_response, 0, 0
            
        # Check for empty data array in response
        if "data" in other_agents_response and (not other_agents_response["data"] or len(other_agents_response["data"]) == 0):
            return empty_response, 0, 0
            
        # Legacy error checking
        error_val = other_agents_response.get("error", "")
        output_val = other_agents_response.get("output", "")
        if (
            (isinstance(error_val, str) and "no data available" in error_val.lower()) or
            (isinstance(error_val, str) and "error" in error_val.lower()) or
            (isinstance(output_val, str) and "no data available" in output_val.lower()) or
            (isinstance(output_val, str) and "error" in output_val.lower())
        ):
            error_msg = error_val if error_val else output_val
            empty_response["summary"] = error_msg
            empty_response["error"] = error_msg
            return empty_response, 0, 0
            
        # Empty/null result check
        if (
            ("output" in other_agents_response and (
                other_agents_response["output"] == [] or
                other_agents_response["output"] == "" or
                other_agents_response["output"] is None
            )) or
            other_agents_response == {} or
            other_agents_response == [] or
            other_agents_response is None
        ):
            return empty_response, 0, 0
 
    # Case 2: task_outputs list from workflow
    if isinstance(other_agents_response, list):
        for item in other_agents_response:
            if isinstance(item, dict) and item.get("function_name") == "generic_conversation_agent":
                friendly_msg = "Please ask a clear business question so I can help."
                ai_response = {
                    "graph_output": {
                        "function_name": "",
                        "parameters": {"data": [], "x_label": "", "y_label": "", "title": ""}
                    },
                    "summary": friendly_msg,
                }
                return ai_response, 0, 0
 
    # Serialize the dictionary to a JSON string
    other_agents_response_str = json.dumps(other_agents_response)
 
    # Combine user input and other agents' responses into the chain input
    chain_input = {
        "user_input": user_input,
        "other_agents_response": other_agents_response_str
    }
 
    # Invoke the graph and summary chain with the combined input
    with get_openai_callback() as cb:
        ai_response = graph_and_summary_chain.invoke(chain_input)
        input_tokens_count = cb.prompt_tokens
        output_tokens_count = cb.completion_tokens
 
    return ai_response, input_tokens_count, output_tokens_count
 
# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------
 