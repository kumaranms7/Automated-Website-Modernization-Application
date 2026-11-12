// The parts of a section a person can style, like the elements of a page builder: its small label, headings, text, cards or pills or tiles,
// their icons, its buttons and pictures. A section's markup is shared by every layout, so the parts are found by the classes the kit gives
// them and marked with data-p. What was chosen for a part is written on the part itself as a few CSS variables and the Tailwind classes that
// read them, so a choice is for that one section only and the theme colours stay live (a theme colour is a variable of the theme).

// buttons come in several designs (filled, outline, white, ...) and icons as boxes or ticks: each design is a part of its own, so two buttons
// that look different can be styled apart, and every button that looks the same is styled once
export const BASE = { buttonPrimary: 'button', buttonAccent: 'button', buttonGhost: 'button', buttonLight: 'button', buttonOutline: 'button', tick: 'icon' };
import { MOTION_TABLES, motionFields, motionOf } from './motion.js';
import { DESC, DESC_CLASS } from './desc-classes.js';

export const PARTS = ['section', 'head', 'content', 'paragraph', 'contentHeading', 'contentLink', 'contentBold', 'contentList', 'contentQuote', 'eyebrow', 'heading', 'text', 'item', 'itemTitle', 'icon', 'tick', 'button', 'buttonPrimary', 'buttonAccent', 'buttonGhost', 'buttonLight', 'buttonOutline', 'image', 'bar', 'brand', 'navLink', 'phone', 'footHeading', 'footLink', 'footText', 'footLegal'];
const baseOf = (part) => BASE[part] || part;

// ---------- the colours of the theme (and white, black, none) ----------
export const THEME_COLORS = [
  ['primary', 'Primary', 'var(--th-brand-primary)'], ['primary-dark', 'Primary dark', 'var(--th-primary-700)'], ['primary-light', 'Primary light', 'var(--th-primary-100)'],
  ['secondary', 'Secondary', 'var(--th-brand-secondary)'], ['accent', 'Accent', 'var(--th-brand-accent)'], ['accent-light', 'Accent light', 'var(--th-accent-100)'],
  ['dark', 'Dark', 'var(--th-bg-dark)'], ['heading', 'Heading text', 'var(--th-text-heading)'], ['text', 'Body text', 'var(--th-text-primary)'], ['muted', 'Muted text', 'var(--th-text-muted)'],
  ['light', 'Page', 'var(--th-bg)'], ['soft', 'Soft background', 'var(--th-bg-alt)'], ['card', 'Card', 'var(--th-surface-card)'], ['border', 'Border', 'var(--th-border-default)'],
  ['white', 'White', '#ffffff'], ['black', 'Black', '#000000'], ['transparent', 'None', 'transparent'],
];
const THEME = new Map(THEME_COLORS.map(([k, , css]) => [k, css]));
const HEX = /^#[0-9a-f]{3,8}$/i;
// "theme:accent" or "#e47229" → the CSS colour; anything else is dropped
export const cssColor = (v) => {
  const s = String(v ?? '').trim();
  if (HEX.test(s)) return s;
  const m = /^theme:([a-z-]+)$/.exec(s);
  return m && THEME.has(m[1]) ? THEME.get(m[1]) : '';
};

// ---------- the shapes, sizes and so on that can be chosen ----------
const SHADOWS = { none: 'none', sm: '0 1px 3px rgb(0 0 0 / .12)', md: '0 10px 24px -10px rgb(0 0 0 / .25)', lg: '0 28px 50px -18px rgb(0 0 0 / .35)', glow: '0 12px 30px -8px color-mix(in srgb, var(--th-brand-primary) 55%, transparent)' };
const SIZES = { xs: '.75rem', sm: '.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': 'clamp(1.25rem, 1rem + 1vw, 1.5rem)', '3xl': 'clamp(1.5rem, 1.1rem + 1.6vw, 1.875rem)', '4xl': 'clamp(1.8rem, 1.2rem + 2.2vw, 2.5rem)', '5xl': 'clamp(2.1rem, 1.3rem + 3vw, 3.25rem)', '6xl': 'clamp(2.5rem, 1.4rem + 4vw, 4.5rem)' };
const TRACKING = { tighter: '-.05em', tight: '-.025em', normal: '0', wide: '.05em', wider: '.1em', widest: '.18em' };
const LEADING = { none: '1', tight: '1.15', snug: '1.3', normal: '1.5', relaxed: '1.7', loose: '2' };
const RADII = { '0': '0', sm: '.5rem', md: '1rem', lg: '1.5rem', full: '999px' };
const BORDER_WIDTHS = { '0': '0px', '1': '1px', '2': '2px', '3': '3px', '4': '4px' };
const WEIGHTS = { '400': '400', '500': '500', '600': '600', '700': '700', '800': '800', '900': '900' };
const ALIGN = { left: 'left', center: 'center', right: 'right' };
const TRANSFORM = { none: 'none', uppercase: 'uppercase', capitalize: 'capitalize', lowercase: 'lowercase' };

