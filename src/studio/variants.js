import fs from 'node:fs/promises';
import { callTool } from '../ai/claude.js';
import { loadActive } from '../template/store.js';
import { wear, configKey, loadConfig } from './wear.js';
import { normalizeSpec, normalizePage, DEFAULT_SPEC, OPTIONS, FONT_CATALOG } from '../template/spec.js';
import { SECTION_TYPES, typeOfRef } from '../template/section-meta.js';
import { DIRECTIONS, DEFAULT_DIRECTIONS, recipe, distance, diversify } from './directions.js';
import { homeContent } from './home.js';
import { ensureBrief } from './brief.js';
import { canvasHtml, portalOrigin, availableSlots } from './canvas.js';
import { inspectPage } from './shots.js';
import { listJson, readItem, writeItem, deleteItem, newId, thumbDir } from './files.js';

// Design variants: each is a full design (theme, header/footer, hero, and every section in its own style and order) for the
// same home-page content. They are saved until the user deletes them, and can be regenerated, duplicated and restored.

const enumOf = (list) => ({ type: 'string', enum: list.map(String) });
const TUNE_TOOL = {
  name: 'submit_variant_tuning',
  description: 'Submit the tuned name, description and typography for each variant.',
  input_schema: {
    type: 'object',
    properties: {
      variants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', description: 'A client-facing name of two or three words.' },
            description: { type: 'string', description: 'One sentence describing the look for a non-designer.' },
            rationale: { type: 'string', description: 'Why this suits this business, one sentence.' },
            tokens: {
              type: 'object',
              properties: {
                fontHeading: enumOf(Object.keys(FONT_CATALOG)), fontBody: enumOf(Object.keys(FONT_CATALOG)),
                headingCase: enumOf(OPTIONS.headingCase), headingWeight: enumOf(OPTIONS.headingWeight), radius: enumOf(OPTIONS.radius),
                shadow: enumOf(OPTIONS.shadow), density: enumOf(OPTIONS.density), container: enumOf(OPTIONS.container),
              },
            },
          },
          required: ['id', 'name', 'description'],
        },
      },
    },
    required: ['variants'],
  },
};

// A variant wears the Configuration: the selected theme's colours and every setting saved in Design settings (see wear.js).
export { COLOUR_KEYS, configKey, wear } from './wear.js';
export const themedTokens = (tokens, active) => wear({ spec: { tokens }, page: null }, active).tokens;

export async function specOf(slug, v, extra = {}) {
  const { spec: active } = await loadActive(slug);
  const w = wear(v, active, await loadConfig(slug));
  return normalizeSpec({ theme: active.theme, tokens: w.tokens, layout: w.layout, extras: w.extras, page: w.page, pages: active.pages, tweaks: v.spec.tweaks || [], pageLayout: v.spec.pageLayout, sections: v.spec.sections || [], customCss: v.spec.customCss || '', ops: v.spec.ops || [], htmlEdits: v.spec.htmlEdits || [], ...extra }, DEFAULT_SPEC);
}

function makeVariant(direction, r, home, fontPair) {
  const d = DIRECTIONS[direction];
  const now = new Date().toISOString();
  return {
    id: newId('v'), createdAt: now, updatedAt: now, direction, fontPair, name: d.name, description: d.blurb, rationale: '',
    spec: { tokens: r.tokens, layout: r.layout, extras: {}, pageLayout: r.pageLayout }, page: r.page,
    labels: Object.fromEntries(home.refs.map((x) => [x.ref, x.title])), revisions: [], qa: null, assets: {},
  };
}

function pickDirections(brief, existing, count) {
  const used = new Set(existing.map((v) => v.direction));
  const order = [...new Set([...(brief.ai?.directions || []), ...DEFAULT_DIRECTIONS, ...Object.keys(DIRECTIONS)])];
  const fresh = order.filter((d) => !used.has(d));
  const out = fresh.slice(0, count);
  while (out.length < count) out.push(order[out.length % order.length]); // every direction already used: repeat with another font pair
  return out;
}

