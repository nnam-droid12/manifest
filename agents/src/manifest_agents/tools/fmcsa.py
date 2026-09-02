"""Carrier lookups against the FMCSA SAFER system — real, free, public government data.

Uses the QCMobile API (https://mobile.fmcsa.dot.gov/QCDevsite/docs/getStarted),
which requires a free registered webKey (FMCSA_WEBKEY env var). Returns the raw
FMCSA response rather than hand-mapping specific fields: the response shape has
known inconsistencies across endpoints, and an LLM reading the JSON directly is
more robust than a brittle field-path parser that breaks the moment FMCSA
renames something.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

from strands import tool

from manifest_agents.config import get_settings

BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services/carriers"


def _get(path: str) -> dict:
    settings = get_settings()
    if not settings.fmcsa_webkey:
        return {
            "error": "FMCSA_WEBKEY is not configured. Register a free key at "
            "https://mobile.fmcsa.dot.gov/QCDevsite/docs/getStarted and set FMCSA_WEBKEY."
        }

    url = f"{BASE_URL}{path}?webKey={urllib.parse.quote(settings.fmcsa_webkey)}"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"error": f"FMCSA API returned HTTP {e.code}", "detail": e.read().decode("utf-8", "ignore")}
    except urllib.error.URLError as e:
        return {"error": f"FMCSA API request failed: {e.reason}"}


@tool
def lookup_carrier_by_mc(mc_number: str) -> dict:
    """Look up a carrier's official FMCSA registry record by MC (docket) number.

    Returns the operating authority status, physical address, insurance-on-file
    status, safety rating, and authority-granted date as recorded by FMCSA.

    Args:
        mc_number: The carrier's MC/docket number, e.g. "MC-512873" or "512873".

    Returns:
        The raw FMCSA carrier record (or an "error" key if the lookup failed).
    """
    docket = mc_number.upper().replace("MC-", "").replace("MC", "").strip()
    return _get(f"/docket-number/{docket}")


@tool
def lookup_carrier_by_dot(dot_number: str) -> dict:
    """Look up a carrier's official FMCSA registry record by USDOT number.

    Args:
        dot_number: The carrier's USDOT number, e.g. "3456120".

    Returns:
        The raw FMCSA carrier record (or an "error" key if the lookup failed).
    """
    return _get(f"/{dot_number.strip()}")
