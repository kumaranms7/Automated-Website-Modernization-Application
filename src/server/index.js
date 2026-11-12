import express from 'express';
import { detectSiteColors } from '../template/site-colors.js';
import { themeState, generate as generateThemesFor, createTheme, updateThemeRecord, duplicateTheme, deleteTheme, selectTheme, resetTheme, exportTheme, importTheme } from '../theme/store.js';
import { loadScope, saveScope, scopeSummary, scopedScan } from '../scope.js';
import { APP, settingsForUi, prepareSettingsFiles } from '../app-settings.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientDir, listClients, loadClient, readJson } from '../config.js';
import { getProfile, saveProfile, approveProfile } from '../profile/store.js';
import { draftProfileFromUrl } from '../profile/fromUrl.js';
import { scanClient } from '../scanner/scan.js';
import { buildInsights, loadInsights } from '../scanner/insights.js';
import { applySettings, getPublicSettings, saveSettings, clearKey, testConnection, listModels } from '../settings.js';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { buildUi } from '../../scripts/build-ui.mjs';
import { buildClient } from '../build/build.js';
import { startBuildJob, buildJob } from '../build/job.js';
import { walkSite, deleteBackup } from '../images/backup.js';
import { mountStudio } from './studio-routes.js';
import { previewHandler } from './preview.js';
import { planFinal, startFinalBuild, retryFinalStep, finalJobOrSaved, finalJob, cancelFinal, loadFinal, finalForUi, finalDetail, attention, rebuildPage, rebuildFailedPages, decidePage, decideWording, approveCheckedWording } from '../build/final.js';
import { templateState, previewTemplate, finaliseTemplate, saveDraft, reopen } from '../template/api.js';
import { designFromBrief, refineDesign, EXPERT_REVIEW, addUrlRef, addImageRef, removeRef, listRefs } from '../template/design.js';
import { restoreVersion, loadActive } from '../template/store.js';
import { recordConfig } from '../studio/wear.js';
import { kitRoutes } from './kit-routes.js';
import { detectFamilies, setOverride, ownState, saveOwn, saveRoles, saveDesign, setTemplateType } from '../template/families.js';
import { describeTemplate } from '../template/own-structure.js';
import { extractTheme } from '../template/own-theme.js';
import { previewConversion, previewPatterns, previewPattern } from '../template/own-preview.js';
import { buildPatterns, resetPattern, patternSummary, describePage, refinePattern, undoRefine, chooseDesign } from '../template/own-patterns.js';
const exState = async (slug) => ({ ...(await ownState(slug)), patterns: await patternSummary(slug) });
import { refsDir } from '../template/store.js';
import { saveBanner, saveBannerFromUrl } from '../template/banners.js';
import { validateSite, loadValidation, reportPath } from '../validate/site.js';
import { startReport, reportJob, reportInfo, reportDir, REPORT_FILE } from '../report/index.js';
import { withDownloadButton, upgradeSavedReports } from '../report/download.js';
import { allowedHosts, refuseRequest, siteFolderProblem } from './guard.js';
import { rulesForUi } from '../rules.js';
import { typesForUi } from '../scanner/page-types.js';
import { pickSample, startBrowserRun, browserJob, loadBrowserResults } from '../validate/browser.js';
import { loadApplied, restoreOriginals as restoreSiteOriginals, appliedPaths, restorePage } from '../build/apply-site.js';
import { loadImageSettings, saveImageSettings } from '../images/optimize.js';
import { planImages, startInplace, inplaceJob, loadInplace, restoreUnused, restoreOriginals, restoreSite, listBackups } from '../images/inplace.js';
import { isFinal, templateReady } from '../template/store.js';
import { OPTION_INFO, normaliseOptions, optionsOf, scopeScan } from '../options.js';
import { sitemapFile } from '../canonical/report.js';
import { reviewData, checkHead, rewriteField, saveManual, clearManual } from '../head/review.js';
import { headSnapshot } from '../head/context.js';
import { contentOverview, contentItem, estimate, startRun, cancelRun, jobStatus, setStatus, generatePage, approveMany, loadBuildSettings, saveBuildSettings } from '../content/generate.js';
import { writeJson, CLIENTS_DIR, DATA_DIR } from '../config.js';

prepareSettingsFiles();
await applySettings();

// the portal's Tailwind stylesheet is compiled when it is missing or older than its sources
try { buildUi(); } catch (e) { console.error('Could not build the portal stylesheet:', e.message); }
const app = express();
// only this computer's own address, and only the portal's own pages, may use it (SM_ALLOWED_HOSTS adds more, e.g. "mypc:4310")
const HOSTS = allowedHosts(Number(process.env.PORT) || 4310, process.env.SM_ALLOWED_HOSTS);
app.use((req, res, next) => { const why = refuseRequest(req.headers, HOSTS); if (why) return res.status(403).type('text').send(why); next(); });
app.use(express.json({ limit: '40mb' }));
// the portal's own scripts and styles are always checked again, so a restart shows a change without a hard refresh
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'public'), { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => res.status(e.status || 400).json({ error: e.message }));

