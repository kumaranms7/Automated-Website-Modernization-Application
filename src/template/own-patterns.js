import path from 'node:path';
import * as cheerio from 'cheerio';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readSource } from '../util/source.js';
import { esc } from '../util/html.js';
import { loadFamilies, familyOf, saveDesign, saveRefined } from './families.js';
import { callTool } from '../ai/claude.js';
import { regions, unitsOf, classify, proseHost, styleMap, unitKey } from './own-convert.js';
import { fillPattern } from './own-fill.js';
export { fillPattern };

// The section designs of the template. A legacy page has cards, FAQs, reviews and link lists; the template page has its own design for
// each of them. This module learns those designs from the template pages (a "recipe": the section markup with slots for the title and
// the items) and, for a kind the template does not show, generates a recipe in the same theme from the classes the template uses.
// Generated recipes use only class names that already appear on the site's modern pages, so the compiled stylesheet styles them.
// The library is stored per site (template/patterns.json) and reused for every page converted afterwards.
//
// Slots are marked with data-slot="name [name2]":
//   title, items (the container the items are put in), link (href), label (text), text, img, icon,
//   q, a (faq), quote, name (reviews), btn (call-to-action button: href and text)

export const KINDS = ['cards', 'faq', 'reviews', 'links', 'cta'];
export const KIND_LABEL = { cards: 'Cards (services, features)', faq: 'FAQ (questions and answers)', reviews: 'Reviews', links: 'Link lists (related pages, areas)', cta: 'Call-to-action band' };
const patFile = (slug) => path.join(clientDir(slug), 'template', 'patterns.json');
const SKIP = new Set(['script', 'style', 'noscript', 'link', 'meta', 'template']);
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const kidsOf = ($, e) => $(e).children().toArray().filter((c) => c.type === 'tag' && !SKIP.has(c.name));
const sig = ($, e) => `${e.name}.${(norm($(e).attr('class')).split(' ')[0] || '')}`;
const HEAD = 'h2, h3, h4, h5, h6';

// the element whose children are the most similar repeated items that pass the test
function findRepeated($, root, min, test, bonus = () => 0) {
  let best = null;
  $(root).find('*').addBack().each((_, e) => {
    if (SKIP.has(e.name)) return;
    const kids = kidsOf($, e);
    if (kids.length < min) return;
    const counts = new Map();
    for (const k of kids) counts.set(sig($, k), (counts.get(sig($, k)) || 0) + 1);
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const lead = kids.filter((k) => /^(h[1-6]|p)$/.test(k.name)).length;
    if (n < min || n < (kids.length - lead) * 0.8) return;
    const items = kids.filter((k) => sig($, k) === top);
    if (!items.every(test($))) return;
    const score = items.length + bonus($, items[0]);
    if (!best || score > best.score) best = { el: e, items, score };
  });
  return best;
}

const TEXT_SLOTS = ['title', 'text', 'q', 'a', 'quote', 'name'];
function blank($, root) {
  root.find('[data-slot]').addBack('[data-slot]').each((_, e) => {
    const slots = ($(e).attr('data-slot') || '').split(' ');
    if (slots.some((t) => TEXT_SLOTS.includes(t)) && !slots.includes('items') && !slots.includes('link') && !slots.includes('btn')) $(e).empty();
  });
  return root;
}
const indexIn = ($, root, el) => (el === root ? -1 : $(root).find('*').toArray().indexOf(el));
const atIndex = ($, clone, i) => (i < 0 ? clone : $(clone.find('*').toArray()[i]));
const mark = (el, slot) => { const cur = (el.attr('data-slot') || '').split(' ').filter(Boolean); if (!cur.includes(slot)) cur.push(slot); el.attr('data-slot', cur.join(' ')); };

// the section without its own content: the container is emptied, the title becomes a slot, loose text and links are removed
function wrapperFrom($, unit, container, items = null) {
  const clone = $(unit).clone();
  const idx = indexIn($, unit, container);
  const box = atIndex($, clone, idx);
  if (items) {
    const all = $(container).children().toArray();
    const drop = items.map((it) => all.indexOf(it));
    box.children().toArray().forEach((c, i) => { if (drop.includes(i)) $(c).remove(); });
  } else box.empty();
  mark(box, 'items');
  const title = clone.find(HEAD).filter((_, h) => !box.is(h) && !$(h).find(box).length).first();
  if (title.length) mark(title, 'title');
  const loose = (_, e) => !$(e).is('[data-slot]') && !$(e).closest('[data-slot~="title"]').length && !$(e).find('[data-slot~="items"]').length;
  clone.find('p, ul, ol, figure, img, form, blockquote, details, button, a').filter(loose).remove();
  stripStatic($, clone); // labels and captions of the template page's own subject
  return $.html(blank($, clone));
}

