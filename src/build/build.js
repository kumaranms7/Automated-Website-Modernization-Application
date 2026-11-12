import fs from 'node:fs/promises';
import { loadScope, scopeReason } from '../scope.js';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readSource } from '../util/source.js';
import { extractModel } from './model.js';
import { loadSite } from './site.js';
import { renderPage } from './render.js';
import { verifyPage } from './verify.js';
import { loadGraph } from './graph.js';
import { getProfile } from '../profile/store.js';
import { loadContent } from '../content/generate.js';
import { applyContent, applyBase } from '../content/apply.js';
import { fixImageTags, imageDims } from './dims.js';
import { makeExists, localTarget } from '../validate/links.js';
import { loadInplace, imageIndex } from '../images/inplace.js';
import { getTemplateType, loadFamilies, familyOf } from '../template/families.js';
import { loadActive } from '../template/store.js';
import { specCss, fontsUsed, FONT_DIR_PATH } from '../template/spec.js';
import { finalizeHtml } from './seo-final.js';
import { loadCanonicalContext } from '../canonical/index.js';
import { buildCanonicalReport } from '../canonical/report.js';
import { loadBuildSettings } from '../content/generate.js';
import { loadImageSettings } from '../images/optimize.js';
import { skipReason } from '../head/skip.js';
import { hasBusinessNode } from '../head/schema.js';
import { buildTypes } from '../scanner/page-types.js';
import { optionsOf } from '../options.js';
import { loadManual } from '../head/review.js';
import { headContext, headSnapshot } from '../head/context.js';
import { pickShareImage } from '../head/social.js';
import { aiAlts, imagesNeedingAlt } from '../head/alt.js';
import { addResponsiveImages } from './responsive.js';
import { sectionSignatures, classDiffs, kindRules } from '../template/section-match.js';
import { expandForm } from '../template/html-ops.js';
import * as cheerio from 'cheerio';
import { storedFixes } from '../content/seo-fix.js';
import { copyBanners } from '../template/banners.js';
import { kitEntry } from '../kit/css.js';
import { phonesOf } from '../kit/fit.js';

const run = promisify(execFile);
export const BUILD_TYPES = buildTypes();

// Compiles the shared stylesheet + the site's design-spec variables into one minified file.
async function compileCss(slug, spec, buildDir, twName) {
  const dir = clientDir(slug);
  const tw = path.join(dir, twName);
  await fs.mkdir(tw, { recursive: true });
  await fs.writeFile(path.join(tw, 'spec.css'), specCss(spec));
  const rel = (p) => path.relative(tw, p).split(path.sep).join('/');
  // a site with a kit design is compiled from the kit's own Tailwind entry (its variables and fonts are in the pages); the classic one from main.css
  await fs.writeFile(path.join(tw, 'entry.css'), spec.kit?.design ? kitEntry(rel, `@source "${rel(buildDir)}";`)
    : `@import "${rel(path.join(ROOT, 'src/styles/main.css'))}";\n@import "./spec.css";\n@source "${rel(buildDir)}";\n`);
  const out = path.join(buildDir, 'assets/css/site.min.css');
  await fs.mkdir(path.dirname(out), { recursive: true });
  const bin = path.join(ROOT, 'node_modules/@tailwindcss/cli/dist/index.mjs');
  await run(process.execPath, [bin, '-i', path.join(tw, 'entry.css'), '-o', out, '--minify'], { cwd: ROOT });
  return (await fs.stat(out)).size;
}

// The pages a build covers, in build order (the first N are the "sample" pages).
export async function buildTargets(slug, { limit, types } = {}) {
  const client = await loadClient(slug);
  const pages = await readJson(path.join(clientDir(slug), 'scan/pages.json'));
  if (!pages) throw new Error('Run a scan first');
  const kinds = types || (optionsOf(client).template ? BUILD_TYPES : [...BUILD_TYPES, 'home']);
  let todo = pages.filter((p) => kinds.includes(p.type) && (/\.(html?|shtml)$/i.test(p.path) || (client.php && /\.php$/i.test(p.path))));
  if (optionsOf(client).template && (await getTemplateType(slug)) === 'existing') {
    const fam = await loadFamilies(slug);
    if (!fam) throw new Error('Detect the templates first (Template design, Existing pages).');
    todo = todo.filter((p) => familyOf(fam, p.path) === 'legacy');
  }
  // pages the run leaves out: the ones listed, noindex, error pages, redirected or removed pages
  const set = await loadBuildSettings(slug), canon = await loadCanonicalContext(slug, client);
  const scope = await loadScope(slug);
  const left = [];
  todo = todo.filter((p) => { const why = scopeReason(scope, p) || skipReason(p, set, canon); if (why) left.push({ path: p.path, why }); return !why; });
  buildTargets.lastLeftOut = left;
  return (limit ? todo.slice(0, limit) : todo).map((p) => ({ path: p.path, type: p.type, title: p.title || '', metaDescription: p.metaDescription || '' }));
}

