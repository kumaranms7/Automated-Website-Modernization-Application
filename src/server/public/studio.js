// ---------- Design studio: variants gallery, section library, composer ----------
// Loaded after template.js; relies on helpers from app.js ($, api, el, busy, toast, panel, slug) at call time.

const SD = { slotView: 'home', slot: 'home', outlines: {}, files: {}, data: null, slug: '', poll: null, compare: new Set(), page: null, sel: null, hist: [], hi: -1, saveTimer: null, token: 0, scrollY: 0, proposal: null, qa: null };
const sapi = (p, o) => api(`/api/clients/${slug}/studio${p}`, o);
const sesc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = (x) => JSON.parse(JSON.stringify(x));
const uid = () => 's' + Math.random().toString(36).slice(2, 8);
const nice = (s) => String(s || '').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
const thumbUrl = (v, id, at) => `/api/clients/${slug}/studio/thumb/${v}/${id}.jpg?t=${encodeURIComponent(at || '')}`;
const typeOf = (ref) => String(ref).split(':')[0];
const vById = (id) => SD.data?.variants.find((v) => v.id === id);
const mixHexJs = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join(''); };
const PROP_LABEL = { bg: 'Background', align: 'Text alignment', spacing: 'Spacing', head: 'Heading style', cards: 'Card style', frame: 'Image style' };
const VALUE_LABEL = { auto: 'Automatic', white: 'White', soft: 'Soft tint', dark: 'Dark', brand: 'Brand colour', left: 'Left', center: 'Centred', tight: 'Tight', normal: 'Normal', loose: 'Loose', inherit: 'Page default', bar: 'Side bar', image: 'Photo', icon: 'Icon', numbered: 'Numbered', overlay: 'Photo overlay', plain: 'Plain', rounded: 'Rounded', offset: 'Offset shadow' };
const vl = (v) => VALUE_LABEL[v] || nice(v);
const SLOT_LABEL = { home: 'Home page', inner: 'Inner page', contact: 'Contact page' };
const slotsOf = () => (SD.data?.slots?.length ? SD.data.slots : ['home']);
const coverUrl = (v, slot) => thumbUrl(v.id, slot === 'home' ? '_cover' : '_cover-' + slot, v.at);
const slotQa = (v, slot) => (slot === 'home' ? v.qa : v.slots?.[slot]?.qa);
// a row of buttons, one per page layout that has a page to draw on
function slotSeg(box, current, onPick) {
  box.innerHTML = '';
  slotsOf().forEach((s) => { const b = el('button', SLOT_LABEL[s], s === current ? 'on' : ''); b.type = 'button'; b.onclick = () => onPick(s); box.append(b); });
  box.hidden = slotsOf().length < 2;
}
// the choices a design makes for a page layout, in words
function slotFacts(v, slot) {
  const e = { ...(v.layout || {}), ...(v.pageLayout?.[slot] || {}) };
  if (slot === 'inner') return [`${nice(e.hero)} hero`, e.innerSidebar === 'off' ? 'No sidebar' : 'Sidebar', e.innerForm === 'below' ? 'Form below' : 'Form beside', `${nice(e.sections)} bands`];
  if (slot === 'contact') return [`${nice(e.hero)} hero`, `${nice(e.contactLayout)} layout`, `${nice(e.cards)} cards`];
  return [`${nice(v.hero)} hero`, `${nice(v.header)} header`, `${nice(v.cards)} cards`];
}

// the Configuration was saved: the design variants are read again the next time they are shown (and redrawn with the new settings)
window.studioInvalidate = () => { SD.data = null; };

window.studioOpen = async (view) => {
  if (view !== 'composer') document.body.classList.remove('cp-focus');
  else if (SD.page) document.body.classList.add('cp-focus');
  if (view !== 'variants' && view !== 'composer') return;
  await studioLoad();
  if (view === 'variants') renderVariants(); else composerStart();
};

async function studioLoad(force) {
  if (!slug) return;
  if (!force && SD.slug === slug && SD.data) return;
  if (SD.slug !== slug) { SD.page = null; SD.sel = null; SD.compare.clear(); }
  SD.data = await sapi('');
  SD.slug = slug;
  if (SD.data.job?.running) watchStudioJob();
  else if (SD.data.job && !SD.data.job.finishedSeen) showStudioJob(SD.data.job);
}

// ================= jobs =================
function showStudioJob(j) {
  const p = panel('jp-studio');
  const errors = j.error ? [j.error] : [];
  if (j.running) p.set({ state: 'running', title: j.label, detail: j.phase, done: j.done, total: j.total, startedAt: j.startedAt });
  else p.set({ state: j.error ? 'failed' : 'done', title: j.label, detail: j.error ? 'The task did not finish.' : 'Finished', errors, startedAt: j.startedAt, finishedAt: j.finishedAt });
}
function watchStudioJob() {
  clearInterval(SD.poll);
  SD.poll = setInterval(async () => {
    const j = await sapi('/job').catch(() => null);
    if (!j) return;
    showStudioJob(j);
    if (!j.running) { clearInterval(SD.poll); await studioLoad(true); renderVariants(); if (!j.error) toast('Done'); else toast(j.error, true); }
  }, 1200);
}
async function runJob(path, body) {
  panel('jp-studio').set({ state: 'running', title: 'Working…', detail: 'Starting' });
  const j = await sapi(path, { method: 'POST', body: body || {} });
  showStudioJob(j);
  watchStudioJob();
}

// a small "type something" dialog
function askText({ title, label, ok = 'Go', value = '', rows = 3 }) {
  return new Promise((done) => {
    $('svr-title').textContent = title; $('svr-label').innerHTML = label; $('svr-ok').textContent = ok; $('svr-text').value = value; $('svr-text').rows = rows;
    const dlg = $('sv-prompt');
    const finish = (v) => { dlg.close(); done(v); };
    $('svr-cancel').onclick = () => finish(null);
    $('svr-form').onsubmit = (e) => { e.preventDefault(); finish($('svr-text').value.trim()); };
    dlg.showModal(); $('svr-text').focus();
  });
}

// ================= design variants =================
function renderBrief() {
  const b = SD.data.brief, box = $('sv-brief');
  box.innerHTML = '';
  if (!b) { box.append(el('p', 'No brief yet. It is written automatically from your home page when you generate variants.', 'hint')); return; }
  const a = b.ai || {};
  const row = (k, v) => { const p = el('p'); p.innerHTML = `<b>${sesc(k)}:</b> ${sesc(v)}`; box.append(p); };
  row('Business', `${a.industry || '—'} (${a.businessType || '—'})`); row('Audience', a.audience || '—'); row('Main goal', a.conversionGoal || '—');
  const dirs = el('div', undefined, 'chips2');
  dirs.append(el('b', 'Art directions: '));
  (a.directions || []).forEach((d) => dirs.append(el('span', SD.data.meta.directions[d]?.name || d)));
  (a.tone || []).slice(0, 4).forEach((t) => dirs.append(el('span', t)));
  box.append(dirs);
  if (a.risks?.length) row('Watch for', a.risks.join('; '));
  const keep = el('p'); keep.innerHTML = `<b>Kept exactly:</b> ${sesc((b.preserve || []).join(' · '))}`; box.append(keep);
  // the palette and fonts in use, read-only: they are set on the Configuration tab
  const t = tp.state?.spec?.tokens;
  const pal = el('div', undefined, 'sv-pal');
  (SD.data.palette || []).map((p) => [p.name, p.hex]).forEach(([n, c]) => {
    const chip = el('span', undefined, 'sv-chip'); const i = document.createElement('i'); i.style.background = c; chip.append(i, document.createTextNode(`${n} ${c}`)); pal.append(chip);
  });
  if (t) pal.append(el('span', `${t.fontHeading} / ${t.fontBody}`, 'sv-chip'));
  box.append(pal);
  if (b.userBrief) { const w = el('p'); w.innerHTML = `<b>Your wishes:</b> ${sesc(b.userBrief)}`; box.append(w); }
}

