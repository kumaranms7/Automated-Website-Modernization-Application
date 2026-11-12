import path from 'node:path';
import { isPlainType } from './page-types.js';
import { existsSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readHtml } from '../util/html.js';
import { localTarget, makeExists } from '../validate/links.js';
import { optionsOf } from '../options.js';

// Deeper checks on top of the audit, worked out from the scan of the original pages or, with { updated: true }, of the updated site:
// duplicate-content groups, internal links, pages competing for the same keyword, and accessibility problems in the page code.

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const isPage = (p) => !isPlainType(p.type) && /\.(html?|php|shtml)$/i.test(p.path);

// pages that are near-duplicates of each other, grouped (A~B and B~C make one group of three)
export function duplicateGroups(pages) {
  const byPath = new Map(pages.map((p) => [p.path, p]));
  const seen = new Set(), groups = [];
  for (const p of pages) {
    if (seen.has(p.path) || !p.duplicates?.length) continue;
    const members = new Set(), queue = [p.path], sims = [];
    while (queue.length) {
      const cur = queue.pop();
      if (members.has(cur)) continue;
      members.add(cur);
      for (const d of byPath.get(cur)?.duplicates || []) { sims.push(d.similarity); if (byPath.has(d.path)) queue.push(d.path); }
    }
    members.forEach((m) => seen.add(m));
    if (members.size > 1) groups.push({ pages: [...members].sort(), max: Math.max(...sims), avg: +(sims.reduce((a, b) => a + b, 0) / sims.length).toFixed(2) });
  }
  return groups.sort((a, b) => b.pages.length - a.pages.length || b.max - a.max);
}

// who links to whom inside the site: pages nobody links to, pages with very few links in, and links to pages that are not there
export function linkReport(pages, host) {
  const live = pages.filter(isPage);
  const known = new Set(pages.map((p) => p.path));
  const stem = (rel) => rel.replace(/\/index\.html?$/i, '/').replace(/^index\.html?$/i, '');
  const byStem = new Map(live.map((p) => [stem(p.path), p.path]));
  const inbound = new Map(live.map((p) => [p.path, new Set()]));
  const broken = [];
  for (const p of live) {
    const out = new Set();
    for (const l of p.links || []) {
      const t = localTarget(l.href || '', p.path, host);
      if (!t || t.startsWith('..')) continue;
      const hit = known.has(t) ? t : byStem.get(stem(t)) || (known.has(t + '.html') ? t + '.html' : null);
      if (hit) { if (hit !== p.path) { out.add(hit); inbound.get(hit)?.add(p.path); } }
      else if (/\.(html?|php|shtml)$/i.test(t) || !/\.[a-z0-9]{2,5}$/i.test(t)) broken.push({ from: p.path, to: t, text: (l.text || '').slice(0, 60) });
    }
    p.__out = out.size;
  }
  const rows = live.map((p) => ({ path: p.path, type: p.type, inbound: inbound.get(p.path).size, outbound: p.__out || 0 }));
  live.forEach((p) => { delete p.__out; });
  const home = (r) => /^(index\.html?|)$/i.test(r.path);
  return {
    pages: rows.sort((a, b) => a.inbound - b.inbound || a.path.localeCompare(b.path)),
    orphans: rows.filter((r) => !r.inbound && !home(r)).map((r) => r.path),
    weak: rows.filter((r) => r.inbound > 0 && r.inbound < 3 && !home(r)).map((r) => r.path),
    broken: broken.slice(0, 500), brokenTotal: broken.length,
  };
}

// pages that target the same keyword: the same main heading or the same title
export function cannibalisation(pages) {
  const groups = [];
  for (const [field, get] of [['H1', (p) => p.h1?.[0]], ['Title', (p) => p.title]]) {
    const map = new Map();
    for (const p of pages.filter(isPage)) { const k = norm(get(p)); if (k.length > 3) (map.get(k) || map.set(k, []).get(k)).push(p.path); }
    for (const [k, list] of map) if (list.length > 1) groups.push({ on: field, keyword: k, pages: list.sort() });
  }
  return groups.sort((a, b) => b.pages.length - a.pages.length);
}

const GENERIC_LINK = /^(click here|here|read more|more|learn more|link|this|details|continue)$/i;

