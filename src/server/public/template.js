// Template design tab (Step 4). Loaded before app.js; app.js calls initTemplateTab() and loadTemplateTab().
let tp = { state: null, slot: 'home', view: 'config', chat: [], show: 'both' };

const LABELS = {
  header: 'Header', hero: 'Hero style', sections: 'Section backgrounds', cards: 'Card style', footer: 'Footer', contactLayout: 'Contact page', innerForm: 'Form on inner pages', homeStyle: 'Home page style',
  radius: 'Corner roundness', shadow: 'Shadows', density: 'Spacing', headingCase: 'Heading case', headingWeight: 'Heading weight', container: 'Content width',
};
const SECTIONS = { layout: ['header', 'hero', 'sections', 'cards', 'footer', 'contactLayout', 'innerForm', 'homeStyle'], tokens: ['radius', 'shadow', 'density', 'headingCase', 'headingWeight', 'container'] };
const COLORS = [['primary', 'Primary'], ['primaryDark', 'Primary dark'], ['accent', 'Accent / buttons'], ['ink', 'Text colour'], ['soft', 'Soft background']];
const SLOTS = [['home', 'Home page', 'Hero, services, reviews, FAQ, areas, contact strip'], ['inner', 'Inner page', 'Service, location and content pages'], ['contact', 'Contact page', 'Details beside the enquiry form']];
const tcap = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/([A-Z])/g, ' $1').toLowerCase();

function tdSelect(id, options, value) {
  const s = document.createElement('select');
  s.id = id;
  options.forEach((o) => s.add(new Option(typeof o === 'string' || typeof o === 'number' ? tcap(String(o)) : o.label, typeof o === 'object' ? o.value : o)));
  s.value = String(value);
  return s;
}

// fonts in groups, each name set in its own typeface, so a font is chosen by how it looks
function tdFontSelect(id, list, value) {
  const s = document.createElement('select');
  s.id = id;
  const groups = [['Sans-serif', (f) => f.kind !== 'serif' && f.body], ['Serif', (f) => f.kind === 'serif' && f.body], ['Display and bold headings', (f) => !f.body]];
  const seen = new Set();
  groups.forEach(([label, test]) => {
    const g = document.createElement('optgroup'); g.label = label;
    list.filter((f) => test(f) && !seen.has(f.name)).sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => {
      seen.add(f.name);
      const o = new Option(f.name, f.name); o.style.fontFamily = `"${f.name}", ${f.kind === 'serif' ? 'serif' : 'sans-serif'}`; o.style.fontSize = '16px';
      g.append(o);
    });
    if (g.children.length) s.append(g);
  });
  s.value = String(value);
  return s;
}

function tdField(label, control) {
  const f = el('div', undefined, 'f');
  const l = el('label', label);
  l.htmlFor = control.id;
  f.append(l, control);
  return f;
}

async function loadTemplateTab() {
  if (!slug) return;
  tp.state = await api(`/api/clients/${slug}/template`);
  renderTemplate();
  applyType();
  loadChat();
  if (tp.state.templateType === 'existing') await loadExisting();
}

function renderTemplate() {
  const { spec, final } = tp.state;
  $('td-badge').textContent = final ? `Finalised · v${spec.version}` : `Draft · v${spec.version}`;
  $('td-badge').className = 'badge ' + (final ? 'approved' : 'draft');
  $('td-final').hidden = final;
  $('td-reopen').hidden = !final;
  $('td-brief').value = spec.brief || '';
  $('td-css').value = spec.customCss || '';
  $('dstatus').className = 'dot' + (final ? ' ok' : ' warn');
  applyGate(final);
  renderRefs(); renderSlots(); renderControls(); renderVersions(); renderPreviewFrames();
}

// the later steps wait for a finalised template only on a website that is getting a new template
let gateFinal;
function applyGate(final) {
  gateFinal = final;
  const waiting = !final && (typeof siteOptions === 'undefined' || siteOptions.template);
  ['images', 'templates', 'report'].forEach((t) => {
    const sec = $('tab-' + t);
    if (!sec) return;
    sec.classList.toggle('gated', waiting);
    let g = sec.querySelector(':scope > .gate');
    if (waiting && !g) {
      g = el('div', 'This step starts after the template is finalised. Open Template design, preview your pages and press Finalise.', 'note gate');
      sec.prepend(g);
    }
    if (!waiting && g) g.remove();
  });
}

// ---------- references ----------
function renderRefs() {
  const box = $('td-refs');
  box.innerHTML = '';
  tp.state.refs.forEach((r) => {
    const c = el('div', undefined, 'ref');
    if (r.type === 'image') { const i = document.createElement('img'); i.src = `/api/clients/${slug}/template/refs/${r.id}/image`; i.alt = r.name; c.append(i); }
    else c.append(el('b', new URL(r.value).hostname));
    c.append(el('small', r.note || (r.type === 'url' ? r.value : r.name)));
    const x = el('button', '×', 'x');
    x.title = 'Remove';
    x.onclick = () => busy(x, async () => { await api(`/api/clients/${slug}/template/refs/${r.id}`, { method: 'DELETE' }); await loadTemplateTab(); });
    c.append(x);
    box.append(c);
  });
  if (!tp.state.refs.length) box.append(el('small', 'No references yet. Add a website or an image, or just describe the style in the brief.', 'hint'));
}

function tdInit() {
  $('td-addurl').onclick = (e) => busy(e.target, async () => {
    await api(`/api/clients/${slug}/template/refs`, { method: 'POST', body: { type: 'url', url: $('td-url').value, note: $('td-refnote').value } });
    $('td-url').value = ''; $('td-refnote').value = '';
    await loadTemplateTab();
  });
  $('td-file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const dataUrl = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
      await api(`/api/clients/${slug}/template/refs`, { method: 'POST', body: { type: 'image', name: f.name, dataUrl, note: $('td-refnote').value } });
      $('td-refnote').value = '';
      await loadTemplateTab();
    } catch (err) { toast(err.message, true); }
    e.target.value = '';
  };

  const aiDone = async (r, what) => {
    const lines = [r.rationale || ''];
    if (r.changes?.length) lines.push('Changed: ' + r.changes.join('; '));
    if (r.unsupported?.length) lines.push('Could not do: ' + r.unsupported.join('; '));
    if (r.unchanged) lines.push('The design settings did not change. ' + (r.unsupported?.length ? '' : 'Try describing the change differently, or edit the settings below by hand.'));
    $('td-rationale').textContent = lines.filter(Boolean).join('\n');
    $('td-rationale').style.whiteSpace = 'pre-line';
    if (r.unchanged) toast('Nothing changed in the design: ' + (r.unsupported?.[0] || 'see the note under the box'), true);
    tp.state = r.state;
    renderTemplate();
    toast(`${what} ready — building the preview…`);
    await runPreview();
  };
  $('td-design').onclick = (e) => busy(e.target, async () => {
    const old = e.target.textContent;
    e.target.textContent = 'Designing…';
    try {
      await aiDone(await api(`/api/clients/${slug}/template/design`, { method: 'POST', body: { brief: $('td-brief').value, archetype: $('td-arch').value, fresh: !$('td-keep').checked } }), 'Design');
      if ($('td-polish').checked) { e.target.textContent = 'Reviewing…'; showView('preview'); await sendChat({ expert: true }); }
    } finally { e.target.textContent = old; }
  });
  // ---- sub-tabs ----
  $('td-views').onclick = (e) => { const b = e.target.closest('button'); if (b) showView(b.dataset.view); };

  initChat();

  $('td-save').onclick = (e) => busy(e.target, async () => {
    await saveConfig('Manual edit');
    toast('Saved as a new version. Building the preview…');
    await runPreview();
  });
  // anything typed in the written brief counts as a change too
  $('td-brief').addEventListener('input', () => { tp.dirty = true; });
  $('td-css').addEventListener('input', () => { tp.dirty = true; });

  $('td-preview').onclick = (e) => busy(e.target, runPreview);
  $('td-final').onclick = (e) => busy(e.target, async () => {
    if (!confirm('Finalise this template? Image optimisation and the page build will use it. You can reopen it later.')) return;
    tp.state = await api(`/api/clients/${slug}/template/finalise`, { method: 'POST' });
    renderTemplate();
    toast('Template finalised — you can continue to Images');
  });
  $('td-reopen').onclick = (e) => busy(e.target, async () => { tp.state = await api(`/api/clients/${slug}/template/reopen`, { method: 'POST' }); renderTemplate(); });

  $('td-slotseg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; tp.slot = b.dataset.slot; renderPreviewFrames(); };
  $('td-show').onclick = (e) => { const b = e.target.closest('button'); if (b) showPane(b.dataset.show); };
  $('td-dev').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll('#td-dev button').forEach((x) => x.classList.toggle('on', x === b));
    $('td-fo').style.width = $('td-fn').style.width = b.dataset.w;
  };
}

// Side by side, or one page at the full width of the card so the desktop layout can be judged properly.
function showPane(m) {
  tp.show = m;
  document.querySelectorAll('#td-show button').forEach((b) => b.classList.toggle('on', b.dataset.show === m));
  $('td-compare').classList.toggle('only-new', m === 'new');
  $('td-compare').classList.toggle('only-orig', m === 'orig');
}

