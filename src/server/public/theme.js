// Theme Management: Template design -> Configuration -> Design settings. Loaded after template.js (uses $, api, el, toast, busy, slug, tp, colorPicker).
// The colour engine is the same code the server uses (/theme-engine/*.js), so every change is drawn at once and the server
// only has to save it. What is saved is the base colours and the tokens set by hand; everything else is worked out again.
const TM = {
  slug: '', data: null, eng: null, col: null, edit: null, draft: null, history: [], future: [], dirty: false,
  previewMode: 'light', editMode: 'light', compare: new Set(), busy: '', auto: {}, strategy: 'auto', industry: '', style: '', host: null, note: '',
};
const TM_FIELDS = [
  { id: 'primary', label: 'Primary color', kind: 'base' }, { id: 'secondary', label: 'Secondary color', kind: 'base' }, { id: 'accent', label: 'Accent color', kind: 'base' },
  { id: 'background.main', label: 'Background color', kind: 'token' }, { id: 'text.heading', label: 'Heading color', kind: 'token' }, { id: 'text.primary', label: 'Body text color', kind: 'token' },
  { id: 'surface.card', label: 'Surface color', kind: 'token' }, { id: 'border.default', label: 'Border color', kind: 'token' },
];
const TM_SOURCE = { extracted: 'Your website', industry: 'Industry', ai: 'AI', local: 'Generated', custom: 'Custom', imported: 'Imported' };
const TM_LEVEL = { pass: ['Pass', '✓'], 'needs-improvement': ['Needs improvement', '!'], poor: ['Poor contrast', '✕'] };

async function tmEngine() {
  if (TM.eng) return;
  [TM.col, TM.eng] = await Promise.all([import('/theme-engine/color.js'), import('/theme-engine/engine.js')]);
}
const tmGet = (t, path) => { const [g, k] = path.split('.'); return t[g]?.[k]; };
const tmCompact = (t) => ({ id: t.id, name: t.name, description: t.description, category: t.category, style: t.style, source: t.source, mode: t.mode, base: t.base, overrides: t.overrides });
const tmBuild = (c) => TM.eng.buildTheme(c);
const tmSaved = (id) => TM.data?.themes.find((t) => t.id === id);
const tmModeOf = (t, preview) => (preview === 'dark' ? 'dark' : 'light');
const tmSiteName = () => document.getElementById('client')?.selectedOptions?.[0]?.textContent?.trim() || 'Your Business';

// ---------- the variables of a theme on an element (the same names the website uses) ----------
function tmApplyVars(node, theme, mode) {
  const vars = TM.eng.cssVars(theme, mode);
  for (const [k, v] of Object.entries(vars)) node.style.setProperty(k, v);
  node.style.colorScheme = mode;
}

// ---------- entry point: called by renderControls ----------
function themeMgrHost() {
  const host = el('div', undefined, 'tm');
  host.id = 'theme-mgr';
  TM.host = host;
  if (TM.slug !== slug) { TM.slug = slug; TM.data = null; TM.edit = null; TM.draft = null; TM.history = []; TM.future = []; TM.dirty = false; TM.compare.clear(); }
  if (TM.data && TM.eng) tmRender();
  else { host.append(el('p', 'Loading the themes…', 'hint')); tmLoad(); }
  return host;
}

async function tmLoad(autoAllowed = true) {
  if (!slug) return;
  const asked = slug;
  try {
    await tmEngine();
    const d = await api(`/api/clients/${slug}/themes`);
    if (asked !== slug) return;
    TM.data = d; TM.slug = slug;
    if (TM.edit && !tmSaved(TM.edit)) { TM.edit = null; TM.draft = null; }
    tmRender();
    // the first visit: the themes are made from the website's own colours, and the first one (the brand as it is) is selected
    const first = !d.themes.length && tp.state?.templateType === 'platform' && !TM.auto[slug] && autoAllowed;
    if (first) { TM.auto[slug] = true; await tmGenerate({ strategy: 'auto' }, { auto: true }); }
  } catch (e) { if (TM.host) { TM.host.replaceChildren(el('p', e.message, 'note bad')); } }
}

