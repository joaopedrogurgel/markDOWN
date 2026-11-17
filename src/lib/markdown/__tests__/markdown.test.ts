import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, pagesToMarkdown, type PageText, type TextRun } from '..';
import { countWords, escapeBlockStart, joinWrapped } from '../text';

const PAGE_HEIGHT = 800;

/** Builds a page from simple line descriptions, top to bottom. */
function page(
  pageNumber: number,
  lines: Array<{ text: string; y: number; size?: number; x?: number; bold?: boolean } | TextRun[]>,
): PageText {
  const runs = lines.flatMap((line) =>
    Array.isArray(line)
      ? line
      : [
          {
            text: line.text,
            x: line.x ?? 50,
            y: line.y,
            width: line.text.length * (line.size ?? 10) * 0.5,
            fontSize: line.size ?? 10,
            bold: line.bold ?? false,
          },
        ],
  );
  return { pageNumber, width: 600, height: PAGE_HEIGHT, runs };
}

const convert = (pages: PageText[], options = {}) =>
  pagesToMarkdown(pages, { ...DEFAULT_OPTIONS, ...options });

describe('text helpers', () => {
  it('repairs words hyphenated at the end of a line', () => {
    expect(joinWrapped('uma pala-', 'vra')).toBe('uma palavra');
    expect(joinWrapped('Rio-', 'Grande')).toBe('Rio- Grande');
  });

  it('escapes characters that would start an unintended block', () => {
    expect(escapeBlockStart('# prioridade')).toBe('\\# prioridade');
    expect(escapeBlockStart('2024. Foi um ano')).toBe('2024\\. Foi um ano');
    expect(escapeBlockStart('Texto normal')).toBe('Texto normal');
  });

  it('counts words, ignoring Markdown syntax', () => {
    expect(countWords('# Título\n\n- um item **forte**')).toBe(4);
  });
});

describe('pagesToMarkdown', () => {
  it('joins wrapped lines into one paragraph and separates paragraphs by spacing', () => {
    const md = convert([
      page(1, [
        { text: 'Primeira linha do', y: 700 },
        { text: 'mesmo parágrafo.', y: 686 },
        { text: 'Outro parágrafo.', y: 650 },
      ]),
    ]);
    expect(md).toBe('Primeira linha do mesmo parágrafo.\n\nOutro parágrafo.\n');
  });

  it('maps larger font sizes to heading levels', () => {
    const md = convert([
      page(1, [
        { text: 'Título', y: 760, size: 24 },
        { text: 'Seção', y: 720, size: 16 },
        { text: 'Texto do corpo com bastante conteúdo para dominar.', y: 690 },
        { text: 'Mais texto do corpo para definir o tamanho base.', y: 676 },
      ]),
    ]);
    expect(md).toMatch(/^# Título$/m);
    expect(md).toMatch(/^## Seção$/m);
  });

  it('turns short bold lines into subheadings', () => {
    const md = convert([
      page(1, [
        { text: 'Texto do corpo com bastante conteúdo.', y: 700 },
        { text: 'Resumo', y: 670, bold: true },
        { text: 'Mais texto do corpo aqui.', y: 655 },
      ]),
    ]);
    expect(md).toMatch(/^## Resumo$/m);
  });

  it('wraps bold spans inside a line', () => {
    const md = convert([
      page(1, [
        [
          { text: 'Um termo ', x: 50, y: 700, width: 45, fontSize: 10, bold: false },
          { text: 'importante', x: 95, y: 700, width: 50, fontSize: 10, bold: true },
          { text: ' aqui.', x: 145, y: 700, width: 30, fontSize: 10, bold: false },
        ],
      ]),
    ]);
    expect(md).toBe('Um termo **importante** aqui.\n');
  });

  it('detects bullet and numbered lists, including nesting', () => {
    const md = convert([
      page(1, [
        { text: '• Primeiro', y: 700 },
        { text: '◦ Aninhado', y: 686, x: 70 },
        { text: '• Segundo', y: 672 },
        { text: '1. Passo um', y: 640 },
        { text: '2) Passo dois', y: 626 },
      ]),
    ]);
    expect(md).toContain('- Primeiro\n   - Aninhado\n- Segundo');
    expect(md).toContain('1. Passo um\n2. Passo dois');
  });

  it('keeps dash-prefixed numbers as text', () => {
    expect(convert([page(1, [{ text: '-5% no trimestre', y: 700 }])])).toBe('-5% no trimestre\n');
  });

  it('removes running headers, footers and page numbers', () => {
    const pages = [1, 2, 3].map((n) =>
      page(n, [
        { text: 'Empresa X — Relatório', y: 780 },
        { text: `Conteúdo da página ${n}.`, y: 500 },
        { text: `Página ${n} de 3`, y: 20 },
      ]),
    );
    const md = convert(pages);
    expect(md).not.toContain('Empresa X');
    expect(md).not.toContain('de 3');
    expect(md).toContain('Conteúdo da página 2.');
  });

  it('continues a paragraph across pages when the sentence is unfinished', () => {
    const md = convert([
      page(1, [{ text: 'Uma frase que continua', y: 100 }]),
      page(2, [{ text: 'na página seguinte.', y: 700 }]),
    ]);
    expect(md).toBe('Uma frase que continua na página seguinte.\n');
  });

  it('marks page breaks when asked', () => {
    const md = convert([page(1, [{ text: 'Fim.', y: 400 }]), page(2, [{ text: 'Início.', y: 400 }])], {
      pageBreaks: true,
    });
    expect(md).toBe('Fim.\n\n---\n\n<!-- Página 2 -->\n\nInício.\n');
  });

  it('respects disabled options', () => {
    const md = convert(
      [
        page(1, [
          { text: 'Título', y: 760, size: 24 },
          { text: '• item', y: 700 },
        ]),
      ],
      { detectHeadings: false, detectLists: false },
    );
    expect(md).not.toContain('#');
    expect(md).toContain('• item');
  });

  it('returns an empty string for PDFs without text', () => {
    expect(convert([page(1, [])])).toBe('');
  });
});
