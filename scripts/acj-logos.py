"""Cut web-ready ACJ Gaming logos from the client's artwork.

The client sent nine 2000 x 2000 PNG exports (client_photos/game/ACJ multiple
color copy_*.png): the mark, a stacked lockup and a horizontal lockup, each on
a solid square. This takes the ones drawn on white, turns "how far from white"
into transparency, and re-fills that shape in the brand mint (#00F7A9) and in
white, trimmed and resized. Output: public/images/acj/.

    python scripts/acj-logos.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "client_photos" / "game"
OUT = ROOT / "public" / "images" / "acj"

MINT = (0, 247, 169)
WHITE = (242, 255, 249)

# Source index (sorted file order, 1-based as in the client's set) -> name, long edge.
# 1: black mark on white. 5: mint stacked lockup on white. 8: mint horizontal lockup on white.
JOBS = {1: ("acj-mark", 512), 5: ("acj-lockup", 900), 8: ("acj-horizontal", 1200)}


def shape(path: Path) -> Image.Image:
    """Alpha mask of the artwork: white background -> 0, ink -> 255."""
    rgb = Image.open(path).convert("RGB")
    # The ink is black or mint; both have a red channel near 0, white has 255.
    r = rgb.getchannel("R")
    alpha = r.point(lambda v: 255 - v)
    box = alpha.getbbox()
    return alpha.crop(box)


def fill(alpha: Image.Image, colour: tuple[int, int, int], long_edge: int) -> Image.Image:
    pad = round(max(alpha.size) * 0.04)
    canvas = Image.new("L", (alpha.width + pad * 2, alpha.height + pad * 2), 0)
    canvas.paste(alpha, (pad, pad))
    scale = long_edge / max(canvas.size)
    canvas = canvas.resize((round(canvas.width * scale), round(canvas.height * scale)), Image.LANCZOS)
    out = Image.new("RGBA", canvas.size, colour + (0,))
    out.putalpha(canvas)
    return out


def icon(mark_alpha: Image.Image, size: int) -> Image.Image:
    """Mint mark on the arcade's dark ground, for the /games browser tab."""
    bg = Image.new("RGBA", (size, size), (9, 8, 22, 255))
    mark = fill(mark_alpha, MINT, round(size * 0.66))
    bg.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return bg


def og(lockup_alpha: Image.Image) -> Image.Image:
    """1200 x 630 link preview for /games: the mint lockup glowing on the arcade ground."""
    from PIL import ImageFilter

    w, h = 1200, 630
    bg = Image.new("RGBA", (w, h), (9, 8, 22, 255))
    logo = fill(lockup_alpha, MINT, 470)
    x, y = (w - logo.width) // 2, (h - logo.height) // 2
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    glow.alpha_composite(logo, (x, y))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    bg.alpha_composite(glow)
    bg.alpha_composite(glow)
    bg.alpha_composite(logo, (x, y))
    return bg.convert("RGB")


def main() -> None:
    files = sorted(SRC.glob("ACJ multiple color copy_*.png"))
    if len(files) < 9:
        raise SystemExit(f"Expected 9 ACJ logo exports in {SRC}, found {len(files)}.")
    OUT.mkdir(parents=True, exist_ok=True)
    for idx, (name, edge) in JOBS.items():
        alpha = shape(files[idx - 1])
        for colour, tag in ((MINT, "mint"), (WHITE, "white")):
            img = fill(alpha, colour, edge)
            img.save(OUT / f"{name}-{tag}.png", optimize=True)
            print(f"{name}-{tag}.png  {img.width}x{img.height}")
        if name == "acj-lockup":
            og(alpha).save(ROOT / "app" / "(park)" / "games" / "opengraph-image.png", optimize=True)
            print("app/(park)/games/opengraph-image.png")
        if name == "acj-mark":
            for size in (192, 512):
                icon(alpha, size).save(OUT / f"acj-icon-{size}.png", optimize=True)
                print(f"acj-icon-{size}.png")


if __name__ == "__main__":
    main()
