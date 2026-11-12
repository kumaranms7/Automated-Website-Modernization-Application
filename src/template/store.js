import fs from 'node:fs/promises';
import path from 'node:path';
import { clientDir, readJson, writeJson } from '../config.js';
import { DEFAULT_SPEC, normalizeSpec } from './spec.js';

// Versioned storage for a site's design spec:
//   template/versions/vN.json   every saved draft (never overwritten)
//   template/current.json       the draft being edited
//   template/final.json         the locked template the site is built with (Steps 5-6 require it)

const dir = (slug) => path.join(clientDir(slug), 'template');

// A site that predates the designer may have a brand.json; carry its colours over as the starting point.
async function legacyBase(slug) {
  const b = await readJson(path.join(clientDir(slug), 'brand.json'), null);
  if (!b) {
    // no saved design yet: the colours the website really shows (template/site-colors.json), else the starter colours
    const site = await readJson(path.join(dir(slug), 'site-colors.json'), null);
    return site?.tokens && Object.keys(site.tokens).length ? normalizeSpec({ tokens: site.tokens }, DEFAULT_SPEC) : DEFAULT_SPEC;
  }
  return normalizeSpec({ tokens: { primary: b.primary, primaryDark: b.primaryDark, accent: b.accent, ink: b.ink, soft: b.soft } }, DEFAULT_SPEC);
}

export async function loadActive(slug) {
  const final = await readJson(path.join(dir(slug), 'final.json'), null);
  if (final) return { spec: normalizeSpec(final, DEFAULT_SPEC), source: 'final' };
  const cur = await readJson(path.join(dir(slug), 'current.json'), null);
  if (cur) return { spec: normalizeSpec(cur, DEFAULT_SPEC), source: 'draft' };
  return { spec: await legacyBase(slug), source: 'default' };
}

// true when the website's template is approved, or when the website is not being given a new template at all
export const templateReady = async (slug) => {
  const { loadClient } = await import('../config.js');
  const { optionsOf } = await import('../options.js');
  return !optionsOf(await loadClient(slug)).template || isFinal(slug);
};

export const isFinal = async (slug) => {
  const type = await readJson(path.join(dir(slug), 'type.json'), null);
  if (type?.type === 'existing') {
    const own = await readJson(path.join(dir(slug), 'own.json'), null);
    return Boolean(own?.enabled && (own.home || own.inner || own.contact));
  }
  return Boolean(await readJson(path.join(dir(slug), 'final.json'), null));
};

// Merge a patch into the working draft and save it as a new version.
// fresh: start from the default design (keeping only the site's colours and chosen preview pages), so nothing of the
// current design is carried over. The previous design stays in the version list.
export async function saveDraft(slug, patch, { note = '', fresh = false } = {}) {
  let { spec: base } = await loadActive(slug);
  if (fresh) {
    const t = base.tokens;
    base = normalizeSpec({ pages: base.pages, brief: base.brief, theme: base.theme, tokens: { primary: t.primary, primaryDark: t.primaryDark, accent: t.accent, ink: t.ink, soft: t.soft } }, DEFAULT_SPEC);
  }
  const versions = await listVersions(slug);
  const version = (versions[0]?.version || 0) + 1;
  const merged = normalizeSpec({
    ...patch,
    tokens: { ...base.tokens, ...(patch.tokens || {}) },
    layout: { ...base.layout, ...(patch.layout || {}) },
    pages: { ...base.pages, ...(patch.pages || {}) },
    extras: patch.extras ? { ...base.extras, ...patch.extras } : base.extras,
    theme: patch.theme === undefined ? base.theme : patch.theme,
    sections: patch.sections ?? base.sections,
    tweaks: patch.tweaks ?? base.tweaks,
    pageLayout: patch.pageLayout ?? base.pageLayout,
    ops: patch.ops ?? base.ops,
    htmlEdits: patch.htmlEdits ?? base.htmlEdits,
    page: patch.page === undefined ? base.page : patch.page,
  }, base);
  const spec = { ...merged, version, status: 'draft', savedAt: new Date().toISOString(), note };
  await writeJson(path.join(dir(slug), 'versions', `v${version}.json`), spec);
  await writeJson(path.join(dir(slug), 'current.json'), spec);
  await fs.rm(path.join(dir(slug), 'final.json'), { force: true }); // editing reopens a finalised template
  return spec;
}

export async function listVersions(slug) {
  const d = path.join(dir(slug), 'versions');
  const out = [];
  for (const f of await fs.readdir(d).catch(() => [])) {
    const s = await readJson(path.join(d, f), null);
    if (s) out.push({ version: s.version, savedAt: s.savedAt, note: s.note || '', name: s.name });
  }
  return out.sort((a, b) => b.version - a.version);
}

export const loadVersion = (slug, n) => readJson(path.join(dir(slug), 'versions', `v${Number(n)}.json`), null);

export async function restoreVersion(slug, n) {
  const s = await loadVersion(slug, n);
  if (!s) throw new Error('Unknown version');
  return saveDraft(slug, s, { note: `Restored from v${n}` });
}

export async function finalise(slug) {
  let { spec, source } = await loadActive(slug);
  if (source === 'default') spec = await saveDraft(slug, {}, { note: 'Starting design accepted' }); // the starting design can be finalised as it is
  const out = { ...spec, status: 'final', finalisedAt: new Date().toISOString() };
  await writeJson(path.join(dir(slug), 'final.json'), out);
  return out;
}

export async function reopen(slug) {
  await fs.rm(path.join(dir(slug), 'final.json'), { force: true });
  return loadActive(slug);
}

export const previewDir = (slug) => path.join(dir(slug), 'preview');
export const refsDir = (slug) => path.join(dir(slug), 'refs');
