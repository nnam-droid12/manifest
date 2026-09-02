from dataclasses import dataclass
from pathlib import Path

from strands import Agent
from strands.types.content import ContentBlock

from manifest_agents.models import get_vision_model

SYSTEM_PROMPT = """\
You are the Cargo Condition Agent for Manifest, an AI freight brokerage system.

You are given two photos of the same shipment: one taken at pickup, one at
delivery. Your job is to compare them and flag any visible condition
discrepancy — damage, crushed or torn packaging, missing pieces, a shifted
load, a broken seal — that a human would otherwise have to eyeball manually.

Rules:
- Actually compare the two images in detail — don't just describe each one
  separately. State specifically what changed between pickup and delivery.
- Use the reference marker visible in both photos (e.g. a BOL number) to
  confirm you're comparing the same shipment, not two unrelated photos.
- If you see damage or a discrepancy: describe exactly what it is, where in
  the image it is, and how confident you are. This is a real finding that
  may hold up a payment or trigger a claim, so be concrete rather than vague
  ("something looks different") and don't invent damage that isn't clearly
  visible.
- If nothing looks different: say so plainly. Don't manufacture a finding to
  seem thorough — a false damage claim against a carrier is a real cost too.
- End with a clear verdict: "condition match — no discrepancy" or
  "discrepancy found — flag for review", plus a one-line reason.
"""


@dataclass
class CargoConditionResult:
    pickup_photo: str
    delivery_photo: str
    narrative: str


def _load_image_block(path: Path) -> ContentBlock:
    fmt = path.suffix.lstrip(".").lower()
    if fmt == "jpg":
        fmt = "jpeg"
    return {"image": {"format": fmt, "source": {"bytes": path.read_bytes()}}}


def build_cargo_condition_agent() -> Agent:
    return Agent(model=get_vision_model(), system_prompt=SYSTEM_PROMPT)


def compare_cargo_photos(pickup_photo: str, delivery_photo: str) -> CargoConditionResult:
    pickup_path = Path(pickup_photo)
    delivery_path = Path(delivery_photo)

    agent = build_cargo_condition_agent()
    content: list[ContentBlock] = [
        {"text": "Photo 1 — taken at PICKUP:"},
        _load_image_block(pickup_path),
        {"text": "Photo 2 — taken at DELIVERY:"},
        _load_image_block(delivery_path),
        {"text": "Compare these and report any condition discrepancy."},
    ]
    result = agent(content)
    return CargoConditionResult(
        pickup_photo=pickup_photo, delivery_photo=delivery_photo, narrative=str(result)
    )
