"""
Module Name: title_generator.py

Description:
This module generates concise chat session titles using OpenAI,
based on the conversation messages in a session.
"""

# -----------------------------------------------------------------------------
# SECTION: Imports
# -----------------------------------------------------------------------------

import os
import logging

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# -----------------------------------------------------------------------------
# SECTION: Setup
# -----------------------------------------------------------------------------

load_dotenv()
logger = logging.getLogger(__name__)

# Initialize a lightweight model for title generation
title_model = ChatOpenAI(
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    model_name="gpt-3.5-turbo",
    temperature=0.5,
    max_tokens=12,
)

# -----------------------------------------------------------------------------
# SECTION: Title Generation
# -----------------------------------------------------------------------------

def generate_session_title(messages: list) -> str:
    """
    Generate a concise title for a chat session using OpenAI.

    Args:
        messages (list): List of dicts like [{"role": "user", "content": "..."}, ...]

    Returns:
        str: A short title (max 3 words).
    """
    if not messages:
        return "Untitled Chat"

    conversation = "\n".join(
        f"{m['role'].capitalize()}: {m['content']}" for m in messages
    )
    prompt = f"""Based on the following conversation, generate a short and meaningful session title (max 3 words):

Conversation:
{conversation}

Title:"""

    try:
        response = title_model.invoke([HumanMessage(content=prompt)])
        title = response.content.strip()
        return title if title else "Untitled Chat"
    except Exception as e:
        logger.error(f"Error generating session title: {e}")
        return "Untitled Chat"

# -----------------------------------------------------------------------------
# END OF MODULE
# -----------------------------------------------------------------------------
