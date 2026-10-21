#!/usr/bin/env python3
"""Generate sitemap.xml from data.js.

Usage: python3 scripts/generate-sitemap.py
Output: LP/sitemap.xml

Google News sitemap は古い記事を受け付けないため、追加出力は publication_date
が過去48時間以内の記事だけに限定する。
"""
import os
import re
import sys
import json
import subprocess
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote
from xml.sax.saxutils import escape

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
    {"path": "/submit.html", "priority": "0.5", "changefreq": "monthly"},
    {"path": "/writers.html", "priority": "0.5", "changefreq": "monthly"},
    {"path": "/en/submit.html", "priority": "0.5", "changefreq": "monthly"},
    {"path": "/en/writers.html", "priority": "0.5", "changefreq": "monthly"},
    # EN ハブは 2026-09-15 まで submit だけが収録され、入口となる6枚が
    # sitemap に申告されていなかった（EN詳細264件は収録済み）。
    {"path": "/en/index.html", "priority": "0.9", "changefreq": "daily"},
    {"path": "/en/festivals.html", "priority": "0.9", "changefreq": "daily"},
    {"path": "/en/artists.html", "priority": "0.8", "changefreq": "weekly"},
    {"path": "/en/venues.html", "priority": "0.8", "changefreq": "weekly"},
    {"path": "/en/news.html", "priority": "0.9", "changefreq": "daily"},
    {"path": "/en/about.html", "priority": "0.5", "changefreq": "monthly"},
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


def extract_article_blocks(data):
    pattern = re.compile(r'const\s+ARTICLES\s*=\s*\[(.*?)\];', re.DOTALL)
    m = pattern.search(data)
    if not m:
        return []
    return re.findall(r'\{[^{}]*\}', m.group(1))


def parse_article_block(block):
    out = {}
    for key in ("id", "title", "date", "publishedAt", "updatedAt", "status"):
        m = re.search(rf'{key}:\s*["\']([^"\']*)["\']', block)
        if m:
            out[key] = m.group(1)
    return out


def article_publication_date(article):
    value = article.get("publishedAt") or article.get("date")
    if not value:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return datetime.fromisoformat(value).replace(tzinfo=timezone(timedelta(hours=9)))
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def parse_date(value):
    if not value:
        return None
    value = str(value).strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return date.fromisoformat(value)
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def record_date(record, *names):
    lowered = {str(k).lower(): v for k, v in record.items()}
    for name in names:
        value = lowered.get(name.lower())
        parsed = parse_date(value)
        if parsed:
            return parsed
    return None


def is_shallow_repository(repo):
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--is-shallow-repository"],
            cwd=repo, capture_output=True, text=True, check=False,
        )
        return result.stdout.strip().lower() == "true"
    except OSError:
        return False


def load_previous_lastmods(path):
    try:
        root = ET.parse(path).getroot()
    except (OSError, ET.ParseError):
        return {}
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    return {
        url.findtext(f"{namespace}loc"): url.findtext(f"{namespace}lastmod")
        for url in root.findall(f"{namespace}url")
        if url.findtext(f"{namespace}loc") and url.findtext(f"{namespace}lastmod")
    }


def git_file_date(path, loc, today, shallow, previous_lastmods):
    if shallow:
        return previous_lastmods.get(loc, today)
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    relative = os.path.relpath(path, repo)
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", relative],
            cwd=repo, capture_output=True, text=True, check=False,
        )
        value = result.stdout.strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return value
    except OSError:
        pass
    return today


def is_noindex_page(html):
    """Exclude both redirect stubs and intentionally thin pages from sitemap."""
    return bool(re.search(r'<meta\s+name="robots"\s+content="noindex(?:[,\"]|\s)', html, re.I))


def load_data_file(name):
    path = os.path.join(LP_DIR, "data", name)
    try:
        with open(path, encoding="utf-8") as source:
            return json.load(source).get("items", [])
    except (OSError, ValueError):
        return []


