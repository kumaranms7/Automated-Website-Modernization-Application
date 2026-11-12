import crypto from 'node:crypto';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readSource } from '../util/source.js';
import { skeleton } from './section-match.js';

// A site can be part modern, part old: some folders were built with Tailwind, others still use an old template. This module finds
// which pages belong to which family, so the modern pages can serve as the template for the old ones.
//
// Pages are grouped by the structure of their header and footer (the template's fingerprint), and each group is judged modern or
// legacy by how much of its markup is Tailwind (responsive and state variants, the colour scale, arbitrary values, core utilities).
// The result is saved in template/families.json; the user can override any page or folder, and chooses the Home, Inner and Contact
// template pages from the modern ones (template/own.json).

const famFile = (slug) => path.join(clientDir(slug), 'template', 'families.json');
const ownFile = (slug) => path.join(clientDir(slug), 'template', 'own.json');

const VARIANT = /^(?:sm|md|lg|xl|2xl|hover|focus|focus-within|focus-visible|group-hover|group-focus|peer-[a-z]+|dark|motion-safe|motion-reduce|print|first|last|odd|even|disabled|aria-[a-z]+|data-\[[^\]]+\]|min-\[[^\]]+\]|max-\[[^\]]+\]):/;
const PALETTE = /^(?:[\w-]+:)*(?:text|bg|border|ring|from|to|via|fill|stroke|divide|decoration|outline|shadow|accent|caret|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?$/;
const ARBITRARY = /^(?:[\w-]+:)*!?-?[a-z-]+-\[[^\]]+\]$/;
const CORE = /^(?:[\w-]+:)*(?:space-[xy]-\d|gap-(?:x-|y-)?\d|max-w-(?:xs|sm|md|lg|xl|[2-7]xl|prose|screen-\w+|full|none)|grid-cols-\d+|col-span-\d+|flex-(?:col|row|wrap|1|none)|items-(?:center|start|end|stretch)|justify-(?:between|center|end|start|around)|rounded-(?:sm|md|lg|xl|2xl|3xl|full)|shadow-(?:sm|md|lg|xl|2xl|inner)|tracking-\w+|leading-\w+|text-(?:xs|sm|base|lg|xl|[2-9]xl)|font-(?:light|medium|semibold|bold|extrabold)|sr-only|object-(?:cover|contain)|aspect-\w+|line-clamp-\d|backdrop-blur\w*|transition(?:-\w+)?|duration-\d+)$/;
const STATE = /^(active|current|open|show|selected|opened|expanded|collapsed|is-[\w-]+|menu-item-[\w-]+|current-[\w-]+|page-item|wow|animated|fadeIn\w*|slide\w*)$/i;

const isTw = (t) => VARIANT.test(t) || PALETTE.test(t) || ARBITRARY.test(t) || CORE.test(t);
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);

// what a page says about its template
export function fingerprintPage(html) {
  const $ = cheerio.load(html);
  const counts = new Map();
  $('[class]').each((_, e) => { for (const t of String($(e).attr('class')).split(/\s+/).filter(Boolean)) counts.set(t, (counts.get(t) || 0) + 1); });
  const tokens = [...counts.keys()];
  const total = tokens.length || 1;
  const tw = tokens.filter(isTw);
  const variants = tokens.filter((t) => VARIANT.test(t)).length;
  const marker = /cdn\.tailwindcss\.com/i.test(html) || $('link[rel="stylesheet"]').toArray().some((l) => /tailwind/i.test($(l).attr('href') || '')) || /tailwindcss/i.test($('style').first().text().slice(0, 400));
  const share = tw.length / total;
  const header = $('header').first().get(0) || $('[id*="header" i], [class*="header" i]').first().get(0) || null;
  const footer = $('footer').last().get(0) || $('[id*="footer" i], [class*="footer" i]').last().get(0) || null;
  const vocab = (n) => (n ? [...new Set($(n).find('[class]').addBack().toArray().flatMap((e) => String($(e).attr('class') || '').split(/\s+/).filter((t) => t && !STATE.test(t))))].sort() : []);
  const hv = vocab(header), fv = vocab(footer);
  return {
    share: +share.toFixed(3), variants, marker,
    // a modern page has many Tailwind variants and utilities; the marker alone is not enough (a page can load Tailwind and not use it)
    modern: marker ? variants >= 2 || share >= 0.2 : variants >= 4 && share >= 0.3,
    sig: md5(`${header ? skeleton(header) : 'none'}|${footer ? skeleton(footer) : 'none'}`),
    vocab: md5(`${hv.slice(0, 60).join(' ')}|${fv.slice(0, 60).join(' ')}`),
    chrome: new Set([...hv, ...fv]),
  };
}

