import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { aiConvertPage, check, tidy, classVocab, contentArea } from '../src/template/own-ai.js';
import { extractModel } from '../src/build/model.js';

const TEMPLATE = `<!doctype html><html><head><meta charset="utf-8"><title>Reference</title><meta name="description" content="Reference description"><link rel="stylesheet" href="../assets/site.css"><script src="../assets/menu.js"></script></head>
<body class="bg-white"><header class="sticky"><a href="../index.html">Home</a><nav><a href="../a.html">Reference menu</a></nav></header>
<main><section class="hero bg-sky-800"><h1 class="text-4xl">Reference heading about gutters</h1><p class="lead">Reference lead about gutters and downspouts for homes.</p></section>
<section class="py-12"><div class="max-w-3xl"><h2 class="text-2xl">Why choose reference gutters</h2><p class="leading-relaxed">We have installed seamless gutters across the county for many years with care.</p></div></section></main>
<footer class="bg-slate-900"><a href="../contact.html">Contact</a></footer><script>window.tpl=1</script></body></html>`;

const OLD = `<!doctype html><html><head><title>Old</title><script>gtag("config","G-OLD12345")</script></head><body>
<header><a href="/">Home</a></header>
<div id="content"><h1>Roof Repair in Tampa</h1><p>Call (813) 555-0142 for fast roof repair. We fix leaks, shingles and flashing.</p>
<h2>Our process</h2><p>We inspect the roof, explain the options and finish the job in one day.</p><img src="/images/roof-crew.jpg" alt="Crew" width="600" height="400"><a href="/contact.html">Contact us</a></div>
<footer>Old footer</footer></body></html>`;

const good = `<section class="hero bg-sky-800"><h1 class="text-4xl">Roof Repair in Tampa</h1><p class="lead">Call (813) 555-0142 for fast roof repair. We fix leaks, shingles and flashing.</p></section>
<section class="py-12"><div class="max-w-3xl"><h2 class="text-2xl">Our process</h2><p class="leading-relaxed">We inspect the roof, explain the options and finish the job in one day.</p><img src="/images/roof-crew.jpg" alt="Crew" width="600" height="400"><a href="/contact.html">Contact us</a></div></section>`;

const run = (html, extra = {}) => {
  const model = extractModel(OLD, 'roof/repair.html');
  return aiConvertPage({ slug: 'no-such-client', model, templateHtml: TEMPLATE, templateRel: 'a/template.html', targetRel: 'roof/repair.html', originalHtml: OLD, mode: 'existing', store: false, call: async () => ({ input: { html, notes: ['n'] }, cost: 0 }), ...extra });
};

test('the reference keeps its head, header, footer and scripts; only the content area is replaced', async () => {
  const r = await run(good);
  const $ = cheerio.load(r.html);
  assert.equal($('header nav').text(), 'Reference menu');
  assert.equal($('footer').text(), 'Contact');
  assert.ok($('link[rel="stylesheet"]').length === 1 && $('script[src$="menu.js"]').length === 1);
  assert.equal($('h1').length, 1);
  assert.equal($('h1').text(), 'Roof Repair in Tampa');
  assert.ok(!/gutters/i.test($('main').text()), 'nothing of the reference wording is left');
  assert.ok($('img[src="/images/roof-crew.jpg"]').length === 1, 'the old picture is used');
  assert.ok($('script').toArray().some((s) => $(s).html().includes('window.tpl')), 'the reference script outside the content area stays');
});

test('the old page\'s tracking code is added to the head, the title and description are the old page\'s', async () => {
  const r = await run(good);
  const $ = cheerio.load(r.html);
  assert.ok($('head').html().includes('G-OLD12345'));
  assert.equal($('title').text(), 'Old');
});

test('an answer that drops a picture, a link, a fact or the wording is refused', () => {
  const oldContent = '<h1>Roof Repair in Tampa</h1><p>Call (813) 555-0142 for fast roof repair.</p><img src="/images/roof-crew.jpg" alt=""><a href="/contact.html">Contact us</a>';
  const args = { oldContent, referenceText: 'Reference lead about gutters and downspouts for homes.', mode: 'existing', h1: 'Roof Repair in Tampa' };
  assert.deepEqual(check({ ...args, html: oldContent }), []);
  assert.match(check({ ...args, html: oldContent.replace('<img src="/images/roof-crew.jpg" alt="">', '') }).join(' '), /pictures/);
  assert.match(check({ ...args, html: oldContent.replace('<a href="/contact.html">Contact us</a>', '') }).join(' '), /links/);
  assert.match(check({ ...args, html: oldContent.replace('(813) 555-0142', '(813) 555-0000') }).join(' '), /facts/);
  assert.match(check({ ...args, html: oldContent.replace('fast roof repair', 'quick fixes for any roof') }).join(' '), /word for word/);
  assert.match(check({ ...args, html: `${oldContent}<p>Reference lead about gutters and downspouts for homes.</p>` }).join(' '), /reference page is still/);
  assert.match(check({ ...args, html: `${oldContent}<h1>Second</h1>` }).join(' '), /exactly one/);
});

