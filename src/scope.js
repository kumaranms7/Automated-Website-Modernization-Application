import path from 'node:path';
import { clientDir, readJson, writeJson } from './config.js';

// Which pages of a website are updated. A website can be updated as a whole, or only in the folders and pages chosen here
// (clients/<site>/scope.json). Every step reads this: the audit, the template build, the wording, the images and the report of the run.
//   { mode: 'all' }                                            the whole website (the default)
//   { mode: 'selected', items: [{ kind: 'folder', value: 'blog' }, { kind: 'folder', value: '.' }, { kind: 'page', value: 'about.html' }] }
// A folder takes everything inside it, at any depth ('.' is the pages of the main folder only); a page is one file.

const file = (slug) => path.join(clientDir(slug), 'scope.json');
const clean = (v) => String(v ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');

export function normaliseScope(input) {
  const items = [];
  for (const it of input?.items || []) {
    const kind = it?.kind === 'folder' ? 'folder' : 'page';
    let value = clean(it?.value ?? it?.path);
    if (kind === 'folder') value = value.replace(/\/+$/, '') || (String(it?.value ?? '').trim() === '.' ? '.' : '');
    if (!value || value.split('/').includes('..')) continue;
    if (!items.some((x) => x.kind === kind && x.value.toLowerCase() === value.toLowerCase())) items.push({ kind, value });
  }
  return { mode: input?.mode === 'selected' ? 'selected' : 'all', items };
}

export const scopeActive = (scope) => scope?.mode === 'selected' && Array.isArray(scope.items) && scope.items.length > 0;
export const loadScope = async (slug) => normaliseScope(await readJson(file(slug), { mode: 'all', items: [] }));

export async function saveScope(slug, input) {
  const scope = normaliseScope(input);
  if (scope.mode === 'selected' && !scope.items.length) throw new Error('Choose at least one folder or page, or switch back to the whole website.');
  const out = scope.mode === 'all' ? { mode: 'all', items: [] } : scope;
  await writeJson(file(slug), out);
  return out;
}

// is this page (a path relative to the site folder) one of the pages being updated?
export function inScopePath(scope, rel) {
  if (!scopeActive(scope)) return true;
  const p = clean(rel).toLowerCase();
  return scope.items.some((it) => {
    const v = it.value.toLowerCase();
    if (it.kind === 'page') return p === v;
    return v === '.' ? !p.includes('/') : p.startsWith(`${v}/`);
  });
}
export const inScopePage = (scope, page) => inScopePath(scope, page?.path);
export const scopeReason = (scope, page) => (inScopePage(scope, page) ? '' : 'not in the pages you selected');

// how many pages, and which folders, for the messages
export function scopeSummary(scope, pages) {
  const list = pages || [];
  const selected = scopeActive(scope) ? list.filter((p) => inScopePage(scope, p)) : list;
  return {
    mode: scopeActive(scope) ? 'selected' : 'all', total: list.length, selected: selected.length,
    folders: scopeActive(scope) ? scope.items.filter((i) => i.kind === 'folder').map((i) => (i.value === '.' ? '(main folder)' : i.value)) : [],
    pages: scopeActive(scope) ? scope.items.filter((i) => i.kind === 'page').map((i) => i.value) : [],
  };
}

// the scan reduced to the pages being updated (counts included), for the audit
export function scopedScan(data, scope) {
  if (!scopeActive(scope)) return data;
  const pages = (data.pages || []).filter((p) => inScopePage(scope, p));
  const byType = {}, issues = {};
  for (const p of pages) { byType[p.type] = (byType[p.type] || 0) + 1; for (const i of p.issues || []) issues[i.code] = (issues[i.code] || 0) + 1; }
  return { ...data, pages, summary: data.summary ? { ...data.summary, pages: pages.length, byType, issues } : data.summary };
}
