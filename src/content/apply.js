import path from 'node:path';
import { relatedFor } from '../scanner/page-types.js';
import * as cheerio from 'cheerio';
import { esc } from '../util/html.js';
import { relatedLinks } from '../build/graph.js';
import { collectUnits } from './units.js';

// Merges approved/generated AI content into the page's content model. Runs on every build, so
// template or content changes are re-applied without touching the stored AI output.

const para = (t) => `<p>${esc(t)}</p>`;
const bullets = (items) => (items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');

// Resolve an href found in a page to a site path ("folder/page.html"), or null if it points elsewhere.
export function resolveHref(href, rel, host) {
  if (!href || /^(tel:|mailto:|#|javascript:)/i.test(href.trim())) return null;
  const h = href.trim().split('#')[0].split('?')[0];
  const abs = h.match(/^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/i);
  if (abs) return abs[1].toLowerCase() === host.replace(/^www\./, '') ? (abs[2] || '/').replace(/^\//, '') || 'index.html' : null;
  if (!h) return null;
  return h.startsWith('/') ? h.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(rel), h));
}

function internalLinksOf(model, rel, host) {
  const out = [];
  for (const b of model.blocks) {
    if (b.t === 'html') {
      const $ = cheerio.load(b.html);
      $('a[href]').each((_, a) => {
        const target = resolveHref($(a).attr('href'), rel, host);
        if (target && /\.(html?|php|shtml)$/.test(target)) out.push({ href: $(a).attr('href'), path: target, text: $(a).text().replace(/\s+/g, ' ').trim() });
      });
    }
  }
  return out;
}

function relatedBlock(model, rel, ctx) {
  const { graph, host } = ctx;
  const links = relatedLinks(graph, rel);
  const combo = graph.combos.find((c) => c.path === rel);
  const city = combo && graph.cities[combo.city];
  const groups = {};
  const title = {
    city: city ? `All services in ${city.name}` : 'Area page',
    'same-city': city ? `More services in ${city.name}` : 'More services',
    service: 'Main service page', 'same-service': combo ? `${graph.labels[combo.service] || 'This service'} in nearby cities` : 'Nearby areas',
    county: 'Areas we serve', 'related-service': 'Related services',
  };
  // "city" and "service" are single links; show them together as the page's parent topics.
  for (const l of links) {
    const g = l.group === 'city' || l.group === 'service' ? 'parents' : l.group;
    (groups[g] ||= []).push({ href: '/' + l.path, text: l.text, path: l.path });
  }
  const have = new Set(links.map((l) => l.path));
  const kept = internalLinksOf(model, rel, host).filter((l) => !have.has(l.path) && l.path !== rel);
  const seen = new Set();
  const extra = kept.filter((l) => !seen.has(l.href) && seen.add(l.href)).map((l) => ({ href: l.href, text: l.text || graph.labels[l.path] || l.path }));
  if (extra.length) groups.more = extra;

  const order = ['parents', 'same-city', 'same-service', 'related-service', 'county', 'more'];
  const label = { ...title, parents: city ? `${city.name} and this service` : 'Start here', more: 'More from this page' };
  return { t: 'related', groups: order.filter((g) => groups[g]).map((g) => ({ title: label[g] || g, links: groups[g] })), zone: 'body' };
}

// The designed template adds its own "related pages" lists. A template made from the site's own pages has the sections its reference page has and no others (ctx.related false).
const wantsRelated = (ctx) => ctx.related !== false && relatedFor(ctx.type);

function pushRelated(blocks, rb) {
  if (!rb.groups.length) return;
  blocks.push({ t: 'break' }, { t: 'h', level: 2, text: 'Explore related pages', zone: 'body' }, rb);
}

function businessSchema(ctx) {
  const { site, profile, host } = ctx;
  return {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: profile.nap.name || site.name, url: `https://${host}`,
    telephone: profile.nap.phone || site.phone.display,
    ...(profile.nap.address ? { address: { '@type': 'PostalAddress', streetAddress: profile.nap.address } } : {}),
    ...(site.logo ? { image: `https://${host}${site.logo}` } : {}),
  };
}

function schemaFor(model, rec, ctx) {
  const { site, profile, host } = ctx;
  const url = `https://${host}/${model.path}`;
  const out = [];
  const crumbs = model.hero.crumbs;
  if (crumbs.length) {
    out.push({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => {
        const target = c.href ? resolveHref(c.href, model.path, host) : null;
        const item = i === crumbs.length - 1 ? url : target ? `https://${host}/${target === 'index.html' ? '' : target}` : undefined;
        return { '@type': 'ListItem', position: i + 1, name: c.text, ...(item ? { item } : {}) };
      }),
    });
  }
  if (!ctx.hasBusinessSchema) out.push(businessSchema(ctx));
  if (rec.type === 'service' || rec.type === 'location-service') {
    const counties = (profile.serviceAreas || []).filter((a) => /county/i.test(a));
    out.push({
      '@context': 'https://schema.org', '@type': 'Service', name: model.hero.h1, description: rec.content.metaDescription, url,
      provider: { '@type': 'LocalBusiness', name: profile.nap.name || site.name, telephone: profile.nap.phone || site.phone.display, url: `https://${host}` },
      ...(counties.length ? { areaServed: counties.map((c) => ({ '@type': 'AdministrativeArea', name: c })) } : {}),
    });
  }
  if (rec.mode === 'rewrite' && rec.content.faq?.length) {
    out.push({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: rec.content.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  return out;
}

export function applyContent(model, rec, ctx) {
  const m = structuredClone(model);
  const c = rec.content;
  m.head.title = c.title || m.head.title;
  m.head.description = c.metaDescription || m.head.description;
  m.head.extraLd = schemaFor(m, rec, ctx);

  const alts = new Map((c.imageAlts || []).map((a) => [a.src, a.alt]));
  for (const b of m.blocks) if (b.t === 'img' && alts.has(b.src)) b.alt = alts.get(b.src);

  // Enhance: the page keeps its structure and wording; only the accepted edits (minus any the reviewer kept as original) are applied.
  if (rec.mode === 'enhance' || rec.inPlace) {
    const map = new Map(collectUnits(m).map((u) => [u.id, u]));
    for (const c of rec.content.units || []) {
      if ((rec.keep || []).includes(c.id)) continue;
      const u = map.get(c.id);
      if (u && u.get() === c.before) u.set(c.after);
    }
    if (wantsRelated(ctx)) pushRelated(m.blocks, relatedBlock(m, m.path, ctx));
    return m;
  }

  if (rec.mode !== 'rewrite') {
    if (wantsRelated(ctx)) pushRelated(m.blocks, relatedBlock(m, m.path, ctx));
    return m;
  }

  const keep = (t) => m.blocks.filter((b) => b.t === t);
  const imgs = keep('img');
  const body = (b) => ({ ...b, zone: 'body' });
  const inLead = m.sideForm;
  const out = [{ t: 'break' }];

  keep('cards').forEach((b) => out.push(body(b)));
  const leadZone = inLead ? 'lead' : 'body';
  out.push({ t: 'h', level: 2, text: c.lead.heading, zone: leadZone });
  c.lead.paragraphs.forEach((p) => out.push({ t: 'html', html: para(p), zone: leadZone }));
  if (imgs.length) out.push({ ...imgs.shift(), zone: leadZone });
  keep('callout').forEach((b) => out.push(body(b)));

  c.sections.forEach((s) => {
    out.push({ t: 'break' }, { t: 'h', level: 2, text: s.heading, zone: 'body' });
    s.paragraphs.forEach((p) => out.push({ t: 'html', html: para(p), zone: 'body' }));
    if (s.bullets?.length) out.push({ t: 'html', html: bullets(s.bullets), zone: 'body' });
    if (imgs.length) out.push({ ...imgs.shift(), zone: 'body' });
  });
  imgs.forEach((b) => out.push({ ...b, zone: 'body' }));

  keep('links').forEach((b) => out.push({ t: 'break' }, body(b)));
  if (c.faq?.length) out.push({ t: 'break' }, { t: 'h', level: 2, text: 'Frequently asked questions', zone: 'body' }, { t: 'faq', items: c.faq.map((f) => ({ q: f.q, a: para(f.a) })), zone: 'body' });
  if (keep('reviews').length) out.push({ t: 'break' }, { t: 'h', level: 2, text: 'What customers say', zone: 'body' }, ...keep('reviews').map(body));

  const cta = keep('cta')[0];
  out.push({ t: 'break' }, {
    t: 'cta', title: c.ctaTitle, text: c.ctaText, zone: 'body',
    href: cta?.href || `tel:${ctx.site.phone.digits}`, label: cta?.label || `Call ${ctx.site.phone.display}`,
  });
  if (ctx.related !== false) pushRelated(out, relatedBlock(model, m.path, ctx));
  m.blocks = out;
  return m;
}

// Everything that does not need AI: breadcrumb / service / FAQ structured data and related-page links.
// Used for pages without approved AI content so every rebuilt page meets the same linking and schema baseline.
export function applyBase(model, ctx) {
  const m = structuredClone(model);
  const pseudo = { type: ctx.type, mode: 'optimize', content: { metaDescription: model.head.description, faq: [] } };
  m.head.extraLd = schemaFor(m, pseudo, ctx);
  const faq = [...m.blocks.filter((b) => b.t === 'faq').flatMap((b) => b.items), ...(m.home?.faq?.items || [])];
  if (faq.length) m.head.extraLd.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: String(f.a).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() } })) });
  if (wantsRelated(ctx)) pushRelated(m.blocks, relatedBlock(m, m.path, ctx));
  return m;
}
