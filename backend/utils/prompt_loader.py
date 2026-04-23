"""Load prompt text files for agents."""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


def load_prompt(file_path: str) -> str:
    """Load UTF-8 prompt text. ``file_path`` is relative to the backend package root."""
    path = _BACKEND_ROOT / file_path.replace("\\", "/").lstrip("/")
    return path.read_text(encoding="utf-8")


def load_dynamic_example_prompt(table_names: list) -> str:
    """Concatenate per-table example snippets from ``prompts/snowflake/snowflake_rei_tables/``."""
    example_texts = []
    for table_name in table_names:
        rel = f"prompts/snowflake/snowflake_rei_tables/{table_name}.txt"
        try:
            example_texts.append(load_prompt(rel))
        except FileNotFoundError:
            logger.warning("Prompt file not found: %s", rel)
    return "\n".join(example_texts)
