import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readSource } from '../util/source.js';
import { getProfile } from '../profile/store.js';
import { extractModel } from './model.js';
import { loadSite } from './site.js';
import { finalizeHtml } from './seo-final.js';
import { verifyPage } from './verify.js';
import { buildTargets, cheerioText } from './build.js';
import { loadContent, loadBuildSettings } from '../content/generate.js';
import { storedFixes } from '../content/seo-fix.js';
import { patchUnits, skeleton } from '../content/inplace-text.js';
import { loadManual } from '../head/review.js';
import { headContext, headSnapshot } from '../head/context.js';
import { pickShareImage } from '../head/social.js';
import { loadCanonicalContext } from '../canonical/index.js';
import { repairJsonLd } from './render.js';
import { buildCanonicalReport } from '../canonical/report.js';

// The build of a website that keeps its design ("Update Content" without "Update Template"). Each page is the page it already is: the AI's
// new wording is put back into it word for word (nothing but words changes inside the page), then the head and the search tags are
// completed. Menus, footers, pictures, forms, scripts and every class stay exactly as they are. The report has the same shape as the
// other builds, so checking, backup, writing to the website folder, restore and the reports work unchanged.
// The search tags (titles, descriptions, canonical, share tags, structured data, links) are only touched when the wording is being
// changed (Enhance or Re-write); with "Use existing content" the pages are left exactly as they are.

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// structured data the page has but search engines cannot read is repaired (only the formatting; nothing is added or removed)
function repairLd(html) {
  const $ = cheerio.load(html);
  let changed = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || '';
    try { JSON.parse(raw); return; } catch { /* broken */ }
    const r = repairJsonLd(raw);
    if (r.json && r.repaired) { $(el).html(`
${r.json}
`); changed = true; }
  });
  return changed ? $.html() : html;
}

// the new title, description and heading go into the head and heading of the page itself
function setHead(html, { title, description, h1 }) {
  const $ = cheerio.load(html);
  let changed = false;
  if (title && clean($('title').first().text()) !== clean(title)) { if ($('title').length) $('title').first().text(title); else $('head').append(`<title></title>`).find('title').text(title); changed = true; }
  if (description) {
    const m = $('head meta[name="description"]').first();
    if (m.length) { if (clean(m.attr('content')) !== clean(description)) { m.attr('content', description); changed = true; } }
    else { $('head').append(`<meta name="description" content="">`); $('head meta[name="description"]').last().attr('content', description); changed = true; }
  }
  if (h1 && $('h1').length && clean($('h1').first().text()) !== clean(h1)) { $('h1').first().text(h1); changed = true; }
  return changed ? $.html() : html;
}

