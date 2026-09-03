"""Bedrock Guardrails check for outgoing carrier-facing messages.

See manifest_agents.tools.guardrails in the main agents/ package for the
full writeup on what this found (live and unblocked, but topic-policy DENY
can't do numeric ceiling comparisons). Duplicated here (not imported)
because this AgentCore deployment package ships standalone.
"""

import os

import boto3
from botocore.exceptions import ClientError
from strands import tool


@tool
def check_outreach_guardrail(text: str) -> dict:
    """Run outgoing carrier-outreach text through the Bedrock Guardrail, if reachable.

    Args:
        text: The candidate outgoing message text to check.

    Returns:
        {checked, blocked, reason} — checked is False if the guardrail isn't
        configured or reachable; otherwise blocked/reason reflect the real
        Bedrock ApplyGuardrail result.
    """
    guardrail_id = os.environ.get("MANIFEST_OUTREACH_GUARDRAIL_ID", "")
    if not guardrail_id:
        return {"checked": False, "reason": "MANIFEST_OUTREACH_GUARDRAIL_ID is not configured."}

    region = os.environ.get("AWS_REGION", "us-east-1")
    client = boto3.client("bedrock-runtime", region_name=region)
    try:
        response = client.apply_guardrail(
            guardrailIdentifier=guardrail_id,
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