const opt = (map, labels) => Object.keys(map).map((k) => [k, labels?.[k] || k]);
// property → [css variable, value table (or null for colours)]
const PAD = { none: '0', xs: '1.5rem', sm: '3rem', md: 'clamp(3rem, 6vw, 5rem)', lg: 'clamp(4rem, 8vw, 7rem)', xl: 'clamp(5rem, 10vw, 9rem)' };
const WIDTHS = { '25': '25%', '33': '33.333%', '50': '50%', '66': '66.666%', '75': '75%', '100': '100%', fit: 'fit-content', auto: 'auto' };
const MAX_WIDTHS = { '20': '20rem', '28': '28rem', '36': '36rem', '48': '48rem', '64': '64rem', '80': '80rem', full: '100%', none: 'none' };
const CONTENT_W = { narrow: '720px', medium: '960px', wide: '1400px', xwide: '1800px', full: '2600px' };
const GAPS = { none: '0', xs: '.5rem', sm: '.9rem', md: '1.4rem', lg: '2rem', xl: '3rem' };
const UNDERLINE = { none: 'none', always: 'underline' };
const TEXT_MODE = { auto: 'auto', light: 'light', dark: 'dark' };
const PROPS = {
  bg: ['--k-bg', 'color'], color: ['--k-fg', 'color'], border: ['--k-bd', 'color'],
  borderWidth: ['--k-bw', BORDER_WIDTHS], radius: ['--k-rd', RADII], shadow: ['--k-sh', SHADOWS],
  padTop: ['--k-pt', PAD], padBottom: ['--k-pb', PAD], textMode: [null, TEXT_MODE], contentWidth: [null, CONTENT_W], position: [null, ALIGN], gap: [null, GAPS], underline: [null, UNDERLINE],
  width: ['--k-w', WIDTHS], maxWidth: ['--k-mw', MAX_WIDTHS],
  align: ['--k-ta', ALIGN], transform: ['--k-tt', TRANSFORM], size: ['--k-fs', SIZES], weight: ['--k-fw', WEIGHTS], tracking: ['--k-ls', TRACKING], leading: ['--k-lh', LEADING],
};
// the Tailwind classes that read the variables (written out in full: the stylesheet is built from what is written in the source and in the pages)
const CLASS = {
  bg: '[background-color:var(--k-bg)]!', bi: '[background-image:var(--k-bi)]!', color: '[color:var(--k-fg)]!', border: '[border-color:var(--k-bd)]!',
  borderWidth: '[border-width:var(--k-bw)]!', radius: '[border-radius:var(--k-rd)]!', shadow: '[box-shadow:var(--k-sh)]!', align: '[text-align:var(--k-ta)]!',
  transform: '[text-transform:var(--k-tt)]!', size: '[font-size:var(--k-fs)]!', weight: '[font-weight:var(--k-fw)]!', tracking: '[letter-spacing:var(--k-ls)]!', leading: '[line-height:var(--k-lh)]!',
  width: '[width:var(--k-w)]!', maxWidth: '[max-width:var(--k-mw)]!', ml: '[margin-left:var(--k-ml)]!', mr: '[margin-right:var(--k-mr)]!',
  svg: '[&_svg]:[color:var(--k-ic)]!', hide: '[display:none]!', padTop: '[padding-top:var(--k-pt)]!', padBottom: '[padding-bottom:var(--k-pb)]!',
};

