import os
import subprocess
import time
from pathlib import Path

import pytest
import requests

REPO_ROOT = Path(__file__).resolve().parents[2]
LOAD_BOARD_URL = "http://localhost:4001"


@pytest.fixture(scope="module")
def load_board_server():
    proc = subprocess.Popen(
        ["node", str(REPO_ROOT / "mock-sites" / "load-board" / "server.js")],
        cwd=REPO_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(30):
        try:
            if requests.get(f"{LOAD_BOARD_URL}/login", timeout=1).status_code == 200:
                break
        except requests.exceptions.ConnectionError:
            pass
        time.sleep(0.5)
    else:
        proc.terminate()
        pytest.fail("load board did not start in time")

    yield

    proc.terminate()
    proc.wait(timeout=5)


def test_search_and_detail_round_trip(load_board_server):
    os.environ["MOCK_LOAD_BOARD_URL"] = LOAD_BOARD_URL
    from manifest_agents.config import Settings
    import manifest_agents.config as config_module

    config_module.settings = Settings.from_env()

    from manifest_agents.tools.browser import get_load_detail, search_load_board

    results = search_load_board(origin="Chicago", destination="Atlanta", equipment_type="Dry Van")
    assert len(results) == 1
    assert results[0]["origin"] == "Chicago, IL"
    assert results[0]["destination"] == "Atlanta, GA"

    detail = get_load_detail(results[0]["id"])
    assert detail["equipment_type"] == "Dry Van"
    assert detail["status"] == "Available"
