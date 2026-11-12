import { HERO_STYLES } from '../template/section-meta.js';

// Art directions. Each is a complete, internally consistent way to design the same content: typography, shape, header and
// footer, hero composition, which style every kind of section uses, how sections are ordered and how backgrounds alternate.
// They differ in structure, not only in colour. The AI chooses which directions suit the business and tunes them.

const hex = (h) => { const m = h.replace('#', ''); const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m; return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)); };
export const mixHex = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join(''); };
const lum = (h) => { const [r, g, b] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

export const DIRECTIONS = {
  'premium-corporate': {
    name: 'Premium Corporate', icon: 'building',
    blurb: 'Disciplined grid, a serif headline, restrained colour and generous spacing. Reads as established and trustworthy.',
    tokens: { fontHeading: 'Playfair Display', fontBody: 'Source Sans 3', headingCase: 'none', headingWeight: 600, radius: 'sm', shadow: 'soft', density: 'spacious', container: 'normal' },
    layout: { header: 'classic', topbar: true, hero: 'split', sections: 'alternating', cards: 'outline', cardLayout: 'image', sectionHead: 'left', footer: 'dark', homeStyle: 'story' },
    colours: { dark: ['#0b1220', 0.72], soft: ['#ffffff', 0.05] },
    order: ['hero', 'tiles', 'prose', 'split', 'cardgrid', 'features', 'stats', 'reviews', 'faq', 'areas', 'listform', 'offers', 'contact', 'cta'],
    styles: { tiles: 'strip', prose: 'story', split: 'image-right', features: 'checks', cardgrid: 'grid', stats: 'inline', reviews: 'featured', faq: 'accordion', areas: 'columns', cta: 'band' },
    props: { split: { frame: 'plain' }, stats: { bg: 'white' } },
    fontPairs: [['Playfair Display', 'Source Sans 3'], ['DM Serif Display', 'Inter'], ['Lora', 'Lato']],
  },
  'conversion-focused': {
    name: 'Conversion Focused', icon: 'target',
    blurb: 'A confident hero with the main action in view, trust signals straight after it, services up front and repeated calls to act.',
    tokens: { fontHeading: 'Montserrat', fontBody: 'Open Sans', headingCase: 'none', headingWeight: 800, radius: 'md', shadow: 'medium', density: 'comfortable', container: 'normal' },
    layout: { header: 'classic', topbar: true, hero: 'photo', sections: 'alternating', cards: 'shadow', cardLayout: 'icon', sectionHead: 'left', footer: 'brand', homeStyle: 'showcase' },
    colours: { dark: ['#000000', 0.5], soft: ['#ffffff', 0.08] },
    order: ['hero', 'offers', 'tiles', 'listform', 'cardgrid', 'features', 'reviews', 'stats', 'split', 'prose', 'faq', 'areas', 'contact', 'cta'],
    styles: { tiles: 'cards', prose: 'stacked', split: 'image-left', features: 'icons', cardgrid: 'grid', stats: 'boxes', reviews: 'grid', faq: 'split', areas: 'pills', cta: 'split' },
    props: { tiles: { bg: 'soft' }, reviews: { bg: 'soft' }, split: { frame: 'rounded' } },
    fontPairs: [['Montserrat', 'Open Sans'], ['Poppins', 'Inter'], ['Raleway', 'Roboto']],
  },
  'editorial-minimal': {
    name: 'Editorial Minimal', icon: 'feather',
    blurb: 'Generous white space, a narrow measure, a refined serif and numbered lists. Quiet, confident and uncluttered.',
    tokens: { fontHeading: 'DM Serif Display', fontBody: 'Inter', headingCase: 'none', headingWeight: 400, radius: 'none', shadow: 'none', density: 'spacious', container: 'narrow' },
    layout: { header: 'minimal', topbar: false, hero: 'editorial', sections: 'flat', cards: 'flat', cardLayout: 'numbered', sectionHead: 'left', footer: 'light', homeStyle: 'story' },
    colours: { dark: ['#111111', 0.6], soft: ['#f6f4ef', 0.03] },
    order: ['hero', 'prose', 'tiles', 'cardgrid', 'split', 'features', 'reviews', 'stats', 'faq', 'areas', 'listform', 'offers', 'contact', 'cta'],
    styles: { tiles: 'pills', prose: 'centered', split: 'image-left', features: 'checks', cardgrid: 'list', stats: 'inline', reviews: 'stacked', faq: 'split', areas: 'pills', cta: 'centered' },
    props: { split: { frame: 'offset' }, tiles: { bg: 'soft' }, prose: { align: 'auto' } },
    fontPairs: [['DM Serif Display', 'Inter'], ['Playfair Display', 'Work Sans'], ['Lora', 'Nunito']],
  },
  'bold-contemporary': {
    name: 'Bold Contemporary', icon: 'bolt',
    blurb: 'Condensed capitals, strong contrast, dark bands and large numbers. Loud, memorable and still easy to use.',
    tokens: { fontHeading: 'Oswald', fontBody: 'Work Sans', headingCase: 'uppercase', headingWeight: 700, radius: 'sm', shadow: 'medium', density: 'comfortable', container: 'wide' },
    layout: { header: 'classic', topbar: false, hero: 'dark', sections: 'alternating', cards: 'outline', cardLayout: 'overlay', sectionHead: 'bar', footer: 'dark', homeStyle: 'showcase' },
    colours: { dark: ['#000000', 0.7], soft: ['#f4f4f5', 0.04] },
    order: ['hero', 'tiles', 'cardgrid', 'stats', 'split', 'features', 'reviews', 'prose', 'faq', 'listform', 'areas', 'offers', 'contact', 'cta'],
    styles: { tiles: 'pills', prose: 'story', split: 'image-right', features: 'icons', cardgrid: 'grid', stats: 'boxes', reviews: 'featured', faq: 'accordion', areas: 'columns', cta: 'centered' },
    props: { stats: { bg: 'dark' }, features: { bg: 'dark' }, split: { frame: 'offset' } },
    fontPairs: [['Oswald', 'Work Sans'], ['Bebas Neue', 'Inter'], ['Montserrat', 'Roboto']],
  },
  'warm-local': {
    name: 'Warm and Local', icon: 'heart',
    blurb: 'Rounded shapes, friendly type and soft backgrounds. Approachable and personal, like a neighbour you trust.',
    tokens: { fontHeading: 'Lora', fontBody: 'Nunito', headingCase: 'none', headingWeight: 600, radius: 'xl', shadow: 'soft', density: 'comfortable', container: 'normal' },
    layout: { header: 'centered', topbar: false, hero: 'centered', sections: 'alternating', cards: 'shadow', cardLayout: 'icon', sectionHead: 'center', footer: 'light', homeStyle: 'showcase' },
    colours: { dark: ['#1c1917', 0.5], soft: ['#fffaf3', 0.06] },
    order: ['hero', 'tiles', 'prose', 'cardgrid', 'split', 'reviews', 'features', 'stats', 'faq', 'areas', 'listform', 'offers', 'contact', 'cta'],
    styles: { tiles: 'cards', prose: 'centered', split: 'image-right', features: 'icons', cardgrid: 'grid', stats: 'boxes', reviews: 'grid', faq: 'accordion', areas: 'pills', cta: 'centered' },
    props: { split: { frame: 'rounded' }, reviews: { bg: 'soft' } },
    fontPairs: [['Lora', 'Nunito'], ['Merriweather', 'Lato'], ['Playfair Display', 'Nunito']],
  },
  'dark-luxe': {
    name: 'Dark Luxe', icon: 'moon',
    blurb: 'Deep backgrounds, light type and a single warm accent. Premium and cinematic, for brands that sell on quality.',
    tokens: { fontHeading: 'Playfair Display', fontBody: 'Manrope', headingCase: 'none', headingWeight: 600, radius: 'sm', shadow: 'medium', density: 'spacious', container: 'normal' },
    layout: { header: 'classic', topbar: false, hero: 'dark', sections: 'alternating', cards: 'outline', cardLayout: 'numbered', sectionHead: 'center', footer: 'dark', homeStyle: 'story' },
    colours: { dark: ['#0c0a09', 0.8], soft: ['#f5f1ea', 0.03] },
    order: ['hero', 'tiles', 'prose', 'cardgrid', 'split', 'stats', 'reviews', 'features', 'faq', 'areas', 'listform', 'offers', 'contact', 'cta'],
    styles: { tiles: 'pills', prose: 'centered', split: 'image-left', features: 'checks', cardgrid: 'list', stats: 'inline', reviews: 'featured', faq: 'split', areas: 'pills', cta: 'split' },
    props: { prose: { bg: 'dark' }, cardgrid: { bg: 'dark' }, stats: { bg: 'dark' }, split: { frame: 'plain' } },
    fontPairs: [['Playfair Display', 'Manrope'], ['DM Serif Display', 'Work Sans'], ['Lora', 'Inter']],
  },
  'fresh-modern': {
    name: 'Fresh Modern', icon: 'sparkle',
    blurb: 'Clean sans-serif type, soft cards and light gradients. Energetic and current without being loud.',
    tokens: { fontHeading: 'Poppins', fontBody: 'Inter', headingCase: 'none', headingWeight: 700, radius: 'lg', shadow: 'soft', density: 'comfortable', container: 'wide' },
    layout: { header: 'classic', topbar: false, hero: 'gradient', sections: 'alternating', cards: 'flat', cardLayout: 'icon', sectionHead: 'center', footer: 'brand', homeStyle: 'showcase' },
    colours: { dark: ['#0f172a', 0.6], soft: ['#ffffff', 0.07] },
    order: ['hero', 'tiles', 'cardgrid', 'features', 'split', 'stats', 'reviews', 'prose', 'faq', 'areas', 'listform', 'offers', 'contact', 'cta'],
    styles: { tiles: 'cards', prose: 'centered', split: 'image-right', features: 'icons', cardgrid: 'grid', stats: 'boxes', reviews: 'grid', faq: 'accordion', areas: 'pills', cta: 'band' },
    props: { split: { frame: 'rounded' } },
    fontPairs: [['Poppins', 'Inter'], ['Manrope', 'Inter'], ['Raleway', 'Open Sans']],
  },
  'classic-trust': {
    name: 'Classic Trust', icon: 'shield',
    blurb: 'Familiar structure, serif-and-sans pairing and calm blues. Dependable and easy to read for every age group.',
    tokens: { fontHeading: 'Merriweather', fontBody: 'Lato', headingCase: 'none', headingWeight: 700, radius: 'md', shadow: 'soft', density: 'comfortable', container: 'normal' },
    layout: { header: 'classic', topbar: true, hero: 'light', sections: 'alternating', cards: 'shadow', cardLayout: 'auto', sectionHead: 'left', footer: 'brand', homeStyle: 'story' },
    colours: { dark: ['#0a1a2f', 0.55], soft: ['#ffffff', 0.06] },
    order: ['hero', 'tiles', 'prose', 'cardgrid', 'features', 'split', 'reviews', 'stats', 'faq', 'areas', 'listform', 'offers', 'contact', 'cta'],
    styles: { tiles: 'strip', prose: 'story', split: 'image-left', features: 'checks', cardgrid: 'grid', stats: 'boxes', reviews: 'grid', faq: 'accordion', areas: 'columns', cta: 'band' },
    props: {},
    fontPairs: [['Merriweather', 'Lato'], ['Lora', 'Open Sans'], ['Playfair Display', 'Lato']],
  },
};

// How each direction designs the inner pages and the contact page (laid over the site-wide layout for those pages only).
export const PAGE_LAYOUTS = {
  'premium-corporate': { inner: { sections: 'alternating', innerSidebar: 'on', innerForm: 'side', sectionHead: 'left' }, contact: { contactLayout: 'split', hero: 'gradient' } },
  'conversion-focused': { inner: { innerSidebar: 'on', innerForm: 'side', cards: 'shadow', hero: 'split' }, contact: { contactLayout: 'split', hero: 'dark' } },
  'editorial-minimal': { inner: { sections: 'flat', innerSidebar: 'off', innerForm: 'below', hero: 'editorial', sectionHead: 'left' }, contact: { contactLayout: 'stacked', hero: 'editorial' } },
  'bold-contemporary': { inner: { hero: 'dark', sections: 'alternating', sectionHead: 'bar', innerSidebar: 'on' }, contact: { contactLayout: 'split', hero: 'dark' } },
  'warm-local': { inner: { hero: 'gradient', innerSidebar: 'on', cards: 'outline', innerForm: 'side' }, contact: { contactLayout: 'stacked', hero: 'centered' } },
  'dark-luxe': { inner: { hero: 'dark', innerSidebar: 'off', sections: 'flat', innerForm: 'below' }, contact: { contactLayout: 'stacked', hero: 'dark' } },
  'fresh-modern': { inner: { hero: 'light', sectionHead: 'center', cards: 'flat', innerSidebar: 'off' }, contact: { contactLayout: 'split', hero: 'centered' } },
  'classic-trust': { inner: { hero: 'gradient', sections: 'alternating', innerForm: 'side', innerSidebar: 'on' }, contact: { contactLayout: 'split', hero: 'light' } },
};

export const DEFAULT_DIRECTIONS = ['premium-corporate', 'conversion-focused', 'editorial-minimal', 'bold-contemporary'];
export const directionCatalog = () => Object.entries(DIRECTIONS).map(([id, d]) => `- ${id} (${d.name}): ${d.blurb}`).join('\n');

// Brand colours stay; the neutrals around them (dark shade, soft tint, ink) are tuned for the direction.
export function paletteFor(direction, brand) {
  const d = DIRECTIONS[direction];
  const primary = brand.primary, accent = brand.accent;
  const dark = mixHex(primary, d.colours.dark[0], d.colours.dark[1]);
  const soft = mixHex(d.colours.soft[0], primary, d.colours.soft[1]);
  const ink = lum(brand.ink || '#111827') < 0.12 ? brand.ink : '#111827';
  return { primary, primaryDark: dark, accent, ink, soft };
}

// Orders the page's content refs the way this direction tells the story (hero first, closing call to action last).
export function orderRefs(refs, order) {
  const rank = (ref) => { const type = ref.split(':')[0]; const k = order.indexOf(type); return k === -1 ? order.length - 2 : k; };
  return refs.map((ref, i) => ({ ref, i })).sort((a, b) => rank(a.ref) - rank(b.ref) || a.i - b.i).map((x) => x.ref);
}

// The design (spec parts) and the page (ordered, styled sections) for a direction.
export function recipe(direction, { brand, refs, fontPair = 0 }) {
  const d = DIRECTIONS[direction];
  const [fh, fb] = d.fontPairs[fontPair % d.fontPairs.length];
  const tokens = { ...d.tokens, fontHeading: fh, fontBody: fb, ...paletteFor(direction, brand) };
  const sections = orderRefs(refs, d.order).map((ref) => {
    const type = ref.split(':')[0];
    if (type === 'hero') return { ref, variant: d.layout.hero, props: {} };
    return { ref, variant: d.styles[type], props: { ...(d.props[type] || {}) } };
  });
  const pl = PAGE_LAYOUTS[direction] || {};
  return { tokens, layout: { ...d.layout }, pageLayout: { inner: { ...(pl.inner || {}) }, contact: { ...(pl.contact || {}) } }, page: { header: { variant: d.layout.header }, footer: { variant: d.layout.footer }, sections } };
}

export const FEATURES = [
  (v) => v.page.sections.find((s) => s.ref === 'hero')?.variant || v.spec.layout.hero, (v) => v.spec.layout.header, (v) => v.spec.layout.footer, (v) => v.spec.layout.cardLayout,
  (v) => v.spec.layout.sectionHead, (v) => v.spec.layout.sections, (v) => v.spec.tokens.fontHeading, (v) => v.spec.tokens.headingCase, (v) => v.spec.tokens.radius, (v) => v.spec.tokens.container, (v) => v.spec.tokens.density,
];

// 0 = identical, 1 = nothing in common: design choices, section order, section styles and backgrounds all count
export function distance(a, b) {
  let diff = FEATURES.reduce((n, f) => n + (f(a) !== f(b) ? 1 : 0), 0);
  const ra = a.page.sections.map((s) => s.ref), rb = b.page.sections.map((s) => s.ref);
  const shared = ra.filter((r) => rb.includes(r));
  const moved = shared.filter((r) => ra.indexOf(r) !== rb.indexOf(r)).length;
  const styleDiff = shared.filter((r) => a.page.sections.find((s) => s.ref === r).variant !== b.page.sections.find((s) => s.ref === r).variant).length;
  const bgDiff = shared.filter((r) => a.page.sections.find((s) => s.ref === r).props.bg !== b.page.sections.find((s) => s.ref === r).props.bg).length;
  const n = Math.max(1, shared.length);
  diff += 3 * (moved / n) + 3 * (styleDiff / n) + (bgDiff / n);
  return +(diff / (FEATURES.length + 7)).toFixed(3);
}

// when two variants come out too alike, change the choices they share until they are clearly different
export function diversify(v, others) {
  const used = (f) => new Set(others.map(f));
  const alts = { hero: HERO_STYLES, header: ['classic', 'centered', 'minimal'], footer: ['dark', 'brand', 'light'], cards: ['image', 'icon', 'numbered', 'overlay'], head: ['left', 'center', 'bar'] };
  const pickOther = (list, taken, cur) => list.find((x) => x !== cur && !taken.has(x)) || list.find((x) => x !== cur) || cur;
  const hero = v.page.sections.find((s) => s.ref === 'hero');
  const steps = [
    () => { if (hero) { const n = pickOther(alts.hero, used((o) => o.page.sections.find((s) => s.ref === 'hero')?.variant), hero.variant); hero.variant = n; v.spec.layout.hero = n; } },
    () => { const n = pickOther(alts.header, used((o) => o.spec.layout.header), v.spec.layout.header); v.spec.layout.header = n; v.page.header.variant = n; },
    () => { v.spec.layout.cardLayout = pickOther(alts.cards, used((o) => o.spec.layout.cardLayout), v.spec.layout.cardLayout); },
    () => { v.spec.layout.sectionHead = pickOther(alts.head, used((o) => o.spec.layout.sectionHead), v.spec.layout.sectionHead); },
    () => { const n = pickOther(alts.footer, used((o) => o.spec.layout.footer), v.spec.layout.footer); v.spec.layout.footer = n; v.page.footer.variant = n; },
  ];
  for (const step of steps) {
    if (others.every((o) => distance(v, o) >= 0.4)) break;
    step();
  }
  return v;
}
