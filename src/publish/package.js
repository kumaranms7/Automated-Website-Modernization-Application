import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { loadValidation } from '../validate/site.js';
import { loadInplace, MOVED } from '../images/inplace.js';

// Publishing is deliberately manual: this module builds a self-contained package (upload set + backup of
// every original file it replaces + rollback set) and can rehearse the deploy and the rollback on a local
// folder. Nothing is ever uploaded or changed on the live site by the platform.

const pubDir = (slug) => path.join(clientDir(slug), 'publish');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const readOrNull = (f) => fs.readFile(f).catch(() => null);
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})/, '$1-');

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

// Which shared files do the chosen pages need?
// What is on the live site for a file right now. After Step 5 the site folder itself has changed, so the live version is
// found in the newest uploaded package, else in the backup folders (original image / unmodified file), else the folder itself.
async function liveBytes(slug, client, rel, uploaded, baseline) {
  for (const id of uploaded) {
    const b = await readOrNull(path.join(pubDir(slug), id, 'deploy', rel));
    if (b) return b;
  }
  return (await readOrNull(path.join(client.sourceDir, MOVED.files, rel)))
    || (await readOrNull(path.join(client.sourceDir, MOVED.originals, rel)))
    || (await currentIfUnchanged(client, rel, baseline));
}

// The folder's current file only counts as "live" if it still matches what was backed up before any change (or, when
// no backup exists yet, always). A file created by the image step is not on the live site.
async function currentIfUnchanged(client, rel, baseline) {
  const cur = await readOrNull(path.join(client.sourceDir, rel));
  if (!baseline) return cur;
  const b = baseline[rel];
  return cur && b && sha(cur) === b.sha256 ? cur : null;
}

async function dependenciesOf(buildDir, pages) {
  const need = new Set(['assets/css/site.min.css']);
  for (const f of await walk(path.join(buildDir, 'assets/js'), buildDir)) need.add(f);
  for (const f of await walk(path.join(buildDir, 'assets/fonts'), buildDir)) need.add(f);
  for (const p of pages) {
    const html = await fs.readFile(path.join(buildDir, p), 'utf8');
    for (const m of html.matchAll(/assets\/img\/[A-Za-z0-9._-]+\.(?:webp|jpe?g|png)/g)) need.add(m[0]);
  }
  return [...need];
}

export function pickPages(validation, { scope = 'ready', count = 10, paths, types, includeReview = false }) {
  let list = Object.entries(validation.pages)
    .filter(([, p]) => p.readiness === 'ready' || (includeReview && p.readiness === 'review'))
    .map(([k, p]) => ({ path: k, type: p.type }));
  if (types?.length) list = list.filter((p) => types.includes(p.type));
  if (paths?.length) list = list.filter((p) => paths.includes(p.path));
  if (scope === 'canary') {
    // a small, varied first batch: round-robin across page types
    const by = {};
    list.forEach((p) => (by[p.type] ||= []).push(p));
    const out = [];
    while (out.length < count && Object.values(by).some((a) => a.length)) for (const t of Object.keys(by)) { const n = by[t].shift(); if (n && out.length < count) out.push(n); }
    list = out;
  }
  return list.map((p) => p.path);
}

