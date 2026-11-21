"""生成 Android 原生图标与启动图（复用 PocketSeek 的矢量图标绘制逻辑）。

- mipmap-*/ic_launcher.png、ic_launcher_round.png：全覆盖蓝色底 + 白色问号
- mipmap-*/ic_launcher_foreground.png：透明底，给 adaptive icon 用
- drawable*/splash.png：保持原尺寸，蓝底居中 logo
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_icons import BLUE, draw_glyph  # noqa: E402

RES = Path(__file__).resolve().parent.parent / 'android' / 'app' / 'src' / 'main' / 'res'
SS = 4

LAUNCHER_SIZES = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192,
}


def render_icon(size: int, *, circle: bool) -> Image.Image:
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if circle:
        d.ellipse([0, 0, big - 1, big - 1], fill=BLUE)
    else:
        d.rectangle([0, 0, big, big], fill=BLUE)
    s = big / 512 * 0.97
    off = (big / 2 - 256 * s, big / 2 - 256 * s)
    draw_glyph(d, s, off)
    return img.resize((size, size), Image.LANCZOS)


def render_foreground(size: int) -> Image.Image:
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = big / 512 * 0.95
    off = (big / 2 - 256 * s, big / 2 - 256 * s)
    draw_glyph(d, s, off)
    return img.resize((size, size), Image.LANCZOS)


def render_splash(width: int, height: int) -> Image.Image:
    big_w, big_h = width * 2, height * 2
    img = Image.new('RGBA', (big_w, big_h), BLUE)
    d = ImageDraw.Draw(img)
    short = min(big_w, big_h)
    s = short * 0.34 / 256
    off = (big_w / 2 - 256 * s, big_h / 2 - 256 * s)
    draw_glyph(d, s, off)
    return img.convert('RGB').resize((width, height), Image.LANCZOS)


def main() -> None:
    for density, size in LAUNCHER_SIZES.items():
        folder = RES / f'mipmap-{density}'
        render_icon(size, circle=False).save(folder / 'ic_launcher.png', 'PNG')
        render_icon(size, circle=True).save(folder / 'ic_launcher_round.png', 'PNG')
        render_foreground(round(size * 2.25)).save(folder / 'ic_launcher_foreground.png', 'PNG')
        print('mipmap', density, 'ok')

    for splash in sorted(RES.glob('drawable*/splash.png')):
        with Image.open(splash) as im:
            width, height = im.size
        render_splash(width, height).save(splash, 'PNG')
        print('splash', splash.relative_to(RES), f'{width}x{height}')


if __name__ == '__main__':
    main()