const scoreClass = (n) => (n == null ? 'none' : n >= 90 ? '' : n >= 75 ? 'mid' : 'low');

function renderVariants() {
  if (!SD.data) return;
  renderBrief();
  const grid = $('sv-grid');
  grid.innerHTML = '';
  const list = SD.data.variants;
  if (!slotsOf().includes(SD.slotView)) SD.slotView = 'home';
  slotSeg($('sv-slotseg'), SD.slotView, (s) => { SD.slotView = s; renderVariants(); });
  $('sv-more').disabled = !list.length;
  $('sv-recheck').disabled = !list.length;
  $('sv-compare').disabled = SD.compare.size < 2;
  $('sv-compare').textContent = SD.compare.size ? `Compare (${SD.compare.size})` : 'Compare';
  // the colours of the selected theme changed since these were drawn: redraw them once, automatically
  const stale = list.filter((v) => v.stale);
  if (stale.length && !SD.data.job?.running && SD.autoKey !== SD.slug + stale.map((v) => v.id + v.at).join()) {
    SD.autoKey = SD.slug + stale.map((v) => v.id + v.at).join();
    toast('The theme colours changed. Redrawing the variants…');
    runJob('/recheck', { staleOnly: true });
  }
  if (!list.length) { grid.append(el('div', 'No variants yet. Press “Generate 4 variants” to create four different designs of your home page.', 'cp-empty')); return; }
  list.forEach((v) => {
    const c = el('div', undefined, 'sv-card');
    const cover = el('button', undefined, 'sv-cover'); cover.type = 'button'; cover.setAttribute('aria-label', 'Preview ' + v.name);
    const slotCover = SD.slotView === 'home' ? v.cover : v.slots?.[SD.slotView]?.cover;
    if (slotCover) { const im = document.createElement('img'); im.src = coverUrl(v, SD.slotView); im.alt = `${v.name}: ${SLOT_LABEL[SD.slotView]}`; im.loading = 'lazy'; cover.append(im); } else cover.append(el('div', v.error ? 'Preview failed: ' + v.error : SD.slotView === 'home' ? 'No preview yet' : (v.slots?.[SD.slotView]?.error || 'No preview of this page yet. Press “Re-check all”.'), 'cp-empty'));
    cover.onclick = () => openVariantPreview(v.id, SD.slotView);
    const body = el('div', undefined, 'sv-body');
    const top = el('div', undefined, 'sv-top');
    const q = slotQa(v, SD.slotView);
    const score = el('span', q ? String(q.total) : '—', 'sv-score ' + scoreClass(q?.total));
    score.title = q ? `${SLOT_LABEL[SD.slotView]}: quality score ${q.total}/100. ${q.issues.length ? q.issues.slice(0, 3).map((i) => i.message).join(' • ') : 'No issues found.'}` : 'Not checked yet';
    top.append(el('b', v.name), score);
    const facts = el('div', undefined, 'sv-facts');
    [...slotFacts(v, SD.slotView), v.fonts[0]].forEach((t) => facts.append(el('span', t)));
    const dots = el('span', undefined, 'sv-dots');
    v.colours.forEach((col) => { const i = document.createElement('i'); i.style.background = col; dots.append(i); });
    facts.append(dots);
    const acts = el('div', undefined, 'sv-actions');
    const prev = el('button', 'Preview', 'btn ghost sm2'); prev.type = 'button'; prev.onclick = () => openVariantPreview(v.id, SD.slotView);
    const pri = el('button', 'Select as primary', 'btn sm2'); pri.type = 'button'; pri.onclick = () => busy(pri, () => makePageFromVariant(v.id));
    const chk = el('label', undefined, 'sv-check'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = SD.compare.has(v.id);
    cb.onchange = () => { if (cb.checked) { if (SD.compare.size >= 4) { cb.checked = false; toast('Compare up to four variants', true); return; } SD.compare.add(v.id); } else SD.compare.delete(v.id); renderVariants(); };
    chk.append(cb, document.createTextNode('Compare'));
    const more = document.createElement('details'); more.className = 'sv-menu';
    const sum = el('summary', 'More', 'btn ghost sm2'); const menu = el('div');
    const item = (label, fn, cls) => { const b = el('button', label, cls); b.type = 'button'; b.onclick = () => { more.open = false; fn(); }; menu.append(b); };
    item('View its sections', () => openLibrary({ title: `Sections of “${v.name}”`, variant: v.id, mode: 'browse' }));
    item('Regenerate…', async () => { const t = await askText({ title: `Regenerate “${v.name}”`, label: 'What should be different? <small>optional, e.g. “calmer colours, larger headings”</small>', ok: 'Regenerate' }); if (t !== null) runJob(`/variants/${v.id}/regenerate`, { instruction: t }).catch((e) => toast(e.message, true)); });
    item('Duplicate', async () => { await sapi(`/variants/${v.id}/duplicate`, { method: 'POST', body: {} }); await studioLoad(true); renderVariants(); toast('Duplicated'); });
    item('Rename…', async () => { const t = await askText({ title: 'Rename variant', label: 'Name', value: v.name, ok: 'Save', rows: 1 }); if (t) { await sapi(`/variants/${v.id}`, { method: 'PUT', body: { name: t } }); await studioLoad(true); renderVariants(); } });
    v.revisions.slice(-3).reverse().forEach((r) => item(`Restore: ${r.label} (${new Date(r.at).toLocaleDateString()})`, () => runJob(`/variants/${v.id}/restore`, { index: r.i }).catch((e) => toast(e.message, true))));
    item('Delete', async () => { if (!confirm(`Delete the variant “${v.name}”? Pages already composed from it are not affected.`)) return; await sapi(`/variants/${v.id}`, { method: 'DELETE' }); SD.compare.delete(v.id); await studioLoad(true); renderVariants(); }, 'danger');
    more.append(sum, menu);
    acts.append(prev, pri, more, chk);
    body.append(top, el('small', (SD.data.meta.directions[v.direction]?.name || v.direction), 'sv-dir'), el('p', v.description), facts, acts);
    c.append(cover, body);
    grid.append(c);
  });
}

async function makePageFromVariant(id) {
  const p = await sapi('/pages', { method: 'POST', body: { fromVariant: id } });
  await studioLoad(true);
  showView('composer');
  await openPage(p.id);
}

// the variants read colours and wishes from the saved Configuration, so unsaved edits there are saved first
async function saveConfigFirst() { if (tp.dirty) { await saveConfig('Saved before generating design variants'); toast('Configuration saved first'); } }

$('sv-gen').onclick = (e) => busy(e.target, async () => {
  if (SD.data?.variants.length && !confirm('Generate four more variants? Your existing variants stay.')) return;
  await saveConfigFirst();
  await runJob('/variants', { count: 4 });
});
$('sv-more').onclick = (e) => busy(e.target, async () => {
  const t = await askText({ title: 'Generate more variants', label: 'Any direction to follow? <small>optional, e.g. “something darker and more premium”</small>', ok: 'Generate 2 more' });
  if (t !== null) { await saveConfigFirst(); await runJob('/variants', { count: 2, instruction: t }); }
});
$('sv-recheck').onclick = (e) => busy(e.target, () => runJob('/recheck', {}));
$('sv-to-config').onclick = () => showView('config');

// ---- full-page preview of one variant ----
function qaPanel(qa, box) {
  box.innerHTML = '';
  if (!qa) { box.append(el('p', 'This design has not been checked yet.', 'hint')); return; }
  const head = el('div', undefined, 'sv-top'); head.append(el('b', `Quality score ${qa.total} / 100`), el('span', String(qa.total), 'sv-score ' + scoreClass(qa.total)));
  box.append(head);
  const bars = el('div', undefined, 'qa-bars');
  Object.entries(qa.parts).forEach(([k, n]) => {
    const r = el('div', undefined, 'qa-bar'), t = el('div', undefined, 'track'), i = document.createElement('i');
    i.style.width = n + '%'; i.style.background = n >= 90 ? '#10b981' : n >= 75 ? '#f59e0b' : '#ef4444'; t.append(i);
    r.append(el('span', `${nice(k)} (${qa.weights?.[k] ?? ''}%)`), t, el('span', String(n)));
    bars.append(r);
  });
  box.append(bars);
  box.append(el('h3', qa.issues.length ? `What to improve (${qa.issues.length})` : 'No issues found'));
  qa.issues.forEach((i) => { const d = el('div', undefined, 'qa-issue ' + i.severity); d.innerHTML = `${sesc(i.message)}${i.viewport ? ` <small>· ${sesc(i.viewport)}</small>` : ''}`; box.append(d); });
  box.append(el('small', 'The score comes from measured checks of the drawn page (hierarchy, spacing, type, images, responsiveness, consistency, accessibility). It guides improvement; it does not guarantee expert-level design.', 'hint'));
}

async function openVariantPreview(id, slot = 'home') {
  const v = vById(id);
  if (!slotsOf().includes(slot)) slot = 'home';
  SD.pSlot = slot;
  slotSeg($('svp-slot'), slot, (s) => openVariantPreview(id, s));
  $('svp-title').textContent = v.name;
  const pq = slotQa(v, slot);
  $('svp-score').textContent = pq ? `${SLOT_LABEL[slot]} · score ${pq.total}` : 'Not checked'; $('svp-score').className = 'badge ' + (pq?.total >= 90 ? 'approved' : 'draft');
  qaPanel(pq, $('svp-side'));
  const side = $('svp-side');
  const use = el('button', 'Select as primary', 'btn'); use.type = 'button'; use.style.marginTop = '10px'; use.onclick = () => busy(use, async () => { $('sv-preview').close(); await makePageFromVariant(id); });
  side.prepend(el('p', v.description, 'hint'), use);
  $('svp-frame').srcdoc = '<p style="font:14px system-ui;padding:20px">Drawing the page…</p>';
  if (!$('sv-preview').open) $('sv-preview').showModal();
  document.querySelectorAll('#svp-dev button').forEach((x, k) => x.classList.toggle('on', k === 0));
  fitPreview();
  try {
    const full = await sapi(`/variants/${id}`);
    const r = await sapi('/render', { method: 'POST', body: { spec: full.spec, page: full.page, editor: false, slot } });
    if (SD.pSlot === slot) $('svp-frame').srcdoc = r.html;
  } catch (e) { $('svp-frame').srcdoc = `<p style="font:14px system-ui;padding:20px;color:#b91c1c">${sesc(e.message)}</p>`; }
}
$('svp-close').onclick = () => $('sv-preview').close();
const fitPreview = () => fitFrame(document.querySelector('.svp-stage'), $('svp-wrap'), document.querySelector('#svp-dev button.on')?.dataset.w || '100%');
$('svp-dev').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#svp-dev button').forEach((x) => x.classList.toggle('on', x === b)); fitPreview(); };

// ---- compare ----
$('sv-compare').onclick = () => { SD.cslot = SD.slotView; renderCompare(); $('sv-compare-dlg').showModal(); };
function renderCompare() {
  const ids = [...SD.compare], list = ids.map(vById).filter(Boolean);
  slotSeg($('svc-slot'), SD.cslot, (s) => { SD.cslot = s; renderCompare(); });
  const body = $('svc-body'); body.innerHTML = '';
  const grid = el('div', undefined, 'svc-grid'); grid.style.gridTemplateColumns = `repeat(${list.length}, minmax(0, 1fr))`;
  const facts = (v) => [['Direction', SD.data.meta.directions[v.direction]?.name || v.direction], ['Hero', nice(v.hero)], ['Header', nice(v.header)], ['Footer', nice(v.footer)], ['Cards', nice(v.cards)], ['Fonts', v.fonts.join(' / ')], ['Section order', v.sections.map((s) => nice(typeOf(s.ref))).join(' → ')], ...(SD.cslot === 'home' ? [] : [[`${SLOT_LABEL[SD.cslot]} design`, slotFacts(v, SD.cslot).join(' · ')]]), ['Quality score', slotQa(v, SD.cslot) ? String(slotQa(v, SD.cslot).total) : '—']];
  const rows = list.map(facts);
  list.forEach((v, c) => {
    const col = el('div', undefined, 'svc-col');
    if (SD.cslot === 'home' ? v.cover : v.slots?.[SD.cslot]?.cover) { const im = document.createElement('img'); im.src = coverUrl(v, SD.cslot); im.alt = ''; col.append(im); }
    col.append(el('b', v.name));
    const dl = document.createElement('dl');
    rows[c].forEach(([k, val], r) => {
      const different = rows.some((o) => o[r][1] !== val);
      const dt = el('dt', k), dd = el('dd'); const sp = el('span', val, different && k !== 'Quality score' ? 'diff' : ''); dd.append(sp);
      dl.append(dt, dd);
    });
    col.append(dl);
    const use = el('button', 'Select as primary', 'btn sm2'); use.type = 'button'; use.style.marginTop = '8px'; use.onclick = () => busy(use, async () => { $('sv-compare-dlg').close(); await makePageFromVariant(v.id); });
    col.append(use);
    grid.append(col);
  });
  body.append(grid, el('small', 'Highlighted values differ between the variants.', 'hint'));
}
$('svc-close').onclick = () => $('sv-compare-dlg').close();

// ================= section library =================
const LIB = { opts: null };
function libEntries() {
  const saved = (SD.data.saved || []).map((e) => ({ ...e, saved: true }));
  return [...SD.data.library, ...saved.filter((s) => !SD.data.library.some((l) => l.id === s.id))];
}
function openLibrary(opts) {
  LIB.opts = { group: '', q: '', variant: opts.variant || '', own: false, ...opts };
  $('svl-title').textContent = opts.title || 'Section library';
  $('svl-sub').textContent = opts.sub || '';
  const sel = $('svl-variant');
  sel.innerHTML = '';
  sel.add(new Option('All variants', ''));
  SD.data.variants.forEach((v) => sel.add(new Option(v.name, v.id)));
  sel.add(new Option('Saved for reuse', 'saved'));
  sel.value = LIB.opts.variant;
  $('svl-q').value = '';
  $('svl-own').checked = false;
  $('svl-own').closest('label').hidden = opts.mode === 'browse';
  renderLibrary();
  $('sv-lib').showModal();
}
function renderLibrary() {
  const o = LIB.opts;
  const groups = $('svl-groups');
  groups.innerHTML = '';
  const all = libEntries().filter((e) => (!o.type || e.type === o.type || (o.type === 'hero' && e.type === 'hero')) && (!o.ref || e.ref === o.ref || !o.refOnly));
  const present = new Set(all.map((e) => e.group));
  const gb = (key, label) => { const b = el('button', label, o.group === key ? 'on' : ''); b.type = 'button'; b.onclick = () => { o.group = key; renderLibrary(); }; groups.append(b); };
  gb('', 'All');
  SD.data.meta.groups.filter(([k]) => present.has(k)).forEach(([k, label]) => gb(k, label));
  const q = $('svl-q').value.trim().toLowerCase();
  const sel = $('svl-variant').value;
  const list = all.filter((e) => (!o.group || e.group === o.group) && (!sel || (sel === 'saved' ? e.saved : e.variant === sel)) && (!q || `${e.label} ${e.style} ${e.type} ${e.variantName}`.toLowerCase().includes(q)));
  const grid = $('svl-grid');
  grid.innerHTML = '';
  if (!list.length) grid.append(el('div', 'No sections match.', 'cp-empty'));
  list.slice(0, 120).forEach((e) => {
    const v = vById(e.variant);
    const c = el('div', undefined, 'svl-card');
    if (e.thumb) { const im = document.createElement('img'); im.src = thumbUrl(e.variant, e.secId, v?.at); im.alt = ''; im.loading = 'lazy'; c.append(im); } else c.append(el('div', 'No preview', 'ph'));
    const b = el('div', undefined, 'b');
    b.append(el('b', e.label), el('small', `${nice(e.type === 'hero' ? 'hero' : (SD.data.meta.types[e.type]?.label || e.type))} · ${nice(e.style)} · ${e.variantName || 'Saved'}`));
    const acts = el('div', undefined, 'acts');
    if (o.mode !== 'browse') { const use = el('button', o.mode === 'replace' ? 'Use this' : 'Add to page', 'btn sm2'); use.type = 'button'; use.onclick = () => { $('sv-lib').close(); o.onPick(e, $('svl-own').checked); }; acts.append(use); }
    const sv = el('button', e.saved ? 'Remove from saved' : 'Save for reuse', 'btn ghost sm2'); sv.type = 'button';
    sv.onclick = () => busy(sv, async () => { SD.data.saved = e.saved ? await sapi(`/saved/${encodeURIComponent(e.id)}`, { method: 'DELETE' }) : await sapi('/saved', { method: 'POST', body: { entry: { ...e, saved: undefined } } }); renderLibrary(); toast(e.saved ? 'Removed' : 'Saved for reuse'); });
    acts.append(sv);
    b.append(acts); c.append(b); grid.append(c);
  });
}
$('svl-q').oninput = () => LIB.opts && renderLibrary();
$('svl-variant').onchange = () => { if (LIB.opts) { LIB.opts.variant = $('svl-variant').value; renderLibrary(); } };
$('svl-close').onclick = () => $('sv-lib').close();

// ================= composer =================
function composerStart() {
  if (!SD.data) return;
  const showEditor = Boolean(SD.page);
  $('cp-start').hidden = showEditor;
  $('cp-editor').hidden = !showEditor;
  if (showEditor) return;
  const list = $('cp-list'); list.innerHTML = '';
  if (!SD.data.pages.length) list.append(el('div', 'No templates yet. Start from a variant below.', 'hint'));
  SD.data.pages.forEach((p) => {
    const it = el('div', undefined, 'cp-item');
    const v = vById(p.from);
    if (v?.cover) { const im = document.createElement('img'); im.src = thumbUrl(v.id, '_cover', v.at); im.alt = ''; it.append(im); }
    const t = el('div', undefined, 't'); t.append(el('b', p.name), el('small', `${p.sections} sections · ${p.revisions} revisions${p.qa ? ` · score ${p.qa.total}` : ''}`));
    const open = el('button', 'Open', 'btn sm2'); open.type = 'button'; open.onclick = () => openPage(p.id);
    const dup = el('button', 'Duplicate', 'btn ghost sm2'); dup.type = 'button'; dup.onclick = () => busy(dup, async () => { await sapi(`/pages/${p.id}/duplicate`, { method: 'POST', body: {} }); await studioLoad(true); composerStart(); });
    const del = el('button', 'Delete', 'btn ghost sm2 danger'); del.type = 'button'; del.onclick = () => busy(del, async () => { if (!confirm(`Delete the template “${p.name}”?`)) return; await sapi(`/pages/${p.id}`, { method: 'DELETE' }); await studioLoad(true); composerStart(); });
    const acts = el('div', undefined, 'acts'); acts.append(open, dup, del);
    it.append(t, acts);
    list.append(it);
  });
  const from = $('cp-from'); from.innerHTML = '';
  if (!SD.data.variants.length) from.append(el('div', 'Generate design variants first (Design variants tab).', 'hint'));
  SD.data.variants.forEach((v) => {
    const it = el('div', undefined, 'cp-item');
    if (v.cover) { const im = document.createElement('img'); im.src = thumbUrl(v.id, '_cover', v.at); im.alt = ''; it.append(im); }
    const t = el('div', undefined, 't'); t.append(el('b', v.name), el('small', SD.data.meta.directions[v.direction]?.name || v.direction));
    const go = el('button', 'Start', 'btn sm2'); go.type = 'button'; go.onclick = () => busy(go, () => makePageFromVariant(v.id));
    const acts = el('div', undefined, 'acts'); acts.append(go);
    it.append(t, acts);
    from.append(it);
  });
}
$('cp-new-blank').onclick = (e) => busy(e.target, async () => { const p = await sapi('/pages', { method: 'POST', body: { name: 'New template' } }); await studioLoad(true); await openPage(p.id); });

async function openPage(id) {
  const p = await sapi(`/pages/${id}`);
  SD.page = { id: p.id, name: p.name, spec: p.spec, page: p.page };
  SD.hist = [JSON.stringify({ spec: SD.page.spec, page: SD.page.page })];
  SD.hi = 0; SD.sel = null; SD.proposal = null; SD.qa = null; SD.scrollY = 0; SD.slot = 'home'; SD.outlines = {};
  $('cp-qapanel').hidden = true;
  $('cp-name').value = p.name;
  document.body.classList.add('cp-focus');
  composerStart();
  applyDevice();
  renderAll();
}

const snapshot = () => JSON.stringify({ spec: SD.page.spec, page: SD.page.page });
function restoreSnapshot(s) { const o = JSON.parse(s); SD.page.spec = o.spec; SD.page.page = o.page; }

// every change goes through here: one history step, a delayed save, a redraw
function commit(label, mutate) {
  mutate(SD.page);
  SD.hist = SD.hist.slice(0, SD.hi + 1);
  SD.hist.push(snapshot());
  if (SD.hist.length > 80) SD.hist.shift();
  SD.hi = SD.hist.length - 1;
  SD.proposal = null;
  scheduleSave(label);
  renderAll();
}
function undo() { if (SD.hi > 0) { SD.hi -= 1; restoreSnapshot(SD.hist[SD.hi]); scheduleSave('Undo'); renderAll(); } }
function redo() { if (SD.hi < SD.hist.length - 1) { SD.hi += 1; restoreSnapshot(SD.hist[SD.hi]); scheduleSave('Redo'); renderAll(); } }
$('cp-undo').onclick = undo; $('cp-redo').onclick = redo;
document.addEventListener('keydown', (e) => {
  if ($('cp-editor').hidden || $('td-view-composer').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
});

function scheduleSave(label) {
  $('cp-state').textContent = 'Unsaved changes…';
  clearTimeout(SD.saveTimer);
  SD.saveTimer = setTimeout(() => saveNow(label), 1200);
}
async function saveNow(label = 'Saved') {
  if (!SD.page) return;
  clearTimeout(SD.saveTimer);
  $('cp-state').textContent = 'Saving…';
  try {
    await sapi(`/pages/${SD.page.id}`, { method: 'PUT', body: { name: SD.page.name, spec: SD.page.spec, page: SD.page.page, label } });
    $('cp-state').textContent = 'All changes saved';
    const row = SD.data.pages.find((x) => x.id === SD.page.id); if (row) { row.name = SD.page.name; row.sections = SD.page.page.sections.length; }
  } catch (e) { $('cp-state').textContent = 'Not saved: ' + e.message; }
}
$('cp-name').onchange = () => { SD.page.name = $('cp-name').value.trim() || SD.page.name; scheduleSave('Renamed'); };
$('cp-close').onclick = async () => { await saveNow(); document.body.classList.remove('cp-focus'); SD.page = null; SD.sel = null; await studioLoad(true); composerStart(); };

function renderAll() {
  $('cp-undo').disabled = SD.hi <= 0; $('cp-redo').disabled = SD.hi >= SD.hist.length - 1;
  slotSeg($('cp-slot'), SD.slot, switchSlot);
  $('cp-add').hidden = SD.slot !== 'home';
  renderOutline(); renderInspector(); renderCanvas();
}
// the composer edits the home page, the inner page and the contact page; header, footer and the theme are shared by all three
function switchSlot(s) {
  if (s === SD.slot) return;
  settleProposal();
  SD.slot = s; SD.sel = null; SD.proposal = null; SD.scrollY = 0;
  renderAll();
}

// ---- canvas ----
async function renderCanvas(pageOverride, specPatch) {
  const token = ++SD.token;
  const slot = SD.slot;
  $('cp-state').dataset.busy = '1';
  try {
    const frame = $('cp-frame');
    try { SD.scrollY = frame.contentWindow?.scrollY || SD.scrollY; } catch { /* the first draw has no document yet */ }
    const r = await sapi('/render', { method: 'POST', body: { spec: specPatch ? { ...SD.page.spec, ...specPatch } : SD.page.spec, page: pageOverride || SD.page.page, slot } });
    if (token !== SD.token) return;
    if (r.file) SD.files[slot] = r.file;
    if (r.outline) { SD.outlines[slot] = r.outline; if (SD.slot === slot) renderOutline(); }
    frame.srcdoc = r.html;
    $('cp-state').title = r.contentFails.length ? 'Original content is missing: ' + r.contentFails[0] : '';
    if (r.contentFails.length) toast('Some original content is no longer on the page: ' + r.contentFails[0], true);
  } catch (e) { toast(e.message, true); }
}
window.addEventListener('message', (ev) => {
  const d = ev.data || {};
  if (d.type === 'studio-select' && SD.page && !$('td-view-composer').hidden) { if (d.id !== SD.sel) settleProposal(); SD.sel = d.id; SD.proposal = null; renderOutline(); renderInspector(); }
  if (d.type === 'studio-ready') {
    const w = $('cp-frame').contentWindow;
    try { w.scrollTo(0, SD.scrollY); } catch { /* ignore */ }
    if (SD.sel) w.postMessage({ type: 'studio-mark', id: SD.sel }, '*');
  }
});
function selectSection(id) { if (id !== SD.sel) settleProposal(); SD.sel = id; SD.proposal = null; renderOutline(); renderInspector(); $('cp-frame').contentWindow?.postMessage({ type: 'studio-mark', id, scroll: true }, '*'); }
// draws a frame at the true width of the chosen device and scales it down to fit its stage
const DEVICE_PX = { '100%': 1440, '820px': 820, '390px': 390 };
function fitFrame(stage, wrap, device, zoom = 1) {
  const dw = DEVICE_PX[device] || 1440;
  // the editor can still be hidden or unlaid-out when this runs: wait until the stage has a width instead of drawing a negative scale
  if (stage.clientWidth < 100) { requestAnimationFrame(() => { if (stage.clientWidth >= 100) fitFrame(stage, wrap, device, zoom); }); return; }
  const avail = stage.clientWidth - 24;
  const scale = Math.max(0.1, Math.min(1, avail / dw) * zoom);
  wrap.style.width = dw + 'px';
  wrap.style.height = (stage.clientHeight - 24) / scale + 'px';
  wrap.style.transform = `scale(${scale})`;
  wrap.style.transformOrigin = 'top left';
  wrap.style.marginLeft = Math.max(0, (avail - dw * scale) / 2) + 'px';
}
function applyDevice() {
  fitFrame(document.querySelector('#cp-editor .cp-stage'), $('cp-wrap'), document.querySelector('#cp-dev button.on')?.dataset.w || '100%', Number($('cp-zoom').value) / 100);
}
window.addEventListener('resize', () => { if (SD.page && !$('td-view-composer').hidden) applyDevice(); });
// the stage changes size when the editor opens, the side panels change or the window is resized: the canvas follows
new ResizeObserver(() => { if (SD.page && !$('td-view-composer').hidden && !$('cp-editor').hidden) applyDevice(); }).observe(document.querySelector('#cp-editor .cp-stage'));
$('cp-dev').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#cp-dev button').forEach((x) => x.classList.toggle('on', x === b)); applyDevice(); };
$('cp-zoom').oninput = applyDevice;

// ---- outline ----
const secLabel = (s) => {
  const inv = SD.data.brief?.inventory?.sections?.find((x) => x.ref === s.ref);
  return s.content?.title || inv?.title || SD.data.meta.types[typeOf(s.ref)]?.label || s.ref;
};
// inner and contact pages: the sections the page's own content produced (they are not reordered, only restyled)
function renderSlotOutline() {
  const ul = $('cp-outline');
  ul.innerHTML = '';
  const P = SD.page.page;
  const row = (id, label, sub, grip) => {
    const li = el('li', undefined, 'cp-row pinned' + (SD.sel === id ? ' sel' : ''));
    const nm = el('div', undefined, 'nm'); nm.append(el('b', label), el('small', sub));
    nm.onclick = () => selectSection(id);
    li.append(el('span', grip, 'grip'), nm);
    return li;
  };
  ul.append(row('header', 'Header and navigation', `${nice(P.header.variant || SD.page.spec.layout.header)} · shared`, '▤'));
  const list = SD.outlines[SD.slot];
  if (!list) ul.append(el('li', 'Drawing the page…', 'hint'));
  (list || []).forEach((o, i) => ul.append(row(o.id, o.label, i === 0 ? 'Page heading' : `Section ${i + 1}`, '▭')));
  ul.append(row('footer', 'Footer', `${nice(P.footer.variant || SD.page.spec.layout.footer)} · shared`, '▤'));
}
function renderOutline() {
  if (SD.slot !== 'home') return renderSlotOutline();
  const ul = $('cp-outline');
  ul.innerHTML = '';
  const P = SD.page.page;
  const fixedRow = (id, label, style) => {
    const li = el('li', undefined, 'cp-row pinned' + (SD.sel === id ? ' sel' : ''));
    const nm = el('div', undefined, 'nm'); nm.append(el('b', label), el('small', nice(style)));
    nm.onclick = () => selectSection(id);
    li.append(el('span', '▤', 'grip'), nm);
    return li;
  };
  ul.append(fixedRow('header', 'Header and navigation', P.header.variant || SD.page.spec.layout.header));
  P.sections.forEach((s, i) => {
    const li = el('li', undefined, 'cp-row' + (SD.sel === s.id ? ' sel' : '') + (s.hidden ? ' hid' : ''));
    li.dataset.i = i;
    li.draggable = !s.locked;
    const grip = el('span', '⠿', 'grip'); grip.title = s.locked ? 'Locked' : 'Drag to reorder';
    const nm = el('div', undefined, 'nm'); nm.append(el('b', secLabel(s)), el('small', `${SD.data.meta.types[typeOf(s.ref)]?.label || ''} · ${nice(s.variant || SD.page.spec.layout.hero)}`));
    nm.onclick = () => selectSection(s.id);
    const btn = (txt, title, fn, on) => { const b = el('button', txt, on ? 'on' : ''); b.type = 'button'; b.title = title; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
    li.append(grip, nm,
      btn(s.hidden ? '◌' : '◉', s.hidden ? 'Show this section' : 'Hide this section', () => toggleHidden(s), s.hidden),
      btn(s.locked ? '🔒' : '🔓', s.locked ? 'Unlock' : 'Lock (cannot be moved or deleted)', () => commit(s.locked ? 'Unlock section' : 'Lock section', () => { s.locked = !s.locked; }), s.locked),
      btn('⧉', 'Duplicate', () => duplicateSection(s)),
      btn('✕', 'Remove', () => removeSection(s)));
    li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); });
    li.addEventListener('dragend', () => { li.classList.remove('dragging'); document.querySelectorAll('.cp-row.over').forEach((x) => x.classList.remove('over')); });
    li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('over'); });
    li.addEventListener('dragleave', () => li.classList.remove('over'));
    li.addEventListener('drop', (e) => {
      e.preventDefault(); li.classList.remove('over');
      const from = Number(e.dataTransfer.getData('text/plain')), to = i;
      if (Number.isNaN(from) || from === to) return;
      commit('Reorder sections', (pg) => { const [m] = pg.page.sections.splice(from, 1); pg.page.sections.splice(to, 0, m); });
    });
    ul.append(li);
  });
  ul.append(fixedRow('footer', 'Footer', P.footer.variant || SD.page.spec.layout.footer));
}

