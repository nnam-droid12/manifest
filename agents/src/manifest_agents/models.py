import os

from strands.models.model import Model


def get_reasoning_model(model_id: str | None = None) -> Model:
    """Reasoning model for agents (negotiation, fraud analysis, orchestration, etc.).

    Defaults to Claude via classic Bedrock. Until account-level Bedrock model
    invocation access clears (see agents/README.md), set
    MANIFEST_MODEL_PROVIDER=bedrock_mantle to route through Bedrock Mantle
    against a third-party stand-in model instead — same Strands Agent code,
    different backing model, swap back by unsetting the env var.
    """
    provider = os.environ.get("MANIFEST_MODEL_PROVIDER", "bedrock")

    if provider == "bedrock_mantle":
        from strands.models.openai_responses import OpenAIResponsesModel

        return OpenAIResponsesModel(
            bedrock_mantle_config={"region": os.environ.get("AWS_REGION", "us-east-1")},
            model_id=model_id or os.environ.get("MANIFEST_MANTLE_STANDIN_MODEL_ID", "openai.gpt-oss-120b"),
        )

    from strands.models.bedrock import BedrockModel

    return BedrockModel(
        model_id=model_id or os.environ.get(
            "MANIFEST_CLAUDE_MODEL_ID", "anthropic.claude-sonnet-4-5-20250929-v1:0"
        ),
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
    )


def get_vision_model() -> Model:
    """Multimodal model for the Cargo Condition Agent. Same provider-swap rule as above.

    Uses the Chat Completions provider (not OpenAIResponsesModel) for the
    Mantle stand-in specifically: the Responses API path
    (`/v1/responses`) rejects image content on Mantle's catalog models with a
    400 ("did not match any expected variant"); `/v1/chat/completions` is the
    shape Mantle actually supports for vision input.
    """
    provider = os.environ.get("MANIFEST_MODEL_PROVIDER", "bedrock")

    if provider == "bedrock_mantle":
        from strands.models.openai import OpenAIModel

        return OpenAIModel(
            bedrock_mantle_config={"region": os.environ.get("AWS_REGION", "us-east-1")},
            model_id=os.environ.get(
                "MANIFEST_MANTLE_VISION_STANDIN_MODEL_ID", "qwen.qwen3-vl-235b-a22b-instruct"
            ),
        )

    from strands.models.bedrock import BedrockModel

    return BedrockModel(
        model_id=os.environ.get("MANIFEST_NOVA_PRO_MODEL_ID", "amazon.nova-pro-v1:0"),
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
    )
