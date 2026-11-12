const $ = (id) => document.getElementById(id);
const LISTS = ['whatWeDo', 'whatWeDoNot', 'services', 'serviceAreas', 'approvedFacts', 'forbiddenClaims', 'localNotes'];
const TEXTS = ['industry', 'summary', 'tone', 'canonicalDomain', 'brand', 'titleSeparator'];
const FACT_TEXTS = ['businessType', 'street', 'city', 'region', 'postal', 'country', 'priceRange', 'logo', 'shareImage'];
const FACT_LISTS = ['hours', 'sameAs'];
// the values the platform runs on (src/app-settings.js): the business types, how many pages a sample covers
let APP_UI = { businessTypes: ['LocalBusiness'], limits: { samplePages: 10, browserTestPages: 12 } };
function applyAppSettings() {
  document.querySelectorAll('[data-sample-n]').forEach((e) => { e.textContent = APP_UI.limits.samplePages; });
  document.querySelectorAll('[data-browser-n]').forEach((e) => { e.textContent = APP_UI.limits.browserTestPages; });
  const sel = document.getElementById('f_businessType');
  if (sel) {
    const cur = sel.value;
    sel.replaceChildren(...APP_UI.businessTypes.map((t) => new Option(t, t)));
    if (cur && !APP_UI.businessTypes.includes(cur)) sel.append(new Option(cur, cur));
    if (cur) sel.value = cur;
  }
}
fetch('/api/app-settings').then((r) => r.json()).then((r) => { APP_UI = r; applyAppSettings(); }).catch(() => {});
const NAP = ['name', 'phone', 'address'];
let slug = '', profileSource = 'manual', profileUrl = '', scanData = null, toastTimer;

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) });
  // a server that answers with a web page and not with data is not running this version of the screens (for example a portal that was
  // started before an update and never restarted): say so, instead of failing on the first "<" of the page
  if (!/json/i.test(res.headers.get('content-type') || '')) {
    const text = await res.text().catch(() => '');
    if (res.status === 403) throw new Error(text.slice(0, 200) || 'The portal refused this request.');
    throw new Error(res.status === 404 ? 'The portal that is running does not have this feature yet. Close it and start it again (npm run portal, or open the new portable file), then try again.' : `The portal gave an unexpected answer (HTTP ${res.status}). Restart it and try again.`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(text, err) {
  const t = $('toast');
  t.textContent = text;
  t.className = err ? 'err' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), err ? 9000 : 4500);
}

async function busy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
}

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

// ---------- activity panels: show whether a long task is running, completed, failed or stopped ----------
const PANEL_BADGE = { running: 'Running', done: 'Completed', failed: 'Failed', stopped: 'Stopped' };
const panels = {};
const fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };

function panel(id) {
  if (panels[id]) return panels[id];
  const box = $(id);
  box.className = 'jp'; box.hidden = true;
  box.innerHTML = '<div class="jp-ic" aria-hidden="true"></div><div class="jp-main"><div class="jp-top"><b class="jp-title"></b><span class="jp-badge"></span><span class="jp-time"></span></div><div class="jp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="jp-meta"><span class="jp-detail"></span><span class="jp-pct"></span></div><div class="jp-stall" hidden></div><div class="jp-errs"></div><div class="jp-log" hidden></div><div class="jp-steps" hidden></div></div><button type="button" class="jp-x" aria-label="Dismiss">×</button>';
  box.setAttribute('role', 'status');
  const q = (s) => box.querySelector(s);
  let tick = null, started = 0, finished = 0, lastKey = '', lastMove = Date.now(), prevState = '', baseTitle = document.title;
  const STALL_MS = 60000;
  const clock = () => {
    if (!started) { q('.jp-time').textContent = ''; return; }
    const running = box.dataset.state === 'running';
    q('.jp-time').textContent = (running ? 'Elapsed ' : 'Took ') + fmtDur((running ? Date.now() : finished || Date.now()) - started);
    // nothing has moved for a while: say so, so a slow answer is not mistaken for a crash
    const still = running && Date.now() - lastMove > STALL_MS;
    const st = q('.jp-stall');
    st.hidden = !still;
    if (still) st.textContent = `Nothing has changed for ${fmtDur(Date.now() - lastMove)}. A slow answer from the AI is normal; press Stop if it stays like this.`;
  };
  q('.jp-x').onclick = () => { box.hidden = true; };
  // clicking the box opens the list of the processes behind the bar, each with its own status and (when failed) a Retry button
  let onRetry = null, stepsKey = '';
  const list = q('.jp-steps');
  const MARK = { done: '✓', failed: '!', running: '', pending: '', skipped: '–' };
  const took = (s) => (s.startedAt && s.finishedAt ? ` · ${fmtDur(Date.parse(s.finishedAt) - Date.parse(s.startedAt))}` : '');
  const STAT = { done: 'Done', failed: 'Failed', running: 'Running', pending: 'Waiting', skipped: 'Not needed' };
  box.addEventListener('click', (ev) => {
    if (!box.classList.contains('has-steps') || ev.target.closest('.jp-x, .jp-steps')) return;
    box.classList.toggle('open'); list.hidden = !box.classList.contains('open');
    if (!box.classList.contains('open') && box.dataset.state !== 'running') q('.jp-log').hidden = true; else if (q('.jp-log').children.length) q('.jp-log').hidden = false;
  });
  const drawSteps = (steps, locked) => {
    const key = JSON.stringify(steps) + locked;
    if (key === stepsKey) return;
    stepsKey = key;
    list.replaceChildren(...steps.map((s) => {
      const row = el('div', undefined, 'jp-step'); row.dataset.status = s.status; row.dataset.id = s.id;
      row.append(el('i', MARK[s.status] || '', 'jp-step-ic'));
      const text = el('div', undefined, 'jp-step-text');
      text.append(el('b', s.label), el('span', (s.error || s.detail || '') + (s.status === 'done' ? took(s) : '')));
      row.append(text, el('em', STAT[s.status] || s.status, 'jp-step-st'));
      if (s.status === 'failed' && onRetry) {
        const b = el('button', 'Retry', 'btn sm'); b.type = 'button'; b.disabled = locked;
        b.onclick = () => onRetry(s.id, b);
        row.append(b);
      }
      return row;
    }));
  };
  return (panels[id] = {
    // state: running | done | failed | stopped. pct (0-100) overrides done/total; no total = animated indeterminate bar.
    set({ state, title, detail = '', done = 0, total = 0, pct, startedAt, finishedAt, errors = [], steps, retry, log }) {
      box.hidden = false; box.dataset.state = state;
      const key = state + '|' + done + '|' + total + '|' + detail + '|' + (pct ?? '') + '|' + (log?.length || 0);
      if (key !== lastKey) { lastKey = key; lastMove = Date.now(); }
      // a long job ends while the window is in the background: tell the person
      if (prevState === 'running' && state !== 'running' && (document.hidden || !document.hasFocus())) {
        try { if (window.Notification && Notification.permission === 'granted') new Notification(title, { body: PANEL_BADGE[state] + (detail ? ': ' + detail : '') }); else if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { /* notifications are optional */ }
      }
      prevState = state;
      if (state === 'running' && window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch { /* optional */ } }
      onRetry = retry || null;
      box.classList.toggle('has-steps', Boolean(steps?.length));
      if (steps?.length) drawSteps(steps, state === 'running'); else { box.classList.remove('open'); list.hidden = true; }
      started = startedAt ? Date.parse(startedAt) : started || Date.now();
      finished = finishedAt ? Date.parse(finishedAt) : state === 'running' ? 0 : finished || Date.now();
      q('.jp-title').textContent = title;
      q('.jp-badge').textContent = PANEL_BADGE[state];
      const known = pct !== undefined || total > 0;
      let p = pct !== undefined ? pct : total > 0 ? (done / total) * 100 : 0;
      p = state === 'done' ? 100 : Math.max(0, Math.min(100, Math.round(p)));
      const bar = q('.jp-bar');
      bar.classList.toggle('indeterminate', state === 'running' && !known);
      bar.firstElementChild.style.width = state === 'running' && !known ? '' : p + '%';
      bar.setAttribute('aria-valuenow', String(p));
      let d = detail;
      if (state === 'running' && known && p > 3 && p < 100 && started) d += (d ? ' · ' : '') + 'about ' + fmtDur(((Date.now() - started) / p) * (100 - p)) + ' left';
      q('.jp-detail').textContent = d;
      q('.jp-pct').textContent = known || state === 'done' ? p + '%' : '';
      // the tab title shows the progress too
      document.title = state === 'running' && known ? `(${p}%) ${title} · ${baseTitle}` : baseTitle;
      // the latest things that happened: a few lines while running, all of them when the box is opened
      const lg = q('.jp-log');
      const lines = (log || []);
      lg.hidden = !lines.length || (state !== 'running' && !box.classList.contains('open'));
      lg.replaceChildren(...(state === 'running' && !box.classList.contains('open') ? lines.slice(-5) : lines.slice(-40)).map((l) => { const row = el('div', undefined, 'jp-log-' + (l.level || 'info')); row.append(el('time', new Date(l.at).toLocaleTimeString()), document.createTextNode(l.text)); return row; }));
      lg.scrollTop = lg.scrollHeight;
      const errBox = q('.jp-errs');
      errBox.replaceChildren(...errors.slice(0, 5).map((e) => el('div', e)), ...(errors.length > 5 ? [el('div', `…and ${errors.length - 5} more`)] : []));
      clearInterval(tick);
      clock();
      if (state === 'running') tick = setInterval(clock, 1000);
    },
    hide() { box.hidden = true; clearInterval(tick); },
  });
}

// runs a task that finishes in a single request and shows it as running, then completed or failed
async function track(id, title, fn, summary = () => '') {
  const p = panel(id), startedAt = new Date().toISOString();
  p.set({ state: 'running', title, detail: 'Working…', startedAt });
  try {
    const r = await fn();
    p.set({ state: 'done', title, detail: summary(r) || 'Finished', startedAt, finishedAt: new Date().toISOString() });
    return r;
  } catch (e) {
    p.set({ state: 'failed', title, detail: 'The task did not finish.', errors: [e.message], startedAt, finishedAt: new Date().toISOString() });
    throw e;
  }
}

// ---------- Business profile ----------
function fill(p) {
  TEXTS.forEach((k) => ($(k).value = p[k] || ''));
  LISTS.forEach((k) => ($(k).value = (p[k] || []).join('\n')));
  NAP.forEach((k) => ($('nap_' + k).value = p.nap?.[k] || ''));
  if (!$('f_businessType').options.length) APP_UI.businessTypes.forEach((t) => $('f_businessType').append(new Option(t, t)));
  const f = p.facts || {};
  { const sel = $('f_businessType'), v = f.businessType || 'LocalBusiness'; if (![...sel.options].some((o) => o.value === v)) sel.append(new Option(v, v)); }
  FACT_TEXTS.forEach((k) => ($('f_' + k).value = f[k] || (k === 'businessType' ? 'LocalBusiness' : '')));
  FACT_LISTS.forEach((k) => ($('f_' + k).value = (f[k] || []).join('\n')));
  $('titleSeparator').value = p.titleSeparator || '|';
  $('canonicalDomain').placeholder = p.suggestedDomain ? `Not set: ${p.suggestedDomain} is used` : 'https://www.example.com';
  profileSource = p.source || 'manual';
  profileUrl = p.sourceUrl || '';
}

function collect() {
  const o = { source: profileSource, sourceUrl: profileUrl, nap: {} };
  TEXTS.forEach((k) => (o[k] = $(k).value));
  LISTS.forEach((k) => (o[k] = $(k).value.split('\n')));
  NAP.forEach((k) => (o.nap[k] = $('nap_' + k).value));
  o.facts = {};
  FACT_TEXTS.forEach((k) => (o.facts[k] = $('f_' + k).value));
  FACT_LISTS.forEach((k) => (o.facts[k] = $('f_' + k).value.split('\n')));
  return o;
}

function setStatus(p) {
  const label = { empty: 'Not started', draft: 'Draft — needs approval', approved: 'Approved' }[p.status];
  $('pbadge').textContent = label;
  $('pbadge').className = 'badge ' + p.status;
  $('pstatus').className = 'dot ' + ({ approved: 'ok', draft: 'warn' }[p.status] || '');
  $('stamp').textContent = p.status === 'approved' ? 'Approved ' + new Date(p.approvedAt).toLocaleString()
    : p.updatedAt ? 'Last saved ' + new Date(p.updatedAt).toLocaleString() : '';
}

async function loadProfile() {
  const p = await api(`/api/clients/${slug}/profile`);
  fill(p);
  setStatus(p);
  $('fetchnote').innerHTML = '';
}

function setMode(url) {
  $('mode-url').classList.toggle('on', url);
  $('mode-manual').classList.toggle('on', !url);
  $('urlbox').hidden = !url;
  if (url) $('url').focus();
}
$('mode-manual').onclick = () => setMode(false);
$('mode-url').onclick = () => setMode(true);

$('fetch').onclick = (e) => busy(e.target, async () => {
  e.target.textContent = 'Reading site…';
  try {
    const { draft, pagesRead } = await api(`/api/clients/${slug}/profile/from-url`, { method: 'POST', body: { url: $('url').value } });
    fill(draft);
    const n = $('fetchnote');
    n.innerHTML = '';
    n.append(el('div', `Drafted from ${pagesRead.length} page(s). Review every field, edit what's wrong, then save and approve.` +
      ((draft.uncertain || []).length ? ` Please double-check: ${draft.uncertain.join('; ')}.` : ''), 'note'));
    toast('Draft ready — please review it');
  } finally { e.target.textContent = 'Fetch & draft'; }
});

$('save').onclick = (e) => busy(e.target, async () => {
  setStatus(await api(`/api/clients/${slug}/profile`, { method: 'PUT', body: collect() }));
  toast('Draft saved');
});

$('approve').onclick = (e) => busy(e.target, async () => {
  await api(`/api/clients/${slug}/profile`, { method: 'PUT', body: collect() });
  setStatus(await api(`/api/clients/${slug}/profile/approve`, { method: 'POST' }));
  toast('Profile approved — AI will now write within these rules');
});

// ---------- Audit ----------
// the title and description limits (the server's rules, asked for once)
let RULES = { title: { min: 30, max: 60 }, description: { min: 110, max: 160 } };
fetch('/api/rules').then((r) => r.json()).then((r) => { RULES = r; }).catch(() => {});
const ruleText = (s) => String(s).replace(/\{tmin\}/g, RULES.title.min).replace(/\{tmax\}/g, RULES.title.max).replace(/\{dmin\}/g, RULES.description.min).replace(/\{dmax\}/g, RULES.description.max);
// plain names and explanations of the audit's issue codes
const ISSUE_INFO = {
  'img-alt': ['Image Alt Text', 'Images with no alt text. Search engines and screen readers use it to understand the picture.'],
  'img-dimensions': ['Image Dimensions', 'Images with no width and height set. The page jumps around while it loads, which hurts the experience and the speed score.'],
  'img-legacy-format': ['Image Format (JPG/PNG)', 'Images still in JPG or PNG. Converting them to WebP makes them much smaller and the page faster.'],
  'title-missing': ['Title Missing', 'The page has no title. It is the main text shown for the page in search results.'],
  'title-long': ['Title Too Long', 'The title is longer than {tmax} characters, so search engines cut it off.'],
  'title-short': ['Title Too Short', 'The title is under {tmin} characters, so it does not say enough about the page.'],
  'title-duplicate': ['Duplicate Title', 'Two or more pages share the same title, so search engines cannot tell them apart.'],
  'meta-missing': ['Meta Description Missing', 'The page has no meta description, the summary shown under the title in search results.'],
  'meta-length': ['Meta Description Length', 'The meta description is shorter than {dmin} or longer than {dmax} characters.'],
  'h1-missing': ['H1 Heading Missing', 'The page has no main heading (H1) telling visitors and search engines what it is about.'],
  'h1-multiple': ['Multiple H1 Headings', 'The page has more than one main heading. A page should have exactly one.'],
  'canonical-missing': ['Canonical Missing', 'No canonical tag, which tells search engines the preferred address of the page.'],
  'canonical-offsite': ['Canonical Points Off-site', 'The canonical tag points to another website, so search engines may ignore this page.'],
  'schema-missing': ['Structured Data Missing', 'No structured data (schema), which helps search engines show richer results.'],
  'schema-invalid': ['Invalid Structured Data', 'The structured data on the page is broken and cannot be read by search engines.'],
  'thin-content': ['Thin Content', 'The page has fewer words than expected for its type, so it may not rank well.'],
  'duplicate-content': ['Duplicate Content', 'The page is almost the same as other pages on the site, which can hold its ranking back.'],
  'no-viewport': ['Mobile Viewport Missing', 'No mobile viewport tag, so the page does not fit phone screens properly.'],
  'no-lang': ['Language Not Set', 'The html tag does not declare the page language.'],
  'legacy-jquery': ['Old jQuery Loaded', 'The page loads the jQuery library, a sign of an older design that slows the page.'],
  'many-stylesheets': ['Many Stylesheets', 'The page loads five or more stylesheets, which slows it down.'],
  'no-landmarks': ['Page Layout Landmarks Missing', 'No header, navigation, main and footer sections, which helps accessibility and search engines.'],
  'html-heavy': ['Heavy HTML', 'The page code is over 150 KB, which slows loading.'],
};
const issueName = (c) => ISSUE_INFO[c]?.[0] || c.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const IMG_ISSUES = new Set(['img-alt', 'img-dimensions', 'img-legacy-format']);
function issueCell(code) {
  const td = el('td'), s = el('span', issueName(code), 'issue-tip');
  s.dataset.tip = ruleText(ISSUE_INFO[code]?.[1] || '');
  td.append(s);
  return td;
}
(() => {
  const box = () => $('tipbox');
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('.issue-tip');
    if (!t || !t.dataset.tip) return;
    const b = box(); b.textContent = t.dataset.tip; b.classList.add('on');
    const r = t.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight;
    b.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    b.style.top = Math.max(8, r.top - h - 8) + 'px';
  });
  document.addEventListener('mouseout', (e) => { if (e.target.closest?.('.issue-tip')) box().classList.remove('on'); });
})();