// the item's loose text: the first piece becomes the text slot, the rest goes
function textSlot($, item, title) {
  let done = false;
  for (const n of item.find('*').addBack().contents().toArray()) {
    if (n.type !== 'text' || !norm(n.data) || (title.length && ($(n).parent().is(title) || $(n).parents().is(title)))) continue;
    if (!done) { const sep = (n.data.match(/^\s*([–—:-]\s*)/) || [])[1] || ''; $(n).replaceWith(`${sep ? ` ${sep}` : ' '}<span data-slot="text"></span>`); done = true; } else $(n).remove();
  }
  return done;
}
function stripStatic($, root) {
  root.find('*').toArray().reverse().forEach((e) => {
    const el = $(e);
    if (el.is('[data-slot]') || el.closest('[data-slot]').length || el.find('[data-slot]').length) return;
    const own = norm(el.contents().toArray().filter((n) => n.type === 'text').map((n) => n.data).join(' '));
    if (own && !/^[^\w]{1,2}$/.test(own)) el.remove();
  });
}

// ---- learning a kind from a template section ----
function cardsFrom($, unit) {
  const rep = findRepeated($, unit, 3, ($) => (k) => !['p', 'span', 'dt', 'dd'].includes(k.name) && ($(k).find('h2, h3, h4, h5, h6').length > 0 || ($(k).find('strong, b').length > 0 && $(k).find('p, img').length > 0)) && ($(k).find('p, img').length > 0 || norm($(k).text()).length > 25), ($, k) => (k.name === 'li' ? -2 : 0) + ($(k).find('p').length ? 4 : 0) + ($(k).find('img').length ? 2 : 0) + ($(k).find('h2, h3, h4, h5, h6').length ? 3 : 0));
  if (!rep) return null;
  // a plain checklist (list items with a bold lead-in and a sentence) is not a card design
  if (rep.items[0].name === 'li' && !$(rep.items[0]).find('p, img').length) return null;
  const item = $(rep.items[0]).clone();
  const h = item.find(HEAD).first().length ? item.find(HEAD).first() : item.find('strong, b').first();
  mark(h, 'title');
  const p = item.find('p').filter((_, e) => !$(e).closest(h).length).first();
  if (p.length) mark(p, 'text'); else textSlot($, item, h);
  item.find('p, ul, ol').not(p).remove();
  const link = item.is('a') ? item : item.find('a[href]').first();
  if (link.length) mark(link, 'link');
  const img = item.find('img').filter((_, e) => !/\.svg(\?|$)/i.test($(e).attr('src') || '')).first();
  if (img.length) mark(img, 'img');
  const icon = item.find('img').filter((_, e) => /\.svg(\?|$)/i.test($(e).attr('src') || '')).first();
  if (icon.length) mark(icon, 'icon');
  stripStatic($, item);
  return { score: rep.score, wrapperHtml: wrapperFrom($, unit, rep.el, rep.items), itemHtml: $.html(blank($, item)) };
}

function faqFrom($, unit) {
  const rep = findRepeated($, unit, 2, ($) => (k) => k.name === 'details' || /faq|accordion/i.test($(k).attr('class') || ''));
  if (!rep) return null;
  const item = $(rep.items[0]).clone();
  let q, a;
  if (item.is('details')) {
    const s = item.children('summary').first();
    if (!s.length) return null;
    const own = s.contents().toArray().find((n) => n.type === 'text' && norm(n.data));
    if (own) { $(own).replaceWith('<span data-slot="q"></span>'); q = s.find('[data-slot="q"]').first(); } else {
      q = s.children().filter((_, c) => c.type === 'tag' && norm($(c).text()) && !/^[^\w]{1,2}$/.test(norm($(c).text()))).first();
      if (!q.length) q = s;
    }
    a = item.children().not(s).first();
  } else {
    const k = item.children().toArray().filter((c) => c.type === 'tag');
    if (k.length < 2) return null;
    q = $(k[0]); a = $(k[1]);
  }
  if (!a.length) return null;
  mark(q, 'q'); mark(a, 'a');
  item.children().not(q.closest(item.children())).not(a).not(item.children().filter((_, c) => $(c).find(q).length)).remove();
  stripStatic($, item);
  return { score: rep.score, wrapperHtml: wrapperFrom($, unit, rep.el, rep.items), itemHtml: $.html(blank($, item)) };
}

