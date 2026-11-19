/** 本文の見出しをページの h1 を起点に1段ずつ詰める。 */
export function normalizeArticleHeadingLevels(html, report = null) {
  const source = String(html || '');
  const tokenRe = /<\/?h([1-6])\b[^>]*>/gi;
  const stack = [];
  const headings = [];
  let nested = false;
  let malformed = false;
  let match;
  while ((match = tokenRe.exec(source))) {
    const token = match[0];
    const level = Number(match[1]);
    if (token[1] !== '/') {
      if (stack.length) {
        nested = true;
        stack[stack.length - 1].nested = true;
      }
      stack.push({ level, open: match, nested: false });
      continue;
    }
    if (!stack.length || stack.at(-1).level !== level) {
      malformed = true;
      continue;
    }
    const heading = stack.pop();
    heading.close = match;
    headings.push(heading);
    if (heading.nested) nested = true;
  }
  if (stack.length || malformed || nested) return source;
  headings.sort((a, b) => a.open.index - b.open.index);

  let previous = 1;
  const edits = [];
  for (const heading of headings) {
    const originalLevel = heading.level;
    const normalizedLevel = Math.max(2, Math.min(originalLevel, previous + 1));
    previous = normalizedLevel;
    if (normalizedLevel === originalLevel) continue;
    const openTag = heading.open[0];
    const hasClass = /\bclass\s*=/i.test(openTag);
    const text = source.slice(heading.open.index + openTag.length, heading.close.index)
      .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (hasClass) {
      report?.classSkips?.push({ originalLevel, normalizedLevel, text });
      continue;
    }
    const attrs = openTag.replace(new RegExp(`^<h${originalLevel}\\b`, 'i'), '').replace(/>$/, '');
    edits.push({
      start: heading.open.index,
      end: heading.open.index + openTag.length,
      value: `<h${normalizedLevel}${attrs} data-hl="${originalLevel}">`,
    });
    edits.push({
      start: heading.close.index,
      end: heading.close.index + heading.close[0].length,
      value: `</h${normalizedLevel}>`,
    });
    report?.changes?.push({ originalLevel, normalizedLevel, text });
  }
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  }
  return result;
}
