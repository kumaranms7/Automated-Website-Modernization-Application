import fs from 'node:fs/promises';
import { loadScope, scopedScan } from '../scope.js';
import { APP } from '../app-settings.js';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readSource } from '../util/source.js';
import { getProfile } from '../profile/store.js';
import { buildClient, buildTargets } from './build.js';
import { loadGraph } from './graph.js';
import { loadInplace } from '../images/inplace.js';
import { isFinal, templateReady } from '../template/store.js';
import { optionsOf, areasOf, auditAreaOf, scopeScan } from '../options.js';
import { scanClient } from '../scanner/scan.js';
import { buildInsights } from '../scanner/insights.js';
import { getTemplateType, loadFamilies, familyOf } from '../template/families.js';
import { loadBuildSettings, saveBuildSettings, SWITCHES, planPages, listContent, loadContent, generatePage, estimate, setStatus, CONTENT_MODES } from '../content/generate.js';
import { findForbiddenClaims } from '../content/validate.js';
import { scoreHtml, breakup, pageFacts } from './score.js';
import { loadCanonicalContext } from '../canonical/index.js';
import { applyBuild, applyOnePage, loadApplied, restorePage } from './apply-site.js';
import { makeHeadFixer, estimateHeadFixes } from '../content/seo-fix.js';
import { explainCheck, explainRow, skipText } from './problems.js';

// "Start building": the one step that turns the finished template, the optimised images and the chosen wording into the updated
// site files, then scores every page before and after.
//   dry    every page, built into a scratch folder: nothing in the real build is touched and the AI is not called
//   sample the first N pages (samplePages in app-settings.js) (content written for them first when the content mode needs it), built into their own folder
//   all    every page: content written for pages that need it first, then a verified backup of the original files, then the site
//          folder is updated directly with the finished pages. "Restore original files" undoes it.

export const BUILD_MODES = ['dry', 'sample', 'all'];
export const OUT = { dry: 'build-dry', sample: 'build-sample', all: 'build' };
const SAMPLE = APP.limits.samplePages;
const finalFile = (slug) => path.join(clientDir(slug), 'final-build.json');
const scoresFile = (slug) => path.join(clientDir(slug), 'final-scores.json');
const jobs = new Map();
export const finalJob = (slug) => jobs.get(slug) || null;
export const loadFinal = (slug) => readJson(finalFile(slug), null);
export const cancelFinal = (slug) => { const j = jobs.get(slug); if (j) j.cancel = true; return j; };

// pages the run covers and which of them still need wording generated
export async function planFinal(slug, opts = {}) {
  const { buildMode = 'sample' } = opts;
  if (!BUILD_MODES.includes(buildMode)) throw new Error('Unknown build mode');
  const KEYS = ['contentMode', 'scope', 'headScope', 'excludePatterns', ...Object.keys(SWITCHES)];
  if (KEYS.some((k) => opts[k] !== undefined)) await saveBuildSettings(slug, Object.fromEntries(KEYS.filter((k) => opts[k] !== undefined).map((k) => [k, opts[k]])));
  const settings = await loadBuildSettings(slug);
  const targets = await buildTargets(slug, { limit: buildMode === 'sample' ? SAMPLE : undefined });
  const leftOut = [...(buildTargets.lastLeftOut || [])];
  const plan = new Map((await planPages(slug)).map((p) => [p.path, p]));
  const recs = new Map((await listContent(slug)).map((c) => [c.path, c]));
  const wants = targets.filter((t) => plan.get(t.path) && plan.get(t.path).mode !== 'existing');
  const need = buildMode === 'dry' || settings.contentMode === 'existing' ? [] : wants.filter((t) => !recs.get(t.path)).map((t) => t.path);
  const reuse = wants.filter((t) => ['approved', 'generated'].includes(recs.get(t.path)?.status)).length;
  const manifest = await loadInplace(slug);
  const est = need.length ? await estimate(slug, need) : null;
  const scanPages = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const seoFix = await estimateHeadFixes(slug, scanPages, targets.map((t) => t.path));
  const options = optionsOf(await loadClient(slug));
  // what the audit found on these pages that this build is meant to fix (only the problems of the options chosen for this website)
  const areas = areasOf(await loadClient(slug), settings);
  const inRun = new Set(targets.map((t) => t.path));
  let auditPages = 0, auditIssues = 0;
  for (const p of scanPages) {
    if (!inRun.has(p.path)) continue;
    const n = (p.issues || []).filter((i) => areas[auditAreaOf(i.code)]).length;
    if (n) { auditPages += 1; auditIssues += n; }
  }
  // wording the AI wrote that you have not approved yet
  const waitingReview = wants.filter((t) => recs.get(t.path)?.status === 'generated').length;
  let existing = null;
  if (options.template && (await getTemplateType(slug)) === 'existing') {
    const fam = await loadFamilies(slug);
    const all = Object.keys(fam?.pageMap || {});
    existing = { legacy: all.filter((r) => familyOf(fam, r) === 'legacy').length, modern: all.filter((r) => familyOf(fam, r) === 'modern').length };
  }
  return {
    existing, leftOut, options, audit: { pages: auditPages, issues: auditIssues, auto: Boolean(settings.autoAudit) && buildMode === 'all' }, waitingReview, holdWording: Boolean(settings.reviewWording) && buildMode === 'all',
    buildMode, outName: OUT[buildMode], settings, pages: targets.length, targets: targets.map((t) => t.path), generate: need, reuse,
    updatesSite: buildMode === 'all', siteDir: (await loadClient(slug)).sourceDir, alreadyUpdated: Boolean(await loadApplied(slug)),
    estimate: est, seoFix, imagesOptimised: Boolean(manifest), templateFinal: await templateReady(slug), profileApproved: (await getProfile(slug)).status === 'approved',
  };
}

