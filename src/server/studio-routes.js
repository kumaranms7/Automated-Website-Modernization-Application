import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import path from 'node:path';
import { loadClient, clientDir } from '../config.js';
import { FONT_DIR_PATH, DEFAULT_SPEC, normalizeSpec, normalizePage, OPTIONS, FONT_CATALOG, PAGE_LAYOUT_KEYS, themeOf } from '../template/spec.js';
import { SECTION_TYPES, LIBRARY_GROUPS, SECTION_PROPS, PROPS_FOR, HEADER_STYLES, FOOTER_STYLES } from '../template/section-meta.js';
import { saveDraft } from '../template/store.js';
import { templateState } from '../template/api.js';
import { DIRECTIONS } from '../studio/directions.js';
import { readBrief, listJson, readItem, writeItem, deleteItem, newId, readSaved, writeSaved } from '../studio/files.js';
import { ensureBrief, syncedBrief } from '../studio/brief.js';
import { generateVariants, regenerateVariant, restoreRevision, duplicateVariant, deleteVariant, libraryOf, specOf, renderAssets } from '../studio/variants.js';
import { wear, configKey, loadConfig } from '../studio/wear.js';
import { canvasHtml, portalOrigin, availableSlots } from '../studio/canvas.js';
import { inspectPage } from '../studio/shots.js';
import { WEIGHTS } from '../studio/qa.js';
import { proposeChange } from '../studio/refine.js';
import { proposePageChange } from '../studio/refine-page.js';
import { prettyHtml, sanitizeSection, sanitizeChrome, canonUrls, FORM_MARK } from '../template/html-ops.js';
import { extractModel } from '../build/model.js';
import { readSource } from '../util/source.js';
import { exportPage } from '../studio/export.js';

// The design studio's HTTP API: brief, variants, section library, composed pages, quality checks, refinement and export.

const jobs = new Map();
function startJob(slug, label, fn) {
  if (jobs.get(slug)?.running) throw new Error('The studio is already busy with another task. Wait for it to finish.');
  const j = { running: true, label, phase: 'Starting', done: 0, total: 0, error: null, startedAt: new Date().toISOString(), finishedAt: null, created: [] };
  jobs.set(slug, j);
  fn((p) => Object.assign(j, p)).then((r) => { j.created = [].concat(r || []).map((x) => x?.id).filter(Boolean); j.phase = 'Done'; }).catch((e) => { j.error = e.message; }).finally(() => { j.running = false; j.finishedAt = new Date().toISOString(); });
  return j;
}

const variantSummary = (v) => ({
  id: v.id, name: v.name, direction: v.direction, description: v.description, rationale: v.rationale, createdAt: v.createdAt, updatedAt: v.updatedAt,
  cover: Boolean(v.assets?.cover), at: v.assets?.at || '', error: v.error || '',
  qa: v.qa ? { total: v.qa.total, parts: v.qa.parts, issues: v.qa.issues } : null,
  tokens: v.spec.tokens, colours: [v.spec.tokens.primary, v.spec.tokens.primaryDark, v.spec.tokens.accent, v.spec.tokens.soft], fonts: [v.spec.tokens.fontHeading, v.spec.tokens.fontBody],
  hero: v.page.sections.find((s) => s.ref === 'hero')?.variant || v.spec.layout.hero, header: v.page.header.variant || v.spec.layout.header, footer: v.page.footer.variant || v.spec.layout.footer,
  layout: v.spec.layout, pageLayout: v.spec.pageLayout || { inner: {}, contact: {} },
  slots: Object.fromEntries(Object.entries(v.assets?.slots || {}).map(([k, s]) => [k, { cover: Boolean(s.cover), error: s.error || '', qa: s.qa ? { total: s.qa.total, parts: s.qa.parts, issues: s.qa.issues } : null }])),
  cards: v.spec.layout.cardLayout, sections: v.page.sections.map((s) => ({ id: s.id, ref: s.ref, variant: s.variant })),
  revisions: (v.revisions || []).map((r, i) => ({ i, at: r.at, label: r.label, name: r.name })),
});
const pageSummary = (p) => ({ id: p.id, name: p.name, from: p.from, createdAt: p.createdAt, updatedAt: p.updatedAt, sections: p.page.sections.length, qa: p.qa ? { total: p.qa.total } : null, revisions: (p.revisions || []).length });

