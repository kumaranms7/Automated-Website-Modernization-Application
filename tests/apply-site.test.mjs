import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeBuildToSite, restoreSiteFiles, PRE_BUILD, preBuildPath } from '../src/build/apply-site.js';

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'apply-'));
  const site = path.join(root, 'site'), build = path.join(root, 'build');
  const put = async (dir, rel, text) => { const f = path.join(dir, rel); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, text); };
  await put(site, 'index.html', 'ORIGINAL home');
  await put(site, 'service/a.html', 'ORIGINAL a');
  await put(site, 'service/b.html', 'ORIGINAL b');
  await put(site, 'broken.html', 'ORIGINAL broken');
  await put(site, 'page.php', '<?php echo 1;');
  await put(site, 'assets/css/site.min.css', 'OLD css');
  await put(build, 'index.html', 'NEW home');
  await put(build, 'service/a.html', 'NEW a');
  await put(build, 'service/b.html', 'NEW b');
  await put(build, 'broken.html', 'NEW broken');
  await put(build, 'page.php', 'NEW php snapshot');
  await put(build, 'assets/css/site.min.css', 'NEW css');
  await put(build, 'assets/js/nav.js', 'NEW js');
  const results = [{ path: 'index.html', status: 'pass' }, { path: 'service/a.html', status: 'warn' }, { path: 'service/b.html', status: 'pass' }, { path: 'broken.html', status: 'fail' }, { path: 'page.php', status: 'pass' }, { path: 'gone.html', status: 'skipped', reason: 'layout not recognised' }];
  const read = (rel) => fs.readFile(path.join(site, rel), 'utf8').catch(() => null);
  return { root, site, build, results, read, put, keepPhp: (rel) => /\.php$/i.test(rel) };
}

test('the build is written into the site folder; the original of every replaced file is saved first', async () => {
  const t = await setup();
  const r = await writeBuildToSite({ siteDir: t.site, buildDir: t.build, results: t.results, keepPhp: t.keepPhp });
  assert.deepEqual(r.pages.map((p) => p.rel).sort(), ['index.html', 'service/a.html', 'service/b.html']);
  assert.equal(await t.read('index.html'), 'NEW home');
  assert.equal(await t.read('service/a.html'), 'NEW a');
  assert.equal(await t.read(`${PRE_BUILD}/index.html`), 'ORIGINAL home');
  assert.equal(await t.read(`${PRE_BUILD}/service/a.html`), 'ORIGINAL a');
  // shared files: a replaced one is saved, a new one is only recorded as new
  assert.deepEqual(r.files.map((f) => [f.rel, f.existed]).sort(), [['assets/css/site.min.css', true], ['assets/js/nav.js', false]]);
  assert.equal(await t.read(`${PRE_BUILD}/assets/css/site.min.css`), 'OLD css');
  assert.equal(await t.read('assets/js/nav.js'), 'NEW js');
});

test('pages that failed a check, were not recognised, or are PHP are left exactly as they were', async () => {
  const t = await setup();
  const r = await writeBuildToSite({ siteDir: t.site, buildDir: t.build, results: t.results, keepPhp: t.keepPhp });
  assert.equal(await t.read('broken.html'), 'ORIGINAL broken');
  assert.equal(await t.read('page.php'), '<?php echo 1;');
  assert.equal(await t.read(`${PRE_BUILD}/broken.html`), null);
  const why = Object.fromEntries(r.skipped.map((s) => [s.rel, s.reason]));
  assert.match(why['broken.html'], /failed an automatic check/);
  assert.match(why['page.php'], /PHP/);
  assert.match(why['gone.html'], /not recognised/);
});

