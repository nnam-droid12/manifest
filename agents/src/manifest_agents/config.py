import os
from dataclasses import dataclass


def _env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@dataclass(frozen=True)
class Settings:
    aws_region: str
    claude_model_id: str
    nova_pro_model_id: str
    nova_act_model_id: str

    loads_table: str
    carriers_table: str
    shipments_table: str
    rate_history_table: str
    audit_log_table: str
    documents_bucket: str
    photos_bucket: str

    carrier_outreach_guardrail_id: str

    fmcsa_webkey: str

    load_board_base_url: str
    carrier_portal_base_url: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            aws_region=_env("AWS_REGION", "us-east-1"),
            claude_model_id=_env(
                "MANIFEST_CLAUDE_MODEL_ID", "anthropic.claude-sonnet-4-5-20250929-v1:0"
            ),
            nova_pro_model_id=_env("MANIFEST_NOVA_PRO_MODEL_ID", "amazon.nova-pro-v1:0"),
            nova_act_model_id=_env("MANIFEST_NOVA_ACT_MODEL_ID", "amazon.nova-act-v1:0"),
            loads_table=_env("MANIFEST_LOADS_TABLE", "manifest-loads"),
            carriers_table=_env("MANIFEST_CARRIERS_TABLE", "manifest-carriers"),
            shipments_table=_env("MANIFEST_SHIPMENTS_TABLE", "manifest-shipments"),
            rate_history_table=_env("MANIFEST_RATE_HISTORY_TABLE", "manifest-rate-history"),
            audit_log_table=_env("MANIFEST_AUDIT_LOG_TABLE", "manifest-audit-log"),
            documents_bucket=_env("MANIFEST_DOCUMENTS_BUCKET", ""),
            photos_bucket=_env("MANIFEST_PHOTOS_BUCKET", ""),
            carrier_outreach_guardrail_id=_env("MANIFEST_OUTREACH_GUARDRAIL_ID", ""),
            fmcsa_webkey=_env("FMCSA_WEBKEY", ""),
            load_board_base_url=_env("MOCK_LOAD_BOARD_URL", "http://localhost:4001"),
            carrier_portal_base_url=_env("MOCK_CARRIER_PORTAL_URL", "http://localhost:4002"),
        )


settings = None


def get_settings() -> Settings:
    global settings
    if settings is None:
        settings = Settings.from_env()
    return settings
