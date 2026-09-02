from manifest_agents.tools.playbook import search_playbook


def test_finds_relevant_note_for_blacklisted_carrier():
    results = search_playbook("Rapid Transit Logistics reefer load")
    assert len(results) > 0
    assert any("Rapid Transit" in r["note"] for r in results)


def test_finds_relevant_note_for_customer_preference():
    results = search_playbook("Halden Foods delivery running late")
    assert len(results) > 0
    assert any("Halden Foods" in r["note"] for r in results)


def test_irrelevant_query_returns_nothing_or_low_relevance():
    results = search_playbook("quantum computing merger acquisition")
    assert results == []


def test_results_are_ranked_by_relevance():
    results = search_playbook("new authority carrier human review")
    assert len(results) > 0
    scores = [r["relevance_score"] for r in results]
    assert scores == sorted(scores, reverse=True)
