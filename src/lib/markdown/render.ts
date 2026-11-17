import { renderSpans, withoutBold } from './spans';
import { escapeBlockStart } from './text';
import type { Block, Span } from './types';

/** Serialises blocks into CommonMark/GFM text. */
export function renderMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  let previous: Block | null = null;

  for (const block of blocks) {
    const chunk = renderBlock(block);
    if (!chunk) continue;
    // Items of the same list stay together; everything else is separated by a blank line.
    const separator = previous?.kind === 'listItem' && block.kind === 'listItem' ? '\n' : '\n\n';
    out.push(previous ? separator + chunk : chunk);
    previous = block;
  }

  return out.join('').trim() + '\n';
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${renderSpans(withoutBold(block.spans))}`;
    case 'paragraph':
      return escapeBlockStart(renderSpans(block.spans));
    case 'listItem':
      return `${'   '.repeat(block.depth)}${block.marker} ${renderSpans(block.spans)}`;
    case 'table':
      return renderTable(block.rows);
    case 'pageBreak':
      return `---\n\n<!-- Página ${block.pageNumber} -->`;
  }
}

const tableCell = (spans: Span[]) => renderSpans(spans).replace(/\|/g, '\\|') || ' ';
const tableRow = (row: Span[][]) => `| ${row.map(tableCell).join(' | ')} |`;

/** GFM table; the first row becomes the header, which Markdown already shows in bold. */
function renderTable(rows: Span[][][]): string {
  const header = tableRow(rows[0].map(withoutBold));
  const body = rows.slice(1).map(tableRow);
  const divider = `| ${rows[0].map(() => '---').join(' | ')} |`;
  return [header, divider, ...body].join('\n');
}
