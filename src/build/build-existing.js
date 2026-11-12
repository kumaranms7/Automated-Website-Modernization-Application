import fs from 'node:fs/promises';
import path from 'node:path';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readSource } from '../util/source.js';
import { extractModel } from './model.js';
import { loadSite } from './site.js';
import { layoutFor } from './render.js';
import { verifyPage } from './verify.js';
import { loadGraph } from './graph.js';
import { getProfile } from '../profile/store.js';
import { loadContent } from '../content/generate.js';
import { applyContent, applyBase } from '../content/apply.js';
import { fixImageTags } from './dims.js';
import { loadInplace, imageIndex } from '../images/inplace.js';
import { finalizeHtml } from './seo-final.js';
import { loadCanonicalContext } from '../canonical/index.js';
import { buildCanonicalReport } from '../canonical/report.js';
import * as cheerio from 'cheerio';
import { loadBuildSettings } from '../content/generate.js';
import { loadImageSettings } from '../images/optimize.js';
import { headContext, headSnapshot } from '../head/context.js';
import { loadManual } from '../head/review.js';
import { hasBusinessNode } from '../head/schema.js';
import { pickShareImage } from '../head/social.js';
import { aiAlts, imagesNeedingAlt } from '../head/alt.js';
import { addResponsiveImages } from './responsive.js';
import { storedFixes } from '../content/seo-fix.js';
import { convertPage } from '../template/own-convert.js';
import { aiConvertPage, classVocab } from '../template/own-ai.js';
import { APP } from '../app-settings.js';
import { ensurePatterns, patternsFor } from '../template/own-patterns.js';
import { loadFamilies, familyOf } from '../template/families.js';
import { buildTargets, cheerioText } from './build.js';
import { optionsOf } from '../options.js';

// The build of a site whose template is made of its own modern pages ("Create a template from existing pages"). Only the legacy
// pages are built: each one is poured into the template page chosen for its layout (Home, Inner or Contact), with the wording, titles
// and descriptions, image tags and SEO guarantees the designed template gets. Modern pages are not part of the build at all, so they
// are never rewritten or applied. The report has the same shape as the designed template's, so scoring, backup, apply, restore and
// the reports work unchanged. No stylesheet is compiled: the converted pages link the site's own.