// ---------- generate ----------
async function tmGenerate(body, { auto = false } = {}) {
  if (TM.busy) return;
  TM.busy = 'generate'; tmRender();
  try {
    const d = await api(`/api/clients/${slug}/themes/generate`, { method: 'POST', body });
    TM.data = d;
    TM.note = (d.warnings || []).join(' ');
    // a new design with no theme yet starts with the brand as it is
    if (auto && !d.activeId && tp.state?.source === 'default' && d.themes[0]) {
      const r = await api(`/api/clients/${slug}/themes/${d.themes[0].id}/select`, { method: 'POST' });
      TM.data = r.state;
      await tmTemplateChanged(true);
    }
    toast(auto ? 'Themes made from the colours of your website' : `${d.themes.length} themes ready`);
  } catch (e) { toast(e.message, true); TM.note = e.message; } finally { TM.busy = ''; tmRender(); }
}

// the template's own state and preview follow a theme that was selected or edited
async function tmTemplateChanged(runPrev) {
  tp.state = await api(`/api/clients/${slug}/template`);
  renderTemplate();
  if (runPrev && typeof runPreview === 'function' && tp.state.templateType === 'platform') runPreview().catch(() => {});
}

// ---------- small parts ----------
const tmSw = (hex, title, cls) => { const s = el('i', undefined, 'tm-sw' + (cls ? ' ' + cls : '')); s.style.background = hex; s.title = title ? `${title} ${hex}` : hex; return s; };
const tmPill = (status) => { const [t, i] = TM_LEVEL[status]; const p = el('span', undefined, `tm-pill ${status}`); p.append(el('b', i), document.createTextNode(' ' + t)); return p; };
const tmSummaryText = (t, mode) => { const s = t.summary[mode === 'dark' ? 'dark' : 'light']; return s.poor ? `${s.pass}/${s.total} pass · ${s.poor} poor` : s.needsImprovement ? `${s.pass}/${s.total} pass · ${s.needsImprovement} to improve` : `${s.total}/${s.total} checks pass`; };
const tmBtn = (label, cls, fn, title) => { const b = el('button', label, 'btn ' + (cls || 'ghost') + ' sm2'); b.type = 'button'; if (title) b.title = title; b.onclick = (e) => fn(e.currentTarget); return b; };

// the representative page: every colour is a theme variable, as on the website
function tmSite(theme, mode, name) {
  const root = el('div', undefined, 'tps');
  root.innerHTML = `
    <div class="tps-nav"><b class="tps-logo"></b><span class="tps-links"><a>Services</a><a>About</a><a>Reviews</a><a>Contact</a></span><span class="tps-btn tps-btn-primary">Get a quote</span></div>
    <div class="tps-hero"><h3></h3><p>Straightforward work, fair prices and a team that answers the phone. See how we can help today.</p><div class="tps-cta"><span class="tps-btn tps-btn-primary">Request service</span><span class="tps-btn tps-btn-secondary">Our services</span></div></div>
    <div class="tps-sec"><h4>Our services</h4><div class="tps-cards">
      <div class="tps-card"><i class="tps-ic"></i><b>Repairs</b><p>Fast, tidy fixes with a clear price.</p><a>Learn more</a></div>
      <div class="tps-card"><i class="tps-ic"></i><b>Installations</b><p>New work done right the first time.</p><a>Learn more</a></div>
      <div class="tps-card"><i class="tps-ic"></i><b>Maintenance</b><p>Regular checks that prevent problems.</p><a>Learn more</a></div></div></div>
    <div class="tps-sec tps-alt"><h4>Why choose us</h4><ul class="tps-list"><li>Licensed and insured</li><li>Same-day appointments</li><li>Upfront, written estimates</li></ul>
      <div class="tps-notes"><span class="tps-note ok">Message sent</span><span class="tps-note warn">Please check the date</span><span class="tps-note err">Phone number missing</span><span class="tps-note info">We reply within one hour</span></div></div>
    <div class="tps-sec"><div class="tps-quote"><span class="tps-stars">★★★★★</span><p>“They arrived on time, fixed it in an hour and left everything clean.”</p><small>Maria S., customer</small></div></div>
    <div class="tps-cta-band"><b>Ready when you are</b><span class="tps-btn tps-btn-on">Call us today</span></div>
    <div class="tps-sec tps-form"><h4>Contact us</h4><div class="tps-fields"><span class="tps-input">Your name</span><span class="tps-input tps-focus">Your phone</span><span class="tps-input wide">How can we help?</span></div><span class="tps-btn tps-btn-primary">Send message</span> <span class="tps-btn tps-btn-disabled">Disabled</span></div>
    <div class="tps-foot"><b></b><span>© Your Business · Terms · Privacy</span></div>`;
  root.querySelector('.tps-logo').textContent = name;
  root.querySelector('.tps-hero h3').textContent = `${name}: reliable service you can trust`;
  root.querySelector('.tps-foot b').textContent = name;
  tmApplyVars(root, theme, mode);
  return root;
}

