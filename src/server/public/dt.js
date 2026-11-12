// DataTable: adds search, sortable columns, page size and pagination to every <table class="dt">.
// The page's own code keeps building plain tables (a header row of <th> followed by data rows); a MutationObserver notices
// each rebuild and upgrades the table again, keeping the user's search, sort and page size.
(() => {
  const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const state = new WeakMap();
  const UNIT = { kb: 1024, mb: 1048576, gb: 1073741824 };

  const sortKey = (td) => {
    if (!td) return '';
    const raw = (td.dataset.sort ?? td.textContent).trim();
    const m = raw.match(/^\$?(-?[\d,]*\.?\d+)\s*(kb|mb|gb|%|ms|s)?$/i);
    if (m) { const n = parseFloat(m[1].replace(/,/g, '')); return n * (UNIT[(m[2] || '').toLowerCase()] || 1); }
    return raw.toLowerCase();
  };
  const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true }));

  function read(table) {
    const trs = [...table.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr')];
    const head = trs.find((r) => r.children.length && [...r.children].every((c) => c.tagName === 'TH'));
    const rows = trs.filter((r) => r !== head && [...r.children].some((c) => c.tagName === 'TD'));
    return { head, rows };
  }

  function build(table) {
    const { head, rows } = read(table);
    const st = state.get(table) || { q: '', sort: -1, dir: 1, page: 1, size: Number(table.dataset.ps) || 10 };
    state.set(table, st);
    // an empty-state table (no rows, or a single message row) stays a plain table
    const plain = rows.length === 0 || (rows.length === 1 && rows[0].children.length === 1);
    st.head = head; st.rows = rows; st.plain = plain;
    if (rows.length !== st.count) st.page = 1; // keep the page when only a row was re-selected, restart when the data changed
    st.count = rows.length;
    st.sort = st.sort >= (head?.children.length || 0) ? -1 : st.sort;
    ensureChrome(table, st);
    paint(table, st);
  }

  function ensureChrome(table, st) {
    if (st.bar) return;
    const host = table.closest('.tbl-wrap') || table.parentElement;
    const bar = document.createElement('div');
    bar.className = 'dt-bar';
    bar.innerHTML = `<div class="dt-search">${SEARCH_ICON}<input type="search" placeholder="Search this table…" aria-label="Search table"></div><div class="dt-tools"><span>Rows per page</span><select aria-label="Rows per page"><option>10</option><option>25</option><option>50</option><option>100</option></select><button type="button" class="dt-export" title="Download the rows now shown (all pages of the table, with the search applied) as a CSV file for Excel">Export CSV</button></div>`;
    const foot = document.createElement('div');
    foot.className = 'dt-foot';
    foot.innerHTML = '<span class="dt-info"></span><div class="dt-pager"></div>';
    host.before(bar);
    host.after(foot);
    st.bar = bar; st.foot = foot;
    const input = bar.querySelector('input'), size = bar.querySelector('select');
    size.value = String(st.size);
    if (![...size.options].some((o) => o.value === size.value)) { size.add(new Option(size.value, size.value)); size.value = String(st.size); }
    let t;
    input.oninput = () => { clearTimeout(t); t = setTimeout(() => { st.q = input.value.trim().toLowerCase(); st.page = 1; paint(table, st); }, 120); };
    bar.querySelector('.dt-export').onclick = () => exportCsv(table, st);
    size.onchange = () => { st.size = Number(size.value); st.page = 1; paint(table, st); };
    bar.querySelector('input').value = st.q;
  }

  // the table as it is now filtered and sorted, every page of it
  function exportCsv(table, st) {
    const cell = (c) => '"' + c.textContent.replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"';
    const lines = [];
    if (st.head) lines.push([...st.head.children].map((c) => cell({ textContent: c.textContent.replace(/[▲▼↑↓]/g, '') })).join(','));
    for (const r of st.list || st.rows) lines.push([...r.children].map(cell).join(','));
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = (table.id || 'table') + '.csv';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function paint(table, st) {
    quiet(table, () => draw(table, st));
  }

  // our own DOM changes must not trigger a rebuild; records for other tables are kept
  function quiet(table, fn) {
    fn();
    for (const r of obs.takeRecords()) if (r.target !== table) pending.add(r.target);
    if (pending.size) queueMicrotask(flush);
  }

  function draw(table, st) {
    const { head, rows } = st;
    st.bar.hidden = st.foot.hidden = st.plain;
    if (st.plain) {
      table.replaceChildren(...[head, ...rows].filter(Boolean));
      return;
    }
    const q = st.q;
    let list = q ? rows.filter((r) => r.textContent.toLowerCase().includes(q)) : rows.slice();
    st.list = list;
    if (st.sort >= 0) list.sort((a, b) => st.dir * cmp(sortKey(a.children[st.sort]), sortKey(b.children[st.sort])));
    const pages = Math.max(1, Math.ceil(list.length / st.size));
    st.page = Math.min(st.page, pages);
    const from = (st.page - 1) * st.size;
    const slice = list.slice(from, from + st.size);

    const thead = document.createElement('thead');
    if (head) {
      const hr = head.cloneNode(false);
      [...head.children].forEach((th, i) => {
        const c = th.cloneNode(true);
        c.classList.add('sortable'); c.tabIndex = 0; c.setAttribute('role', 'columnheader');
        c.setAttribute('aria-sort', st.sort === i ? (st.dir === 1 ? 'ascending' : 'descending') : 'none');
        const go = () => { st.dir = st.sort === i ? -st.dir : 1; st.sort = i; paint(table, st); };
        c.onclick = go; c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
        hr.append(c);
      });
      thead.append(hr);
    }
    const tbody = document.createElement('tbody');
    if (!slice.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = head?.children.length || 1; td.className = 'dt-empty'; td.textContent = 'No matching rows'; tr.append(td); tbody.append(tr); }
    else tbody.append(...slice);
    table.replaceChildren(thead, tbody);

    st.foot.querySelector('.dt-info').textContent = list.length ? `Showing ${from + 1}–${from + slice.length} of ${list.length}${list.length !== rows.length ? ` (filtered from ${rows.length})` : ''}` : 'No rows';
    const pager = st.foot.querySelector('.dt-pager');
    pager.replaceChildren();
    pager.hidden = pages <= 1;
    const btn = (label, page, on, off) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (on) b.classList.add('on'); b.disabled = Boolean(off); b.onclick = () => { st.page = page; paint(table, st); table.closest('.tbl-wrap')?.scrollTo?.({ top: 0 }); }; pager.append(b); };
    btn('‹', st.page - 1, false, st.page === 1);
    const win = new Set([1, pages, st.page - 1, st.page, st.page + 1].filter((p) => p >= 1 && p <= pages));
    let prev = 0;
    [...win].sort((a, b) => a - b).forEach((p) => { if (p - prev > 1) { const s = document.createElement('span'); s.textContent = '…'; pager.append(s); } btn(String(p), p, p === st.page, false); prev = p; });
    btn('›', st.page + 1, false, st.page === pages);
  }

  // a table was rebuilt by the page's own code (children replaced): upgrade it again
  const pending = new Set();
  const obs = new MutationObserver((records) => {
    for (const r of records) pending.add(r.target);
    queueMicrotask(flush);
  });
  function flush() {
    const list = [...pending]; pending.clear();
    for (const t of list) {
      // our own paint has a <thead>; a foreign rebuild leaves bare <tr> children
      if (t.classList.contains('dt') && t.querySelector(':scope > tr')) build(t);
    }
  }

  function init() {
    document.querySelectorAll('table.dt').forEach((t) => { obs.observe(t, { childList: true }); if (t.querySelector(':scope > tr')) build(t); });
  }
  window.dtDestroy = (t) => { const st = state.get(t); if (!st) { t.classList.remove('dt'); return; } st.bar?.remove(); st.foot?.remove(); state.delete(t); t.classList.remove('dt'); };
  window.dtRefresh = (t) => { const tb = typeof t === 'string' ? document.getElementById(t) : t; tb.classList.add('dt'); obs.observe(tb, { childList: true }); build(tb); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
