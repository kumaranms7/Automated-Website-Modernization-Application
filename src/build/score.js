import * as cheerio from 'cheerio';
import { seoChecks, CHECK_INFO } from '../validate/seo.js';
import { inScope } from '../options.js';

// A page's SEO score: the share of applicable checks it passes, weighted by how much each matters. The same checklist runs on the
// original page and on the rebuilt page, so "before" and "after" are directly comparable.

export const CATEGORIES = {
  'Titles, meta and social': ['title-length', 'title-unique', 'title-natural', 'meta-length', 'meta-unique', 'meta-sentence', 'canonical', 'indexable', 'viewport', 'lang', 'og-complete', 'og-sync', 'og-image-large', 'twitter-card', 'brand-consistent'],
  'Content and links': ['h1-single', 'h1-title-aligned', 'heading-order', 'word-count', 'links-internal', 'links-anchor', 'links-rel', 'tel-link', 'nap-phone', 'claims-verified'],
  Images: ['img-alt', 'img-alt-meaningful', 'img-dimensions', 'img-lazy', 'img-modern'],
  'Structured data': ['schema-valid', 'schema-match', 'schema-dupes', 'schema-business', 'schema-breadcrumb', 'schema-service', 'schema-faq'],
  'Technical and accessibility': ['landmarks', 'skip-link', 'duplicate-id', 'mixed-content', 'blocking-scripts', 'html-size'],
};
const CAT_OF = Object.fromEntries(Object.entries(CATEGORIES).flatMap(([c, ids]) => ids.map((id) => [id, c])));
const WEIGHT = { fail: 3, warn: 1 };
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 100);

export function scoreChecks(checks) {
  const cats = Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, { passed: 0, total: 0 }]));
  let got = 0, all = 0;
  for (const c of checks) {
    if (!c.applicable) continue;
    const w = WEIGHT[c.level] || 1, cat = cats[CAT_OF[c.id] || 'Technical and accessibility'];
    all += w; cat.total += w;
    if (c.ok) { got += w; cat.passed += w; }
  }
  return {
    score: pct(got, all),
    categories: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, { score: pct(v.passed, v.total), applicable: v.total > 0 }])),
    checks: checks.map((c) => ({ id: c.id, label: CHECK_INFO[c.id] || c.id, category: CAT_OF[c.id] || 'Technical and accessibility', level: c.level, ok: c.ok, applicable: c.applicable, msg: c.ok ? '' : c.msg })),
  };
}

// claims: optional extra check supplied by the caller (it needs the business profile)
// areas: the parts of the checklist that count ({ template, images, content }); without it every check counts
export function scoreHtml({ html, rel, type, host, phoneDigits, titles, metas, claims, canon, areas = null }) {
  let checks = seoChecks({ html, rel, type, host, phoneDigits, titles, metas, canon, hadFaqForm: false });
  if (areas) checks = checks.filter((c) => inScope(c.id, areas));
  if (claims && (!areas || areas.content)) checks.push({ id: 'claims-verified', ok: !claims.length, applicable: true, level: 'warn', msg: `Uses claims you said never to make: ${claims.slice(0, 4).map((c) => `"${c}"`).join('; ')}` });
  return scoreChecks(checks);
}

// the page's before/after score breakup: every check with its result on each side, grouped by category
export function breakup(before, after) {
  const byId = new Map(before.checks.map((c) => [c.id, c]));
  const rows = after.checks.map((a) => {
    const b = byId.get(a.id) || { ok: true, applicable: false, msg: '' };
    return { id: a.id, label: a.label, category: a.category, level: a.level, before: b.applicable ? b.ok : null, after: a.applicable ? a.ok : null, beforeMsg: b.msg, afterMsg: a.msg, change: !b.applicable || !a.applicable ? 'same' : b.ok === a.ok ? 'same' : a.ok ? 'fixed' : 'worse' };
  });
  return {
    before: { score: before.score, categories: before.categories }, after: { score: after.score, categories: after.categories },
    categories: Object.keys(CATEGORIES).map((name) => ({ name, before: before.categories[name], after: after.categories[name], checks: rows.filter((r) => r.category === name) })),
  };
}

// plain facts about a page, to show what the rebuild changed
export function pageFacts(html) {
  const $ = cheerio.load(html);
  const imgs = $('img').toArray();
  const src = (i) => ($(i).attr('src') || '').toLowerCase();
  const types = [];
  $('script[type="application/ld+json"]').each((_, s) => {
    try { const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { if (n['@type']) types.push(...[].concat(n['@type'])); Object.values(n).forEach(walk); } }; walk(JSON.parse($(s).text())); } catch { /* invalid JSON-LD is reported by the checks */ }
  });
  return {
    title: $('title').first().text().trim(),
    description: ($('meta[name="description"]').attr('content') || '').trim(),
    h1: $('h1').first().text().replace(/\s+/g, ' ').trim(),
    words: $('main').length ? $('main').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length : $('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length,
    images: imgs.length,
    webp: imgs.filter((i) => /\.webp(\?|$)/.test(src(i)) || /\.webp/.test($(i).attr('srcset') || '') || $(i).parent('picture').find('source[type="image/webp"]').length).length,
    srcset: imgs.filter((i) => ($(i).attr('srcset') || '').includes(' ') || $(i).parent('picture').find('source[srcset]').length).length,
    lazy: imgs.filter((i) => $(i).attr('loading') === 'lazy').length,
    sized: imgs.filter((i) => $(i).attr('width') && $(i).attr('height')).length,
    schema: [...new Set(types)],
    og: ['og:title', 'og:description', 'og:image', 'og:url'].filter((p) => $(`meta[property="${p}"]`).attr('content')).length,
    htmlKb: +(Buffer.byteLength(html) / 1024).toFixed(1),
  };
}