// a small card of a theme
function tmMini(theme, mode) {
  const m = el('div', undefined, 'tm-mini');
  m.innerHTML = '<b>Heading text</b><p>A short paragraph of body text with a <a>link</a>.</p><div class="tm-mini-row"><span class="tps-btn tps-btn-primary">Primary</span><span class="tps-btn tps-btn-secondary">Secondary</span></div><div class="tm-mini-card">Sample card</div>';
  tmApplyVars(m, theme, mode);
  return m;
}

// ---------- the whole panel ----------
function tmRender() {
  const host = TM.host;
  if (!host || !TM.data || !TM.eng) return;
  // while a theme is edited the page uses the whole width (the live preview of the other settings steps aside)
  document.querySelector('#td-view-config .cfg-wrap')?.classList.toggle('cfg-wide', Boolean(TM.edit));
  const d = TM.data;
  const active = d.themes.find((t) => t.id === d.activeId) || null;
  host.replaceChildren();
  host.append(tmOverview(active), tmGenerator(d));
  if (TM.note) host.append(el('p', TM.note, 'note'));
  host.append(tmGrid(d, active));
  if (TM.edit && TM.draft) host.append(tmEditor());
}

// ----- overview -----
function tmOverview(active) {
  const box = el('div', undefined, 'tm-over');
  const left = el('div', undefined, 'tm-over-main');
  if (!active) {
    left.append(el('b', 'No theme selected yet'), el('small', 'Pick one of the themes below. Until then the colours of the design settings are used.', 'hint'));
  } else {
    const t = TM.eng.buildTheme(tmCompact(active));
    const tok = TM.eng.tokensOf(t, t.mode === 'dark' ? 'dark' : 'light');
    const top = el('div', undefined, 'row'); top.style.gap = '10px';
    top.append(el('b', active.name), el('span', TM_SOURCE[active.source] || 'Custom', 'tm-tag'), el('span', 'Selected', 'tm-tag on'));
    const sw = el('div', undefined, 'tm-over-sw');
    [['Primary', tok.brand.primary], ['Secondary', tok.brand.secondary], ['Accent', tok.brand.accent], ['Background', tok.background.main], ['Text', tok.text.primary]].forEach(([n, h]) => { const c = el('span', undefined, 'tm-over-c'); c.append(tmSw(h, n), el('span', `${n} ${h}`)); sw.append(c); });
    left.append(top, sw);
  }
  const right = el('div', undefined, 'row'); right.style.gap = '8px';
  if (active) {
    const seg = el('div', undefined, 'seg'); seg.setAttribute('role', 'tablist'); seg.setAttribute('aria-label', 'Colour mode of the website');
    [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].forEach(([v, label]) => { const b = el('button', label, active.mode === v ? 'on' : ''); b.type = 'button'; b.title = v === 'auto' ? 'The visitor’s own setting decides' : `The website is shown in the ${v} mode`; b.onclick = () => tmSetMode(active.id, v); seg.append(b); });
    right.append(seg);
    right.append(tmBtn('Export', 'ghost', () => { const a = document.createElement('a'); a.href = `/api/clients/${slug}/themes/${active.id}/export`; a.click(); }, 'Save this theme as a file'));
  }
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
  file.onchange = async () => { const f = file.files[0]; if (!f) return; try { const text = await f.text(); const t = await api(`/api/clients/${slug}/themes/import`, { method: 'POST', body: { json: text } }); toast(`Imported “${t.name}”`); await tmLoad(false); } catch (e) { toast(e.message, true); } file.value = ''; };
  right.append(tmBtn('Import', 'ghost', () => file.click(), 'Add a theme from a file'), file);
  box.append(left, right);
  return box;
}
async function tmSetMode(id, mode) {
  try { await api(`/api/clients/${slug}/themes/${id}`, { method: 'PUT', body: { mode } }); await tmLoad(false); await tmTemplateChanged(true); toast(mode === 'auto' ? 'The website follows the visitor’s setting' : `The website uses the ${mode} mode`); } catch (e) { toast(e.message, true); }
}

