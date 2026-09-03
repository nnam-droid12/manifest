"""Carrier lookups against the FMCSA SAFER system — real, free, public government data.

See manifest_agents.tools.fmcsa in the main agents/ package for the full
writeup (including the ongoing FMCSA outage). Duplicated here rather than
imported because this AgentCore deployment package is zipped and shipped
standalone — it can't reach back into the sibling agents/ package at
runtime.
"""

import json
import urllib.error
import urllib.parse
import urllib.request
import os

from strands import tool

BASE_URL = "https://mobile.fmcsa.dot.gov/qc/services/carriers"


def _get(path: str) -> dict:
    webkey = os.environ.get("FMCSA_WEBKEY", "")
    if not webkey:
        return {
            "error": "FMCSA_WEBKEY is not configured. Register a free key at "
            "https://mobile.fmcsa.dot.gov/QCDevsite/docs/getStarted and set FMCSA_WEBKEY."
        }

    url = f"{BASE_URL}{path}?webKey={urllib.parse.quote(webkey)}"
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
