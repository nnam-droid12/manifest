from manifest_agents.config import Settings


def test_settings_from_env_uses_defaults(monkeypatch):
    monkeypatch.delenv("AWS_REGION", raising=False)
    settings = Settings.from_env()
    assert settings.aws_region == "us-east-1"
    assert settings.load_board_base_url == "http://localhost:4001"
    assert settings.carrier_portal_base_url == "http://localhost:4002"
