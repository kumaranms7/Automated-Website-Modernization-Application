import fsp from 'node:fs/promises';
import { loadScope, scopeActive, inScopePage } from '../scope.js';
import { APP } from '../app-settings.js';
import path from 'node:path';
import sharp from 'sharp';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { loadImageSettings } from './optimize.js';
import { BACKUP_DIR, walkSite, createBackup, restoreBackup, listBackups, makeWritable } from './backup.js';
import * as cheerio from 'cheerio';
import { optionsOf } from '../options.js';
import { fixImageTags } from '../build/dims.js';
import { addResponsiveImages } from '../build/responsive.js';
import { finalizeHtml } from '../build/seo-final.js';
import { aiAlts, imagesNeedingAlt } from '../head/alt.js';

// Step 5: optimise the site's images in place.
//   1. analyse   - find every image, and every place (HTML, PHP, CSS, JS, XML, JSON) that uses it
//   2. back up   - verified zip of the whole site folder
//   3. convert   - JPG/PNG -> WebP (and heavy WebP recompressed); originals are moved to _modernizer-backup/original-images
//   4. tidy      - images nothing uses are moved to _modernizer-backup/unused-images
//   5. rewrite   - every reference is updated; each changed file is first copied to _modernizer-backup/modified-files
//   6. verify    - no reference may point at a missing file that was not already missing

export const MOVED = { originals: `${BACKUP_DIR}/original-images`, unused: `${BACKUP_DIR}/unused-images`, files: `${BACKUP_DIR}/modified-files` };
const IMG_EXT = /\.(jpe?g|png|webp|gif)$/i;
const TEXT_EXT = /\.(html?|php|shtml|phtml|inc|css|scss|js|mjs|json|xml|svg|txt|webmanifest|tpl|twig|ini)$|(^|\/)\.htaccess$/i;
const MAX_TEXT = 8 * 1024 * 1024;
// Editor/tool bookkeeping that merely lists file names (Dreamweaver sync notes, SEO tool reports, logs) is not a page or a use of an image.
const META_FILE = /(^|\/)_notes\/|dwsync\.xml$|seo_report|canonical_injector_report|(^|\/)error_log$|\.log$/i;
// Folders that hold old copies of pages. Their files still count as uses (they can be opened by URL), unless the user opts out.
const BACKUP_LIKE = /(^|\/)(backups?|bkp|old|archive|archived|_old|_backup|temp|tmp)(\/|$)/i;
const inplaceFile = (slug) => path.join(clientDir(slug), 'images-inplace.json');
export const loadInplace = (slug) => readJson(inplaceFile(slug), null);

const posix = path.posix;
const toOs = (client, rel) => path.join(client.sourceDir, ...rel.split('/'));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- reading text files without damaging their encoding ----------
async function readText(full) {
  const buf = await fsp.readFile(full);
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), enc: 'utf8' }; } catch { return { text: buf.toString('latin1'), enc: 'latin1' }; }
}
const writeText = async (full, text, enc) => { await makeWritable(full); await fsp.writeFile(full, Buffer.from(text, enc === 'latin1' ? 'latin1' : 'utf8')); };

