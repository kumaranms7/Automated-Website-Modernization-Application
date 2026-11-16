import { cleanCustomHtml } from '../kit/custom-html.js';
import { cleanStyle } from '../kit/parts.js';
import { HEADER, FOOTER } from '../kit/chrome.js';
import fs from 'node:fs';
import { normalizeOps, normalizeHtmlEdits, sanitizeSection, sanitizeChrome } from './html-ops.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureContrast, ensureContrastOnDark, onColor } from '../build/color.js';
import { buildTheme, compactTheme, cssVars, themeCss, legacyTokens } from '../theme/engine.js';
import { nearestReadable, readableOn } from '../theme/color.js';
import { DESIGN_IDS } from '../kit/designs.js';
import { PACK_IDS } from '../kit/packs.js';
import { VARIANTS as KIT_VARIANTS } from '../kit/sections.js';
import { SECTION_TYPES, SECTION_PROPS, HEADER_STYLES, FOOTER_STYLES, typeOfRef } from './section-meta.js';

// A site's template is a "design spec": design tokens (colours, fonts, shape, spacing) plus the choice of variant
// for each part of the page (header, hero, cards, footer, forms). Everything the renderer draws is driven by it,
// so two sites with different specs look genuinely different, and a spec can be edited by hand or by the AI.

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');
export const FONT_CATALOG = JSON.parse(fs.readFileSync(path.join(FONT_DIR, 'catalog.json'), 'utf8'));
export const FONT_DIR_PATH = FONT_DIR;

export const OPTIONS = {
  header: ['classic', 'centered', 'minimal'],
  hero: ['gradient', 'split', 'centered', 'light', 'photo', 'dark', 'editorial'],
  sections: ['alternating', 'flat'],
  cards: ['shadow', 'outline', 'flat'],
  cardLayout: ['auto', 'image', 'icon', 'numbered', 'overlay'],
  innerSidebar: ['on', 'off'],
  sectionHead: ['left', 'center', 'bar'],
  footer: ['dark', 'brand', 'light'],
  contactLayout: ['split', 'stacked'],
  innerForm: ['side', 'below'],
  homeStyle: ['showcase', 'story'],
  radius: ['none', 'sm', 'md', 'lg', 'xl'],
  shadow: ['none', 'soft', 'medium'],
  density: ['compact', 'comfortable', 'spacious'],
  headingCase: ['uppercase', 'capitalize', 'none'],
  headingWeight: [400, 600, 700, 800],
  container: ['narrow', 'normal', 'wide'],
};

const RADIUS = { none: ['0', '0'], sm: ['.375rem', '.3rem'], md: ['.75rem', '.5rem'], lg: ['1rem', '.65rem'], xl: ['1.5rem', '999px'] };
const SHADOW = { none: 'none', soft: '0 1px 2px rgb(15 23 42 / .06), 0 4px 14px rgb(15 23 42 / .06)', medium: '0 4px 6px rgb(15 23 42 / .07), 0 14px 32px rgb(15 23 42 / .12)' };
const DENSITY = { compact: ['2.5rem', '3.25rem'], comfortable: ['3rem', '4.5rem'], spacious: ['4rem', '6.25rem'] };
const CONTAINER = { narrow: '64rem', normal: '76rem', wide: '86rem' };
const HEX = /^#[0-9a-f]{6}$/i;

