import fs from 'node:fs/promises';
import { APP } from '../app-settings.js';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { clientDir, loadClient, writeJson } from '../config.js';
import { extractPage } from './extract.js';
import { classify, isSkipped } from './classify.js';
import { detectStructure } from './structure.js';
import { auditPages } from './audit.js';
import { readHtml } from '../util/html.js';
import { renderPhp, phpAvailable } from '../php/render.js';

// Directories that hold assets/config/backups, never pages.
const IGNORE_DIRS = new Set(['_notes', 'cgi-bin', 'backup', 'mform', 'css', 'js', 'images', 'font', 'fonts', 'node_modules', '.git', 'includes', 'common', '_modernizer-backup']);
const PAGE_EXT = /\.(html?|php|shtml)$/i;

async function* walk(dir, base, ignore) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!ignore.has(e.name.toLowerCase()) && !e.name.toLowerCase().startsWith('_modernizer-backup')) yield* walk(path.join(dir, e.name), base, ignore);
    } else if (PAGE_EXT.test(e.name)) {
      yield path.relative(base, path.join(dir, e.name)).split(path.sep).join('/');
    }
  }
}

// client.json options (all optional):
//   scanRoots: ["service-areas"]   only scan these sub-folders of the site folder
//   ignoreDirs: ["old", "zips"]    extra folders to skip
//   php: { bin, host }             render .php pages with the PHP CLI so their output can be analysed
// { updated: true } audits the website folder as it is now (after the updates) and keeps it beside the first scan, which is left as it was
export async function scanClient(slug, log = console.log, { updated = false } = {}) {
  const client = await loadClient(slug);
  if (!client) throw new Error(`Unknown client: ${slug}`);
  const cfg = client.classify || {};
  const ignore = new Set([...IGNORE_DIRS, ...(client.ignoreDirs || [])].map((d) => d.toLowerCase()));
  const phpOn = Boolean(client.php) && (await phpAvailable(client.php.bin));
  const roots = client.scanRoots?.length ? client.scanRoots : [''];
  const pages = [];
  const skipped = [];

  const files = [];
  for (const root of roots) for await (const rel of walk(path.join(client.sourceDir, root), client.sourceDir, ignore)) files.push(rel);

  // how this website is laid out (folders of city pages, the word that names a city page ...), from its own file names
  const hints = detectStructure(files.filter((f) => !isSkipped(f, cfg)), cfg);

  const handle = async (rel) => {
    const why = isSkipped(rel, cfg);
    if (why) { skipped.push({ path: rel, reason: why }); return; }
    const saved = path.join(client.sourceDir, '_modernizer-backup', 'pre-build', ...rel.split('/'));
    const full = !/\.php$/i.test(rel) && !updated && existsSync(saved) ? saved : path.join(client.sourceDir, rel); // the original, once the site files were updated
    const isPhp = /\.php$/i.test(rel);
    let html, phpBlocks = 0;
    if (isPhp) {
      const source = await readHtml(full);
      phpBlocks = (source.match(/<\?(?:php|=)/g) || []).length;
      if (!phpOn) { skipped.push({ path: rel, reason: 'php-not-rendered' }); return; }
      const r = await renderPhp(client, full);
      if (!r.ok || !/<(h1|title|body)\b/i.test(r.html)) { skipped.push({ path: rel, reason: r.ok ? 'not-a-page' : 'render-error' }); return; }
      html = r.html;
    } else {
      html = await readHtml(full);
    }
    const page = extractPage(html, rel);
    if (isPhp) { page.engine = 'php'; page.phpBlockCount = phpBlocks; }
    page.type = classify(rel, cfg, hints, page);
    pages.push(page);
  };

  // PHP rendering spawns a process per page, so run a few at a time.
  const queue = [...files];
  await Promise.all(Array.from({ length: phpOn ? APP.limits.concurrency.phpScan : 1 }, async () => { while (queue.length) await handle(queue.shift()); }));
  pages.sort((a, b) => a.path.localeCompare(b.path));

  const audited = auditPages(pages, client.host);
  const summary = { scannedAt: new Date().toISOString(), pages: audited.length, skipped: skipped.length, byType: {}, issues: {}, engine: phpOn ? 'php+html' : 'html' };
  for (const p of audited) {
    summary.byType[p.type] = (summary.byType[p.type] || 0) + 1;
    for (const i of p.issues) summary.issues[i.code] = (summary.issues[i.code] || 0) + 1;
  }

  const dir = path.join(clientDir(slug), 'scan');
  const [pf, sf] = updated ? ['updated-pages.json', 'updated-summary.json'] : ['pages.json', 'summary.json'];
  await writeJson(path.join(dir, pf), audited);
  if (!updated) await writeJson(path.join(dir, 'structure.json'), hints);
  await writeJson(path.join(dir, sf), { ...summary, skippedFiles: skipped });
  log(`Scanned ${audited.length} pages (${skipped.length} skipped) → clients/${slug}/scan/`);
  return summary;
}