// what the panel offers for each part: [property, label, kind, options]
const C = 'color';
const HIDE = ['hide', 'Remove this element', 'toggle'];
export const PART_FIELDS = {
  eyebrow: [['preset', 'Style', 'preset'], ['bg', 'Background', C], ['color', 'Text', C], ['border', 'Border', C], ['radius', 'Corners', 'select', opt(RADII, { '0': 'Square', sm: 'Small', md: 'Medium', lg: 'Large', full: 'Round' })], ['transform', 'Text case', 'select', opt(TRANSFORM, { none: 'As written', uppercase: 'UPPERCASE', capitalize: 'Capitalize', lowercase: 'lowercase' })], ['size', 'Size', 'select', opt(SIZES)], ['weight', 'Weight', 'select', opt(WEIGHTS)], ['tracking', 'Letter spacing', 'select', opt(TRACKING)]],
  heading: [['color', 'Text colour', C], ['align', 'Alignment', 'align'], ['transform', 'Text case', 'select', opt(TRANSFORM, { none: 'As written', uppercase: 'UPPERCASE', capitalize: 'Capitalize', lowercase: 'lowercase' })], ['size', 'Size', 'select', opt(SIZES)], ['weight', 'Weight', 'select', opt(WEIGHTS)], ['tracking', 'Letter spacing', 'select', opt(TRACKING)], ['leading', 'Line height', 'select', opt(LEADING)]],
  text: [['color', 'Text colour', C], ['align', 'Alignment', 'align'], ['transform', 'Text case', 'select', opt(TRANSFORM, { none: 'As written', uppercase: 'UPPERCASE', capitalize: 'Capitalize', lowercase: 'lowercase' })], ['size', 'Size', 'select', opt(SIZES)], ['weight', 'Weight', 'select', opt(WEIGHTS)], ['tracking', 'Letter spacing', 'select', opt(TRACKING)], ['leading', 'Line height', 'select', opt(LEADING)]],
  item: [['preset', 'Style', 'preset'], ['bg', 'Background', C], ['color', 'Text', C], ['border', 'Border', C], ['borderWidth', 'Border width', 'select', opt(BORDER_WIDTHS)], ['radius', 'Corners', 'select', opt(RADII, { '0': 'Square', sm: 'Small', md: 'Medium', lg: 'Large', full: 'Round' })], ['shadow', 'Shadow', 'select', opt(SHADOWS, { none: 'None', sm: 'Small', md: 'Medium', lg: 'Large', glow: 'Glow' })], ['align', 'Text alignment', 'align']],
  itemTitle: [['color', 'Text colour', C], ['align', 'Alignment', 'align'], ['transform', 'Text case', 'select', opt(TRANSFORM, { none: 'As written', uppercase: 'UPPERCASE', capitalize: 'Capitalize', lowercase: 'lowercase' })], ['size', 'Size', 'select', opt(SIZES)], ['weight', 'Weight', 'select', opt(WEIGHTS)], ['tracking', 'Letter spacing', 'select', opt(TRACKING)]],
  icon: [['preset', 'Style', 'preset'], ['bg', 'Background', C], ['color', 'Icon colour', C], ['radius', 'Corners', 'select', opt(RADII, { '0': 'Square', sm: 'Small', md: 'Medium', lg: 'Large', full: 'Round' })]],
  button: [['preset', 'Style', 'preset'], ['bg', 'Background', C], ['color', 'Text', C], ['border', 'Border', C], ['borderWidth', 'Border width', 'select', opt(BORDER_WIDTHS)], ['radius', 'Corners', 'select', opt(RADII, { '0': 'Square', sm: 'Small', md: 'Medium', lg: 'Large', full: 'Round' })], ['shadow', 'Shadow', 'select', opt(SHADOWS, { none: 'None', sm: 'Small', md: 'Medium', lg: 'Large', glow: 'Glow' })], ['transform', 'Text case', 'select', opt(TRANSFORM, { none: 'As written', uppercase: 'UPPERCASE', capitalize: 'Capitalize', lowercase: 'lowercase' })], ['size', 'Size', 'select', opt(SIZES)], ['weight', 'Weight', 'select', opt(WEIGHTS)], ['tracking', 'Letter spacing', 'select', opt(TRACKING)]],
  image: [['border', 'Border', C], ['borderWidth', 'Border width', 'select', opt(BORDER_WIDTHS)], ['radius', 'Corners', 'select', opt(RADII, { '0': 'Square', sm: 'Small', md: 'Medium', lg: 'Large', full: 'Round' })], ['shadow', 'Shadow', 'select', opt(SHADOWS, { none: 'None', sm: 'Small', md: 'Medium', lg: 'Large', glow: 'Glow' })]],
};
const SIZE_FIELDS = [['width', 'Width', 'select', opt(WIDTHS, { '25': '25%', '33': '33%', '50': '50%', '66': '66%', '75': '75%', '100': 'Full width', fit: 'Fit the content', auto: 'Automatic' })], ['maxWidth', 'Max width', 'select', opt(MAX_WIDTHS, { '20': 'Extra small', '28': 'Small', '36': 'Medium', '48': 'Large', '64': 'Extra large', '80': 'Huge', full: 'Full width', none: 'No limit' })], ['position', 'Position', 'align']];
const SIZED = ['head', 'content', 'eyebrow', 'heading', 'text', 'item', 'itemTitle', 'image', 'button', 'buttonPrimary', 'buttonAccent', 'buttonGhost', 'buttonLight', 'buttonOutline'];
const PADS = { none: 'None', xs: 'Extra small', sm: 'Small', md: 'Medium', lg: 'Large', xl: 'Extra large' };
const TXT = (extra = []) => [['color', 'Text colour', C], ...extra, ['transform', 'Text case', 'select', opt(TRANSFORM, { none: 'As written', uppercase: 'UPPERCASE', capitalize: 'Capitalize', lowercase: 'lowercase' })], ['size', 'Size', 'select', opt(SIZES)], ['weight', 'Weight', 'select', opt(WEIGHTS)], ['tracking', 'Letter spacing', 'select', opt(TRACKING)]];
const RD = ['radius', 'Corners', 'select', opt(RADII, { '0': 'Square', sm: 'Small', md: 'Medium', lg: 'Large', full: 'Round' })];
const SH = ['shadow', 'Shadow', 'select', opt(SHADOWS, { none: 'None', sm: 'Small', md: 'Medium', lg: 'Large', glow: 'Glow' })];
PART_FIELDS.brand = TXT();
PART_FIELDS.navLink = TXT([['bg', 'Background', C]]).concat([RD]);
PART_FIELDS.phone = TXT();
PART_FIELDS.bar = [['bg', 'Background', C], ['border', 'Border', C], ['borderWidth', 'Border width', 'select', opt(BORDER_WIDTHS)], RD, SH];
PART_FIELDS.footHeading = TXT().concat([['align', 'Alignment', 'align']]);
PART_FIELDS.footLink = TXT();
PART_FIELDS.footText = [['color', 'Text colour', C], ['align', 'Alignment', 'align'], ['size', 'Size', 'select', opt(SIZES)], ['leading', 'Line height', 'select', opt(LEADING)]];
PART_FIELDS.footLegal = [['color', 'Text colour', C], ['border', 'Line colour', C], ['align', 'Alignment', 'align'], ['size', 'Size', 'select', opt(SIZES)]];
// the text of the page: the block that holds it, and what is inside it
PART_FIELDS.content = [['color', 'Text colour', C], ['align', 'Alignment', 'align'], ['size', 'Size', 'select', opt(SIZES)], ['leading', 'Line height', 'select', opt(LEADING)], ['tracking', 'Letter spacing', 'select', opt(TRACKING)]];
PART_FIELDS.paragraph = [['color', 'Text colour', C], ['size', 'Size', 'select', opt(SIZES)], ['weight', 'Weight', 'select', opt(WEIGHTS)], ['leading', 'Line height', 'select', opt(LEADING)], ['tracking', 'Letter spacing', 'select', opt(TRACKING)], ['align', 'Alignment', 'align'], ['transform', 'Text case', 'select', opt(TRANSFORM, { none: 'As written', uppercase: 'UPPERCASE', capitalize: 'Capitalize', lowercase: 'lowercase' })], ['gap', 'Space between paragraphs', 'select', opt(GAPS, { none: 'None', xs: 'Extra small', sm: 'Small', md: 'Medium', lg: 'Large', xl: 'Extra large' })]];
PART_FIELDS.contentHeading = TXT().concat([['align', 'Alignment', 'align']]);
PART_FIELDS.contentLink = [['color', 'Text colour', C], ['weight', 'Weight', 'select', opt(WEIGHTS)], ['underline', 'Underline', 'select', opt(UNDERLINE, { none: 'No underline', always: 'Underlined' })]];
PART_FIELDS.contentBold = [['color', 'Text colour', C], ['weight', 'Weight', 'select', opt(WEIGHTS)]];
PART_FIELDS.contentList = [['color', 'Text colour', C], ['size', 'Size', 'select', opt(SIZES)], ['gap', 'Space between items', 'select', opt(GAPS, { none: 'None', xs: 'Extra small', sm: 'Small', md: 'Medium', lg: 'Large', xl: 'Extra large' })]];
PART_FIELDS.contentQuote = [['bg', 'Background', C], ['color', 'Text colour', C], ['border', 'Line colour', C]];
PART_FIELDS.head = [['align', 'Text alignment', 'align']];
PART_FIELDS.section = [['preset', 'Background style', 'preset'], ['bg', 'Background colour', C], ['textMode', 'Text on it', 'select', opt(TEXT_MODE, { auto: 'Automatic', light: 'Light text', dark: 'Dark text' })], ['contentWidth', 'Content width', 'select', opt(CONTENT_W, { narrow: 'Narrow', medium: 'Medium', wide: 'Wide', xwide: 'Extra wide', full: 'Full width' })], ['padTop', 'Space above', 'select', opt(PAD, PADS)], ['padBottom', 'Space below', 'select', opt(PAD, PADS)]];
for (const part of Object.keys(PART_FIELDS)) {
  if (DESC[part]) continue;
  if (SIZED.includes(part)) PART_FIELDS[part].push(...SIZE_FIELDS);
  PART_FIELDS[part].push(...(part === 'section' ? motionFields(['entrance', 'speed', 'delay', 'easing', 'replay']) : motionFields(['entrance', 'hover', 'loop', 'speed', 'delay', 'easing', 'stagger', 'replay'])));
  if (part !== 'section' && part !== 'brand' && part !== 'bar') PART_FIELDS[part].push(HIDE);
}
for (const v of Object.keys(BASE)) PART_FIELDS[v] = PART_FIELDS[BASE[v]];
PART_FIELDS.button = PART_FIELDS.button || PART_FIELDS.buttonPrimary;


