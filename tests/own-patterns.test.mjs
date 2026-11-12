import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { fillPattern } from '../src/template/own-fill.js';
import { learnPatterns } from '../src/template/own-patterns.js';
import { convertPage } from '../src/template/own-convert.js';

const PAGE = `<!doctype html><html><head><title>t</title><link rel="stylesheet" href="s.css"></head><body><header><a href="/">Logo</a></header><main>
<section class="py-16"><div class="mx-auto max-w-5xl"><h1 class="text-4xl">Hero</h1></div></section>
<section class="bg-slate-50 py-12"><div class="mx-auto max-w-5xl"><h2 class="text-3xl font-bold">Our services</h2><p class="mt-3 text-slate-600">Intro about the template subject only.</p>
<div class="mt-8 grid gap-6 md:grid-cols-3">
<a class="block rounded-xl border bg-white p-6 shadow-sm" href="/one.html"><img src="/i/1.webp" alt="One" class="h-40 w-full"><h3 class="mt-4 text-xl font-semibold">Service one</h3><p class="mt-2 text-slate-600">Description of service one.</p></a>
<a class="block rounded-xl border bg-white p-6 shadow-sm" href="/two.html"><img src="/i/2.webp" alt="Two" class="h-40 w-full"><h3 class="mt-4 text-xl font-semibold">Service two</h3><p class="mt-2 text-slate-600">Description of service two.</p></a>
<a class="block rounded-xl border bg-white p-6 shadow-sm" href="/three.html"><img src="/i/3.webp" alt="Three" class="h-40 w-full"><h3 class="mt-4 text-xl font-semibold">Service three</h3><p class="mt-2 text-slate-600">Description of service three.</p></a>
</div></div></section>
<section class="py-12"><div class="mx-auto max-w-5xl"><h2 class="text-3xl font-bold">Checklist</h2><ul class="space-y-2"><li class="flex"><strong>First point</strong> – a plain checklist sentence about something.</li><li class="flex"><strong>Second point</strong> – another plain checklist sentence here.</li><li class="flex"><strong>Third point</strong> – and a third sentence in the same style.</li></ul></div></section>
<section class="py-12"><div class="mx-auto max-w-3xl space-y-3"><h2 class="text-3xl font-bold">Questions</h2>
<details class="rounded-lg border p-4"><summary class="flex cursor-pointer justify-between font-semibold">Do you charge by the hour?<span class="ml-4">+</span></summary><div class="mt-2 text-slate-600">No, we quote a fixed price.</div></details>
<details class="rounded-lg border p-4"><summary class="flex cursor-pointer justify-between font-semibold">Are you insured?<span class="ml-4">+</span></summary><div class="mt-2 text-slate-600">Yes, fully insured.</div></details></div></section>
<section class="py-12"><div class="mx-auto max-w-5xl"><h2 class="text-3xl font-bold">Reviews</h2><div class="grid gap-6 md:grid-cols-2">
<figure class="rounded-xl border p-6"><blockquote><p class="italic">Great work, would use again for sure.</p></blockquote><figcaption class="mt-3 font-semibold">A. Customer</figcaption><span class="text-sm">Pompano Beach, FL</span></figure>
<figure class="rounded-xl border p-6"><blockquote><p class="italic">On time and very polite, thank you.</p></blockquote><figcaption class="mt-3 font-semibold">B. Customer</figcaption><span class="text-sm">Boca Raton, FL</span></figure></div></div></section>
<section class="py-12"><div class="mx-auto max-w-3xl space-y-4"><h2 class="mt-8 text-2xl font-bold">Text heading</h2><p class="text-slate-600 leading-relaxed">A long paragraph of the template page that carries most of the text of its text area and sets the style for text.</p><p class="text-slate-600 leading-relaxed">Another long paragraph of the template page, again with enough words to count as running text of the page.</p><p class="font-semibold text-lg">Short callout</p><ul class="list-disc"><li>One</li><li>Two</li></ul></div></section>
<section class="bg-slate-900 py-10 text-white"><div class="mx-auto flex max-w-5xl justify-between"><div><p class="text-2xl font-bold">Talk to our team</p><p class="text-slate-300">Template call text</p></div><a class="rounded bg-orange-500 px-4 py-2" href="tel:5550100">Call 555-0100</a></div></section>
</main><footer>f</footer></body></html>`;

test('a repeated group with a heading, text and picture is learned as the cards design; a plain checklist is not', () => {
  const p = learnPatterns(PAGE);
  assert.ok(p.cards, 'cards found');
  const w = cheerio.load(p.cards.wrapperHtml, null, false), i = cheerio.load(p.cards.itemHtml, null, false);
  assert.equal(w('[data-slot~="items"]').children().length, 0, 'items container is emptied');
  assert.equal(w('[data-slot~="title"]').length, 1);
  assert.equal(w('p').length, 0, 'the template subject\'s intro text is not kept');
  assert.ok(['title', 'text', 'link', 'img'].every((s) => i(`[data-slot~="${s}"]`).length === 1 || i.root().children().first().is(`[data-slot~="${s}"]`)));
  assert.match(p.cards.itemHtml, /rounded-xl/);
  assert.doesNotMatch(p.cards.itemHtml, /Service one|Description of service one/);
});

