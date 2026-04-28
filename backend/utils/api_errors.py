"""
Map internal exceptions and low-level API errors to user-facing chat messages.
Full detail stays in logs; clients get short, professional text.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def is_debug() -> bool:
    return (os.getenv("FLASK_DEBUG") or "").strip().lower() in ("1", "true", "yes", "on")


def user_facing_message(raw: str) -> str:
    """
    Convert an internal error string into a message suitable for the chat UI.
    In debug mode, append a short technical hint in parentheses (truncated).
    """
    s = (raw or "").strip() or "Unknown error"
    low = s.lower()

    if "supervisor" in low or "invalid json" in low or "json output" in low:
        msg = "We couldn’t route that question. Try rephrasing, or try again in a moment."
    elif any(x in low for x in ("snowflake", "connector", "connection", "not authorized", "login request")):
        msg = "The data service is temporarily unavailable. Please try again shortly."
    elif any(x in low for x in ("openai", "api key", "authentication", "401", "403")):
        msg = "The AI service rejected the request. Check API configuration, then try again."
    elif any(x in low for x in ("timeout", "timed out", "rate limit", "503", "502")):
        msg = "The service is busy or timed out. Please wait a few seconds and try again."
    elif "invalid input" in low and "conversation" in low:
        msg = "We couldn’t read the conversation state. Start a new chat or try your question again."
    elif "list index" in low or "index out of range" in low:
        msg = "A step in the answer pipeline failed. Please try the same question again."
    else:
        msg = "Something went wrong while answering. Please try again. If it keeps happening, contact support."

    if is_debug() and s:
        short = s.replace("\n", " ")
        if len(short) > 120:
            short = short[:117] + "..."
        msg = f"{msg} (debug: {short})"

    return msg


def attach_friendly_error(payload: dict) -> dict:
    """
    If payload has a string `error` key, add `user_message` (and set `message` for clients
    that read `message`). Does not remove the original `error` (string) so logs remain
    unambiguous; frontend should prefer `user_message` or `message` for display.
    """
    if not isinstance(payload, dict):
        return payload
    err = payload.get("error")
    if not (isinstance(err, str) and err.strip()) and isinstance(payload.get("conversation"), dict):
        c_err = payload["conversation"].get("error")
        if isinstance(c_err, str) and c_err.strip():
            payload["error"] = c_err
            err = c_err
    if isinstance(err, str) and err.strip():
        friendly = user_facing_message(err)
        payload["user_message"] = friendly
        if not isinstance(payload.get("message"), str) or not str(payload.get("message")).strip():
            payload["message"] = friendly
    return payload