// the design kit: the modern design chosen for the site (empty: the classic template) and the business type its icons and placeholder content follow
const kitSections = (list) => (list || []).filter((b) => b && (b.type === 'hero' ? KIT_VARIANTS.hero : KIT_VARIANTS[b.type])?.includes(b.variant)).slice(0, 30).map((b) => ({ type: String(b.type), variant: String(b.variant), ...(['white', 'soft', 'tint', 'dark', 'brand'].includes(b.tone) ? { tone: b.tone } : {}), ...(['tight', 'loose'].includes(b.space) ? { space: b.space } : {}), ...(Object.keys(cleanStyle(b.style)).length ? { style: cleanStyle(b.style) } : {}) }));
const pageSections = (v) => {
  const out = {};
  for (const [path, secs] of Object.entries(v && typeof v === 'object' ? v : {}).slice(0, 60)) {
    const keep = {};
    for (const [key, c] of Object.entries(secs && typeof secs === 'object' ? secs : {}).slice(0, 80)) {
      if (!/^(s[a-z0-9]{3,14}|a[a-z0-9]{3,14}|hero)$/.test(key) || !c) continue;
      const role = String(c.role || '').replace(/[^a-z]/g, '').slice(0, 20), variant = String(c.variant || '').replace(/[^a-z0-9-]/g, '').slice(0, 32), tone = ['white', 'soft', 'tint', 'dark', 'brand'].includes(c.tone) ? c.tone : '';
      const html = typeof c.html === 'string' ? cleanCustomHtml(c.html) : '';
      const style = cleanStyle(c.style);
      const styled = Object.keys(style).length > 0;
      // a section of the library added to this page: its kind, layout and the section it comes after
      const ad = key[0] === 'a' && c.added && typeof c.added === 'object' ? { role: String(c.added.role || '').replace(/[^a-z]/g, '').slice(0, 20), variant: String(c.added.variant || '').replace(/[^a-z0-9-]/g, '').slice(0, 32), after: /^[a-z0-9]{3,16}$/.test(c.added.after || '') ? c.added.after : '' } : null;
      if (ad?.role && ad.variant) { keep[key] = { added: ad, ...(variant ? { variant } : {}), ...(tone ? { tone } : {}), ...(c.hide ? { hide: true } : {}), ...(html ? { html } : {}), ...(styled ? { style } : {}) }; continue; }
      if (key[0] === 'a') continue;
      const photo = key === 'hero' && c.bg === 'photo', image = photo && typeof c.image === 'string' ? c.image.replace(/[\s"'<>]/g, '').slice(0, 600) : '';
      const plainBg = key === 'hero' && c.bg === 'plain';
      if (variant || tone || c.hide || html || styled || photo || plainBg) keep[key] = { ...(photo ? { bg: 'photo', ...(image ? { image } : {}) } : plainBg ? { bg: 'plain' } : {}), ...(role ? { role } : {}), ...(variant ? { variant } : {}), ...(tone ? { tone } : {}), ...(c.hide ? { hide: true } : {}), ...(html ? { html } : {}), ...(styled ? { style } : {}) };
    }
    if (Object.keys(keep).length) out[String(path).slice(0, 200)] = keep;
  }
  return out;
};
// what was chosen for a kind of section, for every page that has that kind: { kind id: { role, variant, tone, style } }
const kindChoices = (v) => {
  const out = {};
  for (const [id, c] of Object.entries(v && typeof v === 'object' ? v : {}).slice(0, 80)) {
    if (!/^k[a-z0-9]{3,12}$/.test(id) || !c) continue;
    const role = String(c.role || '').replace(/[^a-z]/g, '').slice(0, 20), variant = String(c.variant || '').replace(/[^a-z0-9-]/g, '').slice(0, 32), tone = ['white', 'soft', 'tint', 'dark', 'brand'].includes(c.tone) ? c.tone : '';
    const style = cleanStyle(c.style);
    const styled = Object.keys(style).length > 0;
    if (variant || tone || styled) out[id] = { ...(role ? { role } : {}), ...(variant ? { variant } : {}), ...(tone ? { tone } : {}), ...(styled ? { style } : {}) };
  }
  return out;
};
// the order of a page's sections, when it was changed: { page path: [section keys] }
const pageOrder = (v) => Object.fromEntries(Object.entries(v && typeof v === 'object' ? v : {}).slice(0, 60).map(([path, keys]) => [String(path).slice(0, 200), (Array.isArray(keys) ? keys : []).map(String).filter((k) => /^s[a-z0-9]{3,16}$/.test(k)).slice(0, 80)]).filter(([, keys]) => keys.length));
// the header, footer and top bar are chosen for the whole theme: a layout, and the styles of their parts
const chromeZone = (c, variants) => {
  const style = cleanStyle(c?.style);
  return { ...(variants && variants.includes(c?.variant) ? { variant: c.variant } : {}), ...(['yes', 'no'].includes(c?.show) && !variants ? { show: c.show } : {}), ...(Object.keys(style).length ? { style } : {}) };
};
const chromeOf = (v) => ({ header: chromeZone(v?.header, Object.keys(HEADER)), footer: chromeZone(v?.footer, Object.keys(FOOTER)), topbar: chromeZone(v?.topbar, null) });
const normalizeKit = (k, base) => ({
  design: DESIGN_IDS.includes(k?.design ?? base?.design) ? (k?.design ?? base?.design) : '',
  pack: PACK_IDS.includes(k?.pack ?? base?.pack) ? (k?.pack ?? base?.pack) : '',
  // the sections chosen for each kind of page (empty: the design's own)
  sections: Object.fromEntries(['home', 'inner', 'contact'].map((kind) => [kind, Array.isArray(k?.sections?.[kind]) ? kitSections(k.sections[kind]) : kitSections(base?.sections?.[kind])])),
  // what was chosen for one section of one page (that page only): { page path: { section key: { role, variant, tone } } }
  pageSections: pageSections(k?.pageSections ?? base?.pageSections),
  pageOrder: pageOrder(k?.pageOrder ?? base?.pageOrder),
  kinds: kindChoices(k?.kinds ?? base?.kinds),
  chrome: chromeOf(k?.chrome ?? base?.chrome),
  // the hero of the inner pages, when it is the one another design gives them
  ...(/^[a-z]{2}-page$/.test(k?.innerHero ?? base?.innerHero ?? '') && KIT_VARIANTS.hero.includes(k?.innerHero ?? base?.innerHero) ? { innerHero: k?.innerHero ?? base?.innerHero } : {}),
  // the template's "Explore related pages" lists are left out of every page
  ...((k?.dropRelated ?? base?.dropRelated) === true ? { dropRelated: true } : {}),
});

export const DEFAULT_SPEC = {
  kit: { design: '', pack: '', sections: { home: [], inner: [], contact: [] }, pageSections: {}, pageOrder: {}, kinds: {}, chrome: { header: {}, footer: {}, topbar: {} } },
  version: 1,
  status: 'draft',
  name: 'Starter',
  tokens: {
    primary: '#19858E', primaryDark: '#075E65', accent: '#E47229', ink: '#1A2828', soft: '#F2F6F6',
    fontHeading: 'Bebas Neue', fontBody: 'Open Sans',
    headingCase: 'uppercase', headingWeight: 400, radius: 'lg', shadow: 'soft', density: 'comfortable', container: 'normal',
  },
  layout: { header: 'classic', topbar: true, hero: 'gradient', sections: 'alternating', cards: 'shadow', cardLayout: 'auto', sectionHead: 'left', innerSidebar: 'on', footer: 'dark', contactLayout: 'split', innerForm: 'side', homeStyle: 'showcase' },
  pages: { home: '', inner: '', contact: '' },
  homeMap: null,
  extras: { backToTop: { icon: '' }, floating: { side: 'right', items: [] }, headerButtons: [], heroImage: { src: '', alt: '' }, banners: { home: { src: '', alt: '', mode: 'background' }, inner: { src: '', alt: '', mode: 'background' }, contact: { src: '', alt: '', mode: 'background' } } },
  archetype: '',
  sections: [],
  tweaks: [],
  pageLayout: { inner: {}, contact: {} },
  ops: [],
  htmlEdits: [],
  page: null,
  customCss: '',
  // the selected theme (the Theme Engine, src/theme): base colours, hand-set tokens, mode. null: the colours of the tokens above are used as they are.
  theme: null,
};

const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

// Extras are small add-ons the option lists cannot express: a custom back-to-top icon, floating side buttons and extra
// header buttons. Every value is clamped: short labels, safe link schemes only, icon limited to an image on the site itself.
const SAFE_HREF = /^(\/(?!\/)[^\s"'<>]*|#[\w-]*|https:\/\/[^\s"'<>]+|tel:[+\d\s().-]+|mailto:[^\s"'<>]+|[\w][\w./-]*\.(?:html?|php))$/i;
const cleanItems = (list, max) => (Array.isArray(list) ? list : []).map((x) => ({ label: String(x?.label || '').replace(/[<>"]/g, '').trim().slice(0, 24), href: String(x?.href || '').trim() })).filter((x) => x.label && SAFE_HREF.test(x.href)).slice(0, max);
function normalizeHeroImage(h) {
  const src = String(h?.src || '').trim();
  return src && SEC_IMG.test(src) && !src.includes('..') ? { src, alt: String(h.alt || '').replace(/[<>"]/g, '').trim().slice(0, 140) } : { src: '', alt: '' };
}
// the banner of each kind of page: a picture stored by the platform (assets/banners/…) or one of the site's own pictures
// mode: 'background' (the picture behind the heading, as the hero) or 'image' (a normal picture beside the heading)
function normalizeBanners(b, base) {
  const out = {};
  for (const slot of ['home', 'inner', 'contact']) {
    const v = b?.[slot] ?? base?.[slot];
    // a looping background video (assets/banners/…mp4|webm) can go with the picture, which then is its poster
    const vs = String(v?.video?.src || '').trim();
    const video = /^assets\/banners\/[\w.-]+\.(?:mp4|webm)$/i.test(vs) ? { src: vs } : null;
    out[slot] = { ...normalizeHeroImage(v), mode: v?.mode === 'image' ? 'image' : 'background', ...(video ? { video } : {}) };
  }
  return out;
}
// Website details and motion (Design settings): what a finished website needs besides its colours and fonts. Everything is optional:
// an announcement over the header, the wording and target of the main call to action, a line about the business, its opening hours,
// its social pages, how the hero looks, which colour the calls to action take, and how much the page moves.
export const SOCIAL_KEYS = ['facebook', 'instagram', 'youtube', 'linkedin', 'x', 'tiktok', 'google', 'yelp'];
export const WEB_OPTIONS = { overlay: ['light', 'medium', 'strong'], height: ['standard', 'tall', 'full'], pop: ['auto', 'primary', 'secondary', 'accent'], level: ['full', 'subtle', 'off'], pattern: ['auto', 'none', 'waves', 'dots', 'grid', 'hatch', 'plus', 'rings', 'hex'] };
function normalizeWeb(input) {
  const w = input && typeof input === 'object' ? input : {};
  const str = (v, n) => String(v ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const href = (v) => { const t = String(v ?? '').trim(); return SAFE_HREF.test(t) ? t.slice(0, 300) : ''; };
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const social = {};
  for (const k of SOCIAL_KEYS) { const v = String(w.social?.[k] ?? '').trim(); if (/^https:\/\/[^\s"'<>]+$/i.test(v)) social[k] = v.slice(0, 300); }
  return {
    announce: { on: bool(w.announce?.on, true), text: str(w.announce?.text, 140), href: href(w.announce?.href) },
    cta: { label: str(w.cta?.label, 40), href: href(w.cta?.href) },
    tagline: str(w.tagline, 220), hours: str(w.hours, 120), social,
    hero: { overlay: pick(w.hero?.overlay, WEB_OPTIONS.overlay, 'medium'), height: pick(w.hero?.height, WEB_OPTIONS.height, 'tall') },
    pop: pick(w.pop, WEB_OPTIONS.pop, 'auto'),
    pattern: pick(w.pattern, WEB_OPTIONS.pattern, 'auto'),
    labels: bool(w.labels, true),
    motion: { level: pick(w.motion?.level, WEB_OPTIONS.level, 'full'), zoom: bool(w.motion?.zoom, true) },
    controls: { progress: bool(w.controls?.progress, true), top: bool(w.controls?.top, true) },
  };
}
function normalizeExtras(input, base) {
  const e = input || {};
  const b = base || DEFAULT_SPEC.extras;
  const icon = String(e.backToTop?.icon ?? b.backToTop?.icon ?? '').trim();
  return {
    backToTop: { icon: /^(https:\/\/[^\s"'<>]+|\/?[\w][\w./%-]*\.(?:svg|png|webp|jpe?g|gif))$/i.test(icon) ? icon : '' },
    floating: { side: (e.floating?.side ?? b.floating?.side) === 'left' ? 'left' : 'right', items: cleanItems(e.floating?.items ?? b.floating?.items, 4) },
    headerButtons: cleanItems(e.headerButtons ?? b.headerButtons, 3),
    heroImage: normalizeHeroImage(e.heroImage ?? b.heroImage),
    banners: normalizeBanners(e.banners, b.banners),
    web: normalizeWeb(e.web ?? b.web),
  };
}

// Inner and contact pages can deviate from the site-wide layout options: a partial layout laid over spec.layout for that page only.
export const PAGE_LAYOUT_KEYS = {
  inner: ['hero', 'sections', 'cards', 'cardLayout', 'sectionHead', 'innerSidebar', 'innerForm'],
  contact: ['hero', 'sections', 'cards', 'sectionHead', 'contactLayout'],
};
export function normalizePageLayout(input) {
  const out = { inner: {}, contact: {} };
  for (const slot of Object.keys(PAGE_LAYOUT_KEYS)) {
    for (const k of PAGE_LAYOUT_KEYS[slot]) { const v = input?.[slot]?.[k]; if (OPTIONS[k]?.includes(v)) out[slot][k] = v; }
  }
  return out;
}
// the spec as one kind of page sees it
// A page with a banner of its own kind (home, inner or contact) is drawn with a photographic hero showing it.
// As a background it is the photographic hero; as a normal image it sits beside the heading (the design's own hero style keeps its
// look, and a photographic one becomes the split hero, which has room for a picture).
const withBanner = (spec, layout) => {
  const banner = spec.extras?.banners?.[layout];
  if (!banner?.src) return spec;
  const asImage = banner.mode === 'image';
  const hero = asImage ? (spec.layout.hero === 'photo' ? 'split' : spec.layout.hero) : 'photo';
  return { ...spec, layout: { ...spec.layout, hero }, extras: { ...spec.extras, heroImage: { src: banner.src, alt: banner.alt, mode: banner.mode } } };
};
export const specForPage = (spec, layout) => withBanner(spec.pageLayout?.[layout] && Object.keys(spec.pageLayout[layout]).length ? { ...spec, layout: { ...spec.layout, ...spec.pageLayout[layout] } } : spec, layout);

// Per-section layout changes (see section-tweaks.js). Keyed by page layout + section number.
const SEC_IMG = /^(\/?[\w][\w./%() -]*\.(?:jpe?g|png|webp|gif|svg)|https:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|gif|svg))$/i;
export function normalizeSections(list) {
  const out = new Map();
  for (const s of Array.isArray(list) ? list : []) {
    const layout = ['home', 'inner', 'contact', 'all'].includes(s?.layout) ? s.layout : 'home';
    const index = Number.isInteger(Number(s?.index)) && Number(s.index) > 0 && Number(s.index) < 60 ? Number(s.index) : 0;
    const heading = String(s?.heading || '').replace(/[<>"]/g, '').trim().slice(0, 80);
    if (!index && !heading) continue;
    const src = String(s?.image?.src || '').trim();
    const item = {
      layout, index, heading,
      columns: [2, 3].includes(Number(s?.columns)) ? Number(s.columns) : 0,
      image: src && SEC_IMG.test(src) && !src.includes('..') ? { src, alt: String(s.image.alt || '').replace(/[<>"]/g, '').trim().slice(0, 140), side: s.image.side === 'left' ? 'left' : 'right', width: s.image.width === 'third' ? 'third' : 'half' } : null,
      background: ['white', 'soft', 'dark', 'brand'].includes(s?.background) ? s.background : '',
      align: s?.align === 'center' ? 'center' : '',
    };
    if (!item.columns && !item.image && !item.background && !item.align) continue;
    const file = String(s?.file || '').replace(/[<>"]/g, '').slice(0, 200);
    if (file) item.file = file;
    out.set(`${layout}|${file}|${index || heading}`, item);
  }
  return [...out.values()].slice(0, 24);
}

const SECTION_CSS = `.sec-split { display: grid; gap: 2rem; align-items: center }
.sec-fig img { display: block }
@media (min-width: 1024px) {
  .sec-split { grid-template-columns: 1fr 1fr; gap: 3rem }
  .sec-split.w-third { grid-template-columns: 2fr 1fr }
  .sec-split.img-left .sec-fig { order: -1 }
  .sec-split.w-third.img-left { grid-template-columns: 1fr 2fr }
}
[data-cols] > * { break-inside: avoid-column }
[data-cols] > h1, [data-cols] > h2 { column-span: all }
@media (min-width: 768px) { [data-cols="2"] { column-count: 2; column-gap: 2.5rem } [data-cols="3"] { column-count: 3; column-gap: 2rem } }`;

// Tailwind class tweaks (see class-tweaks.js): a CSS selector plus classes to add and remove. Every part is clamped.
const CLASS_OK = /^[A-Za-z0-9_:\-/\[\]#%.,()!&>*~+@$]{1,80}$/;
const SELECTOR_OK = /^[\w\s.#:>+~*,()\[\]="'^$|-]{1,400}$/;
export function normalizeTweaks(list) {
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    const selector = String(t?.selector || '').trim();
    if (!SELECTOR_OK.test(selector) || /url\(|javascript:|expression/i.test(selector)) continue;
    const tidy = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(/\s+/)).map((x) => String(x).trim()).filter((x) => CLASS_OK.test(x)))].slice(0, 40);
    const add = tidy(t.add), remove = tidy(t.remove);
    if (!add.length && !remove.length) continue;
    out.push({ layout: ['home', 'inner', 'contact', 'all'].includes(t?.layout) ? t.layout : 'all', selector, add, remove, ...(t?.file ? { file: String(t.file).replace(/[<>"]/g, '').slice(0, 200) } : {}) });
  }
  return out.slice(0, 40);
}

// The home page as an ordered list of sections. Each entry points at a piece of the site's own content (ref), says which
// layout style to draw it in, and carries its design properties. A section can keep the look of the design it came from
// (own = that design's tokens) or follow the page's theme (the default).
const OWN_KEYS = ['primary', 'primaryDark', 'accent', 'ink', 'soft', 'fontHeading', 'fontBody', 'headingCase', 'headingWeight', 'radius', 'shadow', 'density'];
const textOf = (v, n) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n);
// A class that would hide original content is never allowed in a tweak.
const visibleClass = (c) => !/(^|:)(hidden|invisible|sr-only|collapse|opacity-0)$/.test(c);
const balanced = (c) => { let d = 0; for (const ch of c) { if (ch === '{') d += 1; if (ch === '}') d -= 1; if (d < 0) return false; } return d === 0; };
export const safeSectionCss = (css) => { const c = sanitizeCss(css).trim().slice(0, 2500); return !c || !balanced(c) || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0(?![.\d])/i.test(c) ? '' : c; };
export function normalizePage(page) {
  if (!page || !Array.isArray(page.sections)) return null;
  const seen = new Set(), sections = [];
  for (const s of page.sections.slice(0, 40)) {
    const ref = textOf(s?.ref, 40);
    if (!/^(hero|[a-z]+:\d+)$/.test(ref)) continue;
    const type = typeOfRef(ref), meta = SECTION_TYPES[type];
    if (!meta) continue;
    let id = textOf(s.id, 24).replace(/[^\w-]/g, '') || ref.replace(':', '-');
    while (seen.has(id)) id += 'x';
    seen.add(id);
    const p = s.props || {};
    const pickp = (k, d) => (SECTION_PROPS[k].includes(p[k]) ? p[k] : d);
    let own = null;
    if (s.adapt === 'own' && s.own && typeof s.own === 'object') {
      const t = normalizeSpec({ tokens: Object.fromEntries(OWN_KEYS.filter((k) => s.own[k] !== undefined).map((k) => [k, s.own[k]])) }, DEFAULT_SPEC).tokens;
      own = Object.fromEntries(OWN_KEYS.map((k) => [k, t[k]]));
    }
    const c = s.content || {};
    sections.push({
      id, ref,
      variant: meta.variant.includes(s.variant) ? s.variant : type === 'hero' ? '' : meta.variant[0],
      props: { bg: pickp('bg', 'auto'), align: pickp('align', 'auto'), spacing: pickp('spacing', 'normal'), head: pickp('head', 'inherit'), cards: pickp('cards', 'inherit'), frame: pickp('frame', 'plain') },
      adapt: own ? 'own' : 'page', own,
      hidden: Boolean(s.hidden), locked: Boolean(s.locked),
      tweaks: normalizeTweaks(s.tweaks).map(({ selector, add, remove }) => ({ selector, add: add.filter(visibleClass), remove })).filter((t) => t.add.length || t.remove.length),
      extra: normalizeSections([{ layout: 'all', index: 1, ...(s.extra || {}) }])[0] || null,
      css: safeSectionCss(s.css),
      ops: normalizeOps(s.ops).map((o) => ({ ...o, layout: 'all' })),
      html: sanitizeSection(s.html),
      content: { title: textOf(c.title, 160), text: textOf(c.text, 400), buttonText: textOf(c.buttonText, 40), buttonHref: SAFE_HREF.test(String(c.buttonHref || '').trim()) ? String(c.buttonHref).trim() : '' },
    });
  }
  const hv = page.header?.variant, fv = page.footer?.variant;
  return { v: 1, sections, header: { variant: HEADER_STYLES.includes(hv) ? hv : '', html: sanitizeChrome(page.header?.html, 'header') }, footer: { variant: FOOTER_STYLES.includes(fv) ? fv : '', html: sanitizeChrome(page.footer?.html, 'footer') } };
}

// Accepts anything (hand edits, AI output) and returns a safe, complete spec.
export function normalizeSpec(input = {}, base = DEFAULT_SPEC) {
  const t = { ...base.tokens, ...(input.tokens || {}) };
  const l = { ...base.layout, ...(input.layout || {}) };
  const tokens = {
    primary: HEX.test(t.primary) ? t.primary : base.tokens.primary,
    primaryDark: HEX.test(t.primaryDark) ? t.primaryDark : base.tokens.primaryDark,
    accent: HEX.test(t.accent) ? t.accent : base.tokens.accent,
    ink: HEX.test(t.ink) ? t.ink : base.tokens.ink,
    soft: HEX.test(t.soft) ? t.soft : base.tokens.soft,
    fontHeading: FONT_CATALOG[t.fontHeading] ? t.fontHeading : base.tokens.fontHeading,
    fontBody: FONT_CATALOG[t.fontBody] ? t.fontBody : base.tokens.fontBody,
    headingCase: pick(t.headingCase, OPTIONS.headingCase, base.tokens.headingCase),
    headingWeight: pick(Number(t.headingWeight), OPTIONS.headingWeight, base.tokens.headingWeight),
    radius: pick(t.radius, OPTIONS.radius, base.tokens.radius),
    shadow: pick(t.shadow, OPTIONS.shadow, base.tokens.shadow),
    density: pick(t.density, OPTIONS.density, base.tokens.density),
    container: pick(t.container, OPTIONS.container, base.tokens.container),
  };
  const layout = {
    header: pick(l.header, OPTIONS.header, base.layout.header),
    topbar: l.topbar === undefined ? base.layout.topbar : Boolean(l.topbar),
    hero: pick(l.hero, OPTIONS.hero, base.layout.hero),
    sections: pick(l.sections, OPTIONS.sections, base.layout.sections),
    cards: pick(l.cards, OPTIONS.cards, base.layout.cards),
    cardLayout: pick(l.cardLayout, OPTIONS.cardLayout, base.layout.cardLayout || 'auto'),
    sectionHead: pick(l.sectionHead, OPTIONS.sectionHead, base.layout.sectionHead || 'left'),
    innerSidebar: pick(l.innerSidebar, OPTIONS.innerSidebar, base.layout.innerSidebar || 'on'),
    footer: pick(l.footer, OPTIONS.footer, base.layout.footer),
    contactLayout: pick(l.contactLayout, OPTIONS.contactLayout, base.layout.contactLayout),
    innerForm: pick(l.innerForm, OPTIONS.innerForm, base.layout.innerForm),
    homeStyle: pick(l.homeStyle, OPTIONS.homeStyle, base.layout.homeStyle),
  };
  return {
    version: Number(input.version) || base.version,
    status: input.status === 'final' ? 'final' : 'draft',
    name: String(input.name || base.name).slice(0, 60),
    brief: String(input.brief ?? base.brief ?? '').slice(0, 2000),
    tokens, layout,
    pages: { home: String(input.pages?.home ?? base.pages.home ?? ''), inner: String(input.pages?.inner ?? base.pages.inner ?? ''), contact: String(input.pages?.contact ?? base.pages.contact ?? '') },
    homeMap: input.homeMap ?? base.homeMap ?? null,
    kit: normalizeKit(input.kit, base.kit),
    extras: normalizeExtras(input.extras, base.extras),
    sections: normalizeSections(input.sections ?? base.sections),
    tweaks: normalizeTweaks(input.tweaks ?? base.tweaks),
    pageLayout: normalizePageLayout(input.pageLayout ?? base.pageLayout),
    ops: normalizeOps(input.ops ?? base.ops),
    htmlEdits: normalizeHtmlEdits(input.htmlEdits ?? base.htmlEdits),
    page: input.page === null ? null : normalizePage(input.page ?? base.page),
    archetype: String(input.archetype ?? base.archetype ?? '').replace(/[^a-z-]/g, '').slice(0, 40),
    customCss: sanitizeCss(input.customCss ?? base.customCss ?? ''),
    theme: input.theme === null ? null : (input.theme ?? base.theme) ? compactTheme(buildTheme(input.theme ?? base.theme)) : null,
  };
}

// Custom CSS is shown in the preview before it is accepted, but it is still restricted: no imports, no remote
// resources, no scripting hooks, bounded size.
export function sanitizeCss(css) {
  return String(css || '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*['"]?\s*(?:https?:|\/\/|javascript:|data:text)[^)]*\)/gi, 'none')
    .replace(/expression\s*\(|javascript:|behavior\s*:|-moz-binding/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .slice(0, 8000);
}

const stack = (family) => {
  const f = FONT_CATALOG[family];
  return `"${family}", ${f.kind === 'serif' ? 'Georgia, "Times New Roman", serif' : 'system-ui, -apple-system, "Segoe UI", sans-serif'}`;
};

// Font files this spec needs (heading + body), deduplicated.
export function fontsUsed(spec) {
  const out = new Map();
  for (const [family, weights] of [[spec.tokens.fontHeading, [spec.tokens.headingWeight]], [spec.tokens.fontBody, [400, 600, 700]]]) {
    const c = FONT_CATALOG[family];
    for (const w of weights) {
      const avail = Object.keys(c.weights).map(Number).sort((a, b) => a - b);
      const use = avail.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), avail[0]);
      out.set(`${family}|${w}`, { family, weight: w, file: c.weights[use] });
    }
  }
  for (const s of spec.page?.sections || []) {
    if (!s.own) continue;
    for (const [family, weights] of [[s.own.fontHeading, [s.own.headingWeight || 400]], [s.own.fontBody, [400, 600, 700]]]) {
      const c = FONT_CATALOG[family];
      if (!c) continue;
      for (const w of weights) {
        const avail = Object.keys(c.weights).map(Number).sort((a, b) => a - b);
        const use = avail.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), avail[0]);
        out.set(`${family}|${w}`, { family, weight: w, file: c.weights[use] });
      }
    }
  }
  return [...out.values()];
}

// The theme of a spec as the engine builds it: the selected theme, or one made from the five tokens (so the semantic variables always exist).
const themeMemo = new Map();
export function themeOf(spec) {
  const t = spec.tokens;
  const input = spec.theme || { base: { primary: t.primary, secondary: t.primaryDark, accent: t.accent, neutral: t.ink }, mode: 'light' };
  const key = JSON.stringify(input);
  if (!themeMemo.has(key)) { if (themeMemo.size > 50) themeMemo.clear(); themeMemo.set(key, buildTheme(input)); }
  return themeMemo.get(key);
}

// the older variables the sections read, from five colours; dark: the soft colour is a dark background, so text colours are lightened, not darkened
function brandVars(c, dark = false) {
  return {
    '--brand-primary': c.primary, '--brand-primary-dark': c.primaryDark, '--brand-accent': c.accent, '--brand-ink': c.ink, '--brand-soft': c.soft,
    '--brand-primary-text': dark ? nearestReadable(c.primary, c.soft, 4.8) : ensureContrast(c.primary, c.soft, 4.8),
    '--brand-accent-text': dark ? nearestReadable(c.accent, c.soft, 4.8) : ensureContrast(c.accent, c.soft, 4.8),
    '--brand-on-accent': dark ? readableOn(c.accent, { dark: c.soft }).text : onColor(c.accent, c.ink),
    '--brand-accent-light': ensureContrastOnDark(c.accent, [c.primaryDark, c.ink]),
  };
}

// Every theme variable for a spec as a map. specCss writes them on :root; a section that keeps its own look carries them inline.
export function themeVars(spec) {
  const t = spec.tokens;
  const theme = themeOf(spec);
  const mode = theme.mode === 'dark' ? 'dark' : 'light';
  // with a selected theme the five colours come from it; without one they are the tokens
  const eff = spec.theme ? legacyTokens(theme, mode) : { primary: t.primary, primaryDark: t.primaryDark, accent: t.accent, ink: t.ink, soft: t.soft };
  const [radCard, radBtn] = RADIUS[t.radius];
  const [secY, secYLg] = DENSITY[t.density];
  const cards = {
    shadow: ['var(--th-surface-card)', '1px solid var(--th-border-light)', SHADOW[t.shadow === 'none' ? 'soft' : t.shadow]],
    outline: ['var(--th-surface-card)', `2px solid ${eff.primary}`, 'none'],
    flat: [eff.soft, '1px solid transparent', 'none'],
  }[spec.layout.cards];
  return {
    ...brandVars(eff, mode === 'dark'), ...cssVars(theme, mode),
    '--brand-font-heading': stack(t.fontHeading), '--brand-font-body': stack(t.fontBody),
    '--tpl-radius-card': radCard, '--tpl-radius-btn': radBtn, '--tpl-shadow-card': SHADOW[t.shadow],
    '--tpl-sec-y': secY, '--tpl-sec-y-lg': secYLg, '--tpl-container': CONTAINER[t.container],
    '--tpl-heading-case': t.headingCase, '--tpl-heading-tracking': t.headingCase === 'uppercase' ? '.025em' : '0', '--tpl-heading-weight': String(t.headingWeight),
    '--tpl-card-bg': cards[0], '--tpl-card-border': cards[1], '--tpl-card-shadow': cards[2],
  };
}

// the dark half of a theme whose mode follows the visitor's setting: the same variables, worked out for the dark mode
function autoDarkCss(spec) {
  if (spec.theme?.mode !== 'auto') return '';
  const theme = themeOf(spec);
  const vars = { ...brandVars(legacyTokens(theme, 'dark'), true), ...cssVars(theme, 'dark') };
  return `@media (prefers-color-scheme: dark) {\n  :root {\n  ${Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join('\n  ')}\n  }\n}`;
}

// The CSS variables, font faces and custom CSS for a spec (compiled together with the shared stylesheet).
export function specCss(spec, fontUrlPrefix = '../fonts/') {
  const vars = Object.entries(themeVars(spec)).map(([k, v]) => `${k}: ${v};`).join('\n  ');
  const faces = fontsUsed(spec).map((f) => `@font-face { font-family: "${f.family}"; font-weight: ${f.weight}; font-style: normal; src: url(${fontUrlPrefix}${f.file}) format("woff2"); font-display: swap; }`).join('\n');
  return `@layer theme { :root {
  ${vars}
} }
${autoDarkCss(spec)}
@layer base {
${faces}
}
${extrasCss(spec)}
${SECTION_CSS}
${pageCss(spec)}
${spec.customCss ? `\n/* custom overrides */\n${spec.customCss}\n` : ''}`;
}

// Last-resort CSS for one composed section, nested under that section so it cannot leak ("&" is the section).
function pageCss(spec) {
  return (spec.page?.sections || []).filter((s) => s.css).map((s) => `[data-sec="${s.id}"] { ${s.css} }`).join('\n');
}

function extrasCss(spec) {
  const f = spec.extras.floating;
  if (!f.items.length) return '';
  const s = f.side === 'left' ? 'left' : 'right';
  return `.fab { position: fixed; ${s}: 0; top: 45%; z-index: 35; display: flex; flex-direction: column; gap: .5rem }
.fab a { display: block; padding: .7rem .6rem; background: var(--brand-accent); color: var(--brand-on-accent); font-weight: 700; font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; text-decoration: none; writing-mode: vertical-rl; text-orientation: mixed; box-shadow: 0 4px 14px rgb(0 0 0 / .18); ${s === 'right' ? 'border-radius: .5rem 0 0 .5rem; transform: rotate(180deg)' : 'border-radius: 0 .5rem .5rem 0'} }
.fab a:hover, .fab a:focus-visible { background: var(--brand-primary-dark); color: #fff }
@media (max-width: 640px) { .fab a { padding: .55rem .45rem; font-size: .72rem } }`;
}

export function preloadFonts(spec) {
  const t = spec.tokens;
  const files = fontsUsed(spec).filter((f) => (f.family === t.fontHeading && f.weight === t.headingWeight) || (f.family === t.fontBody && [400, 600, 700].includes(f.weight)));
  return [...new Set(files.map((f) => f.file))];
}