// The AI adapts names, wording and typography to the business, staying inside the allowed options. It does not touch colours.
async function tune(slug, brief, variants, instruction) {
  const lines = variants.map((v) => `- id ${v.id}: ${v.name}. ${v.description} Now: heading font ${v.spec.tokens.fontHeading}, body ${v.spec.tokens.fontBody}, case ${v.spec.tokens.headingCase}, radius ${v.spec.tokens.radius}, density ${v.spec.tokens.density}.`).join('\n');
  const user = [
    `Business: ${brief.ai.industry} (${brief.ai.businessType}). Audience: ${brief.ai.audience}. Main goal: ${brief.ai.conversionGoal}. Tone: ${(brief.ai.tone || []).join(', ')}.`,
    brief.ai.typographyNotes && `Type notes: ${brief.ai.typographyNotes}`, instruction && `User instruction: ${instruction}`,
    `Variants to tune:\n${lines}`,
    'Rules: keep each variant\'s character and keep the variants clearly different from each other (different heading fonts and shapes). Change a token only if it fits the business better. Never mention awards, ratings or claims.',
  ].filter(Boolean).join('\n\n');
  try {
    const r = await callTool({ slug, label: 'studio-tune', tool: TUNE_TOOL, maxTokens: 3000, system: 'You are a senior art director adapting design directions to a specific business.', user });
    const byId = new Map((r.input.variants || []).map((x) => [x.id, x]));
    const seenFonts = new Set();
    for (const v of variants) {
      const t = byId.get(v.id);
      if (!t) continue;
      if (t.name) v.name = String(t.name).slice(0, 40);
      if (t.description) v.description = String(t.description).slice(0, 220);
      if (t.rationale) v.rationale = String(t.rationale).slice(0, 220);
      const merged = normalizeSpec({ tokens: { ...v.spec.tokens, ...(t.tokens || {}) } }, DEFAULT_SPEC).tokens;
      if (seenFonts.has(merged.fontHeading) && merged.fontHeading !== v.spec.tokens.fontHeading) continue; // two variants must not share a heading font
      seenFonts.add(merged.fontHeading);
      v.spec.tokens = { ...v.spec.tokens, ...merged, primary: v.spec.tokens.primary, primaryDark: v.spec.tokens.primaryDark, accent: v.spec.tokens.accent, ink: v.spec.tokens.ink, soft: v.spec.tokens.soft };
    }
  } catch (e) { /* the recipes stand on their own; the AI only tunes them */ }
}

// thumbnails of every section, the cover, and the quality score
export async function renderAssets(slug, v) {
  const spec = await specOf(slug, v);
  const { html, result } = await canvasHtml(slug, spec, { origin: portalOrigin(), editor: false });
  const ids = ['header', ...spec.page.sections.filter((s) => !s.hidden).map((s) => s.id), 'footer'];
  const contentFails = (result.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg);
  const out = await inspectPage({ html, outDir: thumbDir(slug, v.id), ids, contentFails });
  v.qa = out.qa;
  v.assets = { thumbs: out.thumbs, cover: true, at: new Date().toISOString(), slots: {}, colourKey: configKey((await loadActive(slug)).spec, await loadConfig(slug)) };
  // the inner page and the contact page of the same design: a cover and a quality score each
  for (const slot of ['inner', 'contact']) {
    if (!(await availableSlots(slug)).includes(slot)) continue;
    try {
      const pg = await canvasHtml(slug, spec, { origin: portalOrigin(), editor: false, slot });
      const o = await inspectPage({ html: pg.html, outDir: thumbDir(slug, v.id), ids: [], coverName: `_cover-${slot}`, contentFails: (pg.result.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg) });
      v.assets.slots[slot] = { cover: true, path: pg.path, qa: o.qa };
    } catch (e) { v.assets.slots[slot] = { cover: false, error: e.message }; }
  }
  return v;
}

export async function generateVariants(slug, { count = 4, directions, instruction = '', onProgress = () => {} } = {}) {
  onProgress({ phase: 'Reading your home page and writing the design brief', done: 0, total: count });
  const home = await homeContent(slug);
  const brief = await ensureBrief(slug);
  const existing = await listJson(slug, 'variants');
  const wanted = (directions?.length ? directions.filter((d) => DIRECTIONS[d]) : pickDirections(brief, existing, count)).slice(0, 8);
  const refs = home.refs.map((r) => r.ref);
  const created = [];
  for (const dir of wanted) {
    const n = [...existing, ...created].filter((v) => v.direction === dir).length;
    created.push(makeVariant(dir, recipe(dir, { brand: brief.brand, refs, fontPair: n }), home, n));
  }
  onProgress({ phase: 'Adapting each direction to this business', done: 0, total: created.length });
  await tune(slug, brief, created, instruction);
  const all = [...existing];
  for (const v of created) { diversify(v, all); all.push(v); }
  for (const v of created) {
    v.page = normalizePage(v.page);
    const s = normalizeSpec({ tokens: v.spec.tokens, layout: v.spec.layout }, DEFAULT_SPEC);
    v.spec = { tokens: s.tokens, layout: s.layout, extras: {}, pageLayout: normalizeSpec({ pageLayout: v.spec.pageLayout }, DEFAULT_SPEC).pageLayout };
    await writeItem(slug, 'variants', v);
  }
  let k = 0;
  for (const v of created) {
    onProgress({ phase: `Drawing and checking “${v.name}” at desktop, tablet and phone sizes`, done: k, total: created.length });
    try { await renderAssets(slug, v); } catch (e) { v.qa = null; v.error = e.message; }
    await writeItem(slug, 'variants', v);
    k += 1;
  }
  onProgress({ phase: 'Done', done: created.length, total: created.length });
  return created;
}

