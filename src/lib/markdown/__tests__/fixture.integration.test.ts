import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, pagesToMarkdown } from '..';
import { extractFile } from '../../../__tests__/extract-node';

describe('exemplo.pdf', () => {
  it('converts the bundled sample into structured Markdown', async () => {
    const pages = await extractFile(
      fileURLToPath(new URL('../../../../public/exemplo.pdf', import.meta.url)),
    );
    const md = pagesToMarkdown(pages, DEFAULT_OPTIONS);

    expect(md).toMatch(/^# Relatório trimestral de produto$/m);
    expect(md).toMatch(/^\*Um documento de exemplo para testar a conversão\*$/m);
    expect(md).toMatch(/^## Visão geral$/m);
    expect(md).toMatch(/^### Destaques do período$/m);
    expect(md).toMatch(/^- Nenhum arquivo é enviado a servidores externos\.$/m);
    expect(md).toMatch(/^1\. Detectar tabelas simples\.$/m);
    expect(md).toContain('em **negrito** no meio');
    expect(md).not.toMatch(/Página \d/);
    expect(md).not.toContain('Relatório de exemplo — markDOWN');
  });
});
