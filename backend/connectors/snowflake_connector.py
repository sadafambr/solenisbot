"""
Execute read-oriented Snowflake SQL using credentials from ``utils.snowflake_env``.
"""

import json
import logging
import re
from typing import Any, Dict

import snowflake.connector
from dotenv import load_dotenv

from utils.snowflake_env import clean_snowflake_query, snowflake_connect_kwargs

load_dotenv()

logger = logging.getLogger(__name__)


class SnowflakeConnector:
    """Connect and run queries with env resolved via ``snowflake_connect_kwargs``."""

    def __init__(self) -> None:
        self.connection_params: Dict[str, Any] = dict(snowflake_connect_kwargs())

    def _validate_connection_params(self) -> str | None:
        required_fields = ["user", "password", "account", "warehouse", "database", "role"]
        missing = [f for f in required_fields if not self.connection_params.get(f)]
        if missing:
            return f"Missing required Snowflake env vars for: {', '.join(missing)}"

        account = str(self.connection_params.get("account", "")).strip()
        if "/" in account:
            return (
                "Invalid Snowflake account format. Use an identifier like "
                "'<account_locator>.<region>.<cloud>' (SNOWFLAKE_ACCOUNT / SF_ACCOUNT / DB_HOST), "
                "not a value containing '/'."
            )
        return None

    def execute_query(self, sql_query: str) -> str:
        conn = None
        cur = None

        try:
            validation_error = self._validate_connection_params()
            if validation_error:
                logger.error(validation_error)
                return json.dumps({"error": validation_error})

            conn = snowflake.connector.connect(**self.connection_params)
            warehouse_name = self.connection_params["warehouse"]

            cur = conn.cursor()
            cur.execute("USE WAREHOUSE " + warehouse_name)

            cleaned_query = clean_snowflake_query(sql_query)
            if not re.search(r"\blimit\b", cleaned_query.lower()):
                cleaned_query = cleaned_query.rstrip(";") + " LIMIT 10"

            logger.info("Executing Snowflake query: %s", cleaned_query)
            cur.execute(cleaned_query)

            column_names = [metadata.name for metadata in cur.description]
            rows = cur.fetchall()
            return json.dumps(
                [{key: str(value) for key, value in zip(column_names, row)} for row in rows]
            )

        except snowflake.connector.errors.ProgrammingError as pe:
            logger.error(pe)
            return json.dumps({"error": str(pe)})

        except snowflake.connector.errors.DatabaseError as de:
            logger.error(de)
            return json.dumps({"error": f"Snowflake Database Error: {de}"})

        except Exception as e:
            logger.error(e)
            return json.dumps({"error": f"An unexpected error occurred: {e}"})

        finally:
            if cur:
                try:
                    cur.close()
                except Exception:
                    pass
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
