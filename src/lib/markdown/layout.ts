import { normaliseSpans, plainText } from './spans';
import { cleanText } from './text';
import type { Line, PageText, Piece, Span, TextRun } from './types';

/** Gap, in multiples of the font size, that is wide enough to need a space between two runs. */
const WORD_GAP = 0.15;

/** Merges a page's text runs into visual lines, ordered top to bottom, left to right. */
export function buildLines(page: PageText): Line[] {
  const runs = page.runs.filter((run) => run.text.length > 0);
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: TextRun[][] = [];
  for (const run of sorted) {
    const current = groups.at(-1);
    const anchor = current?.[0];
    const tolerance = Math.max(run.fontSize, anchor?.fontSize ?? 0) * 0.5;
    if (current && anchor && Math.abs(anchor.y - run.y) <= tolerance) {
      current.push(run);
    } else {
      groups.push([run]);
    }
  }

  return groups.map((group) => toLine(group, page)).filter((line): line is Line => line !== null);
}

const toSpan = (run: TextRun, text: string): Span => ({
  text: cleanText(text),
  bold: run.bold,
  italic: run.italic,
  link: run.link,
});

function toLine(group: TextRun[], page: PageText): Line | null {
  const runs = [...group].sort((a, b) => a.x - b.x);
  const visible = runs.filter((run) => run.text.trim().length > 0);
  if (visible.length === 0) return null;

  const pieces: Piece[] = [];
  const spans: Span[] = [];
  let previousEnd: number | null = null;
  for (const run of visible) {
    const gap = previousEnd === null ? 0 : run.x - previousEnd;
    const needsSpace = previousEnd !== null && gap > run.fontSize * WORD_GAP;
    spans.push(toSpan(run, (needsSpace ? ' ' : '') + run.text));
    pieces.push({ x: run.x, right: run.x + run.width, spans: normaliseSpans([toSpan(run, run.text)]) });
    previousEnd = run.x + run.width;
  }
  const lineSpans = normaliseSpans(spans);
  const text = plainText(lineSpans);
  if (!text) return null;

  return {
    spans: lineSpans,
    pieces: pieces.filter((piece) => piece.spans.length > 0),
    text,
    x: visible[0].x,
    right: Math.max(...visible.map((run) => run.x + run.width)),
    y: visible[0].y,
    fontSize: dominantSize(visible),
    bold: visible.every((run) => run.bold),
    pageNumber: page.pageNumber,
    pageHeight: page.height,
  };
}

/** Size used by most characters of the line. */
function dominantSize(runs: TextRun[]): number {
  const weights = new Map<number, number>();
  for (const run of runs) {
    const size = roundSize(run.fontSize);
    weights.set(size, (weights.get(size) ?? 0) + run.text.length);
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function roundSize(size: number): number {
  return Math.round(size * 2) / 2;
}