// ---------- reference extraction ----------
const RE_QUOTED = /(["'])((?:(?!\1)[^\n\r]){1,500}?\.(?:jpe?g|png|webp|gif))(?:[?#][^"'\n\r]*)?\1/gi;
const RE_URL = /url\(\s*([^)'"]+?\.(?:jpe?g|png|webp|gif))(?:[?#][^)]*)?\s*\)/gi;
// bounded: long runs of path data inside SVG must not cause quadratic backtracking
const RE_TOKEN = /[\w./%+~@-]{1,300}\.(?:jpe?g|png|webp|gif)(?=[?#"'\s,;)<>]|$)/gi;
const RE_XML = />\s*((?:https?:)?\/\/[^<\s]+\.(?:jpe?g|png|webp|gif))\s*</gi;

export function extractRefs(text) {
  const out = new Set();
  for (const re of [RE_QUOTED, RE_URL, RE_XML]) { re.lastIndex = 0; for (const m of text.matchAll(re)) out.add((m[2] || m[1]).trim()); }
  RE_TOKEN.lastIndex = 0;
  for (const m of text.matchAll(RE_TOKEN)) out.add(m[0]);
  return [...out];
}

function candidates(raw, fileRel, host) {
  let p = raw;
  const abs = p.match(/^(?:https?:)?\/\/([^/]+)(\/.*)?$/i);
  if (abs) { if (abs[1].replace(/^www\./i, '').toLowerCase() !== host.replace(/^www\./i, '').toLowerCase()) return []; p = abs[2] || '/'; }
  p = p.replace(/[?#].*$/, '');
  try { p = decodeURIComponent(p); } catch { /* keep */ }
  if (!p) return [];
  const out = [];
  if (p.startsWith('/')) out.push(p.slice(1));
  else { out.push(posix.normalize(posix.join(posix.dirname(fileRel), p))); out.push(posix.normalize(p)); }
  return out.map((x) => x.replace(/^\.\//, '')).filter((x) => x && !x.startsWith('..'));
}

// ---------- inventory ----------
export async function inventory(client) {
  const images = new Map();
  const texts = [];
  for await (const f of walkSite(client)) {
    if (IMG_EXT.test(f.rel)) images.set(f.rel, { rel: f.rel, bytes: (await fsp.stat(f.full)).size });
    else if (TEXT_EXT.test(f.rel) && !META_FILE.test(f.rel)) { const st = await fsp.stat(f.full); if (st.size <= MAX_TEXT) texts.push(f); }
  }
  const lower = new Map([...images.keys()].map((k) => [k.toLowerCase(), k]));
  const byBase = new Map();
  for (const k of images.keys()) { const b = posix.basename(k).toLowerCase(); (byBase.get(b) || byBase.set(b, []).get(b)).push(k); }

  const refs = new Map(); // image rel -> [{ file, raw, how }]
  const broken = [];
  const uncertain = new Set();
  let siteWide = false;
  const resolveRef = (raw, fileRel, host) => {
    for (const c of candidates(raw, fileRel, host)) { if (images.has(c)) return { target: c, how: 'exact' }; if (lower.has(c.toLowerCase())) return { target: lower.get(c.toLowerCase()), how: 'case' }; }
    const loose = byBase.get(posix.basename(raw.replace(/[?#].*$/, '')).toLowerCase());
    if (loose?.length === 1 && candidates(raw, fileRel, host).length) return { target: loose[0], how: 'loose' };
    return null;
  };

  const hits = [];
  for (const f of texts) {
    const { text } = await readText(f.full);
    for (const raw of extractRefs(text)) {
      const r = resolveRef(raw, f.rel, client.host);
      if (r) { (refs.get(r.target) || refs.set(r.target, []).get(r.target)).push({ file: f.rel, raw, how: r.how, backup: BACKUP_LIKE.test(f.rel) }); }
      else if (candidates(raw, f.rel, client.host).length) broken.push({ file: f.rel, raw });
    }
    // paths assembled at run time ("images/" . $name . ".jpg", glob("img/*.jpg")): the images in those folders must not be touched
    if (/\.(php|phtml|inc|js|mjs)$/i.test(f.rel)) {
      for (const m of text.matchAll(/["'`]([\w./-]*\/)["'`]\s*\.\s*[$\w(]|["'`]([\w./-]*\/)\$\{?/g)) {
        const dir = (m[1] || m[2]).replace(/^\//, '');
        if (dir) uncertain.add(dir.replace(/\/$/, ''));
      }
      for (const m of text.matchAll(/(?:glob|scandir|opendir|DirectoryIterator|FilesystemIterator)\s*\(\s*["'`]([^"'`]*)["'`]/g)) {
        const dir = posix.dirname(m[1].replace(/\\/g, '/').replace(/^\//, '').replace(/\*.*$/, '') + 'x');
        uncertain.add(dir === '.' ? posix.dirname(f.rel) : dir);
      }
      if (/(?:glob|scandir|readdir)\s*\(/.test(text) && /jpe?g|png|webp|\.\*/i.test(text) && !uncertain.size) { hits.push(f.rel); }
    }
  }
  if (hits.length) siteWide = true;
  // names with spaces/brackets are easy to miss in code: count a plain mention of the file name as use
  const joined = null;
  return { images, lower, byBase, texts, refs, broken, uncertain: [...uncertain].filter(Boolean), siteWide, joined };
}

const isUncertain = (rel, dirs) => dirs.some((d) => rel.startsWith(d + '/') || rel.includes('/' + d + '/'));

// ---------- plan ----------
export async function planImages(slug) {
  const client = await loadClient(slug);
  return planFrom(client, await loadImageSettings(slug), await inventory(client), await pageLimit(slug));
}

// With a selection of pages, a picture is only touched when every page that shows it is one of the selected pages. A picture that a page
// outside the selection (or a shared stylesheet or script) also uses is left alone, because changing it would change that page too.
async function pageLimit(slug) {
  const scope = await loadScope(slug);
  if (!scopeActive(scope)) return null;
  const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const mine = new Set(scan.filter((p) => inScopePage(scope, p)).map((p) => p.path.toLowerCase()));
  return { inPage: (rel) => mine.has(String(rel).toLowerCase()), selected: mine.size };
}

async function planFrom(client, s, inv, limit = null) {
  const rows = [];
  for (const [rel, info] of inv.images) {
    const all = inv.refs.get(rel) || [];
    const live = all.filter((x) => !x.backup);
    const refCount = (s.ignoreBackupFolders ? live : all).length;
    const used = refCount > 0;
    const backupOnly = all.length > 0 && !live.length;
    const ext = posix.extname(rel).toLowerCase();
    let status;
    if (/\.gif$/i.test(rel)) status = used ? 'keep-gif' : 'unused';
    else if (isUncertain(rel, inv.uncertain) || (inv.siteWide && !used)) status = 'uncertain';
    else if (s.preserve.some((p) => rel.toLowerCase().includes(p))) status = used ? 'preserved' : 'unused';
    else if (!used) status = 'unused';
    else if (ext === '.webp') status = info.bytes > 60 * 1024 ? 'recompress' : 'keep-webp';
    else status = 'convert';
    if (limit && ['convert', 'recompress', 'unused'].includes(status)) {
      const users = live.length ? live : all;
      if (!users.length || !users.every((x) => limit.inPage(x.file))) status = 'outside';
    }
    rows.push({ rel, bytes: info.bytes, refs: refCount, status, backupOnly });
  }
  const by = (st) => rows.filter((r) => r.status === st);
  const sum = (l) => l.reduce((n, r) => n + r.bytes, 0);
  const rewriteFiles = new Set();
  for (const r of by('convert')) for (const x of inv.refs.get(r.rel)) if (x.how !== 'loose') rewriteFiles.add(x.file);
  let siteBytes = 0, siteFiles = 0;
  for await (const f of walkSite(client)) { siteFiles += 1; siteBytes += (await fsp.stat(f.full)).size; }
  const warnings = [];
  if (inv.uncertain.length) warnings.push(`Image folders used by code that builds file names at run time were left alone: ${inv.uncertain.slice(0, 6).join(', ')}.`);
  if (inv.siteWide) warnings.push('Some PHP/JS lists folders with glob/scandir. Images that nothing visibly references will not be moved.');
  if (inv.broken.length) warnings.push(`${inv.broken.length} image reference(s) already point at files that do not exist. They are reported, not changed.`);
  if (limit) warnings.push(`The update is limited to the ${limit.selected} page(s) you selected. ${by('outside').length} image(s) are also used by other pages or by shared styles, or by no page at all, and are left exactly as they are.`);
  if (inv.texts.length < 2) warnings.push('Almost no HTML/PHP/CSS files were found. Check the site folder.');
  return {
    analysedAt: new Date().toISOString(),
    site: { files: siteFiles, bytes: siteBytes },
    textFiles: inv.texts.length,
    counts: { backupOnly: rows.filter((r) => r.backupOnly).length, total: rows.length, convert: by('convert').length, recompress: by('recompress').length, unused: by('unused').length, outside: by('outside').length, preserved: by('preserved').length, uncertain: by('uncertain').length, other: by('keep-gif').length + by('keep-webp').length },
    bytes: { backupOnly: sum(rows.filter((r) => r.backupOnly)), all: sum(rows), convert: sum(by('convert')), recompress: sum(by('recompress')), unused: sum(by('unused')) },
    rewriteFiles: rewriteFiles.size,
    brokenRefs: inv.broken.slice(0, 200), brokenCount: inv.broken.length,
    uncertainDirs: inv.uncertain,
    warnings,
    images: rows.sort((a, b) => b.bytes - a.bytes),
  };
}

// ---------- apply ----------
const jobs = new Map();
export const inplaceJob = (slug) => jobs.get(slug) || null;

async function move(client, rel, destRel) {
  const from = toOs(client, rel), to = toOs(client, destRel);
  await fsp.mkdir(path.dirname(to), { recursive: true });
  let dest = to;
  for (let i = 1; await fsp.stat(dest).catch(() => null); i += 1) dest = `${to}.${i}`; // never overwrite an earlier backup
  try { await fsp.rename(from, dest); } catch { await fsp.copyFile(from, dest); await fsp.unlink(from); }
}

async function encode(buf, width, s, isPng) {
  const base = sharp(buf, { failOnError: false }).rotate();
  const meta = await base.clone().metadata();
  const w = meta.width && meta.width > width ? width : 0;
  const pipe = w ? base.clone().resize({ width: w }) : base.clone();
  const lossy = await pipe.clone().webp({ quality: s.quality, alphaQuality: 90, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true });
  if (!isPng || buf.length > 80 * 1024) return lossy;
  const lossless = await pipe.clone().webp({ lossless: true, effort: 5 }).toBuffer({ resolveWithObject: true }); // small PNGs (icons, UI art) stay crisp
  return lossless.data.length <= lossy.data.length * 1.6 ? lossless : lossy;
}

export function startInplace(slug, opts = {}) {
  if (jobs.get(slug)?.running) throw new Error('Image optimisation is already running');
  const job = { running: true, phase: 'starting', done: 0, total: 0, entries: [], startedAt: new Date().toISOString(), error: null, result: null };
  jobs.set(slug, job);
  runInplace(slug, job, opts).then((r) => { job.result = r; }).catch((e) => { job.error = e.message; }).finally(() => { job.running = false; job.finishedAt = new Date().toISOString(); });
  return job;
}

async function runInplace(slug, job, { copyTo = '' } = {}) {
  const client = await loadClient(slug);
  const s = await loadImageSettings(slug);
  job.phase = 'analysing';
  const inv = await inventory(client);
  const limit = await pageLimit(slug);
  const plan = await planFrom(client, s, inv, limit);
  const brokenBefore = new Set(inv.broken.map((b) => `${b.file}|${b.raw}`));

  job.phase = 'backup';
  const backup = await createBackup(slug, client, { reason: 'before image optimisation', copyTo, onProgress: (p) => { job.done = p.done; job.total = p.total; } });

  job.phase = 'optimising';
  const work = plan.images.filter((r) => ['convert', 'recompress', 'unused'].includes(r.status));
  job.done = 0; job.total = work.length;
  const entries = [];
  const unused = [];
  const queue = [...work];
  const worker = async () => {
    while (queue.length) {
      const r = queue.shift();
      try {
        if (r.status === 'unused') { await move(client, r.rel, `${MOVED.unused}/${r.rel}`); unused.push({ rel: r.rel, bytes: r.bytes }); job.entries.push({ orig: r.rel, file: '', status: 'moved', origBytes: r.bytes, bytes: 0 }); }
        else { const e = await optimiseOne(client, r, s, inv); entries.push(e); job.entries.push(e); }
      } catch (e) { const err = { orig: r.rel, status: 'error', error: e.message, origBytes: r.bytes }; entries.push(err); job.entries.push(err); }
      job.done += 1;
    }
  };
  await Promise.all(Array.from({ length: APP.limits.concurrency.images }, worker));

  job.phase = 'updating references';
  const renamed = entries.filter((e) => e.status === 'converted' && e.file !== e.orig);
  const modified = await rewriteReferences(client, inv, renamed);

  // a website that keeps its design is not rebuilt, so its pages get their image details here: sizes, responsive copies, lazy loading, alt text
  let tagged = [];
  if (!optionsOf(client).template) { job.phase = 'updating pages'; tagged = await tagPages(slug, client, s, job, limit); }

  job.phase = 'verifying';
  const after = await inventory(client);
  const stillBroken = after.broken.filter((b) => !brokenBefore.has(`${b.file}|${b.raw}`));

  const done = entries.filter((e) => ['converted', 'recompressed'].includes(e.status));
  const manifest = {
    runAt: new Date().toISOString(), backup, settings: s,
    status: stillBroken.length ? 'attention' : 'ok',
    problems: stillBroken.slice(0, 100),
    entries, unused, modified, uncertain: plan.images.filter((r) => r.status === 'uncertain'), preserved: plan.images.filter((r) => r.status === 'preserved'),
    brokenBefore: plan.brokenCount,
    totals: {
      processed: done.length, kept: entries.filter((e) => e.status === 'kept').length, errors: entries.filter((e) => e.status === 'error').length,
      bytesBefore: done.reduce((n, e) => n + e.origBytes, 0), bytesAfter: done.reduce((n, e) => n + e.bytes, 0),
      variantBytes: done.reduce((n, e) => n + (e.variants || []).reduce((m, v) => m + v.bytes, 0), 0),
      unusedFiles: unused.length, unusedBytes: unused.reduce((n, u) => n + u.bytes, 0), referencesRewritten: modified.reduce((n, m) => n + m.replacements, 0), filesModified: modified.length,
      newBroken: stillBroken.length,
      pagesTagged: tagged.length, srcsetImages: tagged.reduce((n, t) => n + t.srcset, 0), sizeFixed: tagged.reduce((n, t) => n + t.sized, 0), altWritten: tagged.reduce((n, t) => n + t.alt, 0), variantFiles: tagged.reduce((n, t) => n + t.variants, 0),
    },
    pages: tagged,
  };
  await writeJson(inplaceFile(slug), manifest);
  job.phase = 'done';
  return manifest;
}

// Every page: width and height on each picture, a srcset with smaller copies, lazy loading below the fold and a description for every
// picture. Only the picture tags and alt text change; each page is copied to the backup folder before it is written.
async function tagPages(slug, client, s, job, limit = null) {
  const rels = [];
  for await (const f of walkSite(client)) if (/\.html?$/i.test(f.rel) && (!limit || limit.inPage(f.rel))) rels.push(f.rel);
  job.done = 0; job.total = rels.length;
  const cache = new Map(), out = [];
  for (const rel of rels) {
    job.done += 1;
    const full = toOs(client, rel);
    let text, enc;
    try { ({ text, enc } = await readText(full)); } catch { continue; }
    if (!/<img\b/i.test(text)) continue;
    let html = await fixImageTags(text, rel, { host: client.host, roots: [client.sourceDir] });
    const sized = html !== text ? 1 : 0;
    const r = await addResponsiveImages(html, { rel, siteDir: client.sourceDir, buildDir: client.sourceDir, cache });
    html = r.html;
    let alts = null;
    if (s.aiAlt) {
      const $ = cheerio.load(html);
      alts = await aiAlts({ slug, rel, pictures: imagesNeedingAlt($), h1: $('h1').first().text().replace(/\s+/g, ' ').trim(), ai: true });
    }
    const fin = finalizeHtml(html, { rel, canonicalHost: client.host, host: client.host, alts, parts: { h1: false, tags: false } });
    html = fin.html;
    if (html === text) continue;
    const bak = toOs(client, `${MOVED.files}/${rel}`);
    if (!(await fsp.stat(bak).catch(() => null))) { await fsp.mkdir(path.dirname(bak), { recursive: true }); await fsp.copyFile(full, bak); }
    await writeText(full, html, enc);
    out.push({ file: rel, srcset: r.images, variants: r.files, sized, alt: fin.changes.alt, lazy: fin.changes.lazy, eager: fin.changes.eager });
  }
  return out;
}

async function optimiseOne(client, r, s, inv) {
  const full = toOs(client, r.rel);
  const buf = await fsp.readFile(full);
  const isPng = /\.png$/i.test(r.rel);
  const isWebp = /\.webp$/i.test(r.rel);
  const meta = await sharp(buf, { failOnError: false }).metadata();
  const out = await encode(buf, s.maxWidth, s, isPng);

  const smaller = out.data.length < buf.length * (isWebp ? 0.92 : 0.97);
  if (!smaller) return { orig: r.rel, file: r.rel, status: 'kept', origBytes: buf.length, bytes: buf.length, w: meta.width, h: meta.height, origW: meta.width, origH: meta.height, variants: [] };

  let target = isWebp ? r.rel : r.rel.replace(/\.(jpe?g|png)$/i, '.webp');
  if (!isWebp && inv.images.has(target) && target !== r.rel) target = target.replace(/\.webp$/i, '-optimized.webp');
  await move(client, r.rel, `${MOVED.originals}/${r.rel}`);
  await fsp.writeFile(toOs(client, target), out.data);

  const variants = [];
  const used = r.refs > 0;
  if (used) {
    for (const w of s.widths.filter((x) => x < out.info.width * 0.92 && x >= 320)) {
      const v = await sharp(buf, { failOnError: false }).rotate().resize({ width: w }).webp({ quality: s.quality, effort: 4, smartSubsample: true }).toBuffer({ resolveWithObject: true });
      const vf = target.replace(/\.webp$/i, `-${w}w.webp`);
      await fsp.writeFile(toOs(client, vf), v.data);
      variants.push({ file: vf, w: v.info.width, bytes: v.data.length });
    }
  }
  return { orig: r.rel, file: target, status: isWebp ? 'recompressed' : 'converted', origBytes: buf.length, bytes: out.data.length, w: out.info.width, h: out.info.height, origW: meta.width, origH: meta.height, variants };
}

// Replace each reference in place. The raw text found in the file is swapped for the same text with the new file name, so
// folder prefixes, ../ and absolute URLs are all kept. Every file is copied to the backup folder before it is changed.
async function rewriteReferences(client, inv, renamed) {
  const byOrig = new Map(renamed.map((e) => [e.orig, e]));
  const perFile = new Map();
  for (const [img, list] of inv.refs) {
    const e = byOrig.get(img);
    if (!e) continue;
    for (const ref of list) if (ref.how !== 'loose') (perFile.get(ref.file) || perFile.set(ref.file, new Map()).get(ref.file)).set(ref.raw, { to: swapName(ref.raw, e) });
  }
  const modified = [];
  for (const [file, map] of perFile) {
    const full = toOs(client, file);
    const { text, enc } = await readText(full);
    let next = text, count = 0;
    for (const [raw, { to }] of map) {
      const re = new RegExp(`(?<![\\w./%+~@-])${esc(raw)}(?=[?#"'\\s,;)<>\\\\]|$)`, 'g');
      next = next.replace(re, () => { count += 1; return to; });
    }
    if (next === text) continue;
    const bak = toOs(client, `${MOVED.files}/${file}`);
    if (!(await fsp.stat(bak).catch(() => null))) { await fsp.mkdir(path.dirname(bak), { recursive: true }); await fsp.copyFile(full, bak); }
    await writeText(full, next, enc);
    modified.push({ file, replacements: count });
  }
  return modified;
}

function swapName(raw, e) {
  const dir = raw.includes('/') ? raw.slice(0, raw.lastIndexOf('/') + 1) : '';
  return dir + posix.basename(e.file);
}

// ---------- restore pieces ----------
export async function restoreUnused(slug) {
  const client = await loadClient(slug);
  const m = await loadInplace(slug);
  let n = 0;
  for (const u of m?.unused || []) {
    const from = toOs(client, `${MOVED.unused}/${u.rel}`);
    if (!(await fsp.stat(from).catch(() => null))) continue;
    const to = toOs(client, u.rel);
    await fsp.mkdir(path.dirname(to), { recursive: true });
    if (!(await fsp.stat(to).catch(() => null))) { await fsp.rename(from, to); n += 1; }
  }
  return { restored: n };
}

// Copies the original JPG/PNG files back next to the WebP versions. References keep pointing at the WebP files.
export async function restoreOriginals(slug) {
  const client = await loadClient(slug);
  const m = await loadInplace(slug);
  let n = 0;
  for (const e of m?.entries || []) {
    if (!['converted', 'recompressed'].includes(e.status) || e.file === e.orig) continue;
    const from = toOs(client, `${MOVED.originals}/${e.orig}`);
    const to = toOs(client, e.orig);
    if (!(await fsp.stat(from).catch(() => null)) || (await fsp.stat(to).catch(() => null))) continue;
    await fsp.copyFile(from, to);
    n += 1;
  }
  return { restored: n };
}

export async function restoreSite(slug, id) {
  const client = await loadClient(slug);
  const r = await restoreBackup(slug, client, id);
  await fsp.rm(inplaceFile(slug), { force: true });
  return r;
}
export { listBackups };

export function imageIndex(manifest) {
  const idx = {};
  for (const e of manifest?.entries || []) {
    if (!['converted', 'recompressed'].includes(e.status)) continue;
    idx[e.file] = e; idx[e.orig] = e;
  }
  return idx;
}
