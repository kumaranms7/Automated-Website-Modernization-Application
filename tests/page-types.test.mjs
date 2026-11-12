import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/scanner/classify.js';
import { detectStructure } from '../src/scanner/structure.js';
import { PAGE_TYPES, TYPE_IDS, thinLimit, isPlainType, relatedFor, aiTypes, aiLevel, buildTypes, WORD_TARGETS } from '../src/scanner/page-types.js';
import { SEO } from '../src/rules.js';
import { auditPages } from '../src/scanner/audit.js';
import { verifyPage } from '../src/build/verify.js';
import { validateContent } from '../src/content/validate.js';
import { titleProblem, metaProblem, TITLE, META } from '../src/content/seo-fix.js';

const C = (p, cfg, hints, page) => classify(p, cfg, hints, page);

test('every kind of page is recognised from its folder or its file name', () => {
  const expect = {
    'index.html': 'home',
    'blog/how-to-fix-a-leak.html': 'blog', 'blog.html': 'blog', 'news/our-new-van.html': 'blog', 'articles/guide.html': 'blog', 'blog-roll.html': 'blog',
    'products/blue-widget.html': 'product', 'shop/widgets.html': 'product', 'product-red-widget.html': 'product',
    'portfolio/kitchen-remodel.html': 'portfolio', 'projects/bridge.html': 'portfolio', 'our-work.html': 'portfolio', 'case-studies/acme.html': 'portfolio',
    'gallery.html': 'gallery', 'photos/summer.html': 'gallery', 'photo-gallery.html': 'gallery',
    'faq.html': 'faq', 'faqs.html': 'faq', 'frequently-asked-questions.html': 'faq',
    'about.html': 'about', 'about-us.html': 'about', 'our-team.html': 'about', 'who-we-are.html': 'about',
    'contact.html': 'contact', 'contact-us.html': 'contact', 'get-in-touch.html': 'contact',
    'privacy-policy.html': 'utility', 'thank-you.html': 'utility', 'sitemap.html': 'utility',
    'drain-cleaning.html': 'service', 'about-pipes-and-leaks.html': 'service', 'contact-lens-fitting.html': 'service', 'postcard-printing.html': 'service',
  };
  for (const [path, type] of Object.entries(expect)) assert.equal(C(path), type, path);
});

test('a folder of places is one page for each place, or cities with services when the names say so', () => {
  // no cities with services in the file names: every page is the page of one place
  assert.equal(C('locations/miami.html'), 'location');
  assert.equal(C('our-locations.html'), 'location-hub');
  assert.equal(C('service-areas.html'), 'location-hub');
  // with the structure found from the file names it is a service in a city
  const files = ['index.html', ...['miami', 'tampa', 'orlando'].flatMap((c) => [`locations/${c}-dentist.html`, `locations/${c}-whitening.html`, `locations/${c}-implants.html`])];
  const hints = detectStructure(files);
  assert.equal(C('locations/miami-whitening.html', {}, hints), 'location-service');
  assert.equal(C('locations/miami-dentist.html', {}, hints), 'location-service');
});

test('a page whose name says nothing is recognised by what it contains', () => {
  assert.equal(C('red-widget.html', {}, {}, { schemaTypes: ['Product'], bodyText: 'Red widget. Add to cart. In stock.' }), 'product');
  // many service pages carry Product or Offer markup for review stars: that does not make them products
  assert.equal(C('drain-cleaning.html', {}, {}, { schemaTypes: ['Service', 'Product', 'Offer'], bodyText: 'We clear drains fast. Call today.' }), 'service');
  assert.equal(C('our-van.html', {}, {}, { schemaTypes: ['BlogPosting'] }), 'blog');
  assert.equal(C('summer.html', {}, {}, { images: new Array(14).fill({}), wordCount: 60 }), 'gallery');
  const questions = new Array(8).fill('Is it safe?');
  assert.equal(C('help.html', {}, {}, { h2: questions, h3: [], wordCount: 900 }), 'faq');
  // a service page with a few questions at the end is still a service
  assert.equal(C('drain-cleaning.html', {}, {}, { h2: ['What we do', 'Why us', 'Is it safe?', 'Cost?'], h3: [], wordCount: 900, schemaTypes: ['FAQPage', 'Service'] }), 'service');
  assert.equal(C('drain-cleaning.html', {}, {}, null), 'service');
});

test('a website can say what its folders are', () => {
  const cfg = { typeRules: [{ dir: 'resources', type: 'blog' }, { match: '^lp-', type: 'service' }, { file: 'pricing', type: 'product' }] };
  assert.equal(C('resources/guide.html', cfg), 'blog');
  assert.equal(C('lp-boilers.html', cfg), 'service');
  assert.equal(C('pricing.html', cfg), 'product');
  assert.equal(C('contact.html', { utility: ['contact'] }), 'utility', 'a website that lists contact as a utility page keeps it so');
});