// is this the only place on the page where this piece of the site's content appears?
const lastOfRef = (s) => SD.page.page.sections.filter((x) => x.ref === s.ref && !x.hidden).length <= 1;
function removeSection(s) {
  if (s.locked) return toast('This section is locked', true);
  if (lastOfRef(s) && !confirm(`“${secLabel(s)}” is the only place this content appears on the home page. Removing it takes that content off the page. Remove it anyway?`)) return;
  commit('Remove section', (pg) => { pg.page.sections = pg.page.sections.filter((x) => x.id !== s.id); });
  if (SD.sel === s.id) SD.sel = null;
}
function toggleHidden(s) {
  if (!s.hidden && lastOfRef(s) && !confirm(`Hiding “${secLabel(s)}” takes its content off the home page. Hide it anyway?`)) return;
  commit(s.hidden ? 'Show section' : 'Hide section', () => { s.hidden = !s.hidden; });
}
function duplicateSection(s) {
  commit('Duplicate section', (pg) => { const c = clone(s); c.id = uid(); c.locked = false; const i = pg.page.sections.findIndex((x) => x.id === s.id); pg.page.sections.splice(i + 1, 0, c); SD.sel = c.id; });
}
$('cp-add').onclick = () => openLibrary({ title: 'Add a section', sub: 'Choose any section from any variant. It is added after the selected section.', mode: 'add', onPick: (e, own) => addFromLibrary(e, own) });

