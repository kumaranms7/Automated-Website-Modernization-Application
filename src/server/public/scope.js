// Pages to update: the whole website, or only the folders and pages chosen here. Loaded after app.js (uses $, api, el, toast, busy, slug).
// What is saved is a short list: a folder (everything in it, now and later) or a single page. This screen works with the ticked pages and
// turns them into that list when saved.
const PG = { slug: '', pages: [], mode: 'all', sel: new Set(), open: new Set(), q: '', type: '', limit: new Map(), saved: null };

const pgFolder = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.');
const pgMatch = (items, rel) => items.some((it) => {
  const v = it.value.toLowerCase(), p = rel.toLowerCase();
  if (it.kind === 'page') return p === v;
  return v === '.' ? !p.includes('/') : p.startsWith(v + '/');
});

// the folders as a tree: { name, path, pages: [direct pages], kids: Map, count: pages in it and below }
function pgTree(pages) {
  const root = { name: '(main folder)', path: '.', pages: [], kids: new Map(), count: 0 };
  for (const p of pages) {
    const parts = p.path.split('/');
    let node = root;
    if (parts.length > 1) for (let i = 0; i < parts.length - 1; i += 1) {
      const path = parts.slice(0, i + 1).join('/');
      if (!node.kids.has(parts[i])) node.kids.set(parts[i], { name: parts[i], path, pages: [], kids: new Map(), count: 0 });
      node = node.kids.get(parts[i]);
    }
    node.pages.push(p);
  }
  const count = (n) => { n.count = n.pages.length + [...n.kids.values()].reduce((a, k) => a + count(k), 0); return n.count; };
  count(root);
  return root;
}
const pgBelow = (n) => [...n.pages, ...[...n.kids.values()].flatMap(pgBelow)];

// the ticked pages as the short list: a folder when every page in it is ticked, else the pages
function pgItems() {
  const root = pgTree(PG.pages);
  const items = [];
  const on = (p) => PG.sel.has(p.path);
  // the main folder: its own pages only (a folder inside it is its own entry)
  if (root.pages.length && root.pages.every(on)) items.push({ kind: 'folder', value: '.' });
  else root.pages.filter(on).forEach((p) => items.push({ kind: 'page', value: p.path }));
  const walk = (n) => {
    const all = pgBelow(n);
    if (all.length && all.every(on)) { items.push({ kind: 'folder', value: n.path }); return; }
    n.pages.filter(on).forEach((p) => items.push({ kind: 'page', value: p.path }));
    n.kids.forEach(walk);
  };
  root.kids.forEach(walk);
  return items;
}

async function pgLoad() {
  if (!slug) return;
  PG.slug = slug;
  let d;
  try { d = await api(`/api/clients/${slug}/scope`); } catch { return; }
  if (PG.slug !== slug) return;
  PG.pages = d.pages;
  PG.mode = d.scope.mode;
  PG.saved = d.scope;
  PG.sel = new Set(d.scope.mode === 'selected' ? d.pages.filter((p) => pgMatch(d.scope.items, p.path)).map((p) => p.path) : []);
  PG.open = new Set();
  pgBanner(d.summary);
  pgRender();
}

// the line shown on every step while only some pages are updated
function pgBanner(s) {
  const b = $('scope-banner');
  if (!b) return;
  b.hidden = s.mode !== 'selected';
  if (b.hidden) return;
  const where = [...s.folders, ...(s.pages.length ? [`${s.pages.length} page${s.pages.length === 1 ? '' : 's'}`] : [])].join(', ');
  $('scope-banner-text').textContent = `Only ${s.selected} of ${s.total} pages are updated: ${where}. Everything else stays exactly as it is.`;
}

function pgRender() {
  const card = $('scope-card');
  if (!card) return;
  const none = !PG.pages.length;
  card.querySelectorAll('input[name=scope-mode]').forEach((r) => { r.checked = r.value === PG.mode; r.disabled = none; });
  $('scope-body').hidden = PG.mode !== 'selected' || none;
  $('scope-empty').hidden = !none;
  $('scope-note').textContent = none ? '' : PG.mode === 'all' ? `All ${PG.pages.length} pages of the website are updated.` : `${PG.sel.size} of ${PG.pages.length} pages are ticked. Tick the folders or pages to update, then press Save.`;
  if (PG.mode !== 'selected' || none) { $('scope-save').disabled = PG.saved?.mode === 'all' && PG.mode === 'all'; return; }
  // the page types, to tick every page of a kind at once
  const types = [...new Set(PG.pages.map((p) => p.type))].sort();
  const chips = $('scope-types'); chips.replaceChildren(el('small', 'Tick all of a kind: '));
  types.forEach((t) => { const b = el('button', `${t} (${PG.pages.filter((p) => p.type === t).length})`, 'chip' + (PG.type === t ? ' on' : '')); b.type = 'button'; b.onclick = () => { const ps = PG.pages.filter((p) => p.type === t); const allOn = ps.every((p) => PG.sel.has(p.path)); ps.forEach((p) => (allOn ? PG.sel.delete(p.path) : PG.sel.add(p.path))); pgRender(); }; chips.append(b); });
  const tree = $('scope-tree');
  tree.replaceChildren();
  const q = PG.q.trim().toLowerCase();
  if (q) {
    const hit = PG.pages.filter((p) => p.path.toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q));
    const head = el('div', undefined, 'sc-row sc-head');
    const all = hit.length && hit.every((p) => PG.sel.has(p.path));
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = Boolean(all);
    cb.onchange = () => { hit.forEach((p) => (cb.checked ? PG.sel.add(p.path) : PG.sel.delete(p.path))); pgRender(); };
    head.append(cb, el('b', `${hit.length} page${hit.length === 1 ? '' : 's'} match "${PG.q}"`), el('small', ' tick them all, or one by one'));
    tree.append(head);
    hit.slice(0, 300).forEach((p) => tree.append(pgPageRow(p, 0)));
    if (hit.length > 300) tree.append(el('p', `…and ${hit.length - 300} more. Type more to narrow the list.`, 'hint'));
  } else {
    const root = pgTree(PG.pages);
    pgFolderRow(tree, root, 0, true);
    root.kids.forEach((k) => pgFolderRow(tree, k, 0, false));
  }
  const items = pgItems();
  $('scope-summary').textContent = `${PG.sel.size} of ${PG.pages.length} pages ticked` + (items.length ? ` · saved as ${items.filter((i) => i.kind === 'folder').length} folder(s) and ${items.filter((i) => i.kind === 'page').length} page(s)` : '');
  $('scope-save').disabled = !PG.sel.size;
}

