import path from 'node:path';
import crypto from 'node:crypto';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { buildTheme, updateTheme, compactTheme, legacyTokens, normaliseBase, MODES, TOKEN_PATHS } from './engine.js';
import { generateThemes, AI_TOOL, AI_SYSTEM, STYLES } from './generate.js';
import { extractBrand } from './extract.js';
import { industryList, INDUSTRIES } from './industry.js';
import { getProfile } from '../profile/store.js';
import { loadActive, saveDraft } from '../template/store.js';
import { callTool } from '../ai/claude.js';
import { toHex } from './color.js';
import { detectSiteColors } from '../template/site-colors.js';

// Themes of one website, kept in clients/<site>/themes.json: the generated ones, the ones made or changed by hand, the imported ones, and
// which one is selected. A theme is saved as its base colours, the tokens set by hand and its labels; everything else is worked out again
// when it is read, so it can never be out of date. Selecting a theme writes it into the template draft (colours and theme), which is
// where every preview and the build read it from: nothing of the layout, the fonts, the spacing or the content is touched.

const file = (slug) => path.join(clientDir(slug), 'themes.json');
const GENERATED = new Set(['extracted', 'industry', 'ai', 'local']);
const FORMAT = 'site-modernizer-theme';

const empty = () => ({ version: 1, activeId: null, themes: [], meta: null, generatedAt: null });
async function load(slug) {
  const s = await readJson(file(slug), null);
  return s && Array.isArray(s.themes) ? s : empty();
}
const save = (slug, s) => writeJson(file(slug), s);
const record = (theme, origin) => ({ ...compactTheme(theme), origin: origin || theme.base });
const uid = (name, base) => `theme-${crypto.createHash('sha1').update(`${name}|${JSON.stringify(base)}|${Date.now()}|${Math.random()}`).digest('hex').slice(0, 8)}`;
const hydrate = (rec) => ({ ...buildTheme(rec), origin: rec.origin || rec.base });

// the selected theme as the template has it (a design saved before themes existed has none)
async function templateTheme(slug) {
  const { spec } = await loadActive(slug);
  return spec.theme ? { ...compactTheme(buildTheme(spec.theme)), origin: spec.theme.base } : null;
}

export async function themeState(slug) {
  const s = await load(slug);
  let themes = s.themes;
  // a theme the template already uses but that is not in the list (selected before, or imported with a design) is added
  const inTemplate = await templateTheme(slug);
  let activeId = s.activeId;
  if (inTemplate && !themes.some((t) => t.id === inTemplate.id)) themes = [inTemplate, ...themes];
  if (inTemplate && !activeId) activeId = inTemplate.id;
  return {
    activeId, themes: themes.map(hydrate), meta: s.meta, generatedAt: s.generatedAt,
    industries: industryList(), styles: STYLES.map(({ id, name, description }) => ({ id, name, description })), hasAi: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}

async function put(slug, rec) {
  const s = await load(slug);
  const i = s.themes.findIndex((t) => t.id === rec.id);
  if (i >= 0) s.themes[i] = rec; else s.themes.push(rec);
  await save(slug, s);
  return rec;
}

// ---------- applying a theme to the template ----------
// The five older colour tokens follow the theme (the sections read them), and the theme itself is kept in the design for the new variables.
export async function applyToTemplate(slug, theme, note) {
  const t = buildTheme(theme);
  return saveDraft(slug, { tokens: legacyTokens(t), theme: compactTheme(t) }, { note: note || `Theme: ${t.name}` });
}

// ---------- generating ----------
export async function generate(slug, opts = {}) {
  const client = await loadClient(slug);
  if (!client) throw new Error('Unknown website');
  const profile = await getProfile(slug).catch(() => null);
  let brand = null;
  // how the pages are drawn in the browser tells the brand colour from the many others (read once, when Edge is available)
  if (opts.strategy !== 'industry') { try { await detectSiteColors(slug); } catch { /* no browser or no scan: the files and the industry are used */ } }
  try { brand = await extractBrand(slug); } catch { /* a website that was not scanned has no colours to read: the industry is used */ }
  const callAi = process.env.ANTHROPIC_API_KEY ? async (prompt) => (await callTool({ slug, label: 'theme-colors', system: AI_SYSTEM, user: prompt, tool: AI_TOOL, maxTokens: 2500 })).input : null;
  const mode = MODES.includes(opts.mode) ? opts.mode : 'light';
  const result = await generateThemes({ name: client.name, host: client.host, profile, brand, callAi }, { ...opts, mode, industryId: INDUSTRIES[opts.industry] ? opts.industry : '' });
  const s = await load(slug);
  const inTemplate = await templateTheme(slug);
  const activeId = s.activeId || inTemplate?.id || null;
  // the earlier generated themes are replaced; the ones made by hand, imported ones and the selected one stay
  const keep = s.themes.filter((t) => !GENERATED.has(t.source) || t.id === activeId);
  if (inTemplate && inTemplate.id === activeId && !keep.some((t) => t.id === activeId)) keep.unshift(inTemplate);
  const fresh = result.themes.filter((t) => !keep.some((k) => k.id === t.id)).map((t) => record(t));
  const next = { ...s, version: 1, activeId, themes: [...fresh, ...keep], generatedAt: new Date().toISOString(), meta: { ...result.meta, brand: brand ? { found: brand.found, primary: brand.primary?.hex || null, secondary: brand.secondary?.hex || null, accent: brand.accent?.hex || null, neutral: brand.neutral?.hex || null, background: brand.background?.hex || null, logo: brand.logo.map((c) => c.hex), sources: brand.sources } : null } };
  await save(slug, next);
  return { ...(await themeState(slug)), warnings: result.meta.warnings };
}

// ---------- one theme ----------
export async function getTheme(slug, id) {
  const st = await themeState(slug);
  const t = st.themes.find((x) => x.id === id);
  if (!t) throw new Error('That theme was not found.');
  return t;
}

export async function createTheme(slug, input = {}) {
  const base = normaliseBase(input.base || {});
  const t = buildTheme({ id: uid(input.name || 'Custom', base), name: String(input.name || 'My theme').trim() || 'My theme', description: input.description, category: input.category, style: input.style, source: 'custom', mode: input.mode, base, overrides: input.overrides });
  await put(slug, record(t));
  return hydrate(record(t));
}

// patch: { name, description, mode, base: {primary,...}, tokens: { 'text.heading': '#...' | null }, editMode, clearOverrides }
export async function updateThemeRecord(slug, id, patch) {
  const st = await themeState(slug);
  const cur = st.themes.find((t) => t.id === id);
  if (!cur) throw new Error('That theme was not found.');
  const next = updateTheme(cur, patch || {});
  const rec = record(next, cur.origin);
  await put(slug, rec);
  // the selected theme: the template follows
  if (st.activeId === id) await applyToTemplate(slug, next);
  return hydrate(rec);
}

export async function duplicateTheme(slug, id) {
  const cur = await getTheme(slug, id);
  const copy = buildTheme({ ...compactTheme(cur), id: uid(cur.name, cur.base), name: `${cur.name} copy`.slice(0, 60), source: 'custom' });
  await put(slug, record(copy, cur.origin));
  return hydrate(record(copy, cur.origin));
}

export async function deleteTheme(slug, id) {
  const s = await load(slug);
  const st = await themeState(slug);
  if (st.activeId === id) throw new Error('This theme is selected. Select another theme first, then delete it.');
  if (!st.themes.some((t) => t.id === id)) throw new Error('That theme was not found.');
  s.themes = s.themes.filter((t) => t.id !== id);
  await save(slug, s);
  return themeState(slug);
}

export async function selectTheme(slug, id) {
  const st = await themeState(slug);
  const t = st.themes.find((x) => x.id === id);
  if (!t) throw new Error('That theme was not found.');
  const s = await load(slug);
  if (!s.themes.some((x) => x.id === id)) s.themes.push(record(t, t.origin));
  s.activeId = id;
  await save(slug, s);
  const spec = await applyToTemplate(slug, t);
  return { state: await themeState(slug), spec };
}

// back to the colours the theme was made with: the base colours and no hand-set tokens
export async function resetTheme(slug, id) {
  const cur = await getTheme(slug, id);
  return updateThemeRecord(slug, id, { base: cur.origin, clearOverrides: true });
}

// ---------- export and import ----------
export async function exportTheme(slug, id) {
  const t = await getTheme(slug, id);
  return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), theme: compactTheme(t), tokens: { light: t.light, dark: t.dark }, scales: t.scales };
}

