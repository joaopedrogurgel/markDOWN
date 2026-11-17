import type { TextRun } from '../markdown';

/** The subset of a pdf.js text item that the converter needs. */
export interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

/** A clickable area of the page pointing to a web address. */
export interface LinkArea {
  url: string;
  rect: [number, number, number, number];
}

// Includes the classic LaTeX Computer Modern names: CMBX (bold extended) and CMTI (text italic).
export const isBoldFont = (name: string) => /bold|black|heavy|semibold|demi|cmbx/i.test(name);
export const isItalicFont = (name: string) => /italic|oblique|-it\b|cmti/i.test(name);

const SAFE_URL = /^(https?:|mailto:)/i;

/** Keeps only link annotations that point to safe external addresses. */
export function toLinkAreas(annotations: unknown[]): LinkArea[] {
  const areas: LinkArea[] = [];
  for (const annotation of annotations) {
    const { subtype, url, rect } = (annotation ?? {}) as { subtype?: string; url?: unknown; rect?: unknown };
    if (subtype !== 'Link' || typeof url !== 'string' || !SAFE_URL.test(url)) continue;
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every((n) => typeof n === 'number')) continue;
    const [x1, y1, x2, y2] = rect as number[];
    areas.push({
      url,
      rect: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)],
    });
  }
  return areas;
}

/**
 * Splits a run where a link area starts or ends, so "projeto," linked only on
 * "projeto" becomes two pieces. Character widths are assumed to be uniform.
 */
function splitByLinks(run: TextRun, links: LinkArea[]): TextRun[] {
  const midY = run.y + run.fontSize * 0.3;
  const area = links.find(
    ({ rect: [x1, y1, x2, y2] }) => midY >= y1 - 2 && midY <= y2 + 2 && x1 < run.x + run.width && x2 > run.x,
  );
  if (!area || run.width <= 0) return [run];

  const [x1, , x2] = area.rect;
  const perChar = run.width / run.text.length;
  const start = Math.max(0, Math.min(run.text.length, Math.round((x1 - run.x) / perChar)));
  let end = Math.max(start, Math.min(run.text.length, Math.round((x2 - run.x) / perChar)));
  // The width estimate can swallow the punctuation right after the link.
  if (
    end === run.text.length &&
    end - start > 1 &&
    /[.,;:!?)]$/.test(run.text) &&
    !area.url.endsWith(run.text.at(-1)!)
  ) {
    end -= 1;
  }
  const piece = (from: number, to: number, link: string | null): TextRun | null =>
    to > from
      ? {
          ...run,
          text: run.text.slice(from, to),
          x: run.x + from * perChar,
          width: (to - from) * perChar,
          link,
        }
      : null;
  return [piece(0, start, null), piece(start, end, area.url), piece(end, run.text.length, null)].filter(
    (part): part is TextRun => part !== null,
  );
}

/** Turns pdf.js text items into positioned, styled runs. */
export function toTextRuns(
  items: RawTextItem[],
  fontNames: ReadonlyMap<string, string>,
  links: LinkArea[] = [],
): TextRun[] {
  const runs: TextRun[] = [];
  for (const item of items) {
    if (!item.str) continue;
    const [a, b, c, d, x, y] = item.transform;
    // Skip vertical or rotated text, which rarely belongs to the reading flow.
    if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) continue;
    const fontSize = item.height || Math.hypot(c, d) || Math.hypot(a, b);
    const font = fontNames.get(item.fontName) ?? '';
    const run: TextRun = {
      text: item.str,
      x,
      y,
      width: item.width,
      fontSize,
      bold: isBoldFont(font),
      italic: isItalicFont(font),
      link: null,
    };
    runs.push(...splitByLinks(run, links));
  }
  return runs;
}