function renderAudit() {
  const { summary, pages } = scanData;
  $('stats').innerHTML = '';
  if (!summary) { $('scaninfo').textContent = 'No scan yet — press Re-scan site.'; return; }
  $('scaninfo').textContent = `Last scan ${new Date(summary.scannedAt).toLocaleString()} · ${summary.skipped} backup/report files skipped`;
  for (const [k, v] of [['Pages', summary.pages], ...Object.entries(summary.byType)]) {
    const d = el('div', undefined, 'stat');
    d.append(el('b', v), el('span', k));
    $('stats').append(d);
  }
  const sev = {};
  pages.forEach((p) => p.issues.forEach((i) => (sev[i.code] = i.severity)));
  // once the updated site has been audited the tables compare the two audits: Issue, Severity, Before, After
  const after = scanData.updated?.issues || null;
  Object.assign(sev, scanData.updatedSev || {}, sev);
  const fill = (t, entries) => {
    t.innerHTML = '';
    const head = el('tr');
    head.append(el('th', 'Issue'), el('th', 'Severity'), ...(after ? [el('th', 'Before', 'n'), el('th', 'After', 'n')] : [el('th', 'Pages', 'n')]));
    t.append(head);
    entries.forEach(([code, n]) => {
      const tr = el('tr'), s = el('td');
      s.append(el('span', sev[code] || 'low', 'sev ' + (sev[code] || 'low')));
      tr.append(issueCell(code), s, el('td', n, 'n'));
      if (after) { const a = after[code] || 0, c = el('td', a, 'n'); c.style.fontWeight = '700'; c.style.color = a < n ? 'var(--ok)' : a > n ? 'var(--bad)' : ''; tr.append(c); }
      t.append(tr);
    });
  };
  const codes = after ? [...new Set([...Object.keys(summary.issues), ...Object.keys(after)])] : Object.keys(summary.issues);
  const all = codes.map((c) => [c, summary.issues[c] || 0]).sort((a, b) => b[1] - a[1] || ((after || {})[b[0]] || 0) - ((after || {})[a[0]] || 0));
  if (after) $('scaninfo').textContent += ` · Updated site audited ${new Date(scanData.updated.scannedAt).toLocaleString()}`;
  // the site files changed after the last audit of the updated site: the numbers in After are out of date
  const stale = scanData.appliedAt && (!after || Date.parse(scanData.appliedAt) > Date.parse(scanData.updated.scannedAt) + 60000);
  if (stale) $('scaninfo').textContent += ` · The website files were updated ${new Date(scanData.appliedAt).toLocaleString()}, ${after ? 'after this audit' : 'and the updated site has not been audited'}: press Audit updated site.`;
  $('scan-updated').classList.toggle('attn', Boolean(stale));
  fill($('issues-img'), all.filter(([c]) => IMG_ISSUES.has(c)));
  fill($('issues-content'), all.filter(([c]) => !IMG_ISSUES.has(c)));
  $('issues-img-card').hidden = !siteOptions.images;
  $('issues-content-card').hidden = !siteOptions.template && !siteOptions.content;
  const saved = savedFilter();
  const keepIssue = $('fissue').value || saved.issue || '', keepType = $('ftype').value || saved.type || '';
  $('ftype').length = 1; $('fissue').length = 1;
  Object.keys(summary.byType).forEach((x) => $('ftype').add(new Option(x, x)));
  $('ftype').value = keepType;
  $('fissue').add(new Option('No issues', '__none'));
  for (const [label, test] of [['Image issues', (c) => IMG_ISSUES.has(c)], ['Content issues', (c) => !IMG_ISSUES.has(c)]]) {
    const codes = [...new Set([...Object.keys(summary.issues), ...Object.keys(scanData.updated?.issues || {})])].filter(test).sort((x, y) => issueName(x).localeCompare(issueName(y)));
    if (!codes.length) continue;
    const g = document.createElement('optgroup'); g.label = label;
    codes.forEach((x) => {
      const st = issueStats(x);
      g.append(new Option(scanData.updatedPages ? `${issueName(x)} (open ${st.open}, fixed ${st.fixed}${st.fresh ? `, new ${st.fresh}` : ''})` : `${issueName(x)} (${summary.issues[x]})`, x));
    });
    $('fissue').append(g);
  }
  $('fissue').value = keepIssue;
  renderPages();
}

