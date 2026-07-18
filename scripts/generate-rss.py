#!/usr/bin/env python3
"""Generate RSS feed (rss.xml) from data.js.

Includes upcoming festivals and articles (if any).
Output: LP/rss.xml
"""
import os
import re
import sys
from datetime import datetime, date
from email.utils import format_datetime

BASE_URL = "https://techno-japan.media"
LP_DIR = os.path.join(os.path.dirname(__file__), "..", "LP")
OUT_PATH = os.path.join(LP_DIR, "rss.xml")
DATA_PATH = os.path.join(LP_DIR, "data.js")

SITE_TITLE = "TECHNO JAPAN"
SITE_DESC = "Japan's underground techno and house music media platform."


def parse_block(block):
    """Pull out common fields from a JS object literal block."""
    out = {}
    for key in ("id", "name", "title", "date", "city", "venue", "image",
                "desc", "description", "publishedAt", "publishAt", "category"):
        m = re.search(rf'{key}:\s*["\']([^"\']*)["\']', block)
        if m:
            out[key] = m.group(1)
    return out


def extract_blocks(data, var_name):
    pattern = re.compile(rf'const\s+{var_name}\s*=\s*\[(.*?)\];', re.DOTALL)
    m = pattern.search(data)
    if not m:
        return []
    body = m.group(1)
    # Match top-level objects (handles single-level nesting)
    blocks = []
    depth = 0
    start = None
    for i, c in enumerate(body):
        if c == '{':
            if depth == 0:
                start = i
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0 and start is not None:
                blocks.append(body[start:i + 1])
                start = None
    return blocks


def parse_festival_date(s):
    """Parse "2026-05-15" or "2026-05-15/2026-05-17" → date object (start)."""
    if not s:
        return None
    start = s.split("/")[0].strip()
    try:
        return datetime.strptime(start, "%Y-%m-%d").date()
    except ValueError:
        return None


def to_rfc822(d):
    if isinstance(d, date) and not isinstance(d, datetime):
        d = datetime.combine(d, datetime.min.time())
    return format_datetime(d)


def escape_xml(s):
    if not s:
        return ""
    return (s.replace("&", "&amp;")
             .replace("<", "&lt;")
             .replace(">", "&gt;")
             .replace('"', "&quot;")
             .replace("'", "&apos;"))


def main():
    with open(DATA_PATH, "r") as f:
        data = f.read()

    items = []

    # Festivals (upcoming or recent — sorted by date desc)
    festival_blocks = extract_blocks(data, "FESTIVALS")
    festivals = []
    for block in festival_blocks:
        f = parse_block(block)
        if not f.get("id") or not f.get("name"):
            continue
        d = parse_festival_date(f.get("date", ""))
        if d:
            festivals.append((d, f))
    festivals.sort(key=lambda x: x[0], reverse=True)

    # Take latest 30 festivals
    for d, f in festivals[:30]:
        title = f["name"]
        link = f"{BASE_URL}/festivals/{f['id']}.html"
        desc_text = f.get("desc") or f.get("description") or f"Festival on {d.isoformat()}"
        if f.get("city"):
            desc_text = f"{f['city']} — {desc_text}"
        items.append({
            "title": title,
            "link": link,
            "guid": link,
            "description": desc_text,
            "pubDate": to_rfc822(d),
            "category": "Festival",
        })

    # Articles (if any)
    article_blocks = extract_blocks(data, "ARTICLES")
    for block in article_blocks:
        a = parse_block(block)
        if not a.get("id") or not (a.get("title") or a.get("name")):
            continue
        title = a.get("title") or a.get("name")
        link = f"{BASE_URL}/articles/{a['id']}.html"
        pub_str = a.get("publishedAt") or a.get("publishAt")
        try:
            pub = datetime.fromisoformat(pub_str.replace("Z", "+00:00")) if pub_str else datetime.now()
        except (ValueError, AttributeError):
            pub = datetime.now()
        items.append({
            "title": title,
            "link": link,
            "guid": link,
            "description": a.get("desc") or a.get("description") or "",
            "pubDate": to_rfc822(pub),
            "category": a.get("category", "Article"),
        })

    # Build RSS
    now = to_rfc822(datetime.now())
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        f'    <title>{escape_xml(SITE_TITLE)}</title>',
        f'    <link>{BASE_URL}</link>',
        f'    <description>{escape_xml(SITE_DESC)}</description>',
        '    <language>ja-JP</language>',
        f'    <lastBuildDate>{now}</lastBuildDate>',
        f'    <atom:link href="{BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>',
    ]
    for it in items:
        lines.append('    <item>')
        lines.append(f'      <title>{escape_xml(it["title"])}</title>')
        lines.append(f'      <link>{it["link"]}</link>')
        lines.append(f'      <guid isPermaLink="true">{it["guid"]}</guid>')
        lines.append(f'      <pubDate>{it["pubDate"]}</pubDate>')
        lines.append(f'      <category>{escape_xml(it["category"])}</category>')
        lines.append(f'      <description>{escape_xml(it["description"])}</description>')
        lines.append('    </item>')
    lines.append('  </channel>')
    lines.append('</rss>')

    with open(OUT_PATH, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"✓ rss.xml generated: {len(items)} items")
    print(f"  → {OUT_PATH}")


if __name__ == "__main__":
    main()
