import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { convertPage } from '../src/template/own-convert.js';

// a template page like Virtual Guard's: the hero and a tagline band sit outside <main>; the text section has a text column and a
// "quick contact" box with the site's form embed; a card section follows it
const TEMPLATE = `<!doctype html><html lang="en"><head><title>T</title><link rel="stylesheet" href="s.css"></head><body class="bg-white">
<header><a href="/">Logo</a><nav><a href="/x">X</a></nav></header>
<section class="relative py-24 text-white"><div class="mx-auto max-w-5xl"><h1 class="text-5xl font-bold">Template hero title</h1><p class="mt-4">Template hero line</p></div></section>
<div class="bg-sky-700 py-3 text-center text-white"><p>Tagline of the whole site</p></div>
<main>
<section id="overview" class="py-20"><div class="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-12">
<div class="lg:col-span-7"><span class="text-sm font-bold">Template label</span><h2 class="text-3xl font-extrabold mt-2 mb-6">Template overview heading</h2>
<p class="text-gray-700 leading-relaxed">Template overview paragraph one with plenty of words so that it is clearly running text of the page and not a short line.</p>
<p class="text-gray-700 leading-relaxed">Template overview paragraph two with again plenty of words to be running text and to set the look of the paragraphs.</p>
<ul class="space-y-4"><li>First point</li><li>Second point</li></ul><h3 class="text-xl font-bold mb-3">Template sub heading</h3>
<p class="text-gray-700 leading-relaxed">Template overview paragraph three about something else entirely, also with plenty of words in it for the text area.</p></div>
<div id="quick-contact" class="lg:col-span-5"><div class="rounded-3xl border p-8"><span class="text-xs">Quick Contact</span><h3 class="text-2xl mt-4 mb-6">Get a Free Security Consultation</h3>
<div id="mf_placeholder" data-formurl="//x.test/mform/embed.php?id=1"></div><script>(function(){var m=document.getElementById('mf_placeholder');})();</script></div></div>
</div></section>
<section id="industries" class="bg-slate-50 py-20"><div class="mx-auto max-w-7xl px-4"><div class="mx-auto mb-16 max-w-4xl text-center"><h2 class="text-3xl font-bold">Industries Served</h2><p>Delivers security solutions across industries.</p></div>
<div class="grid gap-6 md:grid-cols-3">
<div class="rounded-xl border bg-white p-6"><h3 class="text-xl font-bold">Template card one</h3><p class="text-sm">Template card one description that is a little long, twenty words or so in total so that it is about as long as real card text.</p></div>
<div class="rounded-xl border bg-white p-6"><h3 class="text-xl font-bold">Template card two</h3><p class="text-sm">Template card two description that is a little long, twenty words or so in total so that it is about as long as real card text.</p></div>
<div class="rounded-xl border bg-white p-6"><h3 class="text-xl font-bold">Template card three</h3><p class="text-sm">Template card three description that is a little long, twenty words or so in total so that it is about as long as real card text.</p></div>
</div></div></section>
</main><footer>f</footer><script src="app.js"></script></body></html>`;

const FORM = '<div id="mf_placeholder" data-formurl="//x.test/mform/embed.php?id=99"></div><script>(function(){var m=document.getElementById("mf_placeholder");})();</script>';
const MODEL = {
  ok: true, head: { title: 'Old title', description: 'Old description of the page.', robots: '', canonical: '', metas: [], jsonLd: [] }, hero: { h1: 'Old Page Heading', crumbs: [] },
  blocks: [{ t: 'h', level: 4, text: 'Old section heading' }, { t: 'html', html: '<p>Old paragraph.</p><ul><li>Old item</li></ul>' }, { t: 'h', level: 4, text: 'Another old heading' }, { t: 'html', html: '<p>Second old paragraph.</p>' },
    { t: 'img', src: '../images/old.jpg', alt: 'Old image' }, { t: 'h', level: 3, text: 'Quick Contact' }, { t: 'form' }],
  protected: { form: FORM, headScripts: [], bodyNoscript: '' },
};
const run = (extra = {}) => { const r = convertPage({ model: MODEL, templateHtml: TEMPLATE, templateRel: 'a/t.html', targetRel: 'b/p.html', ...extra }); return { ...r, $: cheerio.load(r.html) }; };

test('a hero outside <main> gets the page\'s own title; the template\'s own text and cards are not kept', () => {
  const { $, html } = run();
  assert.equal($('h1').length, 1);
  assert.equal($('h1').text(), 'Old Page Heading');
  assert.equal($('title').text(), 'Old title');
  assert.doesNotMatch(html, /Template hero title|Template overview|Template card|Template label|Template sub heading/);
  assert.match(html, /Old paragraph\./);
});

