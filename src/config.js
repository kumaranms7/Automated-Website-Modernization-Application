import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// where the websites and the settings are kept: the folder the desktop app was given, or the project folder
export const DATA_DIR = process.env.SM_DATA_DIR ? path.resolve(process.env.SM_DATA_DIR) : ROOT;
export const CLIENTS_DIR = path.join(DATA_DIR, 'clients');

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

export function assertSlug(slug) {
  if (!SLUG_RE.test(slug || '')) throw new Error('Invalid client slug');
  return slug;
}

export function clientDir(slug) {
  return path.join(CLIENTS_DIR, assertSlug(slug));
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  // written beside the file and renamed into place, so a crash or a second write at the same moment never leaves half a file
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  for (let i = 0; ; i += 1) {
    try { await fs.rename(tmp, file); return; } catch (e) {
      if (i < 6 && ['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { await new Promise((r) => setTimeout(r, 40 * (i + 1))); continue; }
      await fs.rm(tmp, { force: true });
      throw e;
    }
  }
}

export const loadClient = (slug) => readJson(path.join(clientDir(slug), 'client.json'));

export async function listClients() {
  await fs.mkdir(CLIENTS_DIR, { recursive: true });
  const out = [];
  for (const d of await fs.readdir(CLIENTS_DIR, { withFileTypes: true })) {
    if (!d.isDirectory() || !SLUG_RE.test(d.name)) continue;
    const c = await loadClient(d.name);
    if (c && !c.hidden) out.push({ slug: d.name, ...c });
  }
  return out;
}
