#!/usr/bin/env python3
"""TECHNO JAPAN DB（Airtable）の承認制更新パイプライン。

■ 何をするものか

  1) apply     : Updates Inbox で review_status=approved の提案を本体へ反映し、
                 反映済みの行を applied に更新する（承認なしには何も書かない）
  2) fix-dates : Festivals の last_date_start / last_date_end が
                 取り込み時に「選択肢型」になってしまった問題を直す。
                 日付型の新列を作成 → 値をコピー → 旧列を *_legacy に改名 →
                 新列を正式名に改名（API は型変更を許さないため、この手順しかない）

■ 設計の約束（AUDIT §9-92〜）

  - AIも人も、承認（approved）していない変更は本体に書かない
  - 対象の特定は名前ではなく **festival_id / レコードID**（同名フェスが
    実在した: Unsound Festival が日本とポーランドの2レコード）
  - --dry-run が既定。書き込みは --execute を明示したときだけ
  - 変更は1件ずつ内容を印字する（静かな失敗を作らない）

使い方:
  AIRTABLE_TOKEN=... python3 scripts/db/airtable_pipeline.py apply --dry-run
  AIRTABLE_TOKEN=... python3 scripts/db/airtable_pipeline.py apply --execute
  AIRTABLE_TOKEN=... python3 scripts/db/airtable_pipeline.py fix-dates --execute
  AIRTABLE_TOKEN=... python3 scripts/db/airtable_pipeline.py sync-site --input /tmp/site-festivals.json --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
import unicodedata

BASE_ID = "appv8UbrUuRfoltL1"          # TECHNO JAPAN DB
API = "https://api.airtable.com/v0"

# field_name（Inbox）→ 本体のどの列に書くか
FIELD_MAP = {
    "brand_status": "brand_status",
    "last_date": ("last_date_start", "last_date_end"),
    "official_url": "official_url",
    "instagram": "instagram",
    "venue_status": "venue_status",
    # 2026-08-23 追加: 巡回で見つかる国・地域の空欄/誤記を、notes の「提案」でなく
    # 他の項目と同じ Inbox → 承認 → apply の経路で直せるようにする
    "country": "country",
    "city_region": "city_region",
    # 2026-08-23 追加: 公式のチケット案内ページ（年で変わらない URL を優先）
    "ticket_url": "ticket_url",
}


def token() -> str:
    t = os.environ.get("AIRTABLE_TOKEN", "").strip()
    if not t:
        sys.exit("AIRTABLE_TOKEN が未設定です（GitHub Secrets / 環境変数）")
    return t


def call(method: str, path: str, payload: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Authorization": f"Bearer {token()}",
                 "Content-Type": "application/json"},
        method=method,
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:300]
            if e.code == 429:                     # レート制限は待って再試行
                time.sleep(1.2 * (attempt + 1))
                continue
            sys.exit(f"Airtable API エラー {e.code}: {method} {path}\n  {body}")
    sys.exit("レート制限が解消しませんでした")


def list_all(table: str, **params) -> list[dict]:
    out, offset = [], None
    while True:
        q = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items())
        if offset:
            q += f"&offset={offset}"
        d = call("GET", f"/{BASE_ID}/{urllib.parse.quote(table)}?{q}")
        out += d.get("records", [])
        offset = d.get("offset")
        if not offset:
            return out


def schema() -> dict:
    return call("GET", f"/meta/bases/{BASE_ID}/tables")


def parse_date_value(raw: str) -> tuple[str | None, str | None]:
    """'2026-03-21' / '2026-10-02〜2026-10-11' → (start, end)。不明は (None, None)。"""
    s = raw.strip().replace("～", "〜")
    m = re.match(r"^(\d{4}-\d{2}-\d{2})\s*[〜\-–]\s*(\d{4}-\d{2}-\d{2})$", s)
    if m:
        return m.group(1), m.group(2)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})$", s)
    if m:
        return m.group(1), m.group(1)
    return None, None


# ---------------------------------------------------------------- apply
def cmd_apply(execute: bool) -> int:
    inbox = list_all("Updates Inbox")
    approved = [r for r in inbox
                if r["fields"].get("review_status") == "approved"]
    print(f"Inbox {len(inbox)}件中、approved は {len(approved)}件")
    if not approved:
        print("反映するものはありません")
        return 0

    fests = {r["id"]: r for r in list_all("Festivals")}
    failures = 0
    for r in approved:
        f = r["fields"]
        label = f.get("proposal", r["id"])[:60]
        links = f.get("target_festival") or []
        if len(links) != 1:
            print(f"  ✗ スキップ: リンクが{len(links)}件 — {label}")
            failures += 1
            continue
        target = fests.get(links[0])
        if not target:
            print(f"  ✗ スキップ: リンク先が見つからない — {label}")
            failures += 1
            continue
        mapping = FIELD_MAP.get(f.get("field_name", ""))
        if not mapping:
            print(f"  ✗ スキップ: 未対応の field_name={f.get('field_name')} — {label}")
            failures += 1
            continue

        if isinstance(mapping, tuple):                       # last_date
            start, end = parse_date_value(f.get("proposed_value", ""))
            if not start:
                print(f"  ✗ スキップ: 日付を解釈できない "
                      f"'{f.get('proposed_value')}' — {label}")
                failures += 1
                continue
            patch = {mapping[0]: start, mapping[1]: end}
        else:
            patch = {mapping: f.get("proposed_value", "").strip()}

        tid = target["fields"].get("festival_id", "?")
        print(f"  → {tid}: {patch}  {'[実行]' if execute else '[dry-run]'}")
        if execute:
            # typecast: 選択肢型に新しい値が来たら選択肢を自動作成する
            call("PATCH", f"/{BASE_ID}/Festivals",
                 {"records": [{"id": target["id"], "fields": patch}],
                  "typecast": True})
            call("PATCH", f"/{BASE_ID}/Updates%20Inbox",
                 {"records": [{"id": r["id"],
                               "fields": {"review_status": "applied"}}],
                  "typecast": True})
            print(f"     ✅ 反映し、Inbox を applied に更新")
    return failures


# ------------------------------------------------------------ fix-dates
def cmd_fix_dates(execute: bool) -> int:
    meta = schema()
    fest = next(t for t in meta["tables"] if t["name"] == "Festivals")
    fields = {f["name"]: f for f in fest["fields"]}
    todo = [n for n in ("last_date_start", "last_date_end")
            if fields.get(n, {}).get("type") == "singleSelect"]
    if not todo:
        print("✅ 日付列はすでに日付型です（作業不要）")
        return 0
    print(f"選択肢型のままの日付列: {todo}")
    if not execute:
        for name in todo:
            print(f"  [dry-run] {name}: 日付型の新列を作成 → 値コピー → 改名")
        return 0

    records = list_all("Festivals")
    for name in todo:
        tmp = f"{name}__new"
        if tmp not in fields:
            call("POST", f"/meta/bases/{BASE_ID}/tables/{fest['id']}/fields",
                 {"name": tmp, "type": "date",
                  "options": {"dateFormat": {"name": "iso"}}})
            print(f"  作成: {tmp}（日付型）")
        # 値のコピー（10件ずつ = API 上限）
        pending, copied, bad = [], 0, []
        for r in records:
            raw = r["fields"].get(name)
            if not raw:
                continue
            # 形だけでなく「実在する日付か」まで検証する。
            # 移行データに "2026-00-01"（0月）が実在し、形式チェックだけでは
            # Airtable 側で INVALID_VALUE_FOR_COLUMN になった（CI実測）
            try:
                import datetime
                datetime.date.fromisoformat(str(raw))
            except ValueError:
                bad.append((r["fields"].get("festival_id", r["id"]), str(raw)))
                continue
            pending.append({"id": r["id"], "fields": {tmp: raw}})
        for i in range(0, len(pending), 10):
            call("PATCH", f"/{BASE_ID}/Festivals",
                 {"records": pending[i:i + 10]})
            copied += len(pending[i:i + 10])
            time.sleep(0.25)                                  # 5req/s 制限
        print(f"  コピー: {copied}件（不正な日付でスキップ {len(bad)}件）")
        for fid, raw in bad:
            print(f"    ⚠️ {fid}: '{raw}' — needs_review として残置。元値は select 側にあり")
        # 改名: 旧 → legacy、新 → 正式名
        call("PATCH",
             f"/meta/bases/{BASE_ID}/tables/{fest['id']}/fields/{fields[name]['id']}",
             {"name": f"{name}_legacy"})
        fest2 = next(t for t in schema()["tables"] if t["name"] == "Festivals")
        new_id = next(f["id"] for f in fest2["fields"] if f["name"] == tmp)
        call("PATCH",
             f"/meta/bases/{BASE_ID}/tables/{fest['id']}/fields/{new_id}",
             {"name": name})
        print(f"  改名: {name} → {name}_legacy / {tmp} → {name}")
    print("✅ 完了。_legacy 列は確認後に Airtable 上で削除してください")
    return 0


# ------------------------------------------------------------ sync-site
def normalized_name(value: object) -> str:
    return unicodedata.normalize("NFC", str(value or "")).casefold()


def cmd_sync_site(input_path: str, execute: bool) -> int:
    with open(input_path, encoding="utf-8") as fh:
        site_festivals = json.load(fh)
    if not isinstance(site_festivals, list):
        sys.exit("sync-site の入力は配列JSONである必要があります")

    meta = schema()
    festivals_table = next(t for t in meta["tables"] if t["name"] == "Festivals")
    table_fields = festivals_table["fields"]
    field_names = {field["name"] for field in table_fields}
    print(f"Festivalsのフィールド: {', '.join(sorted(field_names))}")
    primary_field_id = festivals_table.get("primaryFieldId")
    name_field = next((field["name"] for field in table_fields
                       if field["id"] == primary_field_id), None)
    if not name_field:
        sys.exit("Festivals の primaryFieldId に対応する名前フィールドが見つかりません")
    # 2026-09-11、名前列を Name と決め打ちして422 UNKNOWN_FIELD_NAMEになった。

    required_fields = {"festival_id", "country", "city", "official_url",
                       "brand_status", "last_date_start", "last_date_end", name_field}
    missing_fields = sorted(required_fields - field_names)
    site_managed_missing = "site_managed" not in field_names
    if missing_fields:
        print(f"存在しないフィールド: {', '.join(missing_fields)}")
        sys.exit(1)

    records = list_all("Festivals")
    by_id = {}
    by_name = {}
    for record in records:
        fields = record.get("fields", {})
        festival_id = str(fields.get("festival_id", "")).strip()
        if festival_id:
            by_id[festival_id] = record
        name = normalized_name(fields.get(name_field, ""))
        if name:
            by_name.setdefault(name, []).append(record)

    if site_managed_missing:
        print("site_managed: checkbox 型フィールドの作成が必要")
        if execute:
            call("POST", f"/meta/bases/{BASE_ID}/tables/{festivals_table['id']}/fields",
                 {"name": "site_managed", "type": "checkbox",
                  "options": {"icon": "check", "color": "greenBright"}})
            print("site_managed: 作成")

    creates = []
    updates = []
    unchanged = 0
    same_name_skips = 0
    status_map = {"active": "active", "ended": "inactive", "inactive": "inactive"}
    for item in site_festivals:
        festival_id = str(item.get("festival_id", "")).strip()
        if not festival_id:
            print("  ⚠️ festival_id が空の入力をスキップ")
            continue
        name_value = str(item.get("name", ""))
        fields = {"festival_id": festival_id, "country": "JP", "site_managed": True}
        if name_value:
            fields[name_field] = name_value
        for name in ("city", "official_url", "last_date_start", "last_date_end"):
            value = str(item.get(name, ""))
            if value:
                fields[name] = value
        status = str(item.get("status", "")).strip().lower()
        if status in status_map:
            fields["brand_status"] = status_map[status]

        existing = by_id.get(festival_id)
        if not existing:
            same_name = by_name.get(normalized_name(name_value), [])
            if same_name:
                print(f"  ⚠️ {festival_id}: 同名レコードがあるためスキップ（ID不一致）")
                same_name_skips += 1
                continue
            creates.append(fields)
            for name, value in fields.items():
                print(f"  {festival_id}: {name} （空→{value}） {'[実行]' if execute else '[dry-run]'}")
            continue

        changed = {}
        old_fields = existing.get("fields", {})
        for name, value in fields.items():
            if old_fields.get(name) != value:
                changed[name] = value
                print(f"  {festival_id}: {name} {old_fields.get(name, '')}→{value} "
                      f"{'[実行]' if execute else '[dry-run]'}")
        if changed:
            updates.append({"id": existing["id"], "fields": changed, "festival_id": festival_id})
        else:
            unchanged += 1

    if execute:
        for i in range(0, len(creates), 10):
            batch = creates[i:i + 10]
            call("POST", f"/{BASE_ID}/Festivals",
                 {"records": [{"fields": fields} for fields in batch], "typecast": True})
            time.sleep(0.25)
        for i in range(0, len(updates), 10):
            batch = updates[i:i + 10]
            call("PATCH", f"/{BASE_ID}/Festivals",
                 {"records": [{"id": row["id"], "fields": row["fields"]} for row in batch],
                  "typecast": True})
            time.sleep(0.25)

    print(f"作成 {len(creates)} / 更新 {len(updates)} / 変更なし {unchanged} / 同名スキップ {same_name_skips}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("task", choices=["apply", "fix-dates", "sync-site"])
    p.add_argument("--input", help="sync-site の入力JSON")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--dry-run", action="store_true", default=True)
    g.add_argument("--execute", action="store_true")
    a = p.parse_args()
    execute = bool(a.execute)
    print(f"=== {a.task} {'（本実行）' if execute else '（dry-run・書き込みなし）'} ===")
    if a.task == "apply":
        return cmd_apply(execute)
    if a.task == "fix-dates":
        return cmd_fix_dates(execute)
    if not a.input:
        p.error("sync-site には --input が必要です")
    return cmd_sync_site(a.input, execute)


if __name__ == "__main__":
    sys.exit(main())
