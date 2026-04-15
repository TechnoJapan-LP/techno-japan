#!/usr/bin/env python3
"""
Festival date updater for Techno Japan.

Commands:
    python3 update_festivals.py read       → dump spreadsheet as JSON
    python3 update_festivals.py search     → search for updated dates (dry-run)
    python3 update_festivals.py update     → search + apply changes
"""

import json
import re
import subprocess
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CREDENTIALS_FILE = SCRIPT_DIR / "techno-japan-493408-4b24cbadf5ec.json"
SPREADSHEET_ID = "1wHY_tf0JlASL11E0SxmsSM0yPMSZw17LIiiZ3LlXwn8"
DATA_JS_PATH = SCRIPT_DIR / "data.js"
LOG_FILE = SCRIPT_DIR / "update_festivals.log"

DATA_JS_FESTIVALS = {
    "rural":              "rural-festival",
    "labyrinth":          "labyrinth",
    "festival de frue":   "festival-de-frue",
    "rainbow disco club": "rainbow-disco-club",
    "fulirock":           "fuji-rock",
    "fujirock":           "fuji-rock",
    "fuji rock":          "fuji-rock",
}


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


# ── Google Sheets ───────────────────────────────────────────────────
def get_sheets_service():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_file(
        str(CREDENTIALS_FILE),
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return build("sheets", "v4", credentials=creds)


def read_spreadsheet():
    service = get_sheets_service()
    result = (
        service.spreadsheets().values()
        .get(spreadsheetId=SPREADSHEET_ID, range="A1:G500")
        .execute()
    )
    rows = result.get("values", [])
    festivals = []
    for i, row in enumerate(rows):
        if i == 0:
            continue
        row += [""] * (7 - len(row))
        festivals.append({
            "row": i + 1,
            "name": row[1].strip(),
            "location": row[2].strip(),
            "date": row[3].strip(),
            "url": row[4].strip(),
            "genre": row[5].strip(),
        })
    return festivals


# ── DuckDuckGo search ───────────────────────────────────────────────
def ddg_search(query):
    """Search DuckDuckGo and return HTML results page."""
    encoded = urllib.parse.quote(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/120.0.0.0 Safari/537.36",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        log(f"  Search error: {e}")
        return ""


def extract_dates_from_html(html, year):
    """Extract date-like patterns for the given year from HTML text."""
    patterns = [
        # Japanese: 2026年7月19日〜21日 / 2026年7月19日-21日
        rf"{year}年(\d{{1,2}})月(\d{{1,2}})日[〜~\-－―–](\d{{1,2}})月(\d{{1,2}})日",
        rf"{year}年(\d{{1,2}})月(\d{{1,2}})日[〜~\-－―–](\d{{1,2}})日",
        rf"{year}年(\d{{1,2}})月(\d{{1,2}})日",
        # Dot: 2026.07.19-21
        rf"{year}\.(\d{{2}})\.(\d{{2}})[〜~\-－―–](\d{{2}})\.(\d{{2}})",
        rf"{year}\.(\d{{2}})\.(\d{{2}})[〜~\-－―–](\d{{2}})",
        rf"{year}\.(\d{{2}})\.(\d{{2}})",
        # Slash: 2026/7/19-21
        rf"{year}/(\d{{1,2}})/(\d{{1,2}})[〜~\-－―–](\d{{1,2}})/(\d{{1,2}})",
        rf"{year}/(\d{{1,2}})/(\d{{1,2}})[〜~\-－―–](\d{{1,2}})",
        rf"{year}/(\d{{1,2}})/(\d{{1,2}})",
    ]
    results = []
    for pat in patterns:
        for m in re.finditer(pat, html):
            results.append(m.group(0))
    return results


def normalize_to_sheet_format(date_str, year):
    """Normalize any date string to spreadsheet format: YYYY.MM.DD-DD or YYYY.MM.DD-MM.DD."""
    # 2026年7月19日〜9月21日
    m = re.match(rf"{year}年(\d{{1,2}})月(\d{{1,2}})日[〜~\-－―–](\d{{1,2}})月(\d{{1,2}})日", date_str)
    if m:
        m1, d1, m2, d2 = m.groups()
        return f"{year}.{int(m1):02d}.{int(d1):02d}-{int(m2):02d}.{int(d2):02d}"

    # 2026年7月19日〜21日
    m = re.match(rf"{year}年(\d{{1,2}})月(\d{{1,2}})日[〜~\-－―–](\d{{1,2}})日", date_str)
    if m:
        mo, d1, d2 = m.groups()
        return f"{year}.{int(mo):02d}.{int(d1):02d}-{int(d2):02d}"

    # 2026年7月19日
    m = re.match(rf"{year}年(\d{{1,2}})月(\d{{1,2}})日", date_str)
    if m:
        mo, d = m.groups()
        return f"{year}.{int(mo):02d}.{int(d):02d}"

    # 2026.07.19-07.21
    m = re.match(rf"{year}\.(\d{{2}})\.(\d{{2}})[〜~\-－―–](\d{{2}})\.(\d{{2}})", date_str)
    if m:
        m1, d1, m2, d2 = m.groups()
        return f"{year}.{m1}.{d1}-{m2}.{d2}"

    # 2026.07.19-21
    m = re.match(rf"{year}\.(\d{{2}})\.(\d{{2}})[〜~\-－―–](\d{{2}})", date_str)
    if m:
        mo, d1, d2 = m.groups()
        return f"{year}.{mo}.{d1}-{d2}"

    # 2026.07.19
    m = re.match(rf"{year}\.(\d{{2}})\.(\d{{2}})", date_str)
    if m:
        mo, d = m.groups()
        return f"{year}.{mo}.{d}"

    # 2026/7/19-21
    m = re.match(rf"{year}/(\d{{1,2}})/(\d{{1,2}})[〜~\-－―–](\d{{1,2}})/(\d{{1,2}})", date_str)
    if m:
        m1, d1, m2, d2 = m.groups()
        return f"{year}.{int(m1):02d}.{int(d1):02d}-{int(m2):02d}.{int(d2):02d}"

    # 2026/7/19-21
    m = re.match(rf"{year}/(\d{{1,2}})/(\d{{1,2}})[〜~\-－―–](\d{{1,2}})", date_str)
    if m:
        mo, d1, d2 = m.groups()
        return f"{year}.{int(mo):02d}.{int(d1):02d}-{int(d2):02d}"

    # 2026/7/19
    m = re.match(rf"{year}/(\d{{1,2}})/(\d{{1,2}})", date_str)
    if m:
        mo, d = m.groups()
        return f"{year}.{int(mo):02d}.{int(d):02d}"

    return date_str


def search_festival_date(name, url, year):
    """Search for a festival's date for the given year."""
    # Try multiple search queries
    queries = [
        f"{name} {year} 開催日",
        f"{name} {year} 日程",
    ]

    all_dates = []
    for q in queries:
        html = ddg_search(q)
        if html:
            dates = extract_dates_from_html(html, year)
            all_dates.extend(dates)
        time.sleep(1.5)  # be polite

    if not all_dates:
        return None

    # Normalize and pick the most common one
    normalized = [normalize_to_sheet_format(d, year) for d in all_dates]
    if normalized:
        # Return the first occurrence (most likely the primary result)
        return normalized[0]
    return None


# ── data.js updater ─────────────────────────────────────────────────
def spreadsheet_date_to_iso(date_str):
    """Convert 2026.07.19-21 → 2026-07-19/2026-07-21."""
    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})-(\d{2})$", date_str)
    if m:
        y, mo, d1, d2 = m.groups()
        return f"{y}-{mo}-{d1}/{y}-{mo}-{d2}"

    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})$", date_str)
    if m:
        y, m1, d1, m2, d2 = m.groups()
        return f"{y}-{m1}-{d1}/{y}-{m2}-{d2}"

    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})$", date_str)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{mo}-{d}"

    return date_str.replace(".", "-")


