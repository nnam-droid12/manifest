from manifest_agents.load_matching.agent import LaneCriteria, find_matches

if __name__ == "__main__":
    criteria = LaneCriteria(
        origin="Chicago",
        destination="Atlanta",
        equipment_type="",
        rate_floor=1400,
    )
    print(find_matches(criteria))
