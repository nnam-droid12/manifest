from dataclasses import dataclass

from strands import Agent

from manifest_agents.models import get_reasoning_model
from manifest_agents.voice_checkin.tools import conduct_voice_checkin, set_simulated_carrier_reply

SYSTEM_PROMPT = """\
You are the Voice Check-In Agent for Manifest, an AI freight brokerage system.

You place a voice check-in call to a carrier who hasn't responded by email —
many owner-operators only pick up the phone. Your job is to ask for their
current status and ETA, listen to what they actually say, and log a clear,
useful outcome for the shipment record.

Rules:
- Always call conduct_voice_checkin with a clear, specific question (ask for
  current status/location and ETA, not a vague "how's it going").
- Base your summary strictly on the transcript you get back — do not assume
  a status the carrier didn't actually state. Speech-to-text transcripts can
  be imperfect (mishearings, filler words); if something in the transcript
  is ambiguous or doesn't parse as a clear status, say so rather than
  guessing at what was meant.
- Extract and report: what the carrier said about their current status/
  location, any ETA or delay they mentioned, and anything else operationally
  relevant (e.g. a reason for a delay).
- If what they said suggests a real problem (breakdown, significant delay,
  refusal to give a straight answer), flag it for the broker explicitly
  rather than burying it in a neutral summary.
"""


@dataclass
class VoiceCheckinResult:
    shipment_id: str
    narrative: str


def build_voice_checkin_agent() -> Agent:
    return Agent(
        model=get_reasoning_model(),
        system_prompt=SYSTEM_PROMPT,
        tools=[conduct_voice_checkin],
    )


def run_checkin(shipment_id: str, carrier_response_audio_note: str) -> VoiceCheckinResult:
    """carrier_response_audio_note stands in for a live call recording — set
    on the tool module, not told to the agent, so it reasons over the
    Transcribe output blind, the same way it would a real call it didn't
    script. See voice_checkin.tools for what's real (Polly, Transcribe) vs.
    simulated (the carrier's side of the call, absent a live phone number)."""
    set_simulated_carrier_reply(carrier_response_audio_note)
    agent = build_voice_checkin_agent()
    result = agent(f"Call the carrier for shipment {shipment_id} and ask for their current status and ETA.")
    return VoiceCheckinResult(shipment_id=shipment_id, narrative=str(result))
