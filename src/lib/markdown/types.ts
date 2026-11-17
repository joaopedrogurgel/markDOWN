/** A contiguous piece of text as positioned on a PDF page. */
export interface TextRun {
  text: string;
  /** Left edge, in PDF units (origin at the bottom-left of the page). */
  x: number;
  /** Baseline, in PDF units. Grows upwards. */
  y: number;
  width: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  /** Target of the link annotation covering this run, if any. */
  link: string | null;
}

export interface PageText {
  pageNumber: number;
  width: number;
  height: number;
  runs: TextRun[];
}

/** Text with a single inline style. */
export interface Span {
  text: string;
  bold: boolean;
  italic: boolean;
  link: string | null;
}

/** One positioned piece of a line, as the PDF placed it. Tables are found by how pieces line up. */
export interface Piece {
  x: number;
  right: number;
  spans: Span[];
}

/** One visual line of text, after merging the runs that share a baseline. */
export interface Line {
  spans: Span[];
  pieces: Piece[];
  /** Plain text of the line, used by the structural heuristics. */
  text: string;
  x: number;
  right: number;
  y: number;
  fontSize: number;
  /** True when every run on the line is bold. */
  bold: boolean;
  pageNumber: number;
  pageHeight: number;
}

export type Block =
  | { kind: 'heading'; level: number; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'listItem'; ordered: boolean; marker: string; depth: number; spans: Span[] }
  | { kind: 'table'; rows: Span[][][] }
  | { kind: 'pageBreak'; pageNumber: number };

export interface ConversionOptions {
  /** Turn larger or bold standalone lines into `#` headings. */
  detectHeadings: boolean;
  /** Turn bullet and numbered lines into Markdown lists. */
  detectLists: boolean;
  /** Turn text aligned in a grid into Markdown tables. */
  detectTables: boolean;
  /** Read two-column pages column by column instead of straight across. */
  detectColumns: boolean;
  /** Drop running headers, footers and page numbers repeated across pages. */
  removeRepeatedLines: boolean;
  /** Insert a horizontal rule between pages. */
  pageBreaks: boolean;
}

export const DEFAULT_OPTIONS: ConversionOptions = {
  detectHeadings: true,
  detectLists: true,
  detectTables: true,
  detectColumns: true,
  removeRepeatedLines: true,
  pageBreaks: false,
};
