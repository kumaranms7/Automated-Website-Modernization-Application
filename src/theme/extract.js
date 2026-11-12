import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { clientDir, loadClient, readJson } from '../config.js';
import { parseColor, toHex, rgbToOklch, hexToOklch, hueGap, oklchHex, contrast } from './color.js';
import { loadSiteColors } from '../template/site-colors.js';

// Strategy 1: the colours the website already has. They come from the files of the website (CSS variables, a Tailwind configuration,
// style rules and inline styles, each judged by where it is used: a button, the header, a heading, a link, the page background),
// from the logo picture, and from how the pages are drawn in a browser (template/site-colors.json, when it was read).
// A colour that is frequent is not automatically a brand colour: a grey or a white is a neutral however often it is used.

const SKIP_DIRS = new Set(['node_modules', '.git', '_modernizer-backup', 'wp-includes', 'wp-admin', 'vendor', 'cache']);
const MAX_FILE = 600 * 1024;
const COLOR_RX = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;

// how brand-like and how neutral a colour is
const kind = (hex) => {
  const o = hexToOklch(hex);
  if (o.l > 0.94 || o.l < 0.14) return 'neutral';
  if (o.c < 0.035) return 'neutral';
  return 'brand';
};

// ---------- reading the files ----------
async function* walk(dir, depth = 0) {
  if (depth > 5) return;
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.well-known') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name.toLowerCase())) yield* walk(full, depth + 1); } else yield full;
  }
}
const read = async (f) => { try { const st = await fs.stat(f); return st.size > MAX_FILE ? '' : await fs.readFile(f, 'utf8'); } catch { return ''; } };

// every { selector, prop, value } of a stylesheet (nested @media blocks included; comments removed)
export function cssDeclarations(css) {
  const out = [];
  const text = String(css).replace(/\/\*[\s\S]*?\*\//g, ' ');
  const walkBlock = (src) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf('{', i);
      if (open < 0) break;
      const head = src.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < src.length && depth) { if (src[j] === '{') depth += 1; else if (src[j] === '}') depth -= 1; j += 1; }
      const body = src.slice(open + 1, j - 1);
      if (/^@(media|supports|layer|container)/i.test(head)) walkBlock(body);
      else if (!head.startsWith('@')) for (const d of body.split(';')) { const k = d.indexOf(':'); if (k > 0) out.push({ selector: head.replace(/\s+/g, ' '), prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim() }); }
      i = j;
    }
  };
  walkBlock(text);
  return out;
}

