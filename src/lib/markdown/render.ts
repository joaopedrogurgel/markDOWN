import { escapeBlockStart } from './text';
import type { Block } from './types';

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
      return `${'#'.repeat(block.level)} ${block.text.trim()}`;
    case 'paragraph':
      return escapeBlockStart(block.text.trim());
    case 'listItem': {
      const indent = '   '.repeat(block.depth);
      return `${indent}${block.marker} ${block.text.trim()}`;
    }
    case 'pageBreak':
      return `---\n\n<!-- Página ${block.pageNumber} -->`;
  }
}
