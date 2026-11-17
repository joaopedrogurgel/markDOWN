const numberFormat = new Intl.NumberFormat('pt-BR');

export const formatNumber = (value: number) => numberFormat.format(value);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

export const plural = (count: number, one: string, many: string) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** "relatorio-final.pdf" → "relatorio-final.md" */
export const toMarkdownName = (pdfName: string) => pdfName.replace(/\.pdf$/i, '') + '.md';
