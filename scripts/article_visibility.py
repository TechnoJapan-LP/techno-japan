"""
Shared article visibility rules for Python generators and checks.

Node, Python, and LP/cms.js each implement this because they run in separate
publish-path runtimes. Keep all three copies in sync; changing only one makes
pages, feeds, or hub data disagree.
"""
import os
import re
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))


def parse_publish_at(value):
    raw = str(value or '').strip()
    if not raw:
        return None
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', raw):
        raw = raw + 'T00:00:00+09:00'
    elif re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}', raw):
        raw = raw + ':00+09:00'
    elif re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', raw):
        raw = raw + '+09:00'
    elif re.match(r'^\d{4}-\d{2}-\d{2}T', raw) and re.search(r'(Z|[+-]\d{2}:?\d{2})$', raw):
        raw = raw[:-1] + '+00:00' if raw.endswith('Z') else raw
    else:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def build_now():
    configured = os.environ.get('TJ_BUILD_NOW', '').strip()
    if configured:
        parsed = parse_publish_at(configured)
        if parsed is None:
            raise ValueError(f'TJ_BUILD_NOW が不正です: {configured}')
        return parsed
    return datetime.now(timezone.utc)


def is_article_live(article, now=None):
    now = now or build_now()
    status = str((article or {}).get('status') or '').strip().lower()
    if status == 'draft':
        return False
    if status != 'scheduled':
        return True
    publish_at = parse_publish_at((article or {}).get('publishAt'))
    if publish_at is None:
        return False
    if publish_at.tzinfo is None:
        publish_at = publish_at.replace(tzinfo=JST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=JST)
    return publish_at <= now
