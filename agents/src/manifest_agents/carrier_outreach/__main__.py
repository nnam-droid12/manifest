from manifest_agents.carrier_outreach.agent import make_offer

if __name__ == "__main__":
    result = make_offer(
        load_id="1002",
        target_rate=1650,
        ceiling_rate=1680,
        contact_email="broker@manifest-demo.example",
    )
    print(result.narrative)
