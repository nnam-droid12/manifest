import os
import subprocess
import time
from pathlib import Path

import pytest
import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
CARRIER_PORTAL_URL = "http://localhost:4002"


@pytest.fixture(scope="module")
def carrier_portal_server():
    proc = subprocess.Popen(
        ["node", str(REPO_ROOT / "mock-sites" / "carrier-portal" / "server.js")],
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        try:
            if requests.get(f"{CARRIER_PORTAL_URL}/login", timeout=1).status_code == 200:
                break
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(0.5)
    else:
        proc.terminate()
        pytest.fail("carrier portal did not start in time")

    yield

    proc.terminate()
    proc.wait(timeout=5)


def test_check_shipment_status(carrier_portal_server):
    os.environ["MOCK_CARRIER_PORTAL_URL"] = CARRIER_PORTAL_URL
    from manifest_agents.config import Settings
    import manifest_agents.config as config_module

    config_module.settings = Settings.from_env()

    from manifest_agents.tools.browser import check_shipment_status

    result = check_shipment_status("SHP-3001")
    assert result["origin"] == "Chicago, IL"
    assert result["destination"] == "Atlanta, GA"
    assert result["reference_number"] == "REF-88213"
    assert result["status"] == "In Transit"
    assert len(result["history"]) == 3
    assert result["history"][0]["status"] == "In Transit"
