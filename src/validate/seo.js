import * as cheerio from 'cheerio';
import { localTarget } from './links.js';
import { decideCanonical } from '../canonical/index.js';
import { isBusinessType } from '../head/schema.js';
import { SEO } from '../rules.js';
import { thinLimit, isPlainType } from '../scanner/page-types.js';

// The applicable SEO / technical / accessibility checklist, run on every rebuilt page.
// A check that does not apply to a page (e.g. FAQ markup on a page without FAQs) is marked applicable:false
// and is excluded from the completion percentage.

const GENERIC_ANCHOR = /^(click here|here|read more|more|learn more|this page|link)$/i;

export const CHECK_INFO = {
  'title-length': `Title ${SEO.title.min}-${SEO.title.max} characters`,
  'title-natural': 'Title reads naturally (no repeated words, not all capitals)',
  'meta-sentence': 'Meta description is a finished sentence',
  'og-sync': 'Share title, description and address match the page',
  'og-image-large': 'Share image is a full web address, at least 600 pixels wide',
  'h1-title-aligned': 'Heading and title are about the same thing',
  'schema-match': 'Structured data matches the visible page',
  'schema-dupes': 'No two conflicting entities of one kind in the structured data',
  'brand-consistent': 'The business name is written the same way everywhere',
  'title-unique': 'Title unique across the site',
  'meta-length': `Meta description ${SEO.description.min}-${SEO.description.max} characters`,
  'meta-unique': 'Meta description unique across the site',
  'h1-single': 'Exactly one H1',
  'heading-order': 'Heading levels never skip',
  canonical: 'Canonical is absolute, https and self-referencing',
  indexable: 'Page is indexable (no noindex)',
  viewport: 'Mobile viewport meta tag',
  lang: 'html lang attribute',
  'og-complete': 'Open Graph title, description, image and URL',
  'twitter-card': 'Twitter card tag',
  'schema-valid': 'Structured data parses as valid JSON',
  'schema-business': 'Business / organisation structured data',
  'schema-breadcrumb': 'BreadcrumbList structured data',
  'schema-service': 'Service structured data',
  'schema-faq': 'FAQPage structured data',
  'img-alt': 'Every image has alt text (decorative = empty alt)',
  'img-alt-meaningful': 'Content images have descriptive alt text',
  'img-dimensions': 'Every image has width and height (no layout shift)',
  'img-lazy': 'Below-the-fold images are lazy-loaded',
  'img-modern': 'Content images are WebP/SVG, not JPG/PNG',
  'links-internal': 'At least 3 internal links in the content',
  'links-anchor': 'No generic anchor text ("click here")',
  'links-rel': 'External new-tab links use rel="noopener"',
  'word-count': 'Enough copy for the page type',
  'tel-link': 'Click-to-call phone link present',
  'nap-phone': 'Phone numbers match the approved profile',
  landmarks: 'Header, nav, main and footer landmarks',
  'skip-link': 'Skip-to-content link',
  'duplicate-id': 'No duplicate element IDs',
  'mixed-content': 'No insecure http:// resources',
  'blocking-scripts': 'No render-blocking external scripts in head',
  'html-size': 'HTML under 150 KB',
  'claims-verified': 'No "claims to never make" used',
};

