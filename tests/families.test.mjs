import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintPage, familyOf } from '../src/template/families.js';

const MODERN = (menu = 'Home') => `<!doctype html><html><head><link rel="stylesheet" href="/css/site.css"></head><body class="bg-white text-slate-800 antialiased">
<header class="sticky top-0 z-40 bg-white shadow-sm"><div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"><a class="text-xl font-bold text-sky-700" href="/">Logo</a>
<nav class="hidden items-center gap-6 md:flex"><a class="text-sm font-medium text-slate-600 hover:text-sky-700" href="/">${menu}</a><a class="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 lg:px-6" href="/contact">Contact</a></nav></div></header>
<main><section class="bg-slate-50 py-12 md:py-20"><div class="mx-auto max-w-5xl px-4"><h1 class="text-3xl font-extrabold tracking-tight md:text-5xl">Title</h1><p class="mt-4 text-lg text-slate-600">Text</p></div></section></main>
<footer class="bg-slate-900 py-10 text-slate-300"><div class="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-3"><p class="text-sm">Footer</p></div></footer></body></html>`;

const LEGACY = (menu = 'Home') => `<!doctype html><html><head><link rel="stylesheet" href="/css/bootstrap.min.css"><link rel="stylesheet" href="/css/style.css"></head><body class="home page">
<header id="header" class="header-area"><div class="container"><div class="row"><div class="col-md-3 logo"><a href="/">Logo</a></div><div class="col-md-9"><ul class="menu nav navbar-nav"><li class="menu-item active"><a href="/">${menu}</a></li><li class="menu-item"><a href="/contact">Contact</a></li></ul></div></div></div></header>
<div class="content-wrapper"><div class="container"><div class="row"><div class="col-md-8 main-content"><h1 class="page-title">Title</h1><p class="lead">Text</p></div></div></div></div>
<footer class="footer-area"><div class="container"><div class="row"><div class="col-md-4 widget"><p>Footer</p></div></div></div></footer></body></html>`;

test('a Tailwind page is modern and an old Bootstrap-style page is legacy', () => {
  const m = fingerprintPage(MODERN()), l = fingerprintPage(LEGACY());
  assert.equal(m.modern, true);
  assert.ok(m.variants >= 4 && m.share >= 0.3, `modern share ${m.share}, variants ${m.variants}`);
  assert.equal(l.modern, false);
  assert.ok(l.variants === 0 && l.share < 0.1, `legacy share ${l.share}`);
});

test('pages of one template share a fingerprint whatever the menu text or the active item', () => {
  assert.equal(fingerprintPage(MODERN('Home')).sig, fingerprintPage(MODERN('Start')).sig);
  assert.equal(fingerprintPage(MODERN('Home')).vocab, fingerprintPage(MODERN('Start')).vocab);
  assert.equal(fingerprintPage(LEGACY('Home')).sig, fingerprintPage(LEGACY('About')).sig);
  assert.notEqual(fingerprintPage(MODERN()).sig, fingerprintPage(LEGACY()).sig);
});

test('a page that loads Tailwind but uses almost none of it is judged by its markup, one with the marker and real use is modern', () => {
  const html = LEGACY().replace('<head>', '<head><script src="https://cdn.tailwindcss.com"></script>');
  assert.equal(fingerprintPage(html).modern, false); // marker only: no variants, almost no utilities
  const used = MODERN().replace('<head>', '<head><script src="https://cdn.tailwindcss.com"></script>');
  assert.equal(fingerprintPage(used).modern, true);
});

test('the family of a page: its own override, then the nearest folder override, then what was detected', () => {
  const data = { pageMap: { 'a/x.html': { family: 'modern' }, 'b/y.html': { family: 'modern' }, 'b/deep/z.html': { family: 'modern' }, 'index.html': { family: 'modern' } }, overrides: { 'b/': 'legacy', 'b/deep/z.html': 'modern', '/': 'legacy' } };
  assert.equal(familyOf(data, 'a/x.html'), 'modern');
  assert.equal(familyOf(data, 'b/y.html'), 'legacy');
  assert.equal(familyOf(data, 'b/deep/z.html'), 'modern');
  assert.equal(familyOf(data, 'index.html'), 'legacy'); // "/" is the files in the site root
  assert.equal(familyOf({ pageMap: {}, overrides: {} }, 'nope.html'), null);
});
