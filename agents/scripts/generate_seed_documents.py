"""One-off generator for the seed rate-confirmation document used to demo/test
the Document Extraction Agent. Run with: python scripts/generate_seed_documents.py

Produces seed-data/documents/rate_confirmation_REF-88213.png — a synthetic
rate confirmation with a deliberate rate mismatch ($1,700 vs. the $1,650
offer Carrier Outreach actually sent) so the reconciliation logic has
something real to catch.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_PATH = Path(__file__).resolve().parents[2] / "seed-data" / "documents" / "rate_confirmation_REF-88213.png"

LINES = [
    ("RATE CONFIRMATION", True),
    ("", False),
    ("Broker: Manifest Freight Brokerage", False),
    ("Carrier: Swiftline Freight LLC", False),
    ("MC Number: MC-512873", False),
    ("", False),
    ("Load Reference: REF-88213", False),
    ("Origin: Chicago, IL", False),
    ("Destination: Atlanta, GA", False),
    ("Equipment: Reefer", False),
    ("Pickup Date: 09/04/2026", False),
    ("Delivery Date: 09/07/2026", False),
    ("", False),
    ("Agreed Rate: $1,700.00", False),
    ("", False),
    ("Please sign and return within 24 hours.", False),
]


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    width, height = 900, 700
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("arial.ttf", 22)
        bold_font = ImageFont.truetype("arialbd.ttf", 28)
    except OSError:
        font = ImageFont.load_default()
        bold_font = font

    y = 40
    for text, is_title in LINES:
        draw.text((50, y), text, fill="black", font=bold_font if is_title else font)
        y += 40 if is_title else 34

    img.save(OUT_PATH)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
