import fs from 'node:fs/promises';
import { readSource } from '../util/source.js';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { readHtml } from '../util/html.js';

// Every local reference (links, images, scripts, styles) on every rebuilt page must resolve to a file
// that exists in the build or on the live site. Breakage that already existed on the original page is
// reported separately so it never blocks a page that did not cause it.

const SKIP = /^(#|mailto:|tel:|sms:|javascript:|data:|blob:|about:)/i;

export function refsOf(html) {
  const $ = cheerio.load(html);
  const out = [];
  const add = (ref, kind) => { if (ref && ref.trim()) out.push({ ref: ref.trim(), kind }); };
  $('a[href]').each((_, e) => add($(e).attr('href'), 'link'));
  $('img[src]').each((_, e) => add($(e).attr('src'), 'image'));
  $('img[srcset], source[srcset]').each((_, e) => $(e).attr('srcset').split(',').forEach((s) => add(s.trim().split(/\s+/)[0], 'image')));
  $('script[src]').each((_, e) => add($(e).attr('src'), 'script'));
  $('link[href]').each((_, e) => {
    const rel = ($(e).attr('rel') || '').toLowerCase();
    if (/stylesheet|icon|preload|manifest/.test(rel)) add($(e).attr('href'), 'asset');
  });
  return out;
}

export function localTarget(ref, pagePath, host) {
  if (SKIP.test(ref) || ref.startsWith('//')) return null;
  let r = ref;
  const abs = r.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
  if (abs) {
    if (abs[1].replace(/^www\./i, '').toLowerCase() !== host.replace(/^www\./i, '').toLowerCase()) return null;
    r = abs[2] || '/';
  }
  r = r.split('#')[0].split('?')[0];
  if (!r) return null;
  let rel = r.startsWith('/') ? r.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(pagePath), r));
  if (rel.startsWith('..')) return '../' + rel;
  if (!rel || rel.endsWith('/')) rel += 'index.html';
  return decodeURIComponent(rel.replace(/^\.\//, ''));
}

export function makeExists(roots) {
  const cache = new Map();
  return async (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    let ok = false;
    for (const root of roots) {
      const st = await fs.stat(path.join(root, rel)).catch(() => null);
      if (st?.isFile()) { ok = true; break; }
      if (st?.isDirectory()) {
        for (const idx of ['index.html', 'index.php', 'index.htm']) if (await fs.stat(path.join(root, rel, idx)).catch(() => null)) ok = true;
        if (ok) break;
      }
    }
    cache.set(rel, ok);
    return ok;
  };
}

export async function checkLinks({ client, buildDir, paths }) {
  const exists = makeExists([buildDir, client.sourceDir]);
  const existsOriginal = makeExists([client.sourceDir]);
  const perPage = {};
  let broken = 0, fresh = 0;
  for (const p of paths) {
    const html = await fs.readFile(path.join(buildDir, p), 'utf8');
    const original = await readSource(client, p);
    const originallyBroken = new Set();
    for (const r of refsOf(original)) {
      const t = localTarget(r.ref, p, client.host);
      if (t && !(await existsOriginal(t))) originallyBroken.add(t);
    }
    const list = [];
    const seen = new Set();
    for (const r of refsOf(html)) {
      const t = localTarget(r.ref, p, client.host);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      if (!(await exists(t))) list.push({ ref: r.ref, target: t, kind: r.kind, preExisting: originallyBroken.has(t) });
    }
    if (list.length) perPage[p] = list;
    broken += list.length;
    fresh += list.filter((x) => !x.preExisting).length;
  }
  return { perPage, totals: { broken, newlyBroken: fresh, preExisting: broken - fresh } };
}
