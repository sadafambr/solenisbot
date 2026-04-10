# bigquery_query_agent.py
"""
Module Name: bigquery_query_agent.py

Description:
This module contains the implementation of the bigquery query agent using LangChain components.
It defines the pipeline for generating and executing bigquery SQL queries based on user input.
The module also includes utility functions for loading prompts and processing responses.
"""

from langchain_community.callbacks import get_openai_callback
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain.prompts.pipeline import PipelinePromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field
from agents.bigquery_agents.bigquery_table_identification_agent import bigquery_table_identification_agent
from connectors.bigquery_connector import execute_snowflake_query
from models.openai_model import model
from utils.helper_functions import load_prompt
from agents.core_engine_agents.insightful_question_agent import generate_related_questions
import json

BQ_PROJECT_ID = "bcone-sales-insights-dev-prj"
BQ_DATASET = "bcone-sales-insights-dev-prj.salesinsights_dev_bqd"

bigquery_query_generation_system_text = load_prompt("prompts/bigquery/bigquery_query_generation_system_prompt.txt")
bigquery_query_generation_start_text = load_prompt("prompts/bigquery/bigquery_query_generation_start_prompt.txt")

bigquery_query_generation_system_prompt = ChatPromptTemplate.from_template(bigquery_query_generation_system_text)
bigquery_query_generation_start_prompt = ChatPromptTemplate.from_template(bigquery_query_generation_start_text)

def load_dynamic_example_prompt(table_names):
    example_texts = []
    for table_name in table_names:
        prompt_file = f"prompts/bigquery/bigquery_bc_data_tables/{table_name}.txt"
        try:
            example_text = load_prompt(prompt_file)
            example_texts.append(example_text)
        except FileNotFoundError:
            print(f"Warning: Prompt file {prompt_file} not found.")
    return "\n".join(example_texts)

standard_template = """
## System: {system}
## Example: {example}
## Start: {start}
"""
standard_template = PromptTemplate.from_template(standard_template)

class bigqueryQuery(BaseModel):
    ai_response: str = Field(description="SQL query code based on user input")

parser = JsonOutputParser(pydantic_object=bigqueryQuery)

def bigquery_agent(input_text: str, conversation_history: str = "") -> tuple:
    table_names, input_tokens_count, output_tokens_count = bigquery_table_identification_agent(input_text)
    table_names = [name.lower() for name in table_names]

    print("*" * 50)
    print("Agent selected table names:", table_names)
    print("*" * 50)

    bigquery_query_generation_example_text = load_dynamic_example_prompt(table_names)
    bigquery_query_generation_example_prompt = ChatPromptTemplate.from_template(bigquery_query_generation_example_text)

    bigquery_template = [
        ("system", bigquery_query_generation_system_prompt),
        ("example", bigquery_query_generation_example_prompt),
        ("start", bigquery_query_generation_start_prompt)
    ]

    bigquery_query_prompt = PipelinePromptTemplate(
        final_prompt=standard_template,
        pipeline_prompts=bigquery_template
    )

    bigquery_query_chain = bigquery_query_prompt | model | parser

    with get_openai_callback() as cb:
        ai_response = bigquery_query_chain.invoke({"user_input": input_text})
        generated_bigquery_query = ai_response["ai_response"]
        input_tokens_count += cb.prompt_tokens
        output_tokens_count += cb.completion_tokens

    print("*" * 50)
    print("Generated BigQuery Query:")
    print(generated_bigquery_query)
    print("*" * 50)

    try:
        query_result = execute_snowflake_query(generated_bigquery_query)
        print("Query Execution Result:", query_result)

        try:
            result_json = json.loads(query_result)
        except Exception as e:
            print(f"Error parsing query result: {str(e)}")
            result_json = {}

        if isinstance(result_json, dict):
            if result_json.get("status") == "no_data":
                print("Snowflake returned no data.")
                return generated_bigquery_query, result_json.get("message", "No data available for the requested period."), [], input_tokens_count, output_tokens_count
            
            if result_json.get("status") == "success" and "data" in result_json:
                result_data = result_json["data"]
                if not result_data:
                    return generated_bigquery_query, "No data available for the requested period.", [], input_tokens_count, output_tokens_count
                result_json = result_data
            
            elif "error" in result_json:
                error_msg = result_json.get("error", "")
                print("Snowflake execution error:", error_msg)
                friendly_msg = "Something went wrong while processing your request. Please try rephrasing your question."
                return generated_bigquery_query, friendly_msg, [], input_tokens_count, output_tokens_count

        if not result_json:
            return generated_bigquery_query, "No data available for the requested period.", [], input_tokens_count, output_tokens_count

        metadata_file_path = r"D:\Latest Code\bristlecone-backend\metadata.txt"
        table_metadata = generate_table_metadata_from_file(metadata_file_path)

        follow_up_questions, question_input_tokens, question_output_tokens = generate_related_questions(
            user_input=input_text,
            llm_response=result_json,
            table_metadata=table_metadata
        )

        input_tokens_count += question_input_tokens
        output_tokens_count += question_output_tokens

        return generated_bigquery_query, result_json, follow_up_questions, input_tokens_count, output_tokens_count
    except Exception as e:
        print("#" * 50)
        print("Error in Snowflake Query Execution:")
        print(str(e))
        print("#" * 50)
        friendly_msg = "Something went wrong while processing your request. Please try rephrasing your question."
        return generated_bigquery_query, friendly_msg, [], input_tokens_count, output_tokens_count

def generate_table_metadata_from_file(metadata_file_path: str) -> dict:
    metadata = {}
    try:
        with open(metadata_file_path, "r") as file:
            lines = file.readlines()
            current_table = None
            for line in lines:
                line = line.strip()
                if "(" in line and ")" in line:
                    current_table = line.split("(")[0].strip()
                    metadata[current_table] = {"fields": [], "descriptions": {}}
                elif ":" in line and current_table:
                    field_name, description = line.split(":", 1)
                    field_name = field_name.strip()
                    description = description.strip()
                    metadata[current_table]["fields"].append(field_name)
                    metadata[current_table]["descriptions"][field_name] = description
    except FileNotFoundError:
        print(f"Error: Metadata file not found at {metadata_file_path}")
    except Exception as e:
        print(f"Error loading metadata from file: {str(e)}")
    return metadata