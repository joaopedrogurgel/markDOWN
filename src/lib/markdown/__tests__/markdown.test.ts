import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, pagesToMarkdown, type PageText, type TextRun } from '..';
import { findGutter } from '../columns';
import { joinSpans, renderSpans } from '../spans';
import { countWords, escapeBlockStart } from '../text';
import type { Span } from '../types';

const PAGE_HEIGHT = 800;

type LineSpec = { text: string; y: number; size?: number; x?: number; bold?: boolean; italic?: boolean };

const run = (partial: Partial<TextRun> & Pick<TextRun, 'text' | 'x' | 'y'>): TextRun => ({
  width: partial.text.length * (partial.fontSize ?? 10) * 0.5,
  fontSize: 10,
  bold: false,
  italic: false,
  link: null,
  ...partial,
});

/** Builds a page from simple line descriptions (or explicit runs), top to bottom. */
function page(pageNumber: number, lines: Array<LineSpec | TextRun[]>): PageText {
  const runs = lines.flatMap((line) =>
    Array.isArray(line)
      ? line
      : [
          run({
            text: line.text,
            x: line.x ?? 50,
            y: line.y,
            fontSize: line.size ?? 10,
            bold: line.bold ?? false,
            italic: line.italic ?? false,
          }),
        ],
  );
  return { pageNumber, width: 600, height: PAGE_HEIGHT, runs };
}

const convert = (pages: PageText[], options = {}) =>
  pagesToMarkdown(pages, { ...DEFAULT_OPTIONS, ...options });

const span = (text: string, style: Partial<Span> = {}): Span => ({
  text,
  bold: false,
  italic: false,
  link: null,
  ...style,
});

describe('text helpers', () => {
  it('repairs words hyphenated at the end of a line', () => {
    expect(renderSpans(joinSpans([span('uma pala-')], [span('vra')]))).toBe('uma palavra');
    expect(renderSpans(joinSpans([span('Rio-')], [span('Grande')]))).toBe('Rio- Grande');
  });

  it('escapes characters that would start an unintended block', () => {
    expect(escapeBlockStart('# prioridade')).toBe('\\# prioridade');
    expect(escapeBlockStart('2024. Foi um ano')).toBe('2024\\. Foi um ano');
    expect(escapeBlockStart('Texto normal')).toBe('Texto normal');
  });

  it('counts words, ignoring Markdown syntax and link targets', () => {
    expect(countWords('# Título\n\n- um item **forte** e [link](https://x.y/z)')).toBe(6);
  });
});

