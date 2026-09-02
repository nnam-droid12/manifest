from manifest_agents.load_matching.agent import LaneCriteria
from manifest_agents.orchestrator.agent import run_load_lifecycle


def _run(label: str, mc_number: str) -> None:
    print(f"\n{'=' * 70}\n{label}\n{'=' * 70}")
    criteria = LaneCriteria(
        origin="Chicago", destination="Atlanta", equipment_type="Reefer", rate_floor=1400
    )
    result = run_load_lifecycle(criteria, candidate_mc_number=mc_number, contact_email="broker@manifest-demo.example")
    print("\n--- Orchestrator step log ---")
    for step in result.steps_log:
        print(f"  - {step}")
    print(f"\n--- Final status: {result.status} ---")
    print(result.summary)


if __name__ == "__main__":
    _run("SCENARIO 1: HIGH-risk carrier — should stop before outreach", "MC-1187765")
    _run("SCENARIO 2: LOW-risk carrier — should proceed to an offer", "MC-512873")
