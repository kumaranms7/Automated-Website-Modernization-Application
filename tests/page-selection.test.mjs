import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseScope, scopeActive, inScopePath, inScopePage, scopeReason, scopeSummary, scopedScan } from '../src/scope.js';

const PAGES = [
  { path: 'index.html', type: 'home' }, { path: 'about.html', type: 'about' }, { path: 'contact.html', type: 'contact' },
  { path: 'blog/one.html', type: 'blog' }, { path: 'blog/2020/two.html', type: 'blog' }, { path: 'blog-archive/old.html', type: 'blog' },
  { path: 'services/drains.html', type: 'service' }, { path: 'services/pipes.html', type: 'service' },
];

test('by default the whole website is updated', () => {
  assert.deepEqual(normaliseScope(undefined), { mode: 'all', items: [] });
  assert.equal(scopeActive({ mode: 'all', items: [] }), false);
  assert.equal(scopeActive({ mode: 'selected', items: [] }), false, 'a selection with nothing in it is not a selection');
  for (const p of PAGES) assert.equal(inScopePage({ mode: 'all', items: [] }, p), true);
});

test('a folder takes everything inside it at any depth, and only that folder', () => {
  const s = normaliseScope({ mode: 'selected', items: [{ kind: 'folder', value: 'blog' }] });
  assert.equal(inScopePath(s, 'blog/one.html'), true);
  assert.equal(inScopePath(s, 'blog/2020/two.html'), true, 'a folder inside it');
  assert.equal(inScopePath(s, 'blog-archive/old.html'), false, 'a folder with a similar name is another folder');
  assert.equal(inScopePath(s, 'services/drains.html'), false);
  assert.equal(inScopePath(s, 'index.html'), false);
  assert.equal(inScopePath(s, 'BLOG/ONE.HTML'), true, 'capitals do not matter');
});

test('the main folder means its own pages only, and a page is one file', () => {
  const s = normaliseScope({ mode: 'selected', items: [{ kind: 'folder', value: '.' }, { kind: 'page', value: 'services/drains.html' }] });
  assert.deepEqual(PAGES.filter((p) => inScopePage(s, p)).map((p) => p.path), ['index.html', 'about.html', 'contact.html', 'services/drains.html']);
});

test('what is saved is cleaned: slashes, repeats and ways out of the website folder', () => {
  const s = normaliseScope({ mode: 'selected', items: [
    { kind: 'folder', value: '/blog/' }, { kind: 'folder', value: 'Blog' }, { kind: 'folder', value: '..' }, { kind: 'page', value: '../secret.html' },
    { kind: 'page', value: 'services\\pipes.html' }, { kind: 'folder', value: '' }, { kind: 'bogus', value: 'x.html' }, null,
  ] });
  assert.deepEqual(s.items, [{ kind: 'folder', value: 'blog' }, { kind: 'page', value: 'services/pipes.html' }, { kind: 'page', value: 'x.html' }]);
});

test('a page outside the selection says why it is left out', () => {
  const s = normaliseScope({ mode: 'selected', items: [{ kind: 'folder', value: 'services' }] });
  assert.equal(scopeReason(s, { path: 'about.html' }), 'not in the pages you selected');
  assert.equal(scopeReason(s, { path: 'services/pipes.html' }), '');
  assert.equal(scopeReason({ mode: 'all', items: [] }, { path: 'about.html' }), '');
});

test('the summary counts the pages and names the folders', () => {
  const s = normaliseScope({ mode: 'selected', items: [{ kind: 'folder', value: 'blog' }, { kind: 'folder', value: '.' }, { kind: 'page', value: 'services/pipes.html' }] });
  assert.deepEqual(scopeSummary(s, PAGES), { mode: 'selected', total: 8, selected: 6, folders: ['blog', '(main folder)'], pages: ['services/pipes.html'] });
  assert.deepEqual(scopeSummary({ mode: 'all', items: [] }, PAGES), { mode: 'all', total: 8, selected: 8, folders: [], pages: [] });
});

test('the audit of a selection counts only the selected pages', () => {
  const data = {
    summary: { pages: 8, byType: {}, issues: { 'title-long': 3 }, scannedAt: 'x' },
    pages: PAGES.map((p, i) => ({ ...p, issues: i < 3 ? [{ code: 'title-long' }] : [] })),
  };
  const s = normaliseScope({ mode: 'selected', items: [{ kind: 'folder', value: '.' }] });
  const out = scopedScan(data, s);
  assert.equal(out.pages.length, 3);
  assert.equal(out.summary.pages, 3);
  assert.deepEqual(out.summary.issues, { 'title-long': 3 });
  assert.deepEqual(out.summary.byType, { home: 1, about: 1, contact: 1 });
  assert.equal(out.summary.scannedAt, 'x');
  assert.equal(scopedScan(data, { mode: 'all', items: [] }), data, 'with no selection the scan is untouched');
});