test('FAQ question, answer and the toggle are learned separately; review lines that are not slots are dropped', () => {
  const p = learnPatterns(PAGE);
  const f = cheerio.load(p.faq.itemHtml, null, false);
  assert.equal(f('summary [data-slot~="q"]').length, 1);
  assert.match(p.faq.itemHtml, /<span class="ml-4">\+<\/span>/, 'the + toggle stays');
  assert.doesNotMatch(p.faq.itemHtml, /hour|fixed price/);
  assert.doesNotMatch(p.reviews.itemHtml, /Pompano|Great work/);
  assert.match(p.reviews.itemHtml, /data-slot="quote"/);
  assert.match(p.reviews.itemHtml, /data-slot="name"/);
  assert.equal(cheerio.load(p.cta.wrapperHtml, null, false)('[data-slot~="btn"]').attr('href'), 'tel:5550100');
});

test('filling a section: the title and each item, nothing of the template left, no slot markers', () => {
  const p = learnPatterns(PAGE);
  const html = fillPattern(p.cards, { title: 'What we do', items: [{ title: 'Drains', text: 'Clear drains.', href: '/drains.html', img: '/i/d.webp', imgAlt: 'Drain' }, { title: 'Pipes', text: 'New pipes.' }] });
  const $ = cheerio.load(html, null, false);
  assert.equal($('h2').text(), 'What we do');
  assert.equal($('h3').length, 2);
  assert.equal($('h3').first().text(), 'Drains');
  assert.equal($('a').first().attr('href'), '/drains.html');
  assert.equal($('img').length, 1, 'an item without a picture has no picture element');
  assert.equal($('img').attr('src'), '/i/d.webp');
  assert.equal($('a').last().attr('href'), undefined, 'an item without a link has no target');
  assert.doesNotMatch(html, /data-slot|Service one/);
  assert.equal(cheerio.load(fillPattern(p.cards, { items: [{ title: 'x', text: 'y' }] }), null, false)('h2').length, 0, 'no title, no heading');
  const faq = cheerio.load(fillPattern(p.faq, { title: 'FAQ', items: [{ q: 'Why?', a: 'Because.' }, { q: 'How?', a: '<p>Like <b>this</b>.</p>' }] }), null, false);
  assert.deepEqual(faq('summary').toArray().map((s) => faq(s).text().replace(/\s+/g, ' ').trim()), ['Why?+', 'How?+']);
  assert.equal(faq('details b').text(), 'this');
});

const MODEL = (blocks) => ({
  ok: true, head: { title: 'Old', description: 'Desc', robots: '', canonical: '', metas: [], jsonLd: [] }, hero: { h1: 'Old Heading', crumbs: [] },
  blocks, protected: { form: null, headScripts: [], bodyNoscript: '' },
});

test('on a converted page, text and sections follow the order of the old page; a heading before a section becomes its title; the closing band carries the old call to action', () => {
  const patterns = learnPatterns(PAGE);
  const model = MODEL([
    { t: 'h', level: 2, text: 'Intro heading' }, { t: 'html', html: '<p>Intro paragraph of the old page.</p>' },
    { t: 'h', level: 2, text: 'Old services' }, { t: 'cardgrid', items: [{ title: 'Old card A', text: 'About A' }, { title: 'Old card B', text: 'About B' }, { title: 'Old card C', text: 'About C' }] },
    { t: 'h', level: 2, text: 'More text' }, { t: 'html', html: '<p>Closing paragraph.</p>' },
    { t: 'faq', items: [{ q: 'Old question?', a: 'Old answer.' }] },
    { t: 'cta', title: 'Old call title', text: 'Old call text', href: 'tel:9990000', label: 'Call the old number' },
  ]);
  const { html } = convertPage({ model, templateHtml: PAGE, templateRel: 'a.html', targetRel: 'b.html', patterns });
  const $ = cheerio.load(html);
  const order = ['Intro paragraph', 'Old card A', 'Closing paragraph', 'Old question?'].map((t) => html.indexOf(t));
  assert.ok(order.every((n, i) => n > 0 && (i === 0 || n > order[i - 1])), `order ${order}`);
  assert.equal($('h2').filter((_, h) => $(h).text() === 'Old services').length, 1, 'the heading is the section title, once');
  assert.equal($('h3').filter((_, h) => /Old card/.test($(h).text())).length, 3);
  assert.equal($('details').length, 1);
  assert.match(html, /Old call title/);
  assert.equal($('a[href="tel:9990000"]').text(), 'Call the old number');
  assert.doesNotMatch(html, /Template call text|Service one|Do you charge|A\. Customer/);
});

test('without a pattern for a kind, that block is written as plain text in the template\'s classes', () => {
  const model = MODEL([{ t: 'html', html: '<p>Text.</p>' }, { t: 'faq', items: [{ q: 'Q one?', a: 'A one.' }] }]);
  const { html } = convertPage({ model, templateHtml: PAGE, templateRel: 'a.html', targetRel: 'b.html', patterns: {} });
  const $ = cheerio.load(html);
  assert.equal($('details').length, 0);
  assert.equal($('h3').filter((_, h) => $(h).text() === 'Q one?').length, 1);
});
