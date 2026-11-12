import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { altFromFile, finalizeHtml } from '../src/build/seo-final.js';
import { titleProblem, metaProblem, findProblems, ruleTitle, ruleMeta, makeHeadFixer } from '../src/content/seo-fix.js';
import { seoChecks } from '../src/validate/seo.js';

test('a file name becomes plain alt text, and a file name that says nothing is not used', () => {
  assert.equal(altFromFile('images/south-florida-commercial-plumber-480w.webp'), 'South florida commercial plumber');
  assert.equal(altFromFile('/images/Modern_Kitchen_Bath.webp'), 'Modern kitchen bath');
  assert.equal(altFromFile('images/backflow-img.webp'), 'Backflow');
  for (const none of ['images/faq-img-1.jpg', 'images/car-img.svg', 'IMG_2043.JPG', 'DSC00123.jpg', 'images/a1b2c3d4e5f6.png', 'banner.png']) assert.equal(altFromFile(none), '', none);
});

const PAGE = `<!doctype html><html lang="en"><head><title>x</title><link rel="canonical" href="http://old.example.com/other.html"></head><body>
<header><img src="images/logo.svg" alt="Logo" loading="lazy" width="200" height="50"></header>
<main id="main"><section><h1>Backflow Testing</h1><h1>Second H1</h1><img src="images/faq-img-1.jpg" width="800" height="400">
<img src="images/icon.svg" width="56" height="56" alt="" loading="lazy"></section>
<section><h2>Common Questions</h2><img src="images/south-florida-commercial-plumber.webp" alt="" width="800" height="400">
<ul><li><img src="images/a.jpg" width="300" height="200"><h3>Drain Cleaning</h3></li><li><img src="images/b.jpg" width="300" height="200"><h3>Leak Repair</h3></li></ul></section></main>
<footer><img src="images/f-logo.svg" alt="Footer logo" width="200" height="50" loading="eager"></footer></body></html>`;

test('every content image gets descriptive alt text, named after its card or section when the file name says nothing', () => {
  const { html, changes } = finalizeHtml(PAGE, { rel: 'service/a.html', canonicalHost: 'www.example.com', host: 'example.com' });
  const $ = cheerio.load(html);
  const alts = $('main img').toArray().map((i) => $(i).attr('alt'));
  assert.deepEqual(alts, ['Second H1 image', '', 'South florida commercial plumber', 'Drain Cleaning image', 'Leak Repair image']);
  assert.equal(changes.alt, 4); // the 56px icon is decorative and keeps its empty alt
});

test('images above the fold are eager, everything below is lazy', () => {
  const $ = cheerio.load(finalizeHtml(PAGE, { rel: 'a.html', canonicalHost: 'example.com', host: 'example.com' }).html);
  const load = (sel) => $(sel).toArray().map((i) => $(i).attr('loading'));
  assert.deepEqual(load('header img'), ['eager']);
  assert.deepEqual(load('main img').slice(0, 2), ['eager', 'eager']); // the first content image, and the small icon in the opening block
  assert.deepEqual(load('main img').slice(2), ['lazy', 'lazy', 'lazy']);
  assert.deepEqual(load('footer img'), ['lazy']);
});

test('one H1 and an absolute https self-referencing canonical link', () => {
  const $ = cheerio.load(finalizeHtml(PAGE, { rel: 'service/a.html', canonicalHost: 'www.example.com', host: 'example.com' }).html);
  assert.equal($('h1').length, 1);
  assert.equal($('main h2').first().text(), 'Second H1');
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://www.example.com/service/a.html');
  const home = cheerio.load(finalizeHtml(PAGE, { rel: 'index.html', canonicalHost: 'example.com', host: 'example.com' }).html);
  assert.equal(home('link[rel="canonical"]').attr('href'), 'https://example.com/');
});

test('the finished page passes the validation checks for alt text, lazy loading, H1 and canonical', () => {
  const { html } = finalizeHtml(PAGE, { rel: 'service/a.html', canonicalHost: 'www.example.com', host: 'example.com' });
  const checks = seoChecks({ html, rel: 'service/a.html', type: 'service', host: 'example.com', phoneDigits: '', titles: new Map(), metas: new Map() });
  const bad = (id) => checks.find((c) => c.id === id);
  for (const id of ['img-alt-meaningful', 'img-lazy', 'h1-single', 'canonical']) assert.equal(bad(id).ok, true, id + ': ' + bad(id).msg);
  const before = seoChecks({ html: PAGE, rel: 'service/a.html', type: 'service', host: 'example.com', phoneDigits: '', titles: new Map(), metas: new Map() });
  for (const id of ['img-alt-meaningful', 'img-lazy', 'h1-single', 'canonical']) assert.equal(before.find((c) => c.id === id).ok, false, 'the original page should fail ' + id);
});