function ownTokens(variantId) { const v = vById(variantId); return v ? { ...v.tokens } : null; }
function entryProps(e) { return { bg: 'auto', align: 'auto', spacing: 'normal', head: 'inherit', cards: 'inherit', frame: 'plain', ...(e.props || {}) }; }
function addFromLibrary(e, own) {
  commit('Add section', (pg) => {
    if (e.type === 'header') { pg.page.header = { variant: e.style }; return; }
    if (e.type === 'footer') { pg.page.footer = { variant: e.style }; return; }
    const s = { id: uid(), ref: e.ref, variant: e.style, props: entryProps(e), adapt: own && ownTokens(e.variant) ? 'own' : 'page', own: own ? ownTokens(e.variant) : null, hidden: false, locked: false, content: {} };
    const i = pg.page.sections.findIndex((x) => x.id === SD.sel);
    pg.page.sections.splice(i >= 0 ? i + 1 : pg.page.sections.length, 0, s);
    SD.sel = s.id;
  });
}
function replaceFromLibrary(sec, e, own) {
  commit('Replace section', (pg) => {
    if (sec.id === 'header') { pg.page.header = { variant: e.style }; return; }
    if (sec.id === 'footer') { pg.page.footer = { variant: e.style }; return; }
    const s = pg.page.sections.find((x) => x.id === sec.id);
    s.variant = e.style; s.props = entryProps(e);
    s.adapt = own && ownTokens(e.variant) ? 'own' : 'page'; s.own = own ? ownTokens(e.variant) : null;
  });
}