// Builds into clients/<slug>/build/ (or another folder inside the client folder). The original site folder is never written to.
// content: 'approved' (default, publish-safe) | 'all' (also drafts, for preview) | 'none' (templates only)
// spec: design spec to use; defaults to the site's finalised template, else its working draft
export async function buildClient(slug, { limit, types, only, content = 'approved', images = 'auto', spec: specOverride, outName = 'build', log = () => {}, onProgress, dry = false, onPage, fixHeads, keep = false } = {}) {
  const client = await loadClient(slug);
  if (!client) throw new Error(`Unknown client: ${slug}`);
  const pages = await readJson(path.join(clientDir(slug), 'scan/pages.json'));
  if (!pages) throw new Error('Run a scan first');
  const isMain = outName === 'build';
  // a website that keeps its design: its pages are changed in place, word for word
  if (!specOverride && !optionsOf(client).template) {
    const { buildContentOnly } = await import('./build-content.js');
    return buildContentOnly(slug, { limit, types, only, content, outName, log, onProgress, dry, onPage, fixHeads, keep });
  }
  // a site whose template is made of its own modern pages is built by the existing-pages builder
  if (!specOverride && (await getTemplateType(slug)) === 'existing') {
    const { buildExisting } = await import('./build-existing.js');
    return buildExisting(slug, { limit, types, only, content, images, outName, log, onProgress, dry, onPage, fixHeads, keep });
  }
  const { chosenPages } = await import('../template/api.js');
  let spec = { ...(specOverride || (await loadActive(slug)).spec), samples: await chosenPages(slug) };
  // The home and contact pages are the ones the template is designed on (chosen, else suggested). A design from the kit draws the page
  // that is the home page with its home sections, so the build has to know which page that is, also when it was left on "Auto".
  if (spec.kit?.design) spec = { ...spec, pages: { ...spec.pages, home: spec.pages.home || spec.samples.home || '', contact: spec.pages.contact || spec.samples.contact || '' } };
  const profile = await getProfile(slug);
  const siteRaw = await loadSite(client, slug);
  if (!siteRaw.phone?.digits && profile.nap.phone) siteRaw.phone = { display: profile.nap.phone, digits: profile.nap.phone.replace(/\D/g, '') };
  if (!siteRaw.address && profile.nap.address) siteRaw.address = profile.nap.address;
  // Menu and footer links that point at pages that do not exist on the live site are dropped, not shipped.
  const alive = makeExists([client.sourceDir]);
  const removedLinks = new Set();
  const prune = async (items) => {
    const keep = [];
    for (const it of items || []) {
      const t = it.href ? localTarget(it.href, 'index.html', client.host) : null;
      if (t && /\.html?$/.test(t) && !(await alive(t))) { removedLinks.add(it.href); continue; }
      keep.push({ ...it, ...(it.children ? { children: await prune(it.children) } : {}) });
    }
    return keep;
  };
  const site = { ...siteRaw, nav: await prune(siteRaw.nav), footerCols: await Promise.all((siteRaw.footerCols || []).map(async (c) => ({ ...c, items: await prune(c.items) }))) };
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
  const usedImages = new Set();
  // 'usable': approved content plus content that passed every automatic check (never content that failed a check)
  const useStatuses = content === 'none' ? [] : content === 'all' ? ['approved', 'generated', 'needs-review'] : content === 'usable' ? ['approved', 'generated'] : ['approved'];
  const buildDir = path.join(clientDir(slug), outName);
  if (!dry && !keep && (!only || !isMain)) await fs.rm(buildDir, { recursive: true, force: true });

  let todo = pages.filter((p) => (types || BUILD_TYPES).includes(p.type) && (/\.(html?|shtml)$/i.test(p.path) || (client.php && /\.php$/i.test(p.path))));
  { const set = await loadBuildSettings(slug), cx = await loadCanonicalContext(slug, client), scope = await loadScope(slug); todo = todo.filter((p) => !scopeReason(scope, p) && !skipReason(p, set, cx)); }
  if (only) todo = todo.filter((p) => only.includes(p.path));
  if (limit) todo = todo.slice(0, limit);

  const results = [];
  const seo = { alt: 0, eager: 0, lazy: 0, h1: 0, canonical: 0, titles: 0, descriptions: 0, headings: 0, srcset: 0, variants: 0 };
  const responsiveCache = new Map();

  // 1. read every page and apply its wording, so titles and descriptions can be checked against the whole site
  const items = [];
  onProgress?.({ total: todo.length, done: 0, phase: 'read' });
  const prepare = async (p) => {
    const original = await readSource(client, p.path);
    const model = extractModel(original, p.path);
    if (!model.ok) return { fail: model.reason };
    const rec = useStatuses.length ? await loadContent(slug, p.path) : null;
    const ai = rec && useStatuses.includes(rec.status) ? rec : null;
    const actx = { graph, profile, site, host: client.host, type: p.type, hasBusinessSchema: hasBusinessNode(model.head.jsonLd) };
    return { original, model, ai, finalModel: ai ? applyContent(model, ai, actx) : applyBase(model, actx) };
  };
  for (const p of todo) {
    onProgress?.({ done: items.length + results.length, path: p.path, phase: 'read' });
    const r = await prepare(p);
    if (r.fail) { results.push({ path: p.path, type: p.type, status: 'skipped', reason: r.fail }); continue; }
    items.push({ p, ...r });
  }

  // 2. titles and meta descriptions: the right length, finished sentences, and different on every page
  const heads = items.map((it) => ({
    path: it.p.path, type: it.p.type, h1: it.finalModel.hero.h1, title: it.finalModel.head.title || '', description: it.finalModel.head.description || '',
    text: cheerioText(it.finalModel),
  }));
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

  // 2b. template changes made on the sample inner and contact pages are matched to other pages by section structure
  const numbered = /\[data-sec="s\d+"\]/;
  const needFile = new Map();
  for (const x of [...(spec.tweaks || []), ...(spec.ops || []), ...(spec.sections || []), ...(spec.htmlEdits || [])]) {
    if (!['inner', 'contact'].includes(x.layout)) continue;
    const pointsAtNumber = numbered.test(x.selector || '') || numbered.test(x.target || '') || x.index > 0 || x.html;
    const file = x.file || spec.samples?.[x.layout];
    if (pointsAtNumber && file) needFile.set(file, x.layout);
  }
  let sectionSigs = null;
  const stayOnSample = [];
  const carried = { kind: 0 };
  if (needFile.size) {
    sectionSigs = {};
    const derived = [];
    const plain = { ...spec, tweaks: (spec.tweaks || []).filter((t) => !numbered.test(t.selector)), ops: [], sections: [], htmlEdits: [] };
    for (const [file] of needFile) {
      const page = pages.find((q) => q.path === file);
      const r = page && (await prepare(page));
      if (!r || r.fail) continue;
      const base = renderPage(r.finalModel, site, file, { imageMap, host: client.host, canonicalHost, spec: plain, dims: null }).html;
      sectionSigs[file] = sectionSignatures(base).map((x) => x.sig);
      const $b = cheerio.load(base);
      const made = $b('main').children('[data-sec]').toArray();
      for (const e of (spec.htmlEdits || []).filter((x) => x.file === file)) {
        const gen = made[e.index - 1];
        const edited = cheerio.load(expandForm(e.html, r.model.protected.form), null, false).root().children('section').get(0);
        const diffs = gen && edited ? classDiffs(gen, edited, 's' + e.index) : null;
        if (diffs) for (const d of diffs) derived.push({ layout: e.layout, ...d, file });
        else stayOnSample.push(`${file} (section ${e.index})`);
      }
    }
    // identifiable elements (the quote box, the text container...) are restyled on every page; layout changes stay with their structure
    const kind = kindRules([...(spec.tweaks || []), ...derived]);
    carried.kind = kind.length;
    const plainDerived = derived.map(({ anchor, ...rest }) => rest);
    if (plainDerived.length || kind.length) spec = { ...spec, tweaks: [...spec.tweaks, ...plainDerived, ...kind] };
  }

  // 3. draw, finish and write each page
  onProgress?.({ total: items.length, done: 0, phase: 'pages' });
  for (const { p, original, model, ai, finalModel } of items) {
    onProgress?.({ done: results.filter((r) => r.status !== 'skipped').length, path: p.path });
    const dims = await imageDims(finalModel, p.path, { host: client.host, roots: [client.sourceDir] });
    const { html: rawHtml, schemaRepaired, schemaBroken, imagesUsed, layout, removedHtml } = renderPage(finalModel, site, p.path, { imageMap, host: client.host, canonicalHost, skipCanon: !tagsOn, spec, dims, sectionSigs, phones: spec.kit?.design ? phonesOf(original) : [] });
    imagesUsed.forEach((f) => usedImages.add(f));
    const tagged = !imagesOn ? rawHtml : await fixImageTags(rawHtml, p.path, { host: client.host, roots: [buildDir, client.sourceDir] });
    // images the optimiser left alone (already WebP) get smaller copies and a srcset too
    let fixed = tagged;
    if (!dry && imagesOn) { const r = await addResponsiveImages(tagged, { rel: p.path, siteDir: client.sourceDir, buildDir, cache: responsiveCache }); fixed = r.html; seo.srcset += r.images; seo.variants += r.files; }
    // alt text, lazy and eager loading, one H1 and the canonical link are guaranteed on every page
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
    const v = verifyPage(model, original, html, { ...(ai ? { ai: { rec: ai, host: client.host } } : {}), removedHtml, imageMap, host: client.host, canon: tagsOn ? canon : undefined, skip: verifySkip, linkFixes: new Set(pageLinks.changes.map((c) => c.old)), headFixed: { title: Boolean(fx?.title), description: Boolean(fx?.description), h1: Boolean(fx?.h1) } });
    headLog.push({ path: p.path, type: p.type, before: headSnapshot(original), after: headSnapshot(html), wrote: { title: Boolean(fx?.title), description: Boolean(fx?.description), h1: Boolean(fx?.h1) }, social: done.head?.social || null, schema: done.head?.schema ? { page: done.head.schema.page, breadcrumb: done.head.schema.breadcrumb, faq: done.head.schema.faq, aligned: done.head.schema.aligned, notes: done.head.schema.notes } : null });
    results.push({ path: p.path, type: p.type, layout, ai: ai ? `${ai.mode}:${ai.status}` : null, ...v, schemaRepaired, schemaBroken, unhandled: model.unhandled });
    onPage?.({ path: p.path, html, result: results.at(-1) });
  }

  let cssBytes = 0;
  if (!dry) {
    await fs.cp(path.join(ROOT, 'src/assets/js'), path.join(buildDir, 'assets/js'), { recursive: true });
    await copyBanners(slug, spec, buildDir);
    await fs.mkdir(path.join(buildDir, 'assets/fonts'), { recursive: true });
    for (const f of new Set(fontsUsed(spec).map((x) => x.file))) await fs.copyFile(path.join(FONT_DIR_PATH, f), path.join(buildDir, 'assets/fonts', f));
    onProgress?.({ done: todo.length, phase: 'styling' });
    cssBytes = await compileCss(slug, spec, buildDir, isMain ? '_tw' : '_tw-preview');
  }

  const count = (s) => results.filter((r) => r.status === s).length;
  const report = {
    builtAt: new Date().toISOString(),
    cssBytes,
    template: { version: spec.version, status: spec.status },
    removedLinks: [...removedLinks],
    seo,
    head: tagsOn ? headLog : [],
    canonical: !tagsOn ? null : await buildCanonicalReport({ slug, client, ctx: canon, log: canonicalLog, linkChanges, linkFindings, scan: pages }),
    notCarried: stayOnSample,
    templateRules: { everyPage: carried.kind, bySectionStructure: Object.keys(sectionSigs || {}).length },
    totals: {
      pages: results.length, pass: count('pass'), warn: count('warn'), fail: count('fail'), skipped: count('skipped'),
      schemaRepaired: results.filter((r) => r.schemaRepaired).length,
    },
    results,
  };
  if (!only && isMain) await writeJson(path.join(clientDir(slug), 'build-report.json'), report);
  log(`Built ${results.length} pages -> clients/${slug}/${outName}/ (${report.totals.pass} pass, ${report.totals.warn} warn, ${report.totals.fail} fail)`);
  return report;
}

// the page's own words, for writing a description that matches it
export function cheerioText(model) {
  const parts = [];
  for (const b of model.blocks || []) {
    // paragraphs only: a heading has no full stop, so it would run into the sentence after it
    // (lists and headings have no full stops, so they would run into the sentence after them)
    if (b.t === 'html') parts.push(String(b.html || '').replace(/<(h[1-6]|ul|ol|table|script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div)>/gi, '$& ').replace(/<[^>]+>/g, ' '));
  }
  return parts.join(' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
}
