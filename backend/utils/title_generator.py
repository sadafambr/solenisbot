import logging

from langchain_core.messages import HumanMessage

from models.azure_openai_model import model

logger = logging.getLogger(__name__)


def generate_session_title(messages):
    """
    Generate a concise title for a chat session using the same LLM as the rest of the app.
    :param messages: List of dicts like [{role: "user", content: "..."}, ...]
    :return: A string title
    """
    if not messages:
        return "Untitled Chat"

    conversation = "\n".join(
        f"{(m.get('role') or 'user')}: {m.get('content', '')}" for m in messages
    )
    prompt = f"""Based on the following conversation, generate a short and meaningful session title (max 3 words):

Conversation:
{conversation}

Title:"""

    try:
        response = model.invoke([HumanMessage(content=prompt)])
        text = (getattr(response, "content", None) or "").strip()
        return text or "Untitled Chat"
    except Exception as e:
        logger.warning("generate_session_title failed: %s", e)
        return "Untitled Chat"