// ---- inspector ----
function field(label, control) { const f = el('div', undefined, 'f cp-prop'); const l = el('label', label); f.append(l, control); return f; }
function select(list, value, onChange, labels = vl) { const s = document.createElement('select'); list.forEach((o) => s.add(new Option(labels(o), o))); s.value = value; s.onchange = () => onChange(s.value); return s; }
function textInput(value, onChange, rows) { const i = document.createElement(rows ? 'textarea' : 'input'); if (rows) i.rows = rows; i.value = value || ''; i.onchange = () => onChange(i.value.trim()); return i; }

function renderInspector() {
  const box = $('cp-inspector');
  box.innerHTML = '';
  const P = SD.page.page;
  const meta = SD.data.meta;
  if (!SD.sel) { if (SD.slot !== 'home') inspectSlotPage(box); inspectTheme(box); return; }
  if (SD.sel === 'header' || SD.sel === 'footer') {
    const which = SD.sel, key = which;
    box.append(el('h3', which === 'header' ? 'Header and navigation' : 'Footer'));
    box.append(field('Style', select(meta[which], P[key].variant || SD.page.spec.layout[key], (v) => commit(`${nice(which)} style`, (pg) => { pg.page[key] = { variant: v }; }), nice)));
    const rep = el('button', 'Choose from the library…', 'btn ghost sm2'); rep.type = 'button';
    rep.onclick = () => openLibrary({ title: `Replace the ${which}`, mode: 'replace', type: which, onPick: (e) => replaceFromLibrary({ id: which }, e) });
    box.append(rep, htmlButton(which, Boolean(P[key].html)), aiBox(which));
    if (P[key].html) box.append(el('small', `This ${which} was edited by hand, so its style choice above no longer changes it. Open Edit HTML and press Reset to go back to the generated one.`, 'hint'));
    return;
  }
  if (SD.slot !== 'home') { inspectSlotSection(box); return; }
  const s = P.sections.find((x) => x.id === SD.sel);
  if (!s) { SD.sel = null; inspectTheme(box); return; }
  const type = typeOf(s.ref), tmeta = meta.types[type], allowed = meta.propsFor[type] || [];
  box.append(el('h3', secLabel(s)), el('small', tmeta?.label || '', 'hint'));
  if (s.locked) box.append(el('div', 'This section is locked. Unlock it in the outline to change it.', 'note'));
  const set = (label, fn) => commit(label, () => fn(P.sections.find((x) => x.id === s.id)));
  if (allowed.includes('variant')) box.append(field('Layout style', select(tmeta.variant, s.variant || SD.page.spec.layout.hero, (v) => set('Section style', (x) => { x.variant = v; }), nice)));
  allowed.filter((p) => p !== 'variant').forEach((p) => box.append(field(PROP_LABEL[p], select(meta.props[p], s.props[p], (v) => set(`${PROP_LABEL[p]}`, (x) => { x.props[p] = v; })))));
  // wording
  const wording = [['title', 'Heading', 1], ...(['cta', 'hero'].includes(type) ? [['text', 'Supporting text', 2], ['buttonText', 'Button text', 1]] : [])];
  box.append(el('h3', 'Wording'));
  wording.forEach(([k, label, rows]) => { const inp = textInput(s.content[k], (v) => set('Edit wording', (x) => { x.content[k] = v; }), rows > 1 ? rows : 0); inp.placeholder = k === 'title' ? 'Keep the original heading' : 'Keep the original'; box.append(field(label, inp)); });
  box.append(el('small', 'Leave a field empty to keep the original wording.', 'hint'));
  // theme adaptation
  box.append(el('h3', 'Theme'));
  const own = s.adapt === 'own';
  const th = select(['page', 'own'], own ? 'own' : 'page', (v) => set('Section theme', (x) => { if (v === 'page') { x.adapt = 'page'; x.own = null; } else { x.adapt = 'own'; x.own = x.own || { ...SD.page.spec.tokens }; } }), (v) => (v === 'page' ? 'Match this page’s theme' : 'Keep its own look'));
  box.append(field('Colours and fonts', th));
  const rep = el('button', 'Replace with another version…', 'btn ghost sm2'); rep.type = 'button';
  rep.onclick = () => openLibrary({ title: `Alternatives for “${secLabel(s)}”`, sub: 'The same content, designed in each variant.', mode: 'replace', ref: s.ref, refOnly: true, type: type, onPick: (e, own2) => replaceFromLibrary(s, e, own2) });
  box.append(rep, htmlButton(s.id, Boolean(s.html)), aiBox(s.id));
}

