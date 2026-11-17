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
}

export interface PageText {
  pageNumber: number;
  width: number;
  height: number;
  runs: TextRun[];
}

/** One visual line of text, after merging the runs that share a baseline. */
export interface Line {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  /** True when every run on the line is bold. */
  bold: boolean;
  pageNumber: number;
  pageHeight: number;
}

export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'listItem'; ordered: boolean; marker: string; depth: number; text: string }
  | { kind: 'pageBreak'; pageNumber: number };

export interface ConversionOptions {
  /** Turn larger or bold standalone lines into `#` headings. */
  detectHeadings: boolean;
  /** Turn bullet and numbered lines into Markdown lists. */
  detectLists: boolean;
  /** Drop running headers, footers and page numbers repeated across pages. */
  removeRepeatedLines: boolean;
  /** Insert a horizontal rule between pages. */
  pageBreaks: boolean;
}

export const DEFAULT_OPTIONS: ConversionOptions = {
  detectHeadings: true,
  detectLists: true,
  removeRepeatedLines: true,
  pageBreaks: false,
};
