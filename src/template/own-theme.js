import path from 'node:path';
import { chromium } from 'playwright-core';
import { clientDir, readJson, writeJson } from '../config.js';
import { describeTemplate } from './own-structure.js';

// The theme of a template page, read from how the page really renders in a browser: the colours, fonts, headings, buttons, corner
// radius, shadows and container widths that its compiled Tailwind CSS (and any other stylesheet) produce. Reading the rendered page
// works for every flavour of CSS (Tailwind 3 or 4, custom properties, arbitrary values, plain classes) and needs no parsing.

const themeFile = (slug) => path.join(clientDir(slug), 'template', 'own-theme.json');

// runs inside the page
export function collect() {
  const px = (v) => parseFloat(v) || 0;
  const hex = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if ((p.length > 3 ? p[3] : 1) < 0.25) return null;
    return `#${p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
  };
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TEMPLATE']);
  const docArea = Math.max(1, document.documentElement.scrollWidth * document.documentElement.scrollHeight);
  const colors = new Map(), fonts = new Map(), radius = new Map(), shadows = new Map(), widths = new Map(), buttons = new Map(), links = new Map();
  const bump = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
  const col = (h, kind, w) => { if (!h) return; const e = colors.get(h) || { text: 0, bg: 0, border: 0 }; e[kind] += w; colors.set(h, e); };
  const first = (family) => String(family).split(',')[0].replace(/["']/g, '').trim();
  for (const e of document.body.querySelectorAll('*')) {
    if (skip.has(e.tagName)) continue;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ');
    if (own) {
      col(hex(cs.color), 'text', own.length);
      const fam = first(cs.fontFamily), f = fonts.get(fam) || { uses: 0, weights: new Set(), sizes: new Set(), tags: new Set() };
      f.uses += own.length; f.weights.add(cs.fontWeight); f.sizes.add(Math.round(px(cs.fontSize))); f.tags.add(e.tagName.toLowerCase()); fonts.set(fam, f);
      if (e.tagName === 'A' && e.closest('p, li') && !e.closest('header, footer, nav')) bump(links, hex(cs.color) || '', own.length);
    }
    const bg = hex(cs.backgroundColor);
    col(bg, 'bg', ((r.width * r.height) / docArea) * 1000);
    if (px(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') col(hex(cs.borderTopColor), 'border', 1);
    if (cs.borderTopLeftRadius !== '0px' && r.width < 900) bump(radius, cs.borderTopLeftRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') bump(shadows, cs.boxShadow);
    if (cs.maxWidth !== 'none' && px(cs.maxWidth) >= 600 && (cs.marginLeft === 'auto' || cs.marginInlineStart === 'auto' || px(cs.marginLeft) > 0)) bump(widths, cs.maxWidth);
    if ((e.tagName === 'A' || e.tagName === 'BUTTON') && bg && own && r.width < 420 && px(cs.paddingLeft) >= 8) {
      const k = [bg, hex(cs.color), cs.borderTopLeftRadius, cs.fontWeight].join('|');
      const b = buttons.get(k) || { n: 0, bg, color: hex(cs.color), radius: cs.borderTopLeftRadius, weight: cs.fontWeight, size: Math.round(px(cs.fontSize)), padding: `${cs.paddingTop} ${cs.paddingLeft}`, family: first(cs.fontFamily) };
      b.n += 1; buttons.set(k, b);
    }
  }
  const main = document.querySelector('main') || document.body;
  const heading = (tag) => {
    const e = [...main.querySelectorAll(tag)].find((x) => !x.closest('header, footer, nav') && x.getBoundingClientRect().height > 0) || document.querySelector(tag);
    if (!e) return null;
    const cs = getComputedStyle(e);
    return { tag, family: first(cs.fontFamily), size: Math.round(px(cs.fontSize)), weight: cs.fontWeight, color: hex(cs.color), lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, transform: cs.textTransform, text: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 70) };
  };
  const bodyCs = getComputedStyle(document.body);
  const sections = [...document.querySelectorAll('[data-sm-key]')].filter((e) => !['header', 'footer'].includes(e.getAttribute('data-sm-key'))).map((e) => {
    let bg = null;
    for (let n = e; n && !bg; n = n.parentElement) bg = hex(getComputedStyle(n).backgroundColor);
    const cs = getComputedStyle(e);
    const inner = [...e.children].find((c) => getComputedStyle(c).maxWidth !== 'none');
    return { key: e.getAttribute('data-sm-key'), bg: bg || '#ffffff', color: hex(cs.color), padTop: Math.round(px(cs.paddingTop)), padBottom: Math.round(px(cs.paddingBottom)), container: inner ? getComputedStyle(inner).maxWidth : '' };
  });
  const sorted = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    sheets: [...document.styleSheets].map((s) => s.href).filter(Boolean),
    colors: [...colors.entries()].map(([h, v]) => ({ hex: h, ...v })).sort((a, b) => (b.text * 0.4 + b.bg + b.border) - (a.text * 0.4 + a.bg + a.border)).slice(0, 40),
    fonts: sorted(new Map([...fonts].map(([k, v]) => [k, v.uses])), 8).map(([family, uses]) => ({ family, uses, weights: [...fonts.get(family).weights].sort(), sizes: [...fonts.get(family).sizes].sort((a, b) => a - b), tags: [...fonts.get(family).tags].slice(0, 8) })),
    loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/["']/g, '')} ${f.weight}`).slice(0, 20),
    body: { family: first(bodyCs.fontFamily), size: Math.round(px(bodyCs.fontSize)), color: hex(bodyCs.color), bg: hex(bodyCs.backgroundColor) || hex(getComputedStyle(document.documentElement).backgroundColor) || '#ffffff', lineHeight: bodyCs.lineHeight },
    headings: ['h1', 'h2', 'h3', 'h4'].map(heading).filter(Boolean),
    buttons: [...buttons.values()].sort((a, b) => b.n - a.n).slice(0, 4),
    linkColor: sorted(links, 1)[0]?.[0] || null,
    radius: sorted(radius, 5).map(([v, n]) => ({ value: v, n })),
    shadows: sorted(shadows, 4).map(([v, n]) => ({ value: v, n })),
    containers: sorted(widths, 4).map(([v, n]) => ({ value: v, n })),
    sections,
  };
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function hsl(h) {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(((hue * 60) + 360) % 360), s, l };
}