// ----- generator -----
function tmGenerator(d) {
  const box = el('div', undefined, 'tm-gen');
  const strat = document.createElement('select'); strat.setAttribute('aria-label', 'Where the colours come from');
  [['auto', 'Automatic (website colours, else industry)'], ['extracted', 'My website’s colours'], ['industry', 'Industry preset'], ['ai', 'AI suggestions']].forEach(([v, l]) => { const o = new Option(l, v); if (v === 'ai' && !d.hasAi) { o.disabled = true; o.textContent = 'AI suggestions (add the AI key in Settings)'; } strat.add(o); });
  strat.value = TM.strategy; strat.onchange = () => { TM.strategy = strat.value; tmRender(); };
  const ind = document.createElement('select'); ind.setAttribute('aria-label', 'Industry');
  ind.add(new Option('Industry: detect from the profile', ''));
  d.industries.forEach((i) => ind.add(new Option(`${i.label}: ${i.palette}`, i.id)));
  ind.value = TM.industry; ind.onchange = () => { TM.industry = ind.value; };
  const style = el('input'); style.placeholder = 'Style or colours you like (optional)'; style.value = TM.style; style.oninput = () => { TM.style = style.value; };
  style.setAttribute('aria-label', 'Preferred style');
  const go = el('button', TM.busy === 'generate' ? 'Making themes…' : d.themes.length ? 'Generate 5 new themes' : 'Generate 5 themes', 'btn sm2'); go.type = 'button'; go.disabled = Boolean(TM.busy);
  go.onclick = () => tmGenerate({ strategy: TM.strategy, industry: TM.industry, style: TM.style, prefer: TM.style ? [TM.style] : [] });
  const row = el('div', undefined, 'row'); row.style.cssText = 'gap:8px;flex-wrap:wrap';
  row.append(strat);
  if (TM.strategy === 'industry' || TM.strategy === 'ai' || TM.strategy === 'auto') row.append(ind);
  row.append(style, go);
  box.append(row);
  // where the colours came from
  const m = d.meta;
  if (m) {
    const bits = [];
    if (m.anchorFrom === 'extracted' && m.brand) bits.push(`Read from your website: primary ${m.brand.primary || '–'}${m.brand.accent ? `, accent ${m.brand.accent}` : ''}${m.brand.logo?.length ? `, logo ${m.brand.logo[0]}` : ''}`);
    if (m.anchorFrom === 'industry') bits.push(`From the ${m.industry?.label || 'industry'} preset (${m.industry?.palette || ''})`);
    if (m.usedAi) bits.push('Ideas from the AI');
    if (m.industry && m.anchorFrom === 'extracted') bits.push(`Industry: ${m.industry.label}`);
    if (bits.length) box.append(el('small', bits.join(' · '), 'hint'));
  }
  return box;
}

// ----- the cards -----
function tmGrid(d, active) {
  const wrap = el('div');
  if (!d.themes.length) { wrap.append(el('p', TM.busy ? 'Making your themes…' : 'No themes yet. Press “Generate 5 themes”.', 'hint')); return wrap; }
  const head = el('div', undefined, 'row between'); head.style.margin = '14px 0 8px';
  head.append(el('b', `Themes (${d.themes.length})`));
  const cmp = tmBtn(TM.compare.size >= 2 ? `Compare ${TM.compare.size} themes` : 'Compare: tick two or three themes', 'ghost', () => tmCompare()); cmp.disabled = TM.compare.size < 2;
  head.append(cmp);
  wrap.append(head);
  const grid = el('div', undefined, 'tm-grid');
  d.themes.forEach((t) => grid.append(tmCard(t, active)));
  wrap.append(grid);
  return wrap;
}

