import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import * as cheerio from 'cheerio';
import { skeleton, sectionSignatures, classDiffs, expandNumberedRules } from '../src/template/section-match.js';
import { applyClassTweaks } from '../src/template/class-tweaks.js';
import { addResponsiveImages, variantWidths, siteRelative } from '../src/build/responsive.js';

const root = (html) => cheerio.load(html, null, false).root().children().get(0);
const A = '<section data-sec="s3"><div class="wrap"><div class="prose-content max-w-5xl"><h3>One</h3><p>a</p><p>b</p><h3>Two</h3><p>c</p></div></div></section>';
const B = '<section data-sec="s2"><div class="wrap"><div class="prose-content max-w-5xl"><h3>Only</h3><p>x</p></div></div></section>';
const C = '<section data-sec="s3"><div class="wrap"><ul><li>a</li><li>b</li></ul></div></section>';

test('sections with the same structure match however many paragraphs they have, and different structures do not', () => {
  assert.equal(skeleton(root(A)), skeleton(root(B)));
  assert.notEqual(skeleton(root(A)), skeleton(root(C)));
  assert.equal(skeleton(root('<section><ul><li>1</li></ul></section>')), skeleton(root('<section><ul><li>1</li><li>2</li><li>3</li></ul></section>')));
  assert.notEqual(skeleton(root('<section><h2>x</h2><p>y</p></section>')), skeleton(root('<section><p>y</p><h2>x</h2></section>'))); // order matters
});

test('a hand edit that only changed classes becomes class changes; a structure change stays on its page', () => {
  const gen = root(A.replace('data-sec="s3"', 'data-sec="s3" class="sec bg-white"'));
  const same = root('<section class="sec bg-soft"><div class="wrap"><div class="prose-content"><h3>One</h3><p>a</p><p>b</p><h3>Two</h3><p>c</p></div></div></section>');
  const diffs = classDiffs(gen, same, 's3');
  assert.deepEqual(diffs.map((d) => [d.selector, d.add, d.remove]), [['[data-sec="s3"]', ['bg-soft'], ['bg-white']], ['[data-sec="s3"] > :nth-child(1) > :nth-child(1)', [], ['max-w-5xl']]]);
  assert.equal(classDiffs(gen, root('<section><div><p>moved</p></div></section>'), 's3'), null);
});

const page = (...sections) => `<html><body><main>${sections.join('')}</main></body></html>`;
const SAMPLE = 'sample.html';

test('a rule made on section 3 of the sample page reaches the matching sections of another page, wherever they sit', () => {
  const spec = { samples: { inner: SAMPLE }, tweaks: [{ layout: 'inner', selector: '[data-sec="s3"] .prose-content', add: ['md:flex'], remove: ['max-w-5xl'] }, { layout: 'all', selector: '[data-sec="header"] a', add: ['x'], remove: [] }], ops: [], sections: [{ layout: 'inner', index: 3, background: 'soft' }] };
  const sample = page('<section data-sec="s1"><h1>x</h1></section>', '<section data-sec="s2"><p>y</p></section>', A);
  const sigsByFile = { [SAMPLE]: sectionSignatures(sample).map((s) => s.sig) };
  // another page: the matching structure is its section 2 and 4, not 3
  const other = page('<section data-sec="s1"><h1>x</h1></section>', B, C.replace('s3', 's3'), B.replace('s2', 's4'));
  const out = expandNumberedRules({ spec, layout: 'inner', rel: 'other.html', mainHtml: other, sigsByFile });
  assert.deepEqual(out.tweaks.filter((t) => t.layout === 'inner').map((t) => t.selector), ['[data-sec="s2"] .prose-content', '[data-sec="s4"] .prose-content']);
  assert.ok(out.tweaks.some((t) => t.layout === 'all'), 'header rules are untouched');
  assert.deepEqual(out.sections.map((s) => s.index), [2, 4]);
  // and it really applies
  const html = applyClassTweaks('<main><section data-sec="s2"><div class="prose-content max-w-5xl"></div></section><section data-sec="s3"><div class="prose-content max-w-5xl"></div></section></main>', out, 'inner', 'other.html');
  assert.match(html, /data-sec="s2"><div class="prose-content md:flex"/);
  assert.match(html, /data-sec="s3"><div class="prose-content max-w-5xl"/);
  // a page with no matching structure gets nothing
  const none = expandNumberedRules({ spec, layout: 'inner', rel: 'none.html', mainHtml: page(C), sigsByFile });
  assert.equal(none.tweaks.filter((t) => t.layout === 'inner').length, 0);
  assert.equal(none.sections.length, 0);
});

