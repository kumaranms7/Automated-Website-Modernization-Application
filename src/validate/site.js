import fs from 'node:fs/promises';
import path from 'node:path';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readHtml, esc } from '../util/html.js';
import { buildClient } from '../build/build.js';
import { getProfile } from '../profile/store.js';
import { loadContent } from '../content/generate.js';
import { findForbiddenClaims } from '../content/validate.js';
import * as cheerio from 'cheerio';
import { checkLinks } from './links.js';
import { seoChecks, CHECK_INFO } from './seo.js';
import { loadCanonicalContext } from '../canonical/index.js';
import { areasOf, inScope, optionsOf, auditAreaOf } from '../options.js';
import { extractPage } from '../scanner/extract.js';
import { auditPages } from '../scanner/audit.js';
import { loadBuildSettings } from '../content/generate.js';
import { loadApplied } from '../build/apply-site.js';
import { hashFile } from '../images/backup.js';

const reportsDir = (slug) => path.join(clientDir(slug), 'reports');

// Full-site quality report: checks links and the SEO checklist on every page of the last full build, and that the files in the
// website folder are the ones that build produced.
export async function validateSite(slug, { skipBuild = false, log = () => {} } = {}) {
  const client = await loadClient(slug);
  const profile = await getProfile(slug);
  // a website that is only updated for its images is not rebuilt: its own pages, as the Images step left them, are what is checked
  const inPlaceOnly = !optionsOf(client).template && !optionsOf(client).content;
  const scanned = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const report = inPlaceOnly ? { results: scanned.filter((p) => /\.html?$/i.test(p.path)).map((p) => ({ path: p.path, type: p.type, status: 'pass' })) } : skipBuild ? await readJson(path.join(clientDir(slug), 'build-report.json')) : await buildClient(slug, { log, content: 'usable' }); // the same wording rule as Content & build: approved, or written and passed every automatic check
  if (!report) throw new Error('Run Build all pages first (Content & build). Validation checks the finished build.');
  const buildDir = inPlaceOnly ? client.sourceDir : path.join(clientDir(slug), 'build');
  const built = report.results.filter((r) => r.status !== 'skipped');
  const phoneDigits = (profile.nap.phone || '').replace(/\D/g, '');

  // site-wide uniqueness needs a first pass over titles / descriptions
  const htmls = {};
  const titles = new Map(), metas = new Map();
  for (const r of built) {
    const html = await fs.readFile(path.join(buildDir, r.path), 'utf8');
    htmls[r.path] = html;
    const t = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
    const m = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1]?.trim() || '';
    titles.set(t, (titles.get(t) || 0) + 1);
    metas.set(m, (metas.get(m) || 0) + 1);
  }

  const canon = await loadCanonicalContext(slug, client);
  // only what this website is being updated for is checked
  const areas = areasOf(client, await loadBuildSettings(slug));
  // the audit again, on the finished pages: which of each page's audited problems are fixed, still open, or new
  const wasBy = Object.fromEntries(scanned.map((p) => [p.path, (p.issues || []).map((i) => i.code)]));
  const nowBy = Object.fromEntries(auditPages(built.map((r) => ({ ...extractPage(htmls[r.path], r.path), type: r.type })), client.host).map((p) => [p.path, p.issues.map((i) => i.code)]));
  const inArea = (c) => optionsOf(client)[auditAreaOf(c)];
  const links = await checkLinks({ client, buildDir, paths: built.map((r) => r.path) });
  const summary = {};
  const pages = {};
  const claimTotals = {};
  for (const r of built) {
    let checks = seoChecks({ html: htmls[r.path], rel: r.path, type: r.type, host: client.host, phoneDigits, titles, metas, canon: areas.content ? canon : null });
    const $m = cheerio.load(htmls[r.path]);
    $m('script, style, noscript, header, footer, nav').remove();
    const claims = findForbiddenClaims($m('main').text().replace(/\s+/g, ' '), profile);
    checks.push({ id: 'claims-verified', ok: !claims.length, applicable: true, level: 'warn', msg: `Uses claims you said never to make: ${claims.map((c) => `"${c.phrase}"`).slice(0, 12).join('; ')}` });
    checks = checks.filter((c) => inScope(c.id, areas));
    for (const c of claims) { const e = (claimTotals[c.phrase] ||= { phrase: c.phrase, kind: c.kind, pages: [] }); e.pages.push(r.path); }
    for (const c of checks) {
      const s = (summary[c.id] ||= { applicable: 0, passed: 0, failedPages: [], failures: [] });
      if (!c.applicable) continue;
      s.applicable += 1;
      if (c.ok) s.passed += 1; else { s.failedPages.push(r.path); s.failures.push({ path: r.path, level: c.level, msg: c.msg }); }
    }
    const ai = await loadContent(slug, r.path);
    const hardFails = checks.filter((c) => !c.ok && c.level === 'fail').map((c) => c.id);
    const newBroken = (links.perPage[r.path] || []).filter((l) => !l.preExisting);
    const reasons = [];
    if (r.status === 'fail') reasons.push('build checks failed');
    // A rebuilt PHP page is a static snapshot: replacing the file would delete the PHP that includes shared parts, handles forms and sets variables.
    if (client.php && /\.php$/i.test(r.path) && client.phpOutput !== 'static-ok') reasons.push('PHP page: preview only until the PHP template output is built');
    if (newBroken.length && (areas.content || areas.template)) reasons.push(`${newBroken.length} new broken link(s)`);
    if (hardFails.length) reasons.push(`SEO: ${hardFails.join(', ')}`);
    // wording that failed an automatic check is never used by the build, so the page simply keeps its existing text
    const readiness = reasons.length ? 'blocked' : 'ready';
    pages[r.path] = {
      type: r.type, readiness, reasons, build: r.status, ai: ai ? `${ai.mode}:${ai.status}` : null,
      seoFail: hardFails, seoWarn: checks.filter((c) => !c.ok && c.level === 'warn').map((c) => ({ id: c.id, msg: c.msg })),
      brokenLinks: links.perPage[r.path] || [],
      audit: (() => {
        const was = (wasBy[r.path] || []).filter(inArea), now = (nowBy[r.path] || []).filter(inArea);
        return { fixed: was.filter((c) => !now.includes(c)), open: now.filter((c) => was.includes(c)), fresh: now.filter((c) => !was.includes(c)) };
      })(),
    };
  }

  const applicable = Object.values(summary).reduce((n, s) => n + s.applicable, 0);
  const passed = Object.values(summary).reduce((n, s) => n + s.passed, 0);
  const counts = (k) => Object.values(pages).filter((p) => p.readiness === k).length;
  const auditSum = Object.values(pages).reduce((a, p) => ({ fixed: a.fixed + p.audit.fixed.length, open: a.open + p.audit.open.length, fresh: a.fresh + p.audit.fresh.length }), { fixed: 0, open: 0, fresh: 0 });
  const out = {
    validatedAt: new Date().toISOString(),
    totals: { pages: built.length, ready: counts('ready'), review: counts('review'), blocked: counts('blocked'), checksApplicable: applicable, checksPassed: passed, completion: applicable ? +((passed / applicable) * 100).toFixed(1) : 100, links: links.totals, audit: auditSum },
    claims: Object.values(claimTotals).sort((a, b) => b.pages.length - a.pages.length).map((c) => ({ phrase: c.phrase, kind: c.kind, count: c.pages.length, example: c.pages[0] })),
    checks: Object.fromEntries(Object.entries(summary).map(([id, s]) => [id, { label: CHECK_INFO[id], applicable: s.applicable, passed: s.passed, failed: s.applicable - s.passed, sample: s.failedPages.slice(0, 5), failures: s.failures }])),
    pages,
  };
  // are the files in the website folder the ones the build produced?
  const applied = await loadApplied(slug);
  if (applied) {
    let matching = 0;
    const differing = [];
    for (const p of applied.pages) {
      try { (await hashFile(path.join(client.sourceDir, p.rel))) === (await hashFile(path.join(buildDir, p.rel))) ? (matching += 1) : differing.push(p.rel); } catch { differing.push(p.rel); }
    }
    out.site = { updated: applied.pages.length, matching, differing: differing.slice(0, 20), backupId: applied.backupId, at: applied.at };
  }
  await writeJson(path.join(clientDir(slug), 'validation.json'), out);
  await writeReports(slug, client, out);
  log(`Validated ${built.length} pages: ${out.totals.ready} ready, ${out.totals.review} need review, ${out.totals.blocked} blocked; ${out.totals.completion}% of applicable checks pass`);
  return out;
}

