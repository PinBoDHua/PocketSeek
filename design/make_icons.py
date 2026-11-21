"""PocketSeek 0.3.0 icon generator — pocket + AI spark.

几何母版与 design/icon-any.svg 保持一致：
品牌蓝圆角方块、白色口袋、蓝色开口弧线、口袋上方白色四角星芒。
全部用 4x 超采样 + 连续圆点描边，避免缩小后出现锯齿或断缝。
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

BLUE = (58, 99, 242, 255)  # #3A63F2
WHITE = (255, 255, 255, 255)
WHITE_CLEAR = (255, 255, 255, 0)
SS = 4  # supersample factor


def bezier(p0, p1, p2, p3, n=96):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def quad(p0, p1, p2, n=48):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append(
            (
                u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
            )
        )
    return pts


def pocket_points():
    """白色口袋轮廓（512 网格）。"""
    pts = [(156, 250), (356, 250)]
    pts += quad((356, 250), (390, 250), (390, 284))
    pts += [(390, 344)]
    pts += bezier((390, 344), (390, 402), (338, 438), (272, 438))
    pts += bezier((272, 438), (206, 438), (122, 402), (122, 344))
    pts += [(122, 284)]
    pts += quad((122, 284), (122, 250), (156, 250))
    return pts


def spark_points():
    """口袋上方的四角星芒（512 网格）。"""
    pts = []
    pts += bezier((256, 78), (264, 120), (278, 134), (320, 146))
    pts += bezier((320, 146), (278, 158), (264, 172), (256, 214))
    pts += bezier((256, 214), (248, 172), (234, 158), (192, 146))
    pts += bezier((192, 146), (234, 134), (248, 120), (256, 78))
    return pts


def mouth_points():
    """口袋开口弧线（512 网格）。"""
    return bezier((142, 286), (188, 326), (324, 326), (370, 286), 140)


def scaled(points, s, off):
    return [(x * s + off[0], y * s + off[1]) for x, y in points]


def draw_mark(d: ImageDraw.ImageDraw, s: float, off: tuple[float, float], *, mouth=BLUE) -> None:
    """在已绘制的背景上画口袋与星芒；开口用背景色/透明色断开。"""
    d.polygon(scaled(pocket_points(), s, off), fill=WHITE)
    width = 16 * s
    r = width / 2
    for x, y in scaled(mouth_points(), s, off):
        d.ellipse([x - r, y - r, x + r, y + r], fill=mouth)
    d.polygon(scaled(spark_points(), s, off), fill=WHITE)


def render_mark_cutout(size: int, s: float, off: tuple[float, float]) -> Image.Image:
    """透明底、白色标记、开口镂空；用于 adaptive foreground 与主题图标。"""
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.polygon(scaled(pocket_points(), s, off), fill=255)
    md.polygon(scaled(spark_points(), s, off), fill=255)
    width = 16 * s
    r = width / 2
    for x, y in scaled(mouth_points(), s, off):
        md.ellipse([x - r, y - r, x + r, y + r], fill=0)
    mark = Image.new("RGBA", (size, size), WHITE_CLEAR)
    mark.putalpha(mask)
    return mark


def render(size: int, *, maskable: bool) -> Image.Image:
    big = 512 * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, big, big], fill=BLUE)
        scale = 0.82
        off = (big * (1 - scale) / 2, big * (1 - scale) / 2)
    else:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=116 * SS, fill=BLUE)
        scale = 1.0
        off = (0.0, 0.0)
    draw_mark(d, big / 512 * scale, off)
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
