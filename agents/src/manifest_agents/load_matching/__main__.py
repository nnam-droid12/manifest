from manifest_agents.load_matching.agent import LaneCriteria, find_matches

if __name__ == "__main__":
    criteria = LaneCriteria(
        origin="Chicago",
        destination="Atlanta",
        equipment_type="",
        rate_floor=1400,
    )
    result = find_matches(criteria)
    print(result.narrative)
    print("\nBEST MATCH:", result.best_match)
