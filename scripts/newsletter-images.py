#!/usr/bin/env python3
"""ニュースレター記事カード用の600x400画像を作る。"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def position(value):
    value = str(value or "center").lower()
    parts = value.replace(",", " ").split()
    x = y = 0.5
    percentage_index = 0
    for part in parts:
        if part.endswith("%"):
            try:
                number = max(0.0, min(100.0, float(part[:-1]))) / 100
            except ValueError:
                continue
            if percentage_index == 0:
                x = number
            else:
                y = number
            percentage_index += 1
        elif part in ("left", "right"):
            x = 0.0 if part == "left" else 1.0
        elif part in ("top", "bottom"):
            y = 0.0 if part == "top" else 1.0
    return x, y


def crop(image, image_position):
    width, height = image.size
    target_ratio = 3 / 2
    x_anchor, y_anchor = position(image_position)
    if width / height > target_ratio:
        crop_height = height
        crop_width = round(height * target_ratio)
    else:
        crop_width = width
        crop_height = round(width / target_ratio)
    left = round((width - crop_width) * x_anchor)
    top = round((height - crop_height) * y_anchor)
    return image.crop((left, top, left + crop_width, top + crop_height)).resize((600, 400), Image.Resampling.LANCZOS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--month", required=True)
    parser.add_argument("--items-json", default="-")
    args = parser.parse_args()
    raw = sys.stdin.read() if args.items_json == "-" else Path(args.items_json).read_text(encoding="utf-8")
    items = json.loads(raw)
    output_dir = ROOT / "LP" / "images" / "newsletter" / args.month
    output_dir.mkdir(parents=True, exist_ok=True)
    created = 0
    skipped = 0
    for item in items:
        image = str(item.get("image") or "").strip()
        source = ROOT / "LP" / image.lstrip("/")
        target = output_dir / f'{item["id"]}.webp'
        if target.exists():
            skipped += 1
            continue
        try:
            if not image or not source.is_file():
                raise FileNotFoundError(f"記事画像が見つかりません: {source}")
            with Image.open(source) as original:
                prepared = ImageOps.exif_transpose(original).convert("RGB")
                crop(prepared, item.get("imagePosition", "center")).save(target, "WEBP", quality=80, method=6)
            created += 1
            print(f"created {target.relative_to(ROOT)}")
        except Exception as exc:
            print(f"WARNING: 記事画像をスキップしました ({item.get('id', '(unknown)')}): {exc}", file=sys.stderr)
    print(f"newsletter images: {created} created, {skipped} already existed")


if __name__ == "__main__":
    main()