function showView(v) {
  const VIEWS = ['designs', 'config', 'preview'];
  if (!VIEWS.includes(v)) v = 'config';
  tp.view = v;
  try { localStorage.setItem('sm-tdview', v); } catch { /* storage unavailable */ }
  // the designer's views (Configuration, variants, composer, preview) belong to a template made with the platform: a template from the
  // site's existing pages, or none chosen yet, shows none of them (this also runs when the remembered tab is restored at start)
  if (tp.state && tp.state.templateType !== 'platform') { VIEWS.forEach((x) => { $('td-view-' + x).hidden = true; }); return; }
  document.querySelectorAll('#td-views button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  VIEWS.forEach((x) => { $('td-view-' + x).hidden = v !== x; });
  document.body.classList.toggle('cp-wide', v === 'composer');
  if (v === 'designs' && window.kitOpen) window.kitOpen();
  if (window.studioOpen) window.studioOpen(v);
}

// ---------- design assistant ----------
tp.atts = []; tp.targets = []; tp.picking = false;
const chatKey = () => 'td-chat-' + slug;
function saveChat() { try { localStorage.setItem(chatKey(), JSON.stringify(tp.chat.slice(-60).map((m) => ({ ...m, files: (m.files || []).map((f) => ({ name: f.name, kind: f.kind })) })))); } catch { /* storage unavailable */ } }
function loadChat() {
  try { tp.chat = JSON.parse(localStorage.getItem(chatKey()) || '[]'); } catch { tp.chat = []; }
  renderChat();
}

function renderChat() {
  const log = $('td-chat-log');
  log.innerHTML = '';
  if (!tp.chat.length) log.append(el('div', 'Hi! Tell me what to change and I will update the design and rebuild the preview. You can paste or attach images, attach a document with your changes, or use “Select area” to click the exact section you mean. For example: “make this section’s background darker”, “use the header from the screenshot”, “add a Financing button”.', 'msg bot'));
  tp.chat.forEach((m, i) => {
    if (m.role === 'user') {
      const d = el('div', undefined, 'msg user');
      if (m.files?.length || m.targets?.length) {
        const box = el('div', undefined, 'att');
        (m.files || []).forEach((f) => { if (f.kind === 'image' && f.dataUrl) { const im = document.createElement('img'); im.src = f.dataUrl; im.alt = f.name; box.append(im); } else box.append(el('span', (f.kind === 'image' ? '🖼 ' : '📄 ') + f.name)); });
        (m.targets || []).forEach((t) => box.append(el('span', '⌖ ' + t)));
        d.append(box);
      }
      if (m.text) d.append(document.createTextNode(m.text));
      log.append(d);
      return;
    }
    const d = el('div', undefined, 'msg bot' + (m.error || m.unchanged ? ' warn' : ''));
    if (m.text) d.append(document.createTextNode(m.text));
    if (m.changes?.length) { d.append(el('b', 'What I changed')); const ul = el('ul'); m.changes.forEach((x) => ul.append(el('li', x))); d.append(ul); }
    if (m.unsupported?.length) { d.append(el('b', 'What I could not do')); const ul = el('ul'); m.unsupported.forEach((x) => ul.append(el('li', x))); d.append(ul); }
    if (m.undoTo && i === tp.chat.length - 1) {
      const u = el('button', 'Undo this change', 'btn ghost sm2 undo');
      u.onclick = () => busy(u, async () => {
        tp.state = await api(`/api/clients/${slug}/template/restore`, { method: 'POST', body: { version: m.undoTo } });
        tp.chat.push({ role: 'bot', text: `Done. I went back to version ${m.undoTo} (saved as a new version).` });
        m.undoTo = 0; saveChat(); renderTemplate(); renderChat(); await runPreview();
      });
      d.append(u);
    }
    log.append(d);
  });
  log.scrollTop = log.scrollHeight;
}

// ---- attachments: button, paste, drag and drop ----
const ATT_OK = /\.(png|jpe?g|webp|gif|pdf|docx|txt|md|csv)$/i;
function addFiles(files) {
  for (const f of [...files]) {
    if (tp.atts.length >= 5) { toast('You can attach up to 5 files per message', true); break; }
    if (!(f.type.startsWith('image/') || ATT_OK.test(f.name))) { toast(`${f.name}: unsupported file type`, true); continue; }
    if (f.size > 8 * 1024 * 1024) { toast(`${f.name} is larger than 8 MB`, true); continue; }
    const r = new FileReader();
    r.onload = () => { tp.atts.push({ name: f.name || 'pasted-image.png', type: f.type, kind: f.type.startsWith('image/') ? 'image' : 'doc', dataUrl: r.result }); renderChips(); };
    r.readAsDataURL(f);
  }
}

function renderChips() {
  const box = $('td-chips');
  box.innerHTML = '';
  tp.atts.forEach((a, i) => {
    const c = el('div', undefined, 'chip');
    if (a.kind === 'image') { const im = document.createElement('img'); im.src = a.dataUrl; im.alt = ''; c.append(im); } else c.append(el('span', '📄'));
    const x = el('button', '×'); x.type = 'button'; x.title = 'Remove'; x.onclick = () => { tp.atts.splice(i, 1); renderChips(); };
    c.append(el('b', a.name), x);
    box.append(c);
  });
  tp.targets.forEach((t, i) => {
    const c = el('div', undefined, 'chip target');
    const x = el('button', '×'); x.type = 'button'; x.title = 'Remove'; x.onclick = () => { tp.targets.splice(i, 1); renderChips(); };
    c.append(el('span', '⌖'), el('b', `${t.frame === 'original' ? 'Original: ' : ''}${t.label}`), x);
    box.append(c);
  });
  box.hidden = !tp.atts.length && !tp.targets.length;
  syncSend();
}
const syncSend = () => { $('td-send').disabled = chatBusy || !($('td-instr').value.trim() || tp.atts.length); };

// ---- select an area on the page ----
const pickMarks = new WeakMap();
function cssPath(el, doc, layout, frame) {
  const root = el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : el.closest('main') ? 'main' : 'body';
  const top = root === 'main' && frame === 'new' ? `body[data-layout="${layout}"] main` : root;
  const stop = doc.querySelector(root) || doc.body;
  const parts = [];
  for (let n = el; n && n !== stop && n !== doc.body; n = n.parentElement) {
    if (n.id) { parts.unshift('#' + CSS.escape(n.id)); return parts.join(' > '); }
    const tag = n.tagName.toLowerCase();
    const same = [...n.parentElement.children].filter((x) => x.tagName === n.tagName);
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(n) + 1})` : tag);
  }
  return [top, ...parts].join(' > ');
}

function describeEl(el, doc, frame) {
  const secs = [...doc.querySelectorAll('main > section')];
  const sec = el.closest('main > section');
  const heading = (sec?.querySelector('h1,h2,h3')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const area = el.closest('header') ? 'Header' : el.closest('footer') ? 'Footer' : el.closest('.fab') ? 'Floating buttons' : el.closest('#to-top') ? 'Back-to-top button' : sec ? `Section ${secs.indexOf(sec) + 1}${heading ? ' “' + heading + '”' : ''}` : 'Page';
  const own = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const cs = doc.defaultView.getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const kind = el === sec ? 'whole section' : el.tagName.toLowerCase();
  return {
    frame, tag: el.tagName.toLowerCase(), label: `${area} · ${kind}${el !== sec && own ? ' “' + own.slice(0, 30) + '”' : ''}`,
    selector: cssPath(el, doc, tp.slot, frame), text: own,
    html: el.outerHTML.replace(/\s+/g, ' ').slice(0, 1200),
    style: { color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize, fontFamily: cs.fontFamily.split(',')[0], width: Math.round(r.width), height: Math.round(r.height) },
  };
}

function attachPick(frameEl, frame) {
  let doc; try { doc = frameEl.contentDocument; } catch { return; }
  if (!doc?.body || doc.__pick) return;
  doc.__pick = true;
  let last = null;
  const clear = () => { if (last) { last.style.outline = pickMarks.get(last) ?? ''; last = null; } };
  doc.addEventListener('mouseover', (e) => {
    if (!tp.picking) return;
    clear(); last = e.target; pickMarks.set(last, last.style.outline); last.style.outline = '3px solid #f97316'; last.style.outlineOffset = '-3px';
  }, true);
  doc.addEventListener('click', (e) => {
    if (!tp.picking) return;
    e.preventDefault(); e.stopPropagation();
    const t = describeEl(e.target, doc, frame);
    clear();
    if (tp.targets.length >= 3) tp.targets.shift();
    tp.targets.push(t);
    setPicking(false);
    renderChips();
    $('td-instr').focus();
  }, true);
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPicking(false); }, true);
}

function setPicking(on) {
  tp.picking = on;
  $('td-pick').classList.toggle('on', on);
  $('td-view-preview').classList.toggle('picking', on);
  let bar = $('td-pickbar');
  if (on) {
    if (tp.show === 'none') showPane('both');
    [['td-fn', 'new'], ['td-fo', 'original']].forEach(([id, f]) => attachPick($(id), f));
    if (!bar) {
      bar = el('div', undefined, 'pickbar'); bar.id = 'td-pickbar';
      bar.append(el('span', 'Click the part of the page you mean, in the New or the Original preview. Press Esc to cancel.'));
      const x = el('button', 'Cancel'); x.type = 'button'; x.onclick = () => setPicking(false); bar.append(x);
      $('td-compare').before(bar);
    }
    $('td-compare').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else bar?.remove();
}

// numbered outline of the page in the New preview, so "section 3" or "the services block" can be resolved
function pageOutline() {
  let doc; try { doc = $('td-fn').contentDocument; } catch { return []; }
  if (!doc?.body) return [];
  const out = [];
  const head = (n) => (n.querySelector('h1,h2,h3')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const bg = (n) => { const m = (n.className || '').match(/\bbg-[\w/\[\]#-]+/); return m ? m[0] : ''; };
  if (doc.querySelector('header')) out.push('Header (logo, menu, buttons)');
  [...doc.querySelectorAll('main > section')].forEach((s, i) => out.push(`Section ${i + 1}: ${head(s) ? '“' + head(s) + '”' : '(no heading)'} · ${bg(s) || 'no background class'} · ${Math.round(s.getBoundingClientRect().height)}px tall`));
  if (doc.querySelector('footer')) out.push('Footer');
  if (doc.querySelector('.fab')) out.push('Floating side buttons');
  return out;
}

// The original site has no fixed structure, so it is outlined by what is visible: header, footer and the headings in order.
function originalOutline() {
  let doc; try { doc = $('td-fo').contentDocument; } catch { return []; }
  if (!doc?.body) return [];
  const out = [];
  const y = (n) => Math.round(n.getBoundingClientRect().top + doc.defaultView.scrollY);
  const txt = (n) => (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const head = doc.querySelector('header, #header, .header, .main-header');
  if (head) out.push(`Header at ${y(head)}px (${Math.round(head.getBoundingClientRect().height)}px tall): “${txt(head).slice(0, 50)}”`);
  doc.querySelectorAll('section, .banner, .slider, .hero, h1, h2').forEach((n) => {
    if (out.length > 30 || !txt(n)) return;
    const tag = n.tagName.toLowerCase();
    out.push(`${/^h[12]$/.test(tag) ? 'Heading' : 'Block ' + tag + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ')[0] : '')} at ${y(n)}px: “${txt(n)}”`);
  });
  const foot = doc.querySelector('footer, #footer, .footer');
  if (foot) out.push(`Footer at ${y(foot)}px`);
  return out;
}

let chatBusy = false;
async function sendChat(opts = {}) {
  const input = $('td-instr'), text = opts.expert ? 'Run an expert design review of this page.' : input.value.trim();
  if ((!text && !tp.atts.length) || chatBusy) return;
  chatBusy = true;
  const files = tp.atts.slice(), targets = tp.targets.slice();
  const history = tp.chat.slice(-6).map((m) => ({ role: m.role, text: m.role === 'user' ? m.text : [m.text, ...(m.changes || [])].filter(Boolean).join(' ') }));
  tp.chat.push({ role: 'user', text, files, targets: targets.map((t) => t.label) });
  input.value = ''; input.style.height = 'auto';
  tp.atts = []; tp.targets = []; renderChips();
  renderChat();
  const log = $('td-chat-log'), wait = el('div', files.length || targets.length ? 'Looking at your page and attachments…' : 'Working on it…', 'msg bot typing');
  log.append(wait); log.scrollTop = log.scrollHeight;
  syncSend();
  try {
    const before = tp.state.spec.version;
    const body = { instruction: text, expert: Boolean(opts.expert), history, layout: tp.slot, page: tp.state.preview?.pages?.[tp.slot] || '', outline: pageOutline(), originalOutline: originalOutline(), targets, attachments: files.map(({ name, type, dataUrl }) => ({ name, type, dataUrl })) };
    const r = await api(`/api/clients/${slug}/template/refine`, { method: 'POST', body });
    tp.state = r.state;
    renderTemplate();
    let line = r.rationale || '';
    if (r.unchanged) line = (line ? line + ' ' : '') + (r.unsupported?.length ? '' : 'Nothing in the design changed.');
    tp.chat.push({ role: 'bot', text: line.trim(), changes: r.changes, unsupported: r.unsupported, unchanged: r.unchanged, undoTo: r.unchanged ? 0 : before });
    saveChat(); renderChat();
    if (!r.unchanged) {
      const w2 = el('div', 'Rebuilding the preview…', 'msg bot typing');
      $('td-chat-log').append(w2);
      await runPreview();
      w2.remove();
    }
  } catch (err) {
    tp.chat.push({ role: 'bot', text: 'Sorry, that did not work: ' + err.message, error: true });
    saveChat(); renderChat();
  } finally {
    chatBusy = false;
    syncSend();
    $('td-instr').focus();
  }
}

function initChat() {
  const input = $('td-instr'), comp = $('td-composer');
  input.oninput = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 200) + 'px'; syncSend(); };
  input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(); } };
  $('td-review').title = 'The assistant critiques the design like an art director and fixes the weakest parts';
  input.onpaste = (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); addFiles(f); } };
  comp.ondragover = (e) => { e.preventDefault(); comp.classList.add('drag'); };
  comp.ondragleave = () => comp.classList.remove('drag');
  comp.ondrop = (e) => { e.preventDefault(); comp.classList.remove('drag'); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); };
  $('td-attach').onclick = () => $('td-chatfile').click();
  $('td-chatfile').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
  $('td-pick').onclick = () => setPicking(!tp.picking);
  $('td-send').onclick = () => sendChat();
  $('td-review').onclick = () => sendChat({ expert: true });
  $('td-chat-clear').onclick = () => { tp.chat = []; saveChat(); renderChat(); };
  // the assistant is a window in the corner: minimise it to a button, open it again from there
  const dock = $('td-chat'), fab = $('td-chat-fab');
  const dockMin = (min) => { dock.classList.toggle('min', min); fab.hidden = !min; $('td-cs-fab').hidden = !min; $('td-cs-fab').hidden = !min; try { localStorage.setItem('sm-chatmin', min ? '1' : ''); } catch { /* storage unavailable */ } if (!min) { const l = $('td-chat-log'); l.scrollTop = l.scrollHeight; $('td-instr').focus(); } };
  $('td-chat-min').onclick = () => dockMin(true);
  fab.onclick = () => dockMin(false);
  try { if (localStorage.getItem('sm-chatmin')) { dock.classList.add('min'); fab.hidden = false; $('td-cs-fab').hidden = false; } } catch { /* storage unavailable */ }
  initCustomize();
  // the preview frames reload after every rebuild; keep the picker working on the new documents
  ['td-fn', 'td-fo'].forEach((id) => $(id).addEventListener('load', () => { if (tp.picking) attachPick($(id), id === 'td-fn' ? 'new' : 'original'); }));
}

async function runPreview() {
  const r = await api(`/api/clients/${slug}/template/preview`, { method: 'POST' });
  tp.state = await api(`/api/clients/${slug}/template`);
  renderTemplate();
  const bad = r.results.filter((x) => x.status === 'fail' || x.status === 'skipped');
  toast(bad.length ? `Preview built, but ${bad.length} page(s) have problems` : 'Preview ready', Boolean(bad.length));
}

// ---------- pages ----------
function renderSlots() {
  const { suggestions, spec } = tp.state;
  const box = $('td-slots');
  box.innerHTML = '';
  SLOTS.forEach(([slot, name, hint]) => {
    const sug = suggestions[slot];
    const manual = Boolean(spec.pages[slot]);
    const card = el('div', undefined, 'slot');
    card.append(el('b', name), el('small', hint));
    const seg = el('div', undefined, 'seg');
    ['Auto', 'Choose'].forEach((m, i) => {
      const b = el('button', m, (i === 1) === manual ? 'on' : '');
      b.onclick = () => setSlot(slot, i === 1 ? (spec.pages[slot] || sug.pick?.path || tp.state.suggestions.all[0]?.path) : '');
      seg.append(b);
    });
    card.append(seg);
    if (!manual) {
      card.append(el('div', sug.pick ? `${sug.pick.path}` : 'Nothing suitable found. Choose a page.', 'pick'), el('small', sug.pick?.why || ''));
    } else {
      const sel = tdSelect('slot_' + slot, tp.state.suggestions.all.map((p) => ({ value: p.path, label: `${p.path} (${p.type})` })), spec.pages[slot]);
      sel.onchange = () => setSlot(slot, sel.value);
      card.append(sel);
    }
    box.append(card);
  });
}
// Saves what is on the Configuration tab as a new version. The design variants read their colours and wishes from it.
async function saveConfig(note) {
  const patch = { tokens: {}, layout: {}, customCss: $('td-css').value, brief: $('td-brief').value };
  COLORS.forEach(([k]) => (patch.tokens[k] = $('tc_' + k).value));
  patch.tokens.fontHeading = $('tf_heading').value; patch.tokens.fontBody = $('tf_body').value;
  SECTIONS.tokens.forEach((k) => (patch.tokens[k] = $('to_' + k).value));
  SECTIONS.layout.forEach((k) => (patch.layout[k] = $('to_' + k).value));
  patch.layout.topbar = $('to_topbar').checked;
  patch.extras = { banners: tp.banners, web: tp.web };
  tp.state = await api(`/api/clients/${slug}/template`, { method: 'PUT', body: { patch, note } });
  if (window.studioInvalidate) window.studioInvalidate();
  tp.dirty = false;
  renderTemplate();
}
async function setSlot(slot, path) {
  tp.state = await api(`/api/clients/${slug}/template`, { method: 'PUT', body: { patch: { pages: { [slot]: path } }, note: `Page for ${slot}: ${path || 'auto'}` } });
  renderTemplate();
}