export async function buildContentOnly(slug, { limit, types, only, content = 'approved', outName = 'build', log = () => {}, onProgress, dry = false, onPage, fixHeads, keep = false } = {}) {
  const client = await loadClient(slug);
  if (!client) throw new Error(`Unknown client: ${slug}`);
  const pages = await readJson(path.join(clientDir(slug), 'scan/pages.json'));
  if (!pages) throw new Error('Run a scan first');
  const isMain = outName === 'build';
  const profile = await getProfile(slug);
  const site = await loadSite(client, slug).catch(() => ({}));
  if (!site.phone?.digits && profile.nap?.phone) site.phone = { display: profile.nap.phone, digits: profile.nap.phone.replace(/\D/g, '') };
  const hset = await loadBuildSettings(slug);
  const tagsOn = hset.contentMode !== 'existing'; // the search tags follow the wording
  const canon = await loadCanonicalContext(slug, client);
  const canonicalHost = new URL(canon.domain).host;
  const hctx = headContext({ profile, site, scan: pages, canon, settings: hset });
  const buildDir = path.join(clientDir(slug), outName);
  if (!dry && !keep && (!only || !isMain)) await fs.rm(buildDir, { recursive: true, force: true });
  const useStatuses = content === 'none' ? [] : content === 'all' ? ['approved', 'generated', 'needs-review'] : content === 'usable' ? ['approved', 'generated'] : ['approved'];

  let todo = await buildTargets(slug, { types });
  if (only) todo = todo.filter((p) => only.includes(p.path));
  if (limit) todo = todo.slice(0, limit);

  const results = [], canonicalLog = [], linkChanges = [], linkFindings = [], headLog = [];
  const seo = { alt: 0, eager: 0, lazy: 0, h1: 0, canonical: 0, titles: 0, descriptions: 0, headings: 0, srcset: 0, variants: 0 };

  // 1. read every page and put the new wording into it
  const items = [];
  onProgress?.({ total: todo.length, done: 0, phase: 'read' });
  for (const p of todo) {
    onProgress?.({ done: items.length + results.length, path: p.path, phase: 'read' });
    const original = await readSource(client, p.path);
    const model = extractModel(original, p.path);
    if (!model.ok) { results.push({ path: p.path, type: p.type, status: 'skipped', reason: model.reason }); continue; }
    const rec = useStatuses.length && tagsOn ? await loadContent(slug, p.path) : null;
    const ai = rec && useStatuses.includes(rec.status) ? rec : null;
    let html = original, placed = { applied: [], skipped: [] };
    const units = (ai?.content?.units || []).filter((u) => !(ai.keep || []).includes(u.id));
    if (units.length) {
      placed = patchUnits(original, units);
      html = placed.html;
      // nothing but words may have changed: if anything else differs, the page keeps its old wording
      if (skeleton(html) !== skeleton(original)) { placed = { applied: [], skipped: units.map((u) => ({ id: u.id, why: 'the page structure would change' })) }; html = original; }
    }
    items.push({ p, original, model, ai, html, placed, head: { title: ai?.content?.title || model.head.title || '', description: ai?.content?.metaDescription || model.head.description || '' } });
  }

  // 2. titles, descriptions and headings: the right length, finished, and different on every page
  const heads = items.map((it) => ({ path: it.p.path, type: it.p.type, h1: it.model.hero.h1, title: it.head.title, description: it.head.description, text: cheerioText(it.model) }));
  onProgress?.({ phase: 'seo', done: 0, total: 0 });
  const fixes = !tagsOn ? new Map() : fixHeads ? await fixHeads(heads, { scan: pages, site, profile, client }) : await storedFixes(slug, heads);
  if (tagsOn) for (const [rel, m] of Object.entries(await loadManual(slug))) fixes.set(rel, { ...(fixes.get(rel) || {}), ...(m.title ? { title: m.title } : {}), ...(m.description ? { description: m.description } : {}), ...(m.h1 ? { h1: m.h1 } : {}) });

  // 3. finish each page and write it
  onProgress?.({ total: items.length, done: 0, phase: 'pages' });
  for (const it of items) {
    const { p, original, model, ai, placed } = it;
    onProgress?.({ done: results.filter((r) => r.status !== 'skipped').length, path: p.path });
    const fx = fixes.get(p.path);
    let html = it.html;
    let pageLinks = { changes: [], findings: [] }, done = null;
    if (tagsOn) {
      html = repairLd(html);
      html = setHead(html, { title: fx?.title || it.head.title, description: fx?.description || it.head.description, h1: fx?.h1 });
      if (fx?.title) seo.titles += 1;
      if (fx?.description) seo.descriptions += 1;
      if (fx?.h1) seo.headings += 1;
      const wantHead = hset.socialTags || hset.schema;
      const shareImg = wantHead ? await pickShareImage(cheerio.load(html), { rel: p.path, domain: canon.domain, roots: [client.sourceDir], defaultImage: hctx.defaultImage }) : null;
      done = finalizeHtml(html, { rel: p.path, canonicalHost, host: client.host, canon, parts: { images: false }, head: wantHead ? { social: hset.socialTags, schema: hset.schema, type: p.type, facts: hctx.facts, biz: hctx.biz, brand: hctx.biz.name || hctx.brand, img: shareImg, folderInfo: hctx.folderInfo, homeName: hctx.homeName } : null });
      html = done.html;
      for (const k of Object.keys(done.changes)) seo[k] += done.changes[k];
      const { links, ...row } = done.canon;
      pageLinks = links;
      canonicalLog.push({ path: p.path, ...row });
      linkChanges.push(...links.changes); linkFindings.push(...links.findings);
    }
    if (!dry) {
      const target = path.join(buildDir, p.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, html);
    }
    const v = verifyPage(model, original, html, { ...(ai ? { ai: { rec: ai, host: client.host } } : {}), host: client.host, ...(tagsOn ? { canon, linkFixes: new Set(pageLinks.changes.map((c) => c.old)) } : {}), skip: ['img-alt-attr', 'img-alt-text', 'img-dimensions', 'content-images', ...(tagsOn ? [] : ['schema-valid', 'schema-present'])], headFixed: { title: Boolean(fx?.title || ai?.content?.title), description: Boolean(fx?.description || ai?.content?.metaDescription), h1: Boolean(fx?.h1) } });
    if (placed.skipped.length) v.checks = [...v.checks, { id: 'words-placed', level: 'warn', ok: false, msg: `${placed.skipped.length} of ${placed.applied.length + placed.skipped.length} new text changes could not be placed and were left as they were` }];
    headLog.push({ path: p.path, type: p.type, before: headSnapshot(original), after: headSnapshot(html), wrote: { title: Boolean(fx?.title), description: Boolean(fx?.description), h1: Boolean(fx?.h1) }, social: done?.head?.social || null, schema: done?.head?.schema ? { page: done.head.schema.page, breadcrumb: done.head.schema.breadcrumb, faq: done.head.schema.faq, aligned: done.head.schema.aligned, notes: done.head.schema.notes } : null });
    results.push({ path: p.path, type: p.type, layout: 'original', ai: ai ? `${ai.mode}:${ai.status}` : null, ...v, status: v.status === 'pass' && placed.skipped.length ? 'warn' : v.status, schemaRepaired: 0, schemaBroken: 0, unhandled: model.unhandled, wording: { placed: placed.applied.length, notPlaced: placed.skipped.length } });
    onPage?.({ path: p.path, html, result: results.at(-1) });
  }

  const count = (s) => results.filter((r) => r.status === s).length;
  const report = {
    builtAt: new Date().toISOString(), cssBytes: 0, template: { version: 'kept as it is', status: 'kept' }, removedLinks: [], seo,
    head: tagsOn ? headLog : [],
    canonical: tagsOn ? await buildCanonicalReport({ slug, client, ctx: canon, log: canonicalLog, linkChanges, linkFindings, scan: pages }) : null,
    notCarried: [], templateRules: { contentOnly: true, converted: results.filter((r) => r.status !== 'skipped').length },
    totals: { pages: results.length, pass: count('pass'), warn: count('warn'), fail: count('fail'), skipped: count('skipped'), schemaRepaired: 0 },
    results,
  };
  if (!only && isMain) await writeJson(path.join(clientDir(slug), 'build-report.json'), report);
  return report;
}