function tmCard(saved, active) {
  const t = TM.eng.buildTheme(tmCompact(saved));
  const mode = t.mode === 'dark' ? 'dark' : 'light';
  const tok = TM.eng.tokensOf(t, mode);
  const card = el('div', undefined, 'tm-card' + (active?.id === t.id ? ' active' : '') + (TM.edit === t.id ? ' editing' : ''));
  const head = el('div', undefined, 'tm-card-head');
  const cmp = el('input'); cmp.type = 'checkbox'; cmp.checked = TM.compare.has(t.id); cmp.title = 'Compare'; cmp.setAttribute('aria-label', `Compare ${t.name}`);
  cmp.onchange = () => { if (cmp.checked) { if (TM.compare.size >= 3) { cmp.checked = false; toast('Compare up to three themes at a time', true); return; } TM.compare.add(t.id); } else TM.compare.delete(t.id); tmRender(); };
  const title = el('div'); title.append(el('b', t.name), el('small', t.description || TM_SOURCE[t.source] || '', 'tm-desc'));
  head.append(cmp, title, el('span', active?.id === t.id ? 'Selected' : TM_SOURCE[t.source] || 'Custom', 'tm-tag' + (active?.id === t.id ? ' on' : '')));
  const sw = el('div', undefined, 'tm-sws');
  [['Primary', tok.brand.primary], ['Secondary', tok.brand.secondary], ['Accent', tok.brand.accent], ['Background', tok.background.main], ['Text', tok.text.primary]].forEach(([n, h]) => sw.append(tmSw(h, n)));
  card.append(head, sw, tmMini(t, mode));
  const foot = el('div', undefined, 'tm-card-foot');
  const worst = t.summary[mode].poor ? 'poor' : t.summary[mode].needsImprovement ? 'needs-improvement' : 'pass';
  const acc = el('small', undefined, 'tm-acc ' + worst); acc.textContent = `${TM_LEVEL[worst][1]} ${tmSummaryText(t, mode)}`; acc.title = 'WCAG contrast checks of the pairs that matter';
  foot.append(acc);
  const acts = el('div', undefined, 'row'); acts.style.gap = '6px';
  const sel = tmBtn(active?.id === t.id ? 'Selected' : 'Select theme', active?.id === t.id ? 'ghost' : '', (b) => tmSelect(t.id, b)); sel.disabled = active?.id === t.id;
  acts.append(sel, tmBtn('Customize', 'ghost', () => tmStartEdit(t.id)));
  const more = el('details', undefined, 'tm-more'); more.append(el('summary', '⋯'));
  const menu = el('div', undefined, 'tm-menu');
  menu.append(tmBtn('Duplicate', 'ghost', async () => { try { await api(`/api/clients/${slug}/themes/${t.id}/duplicate`, { method: 'POST' }); await tmLoad(false); toast('Theme duplicated'); } catch (e) { toast(e.message, true); } }),
    tmBtn('Export', 'ghost', () => { const a = document.createElement('a'); a.href = `/api/clients/${slug}/themes/${t.id}/export`; a.click(); }),
    tmBtn('Delete', 'ghost', async () => { if (!confirm(`Delete the theme “${t.name}”?`)) return; try { TM.data = await api(`/api/clients/${slug}/themes/${t.id}`, { method: 'DELETE' }); if (TM.edit === t.id) { TM.edit = null; TM.draft = null; } TM.compare.delete(t.id); tmRender(); toast('Theme deleted'); } catch (e) { toast(e.message, true); } }));
  more.append(menu); acts.append(more);
  foot.append(acts);
  card.append(foot);
  return card;
}

async function tmSelect(id, btn) {
  if (TM.dirty && TM.edit === id) { if (!(await tmSave(true))) return; }
  await busy(btn, async () => {
    try {
      const r = await api(`/api/clients/${slug}/themes/${id}/select`, { method: 'POST' });
      TM.data = r.state;
      await tmTemplateChanged(true);
      toast('Theme selected: the colours of every page follow it. Layout, fonts, spacing and content are unchanged.');
    } catch (e) { toast(e.message, true); }
  });
  tmRender();
}

