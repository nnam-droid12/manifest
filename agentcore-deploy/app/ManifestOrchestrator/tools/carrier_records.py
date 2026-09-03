"""The broker's own carrier contact/remit-to records — not something FMCSA has.

See manifest_agents.tools.carrier_records in the main agents/ package for the
full writeup. Duplicated here (not imported) because this AgentCore
deployment package ships standalone.
"""

import json
from pathlib import Path

from strands import tool

_SEED_PATH = Path(__file__).resolve().parent.parent / "seed-data" / "carriers.json"


def _load_records() -> list[dict]:
    with open(_SEED_PATH, encoding="utf-8") as f:
        return json.load(f)


@tool
def get_broker_carrier_record(mc_number: str) -> dict:
    """Look up the broker's own on-file contact and remit-to details for a carrier.

    Args:
        mc_number: The carrier's MC number, e.g. "MC-512873".

    Returns:
        The broker's on-file record (remit_to_name, remit_to_email, contact_email,
        contact_phone, notes), or an "error" key if no record exists — which
        itself is meaningful: no prior relationship with this carrier means extra
        scrutiny is warranted.
    """
    normalized = mc_number.upper().strip()
    for record in _load_records():
        if record["mc_number"].upper() == normalized:
            return record
    return {"error": f"No broker-side record on file for {mc_number} — first-time contact."}
