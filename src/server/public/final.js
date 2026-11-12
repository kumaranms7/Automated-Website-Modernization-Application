// ---------- Content & build (one step): content mode + build mode + Start building, then the updated pages with SEO before/after ----------
// Loaded after app.js; uses $, api, el, busy, toast, panel, slug from there.

const FB = { data: null, poll: null, rows: [], sel: '', show: 'both', plan: null };
const fbApi = (p, o) => api(`/api/clients/${slug}/final${p}`, o);
const money = (n) => '$' + Number(n || 0).toFixed(2);
const fbEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MODE_NAME = { existing: 'existing content', enhance: 'enhance', rewrite: 're-write' };
const BUILD_TITLE = { dry: 'Dry run', get sample() { return `Building ${APP_UI.limits.samplePages} sample pages`; }, all: 'Building all pages and updating your website files' };
const BUILD_PHASE = { starting: 'Starting…', failed: 'Stopped with a problem', content: 'Writing page wording', build: 'Building pages', styling: 'Compiling the stylesheet…', read: 'Reading pages', seo: 'Writing titles and descriptions', backup: 'Backing up your original files', apply: 'Updating your website files', scoring: 'Scoring pages for SEO', done: 'Finished', cancelled: 'Stopped' };
const scoreCls = (n) => (n == null ? 'none' : n >= 90 ? 'good' : n >= 75 ? 'mid' : 'low');
const radio = (name) => document.querySelector(`input[name=${name}]:checked`)?.value;

async function loadFinalTab() {
  if (!slug) return;
  FB.data = await fbApi('');
  $('spent').textContent = 'Spent ' + money(FB.data.spent);
  const s = FB.data.settings;
  document.querySelectorAll('input[name=cmode]').forEach((r) => { r.checked = r.value === s.contentMode; });
  $('c-scope').value = s.scope;
  loadOptions(s);
  contentModesFor(siteOptions);
  if (FB.data.last?.mode) document.querySelectorAll('input[name=bmode]').forEach((r) => { r.checked = r.value === FB.data.last.mode; });
  renderFinal();
  refreshPlan();
  const j = FB.data.job;
  if (j && j.phase !== 'idle') { if (j.running) watchFinal(); else showFinalJob(j, true); }
}

// "Use existing content" only makes sense when a template is being applied; a website that keeps its design is always Enhanced or Re-written
function contentModesFor(o) {
  const existing = document.querySelector('input[name=cmode][value=existing]');
  existing.closest('label').hidden = !o.template;
  if (!o.template && existing.checked) document.querySelector('input[name=cmode][value=enhance]').checked = true;
  $('fb-options').querySelector('summary').textContent = o.template ? 'More options for titles, links and search tags' : 'More options for titles, links and search tags';
}

// the other choices of a run: switches, which pages get new titles, the pages to leave out
const OPTION_SWITCHES = { 'o-clean': 'cleanUrls', 'o-links': 'fixLinks', 'o-brand': 'brandInTitles', 'o-h1': 'rewriteH1', 'o-batch': 'headBatch', 'o-social': 'socialTags', 'o-schema': 'schema', 'o-protect': 'protectScore', 'o-hold': 'reviewWording', 'o-audit': 'autoAudit', 'o-noindex': 'skipNoindex', 'o-errors': 'skipErrorPages', 'o-redirected': 'skipRedirected' };
function loadOptions(s) {
  for (const [id, key] of Object.entries(OPTION_SWITCHES)) $(id).checked = Boolean(s[key]);
  $('o-headscope').value = s.headScope || 'failing';
  $('o-exclude').value = s.excludePatterns || '';
}
function readOptions() {
  const o = { headScope: $('o-headscope').value, excludePatterns: $('o-exclude').value };
  for (const [id, key] of Object.entries(OPTION_SWITCHES)) o[key] = $(id).checked;
  return o;
}