// ---------- design controls ----------
// Every input has a small preview beside it, and the fixed preview on the right redraws on each change.
function tdPreviewField(label, control, preview) {
  const f = el('div', undefined, 'f');
  const l = el('label', label);
  l.htmlFor = control.id;
  const row = el('div', undefined, 'f-prev');
  row.append(control, preview);
  f.append(l, row);
  return f;
}
function tdSized(kind) {
  const s = lpSample(kind);
  if (kind === 'density') s.append(...[0, 1, 2].map(() => el('i')));
  if (kind === 'container' || kind === 'shadow') s.append(el('i'));
  return s;
}
// ---------- banner images ----------
// one picture for the top banner of the home page, one for the inner pages and one for the contact page
const BANNERS = [['home', 'Home page'], ['inner', 'Inner pages'], ['contact', 'Contact page']];
const keepVideo = (slot) => (tp.banners[slot]?.video ? { video: tp.banners[slot].video } : {});
const readDataUrl = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
function bannerBlock() {
  const wrap = el('div', undefined, 'banners');
  wrap.style.marginTop = '18px';
  wrap.append(el('h3', 'Banner images'), el('small', 'A picture shown as the top banner of that kind of page. Choose a wide picture, 1600px or more across; it is saved as an optimised WebP. Leave it empty to keep the layout’s own hero.', 'hint'));
  const list = el('div', undefined, 'banner-list');
  list.style.cssText = 'display:grid;gap:12px;margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))';
  for (const [slot, label] of BANNERS) {
    const b = tp.banners[slot] || { src: '', alt: '' };
    const card = el('div', undefined, 'banner-card');
    card.style.cssText = 'border:1px solid var(--line,#e5e7eb);border-radius:.5rem;padding:10px;display:grid;gap:8px;background:var(--surface,#fff)';
    card.append(el('b', label));
    const pic = el('div'); pic.style.cssText = 'aspect-ratio:16/5;border-radius:.4rem;background:var(--soft,#f3f4f6);overflow:hidden;display:grid;place-items:center;color:var(--mute,#6b7280);font-size:12px';
    if (b.src) { const im = document.createElement('img'); im.src = `/original/${slug}/${b.src}`; im.alt = b.alt || label; im.style.cssText = 'width:100%;height:100%;object-fit:cover'; pic.append(im); } else pic.textContent = 'No banner picture';
    card.append(pic);
    const alt = document.createElement('input'); alt.placeholder = 'Describe the picture (alt text)'; alt.value = b.alt || ''; alt.maxLength = 140; alt.disabled = !b.src; alt.setAttribute('aria-label', `${label} banner description`);
    alt.oninput = () => { tp.banners[slot] = { ...tp.banners[slot], alt: alt.value }; tp.dirty = true; };
    // how the picture is used: behind the heading as the hero background, or as an ordinary picture beside it
    const mode = document.createElement('select'); mode.disabled = !b.src; mode.setAttribute('aria-label', `${label} banner use`);
    [['background', 'Use as background image (heading over the picture)'], ['image', 'Use as normal image (beside the heading)']].forEach(([v, t]) => mode.add(new Option(t, v)));
    mode.value = b.mode === 'image' ? 'image' : 'background';
    mode.onchange = () => { tp.banners[slot] = { ...tp.banners[slot], mode: mode.value }; tp.dirty = true; lpSync(); };
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp'; file.hidden = true;
    const pick = el('button', b.src ? 'Change picture' : 'Choose picture', 'btn ghost sm2'); pick.type = 'button'; pick.onclick = () => file.click();
    file.onchange = () => busy(pick, async () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 12 * 1024 * 1024) { toast('That picture is larger than 12 MB.', true); return; }
      const r = await api(`/api/clients/${slug}/template/banner`, { method: 'POST', body: { slot, name: f.name, dataUrl: await readDataUrl(f) } });
      tp.banners[slot] = { ...keepVideo(slot), mode: tp.banners[slot]?.mode || 'background', src: r.src, alt: tp.banners[slot]?.alt || f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 140) };
      tp.dirty = true; renderBanners();
      toast(r.lowRes ? `Banner added (${r.width}px wide: a larger picture will look sharper). Press “Save as new version”.` : 'Banner added. Press “Save as new version” to keep it.');
    });
    // or a picture from a web address: it is downloaded once and kept with the template
    const link = document.createElement('input'); link.type = 'url'; link.placeholder = 'or paste an image link (https://…)'; link.setAttribute('aria-label', `${label} banner image link`);
    const use = el('button', 'Use link', 'btn ghost sm2'); use.type = 'button';
    const useLink = () => busy(use, async () => {
      const v = link.value.trim();
      if (!v) { toast('Paste the address of a picture first.', true); return; }
      const r = await api(`/api/clients/${slug}/template/banner`, { method: 'POST', body: { slot, url: v } });
      tp.banners[slot] = { ...keepVideo(slot), mode: tp.banners[slot]?.mode || 'background', src: r.src, alt: tp.banners[slot]?.alt || r.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 140) };
      tp.dirty = true; renderBanners();
      toast(r.lowRes ? `Banner added (${r.width}px wide: a larger picture will look sharper). Press “Save as new version”.` : 'Banner added from the link. Press “Save as new version” to keep it.');
    });
    use.onclick = useLink; link.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); useLink(); } };
    const linkRow = el('div', undefined, 'row'); linkRow.style.flexWrap = 'nowrap'; link.style.flex = '1 1 auto'; link.style.minWidth = '0'; linkRow.append(link, use);
    const clear = el('button', 'Remove', 'btn ghost sm2'); clear.type = 'button'; clear.hidden = !b.src;
    clear.onclick = () => { tp.banners[slot] = { ...keepVideo(slot), src: '', alt: '', mode: tp.banners[slot]?.mode || 'background' }; tp.dirty = true; renderBanners(); };
    const row = el('div', undefined, 'row'); row.append(pick, clear, file);
    // a looping background video: the picture above is its poster (shown while it loads, and when the visitor prefers no motion)
    const vbox = el('div', undefined, 'banner-video'); vbox.style.cssText = 'display:grid;gap:6px;border-top:1px dashed var(--line,#e5e7eb);padding-top:8px';
    vbox.append(el('b', 'Background video'), el('small', b.video?.src ? `Video in use: ${b.video.src.split('/').pop()}. It plays muted and looping behind the heading.` : 'Optional. An MP4 or WebM file up to 25 MB, 10 to 15 seconds is plenty. It plays muted and looping behind the heading.', 'hint'));
    if (b.video?.src) { const pv = document.createElement('video'); pv.src = `/original/${slug}/${b.video.src}`; pv.muted = true; pv.loop = true; pv.autoplay = true; pv.playsInline = true; pv.style.cssText = 'width:100%;aspect-ratio:16/5;object-fit:cover;border-radius:.4rem;background:#000'; vbox.append(pv); }
    const vfile = document.createElement('input'); vfile.type = 'file'; vfile.accept = 'video/mp4,video/webm'; vfile.hidden = true;
    const vpick = el('button', b.video?.src ? 'Change video' : 'Choose video', 'btn ghost sm2'); vpick.type = 'button'; vpick.onclick = () => vfile.click();
    const setVideo = (r) => { tp.banners[slot] = { ...tp.banners[slot], mode: 'background', video: { src: r.src } }; tp.dirty = true; renderBanners(); toast('Video added. Press “Save as new version” to keep it.'); };
    vfile.onchange = () => busy(vpick, async () => {
      const f = vfile.files[0]; if (!f) return;
      if (f.size > 25 * 1024 * 1024) { toast('That video is larger than 25 MB.', true); return; }
      setVideo(await api(`/api/clients/${slug}/template/banner-video`, { method: 'POST', body: { slot, name: f.name, dataUrl: await readDataUrl(f) } }));
    });
    const vlink = document.createElement('input'); vlink.type = 'url'; vlink.placeholder = 'or paste a video file link (https://….mp4)'; vlink.setAttribute('aria-label', `${label} banner video link`);
    const vuse = el('button', 'Use link', 'btn ghost sm2'); vuse.type = 'button';
    const useVideoLink = () => busy(vuse, async () => { const v = vlink.value.trim(); if (!v) { toast('Paste the address of a video file first.', true); return; } setVideo(await api(`/api/clients/${slug}/template/banner-video`, { method: 'POST', body: { slot, url: v } })); });
    vuse.onclick = useVideoLink; vlink.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); useVideoLink(); } };
    const vlinkRow = el('div', undefined, 'row'); vlinkRow.style.flexWrap = 'nowrap'; vlink.style.flex = '1 1 auto'; vlink.style.minWidth = '0'; vlinkRow.append(vlink, vuse);
    const vclear = el('button', 'Remove video', 'btn ghost sm2'); vclear.type = 'button'; vclear.hidden = !b.video?.src;
    vclear.onclick = () => { const { video, ...rest } = tp.banners[slot] || {}; tp.banners[slot] = rest; tp.dirty = true; renderBanners(); };
    const vrow = el('div', undefined, 'row'); vrow.append(vpick, vclear, vfile);
    vbox.append(vrow, vlinkRow);
    card.append(alt, mode, row, linkRow, vbox);
    list.append(card);
  }
  wrap.append(list);
  return wrap;
}
// ---------- website details and motion ----------
// what a finished website needs besides its colours and fonts: the announcement, the main call to action, the business line, the hours,
// the social pages, the look of the hero, the colour of the calls to action and how much the page moves
const WEB_SOCIAL = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['tiktok', 'TikTok'], ['google', 'Google Business'], ['yelp', 'Yelp']];
function webBlock() {
  const w = tp.web || (tp.web = {});
  for (const k of ['announce', 'cta', 'social', 'hero', 'motion', 'controls']) w[k] = w[k] || {};
  const wrap = el('div', undefined, 'webset');
  wrap.style.marginTop = '22px';
  wrap.append(el('h3', 'Website details and motion'), el('small', 'What a finished website needs besides its colours and fonts. Everything here is optional: what you leave empty is read from the old website.', 'hint'));
  const grid = el('div'); grid.style.cssText = 'display:grid;gap:14px;margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(19rem,1fr))';
  const dirty = () => { tp.dirty = true; };
  const card = (title, hint) => { const c = el('div'); c.style.cssText = 'border:1px solid var(--line,#e5e7eb);border-radius:.5rem;padding:12px;display:grid;gap:8px;align-content:start;background:var(--surface,#fff)'; c.append(el('b', title)); if (hint) c.append(el('small', hint, 'hint')); grid.append(c); return c; };
  const text = (c, label, get, set, { max = 140, ph = '', type = 'text' } = {}) => { const l = el('label', label); l.style.cssText = 'display:grid;gap:4px;font-size:12px;font-weight:600'; const i = document.createElement('input'); i.type = type; i.maxLength = max; i.placeholder = ph; i.value = get() || ''; i.oninput = () => { set(i.value); dirty(); }; l.append(i); c.append(l); return i; };
  const select = (c, label, options, get, set) => { const l = el('label', label); l.style.cssText = 'display:grid;gap:4px;font-size:12px;font-weight:600'; const s = document.createElement('select'); options.forEach(([v, t]) => s.add(new Option(t, v))); s.value = get(); s.onchange = () => { set(s.value); dirty(); }; l.append(s); c.append(l); return s; };
  const check = (c, label, get, set) => { const l = el('label', undefined, 'chk'); const i = document.createElement('input'); i.type = 'checkbox'; i.checked = get(); i.onchange = () => { set(i.checked); dirty(); }; l.append(i, el('span', label)); c.append(l); return i; };

  const a = card('Announcement bar', 'A short line over the header, for an offer or a notice. Empty: the address or the opening hours are shown there.');
  check(a, 'Show the bar', () => w.announce.on !== false, (v) => { w.announce.on = v; });
  text(a, 'Text', () => w.announce.text, (v) => { w.announce.text = v; }, { ph: 'Same-day service, 7 days a week' });
  text(a, 'Link (optional)', () => w.announce.href, (v) => { w.announce.href = v; }, { max: 300, ph: '/schedule-now.html or https://…' });

  const c = card('Main call to action', 'The button in the header and the closing sections. Empty: the wording and page of the old website.');
  text(c, 'Button text', () => w.cta.label, (v) => { w.cta.label = v; }, { max: 40, ph: 'Get a free quote' });
  text(c, 'Button link', () => w.cta.href, (v) => { w.cta.href = v; }, { max: 300, ph: '/contact.html, #quote or tel:+1…' });
  select(c, 'Colour of the calls to action', [['auto', 'Automatic (the livelier of secondary and accent)'], ['secondary', 'Secondary colour'], ['accent', 'Accent colour'], ['primary', 'Primary colour']], () => w.pop || 'auto', (v) => { w.pop = v; });

  const b = card('Business details', 'Shown in the footer and over the header.');
  text(b, 'A line about the business', () => w.tagline, (v) => { w.tagline = v; }, { max: 220, ph: 'Licensed and insured plumbers serving Broward since 1998' });
  text(b, 'Opening hours', () => w.hours, (v) => { w.hours = v; }, { max: 120, ph: 'Mon to Fri 8:00 to 17:00' });

  const s = card('Social pages', 'Full addresses (https://…). Only the ones you fill in are shown in the footer.');
  const sg = el('div'); sg.style.cssText = 'display:grid;gap:8px;grid-template-columns:1fr 1fr';
  WEB_SOCIAL.forEach(([k, label]) => text(sg, label, () => w.social[k], (v) => { if (v.trim()) w.social[k] = v.trim(); else delete w.social[k]; }, { max: 300, ph: 'https://', type: 'url' }));
  s.append(sg);

  const h = card('Hero', 'The top of the home page and of the inner pages. Its picture or video is set in Banner images above.');
  select(h, 'Veil over the picture or video', [['light', 'Light (the picture shows more)'], ['medium', 'Medium'], ['strong', 'Strong (the text reads best)']], () => w.hero.overlay || 'medium', (v) => { w.hero.overlay = v; });
  select(h, 'Height of the home hero', [['standard', 'Standard'], ['tall', 'Tall'], ['full', 'Full screen']], () => w.hero.height || 'tall', (v) => { w.hero.height = v; });
  check(h, 'Small labels over sections (Reviews, Questions, Service areas…)', () => w.labels !== false, (v) => { w.labels = v; });
  select(h, 'Background pattern of the banner (Crest, Orbit, Vista, Facet and Zephyr designs)', [['auto', 'Automatic (suits the kind of business)'], ['waves', 'Waves'], ['dots', 'Dots'], ['grid', 'Grid'], ['hatch', 'Fine diagonal lines'], ['plus', 'Crosses'], ['rings', 'Rings'], ['hex', 'Honeycomb'], ['none', 'No pattern']], () => w.pattern || 'auto', (v) => { w.pattern = v; });

  const m = card('Motion', 'Headings that rise word by word, pictures that are uncovered, numbers that count up. Visitors who ask their device for less motion always get a still page.');
  select(m, 'How much the page moves', [['full', 'Full'], ['subtle', 'Subtle (fades only)'], ['off', 'Off']], () => w.motion.level || 'full', (v) => { w.motion.level = v; });
  check(m, 'Slow zoom on the hero picture', () => w.motion.zoom !== false, (v) => { w.motion.zoom = v; });
  check(m, 'Reading progress bar at the top', () => w.controls.progress !== false, (v) => { w.controls.progress = v; });
  check(m, 'Back-to-top button', () => w.controls.top !== false, (v) => { w.controls.top = v; });

  wrap.append(grid);
  return wrap;
}
function renderBanners() { const old = document.querySelector('#td-controls .banners'); if (old) old.replaceWith(bannerBlock()); lpSync(); }