describe('inline styles', () => {
  it('renders bold, italic and both, keeping spaces outside the markers', () => {
    expect(
      renderSpans([
        span('Um '),
        span('forte ', { bold: true }),
        span('leve', { italic: true }),
        span(' e '),
        span('ambos', { bold: true, italic: true }),
      ]),
    ).toBe('Um **forte** *leve* e ***ambos***');
  });

  it('renders links, with styled text inside them', () => {
    expect(
      renderSpans([
        span('Veja a '),
        span('documentação ', { link: 'https://example.com/a b' }),
        span('oficial', { link: 'https://example.com/a b', bold: true }),
        span('.'),
      ]),
    ).toBe('Veja a [documentação **oficial**](https://example.com/a%20b).');
  });

  it('escapes characters that would create formatting by accident', () => {
    expect(renderSpans([span('2 * 3 = 6 e `x`')])).toBe('2 \\* 3 = 6 e \\`x\\`');
  });

  it('keeps one pair of markers across a wrapped italic paragraph', () => {
    const md = convert([
      page(1, [
        { text: 'Uma frase inteira em', y: 700, italic: true },
        { text: 'itálico que quebra a linha.', y: 686, italic: true },
      ]),
    ]);
    expect(md).toBe('*Uma frase inteira em itálico que quebra a linha.*\n');
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

  it('turns short bold lines into subheadings without bold markers', () => {
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
          run({ text: 'Um termo ', x: 50, y: 700, width: 45 }),
          run({ text: 'importante', x: 95, y: 700, width: 50, bold: true }),
          run({ text: ' aqui.', x: 145, y: 700, width: 30 }),
        ],
      ]),
    ]);
    expect(md).toBe('Um termo **importante** aqui.\n');
  });

  it('turns runs covered by a link annotation into a Markdown link', () => {
    const md = convert([
      page(1, [
        [
          run({ text: 'Acesse ', x: 50, y: 700, width: 35 }),
          run({ text: 'o site', x: 85, y: 700, width: 30, link: 'https://exemplo.com' }),
          run({ text: '.', x: 115, y: 700, width: 3 }),
        ],
      ]),
    ]);
    expect(md).toBe('Acesse [o site](https://exemplo.com).\n');
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

describe('tables', () => {
  const row = (y: number, cells: Array<[string, number]>, bold = false) =>
    cells.map(([text, x]) => run({ text, x, y, bold }));

  const tablePage = page(1, [
    { text: 'Resultados do trimestre:', y: 740 },
    row(
      710,
      [
        ['Produto', 50],
        ['Região', 200],
        ['Receita', 350],
      ],
      true,
    ),
    row(696, [
      ['Plano Básico', 50],
      ['Sul', 200],
      ['1.200', 350],
    ]),
    row(682, [
      ['Plano Pro', 50],
      ['Sudeste', 200],
      ['3.450', 350],
    ]),
    row(668, [
      ['Plano Time', 50],
      ['Norte', 200],
      ['980', 350],
    ]),
    { text: 'Fonte: relatório interno.', y: 630 },
  ]);

  it('turns cells aligned in a grid into a GFM table with a header row', () => {
    expect(convert([tablePage])).toBe(
      [
        'Resultados do trimestre:',
        '',
        '| Produto | Região | Receita |',
        '| --- | --- | --- |',
        '| Plano Básico | Sul | 1.200 |',
        '| Plano Pro | Sudeste | 3.450 |',
        '| Plano Time | Norte | 980 |',
        '',
        'Fonte: relatório interno.',
        '',
      ].join('\n'),
    );
  });

  it('keeps right-aligned numbers in their column', () => {
    const md = convert([
      page(1, [
        row(710, [
          ['Item', 50],
          ['Valor', 330],
        ]),
        row(696, [
          ['Café', 50],
          ['9,50', 345],
        ]),
        row(682, [
          ['Pão de queijo', 50],
          ['12,00', 340],
        ]),
      ]),
    ]);
    expect(md).toContain('| Pão de queijo | 12,00 |');
  });

  it('escapes pipes inside cells', () => {
    const md = convert([
      page(1, [
        row(710, [
          ['A', 50],
          ['B', 200],
        ]),
        row(696, [
          ['x | y', 50],
          ['1', 200],
        ]),
        row(682, [
          ['z', 50],
          ['2', 200],
        ]),
      ]),
    ]);
    expect(md).toContain('| x \\| y | 1 |');
  });

  it('does not build a table from only two rows', () => {
    const md = convert([
      page(1, [
        row(710, [
          ['Nome:', 50],
          ['Ana', 200],
        ]),
        row(696, [
          ['Cargo:', 50],
          ['Dev', 200],
        ]),
      ]),
    ]);
    expect(md).not.toContain('|');
  });

  it('can be turned off', () => {
    expect(convert([tablePage], { detectTables: false })).not.toContain('|');
  });
});

describe('columns', () => {
  const leftText = [
    'O primeiro parágrafo da coluna da',
    'esquerda continua por várias linhas',
    'até terminar a ideia que começou no',
    'topo da página com bastante texto',
    'para preencher a coluna inteira e',
    'chegar ao pé da página sem pressa',
    'nenhuma porque ainda falta escrever',
    'mais um pouco antes de passar à outra',
  ];
  const rightText = [
    'coluna, onde a frase termina de vez.',
    'Depois vem um novo parágrafo que fala',
    'de outra coisa e também se estende por',
    'algumas linhas para ter peso suficiente',
    'na detecção da calha entre as colunas',
    'que separa o texto da esquerda deste',
    'aqui na direita, como num artigo de',
    'revista científica ou de um jornal.',
  ];

  const columnPage = page(1, [
    { text: 'Um artigo em duas colunas', y: 760, size: 18, x: 150 },
    ...leftText.map((text, i) => ({ text, y: 700 - i * 14, x: 50 })),
    ...rightText.map((text, i) => ({ text, y: 700 - i * 14, x: 330 })),
  ]);

  it('finds the gutter between two columns of prose', () => {
    const gutter = findGutter(columnPage.runs);
    expect(gutter).not.toBeNull();
    expect(gutter!).toBeGreaterThan(230);
    expect(gutter!).toBeLessThan(330);
  });

  it('reads the left column before the right one, keeping full-width titles first', () => {
    const md = convert([columnPage]);
    expect(md.startsWith('# Um artigo em duas colunas\n\nO primeiro parágrafo')).toBe(true);
    // The sentence that crosses the gutter is joined back together.
    expect(md).toContain('mais um pouco antes de passar à outra coluna, onde a frase termina de vez.');
    expect(md.indexOf('topo da página')).toBeLessThan(md.indexOf('Depois vem um novo parágrafo'));
  });

  it('reads straight across when column detection is off', () => {
    const md = convert([columnPage], { detectColumns: false, detectTables: false });
    expect(md).toContain('O primeiro parágrafo da coluna da coluna, onde a frase termina');
  });

  it('does not split single-column text', () => {
    const single = page(
      1,
      Array.from({ length: 25 }, (_, i) => ({
        text: 'Uma linha comum de texto corrido que ocupa a largura toda da página sem parar.',
        y: 700 - i * 14,
      })),
    );
    expect(findGutter(single.runs)).toBeNull();
  });
});
