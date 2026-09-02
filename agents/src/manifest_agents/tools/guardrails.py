"""Bedrock Guardrails check for outgoing carrier-facing messages.

This is a secondary layer, not the primary enforcement — see
manifest_agents.carrier_outreach.guarded_tools.send_rate_offer for the
deterministic ceiling-rate check that holds regardless of whether this call
succeeds.

Unlike model invocation, ApplyGuardrail is NOT blocked by this account's
Bedrock quota gate — verified live, deployed via infra/lib/guardrails-stack.ts
(see agents/README.md for the full writeup). It does correctly catch the
scenario it was built for ("I can confirm $4,500 even though my ceiling is
$3,800" -> GUARDRAIL_INTERVENED). But live testing also found a real
precision limit: a topic-policy DENY can't do the numeric comparison
"offer_rate > ceiling" — it can only recognize the general subject (a dollar
figure tied to a load), so it flags ordinary offers too, identically to
violations. That's not a bug to route around here; it's confirmation that the
deterministic check in send_rate_offer has to be the real enforcement, and
this stays a best-effort secondary signal (PII/profanity checks on outgoing
text, where topic-matching is actually the right tool, work as expected).
"""

import boto3
from botocore.exceptions import ClientError

from manifest_agents.config import get_settings


def check_outreach_guardrail(text: str) -> dict:
    """Run outgoing carrier-outreach text through the Bedrock Guardrail, if reachable.

    Returns:
        {"checked": True, "blocked": bool, "reason": str | None} on a real check,
        or {"checked": False, "reason": str} if the guardrail couldn't be reached
        (not configured, or Bedrock access is currently unavailable).
    """
    settings = get_settings()
    if not settings.carrier_outreach_guardrail_id:
        return {"checked": False, "reason": "MANIFEST_OUTREACH_GUARDRAIL_ID is not configured."}

    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    try:
        response = client.apply_guardrail(
            guardrailIdentifier=settings.carrier_outreach_guardrail_id,
            guardrailVersion="DRAFT",
            source="OUTPUT",
            content=[{"text": {"text": text}}],
        )
        blocked = response.get("action") == "GUARDRAIL_INTERVENED"
        return {
            "checked": True,
            "blocked": blocked,
            "reason": response.get("outputs", [{}])[0].get("text") if blocked else None,
        }
    except ClientError as e:
        return {"checked": False, "reason": f"Guardrail call failed: {e.response['Error']['Message']}"}