// accessibility problems that can be seen in the page code (colour contrast needs a real browser: see the real-browser speed test)
export function accessibilityOf(html) {
  const $ = cheerio.load(html);
  const found = [];
  const count = (id, label, n) => { if (n) found.push({ id, label, count: n }); };
  count('form-label', 'Form fields without a label', $('input, select, textarea').toArray().filter((e) => {
    const t = ($(e).attr('type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(t)) return false;
    if ($(e).attr('aria-label') || $(e).attr('aria-labelledby') || $(e).attr('title')) return false;
    const id = $(e).attr('id');
    return !(id && $(`label[for="${id}"]`).length) && !$(e).closest('label').length;
  }).length);
  count('link-name', 'Links without readable text', $('a[href]').toArray().filter((e) => !$(e).text().trim() && !$(e).attr('aria-label') && !$(e).attr('title') && !$(e).find('img[alt]:not([alt=""])').length).length);
  count('link-generic', 'Links like "click here" or "read more"', $('a[href]').toArray().filter((e) => GENERIC_LINK.test($(e).text().trim())).length);
  count('button-name', 'Buttons without a name', $('button').toArray().filter((e) => !$(e).text().trim() && !$(e).attr('aria-label') && !$(e).attr('title')).length);
  count('iframe-title', 'Frames without a title', $('iframe:not([title])').length);
  count('table-header', 'Tables without header cells', $('table').toArray().filter((e) => !$(e).find('th').length).length);
  count('empty-heading', 'Empty headings', $('h1,h2,h3,h4,h5,h6').toArray().filter((e) => !$(e).text().trim()).length);
  const levels = $('h1,h2,h3,h4,h5,h6').map((_, h) => Number(h.name[1])).get();
  count('heading-order', 'Headings that skip a level', levels.filter((l, i) => i > 0 && l - levels[i - 1] > 1).length);
  count('zoom-blocked', 'Pinch-zoom switched off', /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test($('meta[name="viewport"]').attr('content') || '') ? 1 : 0);
  const ids = $('[id]').map((_, e) => $(e).attr('id')).get();
  count('duplicate-id', 'Repeated element ids', ids.length - new Set(ids).size);
  return found;
}

export async function buildInsights(slug, { updated = false } = {}) {
  const client = await loadClient(slug);
  const dir = path.join(clientDir(slug), 'scan');
  const pages = await readJson(path.join(dir, updated ? 'updated-pages.json' : 'pages.json'), []);
  if (!pages.length) throw new Error(updated ? 'Run Audit updated site first.' : 'Scan the site first.');
  const o = optionsOf(client);
  const out = { builtAt: new Date().toISOString(), updated, options: o };
  if (o.content) {
    out.duplicates = duplicateGroups(pages);
    out.links = linkReport(pages, client.host);
    // a page the scan skipped (a thank-you page, say) still exists: only links to files that are really missing are broken
    const exists = makeExists([client.sourceDir]);
    const real = [];
    for (const b of out.links.broken) if (!(await exists(b.to))) real.push(b);
    out.links.brokenTotal -= out.links.broken.length - real.length;
    out.links.broken = real;
    out.keywords = cannibalisation(pages);
  }
  // accessibility is about the page code: the design and the images
  if (o.template || o.images || o.content) {
    const rows = [];
    for (const p of pages.filter(isPage).filter((x) => !/\.php$/i.test(x.path))) {
      const saved = path.join(client.sourceDir, '_modernizer-backup', 'pre-build', ...p.path.split('/'));
      const file = !updated && existsSync(saved) ? saved : path.join(client.sourceDir, p.path);
      try { rows.push({ path: p.path, type: p.type, problems: accessibilityOf(await readHtml(file)) }); } catch { /* unreadable page: skipped */ }
    }
    out.accessibility = rows;
  }
  await writeJson(path.join(clientDir(slug), updated ? 'insights-updated.json' : 'insights.json'), out);
  return out;
}

export const loadInsights = async (slug) => ({
  before: await readJson(path.join(clientDir(slug), 'insights.json'), null),
  after: await readJson(path.join(clientDir(slug), 'insights-updated.json'), null),
});
