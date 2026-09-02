"""Browser-automation tools the agent swarm uses to operate load boards and carrier portals.

Implemented today with Playwright driving a real headless browser against page
structure (login forms, tables, links) rather than any site-specific API — the
same interaction pattern Amazon Nova Act would drive, just with a scripted
navigation layer standing in for Nova Act's vision/action model until a Nova
Act API key is available (see agents/README.md). Swapping the driver later
should not require changing the tool's signature or the agents that call it.
"""

from playwright.sync_api import sync_playwright

from strands import tool

from manifest_agents.config import get_settings


def _login_and_get_page(playwright, base_url: str, username: str, password: str):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"{base_url}/login")
    page.fill('input[name="username"]', username)
    page.fill('input[name="password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    return browser, page


@tool
def search_load_board(origin: str = "", destination: str = "", equipment_type: str = "") -> list[dict]:
    """Search the load board for available freight matching the given criteria.

    Logs into the load board, submits the search form, and scrapes the resulting
    listing table — driven entirely by page structure, not a hidden API.

    Args:
        origin: Free-text origin filter (city/state substring), or "" for any.
        destination: Free-text destination filter (city/state substring), or "" for any.
        equipment_type: One of "Dry Van", "Reefer", "Flatbed", or "" for any.

    Returns:
        A list of load summaries, each with: id, origin, destination, miles,
        equipment_type, commodity, pickup_date, delivery_date, rate, posted_by.
    """
    settings = get_settings()

    with sync_playwright() as playwright:
        browser, page = _login_and_get_page(
            playwright, settings.load_board_base_url, settings.load_board_username, settings.load_board_password
        )
        try:
            page.goto(f"{settings.load_board_base_url}/loads")
            if origin:
                page.fill('input[name="origin"]', origin)
            if destination:
                page.fill('input[name="destination"]', destination)
            if equipment_type:
                page.select_option('select[name="equipmentType"]', equipment_type)
            if origin or destination or equipment_type:
                page.click('.filters button[type="submit"]')
                page.wait_for_load_state("networkidle")

            rows = page.query_selector_all("table tbody tr")
            results = []
            for row in rows:
                cells = row.query_selector_all("td")
                if len(cells) < 7:
                    continue
                lane_text = cells[0].inner_text().strip()
                origin_dest, miles_text = lane_text.split("\n", 1) if "\n" in lane_text else (lane_text, "")
                origin_city, dest_city = [s.strip() for s in origin_dest.split("→")] if "→" in origin_dest else (
                    origin_dest,
                    "",
                )
                equip_text = cells[1].inner_text().strip()
                equip, commodity = (equip_text.split("\n", 1) + [""])[:2]
                detail_link = cells[6].query_selector("a")
                load_id = detail_link.get_attribute("href").rsplit("/", 1)[-1] if detail_link else ""
                results.append(
                    {
                        "id": load_id,
                        "origin": origin_city.strip(),
                        "destination": dest_city.strip(),
                        "miles": miles_text.strip(),
                        "equipment_type": equip.strip(),
                        "commodity": commodity.strip(),
                        "pickup_date": cells[2].inner_text().strip(),
                        "delivery_date": cells[3].inner_text().strip(),
                        "rate": cells[4].inner_text().strip(),
                        "posted_by": cells[5].inner_text().strip(),
                    }
                )
            return results
        finally:
            browser.close()


@tool
def get_load_detail(load_id: str) -> dict:
    """Open a specific load's detail page on the load board and return its full listing.

    Args:
        load_id: The load board's identifier for the load (as returned by search_load_board).

    Returns:
        A dict with the load's origin, destination, equipment_type, commodity,
        weight, miles, pickup_date, delivery_date, rate, posted_by, and status.
    """
    settings = get_settings()

    with sync_playwright() as playwright:
        browser, page = _login_and_get_page(
            playwright, settings.load_board_base_url, settings.load_board_username, settings.load_board_password
        )
        try:
            page.goto(f"{settings.load_board_base_url}/loads/{load_id}")
            page.wait_for_load_state("networkidle")

            def field(label: str) -> str:
                el = page.query_selector(f"xpath=//span[text()='{label}']/following-sibling::strong")
                return el.inner_text().strip() if el else ""

            return {
                "id": load_id,
                "equipment_type": field("Equipment"),
                "commodity": field("Commodity"),
                "weight": field("Weight"),
                "miles": field("Distance"),
                "pickup_date": field("Pickup Date"),
                "delivery_date": field("Delivery Date"),
                "rate": field("Posted Rate"),
                "posted_by": field("Posted By"),
                "status": page.query_selector(".badge").inner_text().strip()
                if page.query_selector(".badge")
                else "",
            }
        finally:
            browser.close()