// ---------- designs for a part, all from the theme ----------
// values are CSS: bg colour, bi (background image), color, border, bw (border width), rd (corners), sh (shadow)
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const P = 'var(--th-brand-primary)', A = 'var(--th-brand-accent)', D = 'var(--th-bg-dark)';
export const PRESETS = {
  button: {
    solid: { label: 'Solid', bg: 'var(--th-btn-primary)', color: 'var(--th-btn-primary-text)', border: 'transparent', bw: '1.5px' },
    outline: { label: 'Outline', bg: 'transparent', color: P, border: P, bw: '1.5px' },
    soft: { label: 'Soft', bg: mix(P, 12), color: P, border: 'transparent', bw: '1.5px' },
    accent: { label: 'Accent', bg: A, color: '#ffffff', border: 'transparent', bw: '1.5px' },
    dark: { label: 'Dark', bg: D, color: '#ffffff', border: 'transparent', bw: '1.5px' },
    light: { label: 'Light', bg: '#ffffff', color: '#0f172a', border: 'transparent', bw: '1.5px', sh: SHADOWS.md },
    gradient: { label: 'Gradient', bg: 'transparent', bi: `linear-gradient(135deg, ${P}, ${A})`, color: '#ffffff', border: 'transparent', bw: '1.5px', sh: SHADOWS.glow },
    underline: { label: 'Text link', bg: 'transparent', color: P, border: 'transparent', bw: '1.5px' },
  },
  item: {
    elevated: { label: 'Elevated', bg: 'var(--th-surface-card)', border: 'var(--th-border-light)', bw: '1px', sh: SHADOWS.md },
    flat: { label: 'Flat', bg: 'var(--th-surface-card)', border: 'var(--th-border-default)', bw: '1px', sh: 'none' },
    tint: { label: 'Tint', bg: mix(P, 8), border: 'transparent', bw: '1px', sh: 'none' },
    solid: { label: 'Solid', bg: P, color: '#ffffff', border: 'transparent', bw: '1px', sh: 'none' },
    dark: { label: 'Dark', bg: D, color: '#ffffff', border: 'transparent', bw: '1px', sh: 'none' },
    outline: { label: 'Outline', bg: 'transparent', border: P, bw: '2px', sh: 'none' },
    glass: { label: 'Glass', bg: 'rgb(255 255 255 / .55)', border: 'rgb(255 255 255 / .7)', bw: '1px', sh: SHADOWS.lg },
  },
  icon: {
    soft: { label: 'Soft', bg: mix(P, 10), color: P, border: 'transparent', bw: '0px' },
    solid: { label: 'Solid', bg: P, color: '#ffffff', border: 'transparent', bw: '0px' },
    accent: { label: 'Accent', bg: A, color: '#ffffff', border: 'transparent', bw: '0px' },
    outline: { label: 'Outline', bg: 'transparent', color: P, border: P, bw: '2px' },
    gradient: { label: 'Gradient', bg: 'transparent', bi: `linear-gradient(135deg, ${P}, ${A})`, color: '#ffffff', border: 'transparent', bw: '0px' },
    dark: { label: 'Dark', bg: D, color: '#ffffff', border: 'transparent', bw: '0px' },
    plain: { label: 'Plain', bg: 'transparent', color: P, border: 'transparent', bw: '0px' },
  },
  eyebrow: {
    soft: { label: 'Soft', bg: mix(P, 10), color: P, border: mix(P, 20), bw: '1px' },
    solid: { label: 'Solid', bg: P, color: '#ffffff', border: 'transparent', bw: '1px' },
    accent: { label: 'Accent', bg: A, color: '#ffffff', border: 'transparent', bw: '1px' },
    outline: { label: 'Outline', bg: 'transparent', color: P, border: P, bw: '1px' },
    plain: { label: 'Plain text', bg: 'transparent', color: P, border: 'transparent', bw: '1px' },
  },
};