// what a declaration says about a colour: the role it plays on the page
function roleOf(selector, prop) {
  const sel = selector.toLowerCase();
  const bg = /^(background|background-color|border-color|border-top-color|border-bottom-color|fill)$/.test(prop) || (prop === 'background' ) ;
  const text = prop === 'color';
  const isButton = /(\bbtn\b|\.btn|button|\.cta|\.button|input\[type=["']?submit)/.test(sel);
  const isHeader = /(^|[\s,.#>])(header|\.header|\.navbar|\.nav\b|nav\b|#header|\.masthead|\.site-header)/.test(sel);
  const isFooter = /(footer|\.footer|#footer)/.test(sel);
  const isHeading = /(^|[\s,>])(h[1-6])\b/.test(sel);
  const isLink = /(^|[\s,>])a\b(?!\.btn)/.test(sel);
  const isBody = /^(html|body|:root|\*)(\s|,|$)/.test(sel) || /^(html|body)\b/.test(sel);
  if (isButton && bg) return { role: 'button', w: 6 };
  if (isButton && text) return { role: 'button-text', w: 1 };
  if (isHeader && bg) return { role: 'header', w: 4 };
  if (isFooter && bg) return { role: 'footer', w: 3 };
  if (isHeading && text) return { role: 'heading', w: 3 };
  if (isLink && text) return { role: 'link', w: 3 };
  if (isBody && bg) return { role: 'page-background', w: 2 };
  if (isBody && text) return { role: 'body-text', w: 2 };
  if (bg) return { role: 'background', w: 1 };
  if (text) return { role: 'text', w: 0.5 };
  return null;
}

// names that say what a CSS variable or a Tailwind colour is
const NAME_ROLE = [[/(^|[-_])(primary|brand|main)([-_]|$)/, 'primary'], [/(secondary|second)/, 'secondary'], [/(accent|cta|highlight)/, 'accent'], [/(^|[-_])(bg|background|body)([-_]|$)/, 'background'], [/(text|ink|foreground|font)/, 'text']];
const nameRole = (name) => { for (const [rx, role] of NAME_ROLE) if (rx.test(name.toLowerCase())) return role; return null; };

// ---------- collecting ----------
export async function scanSiteFiles(sourceDir) {
  const found = new Map(); // hex -> { weight, roles: Map, sources: Set }
  const named = []; // { role, hex, from } from variable and config names
  const counts = { cssVariables: 0, tailwind: 0, rules: 0, inline: 0, files: 0 };
  const add = (hex, role, w, source) => {
    const h = toHex(hex, null);
    if (!h) return;
    const e = found.get(h) || { hex: h, weight: 0, roles: new Map(), sources: new Set() };
    e.weight += w; e.roles.set(role, (e.roles.get(role) || 0) + w); e.sources.add(source);
    found.set(h, e);
  };
  for await (const f of walk(sourceDir)) {
    const ext = path.extname(f).toLowerCase();
    const rel = path.relative(sourceDir, f).split(path.sep).join('/');
    if (['.css', '.scss'].includes(ext) && !/\.min\.css$/.test(f) === true || ext === '.css') {
      const css = await read(f);
      if (!css) continue;
      counts.files += 1;
      // CSS custom properties: the name says what the colour is for
      for (const m of css.matchAll(/(--[a-z0-9_-]+)\s*:\s*([^;}{]+)/gi)) {
        const col = (m[2].match(COLOR_RX) || [])[0];
        if (!col || !toHex(col, null)) continue;
        counts.cssVariables += 1;
        const role = nameRole(m[1]);
        add(col, role || 'variable', role ? 5 : 1, 'css-variable');
        if (role) named.push({ role, hex: toHex(col), from: m[1] });
      }
      for (const d of cssDeclarations(css)) {
        if (d.prop.startsWith('--')) continue;
        const r = roleOf(d.selector, d.prop);
        if (!r) continue;
        for (const c of d.value.match(COLOR_RX) || []) { counts.rules += 1; add(c, r.role, r.w, 'stylesheet'); }
      }
    } else if (/^tailwind\.config\.(js|cjs|mjs|ts)$/i.test(path.basename(f))) {
      const cfg = await read(f);
      // colors: { brand: '#...', primary: { 500: '#...' } }
      for (const m of cfg.matchAll(/['"]?([a-z][\w-]*)['"]?\s*:\s*(?:\{[^{}]*\}|['"][^'"]+['"])/gi)) {
        const role = nameRole(m[1]);
        const hexes = m[0].match(COLOR_RX) || [];
        for (const hx of hexes) { if (!toHex(hx, null)) continue; counts.tailwind += 1; add(hx, role || 'tailwind', role ? 5 : 1, 'tailwind-config'); if (role) named.push({ role, hex: toHex(hx), from: `tailwind ${m[1]}` }); }
      }
    } else if (['.html', '.htm', '.php'].includes(ext)) {
      const html = await read(f);
      if (!html) continue;
      counts.files += 1;
      // <style> blocks are stylesheets; style="" attributes carry colours of one element
      for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) for (const d of cssDeclarations(m[1])) { if (d.prop.startsWith('--')) continue; const r = roleOf(d.selector, d.prop); if (r) for (const c of d.value.match(COLOR_RX) || []) { counts.rules += 1; add(c, r.role, r.w * 0.6, 'style-block'); } }
      for (const m of html.matchAll(/<(\w+)([^>]*?)style\s*=\s*"([^"]*)"/gi)) {
        const tag = m[1].toLowerCase(), style = m[3];
        const btn = tag === 'button' || /class\s*=\s*"[^"]*\b(btn|button|cta)\b/i.test(m[2]);
        for (const d of style.split(';')) {
          const k = d.indexOf(':');
          if (k < 0) continue;
          const prop = d.slice(0, k).trim().toLowerCase();
          const role = /^background(-color)?$/.test(prop) ? (btn ? 'button' : tag === 'header' || tag === 'nav' ? 'header' : tag === 'footer' ? 'footer' : 'background') : prop === 'color' ? (/^h[1-6]$/.test(tag) ? 'heading' : tag === 'a' ? 'link' : 'text') : null;
          if (!role) continue;
          for (const c of d.slice(k + 1).match(COLOR_RX) || []) { counts.inline += 1; add(c, role, btn ? 4 : 1, 'inline-style'); }
        }
      }
    }
  }
  return { colors: [...found.values()].map((e) => ({ hex: e.hex, weight: e.weight, roles: Object.fromEntries(e.roles), sources: [...e.sources] })), named, counts };
}

// ---------- the logo ----------
async function findLogo(client, slug) {
  const home = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const candidates = [];
  const profile = await readJson(path.join(clientDir(slug), 'profile.json'), null);
  if (profile?.facts?.logo) candidates.push(profile.facts.logo);
  for (const p of home.filter((x) => x.type === 'home').slice(0, 1)) for (const im of p.images || []) if (/logo/i.test(`${im.src || ''} ${im.alt || ''}`)) candidates.push(im.src);
  for (const src of candidates) {
    const clean = String(src).split('?')[0].replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
    const file = path.join(client.sourceDir, ...clean.split('/'));
    if (/\.(png|jpe?g|webp|gif|avif)$/i.test(file) && (await fs.stat(file).catch(() => null))) return file;
  }
  return null;
}

// the colours of a logo picture: the few that are neither near white, near black nor grey, by how much of the logo they fill
export async function logoColors(file) {
  try {
    const { data, info } = await sharp(file).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const hex = toHex(`rgb(${data[i]},${data[i + 1]},${data[i + 2]})`);
      const o = hexToOklch(hex);
      if (o.l > 0.94 || o.l < 0.12 || o.c < 0.05) continue;
      const key = `${Math.round(o.h / 18)}|${Math.round(o.l * 6)}`;
      const b = buckets.get(key) || { n: 0, l: 0, c: 0, h: 0 };
      b.n += 1; b.l += o.l; b.c += o.c; b.h += o.h; buckets.set(key, b);
    }
    return [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 4).map((b) => ({ hex: oklchHex(b.l / b.n, b.c / b.n, b.h / b.n), share: +(b.n / (info.width * info.height)).toFixed(3) }));
  } catch { return []; }
}

// ---------- putting it together ----------
// the brand of the website: primary, secondary, accent and neutral, each with where it was seen
export async function extractBrand(slug, { includeRendered = true } = {}) {
  const client = await loadClient(slug);
  if (!client) throw new Error('Unknown website');
  const files = await scanSiteFiles(client.sourceDir);
  const logoFile = await findLogo(client, slug);
  const logo = logoFile ? await logoColors(logoFile) : [];
  const rendered = includeRendered ? await loadSiteColors(slug) : null;
  const pool = new Map();
  const bump = (hex, role, w, source) => {
    const h = toHex(hex, null);
    if (!h) return;
    const e = pool.get(h) || { hex: h, weight: 0, roles: {}, sources: [] };
    e.weight += w; e.roles[role] = (e.roles[role] || 0) + w; if (!e.sources.includes(source)) e.sources.push(source);
    pool.set(h, e);
  };
  for (const c of files.colors) for (const [role, w] of Object.entries(c.roles)) bump(c.hex, role, w, c.sources[0]);
  // the logo is the most direct statement of the brand
  logo.forEach((c, i) => bump(c.hex, 'logo', 14 - i * 3, 'logo'));
  // what the browser drew: the tokens read from the pages
  if (rendered?.tokens) {
    if (rendered.tokens.primary) bump(rendered.tokens.primary, 'rendered-primary', 12, 'rendered pages');
    if (rendered.tokens.accent) bump(rendered.tokens.accent, 'rendered-accent', 8, 'rendered pages');
  }
  const list = [...pool.values()].map((c) => ({ ...c, kind: kind(c.hex), ...hexToOklch(c.hex) })).sort((a, b) => b.weight - a.weight);
  // brand colours: lively colours, grouped by hue (shades of one hue are one colour), the heaviest group first
  const groups = [];
  for (const c of list.filter((x) => x.kind === 'brand')) {
    const g = groups.find((x) => hueGap(x.h, c.h) < 22);
    if (g) { g.weight += c.weight; g.items.push(c); } else groups.push({ h: c.h, weight: c.weight, items: [c] });
  }
  groups.sort((a, b) => b.weight - a.weight);
  const main = (g) => g.items.slice().sort((a, b) => b.weight - a.weight)[0];
  const roleWeight = (g, roles) => g.items.reduce((n, c) => n + roles.reduce((m, r) => m + (c.roles[r] || 0), 0), 0);
  // the accent is the colour of the buttons when that is another hue; the secondary is a dark structural colour (header, footer) or the next hue
  const ctaGroup = groups.slice().sort((a, b) => roleWeight(b, ['button', 'rendered-accent']) - roleWeight(a, ['button', 'rendered-accent']))[0];
  // the brand colour is the heaviest hue; when that hue is only the buttons' and another hue is nearly as heavy (the logo, the headings, the
  // backgrounds), the other one is the brand and the buttons are the accent
  const primaryGroup = !groups.length ? null : groups[0] === ctaGroup && groups[1] && groups[1].weight >= groups[0].weight * 0.4 ? groups[1] : groups[0];
  const primary = primaryGroup ? main(primaryGroup) : null;
  const accentGroup = groups.find((g) => g !== primaryGroup && (g === ctaGroup || g.weight >= (primaryGroup?.weight || 1) / 6));
  const accent = accentGroup ? main(accentGroup) : null;
  const structural = list.filter((c) => (c.roles.header || c.roles.footer) && c.l < 0.4).sort((a, b) => (b.roles.header || 0) + (b.roles.footer || 0) - ((a.roles.header || 0) + (a.roles.footer || 0)))[0];
  const secondaryGroup = groups.find((g) => g !== primaryGroup && g !== accentGroup);
  const secondary = structural || (secondaryGroup ? main(secondaryGroup) : null);
  const neutrals = list.filter((c) => c.kind === 'neutral');
  const textColor = neutrals.filter((c) => c.l < 0.5).sort((a, b) => ((b.roles['body-text'] || 0) + (b.roles.text || 0) + (b.roles.heading || 0)) - ((a.roles['body-text'] || 0) + (a.roles.text || 0) + (a.roles.heading || 0)))[0];
  const pageBg = neutrals.filter((c) => c.l > 0.9).sort((a, b) => (b.roles['page-background'] || 0) - (a.roles['page-background'] || 0))[0];
  const pick = (c) => (c ? { hex: c.hex, weight: +c.weight.toFixed(1), roles: c.roles, sources: c.sources } : null);
  return {
    primary: pick(primary), secondary: pick(secondary), accent: pick(accent), neutral: pick(textColor), background: pick(pageBg),
    colors: list.slice(0, 16).map((c) => ({ hex: c.hex, kind: c.kind, weight: +c.weight.toFixed(1), roles: c.roles, sources: c.sources })),
    logo, logoFile: logoFile ? path.relative(client.sourceDir, logoFile).split(path.sep).join('/') : null,
    sources: { ...files.counts, logo: logo.length, rendered: Boolean(rendered) },
    // true when something of the website's own was found (else the generator uses the industry)
    found: Boolean(primary),
    // a base for the generator
    base: primary ? { primary: primary.hex, ...(secondary ? { secondary: secondary.hex } : {}), ...(accent ? { accent: accent.hex } : {}), ...(textColor ? { neutral: textColor.hex } : {}) } : null,
  };
}
