import path from 'node:path';
import { loadSiteColors } from './site-colors.js';
import { clientDir, readJson, writeJson } from '../config.js';
import { buildClient } from '../build/build.js';
import { collectSections, setKindPool } from '../kit/fit.js';
import { innerKinds } from '../kit/kinds.js';
import { OPTIONS, FONT_CATALOG } from './spec.js';
import { loadActive, saveDraft, listVersions, finalise, reopen, isFinal } from './store.js';
import { suggestPages } from './suggest.js';
import { listRefs } from './design.js';
import { getTemplateType } from './families.js';

const previewState = (slug) => path.join(clientDir(slug), 'template', 'preview-state.json');

export async function templateState(slug) {
  const { spec, source } = await loadActive(slug);
  const sugg = await suggestPages(slug);
  const prev = await readJson(previewState(slug), null);
  return {
    spec, source, final: await isFinal(slug), templateType: await getTemplateType(slug), siteColors: await loadSiteColors(slug),
    versions: await listVersions(slug),
    refs: await listRefs(slug),
    suggestions: sugg,
    options: OPTIONS,
    fonts: Object.entries(FONT_CATALOG).map(([name, f]) => ({ name, kind: f.kind, heading: f.role.includes('h'), body: f.role.includes('b') })),
    preview: prev && prev.version === spec.version ? prev : null,
  };
}

// The three pages the template is designed on: chosen by the user, else suggested.
export async function chosenPages(slug) {
  const { spec } = await loadActive(slug);
  const s = await suggestPages(slug);
  const known = new Set(s.all.map((p) => p.path));
  const pick = (slot) => (spec.pages[slot] && known.has(spec.pages[slot]) ? spec.pages[slot] : s[slot].pick?.path || '');
  return { home: pick('home'), inner: pick('inner'), contact: pick('contact') };
}

// Builds just those pages with the working draft into template/preview, so they can be compared with the originals.
async function migrateChoices(slug, spec, inner, list) {
  const here = spec.kit?.pageSections?.[inner] || {};
  const kinds = { ...(spec.kit?.kinds || {}) }, mine = { ...here };
  let changed = false;
  for (const e of list) {
    const c = here[e.key];
    if (!c || !e.kind || e.hero || !(c.role || c.variant || c.tone)) continue;
    if (!kinds[e.kind]) kinds[e.kind] = { ...(c.role ? { role: c.role } : {}), ...(c.variant ? { variant: c.variant } : {}), ...(c.tone ? { tone: c.tone } : {}) };
    const rest = { ...c }; delete rest.role; delete rest.variant; delete rest.tone;
    if (Object.keys(rest).length) mine[e.key] = rest; else delete mine[e.key];
    changed = true;
  }
  if (!changed) return false;
  await saveDraft(slug, { kit: { ...spec.kit, kinds, pageSections: { ...spec.kit.pageSections, [inner]: mine } } }, { note: 'Layouts of the inner page set for their kind of section' });
  return true;
}

export async function previewTemplate(slug, opts = {}) {
  const { spec } = await loadActive(slug);
  const pages = await chosenPages(slug);
  const only = [...new Set(Object.values(pages).filter(Boolean))];
  if (!only.length) throw new Error('No pages selected for the preview');
  // the template's inner page shows every kind of section found on the website's inner pages, not only those of the page it is designed on
  let kinds = null;
  if (spec.kit?.design && pages.inner) { try { kinds = await innerKinds(slug, { ...spec, pages: { ...spec.pages, home: pages.home, contact: pages.contact } }); setKindPool({ page: pages.inner, kinds: kinds.kinds.map((k) => ({ id: k.id, label: k.label, role: k.role, count: k.count, pages: k.pages.slice(0, 8), s: k.s })) }); } catch { setKindPool(null); } }
  const sections = collectSections(true);
  let report;
  try { report = await buildClient(slug, { only, content: 'none', spec, outName: 'template/preview' }); } finally { collectSections(false); setKindPool(null); }
  await writeJson(path.join(path.dirname(previewState(slug)), 'preview-sections.json'), sections);
  // layouts chosen for single sections of the inner page before kinds existed become the layout of their kind (the first one found wins)
  if (!opts.migrated && kinds && pages.inner && (await migrateChoices(slug, spec, pages.inner, sections[pages.inner] || []))) return previewTemplate(slug, { migrated: true });
  const results = report.results.map((r) => ({ path: r.path, layout: r.layout, status: r.status, issues: (r.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg) }));
  const state = {
    version: spec.version, at: new Date().toISOString(), pages,
    results, fails: results.filter((r) => r.status === 'fail' || r.status === 'skipped').length,
    kinds: kinds ? { pages: kinds.pages, count: kinds.kinds.length } : null,
    missing: Object.entries(pages).filter(([, p]) => !p).map(([k]) => k),
  };
  await writeJson(previewState(slug), state);
  return state;
}

export async function finaliseTemplate(slug) {
  const { spec } = await loadActive(slug);
  const st = await readJson(previewState(slug), null);
  if (!st || st.version !== spec.version) throw new Error('Preview the current version before finalising it');
  if (spec.kit?.design && !st.kinds) throw new Error('Preview again: the inner page template has to show every kind of section of the website.');
  if (st.fails) throw new Error('A previewed page has failed checks. Fix the design or choose different pages.');
  if (st.missing.includes('inner')) throw new Error('Choose an inner page to preview');
  return finalise(slug);
}

export { saveDraft, reopen };