// what is left of a page's issues once the updated site has been audited: still open, fixed, and new since the update
function pageState(p) {
  const before = p.issues.map((x) => x.code), now = scanData.updatedPages?.[p.path];
  if (!now) return { open: before, fixed: [], fresh: new Set(), audited: false };
  return { open: now, fixed: before.filter((c) => !now.includes(c)), fresh: new Set(now.filter((c) => !before.includes(c))), audited: true };
}
function issueStats(code) {
  const st = { open: 0, fixed: 0, fresh: 0 };
  for (const p of scanData.pages) { const s = pageState(p); if (s.open.includes(code)) st.open += 1; if (s.fixed.includes(code)) st.fixed += 1; if (s.fresh.has(code)) st.fresh += 1; }
  return st;
}

function renderPages() {
  const t = $('ftype').value, i = $('fissue').value, upd = Boolean(scanData.updatedPages);
  const rows = scanData.pages.filter((p) => {
    if (t && p.type !== t) return false;
    if (!i) return true;
    const s = pageState(p);
    return i === '__none' ? !s.open.length : s.open.includes(i) || s.fixed.includes(i);
  });
  const tbl = $('pages');
  tbl.innerHTML = '';
  const head = el('tr');
  head.append(el('th', 'Path'), el('th', 'Type'), el('th', 'Words', 'n'), el('th', 'Issues'), ...(upd ? [el('th', 'Fixed')] : []));
  tbl.append(head);
  rows.forEach((p) => {
    const tr = el('tr');
    const s = pageState(p), open = el('td');
    s.open.forEach((c, n) => {
      if (n) open.append(', ');
      const sp = el('span', issueName(c));
      if (s.fresh.has(c)) { sp.style.fontWeight = '700'; sp.style.color = 'var(--bad)'; sp.title = 'New since the update'; }
      open.append(sp);
    });
    const pathTd = el('td', p.path + ' '), cmpLink = el('a', 'compare'); cmpLink.href = '#'; cmpLink.onclick = (ev) => { ev.preventDefault(); openCompare(p.path); }; pathTd.append(cmpLink);
    tr.append(pathTd, el('td', p.type), el('td', p.wordCount, 'n'), open);
    if (upd) tr.append(el('td', s.fixed.map(issueName).join(', ')));
    tbl.append(tr);
  });
  if (rows.length > 300) { const tr = el('tr'), c = el('td', `… ${rows.length - 300} more (use the filters)`); c.colSpan = upd ? 5 : 4; tr.append(c); tbl.append(tr); }
}

// ---------- Deeper checks ----------
let deeper = null;
const shortList = (list, n = 3) => (list.length > n ? `${list.slice(0, n).join(', ')} +${list.length - n} more` : list.join(', '));
function renderDeeper() {
  const box = $('deeper-stats'), cols = $('deeper-cols');
  box.innerHTML = '';
  const b = deeper?.before, a = deeper?.after, d = a || b;
  cols.hidden = !d;
  if (!d) { $('deeper-note').textContent = 'Not run yet. Press Run deeper checks.'; return; }
  $('deeper-note').textContent = a ? 'Results for the updated site (the figures in brackets are before the update).' : 'Results for the original pages. Audit the updated site, then run these again to compare.';
  const cmp = (get) => (a && b ? `${get(a)} (was ${get(b)})` : String(get(d)));
  const stat2 = (label, get) => { const x = el('div', undefined, 'stat'); x.append(el('b', cmp(get)), el('span', label)); box.append(x); };
  const hasContent = Boolean(d.duplicates);
  if (hasContent) {
    stat2('Duplicate groups', (x) => x.duplicates.length);
    stat2('Pages with no links in', (x) => x.links.orphans.length);
    stat2('Broken internal links', (x) => x.links.brokenTotal);
    stat2('Keyword overlaps', (x) => x.keywords.length);
  }
  if (d.accessibility) stat2('Accessibility problems', (x) => x.accessibility.reduce((n, r) => n + r.problems.reduce((m, p) => m + p.count, 0), 0));
  const table = (id, headers, rows) => {
    const t = $(id); t.innerHTML = '';
    const h = el('tr'); headers.forEach(([x, num]) => h.append(el('th', x, num ? 'n' : undefined))); t.append(h);
    rows.forEach((cells) => { const tr = el('tr'); cells.forEach((c, i) => { const td = el('td', c.text ?? c, headers[i][1] ? 'n' : undefined); if (c.title) td.title = c.title; tr.append(td); }); t.append(tr); });
  };
  ['dp-dup', 'dp-kw', 'dp-links', 'dp-broken'].forEach((id) => { $(id).hidden = !hasContent; });
  if (hasContent) {
    table('dp-dup-t', [['Pages in the group'], ['Pages', 1], ['Most alike', 1]], d.duplicates.map((g) => [{ text: shortList(g.pages), title: g.pages.join('\n') }, g.pages.length, Math.round(g.max * 100) + '%']));
    table('dp-kw-t', [['Keyword'], ['Matched on'], ['Pages']], d.keywords.map((g) => [g.keyword, g.on, { text: shortList(g.pages), title: g.pages.join('\n') }]));
    table('dp-links-t', [['Page'], ['Links in', 1], ['Links out', 1]], d.links.pages.map((r) => [r.path, r.inbound, r.outbound]));
    table('dp-broken-t', [['On page'], ['Links to'], ['Link text']], d.links.broken.map((x) => [x.from, x.to, x.text]));
  }
  $('dp-a11y').hidden = !d.accessibility;
  if (d.accessibility) table('dp-a11y-t', [['Page'], ['Problems', 1], ['What']], d.accessibility.filter((r) => r.problems.length).map((r) => [r.path, r.problems.reduce((n, p) => n + p.count, 0), r.problems.map((p) => `${p.label} (${p.count})`).join('; ')]));
}
$('deeper-run').onclick = (e) => busy(e.target, async () => {
  e.target.textContent = 'Checking…';
  try { deeper = await api(`/api/clients/${slug}/insights`, { method: 'POST' }); renderDeeper(); toast('Deeper checks done'); }
  finally { e.target.textContent = 'Run deeper checks'; }
});

async function loadAudit() { scanData = await api(`/api/clients/${slug}/scan`); renderAudit(); try { deeper = await api(`/api/clients/${slug}/insights`); } catch { deeper = null; } renderDeeper(); }
$('scan').onclick = (e) => busy(e.target, async () => {
  e.target.textContent = 'Scanning…';
  try { await api(`/api/clients/${slug}/scan`, { method: 'POST' }); await loadAudit(); toast('Scan complete'); refreshSiteStatus(); }
  finally { e.target.textContent = 'Re-scan site'; }
});
// the Pages filters are remembered for each website
const filterKey = () => `audit-filter:${slug}`;
function savedFilter() { try { return JSON.parse(localStorage.getItem(filterKey()) || '{}'); } catch { return {}; } }
$('ftype').onchange = $('fissue').onchange = () => {
  try { localStorage.setItem(filterKey(), JSON.stringify({ type: $('ftype').value, issue: $('fissue').value })); } catch { /* storage unavailable: the filter just is not remembered */ }
  renderPages();
};
$('scan-updated').onclick = (e) => busy(e.target, async () => {
  e.target.textContent = 'Auditing…';
  try { await api(`/api/clients/${slug}/scan/updated`, { method: 'POST' }); await loadAudit(); toast('Updated site audited'); }
  finally { e.target.textContent = 'Audit updated site'; }
});

// ---------- Settings ----------
function showSettings(s, models) {
  $('kbadge').textContent = s.hasKey ? 'Key saved' : 'No key';
  $('kbadge').className = 'badge ' + (s.hasKey ? 'approved' : 'empty');
  $('kstatus').className = 'dot ' + (s.hasKey ? 'ok' : 'warn');
  $('keyhint').textContent = s.hasKey ? `Saved key: ${s.keyHint} — leave blank to keep it` : 'No key saved yet. AI features are disabled until you add one.';
  $('apikey').value = '';
  if (models) {
    $('model').innerHTML = '';
    models.forEach((m) => $('model').add(new Option(m.label, m.id)));
  }
  if (![...$('model').options].some((o) => o.value === s.model)) $('model').add(new Option(s.model, s.model));
  $('model').value = s.model;
}

function testResult(ok, text) {
  const r = $('testresult');
  r.innerHTML = '';
  r.append(el('div', text, ok ? 'note ok' : 'note bad'));
}

async function runTest() {
  try { await api('/api/settings/test', { method: 'POST' }); testResult(true, 'Connected to Claude successfully.'); }
  catch (e) { testResult(false, e.message); }
}

$('savesettings').onclick = (e) => busy(e.target, async () => {
  const body = { model: $('model').value };
  if ($('apikey').value.trim()) body.apiKey = $('apikey').value;
  await api('/api/settings', { method: 'PUT', body });
  // Re-read from the server so the screen shows what was actually persisted.
  const saved = await api('/api/settings');
  showSettings(saved);
  toast(saved.hasKey ? 'Settings saved' : 'Model saved — no API key yet');
  if (saved.hasKey) await runTest();
});
$('testkey').onclick = (e) => busy(e.target, async () => { testResult(true, 'Testing…'); await runTest(); });
$('removekey').onclick = (e) => busy(e.target, async () => {
  if (!confirm('Remove the saved API key?')) return;
  showSettings(await api('/api/settings/key', { method: 'DELETE' }));
  $('testresult').innerHTML = '';
  toast('API key removed');
});

// ---------- Images (Step 4: optimise in place, with backup and restore) ----------
// The page has three views: "plan" (What will happen), "live" (results appearing while it runs) and "result" (final table).
let imData = null, imPlan = null, imPoll = null, imLive = [], imView = 'plan', imSlug = '', imAnalysing = false;
const fmtB = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB');
const IM_LABEL = { outside: 'left alone (other pages use it)', convert: 'convert to WebP', recompress: 'recompress', unused: 'move (unused)', preserved: 'keep as supplied', uncertain: 'leave alone', 'keep-gif': 'keep', 'keep-webp': 'already small' };
const imStat = (box, a, b) => { const d = el('div', undefined, 'stat'); d.append(el('b', b), el('span', a)); box.append(d); };
const imCard = (box, count, size, text) => { const d = el('div', undefined, 'stat tri'); d.append(el('b', count), el('strong', size), el('span', text)); box.append(d); };
const plural = (n, w) => `${Number(n).toLocaleString()} ${w}${Number(n) === 1 ? '' : 's'}`;

