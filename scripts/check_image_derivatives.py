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
# manifest は 2026-08-07 に {src, srcset:[[path,幅],...]} の形へ変わった。
# 旧形式（文字列1本）も受けて、片方だけ更新された状態でも落ちないようにする。
def entries(value):
    """(パス, 宣言幅 or None) を列挙する。"""
    if isinstance(value, str):
        return [(value, None)]
    out = [(value["src"], None)]
    out += [(path, width) for path, width in value.get("srcset", [])]
    for aspect in value.get("aspect", {}).values():
        for position in aspect.values():
            out.append((position["path"], position.get("w")))
    return out

data = (ROOT / "LP/data.js").read_text(encoding="utf-8")
article_section = data.split("const ARTICLES = [", 1)[-1].split("\n];", 1)[0]
article_heroes = set(re.findall(r'image:\s*"(images/articles/[^"?]+\.webp)"', article_section))


checked = 0
article_sources = 0
for source, value in mapping.items():
    source_path = ROOT / "LP" / source
    if not source_path.exists():
        raise SystemExit(f"原本がありません: {source}")
    if source in article_heroes and isinstance(value, dict):
        article_sources += 1
        if not all(value.get("aspect", {}).get(name) for name in ("wide", "square", "fourThree")):
            raise SystemExit(f"記事画像の3アスペクト派生がありません: {source}")
    for target, declared_width in entries(value):
        target_path = ROOT / "LP" / target
        if not target_path.exists():
            raise SystemExit(f"派生画像がありません: {target}")
        with Image.open(target_path) as image:
            if max(image.size) > 1200:
                raise SystemExit(f"派生画像が大きすぎます: {target} {image.size}")
            # srcset の幅宣言が実体とずれると、ブラウザが誤った1枚を選ぶ。
            # 「小さいのに大きいと宣言」= ぼやけ、逆 = 無駄な転送。
            if declared_width is not None and image.size[0] != declared_width:
                raise SystemExit(
                    f"srcset の幅宣言が実体と違います: {target} "
                    f"宣言={declared_width}w 実体={image.size[0]}px"
                )
        checked += 1
print(f"✅ 派生画像 {checked}枚（原本{len(mapping)}件、記事{article_sources}件）、実体・サイズ・幅宣言を確認")
