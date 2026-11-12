import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePage, normalizeTweaks, normalizeSpec, themeVars, DEFAULT_SPEC } from '../src/template/spec.js';
import { SECTION_TYPES, SECTION_PROPS, PROPS_FOR } from '../src/template/section-meta.js';
import { renderSection } from '../src/template/sections.js';
import { DIRECTIONS, DEFAULT_DIRECTIONS, recipe, distance, diversify, orderRefs } from '../src/studio/directions.js';
import { scoreMetrics, WEIGHTS } from '../src/studio/qa.js';
import { libraryOf } from '../src/studio/variants.js';
import { applyClassTweaks } from '../src/template/class-tweaks.js';

const REFS = ['hero', 'offers:0', 'prose:0', 'tiles:0', 'cardgrid:0', 'cardgrid:1', 'stats:0', 'listform:0', 'reviews:0', 'prose:1', 'faq:0', 'areas:0', 'split:0', 'contact:0', 'cta:0'];
const BRAND = { primary: '#19858E', accent: '#E47229', ink: '#1A2828', soft: '#F2F6F6' };

test('section catalogue: every type has styles, and every property list is valid', () => {
  for (const [type, meta] of Object.entries(SECTION_TYPES)) {
    assert.ok(meta.variant.length >= 1, type);
    for (const p of PROPS_FOR[type] || []) assert.ok(p === 'variant' || SECTION_PROPS[p], `${type}.${p}`);
  }
});

test('normalizePage drops unknown content, clamps values and keeps ids unique', () => {
  const p = normalizePage({
    header: { variant: 'nonsense' }, footer: { variant: 'light' },
    sections: [
      { ref: 'hero', variant: 'editorial', props: { bg: 'dark' } },
      { ref: 'bogus:1' }, { ref: '../etc' },
      { id: 'a', ref: 'cardgrid:0', variant: 'list', props: { bg: 'purple', head: 'bar' } },
      { id: 'a', ref: 'cardgrid:0', variant: 'not-a-style' },
      { ref: 'cta:0', content: { buttonHref: 'javascript:alert(1)', title: '<b>x</b>' } },
    ],
  });
  assert.equal(p.sections.length, 4);
  assert.equal(p.header.variant, '');
  assert.equal(p.footer.variant, 'light');
  assert.equal(new Set(p.sections.map((s) => s.id)).size, 4);
  const card = p.sections.find((s) => s.id === 'a');
  assert.equal(card.variant, 'list');
  assert.equal(card.props.bg, 'auto');
  assert.equal(card.props.head, 'bar');
  assert.equal(p.sections[2].variant, 'grid'); // an unknown style falls back to the type's default
  const cta = p.sections.find((s) => s.ref === 'cta:0');
  assert.equal(cta.content.buttonHref, '');
  assert.ok(!cta.content.title.includes('<'));
});

test('a section that keeps its own look carries clamped theme tokens', () => {
  const p = normalizePage({ sections: [{ ref: 'faq:0', adapt: 'own', own: { primary: '#123456', fontHeading: 'No Such Font', radius: 'huge' } }] });
  const s = p.sections[0];
  assert.equal(s.adapt, 'own');
  assert.equal(s.own.primary, '#123456');
  assert.notEqual(s.own.fontHeading, 'No Such Font');
  assert.ok(['none', 'sm', 'md', 'lg', 'xl'].includes(s.own.radius));
  const vars = themeVars({ tokens: { ...DEFAULT_SPEC.tokens, ...s.own }, layout: DEFAULT_SPEC.layout });
  assert.equal(vars['--brand-primary'], '#123456');
});

test('normalizeSpec keeps a valid page and accepts null', () => {
  const spec = normalizeSpec({ page: { sections: [{ ref: 'hero' }] } }, DEFAULT_SPEC);
  assert.equal(spec.page.sections.length, 1);
  assert.equal(normalizeSpec({ page: null }, spec).page, null);
});

test('class tweaks reject unsafe input and apply only to the right page type', () => {
  const t = normalizeTweaks([{ layout: 'home', selector: 'h1', add: ['text-5xl', '<script>', 'bg-[#e8eef3]', 'x"y'], remove: ['text-4xl'] }, { selector: 'a{color:red}', add: ['p-2'] }]);
  assert.equal(t.length, 1);
  assert.deepEqual(t[0].add, ['text-5xl', 'bg-[#e8eef3]']);
  const spec = normalizeSpec({ tweaks: t }, DEFAULT_SPEC);
  const html = '<html><body><h1 class="text-4xl">Hi</h1></body></html>';
  assert.match(applyClassTweaks(html, spec, 'home'), /class="text-5xl bg-\[#e8eef3\]"/);
  assert.equal(applyClassTweaks(html, spec, 'inner'), html);
});