function reviewsFrom($, unit) {
  const rep = findRepeated($, unit, 2, ($) => (k) => {
    const cls = `${$(k).attr('class') || ''} ${$(k).find('[class]').map((_, e) => $(e).attr('class')).get().join(' ')}`;
    if ($(k).find('blockquote').length > 0 || /review|testimonia|quote/i.test(cls)) return true;
    return /client|customer/i.test(cls) && $(k).find('p').length > 0 && $(k).text().trim().split(/\s+/).length >= 12;
  });
  if (!rep) return null;
  const item = $(rep.items[0]).clone();
  const q = item.find('blockquote p').first().length ? item.find('blockquote p').first() : item.find('blockquote').first().length ? item.find('blockquote').first() : item.find('p').first();
  if (!q.length) return null;
  mark(q, 'quote');
  const name = item.find('cite, figcaption, footer, h4, h5, h6, strong, b').not(q).last();
  if (name.length && !$(name).closest(q).length) mark(name, 'name');
  item.find('img, picture').each((_, e) => { const f = $(e).closest('figure'); (f.length && !f.find('[data-slot]').length ? f : $(e)).remove(); });
  const keep = new Set([q.get(0), ...(name.length ? [name.get(0)] : [])]);
  item.find('p').each((_, e) => { if (!keep.has(e) && !$(e).find('[data-slot]').length && !$(e).closest('[data-slot]').length) $(e).remove(); });
  stripStatic($, item);
  return { score: rep.score, wrapperHtml: wrapperFrom($, unit, rep.el, rep.items), itemHtml: $.html(blank($, item)) };
}

function ctaFrom($, unit) {
  const clone = $(unit).clone();
  const title = clone.find(`${HEAD}, p.font-display, p.font-bold, p[class*="text-2xl"], p[class*="text-3xl"]`).first().length ? clone.find(`${HEAD}, p.font-display, p.font-bold, p[class*="text-2xl"], p[class*="text-3xl"]`).first() : clone.find('p').first();
  if (!title.length) return null;
  mark(title, 'title');
  const text = clone.find('p').not(title).first();
  if (text.length) mark(text, 'text');
  const btn = clone.find('a[href^="tel:"]').first().length ? clone.find('a[href^="tel:"]').first() : clone.find('a').first();
  if (!btn.length) return null;
  mark(btn, 'btn');
  return { wrapperHtml: $.html(blank($, clone)) };
}

// a list of links (related pages, areas served): four or more short links, each in its own item
function linksFrom($, unit) {
  const rep = findRepeated($, unit, 4, ($) => (k) => ['li', 'a', 'div', 'span'].includes(k.name) && ($(k).is('a') ? $(k) : $(k).find('a[href]').first()).length > 0 && norm($(k).text()).split(' ').length <= 8 && !$(k).find('p, img, h2, h3, h4, h5').length);
  if (!rep) return null;
  const item = $(rep.items[0]).clone();
  const link = item.is('a') ? item : item.find('a[href]').first();
  mark(link, 'link'); mark(link, 'label');
  stripStatic($, item);
  return { score: rep.score, wrapperHtml: wrapperFrom($, unit, rep.el, rep.items), itemHtml: $.html(blank($, item)) };
}

