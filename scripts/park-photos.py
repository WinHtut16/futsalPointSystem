"""Edit the client's park photos into the site's photo slots.

Reads scripts/park-photos.json, takes each source photo from the client folder
(outside this repo), and writes a finished JPEG to public/images/park/:

  orient -> rotate -> blur faces -> crop to the slot's aspect -> inpaint
  stamps -> denoise -> white balance -> tone curve -> vibrance -> resize
  -> sharpen -> JPEG (EXIF and GPS stripped)

Re-run whenever the manifest or a source photo changes:

  python scripts/park-photos.py                # all photos
  python scripts/park-photos.py hero-pool.jpg  # just one
  python scripts/park-photos.py --sheet out.png  # also write a before/after sheet

Needs Pillow, OpenCV and NumPy (not part of the Next.js build).
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "scripts" / "park-photos.json"


def load(path: Path) -> np.ndarray:
    """RGB float32 0..1, with EXIF orientation applied."""
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return np.asarray(img).astype(np.float32) / 255.0


def rotate(img: np.ndarray, deg: float) -> np.ndarray:
    """Rotate about the centre and crop to the largest upright rectangle, so
    no blank corners appear."""
    if not deg:
        return img
    h, w = img.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), deg, 1.0)
    out = cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    a = math.radians(abs(deg))
    # Largest axis-aligned rectangle inside the rotated frame (same aspect).
    scale = 1 / (math.cos(a) + max(w / h, h / w) * math.sin(a))
    cw, ch = int(w * scale), int(h * scale)
    x0, y0 = (w - cw) // 2, (h - ch) // 2
    return out[y0 : y0 + ch, x0 : x0 + cw]


def crop(img: np.ndarray, focus: list[float], width: float, aspect: list[int]) -> np.ndarray:
    """Crop `width` (fraction of image width) at `aspect`, centred on `focus`
    (fractions), shifted as needed to stay inside the frame."""
    h, w = img.shape[:2]
    cw = width * w
    ch = cw * aspect[1] / aspect[0]
    if ch > h:  # too tall for the frame: shrink to fit
        ch = h
        cw = ch * aspect[0] / aspect[1]
    cx, cy = focus[0] * w, focus[1] * h
    x0 = min(max(cx - cw / 2, 0), w - cw)
    y0 = min(max(cy - ch / 2, 0), h - ch)
    return img[int(y0) : int(y0 + ch), int(x0) : int(x0 + cw)]


def rect(img: np.ndarray, r: list[float]) -> tuple[int, int, int, int]:
    h, w = img.shape[:2]
    return int(r[0] * w), int(r[1] * h), int(r[2] * w), int(r[3] * h)


def inpaint(img: np.ndarray, rects: list[list[float]]) -> np.ndarray:
    if not rects:
        return img
    u8 = (img * 255).astype(np.uint8)
    mask = np.zeros(u8.shape[:2], np.uint8)
    for r in rects:
        x0, y0, x1, y1 = rect(img, r)
        mask[y0:y1, x0:x1] = 255
    out = cv2.inpaint(u8, mask, 9, cv2.INPAINT_TELEA)
    return out.astype(np.float32) / 255.0


def denoise(img: np.ndarray, strength: float) -> np.ndarray:
    if not strength:
        return img
    u8 = (img * 255).astype(np.uint8)
    out = cv2.fastNlMeansDenoisingColored(u8, None, strength, strength, 7, 21)
    return out.astype(np.float32) / 255.0


def white_balance(img: np.ndarray, amount: float, tint: list[float] | None) -> np.ndarray:
    """Partial gray-world on mid-tones (amount 0..1), then optional manual
    per-channel gains for a deliberate warm or cool lean."""
    if amount:
        lum = img.mean(axis=2)
        mid = (lum > 0.15) & (lum < 0.85)
        means = img[mid].mean(axis=0)
        gains = means.mean() / np.maximum(means, 1e-4)
        img = img * (1 + (gains - 1) * amount)
    if tint:
        img = img * np.array(tint, np.float32)
    return np.clip(img, 0, 1)


def tone(img: np.ndarray, exposure: float, shadows: float, highlights: float, contrast: float) -> np.ndarray:
    x = np.clip(img * (2.0 ** exposure), 0, 1)
    # Lift shadows / roll off highlights with smooth, bounded bumps.
    x = x + shadows * 4 * x * (1 - x) ** 3 - highlights * 4 * x ** 3 * (1 - x)
    x = np.clip(x, 0, 1)
    if contrast:
        s = x * x * (3 - 2 * x)  # smoothstep S-curve
        x = x + (s - x) * contrast
    return np.clip(x, 0, 1)


def vibrance(img: np.ndarray, amount: float) -> np.ndarray:
    """Saturation boost that favours muted colours, so skin and already-bright
    paint don't go garish."""
    if not amount:
        return img
    gray = img.mean(axis=2, keepdims=True)
    sat = img.max(axis=2, keepdims=True) - img.min(axis=2, keepdims=True)
    boost = 1 + amount * (1 - sat)
    return np.clip(gray + (img - gray) * boost, 0, 1)