function setImView(v) {
  imView = v;
  $('im-plan-card').hidden = v !== 'plan' || !imPlan;
  $('im-result-card').hidden = v === 'plan';
  $('im-backups-card').hidden = v !== 'result' || !imData?.backups?.length;
}

async function loadImages(resume = true) {
  if (imSlug !== slug) { imSlug = slug; imPlan = null; imLive = []; imView = 'plan'; }
  imData = await api(`/api/clients/${slug}/images`);
  const s = imData.settings;
  $('im-alt').checked = Boolean(s.aiAlt);
  $('im-q').value = s.quality; $('im-w').value = s.maxWidth; $('im-p').value = s.preserve.join(', ');
  $('im-copy').value = s.copyBackupTo || ''; $('im-bk').checked = Boolean(s.ignoreBackupFolders);
  $('istatus').className = 'dot' + (imData.result ? (imData.result.status === 'ok' ? ' ok' : ' warn') : '');
  renderBackups();
  if (!resume) return;
  const j = await showImageJob(true); // a job from this session (running or finished) takes over the page
  if (!j && imData.result) { renderResult(); setImView('result'); }
  else if (!j) { setImView('plan'); if (document.body.dataset.tab === 'images') imagesOpened(); }
}

// opening the Images step for the first time analyses the site, so the plan is there straight away
function imagesOpened() {
  if (!imData || imAnalysing || imPlan || imView !== 'plan' || !slug) return;
  runAnalyse().catch((e) => toast(e.message, true));
}

const imSettings = () => ({ quality: $('im-q').value, maxWidth: $('im-w').value, preserve: $('im-p').value, copyBackupTo: $('im-copy').value, ignoreBackupFolders: $('im-bk').checked, aiAlt: $('im-alt').checked });
$('im-save').onclick = (e) => busy(e.target, async () => { imData.settings = await api(`/api/clients/${slug}/images/settings`, { method: 'PUT', body: imSettings() }); toast('Settings saved'); });
$('im-settings-toggle').onclick = () => { const c = $('im-settings-card'); c.hidden = !c.hidden; if (!c.hidden) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
$('im-settings-close').onclick = () => { $('im-settings-card').hidden = true; };

// ---- plan: What will happen ----
async function runAnalyse() {
  imAnalysing = true;
  try {
    await track('jp-images', 'Analysing images', async () => {
      await api(`/api/clients/${slug}/images/settings`, { method: 'PUT', body: imSettings() });
      imPlan = await api(`/api/clients/${slug}/images/analyse`, { method: 'POST' });
      renderPlan();
      setImView('plan');
      return imPlan;
    }, (p) => `${plural(p.counts.convert, 'image')} to convert, ${plural(p.counts.recompress, 'image')} to recompress, ${plural(p.counts.unused, 'image')} unused. Review the plan below, then press Start Optimization.`);
  } finally { imAnalysing = false; }
}
$('im-analyse').onclick = (e) => busy(e.target, runAnalyse);

function renderPlan() {
  const p = imPlan;
  $('im-plan-at').textContent = 'Analysed ' + new Date(p.analysedAt).toLocaleTimeString();
  const by = (...st) => p.images.filter((r) => st.includes(r.status));
  const size = (l) => l.reduce((n, r) => n + r.bytes, 0);
  const left = by('preserved', 'uncertain', 'keep-gif', 'keep-webp');
  const refs = by('convert').reduce((n, r) => n + r.refs, 0);
  const box = $('im-plan-stats');
  box.innerHTML = '';
  imCard(box, plural(p.counts.total, 'image'), fmtB(p.bytes.all), 'All images found in the site folder.');
  imCard(box, plural(p.counts.convert, 'image'), fmtB(p.bytes.convert), 'To convert to WebP: JPG and PNG pictures that become much smaller WebP files.');
  imCard(box, plural(p.counts.recompress, 'image'), fmtB(p.bytes.recompress), 'To recompress: heavy WebP files that are re-encoded at a smaller size.');
  imCard(box, plural(p.counts.unused, 'image'), fmtB(p.bytes.unused), 'Unused: no page, style or script uses them. They move to the backup folder.');
  if (p.counts.outside) imCard(box, plural(p.counts.outside, 'image'), fmtB(size(by('outside'))), 'Not touched: the update is limited to the pages you selected, and other pages or shared styles also use these pictures.');
  imCard(box, plural(left.length, 'image'), fmtB(size(left)), 'Left alone: logos, GIFs, small WebP files and images used by code that builds file names at run time.');
  imCard(box, plural(p.rewriteFiles, 'file'), plural(refs, 'reference'), 'To update: pages, styles and scripts whose image links are rewritten to the new files.');
  const w = $('im-warnings');
  w.innerHTML = '';
  p.warnings.forEach((x) => w.append(el('div', x, 'note')));
  if (p.counts.backupOnly) w.append(el('div', `${p.counts.backupOnly} image(s) (${fmtB(p.bytes.backupOnly)}) are used only by old copies in backup/old/archive folders. They are kept unless you tick the option in Settings.`, 'note'));
  renderPlanTable();
}

function renderPlanTable() {
  const t = $('im-plan-table'), f = $('im-f').value;
  t.innerHTML = '';
  const head = el('tr');
  head.append(el('th', 'Image'), el('th', 'Size', 'n'), el('th', 'Used by', 'n'), el('th', 'Plan'));
  t.append(head);
  imPlan.images.filter((r) => !f || r.status === f).forEach((r) => {
    const tr = el('tr');
    tr.append(el('td', r.rel + (r.backupOnly ? '  (old copies only)' : '')), el('td', fmtB(r.bytes), 'n'), el('td', r.refs, 'n'), el('td', IM_LABEL[r.status] || r.status));
    t.append(tr);
  });
}
$('im-f').onchange = () => imPlan && renderPlanTable();

// ---- result rows (shared by the live table and the final table) ----
const IM_RESULT = { converted: ['Converted to WebP', 'approved'], recompressed: ['Recompressed', 'approved'], kept: ['Kept, already small', 'empty'], moved: ['Moved to backup (unused)', 'draft'], error: ['Error', 'bad'] };
const imHead = () => { const tr = el('tr'); tr.append(el('th', 'Filename'), el('th', 'Before size', 'n'), el('th', 'After size', 'n'), el('th', 'Result')); return tr; };

function imRow(e) {
  const tr = el('tr', undefined, 'pick');
  const hasAfter = ['converted', 'recompressed', 'kept'].includes(e.status);
  const name = !e.file || e.orig === e.file ? e.orig : `${e.orig} → ${e.file.split('/').pop()}`;
  const [label, tone] = IM_RESULT[e.status] || [e.status, 'empty'];
  const saved = hasAfter && e.status !== 'kept' && e.origBytes ? Math.round((1 - e.bytes / e.origBytes) * 100) : 0;
  const res = el('td'), b = el('span', label + (saved > 0 ? ` · saved ${saved}%` : ''), 'badge ' + tone);
  if (e.error) b.title = e.error;
  res.append(b);
  tr.append(el('td', name), el('td', fmtB(e.origBytes), 'n'), el('td', hasAfter ? fmtB(e.bytes) : '—', 'n'), res);
  tr.title = 'Double-click to compare the original and optimized image';
  tr.tabIndex = 0;
  tr.ondblclick = () => openImageDialog(e);
  tr.onkeydown = (k) => { if (k.key === 'Enter') openImageDialog(e); };
  return tr;
}

// ---- live: results appear while the job runs ----
function resetLive() {
  imLive = [];
  const t = $('im-result-table');
  window.dtDestroy?.(t);
  t.replaceChildren(imHead());
  $('im-result-title').textContent = 'Optimising images';
  $('im-result-badge').textContent = 'Running';
  $('im-result-badge').className = 'badge draft';
  $('im-result-stats').hidden = true;
  $('im-problems').innerHTML = '';
  setImView('live');
}

function addLiveRows(list) {
  const t = $('im-result-table');
  t.append(...list.map(imRow));
  const wrap = t.closest('.tbl-wrap');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

const IM_PHASES = [['analysing', 'Analysing the site', 5], ['backup', 'Creating and verifying the backup zip', 25], ['optimising', 'Converting and tidying images', 45], ['updating references', 'Updating references in your files', 15], ['updating pages', 'Adding sizes, responsive copies and descriptions to the pages', 15], ['verifying', 'Checking every reference', 10]];

// shows the image job (running, finished or failed); also resumes after a refresh
async function showImageJob(poll) {
  const j = await api(`/api/clients/${slug}/images/job?since=${imLive.length}`).catch(() => null);
  if (!j || j.phase === 'idle') return null;
  if (j.running && imView !== 'live') resetLive();
  if (j.entries?.length) { imLive.push(...j.entries); if (imView === 'live') addLiveRows(j.entries); }
  const p = panel('jp-images'), title = 'Optimising images';
  const idx = IM_PHASES.findIndex(([k]) => k === j.phase);
  if (j.running) {
    const before = IM_PHASES.slice(0, Math.max(0, idx)).reduce((n, x) => n + x[2], 0);
    const within = j.total ? (j.done / j.total) * (IM_PHASES[idx]?.[2] || 0) : 0;
    p.set({ state: 'running', title, detail: `Step ${Math.max(1, idx + 1)} of ${IM_PHASES.length}: ${IM_PHASES[idx]?.[1] || j.phase}${j.total ? ` (${j.done} of ${j.total})` : ''}`, pct: before + within, startedAt: j.startedAt });
    if (poll) { clearInterval(imPoll); imPoll = setInterval(async () => { const r = await showImageJob(false); if (r && !r.running) { clearInterval(imPoll); await finishImageJob(r); } }, 900); }
  } else await finishImageJob(j, true);
  return j;
}

async function finishImageJob(j, quiet) {
  const p = panel('jp-images'), title = 'Optimising images';
  if (j.error) {
    p.set({ state: 'failed', title, detail: 'The optimisation stopped. Your files are safe: restore from the backup below if anything looks wrong.', errors: [j.error], startedAt: j.startedAt, finishedAt: j.finishedAt });
    $('im-result-badge').textContent = 'Failed'; $('im-result-badge').className = 'badge bad';
    if (!quiet) toast(j.error, true);
    await loadImages(false);
    return;
  }
  await loadImages(false);
  renderResult();
  setImView('result');
  const k = imData?.result?.totals;
  const ok = imData?.result?.status === 'ok';
  p.set({ state: ok || !imData?.result ? 'done' : 'failed', title, detail: k ? `${k.processed} images optimised · ${fmtB(k.bytesBefore)} → ${fmtB(k.bytesAfter)} · ${k.unusedFiles} unused moved · ${k.referencesRewritten} references updated` : 'Finished', errors: ok || !imData?.result ? [] : [`${imData.result.problems.length} reference(s) point at a missing file. Review the result below or restore the site from the backup.`], startedAt: j.startedAt, finishedAt: j.finishedAt });
  if (!quiet) toast('Images optimised. The backup is listed below.');
}

$('im-run').onclick = (e) => busy(e.target, async () => {
  if (!confirm('Back up the whole site folder, then convert and tidy the images and update references in place?\n\nNothing is deleted: originals and unused images move into _modernizer-backup, and you can restore everything afterwards.')) return;
  await api(`/api/clients/${slug}/images/settings`, { method: 'PUT', body: imSettings() });
  resetLive();
  panel('jp-images').set({ state: 'running', title: 'Optimising images', detail: 'Starting…', pct: 1 });
  await api(`/api/clients/${slug}/images/run`, { method: 'POST' });
  await showImageJob(true);
});

// ---- result: final table ----
function renderResult() {
  const r = imData.result;
  if (!r) return;
  const k = r.totals, saved = k.bytesBefore ? Math.round((1 - k.bytesAfter / k.bytesBefore) * 100) : 0;
  $('im-result-title').textContent = 'Result';
  $('im-result-badge').textContent = r.status === 'ok' ? 'Completed, no new broken references' : 'Needs attention';
  $('im-result-badge').className = 'badge ' + (r.status === 'ok' ? 'approved' : 'draft');
  const box = $('im-result-stats');
  box.hidden = false;
  box.innerHTML = '';
  imStat(box, 'Images optimised', k.processed);
  imStat(box, 'Before → after', `${fmtB(k.bytesBefore)} → ${fmtB(k.bytesAfter)}`);
  imStat(box, 'Saved', saved + '%');
  imStat(box, 'Responsive copies added', fmtB(k.variantBytes));
  imStat(box, 'Unused images moved', `${k.unusedFiles} · ${fmtB(k.unusedBytes)}`);
  imStat(box, 'References updated', `${k.referencesRewritten} in ${k.filesModified} files`);
  if (k.pagesTagged !== undefined) { imStat(box, 'Pages updated', `${k.pagesTagged} · ${k.srcsetImages} pictures with responsive sizes`); imStat(box, 'Picture sizes and descriptions', `${k.sizeFixed} pages given sizes · ${k.altWritten} descriptions written`); }
  const pr = $('im-problems');
  pr.innerHTML = '';
  if (r.problems.length) { pr.append(el('div', `${r.problems.length} reference(s) now point at a missing file. Restore the site from the backup, or fix these:`, 'note bad')); r.problems.slice(0, 10).forEach((x) => pr.append(el('div', `${x.file}: ${x.raw}`, 'note'))); }
  const rows = [...r.entries, ...(r.unused || []).map((u) => ({ orig: u.rel, file: '', status: 'moved', origBytes: u.bytes, bytes: 0 }))];
  const t = $('im-result-table');
  window.dtDestroy?.(t);
  t.replaceChildren(imHead(), ...rows.map(imRow));
  window.dtRefresh?.(t);
}

// ---- comparison popup ----
const imUrl = (p) => `/original/${slug}/${p.split('/').map(encodeURIComponent).join('/')}?t=${Date.now()}`;
const baseName = (p) => p.split('/').pop();
const extOf = (p) => ((p || '').match(/\.([a-z0-9]+)$/i) || [, ''])[1].toUpperCase() || '—';
const dims = (w, h) => (w && h ? `${w} × ${h} px` : '—');

function openImageDialog(e) {
  const hasAfter = ['converted', 'recompressed', 'kept'].includes(e.status);
  const origPath = e.status === 'moved' ? `_modernizer-backup/unused-images/${e.orig}` : e.status === 'kept' || e.status === 'error' ? e.orig : `_modernizer-backup/original-images/${e.orig}`;
  $('imd-title').textContent = baseName(e.orig);
  const [label, tone] = IM_RESULT[e.status] || [e.status, 'empty'];
  $('imd-result').textContent = label;
  $('imd-result').className = 'badge ' + tone;
  const show = (imgId, noneId, linkId, path) => {
    const img = $(imgId), none = $(noneId), link = $(linkId);
    img.hidden = !path; none.hidden = Boolean(path);
    if (path) { img.src = imUrl(path); link.href = imUrl(path); link.hidden = false; } else { img.removeAttribute('src'); link.hidden = true; }
  };
  show('imd-o', 'imd-o-none', 'imd-o-link', e.status === 'error' ? '' : origPath);
  show('imd-n', 'imd-n-none', 'imd-n-link', hasAfter ? e.file : '');

  const box = $('imd-details');
  box.innerHTML = '';
  const tbl = el('table', undefined, 'imd-tbl');
  const hd = el('tr');
  hd.append(el('th', 'Detail'), el('th', 'Original'), el('th', 'Optimized'));
  tbl.append(hd);
  const row = (k, a, b) => { const tr = el('tr'); tr.append(el('td', k), el('td', a), el('td', b)); tbl.append(tr); };
  const dir = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '(site root)');
  row('Filename', baseName(e.orig), hasAfter ? baseName(e.file) : '—');
  row('Folder', dir(e.orig), hasAfter ? dir(e.file) : '—');
  row('Extension', extOf(e.orig), hasAfter ? extOf(e.file) : '—');
  row('Width × height', dims(e.origW, e.origH), hasAfter ? dims(e.w, e.h) : '—');
  row('File size', `${fmtB(e.origBytes)} (${Number(e.origBytes).toLocaleString()} bytes)`, hasAfter ? `${fmtB(e.bytes)} (${Number(e.bytes).toLocaleString()} bytes)` : '—');
  if (hasAfter && e.status !== 'kept' && e.origBytes) row('Size change', '', `${Math.round((1 - e.bytes / e.origBytes) * 100)}% smaller · saved ${fmtB(e.origBytes - e.bytes)}`);
  row('Stored at', origPath, hasAfter ? e.file : '—');
  const wrap = el('div', undefined, 'tbl-wrap');
  wrap.append(tbl);
  box.append(wrap);

  // responsive copies used for srcset
  box.append(el('h3', 'Responsive copies (srcset)', 'imd-sec'));
  const v = e.variants || [];
  if (e.status === 'error') box.append(el('div', e.error || 'This image could not be processed.', 'note bad'));
  else if (e.status === 'moved') box.append(el('div', 'Not applicable: this image is unused, so it was moved to the backup folder.', 'note'));
  else if (v.length) {
    box.append(el('div', `Created: ${v.length} extra size${v.length === 1 ? '' : 's'} (${fmtB(v.reduce((n, x) => n + x.bytes, 0))} in total). Pages that use this image pick the best size for each screen.`, 'note ok'));
    const list = el('div', undefined, 'imd-links');
    [...v, { file: e.file, w: e.w, bytes: e.bytes }].forEach((x) => { const a = el('a', `${x.w}w · ${fmtB(x.bytes)} · ${x.file}`); a.href = imUrl(x.file); a.target = '_blank'; a.rel = 'noopener'; list.append(a); });
    box.append(list);
  } else box.append(el('div', e.status === 'kept' ? 'Not created: the image was kept as it was, so there are no new files.' : 'Not created: no extra sizes were needed (the image is small, or no page uses it).', 'note'));
  $('im-dialog').showModal();
}

$('imd-close').onclick = () => $('im-dialog').close();
$('im-dialog').addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });

