"""Retrieval over the broker's playbook notes — stands in for Bedrock Knowledge
Bases' Retrieve API.

A real Bedrock Knowledge Base needs a working embedding model
(amazon.titan-embed-text-v2:0 or similar) to ingest content into its vector
store, and embedding calls go through the same bedrock-runtime InvokeModel
path that's currently blocked account-wide (verified — see agents/README.md).
So this does deterministic keyword-overlap scoring over the same source
files a real Knowledge Base would ingest (seed-data/playbook/*.md), chunked
the same way (one note per bullet point). The retrieval quality is cruder
than real semantic search, but the tool's contract — ask a question, get
back the most relevant precedent notes — is the same either way, and swaps
to a real bedrock-agent-runtime Retrieve call without changing callers once
embedding access clears.
"""

import re
from pathlib import Path

from strands import tool

_PLAYBOOK_DIR = Path(__file__).resolve().parents[4] / "seed-data" / "playbook"

_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "to", "of", "and", "or",
    "for", "on", "in", "at", "this", "that", "it", "as", "with", "by", "from",
}


def _load_notes() -> list[str]:
    """Parse markdown bullets into notes, joining wrapped continuation lines.

    A bullet like "- Never book Carrier X for\n  temperature-controlled
    loads..." is two source lines but one note — a continuation line is any
    non-blank line that doesn't start a new bullet (`- `) or heading (`#`).
    """
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
