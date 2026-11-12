import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { ratio, findSimilar, SIMILAR } from '../src/head/similar.js';
import { stripBrand, buildTitle, titleBudget, findProblems, titleProblem, metaProblem, h1Problem, makeHeadFixer } from '../src/content/seo-fix.js';
import { applySchema, extractFaq, breadcrumbNode, pageKind, mergeNode } from '../src/head/schema.js';
import { applySocial } from '../src/head/social.js';
import { poorAlt, capAlt, imagesNeedingAlt } from '../src/head/alt.js';
import { skipReason, patternList } from '../src/head/skip.js';
import { problemsOf } from '../src/head/review.js';
import { cleanFacts, verifyFacts, cleanSeparator, signalsFromPages } from '../src/profile/facts.js';
import { finalizeHtml } from '../src/build/seo-final.js';
import { parseHtaccess } from '../src/canonical/index.js';
import { seoChecks } from '../src/validate/seo.js';

test('similarity: the same wording with a city swapped is too alike; different wording is not', () => {
  assert.equal(ratio('Remote Video Monitoring Alabama', 'remote video monitoring alabama!'), 1);
  assert.ok(ratio('Remote Video Monitoring in Alabama', 'Remote Video Monitoring in Alaska') > SIMILAR.title);
  assert.ok(ratio('Remote Video Monitoring in Alabama', 'Plumbing repair for homes and shops') < 0.5);
  assert.equal(findSimilar('Cast iron pipe repair in Boca Raton', ['Backflow testing', 'Cast iron pipe repair in Boca Raton FL'], SIMILAR.title), 'Cast iron pipe repair in Boca Raton FL');
  assert.equal(findSimilar('Water heater installation', ['Backflow testing', 'Drain cleaning'], SIMILAR.title), '');
});

test('the title: the page\'s words, a separator and the business name, within 60 characters', () => {
  assert.equal(buildTitle('Emergency Plumber', '|', 'Acme Plumbing'), 'Emergency Plumber | Acme Plumbing');
  assert.equal(buildTitle('Emergency Plumber | Acme Plumbing', '|', 'Acme Plumbing'), 'Emergency Plumber | Acme Plumbing', 'a brand the AI added is not added twice');
  assert.equal(stripBrand('Acme Plumbing: Drain Cleaning -', 'Acme Plumbing'), 'Drain Cleaning');
  assert.equal(buildTitle('Drain Cleaning', '–', 'Acme'), 'Drain Cleaning – Acme');
  assert.equal(titleBudget('|', 'Acme Plumbing'), 60 - ' | '.length - 'Acme Plumbing'.length);
  assert.equal(titleBudget('|', ''), 60);
});

test('which pages need new wording: only the failing ones, or every page; headings only when asked', () => {
  const heads = [
    { path: 'a.html', title: 'Emergency Plumber in Pompano Beach | Acme', description: 'x'.repeat(130) + '.', h1: 'Emergency Plumber' },
    { path: 'b.html', title: 'B', description: 'short', h1: 'This heading is much too long to be a good page heading because it keeps going and going on' },
  ];
  const failing = findProblems(heads, [], 'Acme', { scope: 'failing', h1: true });
  assert.deepEqual(failing.map((p) => p.path), ['b.html']);
  assert.equal(failing[0].h1, true);
  assert.deepEqual(findProblems(heads, [], 'Acme', { scope: 'failing' })[0].h1, false);
  const all = findProblems(heads, [], 'Acme', { scope: 'all', h1: true });
  assert.deepEqual(all.map((p) => p.path), ['a.html', 'b.html']);
  assert.equal(all[0].title && all[0].meta && all[0].h1, true);
  assert.match(h1Problem('x'.repeat(80)), /too long/);
  assert.equal(titleProblem('Acme Plumbing Services in Boca Raton | SFPB', 'Acme Plumbing'), 'ends with an abbreviation');
  assert.equal(titleProblem('Acme Plumbing Services in Boca Raton | Acme', 'Acme Plumbing'), 'ends with only part of the business name');
  assert.equal(titleProblem('Acme Plumbing Services in Boca Raton | IBM', 'IBM'), '', 'the business name itself may be capitals');
  assert.equal(metaProblem('A finished sentence that is long enough to be a real meta description for a page, with a call to action at the end. Call today.'), '');
});

