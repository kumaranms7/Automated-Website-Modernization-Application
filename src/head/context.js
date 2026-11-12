import * as cheerio from 'cheerio';
import { canonicalUrl } from '../canonical/index.js';
import { emptyFacts } from '../profile/facts.js';

// What the head steps of a build need to know about the business and the site, read once per build.

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export function headContext({ profile, site, scan, canon, settings }) {
  const facts = { ...emptyFacts(), ...(profile.facts || {}) };
  const biz = { name: clean(profile.nap?.name || site.name), phone: clean(profile.nap?.phone || site.phone?.display), address: clean(profile.nap?.address || site.address) };
  const brand = clean(profile.brand) || biz.name;
  const byRel = new Map(scan.map((p) => [p.path, p]));
  // a folder with its own index page is a step of the breadcrumb: its name is the page's heading, without the business name
  const folderInfo = (dir) => {
    const p = byRel.get(`${dir}/index.html`);
    if (!p) return null;
    const name = clean((p.h1 || [])[0]) || clean(String(p.title || '').split(/\s[|–—-]\s/)[0]);
    return name ? { name, url: canonicalUrl(canon.domain, `${dir}/index.html`) } : null;
  };
  return { facts, biz, brand, folderInfo, homeName: 'Home', settings, defaultImage: facts.shareImage || '' };
}

// the head of a page in a few lines, for the report
export function headSnapshot(html) {
  const $ = cheerio.load(html || '');
  const meta = (a, k) => $(`head meta[${a}="${k}"]`).attr('content') || '';
  const types = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { const walk = (d) => { if (Array.isArray(d)) d.forEach(walk); else if (d && typeof d === 'object') { [].concat(d['@type'] || []).forEach((t) => types.push(String(t))); if (Array.isArray(d['@graph'])) d['@graph'].forEach(walk); } }; walk(JSON.parse($(el).html())); } catch { types.push('(unreadable)'); }
  });
  // the pictures of the page's own content (menu and footer icons are decoration)
  const imgs = $('main img').filter((_, e) => $(e).attr('aria-hidden') !== 'true' && $(e).attr('role') !== 'presentation');
  return {
    title: clean($('title').first().text()), description: clean(meta('name', 'description')), h1: clean($('h1').first().text()),
    canonical: $('link[rel="canonical"]').attr('href') || '', robots: meta('name', 'robots'),
    og: ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name', 'og:type'].filter((k) => meta('property', k)).length,
    ogImage: meta('property', 'og:image'), twitter: ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].filter((k) => meta('name', k)).length,
    keywords: $('head meta[name="keywords"]').length, schema: [...new Set(types)], images: imgs.length, noAlt: imgs.toArray().filter((e) => !clean($(e).attr('alt'))).length,
  };
}
