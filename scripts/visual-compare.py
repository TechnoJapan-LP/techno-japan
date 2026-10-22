#!/usr/bin/env python3
"""Check and compare visual-snapshot PNG files without a browser data URL."""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def pngs(directory: Path) -> dict[str, Path]:
    return {path.name: path for path in directory.glob("*.png")}


def is_unhealthy(path: Path) -> tuple[bool, int, float]:
    with Image.open(path) as image:
        image = image.convert("RGB")
        width = 64
        height = max(1, round(width * image.height / image.width))
        sample = image.resize((width, height))
        colors = sample.getcolors(maxcolors=width * height)
        color_count = len(colors or [])
        dominant = max((count for count, _ in (colors or [])), default=0)
        ratio = dominant / (width * height)
    unhealthy = color_count <= 4 or ratio >= 0.995
    return unhealthy, color_count, ratio


def check(directory: Path) -> int:
    files = pngs(directory)
    if not files:
        print(f"check: PNG がありません: {directory}")
        return 1
    failed = []
    for name, path in sorted(files.items()):
        unhealthy, colors, dominant = is_unhealthy(path)
        print(f"{name}: colors={colors}, dominant={dominant * 100:.3f}%")
        if unhealthy:
            failed.append(name)
    if failed:
        print("撮影失敗（ほぼ単色）:")
        for name in failed:
            print(f"  {name}")
        return 1
    return 0


def save_diff(before: Image.Image, after: Image.Image, diff: Image.Image, output: Path, stem: str) -> None:
    output.mkdir(parents=True, exist_ok=True)
    red = before.copy().convert("RGB")
    red.paste((255, 0, 0), mask=diff)
    red.save(output / f"{stem}__diff.png")

    # Keep the changed area useful even for very tall full-page screenshots.
    bbox = diff.getbbox()
    if bbox is None:
        return
    left = before.crop(bbox).convert("RGB")
    right = after.crop(bbox).convert("RGB")
    joined = Image.new("RGB", (max(left.width, right.width), left.height + right.height), "white")
    joined.paste(left, (0, 0))
    joined.paste(right, (0, left.height))
    joined.save(output / f"{stem}__changed.png")


def compare(directory_a: Path, directory_b: Path, output: Path) -> int:
    unhealthy_a = check(directory_a)
    unhealthy_b = check(directory_b)
    if unhealthy_a or unhealthy_b:
        print("撮影失敗があるため比較を中止しました。")
        return 1

    files_a = pngs(directory_a)
    files_b = pngs(directory_b)
    names = sorted(set(files_a) & set(files_b))
    if not names:
        print("共通する PNG がありません")
        return 1

    changed = []
    output.mkdir(parents=True, exist_ok=True)
    for name in names:
        with Image.open(files_a[name]) as source, Image.open(files_b[name]) as target:
            source = source.convert("RGB")
            target = target.convert("RGB")
            if source.size != target.size:
                print(f"{name}: サイズ違い ({source.width}x{source.height} / {target.width}x{target.height})")
                changed.append(name)
                continue
            delta = ImageChops.difference(source, target)
            channels = delta.split()
            mask = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
            mask = mask.point(lambda value: 255 if value > 16 else 0)
            pixels = mask.width * mask.height
            changed_pixels = sum(1 for value in mask.getdata() if value)
            rate = changed_pixels / pixels
            print(f"{name}: {rate * 100:.4f}% ({changed_pixels}/{pixels})")
            if changed_pixels:
                changed.append(name)
                save_diff(source, target, mask, output, Path(name).stem)

    print("差分が出たページ:")
    if changed:
        for name in changed:
            print(f"  {name}")
        return 1
    print("  なし")
    return 0


def self_test() -> int:
    with tempfile.TemporaryDirectory(prefix="visual-compare-") as temporary:
        root = Path(temporary)
        same_a, same_b, changed = root / "same-a", root / "same-b", root / "changed"
        for directory in (same_a, same_b, changed):
            directory.mkdir()
        base = Image.new("RGB", (32, 24), (20, 40, 80))
        # Add enough texture to be a valid screenshot for the health check.
        draw = ImageDraw.Draw(base)
        for x in range(32):
            draw.line((x, 0, x, 23), fill=(x * 7, 40 + x * 3, 80))
        base.save(same_a / "page.png")
        base.save(same_b / "page.png")
        altered = base.copy()
        ImageDraw.Draw(altered).rectangle((8, 6, 15, 13), fill=(240, 20, 20))
        altered.save(changed / "page.png")
        Image.new("RGB", (32, 24), (0, 0, 0)).save(root / "flat.png")

        assert check(same_a) == 0
        assert check(root) == 1
        assert compare(same_a, same_b, root / "same-diff") == 0
        assert compare(same_a, changed, root / "changed-diff") == 1
        assert (root / "changed-diff" / "page__diff.png").exists()
    print("visual-compare --self-test: OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", nargs="?", choices=("check", "compare"))
    parser.add_argument("paths", nargs="*")
    parser.add_argument("--out", default=None)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if args.command == "check" and len(args.paths) == 1:
        return check(Path(args.paths[0]))
    if args.command == "compare" and len(args.paths) == 2:
        output = Path(args.out) if args.out else Path(args.paths[1]) / "diff"
        return compare(Path(args.paths[0]), Path(args.paths[1]), output)
    parser.error("使い方: visual-compare.py check <dir> | compare <dirA> <dirB> [--out <diffdir>]")
    return 2


if __name__ == "__main__":
    sys.exit(main())
