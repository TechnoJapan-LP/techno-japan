#!/usr/bin/env python3
"""Download and normalize Google Drive images embedded in article bodies."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "LP" / "data.js"
MAP = ROOT / "LP" / "data" / "article-image-map.json"
IMAGE_DIR = ROOT / "LP" / "images" / "articles"
MAX_EDGE = 1920
MAX_BYTES = 1_000_000
SOURCE_URL = "https://lh3.googleusercontent.com/d/{file_id}=w2000"
ID_PATTERNS = (
    re.compile(r"lh3\.googleusercontent\.com/d/([A-Za-z0-9_-]+)", re.I),
    re.compile(r"drive\.google\.com/uc\?[^\"'<>\s]*?\bid=([A-Za-z0-9_-]+)", re.I),
    re.compile(r"drive\.google\.com/file/d/([A-Za-z0-9_-]+)", re.I),
)


def article_fields() -> list[tuple[str, str]]:
    text = DATA.read_text(encoding="utf-8")
    section = text.split("const ARTICLES = [", 1)[1].rsplit("\n];", 1)[0]
    result = []
    for block in re.split(r"\n  \{", section)[1:]:
        article_id = re.search(r"\bid:\s*['\"]([^'\"]+)", block)
        if not article_id:
            continue
        for field in ("body", "body_en"):
            match = re.search(rf"\b{field}:\s*`([\s\S]*?)`", block)
            if match:
                result.append((article_id.group(1), match.group(1)))
    return result


def ids_from_bodies() -> list[tuple[str, str]]:
    found = []
    seen = set()
    for article_id, body in article_fields():
        for pattern in ID_PATTERNS:
            for file_id in pattern.findall(body):
                if file_id not in seen:
                    seen.add(file_id)
                    found.append((article_id, file_id))
    return found


def relative_path(article_id: str, number: int, file_id: str) -> str:
    digest = hashlib.sha1(file_id.encode("utf-8")).hexdigest()[:8]
    return f"images/articles/{article_id}-body{number:02d}-{digest}.webp"


def convert(source: Path, target: Path) -> None:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        if max(image.size) > MAX_EDGE:
            image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=85, method=6)
    if target.stat().st_size > MAX_BYTES:
        for quality in (80, 72, 65):
            with Image.open(target) as image:
                image.save(target, "WEBP", quality=quality, method=6)
            if target.stat().st_size <= MAX_BYTES:
                break


def download(file_id: str, target: Path) -> None:
    last_error = None
    for attempt in range(1, 4):
        try:
            request = urllib.request.Request(SOURCE_URL.format(file_id=file_id), headers={"User-Agent": "techno-japan-image-sync/1"})
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read()
            raw = target.with_suffix(".download")
            raw.write_bytes(data)
            try:
                convert(raw, target)
            finally:
                raw.unlink(missing_ok=True)
            return
        except Exception as error:  # keep other images moving
            last_error = error
            if attempt < 3:
                wait = 2 ** (attempt - 1)
                print(f"  {file_id}: retrying in {wait}s [{attempt}/3]")
                time.sleep(wait)
    raise RuntimeError(str(last_error))


def load_map() -> dict[str, str]:
    if not MAP.exists():
        return {}
    value = json.loads(MAP.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise SystemExit(f"対応表の形式が不正です: {MAP}")
    return {str(key): str(path).lstrip("/") for key, path in value.items()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="downloadせず対象件数だけ表示")
    args = parser.parse_args()
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    mapping = load_map()
    found = ids_from_bodies()
    pending = []
    for article_id, file_id in found:
        current = mapping.get(file_id, "")
        if current and (ROOT / "LP" / current).exists():
            continue
        pending.append((article_id, file_id))
    print(f"Article body Drive images: {len(found)} unique, {len(pending)} to download")
    if args.dry_run:
        for article_id, file_id in pending:
            print(f"  {article_id}: {file_id}")
        return 0

    failures = []
    used_numbers: dict[str, set[int]] = {}
    for article_id, file_id in found:
        used_numbers.setdefault(article_id, set())
        if file_id in mapping and (ROOT / "LP" / mapping[file_id]).exists():
            continue
        digest = hashlib.sha1(file_id.encode("utf-8")).hexdigest()[:8]
        existing = next(IMAGE_DIR.glob(f"*-body??-{digest}.webp"), None)
        if existing:
            mapping[file_id] = existing.relative_to(ROOT / "LP").as_posix()
            continue
        number = 1
        while number in used_numbers[article_id] or (IMAGE_DIR / Path(relative_path(article_id, number, file_id)).name).exists():
            number += 1
        target = IMAGE_DIR / Path(relative_path(article_id, number, file_id)).name
        try:
            print(f"  downloading {file_id} -> {target.name}")
            download(file_id, target)
            used_numbers[article_id].add(number)
            mapping[file_id] = target.relative_to(ROOT / "LP").as_posix()
        except Exception as error:
            failures.append(f"{article_id}: {file_id} ({error})")

    MAP.parent.mkdir(parents=True, exist_ok=True)
    MAP.write_text(json.dumps(dict(sorted(mapping.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        message = "\n".join(failures)
        print(f"::warning::記事本文画像の取得に失敗（{len(failures)}件）:\n{message}")
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as output:
                output.write(f"\n### Article body image sync failures ({len(failures)})\n\n" + "\n".join(f"- {item}" for item in failures) + "\n")
    if failures and len(failures) == len(pending) and pending:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

