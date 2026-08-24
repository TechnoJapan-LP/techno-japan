#!/usr/bin/env python3
"""Airtable Editions と LP シート（サイト）の EDITIONS の二重管理を検出する。

■ 背景（2026-08-24 ユーザー決定）

  - サイトに載っている国内フェスの開催回は LP シートの EDITIONS だけが正。
  - Airtable の Editions は海外フェス（source_tab=Festival(W)）専用。
  - 国内フェス 95 件は両方の DB に「フェスとして」存在するため、Airtable 側に
    開催回を作ると二重管理になる。EDITIONS の重複は過去に Publish を
    丸1日止めた（AUDIT §9-66）。

■ 検査内容

  1) Airtable Editions の edition_id から末尾の年を外した festival 部分が、
     LP/data.js の FESTIVALS の id と重なっていないか（重なり＝二重管理の芽）
  2) Airtable Editions の edition_id に重複が無いか
  3) edition_id が {festival}-{年} の形になっているか

使い方:
  AIRTABLE_TOKEN=... python3 scripts/db/check_edition_overlap.py
  （巡回のついでに実行。preflight には入れない＝Airtable 障害でデプロイを止めない）
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

BASE_ID = "appv8UbrUuRfoltL1"
EID = "﻿edition_id"          # 先頭に BOM 付き


def get(url: str) -> dict:
    tok = os.environ.get("AIRTABLE_TOKEN")
    if not tok:
        sys.exit("AIRTABLE_TOKEN が未設定")
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tok}"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def main() -> int:
    # LP 側のフェス ID
    src = open("LP/data.js", encoding="utf-8").read()
    m = re.search(r"const FESTIVALS = (\[.*?\n\]);", src, re.S)
    if not m:
        sys.exit("LP/data.js に FESTIVALS が見つからない")
    lp_ids = set(re.findall(r'\bid:\s*"([a-z0-9-]+)"', m.group(1)))

    # Airtable Editions
    recs, off = [], None
    while True:
        d = get(f"https://api.airtable.com/v0/{BASE_ID}/Editions?pageSize=100"
                + (f"&offset={off}" if off else ""))
        recs += d["records"]
        off = d.get("offset")
        if not off:
            break

    bad_form, seen, dups, overlap = [], {}, [], []
    for r in recs:
        eid = r["fields"].get(EID)
        if not eid:
            bad_form.append(f"(空) {r['id']}")
            continue
        mm = re.fullmatch(r"([a-z0-9-]+)-(\d{4})", eid)
        if not mm:
            bad_form.append(eid)
            continue
        fest = mm.group(1)
        if eid in seen:
            dups.append(eid)
        seen[eid] = True
        if fest in lp_ids:
            overlap.append(eid)

    print(f"LP フェス {len(lp_ids)} 件 / Airtable Editions {len(recs)} 行")
    ok = True
    if overlap:
        ok = False
        print(f"\n✗ 二重管理の芽: サイト掲載フェスの開催回が Airtable Editions にある（{len(overlap)}件）")
        print("  → 国内フェスの開催回は LP シートの EDITIONS だけが正。Airtable 側の行は削除するか、")
        print("    海外フェスと同名の別フェスでないか確認する")
        for e in sorted(overlap):
            print(f"    {e}")
    if dups:
        ok = False
        print(f"\n✗ edition_id の重複（{len(dups)}件）: {sorted(set(dups))[:10]}")
    if bad_form:
        ok = False
        print(f"\n✗ 形式が {{festival}}-{{年}} でない（{len(bad_form)}件）: {bad_form[:10]}")
    if ok:
        print("✅ 問題なし（重なり 0 / 重複 0 / 形式エラー 0）")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