function renderControls() {
  const { spec, options, fonts } = tp.state;
  tp.banners = JSON.parse(JSON.stringify(spec.extras?.banners || {}));
  tp.web = JSON.parse(JSON.stringify(spec.extras?.web || {}));
  const box = $('td-controls');
  box.innerHTML = '';
  box.append(themeMgrHost());
  const colors = el('div', undefined, 'brand-grid');
  colors.hidden = true; // the colours are chosen in the theme above; these keep the values the older parts of the page read
  COLORS.forEach(([k, label]) => {
    const wrap = el('div');
    const cp = colorPicker({ id: 'tc_' + k, label, value: spec.tokens[k], onChange: () => { tp.dirty = true; lpSync(); } });
    wrap.append(el('label', label), cp.root);
    colors.append(wrap);
  });
  box.append(colors);
  const onChange = (sel) => { sel.addEventListener('change', () => { tp.dirty = true; lpSync(); }); return sel; };
  const grid = el('div', undefined, 'grid');
  grid.style.marginTop = '14px';
  grid.append(
    tdPreviewField('Heading font', onChange(tdFontSelect('tf_heading', fonts.filter((f) => f.heading), spec.tokens.fontHeading)), lpSample('fontHeading')),
    tdPreviewField('Body font', onChange(tdFontSelect('tf_body', fonts.filter((f) => f.body), spec.tokens.fontBody)), lpSample('fontBody')),
  );
  const TOKEN_SAMPLE = { radius: 'radius', shadow: 'shadow', density: 'density', headingCase: 'headingCase', headingWeight: 'headingWeight', container: 'container' };
  SECTIONS.tokens.forEach((k) => grid.append(tdPreviewField(LABELS[k], onChange(tdSelect('to_' + k, options[k], spec.tokens[k])), tdSized(TOKEN_SAMPLE[k]))));
  SECTIONS.layout.forEach((k) => {
    const w = lpSample('wire'); w.dataset.kind = k;
    grid.append(tdPreviewField(LABELS[k], onChange(tdSelect('to_' + k, options[k], spec.layout[k])), w));
  });
  const tb = document.createElement('input');
  tb.type = 'checkbox'; tb.id = 'to_topbar'; tb.checked = spec.layout.topbar; tb.style.width = 'auto';
  tb.addEventListener('change', () => { tp.dirty = true; lpSync(); });
  const tf = tdField('Show address / phone bar above the menu', tb);
  grid.append(tf);
  box.append(grid);
  box.append(bannerBlock());
  box.append(webBlock());
  const live = $('td-live');
  if (!live.firstChild) live.innerHTML = lpHtml();
  tp.dirty = false;
  lpSync();
}

function renderVersions() {
  const t = $('td-versions');
  t.innerHTML = '';
  const head = el('tr');
  head.append(el('th', 'Version'), el('th', 'Saved'), el('th', 'Note'), el('th', ''));
  t.append(head);
  tp.state.versions.forEach((v) => {
    const tr = el('tr');
    const b = el('button', v.version === tp.state.spec.version ? 'Current' : 'Restore', 'btn ghost sm2');
    b.disabled = v.version === tp.state.spec.version;
    b.onclick = () => busy(b, async () => { tp.state = await api(`/api/clients/${slug}/template/restore`, { method: 'POST', body: { version: v.version } }); renderTemplate(); toast(`Restored v${v.version} as a new version`); });
    const td = el('td'); td.append(b);
    tr.append(el('td', 'v' + v.version), el('td', new Date(v.savedAt).toLocaleString()), el('td', v.note || v.name || ''), td);
    t.append(tr);
  });
}

// ---------- preview ----------
function renderPreviewFrames() {
  const st = tp.state;
  document.querySelectorAll('#td-slotseg button').forEach((b) => b.classList.toggle('on', b.dataset.slot === tp.slot));
  const note = $('td-prevnote');
  const prev = st.preview;
  if (prev && !prev.pages[tp.slot]) tp.slot = ['home', 'inner', 'contact'].find((x) => prev.pages[x]) || tp.slot;
  document.querySelectorAll('#td-slotseg button').forEach((b) => b.classList.toggle('on', b.dataset.slot === tp.slot));
  if (!prev) {
    note.textContent = 'Press Build preview to see this version on your pages.';
    $('td-fo').removeAttribute('src'); $('td-fn').removeAttribute('src'); setOpen(null);
    return;
  }
  const path = prev.pages[tp.slot];
  const res = prev.results.find((r) => r.path === path);
  if (!path) { note.textContent = 'No page is selected for this layout. Choose one above.'; $('td-fo').removeAttribute('src'); $('td-fn').removeAttribute('src'); setOpen(null); return; }
  note.textContent = `${path} · rendered with the ${res?.layout || tp.slot} layout${res && res.status === 'fail' ? ' · has problems: ' + res.issues.join('; ') : ''}`;
  $('td-fo').src = `/original/${slug}/${path}`;
  $('td-fn').src = `/draft/${slug}/${path}?v=${prev.version}&t=${Date.parse(prev.at)}`;
  setOpen(`/draft/${slug}/${path}?v=${prev.version}&t=${Date.parse(prev.at)}`);
}

// The new design opens as a normal page in its own browser window, at the real window size, for checking responsiveness.
function setOpen(url) {
  const a = $('td-open');
  if (url) { a.href = url; a.removeAttribute('aria-disabled'); a.style.pointerEvents = ''; a.style.opacity = ''; }
  else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.style.pointerEvents = 'none'; a.style.opacity = '.5'; }
}

// ---------- how this site gets its template ----------
// platform: the AI designer and its views. existing: the template is built from the site's own modern pages.
function applyType() {
  const t = tp.state.templateType || '';
  $('td-chooser').hidden = Boolean(t);
  $('td-typebar').hidden = !t;
  $('td-typename').textContent = t === 'existing' ? 'From existing pages' : 'New template with the platform';
  const platform = t === 'platform';
  $('td-views').hidden = !platform;
  $('td-view-existing').hidden = t !== 'existing';
  if (platform) showView(tp.view);
  else { ['designs', 'config', 'variants', 'composer', 'preview'].forEach((x) => { $('td-view-' + x).hidden = true; }); document.body.classList.remove('cp-wide'); }
  // the finalise controls and the draft badge belong to the platform designer
  const final = tp.state.final;
  $('td-final').hidden = !platform || final;
  $('td-reopen').hidden = !platform || !final;
  // the same badge the designer shows: a template made of existing pages is finalised once its template pages are saved
  $('td-badge').hidden = !t;
  $('dstatus').className = 'dot' + (final ? ' ok' : ' warn');
  if (t === 'existing') { $('td-badge').textContent = final ? 'Finalised · from existing pages' : 'Draft · choose the template pages'; $('td-badge').className = 'badge ' + (final ? 'approved' : 'draft'); }
}

async function setType(type) {
  tp.state = await api(`/api/clients/${slug}/template/type`, { method: 'PUT', body: { type } });
  applyType();
  if (type === 'existing') await loadExisting();
}

async function loadExisting() {
  tp.ex = await api(`/api/clients/${slug}/template/existing`);
  renderExisting();
}

const exUrl = (p) => `/original/${slug}/${p.split('/').map(encodeURIComponent).join('/')}`;
const FAM = { modern: ['Modern (Tailwind CSS)', 'approved'], legacy: ['Legacy (old template)', 'draft'] };

function renderExisting() {
  const ex = tp.ex;
  $('ex-detect').textContent = ex.detected ? 'Detect again' : 'Detect templates';
  $('ex-note').textContent = ex.detected ? `Detected ${new Date(ex.detectedAt).toLocaleString()} · ${ex.summary.pages} pages looked at` : 'Looks at every scanned page and sorts it into modern (Tailwind CSS) or legacy (old template). Run the Site audit first.';
  $('ex-result').hidden = !ex.detected;
  $('ex-pick-card').hidden = !ex.detected || !ex.modernPages.length;
  if (!ex.detected) return;

  const stats = $('ex-stats');
  stats.replaceChildren(...[['Modern pages', ex.summary.modern], ['Legacy pages', ex.summary.legacy], ['Template groups', ex.groups.length]].map(([k, v]) => { const d = el('div', undefined, 'stat'); d.append(el('b', String(v)), el('span', k)); return d; }));

  const gt = $('ex-groups');
  const head = (cols) => { const tr = el('tr'); cols.forEach((c) => tr.append(el('th', c))); return tr; };
  gt.replaceChildren(head(['Group', 'Looks like', 'Pages', 'Tailwind markup', 'Main folders', 'Example page']), ...ex.groups.map((g) => {
    const tr = el('tr');
    const fam = el('td'); fam.append(el('span', FAM[g.family][0], 'badge ' + FAM[g.family][1]));
    const a = el('a', g.sample); a.href = exUrl(g.sample); a.target = '_blank'; a.rel = 'noopener';
    const ex1 = el('td'); ex1.append(a);
    tr.append(el('td', g.id.replace('g', 'Group ')), fam, el('td', String(g.pages), 'n'), el('td', `${Math.round(g.share * 100)}% of classes · ${g.variants} variants per page`), el('td', g.folders.slice(0, 4).map((f) => `${f.folder || '(site root)'} · ${f.count}`).join(', ')), ex1);
    return tr;
  }));

  const ft = $('ex-folders');
  ft.replaceChildren(head(['Folder', 'Pages', 'Modern', 'Legacy', 'Treat as']), ...ex.folders.map((f) => {
    const tr = el('tr');
    const sel = document.createElement('select'); sel.className = 'auto'; sel.setAttribute('aria-label', 'Treat ' + (f.folder || 'site root') + ' as');
    [['auto', `Auto (${f.detected.modern >= f.detected.legacy ? 'modern' : 'legacy'})`], ['modern', 'Modern'], ['legacy', 'Legacy']].forEach(([v, l]) => sel.add(new Option(l, v)));
    sel.value = f.override;
    sel.onchange = () => busy(sel, async () => { tp.ex = await api(`/api/clients/${slug}/template/existing/family`, { method: 'PUT', body: { target: f.key, family: sel.value } }); renderExisting(); });
    const c = el('td'); c.append(sel);
    tr.append(el('td', f.folder ? f.folder + '/' : '(site root files)'), el('td', String(f.total), 'n'), el('td', String(f.modern), 'n'), el('td', String(f.legacy), 'n'), c);
    return tr;
  }));
  renderExistingSlots();
  renderExistingTemplates();
  renderExistingPatterns();
  renderExistingPreview();
}

function renderExistingSlots() {
  const ex = tp.ex, box = $('ex-slots');
  const SLOT = [['home', 'Home page', 'Also gives the header and footer'], ['inner', 'Inner page', 'Service, location and content pages'], ['contact', 'Contact page', 'Details and the form']];
  box.replaceChildren(...SLOT.map(([key, label, note]) => {
    const wrap = el('div', undefined, 'ex-slot');
    const sel = document.createElement('select'); sel.id = 'ex-sel-' + key; sel.className = 'auto';
    sel.add(new Option('Keep using a designed template', ''));
    ex.modernPages.forEach((p) => sel.add(new Option(`${p.path}${p.path === ex.suggested[key] ? '  ★ suggested' : ''} (${p.words} words)`, p.path)));
    sel.value = ex.selection[key] || ex.suggested[key] || '';
    const frame = document.createElement('iframe'); frame.className = 'ex-frame'; frame.title = label + ' template preview'; frame.loading = 'lazy';
    const open = el('a', 'Open in a new window'); open.target = '_blank'; open.rel = 'noopener';
    const show = () => { if (sel.value) { frame.hidden = false; frame.src = exUrl(sel.value); open.href = exUrl(sel.value); open.hidden = false; } else { frame.hidden = true; frame.removeAttribute('src'); open.hidden = true; } };
    sel.onchange = show; show();
    const why = ex.candidates[key].find((c) => c.path === sel.value)?.why;
    wrap.append(el('h4', label), el('small', why ? `${note} · ${why}` : note), sel, frame, open);
    return wrap;
  }));
  const s = ex.selection;
  $('ex-saved').textContent = s.savedAt ? `Saved ${new Date(s.savedAt).toLocaleString()} · Content & build now converts the legacy pages with these template pages` : 'Not saved yet';
}

// step 3: the template pages as templates: header and footer apart, every section on its own row, the theme read from the page
const ED_LAYOUTS = [['home', 'Home'], ['inner', 'Inner page'], ['contact', 'Contact']];
const ed = { layout: 'inner', data: null, sel: 'theme', theme: {} };
const edFile = (u) => String(u || '').replace(/^https?:\/\/[^/]+/, '').replace('/ownpreview/' + slug + '/', '');
function renderExistingTemplates() {
  const ex = tp.ex, s = ex.selection;
  const have = ED_LAYOUTS.filter(([k]) => s[k]);
  $('ex-tpl-card').hidden = !ex.detected || !have.length;
  $('ex-tpl-tiles').replaceChildren(...have.map(([k, label]) => {
    const wrap = el('div', undefined, 'ex-slot');
    const open = el('button', 'Open template', 'btn'); open.type = 'button';
    open.onclick = () => busy(open, () => openEditor(k));
    wrap.append(el('h4', label), el('small', s[k]), open);
    return wrap;
  }));
}

