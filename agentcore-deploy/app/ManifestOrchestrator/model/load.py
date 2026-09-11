import os


def load_model():
    """Same provider-swap rule as manifest_agents.models.get_reasoning_model:
    defaults to real Claude via classic Bedrock; set MANIFEST_MODEL_PROVIDER=
    bedrock_mantle to route through the Bedrock Mantle stand-in until this
    account's Bedrock model-invocation access clears (see the repo README)."""
    provider = os.environ.get("MANIFEST_MODEL_PROVIDER", "bedrock")

    if provider == "bedrock_mantle":
        # strands.models.openai.OpenAIModel (Chat Completions, /v1/chat/completions),
        # not OpenAIResponsesModel (/v1/responses) — mirrors an earlier, confirmed
        # fix for the vision model in the main agents/ package, where Mantle's
        # Responses endpoint rejected image content and Chat Completions fixed
        # it outright. Kept here as the more robust default even though it did
        # NOT fix the specific issue that prompted trying it: what looked at
        # first like a multi-turn-only failure turned out, on further testing,
        # to be Mantle going fully unavailable for this account — single-turn
        # calls that had reliably worked all session started failing too,
        # identically, regardless of API path. See agentcore-deploy/README.md
        # for the full investigation; this is an account-side condition to
        # wait out (or escalate), not something fixable in this code.
        from strands.models.openai import OpenAIModel

        return OpenAIModel(
            bedrock_mantle_config={"region": os.environ.get("AWS_REGION", "us-east-1")},
            model_id=os.environ.get("MANIFEST_MANTLE_STANDIN_MODEL_ID", "openai.gpt-oss-120b"),
        )

    from strands.models.bedrock import BedrockModel

    return BedrockModel(
        model_id=os.environ.get(
            "MANIFEST_CLAUDE_MODEL_ID", "anthropic.claude-sonnet-4-5-20250929-v1:0"
        ),
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
    )
