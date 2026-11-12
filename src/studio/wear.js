import path from 'node:path';
import { clientDir, readJson, writeJson } from '../config.js';

// What the Configuration tab sets, and the design variants wear.
//
// Each design variant is a full design of its own (fonts, layout, sections). The Configuration tab (Design settings) is the one place
// where the user says what the site should look like, so everything saved there reaches the variants:
//   - the colours of the selected theme always do;
//   - any other setting (fonts, corner roundness, shadows, spacing, header, hero, footer, banners…) that the user changed and saved
//     is kept as a "configuration setting" and laid over every variant, the ones made later too. A setting the user never changed
//     stays as the variant has it, so the variants still differ from one another.
// The variants themselves are not rewritten: they wear the configuration when they are drawn, so nothing is lost, and the next
// change to the same setting simply replaces the earlier one.

export const COLOUR_KEYS = ['primary', 'primaryDark', 'accent', 'ink', 'soft'];
export const SETTING_KEYS = {
  tokens: ['fontHeading', 'fontBody', 'radius', 'shadow', 'density', 'headingCase', 'headingWeight', 'container'],
  layout: ['header', 'topbar', 'hero', 'sections', 'cards', 'cardLayout', 'sectionHead', 'innerSidebar', 'footer', 'contactLayout', 'innerForm', 'homeStyle'],
  extras: ['banners', 'heroImage', 'backToTop', 'floating', 'headerButtons'],
};

const file = (slug) => path.join(clientDir(slug), 'template', 'variant-config.json');
const empty = () => ({ tokens: {}, layout: {}, extras: {}, at: null });
export async function loadConfig(slug) {
  const c = await readJson(file(slug), null);
  return { ...empty(), ...(c || {}) };
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// the settings that differ between two saved designs
export function diffSpecs(before, after) {
  const out = { tokens: {}, layout: {}, extras: {} };
  for (const group of Object.keys(SETTING_KEYS)) for (const k of SETTING_KEYS[group]) if (!same(before?.[group]?.[k], after?.[group]?.[k]) && after?.[group]?.[k] !== undefined) out[group][k] = after[group][k];
  return out;
}

// remember what the user changed in this save; returns how many settings that is
export async function recordConfig(slug, before, after) {
  const d = diffSpecs(before, after);
  const n = Object.values(d).reduce((t, g) => t + Object.keys(g).length, 0);
  if (!n) return 0;
  const cur = await loadConfig(slug);
  await writeJson(file(slug), { tokens: { ...cur.tokens, ...d.tokens }, layout: { ...cur.layout, ...d.layout }, extras: { ...cur.extras, ...d.extras }, at: new Date().toISOString() });
  return n;
}

// a variant as it is drawn: its own design, the selected theme's colours, and the settings saved in the Configuration
export function wear(v, active, cfg = empty()) {
  const tokens = { ...v.spec.tokens, ...Object.fromEntries(COLOUR_KEYS.map((k) => [k, active.tokens[k]])), ...(cfg.tokens || {}) };
  const layout = { ...v.spec.layout, ...(cfg.layout || {}) };
  const extras = { ...(v.spec.extras || {}), ...(cfg.extras || {}) };
  // a header, footer or hero style the user chose in the Configuration also replaces the one the variant's page gives that part
  const page = structuredClone(v.page);
  if (cfg.layout?.header !== undefined && page?.header) page.header.variant = '';
  if (cfg.layout?.footer !== undefined && page?.footer) page.footer.variant = '';
  if (cfg.layout?.hero !== undefined) for (const s of page?.sections || []) if (s.ref === 'hero') s.variant = '';
  return { tokens, layout, extras, page };
}

// the colours, theme and configuration settings a drawing was made with: when this changes, the variants' pictures are out of date
export const configKey = (active, cfg = empty()) => JSON.stringify([COLOUR_KEYS.map((k) => active.tokens[k]), active.theme || null, cfg.tokens, cfg.layout, cfg.extras]);