// ---- what is about to happen ----
async function refreshPlan() {
  const body = { buildMode: radio('bmode'), contentMode: radio('cmode'), scope: $('c-scope').value, ...readOptions() };
  let p;
  const asked = slug;
  try { p = await fbApi('/plan', { method: 'POST', body }); } catch (e) { if (asked === slug) $('fb-plan').textContent = e.message; return; }
  if (asked !== slug) return; // the site was switched while this was loading
  FB.plan = p;
  const li = (ok, text) => { const x = el('li', undefined, ok === true ? 'ok' : ok === false ? 'bad' : 'warn'); x.append(el('i', ok === true ? '✓' : ok === false ? '✕' : '!'), document.createTextNode(text)); return x; };
  const ul = $('fb-pre'); ul.innerHTML = '';
  const o = p.options || { template: true, images: true, content: true };
  if (!o.template) ul.append(li(true, 'This website keeps its design: only the wording and the search tags change, page by page, inside the pages you already have.'));
  else if (p.existing) ul.append(li(p.templateFinal, p.templateFinal ? `Template made from your existing pages: ${p.existing.legacy} legacy page(s) are converted, and the ${p.existing.modern} modern page(s) stay exactly as they are.` : 'The template pages are not chosen yet. Choose and save them in Template design first.'));
  else ul.append(li(p.templateFinal, p.templateFinal ? 'Template is finalised' : 'The template is not finalised yet. Finalise it in Template design first.'));
  if (o.images) ul.append(li(p.imagesOptimised ? true : null, p.imagesOptimised ? 'Images are optimised: pages use WebP and responsive srcset files' : 'Images are not optimised yet, so pages will keep their original image files. Run the Images step first for WebP and srcset.'));
  const mode = p.settings.contentMode;
  const blockedAi = p.generate.length > 0 && !p.profileApproved;
  if (p.buildMode === 'dry') ul.append(li(true, `Dry run: the AI is not used. ${p.reuse ? `${p.reuse} page(s) with wording already written will use it.` : 'Pages keep their existing wording.'}`));
  else if (mode === 'existing') ul.append(li(true, 'Existing content: the wording of every page is not changed.'));
  else if (blockedAi) ul.append(li(false, `${p.generate.length} page(s) need AI wording, but the business profile is not approved. Approve it in the Business profile step, or choose "Use existing content".`));
  else if (p.generate.length) ul.append(li(null, `AI will write wording for ${p.generate.length} page(s) first (${MODE_NAME[mode]})${p.estimate?.cost != null ? `, about ${money(p.estimate.cost)}` : ''}. ${p.reuse ? `${p.reuse} already written page(s) are reused.` : ''}`));
  else ul.append(li(true, `All ${p.pages} page(s) in this run already have wording written, or keep their existing wording.`));
  // titles and meta descriptions: always brought within the limits, whatever the content mode
  const sf = p.seoFix || { pages: 0 };
  if (!sf.pages) ul.append(li(true, sf.scope === 'all' ? 'No page needs new titles or descriptions.' : 'Titles and meta descriptions already meet the limits (' + RULES.title.min + '-' + RULES.title.max + ' and ' + RULES.description.min + '-' + RULES.description.max + ' characters) and are different on every page.'));
  else if (p.buildMode === 'dry') ul.append(li(null, `${sf.pages} page(s) have a title or meta description that is the wrong length, cut off or the same as another page. A dry run writes replacements by rule, without the AI.`));
  else ul.append(li(null, `${sf.pages} page(s) have a title or meta description that is the wrong length, cut off or the same as another page. The AI writes complete, different replacements within the limits${sf.cost != null ? (sf.cost < 0.01 ? ', for less than one cent' : `, about ${money(sf.cost)}`) : ''}. This happens in every content mode.`));
  // the audit and this build, joined
  if (p.audit?.issues) ul.append(li(null, `The audit found ${p.audit.issues} issue(s) on ${p.audit.pages} of these pages that this build is meant to fix. ${p.audit.auto ? 'After "Build all pages" the updated site is audited automatically, so you see how many were fixed.' : 'Audit the updated site on the Site audit page afterwards to see how many were fixed.'}`));
  // AI wording that nobody has read yet
  if (p.holdWording) ul.append(li(null, p.waitingReview ? `${p.waitingReview} page(s) have AI wording you have not approved. They keep their own wording in this build until you approve them: open a page and press "Approve this wording", or approve all that passed the checks under Needs attention.` : 'AI wording is published only after you approve it.'));
  else if (p.buildMode === 'all' && p.waitingReview) ul.append(li(null, `${p.waitingReview} page(s) with AI wording you have not read will go live. Tick "Hold AI wording until I approve it" in More options to review it first.`));
  if (p.leftOut?.length) ul.append(li(null, `${p.leftOut.length} page(s) are left out and stay exactly as they are: ${[...new Set(p.leftOut.map((x) => x.why.replace(/ \(.*$/, '')))].join('; ')}.`));
  if (p.updatesSite) ul.append(li(null, p.alreadyUpdated
    ? `Your website folder (${p.siteDir}) will be updated again. Your original files were backed up the first time and can still be restored from this page.`
    : `Your website folder (${p.siteDir}) will be updated directly. A verified backup of your original files is taken first, and you can restore them from this page.`));
  $('fb-plan').textContent = `${p.pages} page${p.pages === 1 ? '' : 's'} will be built${p.buildMode === 'all' ? ' and written into your website folder' : p.buildMode === 'sample' ? ' into a separate sample folder (your website folder is not changed)' : ' into a scratch folder (your website folder is not changed)'}.`;
  $('fb-start').disabled = !p.templateFinal || blockedAi || !p.profileApproved;
  if (!p.profileApproved) ul.append(li(false, 'The business profile is not approved. Approve it in the Business profile step: it is needed for every update.'));
}
document.querySelectorAll('input[name=cmode], input[name=bmode]').forEach((r) => { r.onchange = () => { if (r.checked) refreshPlan(); }; });
$('c-scope').onchange = refreshPlan; document.querySelectorAll('#fb-options input, #fb-options select, #fb-options textarea').forEach((x) => { x.onchange = refreshPlan; });

// ---- start, watch, stop ----
$('fb-start').onclick = (e) => busy(e.target, async () => {
  const body = { buildMode: radio('bmode'), contentMode: radio('cmode'), scope: $('c-scope').value, ...readOptions() };
  await refreshPlan();
  const p = FB.plan;
  if (p.generate.length && !confirm(`The AI will write wording for ${p.generate.length} page(s)${p.estimate?.cost != null ? `, about ${money(p.estimate.cost)}` : ''}, then the pages are built and scored.\n\nContinue?`)) return;
  if (!p.generate.length && p.seoFix?.pages && p.buildMode !== 'dry' && !confirm(`The AI will write new titles and meta descriptions for ${p.seoFix.pages} page(s) whose current ones break the limits${p.seoFix.cost != null ? `, about ${money(p.seoFix.cost)}` : ''}.\n\nContinue?`)) return;
  if (body.buildMode === 'all' && !confirm(`Build all pages and update the files in your website folder?\n\n${p.siteDir}\n\nA verified backup of your original files is taken first. You can restore the originals from this page.${p.waitingReview && !p.holdWording ? `\n\n${p.waitingReview} page(s) have AI wording you have not read yet. It will go live.` : ''}`)) return;
  FB.sel = '';
  await fbApi('/start', { method: 'POST', body });
  watchFinal();
});
$('fb-cancel').onclick = async () => { await fbApi('/cancel', { method: 'POST' }); toast('Stopping after the current page…'); };

// how far the whole build is: every process counts by its share of the work, the running one by its pages
const STEP_WEIGHT = { content: 40, read: 3, seo: 12, build: 25, styling: 3, backup: 4, apply: 6, scoring: 10, audit: 10 };
function jobPct(j) {
  const steps = (j.steps || []).filter((x) => x.status !== 'skipped');
  if (!steps.length) return undefined;
  let total = 0, got = 0;
  for (const x of steps) { const w = STEP_WEIGHT[x.id] || 5; total += w; got += x.status === 'done' || x.status === 'failed' ? w : x.status === 'running' && j.total ? w * Math.min(1, j.done / j.total) : 0; }
  return total ? (got / total) * 100 : undefined;
}

function watchFinal() {
  clearInterval(FB.poll);
  const tick = async () => {
    const j = await fbApi('/job').catch(() => null);
    if (!j || j.phase === 'idle') return;
    showFinalJob(j);
    if (!j.running) { clearInterval(FB.poll); await finishFinal(j); }
  };
  tick();
  FB.poll = setInterval(tick, 900);
}

// runs one failed process again; the ones that finished are not repeated
async function retryStep(id, btn) {
  const row = (FB.job?.steps || []).find((x) => x.id === id);
  if (row?.group === 'content' && !confirm('The AI will write wording for the pages that are still missing it (finished pages are not paid for again), then the pages are rebuilt and scored.' + String.fromCharCode(10, 10) + 'Continue?')) return;
  await busy(btn, async () => { await fbApi('/retry', { method: 'POST', body: { step: id } }); FB.sel = ''; watchFinal(); });
}

