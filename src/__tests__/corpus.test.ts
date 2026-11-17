import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, pagesToMarkdown } from '../lib/markdown';
import { extractFile } from './extract-node';
import { similarity } from './similarity';

/**
 * Quality gate: converts every PDF in corpus/ and compares it with the
 * hand-written Markdown next to it. A document may never score below its
 * baseline, so a heuristic that helps one document cannot silently break another.
 *
 *   npm run corpus          prints the scores and writes the outputs to corpus/.out/
 *   npm run corpus:update   also raises the baseline to the current scores
 */
const CORPUS = fileURLToPath(new URL('../../corpus/', import.meta.url));
const BASELINE = join(CORPUS, 'baseline.json');
const OUT = join(CORPUS, '.out');
const UPDATE = process.env.CORPUS_UPDATE === '1';
const REPORT = process.env.CORPUS_REPORT === '1' || UPDATE;
/** Rounding noise allowed between runs. */
const TOLERANCE = 0.002;

const files = (await readdir(CORPUS)).filter((file) => file.endsWith('.pdf')).sort();
const baseline: Record<string, number> = JSON.parse(await readFile(BASELINE, 'utf8').catch(() => '{}'));
const scores: Record<string, number> = {};

describe('corpus', () => {
  it.each(files)('%s', async (file) => {
    const name = basename(file, '.pdf');
    const expected = await readFile(join(CORPUS, `${name}.md`), 'utf8');
    const actual = pagesToMarkdown(await extractFile(join(CORPUS, file)), DEFAULT_OPTIONS);
    const score = Math.round(similarity(expected, actual) * 1000) / 1000;
    scores[name] = score;

    if (REPORT) {
      await mkdir(OUT, { recursive: true });
      await writeFile(join(OUT, `${name}.md`), actual);
    }
    if (!UPDATE) expect(score).toBeGreaterThanOrEqual((baseline[name] ?? 0) - TOLERANCE);
  });

  afterAll(async () => {
    const names = Object.keys(scores).sort();
    const average = names.reduce((sum, name) => sum + scores[name], 0) / names.length;
    if (REPORT) {
      const report = [
        'Documento                     Nota   Base',
        ...names.map(
          (name) => `${name.padEnd(30)}${scores[name].toFixed(3)}  ${(baseline[name] ?? 0).toFixed(3)}`,
        ),
        `${'Média'.padEnd(30)}${average.toFixed(3)}`,
      ].join('\n');
      await writeFile(join(OUT, 'report.txt'), report + '\n');
    }
    if (UPDATE) {
      const next = Object.fromEntries(names.map((name) => [name, Math.max(scores[name], 0)]));
      await writeFile(BASELINE, JSON.stringify(next, null, 2) + '\n');
    }
  });
});
