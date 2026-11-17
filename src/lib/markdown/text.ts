const LIGATURES: Record<string, string> = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'st',
  '\uFB06': 'st',
};

const LIGATURE = /[\uFB00-\uFB06]/g;
const INVISIBLE = /[\u00AD\u200B-\u200D\uFEFF]/g; // soft hyphen and zero-width characters
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Normalises whitespace, ligatures and invisible characters produced by PDF text extraction. */
export function cleanText(input: string): string {
  return input
    .replace(LIGATURE, (ch) => LIGATURES[ch] ?? ch)
    .replace(INVISIBLE, '')
    .replace(CONTROL, '')
    .replace(/\s+/g, ' ');
}

/**
 * Escapes characters that would accidentally start a Markdown block when a
 * plain paragraph begins with them (e.g. "# 1 priority" or "> 50%").
 */
export function escapeBlockStart(text: string): string {
  return text.replace(/^(#{1,6}\s|>|[-+]\s)/, '\\$1').replace(/^(\d+)([.)]\s)/, '$1\\$2');
}

export function countWords(markdown: string): number {
  return markdown
    .replace(/\]\([^)]*\)/g, ' ') // link targets are not words
    .replace(/[#>*_`~\-|[\]()!\\]/g, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