// ---- backups ----
function renderBackups() {
  const t = $('im-backups');
  t.innerHTML = '';
  const rows = imData.backups;
  if (!rows.length) { t.append(el('div', 'No backups yet. One is created automatically before the first change.', 'hint')); return; }
  const head = el('tr');
  head.append(el('th', 'Backup'), el('th', 'Created'), el('th', 'Age'), el('th', 'Reason'), el('th', 'Files', 'n'), el('th', 'Size', 'n'), el('th', ''));
  t.append(head);
  rows.forEach((b) => {
    const tr = el('tr'), td = el('td');
    const dl = el('a', 'Download', 'btn ghost sm2');
    dl.href = `/api/clients/${slug}/backups/${b.id}/download`;
    const rs = el('button', 'Restore entire site', 'btn ghost sm2 danger');
    rs.onclick = () => busy(rs, async () => {
      if (!confirm(`Restore the whole site folder to the state in backup ${b.id}?\n\nFiles created since then are removed. A backup of the current state is taken first.`)) return;
      const r = await api(`/api/clients/${slug}/images/restore-site`, { method: 'POST', body: { id: b.id } });
      toast(`Restored ${r.restored} files, removed ${r.removed} new files`);
      await loadImages();
    });
    const del = el('button', 'Delete', 'btn ghost sm2 danger'); del.type = 'button';
    del.onclick = () => busy(del, () => deleteBackupFlow({ ...b, slug, site: $('client').selectedOptions[0]?.text }));
    td.append(dl, document.createTextNode(' '), rs, document.createTextNode(' '), del);
    const days = Math.max(0, Math.floor((Date.now() - Date.parse(b.createdAt)) / 864e5));
    const age = el('td'); age.append(el('span', ageText(days) + (days >= 365 ? ' · over a year' : ''), 'badge ' + (days >= 365 ? 'draft' : 'empty')));
    tr.append(el('td', b.id), el('td', new Date(b.createdAt).toLocaleString()), age, el('td', b.reason), el('td', b.files, 'n'), el('td', fmtB(b.bytes), 'n'), td);
    t.append(tr);
  });
}
$('im-restore-unused').onclick = (e) => busy(e.target, async () => { const r = await api(`/api/clients/${slug}/images/restore-unused`, { method: 'POST' }); toast(`${r.restored} unused image(s) put back`); });
$('im-restore-orig').onclick = (e) => busy(e.target, async () => { const r = await api(`/api/clients/${slug}/images/restore-originals`, { method: 'POST' }); toast(`${r.restored} original file(s) put back next to the WebP versions`); });

// ---------- Validation & Report ----------
let valData = null, brData = null, brPoll = null;
const ms = (n) => (n / 1000).toFixed(1) + ' s';
const kb = (n) => Math.round(n / 1024) + ' KB';
const stat = (box, a, b) => { const d = el('div', undefined, 'stat'); d.append(el('b', b), el('span', a)); box.append(d); };

async function loadReport() {
  const [v, b] = await Promise.all([api(`/api/clients/${slug}/validation`), api(`/api/clients/${slug}/browser`)]);
  valData = v; brData = b;
  renderValidation(); refreshReportNote();
  renderBrowser();
}

