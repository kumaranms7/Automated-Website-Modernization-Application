import fs from 'node:fs/promises';
import path from 'node:path';
import { clientDir } from '../config.js';
import { KIND_TEXT } from './index.js';
import { classifyPages, analyseSitemap } from './sitemap.js';

// The canonical part of a build report: what was done to every page's canonical tag, which .htaccess rules were used and which
// ignored, the links that were pointed at their final page, and what the sitemap check found.
export const sitemapFile = (slug) => path.join(clientDir(slug), 'sitemap-recommended.xml');

export async function buildCanonicalReport({ slug, client, ctx, log, linkChanges, linkFindings, scan }) {
  // the status of every page of the website: the pages this build wrote use the canonical it wrote, the others the one they have
  const rebuilt = new Map(log.map((x) => [x.path, x.url || '']));
  const pages = [];
  for (const p of scan) {
    let mtime = '';
    try { mtime = (await fs.stat(path.join(client.sourceDir, p.path))).mtime.toISOString().slice(0, 10); } catch { /* the file is not there */ }
    pages.push({ rel: p.path, noindex: /noindex/i.test(p.robots || ''), canonicals: p.canonical ? [p.canonical] : [], mtime });
  }
  const classified = classifyPages(pages, ctx, { rebuilt });
  let smText = null;
  try { smText = await fs.readFile(path.join(client.sourceDir, 'sitemap.xml'), 'utf8'); } catch { /* no sitemap */ }
  const sm = analyseSitemap(smText, ctx, classified);
  await fs.writeFile(sitemapFile(slug), sm.newXml);
  const statuses = {};
  for (const c of classified) statuses[c.status] = (statuses[c.status] || 0) + 1;
  return {
    domain: ctx.domain, domainFromProfile: ctx.fromProfile, cleanUrls: ctx.cleanUrls, htaccess: ctx.htaccess,
    rules: ctx.rules.map((r) => ({ kind: r.kind, kindText: KIND_TEXT[r.kind], line: r.line, raw: r.raw })),
    ignoredRules: ctx.ignored.map((r) => ({ line: r.line, raw: r.raw, why: r.why })),
    pages: log,
    links: { changes: linkChanges, findings: linkFindings },
    pageStatus: statuses,
    sitemap: { found: sm.found, kind: sm.kind, error: sm.error, entries: sm.entries, ok: sm.ok, issues: sm.issues, missing: sm.missing, livePages: sm.livePages, newCount: sm.newCount, extras: sm.extras },
  };
}
