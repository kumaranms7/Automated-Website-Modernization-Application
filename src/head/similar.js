// How alike two pieces of text are, for titles, descriptions and headings that must differ from the rest of the site.
// The ratio is the one Python's difflib gives (twice the matching characters over the total), on lower-case letters and digits only.

export const SIMILAR = { title: 0.88, description: 0.8, h1: 0.92 };

export const normText = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// size of the longest common block, then the matches on its left and right (Ratcliff / Obershelp)
function matching(a, b) {
  if (!a.length || !b.length) return 0;
  let best = 0, ai = 0, bi = 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) { best = cur[j]; ai = i; bi = j; } }
    }
    prev = cur;
  }
  if (!best) return 0;
  return best + matching(a.slice(0, ai - best), b.slice(0, bi - best)) + matching(a.slice(ai), b.slice(bi));
}

export function ratio(a, b) {
  const x = normText(a), y = normText(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  if (x === y) return 1;
  return (2 * matching(x, y)) / (x.length + y.length);
}

// the first of `others` that is at least `threshold` alike, or ''
export function findSimilar(text, others, threshold) {
  const a = normText(text);
  if (!a) return '';
  for (const o of others) {
    const b = normText(o);
    if (!b) continue;
    if (a === b) return o;
    if ((2 * Math.min(a.length, b.length)) / (a.length + b.length) < threshold) continue; // cannot reach it
    if (ratio(a, b) >= threshold) return o;
  }
  return '';
}
