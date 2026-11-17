/**
 * Similarity between two texts, from 0 (nothing in common) to 1 (identical),
 * based on the Levenshtein edit distance. Whitespace runs are collapsed first,
 * so only meaningful differences count.
 */
export function similarity(expected: string, actual: string): number {
  const a = expected.replace(/[ \t]+/g, ' ').trim();
  const b = actual.replace(/[ \t]+/g, ' ').trim();
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  let current = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}
