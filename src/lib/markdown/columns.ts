import type { PageText, TextRun } from './types';

/** Minimum width of the empty strip between two columns, in PDF units (1/72 inch). */
const MIN_GUTTER = 6;
/** The gutter must sit in the middle part of the text block. */
const SEARCH_FROM = 0.3;
const SEARCH_TO = 0.7;
/**
 * A strip counts as empty when at most this share of the busiest strip's rows cross it.
 * Full-width rows (title, abstract) do cross the gutter, so it is rarely completely empty.
 */
const EMPTY_SHARE = 0.25;

interface Row {
  y: number;
  runs: TextRun[];
}

/**
 * Splits a two-column page into pieces in reading order: any full-width rows
 * (titles, abstracts, figure captions) stay where they are, and the rows between
 * them are read down the left column first, then down the right one.
 *
 * Returns the page unchanged when no clear gutter exists.
 */
export function splitColumns(page: PageText): PageText[] {
  const gutter = findGutter(page.runs);
  if (gutter === null) return [page];

  const rows = groupRows(page.runs);
  const crosses = (run: TextRun) => run.x < gutter && run.x + run.width > gutter;

  const pieces: PageText[] = [];
  const piece = (runs: TextRun[]) => {
    if (runs.length) pieces.push({ ...page, runs });
  };

  let left: TextRun[] = [];
  let right: TextRun[] = [];
  const flush = () => {
    piece(left);
    piece(right);
    left = [];
    right = [];
  };

  for (const row of rows) {
    if (row.runs.some(crosses)) {
      flush();
      piece(row.runs);
      continue;
    }
    for (const run of row.runs) (run.x + run.width / 2 < gutter ? left : right).push(run);
  }
  flush();
  return pieces;
}

/** Groups runs that share a baseline, top to bottom. */
function groupRows(runs: TextRun[]): Row[] {
  const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Row[] = [];
  for (const run of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row.y - run.y) <= run.fontSize * 0.5) row.runs.push(run);
    else rows.push({ y: run.y, runs: [run] });
  }
  return rows;
}

/** Returns the x position of a vertical gutter separating two columns of prose, if any. */
export function findGutter(runs: TextRun[]): number | null {
  const text = runs.filter((run) => run.text.trim().length > 0 && run.width > 0);
  if (text.length < 12) return null;

  const minX = Math.floor(Math.min(...text.map((run) => run.x)));
  const maxX = Math.ceil(Math.max(...text.map((run) => run.x + run.width)));
  const width = maxX - minX;
  if (width < 200) return null;

  // How many rows cover each 1-unit strip of the page. Counting rows rather than
  // runs keeps writers that emit one run per word from weighing more than others.
  const coverage = new Array<number>(width + 1).fill(0);
  for (const row of groupRows(text)) {
    const covered = new Uint8Array(width + 1);
    for (const run of row.runs) {
      const from = Math.max(0, Math.floor(run.x - minX));
      const to = Math.min(width, Math.ceil(run.x + run.width - minX));
      covered.fill(1, from, to);
    }
    for (let i = 0; i <= width; i++) coverage[i] += covered[i];
  }
  const busiest = Math.max(...coverage);
  const limit = busiest * EMPTY_SHARE;

  // Candidate stretches of near-empty strips in the middle of the text block.
  const candidates: Array<{ start: number; end: number; mean: number }> = [];
  let start: number | null = null;
  const from = Math.floor(width * SEARCH_FROM);
  const to = Math.ceil(width * SEARCH_TO);
  for (let i = from; i <= to + 1; i++) {
    const empty = i <= to && coverage[i] <= limit;
    if (empty && start === null) start = i;
    if (!empty && start !== null) {
      if (i - start >= MIN_GUTTER) {
        const strip = coverage.slice(start, i);
        candidates.push({ start, end: i, mean: strip.reduce((sum, n) => sum + n, 0) / strip.length });
      }
      start = null;
    }
  }

  // The emptiest stretch that separates two columns of prose wins. A gap between
  // two cells of a table inside one column can also look empty, so each is checked.
  candidates.sort((a, b) => a.mean - b.mean || b.end - b.start - (a.end - a.start));
  for (const candidate of candidates) {
    const gutter = minX + (candidate.start + candidate.end) / 2;
    if (looksLikeProseColumns(text, gutter)) return gutter;
  }
  return null;
}

interface SideStats {
  chars: number;
  rows: number;
  span: number;
  /** Row widths, shortest first. */
  widths: number[];
  /** Share of rows that continue the sentence of the row above, as wrapped prose does. */
  continuation: number;
}

function sideStats(runs: TextRun[]): SideStats {
  const rows = groupRows(runs);
  const left = Math.min(...runs.map((run) => run.x));
  const right = Math.max(...runs.map((run) => run.x + run.width));
  const widths = rows
    .map(
      (row) =>
        Math.max(...row.runs.map((run) => run.x + run.width)) - Math.min(...row.runs.map((run) => run.x)),
    )
    .sort((a, b) => a - b);
  const texts = rows.map((row) =>
    [...row.runs]
      .sort((a, b) => a.x - b.x)
      .map((run) => run.text)
      .join(' ')
      .trim(),
  );
  let continued = 0;
  for (let i = 1; i < texts.length; i++) {
    if (/^\p{Ll}/u.test(texts[i]) || /\p{L}-$/u.test(texts[i - 1])) continued += 1;
  }
  return {
    chars: runs.reduce((sum, run) => sum + run.text.length, 0),
    rows: rows.length,
    span: right - left,
    widths,
    continuation: texts.length > 1 ? continued / (texts.length - 1) : 0,
  };
}

/**
 * Tells two columns of prose apart from a table, which also has empty vertical strips.
 *
 * One side must clearly be prose: most of its lines run to the column edge (headings
 * and last lines of paragraphs are short, hence the upper quartile) and many lines
 * carry on the sentence of the line above, which table cells do not. The other side
 * may be short, like the end of an article, but must hold a few full lines too.
 * Both columns must be wide; a table's label column usually is not.
 */
function looksLikeProseColumns(runs: TextRun[], gutter: number): boolean {
  const left = runs.filter((run) => run.x + run.width <= gutter);
  const right = runs.filter((run) => run.x >= gutter);
  if (!left.length || !right.length) return false;

  const total = runs.reduce((sum, run) => sum + run.text.length, 0);
  const textWidth = Math.max(...runs.map((run) => run.x + run.width)) - Math.min(...runs.map((run) => run.x));
  const sides = [sideStats(left), sideStats(right)];

  const usable = (side: SideStats) => side.chars >= total * 0.1 && side.span >= textWidth * 0.35;
  const strong = (side: SideStats) =>
    side.rows >= 5 &&
    side.widths[Math.floor(side.widths.length * 0.75)] >= side.span * 0.9 &&
    side.continuation >= 0.3;
  const weak = (side: SideStats) => side.widths.filter((width) => width >= side.span * 0.9).length >= 2;

  const [a, b] = sides;
  return usable(a) && usable(b) && ((strong(a) && weak(b)) || (strong(b) && weak(a)));
}