test('without the AI the fixer only repairs what is broken, even when every page was asked for', async () => {
  const fix = makeHeadFixer({ slug: 'zz-no-such-site', ai: false, persist: false });
  const heads = [
    { path: 'a.html', type: 'service', h1: 'Drain Cleaning', title: 'Drain Cleaning Services in Boca Raton | Acme Plumbing', description: 'Acme Plumbing clears blocked drains in Boca Raton with camera inspection and fair prices. Call us to book a visit today.', text: 'Drain cleaning text. '.repeat(20) },
    { path: 'b.html', type: 'service', h1: 'Pipe Repair', title: 'Pipe', description: '', text: 'Pipe repair is what we do for homes and shops. '.repeat(10) },
  ];
  const r = await fix(heads, { scan: heads.map((h) => ({ path: h.path, title: h.title, metaDescription: h.description })), site: { name: 'Acme Plumbing' }, profile: { nap: { name: 'Acme Plumbing', phone: '555-0100' } } });
  assert.equal(r.has('a.html'), false);
  assert.match(r.get('b.html').title, /Pipe Repair/);
  assert.match(r.get('b.html').description, /[.!?]$/);
});

const FACTS = { businessType: 'Plumber', street: '1 Main St', city: 'Pompano Beach', region: 'FL', postal: '33069', country: 'US', hours: ['Mo-Fr 08:00-17:00'], sameAs: ['https://facebook.com/acme'], logo: 'https://www.acme.com/logo.webp', priceRange: '$$' };
const BIZ = { name: 'Acme Plumbing', phone: '555-0100', address: '' };
const PAGE = (head, body) => `<!doctype html><html lang="en"><head><title>Drain Cleaning in Boca Raton | Acme</title><meta name="description" content="Acme clears drains.">${head}</head><body><header><a href="/">Home</a></header><main><h1>Drain Cleaning</h1>${body || ''}</main></body></html>`;
const schema = (head, body, extra = {}) => { const $ = cheerio.load(PAGE(head, body)); const log = applySchema($, { rel: 'services/drains.html', type: 'service', facts: FACTS, biz: BIZ, siteUrl: 'https://www.acme.com', url: 'https://www.acme.com/services/drains.html', title: 'Drain Cleaning in Boca Raton | Acme', description: 'Acme clears drains.', h1: 'Drain Cleaning', homeName: 'Home', folderInfo: (d) => (d === 'services' ? { name: 'Services', url: 'https://www.acme.com/services/' } : null), ...extra }); return { $, log, ld: $('script[type="application/ld+json"]').toArray().map((e) => { try { return JSON.parse($(e).html()); } catch { return {}; } }) }; };

test('structured data: a service node with the business as provider, and breadcrumbs from the folders that have an index page', () => {
  const { log, ld } = schema('', '');
  const service = ld.find((n) => n['@type'] === 'Service');
  assert.equal(service.provider['@type'], 'Plumber');
  assert.equal(service.provider.address.addressLocality, 'Pompano Beach');
  assert.deepEqual(service.provider.openingHours, ['Mo-Fr 08:00-17:00']);
  assert.equal(service.url, 'https://www.acme.com/services/drains.html');
  const bc = ld.find((n) => n['@type'] === 'BreadcrumbList');
  assert.deepEqual(bc.itemListElement.map((x) => x.name), ['Home', 'Services', 'Drain Cleaning']);
  assert.match(log.page, /Service: added/); assert.equal(log.breadcrumb, 'added');
});

test('structured data: what the page already has wins; gaps are filled; the description and address follow the page; nothing is duplicated', () => {
  const head = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","name":"Our own name","description":"Old text","url":"https://example.org/other.html"}</script>';
  const { ld, $ } = schema(head, '');
  const services = ld.filter((n) => n['@type'] === 'Service');
  assert.equal(services.length, 1);
  assert.equal(services[0].name, 'Our own name');
  assert.equal(services[0].description, 'Acme clears drains.');
  assert.equal(services[0].provider.name, 'Acme Plumbing');
  assert.equal($('script[type="application/ld+json"]').length, 2, 'the service block and the breadcrumb');
  assert.deepEqual(mergeNode({ a: 1, b: { c: 1 } }, { a: 2, b: { c: 2, d: 3 }, e: 4 }), { a: 1, b: { c: 1, d: 3 }, e: 4 });
});

test('structured data that cannot be read is left alone', () => {
  const head = '<script type="application/ld+json">{"@type":"Service","name":"Broken",}</script>';
  const { log, $ } = schema(head, '');
  assert.match(log.page, /skipped_unparseable/);
  assert.equal($('script[type="application/ld+json"]').first().html(), '{"@type":"Service","name":"Broken",}');
});