test('building again never overwrites the saved original with an already-updated page', async () => {
  const t = await setup();
  const first = await writeBuildToSite({ siteDir: t.site, buildDir: t.build, results: t.results, keepPhp: t.keepPhp });
  await t.put(t.build, 'index.html', 'NEWER home');
  const again = await writeBuildToSite({ siteDir: t.site, buildDir: t.build, results: t.results, keepPhp: t.keepPhp, prev: { files: first.files } });
  assert.equal(await t.read('index.html'), 'NEWER home');
  assert.equal(await t.read(`${PRE_BUILD}/index.html`), 'ORIGINAL home');
  assert.equal(await t.read(`${PRE_BUILD}/assets/css/site.min.css`), 'OLD css');
  assert.deepEqual(again.files.find((f) => f.rel === 'assets/js/nav.js'), { rel: 'assets/js/nav.js', existed: false }); // still known as a file the build added
  assert.deepEqual(again.files.find((f) => f.rel === 'assets/css/site.min.css'), { rel: 'assets/css/site.min.css', existed: true });
});

test('restoring puts every original back, removes the files the build added, and clears the saved copies', async () => {
  const t = await setup();
  const r = await writeBuildToSite({ siteDir: t.site, buildDir: t.build, results: t.results, keepPhp: t.keepPhp });
  const out = await restoreSiteFiles({ siteDir: t.site, manifest: { pages: r.pages, files: r.files } });
  assert.equal(await t.read('index.html'), 'ORIGINAL home');
  assert.equal(await t.read('service/b.html'), 'ORIGINAL b');
  assert.equal(await t.read('assets/css/site.min.css'), 'OLD css');
  assert.equal(await t.read('assets/js/nav.js'), null);
  assert.equal(await fs.stat(path.join(t.site, 'assets/js')).catch(() => null), null); // the emptied folder is gone too
  assert.equal(await fs.stat(path.join(t.site, ...PRE_BUILD.split('/'))).catch(() => null), null);
  assert.equal(out.restored, 4); assert.equal(out.removed, 1); assert.deepEqual(out.missing, []);
});

test('a read-only original can still be replaced and restored', async () => {
  const t = await setup();
  await fs.chmod(path.join(t.site, 'index.html'), 0o444);
  await writeBuildToSite({ siteDir: t.site, buildDir: t.build, results: [{ path: 'index.html', status: 'pass' }], keepPhp: t.keepPhp });
  assert.equal(await t.read('index.html'), 'NEW home');
  assert.equal(preBuildPath({ sourceDir: t.site }, 'index.html'), path.join(t.site, '_modernizer-backup', 'pre-build', 'index.html'));
});

test('repeating an update that failed part-way keeps the true originals and knows which shared files were new', async () => {
  const t = await setup();
  let planned;
  // first attempt: stops after the pages and before the shared files are all written (a file is missing from the build)
  await fs.rm(path.join(t.build, 'assets/js/nav.js'));
  await t.put(t.build, 'assets/js/nav.js', 'NEW js');
  const first = await writeBuildToSite({ siteDir: t.site, buildDir: t.build, results: t.results, keepPhp: t.keepPhp, onStart: (p) => { planned = p; } });
  assert.deepEqual(planned.files.map((f) => [f.rel, f.existed]).sort(), [['assets/css/site.min.css', true], ['assets/js/nav.js', false]]);
  assert.equal(first.files.length, 2);
  // the repeat starts from the saved list: the files written the first time are not mistaken for originals
  const again = await writeBuildToSite({ siteDir: t.site, buildDir: t.build, results: t.results, keepPhp: t.keepPhp, prev: { files: planned.files } });
  assert.deepEqual(again.files.map((f) => [f.rel, f.existed]).sort(), [['assets/css/site.min.css', true], ['assets/js/nav.js', false]]);
  assert.equal(await t.read(`${PRE_BUILD}/assets/css/site.min.css`), 'OLD css');
  assert.equal(await t.read(`${PRE_BUILD}/index.html`), 'ORIGINAL home');
  assert.equal(await t.read(`${PRE_BUILD}/assets/js/nav.js`), null);
});
