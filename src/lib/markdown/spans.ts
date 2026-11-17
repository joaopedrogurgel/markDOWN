import type { Span } from './types';

export const sameStyle = (a: Span, b: Span) =>
  a.bold === b.bold && a.italic === b.italic && a.link === b.link;

export const plainText = (spans: Span[]) => spans.map((span) => span.text).join('');

/** Merges neighbours with the same style and collapses whitespace across span boundaries. */
export function normaliseSpans(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    let text = span.text.replace(/\s+/g, ' ');
    const previous = out.at(-1);
    if (previous && /\s$/.test(previous.text)) text = text.replace(/^\s+/, '');
    if (!previous && !text.trim()) continue;
    if (!text) continue;
    if (previous && sameStyle(previous, span)) previous.text += text;
    else out.push({ ...span, text });
  }
  const first = out[0];
  const last = out.at(-1);
  if (first) first.text = first.text.replace(/^\s+/, '');
  if (last) last.text = last.text.replace(/\s+$/, '');
  return out.filter((span) => span.text.length > 0);
}

/**
 * Joins two wrapped lines of the same block. Words hyphenated at the end of the
 * first line are repaired; otherwise the lines are separated by a space.
 */
export function joinSpans(previous: Span[], next: Span[]): Span[] {
  const before = previous.map((span) => ({ ...span }));
  const after = next.map((span) => ({ ...span }));
  const last = before.at(-1);
  const first = after[0];
  if (!last || !first) return normaliseSpans([...before, ...after]);

  if (/\p{L}-$/u.test(last.text) && /^\p{Ll}/u.test(first.text)) {
    last.text = last.text.slice(0, -1);
  } else if (sameStyle(last, first)) {
    last.text += ' ';
  } else {
    before.push({ text: ' ', bold: false, italic: false, link: null });
  }
  return normaliseSpans([...before, ...after]);
}

/** Removes the first `count` characters (e.g. a list marker) and any spaces after them. */
export function dropPrefix(spans: Span[], count: number): Span[] {
  let remaining = count;
  const out: Span[] = [];
  for (const span of spans) {
    if (remaining >= span.text.length) {
      remaining -= span.text.length;
      continue;
    }
    out.push({ ...span, text: span.text.slice(remaining) });
    remaining = 0;
  }
  return normaliseSpans(out);
}

/** Removes a style from every span (headings are bold already, so `**` would be noise). */
export const withoutBold = (spans: Span[]) => normaliseSpans(spans.map((span) => ({ ...span, bold: false })));

const escapeInline = (text: string) => text.replace(/([\\`*])/g, '\\$1');
const escapeLinkText = (text: string) => text.replace(/([[\]])/g, '\\$1');
const escapeUrl = (url: string) => url.replace(/[()\s]/g, (ch) => encodeURIComponent(ch));

/** Wraps text in emphasis markers, keeping surrounding spaces outside them. */
function emphasise(text: string, bold: boolean, italic: boolean): string {
  const marker = bold && italic ? '***' : bold ? '**' : italic ? '*' : '';
  if (!marker || !text.trim()) return text;
  const lead = text.match(/^\s*/)?.[0] ?? '';
  const trail = text.match(/\s*$/)?.[0] ?? '';
  return `${lead}${marker}${text.trim()}${marker}${trail}`;
}

/** Serialises spans as inline Markdown: `**bold**`, `*italic*` and `[links](url)`. */
export function renderSpans(spans: Span[]): string {
  const merged = normaliseSpans(spans);
  let out = '';
  let index = 0;
  while (index < merged.length) {
    const link = merged[index].link;
    const group: Span[] = [];
    while (index < merged.length && merged[index].link === link) {
      group.push(merged[index]);
      index += 1;
    }
    const inner = group
      .map((span) => {
        const escaped = escapeInline(span.text);
        return emphasise(link ? escapeLinkText(escaped) : escaped, span.bold, span.italic);
      })
      .join('');
    if (!link) {
      out += inner;
    } else {
      const lead = inner.match(/^\s*/)?.[0] ?? '';
      const trail = inner.match(/\s*$/)?.[0] ?? '';
      out += `${lead}[${inner.trim()}](${escapeUrl(link)})${trail}`;
    }
  }
  return out;
}
