import { siteKey } from '../canonical/index.js';
import { APP } from '../app-settings.js';
import { schemaKind } from '../scanner/page-types.js';

// The structured data (JSON-LD) of a page, finished the way the SEO Meta Tag Updater does it:
//  - the page's own node is built from the business details in the Business profile, and MERGED into the node the page already has
//    (what the page has wins; gaps are filled; only the description and the page address follow the new description and canonical)
//  - a BreadcrumbList from the folder path (when the page has none), and a FAQPage from question headings, <details> and <dl>
//  - the address of a page node is brought in line with the canonical; JSON-LD that cannot be read is left alone

const ORG = new Set([...APP.businessTypes, ...APP.recognisedBusinessTypes]);
// a type that says what the business is (any trade in the list, or anything named ...Business)
export const isBusinessType = (t) => ORG.has(String(t)) || /Business$/.test(String(t));
// does any of these JSON-LD blocks (text) already describe the business?
export function hasBusinessNode(blocks) {
  const walk = (n) => (Array.isArray(n) ? n.some(walk) : n && typeof n === 'object' ? [].concat(n['@type'] || []).some((t) => isBusinessType(t) && t !== 'Organization') || walk(n['@graph'] || []) : false);
  return (blocks || []).some((b) => { try { return walk(JSON.parse(b)); } catch { return false; } });
}
const PAGE = new Set(['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage', 'ItemPage', 'FAQPage', 'QAPage', 'ProfilePage', 'CheckoutPage', 'SearchResultsPage', 'MedicalWebPage']);
const PAGE_LEVEL = new Set(['WebPage', 'Service', 'Article', 'BlogPosting', 'NewsArticle', 'AboutPage', 'ContactPage', 'CollectionPage', 'ItemPage', 'FAQPage', 'Product', 'ProfilePage', 'SearchResultsPage']);

