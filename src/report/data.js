import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { clientDir, loadClient, readJson } from '../config.js';
import { readSource } from '../util/source.js';
import { readHtml } from '../util/html.js';
import { getProfile } from '../profile/store.js';
import { loadApplied } from '../build/apply-site.js';
import { loadInplace } from '../images/inplace.js';
import { listContent, loadBuildSettings } from '../content/generate.js';
import { findForbiddenClaims } from '../content/validate.js';
import { loadActive } from '../template/store.js';
import { getTemplateType } from '../template/families.js';
import { scoreHtml, pageFacts, CATEGORIES } from '../build/score.js';
import { loadCanonicalContext } from '../canonical/index.js';
import { areasOf, optionsOf } from '../options.js';
import { CHECK_INFO } from '../validate/seo.js';

// Everything the modernisation report says, gathered from the files the platform already keeps. "Before" is always the original page
// (the copy saved before the first update), "after" is the page now in the website folder (or in the build folder when the site
// folder has not been updated). Nothing is estimated: every figure is counted from the pages.

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const plain = (html) => norm(cheerio.load(`<div>${html}</div>`).text());
const count = (list) => { const m = new Map(); for (const v of list) m.set(v, (m.get(v) || 0) + 1); return m; };
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const round = (v, d = 0) => { const k = 10 ** d; return Math.round(v * k) / k; };
const mainText = (html) => { const $ = cheerio.load(html); $('script, style, noscript, header, footer, nav').remove(); return ($('main').text() || $('body').text()).replace(/\s+/g, ' '); };