// ---- generating a kind in the template's theme ----
function kitOf($, tpl, vocab) {
  const has = (t) => vocab.has(t);
  const pick = (c) => c.find(has) || '';
  const cls = (...parts) => parts.flat().filter(Boolean).join(' ');
  const content = $(tpl.content.el);
  const wrap = content.children('div, section').first();
  const layoutOnly = /^(?:grid|flex|inline-flex|items-.+|justify-.+|gap(?:-[xy])?-.+|(?:[a-z]+:)?grid-cols-.+|(?:[a-z]+:)?col-span-.+|(?:[a-z]+:)?flex-.+)$/;
  const container = wrap.length ? norm(wrap.attr('class')).split(' ').filter((t) => !layoutOnly.test(t)).join(' ') : '';
  const sectionWide = /max-w-/.test(norm(content.attr('class')));
  const st = tpl.styles;
  const band = tpl.cta.length ? $(tpl.cta[tpl.cta.length - 1].el) : null;
  const btn = [...$(tpl.region).find('a[class*="bg-"]').toArray(), ...$('a[class*="bg-"]').toArray()].map((a) => norm($(a).attr('class'))).find((c) => /px-/.test(c)) || '';
  return {
    section: norm(content.attr('class')) || 'py-12',
    container: container || (sectionWide ? '' : cls(pick(['mx-auto']), pick(['max-w-5xl', 'max-w-6xl', 'max-w-7xl']), pick(['px-4']))),
    h2: st.h2 || '', h3: st.h3 || st.h2 || '', p: st.p || '', a: st.a || '',
    card: cls(pick(['rounded-xl', 'rounded-lg', 'rounded-2xl', 'rounded-md']), pick(['border', 'border-slate-200', 'border-gray-200']), pick(['p-6', 'p-5', 'p-4']), pick(['shadow-sm', 'shadow', 'shadow-md']), pick(['bg-surface'])),
    grid: cls('grid', pick(['gap-6', 'gap-5', 'gap-4', 'gap-8']), pick(['md:grid-cols-2', 'sm:grid-cols-2']), pick(['lg:grid-cols-3', 'md:grid-cols-3'])),
    stack: cls('grid', pick(['gap-3', 'gap-4', 'space-y-3', 'space-y-4'])),
    btn: btn || cls(pick(['inline-block', 'inline-flex']), pick(['rounded', 'rounded-lg', 'rounded-md']), pick(['bg-orange-500', 'bg-sky-600', 'bg-blue-600']), pick(['px-4', 'px-5', 'px-6']), pick(['py-2', 'py-3']), pick(['font-semibold', 'font-bold']), pick(['text-on-dark'])),
    band: band ? norm(band.attr('class')) : '',
  };
}

const c = (v) => (v ? ` class="${esc(v)}"` : '');
function generate(kind, k) {
  const section = (inner) => `<section${c(k.section)}><div${c(k.container)}><h2 data-slot="title"${c(k.h2)}></h2>${inner}</div></section>`;
  switch (kind) {
    case 'cards': return { wrapperHtml: section(`<div data-slot="items"${c(k.grid)}></div>`), itemHtml: `<div${c(k.card)}><h3 data-slot="title"${c(k.h3)}></h3><p data-slot="text"${c(k.p)}></p><a data-slot="link"${c(k.a)}>Learn more</a></div>` };
    case 'faq': return { wrapperHtml: section(`<div data-slot="items"${c(k.stack)}></div>`), itemHtml: `<details${c(k.card)}><summary data-slot="q"${c(k.h3)}></summary><div data-slot="a"${c(k.p)}></div></details>` };
    case 'reviews': return { wrapperHtml: section(`<div data-slot="items"${c(k.grid)}></div>`), itemHtml: `<figure${c(k.card)}><blockquote data-slot="quote"${c(k.p)}></blockquote><figcaption data-slot="name"${c(k.h3)}></figcaption></figure>` };
    case 'links': return { wrapperHtml: section(`<ul data-slot="items"${c(k.grid)}></ul>`), itemHtml: `<li><a data-slot="link label"${c(k.a)}></a></li>` };
    case 'cta': return { wrapperHtml: `<section${c(k.band || k.section)}><div${c(k.container)}><p data-slot="title"${c(k.h2)}></p><p data-slot="text"${c(k.p)}></p><a data-slot="btn"${c(k.btn)}></a></div></section>` };
    default: return null;
  }
}

// which design a section is (or null): used to label the template's sections
export function kindOfUnit($, unit) {
  for (const [kind, fn] of [['cards', cardsFrom], ['faq', faqFrom], ['reviews', reviewsFrom], ['links', linksFrom]]) if (fn($, unit)) return kind;
  return null;
}

