import path from 'node:path';
import { APP } from '../app-settings.js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import express from 'express';
import { chromium } from 'playwright-core';
import { clientDir, readJson, writeJson } from '../config.js';
import { previewHandler } from '../server/preview.js';

// Real-browser checks: the original page and the rebuilt page are both loaded in Edge/Chromium on an emulated
// mid-range phone over a slow 4G connection, with third-party scripts blocked so the comparison measures only
// what we ship. Desktop adds an accessibility scan (axe-core) and a horizontal-overflow check.

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const INIT = `
  window.__m = { cls: 0, lcp: 0 };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
`;

async function startPreviewServer() {
  const app = express();
  app.use('/preview', previewHandler('preview'));
  app.use('/original', previewHandler('original'));
  return new Promise((ok) => { const server = app.listen(0, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${server.address().port}` })); });
}

async function measure(browser, url, { mobile, axe }) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  const res = { requests: 0, bytes: 0, failedLocal: [], blockedExternal: 0, consoleErrors: [], jsErrors: [] };
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== '127.0.0.1') { res.blockedExternal += 1; return route.abort(); }
    return route.continue();
  });
  page.on('response', (r) => { if (r.status() >= 400) res.failedLocal.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) res.consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => res.jsErrors.push(e.message.slice(0, 160)));

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.loadingFinished', (e) => { res.bytes += e.encodedDataLength || 0; res.requests += 1; });
  if (mobile) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } scrollTo(0, 0); });
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => ({
    lcp: Math.round(window.__m.lcp), cls: +window.__m.cls.toFixed(3),
    load: Math.round(performance.getEntriesByType('navigation')[0]?.loadEventEnd || 0),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  Object.assign(res, m);
  if (axe) {
    await page.evaluate(AXE);
    const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
    res.axe = r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length })).sort((a, b) => b.nodes - a.nodes);
  }
  await ctx.close();
  return res;
}

export function pickSample(validation, n) {
  const all = Object.entries(validation.pages).filter(([, p]) => p.readiness !== 'blocked').map(([k, p]) => ({ path: k, type: p.type, ai: p.ai }));
  const chosen = new Map();
  for (const type of [...new Set(all.map((p) => p.type))]) { const f = all.find((p) => p.type === type); if (f) chosen.set(f.path, f); }
  for (const p of all.filter((x) => x.ai)) { if (chosen.size >= n) break; chosen.set(p.path, p); }
  const step = Math.max(1, Math.floor(all.length / n));
  for (let i = 0; i < all.length && chosen.size < n; i += step) chosen.set(all[i].path, all[i]);
  return [...chosen.keys()].slice(0, n);
}

const jobs = new Map();
export const browserJob = (slug) => jobs.get(slug) || null;
export const loadBrowserResults = async (slug) => {
  const r = await readJson(path.join(clientDir(slug), 'browser.json'), null);
  return r ? { ...r, history: await readJson(path.join(clientDir(slug), 'browser-history.json'), []) } : r;
};

export function startBrowserRun(slug, paths, { concurrency = APP.limits.concurrency.browserTests } = {}) {
  if (jobs.get(slug)?.running) throw new Error('A browser test run is already in progress');
  const job = { running: true, total: paths.length, done: 0, errors: [], startedAt: new Date().toISOString() };
  jobs.set(slug, job);
  (async () => {
    const { server, base } = await startPreviewServer();
    const browser = await chromium.launch({ channel: 'msedge' });
    const results = [];
    const queue = [...paths];
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift();
        try {
          const original = await measure(browser, `${base}/original/${slug}/${p}`, { mobile: true, axe: false });
          const modern = await measure(browser, `${base}/preview/${slug}/${p}`, { mobile: true, axe: false });
          const desktop = await measure(browser, `${base}/preview/${slug}/${p}`, { mobile: false, axe: true });
          results.push({ path: p, original, modern, desktop });
        } catch (e) { job.errors.push({ path: p, error: e.message }); }
        job.done += 1;
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    await browser.close();
    server.close();
    results.sort((a, b) => a.path.localeCompare(b.path));
    const avg = (f) => (results.length ? Math.round(results.reduce((n, r) => n + f(r), 0) / results.length) : 0);
    const out = {
      testedAt: new Date().toISOString(),
      profile: 'Emulated phone (390px), slow 4G (1.6 Mbps, 150 ms), 4x CPU slowdown, third-party scripts blocked',
      summary: {
        pages: results.length,
        lcpBefore: avg((r) => r.original.lcp), lcpAfter: avg((r) => r.modern.lcp),
        bytesBefore: avg((r) => r.original.bytes), bytesAfter: avg((r) => r.modern.bytes),
        requestsBefore: avg((r) => r.original.requests), requestsAfter: avg((r) => r.modern.requests),
        clsBefore: +(results.reduce((n, r) => n + r.original.cls, 0) / Math.max(1, results.length)).toFixed(3),
        clsAfter: +(results.reduce((n, r) => n + r.modern.cls, 0) / Math.max(1, results.length)).toFixed(3),
        axeSerious: results.reduce((n, r) => n + (r.desktop.axe || []).filter((v) => ['serious', 'critical'].includes(v.impact)).length, 0),
        overflowPages: results.filter((r) => r.modern.overflow || r.desktop.overflow).length,
        errorPages: results.filter((r) => r.modern.jsErrors.length || r.modern.consoleErrors.length || r.modern.failedLocal.length).length,
      },
      results,
    };
    await writeJson(path.join(clientDir(slug), 'browser.json'), out);
    // every run is kept, so the speed can be followed over time
    const hist = await readJson(path.join(clientDir(slug), 'browser-history.json'), []);
    await writeJson(path.join(clientDir(slug), 'browser-history.json'), [...hist, { testedAt: out.testedAt, ...out.summary }].slice(-40));
    job.running = false;
    job.finishedAt = new Date().toISOString();
  })().catch((e) => { job.running = false; job.errors.push({ path: '*', error: e.message }); });
  return job;
}
