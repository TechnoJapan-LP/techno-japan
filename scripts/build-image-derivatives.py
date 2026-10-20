#!/usr/bin/env python3
"""カード表示用の縮小画像を、Drive同期の原本から作る。

■ なぜ4サイズ作るか

  カードの実測表示幅は 324〜452px（2026-08-07 / headless で計測）。
  960px 1枚だけだと、スマホには必要の3倍近い画素を送ることになる。
  240 / 480 / 720 / 960px を作り、表示幅に合う画像を選べるようにする。

■ 原本には触らない

  LP/images/ は sync-drive-images.yml が2時間おきに Drive から
  上書きするため、そこへ派生を置くと消えるか毎回差分が出る。
  LP/images/derivatives/ 配下だけを生成物として扱う（AUDIT §9-45）。
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
# 2026-08-15 まで festivals だけを対象にしていた。
# そのため詳細ページの hero（アーティスト・会場・記事）に派生が無く、
# 原寸 1920px をモバイルの 471px 枠へそのまま配っていた。
# 実測でフェス詳細 1,448KB のうち 1,348KB が画像だった（AUDIT §9-90）。
SOURCE_DIRS = ("festivals", "artists", "venues", "articles")
OUT_ROOT = ROOT / "LP" / "images" / "derivatives" / "card"
OUT_JS = ROOT / "LP" / "image-derivatives.js"
# (接尾辞, 長辺上限)。srcset の候補になる。
# 64px の枠（artists.html のカード 137枚）から 345px の枠まで実測で幅が5倍違う。
# 240 / 480 / 720 / 960 の4枚で、どの枠にも1.5倍以内で収まる。
# 2026-09-29 実測: artist-card-img は64〜80px表示で必要192px、
# それに960pxを送っていた（AUDIT / docs/design/BENCHMARK_EYESCREAM_SPINCOASTER_2026-09-29.md）。
SIZES = (("xs", 240), ("sm", 480), ("md", 720), ("lg", 960))
# 記事のfull-bleed heroだけはPC幅1440px/高密度画面に対応する。
# 原本より拡大せず、xxl は原本の幅が xl より大きい記事だけ作る。
ARTICLE_HERO_SIZES = (("xl", 1440), ("xxl", 2560))
# 本文はスマホ100vwとPCのfull幅（実測最大1332px）で表示されるため、
# dpr2の800px、dpr3の1200px、PC Retinaの1440pxを候補にする。
ARTICLE_BODY_SIZES = (("body-md", 800), ("body-lg", 1200), ("body-xl", 1440))
QUALITY = 80
ARTICLE_HERO_QUALITY = 85
ARTICLE_ASPECTS = {
    "wide": (16, 9),
    "square": (1, 1),
    "fourThree": (4, 3),
}
ARTICLE_POSITIONS = ("center", "top", "bottom", "left", "right")


def articles_section() -> str:
    data = (ROOT / "LP" / "data.js").read_text(encoding="utf-8")
    return data.split("const ARTICLES = [", 1)[-1].split("\n];", 1)[0]


def article_hero_sources() -> set[str]:
    """記事のヒーロー画像だけを派生対象にする。

    本文中の外部画像までアスペクト違いを生成すると、対象が5記事ではなく
    数十枚へ膨らみ、生成時間とリポジトリ容量を不必要に増やすため。
    """
    section = articles_section()
    return set(re.findall(r'image:\s*"(images/articles/[^"?]+\.webp)"', section))


def article_body_sources() -> set[str]:
    """本文で直接参照されるローカル画像と対応表の画像だけを対象にする。"""
    sources = set()
    section = articles_section()
    for body in re.findall(r"\bbody(?:_en)?:\s*`([\s\S]*?)`", section):
        sources.update(re.findall(r"images/articles/[^\"'<>\s)]+\.webp", body))
    map_file = ROOT / "LP" / "data" / "article-image-map.json"
    if map_file.exists():
        mapping = json.loads(map_file.read_text(encoding="utf-8"))
        sources.update(str(value).lstrip("/") for value in mapping.values())
    return sources


def article_hero_positions() -> dict[str, set[str]]:
    """記事ごとの実際の imagePosition と center だけを返す。"""
    section = articles_section()
    result = {}
    for block in re.findall(r"\n  \{(.*?)(?=\n  \},|\Z)", section, re.DOTALL):
        image = re.search(r'image:\s*"(images/articles/[^"?]+\.webp)"', block)
        if not image:
            continue
        value = re.search(r'imagePosition:\s*"([^"]+)"', block)
        position = crop_position_key(value.group(1) if value else "center")
        result[image.group(1)] = {"center", position}
    return result


def crop_position_key(value: str) -> str:
    value = str(value or "center").lower()
    if "top" in value:
        return "top"
    if "bottom" in value:
        return "bottom"
    if "left" in value:
        return "left"
    if "right" in value:
        return "right"
    return "center"


def crop_centering(position: str) -> tuple[float, float]:
    """CSSのimagePosition相当をPillowのcrop中心へ変換する。"""
    value = str(position or "center").lower()
    x = 0.0 if "left" in value else 1.0 if "right" in value else 0.5
    y = 0.0 if "top" in value else 1.0 if "bottom" in value else 0.5
    return x, y


def main() -> None:
    mapping = {}
    counts = {}
    article_heroes = article_hero_sources()
    article_bodies = article_body_sources()
    article_positions = article_hero_positions()
    body_count = 0
    for kind in SOURCE_DIRS:
        source_dir = ROOT / "LP" / "images" / kind
        out_dir = OUT_ROOT / kind
        if not source_dir.is_dir():
            counts[kind] = 0
            continue
        out_dir.mkdir(parents=True, exist_ok=True)
        n = 0
        for source in sorted(source_dir.iterdir()):
            if source.suffix.lower() != ".webp":
                continue
            raw = source.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()[:8]
            source_key = f"images/{kind}/{source.name}"
            body_only = kind == "articles" and source_key in article_bodies and source_key not in article_heroes
            entry = {}
            if not body_only:
                for suffix, max_edge in SIZES:
                    target = out_dir / f"{source.stem}--{digest}-{suffix}.webp"
                    with Image.open(source) as image:
                        image = ImageOps.exif_transpose(image)
                        if image.mode not in ("RGB", "RGBA"):
                            image = image.convert("RGB")
                        if max(image.size) > max_edge:
                            image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
                        image.save(target, "WEBP", quality=QUALITY, method=6)
                        entry[suffix] = {
                            "path": f"images/derivatives/card/{kind}/{target.name}",
                            "w": image.size[0],
                        }
                # 既定(src)はlg。srcsetを解釈しない環境でも従来どおり表示できる。
                mapping[source_key] = {
                    "src": entry["lg"]["path"],
                    "srcset": [[entry[suffix]["path"], entry[suffix]["w"]]
                               for suffix, _ in SIZES],
                }
            else:
                # 本文専用画像は本文srcsetだけを持つ。カード/hero側から参照されない。
                mapping[source_key] = {}
            if kind == "articles" and source_key in article_bodies:
                body_srcset = []
                widths = set()
                with Image.open(source) as probe:
                    source_width = ImageOps.exif_transpose(probe).size[0]
                for suffix, max_width in ARTICLE_BODY_SIZES:
                    if source_width <= max_width:
                        break
                    body_target = out_dir / f"{source.stem}--{digest}-{suffix}.webp"
                    with Image.open(source) as image:
                        image = ImageOps.exif_transpose(image)
                        if image.mode not in ("RGB", "RGBA"):
                            image = image.convert("RGB")
                        target_height = round(image.height * max_width / image.width)
                        image = image.resize((max_width, target_height), Image.Resampling.LANCZOS)
                        image.save(body_target, "WEBP", quality=QUALITY, method=6)
                    body_srcset.append([f"images/derivatives/card/{kind}/{body_target.name}", max_width])
                    widths.add(max_width)
                # 1440pxを超える原本は、src属性の原本をsrcsetへ重複登録しない。
                # 1440px以下の原本だけ、生成できる最大候補として原本を1回入れる。
                if source_width <= ARTICLE_BODY_SIZES[-1][1] and source_width not in widths:
                    body_srcset.append([source_key, source_width])
                mapping[source_key]["bodySrcset"] = body_srcset
                body_count += 1
            if kind == "articles" and f"images/articles/{source.name}" in article_heroes:
                hero_srcset = []
                with Image.open(source) as probe:
                    source_width = ImageOps.exif_transpose(probe).size[0]
                for suffix, max_width in ARTICLE_HERO_SIZES:
                    if suffix == "xxl" and source_width <= ARTICLE_HERO_SIZES[0][1]:
                        continue
                    hero_target = out_dir / f"{source.stem}--{digest}-{suffix}.webp"
                    with Image.open(source) as image:
                        image = ImageOps.exif_transpose(image)
                        if image.mode not in ("RGB", "RGBA"):
                            image = image.convert("RGB")
                        target_width = min(max_width, image.width)
                        if image.width > target_width:
                            target_height = round(image.height * target_width / image.width)
                            image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
                        image.save(hero_target, "WEBP", quality=ARTICLE_HERO_QUALITY, method=6)
                        hero_srcset.append([
                            f"images/derivatives/card/{kind}/{hero_target.name}", image.size[0]
                        ])
                mapping[f"images/{kind}/{source.name}"]["heroSrcset"] = hero_srcset
                aspect_entries = {}
                with Image.open(source) as original:
                    original = ImageOps.exif_transpose(original)
                    if original.mode not in ("RGB", "RGBA"):
                        original = original.convert("RGB")
                    for aspect_name, (rw, rh) in ARTICLE_ASPECTS.items():
                        # Discover/News向けに1200pxを目標にするが、原本は拡大しない。
                        target_w = min(1200, original.size[0])
                        target_h = round(target_w * rh / rw)
                        positions = {}
                        source_key = f"images/articles/{source.name}"
                        for position in sorted(article_positions.get(source_key, {"center"})):
                            target = out_dir / f"{source.stem}--{digest}-{aspect_name}-{position}.webp"
                            cropped = ImageOps.fit(
                                original,
                                (target_w, target_h),
                                method=Image.Resampling.LANCZOS,
                                centering=crop_centering(position),
                            )
                            cropped.save(target, "WEBP", quality=QUALITY, method=6)
                            positions[position] = {
                                "path": f"images/derivatives/card/{kind}/{target.name}",
                                "w": target_w,
                                "h": target_h,
                            }
                        aspect_entries[aspect_name] = positions
                mapping[f"images/{kind}/{source.name}"]["aspect"] = aspect_entries
            n += 1
        counts[kind] = n

        # 派生画像はハッシュ付きで履歴を持つため、原本更新時に旧版が残る。
        # 原本同期領域には触れず、この生成物ディレクトリだけを安全に整理する。
        # ⚠️ 種類ごとに掃除する。全体の wanted で他ディレクトリを消さないこと。
        wanted = {
            Path(p).name
            for key, value in mapping.items()
            if key.startswith(f"images/{kind}/")
            for p, _ in value.get("srcset", [])
        } | {
            Path(position["path"]).name
            for key, value in mapping.items()
            if key.startswith(f"images/{kind}/")
            for aspect in value.get("aspect", {}).values()
            for position in aspect.values()
        } | {
            Path(p).name
            for key, value in mapping.items()
            if key.startswith(f"images/{kind}/")
            for p, _ in value.get("heroSrcset", [])
        } | {
            Path(p).name
            for key, value in mapping.items()
            if key.startswith(f"images/{kind}/")
            for p, _ in value.get("bodySrcset", [])
        }
        for stale in out_dir.glob("*.webp"):
            if stale.name not in wanted:
                stale.unlink()

    payload = json.dumps(mapping, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    output = "/* Generated by scripts/build-image-derivatives.py. */\n" \
             f"window.TJ_IMAGE_DERIVATIVES={payload};\n"
    changed = not OUT_JS.exists() or OUT_JS.read_text(encoding="utf-8") != output
    if changed:
        OUT_JS.write_text(output, encoding="utf-8")
        bump_asset_version()
    breakdown = " / ".join(f"{k} {v}" for k, v in counts.items())
    print(f"Card derivatives: {len(mapping)}枚 × {len(SIZES)}サイズ（{breakdown}）"
          f" → {OUT_ROOT.relative_to(ROOT)}")
    print(f"Article body derivatives: {body_count}対象 / {len(article_bodies)}対象画像")


def bump_asset_version() -> None:
    files = sorted((ROOT / "LP").rglob("*.html"))
    pattern = re.compile(r"(image-derivatives\.js)\?v=(\d+)")
    matches = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        found = list(pattern.finditer(text))
        if found:
            matches.append((path, text, found))
    if not matches:
        return
    version = max(int(m.group(2)) for _, _, found in matches for m in found) + 1
    for path, text, _ in matches:
        path.write_text(pattern.sub(rf"\1?v={version}", text), encoding="utf-8")
    print(f"image-derivatives.js の中身が変わったので ?v={version} へ更新（{len(matches)} ファイル）")


if __name__ == "__main__":
    main()
