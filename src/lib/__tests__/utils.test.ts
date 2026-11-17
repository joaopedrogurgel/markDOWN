import { describe, expect, it } from 'vitest';
import { uniqueNames } from '../download';
import { DEFAULT_OPTIONS } from '../markdown';
import { toLinkAreas, toTextRuns } from '../pdf/runs';
import { loadOptions } from '../storage';
import { scrubEvent } from '../telemetry';

describe('uniqueNames', () => {
  it('numbers repeated file names so a zip keeps every file', () => {
    expect(uniqueNames(['a.md', 'b.md', 'A.md', 'a.md'])).toEqual(['a.md', 'b.md', 'A (2).md', 'a (3).md']);
  });
});

describe('loadOptions', () => {
  it('falls back to the defaults when storage is unavailable', () => {
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
  });
});

describe('scrubEvent', () => {
  it('keeps the error and drops anything that could identify a person or a file', () => {
    const event = scrubEvent({
      exception: { values: [{ type: 'TypeError' }] },
      request: { url: 'https://site/relatorio-secreto.pdf' },
      user: { ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'clicked' }],
      extra: { name: 'x' },
    });
    expect(event).toEqual({ exception: { values: [{ type: 'TypeError' }] } });
  });
});

describe('PDF runs', () => {
  const item = (str: string, x: number, width: number, fontName = 'f1') => ({
    str,
    transform: [10, 0, 0, 10, x, 700],
    width,
    height: 10,
    fontName,
  });

  it('reads weight and slant from the font name', () => {
    const fonts = new Map([
      ['f1', 'ABCDEF+Arial-BoldItalicMT'],
      ['f2', 'CMR10'],
    ]);
    const [styled, plain] = toTextRuns([item('a', 0, 5), item('b', 10, 5, 'f2')], fonts);
    expect(styled).toMatchObject({ bold: true, italic: true });
    expect(plain).toMatchObject({ bold: false, italic: false });
  });

  it('splits a run at the edge of a link, leaving punctuation outside', () => {
    const links = toLinkAreas([
      { subtype: 'Link', url: 'https://exemplo.com', rect: [105, 698, 125, 712] },
      { subtype: 'Link', url: 'javascript:alert(1)', rect: [0, 0, 999, 999] },
      { subtype: 'Link', dest: 'secao-2', rect: [0, 0, 999, 999] },
    ]);
    expect(links).toHaveLength(1);
    const runs = toTextRuns([item('Veja o site, ok', 70, 75)], new Map(), links);
    expect(runs.map((run) => [run.text, run.link])).toEqual([
      ['Veja o ', null],
      ['site', 'https://exemplo.com'],
      [', ok', null],
    ]);
  });
});
