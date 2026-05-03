#!/usr/bin/env python3
"""Generate sitemap.xml from data.js.

Usage: python3 scripts/generate-sitemap.py
Output: LP/sitemap.xml
"""
import os
import re
import sys
from datetime import date

BASE_URL = "https://techno-japan.media"
LP_DIR = os.path.join(os.path.dirname(__file__), "..", "LP")
OUT_PATH = os.path.join(LP_DIR, "sitemap.xml")
DATA_PATH = os.path.join(LP_DIR, "data.js")

STATIC_PAGES = [
    {"path": "/", "priority": "1.0", "changefreq": "daily"},
    {"path": "/festivals.html", "priority": "0.9", "changefreq": "daily"},
    {"path": "/artists.html", "priority": "0.8", "changefreq": "weekly"},
    {"path": "/venues.html", "priority": "0.8", "changefreq": "weekly"},
    {"path": "/news.html", "priority": "0.9", "changefreq": "daily"},
    {"path": "/about.html", "priority": "0.5", "changefreq": "monthly"},
]


def extract_ids(data, var_name):
    """Extract IDs from a JS array. Naive regex but works for our data shape."""
    pattern = re.compile(
        rf'const\s+{var_name}\s*=\s*\[(.*?)\];',
        re.DOTALL
    )
    m = pattern.search(data)
    if not m:
        return []
    body = m.group(1)
    # Extract id: "..." occurrences
    return re.findall(r'id:\s*["\']([^"\']+)["\']', body)


def is_valid_venue_block(block):
    """Check that a venue has both name and a real city."""
    name = re.search(r'name:\s*["\']([^"\']*)["\']', block)
    city = re.search(r'city:\s*["\']([^"\']*)["\']', block)
    return bool(name and name.group(1) and city and city.group(1) and city.group(1) != 'undefined')


def extract_venue_ids(data):
    """Extract venue IDs but skip venues with empty/undefined city."""
    pattern = re.compile(r'const\s+VENUES\s*=\s*\[(.*?)\];', re.DOTALL)
    m = pattern.search(data)
    if not m:
        return []
    body = m.group(1)
    # Split by closing brace+comma+open brace
    blocks = re.findall(r'\{[^{}]*\}', body)
    ids = []
    for block in blocks:
        if is_valid_venue_block(block):
            id_m = re.search(r'id:\s*["\']([^"\']+)["\']', block)
            if id_m:
                ids.append(id_m.group(1))
    return ids


def main():
    if not os.path.exists(DATA_PATH):
        print(f"ERROR: {DATA_PATH} not found", file=sys.stderr)
        sys.exit(1)

    with open(DATA_PATH, "r") as f:
        data = f.read()

    today = date.today().isoformat()
    urls = []

    for p in STATIC_PAGES:
        urls.append({
            "loc": BASE_URL + p["path"],
            "lastmod": today,
            "changefreq": p["changefreq"],
            "priority": p["priority"],
        })

    # Festivals
    festival_ids = extract_ids(data, "FESTIVALS")
    for fid in festival_ids:
        urls.append({
            "loc": f"{BASE_URL}/festivals.html#festival/{fid}",
            "lastmod": today,
            "changefreq": "weekly",
            "priority": "0.7",
        })

    # Artists
    artist_ids = extract_ids(data, "ARTISTS")
    for aid in artist_ids:
        urls.append({
            "loc": f"{BASE_URL}/artists.html#artist/{aid}",
            "lastmod": today,
            "changefreq": "monthly",
            "priority": "0.6",
        })

    # Venues (filtered)
    venue_ids = extract_venue_ids(data)
    for vid in venue_ids:
        urls.append({
            "loc": f"{BASE_URL}/venues.html#venue/{vid}",
            "lastmod": today,
            "changefreq": "monthly",
            "priority": "0.6",
        })

    # Articles (if defined)
    article_ids = extract_ids(data, "ARTICLES")
    for aid in article_ids:
        urls.append({
            "loc": f"{BASE_URL}/news.html#article/{aid}",
            "lastmod": today,
            "changefreq": "monthly",
            "priority": "0.7",
        })

    # Build XML
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        lines.append("  <url>")
        lines.append(f"    <loc>{u['loc']}</loc>")
        lines.append(f"    <lastmod>{u['lastmod']}</lastmod>")
        lines.append(f"    <changefreq>{u['changefreq']}</changefreq>")
        lines.append(f"    <priority>{u['priority']}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")

    with open(OUT_PATH, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"✓ sitemap.xml generated: {len(urls)} URLs")
    print(f"  Static: {len(STATIC_PAGES)}")
    print(f"  Festivals: {len(festival_ids)}")
    print(f"  Artists: {len(artist_ids)}")
    print(f"  Venues: {len(venue_ids)}")
    print(f"  Articles: {len(article_ids)}")
    print(f"  → {OUT_PATH}")


if __name__ == "__main__":
    main()