export async function regenerateVariant(slug, id, { instruction = '', onProgress = () => {} } = {}) {
  const v = await readItem(slug, 'variants', id);
  if (!v) throw new Error('Unknown variant');
  const home = await homeContent(slug);
  const brief = await ensureBrief(slug);
  v.revisions = [...(v.revisions || []), { at: new Date().toISOString(), label: instruction ? `Before regenerating: ${instruction.slice(0, 60)}` : 'Before regenerating', name: v.name, description: v.description, spec: v.spec, page: v.page, qa: v.qa }].slice(-10);
  const next = (v.fontPair || 0) + 1;
  const r = recipe(v.direction, { brand: brief.brand, refs: home.refs.map((x) => x.ref), fontPair: next });
  const fresh = makeVariant(v.direction, r, home, next);
  onProgress({ phase: 'Adapting the direction', done: 0, total: 1 });
  await tune(slug, brief, [fresh], instruction);
  const others = (await listJson(slug, 'variants')).filter((o) => o.id !== id);
  diversify(fresh, others);
  Object.assign(v, { fontPair: next, name: fresh.name, description: fresh.description, rationale: fresh.rationale, spec: { tokens: fresh.spec.tokens, layout: fresh.spec.layout, extras: {}, pageLayout: normalizeSpec({ pageLayout: fresh.spec.pageLayout }, DEFAULT_SPEC).pageLayout }, page: normalizePage(fresh.page), labels: fresh.labels, updatedAt: new Date().toISOString() });
  onProgress({ phase: `Drawing and checking “${v.name}”`, done: 0, total: 1 });
  await renderAssets(slug, v);
  await writeItem(slug, 'variants', v);
  return v;
}

export async function restoreRevision(slug, id, index) {
  const v = await readItem(slug, 'variants', id);
  const rev = v?.revisions?.[index];
  if (!rev) throw new Error('That revision was not found');
  v.revisions = [...v.revisions, { at: new Date().toISOString(), label: 'Before restoring an earlier version', name: v.name, description: v.description, spec: v.spec, page: v.page, qa: v.qa }].slice(-10);
  Object.assign(v, { name: rev.name, description: rev.description, spec: rev.spec, page: rev.page, updatedAt: new Date().toISOString() });
  await renderAssets(slug, v);
  await writeItem(slug, 'variants', v);
  return v;
}

export async function duplicateVariant(slug, id) {
  const v = await readItem(slug, 'variants', id);
  if (!v) throw new Error('Unknown variant');
  const copy = { ...JSON.parse(JSON.stringify(v)), id: newId('v'), name: `${v.name} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revisions: [] };
  await fs.cp(thumbDir(slug, id), thumbDir(slug, copy.id), { recursive: true }).catch(() => {});
  await writeItem(slug, 'variants', copy);
  return copy;
}

export const deleteVariant = (slug, id) => deleteItem(slug, 'variants', id);

// every section of every variant, ready to browse
export function libraryOf(variants) {
  const out = [];
  for (const v of variants) {
    const base = { variant: v.id, variantName: v.name, direction: v.direction };
    const has = (id) => Boolean(v.assets?.thumbs?.[id]);
    out.push({ ...base, id: `${v.id}~header`, secId: 'header', ref: 'header', type: 'header', group: 'header', label: 'Header and navigation', style: v.page.header.variant || v.spec.layout.header, thumb: has('header') });
    for (const s of v.page.sections) {
      if (s.hidden) continue;
      const type = typeOfRef(s.ref);
      out.push({ ...base, id: `${v.id}~${s.id}`, secId: s.id, ref: s.ref, type, group: SECTION_TYPES[type].group, label: v.labels?.[s.ref] || SECTION_TYPES[type].label, style: s.variant || v.spec.layout.hero, props: s.props, thumb: has(s.id) });
    }
    out.push({ ...base, id: `${v.id}~footer`, secId: 'footer', ref: 'footer', type: 'footer', group: 'footer', label: 'Footer', style: v.page.footer.variant || v.spec.layout.footer, thumb: has('footer') });
  }
  return out;
}