const PL = 'color-mix(in srgb, var(--th-brand-primary) 8%, var(--th-bg))';
PRESETS.section = {
  plain: { label: 'Page', bg: 'var(--th-bg)', mode: 'dark' },
  soft: { label: 'Soft', bg: 'var(--th-bg-alt)', mode: 'dark' },
  tint: { label: 'Tint', bg: PL, mode: 'dark' },
  dark: { label: 'Dark', bg: D, mode: 'light' },
  brand: { label: 'Brand', bg: P, mode: 'light' },
  gradient: { label: 'Gradient', bi: `linear-gradient(135deg, ${P}, ${A})`, bg: 'transparent', mode: 'light' },
  'gradient-soft': { label: 'Soft gradient', bi: 'linear-gradient(135deg, var(--th-primary-100), var(--th-accent-100))', bg: 'transparent', mode: 'dark' },
  'gradient-dark': { label: 'Dark gradient', bi: `linear-gradient(160deg, ${D}, ${P})`, bg: 'transparent', mode: 'light' },
};
// every part name finds the designs of its kind
for (const v of Object.keys(BASE)) PRESETS[v] = PRESETS[BASE[v]];
PRESETS.button = PRESETS.button;

// ---------- what reaches the page ----------
// a person's choices for the parts: only known parts and values, with colours as "theme:name" or "#hex"
export function cleanStyle(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  for (const part of PARTS) {
    const src = v[part];
    if (!src || typeof src !== 'object') continue;
    const keep = {};
    for (const [prop, , kind] of PART_FIELDS[part]) {
      const val = String(src[prop] ?? '').trim();
      if (!val) continue;
      if (kind === 'preset') { if (PRESETS[part]?.[val]) keep.preset = val; continue; }
      if (kind === 'toggle') { if (val === 'yes') keep[prop] = 'yes'; continue; }
      if (MOTION_TABLES[prop]) { if (Object.hasOwn(MOTION_TABLES[prop], val)) keep[prop] = val; continue; }
      const [, table] = PROPS[prop] || [];
      if (!table) continue;
      if (table === 'color') { if (HEX.test(val) || (/^theme:/.test(val) && cssColor(val))) keep[prop] = val; } else if (table && Object.hasOwn(table, val)) keep[prop] = val;
    }
    if (Object.keys(keep).length) out[part] = keep;
  }
  return out;
}