function showFinalJob(j, quiet) {
  FB.job = j;
  const p = panel('jp-build');
  $('fb-cancel').hidden = !j.running;
  $('fb-start').disabled = j.running || !FB.plan?.templateFinal;
  const title = BUILD_TITLE[j.mode] || 'Building';
  if (j.running) {
    const ct = j.content;
    const extra = j.phase === 'content' ? ` · ${money(ct.cost)} so far${ct.failed ? ` · ${ct.failed} failed` : ''}` : '';
    p.set({ state: 'running', title, detail: `${BUILD_PHASE[j.phase] || j.phase} · ${j.done} of ${j.total || '…'} pages${j.current && ['build', 'content'].includes(j.phase) ? ' · ' + j.current : ''}${extra}`, done: j.done, total: j.total, startedAt: j.startedAt, steps: j.steps, retry: retryStep, pct: jobPct(j), log: j.log });
  } else if (!quiet) finishFinal(j);
  else finishFinal(j, true);
}

async function finishFinal(j, quiet) {
  const p = panel('jp-build');
  $('fb-cancel').hidden = true; $('fb-start').disabled = !FB.plan?.templateFinal;
  const title = BUILD_TITLE[j.mode] || 'Build';
  const failedSteps = (j.steps || []).filter((x) => x.status === 'failed');
  FB.data = await fbApi('');
  $('spent').textContent = 'Spent ' + money(FB.data.spent);
  renderFinal();
  if (j.error || failedSteps.length) {
    const msgs = failedSteps.map((x) => `${x.label}: ${x.error}`);
    // which pages and why, not just how many
    const why = (j.content?.errors || []).slice(0, 8).map((c) => `${c.path}: ${c.error}`);
    if (failedSteps.some((x) => x.id === 'content') && why.length) msgs.push(...why, ...(j.content.errors.length > 8 ? [`…and ${j.content.errors.length - 8} more (see "Needs attention" below)`] : []));
    if (j.error && !failedSteps.some((x) => x.error === j.error)) msgs.unshift(j.error);
    const doneN = (j.steps || []).filter((x) => x.status === 'done').length;
    p.set({ state: 'failed', title, detail: failedSteps.length ? `${failedSteps.length} of ${(j.steps || []).filter((x) => x.status !== 'skipped').length} processes failed, ${doneN} finished. Click here to see them, then retry only the failed ones.` : 'The build stopped.', errors: msgs, startedAt: j.startedAt, finishedAt: j.finishedAt, steps: j.steps, retry: retryStep, log: j.log });
    if (!quiet) toast(j.error || `${failedSteps[0].label} failed. Open the details to retry it.`, true);
    return;
  }
  const t = j.totals || FB.data.last?.totals || {};
  const errs = [];
  if (t.seo?.unresolved) errs.push(`${t.seo.unresolved} title or description could not be fixed automatically (see the last build result).`);
  if (t.fail) errs.push(`${t.fail} page(s) failed an automatic check${failSummary(FB.data.last)}. Open a page in the table to see exactly why.`);
  p.set({
    state: j.phase === 'cancelled' ? 'stopped' : t.fail ? 'failed' : 'done', title,
    detail: j.phase === 'cancelled' ? 'Stopped before it finished. Press Start building to continue: wording and pages that are finished are reused, nothing is paid for twice.' : `${t.updatedInSite ? `${t.updatedInSite} pages updated in your website folder` : `${t.pages ?? 0} pages built`} · SEO score ${t.avgBefore ?? '–'} → ${t.avgAfter ?? '–'} · ${t.pass ?? 0} passed · ${t.warn ?? 0} with warnings · ${t.fail ?? 0} failed${t.contentGenerated ? ` · wording written for ${t.contentGenerated} (${money(t.cost)})` : ''}${t.seo && (t.seo.titlesRewritten || t.seo.descriptionsRewritten) ? ` · ${t.seo.titlesRewritten} titles and ${t.seo.descriptionsRewritten} descriptions rewritten` : ''}${t.seo?.alt ? ` · ${t.seo.alt} alt texts added` : ''}`,
    errors: errs, startedAt: j.startedAt, finishedAt: j.finishedAt, steps: j.steps, retry: retryStep, log: j.log,
  });
  if (!quiet) toast(`Built ${t.pages} pages. SEO score ${t.avgBefore} → ${t.avgAfter}`, Boolean(t.fail));
  refreshPlan();
}

// ---- results ----
function renderApplied() {
  const a = FB.data?.applied, card = $('fb-applied');
  card.hidden = !a;
  if (!a) return;
  $('fb-appnote').textContent = `Updated ${new Date(a.at).toLocaleString()} in ${a.siteDir}. Your original files are backed up (backup ${a.backupId}) and the replaced pages are saved, so you can go back at any time.`;
  const box = $('fb-appstats'); box.innerHTML = '';
  [['Pages updated', a.pages.length], ['Shared files added or replaced', a.files.length], ['Pages kept as they were', a.skipped.length], ['Backup', a.backupId]].forEach(([k, v]) => { const d = el('div', undefined, 'stat'); d.append(el('b', String(v)), el('span', k)); box.append(d); });
  const sk = $('fb-appskipped'); sk.innerHTML = '';
  if (a.skipped.length) sk.append(el('p', `Kept as they were: ${a.skipped.slice(0, 6).map((x) => `${x.rel} (${x.reason})`).join('; ')}${a.skipped.length > 6 ? ` and ${a.skipped.length - 6} more` : ''}.`, 'hint'));
}
$('fb-restore').onclick = (e) => busy(e.target, async () => {
  if (!confirm('Restore your original files?\n\nEvery updated page goes back to the original, and the shared files the build added (stylesheet, scripts, fonts) are removed. Your backup zip stays.')) return;
  const r = await fbApi('/restore', { method: 'POST' });
  toast(`Restored ${r.restored} files and removed ${r.removed} added files${r.missing?.length ? `. ${r.missing.length} could not be restored from the saved copies; use backup ${r.backupId}.` : ''}`, Boolean(r.missing?.length));
  FB.data = await fbApi('');
  renderApplied(); refreshPlan();
});