export async function createPackage(slug, opts = {}) {
  const client = await loadClient(slug);
  const validation = await loadValidation(slug);
  if (!validation) throw new Error('Run validation first');
  const report = await readJson(path.join(clientDir(slug), 'build-report.json'));
  if (new Date(validation.validatedAt) < new Date(report.builtAt)) throw new Error('The build changed after the last validation. Run validation again.');

  const pages = pickPages(validation, opts);
  if (!pages.length) throw new Error('No ready pages match that selection');
  const buildDir = path.join(clientDir(slug), 'build');
  const deps = await dependenciesOf(buildDir, pages);

  const id = stamp();
  const root = path.join(pubDir(slug), id);
  // Files changed by the image step (optimised images and the text files whose references were rewritten) travel with the pages.
  const inplace = await loadInplace(slug);
  const fromSite = new Set();
  for (const e of inplace?.entries || []) {
    if (!['converted', 'recompressed'].includes(e.status)) continue;
    fromSite.add(e.file);
    (e.variants || []).forEach((v) => fromSite.add(v.file));
  }
  for (const m of inplace?.modified || []) if (!pages.includes(m.file)) fromSite.add(m.file);

  const uploaded = (await listPackages(slug)).filter((l) => l.state === 'uploaded').map((l) => l.id);
  const baseline = await readJson(path.join(clientDir(slug), 'backups', 'baseline.json'), null);
  const files = [];
  const all = [...pages.map((rel) => ({ rel, kind: 'page', src: path.join(buildDir, rel) })), ...deps.map((rel) => ({ rel, kind: 'asset', src: path.join(buildDir, rel) })), ...[...fromSite].map((rel) => ({ rel, kind: 'asset', src: path.join(client.sourceDir, rel) }))];
  for (const { rel, kind, src } of all) {
    const next = await readOrNull(src);
    if (!next) throw new Error(`Output missing: ${rel}`);
    const prev = await liveBytes(slug, client, rel, uploaded, baseline);
    const newSha = sha(next), oldSha = prev ? sha(prev) : null;
    if (oldSha === newSha) continue; // identical file already live
    files.push({ path: rel, kind, action: prev ? 'replace' : 'add', bytes: next.length, sha256: newSha, oldSha256: oldSha });
    await fs.mkdir(path.dirname(path.join(root, 'deploy', rel)), { recursive: true });
    await fs.writeFile(path.join(root, 'deploy', rel), next);
    if (prev) {
      await fs.mkdir(path.dirname(path.join(root, 'backup', rel)), { recursive: true });
      await fs.writeFile(path.join(root, 'backup', rel), prev);
    }
  }
  if (!files.length) throw new Error('Everything in that selection is already live and identical');

  const added = files.filter((f) => f.action === 'add').map((f) => f.path);
  const manifest = {
    id, createdAt: new Date().toISOString(), note: opts.note || '', scope: opts.scope || 'ready',
    site: client.host, validatedAt: validation.validatedAt,
    totals: { pages: files.filter((f) => f.kind === 'page').length, assets: files.filter((f) => f.kind === 'asset').length, replaced: files.filter((f) => f.action === 'replace').length, added: added.length, bytes: files.reduce((n, f) => n + f.bytes, 0) },
    files,
  };
  await writeJson(path.join(root, 'manifest.json'), manifest);

  // upload set
  const deploy = new AdmZip();
  for (const f of files) deploy.addLocalFile(path.join(root, 'deploy', f.path), path.posix.dirname(f.path) === '.' ? '' : path.posix.dirname(f.path));
  deploy.writeZip(path.join(root, 'deploy.zip'));
  // rollback set: the exact originals that were replaced, in the same folders
  const rb = new AdmZip();
  for (const f of files.filter((x) => x.action === 'replace')) rb.addLocalFile(path.join(root, 'backup', f.path), path.posix.dirname(f.path) === '.' ? '' : path.posix.dirname(f.path));
  if (added.length) rb.addFile('_NEW-FILES-TO-DELETE-IF-ROLLING-BACK.txt', Buffer.from(added.join('\n')));
  rb.writeZip(path.join(root, 'rollback.zip'));

  await fs.writeFile(path.join(root, 'README.txt'), readme(client, manifest));
  const ledger = await readJson(path.join(pubDir(slug), 'ledger.json'), []);
  ledger.unshift({ id, createdAt: manifest.createdAt, pages: manifest.totals.pages, files: files.length, state: 'created', note: manifest.note });
  await writeJson(path.join(pubDir(slug), 'ledger.json'), ledger);
  return manifest;
}

function readme(client, m) {
  return `PUBLISH PACKAGE ${m.id} - ${client.name}
Created ${m.createdAt}

WHAT IS IN HERE
  deploy.zip     ${m.totals.pages} pages + ${m.totals.assets} shared files. Upload and extract into the site root.
  rollback.zip   The ${m.totals.replaced} original files this package replaces. Upload to undo.
  backup/        The same originals, unzipped.
  manifest.json  Every file with its checksum.

UPLOAD (FTP)
  1. Take a fresh full backup of the live site if you have not today.
  2. Extract deploy.zip locally and upload the contents to the web root, overwriting files with the same name.
     ${m.totals.added} file(s) are new (the assets folder); ${m.totals.replaced} replace existing files. No URL changes.
  3. Open a few of the pages on the live site. Check: phone number, quote form, menu, mobile layout.
  4. Submit one test form lead and confirm it arrives.

ROLLBACK
  Upload rollback.zip contents over the live site. The new files can stay (nothing links to them after rollback)
  or be deleted using the list inside rollback.zip.
`;
}

