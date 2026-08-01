#!/usr/bin/env python3
"""
FESTIVALS の充足状況を調査してレポートを出す（読み取り専用）。

出力:
  reports/festivals-completeness.md          サマリ + 欠落ランキング
  reports/festivals-missing-<field>.csv      項目別の欠落一覧（情報収集用）

CSV には「その項目を埋めるために参照できる既存値」を同梱する。
例) LAT/LNG が空なら LOCATION と ADDRESS を並べる（会場名から座標を引くため）。
"""

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
LINEUPS = ROOT / "LP" / "data" / "lineups.json"
EDITIONS = ROOT / "LP" / "data" / "editions.json"

# 調査する項目。(キー, ラベル, その項目を埋めるときの手がかりになる列)
FIELDS = [
    ("DATE",       "開催日",       ["NAME", "LOCATION", "URL"]),
    ("LOCATION",   "会場名",       ["NAME", "CITY", "URL", "INSTAGRAM"]),
    ("ADDRESS",    "住所",         ["NAME", "LOCATION", "CITY", "URL"]),
    ("LAT",        "緯度",         ["NAME", "LOCATION", "ADDRESS", "CITY"]),
    ("LNG",        "経度",         ["NAME", "LOCATION", "ADDRESS", "CITY"]),
    ("IMAGE",      "メイン画像",   ["NAME", "FLYER", "URL", "INSTAGRAM"]),
    ("FLYER",      "フライヤー",   ["NAME", "IMAGE", "INSTAGRAM"]),
    ("DESC",       "説明(日本語)", ["NAME", "LOCATION", "CITY", "DESC_EN"]),
    ("DESC_EN",    "説明(英語)",   ["NAME", "LOCATION", "CITY", "DESC"]),
    ("URL",        "公式サイト",   ["NAME", "INSTAGRAM", "LOCATION"]),
    ("INSTAGRAM",  "Instagram",    ["NAME", "URL", "LOCATION"]),
    ("TICKETURL",  "チケットURL",  ["NAME", "URL", "DATE"]),
    ("GENRE",      "ジャンル",     ["NAME", "TYPE", "DESC"]),
]
LINEUP_LABEL = "ラインナップ"


def load_sheet():
    """公開CSVから FESTIVALS を読む。列はヘッダー名で引く（位置に依存しない）。"""
    import urllib.request

    base = ("https://docs.google.com/spreadsheets/d/e/2PACX-1vRjtTHfeFBadTxdKF2EGg43Mh"
            "_iPVlgnI9vMpuk429vB6boVSqkRaVa5UwaUl-Iku4RAPBCXYCFOLHB/pub"
            "?single=true&output=csv&gid=818164718")
    with urllib.request.urlopen(base) as r:
        text = r.read().decode("utf-8")
    rows = list(csv.reader(text.splitlines()))
    headers = [h.strip() for h in rows[0]]
    out = []
    for r in rows[1:]:
        d = {h: (r[i].strip() if i < len(r) else "") for i, h in enumerate(headers)}
        if d.get("ID"):
            out.append(d)
    return headers, out


def lineup_index():
    """FESTIVAL_ID -> ラインナップ行数 / ID解決済み行数。"""
    li = json.loads(LINEUPS.read_text(encoding="utf-8"))["items"]
    ed = {e["EDITION_ID"]: e["FESTIVAL_ID"]
          for e in json.loads(EDITIONS.read_text(encoding="utf-8"))["items"]}
    total, resolved = {}, {}
    for row in li:
        fid = ed.get(row.get("EDITION_ID", ""))
        if not fid:
            continue
        total[fid] = total.get(fid, 0) + 1
        ids = (row.get("ARTIST_IDS") or row.get("ARTIST_ID") or "").strip()
        if ids:
            resolved[fid] = resolved.get(fid, 0) + 1
    return total, resolved