test('smaller copies are planned only when they are clearly smaller', () => {
  assert.deepEqual(variantWidths(850), [320, 480]);
  assert.deepEqual(variantWidths(387), [320]);
  assert.deepEqual(variantWidths(1600), [320, 480, 800, 1200]);
  assert.deepEqual(variantWidths(300), []);
  assert.equal(siteRelative('../../images/a%20b.webp?x=1'), 'images/a b.webp');
});

test('an already-WebP image gets smaller copies and a srcset; icons, svg and external images are left alone', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resp-'));
  const site = path.join(dir, 'site'), build = path.join(dir, 'build');
  await fs.mkdir(path.join(site, 'images'), { recursive: true });
  await sharp({ create: { width: 850, height: 400, channels: 3, background: '#38a' } }).webp().toFile(path.join(site, 'images', 'big.webp'));
  await sharp({ create: { width: 60, height: 60, channels: 3, background: '#a83' } }).webp().toFile(path.join(site, 'images', 'tiny.webp'));
  const html = '<html><body><main><img src="../images/big.webp" width="850" height="400" alt="Big"><img src="../images/tiny.webp" width="60" height="60" alt="Tiny"><img src="../images/logo.svg" width="300" height="80" alt="Logo"><img src="https://x.test/seal.png" width="250" height="52" alt="Seal"></main></body></html>';
  const r = await addResponsiveImages(html, { rel: 'dir/page.html', siteDir: site, buildDir: build });
  const $ = cheerio.load(r.html);
  const imgs = $('img').toArray().map((i) => $(i).attr('srcset') || null);
  assert.equal(imgs[0], '../images/big-320w.webp 320w, ../images/big-480w.webp 480w, ../images/big.webp 850w');
  assert.deepEqual(imgs.slice(1), [null, null, null]);
  assert.equal($('img').first().attr('sizes'), '(min-width: 768px) 850px, 100vw');
  assert.equal(r.files, 2);
  const made = await sharp(path.join(build, 'images', 'big-480w.webp')).metadata();
  assert.equal(made.width, 480);
  // running it again makes nothing new
  const again = await addResponsiveImages(html, { rel: 'dir/page.html', siteDir: site, buildDir: build });
  assert.equal(again.files, 0);
});

import { kindRules, kindSelector } from '../src/template/section-match.js';

test('changes aimed at an identifiable element travel to every page; layout changes do not', () => {
  const rules = kindRules([
    { layout: 'inner', selector: '[data-sec="s2"] aside#quote', add: ['self-start', 'h-fit'], remove: [] }, // a unique id: safe to carry whatever the classes are
    { layout: 'inner', selector: '[data-sec="s3"] .prose-content', add: ['max-w-none'], remove: [] }, // a stable component class and a visual class
    { layout: 'inner', selector: '[data-sec="s3"] .prose-content', add: ['md:flex', 'md:gap-8'], remove: [] }, // a row layout: stays with its structure
    { layout: 'inner', selector: '[data-sec="s3"] .prose-content > div', add: ['md:w-3/4'], remove: [] }, // not an identifiable element
    { layout: 'inner', selector: '[data-sec="s3"] > :nth-child(1)', add: ['p-0'], remove: [] }, // a position, not an element
    { layout: 'inner', anchor: 'div.prose-content', selector: '[data-sec="s4"] > :nth-child(1)', add: [], remove: ['max-w-5xl'] }, // from a hand edit
    { layout: 'inner', anchor: null, selector: '[data-sec="s5"]', add: ['bg-white'], remove: ['bg-soft'] }, // the section's own background is not carried
  ]);
  assert.deepEqual(rules.map((r) => [r.selector, r.add, r.remove]), [
    ['main aside#quote', ['self-start', 'h-fit'], []],
    ['main .prose-content', ['max-w-none'], []],
    ['main div.prose-content', [], ['max-w-5xl']],
  ]);
  assert.ok(rules.every((r) => r.layout === 'inner' && r.kind));
  assert.equal(kindSelector(root('<div class="my-6 grid"></div>')), null);
});