// extra counts the page score does not need
function extraFacts(html) {
  const $ = cheerio.load(html);
  const imgs = $('img').toArray();
  // a call-to-action card: a block outside the header, footer, hero and floating bars that has a heading and a "Call ..." / "Get ..." button to a phone number
  const ctas = new Map();
  $('a[href^="tel:"]').each((_, el) => {
    if ($(el).closest('header, footer, nav, aside, [class~="hero"], [class~="fixed"]').length || !/^\s*(call|get|schedule|book|request|talk)/i.test($(el).text())) return;
    const box = $(el).closest('[class*="get-in-touch"], [class*="cta"], section').get(0);
    if (!box || ctas.has(box)) return;
    const $b = $(box), title = norm($b.find('h2, h3, h4, .font-display').first().text());
    if (!title) return;
    ctas.set(box, { title, text: norm($b.find('p').first().text()).slice(0, 160), buttons: $b.find('a').toArray().map((x) => norm($(x).text())).filter(Boolean).slice(0, 3).join(' | ') });
  });
  const cta = [...ctas.values()][0];
  const heads = (sel) => $(sel).toArray().map((e) => norm($(e).text()));
  return {
    imgMissingAlt: imgs.filter((i) => $(i).attr('alt') == null).length,
    imgEager: imgs.filter((i) => $(i).attr('loading') === 'eager').length,
    imgSvg: imgs.filter((i) => /\.svg(\?|$)/i.test($(i).attr('src') || '')).length,
    imgExternal: imgs.filter((i) => /^(https?:)?\/\//i.test($(i).attr('src') || '')).length,
    imgLegacy: imgs.filter((i) => !/^(https?:)?\/\//i.test($(i).attr('src') || '') && /\.(jpe?g|png|gif)(\?|$)/i.test($(i).attr('src') || '') && !$(i).parent('picture').find('source[type="image/webp"]').length).length,
    scripts: $('script[src]').length,
    blocking: $('head script[src]').toArray().filter((s) => !$(s).attr('async') && !$(s).attr('defer') && $(s).attr('type') !== 'module').length,
    jquery: $('script[src]').toArray().some((s) => /jquery/i.test($(s).attr('src') || '')) ? 1 : 0,
    styles: $('link[rel="stylesheet"]').length,
    h2: $('h2').length,
    h1n: $('h1').length,
    ctaCount: ctas.size,
    ctaTitle: cta?.title || '',
    ctaButtons: cta?.buttons || '',
    ctaText: cta?.text || '',
  };
}

const pctFmt = (a, b) => (b ? round((a / b) * 100, 1) : 0);

export async function collectReport(slug, { onProgress = () => {} } = {}) {
  const client = await loadClient(slug);
  const profile = await getProfile(slug);
  const dir = clientDir(slug);
  const [applied, inplace, validation, browser, usage, site, scan, buildReport, final, settings, content, active] = await Promise.all([
    loadApplied(slug), loadInplace(slug), readJson(path.join(dir, 'validation.json'), null), readJson(path.join(dir, 'browser.json'), null),
    readJson(path.join(dir, 'usage.json'), null), readJson(path.join(dir, 'site.json'), {}), readJson(path.join(dir, 'scan/pages.json'), []),
    readJson(path.join(dir, 'build-report.json'), null), readJson(path.join(dir, 'final-build.json'), null), loadBuildSettings(slug), listContent(slug), loadActive(slug),
  ]);
  // a website updated only for its images is not rebuilt: its own pages, after the Images step, are the "after"
  const inPlaceOnly = !optionsOf(client).template && !optionsOf(client).content && Boolean(inplace);
  if (!buildReport && !applied && !inPlaceOnly) throw new Error('There is nothing to report yet. Run Build all pages first (Content & build).');
  const ownSel = (await getTemplateType(slug)) === 'existing' ? await readJson(path.join(dir, 'template/own.json'), null) : null;
  const patternLib = ownSel ? await readJson(path.join(dir, 'template/patterns.json'), null) : null;
  // a template made of the site's own modern pages has no colours or fonts of its own to list
  const spec = ownSel ? { name: 'Existing site template', version: 'existing pages', finalisedAt: ownSel.savedAt, tokens: {}, layout: {} } : active.spec;
  const results = buildReport?.results || [];
  const meta = new Map(results.map((r) => [r.path, r]));
  const scanBy = new Map(scan.map((p) => [p.path, p]));
  const rels = (inPlaceOnly ? scan.map((p) => p.path) : applied?.pages?.length ? applied.pages.map((p) => p.rel) : results.filter((r) => r.status !== 'skipped').map((r) => r.path)).filter((r) => /\.(html?|php|shtml)$/i.test(r));
  const afterDir = inPlaceOnly || applied?.pages?.length ? client.sourceDir : path.join(dir, 'build');
  const contentBy = new Map(content.map((c) => [c.path, c]));
  const phoneDigits = (profile.nap?.phone || '').replace(/\D/g, '');

  // 1. read both sides of every page
  const pages = [];
  let i = 0;
  for (const rel of rels) {
    onProgress({ phase: 'read', done: i, total: rels.length, path: rel });
    i += 1;
    let before, after;
    // the true original: the copy saved before the Images step rewrote its image links, else the copy saved before the build replaced it
    try { before = await readHtml(path.join(client.sourceDir, '_modernizer-backup', 'modified-files', ...rel.split('/'))); } catch { try { before = await readSource(client, rel); } catch { continue; } }
    try { after = await readHtml(path.join(afterDir, rel)); } catch { continue; }
    pages.push({ rel, type: meta.get(rel)?.type || scanBy.get(rel)?.type || 'page', layout: meta.get(rel)?.layout || '', before, after });
  }

  // 2. titles and descriptions must be unique across the whole site, so count them over every page first
  const tm = (html, re) => norm((html.match(re) || [])[1]);
  const T = /<title>([\s\S]*?)<\/title>/i, M = /<meta name="description" content="([^"]*)"/i;
  const have = new Set(pages.map((p) => p.rel));
  const titlesB = count([...pages.map((p) => tm(p.before, T)), ...scan.filter((p) => !have.has(p.path)).map((p) => norm(p.title))]);
  const metasB = count([...pages.map((p) => tm(p.before, M)), ...scan.filter((p) => !have.has(p.path)).map((p) => norm(p.metaDescription))]);
  const titlesA = count([...pages.map((p) => tm(p.after, T)), ...scan.filter((p) => !have.has(p.path)).map((p) => norm(p.title))]);
  const metasA = count([...pages.map((p) => tm(p.after, M)), ...scan.filter((p) => !have.has(p.path)).map((p) => norm(p.metaDescription))]);

  // 3. score and measure
  const canon = await loadCanonicalContext(slug, client);
  const areas = areasOf(client, settings);
  const rows = [];
  const checkAgg = {};
  const catAgg = Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, { b: [], a: [] }]));
  i = 0;
  for (const p of pages) {
    onProgress({ phase: 'score', done: i, total: pages.length, path: p.rel });
    i += 1;
    const common = { rel: p.rel, type: p.type, host: client.host, phoneDigits, canon, areas };
    const sb = scoreHtml({ ...common, html: p.before, titles: titlesB, metas: metasB, claims: findForbiddenClaims(mainText(p.before), profile).map((c) => c.phrase) });
    const sa = scoreHtml({ ...common, html: p.after, titles: titlesA, metas: metasA, claims: findForbiddenClaims(mainText(p.after), profile).map((c) => c.phrase) });
    const fb = { ...pageFacts(p.before), ...extraFacts(p.before) }, fa = { ...pageFacts(p.after), ...extraFacts(p.after) };
    for (const [side, s] of [['b', sb], ['a', sa]]) {
      for (const c of s.checks) {
        const e = (checkAgg[c.id] ||= { id: c.id, label: c.label, category: c.category, b: { n: 0, ok: 0 }, a: { n: 0, ok: 0 } });
        if (c.applicable) { e[side].n += 1; if (c.ok) e[side].ok += 1; }
      }
      for (const [cat, v] of Object.entries(s.categories)) if (v.applicable) catAgg[cat][side].push(v.score);
    }
    const rec = contentBy.get(p.rel);
    rows.push({ used: Boolean(rec && ['approved', 'generated'].includes(rec.status)),
      path: p.rel, type: p.type, layout: p.layout, sb, sa, fb, fa,
      mode: rec?.mode || 'existing wording', status: rec?.status || '', rec,
      score: { before: sb.score, after: sa.score, delta: sa.score - sb.score },
    });
  }

  // 4. tables ----------------------------------------------------------------
  const imagesPages = {
    imgB: rows.reduce((n, r) => n + r.fb.images, 0), imgA: rows.reduce((n, r) => n + r.fa.images, 0),
    webpB: rows.reduce((n, r) => n + r.fb.webp, 0), webpA: rows.reduce((n, r) => n + r.fa.webp, 0),
    srcsetB: rows.reduce((n, r) => n + r.fb.srcset, 0), srcsetA: rows.reduce((n, r) => n + r.fa.srcset, 0),
    lazyB: rows.reduce((n, r) => n + r.fb.lazy, 0), lazyA: rows.reduce((n, r) => n + r.fa.lazy, 0),
    eagerB: rows.reduce((n, r) => n + r.fb.imgEager, 0), eagerA: rows.reduce((n, r) => n + r.fa.imgEager, 0),
    svgB: rows.reduce((n, r) => n + r.fb.imgSvg, 0), svgA: rows.reduce((n, r) => n + r.fa.imgSvg, 0), legacyB: rows.reduce((n, r) => n + r.fb.imgLegacy, 0), legacyA: rows.reduce((n, r) => n + r.fa.imgLegacy, 0),
    extB: rows.reduce((n, r) => n + r.fb.imgExternal, 0), extA: rows.reduce((n, r) => n + r.fa.imgExternal, 0),
    sizedB: rows.reduce((n, r) => n + r.fb.sized, 0), sizedA: rows.reduce((n, r) => n + r.fa.sized, 0),
    noAltB: rows.reduce((n, r) => n + r.fb.imgMissingAlt, 0), noAltA: rows.reduce((n, r) => n + r.fa.imgMissingAlt, 0),
  };

  const pageRows = rows.map((r) => ({
    path: r.path, type: r.type, wording: r.used ? r.mode : 'existing wording', scoreBefore: r.score.before, scoreAfter: r.score.after, change: r.score.delta,
    titleBefore: r.fb.title, titleAfter: r.fa.title, titleLenBefore: r.fb.title.length, titleLenAfter: r.fa.title.length,
    metaBefore: r.fb.description, metaAfter: r.fa.description, metaLenBefore: r.fb.description.length, metaLenAfter: r.fa.description.length,
    h1Before: r.fb.h1n, h1After: r.fa.h1n, wordsBefore: r.fb.words, wordsAfter: r.fa.words,
    imagesBefore: r.fb.images, imagesAfter: r.fa.images, webpBefore: r.fb.webp, webpAfter: r.fa.webp, legacyBefore: r.fb.imgLegacy, legacyAfter: r.fa.imgLegacy, srcsetBefore: r.fb.srcset, srcsetAfter: r.fa.srcset,
    lazyBefore: r.fb.lazy, lazyAfter: r.fa.lazy, eagerAfter: r.fa.imgEager, missingAltBefore: r.fb.imgMissingAlt, missingAltAfter: r.fa.imgMissingAlt,
    schemaBefore: r.fb.schema.join(' '), schemaAfter: r.fa.schema.join(' '), htmlKbBefore: r.fb.htmlKb, htmlKbAfter: r.fa.htmlKb,
  }));

  const checks = Object.values(checkAgg).map((c) => {
    // a check that does not apply to the old markup (for example images inside the main content area) has no "before" figure
    const rb = c.b.n ? pctFmt(c.b.ok, c.b.n) : null, ra = pctFmt(c.a.ok, c.a.n);
    return { check: c.label, category: c.category, applicable: c.a.n, passBefore: c.b.ok, passAfter: c.a.ok, failBefore: c.b.n - c.b.ok, failAfter: c.a.n - c.a.ok, rateBefore: rb, rateAfter: ra, change: rb == null ? null : round(ra - rb, 1), id: c.id };
  }).sort((a, b) => (b.change ?? -1) - (a.change ?? -1) || a.check.localeCompare(b.check));

  const KEY = ['img-alt-meaningful', 'img-lazy', 'title-length', 'meta-length', 'title-unique', 'meta-unique', 'h1-single', 'canonical'];
  const keyChecks = KEY.map((id) => checks.find((c) => c.id === id)).filter(Boolean);

  const bucket = (s) => (s < 60 ? 'Under 60' : s < 70 ? '60-69' : s < 80 ? '70-79' : s < 90 ? '80-89' : '90-100');
  const BUCKETS = ['Under 60', '60-69', '70-79', '80-89', '90-100'];
  const hist = BUCKETS.map((label) => ({ label, a: rows.filter((r) => bucket(r.score.before) === label).length, b: rows.filter((r) => bucket(r.score.after) === label).length }));
  const categories = Object.keys(CATEGORIES).map((name) => ({ category: name, before: round(avg(catAgg[name].b)), after: round(avg(catAgg[name].a)) })).map((c) => ({ ...c, change: c.after - c.before }));

  // images (the Images step's own result)
  const imgEntries = (inplace?.entries || []).map((e) => ({
    original: e.orig, final: e.file, action: e.status, bytesBefore: e.origBytes, bytesAfter: e.bytes, saved: e.origBytes - e.bytes, savedPct: e.origBytes ? round(((e.origBytes - e.bytes) / e.origBytes) * 100, 1) : 0,
    widthBefore: e.origW, heightBefore: e.origH, width: e.w, height: e.h, smallerCopies: (e.variants || []).length, smallerCopiesBytes: (e.variants || []).reduce((s, v) => s + (v.bytes || 0), 0),
    smallerCopyWidths: (e.variants || []).map((v) => v.w).join(' / '),
  })).sort((a, b) => b.saved - a.saved);
  const appliedFiles = (applied?.files || []).map((f) => ({ file: f.rel, kind: /\.css$/i.test(f.rel) ? 'Stylesheet' : /\.js$/i.test(f.rel) ? 'Script' : /font/i.test(f.rel) || /\.(woff2?|ttf)$/i.test(f.rel) ? 'Font' : /\.(webp|png|jpe?g|svg)$/i.test(f.rel) ? 'Image' : 'Other', result: f.existed ? 'Replaced (original saved)' : 'Added (new file)' }));

  // content
  const modeCount = count(rows.map((r) => (r.used ? r.mode : r.rec ? 'kept original (needs review)' : 'existing wording')));
  const usedModes = count(rows.filter((r) => r.used).map((r) => r.mode));
  const modeUsed = [...usedModes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'existing';
  const statusCount = count(rows.filter((r) => r.rec).map((r) => r.status));
  const contentRows = rows.filter((r) => r.rec).map((r) => {
    const u = r.rec.content?.units || [];
    return {
      path: r.path, type: r.type, mode: r.rec.mode, status: r.rec.status, onSite: r.used ? 'Yes' : 'No: original wording kept until reviewed', model: r.rec.model || '', cost: r.rec.cost || 0, attempts: r.rec.attempts || 1,
      sections: u.length, sectionsChanged: u.filter((x) => x.after !== x.before).length, rejected: r.rec.summary?.rejected ?? (r.rec.content?.rejected || []).length,
      wordsBefore: r.fb.words, wordsAfter: r.fa.words, reviewNotes: (r.rec.content?.reviewNotes || []).length, note: norm((r.rec.content?.reviewNotes || []).join(' | ')).slice(0, 400),
    };
  });
  const unitRows = [];
  for (const r of rows) {
    if (!r.used) continue;
    for (const u of r.rec?.content?.units || []) {
      if (u.after === u.before) continue;
      unitRows.push({ path: r.path, section: u.id, kind: u.kind, before: plain(u.before), after: plain(u.after) });
    }
  }
  const ctaRows = rows.map((r) => ({
    path: r.path, type: r.type, ctaBefore: r.fb.ctaCount, ctaAfter: r.fa.ctaCount, titleBefore: r.fb.ctaTitle, titleAfter: r.fa.ctaTitle,
    textBefore: r.fb.ctaText, textAfter: r.fa.ctaText, buttonsBefore: r.fb.ctaButtons, buttonsAfter: r.fa.ctaButtons,
  }));

  // template
  const t = spec.tokens || {}, lay = spec.layout || {};
  const tplFacts = [
    ['Stylesheet files per page', avg(rows.map((r) => r.fb.styles)), avg(rows.map((r) => r.fa.styles))],
    ['External script files per page', avg(rows.map((r) => r.fb.scripts)), avg(rows.map((r) => r.fa.scripts))],
    ['Render-blocking scripts in the head per page', avg(rows.map((r) => r.fb.blocking)), avg(rows.map((r) => r.fa.blocking))],
    ['Pages loading jQuery', rows.reduce((n, r) => n + r.fb.jquery, 0), rows.reduce((n, r) => n + r.fa.jquery, 0)],
    ['Average HTML size (KB)', avg(rows.map((r) => r.fb.htmlKb)), avg(rows.map((r) => r.fa.htmlKb))],
    ['Average images per page', avg(rows.map((r) => r.fb.images)), avg(rows.map((r) => r.fa.images))],
    ['Pages with structured data', rows.filter((r) => r.fb.schema.length).length, rows.filter((r) => r.fa.schema.length).length],
    ['Pages with full Open Graph tags', rows.filter((r) => r.fb.og >= 4).length, rows.filter((r) => r.fa.og >= 4).length],
  ].map(([measure, before, after]) => ({ measure, before: round(before, 1), after: round(after, 1), change: round(after - before, 1) }));
  const tokens = [
    ['Template name', spec.name || ''], ['Template version', `v${spec.version}`], ['Finalised', spec.finalisedAt || ''], ['Heading font', t.fontHeading], ['Body font', t.fontBody],
    ['Primary colour', t.primary], ['Dark primary', t.primaryDark], ['Accent colour', t.accent], ['Text colour', t.ink], ['Soft background', t.soft],
    ['Heading case', t.headingCase], ['Heading weight', t.headingWeight], ['Corner radius', t.radius], ['Shadow', t.shadow], ['Spacing', t.density], ['Content width', t.container],
    ['Header style', lay.header], ['Top bar', lay.topbar ? 'On' : 'Off'], ['Hero style', lay.hero], ['Section backgrounds', lay.sections], ['Card style', lay.cards], ['Card layout', lay.cardLayout],
    ['Section headings', lay.sectionHead], ['Inner page sidebar', lay.innerSidebar], ['Inner page form', lay.innerForm], ['Footer style', lay.footer], ['Contact page layout', lay.contactLayout], ['Home page style', lay.homeStyle],
    ['Hand-made style changes (all pages)', (spec.tweaks || []).length], ['Structure edits', (spec.ops || []).length], ['HTML edits', (spec.htmlEdits || []).length],
    ['Saved versions of the design', (await fs.readdir(path.join(dir, 'template/versions')).catch(() => [])).length],
    ['Compiled stylesheet size (KB)', buildReport?.cssBytes ? round(buildReport.cssBytes / 1024, 1) : ''],
  ].map(([setting, value]) => ({ setting, value: String(value ?? '') }));

  // files and pages not updated
  const notUpdated = [
    ...(applied?.skipped || []).map((s) => ({ path: s.rel, reason: s.reason })),
    ...results.filter((r) => r.status === 'skipped' && !(applied?.skipped || []).some((s) => s.rel === r.path)).map((r) => ({ path: r.path, reason: r.reason || 'the page layout was not recognised' })),
  ];

  // validation, browser, cost
  const checklist = Object.entries(validation?.checks || {}).map(([id, c]) => ({ check: c.label || CHECK_INFO[id] || id, applicable: c.applicable, passed: c.passed, failed: c.failed, rate: c.applicable ? round((c.passed / c.applicable) * 100, 1) : 100 })).sort((a, b) => b.failed - a.failed);
  const blocked = Object.entries(validation?.pages || {}).filter(([, d]) => d.readiness !== 'ready').map(([p, d]) => ({ path: p, status: d.readiness, reasons: (d.reasons || []).join('; ') }));
  const browserRows = (browser?.results || []).map((b) => ({
    path: b.path, requestsBefore: b.original?.requests, requestsAfter: b.modern?.requests, kbBefore: round((b.original?.bytes || 0) / 1024), kbAfter: round((b.modern?.bytes || 0) / 1024),
    lcpBefore: b.original?.lcp, lcpAfter: b.modern?.lcp, clsBefore: b.original?.cls, clsAfter: b.modern?.cls, loadBefore: b.original?.load, loadAfter: b.modern?.load,
    overflow: b.modern?.overflow ? 'Yes' : 'No', accessibility: (b.desktop?.axe || []).map((a) => `${a.impact}: ${a.id}`).join('; '),
  }));
  const costRows = Object.entries(usage?.byLabel || {}).map(([k, v]) => ({ task: k, cost: round(v, 2) })).sort((a, b) => b.cost - a.cost);

  const backupZip = applied?.backupId ? await fs.stat(path.join(dir, 'backups', `${applied.backupId}.zip`)).then((s) => s.size, () => 0) : 0;

  const scoreAvg = (k) => round(avg(rows.map((r) => r.score[k])));
  return {
    generatedAt: new Date().toISOString(), slug, client: { name: client.name, host: client.host, sourceDir: client.sourceDir }, site,
    scope: { pages: rows.length, sitePages: scan.length, updatedInSite: Boolean(applied), builtAt: buildReport?.builtAt || null, appliedAt: applied?.at || null, source: applied?.pages?.length ? 'the website folder' : 'the build folder' },
    kpi: {
      scoreBefore: scoreAvg('before'), scoreAfter: scoreAvg('after'), improved: rows.filter((r) => r.score.delta > 0).length, same: rows.filter((r) => r.score.delta === 0).length, worse: rows.filter((r) => r.score.delta < 0).length,
      imageBytesBefore: inplace?.totals?.bytesBefore || 0, imageBytesAfter: inplace?.totals?.bytesAfter || 0, variantBytes: inplace?.totals?.variantBytes || 0,
      imagesProcessed: inplace?.totals?.processed || 0, imagesKept: inplace?.totals?.kept || 0, referencesRewritten: inplace?.totals?.referencesRewritten || 0, filesModified: inplace?.totals?.filesModified || 0,
      unusedFiles: inplace?.totals?.unusedFiles || 0, unusedBytes: inplace?.totals?.unusedBytes || 0,
      aiPages: rows.filter((r) => r.used).length, aiPagesReview: rows.filter((r) => r.rec && !r.used).length, aiCost: round(usage?.cost || 0, 2), apiCalls: usage?.calls || 0,
      backupId: applied?.backupId || '', backupFiles: applied?.backupFiles || 0, backupBytes: applied?.backupBytes || 0, backupZipBytes: backupZip,
      pagesUpdated: applied?.pages?.length || 0, sharedFiles: applied?.files?.length || 0, pagesNotUpdated: notUpdated.length,
      validation: validation?.totals || null, validatedAt: validation?.validatedAt || null,
    },
    imagesPages, hist, categories, checks, keyChecks, pageRows, imgEntries, appliedFiles,
    imgModified: (inplace?.modified || []).map((m) => ({ file: m.file, referencesRewritten: m.replacements })),
    unusedImages: (inplace?.unused || []).map((u) => ({ file: u.rel, bytes: u.bytes })),
    preservedImages: (inplace?.preserved || []).map((u) => ({ file: u.rel, bytes: u.bytes, references: u.refs, status: u.status })),
    imageSettings: inplace?.settings || null, imageBackup: inplace?.backup || null, imagesRunAt: inplace?.runAt || null,
    contentMode: modeUsed, settingMode: settings.contentMode, scopeSetting: settings.scope, modeCount: [...modeCount.entries()].map(([k, v]) => ({ k, v })), statusCount: [...statusCount.entries()].map(([k, v]) => ({ k, v })),
    contentRows, unitRows, ctaRows, ctaSummary: { before: ctaRows.reduce((n, r) => n + r.ctaBefore, 0), after: ctaRows.reduce((n, r) => n + r.ctaAfter, 0), pagesBefore: ctaRows.filter((r) => r.ctaBefore).length, pagesAfter: ctaRows.filter((r) => r.ctaAfter).length },
    seoFix: final?.totals?.seo || null, buildSeo: buildReport?.seo || null, canonical: buildReport?.canonical || final?.canonical || null, headLog: buildReport?.head || final?.head || [], protectedPages: final?.protectedPages || [], areas, options: optionsOf(client),
    buildFixes: buildReport?.seo ? [['Alt text added to images', buildReport.seo.alt], ['Below-the-fold images set to lazy loading', buildReport.seo.lazy], ['Above-the-fold images set to eager loading', buildReport.seo.eager], ['Pages given exactly one H1', buildReport.seo.h1], ['Canonical links set (absolute, https, self-referencing)', buildReport.seo.canonical], ['Titles rewritten to fit 30-60 characters', buildReport.seo.titles], ['Meta descriptions rewritten to fit 110-160 characters', buildReport.seo.descriptions], ['Images given a responsive srcset', buildReport.seo.srcset], ['Smaller image copies created for srcset', buildReport.seo.variants]].map(([fix, count]) => ({ fix, count: count || 0 })) : [], templateRules: buildReport?.templateRules || null, notCarried: buildReport?.notCarried || [],
    tokens, tplFacts, spec: { tokens: t, layout: lay, version: spec.version, finalisedAt: spec.finalisedAt, name: spec.name }, notUpdated, checklist, blocked, browserRows, browser: browser?.summary || null, browserProfile: browser?.profile || '', costRows, usage: usage ? { calls: usage.calls, input: usage.input, output: usage.output, cost: usage.cost } : null,
    removedLinks: buildReport?.removedLinks || [], cssBytes: buildReport?.cssBytes || 0,
    templateOwn: ownSel ? { pages: { home: ownSel.home, inner: ownSel.inner, contact: ownSel.contact }, converted: rows.length, modern: buildReport?.templateRules?.modernKept ?? 0, patterns: Object.values(patternLib?.patterns || {}).map((p) => ({ kind: p.kind, source: p.source, page: p.page })), notes: buildReport?.templateRules?.notes || [] } : null,
    buildTotals: buildReport?.totals || null, imageProblems: (inplace?.problems || []).length, pagesWithWebp: rows.filter((r) => r.fa.webp > 0).length, pagesWithSrcset: rows.filter((r) => r.fa.srcset > 0).length,
  };
}
