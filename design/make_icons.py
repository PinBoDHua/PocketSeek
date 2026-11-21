"""PocketSeek icon generator — vector-ish rendering with Pillow (4x supersampling).

Design: solid brand-blue tile + white geometric question mark whose dot is a
rounded square ("pocket"). No gradients, no glow, no shadow.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

BLUE = (58, 99, 242, 255)  # #3A63F2
WHITE = (255, 255, 255, 255)
SS = 4  # supersample factor


def bezier(p0, p1, p2, p3, n=48):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def arc_points(cx, cy, r, start_deg, end_deg, n=72):
    pts = []
    for i in range(n + 1):
        a = math.radians(start_deg + (end_deg - start_deg) * i / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def draw_glyph(d: ImageDraw.ImageDraw, s: float, off: tuple[float, float]) -> None:
    """Draw the question-mark glyph in design units (512 grid) scaled by ``s``."""

    def tx(pts):
        return [(x * s + off[0], y * s + off[1]) for x, y in pts]

    stroke = max(2, round(46 * s))
    r = stroke / 2

    def stamp(pts):
        """Stamp overlapping discs instead of drawing polylines: guarantees a
        gap-free stroke after downsampling (Pillow line joins can leak seams)."""
        for x, y in pts:
            d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)

    # upper arch of the question mark (180deg -> 360deg, going over the top)
    stamp(tx(arc_points(256, 206, 70, 180, 360, 140)))

    # S-curve dropping from the right side of the arch down to the stem
    stamp(tx(bezier((326, 206), (326, 258), (256, 258), (256, 316), 96)))

    # "pocket" dot: rounded square
    x0, y0 = tx([(234, 348)])[0]
    x1, y1 = tx([(278, 392)])[0]
    d.rounded_rectangle([x0, y0, x1, y1], radius=(x1 - x0) * 0.34, fill=WHITE)


def render(size: int, *, maskable: bool) -> Image.Image:
    big = 512 * SS
    s = big / 512
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if maskable:
        d.rectangle([0, 0, big, big], fill=BLUE)
        gs = s * 0.82
        off = (big * (1 - 0.82) / 2, big * (1 - 0.82) / 2)
        draw_glyph(d, gs, off)
    else:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=116 * s, fill=BLUE)
        draw_glyph(d, s, (0.0, 0.0))

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "public"
    out.mkdir(parents=True, exist_ok=True)
    targets = [
        ("icon-512.png", 512, False),
        ("icon-512-maskable.png", 512, True),
        ("icon-192.png", 192, False),
        ("icon-192-maskable.png", 192, True),
        ("apple-touch-icon.png", 180, True),
        ("favicon-32.png", 32, False),
    ]
    for name, size, maskable in targets:
        render(size, maskable=maskable).save(out / name, "PNG")
        print(f"wrote public/{name} ({size}x{size})")


if __name__ == "__main__":
    main()