const LAYOUT_LABEL = { hero: 'Hero style', sections: 'Section backgrounds', cards: 'Card style', cardLayout: 'Card layout', sectionHead: 'Section headings', innerSidebar: 'Sidebar beside the text', innerForm: 'Enquiry form', contactLayout: 'Contact layout' };
const LAYOUT_VALUE = { innerSidebar: { on: 'Show a sidebar', off: 'No sidebar' }, innerForm: { side: 'Beside the text', below: 'Below the text' }, contactLayout: { split: 'Details beside the form', stacked: 'Details above the form' } };

// whole-page choices for the inner page or the contact page (they apply to every page of that kind)
function inspectSlotPage(box) {
  const slot = SD.slot, meta = SD.data.meta, spec = SD.page.spec;
  box.append(el('h3', `${SLOT_LABEL[slot]} layout`), el('small', `These choices apply to every ${slot === 'inner' ? 'inner' : 'contact'} page of the site. “Same as site-wide” follows the design used on the home page. Click a section on the page to restyle just that section.`, 'hint'));
  (meta.pageLayoutKeys?.[slot] || []).forEach((k) => {
    const cur = spec.pageLayout?.[slot]?.[k] || '';
    const label = (o) => (o === '' ? `Same as site-wide (${LAYOUT_VALUE[k]?.[spec.layout[k]] || nice(spec.layout[k])})` : LAYOUT_VALUE[k]?.[o] || nice(o));
    box.append(field(LAYOUT_LABEL[k] || nice(k), select(['', ...meta.options[k]], cur, (v) => commit(`${SLOT_LABEL[slot]}: ${LAYOUT_LABEL[k]}`, (pg) => {
      pg.spec.pageLayout = clone(pg.spec.pageLayout || { inner: {}, contact: {} });
      pg.spec.pageLayout[slot] = pg.spec.pageLayout[slot] || {};
      if (v) pg.spec.pageLayout[slot][k] = v; else delete pg.spec.pageLayout[slot][k];
    }), label)));
  });
  box.append(aiBox('page'));
}