const has = (cls, re) => re.test(cls);
function partOf(cls, tag) {
  if (has(cls, /(^|\s)prose-k(\s|$)/)) return 'content';
  if (has(cls, /mb-\[clamp\(2rem,4vw,3\.5rem\)\]/) && has(cls, /\bgrid\b/)) return 'head';
  if (has(cls, /\buppercase\b/) && has(cls, /\bbg-brand\/10\b/) && has(cls, /\brounded-full\b/)) return 'eyebrow';
  if (has(cls, /\brounded-kb\b/)) {
    if (has(cls, /\bborder-white\/40\b/)) return 'buttonOutline';
    if (has(cls, /\bbg-white\b/) && has(cls, /\btext-slate-900\b/)) return 'buttonLight';
    if (has(cls, /\bborder-ink\/20\b/)) return 'buttonGhost';
    if (has(cls, /\bbg-accent\b/)) return 'buttonAccent';
    if (has(cls, /\bbg-button\b/)) return 'buttonPrimary';
    return 'button';
  }
  if (has(cls, /\bplace-items-center\b/) && has(cls, /\bbg-brand\/1\d\b/)) return has(cls, /\bsize-6\b/) ? 'tick' : 'icon';
  if (has(cls, /\bfont-display\b/) && has(cls, /\btext-heading\b/)) return has(cls, /leading-\[1\.0\d?\]/) ? 'heading' : 'itemTitle';
  if (has(cls, /\bbg-surface\b/) && has(cls, /(^|\s)border(\s|$)/) && has(cls, /\brounded/)) return 'item';
  if (has(cls, /\boverflow-hidden\b/) && has(cls, /\bbg-paper-alt\b/) && has(cls, /\[&_img\]/)) return 'image';
  if (has(cls, /\btext-secondary\b/) && /^(p|div|span)$/i.test(tag)) return 'text';
  return '';
}