function renderFinal() {
  renderApplied();
  const last = FB.data?.last;
  const box = $('bstats'); box.innerHTML = '';
  $('bstatus').className = 'dot' + (last ? (last.totals.fail ? ' warn' : ' ok') : '');
  const tbl = $('btable');
  if (window.dtDestroy) window.dtDestroy(tbl);
  tbl.innerHTML = '';
  if (!last) { $('fb-attn').hidden = true; $('fb-resnote').textContent = ''; box.append(el('div', 'Nothing built yet. Choose a content mode and a build mode, then press Start building.', 'hint')); FB.rows = []; return; }
  const t = last.totals;
  const mode = { dry: 'Dry run', sample: `${APP_UI.limits.samplePages} sample pages`, all: 'All pages' }[last.mode];
  $('fb-resnote').textContent = `${mode} · ${new Date(last.builtAt).toLocaleString()} · content: ${MODE_NAME[last.contentMode] || last.contentMode}. Double-click a page to preview it and see its score breakup.${last.templateRules?.everyPage ? ` ${last.templateRules.everyPage} change(s) from your inner-page template apply to every inner page.` : ''}${last.notCarried?.length ? ` ${last.notCarried.length} hand edit(s) changed the page structure, so they stay on the sample page: ${last.notCarried.slice(0, 3).join(', ')}.` : ''}`;
  [['Pages built', t.pages], ...(last.applied ? [['Updated in website folder', last.applied.pages]] : []), ['SEO score before', t.avgBefore ?? '–'], ['SEO score after', t.avgAfter ?? '–'], ['Improved', t.improved], ['Pass', t.pass], ['Warnings', t.warn], ['Fail', t.fail], ['Titles rewritten', t.seo?.titlesRewritten ?? 0], ['Descriptions rewritten', t.seo?.descriptionsRewritten ?? 0], ['Alt texts added', t.seo?.alt ?? 0], ['Images given srcset', t.seo?.srcset ?? 0], ['With WebP images', t.webpPages], ['With srcset', t.srcsetPages], ['AI wording', t.withAiContent], ...(t.audit ? [['Audit issues fixed', t.audit.fixed], ['Still open', t.audit.open], ['New issues', t.audit.added]] : [])].forEach(([k, v]) => {
    const d = el('div', undefined, 'stat'); d.append(el('b', String(v)), el('span', k)); box.append(d);
  });
  const ft = $('bftype');
  [...ft.options].slice(1).forEach((o) => o.remove());
  [...new Set(last.results.map((r) => r.type))].forEach((x) => ft.add(new Option(x, x)));
  renderFinalTable();
  renderAttention();
}

// the short reason shown in the table, so nobody has to open a page to learn why it failed
function whyCell(r) {
  const td = el('td', undefined, 'why-cell');
  const bad = (r.checks || []).filter((c) => c.level === 'fail'), warn = (r.checks || []).filter((c) => c.level !== 'fail');
  const list = r.status === 'fail' ? bad : r.status === 'warn' ? (r.accepted?.length ? bad.concat(r.checks.filter((c) => r.accepted.includes(c.id))) : warn) : [];
  if (r.decision === 'keep') td.append(el('b', 'Original kept by you. '));
  else if (r.decision === 'use' && r.accepted) td.append(el('b', 'New page used by you. '));
  if (r.status === 'skipped') td.append(el('span', (r.reason || 'left out').replace(/^kept as it is: /, '')));
  else if (list.length) { const c = list[0]; td.append(el('b', c.name || checkName(c.id)), document.createTextNode(c.msg ? ': ' + (c.msg.length > 70 ? c.msg.slice(0, 70) + '…' : c.msg) : ''), ...(list.length > 1 ? [el('span', ' +' + (list.length - 1) + ' more')] : [])); td.title = list.map((x) => (x.name || checkName(x.id)) + (x.msg ? ': ' + x.msg : '')).join(String.fromCharCode(10)); }
  else if (r.status === 'fail') td.append(el('span', 'No reason was saved: build again.'));
  td.dataset.sort = td.textContent;
  return td;
}

function renderFinalTable() {
  const last = FB.data?.last;
  const tbl = $('btable');
  if (window.dtDestroy) window.dtDestroy(tbl);
  tbl.innerHTML = '';
  if (!last) return;
  const st = $('bfstatus').value, ty = $('bftype').value;
  const rows = last.results.filter((r) => (!st || r.status === st) && (!ty || r.type === ty));
  const head = el('tr');
  ['Page', 'Type', 'Status', 'Why', 'Content', 'Before (original)', 'After (updated)', 'Change'].forEach((h) => head.append(el('th', h)));
  tbl.append(head);
  rows.forEach((r) => {
    const tr = el('tr', undefined, 'pick');
    tr.title = 'Double-click to preview';
    const s = el('td'); s.append(el('span', r.status, 'sev ' + ({ fail: 'high', warn: 'medium', pass: 'low', skipped: 'low' }[r.status])));
    const sc = (n) => { const td = el('td'); td.dataset.sort = n == null ? '-1' : String(n); td.append(el('span', n == null ? '–' : String(n), 'sv-score ' + scoreCls(n))); return td; };
    const dl = el('td', r.delta == null ? '–' : (r.delta > 0 ? '+' : '') + r.delta); dl.dataset.sort = r.delta == null ? '-999' : String(r.delta);
    if (r.delta != null) dl.className = r.delta > 0 ? 'fb-up' : r.delta < 0 ? 'fb-down' : '';
    tr.append(el('td', r.path), el('td', r.type), s, whyCell(r), el('td', (r.ai ? r.ai.replace(':', ' · ') : 'existing wording') + (r.ai && r.words?.before ? ` · ${r.words.after >= r.words.before ? '+' : ''}${Math.round((100 * (r.words.after - r.words.before)) / r.words.before)}% words` : '')), sc(r.before), sc(r.after), dl);
    tr.ondblclick = () => openFinalDetail(r.path);
    tr.onkeydown = (e) => { if (e.key === 'Enter') openFinalDetail(r.path); };
    tr.tabIndex = 0;
    tbl.append(tr);
  });
  if (window.dtRefresh) window.dtRefresh(tbl);
}
$('bfstatus').onchange = $('bftype').onchange = renderFinalTable;

// ---- the preview popup: same controls as the Template design preview, plus the SEO score breakup ----
function fbShow(m) {
  FB.show = m;
  document.querySelectorAll('#fb-show button').forEach((b) => b.classList.toggle('on', b.dataset.show === m));
  $('fb-compare').classList.toggle('only-new', m === 'new');
  $('fb-compare').classList.toggle('only-orig', m === 'orig');
}
$('fb-show').onclick = (e) => { const b = e.target.closest('button'); if (b) fbShow(b.dataset.show); };
$('fb-dev').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#fb-dev button').forEach((x) => x.classList.toggle('on', x === b));
  $('fb-fo').style.width = $('fb-fn').style.width = b.dataset.w;
};
$('fb-close').onclick = () => $('fb-dlg').close();

