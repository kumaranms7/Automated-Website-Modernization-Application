import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
import { collect, scoreMetrics, VIEWPORTS } from './qa.js';

// Opens a rendered page in a real browser: takes the cover thumbnail and one picture per section, and measures the page at
// desktop, tablet and phone widths for the quality score.

async function settle(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'; // the site scrolls smoothly; screenshots need instant jumps
    const step = Math.max(400, innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight + step; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
    scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 120));
  });
  await page.waitForTimeout(350);
}

export async function inspectPage({ html, outDir, ids = [], contentFails = [], measure = true, coverName = '_cover' }) {
  const browser = await chromium.launch({ channel: 'msedge' });
  const logs = [], failed = [];
  try {
    const page = await browser.newPage({ viewport: VIEWPORTS.desktop });
    page.on('pageerror', (e) => logs.push(e.message.slice(0, 120)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) logs.push(m.text().slice(0, 120)); });
    page.on('requestfailed', (r) => failed.push(r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)));
    page.on('response', (r) => { if (r.status() >= 400) failed.push(r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 80)); });
    await page.setContent(html, { waitUntil: 'load' });
    await settle(page);

    const thumbs = {};
    if (outDir) {
      await fs.mkdir(outDir, { recursive: true });
      const cover = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 1000 }, type: 'jpeg', quality: 78 });
      await sharp(cover).resize({ width: 760 }).jpeg({ quality: 80 }).toFile(path.join(outDir, coverName + '.jpg'));
      for (const id of ids) {
        try {
          const buf = await page.locator(`[data-sec="${id}"]`).first().screenshot({ type: 'jpeg', quality: 76, timeout: 4000 });
          await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(path.join(outDir, `${id}.jpg`));
          thumbs[id] = true;
        } catch { /* the section was not drawn (hidden or empty) */ }
      }
    }
    if (!measure) return { thumbs };
    const metrics = { desktop: await page.evaluate(collect) };
    for (const vp of ['tablet', 'mobile']) {
      await page.setViewportSize(VIEWPORTS[vp]);
      await page.waitForTimeout(250);
      await settle(page);
      metrics[vp] = await page.evaluate(collect);
    }
    return { thumbs, metrics, qa: scoreMetrics({ ...metrics, console: [...new Set(logs)], failed: [...new Set(failed)], contentFails }) };
  } finally { await browser.close(); }
}