export async function buildExisting(slug, { limit, types, only, content = 'approved', images = 'auto', outName = 'build', log = () => {}, onProgress, dry = false, onPage, fixHeads, keep = false, aiConvert } = {}) {
  const client = await loadClient(slug);
  if (!client) throw new Error(`Unknown client: ${slug}`);
  const pages = await readJson(path.join(clientDir(slug), 'scan/pages.json'));
  if (!pages) throw new Error('Run a scan first');
  const isMain = outName === 'build';
  const own = await readJson(path.join(clientDir(slug), 'template', 'own.json'), null);
  if (!own?.enabled || !(own.home || own.inner || own.contact)) throw new Error('Choose and save the template pages first (Template design, Existing pages).');
  if (!(await loadFamilies(slug))) throw new Error('Detect the templates first (Template design, Existing pages).');
  const lib = await ensurePatterns(slug);
  const profile = await getProfile(slug);
  const site = await loadSite(client, slug);
  if (!site.phone?.digits && profile.nap.phone) site.phone = { display: profile.nap.phone, digits: profile.nap.phone.replace(/\D/g, '') };
  if (!site.address && profile.nap.address) site.address = profile.nap.address;
  // one canonical domain for the whole site (Business profile), and the .htaccess redirects that take a page out of it
  const canon = await loadCanonicalContext(slug, client);
  const canonicalHost = new URL(canon.domain).host;
  const canonicalLog = [], linkChanges = [], linkFindings = [], headLog = [];
  const hset = await loadBuildSettings(slug);
  // what this website is updated for: the pictures are only touched with Update Images, and the search tags only when the wording is changed
  const imagesOn = optionsOf(client).images, tagsOn = hset.contentMode !== 'existing';
  const verifySkip = [...(imagesOn ? [] : ['img-alt-attr', 'img-alt-text', 'img-dimensions', 'content-images']), ...(tagsOn ? [] : ['schema-valid', 'schema-present'])];
  const hctx = headContext({ profile, site, scan: pages, canon, settings: hset });
  const graph = await loadGraph(slug);
  const manifest = images === 'none' || !imagesOn ? null : await loadInplace(slug);
  const imageMap = manifest ? imageIndex(manifest) : null;
  const useStatuses = content === 'none' ? [] : content === 'all' ? ['approved', 'generated', 'needs-review'] : content === 'usable' ? ['approved', 'generated'] : ['approved'];
  const buildDir = path.join(clientDir(slug), outName);
  if (!dry && !keep && (!only || !isMain)) await fs.rm(buildDir, { recursive: true, force: true });

  // the legacy pages only (buildTargets leaves the modern ones out)
  let todo = await buildTargets(slug, { types });
  if (only) todo = todo.filter((p) => only.includes(p.path));
  if (limit) todo = todo.slice(0, limit);

  const templates = new Map();
  const templateFor = async (layout) => {
    const rel = own[layout] || own.inner || own.home || own.contact;
    if (!templates.has(rel)) templates.set(rel, await readSource(client, rel));
    return { rel, html: templates.get(rel), fallback: !own[layout] };
  };

  const results = [];
  const seo = { alt: 0, eager: 0, lazy: 0, h1: 0, canonical: 0, titles: 0, descriptions: 0, headings: 0, srcset: 0, variants: 0 };
  const responsiveCache = new Map();
  const notes = new Map();

  // 1. read every page and apply its wording
  const items = [];
  onProgress?.({ total: todo.length, done: 0, phase: 'read' });
  for (const p of todo) {
    onProgress?.({ done: items.length + results.length, path: p.path, phase: 'read' });
    const original = await readSource(client, p.path);
    const model = extractModel(original, p.path);
    if (!model.ok) { results.push({ path: p.path, type: p.type, status: 'skipped', reason: model.reason }); continue; }
    const rec = useStatuses.length ? await loadContent(slug, p.path) : null;
    const ai = rec && useStatuses.includes(rec.status) ? rec : null;
    const actx = { related: false, graph, profile, site, host: client.host, type: p.type, hasBusinessSchema: hasBusinessNode(model.head.jsonLd) };
    items.push({ p, original, model, ai, finalModel: ai ? applyContent(model, ai, actx) : applyBase(model, actx) });
  }

  // 2. titles and meta descriptions: the right length, finished sentences, and different on every page
  const heads = items.map((it) => ({ path: it.p.path, type: it.p.type, h1: it.finalModel.hero.h1, title: it.finalModel.head.title || '', description: it.finalModel.head.description || '', text: cheerioText(it.finalModel) }));
  onProgress?.({ phase: 'seo', done: 0, total: 0 });
  const fixes = !tagsOn ? new Map() : fixHeads ? await fixHeads(heads, { scan: pages, site, profile, client }) : await storedFixes(slug, heads);
  if (!tagsOn) for (const it of items) it.finalModel.head.extraLd = [];
  // wording you wrote yourself in the page review is used as it is
  if (tagsOn) for (const [rel, m] of Object.entries(await loadManual(slug))) fixes.set(rel, { ...(fixes.get(rel) || {}), ...(m.title ? { title: m.title } : {}), ...(m.description ? { description: m.description } : {}), ...(m.h1 ? { h1: m.h1 } : {}) });
  for (const it of items) {
    const fx = fixes.get(it.p.path);
    if (!fx) continue;
    if (fx.title) { it.finalModel.head.title = fx.title; seo.titles += 1; }
    if (fx.description) { it.finalModel.head.description = fx.description; seo.descriptions += 1; }
    if (fx.h1) { it.finalModel.hero.h1 = fx.h1; seo.headings += 1; }
  }

  // 3a. the AI converts each page: the reference page's HTML and the old page's HTML go in, the new content area comes out, in the
  // content mode of the build (existing, enhance or rewrite). Without a key, or for a page that does not pass the checks, the rule-based
  // converter below does it. A dry run only reads answers that are already stored.
  const useAi = aiConvert ?? Boolean(process.env.ANTHROPIC_API_KEY);
  const aiPages = new Map();
  // the other modern pages of the site: what they show the same on every page is part of the template and stays as it is
  const siblings = [];
  if (useAi) {
    const famData = await loadFamilies(slug);
    const chosen = new Set([own.home, own.inner, own.contact].filter(Boolean));
    for (const rel of Object.keys(famData.pageMap).filter((r) => familyOf(famData, r) === 'modern' && !chosen.has(r)).slice(0, 8)) { try { siblings.push(await readSource(client, rel)); } catch { /* skipped */ } }
    for (const rel of chosen) { try { siblings.push(await readSource(client, rel)); } catch { /* skipped */ } }
  }
  if (useAi) {
    onProgress?.({ total: items.length, done: 0, phase: 'ai' });
    let next = 0, finished = 0;
    const worker = async () => {
      while (next < items.length) {
        const it = items[next++];
        const layout = layoutFor(it.finalModel, it.p.path, { pages: { home: '', contact: '' } });
        try {
          const tpl = await templateFor(layout);
          const r = await aiConvertPage({ slug, model: it.finalModel, templateHtml: tpl.html, templateRel: tpl.rel, targetRel: it.p.path, originalHtml: it.original, mode: hset.contentMode || 'existing', vocab: new Set([...(lib.vocab || []), ...classVocab(tpl.html)]), allowCall: !dry, siblings: siblings.filter((h) => h !== tpl.html), roles: own.roles?.[tpl.fallback ? 'inner' : layout] || null });
          if (tpl.fallback) r.notes.push(`No ${layout} template page was chosen, so the inner page template was used.`);
          aiPages.set(it.p.path, r);
        } catch (e) { aiPages.set(it.p.path, { error: e.message }); }
        onProgress?.({ done: (finished += 1), total: items.length, path: it.p.path, phase: 'ai' });
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, APP.limits.concurrency.aiWriting) }, worker));
  }

  // 3. pour each page into its template page, finish it and write it
  onProgress?.({ total: items.length, done: 0, phase: 'pages' });
  for (const { p, original, model, ai, finalModel } of items) {
    onProgress?.({ done: results.filter((r) => r.status !== 'skipped').length, path: p.path });
    const layout = layoutFor(finalModel, p.path, { pages: { home: '', contact: '' } });
    let converted;
    try {
      const tpl = await templateFor(layout);
      const viaAi = aiPages.get(p.path);
      if (viaAi && !viaAi.error) converted = { html: viaAi.html, notes: viaAi.notes };
      else converted = convertPage({ model: finalModel, templateHtml: tpl.html, templateRel: tpl.rel, targetRel: p.path, patterns: patternsFor(lib, tpl.fallback ? 'inner' : layout), vocab: new Set(lib.vocab || []), roles: own.roles?.[tpl.fallback ? 'inner' : layout] || null, hints: lib.titleHints || null });
      if (viaAi?.error && !/has not been run yet/.test(viaAi.error)) converted.notes.push(`The AI conversion was not used for this page (${viaAi.error}); the rule-based converter was used.`);
      if (!viaAi?.html && tpl.fallback) converted.notes.push(`No ${layout} template page was chosen, so the inner page template was used.`);
    } catch (e) {
      results.push({ path: p.path, type: p.type, status: 'skipped', layout, reason: e.message });
      continue;
    }
    for (const n of converted.notes) notes.set(n, (notes.get(n) || 0) + 1);
    const tagged = !imagesOn ? converted.html : await fixImageTags(converted.html, p.path, { host: client.host, roots: [buildDir, client.sourceDir] });
    let fixed = tagged;
    if (!dry && imagesOn) { const r = await addResponsiveImages(tagged, { rel: p.path, siteDir: client.sourceDir, buildDir, cache: responsiveCache }); fixed = r.html; seo.srcset += r.images; seo.variants += r.files; }
    // the share image and the picture descriptions the AI writes, then the head of the page is finished
    const $fixed = cheerio.load(fixed);
    const wantHead = tagsOn && (hset.socialTags || hset.schema);
    const shareImg = wantHead ? await pickShareImage($fixed, { rel: p.path, domain: canon.domain, roots: [buildDir, client.sourceDir], defaultImage: hctx.defaultImage }) : null;
    const alts = imagesOn && (await loadImageSettings(slug)).aiAlt ? await aiAlts({ slug, rel: p.path, pictures: imagesNeedingAlt($fixed), h1: finalModel.hero.h1, ai: !dry }) : null;
    const done = finalizeHtml(fixed, { rel: p.path, canonicalHost, host: client.host, canon, alts, parts: { images: imagesOn, tags: tagsOn }, head: wantHead ? { social: hset.socialTags, schema: hset.schema, type: p.type, facts: hctx.facts, biz: hctx.biz, brand: hctx.biz.name || hctx.brand, img: shareImg, folderInfo: hctx.folderInfo, homeName: hctx.homeName } : null });
    for (const k of Object.keys(done.changes)) seo[k] += done.changes[k];
    const pageLinks = done.canon?.links || { changes: [], findings: [] };
    if (done.canon) { const { links: _l, ...canonRow } = done.canon; canonicalLog.push({ path: p.path, ...canonRow }); }
    linkChanges.push(...pageLinks.changes); linkFindings.push(...pageLinks.findings);
    const html = done.html;
    if (!dry) {
      const target = path.join(buildDir, p.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, html);
    }
    const fx = fixes.get(p.path);
    const v = verifyPage(model, original, html, { ...(ai ? { ai: { rec: ai, host: client.host } } : {}), imageMap, host: client.host, own: true, canon: tagsOn ? canon : undefined, skip: verifySkip, linkFixes: new Set(pageLinks.changes.map((c) => c.old)), headFixed: { title: Boolean(fx?.title), description: Boolean(fx?.description), h1: Boolean(fx?.h1) } });
    headLog.push({ path: p.path, type: p.type, before: headSnapshot(original), after: headSnapshot(html), wrote: { title: Boolean(fx?.title), description: Boolean(fx?.description), h1: Boolean(fx?.h1) }, social: done.head?.social || null, schema: done.head?.schema ? { page: done.head.schema.page, breadcrumb: done.head.schema.breadcrumb, faq: done.head.schema.faq, aligned: done.head.schema.aligned, notes: done.head.schema.notes } : null });
    results.push({ path: p.path, type: p.type, layout, ai: ai ? `${ai.mode}:${ai.status}` : null, ...v, schemaRepaired: 0, schemaBroken: 0, unhandled: model.unhandled, templateNotes: converted.notes });
    onPage?.({ path: p.path, html, result: results.at(-1) });
  }

  const count = (s) => results.filter((r) => r.status === s).length;
  const fam = await loadFamilies(slug);
  const report = {
    builtAt: new Date().toISOString(),
    cssBytes: 0,
    template: { version: 'existing pages', status: 'final' },
    removedLinks: [],
    seo,
    head: tagsOn ? headLog : [],
    canonical: !tagsOn ? null : await buildCanonicalReport({ slug, client, ctx: canon, log: canonicalLog, linkChanges, linkFindings, scan: pages }),
    notCarried: [],
    templateRules: { existing: true, converted: results.filter((r) => r.status !== 'skipped').length, modernKept: Object.keys(fam.pageMap).filter((r) => familyOf(fam, r) === 'modern').length, templatePages: { home: own.home, inner: own.inner, contact: own.contact }, patterns: Object.fromEntries(Object.entries(lib.patterns).map(([k, v]) => [k, v.source])), notes: [...notes.entries()].map(([text, pages]) => ({ text, pages })).sort((a, b) => b.pages - a.pages) },
    totals: { pages: results.length, pass: count('pass'), warn: count('warn'), fail: count('fail'), skipped: count('skipped'), schemaRepaired: 0 },
    results,
  };
  if (!only && isMain) await writeJson(path.join(clientDir(slug), 'build-report.json'), report);
  log(`Converted ${report.templateRules.converted} legacy pages -> clients/${slug}/${outName}/ (${report.totals.pass} pass, ${report.totals.warn} warn, ${report.totals.fail} fail)`);
  return report;
}
