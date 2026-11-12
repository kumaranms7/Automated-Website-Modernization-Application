import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSnippet, sanitizeSection, normalizeOps, applyHtmlOps, applyHtmlEdits, classesIn, prettyHtml } from '../src/template/html-ops.js';
import { normalizePage } from '../src/template/spec.js';

const SEC = '<section class="sec"><div class="wrap"><h2 class="t">Title</h2><p class="a">First</p><p class="b">Second</p><img src="x.jpg" alt="x"></div></section>';

test('inserted markup loses scripts, forms, frames and event handlers', () => {
  const out = sanitizeSnippet('<div class="grid" onclick="x()"><script>alert(1)</script><form><input></form><a href="javascript:alert(1)">go</a><iframe src="//e"></iframe></div>');
  assert.equal(/script|form|input|iframe|onclick|javascript:/i.test(out), false);
  assert.match(out, /class="grid"/);
});

test('a replacement section must be a section and keeps its own form', () => {
  assert.equal(sanitizeSection('<div>no section</div>'), '');
  const out = sanitizeSection('<section data-sec="s1" class="sec"><form action="/x"><input name="a"></form><script>1</script></section>');
  assert.match(out, /<form/);
  assert.equal(/script|data-sec/.test(out), false);
});

test('structure operations are validated: known operations, safe selectors, decoration only', () => {
  const ops = normalizeOps([
    { selector: 'h2', op: 'wrap', html: '<div class="grid md:grid-cols-2"></div>' },
    { selector: 'h2', op: 'after', html: '<hr class="my-4">' },
    { selector: 'h2', op: 'after', html: '<p>' + 'Brand new marketing copy that was never on the site. '.repeat(3) + '</p>' }, // new copy is refused
    { selector: 'h2', op: 'explode' },
    { selector: 'h2', op: 'tag', tag: 'script' },
    { selector: 'h2', op: 'tag', tag: 'h3' },
    { selector: 'url(javascript:1)', op: 'unwrap' },
  ]);
  assert.deepEqual(ops.map((o) => o.op), ['wrap', 'after', 'tag']);
});

test('wrap, move, change tag and insert work inside one section and nothing is deleted', () => {
  const html = applyHtmlOps(SEC, normalizeOps([
    { selector: 'p.a', op: 'wrap', html: '<div class="box"></div>' },
    { selector: 'img', op: 'move-before', target: 'h2' },
    { selector: 'p.b', op: 'tag', tag: 'blockquote' },
    { selector: 'h2', op: 'after', html: '<hr class="my-6">' },
  ]), { fragment: true });
  assert.match(html, /<div class="box"><p class="a">First<\/p><\/div>/);
  assert.ok(html.indexOf('<img') < html.indexOf('<h2'));
  assert.match(html, /<blockquote class="b">Second<\/blockquote>/);
  assert.match(html, /<hr class="my-6">/);
  for (const t of ['Title', 'First', 'Second']) assert.ok(html.includes(t));
});

test('a hand-edited section replaces the one at its position and keeps its editor id', () => {
  const main = '<section data-sec="s1" class="a"><p>one</p></section><section data-sec="s2" class="b"><p>two</p></section>';
  const out = applyHtmlEdits(main, [{ layout: 'inner', file: 'a.html', index: 2, html: '<section class="c"><p>two edited</p></section>' }], 'inner', 'a.html');
  assert.match(out, /<section class="c" data-sec="s2">/);
  assert.ok(out.includes('<p>one</p>'));
  assert.equal(applyHtmlEdits(main, [{ layout: 'inner', file: 'a.html', index: 2, html: '<section><p>x</p></section>' }], 'inner', 'other.html'), main);
});

test('composed sections keep their structure operations and hand-edited html through normalisation', () => {
  const s = normalizePage({ sections: [{ ref: 'hero', ops: [{ selector: 'h1', op: 'wrap', html: '<div class="flex"></div>' }], html: '<section class="x"><h1>Hi</h1></section>' }] }).sections[0];
  assert.equal(s.ops.length, 1);
  assert.match(s.html, /<h1>Hi<\/h1>/);
  assert.equal(normalizePage({ sections: [{ ref: 'hero', html: '<p>not a section</p>' }] }).sections[0].html, '');
});

test('classes inside inserted markup are collected and the editor shows readable HTML', () => {
  assert.deepEqual(classesIn('<div class="grid gap-4"><p class="gap-4 text-xl"></p></div>').sort(), ['gap-4', 'grid', 'text-xl']);
  assert.match(prettyHtml(SEC), /\n {2}<div class="wrap">\n {4}<h2 class="t">Title<\/h2>/);
});

import { expandForm, FORM_MARK } from '../src/template/html-ops.js';

test('the contact form embed is a locked placeholder in the editor and the exact original comes back when drawn', () => {
  const embed = '<div id="f"><script src="https://forms.example/load.js"></script></div>';
  const stored = sanitizeSection(`<section>${FORM_MARK.replace('></div>', '><p>smuggled</p></div>')}</section>`);
  assert.equal(stored, `<section>${FORM_MARK.replace('data-protected-form', 'data-protected-form=""')}</section>`);
  assert.equal(expandForm(stored, embed), `<section>${embed}</section>`);
  assert.equal(expandForm(stored, ''), '<section></section>');
});

import { canonUrls, rebaseUrls, sanitizeChrome } from '../src/template/html-ops.js';

test('a hand-edited header or footer stores links from the site root and gets the right prefix on every page', () => {
  const drawn = '<a href="#main">Skip</a><header><a href="../"><img src="../images/logo.png"></a><a href="../about.html">About</a><a href="tel:+15551234567">Call</a><a href="https://example.com/x">Out</a></header>';
  const stored = canonUrls(drawn);
  assert.match(stored, /<a href="\/"><img src="images\/logo.png">/);
  assert.match(stored, /href="about.html"/);
  assert.match(rebaseUrls(stored, 0), /<a href="\.\/"><img src="\.\/images\/logo.png">/);
  assert.match(rebaseUrls(stored, 2), /href="\.\.\/\.\.\/about.html"/);
  assert.match(rebaseUrls(stored, 1, true), /href="\/about.html"/);
  for (const keep of ['#main', 'tel:+15551234567', 'https://example.com/x']) assert.ok(rebaseUrls(stored, 3).includes(`"${keep}"`));
});

test('a replacement header must contain a header element and is stripped of scripts and handlers; the page keeps it', () => {
  assert.equal(sanitizeChrome('<div>nothing</div>', 'header'), '');
  const out = sanitizeChrome('<header onclick="x()"><script>1</script><nav>ok</nav></header>', 'header');
  assert.equal(/script|onclick/.test(out), false);
  const p = normalizePage({ sections: [{ ref: 'hero' }], header: { variant: 'classic', html: out }, footer: { html: '<div>no footer tag</div>' } });
  assert.match(p.header.html, /<nav>ok<\/nav>/);
  assert.equal(p.footer.html, '');
});
