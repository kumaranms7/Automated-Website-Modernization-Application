import path from 'node:path';
import { chromium } from 'playwright-core';
import { clientDir, readJson, writeJson } from '../config.js';
import { collect, palette, hsl } from './own-theme.js';

// The colours a new template starts from: the colours of the website as it is now. The pages are opened in a browser (the website's own
// stylesheets, fonts and images load as they do for a visitor) and the colours are read from what is drawn: the buttons, the links, the
// headings, the big backgrounds. That works for every kind of CSS, and it picks the brand colours over the many greys.

const file = (slug) => path.join(clientDir(slug), 'template', 'site-colors.json');
export const loadSiteColors = (slug) => readJson(file(slug), null);

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
// hue 0-360, saturation and lightness 0-1 -> #rrggbb
export function hslHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))))).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

// the five colours of a template from what was found; a colour the website does not show is left out (the starter colour stays).
//   accent   the colour of the buttons (the call to action)
//   primary  the brand colour that is drawn most of all the others: backgrounds, headings, borders (shades of one hue count as one colour)
const lively = (c) => c.s > 0.3 && c.l > 0.12 && c.l < 0.8;
// how much a colour is drawn: mostly the area it fills; words in a colour count little (a page with many orange links is not an orange brand)
const weightOf = (c) => c.bg + c.border * 2 + c.text * 0.15;
export function tokensFrom(raw, pal = palette(raw)) {
  const role = Object.fromEntries(pal.map((p) => [p.role, p.hex.toLowerCase()]));
  const colors = (raw.colors || []).map((c) => ({ ...c, ...hsl(c.hex) })).filter(lively).sort((x, y) => weightOf(y) - weightOf(x));
  // shades of one hue are one colour; its main shade is the one drawn most
  const groups = [];
  for (const c of colors) {
    const g = groups.find((x) => hueGap(x.h, c.h) < 20);
    if (g) { g.w += weightOf(c); g.items.push(c); } else groups.push({ h: c.h, w: weightOf(c), items: [c] });
  }
  groups.sort((x, y) => y.w - x.w);
  const mainOf = (g) => g.items[0].hex.toLowerCase();
  // the button colour: the lively background that the most buttons have (the same colour on buttons of different shapes counts together)
  const perBg = new Map();
  for (const x of raw.buttons || []) if (HEX.test(x.bg || '') && lively(hsl(x.bg))) perBg.set(x.bg.toLowerCase(), (perBg.get(x.bg.toLowerCase()) || 0) + x.n);
  const cta = [...perBg.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || '';
  const out = {};
  // the brand colour is the one drawn most of all (shades of one hue count together)
  let primary = groups[0] ? mainOf(groups[0]) : cta || role.Primary || '';
  if (!primary && raw.linkColor && lively(hsl(raw.linkColor))) primary = raw.linkColor.toLowerCase();
  if (primary) {
    const p = hsl(primary);
    out.primary = primary;
    out.primaryDark = hslHex(p.h, clamp(p.s * 0.95), clamp(Math.min(p.l * 0.55, 0.28), 0.1));
    // the buttons keep their colour; a website whose buttons are the brand colour takes another colour it really uses (at least a seventh as much as
    // the brand colour), else the opposite hue
    const apart = (h) => hueGap(hsl(h).h, p.h) > 25;
    const second = groups.slice(1).find((g) => g.w >= groups[0].w / 7 && apart(mainOf(g)));
    out.accent = cta && apart(cta) ? cta : second ? mainOf(second) : hslHex((p.h + 180) % 360, clamp(Math.max(p.s, 0.65)), 0.5);
    const tint = role['Soft background'];
    out.soft = tint && hsl(tint).l > 0.9 ? tint : hslHex(p.h, clamp(p.s * 0.45, 0.08, 0.35), 0.96);
    const body = raw.body?.color && HEX.test(raw.body.color) ? raw.body.color.toLowerCase() : '';
    out.ink = body && hsl(body).l < 0.3 ? body : hslHex(p.h, 0.2, 0.13);
  } else {
    // a website of greys: only the text and background colours are taken
    const body = raw.body?.color && HEX.test(raw.body.color) ? raw.body.color.toLowerCase() : '';
    if (body && hsl(body).l < 0.3) out.ink = body;
    const tint = role['Soft background'];
    if (tint && hsl(tint).l > 0.9) out.soft = tint;
  }
  return out;
}

// the colours of several pages as one: what is drawn on more pages counts more
function merge(raws) {
  const colors = new Map();
  // the home page counts twice: it shows the brand the way the owner wants it seen
  raws.forEach((r, i) => { const k = i === 0 ? 2 : 1; for (const c of r.colors) { const e = colors.get(c.hex) || { hex: c.hex, text: 0, bg: 0, border: 0 }; e.text += c.text * k; e.bg += c.bg * k; e.border += c.border * k; colors.set(c.hex, e); } });
  return {
    ...raws[0],
    colors: [...colors.values()].sort((a, b) => weightOf({ ...b }) - weightOf({ ...a })).slice(0, 40),
    buttons: raws.flatMap((r) => r.buttons).sort((a, b) => b.n - a.n).slice(0, 6),
  };
}

// the home page and two more pages of different kinds
async function pagesToRead(slug) {
  const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const html = scan.filter((p) => /\.(html?|php)$/i.test(p.path) && p.type !== 'utility' && p.type !== 'contact');
  const home = scan.find((p) => p.type === 'home') || scan.find((p) => /^index\./i.test(p.path));
  const seenTypes = new Set(home ? [home.type] : []);
  const more = [];
  for (const p of html) { if (p === home || seenTypes.has(p.type) || more.length >= 2) continue; seenTypes.add(p.type); more.push(p); }
  for (const p of html) { if (more.length >= 2) break; if (p !== home && !more.includes(p)) more.push(p); }
  return [home, ...more].filter(Boolean).map((p) => p.path);
}

export async function detectSiteColors(slug, { refresh = false } = {}) {
  const cached = await loadSiteColors(slug);
  if (cached && !refresh) return cached;
  const origin = globalThis.__portalOrigin;
  if (!origin) throw new Error('The portal address is not known yet.');
  const rels = await pagesToRead(slug);
  if (!rels.length) throw new Error('Scan the website first (Site audit), so there are pages to read the colours from.');
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch { throw new Error('The browser could not be started. Microsoft Edge is needed to read the colours of the website.'); }
  const raws = [], read = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    for (const rel of rels) {
      try {
        const page = await context.newPage();
        await page.goto(`${origin}/original/${slug}/${rel.split('/').map(encodeURIComponent).join('/')}`, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
        await page.waitForTimeout(700);
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < Math.min(h, 6000); y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(70); }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        raws.push(await page.evaluate(collect));
        read.push(rel);
        await page.close();
      } catch { /* a page that cannot be read is skipped */ }
    }
  } finally { await browser.close(); }
  if (!raws.length) throw new Error('None of the pages could be opened in the browser, so the colours could not be read.');
  const merged = merge(raws);
  const pal = palette(merged);
  const result = { at: new Date().toISOString(), pages: read, tokens: tokensFrom(merged, pal), palette: pal, fonts: (raws[0].fonts || []).slice(0, 3).map((f) => f.family), sheets: (raws[0].sheets || []).length };
  await writeJson(file(slug), result);
  return result;
}
