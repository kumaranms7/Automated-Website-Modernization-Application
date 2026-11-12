import { SEO } from '../rules.js';
import { thinLimit, isPlainType } from './page-types.js';

// 5-word shingles hashed to ints; Jaccard similarity between pages flags near-duplicates.
function shingles(textBody) {
  const w = textBody.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 5 <= w.length; i++) {
    let h = 2166136261;
    for (const ch of w.slice(i, i + 5).join(' ')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    set.add(h >>> 0);
  }
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  const [s, l] = a.size < b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of s) if (l.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// the audit's own duplicate measure for two texts (0 to 1; the audit flags 0.5 and above)
export const shingleSimilarity = (a, b) => jaccard(shingles(String(a)), shingles(String(b)));

export function auditPages(pages, siteHost) {
  const sh = pages.map((p) => shingles(p.bodyText));
  const live = pages.map((p, i) => i).filter((i) => !isPlainType(pages[i].type));

  const dupes = new Map();
  for (let x = 0; x < live.length; x++) {
    for (let y = x + 1; y < live.length; y++) {
      const [i, j] = [live[x], live[y]];
      const s = jaccard(sh[i], sh[j]);
      if (s >= 0.5) {
        (dupes.get(i) || dupes.set(i, []).get(i)).push({ path: pages[j].path, similarity: +s.toFixed(2) });
        (dupes.get(j) || dupes.set(j, []).get(j)).push({ path: pages[i].path, similarity: +s.toFixed(2) });
      }
    }
  }

  const titles = new Map();
  pages.forEach((p) => titles.set(p.title, (titles.get(p.title) || 0) + 1));

  return pages.map((p, i) => {
    const issues = [];
    const add = (code, severity, msg) => issues.push({ code, severity, msg });
    const isUtil = isPlainType(p.type);

    if (!p.title) add('title-missing', 'high', 'No <title>');
    else if (p.title.length > SEO.title.max) add('title-long', 'low', `Title ${p.title.length} chars (>${SEO.title.max})`);
    else if (p.title.length < SEO.title.min) add('title-short', 'low', `Title ${p.title.length} chars (<${SEO.title.min})`);
    if (p.title && titles.get(p.title) > 1) add('title-duplicate', 'medium', 'Title shared with other pages');
    if (!p.metaDescription) add('meta-missing', 'high', 'No meta description');
    else if (p.metaDescription.length > SEO.description.max || p.metaDescription.length < SEO.description.min)
      add('meta-length', 'low', `Meta description ${p.metaDescription.length} chars`);
    if (p.h1.length === 0) add('h1-missing', 'high', 'No H1');
    if (p.h1.length > 1) add('h1-multiple', 'medium', `${p.h1.length} H1 tags`);
    if (!p.canonical) add('canonical-missing', 'medium', 'No canonical');
    else if (siteHost && !p.canonical.includes(siteHost)) add('canonical-offsite', 'high', 'Canonical points off-site');
    if (!p.schemaTypes.length && !isUtil) add('schema-missing', 'medium', 'No structured data');
    if (p.schemaTypes.includes('INVALID_JSON')) add('schema-invalid', 'high', 'Invalid JSON-LD');

    const noAlt = p.images.filter((im) => im.alt === undefined || im.alt === '').length;
    if (noAlt) add('img-alt', 'medium', `${noAlt} image(s) without alt`);
    const noDim = p.images.filter((im) => !im.width || !im.height).length;
    if (noDim) add('img-dimensions', 'low', `${noDim} image(s) without width/height`);
    const legacy = p.images.filter((im) => /\.(jpe?g|png)(\?|$)/i.test(im.src)).length;
    if (legacy) add('img-legacy-format', 'low', `${legacy} JPG/PNG image(s) to convert`);

    // the marks of an old design
    if (p.viewport === false) add('no-viewport', 'high', 'No mobile viewport tag');
    if (p.lang === false) add('no-lang', 'low', 'No language on the html tag');
    if (p.jquery) add('legacy-jquery', 'low', 'Loads jQuery');
    if (p.stylesheets >= 5) add('many-stylesheets', 'low', `${p.stylesheets} stylesheets`);
    if (p.landmarks === false && !isUtil) add('no-landmarks', 'low', 'No header, nav, main and footer landmarks');
    if (p.htmlBytes > 150 * 1024) add('html-heavy', 'low', `${Math.round(p.htmlBytes / 1024)} KB of HTML`);

    const min = thinLimit(p.type);
    if (!isUtil && min && p.wordCount < min) add('thin-content', 'high', `${p.wordCount} words (target ≥${min})`);
    const d = dupes.get(i);
    if (d) add('duplicate-content', 'high', `Near-duplicate of ${d.length} page(s), max ${Math.max(...d.map((x) => x.similarity))}`);

    const { bodyText, ...slim } = p;
    return { ...slim, duplicates: d?.sort((a, b) => b.similarity - a.similarity).slice(0, 5) || [], issues };
  });
}
