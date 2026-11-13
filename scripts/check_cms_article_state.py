#!/usr/bin/env python3
"""Static regression checks for the CMS article editor state flow."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "LP/cms.html").read_text(encoding="utf-8")
JS = (ROOT / "LP/cms.js").read_text(encoding="utf-8")

errors = []

for element_id in ("ar-body-editor", "ar-body-source", "ar-body", "ar-preview-content", "ar-focus-preview-content"):
    count = HTML.count(f'id="{element_id}"')
    if count != 1:
        errors.append(f"{element_id}: expected 1 occurrence, got {count}")

if JS.count("function getArticleBodyForSave()") != 1:
    errors.append("getArticleBodyForSave must have exactly one definition")

if "if (!html.trim() && articleLastLoadedBody.trim() && !articleQuillUserEdited) return;" not in JS:
    errors.append("empty Quill overwrite guard is missing")

preview_start = JS.find("function toggleArticlePreview()")
focus_start = JS.find("function toggleFocusMode()")
if preview_start < 0 or focus_start < 0 or focus_start <= preview_start:
    errors.append("preview/focus functions could not be located")
else:
    preview_block = JS[preview_start:focus_start]
    if "flushArticleEditorSync()" in preview_block:
        errors.append("preview open/close must not flush article body")

if re.search(r"body\s*:\s*g\(['\"]ar-body['\"]\)", JS):
    errors.append("article save path still reads ar-body directly")

publishing_start = JS.find("function buildPublishingSection(section){")
publishing_end = JS.find("\nfunction updateCharCount(", publishing_start)
if publishing_start < 0 or publishing_end <= publishing_start:
    errors.append("buildPublishingSection could not be located")
else:
    publishing_block = JS[publishing_start:publishing_end]
    if "isArticle ? '<div class=\"label-hint\">公開状態（Status）とタグは、上のフォームの Status / Tags 欄で設定します。</div>' : ''" not in publishing_block:
        errors.append("article publishing note is missing")
    if "${isArticle ? '' : `<div class=\"form-group\">" not in publishing_block:
        errors.append("article publishing section does not conditionally omit Tags")
    if "${isArticle ? `<div class=\"form-group\"><label>Author</label>" not in publishing_block:
        errors.append("article publishing section does not put Author in the first grid cell")
    if "<select id=\"${p}-status\"" not in publishing_block or "<input type=\"hidden\" id=\"${p}-tags\"" not in publishing_block:
        errors.append("non-article publishing Status/Tags templates are missing")

for element_id in ("ar-status", "ar-tags"):
    count = HTML.count(f'id="{element_id}"')
    if count != 1:
        errors.append(f"{element_id}: expected 1 occurrence, got {count}")

if not re.search(r"article:\[[^\]]*'ar-tags'", JS):
    errors.append("resetForm article fields must clear ar-tags")
if "document.getElementById('ar-status').value='draft'" not in JS:
    errors.append("resetForm article status default must be draft")

get_start = JS.find("function getPubFields(section){")
get_end = JS.find("\nfunction setPubFields(", get_start)
set_start = get_end
set_end = JS.find("\nfunction clearPubFields(", set_start)
clear_start = set_end
clear_end = JS.find("\n/* ==============================================================" , clear_start)
if min(get_start, get_end, set_end, clear_end) < 0:
    errors.append("publishing field helpers could not be located")
else:
    get_article = JS[get_start:get_end]
    set_article = JS[set_start:set_end]
    clear_article = JS[clear_start:clear_end]
    if "if(section !== 'article')" not in get_article or "fields.status" not in get_article or "fields.tags" not in get_article:
        errors.append("getPubFields must keep Status/Tags only for non-articles")
    if "if(section !== 'article')" not in set_article or "setVal(p+'-status'" not in set_article or "setTagsValue(p" not in set_article:
        errors.append("setPubFields must keep Status/Tags only for non-articles")
    if "if(section !== 'article')" not in clear_article or "setVal(p+'-status', 'draft')" not in clear_article or "renderTags(p)" not in clear_article:
        errors.append("clearPubFields must keep Status/Tags reset only for non-articles")

if errors:
    print("CMS article state checks: FAIL")
    print("\n".join(f"- {error}" for error in errors))
    sys.exit(1)

print("CMS article state checks: OK")