// ----- compare -----
function tmCompare() {
  const ids = [...TM.compare];
  let dlg = document.getElementById('tm-compare');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'tm-compare'; dlg.className = 'wide tm-dlg'; document.body.append(dlg); }
  dlg.replaceChildren();
  const head = el('div', undefined, 'row between'); head.append(el('h2', 'Compare themes'), tmBtn('Close', 'ghost', () => dlg.close()));
  const cols = el('div', undefined, 'tm-cmp'); cols.style.gridTemplateColumns = `repeat(${ids.length}, minmax(0, 1fr))`;
  ids.forEach((id) => {
    const saved = tmSaved(id); if (!saved) return;
    const t = TM.eng.buildTheme(tmCompact(saved));
    const col = el('div', undefined, 'tm-cmp-col');
    const h = el('div', undefined, 'row between'); h.append(el('b', t.name), el('small', tmSummaryText(t, t.mode), 'hint'));
    col.append(h, tmSite(t, t.mode === 'dark' ? 'dark' : 'light', tmSiteName()));
    cols.append(col);
  });
  dlg.append(head, cols);
  dlg.showModal();
}

// ---------- editing ----------
function tmStartEdit(id) {
  const saved = tmSaved(id);
  if (TM.dirty && TM.edit !== id && !confirm('You have unsaved changes in the theme you were editing. Discard them?')) return;
  TM.edit = id; TM.draft = tmCompact(saved); TM.history = []; TM.future = []; TM.dirty = false; TM.editMode = TM.previewMode = saved.mode === 'dark' ? 'dark' : 'light';
  tmRender();
  TM.host.querySelector('.tm-edit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const tmLive = () => TM.eng.buildTheme(TM.draft);

function tmChange(patch) {
  // changes of the same colour within a moment (dragging the picker, typing) are one step
  const key = `${TM.editMode}|${Object.keys(patch.base || {})}|${Object.keys(patch.tokens || {})}`;
  const merge = key === TM.lastKey && Date.now() - TM.lastAt < 1500 && TM.history.length;
  TM.lastKey = key; TM.lastAt = Date.now();
  if (!merge) { TM.history.push(JSON.stringify(TM.draft)); if (TM.history.length > 60) TM.history.shift(); }
  TM.future = [];
  TM.draft = tmCompact(TM.eng.updateTheme(tmLive(), { ...patch, editMode: TM.editMode }));
  TM.dirty = true;
  tmRefreshEditor();
}
function tmUndo() { if (!TM.history.length) return; TM.future.push(JSON.stringify(TM.draft)); TM.draft = JSON.parse(TM.history.pop()); TM.dirty = true; tmRefreshEditor(true); }
function tmRedo() { if (!TM.future.length) return; TM.history.push(JSON.stringify(TM.draft)); TM.draft = JSON.parse(TM.future.pop()); TM.dirty = true; tmRefreshEditor(true); }

async function tmSave(quiet) {
  try {
    const t = tmLive();
    const r = await api(`/api/clients/${slug}/themes/${TM.edit}`, { method: 'PUT', body: { name: TM.draft.name, mode: TM.draft.mode, base: t.base, overrides: t.overrides } });
    TM.draft = tmCompact(TM.eng.buildTheme(r)); TM.dirty = false;
    await tmLoad(false);
    if (TM.data.activeId === TM.edit) await tmTemplateChanged(true);
    if (!quiet) toast('Theme saved');
    return true;
  } catch (e) { toast(e.message, true); return false; }
}

// the editor: base colours and overrides on the left, the page on the right
function tmEditor() {
  const box = el('div', undefined, 'tm-edit');
  box.id = 'tm-edit';
  const head = el('div', undefined, 'row between');
  const name = el('input'); name.value = TM.draft.name; name.setAttribute('aria-label', 'Theme name'); name.className = 'tm-name';
  name.oninput = () => { TM.draft.name = name.value; TM.dirty = true; tmUpdateBar(); };
  const bar = el('div', undefined, 'row'); bar.id = 'tm-bar'; bar.style.gap = '6px';
  head.append(name, bar);
  box.append(head);
  const cols = el('div', undefined, 'tm-edit-cols');
  const left = el('div', undefined, 'tm-edit-left'); left.id = 'tm-left';
  const right = el('div', undefined, 'tm-edit-right'); right.id = 'tm-right';
  cols.append(left, right);
  box.append(cols);
  setTimeout(() => { tmBuildFields(); tmRefreshEditor(); }, 0);
  return box;
}

let tmPickers = {};
function tmBuildFields() {
  const left = document.getElementById('tm-left');
  if (!left) return;
  left.replaceChildren();
  tmPickers = {};
  // which mode the colours below are edited for
  const seg = el('div', undefined, 'seg'); seg.id = 'tm-editmode';
  [['light', 'Edit light mode'], ['dark', 'Edit dark mode']].forEach(([v, l]) => { const b = el('button', l, TM.editMode === v ? 'on' : ''); b.type = 'button'; b.onclick = () => { TM.editMode = TM.previewMode = v; tmBuildFields(); tmRefreshEditor(); }; seg.append(b); });
  left.append(seg);
  const list = el('div', undefined, 'tm-fields');
  TM_FIELDS.forEach((f) => {
    const row = el('div', undefined, 'tm-field');
    const lab = el('label', f.label);
    const cur = tmFieldValue(f);
    const cp = colorPicker({ id: 'tmf_' + f.id.replace('.', '_'), label: f.label, value: cur, onChange: (hex) => tmFieldChange(f, hex) });
    tmPickers[f.id] = cp;
    const info = el('small', undefined, 'tm-info'); info.id = 'tmi_' + f.id.replace('.', '_');
    const reset = el('button', 'Use the generated colour', 'tm-link'); reset.type = 'button'; reset.id = 'tmr_' + f.id.replace('.', '_'); reset.hidden = true;
    reset.onclick = () => { if (f.kind === 'token') { tmChange({ tokens: { [f.id]: null } }); tmSyncPickers(); } };
    row.append(lab, cp.root, info, reset);
    list.append(row);
  });
  left.append(list);
  const scales = el('div', undefined, 'tm-scales'); scales.id = 'tm-scales';
  const checks = el('div', undefined, 'tm-checks'); checks.id = 'tm-checks';
  left.append(scales, checks);
}
function tmFieldValue(f) {
  const t = tmLive();
  if (f.kind === 'base') return t.base[f.id];
  return tmGet(TM.eng.tokensOf(t, TM.editMode), f.id);
}
function tmFieldChange(f, hex) {
  if (!hex) return;
  if (f.kind === 'base') tmChange({ base: { [f.id]: hex } });
  else tmChange({ tokens: { [f.id]: hex } });
}
// after a change: the other pickers take the colours worked out from it (a picker that is being dragged is left alone)
function tmSyncPickers() { TM_FIELDS.forEach((f) => { const cp = tmPickers[f.id]; if (cp) { const v = tmFieldValue(f); if (cp.value.toLowerCase() !== String(v).toLowerCase()) cp.set(v, { silent: true }); } }); }

function tmUpdateBar() {
  const bar = document.getElementById('tm-bar');
  if (!bar) return;
  bar.replaceChildren();
  bar.append(tmBtn('Undo', 'ghost', tmUndo, 'Undo the last change'), tmBtn('Redo', 'ghost', tmRedo, 'Redo'));
  bar.children[0].disabled = !TM.history.length; bar.children[1].disabled = !TM.future.length;
  bar.append(tmBtn('Reset', 'ghost', () => { const s = tmSaved(TM.edit); TM.history.push(JSON.stringify(TM.draft)); TM.future = []; TM.draft = tmCompact(TM.eng.buildTheme({ ...tmCompact(s), base: s.origin || s.base, overrides: { light: {}, dark: {} } })); TM.dirty = true; tmBuildFields(); tmRefreshEditor(); }, 'Back to the colours this theme was made with'));
  const save = tmBtn(TM.dirty ? 'Save theme' : 'Saved', TM.dirty ? '' : 'ghost', () => tmSave()); save.disabled = !TM.dirty;
  bar.append(save, tmBtn('Close', 'ghost', () => { if (TM.dirty && !confirm('Discard the unsaved changes?')) return; TM.edit = null; TM.draft = null; TM.dirty = false; tmRender(); }));
}

// everything that depends on the colours: the preview, the contrast list, the shade strips and the read-outs
function tmRefreshEditor(rebuild) {
  const right = document.getElementById('tm-right');
  if (!right || !TM.draft) return;
  if (rebuild) tmBuildFields();
  tmUpdateBar();
  const t = tmLive();
  const mode = TM.previewMode;
  // the page
  let site = document.getElementById('tm-site');
  if (!site) {
    right.replaceChildren();
    const bar = el('div', undefined, 'row between');
    bar.append(el('b', 'Live preview'));
    const seg = el('div', undefined, 'seg'); seg.id = 'tm-prevmode';
    [['light', 'Light'], ['dark', 'Dark']].forEach(([v, l]) => { const b = el('button', l, ''); b.type = 'button'; b.dataset.v = v; b.onclick = () => { TM.previewMode = v; tmRefreshEditor(); }; seg.append(b); });
    bar.append(seg);
    site = tmSite(t, mode, tmSiteName()); site.id = 'tm-site';
    right.append(bar, site);
  }
  document.querySelectorAll('#tm-prevmode button').forEach((b) => b.classList.toggle('on', b.dataset.v === mode));
  tmApplyVars(site, t, mode);
  // the fields
  TM_FIELDS.forEach((f) => {
    const v = tmFieldValue(f), info = document.getElementById('tmi_' + f.id.replace('.', '_')), reset = document.getElementById('tmr_' + f.id.replace('.', '_'));
    const d = TM.col.describe(v);
    if (info && d) info.textContent = `${d.rgb} · ${d.hsl} · ${d.oklch}`;
    if (reset) reset.hidden = !(f.kind === 'token' && t.overrides[TM.editMode][f.id]);
  });
  tmSyncPickers();
  tmScales(t);
  tmChecks(t);
}

function tmScales(t) {
  const box = document.getElementById('tm-scales');
  if (!box) return;
  box.replaceChildren(el('b', 'Shades'), el('small', 'Worked out from each base colour in OKLCH: one hue, even steps. The base colour sits at its own step.', 'hint'));
  for (const [name, label] of [['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'], ['neutral', 'Neutral']]) {
    const row = el('div', undefined, 'tm-scale'); row.append(el('small', label));
    const strip = el('div', undefined, 'tm-strip');
    for (const s of TM.col.STEPS) { const c = el('i', undefined, 'tm-step' + (t.scales[name][s] === t.base[name] ? ' base' : '')); c.style.background = t.scales[name][s]; c.title = `${name}-${s} ${t.scales[name][s]}${t.scales[name][s] === t.base[name] ? ' (your colour)' : ''}`; c.onclick = () => navigator.clipboard?.writeText(t.scales[name][s]).then(() => toast(`${name}-${s} ${t.scales[name][s]} copied`)); strip.append(c); }
    row.append(strip); box.append(row);
  }
}

function tmChecks(t) {
  const box = document.getElementById('tm-checks');
  if (!box) return;
  const mode = TM.editMode === 'dark' ? 'dark' : 'light';
  const list = t.checks[mode];
  const s = t.summary[mode];
  box.replaceChildren();
  const head = el('div', undefined, 'row between');
  head.append(el('b', 'Accessibility (WCAG contrast)'), el('small', tmSummaryText(t, mode), 'hint'));
  box.append(head);
  (t.notes[mode] || []).forEach((n) => box.append(el('p', n, 'tm-note')));
  const ul = el('div', undefined, 'tm-check-list');
  list.slice().sort((a, b) => (a.status === 'pass') - (b.status === 'pass')).forEach((c) => {
    const row = el('div', undefined, 'tm-check ' + c.status);
    row.append(tmPill(c.status));
    const mid = el('div'); mid.append(el('span', c.label), el('small', ` ${c.ratio}:1 · needs ${c.min}:1`, 'hint'));
    row.append(tmSw(c.fgHex.slice(0, 7), 'Text'), tmSw(c.bgHex.slice(0, 7), 'Background'), mid);
    if (c.status !== 'pass' && c.suggestion) {
      const brand = c.fg.startsWith('brand.');
      const b = tmBtn(brand ? `Use ${c.suggestion.hex} for ${c.fg.split('.')[1]}` : `Use ${c.suggestion.hex}`, 'ghost', () => {
        if (brand) tmChange({ base: { [c.fg.split('.')[1]]: c.suggestion.hex } });
        else tmChange({ tokens: { [c.fg]: c.suggestion.hex } });
        tmSyncPickers();
      }, `The closest colour of the same hue that reaches ${c.min}:1 (${c.suggestion.ratio}:1). Your colours are never changed unless you press this.`);
      row.append(b);
    }
    ul.append(row);
  });
  box.append(ul);
}