test('the text goes into the text column, not into a card section, and a tagline band between hero and text stays', () => {
  const { $ } = run();
  assert.match($('.lg\\:col-span-7').html(), /Old section heading/);
  assert.match(html(run().$), /Tagline of the whole site/);
  assert.equal($('#industries').length, 0, 'the template\'s own card section is gone');
});
const html = ($) => $.html();

test('the form of the old page replaces the form in the template\'s form box, which keeps its own title; it is not repeated in the text', () => {
  const { $ } = run();
  assert.equal($('#mf_placeholder').length, 1);
  assert.match($('#mf_placeholder').attr('data-formurl'), /id=99/);
  assert.equal($('#quick-contact #mf_placeholder').length, 1);
  assert.match($('#quick-contact').text(), /Get a Free Security Consultation/);
  assert.equal($('script').filter((_, s) => /getElementById\('mf_placeholder'\)|getElementById\("mf_placeholder"\)/.test($(s).html() || '')).length, 1, 'one loader script');
  assert.doesNotMatch($('.lg\\:col-span-7').text(), /Quick Contact/, 'the heading of the form is not left in the text');
});

test('spacing classes the stylesheet already has are added where the template\'s own classes carry no margin; others are left alone', () => {
  const vocab = new Set(['mb-4', 'mt-8', 'mb-6']);
  const withVocab = run({ vocab }).$;
  assert.ok(withVocab('.lg\\:col-span-7 p').toArray().some((p) => /mb-4/.test(withVocab(p).attr('class') || '')));
  const heads = withVocab('.lg\\:col-span-7 h2').toArray().map((h) => withVocab(h).attr('class') || '');
  assert.ok(heads.length >= 2 && !/mt-8/.test(heads[0]) && /mt-8/.test(heads[1]), 'headings after the first get room above');
  const none = run({}).$;
  assert.ok(!none('.lg\\:col-span-7 p').toArray().some((p) => /mb-4/.test(none(p).attr('class') || '')));
  // a class the stylesheet does not have is never added
  const other = run({ vocab: new Set(['mb-3']) }).$;
  assert.ok(!other('.lg\\:col-span-7 p').toArray().some((p) => /mb-4/.test(other(p).attr('class') || '')));
});

test('a role chosen for a section of the template wins over the automatic one', () => {
  // the card section is made the text area: the old text goes there, and the template's own text section is not copied
  const r = convertPage({ model: MODEL, templateHtml: TEMPLATE, templateRel: 'a/t.html', targetRel: 'b/p.html', roles: { industries: 'text' } });
  const $ = cheerio.load(r.html);
  assert.match($('#industries').text(), /Old paragraph\./);
  assert.equal($('#overview').length, 0);
  // a section marked "keep as it is" stays, one marked "do not copy" goes
  const keep = cheerio.load(convertPage({ model: MODEL, templateHtml: TEMPLATE, templateRel: 'a/t.html', targetRel: 'b/p.html', roles: { industries: 'band' } }).html);
  assert.equal(keep('#industries').length, 1);
  assert.match(keep('#industries').text(), /Template card one/);
  assert.match(keep('#overview').text(), /Old paragraph\./);
});

test('headings of the old page keep their outline: peers stay peers, whatever level number the old page gave them', () => {
  const flat = { ...MODEL, blocks: [{ t: 'h', level: 4, text: 'First point' }, { t: 'html', html: '<p>One.</p>' }, { t: 'h', level: 4, text: 'Second point' }, { t: 'html', html: '<p>Two.</p>' }, { t: 'h', level: 2, text: 'Added closing heading' }, { t: 'html', html: '<p>End.</p>' }] };
  const a = cheerio.load(convertPage({ model: flat, templateHtml: TEMPLATE, templateRel: 'a/t.html', targetRel: 'b/p.html' }).html);
  assert.deepEqual(a('[class~="lg:col-span-7"] h2, [class~="lg:col-span-7"] h3, [class~="lg:col-span-7"] h4').toArray().map((h) => h.tagName), ['h2', 'h2', 'h2']);
  const nested = { ...MODEL, blocks: [{ t: 'h', level: 2, text: 'Part' }, { t: 'h', level: 3, text: 'Detail' }, { t: 'html', html: '<p>x</p>' }, { t: 'h', level: 2, text: 'Next part' }] };
  const b = cheerio.load(convertPage({ model: nested, templateHtml: TEMPLATE, templateRel: 'a/t.html', targetRel: 'b/p.html' }).html);
  assert.deepEqual(b('[class~="lg:col-span-7"] h2, [class~="lg:col-span-7"] h3').toArray().map((h) => h.tagName), ['h2', 'h3', 'h2']);
});
