import { cleanText } from './text';
import type { Line, PageText, TextRun } from './types';

/** Merges a page's text runs into visual lines, ordered top to bottom, left to right. */
export function buildLines(page: PageText): Line[] {
  const runs = page.runs.filter((run) => run.text.trim().length > 0 || run.text === ' ');
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

function toLine(group: TextRun[], page: PageText): Line | null {
  const runs = [...group].sort((a, b) => a.x - b.x);
  const visible = runs.filter((run) => run.text.trim().length > 0);
  if (visible.length === 0) return null;

  const allBold = visible.every((run) => run.bold);
  const anyBold = visible.some((run) => run.bold);

  // Merge neighbouring runs that share the same weight, so a bold span split
  // into several runs becomes a single **span**.
  const segments: { text: string; bold: boolean }[] = [];
  let previousEnd: number | null = null;
  for (const run of runs) {
    const gap = previousEnd === null ? 0 : run.x - previousEnd;
    const needsSpace = previousEnd !== null && gap > run.fontSize * 0.15;
    const last = segments.at(-1);
    const piece = (needsSpace ? ' ' : '') + run.text;
    const bold = run.text.trim() ? run.bold : (last?.bold ?? false);

    if (last && last.bold === bold) {
      last.text += piece;
    } else {
      segments.push({ text: piece, bold });
    }
    previousEnd = run.x + run.width;
  }

  const text = segments
    .map(({ text: raw, bold }) => {
      const value = cleanText(raw);
      if (!bold || allBold || !anyBold || !value.trim()) return value;
      // Keep surrounding spaces outside the markers: "**word** " not "**word **".
      const lead = value.match(/^\s*/)?.[0] ?? '';
      const trail = value.match(/\s*$/)?.[0] ?? '';
      return `${lead}**${value.trim()}**${trail}`;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;

  const fontSize = dominantSize(visible);
  return {
    text,
    x: visible[0].x,
    y: visible[0].y,
    fontSize,
    bold: allBold,
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
