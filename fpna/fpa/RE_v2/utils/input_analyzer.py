"""
Input Analysis Utilities

Pre-processes user input to detect patterns and route appropriately
before sending to LLM agents.
"""

import re
import os
from typing import Dict, List, Optional
from utils.entity_resolver import resolve_entities, is_overall_query, refresh_dynamic_index
from agents.snowflake_agents.snowflake_query_agent import generate_table_metadata_from_file

_ENTITY_INDEX = None

def _get_entity_index(refresh=False):
    global _ENTITY_INDEX
    if _ENTITY_INDEX is None or refresh:
        print("InputAnalyzer: Initializing entity index...")
        # Update path to RE_v2 local path
        metadata_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "metadata.txt")
        if os.path.exists(metadata_file_path):
            print(f"InputAnalyzer: Reading metadata from {metadata_file_path}")
            table_metadata = generate_table_metadata_from_file(metadata_file_path)
            print("InputAnalyzer: Refreshing dynamic index from Snowflake (this may take a minute)...")
            _ENTITY_INDEX = refresh_dynamic_index(table_metadata)
            print("InputAnalyzer: Entity index initialized.")
        else:
            print(f"Warning: Metadata file not found at {metadata_file_path}. Entity index will be empty.")
            _ENTITY_INDEX = {}
    return _ENTITY_INDEX

def analyze_user_input(user_input: str) -> Dict[str, any]:
    """
    Analyze user input for patterns that require specific handling.
   
    Returns:
        Dict with analysis results, routing recommendations, and resolved entities
    """
    analysis = {
        "requires_clarification": False,
        "clarification_type": None,
        "detected_patterns": {},
        "routing_recommendation": None,
        "assumptions": [],
        "is_overall_query": False,
        "resolved_entities": {}  # Store resolved entities for query generation
    }

    try:
        entity_index = _get_entity_index()
        resolutions = resolve_entities(user_input, entity_index)
        analysis["detected_patterns"]["resolutions"] = resolutions
        analysis["resolved_entities"] = resolutions

        person_roles = ["Client Partner", "Opportunity Owner", "Delivery Partner"]
        text_lower = user_input.lower()

        # Handle "Account Executive" as Opportunity Owner
        if "account executive" in text_lower:
            for token, v in resolutions.items():
                if any(c["semantic_type"] in person_roles for c in v["candidates"]):
                    # Force Opportunity Owner for Account Executive
                    chosen_candidate = next((c for c in v["candidates"] if c["semantic_type"] == "Opportunity Owner"), None)
                    if chosen_candidate:
                        analysis["resolved_entities"][token] = {
                            "chosen": chosen_candidate,
                            "candidates": v["candidates"],
                            "requires_clarification": False,
                            "is_overall": v.get("is_overall", False)
                        }
                        analysis["assumptions"].append(f"Assumed '{token}' as Opportunity Owner due to 'Account Executive' in query")
                    else:
                        analysis["assumptions"].append(f"Assumed '{token}' as Opportunity Owner, but no matching data found in index")
                    break  
        else:
            for token, v in resolutions.items():
                if any(c["semantic_type"] in person_roles for c in v["candidates"]):
                    if v["requires_clarification"] or len(v["candidates"]) > 1 or not v.get("chosen"):
                        analysis["requires_clarification"] = True
                        analysis["clarification_type"] = "person_role"
                        analysis["detected_patterns"]["person_names"] = analysis["detected_patterns"].get("person_names", []) + [token]
                    else:
                        ch = v.get("chosen")
                        analysis["assumptions"].append(f"Assumed '{token}' as {ch['semantic_type']} in column {ch['column']}")
                elif v["requires_clarification"]:
                    analysis["requires_clarification"] = True
                    analysis["clarification_type"] = "entity_ambiguity"

        if is_overall_query(user_input):
            analysis["is_overall_query"] = True
            analysis["assumptions"].append("Query interpreted as overall/corporate level (no specific entity filters applied for budget)")

    except Exception as e:
        print(f"Error in entity resolution: {str(e)}")

    person_names = detect_person_names(user_input)
    if person_names and not check_role_specification(user_input, person_names) and "account executive" not in text_lower:
        analysis["requires_clarification"] = True
        analysis["clarification_type"] = "person_role"
        analysis["detected_patterns"]["person_names"] = person_names
        analysis["routing_recommendation"] = "human_agent"
    elif not analysis["requires_clarification"]:
        analysis["routing_recommendation"] = "snowflake_agent"

    if is_direct_metric_query(user_input) and not analysis["requires_clarification"]:
        analysis["routing_recommendation"] = "snowflake_agent"

    return analysis

def is_direct_metric_query(text: str) -> bool:
    metric_keywords = [
        "budget achievement", "win rate", "average deal size", "bookings", "deal velocity",
        "trend", "contribution", "growth", "pipeline conversion ratio", "achievement", "closed amount", "total budget"
    ]
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in metric_keywords)

def detect_person_names(text: str) -> List[str]:
    known_names = ["Sheshu Panga", "John Smith", "Sarah Johnson", "Manish Nair", "Madhu Narasimhan", "Vivek Mangal"]
    exclude_names = [
        "Service Now", "Boston Scientific", "SAP Oracle", "New Deal", "Renewal", 
        "Commercial Business", "Business Unit", "Department", "Unit", "Commercial"
    ]
    non_person_terms = [
        "New Deal", "Renewal", "Reconciliation", "New Business", "Upsell", "Cross-sell",
        "Enterprise Agreement", "Enterprise License", "Cloud Service", "Professional Service",
        "Business Unit", "Commercial Business"
    ]
    text_lower = text.lower()
    found_names = [name for name in known_names if name.lower() in text_lower]
    pattern = r'\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b'
    regex_matches = re.findall(pattern, text)
    for match in regex_matches:
        match_lower = match.lower()
        is_excluded = (
            match in exclude_names or
            any(term.lower() in match_lower for term in ["now", "scientific", "systems", "corp", "inc"]) or
            any(term.lower() in match_lower for term in [t.lower() for t in non_person_terms])
        )
        if not is_excluded and match not in found_names:
            found_names.append(match)
    return list(set(found_names))

def check_role_specification(text: str, person_names: List[str]) -> bool:
    text_lower = text.lower()
    role_keywords = [
        "opportunity owner", "client partner", "account owner",
        "delivery partner", "account executive"
    ]
    return any(role in text_lower for role in role_keywords)

def generate_clarification_question(analysis: Dict[str, any], user_input: str) -> str:
    if analysis["clarification_type"] == "entity_ambiguity":
        resolutions = analysis["detected_patterns"].get("resolutions", {})
        parts = []
        for token, v in resolutions.items():
            if v.get("requires_clarification"):
                types = sorted({c["semantic_type"] for c in v.get("candidates", [])})
                parts.append(f"'{token}' could be: " + " or ".join(types))
        return (
            "I found ambiguous terms in your query. Please clarify:\n"
            + "\n".join(f"• {p}" for p in parts)
            + "\nFor example, specify 'client partner Manish Nair' or 'department Integration'."
        )
    if analysis["clarification_type"] == "person_role":
        names = ", ".join(analysis["detected_patterns"].get("person_names", []))
        return (
            f"To analyze the data for {names}, please specify their role:\n\n"
            f"• Client Partner\n• Opportunity Owner\n• Delivery Partner\n\n"
            f"For example, '{names} as Client Partner'."
        )
    return "I need more information to process your request accurately."
