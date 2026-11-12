import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseOptions, optionsOf, contentAddedFor, areasOf, inScope, areaOfCheck, auditAreaOf, scopeScan } from '../src/options.js';
import { patchUnits, skeleton } from '../src/content/inplace-text.js';
import { duplicateGroups, linkReport, cannibalisation, accessibilityOf } from '../src/scanner/insights.js';
import { shingleSimilarity } from '../src/scanner/audit.js';

// ---------- what a website is updated for ----------
test('a website with nothing chosen gets all three options', () => {
  assert.deepEqual(normaliseOptions(undefined), { template: true, images: true, content: true });
  assert.deepEqual(optionsOf({}), { template: true, images: true, content: true });
});

test('Update Template always brings Update Content', () => {
  assert.deepEqual(normaliseOptions({ template: true, images: false, content: false }), { template: true, images: false, content: true });
  assert.equal(contentAddedFor({ template: true, content: false }), true);
  assert.equal(contentAddedFor({ template: true, content: true }), false);
});

test('at least one option has to be chosen', () => {
  assert.throws(() => normaliseOptions({ template: false, images: false, content: false }), /at least one/i);
});

test('content counts only when the wording changes', () => {
  const client = { options: { template: true, images: false, content: true } };
  assert.equal(areasOf(client, { contentMode: 'existing' }).content, false);
  assert.equal(areasOf(client, { contentMode: 'enhance' }).content, true);
  assert.equal(areasOf(client, { contentMode: 'rewrite' }).images, false);
});

test('each check belongs to the right option', () => {
  const imagesOnly = { template: false, images: true, content: false };
  assert.equal(areaOfCheck('img-alt'), 'images');
  assert.equal(areaOfCheck('viewport'), 'template');
  assert.equal(areaOfCheck('title-length'), 'content');
  assert.equal(inScope('img-dimensions', imagesOnly), true);
  assert.equal(inScope('title-length', imagesOnly), false);
  assert.equal(auditAreaOf('img-legacy-format'), 'images');
  assert.equal(auditAreaOf('no-viewport'), 'template');
  assert.equal(auditAreaOf('thin-content'), 'content');
});

test('the audit shows only the problems of the chosen options', () => {
  const data = {
    summary: { pages: 2, issues: {} },
    pages: [
      { path: 'a.html', issues: [{ code: 'img-alt' }, { code: 'title-long' }, { code: 'no-viewport' }] },
      { path: 'b.html', issues: [{ code: 'img-alt' }] },
    ],
  };
  const images = scopeScan(data, { options: { template: false, images: true, content: false } });
  assert.deepEqual(images.summary.issues, { 'img-alt': 2 });
  assert.deepEqual(images.pages[0].issues.map((i) => i.code), ['img-alt']);
  const content = scopeScan(data, { options: { template: false, images: false, content: true } });
  assert.deepEqual(content.summary.issues, { 'title-long': 1 });
});

// ---------- words-only changes inside an existing page ----------
const PAGE = `<html><body><header><nav>Menu words</nav></header><main>
<h1>Boca Raton Plumber</h1>
<p>We fix leaking pipes <a href="/leaks.html">fast</a>. Call today.</p>
<ul><li>Drain cleaning</li><li>Water heaters</li></ul>
<!-- keep me --><img src="a.jpg" alt="pipe">
</main><footer>Footer words</footer></body></html>`;

test('new wording goes into the page and nothing but words changes', () => {
  const out = patchUnits(PAGE, [
    { id: 'u1', kind: 'text', before: 'Boca Raton Plumber', after: 'Plumber in Boca Raton' },
    { id: 'u2', kind: 'html', before: '<p>We fix leaking pipes <a href="/leaks.html">fast</a>. Call today.</p>', after: '<p>Leaking pipes are repaired <a href="/leaks.html">quickly</a>. Call us.</p>' },
  ]);
  assert.deepEqual(out.applied, ['u1', 'u2']);
  assert.match(out.html, /Plumber in Boca Raton/);
  assert.match(out.html, /<!-- keep me -->/);
  assert.match(out.html, /<img src="a.jpg" alt="pipe">/);
  assert.equal(skeleton(out.html), skeleton(PAGE));
});

