from strands import tool

from manifest_agents.config import get_settings
from manifest_agents.tools.voice import synthesize_speech, transcribe_audio

# Set by the test/demo runner before invoking the agent — stands in for
# "what the carrier actually said on the call," which the agent must reason
# over blind, the same way it would a real call recording it didn't script.
# Never read or set from inside the agent's own reasoning.
_simulated_carrier_reply: str | None = None


def set_simulated_carrier_reply(text: str) -> None:
    global _simulated_carrier_reply
    _simulated_carrier_reply = text


@tool
def conduct_voice_checkin(question: str) -> dict:
    """Call the carrier and ask a check-in question; returns their transcribed reply.

    Speaks `question` via Amazon Polly (the real outbound TTS leg). The
    carrier's spoken reply — captured by a live call in production — is
    processed through Amazon Transcribe here exactly the same way a real
    call recording would be; this function does not let you see or choose
    what they say, only what you asked and what came back.

    Args:
        question: The check-in question to ask, e.g. "What's your current
            status and ETA for this load?"

    Returns:
        {question, transcript} — transcript is real Amazon Transcribe output.
    """
    if _simulated_carrier_reply is None:
        raise RuntimeError("No simulated carrier reply configured — call set_simulated_carrier_reply first.")

    settings = get_settings()
    synthesize_speech(question, voice_id="Matthew")  # the real outbound TTS leg
    reply_audio = synthesize_speech(_simulated_carrier_reply, voice_id="Joanna")
    transcript = transcribe_audio(reply_audio, bucket=settings.documents_bucket)
    return {"question": question, "transcript": transcript}