async function openEditor(layout) {
  ed.layout = layout; ed.sel = 'theme';
  $('ex-ed-state').textContent = 'Reading the page…';
  ed.data = await api(`/api/clients/${slug}/template/existing/outline/${layout}`);
  document.querySelectorAll('#td-view-existing > .card').forEach((c) => { if (c.dataset.was === undefined || $('ex-editor').hidden) c.dataset.was = c.hidden ? '1' : ''; c.hidden = true; });
  $('ex-editor').hidden = false;
  document.body.classList.add('cp-wide', 'cp-focus');
  $('ex-ed-title').textContent = 'Template';
  $('ex-ed-layout').replaceChildren(...ED_LAYOUTS.filter(([k]) => tp.ex.selection[k]).map(([k, label]) => { const b = el('button', label); b.type = 'button'; b.dataset.layout = k; b.className = k === layout ? 'on' : ''; return b; }));
  $('ex-ed-frame').src = ed.data.editUrl + '?t=' + Date.now();
  $('ex-ed-state').textContent = ed.data.page;
  renderEdOutline(); renderEdInspector();
}
function closeEditor() {
  $('ex-editor').hidden = true;
  document.body.classList.remove('cp-wide', 'cp-focus');
  document.querySelectorAll('#td-view-existing > .card').forEach((c) => { c.hidden = c.dataset.was === '1'; delete c.dataset.was; });
  renderExisting();
}