function renderValidation() {
  const box = $('val-stats'), t = $('chk-table');
  box.innerHTML = ''; t.innerHTML = '';
  $('pstatus2').className = 'dot' + (valData ? (valData.totals.blocked ? ' warn' : ' ok') : '');
  $('site-card').hidden = true;
  if (!valData) { box.append(el('div', 'Not validated yet. Build all pages first (Content & build), then press Run validation.', 'hint')); return; }
  const k = valData.totals;
  stat(box, 'Pages checked', k.pages); stat(box, 'Ready', k.ready); stat(box, 'Blocked', k.blocked);
  stat(box, 'Applicable checks passed', k.completion + '%'); stat(box, 'New broken links', k.links.newlyBroken);
  if (k.audit) { stat(box, 'Audit problems fixed', k.audit.fixed); stat(box, 'Still open', k.audit.open); stat(box, 'New since the update', k.audit.fresh); }
  const head = el('tr');
  head.append(el('th', 'Check'), el('th', 'Applies to', 'n'), el('th', 'Passed', 'n'), el('th', 'Failed', 'n'), el('th', 'Example page'));
  t.append(head);
  Object.entries(valData.checks).sort((x, y) => y[1].failed - x[1].failed).forEach(([id, c]) => {
    const tr = el('tr', undefined, c.failed ? 'pick' : '');
    tr.append(el('td', c.label), el('td', c.applicable, 'n'), el('td', c.passed, 'n'), el('td', c.failed, 'n'), el('td', c.failed ? c.sample[0] || '' : '✓'));
    if (c.failed) { tr.title = 'Double-click to see every page that failed'; tr.tabIndex = 0; tr.ondblclick = () => openCheck(id, c); tr.onkeydown = (e) => { if (e.key === 'Enter') openCheck(id, c); }; }
    t.append(tr);
  });
  if (valData.site) {
    const st = valData.site;
    $('site-card').hidden = false;
    $('site-note').textContent = st.matching === st.updated
      ? `All ${st.updated} updated pages in your website folder match the validated build. The original files are backed up (backup ${st.backupId}) and can be restored from Content & build.`
      : `${st.updated - st.matching} of ${st.updated} updated pages in your website folder differ from the validated build (first: ${st.differing[0] || ''}). Run Build all pages again.`;
  }
  $('dl-report').href = `/api/clients/${slug}/reports/optimization-report.html`;
  $('dl-csv').href = `/api/clients/${slug}/reports/validation.csv`;
}


// every page that failed one check, and why
function openCheck(id, c) {
  $('rp-title').textContent = c.label;
  const list = c.failures || [];
  $('rp-sub').textContent = list.length ? 'Pages that did not pass this check, with what is wrong on each. Click a page name to open the updated page, or "original" to compare.' : 'Run validation again to list the pages (this result was saved before page details were kept).';
  const box = $('rp-stats'); box.innerHTML = '';
  stat(box, 'Pages this applies to', c.applicable); stat(box, 'Passed', c.passed); stat(box, 'Failed', c.failed);
  const hard = list.filter((x) => x.level === 'fail').length;
  if (list.length) stat(box, 'Serious / minor', `${hard} / ${list.length - hard}`);
  const t = $('rp-table');
  if (window.dtDestroy) window.dtDestroy(t);
  t.innerHTML = '';
  const head = el('tr');
  ['Page', 'Severity', 'What is wrong', 'Compare'].forEach((x) => head.append(el('th', x)));
  t.append(head);
  (list.length ? list : (c.sample || []).map((p) => ({ path: p, level: '', msg: '' }))).forEach((f) => {
    const tr = el('tr');
    const pg = el('td'), a = el('a', f.path); a.href = `/final/${slug}/build/${f.path}`; a.target = '_blank'; a.rel = 'noopener'; pg.append(a);
    const sv = el('td'); if (f.level) sv.append(el('span', f.level === 'fail' ? 'serious' : 'minor', 'sev ' + (f.level === 'fail' ? 'high' : 'medium')));
    const cmp = el('td'), o = el('a', 'compare'); o.href = '#'; o.onclick = (ev) => { ev.preventDefault(); openCompare(f.path); }; cmp.append(o);
    tr.append(pg, sv, el('td', f.msg || ''), cmp);
    t.append(tr);
  });
  if (window.dtRefresh) window.dtRefresh(t);
  if (!$('rp-dlg').open) $('rp-dlg').showModal();
}
$('rp-close').onclick = () => $('rp-dlg').close();

// ---------- Before / after ----------
let cmpPath = '';
function openCompare(p) {
  cmpPath = p;
  const enc = p.split('/').map(encodeURIComponent).join('/'), t = Date.now();
  $('cmp-title').textContent = p;
  $('cmp-sub').textContent = 'The original page on the left, the updated page on the right. Scroll either one.';
  $('cmp-before').src = `/original/${slug}/${enc}?t=${t}`;
  $('cmp-after').src = `/final/${slug}/build/${enc}?t=${t}`;
  if (!$('cmp-dlg').open) $('cmp-dlg').showModal();
}
$('cmp-close').onclick = () => { $('cmp-dlg').close(); $('cmp-before').src = 'about:blank'; $('cmp-after').src = 'about:blank'; };
$('cmp-restore').onclick = (e) => busy(e.target, async () => {
  if (!confirm(`Put ${cmpPath} back as it was before the updates? Other pages are not touched.`)) return;
  const r = await api(`/api/clients/${slug}/restore-page`, { method: 'POST', body: { path: cmpPath } });
  toast(`Restored from the copy saved by ${r.restoredFrom}`);
  refreshSiteStatus();
});

// the largest-paint time of every speed test run, as a small line chart (lower is better)
function renderTrend(hist) {
  const box = $('br-trend');
  box.hidden = hist.length < 2;
  if (hist.length < 2) return;
  const W = 640, H = 150, P = 28, max = Math.max(...hist.map((h) => Math.max(h.lcpBefore, h.lcpAfter)), 1);
  const x = (i) => P + (i * (W - 2 * P)) / (hist.length - 1), y = (v) => H - P - (v / max) * (H - 2 * P);
  const line = (key, color) => `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${hist.map((h, i) => `${x(i).toFixed(1)},${y(h[key]).toFixed(1)}`).join(' ')}"/>${hist.map((h, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(h[key]).toFixed(1)}" r="3.5" fill="${color}"><title>${new Date(h.testedAt).toLocaleDateString()}: ${ms(h[key])}</title></circle>`).join('')}`;
  box.innerHTML = `<b class="cmp-h">Largest paint over time (${hist.length} test runs, lower is better)</b><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Largest paint over time" style="width:100%;max-width:${W}px">${line('lcpBefore', 'var(--mute)')}${line('lcpAfter', 'var(--a1)')}<text x="${P}" y="12" font-size="11" fill="currentColor">${ms(max)}</text><text x="${P}" y="${H - 6}" font-size="11" fill="currentColor">${new Date(hist[0].testedAt).toLocaleDateString()}</text><text x="${W - P}" y="${H - 6}" font-size="11" text-anchor="end" fill="currentColor">${new Date(hist.at(-1).testedAt).toLocaleDateString()}</text></svg><div class="hint">Grey: original pages · Colour: updated pages</div>`;
}

function renderBrowser() {
  const box = $('br-stats'), t = $('br-table');
  box.innerHTML = ''; t.innerHTML = '';
  if (!brData) { box.append(el('div', 'Not run yet. The test loads the old and new version of each page on an emulated phone with slow 4G.', 'hint')); return; }
  const s = brData.summary;
  $('br-profile').textContent = '· ' + brData.profile;
  stat(box, 'Pages tested', s.pages);
  stat(box, 'Largest paint', `${ms(s.lcpBefore)} → ${ms(s.lcpAfter)}`);
  stat(box, 'Data per page', `${kb(s.bytesBefore)} → ${kb(s.bytesAfter)}`);
  stat(box, 'Requests', `${s.requestsBefore} → ${s.requestsAfter}`);
  stat(box, 'Layout shift', `${s.clsBefore} → ${s.clsAfter}`);
  stat(box, 'Serious accessibility issues', s.axeSerious);
  renderTrend(brData.history || []);
  const head = el('tr');
  head.append(el('th', 'Page'), el('th', 'Largest paint', 'n'), el('th', 'Data', 'n'), el('th', 'Shift', 'n'), el('th', 'Accessibility'), el('th', 'Errors'));
  t.append(head);
  brData.results.forEach((r) => {
    const ax = (r.desktop.axe || []).filter((v) => ['serious', 'critical'].includes(v.impact));
    const errs = r.modern.jsErrors.length + r.modern.consoleErrors.length + r.modern.failedLocal.length + (r.modern.overflow ? 1 : 0);
    const tr = el('tr');
    tr.append(el('td', r.path), el('td', `${ms(r.original.lcp)} → ${ms(r.modern.lcp)}`, 'n'), el('td', `${kb(r.original.bytes)} → ${kb(r.modern.bytes)}`, 'n'), el('td', `${r.original.cls} → ${r.modern.cls}`, 'n'), el('td', ax.length ? ax.map((v) => `${v.id} (${v.nodes})`).join(', ') : 'none serious'), el('td', errs ? String(errs) : 'none'));
    t.append(tr);
  });
}

$('val-run').onclick = (e) => busy(e.target, async () => {
  await track('jp-report', 'Validating all pages', async () => {
    valData = await api(`/api/clients/${slug}/validation`, { method: 'POST' });
    renderValidation();
    return valData;
  }, (v) => `${v.totals.pages} pages checked · ${v.totals.ready} ready · ${v.totals.blocked} blocked`);
  toast(`${valData.totals.ready} pages ready, ${valData.totals.blocked} blocked`);
});

// the modernisation report: "Generate Report" prepares it (both versions of every page are read and scored); once it exists the button
// becomes "View Report" and opens it in a new tab. "Regenerate" prepares it again after a new build.
let reportReady = false;
async function refreshReportNote() {
  if (!slug) return;
  const i = await api(`/api/clients/${slug}/modernization`).catch(() => null);
  reportReady = Boolean(i?.exists);
  $('rep-open').textContent = reportReady ? 'View Report' : 'Generate Report';
  $('rep-regen').hidden = !reportReady;
  $('rep-dl').hidden = !reportReady;
  $('rep-dl').href = `/api/clients/${slug}/modernization/report?download=1`;
  $('rep-note').textContent = reportReady ? `Prepared ${new Date(i.generatedAt).toLocaleString()}` : 'Takes about a minute';
}
async function generateReport(btn) {
  const title = 'Preparing the modernisation report', startedAt = new Date().toISOString();
  const p = panel('jp-report');
  p.set({ state: 'running', title, detail: 'Starting…', startedAt });
  try {
    await api(`/api/clients/${slug}/modernization`, { method: 'POST' });
    for (;;) {
      await new Promise((r) => setTimeout(r, 900));
      const j = await api(`/api/clients/${slug}/modernization/job`);
      const what = { read: 'Reading the original and updated pages', score: 'Scoring both versions of every page', writing: 'Writing the report and CSV files' }[j.phase] || 'Working…';
      p.set({ state: 'running', title, detail: `${what}${j.total ? ` · ${j.done} of ${j.total}` : ''}`, done: j.done, total: j.total, startedAt });
      if (!j.running) { if (j.error) throw new Error(j.error); break; }
    }
    p.set({ state: 'done', title, detail: 'The report is ready. Press View Report to open it; every table in it can be exported as CSV.', startedAt, finishedAt: new Date().toISOString() });
    await refreshReportNote();
  } catch (e) {
    p.set({ state: 'failed', title, detail: 'The report could not be prepared.', errors: [e.message], startedAt, finishedAt: new Date().toISOString() });
    toast(e.message, true);
  }
}
$('rep-open').onclick = (e) => {
  if (!slug) return;
  if (reportReady) { window.open(`/api/clients/${slug}/modernization/report?t=${Date.now()}`, '_blank'); return; }
  busy(e.target, () => generateReport());
};
$('rep-regen').onclick = (e) => busy(e.target, () => generateReport());

