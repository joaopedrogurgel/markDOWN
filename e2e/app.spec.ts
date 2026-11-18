import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const corpus = (name: string) => new URL(`../corpus/${name}`, import.meta.url).pathname;
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 960;

async function openExample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Testar com um PDF de exemplo' }).click();
  await expect(page.getByRole('button', { name: 'Baixar .md' })).toBeVisible();
}

/** The Markdown source, from the editor or the textarea that stands in while it loads. */
async function source(page: Page) {
  if (isMobile(page)) await page.getByRole('radio', { name: 'Markdown' }).click();
  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible();
  return editor;
}

test('converts the example PDF into Markdown with a preview', async ({ page }) => {
  await openExample(page);
  await expect(page.getByRole('heading', { name: 'Relatório trimestral de produto' })).toBeVisible();
  await expect(page.getByText('3 páginas').or(page.getByText('2 páginas'))).toBeVisible();
  await expect(await source(page)).toContainText('# Relatório trimestral de produto');
});

test('reads tables and two-column pages', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles([corpus('relatorio-tabela.pdf'), corpus('artigo-duas-colunas.pdf')]);
  await expect(page.getByRole('button', { name: 'Baixar todos (.zip)' })).toBeVisible();

  await page.getByRole('button', { name: /^relatorio-tabela\.pdf/ }).click();
  await expect(page.getByRole('table')).toContainText('Empresarial');

  await page.getByRole('button', { name: /^artigo-duas-colunas\.pdf/ }).click();
  await expect(await source(page)).toContainText('a ordem certa é descer pela coluna da esquerda');
});

test('explains files it cannot convert', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles([
    { name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') },
    { name: 'quebrado.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nlixo') },
  ]);
  await expect(page.getByRole('listitem').filter({ hasText: 'notas.txt' })).toContainText(
    'Só arquivos PDF são aceitos.',
  );
  await page.getByRole('button', { name: /^quebrado\.pdf/ }).click();
  await expect(page.getByText('O arquivo pode estar corrompido.').first()).toBeVisible();
});

test('edits can be discarded, and options re-convert instantly', async ({ page }) => {
  await openExample(page);
  const editor = await source(page);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\nTexto novo');
  const discard = page.getByRole('button', { name: 'Descartar edições' });
  await expect(discard).toBeVisible();
  await discard.click();
  await expect(discard).toBeHidden();
  await expect(editor).not.toContainText('Texto novo');

  if (isMobile(page)) await page.locator('summary', { hasText: 'Opções de conversão' }).click();
  await page.getByRole('switch', { name: /Separar páginas/ }).check();
  await expect(editor).toContainText('<!-- Página 2 -->');
});

test('downloads one file or all of them', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .setInputFiles([corpus('memorando.pdf'), corpus('relatorio-tabela.pdf')]);
  const zip = page.getByRole('button', { name: 'Baixar todos (.zip)' });
  await expect(zip).toBeVisible();

  const [single] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar .md' }).click(),
  ]);
  expect(single.suggestedFilename()).toBe('memorando.md');
  expect(readFileSync(await single.path(), 'utf8')).toContain('# Memorando interno');

  const [all] = await Promise.all([page.waitForEvent('download'), zip.click()]);
  expect(all.suggestedFilename()).toBe('markdown.zip');
  expect(
    readFileSync(await all.path())
      .subarray(0, 2)
      .toString(),
  ).toBe('PK');
});

test('keeps converted files between visits, until the history is cleared', async ({ page }) => {
  await openExample(page);
  await page.waitForTimeout(600); // history is saved shortly after a change
  await page.reload();
  const resume = page.getByRole('button', { name: /Continuar de onde parou \(1 arquivo\)/ });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.getByRole('button', { name: 'Baixar .md' })).toBeVisible();

  if (isMobile(page)) await page.locator('summary', { hasText: 'Opções de conversão' }).click();
  await page.getByRole('button', { name: 'Limpar histórico' }).click();
  // The list empties only after the stored files are deleted.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Do PDF ao Markdown');
  await page.reload();
  await expect(page.getByRole('button', { name: /Continuar de onde parou/ })).toBeHidden();
});

test('works offline after the first visit', async ({ page, context }) => {
  test.skip(isMobile(page), 'covered on desktop');
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Do PDF ao Markdown');
  await page.getByRole('button', { name: 'Testar com um PDF de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Relatório trimestral de produto' })).toBeVisible();
});

test('is usable with the keyboard and announces the theme switch', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  const toggle = page.getByRole('button', { name: /Usar tema/ });
  const before = await toggle.getAttribute('aria-label');
  await toggle.click();
  await expect(toggle).not.toHaveAttribute('aria-label', before ?? '');
});