function pgPageRow(p, depth) {
  const row = el('label', undefined, 'sc-row sc-page');
  row.style.paddingLeft = `${depth * 18 + 30}px`;
  const cb = el('input'); cb.type = 'checkbox'; cb.checked = PG.sel.has(p.path);
  cb.onchange = () => { if (cb.checked) PG.sel.add(p.path); else PG.sel.delete(p.path); pgRender(); };
  row.append(cb, el('span', p.path.split('/').pop()), el('small', p.type, 'sc-type'));
  row.title = p.title || p.path;
  return row;
}

function pgFolderRow(host, n, depth, isRoot) {
  const mine = isRoot ? n.pages : pgBelow(n);
  if (!mine.length && !n.kids.size) return;
  const on = mine.filter((p) => PG.sel.has(p.path)).length;
  const row = el('div', undefined, 'sc-row sc-folder');
  row.style.paddingLeft = `${depth * 18}px`;
  const open = PG.open.has(n.path);
  const tog = el('button', open ? '▾' : '▸', 'sc-tog'); tog.type = 'button'; tog.onclick = () => { if (open) PG.open.delete(n.path); else PG.open.add(n.path); pgRender(); };
  const cb = el('input'); cb.type = 'checkbox'; cb.checked = mine.length > 0 && on === mine.length; cb.indeterminate = on > 0 && on < mine.length;
  cb.onchange = () => { mine.forEach((p) => (cb.checked ? PG.sel.add(p.path) : PG.sel.delete(p.path))); pgRender(); };
  row.append(tog, cb, el('b', n.name), el('small', ` ${on ? on + ' of ' : ''}${mine.length} page${mine.length === 1 ? '' : 's'}`));
  host.append(row);
  if (!open) return;
  // the main folder lists its own pages only: the folders in it are listed on their own, below it
  if (!isRoot) n.kids.forEach((k) => pgFolderRow(host, k, depth + 1, false));
  const shown = n.pages.slice(0, PG.limit.get(n.path) || 150);
  shown.forEach((p) => host.append(pgPageRow(p, depth + 1)));
  if (n.pages.length > shown.length) { const more = el('button', `Show ${Math.min(150, n.pages.length - shown.length)} more of ${n.pages.length - shown.length}`, 'btn ghost sm2'); more.type = 'button'; more.style.marginLeft = `${depth * 18 + 30}px`; more.onclick = () => { PG.limit.set(n.path, shown.length + 150); pgRender(); }; host.append(more); }
}

// ---- the controls ----
document.querySelectorAll('input[name=scope-mode]').forEach((r) => { r.onchange = () => { if (!r.checked) return; PG.mode = r.value; pgRender(); }; });
$('scope-search').oninput = (e) => { PG.q = e.target.value; pgRender(); };
$('scope-clear').onclick = () => { PG.sel.clear(); pgRender(); };
$('scope-expand').onclick = () => { const all = (n) => [n.path, ...[...n.kids.values()].flatMap(all)]; if (PG.open.size) PG.open.clear(); else all(pgTree(PG.pages)).forEach((p) => PG.open.add(p)); pgRender(); };
$('scope-save').onclick = (e) => busy(e.target, async () => {
  try {
    const body = PG.mode === 'all' ? { mode: 'all', items: [] } : { mode: 'selected', items: pgItems() };
    if (PG.mode === 'selected' && !body.items.length) { toast('Tick at least one folder or page, or choose the whole website.', true); return; }
    const r = await api(`/api/clients/${slug}/scope`, { method: 'PUT', body });
    PG.saved = r.scope;
    pgBanner(r.summary);
    toast(r.scope.mode === 'all' ? 'The whole website will be updated' : `${r.summary.selected} of ${r.summary.total} pages will be updated`);
    pgRender();
    if (typeof loadAudit === 'function') loadAudit();
    // the plans of the other steps were made for the old choice
    if (typeof refreshPlan === 'function' && FB?.plan) refreshPlan();
    if (typeof imPlan !== 'undefined') imPlan = null;
  } catch (err) { toast(err.message, true); }
});
$('scope-banner-change').onclick = () => { document.querySelector('#nav button[data-tab="audit"]')?.click(); $('scope-card')?.scrollIntoView({ block: 'start' }); };

// the website changed, or a new scan was made: read the choice again
let pgSeen = '';
setInterval(() => { if (slug && slug !== pgSeen) { pgSeen = slug; pgLoad(); } }, 500);
window.pgReload = pgLoad;
