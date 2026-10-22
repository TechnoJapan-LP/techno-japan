#!/usr/bin/env python3
"""Check the SEO, measurement, and shared font head of the twelve hub pages."""

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PAGES = [
    'index.html', 'news.html', 'festivals.html', 'artists.html', 'venues.html', 'about.html',
    'en/index.html', 'en/news.html', 'en/festivals.html', 'en/artists.html', 'en/venues.html', 'en/about.html',
]
EXPECTED_TYPES = {
    'index.html': {'NewsMediaOrganization', 'WebSite'},
    'news.html': {'CollectionPage', 'BreadcrumbList'},
    'festivals.html': {'CollectionPage', 'BreadcrumbList'},
    'artists.html': {'CollectionPage', 'BreadcrumbList'},
    'venues.html': {'CollectionPage', 'BreadcrumbList'},
    'about.html': {'NewsMediaOrganization', 'Organization', 'WebSite', 'BreadcrumbList'},
}


def jsonld_types(head):
    types = set()
    for raw in re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>([\s\S]*?)</script>', head, re.I):
        try:
            values = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f'JSON-LD parse error: {exc}') from exc
        for value in values if isinstance(values, list) else [values]:
            if isinstance(value, dict) and value.get('@type'):
                types.update(value['@type'] if isinstance(value['@type'], list) else [value['@type']])
    return types


def check_page(relative):
    path = ROOT / 'LP' / relative
    html = path.read_text(encoding='utf-8')
    head_match = re.search(r'<head>([\s\S]*?)</head>', html, re.I)
    if not head_match:
        return ['head is missing']
    head = head_match.group(1)
    required = {
        'GA4': 'G-4MHCNR7D26' in head,
        'canonical': bool(re.search(r'<link[^>]+rel="canonical"', head, re.I)),
        'hreflang': len(re.findall(r'<link[^>]+hreflang="(?:ja|en|x-default)"', head, re.I)) == 3,
        'og:image': bool(re.search(r'<meta[^>]+property="og:image"', head, re.I)),
        'twitter:card': bool(re.search(r'<meta[^>]+name="twitter:card"', head, re.I)),
        'manifest': bool(re.search(r'<link[^>]+rel="manifest"', head, re.I)),
        'X-Content-Type-Options': 'X-Content-Type-Options' in head,
        '@font-face': bool(re.search(r'<style>[\s\S]*@font-face', head, re.I)),
        'Noto Sans JP': 'fonts.googleapis.com/css2?family=Noto+Sans+JP' in head,
    }
    errors = [name for name, ok in required.items() if not ok]
    expected = EXPECTED_TYPES[Path(relative).name]
    missing_types = expected - jsonld_types(head)
    if missing_types:
        errors.append(f'JSON-LD missing {", ".join(sorted(missing_types))}')
    if "navigator.serviceWorker.register('/sw.js')" not in html:
        errors.append('Service Worker registration is missing')
    return errors


def main():
    failed = False
    for page in PAGES:
        errors = check_page(page)
        if errors:
            failed = True
            print(f'FAIL {page}: {"; ".join(errors)}')
        else:
            print(f'OK   {page}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
