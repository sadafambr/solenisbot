import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
_client = OpenAI()


def generate_session_title(messages):
    """
    Generate a concise title for a chat session using OpenAI.
    :param messages: List of dicts like [{role: "user", content: "..."}, ...]
    :return: A string title
    """
    if not messages:
        return "Untitled Chat"

    conversation = "\n".join(f"{m['role'].capitalize()}: {m['content']}" for m in messages)
    prompt = f"""Based on the following conversation, generate a short and meaningful session title (max 3 words):

Conversation:
{conversation}

Title:"""

    response = _client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        max_tokens=12,
    )

    return (response.choices[0].message.content or "").strip()
