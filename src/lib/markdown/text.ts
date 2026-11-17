const LIGATURES: Record<string, string> = {
  ﬀ: 'ff',
  ﬁ: 'fi',
  ﬂ: 'fl',
  ﬃ: 'ffi',
  ﬄ: 'ffl',
  ﬅ: 'st',
  ﬆ: 'st',
};

/** Normalises whitespace, ligatures and invisible characters produced by PDF text extraction. */
export function cleanText(input: string): string {
  return (
    input
      .replace(/[ﬀ-ﬆ]/g, (ch) => LIGATURES[ch] ?? ch)
      .replace(/[­​-‍﻿]/g, '') // soft hyphen and zero-width chars
      // eslint-disable-next-line no-control-regex -- stripping control characters is the point
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/\s+/g, ' ')
  );
}

/** Joins two wrapped lines of the same paragraph, repairing words hyphenated at the line end. */
export function joinWrapped(previous: string, next: string): string {
  if (/\p{L}-$/u.test(previous) && /^\p{Ll}/u.test(next)) {
    return previous.slice(0, -1) + next;
  }
  return `${previous} ${next}`;
}

/**
 * Escapes characters that would accidentally start a Markdown block when a
 * plain paragraph begins with them (e.g. "# 1 priority" or "> 50%").
 */
export function escapeBlockStart(text: string): string {
  return text.replace(/^(#{1,6}\s|>|[-+*]\s)/, '\\$1').replace(/^(\d+)([.)]\s)/, '$1\\$2');
}

export function countWords(markdown: string): number {
  const words = markdown
    .replace(/[#>*_`~\-|[\]()!]/g, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words.length;
}