export async function listPackages(slug) {
  return readJson(path.join(pubDir(slug), 'ledger.json'), []);
}
export async function getPackage(slug, id) {
  if (!/^\d{8}-\d{6}$/.test(id)) throw new Error('Bad package id');
  return readJson(path.join(pubDir(slug), id, 'manifest.json'), null);
}
export const packageFile = (slug, id, name) => {
  if (!/^\d{8}-\d{6}$/.test(id) || !['deploy.zip', 'rollback.zip', 'README.txt', 'manifest.json'].includes(name)) throw new Error('Bad request');
  return path.join(pubDir(slug), id, name);
};

export async function setPackageState(slug, id, state) {
  if (!['created', 'uploaded'].includes(state)) throw new Error('Bad state');
  const ledger = await listPackages(slug);
  const row = ledger.find((l) => l.id === id);
  if (!row) throw new Error('Unknown package');
  row.state = state;
  if (state === 'uploaded') row.uploadedAt = new Date().toISOString();
  await writeJson(path.join(pubDir(slug), 'ledger.json'), ledger);
  return row;
}

// Rehearse the upload on a local copy of the site (e.g. a staging folder). Refuses if a file in the target
// is not the one that was backed up, so a stale or edited live copy can never be overwritten silently.
export async function deployToFolder(slug, id, target, { force = false } = {}) {
  const m = await getPackage(slug, id);
  if (!m) throw new Error('Unknown package');
  const st = await fs.stat(target).catch(() => null);
  if (!st?.isDirectory()) throw new Error('Target folder does not exist');
  if (path.resolve(target) === path.resolve((await loadClient(slug)).sourceDir)) throw new Error('That is the original site folder. Rehearse on a copy of it instead, so the original stays untouched.');
  const root = path.join(pubDir(slug), id);
  const mismatched = [];
  for (const f of m.files) {
    const cur = await readOrNull(path.join(target, f.path));
    if (f.action === 'replace' && (!cur || sha(cur) !== f.oldSha256)) mismatched.push(f.path);
    if (f.action === 'add' && cur && sha(cur) !== f.sha256) mismatched.push(f.path);
  }
  if (mismatched.length && !force) throw new Error(`${mismatched.length} file(s) in the target differ from the backed-up originals (first: ${mismatched[0]}). The target is not the same site copy this package was made from.`);
  for (const f of m.files) {
    await fs.mkdir(path.dirname(path.join(target, f.path)), { recursive: true });
    await fs.copyFile(path.join(root, 'deploy', f.path), path.join(target, f.path));
  }
  return { copied: m.files.length, target };
}

export async function rollbackFromFolder(slug, id, target, { force = false } = {}) {
  const m = await getPackage(slug, id);
  if (!m) throw new Error('Unknown package');
  const root = path.join(pubDir(slug), id);
  const changed = [];
  for (const f of m.files) {
    const cur = await readOrNull(path.join(target, f.path));
    if (cur && sha(cur) !== f.sha256) changed.push(f.path);
  }
  if (changed.length && !force) throw new Error(`${changed.length} file(s) were edited after this package was deployed (first: ${changed[0]}). Roll back anyway only if you are sure.`);
  let restored = 0, removed = 0;
  for (const f of m.files) {
    if (f.action === 'replace') { await fs.copyFile(path.join(root, 'backup', f.path), path.join(target, f.path)); restored += 1; }
    else {
      await fs.rm(path.join(target, f.path), { force: true });
      removed += 1;
      // tidy up folders this package created
      for (let d = path.dirname(path.join(target, f.path)); d.length > target.length; d = path.dirname(d)) { try { await fs.rmdir(d); } catch { break; } }
    }
  }
  return { restored, removed, target };
}