test('enhance and rewrite may reword, but keep the facts', () => {
  const oldContent = '<h1>Roof Repair in Tampa</h1><p>We repair roofs. Call (813) 555-0142. We have worked on homes in Tampa since 1998 and fix leaks, shingles and flashing for every customer.</p>';
  const html = '<h1>Roof Repair in Tampa</h1><p>Leaks, shingles, flashing: our Tampa team has fixed them since 1998. Call (813) 555-0142 and we will come out and look at the roof with you today.</p>';
  const args = { oldContent, referenceText: '', h1: 'Roof Repair in Tampa' };
  assert.deepEqual(check({ ...args, html, mode: 'enhance' }), []);
  assert.match(check({ ...args, html: html.replace('1998', '2005'), mode: 'rewrite' }).join(' '), /facts/);
});

test('what the AI adds that could break the page is removed: scripts, inline styles, handlers and classes the site does not have', () => {
  const notes = new Set();
  const out = tidy('<div class="py-12 made-up" style="color:red" onclick="x()"><script>x()</script><a href="javascript:x()">a</a><p class="leading-relaxed">t</p></div>', { vocab: classVocab('<p class="py-12 leading-relaxed">'), store: [], form: '', notes });
  const $ = cheerio.load(out, null, false);
  assert.ok(!$('script').length && !$('[style]').length && !$('[onclick]').length && !$('a[href^="javascript"]').length);
  assert.equal($('div').attr('class'), 'py-12');
  assert.ok(notes.size === 1);
});

test('the old form goes where the AI put the marker', async () => {
  const withForm = OLD.replace('<a href="/contact.html">', '<div id="mf_placeholder"></div><script>mf_placeholder()</script><a href="/contact.html">');
  const model = extractModel(withForm, 'roof/repair.html');
  assert.ok(model.protected.form);
  const r = await aiConvertPage({ slug: 'no-such-client', model, templateHtml: TEMPLATE, templateRel: 'a/template.html', targetRel: 'roof/repair.html', originalHtml: withForm, mode: 'existing', store: false, call: async () => ({ input: { html: good.replace('<a href=', '<!--OLD_FORM--><a href=') }, cost: 0 }) });
  assert.ok(r.html.includes('mf_placeholder'));
  assert.ok(!r.html.includes('OLD_FORM'));
});

test('a refused answer is not used, and the reason is given', async () => {
  await assert.rejects(run('<h1>Nothing useful</h1>'), /did not pass the checks/);
  await assert.rejects(run(good, { allowCall: false }), /has not been run yet/);
});

test('the content area is what lies between the header and the footer', () => {
  const $ = cheerio.load(TEMPLATE);
  const area = contentArea($);
  assert.deepEqual(area.nodes.map((n) => n.name), ['section', 'section']);
  assert.deepEqual(area.keys, ['u0', 'u1']);
});

test('an element that sits in a parent the reference never puts it in is refused', async () => {
  const { structureProblems } = await import('../src/template/own-ai.js');
  const ref = '<section class="py-12"><div class="card"><h3 class="t">A</h3><p>x</p></div></section><div class="hero"><h1 class="big">H</h1></div>';
  assert.deepEqual(structureProblems('<section class="py-12"><div class="card"><h3 class="t">B</h3></div></section>', ref), []);
  assert.match(structureProblems('<div class="hero"><div class="card"><h3 class="t">B</h3></div></div>', ref).join(' '), /card inside/);
});

test('navigation menus inside the content area stay with the template and are not handed over', () => {
  const html = '<html><body><header><a href="/">h</a></header><div class="navigation-res"><ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li><li><a href="/c">C</a></li></ul></div><main><h1>T</h1></main><footer>f</footer></body></html>';
  const area = contentArea(cheerio.load(html));
  assert.deepEqual(area.nodes.map((n) => n.name), ['h1']);
});

