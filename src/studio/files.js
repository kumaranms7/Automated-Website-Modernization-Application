import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { clientDir, readJson, writeJson } from '../config.js';

// Where the design studio keeps its data, inside the website's own folder:
//   studio/brief.json            the design brief
//   studio/variants/<id>.json    generated design variants (kept until deleted)
//   studio/pages/<id>.json       composed pages (templates) with their revision history
//   studio/saved-sections.json   sections the user saved for reuse
//   studio/thumbs/<id>/*.jpg     rendered thumbnails

export const studioDir = (slug) => path.join(clientDir(slug), 'studio');
export const thumbDir = (slug, id) => path.join(studioDir(slug), 'thumbs', id);
const dirOf = (slug, kind) => path.join(studioDir(slug), kind);
export const newId = (prefix) => `${prefix}${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const safe = (id) => { if (!/^[\w-]{1,40}$/.test(String(id))) throw new Error('Bad id'); return id; };

export async function listJson(slug, kind) {
  const d = dirOf(slug, kind);
  const out = [];
  for (const f of await fs.readdir(d).catch(() => [])) if (f.endsWith('.json')) { const j = await readJson(path.join(d, f), null); if (j) out.push(j); }
  return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
export const readItem = (slug, kind, id) => readJson(path.join(dirOf(slug, kind), `${safe(id)}.json`), null);
export const writeItem = (slug, kind, item) => writeJson(path.join(dirOf(slug, kind), `${safe(item.id)}.json`), item);
export async function deleteItem(slug, kind, id) {
  await fs.rm(path.join(dirOf(slug, kind), `${safe(id)}.json`), { force: true });
  if (kind === 'variants') await fs.rm(thumbDir(slug, id), { recursive: true, force: true });
}

export const readBrief = (slug) => readJson(path.join(studioDir(slug), 'brief.json'), null);
export const writeBrief = (slug, b) => writeJson(path.join(studioDir(slug), 'brief.json'), b);
export const readSaved = (slug) => readJson(path.join(studioDir(slug), 'saved-sections.json'), []);
export const writeSaved = (slug, list) => writeJson(path.join(studioDir(slug), 'saved-sections.json'), list);