test('art directions: the four defaults are clearly different and keep every piece of content', () => {
  const vs = DEFAULT_DIRECTIONS.map((d) => { const r = recipe(d, { brand: BRAND, refs: REFS }); return { id: d, spec: { tokens: r.tokens, layout: r.layout }, page: r.page }; });
  for (let i = 0; i < vs.length; i++) {
    assert.deepEqual([...vs[i].page.sections.map((s) => s.ref)].sort(), [...REFS].sort(), 'no content ref may be lost');
    assert.equal(vs[i].page.sections[0].ref, 'hero');
    assert.equal(vs[i].spec.tokens.primary, BRAND.primary, 'brand colour is kept');
    for (let j = i + 1; j < vs.length; j++) assert.ok(distance(vs[i], vs[j]) >= 0.4, `${vs[i].id} vs ${vs[j].id}`);
  }
});

test('every direction is complete and orders content with the hero first', () => {
  for (const id of Object.keys(DIRECTIONS)) {
    const r = recipe(id, { brand: BRAND, refs: REFS });
    assert.equal(r.page.sections[0].ref, 'hero', id);
    assert.ok(normalizeSpec({ tokens: r.tokens, layout: r.layout, page: r.page }, DEFAULT_SPEC).page.sections.length === REFS.length, id);
  }
  assert.deepEqual(orderRefs(['cta:0', 'hero', 'faq:0'], ['hero', 'faq', 'cta']), ['hero', 'faq:0', 'cta:0']);
});

test('diversify pushes near-identical variants apart', () => {
  const mk = () => { const r = recipe('premium-corporate', { brand: BRAND, refs: REFS }); return { id: 'x', spec: { tokens: r.tokens, layout: r.layout }, page: r.page }; };
  const a = mk(), b = mk();
  assert.equal(distance(a, b), 0);
  diversify(b, [a]);
  assert.ok(distance(a, b) > 0.1);
});

// ---- quality score ----
const clean = () => ({ vw: 1440, overflowX: false, overflowers: [], brokenImages: [], distortedImages: [], noAlt: 0, clipped: [], h1Count: 1, h1Size: 56, h1Lines: 2, h2Size: 36, h3Size: 24, maxHeadingLines: 2, bodySize: 17, lineLen: 70, families: ['A', 'B'], headingSkips: 0, padTops: [72, 72, 72], wrapLefts: [100], sectionBgs: ['a', 'b', 'a', 'b'], btnRadii: ['8px'], ctaAboveFold: true, smallTargets: 0, cardRadii: ['8px'], lowContrast: 0, lowContrastList: [] });
test('quality score: a clean page scores 100, and weights add up to 100', () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
  const phone = { ...clean(), h1Size: 34 };
  const r = scoreMetrics({ desktop: clean(), tablet: { ...clean(), h1Size: 44 }, mobile: phone });
  assert.equal(r.total, 100);
  assert.equal(r.issues.length, 0);
});

test('quality score: concrete defects lower the right parts and are explained', () => {
  const d = clean(), t = clean(), m = { ...clean(), h1Size: 34 };
  m.overflowX = true; m.overflowers = ['div.wide'];
  d.brokenImages = ['images/a.jpg'];
  d.h1Size = 30; d.h2Size = 34;
  m.smallTargets = 5;
  d.lowContrast = 6; d.lowContrastList = ['p 2.1:1'];
  const r = scoreMetrics({ desktop: d, tablet: t, mobile: m, console: ['TypeError x'], failed: ['/a.css'], contentFails: ['3 text blocks missing'] });
  assert.ok(r.total < 85);
  for (const part of ['hierarchy', 'spacing', 'imagery', 'responsive', 'consistency', 'accessibility']) assert.ok(r.parts[part] < 100, part);
  assert.ok(r.issues.some((i) => i.id === 'overflow-x'));
  assert.ok(r.issues.some((i) => i.id === 'tap-targets'));
  assert.equal(r.issues[0].severity, 'high');
});