// the section designs found on one page: { cards, faq, reviews, cta }
export function learnPatterns(html) {
  const $ = cheerio.load(html);
  const { header, footer, region } = regions($);
  const units = unitsOf($, region, header, footer);
  const cl = classify($, units);
  const out = {};
  const skip = [cl.hero?.el, cl.content?.el];
  for (const [kind, fn] of [['cards', cardsFrom], ['faq', faqFrom], ['reviews', reviewsFrom]]) {
    for (const u of units.filter((x) => !skip.includes(x))) { const r = fn($, u); if (r) { out[kind] = { kind, source: 'template', ...r }; break; } }
  }
  const band = cl.cta[cl.cta.length - 1];
  if (band) { const r = ctaFrom($, band.el); if (r) out.cta = { kind: 'cta', source: 'template', ...r }; }
  return out;
}

// ---- the library ----
async function readTemplates(slug) {
  const own = await readJson(path.join(clientDir(slug), 'template', 'own.json'), null);
  if (!own) throw new Error('Choose and save the template pages first.');
  const roleMap = own.roles || {};
  const client = await loadClient(slug);
  const pages = {};
  for (const layout of ['inner', 'home', 'contact']) {
    const rel = own[layout];
    if (!rel) continue;
    const $ = cheerio.load(await readSource(client, rel));
    const { header, footer, region } = regions($);
    const units = unitsOf($, region, header, footer);
    const cl = classify($, units);
    if (!cl.hero) continue;
    const host = cl.content ? proseHost($, cl.content.el) : null;
    pages[layout] = { rel, $, region, units, ...cl, host, roles: roleMap[layout] || {}, styles: cl.content ? styleMap($, host || cl.content.el, region.get(0)) : {} };
  }
  if (!Object.keys(pages).length) throw new Error('None of the template pages could be read.');
  return { pages, client };
}

async function vocabulary(slug) {
  const fam = await loadFamilies(slug);
  const client = await loadClient(slug);
  const set = new Set();
  const modern = Object.keys(fam?.pageMap || {}).filter((r) => familyOf(fam, r) === 'modern').slice(0, 60);
  for (const r of modern) {
    try { const $ = cheerio.load(await readSource(client, r)); $('[class]').each((_, e) => { for (const t of String($(e).attr('class')).split(/\s+/)) if (t) set.add(t); }); } catch { /* skip */ }
  }
  return set;
}

// the headings the modern pages put over a group of cards ("Industries Served" over six industry cards), so an old page whose cards
// have no heading gets the one its own site already uses for them
async function titleHints(slug) {
  const fam = await loadFamilies(slug), client = await loadClient(slug), out = [];
  for (const r of Object.keys(fam?.pageMap || {}).filter((x) => familyOf(fam, x) === 'modern').slice(0, 60)) {
    try {
      const { $, units } = await sectionsOf(slug, r);
      for (const u of units) {
        const heading = $(u).find('h2').first().text().replace(/\s+/g, ' ').trim();
        const items = $(u).find('h3').toArray().map((h) => $(h).text().replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);
        if (heading && items.length >= 3 && !out.some((o) => o.heading === heading)) out.push({ heading, items });
      }
    } catch { /* skip the page */ }
  }
  return out.slice(0, 60);
}

