import { buildLines } from './layout';
import { renderMarkdown } from './render';
import { buildBlocks, removeRepeatedLines } from './structure';
import type { ConversionOptions, PageText } from './types';

export { countWords } from './text';
export { DEFAULT_OPTIONS } from './types';
export type { ConversionOptions, PageText, TextRun } from './types';

/**
 * Converts the text extracted from a PDF into Markdown.
 * Pure and synchronous, so it can re-run instantly when the user changes an option.
 */
export function pagesToMarkdown(pages: PageText[], options: ConversionOptions): string {
  let lines = pages.flatMap(buildLines);
  if (options.removeRepeatedLines) {
    lines = removeRepeatedLines(lines, pages.length);
  }
  if (lines.length === 0) return '';
  return renderMarkdown(buildBlocks(lines, options));
}