const jaccard = (a, b) => { if (!a.size && !b.size) return 1; let i = 0; for (const x of a) if (b.has(x)) i += 1; return i / (a.size + b.size - i || 1); };
const folderOf = (rel) => (rel.includes('/') ? rel.split('/')[0] : '');

export async function detectFamilies(slug, { onProgress } = {}) {
  const client = await loadClient(slug);
  const pages = (await readJson(path.join(clientDir(slug), 'scan/pages.json'), [])).filter((p) => /\.(html?|shtml|php)$/i.test(p.path));
  if (!pages.length) throw new Error('Run the Site audit first: there are no scanned pages to look at.');
  const prev = await readJson(famFile(slug), null);
  const info = new Map();
  let i = 0;
  for (const p of pages) {
    onProgress?.({ done: i, total: pages.length, path: p.path });
    i += 1;
    try { info.set(p.path, { ...fingerprintPage(await readSource(client, p.path)), type: p.type }); } catch { /* an unreadable page is left out */ }
  }

  // group by the template fingerprint
  const byKey = new Map();
  for (const [rel, f] of info) { const k = `${f.sig}:${f.vocab}`; (byKey.get(k) || byKey.set(k, []).get(k)).push(rel); }
  let groups = [...byKey.entries()].map(([key, rels]) => {
    const fs = rels.map((r) => info.get(r));
    const modernShare = fs.filter((f) => f.modern).length / fs.length;
    return { key, rels, chrome: new Set(fs.flatMap((f) => [...f.chrome])), modern: modernShare >= 0.5, share: fs.reduce((a, f) => a + f.share, 0) / fs.length, variants: fs.reduce((a, f) => a + f.variants, 0) / fs.length };
  }).sort((a, b) => b.rels.length - a.rels.length);

  // tiny groups (a 404 page, one odd page) join the group they look most like, when they are the same kind
  const big = groups.filter((g) => g.rels.length >= 3);
  if (big.length) {
    const rest = [];
    for (const g of groups) {
      if (g.rels.length >= 3) continue;
      const best = big.filter((b) => b.modern === g.modern).map((b) => [b, jaccard(b.chrome, g.chrome)]).sort((x, y) => y[1] - x[1])[0];
      if (best && best[1] >= 0.5) best[0].rels.push(...g.rels); else rest.push(g);
    }
    groups = [...big, ...rest];
  }
  groups = groups.sort((a, b) => b.rels.length - a.rels.length);

  const pageMap = {};
  const out = groups.map((g, n) => {
    const id = `g${n + 1}`;
    const folders = {};
    for (const r of g.rels) { pageMap[r] = { group: id, family: g.modern ? 'modern' : 'legacy', share: info.get(r).share, variants: info.get(r).variants }; const f = folderOf(r); folders[f] = (folders[f] || 0) + 1; }
    const sample = g.rels.find((r) => info.get(r).type === 'home') || g.rels.find((r) => /^index\./i.test(r)) || g.rels[0];
    return { id, family: g.modern ? 'modern' : 'legacy', pages: g.rels.length, share: +g.share.toFixed(2), variants: +g.variants.toFixed(1), sample, folders: Object.entries(folders).map(([folder, count]) => ({ folder, count })).sort((a, b) => b.count - a.count) };
  });

  const data = { detectedAt: new Date().toISOString(), pages: Object.keys(pageMap).length, groups: out, pageMap, overrides: prev?.overrides || {} };
  await writeJson(famFile(slug), data);
  return data;
}

export const loadFamilies = (slug) => readJson(famFile(slug), null);

// the family a page is treated as: its own override, else the longest folder override, else what was detected
export function familyOf(data, rel) {
  const o = data.overrides || {};
  if (o[rel]) return o[rel];
  const parts = rel.split('/');
  for (let n = parts.length - 1; n >= 1; n -= 1) { const k = `${parts.slice(0, n).join('/')}/`; if (o[k]) return o[k]; }
  if (parts.length === 1 && o['/']) return o['/'];
  return data.pageMap[rel]?.family || null;
}

// target: a page path, a folder ("folder/"), or "/" for the files in the site root. family: modern | legacy | auto (clears it)
export async function setOverride(slug, target, family) {
  const data = await loadFamilies(slug);
  if (!data) throw new Error('Detect the templates first.');
  if (!['modern', 'legacy', 'auto'].includes(family)) throw new Error('The family must be modern, legacy or auto.');
  const t = String(target || '');
  if (!t || t.includes('..')) throw new Error('Choose a page or a folder.');
  if (family === 'auto') delete data.overrides[t]; else data.overrides[t] = family;
  await writeJson(famFile(slug), data);
  return data;
}