// one section of an inner or contact page: background, alignment and columns, then the AI box
function inspectSlotSection(box) {
  const slot = SD.slot, id = SD.sel, num = Number(String(id).slice(1));
  const o = (SD.outlines[slot] || []).find((x) => x.id === id);
  box.append(el('h3', o?.label || `Section ${num}`), el('small', `Section ${num} of the ${SLOT_LABEL[slot].toLowerCase()}`, 'hint'));
  const cur = (SD.page.spec.sections || []).find((x) => x.layout === slot && x.index === num) || {};
  const set = (label, patch) => commit(label, (pg) => {
    const list = clone(pg.spec.sections || []).filter((x) => !(x.layout === slot && x.index === num));
    const e = { ...clone(cur), ...patch, layout: slot, index: num, file: SD.files[slot] || cur.file || '' };
    if (e.columns || e.image || e.background || e.align) list.push(e);
    pg.spec.sections = list;
  });
  box.append(el('small', `Changes to this section are made on the sample ${SLOT_LABEL[slot].toLowerCase()} only, because other pages have different sections here. To change every ${slot === 'inner' ? 'inner' : 'contact'} page, click an empty area to deselect and use the page layout options.`, 'hint'));
  box.append(field('Background', select(['', 'white', 'soft', 'dark', 'brand'], cur.background || '', (v) => set('Section background', { background: v }), (v) => (v ? vl(v) : 'Automatic'))));
  box.append(field('Text alignment', select(['', 'center'], cur.align || '', (v) => set('Text alignment', { align: v }), (v) => (v ? 'Centred' : 'Automatic'))));
  box.append(field('Text columns', select(['0', '2', '3'], String(cur.columns || 0), (v) => set('Text columns', { columns: Number(v) }), (v) => (v === '0' ? 'One column' : `${v} columns`))));
  box.append(htmlButton(id, (SD.page.spec.htmlEdits || []).some((e) => e.layout === slot && e.index === num)));
  if (cur.image) { const rm = el('button', 'Remove the image beside the text', 'btn ghost sm2'); rm.type = 'button'; rm.onclick = () => set('Remove image', { image: null }); box.append(rm); }
  box.append(aiBox(id));
}

function inspectTheme(box) {
  const T = SD.page.spec.tokens, meta = SD.data.meta;
  const setT = (label, patch) => commit(label, (pg) => { pg.spec.tokens = { ...pg.spec.tokens, ...patch }; });
  box.append(el('h3', 'Page theme'), el('small', 'Click a section on the page, or in the outline, to edit it. Until then these settings apply to the whole page.', 'hint'));
  const colour = (label, key, extra) => { const i = document.createElement('input'); i.type = 'color'; i.value = T[key]; i.onchange = () => setT(label, { [key]: i.value, ...(extra ? extra(i.value) : {}) }); return field(label, i); };
  box.append(colour('Primary colour', 'primary', (v) => ({ primaryDark: mixHexJs(v, '#000000', 0.5) })), colour('Accent colour', 'accent'));
  const fonts = (kind) => meta.fonts.filter((f) => f[kind]).map((f) => f.name);
  box.append(field('Heading font', select(fonts('heading'), T.fontHeading, (v) => setT('Heading font', { fontHeading: v }), (x) => x)));
  box.append(field('Body font', select(fonts('body'), T.fontBody, (v) => setT('Body font', { fontBody: v }), (x) => x)));
  box.append(field('Corner roundness', select(meta.options.radius, T.radius, (v) => setT('Corners', { radius: v }), nice)));
  box.append(field('Spacing', select(meta.options.density, T.density, (v) => setT('Spacing', { density: v }), nice)));
  box.append(field('Content width', select(meta.options.container, T.container, (v) => setT('Content width', { container: v }), nice)));
  box.append(field('Heading case', select(meta.options.headingCase, T.headingCase, (v) => setT('Heading case', { headingCase: v }), nice)));
  box.append(el('small', 'Sections set to “Match this page’s theme” follow these. Sections that keep their own look are not changed.', 'hint'));
}

// ---- hand-edit the HTML of one section ----
const htmlBody = (id) => ({ spec: SD.page.spec, page: SD.page.page, slot: SD.slot, sectionId: id });
function htmlButton(id, edited) {
  const b = el('button', edited ? 'Edit HTML… (edited by hand)' : 'Edit HTML…', 'btn ghost sm2'); b.type = 'button';
  b.title = 'Change the structure of this section directly: move, wrap or add elements';
  b.onclick = () => editHtml(id);
  return b;
}
async function editHtml(id) {
  const dlg = $('cp-html'), txt = $('cph-text'), err = $('cph-err');
  err.hidden = true; txt.value = 'Loading…'; txt.disabled = true; $('cph-reset').hidden = true;
  $('cph-sub').textContent = id === 'header' || id === 'footer' ? `The ${id} is shared by every page of the site. Links are written from the site root (for example about.html or images/logo.png) and fixed for each page automatically.` : SD.slot === 'home' ? 'Only this section of the home page.' : `This edit is made on the sample ${SLOT_LABEL[SD.slot].toLowerCase()} only; other pages of this kind keep the generated layout.`;
  dlg.showModal();
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  try { const r = await sapi('/section-html', { method: 'POST', body: htmlBody(id) }); txt.value = r.html; $('cph-reset').hidden = !r.edited; } catch (e) { txt.value = ''; fail(e.message); }
  txt.disabled = false;
  const send = async (html) => {
    err.hidden = true;
    const r = await sapi('/html-edit', { method: 'POST', body: { ...htmlBody(id), html } });
    if (!r.ok) return fail(r.error);
    dlg.close();
    commit(html ? 'Edit HTML' : 'Reset HTML', (pg) => { if (r.page) pg.page = r.page; if (r.patch) pg.spec = { ...pg.spec, ...r.patch }; });
    toast(html ? 'HTML saved' : 'Back to the generated HTML');
  };
  $('cph-save').onclick = (e) => busy(e.target, () => send(txt.value));
  $('cph-reset').onclick = (e) => busy(e.target, () => send(''));
  $('cph-close').onclick = () => dlg.close();
}

// ---- AI refinement of the selected section ----
// A suggestion is only a preview until it is accepted. If the person moves on without choosing, ask instead of silently dropping it
// (the preview would stay on the canvas and look applied, and the next suggestion would be built without it).
function proposalName(p) {
  const s = SD.page.page.sections.find((x) => x.id === p.sectionId);
  if (s) return secLabel(s);
  if (p.sectionId === 'page') return 'the whole page';
  if (p.sectionId === 'header' || p.sectionId === 'footer') return 'the ' + p.sectionId;
  return (SD.outlines[SD.slot] || []).find((o) => o.id === p.sectionId)?.label || p.sectionId;
}
function applyProposal(p) {
  commit('AI: ' + (p.instruction || 'refinement').slice(0, 50), (pg) => { if (p.page) pg.page = p.page; const sp = p.patch || (p.tweaks ? { tweaks: p.tweaks } : null); if (sp) pg.spec = { ...pg.spec, ...sp }; });
}
function settleProposal() {
  const p = SD.proposal;
  SD.proposal = null;
  if (!p || (!p.page && !p.patch && !p.tweaks)) return;
  if (confirm('The suggested change to ' + proposalName(p) + ' is only a preview so far.\n\nOK = keep it (apply it now)\nCancel = discard it')) applyProposal(p);
  else renderCanvas();
}