const types = (n) => (n && n['@type'] ? [].concat(n['@type']).map(String) : []);
const family = (t) => (ORG.has(t) || /Business$/.test(t) ? 'org' : PAGE.has(t) ? 'page' : t);
const overlap = (a, b) => { const fa = new Set(a.map(family)); return b.some((x) => fa.has(family(x))); };
function* nodes(data) {
  if (Array.isArray(data)) for (const x of data) yield* nodes(x);
  else if (data && typeof data === 'object') { yield data; if (Array.isArray(data['@graph'])) for (const x of data['@graph']) yield* nodes(x); }
}
const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
export function mergeNode(existing, gen, override = ['description', 'url']) {
  for (const [k, v] of Object.entries(gen)) {
    if (k === '@context' || k === '@type') continue;
    if (override.includes(k) && !empty(v)) existing[k] = v;
    else if (!(k in existing) || empty(existing[k])) existing[k] = v;
    else if (existing[k] && typeof existing[k] === 'object' && !Array.isArray(existing[k]) && v && typeof v === 'object' && !Array.isArray(v)) mergeNode(existing[k], v, []);
  }
  return existing;
}
const dump = (d) => JSON.stringify(d, null, 2).replace(/<\//g, '<\\/');
const hintTypes = (text) => [...String(text).matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);

// the business, from the Business profile: { name, url, phone, street... }
export function orgNode(facts, biz, siteUrl, withContact = true) {
  const node = { '@type': facts.businessType || 'LocalBusiness', name: biz.name };
  if (siteUrl) node.url = siteUrl;
  if (withContact) {
    if (biz.phone) node.telephone = biz.phone;
    const addr = { streetAddress: facts.street || (!facts.city ? biz.address : ''), addressLocality: facts.city, addressRegion: facts.region, postalCode: facts.postal, addressCountry: facts.country };
    const a = Object.fromEntries(Object.entries(addr).filter(([, v]) => v));
    if (Object.keys(a).length) node.address = { '@type': 'PostalAddress', ...a };
    if (facts.hours?.length) node.openingHours = facts.hours;
    if (facts.priceRange) node.priceRange = facts.priceRange;
  }
  if (facts.sameAs?.length) node.sameAs = facts.sameAs;
  if (facts.logo) node.logo = facts.logo;
  return node;
}

// which kind of page node a page gets
export function pageKind(type, rel) {
  const f = String(rel).toLowerCase();
  if (type === 'home') return 'home';
  if (/(^|\/)contact/.test(f)) return 'ContactPage';
  if (/(^|\/)(about|our-story|who-we-are)/.test(f)) return 'AboutPage';
  const k = schemaKind(type);
  if (k === 'Service' || k === 'CollectionPage' || k === 'Article' || k === 'AboutPage' || k === 'ContactPage') return k;
  if (/(^|\/)(blog|news|articles?)\//.test(f)) return 'Article';
  return 'WebPage';
}

function pageNode(kind, p) {
  const { facts, biz, siteUrl, url, title, description, h1, image, published } = p;
  const hasBiz = Boolean(biz.name);
  if (kind === 'home' && hasBiz && (facts.street || facts.city || biz.address)) {
    const n = { '@context': 'https://schema.org', ...orgNode(facts, biz, url || siteUrl), description };
    if (image) n.image = image;
    return n;
  }
  if (kind === 'Service') {
    const n = { '@context': 'https://schema.org', '@type': 'Service', name: h1 || title, description };
    if (url) n.url = url;
    if (hasBiz) n.provider = orgNode(facts, biz, siteUrl);
    if (image) n.image = image;
    return n;
  }
  if (kind === 'Article' && image && published && hasBiz) {
    const n = { '@context': 'https://schema.org', '@type': 'Article', headline: (h1 || title).slice(0, 110), description, image, datePublished: published, author: { '@type': 'Organization', name: biz.name }, publisher: { '@type': 'Organization', name: biz.name } };
    if (facts.logo) n.publisher.logo = { '@type': 'ImageObject', url: facts.logo };
    if (url) n.mainEntityOfPage = url;
    return n;
  }
  const t = ['AboutPage', 'ContactPage', 'CollectionPage'].includes(kind) ? kind : 'WebPage';
  const n = { '@context': 'https://schema.org', '@type': t, name: h1 || title, description, inLanguage: 'en' };
  if (url) n.url = url;
  if (siteUrl && hasBiz) n.isPartOf = { '@type': 'WebSite', name: biz.name, url: siteUrl };
  if (image) n.primaryImageOfPage = { '@type': 'ImageObject', url: image };
  return n;
}

const titled = (s) => s.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
// Home › sections that have their own index page › this page. Home pages get none.
export function breadcrumbNode({ siteUrl, rel, pageUrl, pageName, homeName, folderInfo }) {
  const parts = String(rel).replace(/\\/g, '/').split('/').filter(Boolean);
  const isIndex = /^index\.html?$/i.test(parts.at(-1));
  if (parts.length === 1 && isIndex) return null;
  const base = (siteUrl || '').replace(/\/+$/, '');
  if (!base) return null;
  const items = [[homeName || 'Home', `${base}/`]];
  const walk = isIndex ? parts.slice(0, -2) : parts.slice(0, -1);
  for (let i = 0; i < walk.length; i += 1) { const info = folderInfo?.(walk.slice(0, i + 1).join('/')); if (info) items.push([info.name, info.url]); }
  items.push([pageName || titled(parts.at(-1).replace(/\.[^.]*$/, '')), pageUrl]);
  const seen = new Set(), uniq = items.filter(([, u]) => (seen.has(u.replace(/\/+$/, '')) ? false : seen.add(u.replace(/\/+$/, ''))));
  if (uniq.length < 2) return null;
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: uniq.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) };
}

