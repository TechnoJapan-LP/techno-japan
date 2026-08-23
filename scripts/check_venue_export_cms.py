#!/usr/bin/env python3
"""venue_export_cms.py の Airtable条件・列順・列落ち表示を検査する。"""
from __future__ import annotations

import contextlib
import importlib.util
import io
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "scripts/db/venue_export_cms.py"
spec = importlib.util.spec_from_file_location("venue_export_cms", path)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

records = [
    {"id": "rec1", "fields": {
        "coverage_tier": "editorial", "on_site": "",
        "venue_id": "shibuya-bar", module.NAME: "Shibuya Bar", "city": "Tokyo",
        "venue_type": "bar", "genres": ["HOUSE", "TECHNO"],
        "features": ["after-hours", "cash-only"],
    }},
    {"id": "rec2", "fields": {
        "coverage_tier": "editorial", "on_site": "checked",
        "venue_id": "done", module.NAME: "Done Venue",
    }},
    {"id": "rec3", "fields": {
        "coverage_tier": "draft", "on_site": "",
        "venue_id": "draft", module.NAME: "Draft Venue",
    }},
]

selected = module.eligible(records)
assert len(selected) == 1 and selected[0]["id"] == "rec1"
assert module.OUTPUT_COLUMNS == [
    "ID", "NAME", "CITY", "AREA", "TYPE", "ADDRESS", "URL",
    "INSTAGRAM", "GENRE", "SUBTYPE", "HOURS", "CHARGE", "FEATURES",
]
tsv = module.render_tsv(selected)
lines = tsv.splitlines()
assert lines[0].split("\t") == module.OUTPUT_COLUMNS
assert lines[1].split("\t")[0:3] == ["shibuya-bar", "Shibuya Bar", "Tokyo"]
assert lines[1].split("\t")[8] == "HOUSE; TECHNO"
assert lines[1].split("\t")[12] == "after-hours; cash-only"

err = io.StringIO()
with contextlib.redirect_stderr(err):
    module.report(selected)
assert "対象: 1件" in err.getvalue()
assert "列落ち: AREA 1件" in err.getvalue()
assert "IMAGE / DESC / DESC_EN: 空欄" in err.getvalue()
print("✅ Airtable条件・TSV列順・配列整形・列落ち表示")
