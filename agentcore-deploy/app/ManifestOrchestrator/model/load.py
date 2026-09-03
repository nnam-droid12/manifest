import os


def load_model():
    """Same provider-swap rule as manifest_agents.models.get_reasoning_model:
    defaults to real Claude via classic Bedrock; set MANIFEST_MODEL_PROVIDER=
    bedrock_mantle to route through the Bedrock Mantle stand-in until this
    account's Bedrock model-invocation access clears (see the repo README)."""
    provider = os.environ.get("MANIFEST_MODEL_PROVIDER", "bedrock")

    if provider == "bedrock_mantle":
        from strands.models.openai_responses import OpenAIResponsesModel

        return OpenAIResponsesModel(
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
