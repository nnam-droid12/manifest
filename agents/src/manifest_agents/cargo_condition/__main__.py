import sys
from pathlib import Path

from manifest_agents.cargo_condition.agent import compare_cargo_photos

DEFAULT_DIR = Path(__file__).resolve().parents[4] / "seed-data" / "cargo-photos"

if __name__ == "__main__":
    pickup = sys.argv[1] if len(sys.argv) > 1 else str(DEFAULT_DIR / "pickup.png")
    delivery = sys.argv[2] if len(sys.argv) > 2 else str(DEFAULT_DIR / "delivery.png")
    result = compare_cargo_photos(pickup, delivery)
    print(result.narrative)
