#!/usr/bin/env python3
"""
IRIS OpenGraph Banner Generator
Generates Solo Leveling-inspired glitch typography banners on a solid black background.
"""

import argparse
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

DEFAULT_WIDTH = 1200
DEFAULT_HEIGHT = 630
DEFAULT_FONT_SIZE = 84
DEFAULT_FONT_PATH = "/usr/share/fonts/noto/NotoSerifDisplay-Medium.ttf"

KNOWN_APPS = [
    {"id": "akaromi",   "title": "AKAROMI"},
    {"id": "borealis",  "title": "BOREALIS"},
    {"id": "kiroshi",   "title": "KIROSHI"},
    {"id": "carina",    "title": "CARINA"},
    {"id": "apertune",  "title": "APERTUNE"},
    {"id": "reliquary", "title": "RELIQUARY"},
    {"id": "spica",     "title": "SPICA"},
    {"id": "astra",     "title": "ASTRA"},
    {"id": "amadeus",   "title": "AMADEUS"},
    {"id": "vex",       "title": "VEX"},
    {"id": "nyxis",     "title": "NYXIS"},
    {"id": "lynx",      "title": "LYNX"},
    {"id": "tesseract", "title": "TESSERACT"},
]

def find_font(preferred_path: str = DEFAULT_FONT_PATH) -> ImageFont.FreeTypeFont:
    """Finds an appropriate serif display font."""
    candidates = [
        preferred_path,
        "/usr/share/fonts/noto/NotoSerif-Medium.ttf",
        "/usr/share/fonts/noto/NotoSerif-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, DEFAULT_FONT_SIZE)
            except Exception:
                continue
    # Fallback to default PIL font
    print("Warning: Preferred serif font not found; using PIL default font.", file=sys.stderr)
    return ImageFont.load_default()

def generate_banner(
    title: str,
    output_path: str,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    font_path: str = DEFAULT_FONT_PATH,
) -> str:
    """Renders a single banner image."""
    chars = list(title.upper())
    tracking = 48 if len(chars) <= 4 else (34 if len(chars) >= 8 else 40)

    font = find_font(font_path)

    # Calculate total width for visual centering
    char_widths = []
    total_w = 0
    for c in chars:
        bbox = font.getbbox(c)
        cw = bbox[2] - bbox[0]
        char_widths.append(cw)
        total_w += cw
    total_w += (len(chars) - 1) * tracking

    start_x = (width - total_w) // 2
    start_y = (height - DEFAULT_FONT_SIZE) // 2 - 4

    # Render base text on transparent layer
    text_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw_t = ImageDraw.Draw(text_layer)

    char_positions = []
    cur_x = start_x
    for i, c in enumerate(chars):
        draw_t.text((cur_x, start_y), c, font=font, fill=(255, 255, 255, 255))
        char_positions.append((cur_x, cur_x + char_widths[i]))
        cur_x += char_widths[i] + tracking

    glitched = text_layer.copy()

    # Slice displacements
    slices = [
        (start_y + 17, start_y + 23, 5),
        (start_y + 34, start_y + 39, -6),
        (start_y + 51, start_y + 57, 5),
        (start_y + 66, start_y + 71, -4),
        (start_y + 78, start_y + 82, 4),
    ]

    for y1, y2, shift in slices:
        slice_img = text_layer.crop((0, y1, width, y2))
        draw_clear = ImageDraw.Draw(glitched)
        draw_clear.rectangle([(0, y1), (width, y2)], fill=(0, 0, 0, 0))
        glitched.paste(slice_img, (shift, y1), slice_img)

    draw_spurs = ImageDraw.Draw(glitched)

    # Add glitch spurs and slit cuts across each letter
    for idx, (cl, cr) in enumerate(char_positions):
        mid_y1 = start_y + 34 + (idx % 3) * 6
        mid_y2 = start_y + 60 - (idx % 2) * 8

        # Horizontal spur lines protruding on sides
        draw_spurs.line([(cl - 14, mid_y1), (cr + 14, mid_y1)], fill=(255, 255, 255, 255), width=1)
        draw_spurs.line([(cl - 10, mid_y2), (cr + 12, mid_y2)], fill=(255, 255, 255, 255), width=1)

        # Micro-slit cutout
        slit_y = start_y + 26 + (idx % 4) * 12
        draw_spurs.line([(cl + 3, slit_y), (cr - 3, slit_y)], fill=(0, 0, 0, 0), width=1)

    # Dual glow layers
    glow_wide = glitched.filter(ImageFilter.GaussianBlur(8))
    glow_tight = glitched.filter(ImageFilter.GaussianBlur(2))

    # Composite onto solid pure black (#000000) canvas
    canvas_rgba = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    canvas_rgba.paste(glow_wide, (0, 0), glow_wide)
    canvas_rgba.paste(glow_tight, (0, 0), glow_tight)
    canvas_rgba.paste(glitched, (0, 0), glitched)

    final_rgb = canvas_rgba.convert("RGB")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    final_rgb.save(output_path, "PNG")
    return output_path

def main():
    parser = argparse.ArgumentParser(
        description="Generate IRIS glitch typography OpenGraph banner images on pure black background."
    )
    parser.add_argument(
        "title",
        nargs="?",
        help="App name / title to render on the banner (e.g. 'Akaromi', 'Tesseract')",
    )
    parser.add_argument(
        "--id",
        dest="app_id",
        help="App identifier used for filename (defaults to lowercased title)",
    )
    parser.add_argument(
        "--output",
        "-o",
        dest="output",
        help="Destination path for the PNG file (defaults to apps/web/public/banners/<id>.png)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Generate or regenerate banners for all 13 known IRIS suite apps",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=DEFAULT_WIDTH,
        help=f"Banner width in pixels (default: {DEFAULT_WIDTH})",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=DEFAULT_HEIGHT,
        help=f"Banner height in pixels (default: {DEFAULT_HEIGHT})",
    )
    parser.add_argument(
        "--font",
        dest="font_path",
        default=DEFAULT_FONT_PATH,
        help=f"Path to serif display TTF font (default: {DEFAULT_FONT_PATH})",
    )

    args = parser.parse_args()

    default_dir = os.path.join(os.getcwd(), "apps/web/public/banners")

    if args.all:
        print(f"Generating banners for all {len(KNOWN_APPS)} apps into {default_dir}...")
        for app in KNOWN_APPS:
            dest = os.path.join(default_dir, f"{app['id']}.png")
            generate_banner(app["title"], dest, width=args.width, height=args.height, font_path=args.font_path)
            print(f"  ✓ {app['id']}: {dest} ({args.width}x{args.height})")
        print("Done!")
        return

    if not args.title:
        parser.error("Please provide an app title or use --all to generate all suite banners.")

    app_id = args.app_id or args.title.strip().lower().replace(" ", "-")
    output_path = args.output or os.path.join(default_dir, f"{app_id}.png")

    result = generate_banner(
        args.title,
        output_path,
        width=args.width,
        height=args.height,
        font_path=args.font_path,
    )
    print(f"Banner generated: {result} ({args.width}x{args.height})")

if __name__ == "__main__":
    main()

