#!/usr/bin/env python3
"""VENUE 巡回の結果を Airtable Venues の notes に「提案票」として書き、
ユーザーが notes 上で直した内容を本体の列へ反映する。

■ 流れ

  1) propose : data/inbox/venues/*.json の判断を、各 Venues 行の notes 先頭に
               提案票として書く（既存の notes は下に残す。coverage_tier 等は触らない）
  2) ユーザーが Airtable で coverage_tier のプルダウンを editorial / skip に変える（これが最優先）。
     directory のままなら提案票の「判断:」を使う。type・features 等を直したいときだけ notes を編集
  3) apply   : notes の提案票を読み、判断が「載せる / 載せない」の行だけ本体へ反映し、
               提案票の1行目を「反映済 日付」に書き換える。「保留」は何もしない

■ 提案票の形（notes の先頭。行頭 `[TJ巡回` から空行まで）

  [TJ巡回 2026-08-23] 未反映
  判断: 載せる            ← 載せる / 載せない / 保留
  type: club              ← club / bar / livehouse / record-shop / cafe
  features: after-hours; vinyl
  status: open            ← open / closed
  subtype: dj-bar         ← サイト用メモ（Airtable に列は無い。CMS 入力時に使う）
  hours: 20:00–05:00
  charge: ¥1,000
  address: 東京都…
  url: https://…
  area: SHIBUYA           ← 日本の行だけ（CMS の AREA）。海外は空でよい
  genres: techno; house
  理由: …
  出典: https://… ; https://…

■ 反映の対応

  判断 載せる   → coverage_tier=editorial
  判断 載せない → coverage_tier=skip
  type          → venue_type
  features      → features（複数選択。typecast で語彙を自動作成）
  status        → venue_status
  url           → official_url（空のときだけ）
  area / address / subtype / hours / charge / genres → 同名の列（2026-08-23 追加）

■ 約束
  - --dry-run が既定。書き込みは --execute のときだけ
  - 変更は1件ずつ印字する
  - notes の既存内容は消さない（提案票の下にそのまま残す）

使い方:
  AIRTABLE_TOKEN=... python3 scripts/db/venue_crawl.py propose data/inbox/venues/*.json --execute
  AIRTABLE_TOKEN=... python3 scripts/db/venue_crawl.py apply --dry-run
  AIRTABLE_TOKEN=... python3 scripts/db/venue_crawl.py apply --execute
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request

BASE_ID = "appv8UbrUuRfoltL1"
API = "https://api.airtable.com/v0"
TABLE = "Venues"
NAME = "﻿Name"          # 先頭に BOM 付き（airtable-db-crawl メモ参照）
MARK = "[TJ巡回"
VERDICT_TO_TIER = {"載せる": "editorial", "載せない": "skip"}
TYPES = {"club", "bar", "livehouse", "record-shop", "cafe"}
# 「23時閉店」のような営業時間の記述を閉店と取り違えない。店そのものの閉店だけに当てる
CLOSED_RE = re.compile(r"(\d+日に閉店|閉店\*\*|\*\*.*閉店|は\d{4}年\d+月閉店)")


def call(method: str, path: str, payload: dict | None = None) -> dict:
    tok = os.environ.get("AIRTABLE_TOKEN")
    if not tok:
        sys.exit("AIRTABLE_TOKEN が未設定")
    req = urllib.request.Request(
        f"{API}/{BASE_ID}/{path}",
        data=json.dumps(payload).encode() if payload else None,
        method=method,
        headers={"Authorization": f"Bearer {tok}",
                 "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            if e.code == 429 and attempt < 2:
                time.sleep(30)
                continue
            sys.exit(f"HTTP {e.code} {path}: {body}")
    return {}


def fetch_all() -> list[dict]:
    recs, off = [], None
    while True:
        d = call("GET", f"{TABLE}?pageSize=100" + (f"&offset={off}" if off else ""))
        recs += d["records"]
        off = d.get("offset")
        if not off:
            return recs


def norm(s: str | None) -> str:
    return unicodedata.normalize("NFC", (s or "")).strip().lower()


def ig_handle(url: str | None) -> str:
    m = re.search(r"instagram\.com/([^/?#]+)", url or "")
    return norm(m.group(1)).rstrip("/") if m else ""


# ------------------------------------------------------------ propose

def render_card(v: dict, date: str) -> str:
    lines = [f"{MARK} {date}] 未反映",
             f"判断: {v.get('verdict', '保留')}",
             f"type: {v.get('type', '')}",
             f"features: {'; '.join(v.get('features') or [])}",
             f"status: {'closed' if CLOSED_RE.search(v.get('reason') or '') else 'open'}"]
    lines.append(f"area: {v.get('area', '')}")
    lines.append(f"genres: {'; '.join(v.get('genres') or [])}")
    for k in ("subtype", "hours", "charge", "address", "url"):
        if v.get(k):
            lines.append(f"{k}: {v[k]}")
    lines.append(f"理由: {v.get('reason', '')}")
    lines.append(f"出典: {' ; '.join(v.get('sources') or [])}")
    return "\n".join(lines)


def strip_card(notes: str) -> str:
    """notes から既存の提案票（先頭ブロック）を外し、残りを返す。"""
    if not notes.startswith(MARK):
        return notes
    rest = notes.split("\n\n", 1)
    return rest[1] if len(rest) == 2 else ""


def match_record(v: dict, by_ig: dict, by_id: dict, by_name: dict) -> list[dict]:
    h = ig_handle(v.get("instagram"))
    if h and h in by_ig:
        return by_ig[h]
    if v.get("tj_id") and v["tj_id"] in by_id:
        return by_id[v["tj_id"]]
    n = norm(v.get("name"))
    return by_name.get(n, [])


def cmd_propose(files: list[str], execute: bool) -> int:
    recs = fetch_all()
    by_ig, by_id, by_name = {}, {}, {}
    for r in recs:
        f = r["fields"]
        h = ig_handle(f.get("instagram"))
        if h:
            by_ig.setdefault(h, []).append(r)
        if f.get("venue_id"):
            by_id.setdefault(f["venue_id"], []).append(r)
        by_name.setdefault(norm(f.get(NAME)), []).append(r)

    updates, unmatched, multi = [], [], []
    seen = set()
    for path in files:
        d = json.load(open(path))
        date = d.get("date", "")
        for v in d["venues"]:
            hits = match_record(v, by_ig, by_id, by_name)
            if not hits:
                unmatched.append((path, v["name"]))
                continue
            if len(hits) > 1:
                multi.append((v["name"], [h["id"] for h in hits]))
            for r in hits:
                if r["id"] in seen:
                    continue
                seen.add(r["id"])
                old = r["fields"].get("notes") or ""
                card = render_card(v, date)
                body = strip_card(old)
                notes = card + ("\n\n" + body if body.strip() else "")
                updates.append({"id": r["id"], "fields": {"notes": notes}})
                print(f"  → {r['fields'].get(NAME)!s:40} {v.get('verdict')}  "
                      f"{'[実行]' if execute else '[dry-run]'}")

    print(f"\n提案票を書く: {len(updates)} 行 / 一致なし: {len(unmatched)} / 複数一致: {len(multi)}")
    for p, n in unmatched:
        print(f"  ✗ 一致なし: {n}  ({os.path.basename(p)})")
    for n, ids in multi:
        print(f"  ! 複数一致（重複行の疑い）: {n} → {ids}")
    if execute:
        for i in range(0, len(updates), 10):
            call("PATCH", TABLE, {"records": updates[i:i + 10], "typecast": True})
        print("✅ notes に提案票を書き込んだ")
    return 0


# ------------------------------------------------------------ apply

def parse_card(notes: str) -> dict | None:
    if not notes.startswith(MARK):
        return None
    block = notes.split("\n\n", 1)[0]
    lines = block.split("\n")
    head = lines[0]
    card = {"_head": head, "_applied": "反映済" in head}
    for ln in lines[1:]:
        if ":" in ln:
            k, val = ln.split(":", 1)
            card[k.strip()] = val.strip()
    return card


def cmd_apply(execute: bool) -> int:
    recs = fetch_all()
    today = time.strftime("%Y-%m-%d")
    updates, skipped, held, bad = [], 0, 0, []
    for r in recs:
        f = r["fields"]
        card = parse_card(f.get("notes") or "")
        if not card or card["_applied"]:
            continue
        # 判断は「coverage_tier のプルダウン」が優先（ユーザーが Airtable で変えた値）。
        # editorial / skip 以外（directory のまま）なら提案票の「判断:」を見る
        tier = (f.get("coverage_tier") or "").strip()
        if tier in ("editorial", "skip"):
            verdict = {"editorial": "載せる", "skip": "載せない"}[tier]
        else:
            verdict = card.get("判断", "保留")
        if verdict not in VERDICT_TO_TIER:
            held += 1
            continue
        patch = {"coverage_tier": VERDICT_TO_TIER[verdict]}
        t = card.get("type", "")
        if t:
            if t not in TYPES:
                bad.append((f.get(NAME), f"type={t}"))
                continue
            patch["venue_type"] = t
        feats = [x.strip() for x in card.get("features", "").split(";") if x.strip()]
        if feats:
            patch["features"] = feats
        st = card.get("status", "")
        if st in ("open", "closed"):
            patch["venue_status"] = st
        if card.get("url") and not f.get("official_url"):
            patch["official_url"] = card["url"]
        # 2026-08-23 追加列（CMS 入力用）。提案票に値があれば書く
        for k in ("area", "address", "subtype", "hours", "charge"):
            if card.get(k):
                patch[k] = card[k]
        genres = [x.strip() for x in card.get("genres", "").split(";") if x.strip()]
        if genres:
            patch["genres"] = genres
        # 提案票の1行目を反映済に
        notes = f["notes"]
        first, rest = notes.split("\n", 1)
        patch["notes"] = first.replace("未反映", f"反映済 {today}") + "\n" + rest
        updates.append({"id": r["id"], "fields": patch})
        shown = {k: v for k, v in patch.items() if k != "notes"}
        print(f"  → {f.get(NAME)!s:40} {shown}  {'[実行]' if execute else '[dry-run]'}")

    print(f"\n反映: {len(updates)} / 保留のまま: {held} / 不正な値: {len(bad)}")
    for n, why in bad:
        print(f"  ✗ {n}: {why}")
    if execute and updates:
        for i in range(0, len(updates), 10):
            call("PATCH", TABLE, {"records": updates[i:i + 10], "typecast": True})
        print("✅ 反映した")
    return 1 if bad else 0


def main() -> int:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("propose")
    a.add_argument("files", nargs="+")
    b = sub.add_parser("apply")
    for x in (a, b):
        g = x.add_mutually_exclusive_group()
        g.add_argument("--dry-run", action="store_true", default=True)
        g.add_argument("--execute", action="store_true")
    args = p.parse_args()
    if args.cmd == "propose":
        return cmd_propose(args.files, args.execute)
    return cmd_apply(args.execute)


if __name__ == "__main__":
    sys.exit(main())