// question and answer pairs that are visible on the page: <details>, headings that end in "?", <dt>/<dd>
export function extractFaq($, limit = 10) {
  const root = $('main').length ? $('main').first() : $('body');
  const text = (el) => $(el).text().replace(/\s+/g, ' ').trim();
  const pairs = [];
  root.find('details').each((_, d) => { const q = text($(d).children('summary').first()); const a = text($(d).clone().children('summary').remove().end()); if (q && a.length >= 40) pairs.push([q, a.slice(0, 600)]); });
  root.find('h2, h3, h4').each((_, h) => {
    const q = text(h);
    if (!q.endsWith('?') || $(h).closest('details, header, nav, footer, aside').length) return;
    const ans = []; let n = $(h).next();
    while (n.length && n.is('p, ul, ol') && ans.length < 6) { ans.push(text(n)); n = n.next(); }
    const a = ans.join(' ').trim();
    if (a.length >= 40) pairs.push([q, a.slice(0, 600)]);
  });
  root.find('dl').each((_, dl) => { $(dl).children('dt').each((__, dt) => { const dd = $(dt).next('dd'); const a = text(dd); if (dd.length && a.length >= 40) pairs.push([text(dt), a.slice(0, 600)]); }); });
  const seen = new Set(), out = [];
  for (const [q, a] of pairs) { const k = q.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push([q, a]); } }
  return out.length >= 2 ? out.slice(0, limit) : [];
}

// adds and merges the page's structured data in the document; returns what was done
export function applySchema($, p) {
  const log = { page: '', breadcrumb: '', faq: '', aligned: 0, before: [], after: [], notes: [] };
  const blocks = $('script[type="application/ld+json"]').toArray().map((el) => {
    const body = $(el).html() || '';
    let data = null; try { data = JSON.parse(body.trim()); } catch { data = null; }
    return { el, data, hints: hintTypes(body), changed: false };
  });
  log.before = [...new Set(blocks.flatMap((b) => (b.data ? [...nodes(b.data)].flatMap(types) : b.hints)))];
  const merge = (gen) => {
    const gt = types(gen);
    for (const b of blocks) {
      if (b.data === null) { if (overlap(b.hints, gt)) return 'skipped_unparseable'; continue; }
      for (const n of nodes(b.data)) if (overlap(types(n), gt)) {
        const before = JSON.stringify(n);
        mergeNode(n, gen);
        if (JSON.stringify(n) === before) return 'unchanged';
        b.changed = true; return 'merged';
      }
    }
    const el = $(`<script type="application/ld+json"></script>`);
    el.html(`\n${dump(gen)}\n`);
    const last = blocks.at(-1);
    if (last) $(last.el).after('\n', el); else $('head').append(el, '\n');
    blocks.push({ el: el.get(0), data: gen, hints: types(gen), changed: false });
    return 'added';
  };

  if (p.schema !== false) {
    const kind = pageKind(p.type, p.rel);
    const node = pageNode(kind, p);
    log.page = `${types(node)[0]}: ${merge(node)}`;
    if (log.page.endsWith('skipped_unparseable')) log.notes.push('existing JSON-LD has a syntax error, so the structured data was left untouched');
  }
  const has = (t) => blocks.some((b) => b.data && [...nodes(b.data)].some((n) => types(n).includes(t)));
  if (p.breadcrumb !== false && !has('BreadcrumbList')) {
    const bc = breadcrumbNode({ siteUrl: p.siteUrl, rel: p.rel, pageUrl: p.url, pageName: p.h1 || p.title, homeName: p.homeName, folderInfo: p.folderInfo });
    if (bc) log.breadcrumb = merge(bc);
  }
  if (p.faq !== false && !has('FAQPage')) {
    const pairs = extractFaq($);
    if (pairs.length) { log.faq = merge({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: pairs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }); log.faqItems = pairs.length; }
  }
  // a page node whose address names another form of this page follows the canonical
  if (p.url) for (const b of blocks) if (b.data) for (const n of nodes(b.data)) {
    const ts = types(n), u = n.url;
    if (ts.length && ts.every((t) => PAGE_LEVEL.has(t)) && typeof u === 'string' && /^https?:\/\//i.test(u) && u.replace(/\/+$/, '') !== p.url.replace(/\/+$/, '') && siteKey(u) === siteKey(p.url)) { n.url = p.url; b.changed = true; log.aligned += 1; }
  }
  for (const b of blocks) if (b.changed && b.data) $(b.el).html(`\n${dump(b.data)}\n`);
  log.after = [...new Set(blocks.flatMap((b) => (b.data ? [...nodes(b.data)].flatMap(types) : b.hints)))];
  return log;
}