// the classes and variables for one part: its design first, then what was set one by one
function declare(part, cfg, { svgOnly = false, index = 0 } = {}) {
  const vars = {}, classes = [];
  if (cfg.hide === 'yes') return { vars, classes: [CLASS.hide] };
  const set = (name, cls, value) => { if (value === undefined || value === '') return; vars[name] = value; classes.push(cls); };
  if (svgOnly) {
    const c = cssColor(cfg.color);
    if (c) { vars['--k-ic'] = c; classes.push(CLASS.svg); }
    return { vars, classes };
  }
  const preset = cfg.preset ? PRESETS[baseOf(part)]?.[cfg.preset] : null;
  if (preset) {
    set('--k-bg', CLASS.bg, preset.bg);
    set('--k-bi', CLASS.bi, preset.bi);
    set('--k-fg', CLASS.color, preset.color);
    set('--k-bd', CLASS.border, preset.border);
    set('--k-bw', CLASS.borderWidth, preset.bw);
    set('--k-sh', CLASS.shadow, preset.sh);
    if (preset.color && baseOf(part) === 'icon') { vars['--k-ic'] = preset.color; classes.push(CLASS.svg); }
  }
  for (const [prop, [name, table]] of Object.entries(PROPS)) {
    const val = cfg[prop];
    if (!val || !name) continue;
    const css = table === 'color' ? cssColor(val) : table[val];
    if (css === undefined || css === '') continue;
    if (!(name in vars)) classes.push(CLASS[prop]);
    vars[name] = css;
    if (prop === 'color' && baseOf(part) === 'icon') { vars['--k-ic'] = css; if (!classes.includes(CLASS.svg)) classes.push(CLASS.svg); }
    // a colour chosen for a background replaces the design's gradient
    if (prop === 'bg' && vars['--k-bi']) delete vars['--k-bi'];
  }
  if (!('--k-bi' in vars)) { const i = classes.indexOf(CLASS.bi); if (i >= 0) classes.splice(i, 1); }
  // where a block of limited width sits in the space it has: left, middle or right
  if (ALIGN[cfg.position]) {
    vars['--k-ml'] = cfg.position === 'left' ? '0' : 'auto';
    vars['--k-mr'] = cfg.position === 'right' ? '0' : 'auto';
    classes.push(CLASS.ml, CLASS.mr);
  }
  const mo = motionOf(cfg, index);
  Object.assign(vars, mo.vars);
  return { vars, classes: [...new Set([...classes, ...mo.classes])], attrs: mo.attrs };
}

const styleAttr = (attrs, vars) => {
  const add = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
  if (!add) return attrs;
  const m = /\sstyle="([^"]*)"/.exec(attrs);
  return m ? attrs.replace(m[0], ` style="${m[1].replace(/;?\s*$/, ';')}${add}"`) : `${attrs} style="${add}"`;
};

const DESC_VALUE = { color: 'color', bg: 'color', border: 'color', size: SIZES, weight: WEIGHTS, leading: LEADING, tracking: TRACKING, align: ALIGN, transform: TRANSFORM, gap: GAPS, underline: UNDERLINE };
const DESC_VAR = { color: 'fg', size: 'fs', weight: 'fw', leading: 'lh', tracking: 'ls', align: 'ta', transform: 'tt', gap: 'mt', underline: 'td', bg: 'bg', border: 'bd' };
function declareDesc(chosen) {
  const vars = {}, classes = [];
  for (const [part, { code }] of Object.entries(DESC)) {
    for (const [prop, val] of Object.entries(chosen[part] || {})) {
      const table = DESC_VALUE[prop], cls = DESC_CLASS[`${part}.${prop}`];
      const css = table === 'color' ? cssColor(val) : table?.[val];
      if (!cls || css === undefined || css === '') continue;
      vars[`--k-${code}-${DESC_VAR[prop]}`] = css;
      classes.push(cls);
    }
  }
  return { vars, classes };
}