test('a change that alters the formatting or link is not applied', () => {
  const out = patchUnits(PAGE, [
    { id: 'x1', kind: 'html', before: '<p>We fix leaking pipes <a href="/leaks.html">fast</a>. Call today.</p>', after: '<p>We fix leaking pipes. Call today.</p>' },
    { id: 'x2', kind: 'html', before: '<ul><li>Drain cleaning</li><li>Water heaters</li></ul>', after: '<ul><li>Drains</li></ul>' },
    { id: 'x3', kind: 'text', before: 'A heading that is not there', after: 'Whatever' },
  ]);
  assert.deepEqual(out.applied, []);
  assert.equal(out.skipped.length, 3);
  assert.equal(out.html.includes('Water heaters'), true);
});

test('menu and footer words are never touched', () => {
  const out = patchUnits(PAGE, [{ id: 'm', kind: 'text', before: 'Menu words', after: 'Changed' }, { id: 'f', kind: 'text', before: 'Footer words', after: 'Changed' }]);
  assert.deepEqual(out.applied, []);
});

// ---------- the deeper checks ----------
test('duplicate pages are grouped together', () => {
  const pages = [
    { path: 'a.html', duplicates: [{ path: 'b.html', similarity: 0.7 }] },
    { path: 'b.html', duplicates: [{ path: 'a.html', similarity: 0.7 }, { path: 'c.html', similarity: 0.55 }] },
    { path: 'c.html', duplicates: [{ path: 'b.html', similarity: 0.55 }] },
    { path: 'd.html', duplicates: [] },
  ];
  const groups = duplicateGroups(pages);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].pages, ['a.html', 'b.html', 'c.html']);
  assert.equal(groups[0].max, 0.7);
});

test('pages nobody links to, and broken links, are found', () => {
  const pages = [
    { path: 'index.html', type: 'home', links: [{ href: 'a.html', text: 'A' }, { href: 'missing.html', text: 'Gone' }, { href: 'https://other.com/x.html', text: 'Other' }] },
    { path: 'a.html', type: 'service', links: [{ href: '/index.html', text: 'Home' }] },
    { path: 'lonely.html', type: 'service', links: [] },
  ];
  const r = linkReport(pages, 'example.com');
  assert.deepEqual(r.orphans, ['lonely.html']);
  assert.equal(r.brokenTotal, 1);
  assert.equal(r.broken[0].to, 'missing.html');
});

test('pages with the same heading compete for the same keyword', () => {
  const pages = [
    { path: 'a.html', type: 'service', h1: ['Drain Cleaning in Boca'], title: 'One' },
    { path: 'b.html', type: 'service', h1: ['drain cleaning in boca!'], title: 'Two' },
    { path: 'c.html', type: 'service', h1: ['Water Heaters'], title: 'Three' },
  ];
  const g = cannibalisation(pages);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].pages, ['a.html', 'b.html']);
});

test('accessibility problems in the page code are listed', () => {
  const found = Object.fromEntries(accessibilityOf(`<html><head><meta name="viewport" content="width=device-width, user-scalable=no"></head><body>
    <h1>Title</h1><h3>Skipped</h3>
    <form><input type="text" name="q"><label for="e">Email</label><input id="e" type="email"></form>
    <a href="/x.html">click here</a><a href="/y.html"></a><button></button><iframe src="/f.html"></iframe>
  </body></html>`).map((p) => [p.id, p.count]));
  assert.equal(found['form-label'], 1);
  assert.equal(found['link-generic'], 1);
  assert.equal(found['link-name'], 1);
  assert.equal(found['button-name'], 1);
  assert.equal(found['iframe-title'], 1);
  assert.equal(found['heading-order'], 1);
  assert.equal(found['zoom-blocked'], 1);
});

test('a clean page has no accessibility problems', () => {
  assert.deepEqual(accessibilityOf('<html><body><h1>T</h1><h2>U</h2><a href="/a.html">Our drain service</a><label>Name <input name="n"></label></body></html>'), []);
});

test('the audit duplicate measure tells alike texts from different ones', () => {
  const a = 'We repair leaking pipes in Boca Raton and we offer same visit estimates for every home owner nearby today';
  assert.ok(shingleSimilarity(a, a) > 0.99);
  assert.ok(shingleSimilarity(a, 'Backflow testing keeps drinking water safe and many cities require a yearly certified test report') < 0.1);
});
