import * as cheerio from 'cheerio';
import { readSource } from '../util/source.js';
import { plain } from '../util/html.js';
import { extractModel } from './model.js';
import { composeHome } from '../template/home-compose.js';

// What a design from the kit needs of a website beyond its menu and footer:
//  - the links the old header showed beside its menu (its buttons: "Financing", "Contact", "Schedule now"), so none is lost;
//  - the sections of the website that a page of another kind may show (a contact page shows the website's questions and its closing call).
// Both are read from the website's own pages; nothing is made up.

const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

function normHref(href, host) {
  if (!href) return href;
  const m = href.match(/^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/i);
  if (m && m[1].toLowerCase() === String(host || '').replace(/^www\./, '')) return m[2] || '/';
  return href.replace(/^\.\//, '/').replace(/^(?!\/|#|https?:|tel:|mailto:)/, '/');
}
const MAIN_ACTION = /schedule|book|quote|estimate|appointment|get started|request|reserve|order|buy|sign up|free/i;
// a label written in capitals only is set in ordinary case (the design decides how it is shown)
const calm = (t) => (/[a-z]/.test(t) ? t : t.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()));

export function headerLinksOf(html, host) {
  const $ = cheerio.load(html);
  const header = $('header').first();
  if (!header.length) return [];
  const menu = header.find('.menus, nav').first();
  const seen = new Set();
  const out = [];
  header.find('a[href]').each((_, a) => {
    const $a = $(a);
    if (menu.length && $.contains(menu[0], a)) return;
    const raw = ($a.attr('href') || '').trim();
    if (!raw || /^(tel:|mailto:|#|javascript:)/i.test(raw)) return;
    const text = plain($a.clone().find('img, svg').remove().end().text());
    if (!text || text.length > 40) return;
    const href = normHref(raw, host);
    if (/^\/(index\.(html?|php))?$/i.test(href) || /^home$/i.test(text) || seen.has(href)) return;
    seen.add(href);
    out.push({ text: calm(text), href });
  });
  // the one that asks for the visitor's order is the header's main action (the last such, as old headers end with it)
  const main = out.findLast((l) => MAIN_ACTION.test(l.text));
  return out.slice(0, 5).map((l) => (l === main ? { ...l, main: true } : l));
}

export const loadHeaderLinks = (client) => once(`h|${client.sourceDir}`, async () => {
  try { return headerLinksOf(await readSource(client, client.chromePage || 'index.html'), client.host); } catch { return []; }
});

// the website's questions (from its home page) and its closing call (from its home page, else the first page that has one)
export const loadCommonSections = (client, site, { home = 'index.html', pages = [] } = {}) => once(`c|${client.sourceDir}|${home}`, async () => {
  const out = { from: home, faq: null, cta: null };
  const read = async (p) => { try { const m = extractModel(await readSource(client, p), p); return m.ok ? m : null; } catch { return null; } };
  const hm = await read(home);
  if (hm) {
    let comp = null;
    try { comp = composeHome(hm, site, { bands: true }); } catch { /* a home page that cannot be composed has nothing to lend */ }
    const faq = comp?.sections.find((s) => s.type === 'faq' && (s.items || []).length >= 2);
    if (faq) out.faq = { type: 'faq', title: faq.title || '', intro: faq.intro || [], items: faq.items };
    const cta = comp?.sections.find((s) => s.type === 'cta' && s.title);
    if (cta) out.cta = { type: 'cta', title: cta.title, text: cta.text || '', href: cta.href || '', label: cta.label || '', img: cta.img || '', imgAlt: cta.imgAlt || '' };
  }
  if (!out.cta) {
    for (const p of pages.slice(0, 12)) {
      const m = await read(p);
      const b = m?.blocks.find((x) => x.t === 'cta' && x.title);
      // (the words under the heading are about that page: only the heading, its picture and its button are the website's)
      if (b) { out.cta = { type: 'cta', title: b.title, text: '', href: b.href || '', label: b.label || '', img: b.img || '', imgAlt: b.imgAlt || '', from: p }; break; }
    }
  }
  return out;
});