// ---- what to do about a page: build it again, use it anyway, keep the original ----
const rebuildMsg = (r) => (r.now === 'fail' ? `Still failing: ${r.reasons?.[0]?.name || 'a check'}. The reason is shown on the page.` : `Page built again: now ${r.now}${r.written ? ' and written to your website folder' : ''}`);
async function pageAction(btn, path, call, okMsg) {
  await busy(btn, async () => {
    let r;
    try { r = await call(); } catch (e) { toast(e.message, true); return; }
    toast(okMsg(r), r?.now === 'fail');
    FB.data = await fbApi('');
    renderFinal();
    if ($('fb-dlg').open && $('fb-title').textContent === path) openFinalDetail(path);
  });
}
// the buttons for one page; item = { path, status, decision, reasons, canUse }, rewrite = the AI wording failed its checks
function pageButtons(item, { rewrite = false } = {}) {
  const box = el('div', undefined, 'attn-actions');
  const mk = (label, cls, fn) => { const b = el('button', label, 'btn sm2 ' + cls); b.type = 'button'; b.onclick = () => fn(b); box.append(b); return b; };
  const names = (item.reasons || []).map((x) => x.name).join(', ');
  mk('Build this page again', 'ghost', (b) => pageAction(b, item.path, () => fbApi('/page/rebuild', { method: 'POST', body: { path: item.path } }), rebuildMsg));
  if (rewrite) mk('Write the wording again (AI)', 'ghost', (b) => { if (!confirm('The AI will write the wording of this page again (a few cents), then the page is built again.\n\nContinue?')) return; return pageAction(b, item.path, () => fbApi('/page/rebuild', { method: 'POST', body: { path: item.path, rewrite: true } }), rebuildMsg); });
  if (item.decision) mk('Undo my choice', 'ghost', (b) => pageAction(b, item.path, () => fbApi('/page/decide', { method: 'POST', body: { path: item.path, decision: 'clear' } }), () => 'Back to automatic'));
  else {
    if (item.canUse) mk('Use the new page anyway', 'ghost', (b) => { if (!confirm(`Use the new page although it failed${names ? ` (${names})` : ''}?\n\n${FB.data?.last?.mode === 'all' ? 'It is written into your website folder now.' : 'It is used the next time you build all pages.'} You can undo this choice.`)) return; return pageAction(b, item.path, () => fbApi('/page/decide', { method: 'POST', body: { path: item.path, decision: 'use' } }), (r) => `The new page is used${r.writtenToSite ? ' and written to your website folder' : ''}`); });
    mk('Keep the original page', 'ghost', (b) => pageAction(b, item.path, () => fbApi('/page/decide', { method: 'POST', body: { path: item.path, decision: 'keep' } }), () => 'The original page is kept'));
  }
  return box;
}

async function renderAttention() {
  const card = $('fb-attn');
  let a;
  try { a = await fbApi('/attention'); } catch { card.hidden = true; return; }
  const open = a.items.filter((i) => !i.decision);
  const wd = a.wording;
  const wordingOpen = Boolean(wd && (wd.waiting || wd.needsReview));
  card.hidden = !a.items.length && !a.seo?.length && !a.content?.length && !wordingOpen;
  if (card.hidden) return;
  $('fb-attn-note').textContent = open.length || a.seo?.length || a.content?.length
    ? `${a.counts.fail} page(s) failed a check and keep their original file, ${a.counts.skipped} page(s) were left as they are, ${a.counts.decided} page(s) have your choice. Each page shows the reason and what you can do.`
    : `All ${a.counts.decided} page(s) that failed have your choice.`;
  $('fb-attn-retry').hidden = !a.counts.fail;
  const list = $('fb-attn-list'); list.innerHTML = '';
  if (wordingOpen) {
    const box = el('div', undefined, 'attn-item');
    box.append(el('b', `${wd.waiting} page(s) have AI wording you have not looked at${wd.needsReview ? `, ${wd.needsReview} failed a check and keep their own wording` : ''}`));
    box.append(el('p', wd.hold ? 'A full build publishes only wording you approved, so these pages keep their own wording until you approve them.' : 'This wording is already part of the build. Approving only records that you have read it; "Hold AI wording until I approve it" in More options makes a full build wait for you.', 'fb-fixhint'));
    const row = el('div', undefined, 'attn-actions');
    if (wd.waitingClean) { const b = el('button', `Approve the ${wd.waitingClean} that passed every check`, 'btn sm2'); b.type = 'button'; b.onclick = () => busy(b, async () => { try { const r = await fbApi('/wording/approve-checked', { method: 'POST' }); toast(`${r.approved} page(s) approved`); } catch (err) { toast(err.message, true); } renderAttention(); refreshPlan(); }); row.append(b); }
    box.append(row);
    list.append(box);
  }
  if (a.content?.length) {
    const box = el('div', undefined, 'attn-item');
    box.append(el('b', `${a.content.length} page(s) could not get new wording from the AI`));
    a.content.slice(0, 20).forEach((c) => box.append(Object.assign(el('div', undefined, 'attn-reason'), { innerHTML: `<b>${fbEsc(c.path)}</b><small>${fbEsc(c.error)}</small>` })));
    box.append(el('p', 'These pages kept their existing wording. Start the build again to write only the missing ones (finished pages are not paid for twice).', 'fb-fixhint'));
    list.append(box);
  }
  if (a.seo?.length) {
    const box = el('div', undefined, 'attn-item');
    box.append(el('b', `${a.seo.length} title or description could not be fixed automatically`));
    a.seo.slice(0, 20).forEach((s) => box.append(Object.assign(el('div', undefined, 'attn-reason warn'), { innerHTML: `<b>${fbEsc(s.path || '')}</b><small>${fbEsc(s.why || s.problem || s.reason || JSON.stringify(s))}</small>` })));
    box.append(el('p', 'Open the page in the table and write the title or description yourself in "Review title, description and heading".', 'fb-fixhint'));
    list.append(box);
  }
  a.items.forEach((it) => {
    const box = el('div', undefined, 'attn-item' + (it.decision ? ' decided' : ''));
    const head = el('div', undefined, 'attn-head');
    head.append(el('b', it.path), el('span', it.status, 'sev ' + ({ fail: 'high', warn: 'medium', skipped: 'low' }[it.status] || 'low')));
    if (it.decision === 'keep') head.append(el('span', 'original kept by you', 'badge draft'));
    if (it.decision === 'use') head.append(el('span', 'new page used by you', 'badge approved'));
    const open2 = el('button', 'Open and compare', 'btn ghost sm2'); open2.type = 'button'; open2.onclick = () => openFinalDetail(it.path);
    head.append(open2);
    box.append(head);
    (it.reasons || []).forEach((r) => box.append(Object.assign(el('div', undefined, 'attn-reason ' + (r.level === 'fail' ? '' : 'warn')), { innerHTML: `<b>${fbEsc(r.name)}</b>${r.msg ? `: ${fbEsc(r.msg)}` : ''}<small>${fbEsc(r.fix || '')}</small>` })));
    if (it.canRebuild) box.append(pageButtons(it));
    list.append(box);
  });
}
$('fb-attn-retry').onclick = (e) => busy(e.target, async () => {
  try {
    const r = await fbApi('/pages/rebuild-failed', { method: 'POST' });
    toast(`${r.fixed} of ${r.tried} failed page(s) now pass${r.tried - r.fixed ? `. ${r.tried - r.fixed} still fail; the reason is shown for each.` : ''}`, r.fixed < r.tried);
  } catch (err) { toast(err.message, true); }
  FB.data = await fbApi(''); renderFinal();
});

