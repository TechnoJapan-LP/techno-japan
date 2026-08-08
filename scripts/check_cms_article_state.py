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

if errors:
    print("CMS article state checks: FAIL")
    print("\n".join(f"- {error}" for error in errors))
    sys.exit(1)

print("CMS article state checks: OK")
