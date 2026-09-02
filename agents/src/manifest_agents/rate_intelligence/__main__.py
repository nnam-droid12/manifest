from manifest_agents.rate_intelligence.agent import recommend_rate

if __name__ == "__main__":
    result = recommend_rate("Chicago, IL", "Atlanta, GA", "Reefer")
    print(result.narrative)
