"""
Resolve Snowflake credentials from env.

Supports Bristlecone-style names (SNOWFLAKE_*) and RE_v2 .env names (SF_*, DB_*).
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _strip_val(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    if len(v) >= 2 and ((v[0] == v[-1] == '"') or (v[0] == v[-1] == "'")):
        v = v[1:-1].strip()
    return v if v else None


def _first(*keys: str) -> str | None:
    for k in keys:
        raw = os.getenv(k)
        val = _strip_val(raw)
        if val:
            return val
    return None


def snowflake_fq_table(table_name: str) -> str:
    database = _first("SNOWFLAKE_DATABASE", "SF_DATABASE", "DB_NAME") or ""
    schema = _first("SNOWFLAKE_SCHEMA", "SF_SCHEMA") or "PUBLIC"
    if database:
        return f'"{database}"."{schema}"."{table_name}"'
    else:
        return f'"{schema}"."{table_name}"'


def snowflake_connect_kwargs() -> dict:
    user = _first("SNOWFLAKE_USER", "SF_USER", "DB_USER")
    password = _first("SNOWFLAKE_PASSWORD", "SF_PASSWORD", "DB_PASSWORD")
    account = _first("SNOWFLAKE_ACCOUNT", "SF_ACCOUNT", "DB_HOST")
    database = _first("SNOWFLAKE_DATABASE", "SF_DATABASE", "DB_NAME")
    schema = _first("SNOWFLAKE_SCHEMA", "SF_SCHEMA") or "PUBLIC"
    warehouse = _first("SNOWFLAKE_WAREHOUSE", "SF_WAREHOUSE", "DB_WAREHOUSE")
    role = _first("SNOWFLAKE_ROLE", "SF_ROLE", "DB_ROLE")

    kwargs: dict = {
        "user": user,
        "password": password,
        "account": account,
        "warehouse": warehouse,
        "database": database,
        "schema": schema,
    }
    if role:
        kwargs["role"] = role
    return {k: v for k, v in kwargs.items() if v is not None and v != ""}
