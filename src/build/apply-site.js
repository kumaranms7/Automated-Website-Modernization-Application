import fsp from 'node:fs/promises';
import path from 'node:path';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { BACKUP_DIR, createBackup, makeWritable, hashFile } from '../images/backup.js';

// "Build all pages" updates the website folder directly. Before the first file is written:
//   1. a verified zip backup of the whole site folder is taken (the same backups the Images step makes)
//   2. each page and shared file that is about to be replaced is copied to <site>/_modernizer-backup/pre-build/
// Every later build reads those saved originals, so rebuilding always starts from the original page, and previews, scoring and
// scans keep showing the original. "Restore original files" puts everything back and removes the files the build added.

export const PRE_BUILD = `${BACKUP_DIR}/pre-build`;
export const appliedFile = (slug) => path.join(clientDir(slug), 'applied.json');
export const loadApplied = (slug) => readJson(appliedFile(slug), null);
export const preBuildPath = (client, rel) => path.join(client.sourceDir, ...PRE_BUILD.split('/'), ...rel.split('/'));

const isFile = (p) => fsp.stat(p).then((s) => s.isFile(), () => false);
const same = async (a, b) => (await hashFile(a)) === (await hashFile(b));

async function copyKeepTime(from, to) {
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await makeWritable(to); // read-only and hidden files cannot be overwritten in place on Windows
  await fsp.copyFile(from, to);
  const st = await fsp.stat(from);
  await fsp.utimes(to, st.atime, st.mtime);
}

async function* walkFiles(dir, base = dir) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(full, base);
    else if (e.isFile()) yield path.relative(base, full).split(path.sep).join('/');
  }
}

async function pruneEmptyDirs(site, from) {
  for (let d = path.dirname(from); d.startsWith(path.resolve(site) + path.sep); d = path.dirname(d)) {
    if ((await fsp.readdir(d).catch(() => ['x'])).length) break;
    await fsp.rmdir(d).catch(() => {});
  }
}

// The file operations (no backup, no manifest), so they can be tested on plain folders.
//   results: the build's rows ({ path, status }); keepPhp: pages that must never be replaced (PHP pages)
export async function writeBuildToSite({ siteDir, buildDir, results, keepPhp = () => false, prev = null, onProgress = () => {}, onStart = null }) {
  const client = { sourceDir: siteDir };
  const pagesSet = new Set(results.map((r) => r.path));
  const pages = [], skipped = [], files = [], problems = [];
  const todo = results.filter((r) => {
    if (r.status === 'skipped') { skipped.push({ rel: r.path, reason: r.reason || 'the page layout was not recognised' }); return false; }
    if (r.status === 'fail') { skipped.push({ rel: r.path, reason: 'it failed an automatic check, so the original page was kept' }); return false; }
    if (keepPhp(r.path)) { skipped.push({ rel: r.path, reason: 'PHP page: kept as it is' }); return false; }
    return true;
  });
  const support = [];
  for await (const rel of walkFiles(buildDir)) if (!pagesSet.has(rel)) support.push(rel);
  // whether each shared file was already on the site is decided before anything is written, so a repeat after a failure still knows
  const existedAt = {};
  for (const rel of support) {
    const before = prev?.files?.find((f) => f.rel === rel);
    existedAt[rel] = before ? before.existed : prev?.pending && rel in prev.pending ? prev.pending[rel] : await isFile(path.join(siteDir, rel));
  }
  await onStart?.({ pages: todo.map((r) => ({ rel: r.path })), files: support.map((rel) => ({ rel, existed: existedAt[rel] })) });
  const total = todo.length + support.length;
  let done = 0;
  const tick = () => { done += 1; if (done % 10 === 0 || done === total) onProgress({ done, total }); };

  for (const r of todo) {
    const src = path.join(buildDir, r.path), dest = path.join(siteDir, r.path), pre = preBuildPath(client, r.path);
    if (!(await isFile(src))) { skipped.push({ rel: r.path, reason: 'it was not found in the build' }); continue; }
    if (!(await isFile(pre)) && (await isFile(dest))) await copyKeepTime(dest, pre); // the original, saved once
    await copyKeepTime(src, dest);
    if (!(await same(src, dest))) problems.push(r.path);
    pages.push({ rel: r.path });
    tick();
  }
  for (const rel of support) {
    const src = path.join(buildDir, rel), dest = path.join(siteDir, rel), pre = preBuildPath(client, rel);
    const existed = existedAt[rel];
    if (existed &&!(await isFile(pre)) && (await isFile(dest))) await copyKeepTime(dest, pre);
    await copyKeepTime(src, dest);
    if (!(await same(src, dest))) problems.push(rel);
    files.push({ rel, existed });
    tick();
  }
  if (problems.length) throw new Error(`${problems.length} file(s) did not copy correctly (first: ${problems[0]}). Use Restore original files to go back.`);
  return { pages, skipped, files };
}

export async function restoreSiteFiles({ siteDir, manifest }) {
  const client = { sourceDir: siteDir };
  let restored = 0, removed = 0;
  const missing = [];
  for (const p of manifest.pages || []) {
    const pre = preBuildPath(client, p.rel);
    if (await isFile(pre)) { await copyKeepTime(pre, path.join(siteDir, p.rel)); restored += 1; } else missing.push(p.rel);
  }
  for (const f of manifest.files || []) {
    const dest = path.join(siteDir, f.rel), pre = preBuildPath(client, f.rel);
    if (f.existed) {
      if (await isFile(pre)) { await copyKeepTime(pre, dest); restored += 1; } else missing.push(f.rel);
    } else { await makeWritable(dest); await pruneEmptyDirs(siteDir, dest); removed += 1; }
  }
  await fsp.rm(path.join(siteDir, ...PRE_BUILD.split('/')), { recursive: true, force: true });
  return { restored, removed, missing };
}

