import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, pagesToMarkdown, type PageText } from '..';

/** Mirrors src/lib/pdf/extract.ts using the Node build of pdf.js. */
async function extract(path: string): Promise<PageText[]> {
  const data = new Uint8Array(await readFile(path));
  const doc = await getDocument({
    data,
    fontExtraProperties: true,
    useSystemFonts: false,
    verbosity: VerbosityLevel.ERRORS,
  }).promise;
  const pages: PageText[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { width, height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    await page.getOperatorList();
    const runs = content.items.flatMap((item) => {
      if (!('str' in item) || !item.str) return [];
      const [, , c, d, e, f] = item.transform as number[];
      const font = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
      return [
        {
          text: item.str,
          x: e,
          y: f,
          width: item.width,
          fontSize: item.height || Math.hypot(c, d),
          bold: /bold/i.test(font?.name ?? ''),
        },
      ];
    });
    pages.push({ pageNumber: n, width, height, runs });
  }
  return pages;
}

describe('exemplo.pdf', () => {
  it('converts the bundled sample into structured Markdown', async () => {
    const pages = await extract(fileURLToPath(new URL('../../../../public/exemplo.pdf', import.meta.url)));
    const md = pagesToMarkdown(pages, DEFAULT_OPTIONS);

    expect(md).toMatch(/^# Relatório trimestral de produto$/m);
    expect(md).toMatch(/^## Visão geral$/m);
    expect(md).toMatch(/^### Destaques do período$/m);
    expect(md).toMatch(/^- Nenhum arquivo é enviado a servidores externos\.$/m);
    expect(md).toMatch(/^1\. Detectar tabelas simples\.$/m);
    expect(md).toContain('em **negrito** no meio');
    expect(md).not.toMatch(/Página \d/);
    expect(md).not.toContain('Relatório de exemplo — Pauta');
  });
});