test('a FAQ is marked up from questions that are on the page, and only when there are at least two', () => {
  const body = '<h2>Do you work weekends?</h2><p>Yes, we take emergency calls on weekends and holidays for no extra call-out fee at all.</p><h2>Are you insured?</h2><p>Yes, we are fully insured for all residential and commercial work that we carry out for you.</p>';
  const { ld, log } = schema('', body);
  const faq = ld.find((n) => n['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, 2);
  assert.equal(log.faqItems, 2);
  assert.equal(extractFaq(cheerio.load(PAGE('', '<h2>One question?</h2><p>With a long enough answer to count as an answer on a web page, really.</p>'))).length, 0);
  assert.equal(pageKind('service', 'a.html'), 'Service');
  assert.equal(pageKind('utility', 'contact-us.html'), 'ContactPage');
  assert.equal(pageKind('home', 'index.html'), 'home');
  assert.equal(breadcrumbNode({ siteUrl: 'https://x.com', rel: 'index.html', pageUrl: 'https://x.com/' }), null);
});

test('share tags follow the page; robots is added when missing; the keywords tag goes', () => {
  const $ = cheerio.load(PAGE('<meta name="keywords" content="a, b"><meta property="og:title" content="Old">', ''));
  const out = applySocial($, { title: 'Drain Cleaning | Acme', description: 'Acme clears drains.', canonical: 'https://www.acme.com/d.html', brand: 'Acme', image: { url: 'https://www.acme.com/i/d.webp', width: 1200, height: 630, source: 'page' }, pageKind: 'Service', social: true });
  assert.equal($('meta[property="og:title"]').attr('content'), 'Drain Cleaning | Acme');
  assert.equal($('meta[property="og:image:width"]').attr('content'), '1200');
  assert.equal($('meta[property="og:url"]').attr('content'), 'https://www.acme.com/d.html');
  assert.equal($('meta[property="og:site_name"]').attr('content'), 'Acme');
  assert.equal($('meta[name="twitter:card"]').attr('content'), 'summary_large_image');
  assert.equal($('meta[name="robots"]').attr('content'), 'index, follow');
  assert.equal($('meta[name="keywords"]').length, 0);
  assert.equal(out.keywords, 1);
  const small = cheerio.load(PAGE('', ''));
  applySocial(small, { title: 'T', description: 'D', canonical: '', brand: '', image: { url: 'https://x.com/s.png', width: 300, height: 300 }, pageKind: 'WebPage', social: true });
  assert.equal(small('meta[name="twitter:card"]').attr('content'), 'summary');
  const noindex = cheerio.load(PAGE('<meta name="robots" content="noindex">', ''));
  applySocial(noindex, { title: 'T', description: 'D', canonical: '', brand: '', image: null, pageKind: 'WebPage', social: false });
  assert.equal(noindex('meta[name="robots"]').attr('content'), 'noindex', 'an existing robots tag is never changed');
});

test('picture descriptions: only missing or empty-of-meaning ones are written again, and never longer than 125 characters', () => {
  assert.equal(poorAlt('', 'a.jpg'), true);
  assert.equal(poorAlt('IMG_2041', 'a.jpg'), true);
  assert.equal(poorAlt('image', 'a.jpg'), true);
  assert.equal(poorAlt('drain-cleaning-van', '/img/drain-cleaning-van.webp'), true);
  assert.equal(poorAlt('A technician clearing a blocked kitchen drain', 'x.jpg'), false);
  assert.ok(capAlt('Image of ' + 'word '.repeat(60)).length <= 125);
  const $ = cheerio.load('<main><h2>Our team</h2><figure><img src="a.jpg" alt=""><img src="b.jpg" alt="A van parked outside a shop"><img src="c.jpg" alt="photo"></figure></main>');
  assert.deepEqual(imagesNeedingAlt($).map((p) => p.src), ['a.jpg', 'c.jpg']);
});

test('pages a run leaves out, and why', () => {
  const set = { excludePatterns: 'blog/*\n*-old.html\nprivate', skipNoindex: true, skipErrorPages: true, skipRedirected: true };
  const canon = { rules: parseHtaccess('Redirect 301 /moved.html /new.html').rules, cleanUrls: false };
  assert.match(skipReason({ path: 'blog/post.html' }, set, canon), /listed/);
  assert.match(skipReason({ path: 'a-old.html' }, set, canon), /listed/);
  assert.match(skipReason({ path: 'private/x.html' }, set, canon), /listed/, 'a folder name leaves the whole folder out');
  assert.match(skipReason({ path: 'x.html', robots: 'noindex, follow' }, set, canon), /noindex/);
  assert.match(skipReason({ path: '404.html' }, set, canon), /error/);
  assert.match(skipReason({ path: 'moved.html' }, set, canon), /redirected/);
  assert.equal(skipReason({ path: 'services/a.html', robots: 'index' }, set, canon), '');
  assert.equal(skipReason({ path: 'blog/post.html' }, { ...set, excludePatterns: '' }, canon), '');
  assert.equal(patternList('a\n\n b ').length, 2);
});

test('the page review checks wording against the same rules, and against the other pages', () => {
  const others = [{ title: 'Drain Cleaning in Boca Raton | Acme', description: 'Acme clears blocked drains in Boca Raton with a camera inspection, fair prices and a clear quote. Call us today.', h1: 'Drain Cleaning in Boca Raton' }];
  const p = problemsOf({ title: 'Drain Cleaning in Boca Raton | Acme', description: 'x', h1: 'Drain Cleaning in Boca Raton' }, others, 'Acme');
  assert.match(p.title.join(' '), /too like another page/i);
  assert.match(p.description.join(' '), /too short/);
  assert.match(p.h1.join(' '), /too like another page/i);
  const good = problemsOf({ title: 'Water Heater Installation for Homes | Acme', h1: 'Water Heater Installation' }, others, 'Acme');
  assert.deepEqual([good.title, good.h1], [[], []]);
});

test('business details: the separator and the details are cleaned, and what the pages do not support is dropped', () => {
  assert.equal(cleanSeparator(' – '), '–');
  assert.equal(cleanSeparator('<script>'), '|');
  const f = cleanFacts({ businessType: 'Plumber<x>', hours: 'Mo-Fr 8-5\n\nSa 9-1', sameAs: ['javascript:alert(1)', 'https://facebook.com/x'], street: ' 1  Main St ' });
  assert.equal(f.businessType, 'LocalBusiness');
  assert.deepEqual(f.hours, ['Mo-Fr 8-5', 'Sa 9-1']);
  assert.deepEqual(f.sameAs, ['https://facebook.com/x']);
  assert.equal(f.street, '1 Main St');
  const v = verifyFacts({ street: '1 Main St', city: 'Invented City', region: 'FL', hours: ['Mo-Fr 08:00-17:00', 'Sun 99:99'], priceRange: '$$' }, 'Visit us at 1 Main St, Pompano Beach FL. Open Mo-Fr 08:00-17:00.');
  assert.equal(v.facts.street, '1 Main St');
  assert.equal(v.facts.city, '');
  assert.deepEqual(v.facts.hours, ['Mo-Fr 08:00-17:00']);
  assert.equal(v.facts.priceRange, '$$', 'a price range written as dollar signs is a rating, not a claim');
  assert.ok(v.dropped.length >= 2);
  const home = { url: 'https://www.acme.com/', $: cheerio.load('<head><meta property="og:image" content="/share.jpg"></head><body><header><img src="/logo.webp" alt="Acme logo"></header><a href="https://www.facebook.com/acme">f</a><a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a></body>') };
  const s = signalsFromPages([home]);
  assert.equal(s.shareImage, 'https://www.acme.com/share.jpg');
  assert.equal(s.logo, 'https://www.acme.com/logo.webp');
  assert.deepEqual(s.sameAs, ['https://www.facebook.com/acme']);
});

test('when a page has several H1 tags, the one in the main content that matches the title stays', () => {
  const html = '<!doctype html><html><head><title>Drain Cleaning in Boca Raton</title></head><body><header><h1>Acme Plumbing</h1></header><main><h1>Drain Cleaning in Boca Raton</h1><p>x</p></main></body></html>';
  const $ = cheerio.load(finalizeHtml(html, { rel: 'services/drain-cleaning.html', canonicalHost: 'www.acme.com', host: 'acme.com' }).html);
  assert.equal($('h1').length, 1);
  assert.equal($('main h1').text(), 'Drain Cleaning in Boca Raton');
  assert.equal($('header h2').text(), 'Acme Plumbing');
});

test('the finished page: share tags, structured data and canonical agree, and the new checks pass', () => {
  const html = PAGE('<link rel="canonical" href="https://www.acme.com/services/drains.html">', '<h2>Why us</h2><p>We clear drains fast.</p>');
  const CTX = { domain: 'https://www.acme.com', rules: [], ignored: [], cleanUrls: false, fixLinks: false };
  const r = finalizeHtml(html, { rel: 'services/drains.html', canonicalHost: 'www.acme.com', host: 'acme.com', canon: CTX, head: { social: true, schema: true, type: 'service', facts: FACTS, biz: BIZ, brand: 'Acme Plumbing', img: { url: 'https://www.acme.com/i/d.webp', width: 1200, height: 630 }, homeName: 'Home', folderInfo: () => null } });
  const checks = seoChecks({ html: r.html, rel: 'services/drains.html', type: 'service', host: 'acme.com', phoneDigits: '', titles: new Map(), metas: new Map(), canon: CTX });
  const by = Object.fromEntries(checks.map((c) => [c.id, c.ok]));
  for (const id of ['canonical', 'og-sync', 'og-image-large', 'schema-valid', 'schema-match', 'schema-dupes', 'brand-consistent', 'twitter-card', 'meta-sentence']) assert.equal(by[id], true, id);
});
