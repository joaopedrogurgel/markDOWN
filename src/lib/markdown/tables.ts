import { normaliseSpans, plainText } from './spans';
import type { Block, Line, Piece, Span } from './types';

type TableBlock = Extract<Block, { kind: 'table' }>;

const MIN_ROWS = 3;
const MAX_ROWS = 200;
const MAX_COLUMNS = 12;
/** Rows further apart than this many line heights are not part of the same table. */
const MAX_ROW_GAP = 2.5;
/** Narrowest empty channel between two columns, in multiples of the font size. */
const MIN_CHANNEL = 0.5;
/** Gap between pieces of one cell that needs a space, in multiples of the font size. */
const WORD_GAP = 0.15;
const LIST_MARKER = /^(?:[•◦▪▫‣⁃●○■□–—*-]|\d{1,3}[.)]|[a-z]\)|[IVX]{1,4}[.)])$/u;

type Range = [number, number];

/**
 * Tries to read a table starting at `lines[start]`.
 *
 * A table is a run of lines of the same size crossed, from top to bottom, by one or
 * more empty vertical channels. Justified prose can space its words as widely as a
 * table spaces its columns, but its gaps never line up over several lines.
 * Returns null whenever the evidence is weak: plain text is a safer failure than an invented table.
 */
export function matchTable(lines: Line[], start: number): { block: TableBlock; end: number } | null {
  const first = lines[start];
  const rows: Line[] = [];
  let channels: Range[] = [];

  for (let i = start; i < lines.length && rows.length < MAX_ROWS; i++) {
    const line = lines[i];
    const previous = rows.at(-1);
    if (previous) {
      const gap = previous.y - line.y;
      if (
        line.pageNumber !== previous.pageNumber ||
        gap <= 0 ||
        gap > Math.max(previous.fontSize, line.fontSize) * MAX_ROW_GAP ||
        Math.abs(line.fontSize - first.fontSize) > 1
      ) {
        break;
      }
    }
    const next = findChannels([...rows, line], first.fontSize);
    // Once there are enough rows, a line that closes every channel ends the table.
    if (rows.length >= MIN_ROWS && next.length === 0) break;
    rows.push(line);
    channels = next;
  }
  if (rows.length < MIN_ROWS || channels.length === 0 || channels.length >= MAX_COLUMNS) return null;

  const columns = columnsBetween(channels);
  const grid = rows.map((row) => columns.map(([from, to]) => cellText(row.pieces, from, to, row.fontSize)));
  if (!isPlausible(grid)) return null;
  return { block: { kind: 'table', rows: grid }, end: start + rows.length };
}

/** Vertical strips that no piece of any row covers, strictly between the rows' content. */
function findChannels(rows: Line[], fontSize: number): Range[] {
  const pieces = rows.flatMap((row) => row.pieces);
  if (pieces.length < 2) return [];
  const sorted = [...pieces].sort((a, b) => a.x - b.x);

  const channels: Range[] = [];
  let reach = sorted[0].right;
  for (const piece of sorted.slice(1)) {
    if (piece.x - reach >= fontSize * MIN_CHANNEL) channels.push([reach, piece.x]);
    reach = Math.max(reach, piece.right);
  }
  // Every row must have content on both sides of a channel, or it is just a ragged edge.
  return channels.filter(([from, to]) =>
    rows.every((row) => row.pieces.some((p) => p.right <= from) && row.pieces.some((p) => p.x >= to)),
  );
}

function columnsBetween(channels: Range[]): Range[] {
  const edges = [Number.NEGATIVE_INFINITY, ...channels.flat(), Number.POSITIVE_INFINITY];
  const columns: Range[] = [];
  for (let i = 0; i < edges.length; i += 2) columns.push([edges[i], edges[i + 1]]);
  return columns;
}

function cellText(pieces: Piece[], from: number, to: number, fontSize: number): Span[] {
  const inside = pieces.filter((p) => p.x >= from && p.right <= to).sort((a, b) => a.x - b.x);
  const spans: Span[] = [];
  inside.forEach((piece, index) => {
    const gap = index === 0 ? 0 : piece.x - inside[index - 1].right;
    if (gap > fontSize * WORD_GAP) spans.push({ text: ' ', bold: false, italic: false, link: null });
    spans.push(...piece.spans);
  });
  return normaliseSpans(spans);
}

/**
 * Each column must be used by at least half of the rows; a first column made only
 * of bullets or numbers is a list; and rows that read as wrapped sentences, or cells
 * that are mostly long, are prose that happens to have aligned gaps.
 */
function isPlausible(grid: Span[][][]): boolean {
  const columnCount = grid[0].length;
  for (let column = 0; column < columnCount; column++) {
    const filled = grid.filter((row) => row[column].length > 0).length;
    if (filled < grid.length / 2) return false;
  }
  if (grid.every((row) => LIST_MARKER.test(plainText(row[0])))) return false;

  // Wrapped prose carries sentences from one row to the next; table rows do not.
  const texts = grid.map((row) => row.map(plainText).join(' '));
  const carried = texts.slice(1).filter((text) => /^\p{Ll}/u.test(text)).length;
  const average = texts.reduce((sum, text) => sum + text.length, 0) / texts.length;
  if (carried >= (texts.length - 1) / 2 && average > 30) return false;

  const cells = grid.flat().filter((cell) => cell.length > 0);
  const long = cells.filter((cell) => plainText(cell).length > 40).length;
  return long < cells.length * 0.5;
}