def main():
    if not os.path.exists(DATA_PATH):
        print(f"ERROR: {DATA_PATH} not found", file=sys.stderr)
        sys.exit(1)

    with open(DATA_PATH, "r") as f:
        data = f.read()

    today = date.today().isoformat()
    urls = []
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    shallow = is_shallow_repository(repo)
    previous_lastmods = load_previous_lastmods(OUT_PATH) if shallow else {}
    today_date = date.today()
    editions = load_data_file("editions.json")
    lineups = load_data_file("lineups.json")
    authors = load_data_file("authors.json")
    editions_by_festival = {}
    editions_by_id = {}
    for edition in editions:
        editions_by_festival.setdefault(edition.get("FESTIVAL_ID"), []).append(edition)
        if edition.get("EDITION_ID"):
            editions_by_id[edition["EDITION_ID"]] = edition
    lineups_by_edition = {}
    for lineup in lineups:
        lineups_by_edition.setdefault(lineup.get("EDITION_ID"), []).append(lineup)

    for p in STATIC_PAGES:
        urls.append({
            "loc": BASE_URL + p["path"],
            "lastmod": git_file_date(os.path.join(LP_DIR, p["path"].lstrip("/")), BASE_URL + p["path"], today, shallow, previous_lastmods),
            "changefreq": p["changefreq"],
            "priority": p["priority"],
        })

    # Festivals
    festival_ids = extract_ids(data, "FESTIVALS")
    for fid in festival_ids:
        festival_path = os.path.join(LP_DIR, "festivals", f"{fid}.html")
        candidates = []
        for edition in editions_by_festival.get(fid, []):
            changed = record_date(edition, "updated_at", "updatedAt", "last_updated")
            if changed:
                candidates.append(changed)
            for lineup in lineups_by_edition.get(edition.get("EDITION_ID"), []):
                changed = record_date(lineup, "updated_at", "updatedAt", "last_updated")
                if changed:
                    candidates.append(changed)
        if not candidates:
            starts = [record_date(e, "date_start", "start", "date")
                      for e in editions_by_festival.get(fid, [])]
            starts = [d for d in starts if d and d <= today_date]
            if starts:
                candidates.append(max(starts))
        festival_loc = f"{BASE_URL}/festivals/{fid}.html"
        festival_lastmod = max(candidates).isoformat() if candidates else git_file_date(festival_path, festival_loc, today, shallow, previous_lastmods)
        urls.append({
            "loc": festival_loc,
            "lastmod": festival_lastmod,
            "changefreq": "weekly",
            "priority": "0.7",
        })

    # Artists
    artist_ids = extract_ids(data, "ARTISTS")
    artist_url_count = 0
    for aid in artist_ids:
        artist_path = os.path.join(LP_DIR, "artists", f"{aid}.html")
        try:
            with open(artist_path, encoding="utf-8", errors="replace") as artist_file:
                if is_noindex_page(artist_file.read()):
                    continue
        except OSError:
            continue
        urls.append({
            "loc": f"{BASE_URL}/artists/{aid}.html",
            "lastmod": git_file_date(os.path.join(LP_DIR, "artists", f"{aid}.html"), f"{BASE_URL}/artists/{aid}.html", today, shallow, previous_lastmods),
            "changefreq": "monthly",
            "priority": "0.6",
        })
        artist_url_count += 1

    # Venues (filtered)
    venue_ids = extract_venue_ids(data)
    for vid in venue_ids:
        urls.append({
            "loc": f"{BASE_URL}/venues/{vid}.html",
            "lastmod": git_file_date(os.path.join(LP_DIR, "venues", f"{vid}.html"), f"{BASE_URL}/venues/{vid}.html", today, shallow, previous_lastmods),
            "changefreq": "monthly",
            "priority": "0.6",
        })

    # Writers: only authors with at least one published article receive a page.
    article_blocks = extract_article_blocks(data)
    published_author_names = set()
    for block in article_blocks:
        article = parse_article_block(block)
        if article.get("status") != "draft":
            author = re.search(r'author:\s*["\']([^"\']*)["\']', block)
            if author and author.group(1).strip():
                published_author_names.add(author.group(1).strip().casefold())
    for author in authors:
        aid = str(author.get("id") or "").strip()
        name = str(author.get("name") or "").strip()
        if not aid or not name or name.casefold() not in published_author_names:
            continue
        writer_path = os.path.join(LP_DIR, "writers", f"{aid}.html")
        if not os.path.exists(writer_path):
            continue
        urls.append({
            "loc": f"{BASE_URL}/writers/{quote(aid, safe='')}.html",
            "lastmod": git_file_date(writer_path, f"{BASE_URL}/writers/{aid}.html", today, shallow, previous_lastmods),
            "changefreq": "monthly",
            "priority": "0.5",
        })

    # English pages (/en/...) — 生成済みファイルをそのまま列挙する
    import glob
    en_root = os.path.join(LP_DIR, "en")
    for f in sorted(glob.glob(os.path.join(en_root, "*", "*.html"))):
        # 旧Title Case URLなどの noindex リダイレクトスタブは検索対象ではない。
        # sitemap には転送先の正規ページだけを載せる。
        with open(f, "r", encoding="utf-8", errors="replace") as html_file:
            if is_noindex_page(html_file.read()):
                continue
        rel = os.path.relpath(f, LP_DIR).replace(os.sep, "/")
        urls.append({
            "loc": f"{BASE_URL}/{rel}",
            "lastmod": git_file_date(f, f"{BASE_URL}/{rel}", today, shallow, previous_lastmods),
            "changefreq": "weekly",
            "priority": "0.5",
        })

    # Articles: 生成済みの公開ページだけを列挙する。
    # data.js の ARTICLES を無条件に読むと draft も sitemap に入り、
    # 詳細ページ生成側（draft は除外）との間で404が生じる。
    article_ids = []
    article_data = {
        article.get("id"): article
        for article in (parse_article_block(block) for block in extract_article_blocks(data))
        if article.get("id")
    }
    article_root = os.path.join(LP_DIR, "articles")
    for f in sorted(glob.glob(os.path.join(article_root, "*.html"))):
        with open(f, "r", encoding="utf-8", errors="replace") as html_file:
            html = html_file.read()
        if is_noindex_page(html):
            continue
        aid = os.path.splitext(os.path.basename(f))[0]
        article_ids.append(aid)
        article_lastmod = record_date(article_data.get(aid, {}), "updatedAt", "date")
        urls.append({
            "loc": f"{BASE_URL}/articles/{aid}.html",
            "lastmod": article_lastmod.isoformat() if article_lastmod else git_file_date(f, f"{BASE_URL}/articles/{aid}.html", today, shallow, previous_lastmods),
            "changefreq": "monthly",
            "priority": "0.7",
        })

    # Build XML
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        lines.append("  <url>")
        # URLとして非ASCII・空白等をpercent-encodeし、XML予約文字もescapeする。
        loc = escape(quote(u["loc"], safe=":/%"))
        lines.append(f"    <loc>{loc}</loc>")
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
    print(f"  Artists: {artist_url_count} (source {len(artist_ids)}, noindex {len(artist_ids) - artist_url_count})")
    print(f"  Venues: {len(venue_ids)}")
    print(f"  Articles: {len(article_ids)}")
    print(f"  → {OUT_PATH}")

    # Google News sitemap は直近48時間の記事だけを受け付けるため、古い記事は含めない。
    news_path = os.path.join(LP_DIR, "sitemap-news.xml")
    news_articles = []
    now = datetime.now(timezone.utc)
    for block in extract_article_blocks(data):
        article = parse_article_block(block)
        publication_date = article_publication_date(article)
        if (article.get("status") == "published" and article.get("id") and
                article.get("title") and publication_date and
                now - timedelta(hours=48) <= publication_date.astimezone(timezone.utc) <= now):
            news_articles.append((publication_date, article))
    news_articles.sort(key=lambda item: item[0], reverse=True)
    if not news_articles:
        news_lines = ['<?xml version="1.0" encoding="UTF-8"?>',
                      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"/>']
    else:
        news_lines = ['<?xml version="1.0" encoding="UTF-8"?>',
                      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
                      '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">']
        for publication_date, article in news_articles:
            iso = publication_date.isoformat()
            article_loc = escape(quote(f"{BASE_URL}/articles/{article['id']}.html", safe=":/%"))
            news_lines.extend([
                '  <url>',
                f'    <loc>{article_loc}</loc>',
                '    <news:news>',
                '      <news:publication>',
                '        <news:name>TECHNO JAPAN</news:name>',
                '        <news:language>ja</news:language>',
                '      </news:publication>',
                f'      <news:publication_date>{iso}</news:publication_date>',
                f'      <news:title>{escape(article["title"])}</news:title>',
                '    </news:news>',
                '  </url>',
            ])
        news_lines.append('</urlset>')
    with open(news_path, "w") as f:
        f.write("\n".join(news_lines) + "\n")
    print(f"✓ sitemap-news.xml generated: {len(news_articles)} articles (過去48時間)")


if __name__ == "__main__":
    main()