export async function buildPatterns(slug, { only } = {}) {
  const { pages } = await readTemplates(slug);
  const vocab = await vocabulary(slug);
  const prev = await readJson(patFile(slug), null);
  const keep = prev?.patterns && only;
  const lib = keep ? { ...prev.patterns } : {};
  const byLayout = keep ? JSON.parse(JSON.stringify(prev.byLayout || {})) : {};
  const order = ['inner', 'home', 'contact'].filter((l) => pages[l]);
  const FROM = { cards: cardsFrom, faq: faqFrom, reviews: reviewsFrom, links: linksFrom };
  const kinds = only ? [only] : KINDS;
  const ownCfg = await readJson(path.join(clientDir(slug), 'template', 'own.json'), {});
  const clean = (r, t) => { const { score, ...rest } = r; return { kind: rest.kind, source: 'template', page: t.rel, ...rest, builtAt: new Date().toISOString() }; };
  for (const kind of kinds) {
    delete lib[kind];
    for (const l of Object.keys(byLayout)) delete byLayout[l]?.[kind];
    let best = null;
    for (const layout of order) {
      const t = pages[layout];
      const keyed = t.units.map((u, i) => [u, t.roles[unitKey(t.$, u, i)]]);
      const marked = (role) => keyed.filter(([, r]) => r === role).map(([u]) => u);
      const free = keyed.filter(([u, r]) => !r && ![t.hero?.el, t.content?.el].includes(u)).map(([u]) => u);
      // a section the user marked as this design is used first; sections they gave another role are not learned from
      const units = kind === 'cta' ? [...marked('cta'), ...t.cta.slice(-1).map((x) => x.el)] : [...marked(kind), ...free];
      let mine = null;
      for (const u of units) {
        const r = kind === 'cta' ? ctaFrom(t.$, u) : FROM[kind]?.(t.$, u);
        if (!r) continue;
        const chosen = marked(kind).includes(u);
        const score = chosen ? 1e6 : r.score ?? 0;
        if (!mine || score > (mine.score ?? 0)) mine = { ...r, kind, score };
      }
      // a page converted with this layout uses the design of this layout's own template page
      if (mine) { (byLayout[layout] ||= {})[kind] = clean(mine, t); if (!best || (layout === 'inner') || (mine.score ?? 0) > (best.r.score ?? 0)) best = { r: mine, t }; }
    }
    if (best) lib[kind] = clean(best.r, best.t);
  }
  // a section the user chose from any page is the design of its kind, on every layout
  for (const kind of kinds) {
    const d = ownCfg.designs?.[kind];
    if (!d) continue;
    try { lib[kind] = await learnFromSection(slug, kind, d.page, d.key); for (const l of Object.keys(byLayout)) delete byLayout[l]?.[kind]; } catch { /* the chosen section is gone: the automatic design stays */ }
  }
  for (const kind of kinds) { const r = ownCfg.refined?.[kind]; if (r && !ownCfg.designs?.[kind]) { lib[kind] = { kind, source: 'generated', page: (pages.inner || pages[order[0]]).rel, ...r, builtAt: new Date().toISOString() }; for (const l of Object.keys(byLayout)) delete byLayout[l]?.[kind]; } }
  const base = pages.inner || pages[order[0]];
  const kit = base.content ? kitOf(base.$, base, vocab) : null;
  if (kit) for (const kind of kinds) if (!lib[kind]) lib[kind] = { kind, source: 'generated', page: base.rel, ...generate(kind, kit), builtAt: new Date().toISOString() };
  const ownNow = await readJson(path.join(clientDir(slug), 'template', 'own.json'), {});
  const out = { v: 3, roles: JSON.stringify({ roles: ownNow.roles || {}, designs: ownNow.designs || {} }), builtAt: new Date().toISOString(), classes: vocab.size, vocab: [...vocab], titleHints: await titleHints(slug), templates: Object.fromEntries(['inner', 'home', 'contact'].map((l) => [l, pages[l]?.rel || ''])), patterns: lib, byLayout };
  await writeJson(patFile(slug), out);
  return out;
}

// regenerate one kind: from the template pages again, or as a new design in the template's theme
export async function resetPattern(slug, kind, source) {
  if (!KINDS.includes(kind)) throw new Error('Unknown section kind.');
  if (!['template', 'generated'].includes(source)) throw new Error('Choose the template design or a generated one.');
  await saveDesign(slug, kind, null);
  await saveRefined(slug, kind, null);
  if (source === 'template') {
    const lib = await buildPatterns(slug, { only: kind });
    if (lib.patterns[kind]?.source !== 'template') throw new Error(`None of the template pages has a ${KIND_LABEL[kind].split(' (')[0].toLowerCase()} section to learn from.`);
    return lib;
  }
  const { pages } = await readTemplates(slug);
  const vocab = await vocabulary(slug);
  const base = pages.inner || Object.values(pages)[0];
  const lib = await readJson(patFile(slug), { patterns: {} });
  lib.patterns[kind] = { kind, source: 'generated', page: base.rel, ...generate(kind, kitOf(base.$, base, vocab)), builtAt: new Date().toISOString() };
  for (const l of Object.keys(lib.byLayout || {})) delete lib.byLayout[l]?.[kind]; // the generated design is used on every layout
  lib.builtAt = new Date().toISOString();
  await writeJson(patFile(slug), lib);
  return lib;
}

