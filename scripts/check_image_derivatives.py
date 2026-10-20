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
    out = []
    if value.get("src"):
        out.append((value["src"], None))
    out += [(path, width) for path, width in value.get("srcset", [])]
    for aspect in value.get("aspect", {}).values():
        for position in aspect.values():
            out.append((position["path"], position.get("w")))
    out += [(path, width) for path, width in value.get("heroSrcset", [])]
    out += [(path, width) for path, width in value.get("bodySrcset", [])]
    return out

data = (ROOT / "LP/data.js").read_text(encoding="utf-8")
article_section = data.split("const ARTICLES = [", 1)[-1].split("\n];", 1)[0]
article_heroes = set(re.findall(r'image:\s*"(images/articles/[^"?]+\.webp)"', article_section))
article_bodies = set()
for body in re.findall(r"\bbody(?:_en)?:\s*`([\s\S]*?)`", article_section):
    article_bodies.update(re.findall(r"images/articles/[^\"'<>\s)]+\.webp", body))
map_file = ROOT / "LP/data/article-image-map.json"
if map_file.exists():
    article_bodies.update(str(value).lstrip("/") for value in json.loads(map_file.read_text(encoding="utf-8")).values())


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
        hero_srcset = value.get("heroSrcset") or []
        if not hero_srcset:
            raise SystemExit(f"記事heroのxl派生がありません: {source}")
        with Image.open(source_path) as original:
            source_width = original.size[0]
        if source_width > 1440 and not any(path.endswith("-xxl.webp") for path, _ in hero_srcset):
            raise SystemExit(f"記事heroのxxl派生がありません: {source}")
    if source in article_bodies and source not in article_heroes and isinstance(value, dict):
        body_srcset = value.get("bodySrcset") or []
        if not body_srcset:
            raise SystemExit(f"本文専用記事画像のbody派生がありません: {source}")
        if value.get("src") or value.get("srcset") or value.get("heroSrcset") or value.get("aspect"):
            raise SystemExit(f"本文専用記事画像に不要な派生があります: {source}")
        with Image.open(source_path) as original:
            source_width = original.size[0]
        widths = [width for _, width in body_srcset]
        if len(widths) != len(set(widths)):
            raise SystemExit(f"本文bodySrcsetに重複幅があります: {source}")
        if any(width > source_width or width > 1440 for width in widths):
            raise SystemExit(f"本文bodySrcsetに原本幅超過または1440px超の候補があります: {source}")
        has_original = any(path == source for path, _ in body_srcset)
        if source_width > 1440 and has_original:
            raise SystemExit(f"1440px超の本文原本がbodySrcsetに入っています: {source}")
        if source_width <= 1440 and not has_original:
            raise SystemExit(f"1440px以下の本文原本が最大候補にありません: {source}")
    if source in article_bodies and source in article_heroes and isinstance(value, dict):
        body_srcset = value.get("bodySrcset") or []
        if not body_srcset:
            raise SystemExit(f"本文兼ヒーロー記事画像のbody派生がありません: {source}")
        with Image.open(source_path) as original:
            source_width = original.size[0]
        widths = [width for _, width in body_srcset]
        if len(widths) != len(set(widths)):
            raise SystemExit(f"本文bodySrcsetに重複幅があります: {source}")
        if any(width > source_width or width > 1440 for width in widths):
            raise SystemExit(f"本文bodySrcsetに原本幅超過または1440px超の候補があります: {source}")
        has_original = any(path == source for path, _ in body_srcset)
        if source_width > 1440 and has_original:
            raise SystemExit(f"1440px超の本文原本がbodySrcsetに入っています: {source}")
        if source_width <= 1440 and not has_original:
            raise SystemExit(f"1440px以下の本文原本が最大候補にありません: {source}")
    for target, declared_width in entries(value):
        target_path = ROOT / "LP" / target
        if not target_path.exists():
            raise SystemExit(f"派生画像がありません: {target}")
        with Image.open(target_path) as image:
            # 本文派生は表示幅に合わせて横幅で作るため、縦長画像の高さは制限しない。
            # カード/hero派生は従来どおり長辺基準で検査する。
            if "-body-" in target:
                if image.width > 1440:
                    raise SystemExit(f"本文派生の幅が大きすぎます: {target} {image.size}")
            elif target.endswith("-xxl.webp"):
                if image.width > 2560:
                    raise SystemExit(f"記事heroの幅が大きすぎます: {target} {image.size}")
            elif target.endswith("-xl.webp"):
                if image.width > 1440:
                    raise SystemExit(f"記事heroの幅が大きすぎます: {target} {image.size}")
            elif target.startswith("images/articles/") and not target.startswith("images/derivatives/"):
                # 本文srcsetの最大候補として原本を登録することがある。
                pass
            elif max(image.size) > 1440:
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
