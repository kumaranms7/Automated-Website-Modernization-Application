import * as cheerio from 'cheerio';
import { decideCanonical } from '../canonical/index.js';
import { fixLinks } from '../canonical/links.js';
import { applySocial } from '../head/social.js';
import { applySchema, pageKind } from '../head/schema.js';

// The last step of every page build. Whatever the content mode, a finished page must have:
//   - a descriptive alt text on every content image
//   - loading="eager" on images above the fold and loading="lazy" on everything below it
//   - exactly one H1
//   - one canonical link: the site's canonical domain + the page's own path (none on a page the .htaccess redirects or removes); links to redirected pages point at the final page
// Titles and meta descriptions are handled earlier (src/content/seo-fix.js), because they need wording, not markup.

// words that say nothing about what a picture shows
const GENERIC = new Set(['img', 'imgs', 'image', 'images', 'pic', 'pics', 'picture', 'pictures', 'photo', 'photos', 'dsc', 'dscn', 'dscf', 'screenshot', 'untitled', 'banner', 'bg', 'background', 'slide', 'thumb', 'thumbnail', 'icon', 'logo', 'copy', 'final', 'new', 'old', 'web', 'webp', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'file', 'asset', 'assets', 'small', 'large', 'medium', 'full', 'square', 'crop', 'cropped', 'resized', 'edit', 'edited', 'opt', 'hero', 'section', 'col', 'column', 'item', 'mobile', 'desktop', 'sm', 'md', 'lg', 'xl']);

export function fileWords(src) {
  let name = String(src || '').split('#')[0].split('?')[0].split('/').pop() || '';
  try { name = decodeURIComponent(name); } catch { /* keep it as it is */ }
  name = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/@\d+x\b/gi, ' ').replace(/[-_.+\s]+/g, ' ');
  return name.split(' ').filter(Boolean)
    .filter((t) => !/^\d+(w|h|px)?$/i.test(t) && !/^\d+x\d+$/i.test(t) && !/^[0-9a-f]{8,}$/i.test(t) && !/^[a-z]{0,5}\d{3,}$/i.test(t) && !GENERIC.has(t.toLowerCase()))
    .map((t) => t.toLowerCase());
}

// "south-florida-commercial-plumber-480w.webp" -> "South florida commercial plumber"; "" when the file name says nothing
export function altFromFile(src) {
  const w = fileWords(src);
  const meaningful = (w.length >= 2 && w.join('').length >= 8) || (w.length === 1 && w[0].length >= 7);
  return meaningful ? w.join(' ').replace(/^./, (c) => c.toUpperCase()) : '';
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// a heading as a short alt-text phrase: whole words only
function phrase(s, max = 100) {
  const t = clean(s);
  if (t.length <= max) return t;
  const clause = t.split(/\s[|–—:-]\s|[,.:;!?]\s/)[0];
  if (clause.length >= 12 && clause.length <= max) return clause;
  const cut = t.slice(0, max + 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 12)).trim();
}