const roleName = (v) => (ed.data.roles.find((r) => r.value === v)?.label || v).replace(/ \(.*$/, '');
function renderEdOutline() {
  const ul = $('ex-ed-outline');
  const row = (key, label, sub, pinned, role) => {
    const li = el('li', undefined, 'cp-row' + (pinned ? ' pinned' : '') + (ed.sel === key ? ' sel' : ''));
    const nm = el('div', undefined, 'nm'); nm.append(el('b', label), el('small', sub));
    nm.onclick = () => edSelect(key);
    li.append(el('span', pinned ? '▤' : '▭', 'grip'), nm);
    if (role) { const b = el('span', role.you ? 'You' : 'Auto', 'ed-role' + (role.you ? ' you' : '')); b.title = role.you ? 'You chose this role' : 'Worked out automatically'; li.append(b); }
    return li;
  };
  ul.replaceChildren(row('theme', 'Theme and styles', 'Colours, fonts, headings, buttons', true));
  for (const it of ed.data.items) {
    if (it.kind === 'section') ul.append(row(it.key, it.label, roleName(it.role), false, it));
    else ul.append(row(it.key, it.label, 'Reused on every converted page', true));
  }
}
function edSelect(key) {
  ed.sel = key;
  renderEdOutline(); renderEdInspector();
  if (key !== 'theme') $('ex-ed-frame').contentWindow?.postMessage({ sm: 'select', key }, '*');
}
window.addEventListener('message', (e) => { if (e.data?.sm === 'select' && !$('ex-editor').hidden) edSelect(e.data.key); });

const ROLE_HELP = {
  hero: 'The top of the page. It gets the old page\'s title, a short line from its description and its breadcrumb.',
  text: 'The old page\'s text is poured into this section, written with this page\'s own heading, paragraph and list styles.',
  band: 'Kept exactly as it is on every converted page (a strip, a row of figures).',
  common: 'A common section: its design and wording are kept on every converted page. Only the wording that names the service of this template page (for example "Residential Junk Removal") is changed to the service of the page being converted.',
  cards: 'Its card design is used for the old page\'s cards. The section itself is not copied.',
  faq: 'Its question and answer design is used for the old page\'s FAQs. The section itself is not copied.',
  reviews: 'Its design is used for the old page\'s reviews. The section itself is not copied.',
  cta: 'The closing call-to-action band. It carries the old page\'s own call to action when it has one.',
  form: 'The box the old page\'s form is put in. It keeps its own title.',
  drop: 'Belongs to this template page\'s own subject, so it is not copied to converted pages.',
};
function kv(rows) { const dl = el('dl', undefined, 'ed-kv'); for (const [k, v] of rows) { const d = el('div'); d.append(el('dt', k), el('dd', String(v))); dl.append(d); } return dl; }

function renderEdInspector() {
  const box = $('ex-ed-inspector');
  if (ed.sel === 'theme') return renderEdTheme(box);
  const it = ed.data.items.find((x) => x.key === ed.sel);
  if (!it) { box.replaceChildren(el('div', 'Choose a part of the page.', 'cp-empty')); return; }
  if (it.kind !== 'section') {
    box.replaceChildren(el('h3', it.label), el('p', it.kind === 'header' ? 'The header, its menu and its top bar are taken from this template page and reused on every converted page. Their links are adjusted for each page\'s folder.' : 'The footer is taken from this template page and reused on every converted page.', 'hint'), kv([['Links', it.links], ['Classes', it.classes || '–']]));
    return;
  }
  const sel = document.createElement('select'); sel.id = 'ex-ed-role';
  ed.data.roles.forEach((r) => sel.add(new Option(r.label + (r.value === it.auto ? '  (automatic)' : ''), r.value)));
  sel.value = it.role;
  sel.onchange = () => edSaveRole(it.key, sel.value, it.auto);
  const f = el('div', undefined, 'f'); f.append(el('label', 'What this section is used for'), sel);
  // the quick way to say a section is common to all the pages of this template
  const common = document.createElement('input'); common.type = 'checkbox'; common.id = 'ex-ed-common'; common.checked = it.role === 'common';
  common.onchange = () => edSaveRole(it.key, common.checked ? 'common' : it.auto === 'common' ? 'drop' : it.auto, it.auto);
  const cl = el('label', undefined, 'ex-ed-common'); cl.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin:0 0 10px;font-weight:600'; const ct = el('span'); ct.innerHTML = 'Common section <small style="display:block;font-weight:400">Keep it on every page. Only the wording about the service is updated for each page.</small>'; cl.append(common, ct); common.style.width = 'auto'; common.style.marginTop = '3px';
  const back = it.you ? (() => { const b = el('button', 'Back to automatic', 'btn ghost sm2'); b.type = 'button'; b.onclick = () => edSaveRole(it.key, it.auto, it.auto); return b; })() : null;
  box.replaceChildren(el('h3', it.label), cl, f, el('p', ROLE_HELP[it.role] || '', 'hint'), ...(back ? [back] : []),
    el('h3', 'About this section'), kv([['Id', it.id || '–'], ['Words', it.words], ['Headings', it.headings], ['Has a form', it.form ? 'Yes' : 'No'], ['Classes', it.classes || '–']]));
}
async function edSaveRole(key, role, auto) {
  const roles = {};
  for (const x of ed.data.items) if (x.kind === 'section' && x.you) roles[x.key] = x.role;
  if (role === auto) delete roles[key]; else roles[key] = role;
  $('ex-ed-state').textContent = 'Saving…';
  try {
    ed.data = await api(`/api/clients/${slug}/template/existing/roles`, { method: 'PUT', body: { layout: ed.layout, roles } });
    $('ex-ed-state').textContent = 'Saved · converted pages follow this the next time they are built';
    renderEdOutline(); renderEdInspector();
  } catch (e) { $('ex-ed-state').textContent = ''; toast(e.message, true); }
}

async function renderEdTheme(box) {
  box.replaceChildren(el('h3', 'Theme and styles'), el('p', 'Reading the colours and fonts from the page…', 'hint'));
  let th = ed.theme[ed.layout];
  if (!th) {
    try { th = ed.theme[ed.layout] = await api(`/api/clients/${slug}/template/existing/theme/${ed.layout}`); } catch (e) { box.replaceChildren(el('h3', 'Theme and styles'), el('p', e.message, 'note bad')); return; }
  }
  if (ed.sel !== 'theme') return;
  const sw = (hex, name) => { const d = el('div', undefined, 'ed-sw'); const i = el('i'); i.style.background = hex; const t = el('div'); t.append(el('b', name), el('small', hex)); d.append(i, t); return d; };
  const pal = el('div', undefined, 'ed-pal'); th.palette.forEach((p) => pal.append(sw(p.hex, p.role)));
  const chips = el('div', undefined, 'ed-chips'); th.colors.slice(0, 18).forEach((c) => { const i = el('i'); i.style.background = c.hex; i.title = c.hex; chips.append(i); });
  const fonts = th.fonts.map((f) => { const d = el('div', undefined, 'ed-type'); const heading = th.headings.find((h) => h.family === f.family), isBody = th.body.family === f.family; d.append(el('b', f.family), el('small', [heading ? 'headings' : '', isBody ? 'body text' : '', 'weights ' + f.weights.join(', ')].filter(Boolean).join(' · '))); return d; });
  const heads = th.headings.map((h) => { const d = el('div', undefined, 'ed-type'); d.append(el('b', h.tag.toUpperCase()), el('small', `${h.size}px · weight ${h.weight} · ${h.family}${h.transform && h.transform !== 'none' ? ' · ' + h.transform : ''}`)); if (h.color) { const i = el('i'); i.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:4px;background:${h.color};margin-left:auto`; d.append(i); } return d; });
  const btns = th.buttons.map((b) => { const a = el('span', 'Button', 'ed-btn'); a.style.cssText = `background:${b.bg};color:${b.color || '#fff'};border-radius:${b.radius};font-weight:${b.weight}`; a.title = `${b.bg} · radius ${b.radius} · padding ${b.padding}`; return a; });
  const reread = el('button', 'Read the page again', 'btn ghost sm2'); reread.type = 'button';
  reread.onclick = () => busy(reread, async () => { delete ed.theme[ed.layout]; ed.theme[ed.layout] = await api(`/api/clients/${slug}/template/existing/theme/${ed.layout}?refresh=1`); renderEdTheme(box); });
  box.replaceChildren(
    el('h3', 'Theme and styles'), el('p', 'Read from how this page really renders, so it matches your compiled Tailwind CSS.', 'hint'),
    el('h3', 'Colours'), pal, el('small', 'All colours on the page', 'hint'), chips,
    el('h3', 'Fonts'), ...fonts, el('h3', 'Headings'), ...heads,
    el('h3', 'Body text'), kv([['Font', th.body.family], ['Size', th.body.size + 'px'], ['Colour', th.body.color || '–'], ['Link colour', th.linkColor || '–']]),
    el('h3', 'Buttons'), ...(btns.length ? btns : [el('small', 'No buttons found.', 'hint')]),
    el('h3', 'Shape and layout'), kv([['Corner radius', th.radius.map((r) => r.value).slice(0, 3).join(', ') || '–'], ['Shadows', th.shadows.length ? th.shadows.length + ' style(s)' : 'none'], ['Content width', th.containers.map((c) => c.value).slice(0, 2).join(', ') || '–'], ['Section spacing', [...new Set(th.sections.map((s) => s.padTop))].slice(0, 3).map((p) => p + 'px').join(', ') || '–']]),
    el('h3', 'Read from'), el('small', th.sheets.map((s) => edFile(s)).join(' · '), 'hint'), el('div'), reread);
}

// step 4: the section designs (cards, FAQ, reviews, link lists, call-to-action) of the template
const PAT_SRC = { template: ['From the template page', 'approved'], chosen: ['Chosen by you', 'approved'], generated: ["Generated in the template's style", 'draft'], none: ['Not set', 'empty'] };
function renderExistingPatterns() {
  const ex = tp.ex, s = ex.selection;
  const has = ['home', 'inner', 'contact'].some((k) => s[k]);
  $('ex-pat-card').hidden = !ex.detected || !has;
  if ($('ex-pat-card').hidden) return;
  const p = ex.patterns;
  $('ex-pat-build').textContent = p ? 'Detect again' : 'Detect section patterns';
  $('ex-pat-show').hidden = !p;
  $('ex-pat-note').textContent = p ? `Built ${new Date(p.builtAt).toLocaleString()} · ${p.classes} style classes known` : 'Not detected yet. Until then, old sections are written as plain text.';
  const head = el('tr'); ['Section', 'Design from', 'Learned from', ''].forEach((h) => head.append(el('th', h)));
  const rows = (p?.items || []).map((i) => {
    const tr = el('tr');
    const src = el('td'); src.append(el('span', PAT_SRC[i.source][0], 'badge ' + PAT_SRC[i.source][1]));
    const act = el('td');
    const b = el('button', 'Preview', 'btn ghost sm2'); b.type = 'button';
    b.onclick = () => busy(b, () => openPatternEditor(i.kind).catch((e) => toast(e.message, true)));
    act.append(b);
    tr.append(el('td', i.label), src, el('td', i.page ? i.page + (i.source === 'chosen' ? ' (chosen by you)' : '') : '–'), act);
    return tr;
  });
  $('ex-pats').replaceChildren(head, ...rows);
}

// step 4: one section design in the editor: its preview, where it comes from, and the choice of another design
const pe = { kind: 'cards', step: 'main', page: '', sections: null, tried: '' };
const kindName = (i) => i.label.replace(/ \(.*$/, '');
async function openPatternEditor(kind) {
  pe.kind = kind; pe.step = 'main'; pe.page = ''; pe.sections = null; pe.tried = '';
  document.querySelectorAll('#td-view-existing > .card, #ex-editor').forEach((c) => { if (c.dataset.was === undefined || $('ex-pe').hidden) c.dataset.was = c.hidden ? '1' : ''; c.hidden = true; });
  $('ex-pe').hidden = false;
  document.body.classList.add('cp-wide', 'cp-focus');
  await showPattern();
}
function closePatternEditor() {
  $('ex-pe').hidden = true;
  document.body.classList.remove('cp-wide', 'cp-focus');
  document.querySelectorAll('#td-view-existing > .card, #ex-editor').forEach((c) => { c.hidden = c.dataset.was === '1'; delete c.dataset.was; });
  $('ex-editor').hidden = true;
  renderExisting();
}
async function showPattern(choice) {
  $('ex-pe-state').textContent = 'Preparing the preview…';
  const r = await api(`/api/clients/${slug}/template/existing/patterns/${pe.kind}/preview`, { method: 'POST', body: choice || {} });
  pe.tried = choice ? choice.key : '';
  const fr = $('ex-pe-frame');
  fr.onload = () => { try { const t = fr.contentDocument.querySelector('[data-pattern]'); if (t) fr.contentWindow.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + fr.contentWindow.scrollY - 90) }); } catch { /* the page could not be reached */ } };
  fr.src = r.url + '?t=' + Date.now();
  $('ex-pe-state').textContent = choice ? 'Trying a design from ' + choice.page : 'Current design';
  renderPatternList(); renderPatternInspector();
}
function renderPatternList() {
  $('ex-pe-list').replaceChildren(...tp.ex.patterns.items.map((i) => {
    const li = el('li', undefined, 'cp-row' + (i.kind === pe.kind ? ' sel' : ''));
    const nm = el('div', undefined, 'nm'); nm.append(el('b', kindName(i)), el('small', PAT_SRC[i.source][0]));
    nm.onclick = () => { pe.kind = i.kind; pe.step = 'main'; pe.page = ''; pe.sections = null; showPattern().catch((e) => toast(e.message, true)); };
    li.append(el('span', '▭', 'grip'), nm);
    return li;
  }));
}
function renderPatternInspector() {
  const item = tp.ex.patterns.items.find((i) => i.kind === pe.kind), box = $('ex-pe-inspector'), name = kindName(item), low = name.toLowerCase();
  const act = (label, cls, fn) => { const b = el('button', label, cls); b.type = 'button'; b.style.margin = '0 6px 8px 0'; b.onclick = () => busy(b, async () => { try { await fn(); } catch (e) { toast(e.message, true); } }); return b; };
  const apply = async (body, done) => { tp.ex = await api(`/api/clients/${slug}/template/existing/patterns/${pe.kind}`, { method: 'PUT', body }); pe.step = 'main'; pe.page = ''; pe.sections = null; await showPattern(); toast(done); };
  const parts = [el('h3', name), el('span', PAT_SRC[item.source][0], 'badge ' + PAT_SRC[item.source][1])];
  if (pe.step === 'main') {
    parts.push(el('p', item.source === 'none' ? 'Your template pages have no ' + low + ' section yet. Take one from another page, or generate one in the style of your template.' : item.source === 'generated' ? "No page of your template has this section, so a design was generated in your template's style." : 'This design comes from ' + item.page + '.', 'hint'));
    parts.push(el('div'));
    parts.push(act('Select a design from another page', 'btn', async () => { pe.step = 'pages'; renderPatternInspector(); }));
    if (item.source !== 'generated') parts.push(act('Generate based on the template styling', 'btn ghost', () => apply({ source: 'generated' }, 'Design generated')));
    if (item.source === 'chosen' || item.source === 'generated') parts.push(act("Use the template pages' own design", 'btn ghost', () => apply({ source: 'template' }, 'Back to the template design')));
    if (item.source === 'generated') {
      parts.push(el('h3', 'Refine this design'), el('p', 'Tell me what to change, for example “make the cards darker with a bigger heading” or “three columns instead of two”.', 'hint'));
      const log = el('div', undefined, 'pe-chat');
      for (const m of item.chat || []) log.append(el('div', m.text, 'pe-msg ' + m.role));
      const box = el('textarea'); box.rows = 3; box.placeholder = 'What should change?';
      const send = () => busy(sendBtn, async () => { const message = box.value.trim(); if (!message) return; try { const r = await api(`/api/clients/${slug}/template/existing/patterns/${pe.kind}/refine`, { method: 'POST', body: { message } }); tp.ex = r.state; await showPattern(); toast(r.reply); } catch (e) { toast(e.message, true); } });
      const sendBtn = act('Send', 'btn', async () => { await send(); });
      sendBtn.onclick = send;
      box.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendBtn.click(); } };
      parts.push(log, box, el('div'), sendBtn);
      if (item.canUndo) parts.push(act('Undo last change', 'btn ghost', async () => { tp.ex = await api(`/api/clients/${slug}/template/existing/patterns/${pe.kind}/undo`, { method: 'POST' }); await showPattern(); toast('Change undone'); }));
    }
  } else {
    const sel = el('select'); sel.append(new Option('Choose a page…', ''), ...tp.ex.modernPages.map((p) => new Option(p.path, p.path))); sel.value = pe.page;
    sel.onchange = () => busy(sel, async () => { try { pe.page = sel.value; pe.sections = null; pe.tried = ''; if (pe.page) pe.sections = await api(`/api/clients/${slug}/template/existing/pattern-page?page=${encodeURIComponent(pe.page)}`); renderPatternInspector(); } catch (e) { toast(e.message, true); } });
    parts.push(el('p', 'Step 1 · Choose the page that has the design you like.', 'hint'), sel);
    if (pe.sections) {
      const fit = pe.sections.sections.filter((x) => x.kinds.includes(pe.kind));
      parts.push(el('p', fit.length ? 'Step 2 · Choose the section. ' + fit.length + ' of ' + pe.sections.sections.length + ' sections on this page can be used as a ' + low + ' design.' : 'No section on this page can be used as a ' + low + ' design. Choose another page.', 'hint'));
      const list = el('div', undefined, 'pe-pick');
      for (const x of fit) {
        const b = el('button', undefined, 'item' + (pe.tried === x.key ? ' on' : '')); b.type = 'button';
        b.append(el('b', x.label), el('small', x.words + ' words' + (x.id ? ' · #' + x.id : '')));
        b.onclick = () => busy(b, async () => { try { await showPattern({ page: pe.page, key: x.key }); } catch (e) { toast(e.message, true); } });
        list.append(b);
      }
      parts.push(list);
      if (pe.tried) parts.push(el('div', 'The preview shows this design with sample content. Nothing is saved until you use it.', 'pe-note'), act('Use this design', 'btn', () => apply({ source: 'chosen', page: pe.page, key: pe.tried }, 'Design saved')));
    }
    parts.push(el('div'), act('Back', 'btn ghost', async () => { pe.step = 'main'; pe.tried = ''; await showPattern(); }));
  }
  box.replaceChildren(...parts);
}

// step 4: one legacy page, rebuilt in the chosen template, beside the original
tp.exLayout = 'inner';
function renderExistingPreview() {
  const ex = tp.ex, s = ex.selection;
  const has = ['home', 'inner', 'contact'].filter((k) => s[k]);
  $('ex-prev-card').hidden = !ex.detected || !has.length || !ex.legacyPages.length;
  if ($('ex-prev-card').hidden) return;
  if (!has.includes(tp.exLayout)) tp.exLayout = has[0];
  document.querySelectorAll('#ex-layout button').forEach((b) => { b.hidden = !s[b.dataset.layout]; b.classList.toggle('on', b.dataset.layout === tp.exLayout); });
  const sel = $('ex-legacy'), keep = sel.value;
  sel.replaceChildren(...ex.legacyPages.map((p) => new Option(`${p.path} (${p.words} words)`, p.path)));
  sel.value = ex.legacyPages.some((p) => p.path === keep) ? keep : ex.legacySuggested[tp.exLayout] || ex.legacyPages[0].path;
}

async function buildExistingPreview() {
  const layout = tp.exLayout, page = $('ex-legacy').value;
  const r = await api(`/api/clients/${slug}/template/existing/preview`, { method: 'POST', body: { layout, page } });
  const enc = page.split('/').map(encodeURIComponent).join('/');
  const stamp = Date.now();
  $('ex-compare').hidden = false;
  $('ex-fo').src = `/original/${slug}/${enc}?t=${stamp}`;
  $('ex-fn').src = `/ownpreview/${slug}/${enc}?t=${stamp}`;
  $('ex-open').href = `/ownpreview/${slug}/${enc}`; $('ex-open').hidden = false;
  const notes = $('ex-notes');
  notes.replaceChildren(el('b', `Built from ${r.template}${r.notes.length ? '. Things to know:' : '. Nothing needs attention.'}`), ...r.notes.map((n) => el('div', '• ' + n)));
}

function exInit() {
  $('ex-ed-close').onclick = closeEditor;
  $('ex-ed-layout').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.layout !== ed.layout) busy(b, () => openEditor(b.dataset.layout)); };
  $('ex-ed-dev').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#ex-ed-dev button').forEach((x) => x.classList.toggle('on', x === b)); $('ex-ed-wrap').style.width = b.dataset.w; $('ex-ed-wrap').style.margin = b.dataset.w === '100%' ? '' : '0 auto'; };
  $('ex-pat-build').onclick = (e) => busy(e.target, async () => { try { tp.ex = await api(`/api/clients/${slug}/template/existing/patterns`, { method: 'POST' }); renderExisting(); toast('Section patterns detected'); } catch (err) { toast(err.message, true); } });
  $('ex-pat-show').onclick = (e) => busy(e.target, async () => { await api(`/api/clients/${slug}/template/existing/patterns/preview`, { method: 'POST' }); $('ex-pat-frame').src = `/ownpreview/${slug}/_patterns.html?t=${Date.now()}`; $('ex-pat-dlg').showModal(); });
  $('ex-pat-dlg-close').onclick = () => { $('ex-pat-dlg').close(); $('ex-pat-frame').removeAttribute('src'); };
  $('ex-pe-close').onclick = closePatternEditor;
  $('ex-layout').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; tp.exLayout = b.dataset.layout; renderExistingPreview(); };
  $('ex-preview').onclick = (e) => busy(e.target, buildExistingPreview);
  $('ex-show').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('#ex-show button').forEach((x) => x.classList.toggle('on', x === b)); $('ex-compare').classList.toggle('only-new', b.dataset.show === 'new'); };
  document.querySelectorAll('#td-chooser .tt-card').forEach((b) => { b.onclick = () => busy(b, () => setType(b.dataset.type)); });
  $('td-changetype').onclick = () => { if (confirm('Change how this template is created?\n\nYour saved work stays, and you can switch back at any time.')) busy($('td-changetype'), () => setType('')); };
  $('ex-detect').onclick = (e) => busy(e.target, async () => { tp.ex = await api(`/api/clients/${slug}/template/existing/detect`, { method: 'POST' }); renderExisting(); toast(`${tp.ex.summary.modern} modern and ${tp.ex.summary.legacy} legacy pages found`); });
  $('ex-save').onclick = (e) => busy(e.target, async () => {
    const body = { enabled: true, home: $('ex-sel-home').value, inner: $('ex-sel-inner').value, contact: $('ex-sel-contact').value };
    tp.ex = await api(`/api/clients/${slug}/template/existing/selection`, { method: 'PUT', body });
    renderExistingSlots(); renderExistingPreview(); renderExistingPatterns();
    tp.state = await api(`/api/clients/${slug}/template`); applyType(); applyGate(tp.state.final);
    toast('Template pages saved');
  });
}

window.initTemplateTab = () => { tdInit(); exInit(); };
window.loadTemplateTab = loadTemplateTab;

// ---------- customize sections ----------
// Click a section of the new page, then pick another layout for it (or another kind of section it can become). The choice is for this
// section on this page only; the preview is rebuilt with it.
const cs = { on: false, key: '', zone: '', section: null, busy: false, y: 0 };
const csDoc = () => { try { return $('td-fn').contentDocument; } catch { return null; } };
const csPath = () => tp.state?.preview?.pages?.[tp.slot] || '';
const ROLE_LABEL = { hero: 'Hero', trust: 'Trust points', services: 'Services / cards', about: 'Text', features: 'Features', steps: 'Steps', stats: 'Numbers', reviews: 'Reviews', faq: 'Questions & answers', areas: 'Areas', cta: 'Call to action', contact: 'Contact' };
const csTitle = (role, variant, from) => `${ROLE_LABEL[role] || role} · ${from ? `${from} layout` : String(variant || '').replace(/-/g, ' ')}`;

// where the page is now (so it can come back there), and back to the part that was selected once the preview has been drawn again
const csRemember = () => { try { cs.y = csDoc()?.defaultView?.scrollY || 0; } catch { cs.y = 0; } };
function csFocus() {
  const doc = csDoc(), win = doc?.defaultView;
  if (!doc || !win) return;
  const go = () => {
    if (cs.zone) win.scrollTo(0, cs.zone === 'footer' ? doc.documentElement.scrollHeight : 0);
    else if (cs.key) { const el2 = doc.querySelector(`[data-kit-key="${cs.key}"]`); if (el2) win.scrollTo(0, Math.max(0, el2.getBoundingClientRect().top + win.scrollY - Math.max(0, (win.innerHeight - el2.getBoundingClientRect().height) / 2))); else win.scrollTo(0, cs.y); }
    else win.scrollTo(0, cs.y);
  };
  go();
  // pictures and fonts arrive after the page: the part is brought back into place once more when they have
  setTimeout(go, 500);
}
function csMark() {
  const doc = csDoc();
  if (!doc || !doc.body) return;
  if (!doc.getElementById('kit-cs-style')) {
    const st = doc.createElement('style'); st.id = 'kit-cs-style';
    st.textContent = '[data-kit-key],[data-kit-chrome]{cursor:pointer}[data-kit-key]:hover,[data-kit-chrome]:hover{outline:2px dashed #6366f1;outline-offset:-2px}.kit-cs-sel{outline:3px solid #6366f1!important;outline-offset:-3px}';
    doc.head.append(st);
  }
  if (!doc.kitCsBound) {
    doc.kitCsBound = true;
    doc.addEventListener('click', (e) => {
      if (!cs.on) return;
      const sec = e.target.closest?.('[data-kit-key]'), zone = sec ? null : e.target.closest?.('[data-kit-chrome]');
      e.preventDefault(); e.stopPropagation();
      if (sec) csSelect(sec.getAttribute('data-kit-key'));
      else if (zone) csSelectZone(zone.getAttribute('data-kit-chrome'));
    }, true);
    doc.addEventListener('submit', (e) => { if (cs.on) e.preventDefault(); }, true);
  }
  doc.querySelectorAll('.kit-cs-sel').forEach((x) => x.classList.remove('kit-cs-sel'));
  const target = cs.zone ? doc.querySelector(`[data-kit-chrome="${cs.zone}"]`) : cs.key ? doc.querySelector(`[data-kit-key="${cs.key}"]`) : null;
  target?.classList.add('kit-cs-sel');
}

function csShell(html) {
  const doc = csDoc();
  const head = doc.head.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '');
  return `<!doctype html><html lang="en"><head><base href="${doc.baseURI}">${head}<style>html{overflow:hidden}header,footer,[data-k-header]{display:none!important}*{animation:none!important;opacity:1!important}</style></head><body class="${doc.body.className}" data-k-skin="${doc.body.getAttribute('data-k-skin') || 'day'}" data-k-pat="${doc.body.getAttribute('data-k-pat') || 'none'}" style="${doc.body.getAttribute('style') || ''}"><main>${html}</main></body></html>`;
}

function csCard(opt, current, pick) {
  const card = el('button', undefined, 'cs-card' + (current ? ' on' : '')); card.type = 'button';
  const thumb = el('div', undefined, 'cs-thumb');
  const fr = document.createElement('iframe'); fr.loading = 'lazy'; fr.tabIndex = -1; fr.title = opt.label; fr.srcdoc = csShell(opt.html);
  thumb.append(fr);
  const cap = el('div', undefined, 'cs-cap');
  cap.append(el('b', opt.label), el('small', current ? 'Current layout' : opt.design ? (opt.own ? 'This design' : `${ROLE_LABEL[opt.role] || 'Layout'} of the ${opt.design} design`) : opt.note ? `Used in this design on: ${opt.note}` : ''));
  card.append(thumb, cap);
  card.onclick = () => { if (pick) pick(); else if (!current) csApply({ role: opt.role, variant: opt.variant }); };
  requestAnimationFrame(() => { fr.style.transform = `scale(${(thumb.clientWidth || 380) / 1280})`; });
  return card;
}


// the section library: every kind of section in every layout. One picked here is added to this page, below the section it is added after
async function csLibrary(after) {
  cs.key = ''; cs.zone = ''; cs.section = null; csMark();
  const body = $('td-cs-body');
  $('td-cs-hint').textContent = 'Pick a layout to add it to this page. It comes with sample text and pictures to replace.';
  body.replaceChildren(el('p', 'Loading the library…', 'hint'));
  try {
    cs.lib = cs.lib || (await api(`/api/clients/${slug}/template/library`));
    const out = [];
    const bar = el('div', undefined, 'cs-bar');
    const back = el('button', '← All sections', 'btn ghost sm2'); back.type = 'button'; back.onclick = csOverview; bar.append(back);
    out.push(bar, el('h3', 'Add a section from the library', 'cs-h'));
    cs.lib.types.forEach((t) => {
      const d = document.createElement('details'); d.className = 'cs-lib';
      const sm = document.createElement('summary'); sm.append(el('b', t.title), el('small', `${t.layouts.length} layout${t.layouts.length === 1 ? '' : 's'}`)); d.append(sm);
      let filled = false;
      d.addEventListener('toggle', () => { if (!d.open || filled) return; filled = true; t.layouts.forEach((l) => d.append(csCard({ label: l.design || l.variant.replace(/-/g, ' '), design: l.design, own: l.own, html: l.html, role: t.type, variant: l.variant }, false, () => csAdd(t.type, l.variant, after)))); });
      out.push(d);
    });
    body.replaceChildren(...out);
  } catch (e) { body.replaceChildren(el('p', e.message || 'Could not load the library', 'hint')); }
}
async function csAdd(role, variant, after) {
  if (cs.busy) return;
  const before = new Set((await csList().catch(() => [])).map((x) => x.key));
  await csSave({ pageSection: { path: csPath(), key: 'add', add: { role, variant, after: after || '' } } });
  const now = await csList().catch(() => []);
  const added = now.find((x) => !before.has(x.key) && x.key[0] === 'a');
  if (added) { csGoto(added.key); csSelect(added.key); } else csOverview();
}

// the sections of the page in the order they are drawn (removed ones too), and what can be done with them
const csList = async () => (await api(`/api/clients/${slug}/template/sections?page=${encodeURIComponent(csPath())}`)).sections || [];
async function csSave(body) {
  if (cs.busy) return;
  csRemember();
  cs.busy = true; $('td-cs').classList.add('busy');
  try { await api(`/api/clients/${slug}/kit`, { method: 'PUT', body }); await runPreview(); } catch (e) { toast(e.message || 'Could not save that change', true); }
  cs.busy = false; $('td-cs').classList.remove('busy');
}
function csMove(list, key, dir) {
  list = list.filter((s) => !s.hero);
  const vis = list.filter((s) => !s.hidden);
  const i = vis.findIndex((s) => s.key === key), j = i + dir;
  if (i < 0 || j < 0 || j >= vis.length) return;
  const order = list.map((s) => s.key);
  const a = order.indexOf(vis[i].key), b = order.indexOf(vis[j].key);
  [order[a], order[b]] = [order[b], order[a]];
  return csSave({ pageOrder: { path: csPath(), keys: order } });
}
// the "Explore related pages" lists are added by the template to every page: removing one removes them from every page (and restoring brings them back)
const CS_RELATED = /^explore related pages$/i;
function csHide(key, hide, label = '') { if (hide && cs.key === key) cs.key = ''; return csSave({ pageSection: { path: csPath(), key, hide }, ...(CS_RELATED.test(label) ? { dropRelated: Boolean(hide) } : {}) }); }
const csBtn = (text, title, fn, off) => { const b = el('button', text, 'cs-mini'); b.type = 'button'; b.title = title; b.disabled = Boolean(off); b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
function csGoto(key) { csDoc()?.querySelector(`[data-kit-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

// drag a row onto another to move the section there
function csDrag(row, key, list) {
  const clear = () => document.querySelectorAll('#td-cs-body .cs-row').forEach((r) => r.classList.remove('drop-before', 'drop-after', 'dragging'));
  const after = (e) => { const b = row.getBoundingClientRect(); return e.clientY > b.top + b.height / 2; };
  row.addEventListener('dragstart', (e) => { cs.drag = key; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', key); } catch { /* some browsers need data to start a drag */ } });
  row.addEventListener('dragend', () => { cs.drag = ''; clear(); });
  row.addEventListener('dragover', (e) => { if (!cs.drag || cs.drag === key) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.toggle('drop-after', after(e)); row.classList.toggle('drop-before', !after(e)); });
  row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    const from = cs.drag, below = after(e);
    cs.drag = ''; clear();
    if (!from || from === key) return;
    const order = list.filter((s) => !s.hero).map((s) => s.key).filter((k) => k !== from);
    const at = order.indexOf(key) + (below ? 1 : 0);
    order.splice(at, 0, from);
    csSave({ pageOrder: { path: csPath(), keys: order } });
  });
}

async function csOverview() {
  cs.key = ''; cs.zone = ''; cs.section = null; cs.tabKey = ''; csMark();
  const body = $('td-cs-body');
  $('td-cs-hint').textContent = 'Click a section, the header or the footer in the preview, or choose one here.';
  let list = [];
  try { list = await csList(); } catch (e) { body.replaceChildren(el('p', e.message || 'Could not load the sections', 'hint')); return; }
  const hero = list.find((s) => s.hero);
  const vis = list.filter((s) => !s.hidden && !s.hero), gone = list.filter((s) => s.hidden);
  const chrome = (typeof KT !== 'undefined' && KT.data?.selected?.chrome) || {}, now = (typeof KT !== 'undefined' && KT.data?.chrome) || {};
  const out = [el('h3', 'Whole theme', 'cs-h'), el('small', 'The header, top bar and footer are the same on every page.', 'hint')];
  const zoneRow = (name, label, note, styled) => {
    const row = el('div', undefined, 'cs-row'); const nm = el('button', undefined, 'cs-name'); nm.type = 'button';
    nm.append(el('b', label), el('small', note + (styled ? ' · styled' : '')));
    nm.onclick = () => csSelectZone(name); row.append(nm); out.push(row);
  };
  if (now.topbar || chrome.topbar?.show === 'yes') zoneRow('topbar', 'Top bar', 'Address and hours', chrome.topbar?.style);
  zoneRow('header', 'Header', String(chrome.header?.variant || now.header || '').replace(/-/g, ' '), chrome.header?.style);
  zoneRow('footer', 'Footer', String(chrome.footer?.variant || now.footer || '').replace(/-/g, ' '), chrome.footer?.style);
  out.push(el('h3', 'This page', 'cs-h'));
  if (hero) {
    const row = el('div', undefined, 'cs-row'); const nm = el('button', undefined, 'cs-name'); nm.type = 'button';
    nm.append(el('b', 'Hero'), el('small', (hero.from ? `${hero.from} layout` : String(hero.variant || '').replace(/-/g, ' ')) + (Object.keys(hero.style || {}).length ? ' · styled' : '')));
    nm.onclick = () => { csGoto('hero'); csSelect('hero'); }; row.append(nm); out.push(row);
  }
  if (!vis.length) out.push(el('p', 'No sections to show. Rebuild the preview, then try again.', 'hint'));
  const addBtn = () => { const add = el('button', '+ Add a section from the library', 'btn sm2'); add.type = 'button'; add.onclick = () => csLibrary(vis.length ? vis[vis.length - 1].key : 'hero'); return add; };
  out.push(addBtn());
  if (vis.length > 1) out.push(el('small', 'Drag a row (⋮⋮) to move it, or use the arrows.', 'hint'));
  vis.forEach((s, i) => {
    const row = el('div', undefined, 'cs-row');
    row.draggable = true; row.dataset.key = s.key;
    const grip = el('span', '⋮⋮', 'cs-grip'); grip.title = 'Drag to move this section';
    csDrag(row, s.key, list);
    const name = el('button', undefined, 'cs-name'); name.type = 'button';
    name.append(el('b', s.label), el('small', csTitle(s.role, s.variant, s.from) + (Object.keys(s.style || {}).length ? ' · styled' : '') + (s.external ? ' · from another page' : '') + (s.pages > 1 ? ` · ${s.pages} pages` : '')));
    name.onclick = () => { csGoto(s.key); csSelect(s.key); };
    row.append(grip, name, csBtn('↑', 'Move up', () => csMove(list, s.key, -1), i === 0), csBtn('↓', 'Move down', () => csMove(list, s.key, 1), i === vis.length - 1), csBtn('✕', 'Remove this section from the page', () => csHide(s.key, true, s.label)));
    out.push(row);
  });
  if (vis.length > 4) out.push(addBtn());
  if (gone.length) {
    out.push(el('h3', 'Removed from this page', 'cs-h'));
    gone.forEach((s) => { const row = el('div', undefined, 'cs-row gone'); const name = el('div', undefined, 'cs-name'); name.append(el('b', s.label), el('small', csTitle(s.role, s.variant))); const b = el('button', 'Restore', 'btn ghost sm2'); b.type = 'button'; b.onclick = () => csHide(s.key, false, s.label); row.append(name, b); out.push(row); });
  }
  body.replaceChildren(...out);
}

// the header, top bar or footer: chosen for the whole theme
async function csSelectZone(name) {
  cs.key = ''; cs.zone = name; cs.section = null; csMark();
  const body = $('td-cs-body');
  try { if (typeof ktLoad === 'function') await ktLoad(false); } catch { /* the panel still works without it */ }
  const zone = ((KT.data?.selected?.chrome) || {})[name] || {};
  const info = KT.data?.chrome || { variants: {} };
  $('td-cs-hint').textContent = 'A change here is made for the whole theme: every page uses it.';
  const label = { header: 'Header', topbar: 'Top bar', footer: 'Footer' }[name];
  const out = [];
  const top = el('div', undefined, 'cs-sel'); top.append(el('b', label), el('small', 'Whole theme (all pages)')); out.push(top);
  const bar = el('div', undefined, 'cs-bar'); const back = el('button', '← All sections', 'btn ghost sm2'); back.type = 'button'; back.onclick = csOverview; bar.append(back); out.push(bar);
  const line = el('div', undefined, 'f'); line.append(el('label', name === 'topbar' ? 'Top bar' : 'Layout'));
  const sel = document.createElement('select');
  if (name === 'topbar') { ktOpt(sel, [['yes', 'Show the top bar'], ['no', 'Hide the top bar']], zone.show || (info.topbar ? 'yes' : 'no')); sel.onchange = () => csSaveChrome(name, { show: sel.value }); }
  else { ktOpt(sel, (info.variants[name] || []).map((v) => [v, v.replace(/-/g, ' ')]), zone.variant || info[name]); sel.onchange = () => csSaveChrome(name, { variant: sel.value }); }
  line.append(sel); out.push(line);
  out.push(ktStyleBox({ b: { type: name, style: zone.style || {} }, root: () => csDoc()?.querySelector(`[data-kit-chrome="${name}"]`), edit: (patch) => csSaveChrome(name, { style: patch.style }), play: () => { try { csDoc().defaultView.kitReplay?.(); } catch { /* not reachable */ } } }));
  body.replaceChildren(...out);
}
async function csSaveChrome(name, patch) {
  if (cs.busy) return;
  csRemember();
  cs.busy = true; $('td-cs').classList.add('busy');
  try {
    const cur = { ...(((KT.data?.selected?.chrome) || {})[name] || {}) };
    if ('style' in patch) { if (patch.style) cur.style = patch.style; else delete cur.style; }
    for (const k of ['variant', 'show']) if (k in patch) { if (patch[k]) cur[k] = patch[k]; else delete cur[k]; }
    KT.data = await api(`/api/clients/${slug}/kit`, { method: 'PUT', body: { chrome: { [name]: cur } } });
    await runPreview();
  } catch (e) { toast(e.message || 'Could not save that change', true); }
  cs.busy = false; $('td-cs').classList.remove('busy');
}
// a layout or style chosen for a kind of section is chosen for every page that has it (the hero is a page's own)
const csKind = () => (cs.section?.kind && cs.key !== 'hero' ? { kind: cs.section.kind } : {});
const csApplyStyle = (style) => csSave({ pageSection: { path: csPath(), key: cs.key, style: style || {}, ...csKind() } });

// ---- Edit HTML: the markup of one section, written by hand (this page only)
const BLOCKS = 'div|section|article|ul|ol|li|p|h[1-6]|header|footer|figure|figcaption|table|thead|tbody|tr|td|th|details|summary|aside|nav|form|blockquote|main|dl|dt|dd';
function csPretty(html) {
  let depth = 0;
  const open = new RegExp('^<(' + BLOCKS + ')\\b', 'i'), close = new RegExp('^</(' + BLOCKS + ')>', 'i');
  return html.replace(/\s*\n\s*/g, ' ').replace(new RegExp('(</?(?:' + BLOCKS + ')\\b[^>]*>)', 'gi'), '\n$1').split('\n').map((line) => {
    const t = line.trim();
    if (!t) return '';
    if (close.test(t)) depth = Math.max(0, depth - 1);
    const out = '  '.repeat(depth) + t;
    if (open.test(t) && !new RegExp('</(' + BLOCKS + ')>\\s*$', 'i').test(t.replace(/^<[^>]+>/, ''))) depth += 1;
    return out;
  }).filter(Boolean).join('\n');
}
function csSectionHtml(key) {
  const node = csDoc()?.querySelector(`[data-kit-key="${key}"]`);
  if (!node) return '';
  const c = node.cloneNode(true);
  c.removeAttribute('data-kit-key'); c.classList.remove('kit-cs-sel');
  if (!c.getAttribute('class')) c.removeAttribute('class');
  return c.outerHTML;
}
function csEditor(key, label, edited) {
  const body = $('td-cs-body'), doc = csDoc();
  const original = csSectionHtml(key);
  $('td-cs-hint').textContent = 'Edit the markup of this section. Tailwind classes work; a class this page does not use yet shows after you apply. Scripts and event handlers are removed.';
  const area = el('textarea', undefined, 'cs-code'); area.value = csPretty(original); area.spellcheck = false; area.wrap = 'off';
  const err = el('small', '', 'cs-err');
  const live = () => {
    const d = csDoc(); const old = d?.querySelector(`[data-kit-key="${key}"]`);
    if (!old) return;
    const t = d.createElement('template'); t.innerHTML = area.value;
    const nodes = [...t.content.children];
    if (!nodes.length) return;
    let n = nodes[0];
    if (nodes.length > 1) { n = d.createElement('section'); nodes.forEach((x) => n.append(x)); }
    n.querySelectorAll('script').forEach((x) => x.remove());
    n.setAttribute('data-kit-key', key); n.classList.add('kit-cs-sel');
    old.replaceWith(n);
  };
  let timer = 0;
  area.oninput = () => { clearTimeout(timer); timer = setTimeout(live, 350); };
  const bar = el('div', undefined, 'cs-bar');
  const apply = el('button', 'Apply to this page', 'btn sm2'); apply.type = 'button';
  apply.onclick = () => { if (!area.value.trim()) { err.textContent = 'The section is empty. Use Remove section to take it off the page.'; return; } csSave({ pageSection: { path: csPath(), key, html: area.value } }); };
  const cancel = el('button', 'Cancel', 'btn ghost sm2'); cancel.type = 'button';
  cancel.onclick = () => { const d = csDoc(); const cur = d?.querySelector(`[data-kit-key="${key}"]`); if (cur && csSectionHtml(key) !== original) { const t = d.createElement('template'); t.innerHTML = original; const n = t.content.firstElementChild; n.setAttribute('data-kit-key', key); cur.replaceWith(n); } csSelect(key); };
  bar.append(apply, cancel);
  if (edited) { const rv = el('button', 'Back to the design’s own', 'btn ghost sm2'); rv.type = 'button'; rv.onclick = () => csSave({ pageSection: { path: csPath(), key, html: '' } }); bar.append(rv); }
  body.replaceChildren(el('div', undefined, 'cs-sel'), area, err, bar);
  body.firstChild.append(el('b', label), el('small', 'HTML · this page only'));
  area.focus();
}

// the background of an inner page's hero: plain, or a photo under an overlay, chosen from the pictures of that page (it is then not used again in the page)
function csHeroBg(bg) {
  const box = el('div', undefined, 'cs-bg');
  box.append(el('b', 'Background'));
  const row = el('div', undefined, 'cs-bar');
  [['plain', 'Plain'], ['photo', 'Photo + overlay']].forEach(([type, label]) => {
    const b = el('button', label, bg.type === type ? 'btn sm2' : 'btn ghost sm2'); b.type = 'button';
    b.onclick = () => { if (bg.type !== type) csApply(type === 'photo' ? { bg: 'photo', image: bg.images[0]?.src || '' } : { bg: 'plain' }); };
    if (type === 'photo' && !bg.images.length) { b.disabled = true; b.title = 'This page has no pictures'; }
    row.append(b);
  });
  box.append(row);
  if (!bg.images.length) box.append(el('small', 'This page has no pictures to use as a banner.', 'hint'));
  else if (bg.type === 'photo') {
    box.append(el('small', 'Pictures of this page. The one you pick is taken out of the rest of the page.', 'hint'));
    const grid = el('div', undefined, 'cs-pics');
    bg.images.forEach((p) => {
      const b = el('button', undefined, p.src === bg.image ? 'cs-pic on' : 'cs-pic'); b.type = 'button'; b.title = `${p.w ? `${p.w} × ${p.h}` : ''}${p.alt ? ` · ${p.alt}` : ''}`;
      const im = document.createElement('img'); im.src = p.url; im.alt = p.alt || ''; im.loading = 'lazy'; b.append(im);
      b.onclick = () => { if (p.src !== bg.image) csApply({ bg: 'photo', image: p.src }); };
      grid.append(b);
    });
    box.append(grid);
  }
  return box;
}

async function csSelect(key) {
  cs.key = key; cs.zone = ''; csMark();
  const body = $('td-cs-body');
  body.replaceChildren(el('p', 'Loading the layouts…', 'hint'));
  const path = csPath();
  try {
    const r = await api(`/api/clients/${slug}/template/sections?page=${encodeURIComponent(path)}&key=${encodeURIComponent(key)}`);
    const s = r.section;
    if (!s || s.hidden) { await csOverview(); return; }
    cs.section = s;
    $('td-cs-hint').textContent = s.hero ? (s.inner ? 'Pick a layout for the hero. It is the same on every inner page.' : 'Pick a layout for the hero of this page.') : 'Pick a layout: of this design, or the one another design gives the same content.';
    const out = [];
    const top = el('div', undefined, 'cs-sel');
    top.append(el('b', s.label), el('small', s.edited ? 'Custom HTML' : csTitle(s.role, s.variant, s.from)));
    if (s.kind && s.kind !== 'added' && !s.hero) top.append(el('small', `${s.external ? 'From another page · ' : ''}${s.pages > 1 ? `This kind of section is on ${s.pages} pages. ` : ''}A layout or style chosen here applies to all of them.`, 'hint'));
    if (s.choice) { const rb = el('button', 'Use the design’s own layout', 'btn ghost sm2'); rb.type = 'button'; rb.onclick = () => csApply({ reset: true }); top.append(rb); }
    out.push(top);
    const list = await csList().catch(() => []);
    const vis = list.filter((x) => !x.hidden), at = vis.findIndex((x) => x.key === key);
    const bar = el('div', undefined, 'cs-bar');
    const back = el('button', '← All sections', 'btn ghost sm2'); back.type = 'button'; back.onclick = csOverview;
    if (s.hero) bar.append(back); else bar.append(back, csBtn('↑ Move up', 'Move this section up', () => csMove(list, key, -1), at <= 0), csBtn('↓ Move down', 'Move this section down', () => csMove(list, key, 1), at < 0 || at === vis.length - 1), csBtn('</> Edit HTML', 'Change the markup of this section', () => csEditor(key, s.label, s.edited)), csBtn('+ Add below', 'Add a section from the library below this one', () => csLibrary(key)), csBtn('✕ Remove', 'Remove this section from the page', () => csHide(key, true, s.label)));
    out.push(bar);
    // two panes: the layouts this section can be drawn in (shown first), and the styles of its parts
    if (cs.tabKey !== key) { cs.tabKey = key; cs.tab = 'layout'; }
    const layoutPane = el('div', undefined, 'cs-pane'), stylePane = el('div', undefined, 'cs-pane');
    const tabs = el('div', undefined, 'cs-tabs');
    const show = (id) => { cs.tab = id; layoutPane.style.display = id === 'layout' ? '' : 'none'; stylePane.style.display = id === 'style' ? '' : 'none'; tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.tab === id)); };
    [['layout', 'Layout'], ['style', 'Style']].forEach(([id, label]) => { const t = el('button', label, 'cs-tab'); t.type = 'button'; t.dataset.tab = id; t.onclick = () => show(id); tabs.append(t); });
    out.push(tabs, layoutPane, stylePane);
    // the hero of an inner page: the background, plain or one of the page's own pictures
    if (s.hero && s.bg) layoutPane.append(csHeroBg(s.bg));
    // the parts of the section: design, colours, size, animation, text
    stylePane.append(ktStyleBox({ b: { type: s.role, style: s.style || {} }, root: () => csDoc()?.querySelector(`[data-kit-key="${key}"]`), edit: (patch) => csApplyStyle(patch.style), play: () => { try { csDoc().defaultView.kitReplay?.(); } catch { /* not reachable */ } } }));
    const cur = `${s.role}:${s.variant}`;
    const rolesOf = (list) => [s.role, ...new Set(list.map((o) => o.role).filter((r) => r !== s.role))].filter((r) => list.some((o) => o.role === r));
    const sameOwn = s.options.filter((o) => o.role === s.role && o.own !== false), sameOther = s.options.filter((o) => o.role === s.role && o.own === false);
    // the layouts of this design for this kind of section
    if (sameOwn.length) {
      layoutPane.append(el('h3', sameOther.length ? 'This design' : `Other ${ROLE_LABEL[s.role] || 'layouts'} layouts`, 'cs-h'));
      sameOwn.forEach((o) => layoutPane.append(csCard(o, o.id === cur)));
    }
    // the layouts the other designs give the same content
    if (sameOther.length) {
      layoutPane.append(el('h3', 'From other designs', 'cs-h'), el('small', 'The same content in the layout another design gives it. It keeps the shapes of that design, and the colours and fonts of this website.', 'hint'));
      sameOther.forEach((o) => layoutPane.append(csCard(o, o.id === cur)));
    }
    // the other kinds of section the content can become: folded, this design's layout first
    rolesOf(s.options).filter((r) => r !== s.role).forEach((role) => {
      const list = s.options.filter((o) => o.role === role);
      const d = document.createElement('details'); d.className = 'cs-lib';
      const sm = document.createElement('summary'); sm.append(el('b', `Show as ${ROLE_LABEL[role] || role}`), el('small', `${list.length} layout${list.length === 1 ? '' : 's'}`)); d.append(sm);
      let filled = false;
      const fill = () => { if (filled) return; filled = true; list.forEach((o) => d.append(csCard(o, o.id === cur))); };
      d.addEventListener('toggle', () => { if (d.open) fill(); });
      if (list.length <= 3 || list.some((o) => o.id === cur)) { d.open = true; fill(); }
      layoutPane.append(d);
    });
    if (s.hero && s.options.length < 2) layoutPane.append(el('p', 'This hero has one layout. Its parts can be styled in the Style tab.', 'hint'));
    else if (s.options.filter((o) => o.role === s.role).length < 2 && rolesOf(s.options).length < 2) layoutPane.append(el('p', 'No other layout can show this content without losing part of it.', 'hint'));
    body.replaceChildren(...out);
    show(cs.tab);
  } catch (e) { body.replaceChildren(el('p', e.message || 'Could not load the layouts', 'hint')); }
}

async function csApply(choice) {
  if (cs.busy || !cs.key) return;
  csRemember();
  cs.busy = true; $('td-cs').classList.add('busy');
  try {
    const innerHero = cs.key === 'hero' && Boolean(cs.section?.inner);
    const body = innerHero && choice.variant ? { innerHero: choice.variant } : { pageSection: { path: csPath(), key: cs.key, ...csKind(), ...choice }, ...(innerHero && choice.reset ? { innerHero: '' } : {}) };
    await api(`/api/clients/${slug}/kit`, { method: 'PUT', body });
    await runPreview();
  } catch (e) { toast(e.message || 'Could not apply that layout', true); }
  cs.busy = false; $('td-cs').classList.remove('busy');
}

function csToggle(on) {
  cs.on = on;
  $('td-cs').hidden = !on;
  const dock = $('td-chat'), fab = $('td-chat-fab'), btn = $('td-cs-fab');
  if (on) {
    if (!tp.state?.preview) { cs.on = false; $('td-cs').hidden = true; toast('Build the preview first, then customize its sections', true); return; }
    dock.classList.add('min'); fab.hidden = true; btn.hidden = true;
    document.querySelector('#td-show button[data-show="new"]')?.click();
    document.body.classList.add('cs-open');
    $('td-cs-hint').textContent = 'Click a section in the New template preview.';
    cs.key = ''; cs.zone = ''; cs.section = null; csMark();
    if (typeof ktLoad === 'function') ktLoad(true).then(() => { if (cs.on && !cs.key && !cs.zone) csOverview(); }).catch(() => {});
    // a preview built before sections could be picked has no markers on them: build it again once
    if (csDoc()?.querySelector('[data-kit-key]')) csOverview();
    else {
      $('td-cs-hint').textContent = 'Preparing the preview so its sections can be picked…';
      cs.busy = true;
      runPreview().then(() => { setTimeout(() => { $('td-cs-hint').textContent = csDoc()?.querySelector('[data-kit-key]') ? 'Click a section in the New template preview.' : 'Sections can be picked on a design chosen in the Modern designs tab. This template is not one.'; }, 1200); }, (e) => toast(e.message || 'Could not build the preview', true)).finally(() => { cs.busy = false; });
    }
    $('td-fn').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    document.body.classList.remove('cs-open');
    csDoc()?.querySelectorAll('.kit-cs-sel').forEach((x) => x.classList.remove('kit-cs-sel'));
    let min = false; try { min = Boolean(localStorage.getItem('sm-chatmin')); } catch { /* storage unavailable */ }
    dock.classList.toggle('min', min); fab.hidden = !min; $('td-cs-fab').hidden = !min; btn.hidden = false;
  }
}

function initCustomize() {
  $('td-cs-open').onclick = () => csToggle(true);
  $('td-cs-fab').onclick = () => csToggle(true);
  $('td-cs-close').onclick = () => csToggle(false);
  // the panel can be folded to its title bar, to see the whole preview
  $('td-cs-min').onclick = () => { const m = $('td-cs').classList.toggle('min'); $('td-cs-min').innerHTML = m ? '+' : '&minus;'; $('td-cs-min').title = m ? 'Open' : 'Minimise'; };
  $('td-fn').addEventListener('load', () => { if (cs.on) { csMark(); csFocus(); if (cs.zone) csSelectZone(cs.zone); else if (cs.key) csSelect(cs.key); else csOverview(); } });
}
