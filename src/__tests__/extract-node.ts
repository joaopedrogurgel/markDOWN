import { readFile } from 'node:fs/promises';
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PageText } from '../lib/markdown';
import { toLinkAreas, toTextRuns, type RawTextItem } from '../lib/pdf/runs';

/** Reads a PDF from disk the same way src/lib/pdf/extract.ts does in the browser. */
export async function extractFile(path: string): Promise<PageText[]> {
  const data = new Uint8Array(await readFile(path));
  const task = getDocument({
    data,
    fontExtraProperties: true,
    useSystemFonts: false,
    verbosity: VerbosityLevel.ERRORS,
  });
  const doc = await task.promise;

  const pages: PageText[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const { width, height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    await page.getOperatorList();
    const fontNames = new Map<string, string>();
    for (const item of content.items) {
      if (!('fontName' in item) || fontNames.has(item.fontName)) continue;
      const font = page.commonObjs.has(item.fontName) ? page.commonObjs.get(item.fontName) : null;
      fontNames.set(item.fontName, font?.name ?? '');
    }
    const annotations = await page.getAnnotations({ intent: 'display' });
    const items = content.items.filter((item) => 'str' in item) as RawTextItem[];
    pages.push({ pageNumber, width, height, runs: toTextRuns(items, fontNames, toLinkAreas(annotations)) });
  }
  await task.destroy();
  return pages;
}
