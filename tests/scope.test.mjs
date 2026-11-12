import test from 'node:test';
import assert from 'node:assert/strict';
import { appliesHere, sectionAppliesHere } from '../src/template/scope.js';
import { applyClassTweaks } from '../src/template/class-tweaks.js';
import { applyHtmlOps } from '../src/template/html-ops.js';

const spec = { samples: { inner: 'sample.html', contact: 'contact.html' } };
const numbered = { layout: 'inner', selector: '[data-sec="s3"] h3', add: ['md:flex'], remove: [] };

test('a change to a numbered section only applies on the page it was made on', () => {
  assert.equal(appliesHere({ ...numbered, file: 'sample.html' }, spec, 'inner', 'sample.html'), true);
  assert.equal(appliesHere({ ...numbered, file: 'sample.html' }, spec, 'inner', 'other.html'), false);
  // recorded before pages were tracked: it belongs to the sample page for that kind of page
  assert.equal(appliesHere(numbered, spec, 'inner', 'sample.html'), true);
  assert.equal(appliesHere(numbered, spec, 'inner', 'other.html'), false);
  assert.equal(appliesHere(numbered, {}, 'inner', 'sample.html'), false);
});

test('header, footer, home and whole-page changes still apply everywhere', () => {
  assert.equal(appliesHere({ layout: 'all', selector: '[data-sec="header"] a', add: ['x'] }, spec, 'inner', 'other.html'), true);
  assert.equal(appliesHere({ layout: 'inner', selector: 'main h2', add: ['x'] }, spec, 'inner', 'other.html'), true);
  assert.equal(appliesHere({ layout: 'contact', selector: '[data-sec="s2"] p', add: ['x'] }, spec, 'inner', 'other.html'), false); // another kind of page
  assert.equal(appliesHere({ layout: 'home', selector: '[data-sec="s3"] p', add: ['x'] }, spec, 'home', 'index.html'), true);
});

test('per-section extras on inner and contact pages are scoped the same way', () => {
  assert.equal(sectionAppliesHere({ layout: 'inner', index: 2, columns: 2 }, spec, 'inner', 'other.html'), false);
  assert.equal(sectionAppliesHere({ layout: 'inner', index: 2, columns: 2, file: 'other.html' }, spec, 'inner', 'other.html'), true);
  assert.equal(sectionAppliesHere({ layout: 'inner', heading: 'Why us', columns: 2 }, spec, 'inner', 'other.html'), true); // matched by heading, not number
});

test('class tweaks and structure operations skip pages they were not made for', () => {
  const html = '<main><section data-sec="s3"><h3 class="a">T</h3></section></main>';
  const withTweak = { ...spec, tweaks: [{ ...numbered, selector: '[data-sec="s3"] h3', add: ['b'], remove: [] }] };
  assert.match(applyClassTweaks(html, withTweak, 'inner', 'sample.html'), /class="a b"/);
  assert.equal(applyClassTweaks(html, withTweak, 'inner', 'other.html'), html);
  const ops = [{ layout: 'inner', selector: '[data-sec="s3"] h3', op: 'wrap', html: '<div class="w"></div>' }];
  assert.match(applyHtmlOps(html, ops, { layout: 'inner', rel: 'sample.html', spec }), /<div class="w"><h3/);
  assert.equal(applyHtmlOps(html, ops, { layout: 'inner', rel: 'other.html', spec }), html);
});