// ---- what the AI changed on a page ----
const WORDING_STATE = { generated: 'waiting for your review', approved: 'approved by you', rejected: 'the original wording is kept (your choice)', 'needs-review': 'failed a check, so the original wording is used' };
// the words that differ, marked in both texts (a plain longest-common-words comparison)
function wordDiff(a, b) {
  const x = String(a).split(' ').filter(Boolean), y = String(b).split(' ').filter(Boolean);
  const out = (words, mark) => { const f = document.createDocumentFragment(); words.forEach(([w, k]) => { f.append(k === 'same' ? document.createTextNode(w + ' ') : Object.assign(document.createElement(mark), { textContent: w + ' ' })); }); return f; };
  if (x.length * y.length > 250000) return { before: out(x.map((w) => [w, 'same']), 'del'), after: out(y.map((w) => [w, 'same']), 'ins') };
  const n = x.length, m = y.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const bw = [], aw = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { bw.push([x[i], 'same']); aw.push([y[j], 'same']); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { bw.push([x[i], 'x']); i++; }
    else { aw.push([y[j], 'x']); j++; }
  }
  for (; i < n; i++) bw.push([x[i], 'x']);
  for (; j < m; j++) aw.push([y[j], 'x']);
  return { before: out(bw, 'del'), after: out(aw, 'ins') };
}
function renderWording(side, d) {
  const w = d.wording;
  if (!w) return;
  side.append(el('h3', 'What the AI changed'));
  side.append(el('p', `${MODE_NAME[w.mode] || w.mode} · ${WORDING_STATE[w.status] || w.status} · ${w.changes.length} edit(s)${w.summary?.rejected ? `, ${w.summary.rejected} more refused by the safety checks` : ''}${w.cost ? ` · $${w.cost.toFixed(3)}` : ''}`, 'hint'));
  const pair = (label, a, b) => {
    const box = el('div', undefined, 'wd-pair');
    const df = wordDiff(a, b);
    const left = el('div', undefined, 'wd-before'), right = el('div', undefined, 'wd-after');
    left.append(el('small', label + ' · before'), df.before); right.append(el('small', label + ' · after'), df.after);
    box.append(left, right);
    side.append(box);
  };
  if (w.title.after && w.title.after !== w.title.before) pair('Title', w.title.before, w.title.after);
  w.changes.slice(0, 40).forEach((c) => pair(c.kind === 'text' ? 'Text' : 'Paragraph', c.before, c.after));
  if (w.changes.length > 40) side.append(el('p', `…and ${w.changes.length - 40} more edits.`, 'hint'));
  if (!w.changes.length && !w.inPlace) side.append(el('p', 'This page was written new for the template. Compare the original and the new page side by side in the preview above.', 'hint'));
  if (w.rejected.length) {
    side.append(el('h3', 'Edits the safety checks refused'));
    w.rejected.forEach((r) => { const b = el('div', undefined, 'qa-issue warn'); b.append(el('b', r.reason || 'Refused'), el('small', ' ' + r.after.slice(0, 160))); side.append(b); });
  }
  (w.duplicates || []).filter((x) => x.after >= 0.5).forEach((x) => side.append(el('div', `Still ${Math.round(x.after * 100)}% the same as ${x.path} (was ${Math.round(x.before * 100)}%).`, 'qa-issue warn')));
  (w.issues || []).forEach((i) => side.append(el('div', i.msg, 'qa-issue ' + (i.level === 'fail' ? 'error' : 'warn'))));
  const row = el('div', undefined, 'attn-actions');
  const act = (label, cls, action, ok) => { const b = el('button', label, 'btn sm2 ' + cls); b.type = 'button'; b.onclick = () => pageAction(b, d.path, () => fbApi('/page/wording', { method: 'POST', body: { path: d.path, action } }), () => ok); row.append(b); };
  if (w.status !== 'approved') act('Approve this wording', '', 'approve', 'Wording approved');
  if (w.status !== 'rejected') act('Use the original wording', 'ghost', 'original', 'The page keeps its original wording');
  if (w.status === 'approved' || w.status === 'rejected') act('Back to waiting for review', 'ghost', 'undo', 'Back to waiting for review');
  side.append(row);
}