function aiBox(sectionId) {
  const box = el('div', undefined, 'cp-ai');
  box.append(el('b', 'Refine with AI'));
  const ta = document.createElement('textarea'); ta.rows = 3; ta.placeholder = sectionId === 'page' ? 'Describe the page layout you want, e.g. “Dark hero, no sidebar, form below the text”, “Make this page feel more modern”' : 'Describe the layout you want, e.g. “Put the photo on the left and make the text bigger”, “Show the cards in 4 columns with more space”, “Make this feel more premium”';
  const go = el('button', 'Suggest a change', 'btn sm2'); go.type = 'button'; go.style.marginTop = '6px';
  box.append(ta, go);
  const out = el('div'); box.append(out);
  const showProposal = () => {
    out.innerHTML = '';
    const p = SD.proposal;
    if (!p || p.sectionId !== sectionId) return;
    out.append(el('p', p.explanation, 'hint'));
    if (p.cannotDo) out.append(el('div', p.changes.length ? 'Not done: ' + p.cannotDo : p.cannotDo, 'note'));
    if (p.rejected) { out.append(el('div', p.rejected, 'note bad')); return; }
    if (!p.page && !p.patch) { out.append(el('div', 'No change was proposed.', 'note')); return; }
    const ul = el('ul'); p.changes.forEach((c) => ul.append(el('li', c))); out.append(ul);
    out.append(el('div', 'This is a preview. Press Accept to keep it.', 'note'));
    const row = el('div', undefined, 'row');
    const ok = el('button', 'Accept', 'btn sm2'), no = el('button', 'Reject', 'btn ghost sm2'); ok.type = no.type = 'button';
    ok.onclick = () => applyProposal(p);
    no.onclick = () => { SD.proposal = null; renderCanvas(); showProposal(); };
    row.append(ok, no); out.append(row);
  };
  go.onclick = () => busy(go, async () => {
    if (!ta.value.trim()) throw new Error('Describe the change you want');
    go.textContent = 'Thinking…';
    try {
      const r = await sapi('/refine', { method: 'POST', body: { spec: SD.page.spec, page: SD.page.page, sectionId, slot: SD.slot, instruction: ta.value.trim() } });
      SD.proposal = { ...r, instruction: ta.value.trim() };
      if (r.page || r.patch || r.tweaks) renderCanvas(r.page, r.patch || (r.tweaks ? { tweaks: r.tweaks } : null)); // the page is drawn with the proposal so you can judge it before accepting
      showProposal();
    } finally { go.textContent = 'Suggest a change'; }
  });
  showProposal();
  return box;
}

// ---- revisions, quality check, apply, export ----
$('cp-hist').onclick = async (e) => {
  const list = await sapi(`/pages/${SD.page.id}/revisions`);
  const dlg = $('sv-prompt'); $('svr-title').textContent = 'Revisions'; $('svr-label').innerHTML = 'Restore an earlier version of this template <small>(your current version is kept as a revision)</small>';
  const sel = document.createElement('select'); sel.size = 8; sel.style.height = '200px';
  list.forEach((r) => sel.add(new Option(`${new Date(r.at).toLocaleString()} — ${r.label}`, r.i)));
  const holder = $('svr-text'); holder.hidden = true; holder.after(sel);
  $('svr-ok').textContent = 'Restore'; $('svr-ok').disabled = !list.length;
  const cleanup = () => { sel.remove(); holder.hidden = false; $('svr-ok').disabled = false; dlg.close(); };
  $('svr-cancel').onclick = cleanup;
  $('svr-form').onsubmit = async (ev) => { ev.preventDefault(); if (sel.value === '') return; const p = await sapi(`/pages/${SD.page.id}/restore`, { method: 'POST', body: { index: Number(sel.value) } }); cleanup(); SD.page.spec = p.spec; SD.page.page = p.page; SD.hist.push(snapshot()); SD.hi = SD.hist.length - 1; renderAll(); toast('Revision restored'); };
  dlg.showModal();
};

const FIXES = {
  'wide-paragraphs': { label: 'Limit paragraph width', tweak: { layout: 'home', selector: 'main .prose-content p', add: ['max-w-[72ch]'], remove: [] } },
  'h1-lines': { label: 'Balance and shrink the main heading', tweak: { layout: 'home', selector: 'main h1, .hero h1', add: ['text-balance', 'lg:text-5xl'], remove: ['lg:text-6xl'] } },
  'overflow-x': { label: 'Stop the page scrolling sideways', tweak: { layout: 'all', selector: 'body', add: ['overflow-x-hidden'], remove: [] } },
  'tap-targets': { label: 'Make buttons easier to tap', tweak: { layout: 'all', selector: '.btn', add: ['min-h-11'], remove: [] } },
};
$('cp-qa').onclick = (e) => busy(e.target, async () => {
  const box = $('cp-qapanel');
  box.hidden = false; box.innerHTML = '<p class="hint">Drawing the page in a browser at desktop, tablet and phone sizes…</p>';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const qa = await sapi('/qa', { method: 'POST', body: { spec: SD.page.spec, page: SD.page.page, slot: SD.slot, pageId: SD.slot === 'home' ? SD.page.id : undefined } });
  SD.qa = qa;
  qaPanel(qa, box);
  const fixable = qa.issues.filter((i) => FIXES[i.id]);
  if (fixable.length) {
    const b = el('button', `Apply ${fixable.length} automatic fix${fixable.length === 1 ? '' : 'es'}`, 'btn sm2'); b.type = 'button'; b.style.marginTop = '8px';
    b.onclick = () => { commit('Automatic quality fixes', (pg) => { pg.spec.tweaks = [...(pg.spec.tweaks || []), ...fixable.map((i) => FIXES[i.id].tweak)]; }); toast('Fixes applied. Run the quality check again to confirm.'); };
    box.append(b, el('small', ' ' + fixable.map((i) => FIXES[i.id].label).join(' · '), 'hint'));
  }
});

$('cp-apply').onclick = (e) => busy(e.target, async () => {
  if (!confirm(`Use “${SD.page.name}” as this website's template?\n\nThe home page is built from this composition; every other page follows its design (colours, fonts, header, footer, shapes). Your current template stays in the version list.`)) return;
  await saveNow('Applied as template');
  tp.state = await sapi(`/pages/${SD.page.id}/apply`, { method: 'POST', body: {} });
  renderTemplate();
  toast('Applied. Open Preview & refine to check it on your real pages, then finalise.');
  showView('preview');
  runPreview().catch(() => {});
});

$('cp-export').onclick = (e) => busy(e.target, async () => {
  await saveNow('Before export');
  const box = $('cp-qapanel');
  box.hidden = false; box.innerHTML = '<p class="hint">Building the export and opening it in a browser to check it…</p>';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const r = await sapi(`/pages/${SD.page.id}/export`, { method: 'POST', body: {} });
  box.innerHTML = '';
  box.append(el('b', r.check.ok ? 'Export ready and verified' : 'Export ready, but the check found problems'));
  const a = el('a', `Download ${r.file} (${fmtB(r.bytes)})`, 'btn sm2'); a.href = r.url; a.style.margin = '8px 0'; a.style.display = 'inline-flex'; box.append(el('br'), a);
  const lines = [`${r.images} site image file(s) included`, r.check.ok ? 'Opened on its own in a browser: the stylesheet and every file loaded, no errors, no sideways scrolling.' : '', ...r.check.failedRequests.map((x) => 'Could not load: ' + x), ...r.check.errors, r.check.sideways ? 'The page scrolls sideways on a phone.' : '', r.check.brokenImages ? `${r.check.brokenImages} image(s) did not display.` : '', ...r.missing.map((m) => 'Image not found in your site files: ' + m), ...r.preservation.map((m) => 'Content check: ' + m)].filter(Boolean);
  const ul = el('ul'); lines.forEach((l) => ul.append(el('li', l))); box.append(ul);
});