// the design system and the page as the editor sends them, made safe
const specFromBody = async (slug, body) => specOf(slug, { spec: { tokens: body.spec?.tokens || {}, layout: body.spec?.layout || {}, extras: body.spec?.extras || {}, tweaks: body.spec?.tweaks || [], pageLayout: body.spec?.pageLayout, sections: body.spec?.sections || [], customCss: body.spec?.customCss || '', ops: body.spec?.ops || [], htmlEdits: body.spec?.htmlEdits || [] }, page: body.page });
const slotOf = (b) => (['inner', 'contact'].includes(b?.slot) ? b.slot : 'home');
// the sections of a drawn inner or contact page, for the editor's outline
function outlineOf(html) {
  const $ = cheerio.load(html);
  return $('main > [data-sec]').toArray().map((n) => { const e = $(n); return { id: e.attr('data-sec'), label: e.find('h1,h2,h3').first().text().replace(/\s+/g, ' ').trim().slice(0, 60) || (e.find('form').length ? 'Form' : 'Content') }; });
}

// the page's protected contact form embed (exact original markup), or ''
async function embedOf(slug, file) {
  try { const c = await loadClient(slug); return extractModel(await readSource(c, file), file).protected.form || ''; } catch { return ''; }
}

// the section's markup as the design draws it, before structure changes, class tweaks and extras (those apply on top of an edit)
async function sectionMarkup(slug, body) {
  const slot = slotOf(body), id = String(body.sectionId || '');
  const spec = await specFromBody(slug, body);
  if (id === 'header' || id === 'footer') {
    const own = spec.page?.[id]?.html;
    if (own) return { html: prettyHtml(own), edited: true };
    const m = `[data-sec="${id}"]`;
    const probeSpec = normalizeSpec({ ...spec, page: { ...spec.page, [id]: { ...spec.page[id], html: '' } }, tweaks: spec.tweaks.filter((t) => !t.selector.includes(m)), ops: spec.ops.filter((o) => !o.selector.includes(m)) }, spec);
    const shown = await canvasHtml(slug, probeSpec, { origin: '', editor: false, slot });
    const $ = cheerio.load(shown.html);
    const el = $(`${id}[data-sec="${id}"]`).first()[0];
    if (!el) throw new Error(`The ${id} was not found on the page`);
    const run = [el];
    if (id === 'header') {
      let p = el.prev;
      while (p && p.type === 'text') p = p.prev;
      if (p && p.name === 'a' && p.attribs?.href === '#main') run.unshift(p); // the skip link belongs to the header
    } else {
      for (let n = el.next; n; n = n.next) { if (n.type === 'tag' && n.name === 'script') break; if (n.type === 'tag') run.push(n); } // the mobile call bar, back-to-top and floating buttons
    }
    const frag = cheerio.load($.html(run), null, false);
    frag('[data-sec]').removeAttr('data-sec');
    return { html: prettyHtml(canonUrls(frag.html())), edited: false };
  }
  const num = /^s\d+$/.test(id) ? Number(id.slice(1)) : 0;
  const mark = `[data-sec="${id}"]`;
  let probe;
  if (slot === 'home') {
    const sec = spec.page.sections.find((x) => x.id === id);
    if (!sec) throw new Error('Select a section first');
    if (sec.html) return { html: prettyHtml(sec.html), edited: true };
    probe = normalizeSpec({ ...spec, page: { ...spec.page, sections: spec.page.sections.map((x) => (x.id === id ? { ...x, html: '', ops: [], tweaks: [], extra: null, css: '' } : x)) } }, spec);
  } else {
    if (!num) throw new Error('Select a section of the page first');
    probe = normalizeSpec({
      ...spec,
      htmlEdits: [], sections: spec.sections.filter((x) => !(x.layout === slot && x.index === num)),
      tweaks: spec.tweaks.filter((t) => !t.selector.includes(mark)), ops: spec.ops.filter((o) => !o.selector.includes(mark)),
    }, spec);
  }
  const drawn = await canvasHtml(slug, probe, { origin: '', editor: false, slot });
  const made = slot !== 'home' ? spec.htmlEdits.find((e) => e.layout === slot && e.file === drawn.path && e.index === num) : null;
  if (made) return { html: prettyHtml(made.html), edited: true };
  const $ = cheerio.load(drawn.html);
  const kids = $('main').children().toArray();
  const i = kids.findIndex((k) => $(k).attr('data-sec') === id);
  if (i < 0) throw new Error('That section is not on the page');
  const run = [kids[i]];
  for (let j = i + 1; j < kids.length && !$(kids[j]).attr('data-sec'); j += 1) run.push(kids[j]);
  const frag = cheerio.load($.html(run), null, false);
  frag('[data-sec],[data-ref]').removeAttr('data-sec').removeAttr('data-ref');
  frag('section[style*="--brand"]').removeAttr('style');
  // the form embed is shown as a locked placeholder: the exact original is put back when the page is drawn
  let markup = frag.html();
  const form = (await embedOf(slug, drawn.path)).trim();
  if (form) markup = markup.replace(new RegExp(form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')), () => FORM_MARK);
  return { html: prettyHtml(markup), edited: false };
}

export function mountStudio(app, wrap) {
  const B = '/api/clients/:slug/studio';
  app.use(B, async (req, res, next) => {
    try { if (!(await loadClient(req.params.slug))) throw new Error('Unknown website'); next(); } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // fonts for the editor canvas and the screenshot browser
  app.get('/studio-fonts/:file', (req, res) => {
    if (!/^[\w.-]+\.woff2$/.test(req.params.file)) return res.sendStatus(404);
    res.set('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(FONT_DIR_PATH, req.params.file), (e) => { if (e) res.sendStatus(404); });
  });

  // every catalogue font as @font-face, for the small live previews on the Configuration tab
  app.get('/studio-fonts.css', (req, res) => {
    const faces = [];
    for (const [family, f] of Object.entries(FONT_CATALOG)) for (const [w, file] of Object.entries(f.weights)) faces.push(`@font-face{font-family:"${family}";font-weight:${w};font-style:normal;src:url(/studio-fonts/${file}) format("woff2");font-display:swap}`);
    res.type('text/css').send(faces.join('\n'));
  });

  app.get(B, wrap(async (req, res) => {
    const slug = req.params.slug;
    const variants = await listJson(slug, 'variants');
    const { spec: active } = await (await import('../template/store.js')).loadActive(slug);
    const cfg = await loadConfig(slug);
    const key = configKey(active, cfg);
    // the colours shown are those of the selected theme, the same ones as in Configuration > Design settings
    const th = themeOf(active), lt = th.light;
    const palette = [['Primary', th.base.primary], ['Secondary', th.base.secondary], ['Accent', th.base.accent], ['Background', lt.background.main], ['Text', lt.text.primary]].map(([name, hex]) => ({ name, hex }));
    res.json({
      palette,
      brief: await syncedBrief(slug),
      // a variant shows the colours of the selected theme; one drawn with other colours is stale until it is redrawn
      variants: variants.map((v) => ({ ...variantSummary({ ...v, ...(({ tokens, layout, extras, page }) => ({ page, spec: { ...v.spec, tokens, layout, extras } }))(wear(v, active, cfg)) }), colours: palette.map((p) => p.hex), stale: Boolean(v.assets?.cover) && v.assets.colourKey !== key })),
      library: libraryOf(variants),
      pages: (await listJson(slug, 'pages')).map(pageSummary),
      saved: await readSaved(slug),
      job: jobs.get(slug) || null,
      slots: await availableSlots(slug),
      meta: { pageLayoutKeys: PAGE_LAYOUT_KEYS, types: SECTION_TYPES, groups: LIBRARY_GROUPS, props: SECTION_PROPS, propsFor: PROPS_FOR, header: HEADER_STYLES, footer: FOOTER_STYLES, weights: WEIGHTS, options: OPTIONS, directions: Object.fromEntries(Object.entries(DIRECTIONS).map(([k, d]) => [k, { name: d.name, blurb: d.blurb }])), fonts: Object.entries(FONT_CATALOG).map(([name, f]) => ({ name, kind: f.kind, heading: f.role.includes('h'), body: f.role.includes('b') })) },
    });
  }));
  app.get(`${B}/job`, wrap(async (req, res) => res.json(jobs.get(req.params.slug) || { running: false })));

  // brief
  app.post(`${B}/brief`, wrap(async (req, res) => res.json(await ensureBrief(req.params.slug, { refresh: true }))));

  // variants
  app.post(`${B}/variants`, wrap(async (req, res) => {
    const count = Math.max(1, Math.min(8, Number(req.body?.count) || 4));
    res.json(startJob(req.params.slug, `Generating ${count} design variant${count === 1 ? '' : 's'}`, (progress) => generateVariants(req.params.slug, { count, directions: req.body?.directions, instruction: String(req.body?.instruction || ''), onProgress: progress })));
  }));
  // redraw and re-score variants (all, or one) without changing them
  app.post(`${B}/recheck`, wrap(async (req, res) => {
    const slug = req.params.slug;
    const key = configKey((await (await import('../template/store.js')).loadActive(slug)).spec, await loadConfig(slug));
    const all = await listJson(slug, 'variants');
    const ids = req.body?.id ? [req.body.id] : all.filter((v) => !req.body?.staleOnly || v.assets?.colourKey !== key).map((v) => v.id);
    res.json(startJob(slug, 'Re-checking design variants', async (progress) => {
      let k = 0;
      for (const id of ids) {
        const v = await readItem(slug, 'variants', id);
        if (!v) continue;
        progress({ phase: `Drawing and checking “${v.name}”`, done: k, total: ids.length });
        try { await renderAssets(slug, v); v.error = ''; } catch (e) { v.error = e.message; }
        await writeItem(slug, 'variants', v);
        k += 1;
      }
      progress({ phase: 'Done', done: ids.length, total: ids.length });
    }));
  }));
  app.post(`${B}/variants/:id/regenerate`, wrap(async (req, res) => res.json(startJob(req.params.slug, 'Regenerating a variant', (progress) => regenerateVariant(req.params.slug, req.params.id, { instruction: String(req.body?.instruction || ''), onProgress: progress })))));
  app.post(`${B}/variants/:id/duplicate`, wrap(async (req, res) => res.json(variantSummary(await duplicateVariant(req.params.slug, req.params.id)))));
  app.post(`${B}/variants/:id/restore`, wrap(async (req, res) => res.json(variantSummary(await restoreRevision(req.params.slug, req.params.id, Number(req.body?.index))))));
  app.put(`${B}/variants/:id`, wrap(async (req, res) => {
    const v = await readItem(req.params.slug, 'variants', req.params.id);
    if (!v) throw new Error('Unknown variant');
    if (req.body?.name) v.name = String(req.body.name).slice(0, 40);
    v.updatedAt = new Date().toISOString();
    await writeItem(req.params.slug, 'variants', v);
    res.json(variantSummary(v));
  }));
  app.delete(`${B}/variants/:id`, wrap(async (req, res) => { await deleteVariant(req.params.slug, req.params.id); res.json({ deleted: req.params.id }); }));
  app.get(`${B}/variants/:id`, wrap(async (req, res) => {
    const v = await readItem(req.params.slug, 'variants', req.params.id);
    if (!v) throw new Error('Unknown variant');
    res.json(v);
  }));
  app.get(`${B}/thumb/:variant/:file`, (req, res) => {
    if (!/^[\w-]+$/.test(req.params.variant) || !/^[\w-]+\.jpg$/.test(req.params.file)) return res.sendStatus(404);
    res.sendFile(path.join(clientDir(req.params.slug), 'studio', 'thumbs', req.params.variant, req.params.file), (e) => { if (e) res.sendStatus(404); });
  });

  // the canvas and quality checks for any page the editor holds (nothing needs saving first)
  app.post(`${B}/render`, wrap(async (req, res) => {
    const spec = await specFromBody(req.params.slug, req.body);
    const slot = slotOf(req.body);
    const { html, result, path: file } = await canvasHtml(req.params.slug, spec, { origin: '', editor: req.body.editor !== false, slot });
    res.json({ html, slot, file, outline: slot === 'home' ? null : outlineOf(html), contentFails: (result.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg) });
  }));
  app.post(`${B}/qa`, wrap(async (req, res) => {
    const spec = await specFromBody(req.params.slug, req.body);
    const { html, result } = await canvasHtml(req.params.slug, spec, { origin: portalOrigin(), editor: false, slot: slotOf(req.body) });
    const out = await inspectPage({ html, contentFails: (result.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg) });
    if (req.body.pageId) {
      const p = await readItem(req.params.slug, 'pages', req.body.pageId);
      if (p) { p.qa = out.qa; await writeItem(req.params.slug, 'pages', p); }
    }
    res.json(out.qa);
  }));

  // composed pages (templates)
  app.post(`${B}/pages`, wrap(async (req, res) => {
    const slug = req.params.slug;
    const v = req.body?.fromVariant ? await readItem(slug, 'variants', req.body.fromVariant) : null;
    if (req.body?.fromVariant && !v) throw new Error('Unknown variant');
    const { spec: active } = await (await import('../template/store.js')).loadActive(slug);
    const now = new Date().toISOString();
    const worn = v ? wear(v, active, await loadConfig(slug)) : null;
    const item = {
      id: newId('p'), name: String(req.body?.name || (v ? `${v.name} template` : 'New template')).slice(0, 60), from: v?.id || '', createdAt: now, updatedAt: now,
      spec: v ? { tokens: worn.tokens, layout: worn.layout, extras: worn.extras, tweaks: [], pageLayout: v.spec.pageLayout || { inner: {}, contact: {} }, sections: [] } : { tokens: active.tokens, layout: active.layout, extras: active.extras, tweaks: [], pageLayout: active.pageLayout, sections: [] },
      page: v ? worn.page : null, revisions: [], qa: null,
    };
    if (!item.page) { const { homeContent } = await import('../studio/home.js'); const home = await homeContent(slug); item.page = normalizePage({ sections: home.refs.map((r) => ({ ref: r.ref })) }); }
    await writeItem(slug, 'pages', item);
    res.json(item);
  }));
  app.get(`${B}/pages/:id`, wrap(async (req, res) => {
    const p = await readItem(req.params.slug, 'pages', req.params.id);
    if (!p) throw new Error('Unknown template');
    res.json(p);
  }));
  app.put(`${B}/pages/:id`, wrap(async (req, res) => {
    const slug = req.params.slug;
    const p = await readItem(slug, 'pages', req.params.id);
    if (!p) throw new Error('Unknown template');
    const spec = await specFromBody(slug, req.body);
    p.revisions = [...(p.revisions || []), { at: p.updatedAt, label: String(req.body.label || 'Saved').slice(0, 80), spec: p.spec, page: p.page }].slice(-60);
    p.spec = { tokens: spec.tokens, layout: spec.layout, extras: spec.extras, tweaks: spec.tweaks, pageLayout: spec.pageLayout, sections: spec.sections, customCss: spec.customCss, ops: spec.ops, htmlEdits: spec.htmlEdits };
    p.page = spec.page;
    if (req.body.name) p.name = String(req.body.name).slice(0, 60);
    p.updatedAt = new Date().toISOString();
    await writeItem(slug, 'pages', p);
    res.json(pageSummary(p));
  }));
  app.post(`${B}/pages/:id/duplicate`, wrap(async (req, res) => {
    const p = await readItem(req.params.slug, 'pages', req.params.id);
    if (!p) throw new Error('Unknown template');
    const now = new Date().toISOString();
    const copy = { ...JSON.parse(JSON.stringify(p)), id: newId('p'), name: `${p.name} copy`, createdAt: now, updatedAt: now, revisions: [] };
    await writeItem(req.params.slug, 'pages', copy);
    res.json(pageSummary(copy));
  }));
  app.delete(`${B}/pages/:id`, wrap(async (req, res) => { await deleteItem(req.params.slug, 'pages', req.params.id); res.json({ deleted: req.params.id }); }));
  app.get(`${B}/pages/:id/revisions`, wrap(async (req, res) => {
    const p = await readItem(req.params.slug, 'pages', req.params.id);
    res.json((p?.revisions || []).map((r, i) => ({ i, at: r.at, label: r.label })).reverse());
  }));
  app.post(`${B}/pages/:id/restore`, wrap(async (req, res) => {
    const p = await readItem(req.params.slug, 'pages', req.params.id);
    const rev = p?.revisions?.[Number(req.body?.index)];
    if (!rev) throw new Error('That revision was not found');
    p.revisions = [...p.revisions, { at: p.updatedAt, label: 'Before restoring an earlier revision', spec: p.spec, page: p.page }].slice(-60);
    p.spec = rev.spec; p.page = rev.page; p.updatedAt = new Date().toISOString();
    await writeItem(req.params.slug, 'pages', p);
    res.json(p);
  }));

  // use the composed page as the website's template (the rest of the workflow then builds every page with it)
  app.post(`${B}/pages/:id/apply`, wrap(async (req, res) => {
    const slug = req.params.slug;
    const p = await readItem(slug, 'pages', req.params.id);
    if (!p) throw new Error('Unknown template');
    await saveDraft(slug, { name: p.name, tokens: p.spec.tokens, layout: p.spec.layout, extras: p.spec.extras, tweaks: p.spec.tweaks || [], pageLayout: p.spec.pageLayout || { inner: {}, contact: {} }, sections: p.spec.sections || [], customCss: p.spec.customCss || '', ops: p.spec.ops || [], htmlEdits: p.spec.htmlEdits || [], page: p.page }, { note: `Composed template “${p.name}”`, fresh: true });
    res.json(await templateState(slug));
  }));

  // AI refinement of one section: a proposal (structured property changes) that the user accepts or rejects
  app.post(`${B}/refine`, wrap(async (req, res) => res.json(await (slotOf(req.body) === 'home' ? proposeChange : proposePageChange)(req.params.slug, { page: req.body.page, spec: req.body.spec, sectionId: String(req.body.sectionId || ''), slot: slotOf(req.body), instruction: String(req.body.instruction || '') }))));

  // hand-edited HTML for one section
  app.post(`${B}/section-html`, wrap(async (req, res) => res.json(await sectionMarkup(req.params.slug, req.body))));
  app.post(`${B}/html-edit`, wrap(async (req, res) => {
    const slug = req.params.slug, slot = slotOf(req.body), id = String(req.body.sectionId || '');
    const raw = String(req.body.html || '').trim();
    const chrome = id === 'header' || id === 'footer';
    const clean = raw ? (chrome ? sanitizeChrome(canonUrls(raw), id) : sanitizeSection(raw)) : '';
    if (raw && !clean) return res.json({ ok: false, error: `The HTML must contain a <${chrome ? id : 'section'}> element.` });
    const spec = await specFromBody(slug, req.body);
    const before = await canvasHtml(slug, spec, { origin: '', editor: false, slot });
    let cand, out;
    if (chrome) {
      cand = normalizeSpec({ ...spec, page: { ...spec.page, [id]: { ...spec.page[id], html: clean } } }, spec);
      out = { page: cand.page, patch: null };
    } else if (slot === 'home') {
      if (!spec.page.sections.some((x) => x.id === id)) throw new Error('Select a section first');
      cand = normalizeSpec({ ...spec, page: { ...spec.page, sections: spec.page.sections.map((x) => (x.id === id ? { ...x, html: clean } : x)) } }, spec);
      out = { page: cand.page, patch: null };
    } else {
      const num = /^s\d+$/.test(id) ? Number(id.slice(1)) : 0;
      if (!num) throw new Error('Select a section of the page first');
      const edits = spec.htmlEdits.filter((e) => !(e.layout === slot && e.file === before.path && e.index === num));
      if (clean) edits.push({ layout: slot, file: before.path, index: num, html: clean });
      cand = normalizeSpec({ ...spec, htmlEdits: edits }, spec);
      out = { page: null, patch: { htmlEdits: cand.htmlEdits } };
    }
    const after = await canvasHtml(slug, cand, { origin: '', editor: false, slot });
    const was = new Set((before.result.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg));
    const lost = (after.result.checks || []).filter((c) => c.level === 'fail' && !was.has(c.msg));
    if (lost.length) return res.json({ ok: false, error: `This edit removes original content (${lost[0].msg}). Keep that text in the HTML.` });
    res.json({ ok: true, reset: !clean, ...out });
  }));

  // saved (reusable) sections
  app.post(`${B}/saved`, wrap(async (req, res) => {
    const list = await readSaved(req.params.slug);
    const e = req.body?.entry;
    if (!e?.id) throw new Error('Nothing to save');
    if (!list.some((x) => x.id === e.id)) list.push({ ...e, savedAt: new Date().toISOString() });
    await writeSaved(req.params.slug, list);
    res.json(list);
  }));
  app.delete(`${B}/saved/:id`, wrap(async (req, res) => { const list = (await readSaved(req.params.slug)).filter((x) => x.id !== req.params.id); await writeSaved(req.params.slug, list); res.json(list); }));

  app.post(`${B}/pages/:id/export`, wrap(async (req, res) => res.json(await exportPage(req.params.slug, req.params.id))));
  app.get(`${B}/exports/:file`, (req, res) => {
    if (!/^[\w-]+\.zip$/.test(req.params.file)) return res.sendStatus(404);
    res.download(path.join(clientDir(req.params.slug), 'studio', 'exports', req.params.file));
  });
}