test('titles and meta descriptions: length, cut-off text and sentence endings', () => {
  assert.equal(titleProblem('Backflow Testing, Repair, and Replacement Services'), '');
  assert.match(titleProblem('Short title'), /too short/);
  assert.match(titleProblem('Backflow Testing, Repair, and Replacement Services in South Florida and More'), /too long/);
  assert.match(titleProblem('Professional Backflow Testing Services for Homes and'), /cut off/);
  assert.match(titleProblem('Professional Backflow Testing Services for Homes |'), /cut off/);
  const ok = 'Licensed backflow testing, repair and replacement for homes and businesses across Broward County. Call us to schedule a visit.';
  assert.equal(metaProblem(ok), '');
  assert.match(metaProblem(ok.slice(0, 100)), /too short/);
  assert.match(metaProblem(ok + ' ' + ok), /too long/);
  assert.match(metaProblem('Backflow testing, repair and replacement for homes and businesses across Broward County, with a visit that suits your day and a clear'), /(complete sentence|cut off)/);
});

test('a page that repeats another page\'s title or description is flagged, and only the later one', () => {
  const t = 'Backflow Testing, Repair, and Replacement Services';
  const m = 'Licensed backflow testing, repair and replacement for homes and businesses across Broward County. Call us to schedule a visit.';
  const p = findProblems([{ path: 'a.html', title: t, description: m }, { path: 'b.html', title: t, description: m }]);
  assert.deepEqual(p.map((x) => [x.path, x.title, x.meta]), [['b.html', true, true]]);
  assert.deepEqual(findProblems([{ path: 'a.html', title: t, description: m }], [{ title: t, description: 'Something else entirely that is also a long enough description for the check to pass cleanly here.' }]).map((x) => [x.path, x.title, x.meta]), [['a.html', true, false]]);
});

test('the rules-only fixer writes whole, different titles and descriptions, and never trims text', async () => {
  const heads = [
    { path: 'coconut-creek-backflow-inspection.html', type: 'location-service', h1: 'Coconut Creek Backflow Inspection Services Provided By Our Expert Team', title: 'Coconut Creek Backflow Inspection Services Provided By Our Expert Team Today', description: 'Short.', text: 'We test backflow preventers for homes and businesses in Coconut Creek. Annual testing keeps drinking water safe and meets local rules.' },
    { path: 'coconut-creek-backflow-repair.html', type: 'location-service', h1: 'Coconut Creek Backflow Repair', title: 'Coconut Creek Backflow Repair', description: 'Short.', text: '' },
    { path: 'coral-springs-backflow-repair.html', type: 'location-service', h1: 'Coral Springs Backflow Repair', title: 'Coconut Creek Backflow Repair', description: 'Short.', text: '' },
  ];
  const fix = makeHeadFixer({ slug: 'unit-test', ai: false, persist: false });
  const out = await fix(heads, { scan: [], site: { name: 'South Florida Plumbing & Backflow', phone: { display: '(954) 592-6220' } }, profile: {} });
  assert.equal(fix.stats.unresolved.length, 0);
  const titles = new Set(), metas = new Set();
  for (const h of heads) {
    const f = out.get(h.path) || {};
    const title = f.title || h.title, meta = f.description || h.description;
    assert.equal(titleProblem(title), '', `${h.path}: ${title}`);
    assert.equal(metaProblem(meta), '', `${h.path}: ${meta}`);
    assert.equal(titles.has(title.toLowerCase()), false, 'duplicate title ' + title); titles.add(title.toLowerCase());
    assert.equal(metas.has(meta.toLowerCase()), false, 'duplicate description ' + meta); metas.add(meta.toLowerCase());
  }
  // the first page's own sentences are reused whole
  assert.match(out.get(heads[0].path).description, /^We test backflow preventers for homes and businesses in Coconut Creek\./);
  void ruleTitle; void ruleMeta;
});
