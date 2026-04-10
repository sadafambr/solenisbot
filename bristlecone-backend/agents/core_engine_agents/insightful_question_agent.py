"""
Module Name: insightful_question_agent.py
 
Description:
This module generates 2–3 follow-up questions based on the original user query
and the assistant's generated response. The follow-up questions are restricted
to be about regions, agents (business units), or accounts.
"""
 
import os
from dotenv import load_dotenv
from langchain.chat_models import ChatOpenAI  # type: ignore
from langchain.schema import HumanMessage, SystemMessage  # type: ignore
from langchain_community.callbacks import get_openai_callback  # type: ignore
 
# Load API key from .env
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
 
# Initialize model
llm = ChatOpenAI(model="gpt-4.1", temperature=0.3, openai_api_key=openai_api_key)
 
def generate_related_questions(user_input: str, llm_response: str, table_metadata: dict) -> list:
    """
    Dynamically generates follow-up questions based on the context of the user query, LLM response, and table metadata.
 
    Args:
        user_input (str): Original user query.
        llm_response (str): Response from LLM.
        table_metadata (dict): Metadata containing all fields and descriptions from the relevant tables.
 
    Returns:
        list: A list of dynamically generated follow-up questions.
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
3. Ensure the questions are diverse and meaningful, focusing on:
   - Comparisons (e.g., across months, regions, or departments).
   - Drivers of performance differences.
   - Pipeline health or account movement (e.g., from hunting to farming).
   - Forecast accuracy or missed targets.
   - Customer segmentation and behavior patterns (e.g., repeat customers, customer churn).
   - Operational efficiency (e.g., stage duration, deal approval time).
   - Trend analysis (e.g., changes in pipeline value over time, seasonality effects).
   - Risk identification (e.g., accounts at risk of churn, deals likely to slip).
   - Revenue opportunities (e.g., upsell or cross-sell potential, high-value accounts).
   - Benchmarking (e.g., performance comparison across teams, regions, or time periods).
4. Use the metadata fields and descriptions to generate questions that are directly relevant to the user's query and the assistant's response.
5. Avoid repeating questions and ensure they are actionable and insightful.
 
### User Query:
\"\"\"{user_input}\"\"\"
 
### Assistant Response:
\"\"\"{llm_response}\"\"\"
 
### Output Format:
**Insightful Questions:**
1. ...
"""
 
    with get_openai_callback() as cb:
        response = llm([
            SystemMessage(content="You generate structured, sales-relevant follow-up questions."),
            HumanMessage(content=dynamic_prompt)
        ])
        return response.content.strip().split("\n"), cb.prompt_tokens, cb.total_tokens
 
 