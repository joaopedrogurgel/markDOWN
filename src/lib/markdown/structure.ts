import { roundSize } from './layout';
import { dropPrefix, joinSpans } from './spans';
import { matchTable } from './tables';
import type { Block, ConversionOptions, Line } from './types';

/** Share of the page height, at the top and at the bottom, where headers and footers live. */
const MARGIN_ZONE = 0.12;
// Symbol bullets may touch the text; dashes and asterisks need a space so "-5%" stays text.
const BULLET = /^(?:[•◦▪▫‣⁃●○■□]\s*|[–—*-]\s+)(?=\S)/u;
const ORDERED = /^(\d{1,3}[.)]|[a-z]\)|[IVX]{1,4}[.)])\s+(?=\S)/;
const PAGE_NUMBER = /^(?:p(?:á|a)g(?:ina)?\.?|page)?\s*\d+(?:\s*(?:\/|de|of)\s*\d+)?$/i;
const SENTENCE_END = /[.!?:;]["')\]]?$/;

/** Removes running headers/footers and lone page numbers found in the page margins. */
export function removeRepeatedLines(lines: Line[], pageCount: number): Line[] {
  const inMargin = (line: Line) =>
    line.y > line.pageHeight * (1 - MARGIN_ZONE) || line.y < line.pageHeight * MARGIN_ZONE;
  const signature = (line: Line) => line.text.toLowerCase().replace(/\d+/g, '#').trim();

  const pagesBySignature = new Map<string, Set<number>>();
  for (const line of lines) {
    if (!inMargin(line)) continue;
    const key = signature(line);
    const pages = pagesBySignature.get(key) ?? new Set<number>();
    pages.add(line.pageNumber);
    pagesBySignature.set(key, pages);
  }

  const threshold = Math.max(2, Math.ceil(pageCount * 0.5));
  return lines.filter((line) => {
    if (!inMargin(line)) return true;
    if (PAGE_NUMBER.test(line.text.trim())) return false;
    if (pageCount < 2) return true;
    return (pagesBySignature.get(signature(line))?.size ?? 0) < threshold;
  });
}

/** Font size used by most of the document's characters. */
export function bodyFontSize(lines: Line[]): number {
  const weights = new Map<number, number>();
  for (const line of lines) {
    const size = roundSize(line.fontSize);
    weights.set(size, (weights.get(size) ?? 0) + line.text.length);
  }
  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? 12;
}

/** Maps font sizes noticeably larger than the body text to heading levels 1–3. */
export function headingScale(lines: Line[], body: number): Map<number, number> {
  const sizes = new Set<number>();
  for (const line of lines) {
    const size = roundSize(line.fontSize);
    if (size >= body * 1.15 && line.text.length <= 160) sizes.add(size);
  }
  const ordered = [...sizes].sort((a, b) => b - a);
  return new Map(ordered.map((size, index) => [size, Math.min(index + 1, 3)]));
}

function looksLikeBoldHeading(line: Line, body: number): boolean {
  return (
    line.bold &&
    roundSize(line.fontSize) >= body &&
    line.text.length <= 90 &&
    !SENTENCE_END.test(line.text) &&
    /\p{L}/u.test(line.text)
  );
}

/** Groups lines into Markdown blocks: headings, paragraphs, list items, tables and page breaks. */
export function buildBlocks(lines: Line[], options: ConversionOptions): Block[] {
  const body = bodyFontSize(lines);
  const scale = options.detectHeadings ? headingScale(lines, body) : new Map<number, number>();
  const boldLevel = Math.min((Math.max(0, ...scale.values()) || 1) + 1, 4);

  const blocks: Block[] = [];
  let previous: Line | null = null;
  let listBaseX: number | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const last = blocks.at(-1);
    const samePage = previous?.pageNumber === line.pageNumber;
    const gap = previous && samePage ? previous.y - line.y : Number.POSITIVE_INFINITY;
    // A negative gap means the text jumped up to the top of the next column.
    const columnJump = gap < 0;
    const tightGap = !columnJump && gap <= Math.max(previous?.fontSize ?? 0, line.fontSize) * 1.75;

    if (previous && !samePage && options.pageBreaks) {
      blocks.push({ kind: 'pageBreak', pageNumber: line.pageNumber });
    }

    // Tables: several consecutive rows whose cells line up in the same bands.
    if (options.detectTables && line.pieces.length >= 2) {
      const table = matchTable(lines, index);
      if (table) {
        blocks.push(table.block);
        index = table.end - 1;
        previous = lines[index];
        listBaseX = null;
        continue;
      }
    }

    const headingLevel = options.detectHeadings
      ? (scale.get(roundSize(line.fontSize)) ?? (looksLikeBoldHeading(line, body) ? boldLevel : null))
      : null;

    // Headings: consecutive lines of the same level form a single, multi-line title.
    if (headingLevel) {
      if (last?.kind === 'heading' && last.level === headingLevel && samePage && tightGap) {
        last.spans = joinSpans(last.spans, line.spans);
      } else {
        blocks.push({ kind: 'heading', level: headingLevel, spans: line.spans });
      }
      listBaseX = null;
      previous = line;
      continue;
    }

    // Lists: bullets and numbered items, nested by their indentation.
    const bullet = options.detectLists ? line.text.match(BULLET) : null;
    const ordered = options.detectLists && !bullet ? line.text.match(ORDERED) : null;
    const marker = bullet ?? ordered;
    if (marker) {
      if (listBaseX === null || line.x < listBaseX) listBaseX = line.x;
      const depth = Math.min(Math.round((line.x - listBaseX) / (line.fontSize * 1.5)), 3);
      blocks.push({
        kind: 'listItem',
        ordered: Boolean(ordered),
        marker: bullet ? '-' : normaliseOrderedMarker(ordered![1]),
        depth,
        spans: dropPrefix(line.spans, marker[0].length),
      });
      previous = line;
      continue;
    }

    // Continuation of a list item: an indented, tightly spaced line after it.
    if (last?.kind === 'listItem' && samePage && tightGap && listBaseX !== null && line.x > listBaseX) {
      last.spans = joinSpans(last.spans, line.spans);
      previous = line;
      continue;
    }

    // Paragraphs: wrapped lines of similar size, possibly flowing into the next column or page.
    const sameSize = previous !== null && Math.abs(previous.fontSize - line.fontSize) < 1;
    // Some writers (LaTeX, books) mark new paragraphs with a first-line indent instead of space.
    const indented =
      previous !== null &&
      samePage &&
      !columnJump &&
      line.x > previous.x + line.fontSize * 0.8 &&
      line.x - previous.x < line.fontSize * 4;
    const unfinished = last?.kind === 'paragraph' && !SENTENCE_END.test(last.spans.at(-1)?.text ?? '');
    const flows = previous !== null && unfinished && (columnJump || (!samePage && !options.pageBreaks));
    const startsParagraph = indented && !unfinished;
    if (last?.kind === 'paragraph' && sameSize && !startsParagraph && ((samePage && tightGap) || flows)) {
      last.spans = joinSpans(last.spans, line.spans);
    } else {
      blocks.push({ kind: 'paragraph', spans: line.spans });
      listBaseX = null;
    }
    previous = line;
  }

  return blocks;
}

/** Markdown only understands `1.` / `1)` style numbers; letters and roman numerals become `1.`. */
function normaliseOrderedMarker(marker: string): string {
  return /^\d+[.)]$/.test(marker) ? marker.replace(')', '.') : '1.';
}
