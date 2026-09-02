from manifest_agents.voice_checkin.agent import run_checkin


def _run(label: str, shipment_id: str, carrier_says: str) -> None:
    print(f"\n{'=' * 70}\n{label}\n{'=' * 70}")
    result = run_checkin(shipment_id, carrier_says)
    print(result.narrative)


if __name__ == "__main__":
    _run(
        "SCENARIO 1: normal check-in, on schedule",
        "SHP-3001",
        "Yeah we're doing fine, just passed Nashville, should be in Atlanta by tomorrow morning like planned.",
    )
    _run(
        "SCENARIO 2: real problem — breakdown",
        "SHP-3001",
        "Uh, yeah, not great actually, the truck broke down outside Knoxville, I've got a mechanic "
        "looking at it now but I honestly don't know how long it's gonna be, could be a few hours.",
    )
