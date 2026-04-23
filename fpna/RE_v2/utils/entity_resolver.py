from collections import defaultdict
from typing import Dict, List
import re
import difflib
import json
from connectors.snowflake_connector_v2 import SnowflakeConnector

SEMANTIC_TYPES = {
    "Commercial_BU_Name": "Business Unit",
    "Commercial_BU": "Business Unit",
    "Client_Partner": "Client Partner",
    "Delivery_Partner": "Delivery Partner",
    "Opportunity_Owner": "Opportunity Owner",
    "Department": "Department",
    "Account_Name": "Account",
}

OVERALL_INDICATORS = {
    "corporate": "overall",
    "overall": "overall",
    "total": "overall",
    "all": "overall",
    "company": "overall",
    "enterprise": "overall",
    "global": "overall"
}

def build_entity_index(table_metadata: dict) -> Dict[str, List[dict]]:
    index = defaultdict(list)
    for table, meta in table_metadata.items():
        fields = meta.get("fields", [])
        desc = meta.get("descriptions", {})
        for col in fields:
            stype = SEMANTIC_TYPES.get(col)
            if not stype:
                continue
            text = desc.get(col, "")
            m = re.search(r"Sample values:\s*(.+)$", text, re.IGNORECASE)
            candidates = []
            if m:
                raw = m.group(1)
                candidates = [v.strip().strip("[]'\"") for v in raw.split(",")]
            if not candidates or all("no sample" in v.lower() for v in candidates):
                candidates.append(col)
            for v in candidates:
                if v and "no sample" not in v.lower():
                    index[v.lower()].append({"table": table, "column": col, "semantic_type": stype})
    return dict(index)

def refresh_dynamic_index(table_metadata: dict) -> Dict[str, List[dict]]:
    index = defaultdict(list)
    connector = SnowflakeConnector()
    for table, meta in table_metadata.items():
        fields = meta.get("fields", [])
        for col in fields:
            stype = SEMANTIC_TYPES.get(col)
            if not stype:
                continue
            # Snowflake: quoting identifiers with double quotes
            query = f'SELECT DISTINCT "{col}" FROM "{table}" WHERE "{col}" IS NOT NULL LIMIT 100'
            try:
                result_json = connector.execute_query(query)
                data = json.loads(result_json)
                if isinstance(data, list):
                    values = [row.get(col) or row.get(col.upper()) for row in data]
                    for v in values:
                        if v:
                            index[str(v).lower()].append({"table": table, "column": col, "semantic_type": stype})
            except Exception as e:
                print(f"Error fetching data for {table}.{col}: {e}")
    return dict(index)

def resolve_entities(user_input: str, index: Dict[str, List[dict]]) -> Dict[str, dict]:
    text_lower = user_input.lower()
    found: Dict[str, dict] = {}
    
    # Collect overall indicators
    for indicator, meaning in OVERALL_INDICATORS.items():
        if indicator in text_lower:
            m = re.search(re.escape(indicator), text_lower)
            token = user_input[m.start():m.end()] if m else indicator
            found[token] = {
                "chosen": {"table": "overall", "column": "overall", "semantic_type": "overall"},
                "candidates": [],
                "requires_clarification": False,
                "is_overall": True
            }
    
    # Continue to resolve person names and other entities
    for value_lower, cands in index.items():
        similarity = difflib.SequenceMatcher(None, value_lower, text_lower).ratio()
        if similarity > 0.85 or value_lower in text_lower:
            m = re.search(r'\b' + re.escape(value_lower) + r'\b', text_lower, re.IGNORECASE)
            if m:
                token = user_input[m.start():m.end()]
                types = {c["semantic_type"] for c in cands}
                if any(st in ["Client Partner", "Opportunity Owner", "Delivery Partner"] for st in types):
                    chosen = cands[0] if len(types) == 1 and len(cands) == 1 else None
                    found[token] = {
                        "chosen": chosen,
                        "candidates": cands,
                        "requires_clarification": len(types) > 1 or len(cands) > 1 or not chosen,
                        "is_overall": False
                    }
                else:
                    found[token] = {
                        "chosen": cands[0] if len(types) == 1 else None,
                        "candidates": cands,
                        "requires_clarification": len(types) > 1,
                        "is_overall": False
                    }
    return found

def is_overall_query(user_input: str) -> bool:
    """Check if the user input indicates an overall/corporate query."""
    text_lower = user_input.lower()
    return any(indicator in text_lower for indicator in OVERALL_INDICATORS.keys())
