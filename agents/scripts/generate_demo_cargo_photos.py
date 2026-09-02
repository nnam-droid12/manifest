"""Generates two synthetic cargo photos (pickup vs. delivery) for testing the
Cargo Condition Agent's vision tool end to end without needing real freight
photos on hand. Drawn with Pillow, not photographs — labeled as such
everywhere they're used. Run once; output is checked in under seed-data/.
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parents[2] / "seed-data" / "cargo-photos"


def _pallet_scene(damaged: bool) -> Image.Image:
    img = Image.new("RGB", (640, 480), color=(235, 235, 230))
    draw = ImageDraw.Draw(img)

    # Warehouse floor
    draw.rectangle([0, 380, 640, 480], fill=(190, 180, 165))

    # Wooden pallet
    draw.rectangle([120, 360, 520, 390], fill=(150, 110, 60))
    for x in range(140, 520, 40):
        draw.rectangle([x, 360, x + 8, 390], fill=(120, 85, 45))

    # Stack of boxes
    box_color = (200, 165, 110)
    positions = [(150, 240, 330, 360), (340, 240, 500, 360), (150, 120, 330, 240), (340, 130, 500, 240)]
    for i, (x0, y0, x1, y1) in enumerate(positions):
        if damaged and i == 2:
            # Crushed top-left box: shifted/collapsed shape
            draw.polygon([(x0, y0 + 35), (x1 - 20, y0), (x1, y0 + 20), (x1, y1), (x0, y1)], fill=(190, 140, 90))
            draw.line([(x0, y0 + 35), (x1, y1 - 10)], fill=(90, 40, 20), width=4)
            draw.line([(x0 + 10, y1), (x1 - 10, y0 + 45)], fill=(90, 40, 20), width=4)
        else:
            draw.rectangle([x0, y0, x1, y1], outline=(120, 85, 45), width=3, fill=box_color)
            draw.line([(x0, y0), (x1, y1)], fill=(120, 85, 45), width=2)
            draw.line([(x1, y0), (x0, y1)], fill=(120, 85, 45), width=2)

    if damaged:
        # Torn flap + a visible stain on the front box
        draw.polygon([(150, 300), (200, 260), (210, 300), (180, 340)], fill=(150, 100, 60))
        draw.ellipse([420, 300, 470, 340], outline=(60, 40, 20), width=3)

    # BOL clipboard corner marker (consistent reference point in both shots)
    draw.rectangle([20, 20, 140, 70], outline=(40, 40, 40), width=2, fill=(255, 255, 255))
    draw.text((30, 35), "BOL REF-88213", fill=(20, 20, 20))

    draw.text((20, 450), "SYNTHETIC TEST IMAGE - not a real photo", fill=(80, 80, 80))
    return img


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    _pallet_scene(damaged=False).save(OUT_DIR / "pickup.png")
    _pallet_scene(damaged=True).save(OUT_DIR / "delivery.png")
    print(f"Wrote {OUT_DIR / 'pickup.png'} and {OUT_DIR / 'delivery.png'}")


if __name__ == "__main__":
    main()
