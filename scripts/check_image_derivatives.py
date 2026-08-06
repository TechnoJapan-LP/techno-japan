#!/usr/bin/env python3
"""Validate generated festival card derivatives and their manifest."""
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source_dir = ROOT / "LP/images/festivals"
derived_dir = ROOT / "LP/images/derivatives/card/festivals"
manifest = ROOT / "LP/image-derivatives.js"
if not manifest.exists():
    raise SystemExit("image-derivatives.js がありません")
text = manifest.read_text(encoding="utf-8")
match = re.search(r"window\.TJ_IMAGE_DERIVATIVES=(\{.*\});", text)
if not match:
    raise SystemExit("派生画像manifestの形式が不正です")
mapping = json.loads(match.group(1))
if not mapping:
    raise SystemExit("派生画像manifestが空です")
for source, target in mapping.items():
    source_path = ROOT / "LP" / source
    target_path = ROOT / "LP" / target
    if not source_path.exists():
        raise SystemExit(f"原本がありません: {source}")
    if not target_path.exists():
        raise SystemExit(f"派生画像がありません: {target}")
    with Image.open(target_path) as image:
        if max(image.size) > 960:
            raise SystemExit(f"派生画像が大きすぎます: {target} {image.size}")
print(f"✅ 派生画像 {len(mapping)}件、原本・manifest・サイズを確認")