test('each kind is treated by its own table row', () => {
  assert.ok(TYPE_IDS.length >= 13);
  for (const id of ['blog', 'product', 'portfolio', 'gallery', 'faq', 'about', 'contact', 'location', 'service']) assert.ok(PAGE_TYPES[id], id);
  assert.equal(thinLimit('gallery'), 0);
  assert.equal(thinLimit('service'), 350);
  assert.equal(isPlainType('contact'), true);
  assert.equal(isPlainType('blog'), false);
  assert.equal(relatedFor('contact'), false);
  assert.equal(relatedFor('blog'), true);
  assert.equal(aiLevel('product'), 'enhance', 'a product description is improved, never written again from nothing');
  assert.equal(aiLevel('service'), 'rewrite');
  assert.ok(!aiTypes().includes('gallery') && !aiTypes().includes('contact'));
  assert.ok(aiTypes().includes('blog') && aiTypes().includes('faq'));
  assert.deepEqual(buildTypes(), TYPE_IDS, 'every kind is rebuilt with the template');
  assert.deepEqual(WORD_TARGETS.service, [650, 1000]);
  assert.deepEqual(WORD_TARGETS.blog, [600, 1500]);
});

// ---- one rule for titles and descriptions ----
const words = (n) => 'word '.repeat(Math.ceil(n / 5)).slice(0, n).trim().replace(/ $/, 'x');
// a title and a description of exactly n characters, ending the way a finished one does
const T = (n) => ('Title '.repeat(20)).slice(0, n - 1).trimEnd().padEnd(n - 1, 'e') + 'x';
const D = (n) => ('A description sentence. '.repeat(20)).slice(0, n - 1).trimEnd().padEnd(n - 1, 'e') + '.';

test('the limits are 60 for a title and 160 for a description, and every part of the app agrees', () => {
  assert.equal(SEO.title.max, 60);
  assert.equal(SEO.description.max, 160);
  assert.deepEqual(TITLE, [SEO.title.min, 60]);
  assert.deepEqual(META, [SEO.description.min, 160]);
  const page = (title, meta) => ({ path: 'a.html', type: 'service', title, metaDescription: meta, h1: ['H'], canonical: 'https://x.test/a.html', schemaTypes: ['Service'], wordCount: 900, bodyText: 'x', images: [], links: [], issues: [], landmarks: true });
  const codes = (t, m) => auditPages([page(t, m), page('Other title that is long enough here', D(130))], 'x.test')[0].issues.map((i) => i.code);
  // inside the limits: nothing is said
  for (const n of [SEO.title.min, 45, 60]) assert.ok(!codes(T(n), D(130)).some((c) => c.startsWith('title-') && c !== 'title-duplicate'), `title ${n}`);
  for (const n of [SEO.description.min, 140, 160]) assert.ok(!codes(T(45), D(n)).includes('meta-length'), `description ${n}`);
  // outside: the audit, the AI-writing check and the review box say the same
  for (const [n, code] of [[SEO.title.min - 1, 'title-short'], [61, 'title-long']]) {
    assert.ok(codes(T(n), D(130)).includes(code), `audit title ${n}`);
    assert.ok(titleProblem(T(n)), `fixer title ${n}`);
  }
  for (const n of [SEO.description.min - 1, 161]) {
    assert.ok(codes(T(45), D(n)).includes('meta-length'), `audit description ${n}`);
    assert.ok(metaProblem(D(n)), `fixer description ${n}`);
  }
  for (const n of [SEO.title.min, 60]) assert.ok(!titleProblem(T(n)), `fixer title ${n}`);
  for (const n of [SEO.description.min, 160]) assert.ok(!metaProblem(D(n)), `fixer description ${n}`);
});

test('a title or description that the build wrote is accepted exactly inside the limits', () => {
  const MODEL = { path: 'a.html', blocks: [], protected: { form: null, headScripts: [] } };
  const html = (t, m) => `<!doctype html><html lang="en"><head><title>${t}</title><meta name="description" content="${m}"></head><body><h1>H</h1></body></html>`;
  const fails = (t, m) => verifyPage(MODEL, html('Old', 'Old description'), html(t, m), { headFixed: { title: true, description: true } }).checks.filter((c) => c.level === 'fail').map((c) => c.id).filter((id) => id === 'title' || id === 'meta-desc');
  assert.deepEqual(fails(T(60), D(160)), []);
  assert.deepEqual(fails(T(61), D(160)), ['title']);
  assert.deepEqual(fails(T(60), D(161)), ['meta-desc']);
  assert.deepEqual(fails(T(60), D(SEO.description.min - 1)), ['meta-desc']);
});

test('the AI-written copy is held to the same limits', () => {
  const profile = { nap: { name: 'Acme', phone: '' }, forbiddenClaims: [], whatWeDo: [], whatWeDoNot: [], approvedFacts: [], summary: '', facts: {} };
  const c = (title, metaDescription) => ({ title, metaDescription, blocks: [], sections: [], faq: [], lead: { heading: 'H', paragraphs: ['x'] }, imageAlts: [] });
  const ids = (t, m) => validateContent(c(t, m), { mode: 'optimize', type: 'service', h1: 'H', profile, sourceText: '', others: [] }).map((i) => i.id);
  assert.ok(ids(T(61), D(130)).includes('title-length'));
  assert.ok(!ids(T(60), D(130)).includes('title-length'));
  assert.ok(ids(T(45), D(161)).includes('meta-length'));
  assert.ok(!ids(T(45), D(160)).includes('meta-length'));
});
