#!/usr/bin/env python3
"""Airtable Venues の未現地確認行を CMS クイック追加用 TSV に変換する。

対象は coverage_tier=editorial かつ on_site が空欄の行。
IMAGE / DESC / DESC_EN は出力せず、CMSで人が入力する。

使い方:
  python3 scripts/db/venue_export_cms.py --dry-run > venues.tsv
  python3 scripts/db/venue_export_cms.py --output venues.tsv

このスクリプトは Airtable を読み取るだけで、書き込みは行わない。
--dry-run は既定で、明示しても同じ読み取り専用動作になる。
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable


BASE_ID = "appv8UbrUuRfoltL1"
API = "https://api.airtable.com/v0"
TABLE = "Venues"
ROOT = Path(__file__).resolve().parents[2]
TOKEN_FILE = ROOT / "data/migration/.airtable_token"
NAME = "﻿Name"  # venue_crawl.py と同じ。先頭 BOM 付きの Airtable 列名。

OUTPUT_COLUMNS = [
    "ID", "NAME", "CITY", "AREA", "TYPE", "ADDRESS", "URL",
    "INSTAGRAM", "GENRE", "SUBTYPE", "HOURS", "CHARGE", "FEATURES",
]

SOURCE_FIELDS = {
    "ID": "venue_id",
    "NAME": NAME,
    "CITY": "city",
    "AREA": "area",
    "TYPE": "venue_type",
    "ADDRESS": "address",
    "URL": "official_url",
    "INSTAGRAM": "instagram",
    "GENRE": "genres",
    "SUBTYPE": "subtype",
    "HOURS": "hours",
    "CHARGE": "charge",
    "FEATURES": "features",
}


def token() -> str:
    env = os.environ.get("AIRTABLE_TOKEN", "").strip()
    if env:
        return env
    try:
        value = TOKEN_FILE.read_text(encoding="utf-8-sig").strip()
    except FileNotFoundError:
        value = ""
    if not value:
        raise SystemExit(
            f"Airtableトークンがありません: {TOKEN_FILE} "
            "（または AIRTABLE_TOKEN を設定）"
        )
    return value


def call(method: str, path: str, payload: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"{API}/{BASE_ID}/{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
        },
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            body = error.read().decode(errors="replace")[:300]
            if error.code == 429 and attempt < 2:
                time.sleep(1.2 * (attempt + 1))
                continue
            raise SystemExit(f"Airtable API エラー {error.code}: {body}")
    raise SystemExit("Airtable API の再試行に失敗しました")


def fetch_all(request: Callable[[str, str], dict] = call) -> list[dict]:
    records: list[dict] = []
    offset = ""
    while True:
        path = f"{TABLE}?pageSize=100"
        if offset:
            path += f"&offset={urllib.parse.quote(offset)}"
        data = request("GET", path)
        records.extend(data.get("records", []))
        offset = data.get("offset", "")
        if not offset:
            return records


def text(value: object) -> str:
    """Airtableの単一値・選択肢・配列をTSVセルへ変換する。"""
    if value is None:
        return ""
    if isinstance(value, list):
        values = []
        for item in value:
            if isinstance(item, dict):
                item = item.get("name", item.get("id", ""))
            if str(item).strip():
                values.append(str(item).strip())
        return "; ".join(values)
    if isinstance(value, dict):
        return str(value.get("name", value.get("value", ""))).strip()
    return str(value).replace("\r", " ").replace("\n", " ").replace("\t", " ").strip()


def is_empty(value: object) -> bool:
    return not text(value)


def eligible(records: list[dict]) -> list[dict]:
    rows = []
    for record in records:
        fields = record.get("fields", {})
        if text(fields.get("coverage_tier")).lower() == "editorial" and is_empty(fields.get("on_site")):
            rows.append(record)
    return sorted(rows, key=lambda r: (text(r.get("fields", {}).get(NAME)).casefold(), r.get("id", "")))


def cells(record: dict) -> list[str]:
    fields = record.get("fields", {})
    return [text(fields.get(SOURCE_FIELDS[column])) for column in OUTPUT_COLUMNS]


def render_tsv(records: list[dict]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, delimiter="\t", lineterminator="\n")
    writer.writerow(OUTPUT_COLUMNS)
    writer.writerows(cells(record) for record in records)
    return out.getvalue()


def report(records: list[dict], stream: io.TextIOBase | None = None) -> None:
    stream = stream or sys.stderr
    missing = {column: 0 for column in OUTPUT_COLUMNS}
    for record in records:
        for column, value in zip(OUTPUT_COLUMNS, cells(record)):
            if not value:
                missing[column] += 1
    dropped = ", ".join(f"{column} {count}件" for column, count in missing.items() if count)
    print(f"対象: {len(records)}件（coverage_tier=editorial かつ on_site空欄）", file=stream)
    print(f"出力列: {' '.join(OUTPUT_COLUMNS)}", file=stream)
    print(f"列落ち: {dropped or 'なし'}", file=stream)
    print("IMAGE / DESC / DESC_EN: 空欄（CMSで入力）", file=stream)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="読み取り専用（既定。指定しても動作は変わらない）")
    parser.add_argument("--output", type=Path, help="TSVの出力先。省略時は標準出力")
    args = parser.parse_args(argv)

    selected = eligible(fetch_all())
    report(selected)
    tsv = render_tsv(selected)
    if args.output:
        args.output.write_text(tsv, encoding="utf-8")
        print(f"TSV: {args.output}（{len(selected)}件）", file=sys.stderr)
    else:
        sys.stdout.write(tsv)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
