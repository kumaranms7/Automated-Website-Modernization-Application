import crypto from 'node:crypto';
import { designById } from './designs.js';
import { DEFAULT_SPEC } from '../template/spec.js';

// A design is not the same for every website. The six designs are directions; a website's own design is derived from them:
//   1. what the user set in Configuration > Design settings (a setting that differs from the platform default is the user's decision:
//      the header, hero and footer styles, the top bar, corner roundness, shadows, spacing, width, heading case and weight, fonts);
//   2. a stable seed from the website itself (its name and business type), which picks, for some sections, another layout of the same
//      kind, so two websites on the same direction do not end up with the same page;
//   3. the sections the user swapped, added, removed or moved for a kind of page (spec.kit.sections), which win over everything.

const HEADER_OF = { classic: 'clean', centered: 'center', minimal: 'pill' };
const HERO_OF = { photo: 'photo', split: 'split', centered: 'aurora', light: 'minimal', dark: 'spotlight', editorial: 'editorial' };
const FOOTER_OF = { dark: 'dark', light: 'light', brand: 'dark' };
const RADIUS = { none: ['0rem', '.25rem', '.25rem'], sm: ['.5rem', '.4rem', '.4rem'], md: ['1rem', '.75rem', '.75rem'], lg: ['1.5rem', '1rem', '1rem'], xl: ['2rem', '1.25rem', '999px'] };
const SHADOW = {
  none: ['none', 'none', 'none', 'none'],
  soft: ['0 1px 2px rgb(15 23 42 / .05), 0 2px 6px rgb(15 23 42 / .04)', '0 1px 2px rgb(15 23 42 / .04), 0 8px 24px -6px rgb(15 23 42 / .10), 0 24px 48px -24px rgb(15 23 42 / .12)', '0 2px 4px rgb(15 23 42 / .04), 0 16px 40px -8px rgb(15 23 42 / .16), 0 40px 80px -32px rgb(15 23 42 / .22)', '0 10px 30px -8px color-mix(in srgb, var(--th-brand-primary) 55%, transparent)'],
  medium: ['0 2px 4px rgb(15 23 42 / .08), 0 4px 12px rgb(15 23 42 / .08)', '0 4px 8px rgb(15 23 42 / .08), 0 14px 32px -6px rgb(15 23 42 / .18)', '0 6px 12px rgb(15 23 42 / .10), 0 28px 60px -10px rgb(15 23 42 / .32)', '0 14px 36px -6px color-mix(in srgb, var(--th-brand-primary) 70%, transparent)'],
};
const DENSITY = { compact: 'clamp(2.5rem, 5vw, 4.5rem)', comfortable: 'clamp(3.5rem, 7.5vw, 7rem)', spacious: 'clamp(4.5rem, 10vw, 9rem)' };
const WIDTH = { narrow: '64rem', normal: '76rem', wide: '88rem' };

// layouts of the same kind a section can swap between when the seed says so
const SIBLINGS = {
  services: ['bento', 'icon-cards', 'image-cards', 'sticky'], reviews: ['grid', 'featured', 'masonry', 'marquee'], faq: ['accordion', 'sticky', 'grid'],
  features: ['icon-grid', 'cards', 'numbers'], areas: ['pills', 'columns', 'map'], steps: ['cards', 'timeline', 'horizontal'], stats: ['cards', 'line', 'dark', 'brand'],
  cta: ['gradient', 'center', 'banner', 'split'], trust: ['strip', 'pills', 'marquee'], about: ['image-right', 'image-left', 'story'],
};

export const seedOf = (text) => parseInt(crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 8), 16);
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const changed = (spec, group, key) => spec?.[group]?.[key] !== undefined && spec[group][key] !== DEFAULT_SPEC[group][key];

export function tailor(designId, { spec = null, seedKey = '' } = {}) {
  const base = designById(designId);
  const d = JSON.parse(JSON.stringify(base));
  d.vars = { ...(d.vars || {}) };
  const l = spec?.layout || {}, t = spec?.tokens || {};

  // 1. the configuration
  if (changed(spec, 'layout', 'header') && HEADER_OF[l.header]) d.header = HEADER_OF[l.header];
  if (changed(spec, 'layout', 'footer') && FOOTER_OF[l.footer]) d.footer = FOOTER_OF[l.footer];
  if (changed(spec, 'layout', 'topbar')) d.topbar = Boolean(l.topbar);
  if (changed(spec, 'layout', 'hero') && HERO_OF[l.hero] && d.home[0]?.type === 'hero') d.home[0] = { type: 'hero', variant: HERO_OF[l.hero] };
  if (changed(spec, 'tokens', 'radius') && RADIUS[t.radius]) { const [r, rs, rb] = RADIUS[t.radius]; d.vars['--k-r'] = r; d.vars['--k-r-sm'] = rs; d.vars['--k-r-btn'] = rb; }
  const cardsFlat = changed(spec, 'layout', 'cards') && l.cards !== 'shadow';
  const shadow = changed(spec, 'tokens', 'shadow') ? t.shadow : cardsFlat ? 'none' : '';
  if (shadow && SHADOW[shadow]) { const [a, b, c, g] = SHADOW[shadow]; Object.assign(d.vars, { '--k-shadow-1': a, '--k-shadow-2': b, '--k-shadow-3': c, '--k-glow': g }); }
  if (changed(spec, 'tokens', 'density') && DENSITY[t.density]) d.vars['--k-sec-y'] = DENSITY[t.density];
  if (changed(spec, 'tokens', 'container') && WIDTH[t.container]) d.vars['--k-wrap'] = WIDTH[t.container];
  if (changed(spec, 'tokens', 'headingCase')) d.vars['--k-h-case'] = t.headingCase === 'uppercase' ? 'uppercase' : t.headingCase === 'capitalize' ? 'capitalize' : 'none';
  if (changed(spec, 'tokens', 'headingWeight')) d.vars['--k-h-weight'] = String(t.headingWeight);
  if (changed(spec, 'tokens', 'fontHeading')) d.fonts = { ...d.fonts, heading: t.fontHeading };
  if (changed(spec, 'tokens', 'fontBody')) d.fonts = { ...d.fonts, body: t.fontBody };

  // 2. the website's own seed: some sections take another layout of the same kind
  const rand = rng(seedOf(`${seedKey}|${designId}`));
  const used = {};
  for (const kind of ['home', 'inner', 'contact']) {
    d[kind] = d[kind].map((b) => {
      const sib = SIBLINGS[b.type];
      if (!sib || b.type === 'hero' || rand() > 0.38) return b;
      const options = sib.filter((v) => v !== b.variant && !(used[b.type] || []).includes(v));
      if (!options.length) return b;
      const v = options[Math.floor(rand() * options.length)];
      (used[b.type] ||= []).push(v);
      return { ...b, variant: v };
    });
  }

  // 3. the sections the user chose for a kind of page
  for (const kind of ['home', 'inner', 'contact']) {
    const mine = spec?.kit?.sections?.[kind];
    if (Array.isArray(mine) && mine.length) d[kind] = mine.map((b) => ({ ...b }));
  }

  // 4. the header, footer and top bar chosen for the whole theme
  const ch = spec?.kit?.chrome || {};
  if (ch.header?.variant) d.header = ch.header.variant;
  if (ch.footer?.variant) d.footer = ch.footer.variant;
  if (ch.topbar?.show) d.topbar = ch.topbar.show === 'yes';
  d.chrome = { header: ch.header || {}, footer: ch.footer || {}, topbar: ch.topbar || {} };
  return d;
}