// parts: which of the three jobs run: { images: alt text, lazy and eager loading; h1: one heading; tags: canonical, links, share tags, structured data }
export function finalizeHtml(html, { rel, canonicalHost, host, canon = null, head = null, alts = null, parts = {} }) {
  const doImages = parts.images !== false, doH1 = parts.h1 !== false, doTags = parts.tags !== false;
  const $ = cheerio.load(html);
  const changes = { alt: 0, eager: 0, lazy: 0, h1: 0, canonical: 0 };

  // ---- exactly one H1 ----
  const h1s = $('h1');
  if (doH1 && h1s.length > 1) {
    // the best heading stays: the one in the main content (not the header, menu or footer) that shares the most words with the title
    const words = (t) => new Set(String(t || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2) || []);
    const ref = new Set([...words($('title').text()), ...words(rel.replace(/\.html?$/i, '').replace(/[-_/]+/g, ' '))]);
    let keep = 0, best = -Infinity;
    h1s.each((i, e) => {
      const w = words($(e).text());
      const union = new Set([...w, ...ref]).size || 1;
      const score = ($(e).closest('main, article').length ? 2 : 0) - ($(e).closest('header, nav, footer, aside').length ? 2 : 0) + (3 * [...w].filter((x) => ref.has(x)).length) / union;
      if (score > best + 1e-9) { best = score; keep = i; }
    });
    h1s.each((i, e) => { if (i !== keep) e.name = 'h2'; });
    changes.h1 += h1s.length - 1;
  }
  else if (doH1 && !h1s.length) {
    const first = $('main h2').first();
    if (first.length) { first[0].name = 'h1'; changes.h1 += 1; }
  }
  const h1Text = clean($('h1').first().text()) || clean($('title').first().text());

  // ---- alt text ----
  const isContent = (el) => !$(el).closest('header, footer').length && $(el).attr('width') !== '56' && $(el).attr('aria-hidden') !== 'true' && $(el).attr('role') !== 'presentation';
  const used = new Map();
  let heading = '';
  if (doImages) $('main').find('h1,h2,h3,h4,img').each((_, el) => {
    if (el.name !== 'img') { heading = clean($(el).text()) || heading; return; }
    if (!isContent(el)) return;
    const $i = $(el);
    const alt = clean($i.attr('alt'));
    const written = alts?.get($i.attr('src') || $i.attr('data-src'));
    if (written && written !== alt) { $i.attr('alt', written); used.set(written.toLowerCase(), (used.get(written.toLowerCase()) || 0) + 1); changes.alt += 1; return; }
    if (alt) { used.set(alt.toLowerCase(), (used.get(alt.toLowerCase()) || 0) + 1); return; }
    let text = altFromFile($i.attr('src') || $i.attr('data-src'));
    if (!text) {
      // the file name says nothing: name the picture after the section it sits in
      // a card or column with exactly one heading is named by it; otherwise the heading just above the picture
      let near = '';
      for (let up = $i.parent(), k = 0; k < 5 && up.length && !up.is('main'); up = up.parent(), k += 1) {
        const hs = up.find('h1,h2,h3,h4');
        if (hs.length === 1) { near = clean(hs.first().text()); break; }
        if (hs.length > 1) break;
      }
      const title = phrase(near || heading || h1Text);
      text = title ? `${title} image` : 'Image';
    }
    const key = text.toLowerCase();
    const n = (used.get(key) || 0) + 1;
    used.set(key, n);
    $i.attr('alt', n > 1 && !altFromFile($i.attr('src')) ? `${text} ${n}` : text);
    changes.alt += 1;
  });

  // ---- lazy and eager ----
  const content = $('main img').toArray().filter(isContent);
  const firstSection = $('main > section').first();
  const aboveFold = new Set([
    ...$('header img').toArray(),
    ...(content[0] ? [content[0]] : []),
    ...firstSection.find('img').toArray().filter((e) => !isContent(e)), // small icons in the opening block
  ]);
  if (doImages) $('img').each((_, el) => {
    const want = aboveFold.has(el) ? 'eager' : 'lazy';
    if ($(el).attr('loading') !== want) { $(el).attr('loading', want); changes[want] += 1; }
  });

  if (!doTags) return { html: Object.values(changes).some(Boolean) ? $.html() : html, changes };

  // ---- canonical ----
  let canonInfo = null;
  if (canon) {
    // the SEO Meta Tag Updater's way: one domain for the site; a redirected page has none; a tag that names this page rightly is kept
    const links = $('link[rel="canonical"]');
    const hrefs = links.map((_, l) => $(l).attr('href') || '').get();
    const d = decideCanonical(hrefs, rel, canon);
    let final = d.url;
    if (d.action === 'insert') $('head').append(`<link rel="canonical" href="${d.url}">`);
    else if (d.action === 'replace') { links.first().attr('href', d.url); links.slice(1).remove(); }
    else if (d.action === 'dupes') links.slice(1).remove();
    else if (d.action === 'removed') links.remove();
    else if (d.action === 'keep_foreign') final = d.old;
    if (['insert', 'replace', 'dupes', 'removed'].includes(d.action)) changes.canonical += 1;
    // og:url is the same address as the canonical
    if (final && d.action !== 'junk') { const og = $('meta[property="og:url"]'); if (og.length && og.attr('content') !== final) { og.attr('content', final); changes.canonical += 1; } }
    canonInfo = { action: d.action, old: d.old, url: final || '', note: d.note || '', rule: d.rule || '', links: { changes: [], findings: [] } };
    if (canon.fixLinks) canonInfo.links = fixLinks($, rel, canon);
    // share tags, robots and structured data, in step with the finished title, description and canonical
    let headInfo = null;
    if (head) {
      const title = clean($('title').first().text()), description = clean($('meta[name="description"]').attr('content'));
      const kind = pageKind(head.type, rel);
      const pageUrl = ['removed', 'redirect', 'junk', 'keep_foreign'].includes(d.action) ? '' : final;
      headInfo = {
        social: applySocial($, { title, description, canonical: pageUrl, brand: head.brand, image: head.img, pageKind: kind, social: head.social }),
        schema: head.schema ? applySchema($, { rel, type: head.type, facts: head.facts, biz: head.biz, siteUrl: canon.domain, url: pageUrl, title, description, h1: clean($('h1').first().text()), image: head.img?.url || '', published: head.published || '', homeName: head.homeName, folderInfo: head.folderInfo }) : null,
      };
    }
    const touchedC = head || Object.values(changes).some(Boolean) || canonInfo.links.changes.length > 0;
    return { html: touchedC ? $.html() : html, changes, canon: canonInfo, head: headInfo };
  }
  const wantPath = '/' + rel.replace(/index\.html$/, '');
  const link = $('link[rel="canonical"]').first();
  const m = (link.attr('href') || '').match(/^https:\/\/([^/]+)(\/.*)?$/i);
  const good = m && m[1].replace(/^www\./i, '') === String(host || canonicalHost).replace(/^www\./i, '') && (m[2] || '/') === wantPath;
  if (!good) {
    const href = `https://${canonicalHost}${wantPath}`;
    if (link.length) link.attr('href', href); else $('head').append(`<link rel="canonical" href="${href}">`);
    changes.canonical += 1;
  }

  const touched = Object.values(changes).some(Boolean);
  return { html: touched ? $.html() : html, changes };
}