export function seoChecks({ html, rel, type, host, phoneDigits, hadFaqForm, titles, metas, canon = null }) {
  const $ = cheerio.load(html);
  const checks = [];
  const add = (id, ok, level, msg, applicable = true) => checks.push({ id, ok: applicable ? ok : true, applicable, level, msg: ok ? '' : msg });

  const title = $('title').first().text().trim();
  const meta = ($('meta[name="description"]').attr('content') || '').trim();
  add('title-length', title.length >= SEO.title.min && title.length <= SEO.title.max, title.length ? 'warn' : 'fail', `Title is ${title.length} characters`);
  add('title-unique', (titles.get(title) || 0) <= 1, 'warn', 'Title is shared with another page');
  add('meta-length', meta.length >= SEO.description.min && meta.length <= SEO.description.max, meta.length ? 'warn' : 'fail', `Meta description is ${meta.length} characters`);
  add('meta-unique', (metas.get(meta) || 0) <= 1, 'warn', 'Meta description is shared with another page');

  const h1 = $('h1');
  add('h1-single', h1.length === 1 && h1.text().trim().length > 0, 'fail', `${h1.length} H1 tags`);
  const levels = $('h1,h2,h3,h4,h5,h6').map((_, h) => Number(h.name[1])).get();
  add('heading-order', levels.every((l, i) => i === 0 || l - levels[i - 1] <= 1) && $('h1,h2,h3,h4,h5,h6').toArray().every((h) => $(h).text().trim()), 'warn', 'Heading levels skip or a heading is empty');

  const canonHref = $('link[rel="canonical"]').attr('href') || '';
  const m = canonHref.match(/^https:\/\/([^/]+)(\/.*)?$/i);
  const expectPath = '/' + rel.replace(/index\.html$/, '');
  const d = canon ? decideCanonical($('link[rel="canonical"]').map((_, l) => $(l).attr('href') || '').get(), rel, canon) : null;
  if (d) add('canonical', ['ok', 'redirect', 'junk'].includes(d.action), d.action === 'keep_foreign' ? 'warn' : 'fail', d.action === 'removed' ? `Page is redirected (${d.rule}) so it should have no canonical, but has "${canonHref}"` : d.action === 'keep_foreign' ? `Canonical points to another website (${canonHref})` : d.action === 'insert' ? 'Canonical missing' : `Canonical "${canonHref}" should be "${d.url}"${d.note ? ` (${d.note})` : ''}`);
  else add('canonical', Boolean(m) && m[1].replace(/^www\./i, '') === host.replace(/^www\./i, '') && (m[2] || '/') === expectPath, 'fail', canonHref ? `Canonical "${canonHref}" does not match this page` : 'Canonical missing');
  add('indexable', !/noindex/i.test($('meta[name="robots"]').attr('content') || ''), 'fail', 'Page is set to noindex', !isPlainType(type));
  add('viewport', /width=device-width/.test($('meta[name="viewport"]').attr('content') || ''), 'fail', 'Viewport meta missing');
  add('lang', Boolean($('html').attr('lang')), 'warn', 'html lang missing');

  const og = (p) => ($(`meta[property="${p}"]`).attr('content') || '').trim();
  add('og-complete', ['og:title', 'og:description', 'og:image', 'og:url'].every(og), 'warn', `Missing: ${['og:title', 'og:description', 'og:image', 'og:url'].filter((p) => !og(p)).join(', ')}`);
  add('twitter-card', Boolean($('meta[name="twitter:card"]').attr('content')), 'warn', 'twitter:card missing');

  const types = [];
  let schemaOk = true;
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { if (n['@type']) types.push(...[].concat(n['@type'])); Object.values(n).forEach(walk); } };
      walk(JSON.parse($(s).text()));
    } catch { schemaOk = false; }
  });
  add('schema-valid', schemaOk && types.length > 0, 'fail', schemaOk ? 'No structured data' : 'Invalid JSON-LD');
  add('schema-business', types.some((t) => t === 'Organization' || isBusinessType(t)), 'warn', 'No organisation / business markup');
  add('schema-breadcrumb', types.includes('BreadcrumbList'), 'warn', 'No BreadcrumbList markup', $('nav[aria-label="Breadcrumb"]').length > 0);
  add('schema-service', types.includes('Service'), 'warn', 'No Service markup', type === 'service' || type === 'location-service');
  add('schema-faq', types.includes('FAQPage'), 'warn', 'FAQ on the page but no FAQPage markup', $('main details').length > 0);

  const mainImgs = $('main img').toArray();
  const content = mainImgs.filter((i) => $(i).attr('width') !== '56');
  add('img-alt', $('img').toArray().every((i) => $(i).attr('alt') !== undefined), 'warn', 'An image has no alt attribute');
  const noAlt = content.filter((i) => !($(i).attr('alt') || '').trim());
  add('img-alt-meaningful', !noAlt.length, 'warn', `${noAlt.length} content image(s) with empty alt`, content.length > 0);
  const noDim = $('img').toArray().filter((i) => !$(i).attr('width') || !$(i).attr('height'));
  add('img-dimensions', !noDim.length, 'warn', `${noDim.length} image(s) without width/height`);
  const notLazy = content.slice(1).filter((i) => $(i).attr('loading') !== 'lazy');
  add('img-lazy', !notLazy.length, 'warn', `${notLazy.length} below-the-fold image(s) not lazy-loaded`, content.length > 1);
  const legacy = content.filter((i) => /\.(jpe?g|png)(\?|$)/i.test($(i).attr('src') || ''));
  add('img-modern', !legacy.length, 'warn', `${legacy.length} content image(s) still JPG/PNG`, content.length > 0);

  const mainLinks = $('main a[href]').toArray().map((a) => ({ href: $(a).attr('href'), text: $(a).text().trim(), target: $(a).attr('target'), rel: $(a).attr('rel') || '' }));
  const internal = new Set(mainLinks.map((l) => localTarget(l.href, rel, host)).filter((t) => t && /\.(html?|php|shtml)$/.test(t) && t !== rel));
  add('links-internal', internal.size >= 3, 'warn', `${internal.size} internal link(s) in the content`, !isPlainType(type));
  const generic = mainLinks.filter((l) => GENERIC_ANCHOR.test(l.text));
  add('links-anchor', !generic.length, 'warn', `${generic.length} generic anchor text link(s)`);
  const unsafe = $('a[target="_blank"]').toArray().filter((a) => !/noopener/.test($(a).attr('rel') || '') && !/noreferrer/.test($(a).attr('rel') || ''));
  add('links-rel', !unsafe.length, 'warn', `${unsafe.length} target=_blank link(s) without rel=noopener`);

  const words = $('main').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  add('word-count', words >= (thinLimit(type) || 250), 'warn', `${words} words (minimum ${thinLimit(type) || 250})`, !isPlainType(type) && thinLimit(type) > 0);

  const tels = $('a[href^="tel:"]').toArray().map((a) => $(a).attr('href').replace(/\D/g, ''));
  add('tel-link', tels.length > 0, 'warn', 'No tel: link');
  add('nap-phone', tels.every((t) => t === phoneDigits), 'fail', `Phone differs from profile: ${[...new Set(tels.filter((t) => t !== phoneDigits))].join(', ')}`, Boolean(phoneDigits) && tels.length > 0);

  add('landmarks', $('header').length > 0 && $('nav').length > 0 && $('main').length === 1 && $('footer').length > 0, 'warn', 'Missing header/nav/main/footer landmark');
  add('skip-link', $('a[href="#main"]').length > 0, 'warn', 'No skip link');
  const ids = $('[id]').toArray().map((e) => $(e).attr('id'));
  const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
  add('duplicate-id', !dupes.length, 'warn', `Duplicate id: ${[...new Set(dupes)].slice(0, 3).join(', ')}`);

  const http = $('[src],[href]').toArray().filter((e) => /^http:\/\//i.test($(e).attr('src') || $(e).attr('href') || '') && e.name !== 'a');
  add('mixed-content', !http.length, 'fail', `${http.length} insecure resource(s)`);
  const blocking = $('head script[src]').toArray().filter((s) => !$(s).attr('async') && !$(s).attr('defer') && $(s).attr('type') !== 'module');
  add('blocking-scripts', !blocking.length, 'warn', `${blocking.length} render-blocking script(s) in head`);
  add('html-size', Buffer.byteLength(html) < 150 * 1024, 'warn', 'HTML is larger than 150 KB');

  // ---- the checks of the SEO Meta Tag Updater's score that need no AI ----
  const wordsOf = (s) => (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2);
  const tcount = {};
  for (const w of wordsOf(title)) tcount[w] = (tcount[w] || 0) + 1;
  const stuffed = Object.entries(tcount).filter(([w, n]) => n >= 3 && !/^(and|the|for|with|near)$/.test(w));
  add('title-natural', title.length > 0 && !stuffed.length && !(title.length > 12 && title === title.toUpperCase()) && (title.match(/[|•·]/g) || []).length <= 2, 'warn', stuffed.length ? `Title repeats "${stuffed[0][0]}"` : 'Title is in capitals or has too many separators', title.length > 0);
  add('meta-sentence', /[.!?]$/.test(meta) && !/…|\.\.\./.test(meta), 'warn', 'Meta description is not a finished sentence', meta.length > 0);
  const ogv = (p) => ($(`meta[property="${p}"]`).attr('content') || '').trim();
  const sameText = (a, b) => a.toLowerCase().replace(/\s+/g, ' ') === b.toLowerCase().replace(/\s+/g, ' ');
  const anyOg = ['og:title', 'og:description', 'og:url'].some(ogv);
  const syncBad = [ogv('og:title') && !sameText(ogv('og:title'), title) ? 'og:title' : '', ogv('og:description') && !sameText(ogv('og:description'), meta) ? 'og:description' : '', ogv('og:url') && canonHref && ogv('og:url').replace(/\/+$/, '') !== canonHref.replace(/\/+$/, '') ? 'og:url' : '', anyOg && !ogv('og:site_name') ? 'og:site_name (missing)' : ''].filter(Boolean);
  add('og-sync', anyOg && !syncBad.length, 'warn', anyOg ? `Not in step with the page: ${syncBad.join(', ')}` : 'No share tags', true);
  const ogImg = ogv('og:image'), ogW = Number(ogv('og:image:width')) || 0;
  add('og-image-large', /^https:\/\//i.test(ogImg) && ogW >= 600, 'warn', !ogImg ? 'No share image' : !/^https:\/\//i.test(ogImg) ? 'Share image is not a full https address' : ogW ? `Share image is only ${ogW} pixels wide` : 'Share image size is not given', true);
  const h1Words = new Set(wordsOf($('h1').first().text()));
  add('h1-title-aligned', !h1Words.size || !title || wordsOf(title).some((w) => h1Words.has(w)), 'warn', 'Heading and title share no word', title.length > 0);

  // the page node of the structured data must say what the page says
  const pageNodes = [];
  const gather = (n) => { if (Array.isArray(n)) n.forEach(gather); else if (n && typeof n === 'object') { if (n['@type'] && [].concat(n['@type']).some((t) => /^(WebPage|AboutPage|ContactPage|CollectionPage|Service|Article)$/.test(t))) pageNodes.push(n); if (Array.isArray(n['@graph'])) gather(n['@graph']); } };
  const kinds = [];
  $('script[type="application/ld+json"]').each((_, s) => { try { const d = JSON.parse($(s).text()); gather(d); const walkT = (n) => { if (Array.isArray(n)) n.forEach(walkT); else if (n && typeof n === 'object') { if (n['@type']) kinds.push([].concat(n['@type']).join('/')); if (Array.isArray(n['@graph'])) walkT(n['@graph']); } }; walkT(d); } catch { /* reported above */ } });
  const mismatch = pageNodes.filter((n) => (typeof n.description === 'string' && meta && !sameText(n.description, meta)) || (typeof n.url === 'string' && canonHref && n.url.replace(/\/+$/, '') !== canonHref.replace(/\/+$/, '')));
  add('schema-match', pageNodes.length > 0 && !mismatch.length, 'warn', pageNodes.length ? 'The structured data names another description or address than the page' : 'No page-level structured data', true);
  const dupKinds = kinds.filter((k, i) => k !== 'BreadcrumbList' && kinds.indexOf(k) !== i);
  add('schema-dupes', !dupKinds.length, 'warn', `Entities listed twice: ${[...new Set(dupKinds)].join(', ')}`, true);

  // the business name is the same in the title's tail, the share tags and the structured data
  const names = new Set([ogv('og:site_name'), ...pageNodes.flatMap((n) => [n.provider?.name, n.isPartOf?.name]).filter(Boolean)].map((x) => String(x).toLowerCase().trim()).filter(Boolean));
  add('brand-consistent', names.size <= 1, 'warn', `The business name is written ${names.size} different ways: ${[...names].slice(0, 3).join(' / ')}`, names.size > 0);

  return checks;
}