// ---- refining a generated design in the chat ----
const REFINE_TOOL = {
  name: 'set_design',
  description: 'Return the changed section design.',
  input_schema: { type: 'object', properties: { reply: { type: 'string', description: 'One or two plain sentences telling the user what you changed, or why you could not.' }, wrapperHtml: { type: 'string' }, itemHtml: { type: 'string', description: 'The markup of one item; empty for a call-to-action band' } }, required: ['reply', 'wrapperHtml'] },
};
const slotNames = (html) => { const $ = cheerio.load(html || '', null, false); return new Set($('[data-slot]').toArray().flatMap((e) => String($(e).attr('data-slot')).split(/\s+/))); };
const tokens = (html) => { const $ = cheerio.load(html || '', null, false); return new Set($('[class]').toArray().flatMap((e) => String($(e).attr('class')).split(/\s+/)).filter(Boolean)); };
// only classes the site's stylesheet has survive, and nothing that runs
function tidy(html, allowed) {
  const $ = cheerio.load(html || '', null, false);
  $('script, style, iframe, object, embed').remove();
  let dropped = 0;
  $('*').each((_, e) => {
    for (const a of Object.keys(e.attribs || {})) if (/^on/i.test(a) || a === 'style' || (/^(href|src)$/i.test(a) && /^\s*javascript:/i.test(e.attribs[a]))) $(e).removeAttr(a);
    if (e.attribs?.class) { const keep = e.attribs.class.split(/\s+/).filter((t) => { const ok = !t || allowed.has(t); if (!ok) dropped += 1; return ok; }); $(e).attr('class', keep.join(' ')); }
  });
  return { html: $.html(), dropped };
}
export async function refinePattern(slug, kind, message) {
  const text = String(message || '').trim();
  if (!text) throw new Error('Tell me what to change.');
  const lib = await readJson(patFile(slug), null);
  const rec = lib?.patterns?.[kind];
  if (!rec || rec.source !== 'generated') throw new Error('Only a design generated in the template style can be refined in the chat.');
  const allowed = new Set([...(lib.vocab || []), ...tokens(rec.wrapperHtml), ...tokens(rec.itemHtml)]);
  const chat = rec.chat || [];
  const system = `You refine one section design of a website's template. A design is HTML with data-slot attributes that mark where content goes (title, items, link, label, text, img, icon, q, a, quote, name, btn). The site uses compiled Tailwind CSS, so you may only use class names from the allowed list; any other class does nothing and will be removed. Keep every data-slot attribute that is already there, on the same kind of element, and keep the element marked data-slot="items" as the container the items are put into. Do not add text content, images or scripts: the section is filled with the page's own content later. Make the change the user asks for, and keep everything else as it is. If the request cannot be done with the allowed classes, do the closest thing and say so in the reply.`;
  const user = `Kind of section: ${KIND_LABEL[kind]}\n\nCurrent wrapper HTML:\n${rec.wrapperHtml}\n\nCurrent item HTML:\n${rec.itemHtml || '(none)'}\n\nEarlier requests:\n${chat.map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${m.text}`).join('\n') || '(none)'}\n\nAllowed classes:\n${[...allowed].join(' ')}\n\nRequest: ${text}`;
  const { input } = await callTool({ slug, label: 'refine-section', system, user, tool: REFINE_TOOL, maxTokens: 4000 });
  const wrapper = tidy(input.wrapperHtml, allowed), item = tidy(input.itemHtml || '', allowed);
  const lost = (before, after) => [...slotNames(before)].filter((s) => !slotNames(after).has(s));
  const missing = [...lost(rec.wrapperHtml, wrapper.html), ...lost(rec.itemHtml, item.html)];
  if (missing.length) throw new Error(`The change would break the design (the ${[...new Set(missing)].join(', ')} part is missing), so nothing was changed. Try asking in a different way.`);
  const note = wrapper.dropped + item.dropped ? ` (${wrapper.dropped + item.dropped} style(s) your stylesheet does not have were left out.)` : '';
  const next = { wrapperHtml: wrapper.html, itemHtml: item.html, chat: [...chat, { role: 'user', text }, { role: 'assistant', text: String(input.reply || 'Done.') + note }].slice(-20) };
  lib.patterns[kind] = { ...rec, ...next, prev: { wrapperHtml: rec.wrapperHtml, itemHtml: rec.itemHtml, chat }, builtAt: new Date().toISOString() };
  for (const l of Object.keys(lib.byLayout || {})) delete lib.byLayout[l]?.[kind];
  await writeJson(patFile(slug), lib);
  await saveRefined(slug, kind, next);
  return { reply: next.chat[next.chat.length - 1].text };
}
export async function undoRefine(slug, kind) {
  const lib = await readJson(patFile(slug), null);
  const rec = lib?.patterns?.[kind];
  if (!rec?.prev) throw new Error('There is nothing to undo.');
  const { wrapperHtml, itemHtml, chat } = rec.prev;
  const { prev, ...rest } = rec;
  lib.patterns[kind] = { ...rest, wrapperHtml, itemHtml, chat };
  await writeJson(patFile(slug), lib);
  await saveRefined(slug, kind, chat.length ? { wrapperHtml, itemHtml, chat } : null);
}

// ---- the section of any page as a design ----
const LEARN = { cards: cardsFrom, faq: faqFrom, reviews: reviewsFrom, links: linksFrom, cta: ($, u) => ctaFrom($, u) };
async function sectionsOf(slug, rel) {
  // only the pages of the site's own audit can be read
  const fam = await loadFamilies(slug);
  if (!fam?.pageMap?.[String(rel || '')]) throw new Error('That page was not found in the audit.');
  const client = await loadClient(slug);
  const $ = cheerio.load(await readSource(client, rel));
  const { header, footer, region } = regions($);
  return { $, units: unitsOf($, region, header, footer) };
}
// the page's sections, and which kinds of design each could be
export async function describePage(slug, rel) {
  const { $, units } = await sectionsOf(slug, rel);
  const text = (u, sel) => $(u).find(sel).first().text().replace(/\s+/g, ' ').trim();
  return {
    page: rel,
    sections: units.map((u, i) => ({
      key: unitKey($, u, i), id: $(u).attr('id') || '', words: $(u).text().split(/\s+/).filter(Boolean).length,
      label: text(u, 'h1') || text(u, 'h2') || text(u, 'h3') || `“${$(u).text().replace(/\s+/g, ' ').trim().slice(0, 42)}…”`,
      kinds: (() => { const found = Object.entries(LEARN).filter(([k, fn]) => k !== 'cta' && fn($, u)).map(([k]) => k); const words = $(u).text().split(/\s+/).filter(Boolean).length; return !found.length && words <= 90 && LEARN.cta($, u) ? ['cta'] : found; })(),
    })),
  };
}
export async function learnFromSection(slug, kind, rel, key) {
  if (!LEARN[kind]) throw new Error('Unknown section kind.');
  const { $, units } = await sectionsOf(slug, rel);
  const i = units.findIndex((u, n) => unitKey($, u, n) === key);
  if (i < 0) throw new Error('That section was not found on the page.');
  const r = LEARN[kind]($, units[i]);
  if (!r) throw new Error(`That section does not look like a ${KIND_LABEL[kind].split(' (')[0].toLowerCase()} design, so it cannot be used as one.`);
  const { score, ...rest } = r;
  return { kind, source: 'chosen', page: rel, key, ...rest, builtAt: new Date().toISOString() };
}

// the section the user chose becomes the design of its kind; it is checked first, so a section that cannot be used is never saved
export async function chooseDesign(slug, kind, rel, key) {
  await learnFromSection(slug, kind, String(rel || ''), String(key || ''));
  await saveDesign(slug, kind, { page: String(rel), key: String(key) });
  await saveRefined(slug, kind, null);
  return buildPatterns(slug, { only: kind });
}

// the designs to use for a page of one layout, and the classes the site's stylesheet is known to have
export const patternsFor = (lib, layout) => ({ ...(lib?.patterns || {}), ...(lib?.byLayout?.[layout] || {}) });

export const loadPatterns = (slug) => readJson(patFile(slug), null);
export async function ensurePatterns(slug) {
  const lib = await loadPatterns(slug);
  const own = await readJson(path.join(clientDir(slug), 'template', 'own.json'), {});
  const same = lib?.templates && ['inner', 'home', 'contact'].every((l) => (lib.templates[l] || '') === (own[l] || ''));
  return same && lib.v === 3 && (lib.roles || '{}') === JSON.stringify({ roles: own.roles || {}, designs: own.designs || {} }) ? lib : buildPatterns(slug);
}
export async function patternSummary(slug) {
  const lib = await loadPatterns(slug);
  if (!lib) return null;
  return { builtAt: lib.builtAt, classes: lib.classes, items: KINDS.map((k) => ({ kind: k, label: KIND_LABEL[k], source: lib.patterns[k]?.source || 'none', page: lib.patterns[k]?.page || '', key: lib.patterns[k]?.key || '', chat: lib.patterns[k]?.chat || [], canUndo: Boolean(lib.patterns[k]?.prev) })) };
}
