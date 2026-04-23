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
from typing import List, Optional, Tuple, Dict, Any
import json
import logging
import re

# Third-party imports
from langchain_community.callbacks import get_openai_callback
from langchain_core.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field

# Local application imports
from models.azure_openai_model import model
from utils.prompt_loader import load_prompt

logger = logging.getLogger(__name__)

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


def _strip_json_comments(s: str) -> str:
    s = re.sub(r"//[^\n]*", "", s)
    s = re.sub(r"/\*[\s\S]*?\*/", "", s)
    return s


def _extract_json_object_array(text: str) -> str:
    t = (text or "").strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t, re.IGNORECASE)
    if fence:
        t = fence.group(1).strip()
    t = _strip_json_comments(t)
    decoder = json.JSONDecoder()
    for i, ch in enumerate(t):
        if ch not in "{[":
            continue
        try:
            _, end = decoder.raw_decode(t, i)
            return t[i:end]
        except json.JSONDecodeError:
            continue
    return t


def _coerce_function_params(
    function_params: Any, question: str, user_input: str, function_name: str
) -> List[str]:
    """Always pass a list of strings to agents; maps bad dict outputs to a single user query string."""
    q = (question or user_input or "").strip()
    if isinstance(function_params, list):
        out = [str(x).strip() for x in function_params if x is not None and str(x).strip()]
        return out if out else [q] if q else [""]
    if isinstance(function_params, str) and function_params.strip():
        return [function_params.strip()]
    if isinstance(function_params, dict) and function_params:
        vals = [str(v).strip() for v in function_params.values() if v is not None and str(v).strip()]
        if len(vals) == 1:
            return [vals[0]]
        if q:
            return [q]
        return [", ".join(vals)]
    if q:
        return [q]
    return [""] if function_name in ("generic_conversation_agent", "human_agent") else [user_input or ""]


def _normalize_depends_on(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    if isinstance(raw, int) and raw >= 1:
        return raw
    if isinstance(raw, str):
        s = raw.strip()
        if s == "" or s.lower() in ("null", "none"):
            return None
        if s.isdigit():
            return int(s)
    return None


def _normalize_tasks_payload(data: Any, user_input: str) -> Dict[str, Any]:
    if isinstance(data, list):
        data = {"tasks": data}
    if not isinstance(data, dict) or "tasks" not in data:
        return {"tasks": []}
    raw_tasks = data["tasks"] or []
    out: list = []
    for t in raw_tasks:
        if not isinstance(t, dict):
            continue
        fn = (t.get("function_name") or "snowflake_agent").strip() or "snowflake_agent"
        qu = (t.get("question") or user_input or "").strip()
        fp = _coerce_function_params(
            t.get("function_params"), qu, user_input, fn
        )
        t = {
            "question": qu,
            "function_name": fn,
            "function_params": fp,
            "depends_on": _normalize_depends_on(t.get("depends_on")),
        }
        out.append(t)
    return {"tasks": out}


def parse_supervisor_model_output(text: str, user_input: str) -> Dict[str, Any]:
    """
    Best-effort parse of the supervisor LLM output into ``{'tasks': [...]}``.
    Tolerates markdown fences, // comments, and dict-shaped function_params.
    """
    cleaned = _extract_json_object_array(text)
    for payload in (cleaned, re.sub(r",\s*([}\]])", r"\1", cleaned)):
        try:
            data = json.loads(payload)
            return _normalize_tasks_payload(data, user_input)
        except json.JSONDecodeError:
            continue
    logger.error("supervisor JSON parse failed; snippet=%r", cleaned[:500])
    return {
        "tasks": [
            {
                "question": user_input,
                "function_name": "snowflake_agent",
                "function_params": [user_input],
                "depends_on": None,
            }
        ]
    }


# LLM only — we parse JSON manually so invalid examples in older prompts cannot break the graph
supervisor_raw_chain = supervisor_prompt | model

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
            hist_str = (
                json.dumps(conversation_history, ensure_ascii=False)[:30000]
                if conversation_history
                else "[]"
            )
            msg = supervisor_raw_chain.invoke(
                {
                    "user_input": user_input,
                    "conversation_history": hist_str,
                }
            )
            input_tokens_count = cb.prompt_tokens
            output_tokens_count = cb.completion_tokens

        raw = getattr(msg, "content", None) or str(msg)
        ai_response = parse_supervisor_model_output(raw, user_input)
        if not (isinstance(ai_response, dict) and (ai_response.get("tasks") or [])):
            return (
                {
                    "error": "Supervisor returned no tasks after parsing; raw output was: %s"
                    % (raw[:800] if isinstance(raw, str) else str(raw)[:800])
                },
                0,
                0,
            )
        return ai_response, input_tokens_count, output_tokens_count

    except Exception as e:
        # Log and return a failure response
        error_message = {"error": str(e)}
        return error_message, 0, 0


# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------
