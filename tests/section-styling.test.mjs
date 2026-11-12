import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePage, normalizeSpec, specCss, DEFAULT_SPEC } from '../src/template/spec.js';
import { applySectionClassTweaks } from '../src/template/class-tweaks.js';

const page = (s) => normalizePage({ sections: [{ ref: 'hero', ...s }] }).sections[0];

test('class tweaks on a section are kept, but classes that would hide content are dropped', () => {
  const s = page({ tweaks: [{ selector: 'h1', add: ['text-5xl', 'hidden', 'md:invisible', 'sr-only', 'opacity-0'], remove: ['text-4xl'] }] });
  assert.deepEqual(s.tweaks, [{ selector: 'h1', add: ['text-5xl'], remove: ['text-4xl'] }]);
});

test('a section can carry columns, an image and a background as structural extras', () => {
  const s = page({ extra: { columns: 2, background: 'soft', image: { src: 'images/van.jpg', alt: 'A van', side: 'left' } } });
  assert.equal(s.extra.columns, 2);
  assert.equal(s.extra.background, 'soft');
  assert.equal(s.extra.image.side, 'left');
  assert.equal(page({ extra: { image: { src: 'javascript:alert(1)' } } }).extra, null);
});

test('scoped custom CSS is nested under its section and unsafe CSS is refused', () => {
  const ok = page({ id: 'hero', css: '& h1 { letter-spacing: .08em }' });
  const spec = normalizeSpec({ page: { sections: [{ ref: 'hero', id: 'hero', css: ok.css }] } }, DEFAULT_SPEC);
  assert.match(specCss(spec), /\[data-sec="hero"\] \{ & h1 \{ letter-spacing: \.08em \} \}/);
  assert.equal(page({ css: '& h1 { display: none }' }).css, '');
  assert.equal(page({ css: '} body { background: red } .x {' }).css, '');
  assert.equal(page({ css: '@import url(https://evil.example/x.css); & p { color: red }' }).css.includes('@import'), false);
});

test('tweaks are applied inside one section and "section" targets the section itself', () => {
  const html = '<section class="sec"><div class="wrap"><h2 class="text-2xl">Title</h2><p>Text</p></div></section>';
  const out = applySectionClassTweaks(html, [
    { selector: 'h2', add: ['text-4xl'], remove: ['text-2xl'] },
    { selector: 'section', add: ['py-24'], remove: [] },
    { selector: 'h2[', add: ['x'], remove: [] }, // an invalid selector is skipped, never fatal
  ]);
  assert.match(out, /<section class="sec py-24">/);
  assert.match(out, /<h2 class="text-4xl">Title<\/h2>/);
  assert.match(out, /<p>Text<\/p>/);
});

import { normalizePageLayout, specForPage } from '../src/template/spec.js';
import { PAGE_LAYOUTS, DIRECTIONS } from '../src/studio/directions.js';

test('inner and contact pages can override only the layout options that belong to them', () => {
  const pl = normalizePageLayout({ inner: { hero: 'dark', innerSidebar: 'off', contactLayout: 'stacked', hero2: 'x' }, contact: { contactLayout: 'stacked', innerSidebar: 'off', hero: 'nonsense' } });
  assert.deepEqual(pl.inner, { hero: 'dark', innerSidebar: 'off' });
  assert.deepEqual(pl.contact, { contactLayout: 'stacked' });
});

test('a page sees the site layout with its own overrides laid over it, and home is untouched', () => {
  const spec = normalizeSpec({ layout: { hero: 'gradient', innerSidebar: 'on' }, pageLayout: { inner: { hero: 'light', innerSidebar: 'off' } } }, DEFAULT_SPEC);
  assert.equal(specForPage(spec, 'inner').layout.hero, 'light');
  assert.equal(specForPage(spec, 'inner').layout.innerSidebar, 'off');
  assert.equal(specForPage(spec, 'home').layout.hero, 'gradient');
  assert.equal(specForPage(spec, 'contact').layout.hero, 'gradient');
});

test('every art direction designs its inner and contact pages with valid options, and they differ between directions', () => {
  const seen = new Set();
  for (const d of Object.keys(DIRECTIONS)) {
    const pl = normalizePageLayout(PAGE_LAYOUTS[d]);
    assert.deepEqual(pl, { inner: PAGE_LAYOUTS[d].inner, contact: PAGE_LAYOUTS[d].contact }, `${d} has an invalid option`);
    seen.add(JSON.stringify(pl));
  }
  assert.equal(seen.size, Object.keys(DIRECTIONS).length);
});
