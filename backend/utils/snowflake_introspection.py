"""
Detect Snowflake *metadata* questions (list tables, schemas, databases) and build read-only SQL. Business questions should keep using the LLM + TPCH table prompts.
"""

from __future__ import annotations

import re


def is_list_tables_intent(text: str) -> bool:
    """User wants to see table names in the current database/schema."""
    t = (text or "").strip().lower()
    if "table" not in t and "tables" not in t:
        return False
    # Avoid common business phrasing: "customer table" alone shouldn't trigger
    if re.search(
        r"(?i)(list|show|display|enumerate|see|get|name|name\s+all)\s+"
        r"(all\s+)?(the\s+)?(table|tables)\b",
        text,
    ):
        return True
    if re.search(r"(?i)\b(what|which)\s+(tables|table)\b", text):
        return True
    if re.search(r"(?i)\b(tables|table)\s+(in|available|in\s+this|in\s+the|in\s+my)\b", text):
        return True
    if re.search(r"(?i)\b(list|show)\b.*\b(tables|table)\b.*\b(database|schema|snowflake|db)\b", text):
        return True
    if re.search(r"(?i)\b(all|the)\s+tables\s+(in|here|available|exist|you\s+have)\b", text):
        return True
    return False


def is_list_schemas_intent(text: str) -> bool:
    t = (text or "").strip().lower()
    if "schema" not in t and "schemas" not in t:
        return False
    return bool(
        re.search(
            r"(?i)(list|show|display|what|which|get|all)\s+"
            r"(all\s+)?(the\s+)?(schema|schemas)\b",
            text,
        )
    )


def is_list_databases_intent(text: str) -> bool:
    t = (text or "").strip().lower()
    if "database" not in t and "databases" not in t and "dbs" not in t:
        return False
    return bool(
        re.search(
            r"(?i)(list|show|display|what|which|get|all)\s+"
            r"(all\s+)?(the\s+)?(database|databases|dbs)\b",
            text,
        )
    )


def sql_list_tables_in_current_context() -> str:
    """
    Read-only: tables and views in the connection's current database + schema.
    Uses LIMIT 500; connector will not add a second cap if 'limit' is present.
    """
    return (
        "SELECT table_catalog, table_schema, table_name, table_type "
        "FROM information_schema.tables "
        "WHERE table_catalog = CURRENT_DATABASE() "
        "AND table_schema = UPPER(CURRENT_SCHEMA()) "
        "AND table_type IN ('BASE TABLE', 'VIEW') "
        "ORDER BY table_name "
        "LIMIT 500"
    )


def sql_list_schemas() -> str:
    return (
        "SELECT catalog_name, schema_name, schema_owner "
        "FROM information_schema.schemata "
        "WHERE catalog_name = CURRENT_DATABASE() "
        "ORDER BY schema_name "
        "LIMIT 500"
    )


def sql_list_databases() -> str:
    # Account-visible databases (read-only; requires privileges)
    return "SHOW DATABASES LIMIT 500"
