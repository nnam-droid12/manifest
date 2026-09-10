"""Retrieval over the broker's playbook notes — stands in for Bedrock Knowledge
Bases' Retrieve API. See manifest_agents.tools.playbook in the main agents/
package for the full writeup. Duplicated here (not imported) because this
AgentCore deployment package ships standalone.
"""

import re
from pathlib import Path

from strands import tool

_PLAYBOOK_DIR = Path(__file__).resolve().parent.parent / "seed-data" / "playbook"

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "to", "of", "and", "or",
    "for", "on", "in", "at", "this", "that", "it", "as", "with", "by", "from",
}


def _load_notes() -> list[str]:
    notes: list[str] = []
    current: list[str] = []

    def flush() -> None:
        if current:
            notes.append(" ".join(current))
            current.clear()

    for path in sorted(_PLAYBOOK_DIR.glob("*.md")):
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("- "):
                flush()
                current.append(stripped[2:].strip())
            elif stripped and not stripped.startswith("#") and current:
                current.append(stripped)
            elif not stripped:
                flush()
        flush()
    return notes


def _keywords(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w for w in words if w not in _STOPWORDS and len(w) > 2}


@tool
def search_playbook(query: str, top_k: int = 3) -> list[dict]:
    """Search the broker's playbook notes (carrier blacklists, customer
    preferences, lane-specific rate context, standing policy rules) for
    precedent relevant to a query.

    Args:
        query: What you're trying to find precedent for, e.g. "Rapid Transit
            Logistics reefer load" or "Halden Foods delivery delay".
        top_k: Maximum number of notes to return, ranked by relevance.

    Returns:
        A list of {note, relevance_score} dicts, most relevant first. Empty
        list if nothing in the playbook is relevant to the query.
    """
    query_words = _keywords(query)
    if not query_words:
        return []

    scored = []
    for note in _load_notes():
        note_words = _keywords(note)
        overlap = query_words & note_words
        if overlap:
            score = len(overlap) / len(query_words)
            scored.append((score, note))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [{"note": note, "relevance_score": round(score, 2)} for score, note in scored[:top_k]]