// ---- every section style draws the section's own content ----
const spec = normalizeSpec({}, DEFAULT_SPEC);
const ctx = { spec, imgs: null, used: new Set(), siteUrl: (h) => h, state: {}, dims: null, rel: 'index.html', host: 'example.com', model: {} };
const u = (h) => h;
const site = { phone: { digits: '5550100100', display: '555-010-0100' }, ctaHref: '/contact.html', ctaTitle: 'Talk', ctaLabel: 'Contact' };
const model = { protected: { form: '<form id="f"></form>' } };
const CONTENT = {
  offers: [{ type: 'offers', items: [{ badge: 'TWENTY OFF', label: 'drains' }], links: [{ text: 'Schedule now', href: '/s', mobile: false }] }, 'TWENTY OFF'],
  prose: [{ type: 'prose', title: 'About Alpha', blocks: [{ t: 'html', html: '<p>Alpha body text</p>' }] }, 'Alpha body text'],
  tiles: [{ type: 'tiles', items: [{ text: 'Licensed pros' }, { text: 'Same day help' }] }, 'Same day help'],
  features: [{ type: 'features', title: 'Why us', intro: [], items: ['Fast', 'Fair', 'Friendly', 'Clean'] }, 'Friendly'],
  cardgrid: [{ type: 'cardgrid', title: 'Services', intro: [], items: [{ title: 'Drain care', text: 'Clears drains', href: '/d' }, { title: 'Pipe repair', text: 'Fixes pipes', href: '/p' }, { title: 'Water heaters', text: 'Heats water', href: '/w' }] }, 'Pipe repair'],
  iconcards: [{ type: 'iconcards', title: 'Quick', items: [{ text: 'Leak help', href: '/l', img: '' }] }, 'Leak help'],
  stats: [{ type: 'stats', items: [{ value: '50+', label: 'Years serving' }, { value: 'A+', label: 'Rated' }, { value: '5.0', label: 'Stars' }] }, 'Years serving'],
  listform: [{ type: 'listform', title: 'Same day', items: ['Item one', 'Item two'], formTitle: 'Get a quote', formBlocks: [] }, 'Get a quote'],
  reviews: [{ type: 'reviews', title: 'Reviews', items: [{ quote: 'Great work done here', name: 'AB', place: '' }, { quote: 'Second quote of praise', name: 'CD', place: '' }] }, 'Second quote of praise'],
  faq: [{ type: 'faq', title: 'Questions', intro: [], sideTitle: 'Family owned', items: [{ q: 'First question?', a: '<p>First answer</p>' }] }, 'Family owned'],
  areas: [{ type: 'areas', groups: [{ title: 'Cities', links: [{ text: 'Miami', href: '/m' }] }] }, 'Miami'],
  split: [{ type: 'split', title: 'Our family', img: '', blocks: [{ t: 'html', html: '<p>Beta body text</p>' }] }, 'Beta body text'],
  contact: [{ type: 'contact', items: [{ title: 'Call us', text: 'Anytime' }] }, 'Call us'],
  cta: [{ type: 'cta', title: 'Ready to start', text: 'Call now', href: '/c', label: 'Contact us' }, 'Ready to start'],
};
test('every section type, in every layout style, draws its own content', () => {
  for (const [type, [s, expected]] of Object.entries(CONTENT)) {
    for (const variant of SECTION_TYPES[type].variant) {
      const html = renderSection({ ...s, variant }, 1, ctx, spec, u, site, model, {});
      assert.ok(html.includes(expected), `${type}/${variant} lost "${expected}"`);
      assert.match(html, /^<section/, `${type}/${variant}`);
    }
  }
});

test('section properties change the markup without losing content', () => {
  const [s, expected] = CONTENT.cardgrid;
  const dark = renderSection({ ...s }, 1, ctx, spec, u, site, model, { bg: 'dark', spacing: 'loose', align: 'center' });
  assert.match(dark, /bg-brand-dark/);
  assert.match(dark, /on-dark/);
  assert.match(dark, /sec-loose/);
  assert.match(dark, /text-center/);
  assert.ok(dark.includes(expected));
});

test('library lists header, every visible section and footer of each variant', () => {
  const r = recipe('conversion-focused', { brand: BRAND, refs: REFS });
  const page = normalizePage(r.page);
  page.sections[2].hidden = true;
  const v = { id: 'v1', name: 'One', direction: 'conversion-focused', spec: { tokens: r.tokens, layout: r.layout }, page, labels: { hero: 'Welcome' }, assets: { thumbs: { header: true } } };
  const lib = libraryOf([v]);
  assert.equal(lib.length, REFS.length - 1 + 2);
  assert.equal(lib[0].type, 'header');
  assert.equal(lib.at(-1).type, 'footer');
  assert.equal(lib.find((e) => e.type === 'hero').label, 'Welcome');
  assert.equal(lib[0].thumb, true);
});
