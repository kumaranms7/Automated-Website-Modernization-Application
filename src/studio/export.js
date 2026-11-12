import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { chromium } from 'playwright-core';
import http from 'node:http';
import { clientDir, loadClient } from '../config.js';
import { buildClient } from '../build/build.js';
import { chosenPages } from '../template/api.js';
import { readItem } from './files.js';
import { specOf } from './variants.js';

// Exports one composed page as a zip: the finished HTML, its compiled Tailwind stylesheet, the fonts, and the site images it
// uses. The exported files are then opened on their own in a browser, away from the editor, to prove they work.

const LOCAL = (u) => u && !/^(https?:|\/\/|data:|mailto:|tel:|#|javascript:)/i.test(u);

export async function exportPage(slug, pageId) {
  const p = await readItem(slug, 'pages', pageId);
  if (!p) throw new Error('Unknown template');
  const client = await loadClient(slug);
  const pages = await chosenPages(slug);
  const home = pages.home;
  const spec = await specOf(slug, p);
  const name = `export-${pageId}`;
  const dir = path.join(clientDir(slug), 'studio', name);
  const files = [...new Set([home, pages.inner, pages.contact].filter(Boolean))];
  const report = await buildClient(slug, { only: files, content: 'approved', spec: { ...spec, pages: { ...spec.pages, ...pages } }, outName: `studio/${name}` });
  const result = report.results.find((r) => r.path === home) || report.results[0];
  let html = '';
  for (const f of files) html += '\n' + (await fsp.readFile(path.join(dir, f), 'utf8').catch(() => ''));

  // copy the site images the page uses, keeping their paths
  const refs = new Set();
  for (const m of html.matchAll(/\b(?:src|poster)="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/\bdata-(?:jquery|ada)="([^"]+)"/g)) refs.add(m[1]); // the site's own accessibility widget files
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/g)) m[1].split(',').forEach((s) => refs.add(s.trim().split(/\s+/)[0]));
  for (const m of html.matchAll(/url\(['"]?([^)'"]+)/g)) refs.add(m[1]);
  const copied = [], missing = [];
  for (const ref of refs) {
    if (!LOCAL(ref) || /\.(html?|php)(\?|$)/i.test(ref) || ref.startsWith('assets/') || ref.startsWith('./assets/')) continue;
    const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
    const rel = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(home), clean));
    const from = path.join(client.sourceDir, rel), to = path.join(dir, rel);
    if (fs.existsSync(to)) continue;
    if (fs.existsSync(from)) { await fsp.mkdir(path.dirname(to), { recursive: true }); await fsp.copyFile(from, to); copied.push(rel); } else missing.push(rel);
  }

  // open the export on its own, served the way a web host would serve it (browsers refuse modules and fonts from file://)
  const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  const server = http.createServer((req, res) => {
    const f = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || home);
    if (f.startsWith(dir) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); } else { res.writeHead(404); res.end(); }
  }).listen(0, '127.0.0.1');
  const browser = await chromium.launch({ channel: 'msedge' });
  const failed = [], errors = [];
  let overflow = false, images = 0, broken = 0;
  try {
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('requestfailed', (r) => failed.push(r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)));
    pg.on('response', (r) => { if (r.status() >= 400) failed.push(r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)); });
    pg.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
    await pg.goto(`http://127.0.0.1:${server.address().port}/${home}`, { waitUntil: 'load' });
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
    await pg.waitForTimeout(400);
    const m = await pg.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 1, n: document.images.length, bad: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length, css: [...document.styleSheets].length }));
    overflow = m.over; images = m.n; broken = m.bad;
    if (!m.css) errors.push('The stylesheet did not load');
  } finally { await browser.close(); server.close(); }

  // zip
  const out = path.join(clientDir(slug), 'studio', 'exports');
  await fsp.mkdir(out, { recursive: true });
  const zipName = `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'template'}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.zip`;
  const output = fs.createWriteStream(path.join(out, zipName));
  const zip = new ZipArchive({ zlib: { level: 6 } });
  const done = new Promise((ok, no) => { output.on('close', ok); output.on('error', no); zip.on('error', no); });
  zip.pipe(output);
  zip.directory(dir, false);
  await zip.finalize();
  await done;
  const bytes = (await fsp.stat(path.join(out, zipName))).size;
  const ok = !failed.length && !errors.length && !overflow && !broken;
  return { file: zipName, url: `/api/clients/${slug}/studio/exports/${zipName}`, bytes, images: copied.length, missing, check: { ok, failedRequests: [...new Set(failed)].slice(0, 6), errors, sideways: overflow, images, brokenImages: broken }, preservation: (result.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg) };
}