$('br-run').onclick = (e) => busy(e.target, async () => {
  if (!valData) throw new Error('Run validation first');
  const startedAt = new Date().toISOString(), title = 'Real-browser test (speed and accessibility)';
  panel('jp-report').set({ state: 'running', title, detail: 'Opening the browser…', startedAt });
  await api(`/api/clients/${slug}/browser`, { method: 'POST', body: { limit: 12 } });
  clearInterval(brPoll);
  brPoll = setInterval(async () => {
    const j = await api(`/api/clients/${slug}/browser/job`).catch(() => null);
    if (!j) return;
    $('br-progress').textContent = `${j.done} of ${j.total} pages`;
    if (j.running) { panel('jp-report').set({ state: 'running', title, detail: `${j.done} of ${j.total} pages tested`, done: j.done, total: j.total, startedAt }); return; }
    clearInterval(brPoll);
    $('br-progress').textContent = j.errors.length ? `${j.errors.length} failed: ${j.errors[0].error}` : 'finished';
    brData = await api(`/api/clients/${slug}/browser`);
    renderBrowser();
    panel('jp-report').set({ state: j.errors.length ? 'failed' : 'done', title, detail: `${j.done} of ${j.total} pages tested`, done: j.done, total: j.total, errors: j.errors.map((x) => `${x.path || ''} ${x.error}`.trim()), startedAt, finishedAt: new Date().toISOString() });
  }, 2000);
});

// ---------- Navigation & sites ----------
// the selected website and step are remembered, so a refresh reopens the same place
const remember = {
  get: (k) => { try { return localStorage.getItem('sm-' + k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem('sm-' + k, v); } catch { /* storage unavailable */ } },
};
const TABS = ['profile', 'audit', 'design', 'templates', 'images', 'report', 'settings'];
// the steps in order; a step is shown only when the website is being updated for something that needs it
const STEP_ORDER = ['profile', 'audit', 'design', 'images', 'templates', 'report'];
let siteOptions = { template: true, images: true, content: true };
const stepShown = (t) => t === 'settings' || t === 'profile' || t === 'audit' || t === 'report' || (t === 'design' && siteOptions.template) || (t === 'images' && siteOptions.images) || (t === 'templates' && (siteOptions.template || siteOptions.content));
const STEP = {};
function applyOptions() {
  siteOptions = sites.find((c) => c.slug === slug)?.options || { template: true, images: true, content: true };
  if (typeof gateFinal !== 'undefined') applyGate(gateFinal); // the template wait depends on the website's options
  const shown = STEP_ORDER.filter(stepShown);
  STEP_ORDER.forEach((t) => delete STEP[t]);
  shown.forEach((t, i) => { STEP[t] = i + 1; });
  STEP.total = shown.length;
  document.querySelectorAll('#nav button').forEach((b) => {
    const t = b.dataset.tab;
    b.hidden = !stepShown(t);
    const em = b.querySelector('em');
    if (em && STEP[t]) em.textContent = String(STEP[t]);
  });
}

function openTab(tab, { scroll = true } = {}) {
  if (tab === 'publish') tab = 'report'; // the step was called Validate & publish before
  if (!TABS.includes(tab) || !stepShown(tab)) tab = 'profile';
  document.querySelectorAll('#nav button').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
  TABS.forEach((t) => ($('tab-' + t).hidden = t !== tab));
  setAccent(tab);
  remember.set('tab', tab);
  if (tab === 'images' && typeof imagesOpened === 'function') imagesOpened();
  if (slug && Date.now() - lastStatusAt > 15000) refreshSiteStatus();
  if (tab === 'settings' && typeof loadStorage === 'function') loadStorage();
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('nav').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) openTab(b.dataset.tab);
});

// each workflow step has its own accent colour (set on <body>, used by the whole stylesheet)
function setAccent(tab) {
  document.body.dataset.tab = tab;
  const name = document.querySelector(`#nav button[data-tab="${tab}"] span`)?.textContent || '';
  $('crumb-name').textContent = name;
  $('crumb-step').textContent = STEP[tab] ? `Step ${STEP[tab]} of ${STEP.total}` : 'Settings';
}

async function loadClients(select) {
  const clients = await api('/api/clients');
  sites = clients;
  $('client').innerHTML = '';
  clients.forEach((c) => $('client').add(new Option(c.name, c.slug)));
  const saved = remember.get('site');
  if (select) $('client').value = select;
  else if (saved && clients.some((c) => c.slug === saved)) $('client').value = saved;
  slug = $('client').value;
  if (slug) remember.set('site', slug);
  applyOptions();
  $('crumb-site').textContent = $('client').selectedOptions[0]?.text || 'No website';
  syncSiteButtons();
  refreshSiteStatus();
  loadStorage();
  if (slug) { await loadProfile(); await loadAudit(); await loadFinalTab(); await loadImages(); await loadReport(); await loadTemplateTab(); }
}
$('client').onchange = () => loadClients($('client').value);

// ---------- backups & storage: where the space goes, and a warning for backups older than a year ----------
let stData = null;
const ageText = (d) => (d < 1 ? 'today' : d < 31 ? `${d} day${d === 1 ? '' : 's'}` : d < 365 ? `${Math.round(d / 30.4)} months` : `${Math.floor(d / 365)} year${d >= 730 ? 's' : ''}${Math.round((d % 365) / 30.4) ? ' ' + Math.round((d % 365) / 30.4) + ' mo' : ''}`);

async function deleteBackupFlow(b) {
  if (!confirm(`Delete the backup of ${b.site || 'this website'} from ${new Date(b.createdAt).toLocaleString()} (${fmtB(b.bytes)})?\n\nThis frees the space, but you will no longer be able to restore the site to that state. This cannot be undone.\n\nAny extra copy you made in another folder is not touched.`)) return;
  const r = await api(`/api/clients/${b.slug}/backups/${b.id}`, { method: 'DELETE' });
  toast(`Backup deleted. ${fmtB(r.freed)} freed.`);
  await loadStorage();
  if (b.slug === slug && typeof loadImages === 'function') await loadImages(false);
}

async function loadStorage() {
  const d = await api('/api/backups').catch(() => null);
  if (!d) return;
  stData = d;
  const box = $('bk-stats');
  box.innerHTML = '';
  const oldest = d.rows.length ? Math.max(...d.rows.map((r) => r.ageDays)) : 0;
  const stat = (label, value) => { const x = el('div', undefined, 'stat'); x.append(el('b', value), el('span', label)); box.append(x); };
  stat('Backups', d.rows.length);
  stat('Space used by backups', fmtB(d.totalBytes));
  stat('Oldest backup', d.rows.length ? ageText(oldest) : '—');
  stat(`Older than ${d.warnDays >= 365 ? 'a year' : d.warnDays + ' days'}`, d.oldCount ? `${d.oldCount} · ${fmtB(d.oldBytes)}` : 'None');
  if (d.disk) stat('Free disk space here', `${fmtB(d.disk.free)} of ${fmtB(d.disk.total)}`);
  const t = $('bk-table');
  t.innerHTML = '';
  const head = el('tr');
  head.append(el('th', 'Website'), el('th', 'Created'), el('th', 'Age'), el('th', 'Reason'), el('th', 'Files', 'n'), el('th', 'Size', 'n'), el('th', ''));
  t.append(head);
  d.rows.forEach((b) => {
    const tr = el('tr'), age = el('td'), act = el('td');
    age.append(el('span', ageText(b.ageDays) + (b.old ? ' · over a year' : ''), 'badge ' + (b.old ? 'draft' : 'empty')));
    if (b.missing) age.append(el('span', 'file missing', 'badge bad'));
    const dl = el('a', 'Download', 'btn ghost sm2'); dl.href = `/api/clients/${b.slug}/backups/${b.id}/download`;
    const del = el('button', 'Delete', 'btn ghost sm2 danger'); del.type = 'button';
    del.onclick = () => busy(del, () => deleteBackupFlow(b));
    if (!b.missing) act.append(dl, document.createTextNode(' '));
    act.append(del);
    const created = el('td', new Date(b.createdAt).toLocaleString());
    created.dataset.sort = String(Date.parse(b.createdAt)); age.dataset.sort = String(b.ageDays);
    tr.append(el('td', b.site), created, age, el('td', b.reason), el('td', b.files, 'n'), el('td', fmtB(b.bytes), 'n'), act);
    t.append(tr);
  });
  renderStorageAlert(d);
}

// the notice stays until you act on it; "remind me later" hides it for a week
function renderStorageAlert(d) {
  const box = $('storage-alert');
  let snoozed = 0;
  try { snoozed = Number(localStorage.getItem('sm-storage-snooze') || 0); } catch { /* storage unavailable */ }
  const lowDisk = d.disk && (d.disk.free < 10 * 1073741824 || d.disk.free / d.disk.total < 0.1);
  if (!(d.oldCount || lowDisk) || Date.now() < snoozed) { box.hidden = true; return; }
  box.className = 'alert' + (lowDisk ? ' bad' : '');
  box.replaceChildren();
  const main = el('div', undefined, 'alert-main');
  main.append(el('b', lowDisk ? 'Disk space is running low' : 'You still have old backups'));
  if (d.oldCount) main.append(el('p', `${d.oldCount} backup${d.oldCount === 1 ? '' : 's'} older than a year (${fmtB(d.oldBytes)}) from ${d.oldSites} website${d.oldSites === 1 ? '' : 's'} ${d.oldCount === 1 ? 'is' : 'are'} still stored. Backups are kept until you delete them, and they use disk space.`));
  if (lowDisk) main.append(el('p', `Only ${fmtB(d.disk.free)} is free on the drive where backups are stored. All backups use ${fmtB(d.totalBytes)}.`));
  const row = el('div', undefined, 'alert-actions');
  const review = el('button', 'Review backups', 'btn sm2'); review.type = 'button';
  review.onclick = () => { openTab('settings'); setTimeout(() => $('storage-card').scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); };
  const later = el('button', 'Remind me in a week', 'btn sm2 ghost'); later.type = 'button';
  later.onclick = () => { try { localStorage.setItem('sm-storage-snooze', String(Date.now() + 7 * 864e5)); } catch { /* ignore */ } box.hidden = true; };
  row.append(review, later);
  main.append(row);
  box.append(el('div', lowDisk ? '!' : 'i', 'alert-ic'), main);
  box.hidden = false;
}
$('bk-refresh').onclick = (e) => busy(e.target, loadStorage);