// marks the parts of one section's markup, and gives them what was chosen for them
// auto: when given, only these kinds of part are found by their classes (the rest must be marked in the markup)
export function tagParts(html, style = null, { auto = null } = {}) {
  const chosen = style ? cleanStyle(style) : {};
  const seen = {};
  const out = String(html).replace(/<([a-z][a-z0-9]*)\b([^>]*?)\bclass="([^"]*)"([^>]*)>/gi, (m, tag, pre, cls, post) => {
    if (/^(section|header|footer|main|svg|path|img|html|body)$/i.test(tag)) return m;
    const had = /\sdata-p="([a-zA-Z]+)"/.exec(`${pre} ${post}`);
    const p = had ? had[1] : partOf(cls, tag);
    if (!p) return m;
    if (!had && auto && !auto.some((x) => p === x || p.startsWith(x))) return m;
    const cfg = chosen[p] || (BASE[p] === 'button' ? chosen.button : BASE[p] === 'icon' ? chosen.icon : null);
    const inside = p === 'content' ? declareDesc(chosen) : null;
    if (!cfg && !inside?.classes.length) return had ? m : `<${tag}${pre}class="${cls}" data-p="${p}"${post}>`;
    seen[p] = (seen[p] ?? -1) + 1;
    const d = cfg ? declare(p, cfg, { index: seen[p] }) : { vars: {}, classes: [], attrs: '' };
    if (inside) { Object.assign(d.vars, inside.vars); d.classes.push(...inside.classes); }
    const extra = d.classes.length ? ` ${d.classes.join(' ')}` : '';
    return `<${tag}${styleAttr(had ? `${pre}class="${cls}${extra}"${post}` : `${pre}class="${cls}${extra}" data-p="${p}"${post}`, d.vars)}${d.attrs || ''}>`;
  });
  // an icon drawn straight into a pill or a card (no box of its own) takes its colour from the card
  if (chosen.icon?.color && !/data-p="(icon|tick)"/.test(out)) {
    const d = declare('icon', chosen.icon, { svgOnly: true });
    return out.replace(/<([a-z][a-z0-9]*)\b([^>]*?)\bdata-p="item"([^>]*)>/gi, (m, tag, pre, post) => `<${tag}${styleAttr(`${pre}data-p="item"${post}`, d.vars).replace(/\bclass="([^"]*)"/, (x, c) => `class="${c} ${d.classes.join(' ')}"`)}>`);
  }
  return out;
}

// ---------- the section itself ----------
const DARK_THEME = new Set(['dark', 'primary-dark', 'secondary', 'heading', 'text', 'black']);
function isDarkColor(v) {
  const t = /^theme:(.+)$/.exec(v || '');
  if (t) return DARK_THEME.has(t[1]);
  const h = /^#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i.exec(v || '');
  if (!h) return false;
  const x = h[1].length === 3 ? h[1].split('').map((c) => c + c).join('') : h[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}
// the opening tag of a section with a background, text mode and space chosen for it
export function applySection(html, raw) {
  const cfg = cleanStyle({ section: raw }).section;
  if (!cfg) return html;
  const m = /<(section|header|footer|div)\b([^>]*?)\bclass="([^"]*)"([^>]*)>/.exec(html);
  if (!m) return html;
  const vars = {}, add = [];
  const preset = cfg.preset ? PRESETS.section[cfg.preset] : null;
  if (preset?.bg) { vars['--k-bg'] = preset.bg; add.push(CLASS.bg); }
  if (preset?.bi) { vars['--k-bi'] = preset.bi; add.push(CLASS.bi); }
  if (cfg.bg) { vars['--k-bg'] = cssColor(cfg.bg); if (!add.includes(CLASS.bg)) add.push(CLASS.bg); delete vars['--k-bi']; const i = add.indexOf(CLASS.bi); if (i >= 0) add.splice(i, 1); }
  for (const [prop, cls] of [['padTop', CLASS.padTop], ['padBottom', CLASS.padBottom]]) if (cfg[prop]) { vars[PROPS[prop][0]] = PAD[cfg[prop]]; add.push(cls); }
  if (cfg.contentWidth && CONTENT_W[cfg.contentWidth]) vars['--k-wrap'] = CONTENT_W[cfg.contentWidth];
  const mo = motionOf(cfg, 0);
  add.push(...mo.classes);
  Object.assign(vars, mo.vars);
  let cls = m[3];
  const mode = cfg.textMode && cfg.textMode !== 'auto' ? cfg.textMode : preset?.mode || (cfg.bg ? (isDarkColor(cfg.bg) ? 'light' : 'dark') : '');
  const tokens = cls.split(/\s+/).filter(Boolean);
  if (mode === 'light') for (const t of ['on-dark', 'text-on-dark']) { if (!tokens.includes(t)) tokens.push(t); }
  cls = (mode === 'dark' ? tokens.filter((t) => t !== 'on-dark' && t !== 'text-on-dark') : tokens).join(' ');
  const attrs = styleAttr(`${m[2]}class="${`${cls} ${add.join(' ')}`.replace(/\s+/g, ' ').trim()}"${m[4]}`, vars);
  return html.replace(m[0], `<${m[1]}${attrs}${mo.attrs}>`);
}
