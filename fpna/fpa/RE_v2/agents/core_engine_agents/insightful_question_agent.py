"""
Module Name: insightful_question_agent.py
 
Description:
This module generates 2–3 follow-up questions based on the original user query
and the assistant's generated response.
"""

import os
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.callbacks import get_openai_callback
from models.azure_openai_model import model

def generate_related_questions(user_input: str, llm_response: str, table_metadata: dict) -> list:
    """
    Dynamically generates follow-up questions based on the context of the user query, LLM response, and table metadata.
    """
    # Convert metadata dictionary to a readable format for the LLM
    metadata_description = "\n".join(
        [f"Table: {table_name}\nFields and Descriptions:\n" +
         "\n".join([f"- {field}: {desc}" for field, desc in metadata["descriptions"].items()])
         for table_name, metadata in table_metadata.items()]
    )

    dynamic_prompt = f"""
You are a sales analytics assistant who generates smart and varied follow-up questions for analysts and leaders.
 
### Metadata:
{metadata_description}
 
### Instructions:
1. Use the metadata above to understand the context of the user's query and the assistant's response.
2. Generate **only one insightful, non-repetitive** follow-up questions that help business stakeholders dig deeper.
3. Ensure the questions are diverse and meaningful, focusing on revenue, pipeline, or operational drivers.
 
### User Query:
\"\"\"{user_input}\"\"\"
 
### Assistant Response:
\"\"\"{llm_response}\"\"\"
 
### Output Format:
**Insightful Questions:**
1. ...
"""

    try:
        with get_openai_callback() as cb:
            response = model.invoke([
                SystemMessage(content="You generate structured, sales-relevant follow-up questions."),
                HumanMessage(content=dynamic_prompt)
            ])
            return response.content.strip().split("\n"), cb.prompt_tokens, cb.total_tokens
    except Exception as e:
        print(f"Error in generate_related_questions: {e}")
        return [], 0, 0