// Accepts an export of this platform, a saved theme, or the plain shape { brand: {...}, background: {...}, text: {...}, surface, border, status }.
export function themeFromJson(json) {
  let data = json;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { throw new Error('That file is not valid JSON.'); } }
  if (!data || typeof data !== 'object') throw new Error('That file does not hold a theme.');
  if (data.format === FORMAT && data.theme) data = data.theme;
  const input = { name: data.name, description: data.description, category: data.category, style: data.style, mode: data.mode, source: 'imported' };
  const plain = {};
  if (data.base && (data.base.primary || data.base.secondary)) input.base = data.base;
  else if (data.brand?.primary) {
    input.base = { primary: data.brand.primary, secondary: data.brand.secondary, accent: data.brand.accent, neutral: data.text?.secondary || data.text?.primary, background: data.background?.default || data.background?.main };
    // what the file sets outright is kept as hand-set tokens
    const map = { 'background.alternate': data.background?.alternate, 'background.dark': data.background?.dark, 'text.primary': data.text?.primary, 'text.secondary': data.text?.secondary, 'text.inverse': data.text?.inverse, 'surface.card': data.surface?.default, 'surface.cardHover': data.surface?.muted, 'border.default': data.border?.default, 'border.strong': data.border?.strong, 'status.success': data.status?.success, 'status.warning': data.status?.warning, 'status.error': data.status?.error, 'status.info': data.status?.info };
    for (const [k, v] of Object.entries(map)) if (v && toHex(v)) plain[k] = toHex(v);
  } else throw new Error('That file has no theme colours (a primary colour is needed).');
  if (!toHex(input.base.primary)) throw new Error('The primary colour in that file is not a valid colour.');
  const overrides = { light: { ...(data.overrides?.light || {}), ...plain }, dark: { ...(data.overrides?.dark || {}) } };
  for (const m of ['light', 'dark']) for (const k of Object.keys(overrides[m])) if (!TOKEN_PATHS.includes(k) || !toHex(overrides[m][k])) delete overrides[m][k];
  return { ...input, overrides };
}

export async function importTheme(slug, json) {
  const input = themeFromJson(json);
  const base = normaliseBase(input.base);
  const t = buildTheme({ ...input, id: uid(input.name || 'Imported', base), name: String(input.name || 'Imported theme').slice(0, 60), base });
  await put(slug, record(t));
  return hydrate(record(t));
}
