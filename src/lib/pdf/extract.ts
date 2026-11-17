import type { PageText, TextRun } from '../markdown';

export interface ExtractProgress {
  page: number;
  total: number;
}

export interface ExtractResult {
  pages: PageText[];
  title: string | null;
}

export type ExtractErrorCode = 'not-pdf' | 'password' | 'corrupt' | 'aborted' | 'unknown';

export class ExtractError extends Error {
  readonly code: ExtractErrorCode;

  constructor(code: ExtractErrorCode, message: string) {
    super(message);
    this.name = 'ExtractError';
    this.code = code;
  }
}

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js is ~1 MB, so it is only downloaded when the first file arrives. */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function hasPdfSignature(data: Uint8Array): boolean {
  // The header may be preceded by a few junk bytes, which readers tolerate.
  const head = data.subarray(0, 1024);
  for (let i = 0; i <= head.length - PDF_MAGIC.length; i++) {
    if (PDF_MAGIC.every((byte, j) => head[i + j] === byte)) return true;
  }
  return false;
}

const isBoldFont = (name: string) => /bold|black|heavy|semibold|demi/i.test(name);

/** Reads every page of a PDF and returns its positioned text runs. */
export async function extractPdf(
  data: ArrayBuffer,
  { onProgress, signal }: { onProgress?: (p: ExtractProgress) => void; signal?: AbortSignal } = {},
): Promise<ExtractResult> {
  const bytes = new Uint8Array(data);
  if (!hasPdfSignature(bytes)) {
    throw new ExtractError('not-pdf', 'O arquivo não é um PDF válido.');
  }

  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: bytes,
    fontExtraProperties: true,
    useSystemFonts: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const abort = () => void task.destroy();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    const doc = await task.promise;
    const meta = await doc.getMetadata().catch(() => null);
    const info = meta?.info as { Title?: unknown } | undefined;
    const title = typeof info?.Title === 'string' && info.Title.trim() ? info.Title.trim() : null;

    const pages: PageText[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      if (signal?.aborted) throw new ExtractError('aborted', 'Conversão cancelada.');

      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      // Font names (and therefore weight) are only known after the page's operators load.
      const fontNames = new Map<string, string>();
      try {
        await page.getOperatorList();
        for (const item of content.items) {
          if (!('fontName' in item) || fontNames.has(item.fontName)) continue;
          const font = page.commonObjs.has(item.fontName)
            ? (page.commonObjs.get(item.fontName) as { name?: string } | null)
            : null;
          fontNames.set(item.fontName, font?.name ?? content.styles[item.fontName]?.fontFamily ?? '');
        }
      } catch {
        // Weight detection is a nicety; the text itself is already in hand.
      }

      const runs: TextRun[] = [];
      for (const item of content.items) {
        if (!('str' in item) || item.str.length === 0) continue;
        const [a, b, c, d, e, f] = item.transform as number[];
        // Skip vertical or rotated text, which rarely belongs to the reading flow.
        if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) continue;
        const fontSize = item.height || Math.hypot(c, d) || Math.hypot(a, b);
        runs.push({
          text: item.str,
          x: e,
          y: f,
          width: item.width,
          fontSize,
          bold: isBoldFont(fontNames.get(item.fontName) ?? ''),
        });
      }

      pages.push({ pageNumber, width: viewport.width, height: viewport.height, runs });
      page.cleanup();
      onProgress?.({ page: pageNumber, total: doc.numPages });
    }

    await task.destroy();
    return { pages, title };
  } catch (error) {
    throw toExtractError(error, signal);
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

function toExtractError(error: unknown, signal?: AbortSignal): ExtractError {
  if (error instanceof ExtractError) return error;
  if (signal?.aborted) return new ExtractError('aborted', 'Conversão cancelada.');
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') {
    return new ExtractError('password', 'Este PDF é protegido por senha. Remova a senha e tente de novo.');
  }
  if (name === 'InvalidPDFException') {
    return new ExtractError('corrupt', 'Não foi possível ler este PDF. O arquivo pode estar corrompido.');
  }
  return new ExtractError('unknown', 'Algo impediu a leitura deste PDF. Tente outro arquivo.');
}