// ---- how this site gets its template ----
//   platform  design a new template with the platform (the AI designer, variants and composer)
//   existing  build the template from the site's own modern pages (this module)
// A site that has not chosen yet is asked, unless it already has a template of its own (then it is a platform site).
const typeFile = (slug) => path.join(clientDir(slug), 'template', 'type.json');
export async function getTemplateType(slug) {
  const saved = await readJson(typeFile(slug), null);
  if (saved && 'type' in saved) return saved.type;
  const has = await Promise.all(['final.json', 'current.json'].map((f) => readJson(path.join(clientDir(slug), 'template', f), null)));
  return has.some(Boolean) ? 'platform' : '';
}
export async function setTemplateType(slug, type) {
  if (!['platform', 'existing', ''].includes(type)) throw new Error('Choose how to create the template.');
  await writeJson(typeFile(slug), { type, chosenAt: new Date().toISOString() });
  return type;
}

// ---- the three template pages ----
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export async function ownState(slug) {
  const data = await loadFamilies(slug);
  const own = await readJson(ownFile(slug), { enabled: false, home: '', inner: '', contact: '' });
  if (!data) return { detected: false, selection: own };
  const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const by = new Map(scan.map((p) => [p.path, p]));
  const modern = Object.keys(data.pageMap).filter((r) => familyOf(data, r) === 'modern').map((r) => by.get(r)).filter(Boolean);
  const legacy = Object.keys(data.pageMap).filter((r) => familyOf(data, r) === 'legacy');
  const row = (p, why = '') => ({ path: p.path, title: p.title || '', words: p.wordCount || 0, type: p.type, why });
  const homes = modern.map((p) => ({ p, s: (p.type === 'home' ? 100 : 0) + (/^index\.(html?|php)$/i.test(p.path) ? 60 : 0) + (p.path.split('/').length === 1 ? 5 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => row(x.p, x.p.type === 'home' ? 'Detected as the home page' : 'Site root index page'));
  const contacts = modern.map((p) => {
    const hay = `${p.path} ${p.h1?.[0] || ''} ${p.title}`.toLowerCase();
    return { p, s: (/contact/.test(hay) ? 6 : 0) + (/schedule|quote|book|appointment|get-in-touch/.test(hay) ? 3 : 0) + (p.forms?.length ? 3 : 0) + (p.wordCount < 400 ? 2 : 0) - (/thank/.test(hay) ? 8 : 0) };
  }).filter((x) => x.s >= 5).sort((a, b) => b.s - a.s).map((x) => row(x.p, `Looks like the contact page${x.p.forms?.length ? ' (has a form)' : ''}`));
  const content = modern.filter((p) => ['service', 'location-service', 'location-hub'].includes(p.type));
  const med = median(content.map((p) => p.wordCount));
  const inners = content.map((p) => ({ p, s: Math.min(p.h2?.length || 0, 6) * 2 + (p.images?.length ? 2 : 0) - Math.abs(p.wordCount - med) / Math.max(med, 1) * 4 })).sort((a, b) => b.s - a.s).map((x) => row(x.p, `Typical content page: ${x.p.wordCount} words, ${x.p.h2?.length || 0} sections`));
  const legacyRows = Object.keys(data.pageMap).filter((r) => familyOf(data, r) === 'legacy').map((r) => by.get(r)).filter(Boolean);
  const lhome = legacyRows.map((p) => ({ p, s: (p.type === 'home' ? 100 : 0) + (/^index\.(html?|php)$/i.test(p.path) ? 60 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0]?.p.path || '';
  const lcontact = legacyRows.map((p) => { const hay = `${p.path} ${p.h1?.[0] || ''} ${p.title}`.toLowerCase(); return { p, s: (/contact/.test(hay) ? 6 : 0) + (/schedule|quote|book|appointment|get-in-touch/.test(hay) ? 3 : 0) + (p.forms?.length ? 3 : 0) - (/thank/.test(hay) ? 8 : 0) }; }).filter((x) => x.s >= 5).sort((a, b) => b.s - a.s)[0]?.p.path || '';
  const lmed = median(legacyRows.filter((p) => ['service', 'location-service', 'location-hub'].includes(p.type)).map((p) => p.wordCount));
  const linner = legacyRows.filter((p) => ['service', 'location-service', 'location-hub'].includes(p.type)).map((p) => ({ p, s: -Math.abs(p.wordCount - lmed) / Math.max(lmed, 1) + Math.min(p.h2?.length || 0, 6) / 6 })).sort((a, b) => b.s - a.s)[0]?.p.path || '';
  return {
    detected: true, detectedAt: data.detectedAt, selection: own,
    legacyPages: legacyRows.map((p) => row(p)).sort((a, b) => a.path.localeCompare(b.path)),
    legacySuggested: { home: lhome, inner: linner || legacyRows[0]?.path || '', contact: lcontact },
    summary: { modern: modern.length, legacy: legacy.length, pages: data.pages },
    groups: data.groups, overrides: data.overrides,
    folders: folderTable(data),
    candidates: { home: homes.slice(0, 8), inner: inners.slice(0, 8), contact: contacts.slice(0, 8) },
    modernPages: modern.map((p) => row(p)).sort((a, b) => a.path.localeCompare(b.path)),
    suggested: { home: homes[0]?.path || '', inner: inners[0]?.path || '', contact: contacts[0]?.path || '' },
  };
}

// one row per top-level folder (and the files in the site root), with how many pages are modern and legacy now
function folderTable(data) {
  const rows = new Map();
  for (const rel of Object.keys(data.pageMap)) {
    const f = folderOf(rel);
    const r = rows.get(f) || rows.set(f, { folder: f, key: f ? `${f}/` : '/', total: 0, modern: 0, legacy: 0, detected: { modern: 0, legacy: 0 } }).get(f);
    r.total += 1; r[familyOf(data, rel)] += 1; r.detected[data.pageMap[rel].family] += 1;
  }
  return [...rows.values()].map((r) => ({ ...r, override: data.overrides[r.key] || 'auto' })).sort((a, b) => b.total - a.total);
}

// the section (of any modern page) the user chose as the design of a kind of section; design null goes back to automatic
export async function saveDesign(slug, kind, design) {
  if (!['cards', 'faq', 'reviews', 'links', 'cta'].includes(kind)) throw new Error('Unknown section kind.');
  const own = await readJson(ownFile(slug), null);
  if (!own) throw new Error('Choose and save the template pages first.');
  own.designs = { ...(own.designs || {}) };
  if (design && (!design.page || !design.key)) throw new Error('Choose a page and a section.');
  if (design) own.designs[kind] = { page: String(design.page), key: String(design.key) }; else delete own.designs[kind];
  await writeJson(ownFile(slug), own);
}

// a generated design the user refined in the chat; null goes back to the plain generated design
export async function saveRefined(slug, kind, rec) {
  const own = await readJson(ownFile(slug), null);
  if (!own) throw new Error('Choose and save the template pages first.');
  own.refined = { ...(own.refined || {}) };
  if (rec) own.refined[kind] = rec; else delete own.refined[kind];
  await writeJson(ownFile(slug), own);
}

// the roles the user gave to the sections of one template page: { sectionKey: 'text' | 'band' | 'cards' | ... }
export async function saveRoles(slug, layout, roles) {
  if (!['home', 'inner', 'contact'].includes(layout)) throw new Error('Choose home, inner or contact.');
  const own = await readJson(ownFile(slug), null);
  if (!own?.[layout]) throw new Error('Choose and save the template pages first.');
  const clean = {};
  for (const [k, v] of Object.entries(roles || {})) if (/^[\w-]{1,80}$/.test(k) && ['hero', 'text', 'band', 'common', 'cards', 'faq', 'reviews', 'cta', 'form', 'drop'].includes(v)) clean[k] = v;
  own.roles = { ...(own.roles || {}), [layout]: clean };
  await writeJson(ownFile(slug), own);
  return own.roles[layout];
}

export async function saveOwn(slug, input) {
  const data = await loadFamilies(slug);
  if (!data) throw new Error('Detect the templates first.');
  const prev = await readJson(ownFile(slug), {});
  const out = { enabled: Boolean(input.enabled), savedAt: new Date().toISOString(), roles: {}, designs: prev.designs || {}, refined: prev.refined || {} };
  for (const k of ['home', 'inner', 'contact']) {
    const p = String(input[k] || '');
    if (p && familyOf(data, p) !== 'modern') throw new Error(`${p} is not a modern page, so it cannot be a template page.`);
    out[k] = p;
    // the roles belong to the page they were chosen on
    if (p && p === prev[k] && prev.roles?.[k]) out.roles[k] = prev.roles[k];
  }
  if (out.enabled && !out.home && !out.inner && !out.contact) throw new Error('Choose at least one template page first.');
  await writeJson(ownFile(slug), out);
  return out;
}
