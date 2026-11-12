import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreChecks, scoreHtml, breakup, pageFacts, CATEGORIES } from '../src/build/score.js';

const T = new Map(), M = new Map();
const base = { rel: 'a.html', type: 'service', host: 'example.com', phoneDigits: '5551234567', titles: T, metas: M };
const OLD = '<html><head><title>x</title></head><body><div><img src="a.jpg"><a href="b.html">click here</a></div></body></html>';
const NEW = `<!doctype html><html lang="en"><head><title>Backflow testing and repair in South Florida</title>
<meta name="description" content="Licensed backflow testing, repair and replacement across Broward and Palm Beach counties. Same-day service, honest pricing and a quick reply when you call us today.">
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="canonical" href="https://example.com/a.html">
<meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="https://example.com/i.png"><meta property="og:url" content="https://example.com/a.html"><meta name="twitter:card" content="summary">
<script type="application/ld+json">{"@type":"Plumber","name":"x"}</script></head>
<body><a href="#main">Skip</a><header><nav aria-label="Main"></nav></header><main id="main"><h1>Backflow</h1><h2>Why</h2>
<img src="a.webp" srcset="a-480w.webp 480w, a.webp 900w" alt="A backflow device" width="900" height="500"><a href="tel:5551234567">Call</a></main><footer></footer></body></html>`;

test('a page is scored by the weighted share of applicable checks it passes', () => {
  const s = scoreChecks([
    { id: 'h1-single', ok: true, applicable: true, level: 'fail' }, // weight 3
    { id: 'title-length', ok: false, applicable: true, level: 'warn' }, // weight 1
    { id: 'schema-faq', ok: false, applicable: false, level: 'warn' }, // not applicable: ignored
  ]);
  assert.equal(s.score, 75);
  assert.equal(s.categories['Content and links'].score, 100);
  assert.equal(s.categories['Titles, meta and social'].score, 0);
});

test('the rebuilt page scores higher than a bare original, and the breakup shows what was fixed', () => {
  const before = scoreHtml({ ...base, html: OLD });
  const after = scoreHtml({ ...base, html: NEW });
  assert.ok(after.score > before.score + 20, `${before.score} -> ${after.score}`);
  const b = breakup(before, after);
  assert.equal(b.categories.length, Object.keys(CATEGORIES).length);
  const fixed = b.categories.flatMap((c) => c.checks).filter((c) => c.change === 'fixed').map((c) => c.id);
  for (const id of ['viewport', 'canonical', 'og-complete', 'schema-valid', 'img-dimensions']) assert.ok(fixed.includes(id), id + ' should be fixed');
  assert.equal(b.categories.flatMap((c) => c.checks).filter((c) => c.change === 'worse').length, 0);
});

test('page facts count WebP, responsive and sized images and read the meta tags', () => {
  const f = pageFacts(NEW);
  assert.equal(f.title, 'Backflow testing and repair in South Florida');
  assert.equal(f.images, 1); assert.equal(f.webp, 1); assert.equal(f.srcset, 1); assert.equal(f.sized, 1);
  assert.deepEqual(f.schema, ['Plumber']);
  assert.equal(f.og, 4);
  const o = pageFacts(OLD);
  assert.equal(o.webp, 0); assert.equal(o.srcset, 0); assert.equal(o.og, 0);
});