// back up, then update the site files with the finished build
export async function applyBuild(slug, report, { onProgress = () => {} } = {}) {
  const client = await loadClient(slug);
  const buildDir = path.join(clientDir(slug), 'build');
  const prev = await loadApplied(slug);
  const kept = prev && (await fsp.stat(path.join(client.sourceDir, ...PRE_BUILD.split('/'))).catch(() => null));

  // 1. the backup: taken before anything is written, and only once while the originals are still saved
  let backup;
  if (kept) backup = { id: prev.backupId, reused: true, files: prev.backupFiles, bytes: prev.backupBytes };
  else {
    onProgress({ phase: 'backup', done: 0, total: 0 });
    const row = await createBackup(slug, client, { reason: 'before Content & build updated the site files', onProgress: (p) => onProgress({ phase: 'backup', ...p }) });
    backup = { id: row.id, reused: false, files: row.files, bytes: row.bytes };
  }

  // 2. the update
  onProgress({ phase: 'apply', done: 0, total: report.results.length });
  const keepPhp = (rel) => Boolean(client.php) && /\.php$/i.test(rel) && client.phpOutput !== 'static-ok';
  // pages and shared files updated by an earlier run stay on the list, because their originals are still saved
  const union = (a, b) => [...new Map([...(a || []), ...b].map((x) => [x.rel, x])).values()];
  // the list is saved before the first file is written, so a failed update can be repeated or restored without taking a second backup
  const onStart = (planned) => writeJson(appliedFile(slug), {
    at: new Date().toISOString(), siteDir: client.sourceDir, backupId: backup.id, backupFiles: backup.files, backupBytes: backup.bytes,
    pages: union(kept ? prev.pages : [], planned.pages), files: union(kept ? prev.files : [], planned.files), skipped: [],
    builtAt: report.builtAt, firstAt: kept ? prev.firstAt || prev.at : new Date().toISOString(), partial: true,
  });
  const r = await writeBuildToSite({ siteDir: client.sourceDir, buildDir, results: report.results, keepPhp, prev: kept ? prev : null, onProgress: (p) => onProgress({ phase: 'apply', ...p }), onStart });

  const manifest = {
    at: new Date().toISOString(), siteDir: client.sourceDir, backupId: backup.id, backupFiles: backup.files, backupBytes: backup.bytes,
    pages: union(kept ? prev.pages : [], r.pages), files: union(kept ? prev.files : [], r.files), skipped: r.skipped,
    builtAt: report.builtAt, firstAt: kept ? prev.firstAt || prev.at : new Date().toISOString(),
  };
  await writeJson(appliedFile(slug), manifest);
  return { ...manifest, backupReused: backup.reused, updatedPages: r.pages.length, updatedFiles: r.files.length };
}

export async function restoreOriginals(slug) {
  const m = await loadApplied(slug);
  if (!m) throw new Error('The site files have not been updated, so there is nothing to restore.');
  const client = await loadClient(slug);
  const out = await restoreSiteFiles({ siteDir: client.sourceDir, manifest: m });
  await fsp.rm(appliedFile(slug), { force: true });
  return { ...out, backupId: m.backupId };
}

// the paths the build wrote into the site folder (so a "files changed since the scan" warning does not blame them)
export async function appliedPaths(slug) {
  const m = await loadApplied(slug);
  return new Set(m ? [...(m.pages || []), ...(m.files || [])].map((x) => x.rel) : []);
}

// puts ONE page back as it was before the updates (from the copy saved before Content & build, or before the Images step changed it)
export async function restorePage(slug, rel) {
  const client = await loadClient(slug);
  if (!rel || rel.includes('..')) throw new Error('Not a page of this website');
  const sources = [
    { from: 'Content & build', file: preBuildPath(client, rel) },
    { from: 'the Images step', file: path.join(client.sourceDir, BACKUP_DIR, 'modified-files', ...rel.split('/')) },
  ];
  for (const s of sources) {
    if (!(await isFile(s.file))) continue;
    await copyKeepTime(s.file, path.join(client.sourceDir, ...rel.split('/')));
    const m = await loadApplied(slug);
    if (m && s.from === 'Content & build') await writeJson(appliedFile(slug), { ...m, pages: (m.pages || []).filter((p) => p.rel !== rel) });
    return { rel, restoredFrom: s.from };
  }
  throw new Error('There is no saved copy of this page. Use Restore original files, or restore a full backup.');
}

// writes ONE built page into the site folder (a page the user accepted or rebuilt after the full update); the original is saved once
export async function applyOnePage(slug, rel) {
  const client = await loadClient(slug);
  if (!rel || rel.includes('..')) throw new Error('Not a page of this website');
  const m = await loadApplied(slug);
  if (!m) throw new Error('The website files have not been updated yet, so there is nothing to add this page to. Run "Build all pages" first.');
  const src = path.join(clientDir(slug), 'build', ...rel.split('/')), dest = path.join(client.sourceDir, ...rel.split('/')), pre = preBuildPath(client, rel);
  if (!(await isFile(src))) throw new Error('The built page was not found. Build the page again first.');
  if (!(await isFile(pre)) && (await isFile(dest))) await copyKeepTime(dest, pre);
  await copyKeepTime(src, dest);
  if (!(await same(src, dest))) throw new Error('The page did not copy correctly. Use "Restore this page" to go back.');
  const pages = (m.pages || []).some((p) => p.rel === rel) ? m.pages : [...(m.pages || []), { rel }];
  await writeJson(appliedFile(slug), { ...m, pages, skipped: (m.skipped || []).filter((s) => s.rel !== rel) });
  return { rel };
}
