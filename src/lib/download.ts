function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, content: string, type = 'text/markdown;charset=utf-8') {
  saveBlob(filename, new Blob([content], { type }));
}

/** "relatorio.md" twice becomes "relatorio.md" and "relatorio (2).md". */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name.toLowerCase()) ?? 0) + 1;
    seen.set(name.toLowerCase(), count);
    return count === 1 ? name : name.replace(/(\.[^.]+)?$/, ` (${count})$1`);
  });
}

/** Bundles several text files into one .zip, built in the browser. fflate (8 KB) loads on first use. */
export async function downloadZip(filename: string, files: Array<{ name: string; content: string }>) {
  const { strToU8, zipSync } = await import('fflate');
  const names = uniqueNames(files.map((file) => file.name));
  const entries = Object.fromEntries(files.map((file, index) => [names[index], strToU8(file.content)]));
  saveBlob(filename, new Blob([zipSync(entries, { level: 6 })], { type: 'application/zip' }));
}