async function writeReports(slug, client, v) {
  const dir = reportsDir(slug);
  await fs.mkdir(dir, { recursive: true });
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = ['page,type,readiness,build,ai,blocking_reasons,seo_warnings,broken_links,audit_fixed,audit_still_open,audit_new'];
  for (const [p, d] of Object.entries(v.pages)) csv.push([p, d.type, d.readiness, d.build, d.ai || '', q(d.reasons.join('; ')), q(d.seoWarn.map((w) => w.id).join(' ')), d.brokenLinks.length, q(d.audit.fixed.join(' ')), q(d.audit.open.join(' ')), q(d.audit.fresh.join(' '))].join(','));
  await fs.writeFile(path.join(dir, 'validation.csv'), csv.join('\n'));

  const rows = Object.entries(v.checks).sort((a, b) => b[1].failed - a[1].failed).map(([id, c]) => `<tr><td>${esc(c.label || id)}</td><td>${c.applicable}</td><td>${c.passed}</td><td>${c.failed}</td><td>${c.applicable ? Math.round((c.passed / c.applicable) * 100) : 100}%</td></tr>`).join('');
  const bad = Object.entries(v.pages).filter(([, d]) => d.readiness !== 'ready').slice(0, 200).map(([p, d]) => `<tr><td>${esc(p)}</td><td>${d.readiness}</td><td>${esc(d.reasons.join('; '))}</td></tr>`).join('');
  await fs.writeFile(path.join(dir, 'optimization-report.html'), `<!doctype html><meta charset="utf-8"><title>Optimization report - ${esc(client.name)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#1a2828}table{border-collapse:collapse;width:100%;margin:1rem 0}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f2f6f6}.big{font-size:2rem;font-weight:700}</style>
<h1>Optimization report: ${esc(client.name)}</h1><p>${esc(v.validatedAt)}</p>
<p class="big">${v.totals.completion}% of applicable checks pass</p>
<p>${v.totals.pages} pages: ${v.totals.ready} ready, ${v.totals.review} need review, ${v.totals.blocked} blocked. New broken links: ${v.totals.links.newlyBroken} (already broken on the original site: ${v.totals.links.preExisting}).</p>
<p>Audit problems on these pages: ${v.totals.audit.fixed} fixed, ${v.totals.audit.open} still open, ${v.totals.audit.fresh} new.</p>
<h2>Checks</h2><table><tr><th>Check</th><th>Applicable</th><th>Passed</th><th>Failed</th><th>Rate</th></tr>${rows}</table>
<h2>Pages that are not ready</h2><table><tr><th>Page</th><th>Status</th><th>Why</th></tr>${bad}</table>`);
}

export const loadValidation = (slug) => readJson(path.join(clientDir(slug), 'validation.json'), null);
export const reportPath = (slug, name) => path.join(reportsDir(slug), name);