def update_data_js(festival_id, new_date_iso):
    content = DATA_JS_PATH.read_text(encoding="utf-8")
    pattern = rf'(id:\s*"{re.escape(festival_id)}".*?date:\s*")([^"]+)(")'
    match = re.search(pattern, content, re.DOTALL)
    if match and match.group(2) != new_date_iso:
        new_content = content[:match.start(2)] + new_date_iso + content[match.end(2):]
        DATA_JS_PATH.write_text(new_content, encoding="utf-8")
        log(f"  data.js: {festival_id} → {new_date_iso}")
        return True
    return False


# ── Commands ────────────────────────────────────────────────────────
def cmd_read():
    festivals = read_spreadsheet()
    print(json.dumps(festivals, ensure_ascii=False, indent=2))


def cmd_search(apply=False):
    year = datetime.now().year
    log(f"=== Festival date check (year={year}, apply={apply}) ===")

    festivals = read_spreadsheet()
    log(f"Read {len(festivals)} festivals from spreadsheet")

    changes = []
    for fest in festivals:
        if not fest["name"]:
            continue

        log(f"Checking: {fest['name']}")
        new_date = search_festival_date(fest["name"], fest["url"], year)

        if new_date and new_date != fest["date"]:
            log(f"  CHANGE: {fest['date']} → {new_date}")
            changes.append({
                "row": fest["row"],
                "name": fest["name"],
                "old_date": fest["date"],
                "new_date": new_date,
            })
        elif new_date:
            log(f"  unchanged: {fest['date']}")
        else:
            log(f"  not found")

        time.sleep(1)  # rate limit

    log(f"\n=== {len(changes)} changes found ===")
    for c in changes:
        log(f"  {c['name']}: {c['old_date']} → {c['new_date']}")

    if not apply or not changes:
        if not apply:
            log("Dry run. Use 'update' to apply.")
        return

    # Apply changes
    service = get_sheets_service()
    data_js_changed = False

    for c in changes:
        # Update spreadsheet
        cell = f"D{c['row']}"
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=cell,
            valueInputOption="RAW",
            body={"values": [[c["new_date"]]]},
        ).execute()
        log(f"  Spreadsheet row {c['row']} updated")

        # Update data.js if applicable
        for key, js_id in DATA_JS_FESTIVALS.items():
            if key in c["name"].lower():
                iso_date = spreadsheet_date_to_iso(c["new_date"])
                if update_data_js(js_id, iso_date):
                    data_js_changed = True
                break

    if data_js_changed:
        subprocess.run(["git", "add", "data.js"], cwd=str(SCRIPT_DIR))
        subprocess.run(
            ["git", "commit", "-m",
             f"auto: update festival dates ({datetime.now().strftime('%Y-%m-%d')})"],
            cwd=str(SCRIPT_DIR),
        )
        subprocess.run(["git", "push"], cwd=str(SCRIPT_DIR))
        log("data.js committed and pushed.")

    log("=== Update complete ===")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "read":
        cmd_read()
    elif cmd == "search":
        cmd_search(apply=False)
    elif cmd == "update":
        cmd_search(apply=True)
    else:
        print("Usage: python3 update_festivals.py read|search|update")
        print("  read   — dump spreadsheet as JSON")
        print("  search — search for updated dates (dry-run)")
        print("  update — search + apply changes to spreadsheet & data.js")
        sys.exit(1)
