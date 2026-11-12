import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { convertPage } from '../src/template/own-convert.js';

// a modern page of the site, in a folder one level deep, with its own subject (cards, reviews) and a closing call-to-action band
const TEMPLATE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Template page title</title><meta name="description" content="Template description"><link rel="canonical" href="https://x.test/a/template.html"><meta property="og:title" content="Template og">
<script type="application/ld+json">{"@type":"Service"}</script><link rel="stylesheet" href="../assets/css/site.min.css"><script src="../assets/js/menu.js" defer></script></head>
<body class="bg-white text-slate-800"><header class="sticky top-0 bg-white"><a href="../index.html"><img src="../images/logo.svg" alt="Logo"></a><nav><a href="../services.html" class="px-4">Services</a></nav></header>
<main>
<section class="bg-sky-800 py-16 text-white"><div class="mx-auto max-w-5xl"><nav aria-label="Breadcrumb"><ol class="flex gap-2 text-sm"><li class="flex"><a class="hover:underline" href="../index.html">Home</a><span>/</span></li><li><span aria-current="page">Template page</span></li></ol></nav><h1 class="text-4xl font-bold">Template heading</h1><p class="mt-4 text-lg">Template subtitle</p></div></section>
<section class="py-12"><div class="mx-auto max-w-5xl grid md:grid-cols-3 gap-6"><div class="rounded-xl p-6"><h3 class="font-semibold">Template card one</h3><p>Card text about template subject.</p></div><div class="rounded-xl p-6"><h3 class="font-semibold">Template card two</h3><p>More.</p></div><div class="rounded-xl p-6"><h3 class="font-semibold">Card three</h3><p>More.</p></div></div></section>
<section class="py-12"><div class="mx-auto max-w-3xl space-y-4"><h2 class="mt-8 text-2xl font-bold text-sky-900">Template section heading</h2><p class="text-slate-600 leading-relaxed">First template paragraph with enough words to look like running text for the page.</p><h3 class="mt-6 text-xl font-semibold">Sub heading</h3><p class="text-slate-600 leading-relaxed">Second template paragraph with more words and more words and more words.</p><ul class="list-disc pl-6"><li class="mb-1">One</li><li class="mb-1">Two</li></ul><p class="text-slate-600 leading-relaxed">Third paragraph, again a few words more than before so it counts.</p></div></section>
<section class="py-10"><div class="mx-auto max-w-5xl"><aside class="rounded-xl border p-6"><h3>Get a quote</h3><form action="/send" method="post"><input name="n"><button>Send</button></form></aside></div></section>
<section class="bg-sky-50 py-8"><div class="mx-auto flex max-w-5xl justify-between"><p class="font-bold">Template-subject offer</p><a class="rounded bg-orange-500 px-4 py-2" href="tel:5550100">Call 555-0100</a></div></section>
<section class="bg-slate-900 py-10 text-white"><div class="mx-auto flex max-w-5xl justify-between"><p class="text-2xl font-bold">Talk to our team</p><a class="rounded bg-orange-500 px-4 py-2" href="tel:5550100">Call 555-0100</a></div></section>
</main><footer class="bg-slate-900 text-slate-300"><a href="../contact.html">Contact</a></footer></body></html>`;

const MODEL = (extra = {}) => ({
  ok: true, path: 'old/page.html',
  head: { title: 'Old page title', description: 'Old page description that is short.', robots: '', canonical: 'https://x.test/old/page.html', metas: ['<meta property="og:title" content="Old og">'], links: [], jsonLd: ['{"@type":"LocalBusiness","name":"Biz"}'] },
  hero: { h1: 'Old Page Heading', crumbs: [{ text: 'Home', href: '../index.html' }, { text: 'Old Services', href: '../old.html' }, { text: 'Old page', href: null }] },
  blocks: [{ t: 'break' }, { t: 'h', level: 3, text: 'First old heading' }, { t: 'html', html: '<p>Old paragraph one with <a href="x.html">a link</a>.</p><ul><li>Old item</li></ul>' }, { t: 'h', level: 4, text: 'Old sub heading' }, { t: 'html', html: '<p>Old paragraph two.</p>' }, { t: 'faq', items: [{ q: 'Old question?', a: 'Old answer.' }] }],
  protected: { form: null, headScripts: ['<script>gtag("config","G-ABC12345")</script>'], bodyNoscript: '' },
  ...extra,
});

const run = (model, targetRel = 'old/page.html') => { const r = convertPage({ model, templateHtml: TEMPLATE, templateRel: 'a/template.html', targetRel }); return { ...r, $: cheerio.load(r.html) }; };

test('the page keeps the template page\'s head, header, footer and styles, with its own metadata', () => {
  const { $ } = run(MODEL());
  assert.equal($('title').text(), 'Old page title');
  assert.equal($('meta[name="description"]').attr('content'), 'Old page description that is short.');
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://x.test/old/page.html');
  assert.equal($('meta[property="og:title"]').length, 1);
  assert.equal($('meta[property="og:title"]').attr('content'), 'Old og');
  assert.deepEqual($('script[type="application/ld+json"]').toArray().map((s) => JSON.parse($(s).text())['@type']), ['LocalBusiness']);
  assert.ok($('link[rel="stylesheet"]').attr('href').endsWith('assets/css/site.min.css'));
  assert.equal($('header').length, 1);
  assert.equal($('footer').length, 1);
  assert.equal($('body').attr('class'), 'bg-white text-slate-800');
});

test('relative links of the template page are re-pointed for the page\'s own folder, root-absolute and external ones are not touched', () => {
  const deeper = run(MODEL(), 'x/y/page.html').$;
  assert.equal(deeper('link[rel="stylesheet"]').attr('href'), '../../assets/css/site.min.css');
  assert.equal(deeper('header a').first().attr('href'), '../../index.html');
  const same = run(MODEL(), 'a/page.html').$;
  assert.equal(same('link[rel="stylesheet"]').attr('href'), '../assets/css/site.min.css');
  const root = run(MODEL(), 'page.html').$;
  assert.equal(root('link[rel="stylesheet"]').attr('href'), 'assets/css/site.min.css');
  assert.equal(root('footer a').attr('href'), 'contact.html');
});

test('the hero gets the page\'s own heading, description and breadcrumb; one H1', () => {
  const { $ } = run(MODEL());
  assert.equal($('h1').length, 1);
  assert.equal($('h1').text(), 'Old Page Heading');
  assert.equal($('main p.mt-4').text(), 'Old page description that is short.');
  assert.deepEqual($('nav[aria-label="Breadcrumb"] li').toArray().map((li) => $(li).text().replace('/', '').trim()), ['Home', 'Old Services', 'Old page']);
  assert.equal($('nav[aria-label="Breadcrumb"] li a').first().attr('href'), '../index.html');
});

test('the old text is written with the template page\'s own classes and replaces the template\'s text', () => {
  const { $, html } = run(MODEL());
  assert.match(html, /First old heading/);
  assert.doesNotMatch(html, /Template section heading|Template card one|Template-subject offer|First template paragraph/);
  // headings start at h2 and never skip: h3 -> h2, h4 -> h3
  assert.equal($('h2.mt-8').text(), 'First old heading');
  assert.equal($('h3.mt-6').first().text(), 'Old sub heading');
  assert.ok($('p.text-slate-600').toArray().some((p) => $(p).text().startsWith('Old paragraph one')));
  assert.equal($('ul.list-disc li').first().attr('class'), 'mb-1');
  assert.equal($('main a[href="x.html"]').length, 1);
  assert.ok($('h3.mt-6').toArray().some((h) => $(h).text() === 'Old question?')); // a FAQ without its own section is plain text for now
});

test('only the closing call-to-action band is kept; the form follows the old page', () => {
  const { $, notes } = run(MODEL());
  assert.match($.html(), /Talk to our team/);
  assert.doesNotMatch($.html(), /Template-subject offer/);
  assert.equal($('form').length, 0);
  assert.ok(notes.some((n) => /no form/.test(n)));
  const withForm = run(MODEL({ protected: { form: '<div id="mf_placeholder"></div><script>mf()</script>', headScripts: [], bodyNoscript: '' } })).$;
  assert.equal(withForm('#mf_placeholder').length, 1);
  assert.equal(withForm('form').length, 0);
});

test('tracking of the old page is kept only when the template page does not already carry it', () => {
  const { html } = run(MODEL());
  assert.match(html, /G-ABC12345/);
  const tpl = TEMPLATE.replace('</head>', '<script>gtag("config","G-ABC12345")</script></head>');
  const r = convertPage({ model: MODEL(), templateHtml: tpl, templateRel: 'a/template.html', targetRel: 'old/page.html' });
  assert.equal((r.html.match(/G-ABC12345/g) || []).length, 1);
});

test('a template page without a text area is refused with a clear message', () => {
  const tpl = '<html><head></head><body><header><a href="/">x</a></header><main><section><h1>T</h1><p>short</p></section></main><footer>f</footer></body></html>';
  assert.throws(() => convertPage({ model: MODEL(), templateHtml: tpl, templateRel: 'a.html', targetRel: 'b.html' }), /no text area/);
  assert.throws(() => convertPage({ model: { ok: false }, templateHtml: TEMPLATE, templateRel: 'a.html', targetRel: 'b.html' }), /could not be read/);
});
