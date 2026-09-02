"""Real statistical computation over historical rate data — not an LLM guessing at numbers.

Backed by seed-data/rate-history.json for now (the manifest-rate-history
DynamoDB table, see infra/lib/data-stack.ts, takes over once the swarm is
deployed and booking loads for real).
"""

import json
import statistics
from pathlib import Path

from strands import tool

_RATE_HISTORY_PATH = Path(__file__).resolve().parents[4] / "seed-data" / "rate-history.json"
_MARKET_CONDITIONS_PATH = Path(__file__).resolve().parents[4] / "seed-data" / "market-conditions.json"


def _load_json(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@tool
def compute_rate_stats(origin: str, destination: str, equipment_type: str) -> dict:
    """Compute real historical-rate statistics for a lane and equipment type.

    Filters the broker's own booked-load history to this exact lane/equipment
    and computes count, mean, median, min, max, and the 25th/75th percentiles
    with Python's statistics module — actual arithmetic over actual records,
    not a model estimating a number from memory.

    Args:
        origin: Origin city/state, e.g. "Chicago, IL".
        destination: Destination city/state, e.g. "Atlanta, GA".
        equipment_type: "Dry Van", "Reefer", or "Flatbed".

    Returns:
        A dict with sample_size and the rate statistics, or an "error" key if
        there's no history for this lane/equipment (too thin a sample to trust).
    """
    history = _load_json(_RATE_HISTORY_PATH)
    rates = sorted(
        r["rate"]
        for r in history
        if r["origin"] == origin and r["destination"] == destination and r["equipment_type"] == equipment_type
    )

    if len(rates) < 2:
        return {
            "error": f"Only {len(rates)} historical booking(s) on file for this lane/equipment — "
            "too thin a sample for a statistically grounded recommendation."
        }

    quantiles = statistics.quantiles(rates, n=4, method="inclusive")
    return {
        "sample_size": len(rates),
        "mean": round(statistics.mean(rates), 2),
        "median": round(statistics.median(rates), 2),
        "min": min(rates),
        "max": max(rates),
        "p25": round(quantiles[0], 2),
        "p75": round(quantiles[2], 2),
        "stdev": round(statistics.stdev(rates), 2) if len(rates) > 1 else 0,
    }


@tool
def get_market_conditions(origin: str, destination: str) -> dict:
    """Get current load-to-truck market signal for a lane.

    Args:
        origin: Origin city/state, e.g. "Chicago, IL".
        destination: Destination city/state, e.g. "Atlanta, GA".

    Returns:
        load_to_truck_ratio (higher = tighter capacity, upward rate pressure),
        trend, and a short note — or an "error" key if no data exists for this lane.
    """
    for record in _load_json(_MARKET_CONDITIONS_PATH):
        if record["origin"] == origin and record["destination"] == destination:
            return {k: v for k, v in record.items() if k not in ("origin", "destination")}
    return {"error": f"No market condition data on file for {origin} -> {destination}."}
