from dataclasses import dataclass

from strands import Agent

from manifest_agents.models import get_reasoning_model
from manifest_agents.tools.textract import extract_document_fields

SYSTEM_PROMPT = """\
You are the Document Extraction Agent for Manifest, an AI freight brokerage
system. You process incoming carrier documents — rate confirmations, Bills of
Lading — and reconcile them against what the broker actually agreed to.

Rules:
- Always call extract_document_fields on the given file first. Use both the
  structured "fields" it returns and the raw "lines" — Textract's form
  detection is good but not perfect, so cross-check against the raw lines if
  a field looks off or missing.
- You will be told the shipment's expected terms (rate, carrier, pickup/
  delivery dates, reference number) as previously agreed. Compare every one
  of those against what the document actually says.
- A mismatch on rate is the highest-priority thing to catch — that is exactly
  the scenario where a carrier's paperwork quietly states a different number
  than what was verbally/by-email agreed, and it needs to be caught before
  anyone signs or pays against it, not discovered afterward.
- Report each field as MATCH or MISMATCH with the expected value vs. the
  document's value. Do not soften a mismatch or rationalize it away — if the
  numbers differ, say so plainly and flag it for broker review regardless of
  how small the difference is.
- End with a clear overall verdict: either "matches expected terms" or
  "discrepancies found — do not proceed without broker review", and list
  exactly what needs review.
"""


@dataclass
class ExtractionResult:
    file_path: str
    narrative: str


def build_document_extraction_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[extract_document_fields],
    )


def reconcile_document(file_path: str, expected_terms: dict) -> ExtractionResult:
    agent = build_document_extraction_agent()
    expected_str = ", ".join(f"{k}: {v}" for k, v in expected_terms.items())
    result = agent(
        f"Process the document at {file_path}. Expected shipment terms (previously agreed): "
        f"{expected_str}. Reconcile and report."
    )
    return ExtractionResult(file_path=file_path, narrative=str(result))