test('sections the template shows on all its pages are kept exactly and must be placed once', async () => {
  const { commonSections, sectionsOf, keepProblems, decorationProblems } = await import('../src/template/own-ai.js');
  const band = '<section class="band"><h2>Same day junk removal across Miami and Broward call now for fast service</h2></section>';
  const page = (mid) => `<html><body><header><a href="/">h</a></header>${mid}${band}<footer>f</footer></body></html>`;
  const $ = cheerio.load(page('<section class="own"><h1>Subject A</h1><p>Words only on this page about subject A in detail.</p></section>'));
  const sections = sectionsOf(contentArea($));
  const common = commonSections($, sections, [page('<section class="own"><h1>Subject B</h1><p>Other words</p></section>')]);
  assert.deepEqual([...common], [1]);
  assert.match(keepProblems('<h1>x</h1>', common, 2).join(' '), /KEEP 1/);
  assert.deepEqual(keepProblems('<h1>x</h1><!--KEEP 1-->', common, 2), []);
  assert.match(keepProblems('<!--KEEP 1--><!--KEEP 1-->', common, 2).join(' '), /more than once/);
  // an icon box of the reference cannot be left out
  const ref = '<div class="card"><div class="ico"><svg></svg></div><h3 class="t">A</h3></div>';
  assert.deepEqual(decorationProblems(ref.replace('A', 'B'), ref), []);
  assert.match(decorationProblems('<div class="card"><h3 class="t">B</h3></div>', ref).join(' '), /ico/);
  assert.match(decorationProblems('<div class="card"><div class="ico"></div><h3 class="t">B</h3></div>', ref).join(' '), /icon/);
});

test('a common section keeps its markup and wording; only the wording about the service changes', async () => {
  const { adaptProblems } = await import('../src/template/own-ai.js');
  const orig = '<section class="band"><h2 class="t">Request a Residential Junk Removal Quote</h2><p>Licensed and insured crew. Call (954) 775-4717 today.</p><a class="btn" href="/quote.html">Get a quote</a></section>';
  assert.deepEqual(adaptProblems(orig, orig.replace('Residential Junk Removal', 'Foreclosure Cleanout'), 3), []);
  assert.match(adaptProblems(orig, orig.replace('class="btn" ', ''), 3).join(' '), /markup/);
  assert.match(adaptProblems(orig, orig.replace('/quote.html', '/other.html'), 3).join(' '), /markup/);
  assert.match(adaptProblems(orig, orig.replace('(954) 775-4717', '(305) 000-0000'), 3).join(' '), /phone/);
  assert.match(adaptProblems(orig, '<section class="band"><h2 class="t">Totally different words here now</h2><p>Nothing alike at all in this text.</p><a class="btn" href="/quote.html">Go</a></section>', 3).join(' '), /too much/);
});

test('the converter places the adapted common section where the AI put its marker', async () => {
  const tpl = `<html><head><title>R</title></head><body><header><a href="/">h</a></header>
<section class="hero"><h1 class="big">Roof Repair</h1></section>
<section class="band"><h2 class="t">Request a Roof Repair Quote</h2><p>Licensed and insured crew works every day for every customer.</p></section>
<section class="body"><p class="p">Roof repair text of the reference page itself for show only.</p></section><footer>f</footer></body></html>`;
  const old = `<html><head><title>Old</title></head><body><header>h</header><div id="c"><h1>Gutter Cleaning</h1><p>We clean gutters and downspouts for homes in Tampa and keep them flowing all year round.</p></div><footer>f</footer></body></html>`;
  const model = extractModel(old, 'g/gutters.html');
  const call = async () => ({ input: {
    html: '<section class="hero"><h1 class="big">Gutter Cleaning</h1></section><!--KEEP 1--><section class="body"><p class="p">We clean gutters and downspouts for homes in Tampa and keep them flowing all year round.</p></section>',
    common_sections: [{ n: 1, html: '<section class="band"><h2 class="t">Request a Gutter Cleaning Quote</h2><p>Licensed and insured crew works every day for every customer.</p></section>' }],
  }, cost: 0 });
  const r = await aiConvertPage({ slug: 'no-such-client', model, templateHtml: tpl, templateRel: 'a/t.html', targetRel: 'g/gutters.html', originalHtml: old, mode: 'existing', store: false, call, roles: { u1: 'common' }, vocab: null });
  const $ = cheerio.load(r.html);
  assert.equal($('h2.t').text(), 'Request a Gutter Cleaning Quote');
  assert.equal($('section').length, 3);
  assert.ok(!/Roof Repair/.test($('body').text()));
  assert.equal($('header').length, 1);
  // a section the AI forgot to place is refused
  await assert.rejects(aiConvertPage({ slug: 'no-such-client', model, templateHtml: tpl, templateRel: 'a/t.html', targetRel: 'g/gutters.html', originalHtml: old, mode: 'existing', store: false, roles: { u1: 'common' }, call: async () => ({ input: { html: '<section class="hero"><h1 class="big">Gutter Cleaning</h1></section><section class="body"><p class="p">We clean gutters and downspouts for homes in Tampa and keep them flowing all year round.</p></section>', common_sections: [] }, cost: 0 }) }), /KEEP 1/);
});