// plain names for the build's own pass/fail checks
const CHECK_NAME = {
  title: 'Page title', 'meta-desc': 'Meta description', canonical: 'Canonical address', h1: 'Main heading (H1)', phones: 'Phone links', tracking: 'Tracking codes', php: 'PHP code',
  'form-intact': 'Form', 'head-scripts': 'Scripts in the page head', 'content-text': 'Page text kept', 'content-links': 'Links kept', 'content-images': 'Images kept',
  'schema-valid': 'Structured data valid', 'schema-present': 'Structured data present', 'img-alt-attr': 'Image alt attribute', 'img-alt-text': 'Image alt text',
  'img-dimensions': 'Image width and height', 'heading-order': 'Heading order', 'home-text': 'Home page text kept', 'home-links': 'Home page links kept', 'reviews-verbatim': 'Customer reviews kept',
};
const checkName = (id) => CHECK_NAME[id] || (id.startsWith('ai:') ? 'Wording check' : id.replace(/[-_:]+/g, ' ').replace(/^./, (m) => m.toUpperCase()));
// "(most often: Page title on 4 pages, ...)" from the failed pages of a build
const nameOf = (last, id) => { for (const r of last?.results || []) for (const c of r.checks || []) if (c.id === id && c.name) return c.name; return checkName(id); };
function failSummary(last) {
  const count = {};
  for (const r of last?.results || []) if (r.status === 'fail') for (const c of r.checks || []) if (c.level === 'fail') count[c.id] = (count[c.id] || 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${nameOf(last, id)} on ${n}`);
  return top.length ? ` (${top.join('; ')})` : '';
}
// why a page is marked fail or warn: each check that did not pass, with what is wrong
function renderWhy(side, row, d) {
  if (row.status !== 'fail' && row.status !== 'warn') return;
  side.append(el('h3', row.status === 'fail' ? 'Why this page failed' : 'Why this page has warnings'));
  const list = row.checks?.length ? row.checks : (row.issues || []).map((id) => ({ id, level: 'fail', msg: '' }));
  if (!list.length) { side.append(el('p', 'No reason was saved for this page. Build all pages again to see it.', 'hint')); return; }
  list.slice().sort((a, b) => (a.level === 'fail' ? 0 : 1) - (b.level === 'fail' ? 0 : 1)).forEach((c) => {
    const box = el('div', undefined, 'qa-issue ' + (c.level === 'fail' ? 'error' : 'warn'));
    box.append(el('b', c.name || checkName(c.id)), document.createTextNode(c.msg ? `: ${c.msg}` : ''));
    if (c.fix) box.append(el('small', c.fix));
    side.append(box);
  });
  if (row.status === 'fail') side.append(el('p', 'A page that fails keeps its original file. Fix the cause (for example edit the wording or the title below) and build the page again, use the new page anyway, or keep the original.', 'hint'));
  side.append(pageButtons({ path: row.path, status: row.status, decision: row.decision || null, canUse: row.status === 'fail', reasons: list.filter((x) => x.level === 'fail').map((x) => ({ name: x.name || checkName(x.id) })) }, { rewrite: d?.content?.status === 'needs-review' }));
  if (!row.checks?.length) side.append(el('p', 'This result was saved before the reasons were kept: build again to see what is wrong.', 'hint'));
}

async function openFinalDetail(path) {
  const dlg = $('fb-dlg');
  $('fb-title').textContent = path;
  $('fb-badges').innerHTML = '';
  $('fb-side').innerHTML = '<p class="hint">Loading the score breakup…</p>';
  $('fb-fo').src = `/original/${slug}/${path}`;
  $('fb-fn').removeAttribute('src');
  fbShow(FB.show);
  if (!dlg.open) dlg.showModal();
  let d;
  try { d = await fbApi(`/detail?path=${encodeURIComponent(path)}`); } catch (e) { $('fb-side').innerHTML = `<p class="note bad">${fbEsc(e.message)}</p>`; return; }
  const url = `/final/${slug}/${d.outName}/${path}`;
  $('fb-fn').src = url; $('fb-open').href = url;
  const r = d.row;
  const bd = $('fb-badges');
  bd.append(el('span', r.status, 'sev ' + ({ fail: 'high', warn: 'medium', pass: 'low', skipped: 'low' }[r.status])));
  if (r.before != null) bd.append(el('span', `SEO ${r.before} → ${r.after} (${r.delta > 0 ? '+' : ''}${r.delta})`, 'badge ' + (r.delta >= 0 ? 'approved' : 'draft')));
  renderBreakup(d);
  if (r.status !== 'skipped') renderHeadReview($('fb-side'), d.path);
}

// the review of this page's title, meta description and heading: edit, check against the rules, ask the AI to write one again
const HEAD_FIELDS = [['title', 'Title', 1], ['description', 'Meta description', 3], ['h1', 'Main heading (H1)', 2]];
async function renderHeadReview(side, path) {
  const box = el('div', undefined, 'fb-review');
  side.append(el('h3', 'Review title, description and heading'), box);
  let d;
  try { d = await fbApi(`/head?path=${encodeURIComponent(path)}`); } catch (e) { box.append(el('p', e.message, 'hint')); return; }
  box.append(el('p', 'Change the wording yourself, or ask the AI to write one field again. Wording you save is kept: later builds use it and never replace it.', 'hint'));
  const inputs = {};
  const status = el('p', '', 'hint');
  const lim = d.limits;
  const rangeText = (f) => (f === 'title' ? `${lim.title[0]}-${lim.title[1]} characters` : f === 'description' ? `${lim.descriptionTarget[0]}-${lim.descriptionTarget[1]} characters` : `up to ${lim.h1[1]} characters`);
  const paint = (f, problems) => { inputs[f].note.replaceChildren(...(problems.length ? problems.map((x) => el('div', x, 'note bad')) : [el('div', 'This wording meets the rules.', 'note ok')])); };
  for (const [f, label, rows] of HEAD_FIELDS) {
    const wrap = el('div', undefined, 'f');
    const lab = el('label', label); lab.append(el('small', ` ${rangeText(f)}${d.manual[f] ? ' · your own wording' : ''}`));
    const input = rows === 1 ? document.createElement('input') : Object.assign(document.createElement('textarea'), { rows });
    input.value = d.values[f] || '';
    const count = el('small', '', 'hint'); const upd = () => { count.textContent = `${input.value.trim().length} characters`; }; upd(); input.oninput = upd;
    const orig = el('small', `Original: ${d.original[f] || '(none)'}`, 'hint');
    const note = el('div');
    const ask = el('input'); ask.placeholder = 'What should it say? (optional)'; ask.style.marginTop = '4px';
    const bCheck = el('button', 'Check', 'btn ghost sm2'), bAi = el('button', 'Ask the AI to write it', 'btn ghost sm2');
    bCheck.type = bAi.type = 'button';
    bCheck.onclick = () => busy(bCheck, async () => { try { const r = await fbApi('/head/check', { method: 'POST', body: { path, values: { [f]: input.value } } }); paint(f, r.problems[f]); } catch (e) { toast(e.message, true); } });
    bAi.onclick = () => busy(bAi, async () => { try { const r = await fbApi('/head/rewrite', { method: 'POST', body: { path, field: f, instruction: ask.value, value: input.value } }); input.value = r.value; upd(); paint(f, r.problems); } catch (e) { toast(e.message, true); } });
    const row = el('div', undefined, 'row'); row.style.gap = '6px'; row.append(bCheck, bAi);
    inputs[f] = { input, note };
    wrap.append(lab, input, count, orig, ask, row, note);
    box.append(wrap);
    paint(f, d.problems[f]);
  }
  const bSave = el('button', 'Save my wording', 'btn sm2'), bBuild = el('button', 'Save and build this page again', 'btn ghost sm2'), bAuto = el('button', 'Go back to automatic wording', 'btn ghost sm2');
  [bSave, bBuild, bAuto].forEach((b) => { b.type = 'button'; b.style.margin = '4px 6px 0 0'; });
  const values = () => Object.fromEntries(HEAD_FIELDS.map(([f]) => [f, inputs[f].input.value]));
  const save = async () => { await fbApi('/head', { method: 'PUT', body: { path, values: values() } }); };
  bSave.onclick = () => busy(bSave, async () => { try { await save(); status.textContent = 'Saved. It is used the next time this page is built.'; toast('Wording saved'); } catch (e) { toast(e.message, true); } });
  bBuild.onclick = () => busy(bBuild, async () => { try { await save(); const r = await fbApi('/head/rebuild', { method: 'POST', body: { path } }); $('fb-fn').src = $('fb-fn').src; status.textContent = r.mode === 'all' ? 'Saved and built again in the build folder. To write it into your website folder, run Build all pages again.' : 'Saved and built again.'; toast('Page built again'); } catch (e) { toast(e.message, true); } });
  bAuto.onclick = () => busy(bAuto, async () => { try { await fbApi(`/head?path=${encodeURIComponent(path)}`, { method: 'DELETE' }); status.textContent = 'Your wording was removed. The next build writes this page automatically.'; toast('Back to automatic'); } catch (e) { toast(e.message, true); } });
  box.append(el('div'), bSave, bBuild, bAuto, status);
}

function renderBreakup(d) {
  const side = $('fb-side');
  side.innerHTML = '';
  const r = d.row;
  renderWhy(side, r, d);
  if (!d.breakup) { side.append(el('p', r.reason ? `This page was skipped: ${r.reason}` : 'This page has no score.', 'hint')); return; }
  const b = d.breakup;
  const big = el('div', undefined, 'fb-big');
  const cell = (label, n) => { const c = el('div'); c.append(el('small', label), el('b', String(n), 'sv-score ' + scoreCls(n))); return c; };
  big.append(cell('Original page', b.before.score), el('span', '→', 'arrow'), cell('Updated page', b.after.score));
  side.append(el('h3', 'SEO score'), big);

  // categories
  side.append(el('h3', 'Score by area'));
  const bars = el('div', undefined, 'fb-cats');
  b.categories.forEach((c) => {
    if (!c.before?.applicable && !c.after?.applicable) return;
    const row = el('div', undefined, 'fb-cat');
    const tr = (n, cls) => { const t = el('div', undefined, 'track'); const i = document.createElement('i'); i.style.width = (n || 0) + '%'; i.className = cls; t.append(i); return t; };
    row.append(el('span', c.name, 'nm'), tr(c.before?.score, 'was'), el('span', String(c.before?.score ?? '–'), 'v'), tr(c.after?.score, 'now'), el('span', String(c.after?.score ?? '–'), 'v'));
    bars.append(row);
  });
  side.append(Object.assign(el('div', undefined, 'fb-legend'), { innerHTML: '<span><i class="was"></i>Original</span><span><i class="now"></i>Updated</span>' }), bars);

  // what changed on the page
  const fa = d.facts;
  if (fa) {
    side.append(el('h3', 'What changed'));
    const t = document.createElement('table'); t.className = 'fb-facts';
    const th = el('tr'); ['', 'Original', 'Updated'].forEach((x) => th.append(el('th', x))); t.append(th);
    const trunc = (s, n = 90) => (String(s).length > n ? String(s).slice(0, n) + '…' : String(s || '–'));
    const rows = [['Title', trunc(fa.before.title), trunc(fa.after.title)], ['Meta description', trunc(fa.before.description, 120), trunc(fa.after.description, 120)], ['Main heading', trunc(fa.before.h1), trunc(fa.after.h1)], ['Words', fa.before.words, fa.after.words],
      ['Images', fa.before.images, fa.after.images], ['WebP images', fa.before.webp, fa.after.webp], ['Responsive (srcset)', fa.before.srcset, fa.after.srcset], ['Lazy-loaded', fa.before.lazy, fa.after.lazy], ['With width and height', fa.before.sized, fa.after.sized],
      ['Structured data', fa.before.schema.join(', ') || 'none', fa.after.schema.join(', ') || 'none'], ['Social tags (of 4)', fa.before.og, fa.after.og], ['HTML size', fa.before.htmlKb + ' KB', fa.after.htmlKb + ' KB']];
    rows.forEach(([k, x, y]) => { const tr = el('tr'); tr.append(el('th', k), el('td', String(x)), el('td', String(y), String(x) !== String(y) ? 'chg' : '')); t.append(tr); });
    side.append(t);
  }

  // every check, before and after
  side.append(el('h3', 'Every check'));
  b.categories.forEach((c) => {
    const rows = c.checks.filter((x) => x.before !== null || x.after !== null);
    if (!rows.length) return;
    const det = document.createElement('details'); det.className = 'fb-group';
    const fixed = rows.filter((x) => x.change === 'fixed').length, worse = rows.filter((x) => x.change === 'worse').length;
    const sum = document.createElement('summary');
    sum.append(el('b', c.name), el('small', `${fixed ? ` · ${fixed} fixed` : ''}${worse ? ` · ${worse} worse` : ''}`));
    det.append(sum);
    det.open = fixed > 0 || worse > 0;
    rows.forEach((x) => {
      const li = el('div', undefined, 'fb-check ' + x.change);
      const mark = (v) => (v === null ? '–' : v ? '✓' : '✕');
      li.append(el('span', mark(x.before), 'm ' + (x.before ? 'ok' : 'bad')), el('span', '→', 'a'), el('span', mark(x.after), 'm ' + (x.after ? 'ok' : 'bad')));
      const tx = el('span', undefined, 't'); tx.append(document.createTextNode(x.label), ...(x.afterMsg ? [Object.assign(el('small'), { textContent: x.afterMsg })] : x.beforeMsg && x.after ? [Object.assign(el('small'), { textContent: 'Was: ' + x.beforeMsg })] : []));
      li.append(tx);
      det.append(li);
    });
    side.append(det);
  });

  renderWording(side, d);
  if (d.content && !d.wording) {
    side.append(el('h3', 'Page wording'));
    const note = el('p', `${MODE_NAME[d.content.mode] || d.content.mode} · ${d.content.status}${d.content.status === 'needs-review' ? '. It failed an automatic check, so this page kept its existing wording.' : ''}`, 'hint');
    side.append(note);
    d.content.issues.forEach((i) => side.append(el('div', i.message || i.msg || String(i.code || ''), 'qa-issue ' + (i.level === 'fail' ? 'error' : 'warn'))));
  }
}
