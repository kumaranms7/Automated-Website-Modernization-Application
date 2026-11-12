import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { ZipArchive } from 'archiver';
import yauzl from 'yauzl';
import { clientDir, readJson, writeJson } from '../config.js';

// Whole-site backups. A backup is a verified zip of the site folder, stored outside the site. Every risky action
// (image optimisation, a restore) takes one first, so any change can be undone.

export const BACKUP_DIR = '_modernizer-backup';
const backupsDir = (slug) => path.join(clientDir(slug), 'backups');

// Files that are never part of a backup or a restore: our own backup folder, VCS/tooling folders, and existing zips
// (the platform never modifies those, so they cannot be lost).
export function isExcluded(rel, client) {
  const r = rel.replace(/\\/g, '/');
  if (r === BACKUP_DIR || r.startsWith(BACKUP_DIR + '/') || r.startsWith(BACKUP_DIR + '.')) return true;
  if (/(^|\/)(\.git|node_modules)(\/|$)/.test(r)) return true;
  if (/\.zip$/i.test(r)) return true;
  return (client.backupExclude || []).some((x) => new RegExp(x, 'i').test(r));
}

export async function* walkSite(client, dir = client.sourceDir, base = client.sourceDir) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (isExcluded(rel, client)) continue;
    if (e.isDirectory()) yield* walkSite(client, full, base);
    else if (e.isFile()) yield { rel, full };
  }
}

// Editors such as Dreamweaver leave files read-only; Windows refuses to overwrite or delete those until the flag is cleared.
// Hidden/system files (Dreamweaver's _notes folders) cannot be overwritten in place either, so the old file is removed first.
export async function makeWritable(full) {
  await fsp.chmod(full, 0o666).catch(() => {});
  await fsp.rm(full, { force: true }).catch(() => {});
}

export async function hashFile(full) {
  const h = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(full), h);
  return h.digest('hex');
}

const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})/, '$1-');

export async function listBackups(slug) {
  return readJson(path.join(backupsDir(slug), 'index.json'), []);
}

// Removes one backup (its zip and file list). Any extra copy the user made elsewhere is not touched.
export async function deleteBackup(slug, id) {
  if (!/^\d{8}-\d{6}$/.test(id)) throw new Error('Bad backup id');
  const list = await listBackups(slug);
  if (!list.some((b) => b.id === id)) throw new Error('That backup was not found');
  let freed = 0;
  for (const f of [`${id}.zip`, `${id}.files.json`]) {
    const p = path.join(backupsDir(slug), f);
    const st = await fsp.stat(p).catch(() => null);
    if (st) { freed += st.size; await fsp.rm(p, { force: true }); }
  }
  await writeJson(path.join(backupsDir(slug), 'index.json'), list.filter((b) => b.id !== id));
  return { deleted: id, freed };
}

// Creates and verifies <client>/backups/<id>.zip. `copyTo` optionally stores a second copy elsewhere (another disk, a share).
export async function createBackup(slug, client, { reason = 'manual', copyTo = '', onProgress = () => {} } = {}) {
  await fsp.mkdir(backupsDir(slug), { recursive: true });
  const id = stamp();
  const zipPath = path.join(backupsDir(slug), `${id}.zip`);
  const files = [];
  for await (const f of walkSite(client)) files.push(f);

  const manifest = {};
  let done = 0;
  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const finished = new Promise((ok, no) => { output.on('close', ok); output.on('error', no); archive.on('error', no); });
  archive.pipe(output);
  for (const f of files) {
    const st = await fsp.stat(f.full);
    manifest[f.rel] = { sha256: await hashFile(f.full), size: st.size };
    archive.file(f.full, { name: f.rel, date: st.mtime });
    done += 1;
    if (done % 25 === 0) onProgress({ phase: 'backup', done, total: files.length });
  }
  await archive.finalize();
  await finished;

  // verification: the zip must list every file, with the right sizes, before anything is changed
  const entries = await readZipIndex(zipPath);
  const missing = Object.keys(manifest).filter((k) => !entries.has(k));
  const wrong = Object.keys(manifest).filter((k) => entries.has(k) && entries.get(k) !== manifest[k].size);
  if (missing.length || wrong.length) {
    await fsp.rm(zipPath, { force: true });
    throw new Error(`Backup verification failed (${missing.length} missing, ${wrong.length} size mismatches). Nothing was changed.`);
  }
  await writeJson(path.join(backupsDir(slug), `${id}.files.json`), manifest);
  if (!(await readJson(path.join(backupsDir(slug), 'baseline.json'), null))) await writeJson(path.join(backupsDir(slug), 'baseline.json'), manifest);

  let copy = '';
  if (copyTo) {
    await fsp.mkdir(copyTo, { recursive: true });
    copy = path.join(copyTo, `${path.basename(client.sourceDir)}-${id}.zip`);
    await fsp.copyFile(zipPath, copy);
  }
  const row = { id, reason, createdAt: new Date().toISOString(), files: files.length, bytes: (await fsp.stat(zipPath)).size, copy };
  const list = await listBackups(slug);
  list.unshift(row);
  await writeJson(path.join(backupsDir(slug), 'index.json'), list);
  onProgress({ phase: 'backup', done: files.length, total: files.length });
  return row;
}