// names for the colours: what each one does on the page
export function palette(raw) {
  const c = raw.colors.map((x) => ({ ...x, ...hsl(x.hex) }));
  const buttonBg = new Set(raw.buttons.map((b) => b.bg));
  const sat = c.filter((x) => x.s > 0.3 && x.l > 0.12 && x.l < 0.78).sort((a, b) => (b.text * 0.5 + b.bg + b.border * 2 + (buttonBg.has(b.hex) ? 80 : 0) + (raw.linkColor === b.hex ? 40 : 0)) - (a.text * 0.5 + a.bg + a.border * 2 + (buttonBg.has(a.hex) ? 80 : 0) + (raw.linkColor === a.hex ? 40 : 0)));
  const primary = sat[0];
  const accent = sat.find((x) => primary && Math.min(Math.abs(x.h - primary.h), 360 - Math.abs(x.h - primary.h)) > 25);
  const secondary = sat.find((x) => x !== primary && x !== accent);
  const dark = c.filter((x) => x.l < 0.25).sort((a, b) => b.bg - a.bg)[0];
  const soft = c.filter((x) => x.l > 0.88 && x.l < 0.995).sort((a, b) => b.bg - a.bg)[0];
  const text = raw.body.color || [...c].sort((a, b) => b.text - a.text)[0]?.hex;
  const out = [['Primary', primary], ['Accent', accent], ['Secondary', secondary], ['Dark surface', dark], ['Soft background', soft]].filter(([, v]) => v).map(([role, v]) => ({ role, hex: v.hex }));
  if (text) out.push({ role: 'Text', hex: text });
  out.push({ role: 'Page background', hex: raw.body.bg });
  const seen = new Set();
  return out.filter((x) => (seen.has(`${x.role}`) ? false : seen.add(x.role)));
}

export async function extractTheme(slug, layout, { refresh = false } = {}) {
  const cache = await readJson(themeFile(slug), { layouts: {} });
  const own = await readJson(path.join(clientDir(slug), 'template', 'own.json'), {});
  if (!refresh && cache.layouts[layout]?.page === own[layout]) return cache.layouts[layout];
  await describeTemplate(slug, layout); // writes the page the theme is read from
  const origin = globalThis.__portalOrigin;
  if (!origin) throw new Error('The portal address is not known yet.');
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge' }); } catch { throw new Error('The browser could not be started. Microsoft Edge is needed to read the theme.'); }
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(`${origin}/ownpreview/${slug}/_edit-${layout}.html`, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 600) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const raw = await page.evaluate(collect);
    const theme = { ...raw, page: own[layout], at: new Date().toISOString(), palette: palette(raw) };
    cache.layouts[layout] = theme;
    await writeJson(themeFile(slug), cache);
    return theme;
  } finally { await browser.close(); }
}
