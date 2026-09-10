"""Delegates carrier vetting to the standalone Carrier Vetting Agent runtime.

This is a genuine cross-runtime AgentCore call — bedrock-agentcore's
InvokeAgentRuntime API against a *different* deployed runtime's ARN, not an
in-process tool call. The Orchestrator doesn't reason about FMCSA records or
remit-to mismatches itself; it delegates that specialized, safety-critical
judgment to the dedicated agent and works from its answer, the way a real
team of specialists would hand off rather than one generalist doing every
job. RUNTIME_VETTINGRUNTIME_ARN is injected by the "vettingRuntime"
connection in agentcore.json.
"""

import json
import os
import re

import boto3
from botocore.config import Config
from strands import tool

# A full carrier assessment (FMCSA + broker record + playbook, each a
# separate tool call inside the delegate agent) genuinely takes 15-20+
# seconds end to end — verified directly (18.9s for one real call). The
# default botocore timeouts are enough on their own, but pinned explicitly
# here so a slow assessment fails loudly (a real timeout error) rather than
# silently returning a truncated body if any layer's default were shorter.
_BOTO_CONFIG = Config(connect_timeout=10, read_timeout=120, retries={"max_attempts": 0})


def _parse_risk_lines(text: str) -> tuple[str | None, bool | None]:
    risk_match = re.search(r"RISK_LEVEL:\s*(LOW|MEDIUM|HIGH)", text)
    ok_match = re.search(r"AUTONOMOUS_OK:\s*(true|false)", text, re.IGNORECASE)
    risk = risk_match.group(1) if risk_match else None
    autonomous_ok = ok_match.group(1).lower() == "true" if ok_match else None
    return risk, autonomous_ok


@tool
def assess_carrier(mc_number: str) -> dict:
    """Delegate a full carrier risk assessment to the standalone Carrier
    Vetting & Fraud Detection Agent, running on its own AgentCore Runtime.

    Args:
        mc_number: The carrier's MC number, e.g. "MC-1187765".

    Returns:
        {narrative, risk_level, autonomous_ok} from the dedicated agent's
        real assessment, or an "error" key if the cross-runtime call failed
        (e.g. the vetting runtime isn't reachable) — never fabricate a risk
        level locally if the delegate call fails.
    """
    runtime_arn = os.environ.get("RUNTIME_VETTINGRUNTIME_ARN")
    if not runtime_arn:
        return {"error": "RUNTIME_VETTINGRUNTIME_ARN is not configured — vetting runtime not connected."}

    client = boto3.client(
        "bedrock-agentcore", region_name=os.environ.get("AWS_REGION", "us-east-1"), config=_BOTO_CONFIG
    )
    payload = json.dumps({"prompt": f"Assess carrier {mc_number} before we engage them for a load."}).encode()

    try:
        response = client.invoke_agent_runtime(
            agentRuntimeArn=runtime_arn, payload=payload, contentType="application/json"
        )
        body = response["response"].read().decode("utf-8")
    except Exception as e:
        return {"error": f"Carrier Vetting Agent runtime call failed: {type(e).__name__}: {e}"}

    text_parts = []
    for line in body.splitlines():
        if not line.startswith("data:"):
            continue
        try:
            event = json.loads(line[len("data:") :].strip())
        except json.JSONDecodeError:
            continue
        delta = event.get("event", {}).get("contentBlockDelta", {}).get("delta", {})
        if "text" in delta:
            text_parts.append(delta["text"])

    narrative = "".join(text_parts)
    risk_level, autonomous_ok = _parse_risk_lines(narrative)
    if not narrative:
        # Surface exactly what came back rather than silently returning
        # nothing — this is what caught the response body being empty in
        # production the first time, when local testing (same code) worked.
        return {
            "error": "Vetting agent call succeeded but produced no narrative text.",
            "raw_body_length": len(body),
            "raw_body_sample": body[:500],
        }
    return {"narrative": narrative, "risk_level": risk_level, "autonomous_ok": autonomous_ok}