function readZipIndex(zipPath) {
  return new Promise((ok, no) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zf) => {
      if (err) return no(err);
      const map = new Map();
      zf.on('entry', (e) => { if (!/\/$/.test(e.fileName)) map.set(e.fileName, e.uncompressedSize); zf.readEntry(); });
      zf.on('end', () => ok(map));
      zf.on('error', no);
      zf.readEntry();
    });
  });
}

// Puts the site folder back to exactly the state in the backup. A safety backup of the current state is taken first.
export async function restoreBackup(slug, client, id, { onProgress = () => {} } = {}) {
  if (!/^\d{8}-\d{6}$/.test(id)) throw new Error('Bad backup id');
  const zipPath = path.join(backupsDir(slug), `${id}.zip`);
  if (!(await fsp.stat(zipPath).catch(() => null))) throw new Error('That backup file is missing');
  const safety = await createBackup(slug, client, { reason: `before restoring ${id}`, onProgress });

  const keep = new Set();
  let n = 0;
  await new Promise((ok, no) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zf) => {
      if (err) return no(err);
      zf.on('entry', (e) => {
        if (/\/$/.test(e.fileName)) return zf.readEntry();
        const dest = path.join(client.sourceDir, e.fileName);
        if (!path.resolve(dest).startsWith(path.resolve(client.sourceDir) + path.sep)) return zf.readEntry();
        keep.add(e.fileName);
        fsp.mkdir(path.dirname(dest), { recursive: true }).then(() => makeWritable(dest)).then(() => {
          zf.openReadStream(e, (err2, rs) => {
            if (err2) return no(err2);
            pipeline(rs, fs.createWriteStream(dest)).then(() => { n += 1; if (n % 25 === 0) onProgress({ phase: 'restore', done: n }); zf.readEntry(); }, no);
          });
        }, no);
      });
      zf.on('end', ok);
      zf.on('error', no);
      zf.readEntry();
    });
  });

  // files created since the backup (converted images, rewritten variants) are removed
  let removed = 0;
  for await (const f of walkSite(client)) if (!keep.has(f.rel)) { await makeWritable(f.full); await fsp.rm(f.full, { force: true }); removed += 1; }
  await removeEmptyDirs(client.sourceDir, client);
  // the in-site backup folder is no longer needed; keep it, renamed, rather than deleting anything
  const inSite = path.join(client.sourceDir, BACKUP_DIR);
  if (await fsp.stat(inSite).catch(() => null)) await fsp.rename(inSite, `${inSite}.restored-${stamp()}`);
  return { restored: n, removed, safetyBackup: safety.id };
}

async function removeEmptyDirs(dir, client) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(client.sourceDir, full).split(path.sep).join('/');
    if (isExcluded(rel, client)) continue;
    await removeEmptyDirs(full, client);
    if (!(await fsp.readdir(full)).length) await fsp.rmdir(full).catch(() => {});
  }
}