// how often each title and description is used on the whole site, before and after the build (the uniqueness checks need it)
async function siteCounts(scan, builtHtml) {
  const norm = (s) => String(s || '').trim();
  const count = (list) => { const m = new Map(); for (const v of list) m.set(v, (m.get(v) || 0) + 1); return m; };
  const origTitles = count(scan.map((p) => norm(p.title))), origMetas = count(scan.map((p) => norm(p.metaDescription)));
  const newTitles = new Map(), newMetas = new Map();
  for (const p of scan) {
    const html = await builtHtml(p.path);
    const t = html ? norm((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]) : norm(p.title);
    const m = html ? norm((html.match(/<meta name="description" content="([^"]*)"/i) || [])[1]) : norm(p.metaDescription);
    newTitles.set(t, (newTitles.get(t) || 0) + 1); newMetas.set(m, (newMetas.get(m) || 0) + 1);
  }
  return { origTitles, origMetas, newTitles, newMetas };
}

// the pages that would score LOWER than the page they replace, with the same checklist on both
async function lowerScoring(slug, client, profile, report, builtHtml) {
  const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const { origTitles, origMetas, newTitles, newMetas } = await siteCounts(scan, builtHtml);
  const canon = await loadCanonicalContext(slug, client);
  const phoneDigits = (profile.nap?.phone || '').replace(/\D/g, '');
  const areas = areasOf(client, await loadBuildSettings(slug));
  const lower = [];
  for (const r of report.results) {
    if (r.status === 'skipped' || r.status === 'fail') continue;
    const html = await builtHtml(r.path);
    if (!html) continue;
    const original = await readSource(client, r.path);
    const common = { rel: r.path, type: r.type, host: client.host, phoneDigits, canon, areas };
    const before = scoreHtml({ ...common, html: original, titles: origTitles, metas: origMetas, claims: findForbiddenClaims(textOf(original), profile).map((c) => c.phrase) });
    const after = scoreHtml({ ...common, html, titles: newTitles, metas: newMetas, claims: findForbiddenClaims(textOf(html), profile).map((c) => c.phrase) });
    if (after.score < before.score) lower.push({ path: r.path, before: before.score, after: after.score });
  }
  return lower;
}

const textOf = (html) => { const $ = cheerio.load(html); $('script, style, noscript, header, footer, nav').remove(); return ($('main').text() || $('body').text()).replace(/\s+/g, ' '); };

// which saved wording a build uses: none for existing content; for a full build with the hold switch on, only wording you approved
const wordingUse = (settings, mode) => (settings.contentMode === 'existing' ? 'none' : settings.reviewWording && mode === 'all' ? 'approved' : 'usable');

// one result row of the table (and the score breakup shown when a page is opened) from the build's own row for that page
async function makeRow(r, c) {
  const row = { path: r.path, type: r.type, status: r.status, layout: r.layout || '', ai: r.ai || null, reason: r.reason || '', issues: (r.checks || []).filter((x) => x.level !== 'pass').map((x) => x.id), checks: (r.checks || []).filter((x) => x.level !== 'pass').map((x) => ({ id: x.id, level: x.level, msg: x.msg || '' })) };
  if (r.accepted) row.accepted = r.accepted;
  if (r.wordsBefore != null) row.words = { before: r.wordsBefore, after: r.wordsAfter };
  if (r.decision) row.decision = r.decision;
  const html = await c.builtHtml(r.path);
  if (r.status === 'skipped' || !html) return { row, detail: null };
  const original = await readSource(c.client, r.path);
  const common = { rel: r.path, type: r.type, host: c.client.host, phoneDigits: c.phoneDigits, canon: c.canon, areas: c.areas };
  const before = scoreHtml({ ...common, html: original, titles: c.origTitles, metas: c.origMetas, claims: findForbiddenClaims(textOf(original), c.profile).map((x) => x.phrase) });
  const after = scoreHtml({ ...common, html, titles: c.newTitles, metas: c.newMetas, claims: findForbiddenClaims(textOf(html), c.profile).map((x) => x.phrase) });
  row.before = before.score; row.after = after.score; row.delta = after.score - before.score;
  const fa = pageFacts(html);
  row.webp = fa.webp; row.srcset = fa.srcset;
  return { row, detail: { breakup: breakup(before, after), facts: { before: pageFacts(original), after: fa } } };
}

// the counts at the top of the results, from the rows
function totalsOf(results) {
  const scored = results.filter((r) => r.before !== undefined);
  const avg = (k) => (scored.length ? Math.round(scored.reduce((n, r) => n + r[k], 0) / scored.length) : null);
  const count = (s) => results.filter((r) => r.status === s).length;
  return {
    pages: results.length, pass: count('pass'), warn: count('warn'), fail: count('fail'), skipped: count('skipped'),
    avgBefore: avg('before'), avgAfter: avg('after'), improved: scored.filter((r) => r.delta > 0).length, same: scored.filter((r) => r.delta === 0).length, worse: scored.filter((r) => r.delta < 0).length,
    withAiContent: results.filter((r) => r.ai).length, webpPages: scored.filter((r) => r.webp > 0).length, srcsetPages: scored.filter((r) => r.srcset > 0).length,
  };
}

// ---- what you decided about a page that failed a check ----
// use   the new page is used although a check did not pass (only for the checks that were failing when you decided)
// keep  the original page is kept on purpose
const decisionsFile = (slug) => path.join(clientDir(slug), 'final-decisions.json');
export const loadDecisions = (slug) => readJson(decisionsFile(slug), {});

// a failed page you accepted counts as a warning, so it is written into the site; a new failure you did not accept still blocks it
function applyDecisions(report, decisions) {
  for (const r of report.results) {
    const d = decisions[r.path];
    if (!d) continue;
    if (d.decision === 'keep') { r.decision = 'keep'; continue; }
    if (d.decision === 'use' && r.status === 'fail') {
      const failing = (r.checks || []).filter((c) => c.level === 'fail').map((c) => c.id);
      if (failing.every((id) => (d.accepted || []).includes(id))) { r.status = 'warn'; r.accepted = failing; r.decision = 'use'; }
    }
  }
  const count = (s) => report.results.filter((r) => r.status === s).length;
  report.totals = { ...report.totals, pass: count('pass'), warn: count('warn'), fail: count('fail'), skipped: count('skipped') };
  return report;
}


// ---- the processes behind the one progress bar ----
// Each process keeps its own status (saved in final-run.json after every group), so a failure in one of them never costs the others:
// "Retry" runs the failed process again, reusing the wording, titles and built pages already saved, and then the processes after it
// that had not run yet. Nothing that finished is redone, so no AI is paid for twice.
const STEPS = [
  { id: 'content', group: 'content', label: 'Write page wording (AI)' },
  { id: 'read', group: 'build', label: 'Read the original pages' },
  { id: 'seo', group: 'build', label: 'Titles and meta descriptions' },
  { id: 'build', group: 'build', label: 'Build the pages' },
  { id: 'styling', group: 'build', label: 'Compile the stylesheet' },
  { id: 'backup', group: 'apply', label: 'Back up the original files' },
  { id: 'apply', group: 'apply', label: 'Update the website files' },
  { id: 'scoring', group: 'scoring', label: 'SEO scoring' },
  { id: 'audit', group: 'audit', label: 'Audit the updated site' },
];
const GROUPS = ['content', 'build', 'apply', 'scoring', 'audit'];
const LOG_MAX = 40;
// the "what is happening" lines shown under the progress bar
export function logLine(job, text, level = 'info') {
  (job.log ||= []).push({ at: new Date().toISOString(), text, level });
  if (job.log.length > LOG_MAX) job.log.splice(0, job.log.length - LOG_MAX);
}

// how the audit of the updated site compares with the audit before the build, for the problems of this website's options
export async function auditCompare(slug) {
  const dir = path.join(clientDir(slug), 'scan');
  const client = await loadClient(slug);
  const scope = await loadScope(slug);
  const side = async (summary, pages) => scopeScan(scopedScan({ summary: await readJson(path.join(dir, summary), {}), pages: await readJson(path.join(dir, pages), []) }, scope), client).summary.issues || {};
  const before = await side('summary.json', 'pages.json'), after = await side('updated-summary.json', 'updated-pages.json');
  let fixed = 0, open = 0, added = 0;
  for (const code of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[code] || 0, a = after[code] || 0;
    fixed += Math.max(0, b - a); open += Math.min(a, b); added += Math.max(0, a - b);
  }
  return { fixed, open, added, at: now() };
}
const runFile = (slug) => path.join(clientDir(slug), 'final-run.json');
const newSteps = () => STEPS.map((s) => ({ ...s, status: 'pending', detail: '', error: null, startedAt: null, finishedAt: null }));
const ctxs = new Map();
const stepOf = (job, id) => job.steps.find((s) => s.id === id);
const now = () => new Date().toISOString();

// the process that is working now; the one before it is finished
function enter(job, id) {
  const s = stepOf(job, id);
  if (!s || s.status === 'done' || s.status === 'skipped') return;
  for (const r of job.steps) if (r.status === 'running' && r.id !== id) { r.status = 'done'; r.finishedAt = now(); }
  if (s.status !== 'running') { s.status = 'running'; s.startedAt = now(); s.finishedAt = null; s.error = null; s.detail = ''; logLine(job, `Started: ${s.label}`); }
  job.phase = id;
}
function settle(job, id, status, detail = '', error = null) {
  const s = stepOf(job, id);
  if (!s) return;
  s.status = status; s.detail = detail; s.error = error; s.finishedAt = now();
  if (!s.startedAt) s.startedAt = s.finishedAt;
  if (status === 'failed') logLine(job, `${s.label} failed: ${error || detail}`, 'bad'); else if (status === 'done') logLine(job, `${s.label}: ${detail || 'done'}`, 'ok');
}
// every process of the group that has not failed is finished
function closeGroup(job, group) {
  for (const s of job.steps) if (s.group === group && ['running', 'pending'].includes(s.status)) { s.status = 'done'; s.finishedAt = s.finishedAt || now(); if (!s.startedAt) s.startedAt = s.finishedAt; }
}

const snapshot = (job, ctx) => ({
  mode: job.mode, outName: job.outName, opts: ctx.opts, startedAt: job.startedAt, finishedAt: job.finishedAt, phase: job.phase, error: job.error,
  contentMode: job.contentMode, scope: job.scope, imagesOptimised: ctx.imagesOptimised ?? null, content: job.content, steps: job.steps,
  log: job.log || [], report: ctx.report || null, seoStats: ctx.seoStats || null, applied: ctx.applied || null, protectedPages: ctx.protectedPages || [], appliedSummary: job.applied || null,
});

// the last run as it was saved; anything that was running when the server stopped counts as interrupted
export async function loadRun(slug) {
  const saved = await readJson(runFile(slug), null);
  if (!saved?.steps) return null;
  for (const s of saved.steps) if (s.status === 'running') { s.status = 'failed'; s.error = 'Interrupted: the server stopped while this was running.'; }
  return saved;
}

// the live job, or (after a restart) the last run when something in it failed, so its Retry buttons are still there
export async function finalJobOrSaved(slug) {
  const live = jobs.get(slug);
  if (live) return live;
  const saved = await loadRun(slug);
  if (!saved || !saved.steps.some((s) => s.status === 'failed')) return null;
  return { running: false, cancel: false, phase: 'failed', mode: saved.mode, outName: saved.outName, done: 0, total: 0, current: '', content: saved.content, steps: saved.steps, log: saved.log || [], startedAt: saved.startedAt, finishedAt: saved.finishedAt, error: saved.error, totals: (await loadFinal(slug))?.totals || null, applied: saved.appliedSummary, restored: true };
}

function launch(slug, job, ctx) {
  jobs.set(slug, job);
  ctxs.set(slug, ctx);
  execute(slug, job, ctx)
    .then(() => { job.phase = job.cancel ? 'cancelled' : 'done'; })
    .catch((e) => {
      job.error = e.message; job.phase = 'failed';
      const r = job.steps.find((s) => s.status === 'running');
      if (r) { r.status = 'failed'; r.error = e.message; r.finishedAt = now(); }
    })
    .finally(async () => { job.running = false; job.finishedAt = now(); await writeJson(runFile(slug), snapshot(job, ctx)).catch(() => {}); });
}

export function startFinalBuild(slug, opts = {}) {
  if (jobs.get(slug)?.running) throw new Error('A build is already running');
  const mode = opts.buildMode || 'sample';
  const job = {
    running: true, cancel: false, phase: 'starting', mode, outName: OUT[mode], done: 0, total: 0, current: '',
    content: { total: 0, done: 0, failed: 0, cost: 0, errors: [] }, steps: newSteps(), log: [], startedAt: now(), finishedAt: null, error: null, totals: null,
  };
  launch(slug, job, { opts });
  return job;
}

// run one failed process again (and the ones after it that had not run)
export async function retryFinalStep(slug, stepId) {
  if (jobs.get(slug)?.running) throw new Error('A build is already running');
  const saved = await loadRun(slug);
  if (!saved) throw new Error('There is no earlier build to retry.');
  const row = saved.steps.find((s) => s.id === stepId);
  if (!row) throw new Error('Unknown process');
  if (row.status !== 'failed') throw new Error('Only a failed process can be retried.');
  // a dry run keeps no page files, so its scoring needs the (free, AI-less) pages built again first
  const group = saved.mode === 'dry' && row.group === 'scoring' ? 'build' : row.group;
  const from = GROUPS.indexOf(group);
  const steps = saved.steps.map((s) => (s.status !== 'skipped' && GROUPS.indexOf(s.group) >= from ? { ...s, status: 'pending', detail: '', error: null, startedAt: null, finishedAt: null } : s));
  const job = {
    running: true, cancel: false, phase: 'starting', mode: saved.mode, outName: saved.outName, done: 0, total: 0, current: '',
    content: { ...saved.content, total: 0, done: 0, failed: 0, errors: [] }, steps, log: [{ at: now(), text: `Retrying from: ${stepId}`, level: 'info' }], startedAt: now(), finishedAt: null, error: null, totals: null,
    contentMode: saved.contentMode, scope: saved.scope, applied: saved.appliedSummary || null, retry: stepId,
  };
  launch(slug, job, { opts: saved.opts, report: saved.report, seoStats: saved.seoStats, applied: saved.applied, protectedPages: saved.protectedPages || [], imagesOptimised: saved.imagesOptimised });
  return job;
}

async function execute(slug, job, ctx) {
  const mode = job.mode;
  const save = () => writeJson(runFile(slug), snapshot(job, ctx)).catch(() => {});
  const waiting = (g) => job.steps.some((s) => s.group === g && s.status === 'pending');

  if (!(await templateReady(slug))) throw new Error('Approve the template first (Template design step).');
  const plan = await planFinal(slug, ctx.opts);
  const settings = plan.settings;
  const client = await loadClient(slug);
  const profile = await getProfile(slug);
  const outName = OUT[mode];
  job.contentMode = settings.contentMode; job.scope = settings.scope; ctx.imagesOptimised = plan.imagesOptimised;
  if (!plan.profileApproved) throw new Error('Approve the business profile first (Business profile step). It is needed for every update.');
  if (waiting('content') && plan.generate.length && !plan.profileApproved) throw new Error('Approve the business profile first (Business profile step), or choose "Use existing content". The AI only writes from an approved profile.');

  // processes this run does not need
  const skip = (id, why) => { if (stepOf(job, id).status === 'pending') settle(job, id, 'skipped', why); };
  if (!plan.generate.length) skip('content', mode === 'dry' ? 'Not used in a dry run' : 'Nothing to write');
  if (mode === 'dry') skip('styling', 'Not needed in a dry run');
  if (plan.existing) skip('styling', 'Not needed: the pages use your own stylesheet');
  if (!plan.options.template) skip('styling', 'Not needed: the design is kept as it is');
  if (mode !== 'all') { skip('backup', 'Only when updating the website files'); skip('apply', 'Only when updating the website files'); }
  if (mode !== 'all') skip('audit', 'Only after the website files are updated');
  else if (!settings.autoAudit) skip('audit', 'Switched off in More options: use "Audit updated site" on the Site audit page');
  await save();

  // 1. wording for the pages that need it (never in a dry run)
  if (waiting('content')) {
    enter(job, 'content'); job.content.total = plan.generate.length; job.total = plan.generate.length; job.done = 0;
    const graph = await loadGraph(slug);
    const queue = [...plan.generate];
    const worker = async () => {
      while (queue.length && !job.cancel) {
        const rel = queue.shift();
        job.current = rel;
        try { const rec = await generatePage(slug, rel, { profile, graph }); job.content.cost = +(job.content.cost + (rec.cost || 0)).toFixed(4); logLine(job, `Wording written: ${rel}${rec.status === 'needs-review' ? ' (needs review: a check failed)' : ''}${rec.cost ? ` · $${rec.cost.toFixed(3)}` : ''}`, rec.status === 'needs-review' ? 'warn' : 'info'); } catch (e) { job.content.failed += 1; job.content.errors.push({ path: rel, error: e.message }); logLine(job, `Wording failed: ${rel}: ${e.message}`, 'bad'); }
        job.content.done += 1; job.done = job.content.done;
      }
    };
    await Promise.all(Array.from({ length: APP.limits.concurrency.aiWriting }, worker));
    if (job.cancel) { for (const s of job.steps) if (s.status === 'running') s.status = 'pending'; await save(); return; }
    const c = job.content;
    if (c.failed) settle(job, 'content', 'failed', `${c.done - c.failed} of ${c.total} written`, `${c.failed} page(s) could not be written (${c.errors[0].error}). The other pages kept their wording; retry writes only the ones missing.`);
    else settle(job, 'content', 'done', `${c.done} page(s) written${c.cost ? ` · ${'$' + c.cost.toFixed(2)}` : ''}`);
    await save();
  }

  // 2. read the pages, fix the titles and descriptions, build every page with the template, the images and the usable wording
  if (waiting('build')) {
    job.done = 0; job.total = plan.pages; job.current = '';
    enter(job, 'read');
    const built = new Map();
    ctx.built = built;
    // titles and meta descriptions: the right length, finished sentences, unique. AI writes them; a dry run uses rules only and saves nothing
    const fixer = makeHeadFixer({ slug, ai: mode !== 'dry', persist: mode !== 'dry', onProgress: (p) => { enter(job, 'seo'); if (p.done !== undefined) job.done = p.done; if (p.total !== undefined) job.total = p.total; if (p.path) job.current = p.path; } });
    const PH = { read: 'read', seo: 'seo', pages: 'build', styling: 'styling' };
    const report = await buildClient(slug, {
      only: mode === 'sample' ? plan.targets : undefined, content: wordingUse(settings, mode), outName, fixHeads: fixer,
      onProgress: (p) => { for (const k of ['total', 'done']) if (p[k] !== undefined) job[k] = p[k]; if (PH[p.phase]) enter(job, PH[p.phase]); if (p.path) job.current = p.path; },
      onPage: (p) => built.set(p.path, p.html),
    });
    applyDecisions(report, await loadDecisions(slug));
    ctx.report = report;
    const st = fixer.stats;
    ctx.seoStats = { titlesRewritten: st.titles, descriptionsRewritten: st.metas, byAi: st.ai, byRule: st.byRule, reused: st.reused, unresolved: st.unresolved, aiError: st.aiError || null, cost: +st.cost.toFixed(4) };
    closeGroup(job, 'build');
    settle(job, 'read', 'done', `${plan.pages} page(s)`);
    settle(job, 'build', 'done', `${report.totals.pass} passed · ${report.totals.warn} with warnings · ${report.totals.fail} failed`);
    if (mode !== 'dry') settle(job, 'styling', 'done', `${Math.round((report.cssBytes || 0) / 1024)} KB`);
    if (st.aiError) settle(job, 'seo', 'failed', `${st.titles} titles and ${st.metas} descriptions rewritten by rule`, `The AI could not write titles and descriptions (${st.aiError}), so rule-based ones were used. Retry writes them with the AI; only the pages still needing it are paid for.`);
    else settle(job, 'seo', 'done', `${st.titles} titles and ${st.metas} descriptions rewritten${st.reused ? ` · ${st.reused} reused` : ''}${st.cost ? ` · $${st.cost.toFixed(2)}` : ''}`);
    await save();
  }

  // 3. Build all pages: back up the originals, then update the website folder directly
  if (waiting('apply')) {
    if (!ctx.report) throw new Error('The build results were not saved. Retry "Build the pages" first.');
    job.done = 0; job.total = 0; job.current = '';
    enter(job, 'backup');
    // a page that would score lower than the one it replaces is left as it is in the website folder
    let toWrite = ctx.report;
    ctx.protectedPages = [];
    if (settings.protectScore) {
      const builtNow = async (rel) => ctx.built?.get(rel) ?? fs.readFile(path.join(clientDir(slug), job.outName, rel), 'utf8').catch(() => null);
      const lower = await lowerScoring(slug, client, profile, ctx.report, builtNow);
      ctx.protectedPages = lower;
      if (lower.length) {
        const by = new Map(lower.map((x) => [x.path, x]));
        toWrite = { ...ctx.report, results: ctx.report.results.map((r) => (by.has(r.path) ? { ...r, status: 'skipped', reason: `kept as it is: the new page would score lower (${by.get(r.path).before} to ${by.get(r.path).after})` } : r)) };
      }
    }
    const applied = await applyBuild(slug, toWrite, {
      onProgress: (p) => { enter(job, p.phase); if (p.done !== undefined) job.done = p.done; if (p.total !== undefined) job.total = p.total; },
    });
    ctx.applied = applied;
    job.applied = { backupId: applied.backupId, backupReused: applied.backupReused, pages: applied.updatedPages, files: applied.updatedFiles, skipped: applied.skipped.length };
    closeGroup(job, 'apply');
    settle(job, 'backup', 'done', applied.backupReused ? 'The backup from the first update is kept' : `Backup ${applied.backupId}`);
    settle(job, 'apply', 'done', `${applied.updatedPages} page(s) and ${applied.updatedFiles} file(s)${ctx.protectedPages?.length ? ` · ${ctx.protectedPages.length} kept as they were because the new page would score lower` : ''}`);
    await save();
  }

  // 4. score the original and the rebuilt page with the same checklist; the pages come from memory, or from the build folder on a retry
  if (waiting('scoring')) {
    const report = ctx.report;
    if (!report) throw new Error('The build results were not saved. Retry "Build the pages" first.');
    const seoStats = ctx.seoStats || {};
    const applied = ctx.applied || null;
    enter(job, 'scoring'); job.done = 0; job.current = ''; job.total = report.results.filter((r) => r.status !== 'skipped').length;
    const builtHtml = async (rel) => ctx.built?.get(rel) ?? fs.readFile(path.join(clientDir(slug), job.outName, rel), 'utf8').catch(() => null);
    const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
    const phoneDigits = (profile.nap?.phone || '').replace(/\D/g, '');
    const { origTitles, origMetas, newTitles, newMetas } = await siteCounts(scan, builtHtml);
    const canon = await loadCanonicalContext(slug, client);
    const areas = areasOf(client, settings);
    const details = {}, results = [];
    const rowCtx = { client, profile, phoneDigits, canon, areas, origTitles, origMetas, newTitles, newMetas, builtHtml };
    for (const r of report.results) {
      const { row, detail } = await makeRow(r, rowCtx);
      if (detail) details[r.path] = detail;
      results.push(row);
      job.done += 1;
    }

    const totals = {
      ...totalsOf(results),
      updatedInSite: applied ? applied.updatedPages : 0,
      seo: { ...report.seo, titlesRewritten: seoStats.titlesRewritten || 0, descriptionsRewritten: seoStats.descriptionsRewritten || 0, byAi: seoStats.byAi || 0, byRule: seoStats.byRule || 0, reused: seoStats.reused || 0, unresolved: (seoStats.unresolved || []).length, aiError: seoStats.aiError || null, cost: seoStats.cost || 0 },
      contentGenerated: job.content.done - job.content.failed, contentFailed: job.content.failed, cost: job.content.cost,
    };
    const out = {
      builtAt: new Date().toISOString(), mode, outName, contentMode: settings.contentMode, scope: settings.scope, imagesOptimised: plan.imagesOptimised,
      template: report.template, cssBytes: report.cssBytes, removedLinks: report.removedLinks, totals, results,
      unresolvedSeo: (seoStats.unresolved || []).slice(0, 50),
      templateRules: report.templateRules || null, notCarried: report.notCarried || [], canonical: report.canonical || null, head: report.head || [], protectedPages: ctx.protectedPages || [],
      applied: applied ? { at: applied.at, backupId: applied.backupId, backupReused: applied.backupReused, pages: applied.updatedPages, files: applied.updatedFiles, skipped: applied.skipped } : null,
    };
    await writeJson(finalFile(slug), out);
    await writeJson(scoresFile(slug), details);
    job.totals = totals;
    settle(job, 'scoring', 'done', `${results.filter((r) => r.before !== undefined).length} page(s) · average ${totals.avgBefore ?? '–'} → ${totals.avgAfter ?? '–'}`);
    await save();
  }

  // 5. the audit of the updated site, so the Site audit page and this page tell the same story
  if (waiting('audit')) {
    enter(job, 'audit'); job.done = 0; job.total = 0; job.current = '';
    try {
      await scanClient(slug, (m) => { if (m) job.current = String(m).slice(0, 120); }, { updated: true });
      await buildInsights(slug, { updated: true });
      const cmp = await auditCompare(slug);
      ctx.audit = cmp;
      const saved = await loadFinal(slug);
      if (saved) { saved.totals = { ...saved.totals, audit: cmp }; await writeJson(finalFile(slug), saved); job.totals = saved.totals; }
      settle(job, 'audit', 'done', `${cmp.fixed} issue(s) fixed · ${cmp.open} still open · ${cmp.added} new`);
    } catch (e) {
      settle(job, 'audit', 'failed', '', `The updated site could not be audited (${e.message}). The build itself is finished and safe. Retry runs only this audit.`);
    }
    await save();
  }
}

export async function finalDetail(slug, rel) {
  const last = await loadFinal(slug);
  const details = await readJson(scoresFile(slug), {});
  const row = last?.results.find((r) => r.path === rel);
  if (!row) throw new Error('That page is not in the last build');
  const rec = await loadContent(slug, rel);
  const applied = await loadApplied(slug);
  return {
    path: rel, outName: last.outName, mode: last.mode, row: explainRow(row), ...(details[rel] || {}),
    skip: row.status === 'skipped' ? skipText(row.reason) : null,
    wording: wordingChanges(rec),
    inSite: Boolean(applied?.pages?.some((p) => p.rel === rel)),
    content: rec ? { mode: rec.mode, status: rec.status, issues: (rec.issues || []).slice(0, 8), title: rec.content?.title || '', metaDescription: rec.content?.metaDescription || '' } : null,
  };
}

// what the AI changed on a page, in the order of the page, with the edits the safety checks refused
const stripTags = (h) => String(h || '').replace(/<\/?(p|br|li|ul|ol|div|h[1-6]|tr|td|th|table|blockquote)\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
export function wordingChanges(rec) {
  if (!rec || !['enhance', 'rewrite', 'optimize'].includes(rec.mode)) return null;
  const c = rec.content || {};
  const changes = (c.units || []).map((u) => ({ kind: u.kind, before: stripTags(u.before), after: stripTags(u.after) })).filter((u) => u.before !== u.after);
  return {
    mode: rec.mode, status: rec.status, createdAt: rec.createdAt, model: rec.model, cost: rec.cost || 0, overridden: Boolean(rec.overridden), reviewedAt: rec.reviewedAt || null,
    inPlace: Boolean(rec.inPlace), summary: rec.summary || null,
    title: { before: rec.source?.title || '', after: c.title || '' }, metaDescription: c.metaDescription || '',
    changes, rejected: (c.rejected || []).map((u) => ({ before: stripTags(u.before), after: stripTags(u.after), reason: u.reason })).slice(0, 12),
    duplicates: rec.duplicates || [], issues: (rec.issues || []).map((i) => ({ level: i.level, msg: i.msg || i.message || '' })),
  };
}

// "approve": the wording is published by every build, "original": this page keeps its own wording
export async function decideWording(slug, rel, action) {
  if (jobs.get(slug)?.running) throw new Error('A build is running. Wait for it to finish first.');
  if (!['approve', 'original', 'undo'].includes(action)) throw new Error('Unknown choice');
  const rec = await loadContent(slug, rel);
  if (!rec) throw new Error('This page has no AI wording.');
  await setStatus(slug, rel, action === 'approve' ? 'approved' : action === 'original' ? 'rejected' : 'generated');
  const built = await rebuildPage(slug, rel).catch((e) => ({ error: e.message }));
  return { path: rel, wording: action === 'approve' ? 'approved' : action === 'original' ? 'original kept' : 'waiting for review', page: built.now || null, written: Boolean(built.written), error: built.error || null };
}

// every page whose wording passed all the automatic checks is marked as reviewed
export async function approveCheckedWording(slug) {
  const recs = (await listContent(slug)).filter((c) => c.status === 'generated' && !(c.issues || []).some((i) => i.level === 'fail'));
  for (const c of recs) await setStatus(slug, c.path, 'approved');
  return { approved: recs.length };
}

// the last build as the screen shows it: every check with its plain name and what to do about it
export async function finalForUi(slug) {
  const last = await loadFinal(slug);
  if (!last) return null;
  return { ...last, results: last.results.map(explainRow) };
}

// how much AI wording there is and how much of it you have looked at
async function wordingCounts(slug) {
  const recs = (await listContent(slug)).filter((c) => ['enhance', 'rewrite', 'optimize'].includes(c.mode));
  const n = (f) => recs.filter(f).length;
  const settings = await loadBuildSettings(slug);
  return { total: recs.length, waiting: n((c) => c.status === 'generated'), waitingClean: n((c) => c.status === 'generated' && !(c.issues || []).some((i) => i.level === 'fail')), approved: n((c) => c.status === 'approved'), original: n((c) => c.status === 'rejected'), needsReview: n((c) => c.status === 'needs-review'), warned: n((c) => (c.issues || []).some((i) => i.level === 'warn')), hold: Boolean(settings.reviewWording) };
}

// ---- pages that need attention, and what can be done about each ----
export async function attention(slug) {
  const last = await loadFinal(slug);
  if (!last) return { items: [], counts: { fail: 0, skipped: 0, decided: 0 }, seo: [], content: [], buildMode: null, wording: null };
  const run = await loadRun(slug);
  const applied = await loadApplied(slug);
  const inSite = new Set((applied?.pages || []).map((p) => p.rel));
  const items = [];
  for (const r of last.results) {
    if (r.status === 'fail' || r.decision === 'keep') {
      items.push({ path: r.path, type: r.type, status: r.status, decision: r.decision || null, accepted: r.accepted || [], inSite: inSite.has(r.path), reasons: (r.checks || []).filter((c) => c.level === 'fail').map(explainCheck), canUse: r.status === 'fail', canRebuild: true });
    } else if (r.status === 'warn' && r.decision === 'use') {
      items.push({ path: r.path, type: r.type, status: r.status, decision: 'use', accepted: r.accepted || [], inSite: inSite.has(r.path), reasons: (r.checks || []).filter((c) => (r.accepted || []).includes(c.id)).map(explainCheck), canUse: false, canRebuild: true });
    } else if (r.status === 'skipped') {
      const t = skipText(r.reason);
      items.push({ path: r.path, type: r.type, status: 'skipped', decision: null, accepted: [], inSite: false, reasons: [{ id: 'skipped', level: 'skip', name: 'Left as it is', msg: t.msg, fix: t.fix }], canUse: false, canRebuild: !/unrecognised-layout/.test(r.reason || '') });
    }
  }
  const order = { fail: 0, skipped: 2, warn: 1 };
  items.sort((a, b) => (a.decision ? 1 : 0) - (b.decision ? 1 : 0) || order[a.status] - order[b.status] || a.path.localeCompare(b.path));
  return {
    buildMode: last.mode, items,
    counts: { fail: items.filter((i) => i.status === 'fail' && !i.decision).length, skipped: items.filter((i) => i.status === 'skipped').length, decided: items.filter((i) => i.decision).length },
    seo: (last.unresolvedSeo || []).slice(0, 50),
    content: (run?.content?.errors || []).slice(0, 50),
    wording: await wordingCounts(slug),
  };
}

// builds one page again (the same way the full build did), checks and scores it again and updates the results
export async function rebuildPage(slug, rel, { rewrite = false } = {}) {
  if (jobs.get(slug)?.running) throw new Error('A build is running. Wait for it to finish first.');
  const last = await loadFinal(slug);
  if (!last?.results?.some((r) => r.path === rel)) throw new Error('That page is not in the last build.');
  const client = await loadClient(slug);
  const profile = await getProfile(slug);
  const settings = await loadBuildSettings(slug);
  if (rewrite) {
    if (profile.status !== 'approved') throw new Error('Approve the business profile first (Business profile step). The AI only writes from an approved profile.');
    await generatePage(slug, rel, { profile, graph: await loadGraph(slug) });
  }
  const report = await buildClient(slug, { only: [rel], keep: true, content: wordingUse(settings, last.mode), outName: last.outName });
  const one = report.results.find((r) => r.path === rel);
  if (!one) throw new Error('This page is no longer part of the build (it is left out by the build options).');
  applyDecisions({ results: [one], totals: {} }, await loadDecisions(slug));
  const builtHtml = (p) => fs.readFile(path.join(clientDir(slug), last.outName, p), 'utf8').catch(() => null);
  const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const counts = await siteCounts(scan, builtHtml);
  const { row, detail } = await makeRow(one, { client, profile, phoneDigits: (profile.nap?.phone || '').replace(/\D/g, ''), canon: await loadCanonicalContext(slug, client), areas: areasOf(client, settings), origTitles: counts.origTitles, origMetas: counts.origMetas, newTitles: counts.newTitles, newMetas: counts.newMetas, builtHtml });
  const before = last.results.find((r) => r.path === rel);
  last.results = last.results.map((r) => (r.path === rel ? row : r));
  last.totals = { ...last.totals, ...totalsOf(last.results) };
  // a page that now passes goes into the site folder when the site was updated from a full build
  let written = false;
  const applied = await loadApplied(slug);
  if (last.mode === 'all' && applied && ['pass', 'warn'].includes(row.status) && row.decision !== 'keep') { await applyOnePage(slug, rel); written = true; }
  if (written) { const a = await loadApplied(slug); last.totals.updatedInSite = (a?.pages || []).length; if (last.applied) last.applied = { ...last.applied, skipped: (last.applied.skipped || []).filter((s) => s.rel !== rel) }; }
  await writeJson(finalFile(slug), last);
  const details = await readJson(scoresFile(slug), {});
  if (detail) details[rel] = detail; else delete details[rel];
  await writeJson(scoresFile(slug), details);
  return { path: rel, was: before?.status, now: row.status, written, reasons: (row.checks || []).filter((c) => c.level === 'fail').map(explainCheck) };
}

// every page that failed (and has no decision yet), one after the other
export async function rebuildFailedPages(slug) {
  const last = await loadFinal(slug);
  const todo = (last?.results || []).filter((r) => r.status === 'fail' && !r.decision).map((r) => r.path);
  const out = [];
  for (const rel of todo) {
    try { out.push(await rebuildPage(slug, rel)); } catch (e) { out.push({ path: rel, was: 'fail', now: 'fail', error: e.message }); }
  }
  return { tried: todo.length, fixed: out.filter((o) => o.now !== 'fail' && !o.error).length, results: out };
}

// "use": the new page is used although it failed; "keep": the original stays on purpose; "clear": back to automatic
export async function decidePage(slug, rel, decision) {
  if (jobs.get(slug)?.running) throw new Error('A build is running. Wait for it to finish first.');
  if (!['use', 'keep', 'clear'].includes(decision)) throw new Error('Unknown choice');
  const last = await loadFinal(slug);
  const row = last?.results?.find((r) => r.path === rel);
  if (!row) throw new Error('That page is not in the last build.');
  const all = await loadDecisions(slug);
  if (decision === 'clear') delete all[rel];
  else all[rel] = { decision, at: now(), accepted: decision === 'use' ? (row.checks || []).filter((c) => c.level === 'fail').map((c) => c.id).concat(row.accepted || []) : [] };
  await writeJson(decisionsFile(slug), all);
  let restored = false;
  if (decision === 'keep' && (await loadApplied(slug))?.pages?.some((p) => p.rel === rel)) { await restorePage(slug, rel); restored = true; }
  await rebuildPage(slug, rel).catch(async () => {
    // the build could not be repeated (for example the page is now left out): record the choice on the row only
    row.decision = decision === 'clear' ? undefined : decision;
    await writeJson(finalFile(slug), last);
  });
  const now2 = (await loadFinal(slug))?.results?.find((r) => r.path === rel);
  return { path: rel, status: now2?.status, decision: now2?.decision || null, restored, writtenToSite: Boolean(last.mode === 'all' && decision === 'use') };
}

export { CONTENT_MODES };
