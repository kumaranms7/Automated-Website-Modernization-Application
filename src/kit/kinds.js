import path from 'node:path';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readSource } from '../util/source.js';
import { extractModel } from '../build/model.js';
import { loadSite } from '../build/site.js';
import { layoutFor } from '../build/render.js';
import { imageDims } from '../build/dims.js';
import { buildTargets } from '../build/build.js';
import { pageKinds } from './fit.js';

// The unique kinds of section on all the inner pages of a website, found from the pages themselves (nothing is listed in advance):
// every inner page is split into its sections the way a build splits it, and sections of the same kind are counted together.
// The inner template shows one example of each kind, so a page built from the template has a layout for every section it contains.
const file = (slug) => path.join(clientDir(slug), 'template', 'inner-kinds.json');
const ORDER = ['trust', 'about', 'services', 'features', 'steps', 'stats', 'reviews', 'faq', 'areas', 'cta', 'contact'];

export async function innerKinds(slug, spec, { onProgress } = {}) {
  const client = await loadClient(slug);
  const site = await loadSite(client, slug);
  const targets = await buildTargets(slug);
  const found = new Map();
  let pagesSeen = 0;
  for (const t of targets) {
    let model;
    try { model = extractModel(await readSource(client, t.path), t.path); } catch { continue; }
    if (!model.ok || layoutFor(model, t.path, spec) !== 'inner') continue;
    pagesSeen += 1;
    onProgress?.({ done: pagesSeen, path: t.path });
    const dims = await imageDims(model, t.path, { host: client.host, roots: [client.sourceDir] }).catch(() => null);
    let list = [];
    try { list = pageKinds({ model, site, spec, dims }); } catch { continue; }
    for (const { s, role, kind } of list) {
      const k = found.get(kind.id) || { id: kind.id, label: kind.label, role, sig: kind.sig, count: 0, pages: [], samples: [] };
      k.count += 1;
      if (!k.pages.includes(t.path)) k.pages.push(t.path);
      k.samples.push({ page: t.path, s, size: JSON.stringify(s).length });
      found.set(kind.id, k);
    }
  }
  const kinds = [...found.values()].map((k) => {
    // the example is the middle one by size: neither the shortest nor the longest of the website
    const sorted = k.samples.slice().sort((a, b) => a.size - b.size);
    const pick = sorted[Math.floor((sorted.length - 1) / 2)];
    return { id: k.id, label: k.label, role: k.role, sig: k.sig, count: k.count, pages: k.pages, example: pick.page, s: pick.s };
  }).sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || b.count - a.count);
  const out = { at: new Date().toISOString(), pages: pagesSeen, kinds };
  await writeJson(file(slug), { ...out, kinds: kinds.map(({ s, ...k }) => ({ ...k, pages: k.pages.slice(0, 12), pageCount: k.pages.length })) });
  return out;
}

export const loadInnerKinds = (slug) => readJson(file(slug), null);
