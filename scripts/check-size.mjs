// Fails the build when the JavaScript and CSS the first page needs grow past the budget.
// Everything loaded on demand (PDF reader, editor, preview) is left out on purpose.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 100;
const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const initial = [...html.matchAll(/(?:src|href)="[^"]*?\/?(assets\/[^"]+\.(?:js|css))"/g)].map(
  (match) => match[1],
);
let total = 0;
for (const file of initial) {
  const size = gzipSync(readFileSync(join(dist, file))).length / 1024;
  total += size;
  console.log(`${file.padEnd(40)} ${size.toFixed(1)} KB`);
}
console.log(`${'Total (gzip)'.padEnd(40)} ${total.toFixed(1)} KB de ${BUDGET_KB} KB`);
if (total > BUDGET_KB) {
  console.error(`A página inicial passou do limite de ${BUDGET_KB} KB.`);
  process.exit(1);
}
