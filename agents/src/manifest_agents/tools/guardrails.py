"""Bedrock Guardrails check for outgoing carrier-facing messages.

This is a secondary layer, not the primary enforcement — see
manifest_agents.carrier_outreach.guarded_tools.send_rate_offer for the
deterministic ceiling-rate check that holds regardless of whether this call
succeeds. Bedrock Guardrails' ApplyGuardrail lives behind classic
bedrock-runtime, which is currently blocked account-wide (same gate as model
invocation — see agents/README.md), so this degrades to "not checked" rather
than blocking outreach entirely on an infrastructure outage unrelated to the
message's actual content.
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