// ---------- website status: warns when the folder no longer matches what the portal has stored ----------
let lastStatusAt = 0, dismissedStale = '';
async function refreshSiteStatus() {
  const box = $('site-alert');
  if (!slug) { box.hidden = true; return; }
  lastStatusAt = Date.now();
  const s = await api(`/api/clients/${slug}/status`).catch(() => null);
  if (!s) return;
  let kind = '', title = '', text = '';
  const actions = [];
  const btn = (label, fn, ghost) => actions.push([label, fn, ghost]);
  const lb = s.latestBackup;
  if (!s.exists || s.files === 0) {
    kind = 'bad';
    title = s.exists ? 'The website folder is empty' : 'The website folder was not found';
    text = `${s.exists ? 'No files were found in' : 'Nothing exists at'} ${s.sourceDir}. ${s.hasResults ? 'The results shown in the steps come from earlier runs on files that are no longer there.' : ''}`;
    if (lb) btn(`Restore the site from the backup of ${new Date(lb.createdAt).toLocaleString()} (${lb.files} files)`, () => restoreLatestBackup(lb));
    if (s.hasResults) btn('Clear the old results', () => resetResults(), true);
    btn('Change the folder', () => openSiteDialog('edit'), true);
  } else if (s.stale && dismissedStale !== s.newestAt) {
    kind = 'info';
    title = 'Files changed since the last scan';
    text = `Some files in the website folder are newer than the last scan (${new Date(s.scannedAt).toLocaleString()}), so the audit and build may not match the folder any more.`;
    btn('Re-scan now', async () => { await api(`/api/clients/${slug}/scan`, { method: 'POST' }); await loadAudit(); toast('Scan complete'); await refreshSiteStatus(); });
    btn('Dismiss', () => { dismissedStale = s.newestAt; box.hidden = true; }, true);
  } else { box.hidden = true; return; }
  box.className = 'alert ' + kind;
  box.replaceChildren();
  const ic = el('div', kind === 'bad' ? '!' : 'i', 'alert-ic');
  const main = el('div', undefined, 'alert-main');
  main.append(el('b', title), el('p', text));
  const row = el('div', undefined, 'alert-actions');
  actions.forEach(([label, fn, ghost]) => { const b = el('button', label, 'btn sm2' + (ghost ? ' ghost' : '')); b.type = 'button'; b.onclick = () => busy(b, fn); row.append(b); });
  main.append(row);
  box.append(ic, main);
  box.hidden = false;
}

async function restoreLatestBackup(b) {
  if (!confirm(`Restore the website folder from the backup taken ${new Date(b.createdAt).toLocaleString()} (${b.files} files)?\n\nA backup of the current state is taken first, so this can be undone.`)) return;
  const r = await api(`/api/clients/${slug}/images/restore-site`, { method: 'POST', body: { id: b.id } });
  toast(`Restored ${r.restored} files into the website folder`);
  await loadClients(slug);
}

async function resetResults() {
  if (!confirm('Clear the old results for this website?\n\nThe scan, builds, validation, image-optimisation result and reports are moved aside (nothing is erased). Your profile, design, AI-written content and backups stay.')) return;
  const r = await api(`/api/clients/${slug}/reset`, { method: 'POST' });
  toast(r.moved.length ? `Old results cleared. They were kept in ${r.keptAt}.` : 'There were no old results to clear.');
  await loadClients(slug);
}

// ---------- websites: add, edit, delete ----------
let siteMode = 'add', sites = [], autoContent = false;
// Update Template can only be applied by building pages, which is Update Content's step: ticking it ticks Update Content too
function syncOptionBoxes() {
  const t = $('o_template').checked;
  $('o_content').disabled = t;
  $('o_note').hidden = !(t && autoContent);
  $('o_note').textContent = 'Update Content was added for you: a template is applied by building the pages in Content & build. The wording stays as it is ("Use existing content") until you choose Enhance or Re-write there.';
}
$('o_template').onchange = () => {
  if ($('o_template').checked) { if (!$('o_content').checked) { $('o_content').checked = true; autoContent = true; } }
  else if (autoContent) { $('o_content').checked = false; autoContent = false; }
  syncOptionBoxes();
};
$('o_content').onchange = () => { autoContent = false; syncOptionBoxes(); };
const optionsFromDialog = () => ({ template: $('o_template').checked, images: $('o_images').checked, content: $('o_content').checked });
const syncSiteButtons = () => { $('edit-site').disabled = $('del-site').disabled = !slug; };

function openSiteDialog(mode) {
  siteMode = mode;
  const cur = sites.find((c) => c.slug === slug);
  $('s_err').textContent = '';
  $('site-form').reset();
  $('s_title').textContent = mode === 'edit' ? 'Edit website' : 'Add website';
  $('s_ok').textContent = mode === 'edit' ? 'Save changes' : 'Add website';
  $('s_hint').hidden = mode !== 'edit';
  if (mode === 'edit' && cur) { $('s_name').value = cur.name; $('s_host').value = cur.host; $('s_dir').value = cur.sourceDir; }
  const o = (mode === 'edit' && cur?.options) || { template: true, images: true, content: true }; // a new website starts with everything ticked
  $('o_template').checked = o.template; $('o_images').checked = o.images; $('o_content').checked = o.content;
  autoContent = false; syncOptionBoxes();
  $('site-dialog').showModal();
  $('s_name').focus();
}
const TEMPLATE_NOTICE = 'Update Content was added to this website.\n\nA template is applied by building the pages in the Content & build step, so you will build the pages there after the template is approved. Content & build starts with "Use existing content", so the wording stays exactly as it is until you choose Enhance or Re-write.';
// folder browser: pick the site folder instead of typing its path
const fp = { onPick: null, path: '' };
async function fpLoad(p) {
  $('fp-err').textContent = '';
  let r;
  try { r = await api('/api/fs/list?path=' + encodeURIComponent(p || '')); } catch (e) { $('fp-err').textContent = e.message; return; }
  fp.path = r.path; fp.parent = r.parent; fp.home = r.home;
  $('fp-path').value = r.path;
  $('fp-up').disabled = r.parent === null;
  $('fp-ok').disabled = !r.path;
  const list = $('fp-list');
  list.replaceChildren(...(r.entries.length ? r.entries.map((d) => { const li = el('li'); const b = el('button'); b.type = 'button'; b.append(el('i', d.drive ? '🖴' : '📁'), document.createTextNode(d.name)); b.onclick = () => fpLoad(d.path); li.append(b); return li; }) : [el('li', 'No folders inside this one.', 'empty')]));
  list.scrollTop = 0;
  $('fp-info').textContent = r.path ? (r.pages ? `${r.pages} page file(s) (HTML or PHP) are directly in this folder.` : 'No HTML or PHP files directly in this folder. Open the folder that holds the site pages.') : 'Choose a drive.';
}
function openFolderPicker(start, onPick) {
  fp.onPick = onPick;
  $('fp-dialog').showModal();
  fpLoad(start).then(() => { if ($('fp-err').textContent) fpLoad(''); });
}
$('fp-up').onclick = () => fpLoad(fp.parent || '');
$('fp-drives').onclick = () => fpLoad('');
$('fp-home').onclick = () => fpLoad(fp.home || '');
$('fp-go').onclick = () => fpLoad($('fp-path').value);
$('fp-path').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); fpLoad($('fp-path').value); } };
$('fp-cancel').onclick = () => $('fp-dialog').close();
$('fp-ok').onclick = () => { if (fp.path) { fp.onPick?.(fp.path); $('fp-dialog').close(); } };
$('s_browse').onclick = () => openFolderPicker($('s_dir').value.trim(), (p) => { $('s_dir').value = p; $('s_dir').dispatchEvent(new Event('input')); });

$('add-site').onclick = () => openSiteDialog('add');
$('edit-site').onclick = () => { if (slug) openSiteDialog('edit'); };
$('s_cancel').onclick = () => $('site-dialog').close();
$('site-form').onsubmit = async (e) => {
  e.preventDefault();
  const options = optionsFromDialog();
  if (!options.template && !options.images && !options.content) { $('s_err').textContent = 'Choose at least one thing to update.'; return; }
  const body = { name: $('s_name').value, host: $('s_host').value, sourceDir: $('s_dir').value, options, contentAdded: autoContent };
  $('s_ok').disabled = true;
  try {
    if (siteMode === 'edit') {
      const r = await api(`/api/clients/${slug}`, { method: 'PUT', body });
      $('site-dialog').close();
      await loadClients(r.slug);
      toast(r.moved ? 'Website updated. The folder or domain changed, so run Re-scan site on the Site audit step.' : 'Website updated');
      if (body.contentAdded) alert(TEMPLATE_NOTICE);
    } else {
      const { slug: s } = await api('/api/clients', { method: 'POST', body });
      $('site-dialog').close();
      await loadClients(s);
      toast('Website added — run a scan from the Site audit tab');
      if (body.contentAdded) alert(TEMPLATE_NOTICE);
    }
  } catch (err) { $('s_err').textContent = err.message; } finally { $('s_ok').disabled = false; }
};

// delete: the website's name has to be typed, and the data is moved aside rather than erased
$('del-site').onclick = () => {
  const cur = sites.find((c) => c.slug === slug);
  if (!cur) return;
  $('d_name').textContent = cur.name;
  $('d_confirm').value = ''; $('d_ok').disabled = true; $('d_err').textContent = '';
  $('del-dialog').showModal();
  $('d_confirm').focus();
};
$('d_confirm').oninput = () => { const cur = sites.find((c) => c.slug === slug); $('d_ok').disabled = $('d_confirm').value.trim().toLowerCase() !== (cur?.name || '').trim().toLowerCase(); };
$('d_cancel').onclick = () => $('del-dialog').close();
$('del-form').onsubmit = async (e) => {
  e.preventDefault();
  $('d_ok').disabled = true;
  try {
    const r = await api(`/api/clients/${slug}`, { method: 'DELETE', body: { confirm: $('d_confirm').value } });
    $('del-dialog').close();
    remember.set('site', '');
    await loadClients();
    toast(`Website deleted. Its data was kept in ${r.keptAt} and can be recovered.`);
    if (!slug) location.reload();
  } catch (err) { $('d_err').textContent = err.message; $('d_ok').disabled = false; }
};

if (window.initTemplateTab) initTemplateTab();
(async () => {
  openTab(remember.get('tab') || 'profile', { scroll: false });
  showSettings(await api('/api/settings'), await api('/api/settings/models'));
  await loadClients();
  // the Template design sub-tab (Configuration, Design variants, Composer, Preview & refine) is restored too
  const sub = remember.get('tdview');
  if (sub && window.showView) showView(sub);
})().catch((e) => toast(e.message, true));

// ---------- the sidebar folds to icons and opens again; the choice is remembered ----------
(() => {
  const btn = document.getElementById('side-toggle');
  if (!btn) return;
  document.querySelectorAll('#nav button').forEach((b) => { const t = b.querySelector('span:not(.dot)')?.textContent?.trim(); if (t) b.title = t; });
  const apply = (collapsed) => {
    document.body.classList.toggle('side-collapsed', collapsed);
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.setAttribute('aria-label', collapsed ? 'Open the sidebar' : 'Collapse the sidebar');
    btn.title = collapsed ? 'Open the sidebar' : 'Collapse the sidebar';
  };
  let saved = false; try { saved = localStorage.getItem('sm-side') === '1'; } catch { /* storage unavailable */ }
  apply(saved);
  btn.onclick = () => { const next = !document.body.classList.contains('side-collapsed'); apply(next); try { localStorage.setItem('sm-side', next ? '1' : ''); } catch { /* storage unavailable */ } };
})();