// the folder browser of the Add/Edit website dialog: the sub-folders of a folder, or the drives when no folder is given
const SKIP_DIRS = new Set(['_modernizer-backup', 'System Volume Information', '$RECYCLE.BIN', 'node_modules', 'Windows', 'Program Files', 'Program Files (x86)', 'ProgramData']);
app.get('/api/fs/list', wrap(async (req, res) => {
  const here = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '');
  if (!here) throw new Error('Folders can only be browsed on the computer that runs the portal.');
  const os = await import('node:os');
  const drives = process.platform === 'win32'
    ? (await Promise.all('CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(async (l) => ((await fs.stat(`${l}:\\`).catch(() => null))?.isDirectory() ? `${l}:\\` : null)))).filter(Boolean)
    : ['/'];
  const want = String(req.query.path || '').trim();
  if (!want) return res.json({ path: '', parent: null, entries: drives.map((d) => ({ name: d, path: d, drive: true })), drives, home: os.homedir(), pages: 0 });
  const abs = path.resolve(want);
  const st = await fs.stat(abs).catch(() => null);
  if (!st?.isDirectory()) throw new Error('That folder does not exist.');
  const items = await fs.readdir(abs, { withFileTypes: true }).catch(() => { throw new Error('That folder cannot be opened.'); });
  const entries = items.filter((e) => e.isDirectory() && !/^[.$]/.test(e.name) && !SKIP_DIRS.has(e.name)).map((e) => ({ name: e.name, path: path.join(abs, e.name) })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const parent = path.dirname(abs) === abs ? '' : path.dirname(abs);
  res.json({ path: abs, parent, entries, drives, home: os.homedir(), pages: items.filter((e) => e.isFile() && /\.(html?|shtml|php)$/i.test(e.name)).length });
}));
app.get('/api/settings', wrap(async (_, res) => res.json(await getPublicSettings())));
app.get('/api/settings/models', wrap(async (_, res) => res.json(await listModels())));
app.put('/api/settings', wrap(async (req, res) => res.json(await saveSettings(req.body))));
app.delete('/api/settings/key', wrap(async (_, res) => res.json(await clearKey())));
app.post('/api/settings/test', wrap(async (_, res) => res.json(await testConnection())));

app.post('/api/clients', wrap(async (req, res) => {
  const { name, host, sourceDir } = req.body;
  const options = normaliseOptions(req.body.options);
  const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  if (!slug || !host || !sourceDir) throw new Error('Name, domain and site folder are required');
  if (await loadClient(slug)) throw new Error('A website with that name already exists');
  const st = await fs.stat(sourceDir).catch(() => null);
  if (!st?.isDirectory()) throw new Error('That site folder does not exist');
  const unsafe = siteFolderProblem(sourceDir, [DATA_DIR, CLIENTS_DIR]);
  if (unsafe) throw new Error(unsafe);
  await writeJson(path.join(clientDir(slug), 'client.json'), {
    name: String(name).trim(), host: String(host).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), sourceDir: path.resolve(sourceDir), classify: {}, options,
  });
  // a template can only be applied by building pages, and the wording is left as it is until you choose otherwise
  if (options.template && req.body.contentAdded) await saveBuildSettings(slug, { contentMode: 'existing' });
  res.json({ slug, options });
}));

const cleanHost = (h) => String(h || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

// Edit a website's name, domain or site folder. Everything else about the site (scan, design, content) is kept.
app.put('/api/clients/:slug', wrap(async (req, res) => {
  const slug = req.params.slug;
  const cur = await loadClient(slug);
  if (!cur) throw new Error('Unknown website');
  const name = String(req.body.name || '').trim(), host = cleanHost(req.body.host), dir = String(req.body.sourceDir || '').trim();
  if (!name || !host || !dir) throw new Error('Name, domain and site folder are required');
  const st = await fs.stat(dir).catch(() => null);
  if (!st?.isDirectory()) throw new Error('That site folder does not exist');
  const sourceDir = path.resolve(dir);
  if (sourceDir !== cur.sourceDir) { const unsafe = siteFolderProblem(sourceDir, [DATA_DIR, CLIENTS_DIR]); if (unsafe) throw new Error(unsafe); }
  const moved = host !== cur.host || sourceDir !== cur.sourceDir;
  const before = optionsOf(cur), options = normaliseOptions(req.body.options ?? cur.options);
  await writeJson(path.join(clientDir(slug), 'client.json'), { ...cur, name, host, sourceDir, options });
  if (options.template && !before.template && req.body.contentAdded) await saveBuildSettings(slug, { contentMode: 'existing' });
  // the menu and footer read from the old files are out of date once the folder or domain changes
  if (moved) await fs.rm(path.join(clientDir(slug), 'site.json'), { force: true });
  res.json({ slug, moved, options });
}));

// Delete a website from the platform. Nothing is erased: its data folder is moved to clients/_deleted so it can be recovered,
// and the site's own files are never touched. The website's name must be typed to confirm.
app.delete('/api/clients/:slug', wrap(async (req, res) => {
  const slug = req.params.slug;
  const cur = await loadClient(slug);
  if (!cur) throw new Error('Unknown website');
  if (String(req.body?.confirm || '').trim().toLowerCase() !== String(cur.name).trim().toLowerCase()) throw new Error('Type the website name exactly to confirm');
  const busyJob = [inplaceJob(slug), buildJob(slug), jobStatus(slug)].find((j) => j?.running);
  if (busyJob) throw new Error('A task is still running for this website. Wait for it to finish, then delete it.');
  const dest = path.join(CLIENTS_DIR, '_deleted', `${slug}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.rename(clientDir(slug), dest);
  res.json({ deleted: slug, keptAt: path.relative(DATA_DIR, dest) });
}));

// How a website's folder compares with what the portal has stored about it, so stale results can be flagged.
app.get('/api/clients/:slug/status', wrap(async (req, res) => {
  const slug = req.params.slug;
  const client = await loadClient(slug);
  if (!client) throw new Error('Unknown website');
  const exists = Boolean((await fs.stat(client.sourceDir).catch(() => null))?.isDirectory());
  let files = 0, newest = 0;
  const written = await appliedPaths(slug);
  if (exists) {
    try {
      for await (const f of walkSite(client)) {
        files += 1;
        if (written.has(f.rel)) continue; // written by Content & build, not edited by someone else
        const st = await fs.stat(f.full).catch(() => null);
        if (st) newest = Math.max(newest, st.mtimeMs);
        if (files >= 30000) break;
      }
    } catch { /* unreadable folder: reported as empty below */ }
  }
  const summary = await readJson(path.join(clientDir(slug), 'scan', 'summary.json'), null);
  const backups = await listBackups(slug);
  const has = await Promise.all(['scan/summary.json', 'build-report.json', 'validation.json', 'images-inplace.json'].map((f) => fs.stat(path.join(clientDir(slug), f)).then(() => true, () => false)));
  res.json({
    sourceDir: client.sourceDir, exists, files, newestAt: newest ? new Date(newest).toISOString() : null, scannedAt: summary?.scannedAt || null,
    stale: Boolean(summary && newest && newest > Date.parse(summary.scannedAt) + 1000),
    backups: backups.length, latestBackup: backups[0] || null, hasResults: has.some(Boolean),
  });
}));

// "Start fresh": the results of earlier runs (scan, builds, validation, image results, reports) are moved aside.
// The website's own files, its profile, its design, the AI-written content and the backups are not touched.
const RESET_ITEMS = ['scan', 'build', 'build-report.json', 'validation.json', 'browser.json', 'images-inplace.json', 'reports', 'publish', 'graph.json', 'site.json', '_tw', '_tw-preview', 'template/preview', 'template/preview-state.json'];
app.post('/api/clients/:slug/reset', wrap(async (req, res) => {
  const slug = req.params.slug;
  if (!(await loadClient(slug))) throw new Error('Unknown website');
  if ([inplaceJob(slug), buildJob(slug), jobStatus(slug)].some((j) => j?.running)) throw new Error('A task is still running for this website. Wait for it to finish first.');
  const dest = path.join(clientDir(slug), `_reset-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`);
  const moved = [];
  for (const item of RESET_ITEMS) {
    const from = path.join(clientDir(slug), item);
    if (!(await fs.stat(from).catch(() => null))) continue;
    const to = path.join(dest, item);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);
    moved.push(item);
  }
  res.json({ moved, keptAt: moved.length ? path.relative(DATA_DIR, dest) : '' });
}));

app.get('/api/clients', wrap(async (_, res) => res.json((await listClients()).map((c) => ({ ...c, options: optionsOf(c) })))));
app.get('/api/options', (_, res) => res.json(OPTION_INFO));

app.get('/api/clients/:slug/profile', wrap(async (req, res) => { const c = await loadClient(req.params.slug); res.json({ ...(await getProfile(req.params.slug)), suggestedDomain: c?.host ? `https://${c.host}` : '' }); }));
app.put('/api/clients/:slug/profile', wrap(async (req, res) => res.json(await saveProfile(req.params.slug, req.body))));
app.post('/api/clients/:slug/profile/approve', wrap(async (req, res) => res.json(await approveProfile(req.params.slug))));

// Returns a draft for review; nothing is stored until the user saves it.
app.post('/api/clients/:slug/profile/from-url', wrap(async (req, res) => {
  if (!(await loadClient(req.params.slug))) throw new Error('Unknown client');
  res.json(await draftProfileFromUrl(String(req.body.url || '')));
}));

app.post('/api/clients/:slug/scan', wrap(async (req, res) => res.json(await scanClient(req.params.slug, () => {}))));
app.post('/api/clients/:slug/scan/updated', wrap(async (req, res) => res.json(await scanClient(req.params.slug, () => {}, { updated: true }))));
// deeper checks: duplicate groups, internal links, keyword overlap, accessibility (the updated site too, once it has been audited)
app.get('/api/clients/:slug/insights', wrap(async (req, res) => res.json(await loadInsights(req.params.slug))));
app.post('/api/clients/:slug/insights', wrap(async (req, res) => {
  const slug = req.params.slug;
  await buildInsights(slug);
  if (await readJson(path.join(clientDir(slug), 'scan', 'updated-pages.json'), null)) await buildInsights(slug, { updated: true });
  res.json(await loadInsights(slug));
}));
app.get('/api/clients/:slug/scan', wrap(async (req, res) => {
  const dir = path.join(clientDir(req.params.slug), 'scan');
  const client = await loadClient(req.params.slug);
  const scope = await loadScope(req.params.slug);
  const after = await readJson(path.join(dir, 'updated-summary.json'), null);
  const applied = await loadApplied(req.params.slug);
  res.json({
    appliedAt: applied?.at || null,
    ...scopeScan(scopedScan({ summary: await readJson(path.join(dir, 'summary.json')), pages: await readJson(path.join(dir, 'pages.json'), []) }, scope), client), scope: scopeSummary(scope, await readJson(path.join(dir, 'pages.json'), [])),
    ...(after ? await (async () => { const u = scopeScan(scopedScan({ summary: after, pages: await readJson(path.join(dir, 'updated-pages.json'), []) }, scope), client); const sev = {}; u.pages.forEach((p) => p.issues.forEach((i) => (sev[i.code] = i.severity))); return { updated: u.summary, updatedSev: sev, updatedPages: Object.fromEntries(u.pages.map((p) => [p.path, p.issues.map((i) => i.code)])) }; })() : { updated: null }),
  });
}));

app.post('/api/clients/:slug/build', wrap(async (req, res) => {
  const limit = Number(req.body?.limit) || undefined;
  const { results, ...rest } = await buildClient(req.params.slug, { limit });
  res.json({ ...rest, results });
}));
app.post('/api/clients/:slug/build/start', wrap(async (req, res) => res.json(startBuildJob(req.params.slug, { limit: Number(req.body?.limit) || undefined }))));
app.get('/api/clients/:slug/build/job', wrap(async (req, res) => res.json(buildJob(req.params.slug) || { running: false, phase: 'idle', done: 0, total: 0 })));
app.get('/api/clients/:slug/build', wrap(async (req, res) => res.json(await readJson(path.join(clientDir(req.params.slug), 'build-report.json'), null))));

// ---- which build is running, and whether a newer portable file exists ----
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
async function versionInfo() {
  const pkg = await readJson(path.join(APP_ROOT, 'package.json'), {});
  const built = await readJson(path.join(APP_ROOT, 'build-info.json'), null);
  const desktop = process.env.SM_DESKTOP === '1';
  let newer = null;
  if (desktop && built?.stamp && process.env.SM_LAUNCHERS_FILE) newer = (await import('../../electron/updates.cjs')).default.findNewer(process.env.SM_LAUNCHERS_FILE, built.stamp);
  return { version: built?.version || pkg.version || '', stamp: built?.stamp || '', builtAt: built?.builtAt || '', desktop, newer: newer ? { file: newer.file, name: path.basename(newer.file), stamp: newer.stamp, version: newer.version } : null };
}
// which pages of the website are updated (the whole website, or the chosen folders and pages)
app.get('/api/clients/:slug/scope', wrap(async (req, res) => {
  const slug = req.params.slug;
  const pages = (await readJson(path.join(clientDir(slug), 'scan/pages.json'), [])).map((p) => ({ path: p.path, type: p.type, title: p.title || '' }));
  const scope = await loadScope(slug);
  res.json({ scope, pages, summary: scopeSummary(scope, pages) });
}));
app.put('/api/clients/:slug/scope', wrap(async (req, res) => {
  const slug = req.params.slug;
  if (!(await loadClient(slug))) throw new Error('Unknown website');
  if ([inplaceJob(slug), buildJob(slug), jobStatus(slug), finalJob(slug)].some((j) => j?.running)) throw new Error('A task is running for this website. Wait for it to finish, then change the pages.');
  const scope = await saveScope(slug, req.body || {});
  const pages = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  res.json({ scope, summary: scopeSummary(scope, pages) });
}));
app.get('/api/app-settings', (_req, res) => res.json(settingsForUi()));
app.get('/api/rules', (_req, res) => res.json(rulesForUi()));
app.get('/api/page-types', (_req, res) => res.json(typesForUi()));
app.get('/api/version', wrap(async (_req, res) => res.json(await versionInfo())));
// close this copy and open the newer portable file (the app is only restarted; nothing is installed)
app.post('/api/update-now', wrap(async (_req, res) => {
  const v = await versionInfo();
  if (!v.newer) throw new Error('There is no newer portable file next to this one.');
  const { spawn } = await import('node:child_process');
  spawn('cmd.exe', ['/c', `ping -n 4 127.0.0.1 >nul & start "" "${v.newer.file}"`], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
  res.json({ restarting: true, to: v.newer.name });
  // the window and this server end together; the newer file opens a few seconds later
  setTimeout(() => { const parent = Number(process.env.SM_PARENT_PID); if (parent) spawn('taskkill', ['/PID', String(parent), '/T', '/F'], { stdio: 'ignore' }); else process.exit(0); }, 600);
}));

// ---- content and build, as one step ----
app.get('/api/clients/:slug/final', wrap(async (req, res) => res.json({ applied: await loadApplied(req.params.slug), spent: (await readJson(path.join(clientDir(req.params.slug), 'usage.json'), { cost: 0 })).cost || 0, settings: await loadBuildSettings(req.params.slug), last: await finalForUi(req.params.slug), job: await finalJobOrSaved(req.params.slug), templateFinal: await templateReady(req.params.slug) })));
// the review of one page's title, description and heading
app.get('/api/clients/:slug/final/head', wrap(async (req, res) => res.json(await reviewData(req.params.slug, String(req.query.path || '')))));
app.post('/api/clients/:slug/final/head/check', wrap(async (req, res) => res.json(await checkHead(req.params.slug, String(req.body?.path || ''), req.body?.values || {}))));
app.post('/api/clients/:slug/final/head/rewrite', wrap(async (req, res) => res.json(await rewriteField(req.params.slug, String(req.body?.path || ''), String(req.body?.field || ''), { instruction: String(req.body?.instruction || ''), value: String(req.body?.value || '') }))));
app.put('/api/clients/:slug/final/head', wrap(async (req, res) => res.json(await saveManual(req.params.slug, String(req.body?.path || ''), req.body?.values || {}))));
app.delete('/api/clients/:slug/final/head', wrap(async (req, res) => { await clearManual(req.params.slug, String(req.query.path || '')); res.json({ cleared: true }); }));
// the page is built again into the folder of the last run, so the saved wording can be seen at once
app.post('/api/clients/:slug/final/head/rebuild', wrap(async (req, res) => {
  const slug = req.params.slug, rel = String(req.body?.path || '');
  const last = await loadFinal(slug);
  if (!last?.results?.some((r) => r.path === rel)) throw new Error('That page is not in the last build.');
  const settings = await loadBuildSettings(slug);
  await buildClient(slug, { only: [rel], content: settings.contentMode === 'existing' ? 'none' : 'usable', outName: last.outName });
  const html = await fs.readFile(path.join(clientDir(slug), last.outName, rel), 'utf8').catch(() => null);
  if (html) { const file = path.join(clientDir(slug), 'final-build.json'); const j = await readJson(file, null); const row = j?.head?.find((h) => h.path === rel); if (row) { row.after = headSnapshot(html); await writeJson(file, j); } }
  res.json({ rebuilt: Boolean(html), mode: last.mode, writtenToSite: false });
}));
// what needs attention after a build, and the choices for each page
app.get('/api/clients/:slug/final/attention', wrap(async (req, res) => res.json(await attention(req.params.slug))));
app.post('/api/clients/:slug/final/page/rebuild', wrap(async (req, res) => res.json(await rebuildPage(req.params.slug, String(req.body?.path || ''), { rewrite: Boolean(req.body?.rewrite) }))));
app.post('/api/clients/:slug/final/page/decide', wrap(async (req, res) => res.json(await decidePage(req.params.slug, String(req.body?.path || ''), String(req.body?.decision || '')))));
app.post('/api/clients/:slug/final/page/wording', wrap(async (req, res) => res.json(await decideWording(req.params.slug, String(req.body?.path || ''), String(req.body?.action || '')))));
app.post('/api/clients/:slug/final/wording/approve-checked', wrap(async (req, res) => res.json(await approveCheckedWording(req.params.slug))));
app.post('/api/clients/:slug/final/pages/rebuild-failed', wrap(async (req, res) => res.json(await rebuildFailedPages(req.params.slug))));
app.post('/api/clients/:slug/final/plan', wrap(async (req, res) => { const { targets, ...rest } = await planFinal(req.params.slug, req.body || {}); res.json(rest); }));
app.post('/api/clients/:slug/final/start', wrap(async (req, res) => res.json(startFinalBuild(req.params.slug, req.body || {}))));
app.post('/api/clients/:slug/restore-page', wrap(async (req, res) => res.json(await restorePage(req.params.slug, String(req.body.path || '')))));
app.post('/api/clients/:slug/final/restore', wrap(async (req, res) => {
  if (finalJob(req.params.slug)?.running) throw new Error('A build is running. Wait for it to finish first.');
  res.json(await restoreSiteOriginals(req.params.slug));
}));
app.get('/api/clients/:slug/final/job', wrap(async (req, res) => res.json((await finalJobOrSaved(req.params.slug)) || { running: false, phase: 'idle', done: 0, total: 0 })));
app.post('/api/clients/:slug/final/retry', wrap(async (req, res) => res.json(await retryFinalStep(req.params.slug, String(req.body?.step || '')))));
app.post('/api/clients/:slug/final/cancel', wrap(async (req, res) => res.json(cancelFinal(req.params.slug) || {})));
app.get('/api/clients/:slug/final/detail', wrap(async (req, res) => res.json(await finalDetail(req.params.slug, String(req.query.path || '')))));
app.get('/api/clients/:slug/build-settings', wrap(async (req, res) => res.json(await loadBuildSettings(req.params.slug))));
app.put('/api/clients/:slug/build-settings', wrap(async (req, res) => res.json(await saveBuildSettings(req.params.slug, req.body))));
app.get('/api/clients/:slug/content', wrap(async (req, res) => res.json(await contentOverview(req.params.slug))));
app.get('/api/clients/:slug/content/item', wrap(async (req, res) => res.json(await contentItem(req.params.slug, String(req.query.path || '')))));
app.post('/api/clients/:slug/content/estimate', wrap(async (req, res) => res.json(await estimate(req.params.slug, req.body.paths))));
app.post('/api/clients/:slug/content/generate', wrap(async (req, res) => {
  const { paths, mode } = req.body;
  if (!Array.isArray(paths) || !paths.length) throw new Error('No pages selected');
  res.json(startRun(req.params.slug, paths, { mode }));
}));
app.get('/api/clients/:slug/content/job', wrap(async (req, res) => res.json(jobStatus(req.params.slug) || { running: false, total: 0, done: 0, failed: 0, cost: 0, errors: [] })));
app.post('/api/clients/:slug/content/cancel', wrap(async (req, res) => res.json(cancelRun(req.params.slug) || {})));
app.post('/api/clients/:slug/content/status', wrap(async (req, res) => res.json(await setStatus(req.params.slug, req.body.path, req.body.status, req.body.edits))));
app.post('/api/clients/:slug/content/approve-many', wrap(async (req, res) => res.json(await approveMany(req.params.slug, req.body.paths || []))));
app.post('/api/clients/:slug/content/regenerate', wrap(async (req, res) => res.json(await generatePage(req.params.slug, req.body.path, { mode: req.body.mode, note: req.body.note, force: true }))));
app.post('/api/clients/:slug/content/preview', wrap(async (req, res) => {
  const r = await buildClient(req.params.slug, { only: [req.body.path], content: 'all' });
  res.json(r.results[0] || {});
}));

app.get('/api/clients/:slug/images', wrap(async (req, res) => res.json({ result: await loadInplace(req.params.slug), settings: await loadImageSettings(req.params.slug), backups: await listBackups(req.params.slug), final: await templateReady(req.params.slug) })));
app.put('/api/clients/:slug/images/settings', wrap(async (req, res) => res.json(await saveImageSettings(req.params.slug, req.body))));
app.post('/api/clients/:slug/images/analyse', wrap(async (req, res) => res.json(await planImages(req.params.slug))));
app.post('/api/clients/:slug/images/run', wrap(async (req, res) => {
  if (await loadApplied(req.params.slug)) throw new Error('The site files were already updated by Content & build. Restore the original files first (Content & build page), then optimise the images.');
  if (!(await templateReady(req.params.slug))) throw new Error('Approve the template first (Template design step)');
  if ((await getProfile(req.params.slug)).status !== 'approved') throw new Error('Approve the business profile first (Business profile step). It is needed for every update.');
  const s = await loadImageSettings(req.params.slug);
  res.json(startInplace(req.params.slug, { copyTo: s.copyBackupTo }));
}));
// the job without its (large) final manifest; entries are sent from ?since=N so the live table only fetches new rows
app.get('/api/clients/:slug/images/job', wrap(async (req, res) => {
  const j = inplaceJob(req.params.slug);
  if (!j) return res.json({ running: false, phase: 'idle', done: 0, total: 0, entries: [], entryCount: 0 });
  const { result, entries, ...rest } = j;
  const since = Math.max(0, Number(req.query.since) || 0);
  res.json({ ...rest, entryCount: entries.length, entries: entries.slice(since) });
}));
app.post('/api/clients/:slug/images/restore-unused', wrap(async (req, res) => res.json(await restoreUnused(req.params.slug))));
app.post('/api/clients/:slug/images/restore-originals', wrap(async (req, res) => res.json(await restoreOriginals(req.params.slug))));
app.post('/api/clients/:slug/images/restore-site', wrap(async (req, res) => res.json(await restoreSite(req.params.slug, String(req.body.id || '')))));
// Every backup of every website with its age and size, plus free space on the drive the backups live on.
const BACKUP_WARN_DAYS = 365;
app.get('/api/backups', wrap(async (_, res) => {
  const rows = [];
  for (const c of await listClients()) {
    for (const b of await listBackups(c.slug)) {
      const st = await fs.stat(path.join(clientDir(c.slug), 'backups', `${b.id}.zip`)).catch(() => null);
      const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(b.createdAt)) / 864e5));
      rows.push({ slug: c.slug, site: c.name, ...b, bytes: st?.size ?? b.bytes, missing: !st, ageDays, old: ageDays >= BACKUP_WARN_DAYS });
    }
  }
  rows.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  let disk = null;
  try { const f = await fs.statfs(CLIENTS_DIR); disk = { free: f.bavail * f.bsize, total: f.blocks * f.bsize }; } catch { /* not supported here */ }
  const old = rows.filter((r) => r.old);
  res.json({ warnDays: BACKUP_WARN_DAYS, rows, totalBytes: rows.reduce((n, r) => n + r.bytes, 0), oldCount: old.length, oldBytes: old.reduce((n, r) => n + r.bytes, 0), oldSites: new Set(old.map((r) => r.slug)).size, disk });
}));

app.delete('/api/clients/:slug/backups/:id', wrap(async (req, res) => {
  if (inplaceJob(req.params.slug)?.running) throw new Error('An image optimisation is running for this website. Wait for it to finish.');
  res.json(await deleteBackup(req.params.slug, req.params.id));
}));

app.get('/api/clients/:slug/backups/:id/download', wrap(async (req, res) => {
  if (!/^\d{8}-\d{6}$/.test(req.params.id)) throw new Error('Bad id');
  res.download(path.join(clientDir(req.params.slug), 'backups', `${req.params.id}.zip`));
}));

app.get('/api/clients/:slug/validation', wrap(async (req, res) => res.json(await loadValidation(req.params.slug))));
app.post('/api/clients/:slug/validation', wrap(async (req, res) => res.json(await validateSite(req.params.slug, { skipBuild: true }))));
app.get('/api/clients/:slug/reports/:name', (req, res) => {
  if (!['optimization-report.html', 'validation.csv'].includes(req.params.name)) return res.status(404).end();
  res.sendFile(reportPath(req.params.slug, req.params.name), (err) => err && res.status(404).end());
});
// the modernisation report: prepared in the background, then opened as a page; every table is also a csv file
app.get('/api/clients/:slug/modernization', wrap(async (req, res) => res.json(await reportInfo(req.params.slug))));
app.post('/api/clients/:slug/modernization', wrap(async (req, res) => res.json(startReport(req.params.slug))));
app.get('/api/clients/:slug/modernization/job', wrap(async (req, res) => res.json(reportJob(req.params.slug) || { running: false, phase: 'idle', done: 0, total: 0 })));
app.get('/api/clients/:slug/modernization/report', (req, res) => {
  const file = path.join(reportDir(req.params.slug), REPORT_FILE), missing = (err) => err && !res.headersSent && res.status(404).send('The report has not been prepared yet. Open it from the Validation & Report page.');
  // a report made before the download button existed gets the button (and the print layout) as it is opened; ?download=1 saves it as a file
  fs.readFile(file, 'utf8').then((html) => {
    res.type('html');
    if (req.query.download) res.attachment(`${req.params.slug}-modernization-report.html`);
    res.send(withDownloadButton(html));
  }, () => missing(new Error('missing')));
});
app.get('/api/clients/:slug/modernization/csv/:name', (req, res) => {
  if (!/^[\w-]+\.csv$/.test(req.params.name)) return res.status(404).end();
  res.download(path.join(reportDir(req.params.slug), 'csv', req.params.name), (err) => err && !res.headersSent && res.status(404).end());
});
app.get('/api/clients/:slug/sitemap', (req, res) => res.download(sitemapFile(req.params.slug), 'sitemap.xml', (err) => err && !res.headersSent && res.status(404).send('Run a build first: the recommended sitemap is prepared with it.')));
app.get('/api/clients/:slug/browser', wrap(async (req, res) => res.json(await loadBrowserResults(req.params.slug))));
app.get('/api/clients/:slug/browser/job', wrap(async (req, res) => res.json(browserJob(req.params.slug) || { running: false, total: 0, done: 0, errors: [] })));
app.post('/api/clients/:slug/browser', wrap(async (req, res) => {
  const v = await loadValidation(req.params.slug);
  if (!v) throw new Error('Run validation first');
  res.json(startBrowserRun(req.params.slug, pickSample(v, Number(req.body?.limit) || APP.limits.browserTestPages)));
}));

// ---- the Theme Engine (src/theme): themes of a website, generated, edited, selected, exported and imported ----
// the colour engine itself also runs in the browser (instant previews while a colour is edited): the same three files, nothing else
app.get('/theme-engine/:file', (req, res) => {
  if (!['color.js', 'engine.js', 'industry.js'].includes(req.params.file)) return res.status(404).end();
  res.type('js').sendFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'theme', req.params.file));
});
app.get('/api/clients/:slug/themes', wrap(async (req, res) => res.json(await themeState(req.params.slug))));
app.post('/api/clients/:slug/themes/generate', wrap(async (req, res) => res.json(await generateThemesFor(req.params.slug, req.body || {}))));
app.post('/api/clients/:slug/themes/import', wrap(async (req, res) => res.json(await importTheme(req.params.slug, req.body?.json ?? req.body))));
app.post('/api/clients/:slug/themes', wrap(async (req, res) => res.json(await createTheme(req.params.slug, req.body || {}))));
app.put('/api/clients/:slug/themes/:id', wrap(async (req, res) => res.json(await updateThemeRecord(req.params.slug, req.params.id, req.body || {}))));
app.post('/api/clients/:slug/themes/:id/duplicate', wrap(async (req, res) => res.json(await duplicateTheme(req.params.slug, req.params.id))));
app.post('/api/clients/:slug/themes/:id/select', wrap(async (req, res) => res.json(await selectTheme(req.params.slug, req.params.id))));
app.post('/api/clients/:slug/themes/:id/reset', wrap(async (req, res) => res.json(await resetTheme(req.params.slug, req.params.id))));
app.get('/api/clients/:slug/themes/:id/export', wrap(async (req, res) => { const t = await exportTheme(req.params.slug, req.params.id); res.attachment(`${req.params.slug}-${String(t.theme.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.theme.json`).json(t); }));
app.delete('/api/clients/:slug/themes/:id', wrap(async (req, res) => res.json(await deleteTheme(req.params.slug, req.params.id))));

// the colours of the website as it is now, read from how its pages are drawn in the browser: the starting colours of a new template
app.post('/api/clients/:slug/template/site-colors', wrap(async (req, res) => res.json(await detectSiteColors(req.params.slug, { refresh: Boolean(req.body?.refresh) }))));
app.get('/api/clients/:slug/template', wrap(async (req, res) => res.json(await templateState(req.params.slug))));
// Saving the Design settings: besides the new version, the settings the user changed are kept for the design variants, which wear them
app.put('/api/clients/:slug/template', wrap(async (req, res) => {
  const before = (await loadActive(req.params.slug)).spec;
  const after = await saveDraft(req.params.slug, req.body.patch || {}, { note: req.body.note || 'Manual edit' });
  const changed = await recordConfig(req.params.slug, before, after);
  res.json({ ...(await templateState(req.params.slug)), variantSettingsChanged: changed });
}));
app.post('/api/clients/:slug/template/design', wrap(async (req, res) => { const r = await designFromBrief(req.params.slug, { brief: String(req.body.brief || ''), archetype: String(req.body.archetype || ''), fresh: Boolean(req.body.fresh) }); res.json({ ...r, state: await templateState(req.params.slug) }); }));
app.post('/api/clients/:slug/template/refine', wrap(async (req, res) => { if (!req.body.expert && !String(req.body.instruction || '').trim() && !(req.body.attachments || []).length) throw new Error('Describe the change you want'); const r = await refineDesign(req.params.slug, req.body.expert ? EXPERT_REVIEW : String(req.body.instruction), Array.isArray(req.body.history) ? req.body.history.slice(-6) : [], { attachments: req.body.attachments, targets: req.body.targets, outline: req.body.outline, originalOutline: req.body.originalOutline, layout: req.body.layout, page: req.body.page, baseUrl: `http://127.0.0.1:${req.socket.localPort}` }); res.json({ ...r, state: await templateState(req.params.slug) }); }));
// a banner picture for the home, inner or contact page: stored with the template files; the design keeps its path (Save as new version)
app.post('/api/clients/:slug/template/banner', wrap(async (req, res) => {
  if (!(await loadClient(req.params.slug))) throw new Error('Unknown website');
  const slot = String(req.body?.slot || '');
  res.json(req.body?.url ? await saveBannerFromUrl(req.params.slug, slot, req.body.url) : await saveBanner(req.params.slug, slot, { dataUrl: req.body?.dataUrl, name: req.body?.name }));
}));
app.post('/api/clients/:slug/template/refs', wrap(async (req, res) => {
  const { type, url, name, dataUrl, note } = req.body;
  if (type === 'url') await addUrlRef(req.params.slug, String(url || ''), note);
  else await addImageRef(req.params.slug, name, dataUrl, note);
  res.json(await listRefs(req.params.slug));
}));
app.delete('/api/clients/:slug/template/refs/:id', wrap(async (req, res) => { await removeRef(req.params.slug, req.params.id); res.json(await listRefs(req.params.slug)); }));
app.get('/api/clients/:slug/template/refs/:id/image', wrap(async (req, res) => {
  const ref = (await listRefs(req.params.slug)).find((r) => r.id === req.params.id && r.type === 'image');
  if (!ref) return res.status(404).end();
  res.sendFile(path.join(refsDir(req.params.slug), ref.value));
}));
// a site's template is either designed with the platform or built from the site's own modern pages
app.put('/api/clients/:slug/template/type', wrap(async (req, res) => { await setTemplateType(req.params.slug, String(req.body?.type ?? '')); res.json(await templateState(req.params.slug)); }));
app.get('/api/clients/:slug/template/existing', wrap(async (req, res) => res.json(await exState(req.params.slug))));
app.post('/api/clients/:slug/template/existing/detect', wrap(async (req, res) => { await detectFamilies(req.params.slug); res.json(await exState(req.params.slug)); }));
app.put('/api/clients/:slug/template/existing/family', wrap(async (req, res) => { await setOverride(req.params.slug, String(req.body?.target || ''), String(req.body?.family || '')); res.json(await exState(req.params.slug)); }));
app.post('/api/clients/:slug/template/existing/patterns', wrap(async (req, res) => { await buildPatterns(req.params.slug); res.json(await exState(req.params.slug)); }));
app.put('/api/clients/:slug/template/existing/patterns/:kind', wrap(async (req, res) => {
  const { slug, kind } = req.params, b = req.body || {};
  if (b.source === 'chosen') await chooseDesign(slug, kind, b.page, b.key); else await resetPattern(slug, kind, String(b.source || ''));
  res.json(await exState(slug));
}));
app.post('/api/clients/:slug/template/existing/patterns/:kind/refine', wrap(async (req, res) => { const r = await refinePattern(req.params.slug, req.params.kind, req.body?.message); res.json({ ...r, state: await exState(req.params.slug) }); }));
app.post('/api/clients/:slug/template/existing/patterns/:kind/undo', wrap(async (req, res) => { await undoRefine(req.params.slug, req.params.kind); res.json(await exState(req.params.slug)); }));
app.get('/api/clients/:slug/template/existing/pattern-page', wrap(async (req, res) => res.json(await describePage(req.params.slug, String(req.query.page || '')))));
app.post('/api/clients/:slug/template/existing/patterns/:kind/preview', wrap(async (req, res) => res.json(await previewPattern(req.params.slug, req.params.kind, req.body?.page ? { page: req.body.page, key: req.body.key } : null))));
app.post('/api/clients/:slug/template/existing/patterns/preview', wrap(async (req, res) => res.json(await previewPatterns(req.params.slug))));
app.post('/api/clients/:slug/template/existing/preview', wrap(async (req, res) => res.json(await previewConversion(req.params.slug, String(req.body?.layout || ''), String(req.body?.page || '')))));
// the template page as an outline (header, sections, footer), the role of each section, and its theme
app.get('/api/clients/:slug/template/existing/outline/:layout', wrap(async (req, res) => res.json(await describeTemplate(req.params.slug, req.params.layout))));
app.put('/api/clients/:slug/template/existing/roles', wrap(async (req, res) => { await saveRoles(req.params.slug, String(req.body?.layout || ''), req.body?.roles || {}); res.json(await describeTemplate(req.params.slug, String(req.body.layout))); }));
app.get('/api/clients/:slug/template/existing/theme/:layout', wrap(async (req, res) => res.json(await extractTheme(req.params.slug, req.params.layout, { refresh: req.query.refresh === '1' }))));
app.put('/api/clients/:slug/template/existing/selection', wrap(async (req, res) => { await saveOwn(req.params.slug, req.body || {}); res.json(await exState(req.params.slug)); }));
app.post('/api/clients/:slug/template/preview', wrap(async (req, res) => res.json(await previewTemplate(req.params.slug))));
app.post('/api/clients/:slug/template/finalise', wrap(async (req, res) => { await finaliseTemplate(req.params.slug); res.json(await templateState(req.params.slug)); }));
app.post('/api/clients/:slug/template/reopen', wrap(async (req, res) => { await reopen(req.params.slug); res.json(await templateState(req.params.slug)); }));
app.post('/api/clients/:slug/template/restore', wrap(async (req, res) => { await restoreVersion(req.params.slug, req.body.version); res.json(await templateState(req.params.slug)); }));

mountStudio(app, wrap);

kitRoutes(app, wrap);
app.use('/draft', previewHandler('draft'));
app.use('/preview', previewHandler('preview'));
app.use('/original', previewHandler('original'));
app.use('/ownpreview', previewHandler('ownpreview'));
app.use('/final', previewHandler('final'));

// a bad request body or an error outside a wrapped route is answered as JSON, never as a stack trace
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status || 400).json({ error: err.type === 'entity.parse.failed' ? 'The request was not valid JSON.' : err.type === 'entity.too.large' ? 'The upload is too large.' : err.message });
});
// a background job that fails must not take the portal down with it
process.on('unhandledRejection', (e) => console.error('A background task failed (the portal keeps running):', e));
process.on('uncaughtException', (e) => console.error('Unexpected error (the portal keeps running):', e));

const port = Number(process.env.PORT) || 4310;
const server = app.listen(port, '127.0.0.1', () => {
  globalThis.__portalOrigin = `http://127.0.0.1:${port}`; console.log(`Portal: http://127.0.0.1:${port}`);
  // reports saved before the Download as HTML button existed get it in the file itself
  listClients().then((cs) => upgradeSavedReports(cs.map((c) => path.join(reportDir(c.slug), REPORT_FILE)))).then((d) => d.length && console.log(`Added the Download as HTML button to ${d.length} saved report(s).`)).catch(() => {});
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Close the other portal window first, or start with PORT=<another number>.` : e.message); process.exit(1); });