def blur_faces(img: np.ndarray, rects: list[list[float]]) -> np.ndarray:
    """Feathered elliptical blur over each face box (fractions of the source)."""
    if not rects:
        return img
    h, w = img.shape[:2]
    out = img.copy()
    for r in rects:
        x0, y0, x1, y1 = rect(img, r)
        bw, bh = x1 - x0, y1 - y0
        sigma = max(bw, bh) / 4
        blurred = cv2.GaussianBlur(img, (0, 0), sigma)
        mask = np.zeros((h, w), np.float32)
        cv2.ellipse(mask, ((x0 + x1) // 2, (y0 + y1) // 2), (bw // 2, bh // 2), 0, 0, 360, 1.0, -1)
        mask = cv2.GaussianBlur(mask, (0, 0), max(bw, bh) / 6)[..., None]
        out = out * (1 - mask) + blurred * mask
    return out


def resize_sharpen(img: np.ndarray, max_long: int, sharpen: float) -> np.ndarray:
    h, w = img.shape[:2]
    scale = min(1.0, max_long / max(h, w))
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    if sharpen:
        soft = cv2.GaussianBlur(img, (0, 0), 1.1)
        img = np.clip(img + (img - soft) * sharpen, 0, 1)
    return img


def process(p: dict, src_root: Path) -> tuple[Image.Image, Image.Image]:
    original = load(src_root / p["src"])
    img = rotate(original, p.get("rotate", 0))
    # Face boxes are fractions of the (rotated) source, so they stay put when
    # a crop is retuned.
    img = blur_faces(img, p.get("faces", []))
    img = crop(img, p["focus"], p["width"], p["aspect"])
    img = inpaint(img, p.get("inpaint", []))
    img = denoise(img, p.get("denoise", 0))
    img = white_balance(img, p.get("wb", 0.5), p.get("tint"))
    img = tone(img, p.get("exposure", 0), p.get("shadows", 0.25), p.get("highlights", 0.1), p.get("contrast", 0.15))
    img = vibrance(img, p.get("vibrance", 0.12))
    img = resize_sharpen(img, p.get("maxLong", 2000), p.get("sharpen", 0.45))
    before = Image.fromarray((original * 255).astype(np.uint8))
    after = Image.fromarray((img * 255).round().astype(np.uint8))
    return before, after


def sheet(pairs: list[tuple[str, Image.Image, Image.Image]], out: Path) -> None:
    """Before (left) / after (right) contact sheet, one row per photo."""
    row_h, pad, label_h = 360, 24, 34
    widths = []
    for _, b, a in pairs:
        widths.append(int(b.width * row_h / b.height) + int(a.width * row_h / a.height) + pad * 3)
    width = max(widths)
    canvas = Image.new("RGB", (width, len(pairs) * (row_h + label_h + pad) + pad), (238, 246, 240))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
    y = pad
    for name, b, a in pairs:
        draw.text((pad, y), f"{name}   (left: original, right: edited crop)", fill=(18, 48, 42), font=font)
        y += label_h
        bt = b.resize((int(b.width * row_h / b.height), row_h))
        at = a.resize((int(a.width * row_h / a.height), row_h))
        canvas.paste(bt, (pad, y))
        canvas.paste(at, (pad * 2 + bt.width, y))
        y += row_h + pad
    canvas.save(out, quality=85)


def main() -> None:
    args = sys.argv[1:]
    sheet_out = None
    if "--sheet" in args:
        i = args.index("--sheet")
        sheet_out = Path(args[i + 1])
        args = args[:i] + args[i + 2 :]
    cfg = json.loads(MANIFEST.read_text(encoding="utf-8"))
    src_root = (ROOT / cfg["srcRoot"]).resolve()
    out_dir = ROOT / cfg["outDir"]
    out_dir.mkdir(parents=True, exist_ok=True)
    pairs = []
    for p in cfg["photos"]:
        if args and p["out"] not in args:
            continue
        before, after = process(p, src_root)
        # Fresh image object: no EXIF, no GPS, no camera metadata. Baseline,
        # not progressive: Next's image optimizer hung on a progressive JPEG
        # (hero-pool), and it re-encodes to WebP/AVIF for visitors anyway.
        after.save(out_dir / p["out"], "JPEG", quality=82, optimize=True)
        kb = (out_dir / p["out"]).stat().st_size // 1024
        print(f"{p['out']:28s} {after.width}x{after.height}  {kb} KB")
        pairs.append((p["out"], before, after))
    if sheet_out:
        sheet(pairs, sheet_out)
        print(f"sheet -> {sheet_out}")


if __name__ == "__main__":
    main()