def main():
    headers, rows = load_sheet()
    lu_total, lu_resolved = lineup_index()
    REPORTS.mkdir(exist_ok=True)

    missing = {k: [] for k, _, _ in FIELDS}
    missing["LINEUP"] = []
    per_fest = {}

    for r in rows:
        fid = r["ID"]
        gaps = []
        for key, label, _ in FIELDS:
            if not r.get(key, "").strip():
                missing[key].append(r)
                gaps.append(label)
        if lu_total.get(fid, 0) == 0:
            missing["LINEUP"].append(r)
            gaps.append(LINEUP_LABEL)
        per_fest[fid] = {"row": r, "gaps": gaps}

    # ---- 項目別CSV ----
    written = []
    for key, label, hints in FIELDS:
        recs = missing[key]
        if not recs:
            continue
        path = REPORTS / f"festivals-missing-{key.lower()}.csv"
        # CITY と DATE は常に付ける。全項目が空のフェスでも「どの都道府県の
        # いつのフェスか」だけは分かり、検索の取っかかりになるため。
        cols = ["ID", "NAME"] + [h for h in hints if h != "NAME"]
        for extra in ("CITY", "DATE"):
            if extra not in cols:
                cols.append(extra)
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(cols)
            for r in recs:
                w.writerow([r.get(c, "") for c in cols])
        written.append((path.name, label, len(recs)))

    if missing["LINEUP"]:
        path = REPORTS / "festivals-missing-lineup.csv"
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["ID", "NAME", "DATE", "LOCATION", "URL", "INSTAGRAM"])
            for r in missing["LINEUP"]:
                w.writerow([r.get(c, "") for c in
                            ["ID", "NAME", "DATE", "LOCATION", "URL", "INSTAGRAM"]])
        written.append((path.name, LINEUP_LABEL, len(missing["LINEUP"])))

    # ---- Markdown レポート ----
    n = len(rows)
    ranked = sorted(per_fest.items(), key=lambda kv: (-len(kv[1]["gaps"]), kv[0]))
    total_fields = len(FIELDS) + 1

    L = []
    L.append("# FESTIVALS 充足状況レポート")
    L.append("")
    L.append(f"> 生成: `scripts/audit_festivals_completeness.py`（読み取り専用）")
    L.append(f"> 対象: スプレッドシート「LP」FESTIVALS タブ **{n}件**")
    L.append(f"> 検査項目: {total_fields}（{', '.join(l for _, l, _ in FIELDS)}, {LINEUP_LABEL}）")
    L.append("")
    L.append("項目別の欠落一覧は `reports/festivals-missing-<項目>.csv` に出力している。")
    L.append("各CSVには、その項目を埋めるときに参照できる既存値を同梱した")
    L.append("（例: 座標が空なら会場名と住所を並べる）。")
    L.append("")
    L.append("## (a) 項目別の欠落件数")
    L.append("")
    L.append("| 項目 | 欠落 | 充足 | 充足率 | CSV |")
    L.append("|---|---:|---:|---:|---|")
    rows_sum = [(l, len(missing[k]), k) for k, l, _ in FIELDS]
    rows_sum.append((LINEUP_LABEL, len(missing["LINEUP"]), "LINEUP"))
    for label, cnt, key in sorted(rows_sum, key=lambda x: -x[1]):
        rate = (n - cnt) / n * 100
        csvname = f"festivals-missing-{key.lower()}.csv" if cnt else "—"
        L.append(f"| {label} | **{cnt}** | {n - cnt} | {rate:.0f}% | `{csvname}` |")
    L.append("")

    complete = [f for f, v in per_fest.items() if not v["gaps"]]
    L.append(f"**全項目が埋まっているフェス: {len(complete)}件**"
             + (f" — {', '.join(sorted(complete))}" if complete else ""))
    L.append("")
    avg = sum(len(v["gaps"]) for v in per_fest.values()) / n
    L.append(f"1フェスあたりの平均欠落数: **{avg:.1f} / {total_fields}項目**")
    L.append("")

    L.append("## (b) 欠落数の多い順（上位20件）")
    L.append("")
    L.append("| # | ID | NAME | 欠落数 | 欠落項目 |")
    L.append("|---:|---|---|---:|---|")
    for i, (fid, v) in enumerate(ranked[:20], 1):
        nm = v["row"].get("NAME", "")
        L.append(f"| {i} | `{fid}` | {nm} | **{len(v['gaps'])}** | {' / '.join(v['gaps'])} |")
    L.append("")

    L.append("## (c) 項目別CSV")
    L.append("")
    L.append("| ファイル | 項目 | 件数 |")
    L.append("|---|---|---:|")
    for name, label, cnt in sorted(written, key=lambda x: -x[2]):
        L.append(f"| `{name}` | {label} | {cnt} |")
    L.append("")

    # ラインナップは解決状況も出す
    L.append("### ラインナップの内訳")
    L.append("")
    L.append("| 状態 | 件数 |")
    L.append("|---|---:|")
    has_rows = [r["ID"] for r in rows if lu_total.get(r["ID"], 0) > 0]
    has_resolved = [f for f in has_rows if lu_resolved.get(f, 0) > 0]
    L.append(f"| ラインナップ行あり | {len(has_rows)} |")
    L.append(f"| うち ARTIST_ID 解決済みの行を持つ | {len(has_resolved)} |")
    L.append(f"| 行はあるが全行未解決 | {len(has_rows) - len(has_resolved)} |")
    L.append(f"| 行なし | {n - len(has_rows)} |")
    L.append("")

    (REPORTS / "festivals-completeness.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    print(f"レポート: reports/festivals-completeness.md")
    for name, label, cnt in sorted(written, key=lambda x: -x[2]):
        print(f"  reports/{name}  ({label} {cnt}件)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
