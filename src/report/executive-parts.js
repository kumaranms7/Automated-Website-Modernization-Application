import { esc } from '../util/html.js';
import { SEO } from '../rules.js';

// Blocks of the executive report added to the reference design: the executive summary, the image results list and the content results.
// They use the report's own look (white rounded cards, soft tinted tiles, Outfit headings), not the look of the portal screens they mirror.

const n = (v) => Number(v) || 0;
const fmt = (v, d = 0) => n(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const size = (b) => (n(b) >= 1048576 ? `${fmt(n(b) / 1048576, 1)} MB` : n(b) >= 1024 ? `${fmt(n(b) / 1024)} KB` : `${fmt(b)} B`);
const pctOf = (a, b) => (b ? (a / b) * 100 : 0);
const cap = (s) => String(s || '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const rate = (d, id) => d.checks.find((c) => c.id === id)?.rateAfter;
// dark, colourful tiles with white text
const GRAD = { sky: 'from-sky-600 to-indigo-700', indigo: 'from-indigo-600 to-violet-700', emerald: 'from-emerald-500 to-teal-700', purple: 'from-purple-600 to-fuchsia-700', amber: 'from-amber-500 to-orange-600', teal: 'from-teal-500 to-cyan-700', rose: 'from-rose-500 to-pink-700', slate: 'from-slate-600 to-slate-800' };

// ---------- executive summary: what was done, in plain words ----------
export function summaryBox(d) {
  const k = d.kpi, ip = d.imagesPages, total = d.scope.pages;
  const f = (m) => d.tplFacts.find((r) => r.measure === m) || { before: 0, after: 0 };
  const html = f('Average HTML size (KB)'), css = f('Stylesheet files per page'), jq = f('Pages loading jQuery');
  const imgPct = Math.round(pctOf(k.imageBytesBefore - k.imageBytesAfter, k.imageBytesBefore));
  const modern = Math.round(pctOf(ip.webpA + ip.svgA, ip.imgA - ip.extA));
  const top = d.pageRows.filter((r) => r.scoreAfter >= 90).length;
  const b = d.browser;
  const A = d.areas || { template: true, images: true, content: true };
  const items = [
    ['palette', 'sky', 'A new design', d.templateOwn ? `${fmt(d.templateOwn.converted)} legacy pages now use the design of your own modern pages: their header, footer, hero and styles, with the old content poured in. ${fmt(d.templateOwn.modern)} modern pages were left exactly as they were. Pages look consistent and load less (average HTML ${fmt(html.before, 1)} → ${fmt(html.after, 1)} KB, stylesheets per page ${fmt(css.before, 1)} → ${fmt(css.after, 1)}, jQuery on ${fmt(jq.before)} → ${fmt(jq.after)} pages).` : `Every page now uses one modern template, “${esc(d.spec.name || 'new template')}” v${esc(d.spec.version)}: a new header, footer, hero and call-to-action band. It replaces the old hand-copied page code, so pages look consistent and load less (average HTML ${fmt(html.before, 1)} → ${fmt(html.after, 1)} KB, stylesheets per page ${fmt(css.before, 1)} → ${fmt(css.after, 1)}, jQuery on ${fmt(jq.before)} → ${fmt(jq.after)} pages).`, (a) => a.template],
    ['image', 'amber', 'Lighter, modern images', `${fmt(k.imagesProcessed)} images were recompressed or converted to WebP, cutting their weight from ${size(k.imageBytesBefore)} to ${size(k.imageBytesAfter)} (${imgPct}% smaller). ${modern}% of the site’s own images are now WebP or SVG, and ${fmt(ip.srcsetA)} images carry responsive srcset copies so phones download smaller files.`, (a) => a.images],
    ['link', 'indigo', 'Nothing left broken', `${fmt(k.referencesRewritten)} image references were rewritten across ${fmt(k.filesModified)} files so every page points to the new files. ${fmt(k.unusedFiles)} images no page used (${size(k.unusedBytes)}) were moved to the backup, not deleted.`, (a) => a.images],
    ['text-aa', 'purple', 'Better wording', `${esc(cap(d.contentMode))} wording was applied to ${fmt(k.aiPages)} pages and checked against the approved business facts and the claims you ruled out; ${fmt(d.unitRows.length)} text sections changed.${k.aiPagesReview ? ` ${fmt(k.aiPagesReview)} more pages are waiting for your review and keep their original text meanwhile.` : ''}`, (a) => a.content],
    ['magnifying-glass', 'emerald', 'Search essentials fixed', `${rate(d, 'title-length')}% of titles fit ${SEO.title.min}–${SEO.title.max} characters and ${rate(d, 'meta-length')}% of descriptions fit ${SEO.description.min}–${SEO.description.max}, all written as complete sentences and unique. Every page has one H1 and an absolute HTTPS canonical; images carry descriptive alt text, load lazily below the fold and at once above it.`, (a) => a.content],
    ['phone-call', 'orange', 'One clear call to action', `${fmt(d.ctaSummary.pagesAfter)} of ${fmt(total)} pages carry a call-to-action card with a click-to-call button and the approved phone number (${fmt(d.ctaSummary.pagesBefore)} before).${d.ctaSummary.pagesAfter >= d.ctaSummary.pagesBefore ? ' A visitor can always act.' : ''} A sticky call bar and header call buttons add more ways to call.`, (a) => a.template || a.content],
    ['gauge', 'teal', 'Faster for visitors', b ? `On a phone-sized screen with slow 4G, the largest content paint improved from ${fmt(b.lcpBefore)} to ${fmt(b.lcpAfter)} ms (${Math.round(pctOf(b.lcpBefore - b.lcpAfter, b.lcpBefore))}% faster); pages are ${Math.round(pctOf(b.bytesBefore - b.bytesAfter, b.bytesBefore))}% lighter and make ${Math.round(pctOf(b.requestsBefore - b.requestsAfter, b.requestsBefore))}% fewer requests.` : 'The real-browser speed test has not been run for this site yet.', (a) => a.images || a.template],
    ['seal-check', 'rose', 'Checked on every page', `The site now scores ${k.scoreAfter} (was ${k.scoreBefore}) on the ${d.checks.length}-point checklist, and ${fmt(top)} of ${fmt(total)} pages sit in the 90–100 band.${k.validation ? ` ${k.validation.completion}% of the ${fmt(k.validation.checksApplicable)} validation checks pass.` : ''}`],
    ['shield-check', 'slate', 'Safe to undo', `${k.backupId ? `A verified backup (${esc(k.backupId)}, ${fmt(k.backupFiles)} files, ${size(k.backupBytes)}) was taken before any file changed, and ` : ''}every replaced page is saved, so the original site can be restored in one click. Nothing is uploaded automatically; you publish when you are ready.`],
  ].filter((it) => !it[4] || it[4](A));
  return `<section id="overview" class="bg-white rounded-3xl border border-slate-200/80 shadow-card-glass p-6 sm:p-8 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <span class="text-xs font-extrabold text-brand-600 uppercase tracking-wider">Executive Summary</span>
          <h3 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">What we changed, and what it delivers</h3>
        </div>
        <span class="text-xs font-mono bg-sky-50 text-sky-800 font-bold px-3 py-1.5 rounded-xl border border-sky-200">${fmt(total)} pages • SEO ${k.scoreBefore} → ${k.scoreAfter}</span>
      </div>
      <p class="text-slate-600 leading-relaxed max-w-4xl">${esc(d.client.name)}’s website was updated: ${[A.template && 'its pages were rebuilt on a new template', A.images && 'its images were optimised', A.content && 'its wording, titles and descriptions were improved and the search tags of every page were completed'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1')}. The original files were backed up first. Here is what changed and why it matters.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${items.map(([icon, tint, title, text]) => `<div class="p-5 rounded-2xl bg-gradient-to-br from-white to-${tint}-50/60 border border-${tint}-100 shadow-card-glass hover:shadow-card-hover transition">
          <div class="flex items-center gap-3 mb-2.5">
            <div class="w-9 h-9 rounded-xl bg-${tint}-100 text-${tint}-600 flex items-center justify-center shrink-0"><i class="ph-bold ph-${icon} text-lg"></i></div>
            <h4 class="font-bold font-display text-slate-900">${title}</h4>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed">${text}</p>
        </div>`).join('\n        ')}
      </div>
    </section>`;
}

// ---------- the images result list (the Images step's Result box) ----------
const IM = { converted: ['Converted to WebP', 'bg-emerald-50 text-emerald-700 border-emerald-200'], recompressed: ['Recompressed', 'bg-emerald-50 text-emerald-700 border-emerald-200'], kept: ['Kept, already small', 'bg-slate-100 text-slate-600 border-slate-200'], moved: ['Moved to backup (unused)', 'bg-amber-50 text-amber-700 border-amber-200'], error: ['Error', 'bg-rose-50 text-rose-700 border-rose-200'] };
export function imageResult(d) {
  const k = d.kpi, saved = Math.round(pctOf(k.imageBytesBefore - k.imageBytesAfter, k.imageBytesBefore));
  const ok = !d.imageProblems;
  const stats = [
    ['Images optimised', fmt(k.imagesProcessed), 'sky'], ['Before → after', `${size(k.imageBytesBefore)} → ${size(k.imageBytesAfter)}`, 'indigo'], ['Saved', `${saved}%`, 'emerald'],
    ['Responsive copies added', size(k.variantBytes), 'purple'], ['Unused images moved', `${fmt(k.unusedFiles)} · ${size(k.unusedBytes)}`, 'amber'], ['References updated', `${fmt(k.referencesRewritten)} in ${fmt(k.filesModified)} files`, 'teal'],
  ].map(([label, value, tint]) => `<div class="p-4 rounded-2xl bg-gradient-to-br ${GRAD[tint]} text-white shadow-lg shadow-slate-900/10">
            <div class="text-lg sm:text-xl font-black text-white font-display leading-tight">${value}</div>
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-white/75 mt-1">${label}</div>
          </div>`).join('\n          ');
  const rows = [...d.imgEntries.map((e) => ({ name: e.final && e.final !== e.original ? `${e.original} → ${e.final.split('/').pop()}` : e.original, before: e.bytesBefore, after: e.action === 'kept' || e.final ? e.bytesAfter : null, status: e.action, saved: e.action !== 'kept' && e.bytesBefore ? Math.round(pctOf(e.bytesBefore - e.bytesAfter, e.bytesBefore)) : 0 })),
    ...d.unusedImages.map((u) => ({ name: u.file, before: u.bytes, after: null, status: 'moved', saved: 0 }))];
  const body = rows.map((r) => {
    const [label, cls] = IM[r.status] || [r.status, 'bg-slate-100 text-slate-600 border-slate-200'];
    return `<tr class="hover:bg-slate-50/80" data-row="${esc(`${r.name} ${label}`.toLowerCase())}" data-status="${r.status}" data-name="${esc(r.name)}" data-before="${n(r.before)}" data-after="${r.after == null ? '' : n(r.after)}" data-label="${esc(label)}" data-saved="${r.saved}">
              <td class="py-2 px-4 font-mono text-slate-800 truncate max-w-md" title="${esc(r.name)}">${esc(r.name)}</td>
              <td class="py-2 px-3 text-right font-mono text-slate-500">${size(r.before)}</td>
              <td class="py-2 px-3 text-right font-mono ${r.after == null ? 'text-slate-300' : 'text-brand-600 font-bold'}">${r.after == null ? '—' : size(r.after)}</td>
              <td class="py-2 px-4"><span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${cls}">${label}${r.saved > 0 ? ` · saved ${r.saved}%` : ''}</span></td>
            </tr>`;
  }).join('\n            ');
  return `<div id="imageResults" class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-5">
        <div class="flex flex-wrap justify-between items-center gap-3">
          <div><h4 class="text-lg font-bold font-display text-slate-900">Image Optimisation Result</h4><p class="text-xs text-slate-500">Every image that was recompressed, converted, kept or moved, with its size before and after</p></div>
          <span class="px-3 py-1 text-xs font-bold ${ok ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'} rounded-full flex items-center gap-1.5 border"><i class="ph-bold ph-${ok ? 'check' : 'warning'}"></i> ${ok ? 'Completed, no new broken references' : `${d.imageProblems} reference(s) need attention`}</span>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-6 gap-3">
          ${stats}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div class="sm:col-span-6 relative">
            <i class="ph-bold ph-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-base"></i>
            <input type="text" id="imageSearchInput" onkeyup="filterImageRows()" placeholder="Search an image by file name..." class="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition font-medium">
          </div>
          <div class="sm:col-span-4">
            <select id="imageResultFilter" onchange="filterImageRows()" class="w-full py-2.5 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium">
              <option value="">All results (${fmt(rows.length)})</option>
              ${Object.entries(IM).filter(([key]) => rows.some((r) => r.status === key)).map(([key, [label]]) => `<option value="${key}">${label} (${fmt(rows.filter((r) => r.status === key).length)})</option>`).join('\n              ')}
            </select>
          </div>
          <div class="sm:col-span-2">
            <button type="button" onclick="exportImagesCSV()" class="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition active:scale-95"><i class="ph-bold ph-download-simple text-sm text-brand-600"></i> Export CSV</button>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 overflow-hidden">
          <div class="overflow-auto custom-scrollbar max-h-[460px]">
            <table class="w-full text-left text-xs" id="imageTable">
              <thead class="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider border-b border-slate-200 sticky top-0 z-10"><tr><th class="py-3 px-4">Filename</th><th class="py-3 px-3 text-right">Before size</th><th class="py-3 px-3 text-right">After size</th><th class="py-3 px-4">Result</th></tr></thead>
              <tbody class="divide-y divide-slate-100 font-medium">
            ${body}
              </tbody>
            </table>
          </div>
          <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500" id="imageCount">Showing ${fmt(rows.length)} of ${fmt(rows.length)} images</div>
        </div>
      </div>`;
}

// ---------- content mode details and the Content & build style result cards ----------
const MODES = {
  existing: ['Existing content', 'The wording of every page is kept as it was.'],
  enhance: ['Enhance', 'Keeps each page’s meaning, facts and numbers and improves grammar, clarity, headings and completeness.'],
  optimize: ['Optimise', 'Light edits to keep the page’s wording while fixing what weakens it.'],
  rewrite: ['Re-write', 'New wording written from the approved business profile.'],
};
export function contentBlock(d) {
  const k = d.kpi, t = d.buildTotals || {}, seo = d.buildSeo || {}, total = d.scope.pages;
  const [modeName, modeText] = MODES[d.contentMode] || [cap(d.contentMode), ''];
  const scope = { all: 'All pages', services: 'Service pages only', locations: 'Location pages only' }[d.scopeSetting] || cap(d.scopeSetting);
  const chips = d.modeCount.map((m) => `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">${esc(cap(m.k))} <b class="font-mono text-brand-600">${fmt(m.v)}</b></span>`).join('\n              ');
  const cards = [
    ['Pages built', fmt(total), 'sky'], ['Updated in website folder', k.pagesUpdated ? fmt(k.pagesUpdated) : null, 'indigo'], ['SEO score before', k.scoreBefore, 'slate'], ['SEO score after', k.scoreAfter, 'emerald'],
    ['Improved', fmt(k.improved), 'emerald'], ['Pass', fmt(t.pass), 'emerald'], ['Warnings', fmt(t.warn), 'amber'], ['Fail', fmt(t.fail), n(t.fail) ? 'rose' : 'slate'],
    ['Titles rewritten', fmt(seo.titles), 'purple'], ['Descriptions rewritten', fmt(seo.descriptions), 'purple'], ['Alt texts added', fmt(seo.alt), 'teal'], ['Images given srcset', fmt(seo.srcset), 'indigo'],
    ['With WebP images', fmt(d.pagesWithWebp), 'sky'], ['With srcset', fmt(d.pagesWithSrcset), 'teal'], ['AI wording', fmt(k.aiPages), 'purple'],
  ].filter((c) => c[1] != null).map(([label, value, tint]) => `<div class="p-4 rounded-2xl bg-gradient-to-br ${GRAD[tint]} text-white text-center shadow-lg shadow-slate-900/10">
            <div class="text-2xl font-black text-white font-display">${value}</div>
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-white/75 mt-1">${label}</div>
          </div>`).join('\n          ');
  return `<div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-6">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="space-y-1.5">
            <span class="text-xs font-extrabold text-brand-600 uppercase tracking-wider">Content Mode</span>
            <h4 class="text-2xl font-extrabold font-display text-slate-900 flex items-center gap-2.5"><i class="ph-fill ph-text-aa text-purple-500"></i> ${esc(modeName)}</h4>
            <p class="text-sm text-slate-600 max-w-2xl">${esc(modeText)} Every piece of wording was checked against the approved facts and the claims you ruled out before it was used.</p>
          </div>
          <div class="grid grid-cols-3 gap-3 text-center shrink-0">
            <div class="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100"><div class="text-xl font-black font-display text-slate-900">${fmt(k.aiPages)}</div><div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Pages with new wording</div></div>
            <div class="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100"><div class="text-xl font-black font-display text-slate-900">${fmt(k.aiPagesReview)}</div><div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Waiting for review</div></div>
            <div class="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100"><div class="text-xl font-black font-display text-slate-900">${fmt(d.unitRows.length)}</div><div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Sections changed</div></div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2"><span class="text-xs font-bold text-slate-500 mr-1">Applies to: ${esc(scope)} • Wording by page:</span>
              ${chips}
        </div>
        <div class="border-t border-slate-100 pt-5">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">Build Results</h4>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          ${cards}
          </div>
        </div>
      </div>`;
}

// ---------- canonical tags, redirected links and the sitemap ----------
const ACTION = { insert: 'Added', replace: 'Fixed', ok: 'Already right', dupes: 'Duplicates removed', keep_foreign: 'Another website (kept)', removed: 'Removed (redirected page)', redirect: 'None (redirected page)', junk: 'Skipped (copy / backup)' };
const csvLink = (name, cols, rows) => {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const text = `﻿${[cols.map((c) => q(c[1])).join(','), ...rows.map((r) => cols.map((c) => q(r[c[0]])).join(','))].join('\r\n')}`;
  return `<a download="${esc(name)}.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(text)}" class="text-xs font-bold text-brand-600 hover:underline">Export CSV</a>`;
};
const miniTable = (name, title, note, cols, rows, limit = 12) => `<div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-3">
          <div class="flex justify-between items-start gap-3"><div><h4 class="text-base font-bold font-display text-slate-900">${esc(title)}</h4><p class="text-xs text-slate-500">${esc(note)}</p></div>${rows.length ? csvLink(name, cols, rows) : ''}</div>
          ${rows.length ? `<div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="text-slate-500">${cols.filter((c) => !c[2]).map((c) => `<th class="py-2 pr-4 font-bold">${esc(c[1])}</th>`).join('')}</tr></thead><tbody class="divide-y divide-slate-100 text-slate-700">${rows.map((r, i) => `<tr${i >= limit ? ' class="print-more"' : ''}>${cols.filter((c) => !c[2]).map((c) => `<td class="py-2 pr-4 align-top break-words">${esc(r[c[0]] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length > limit ? `<p class="text-xs text-slate-500 no-print">${fmt(rows.length - limit)} more in the CSV export (all of them are printed).</p>` : ''}` : '<p class="text-xs text-slate-500">Nothing to show.</p>'}
        </div>`;

export function canonicalBlock(d, head) {
  const c = d.canonical;
  if (!c) return '';
  const pages = c.pages || [], count = (...a) => pages.filter((x) => a.includes(x.action)).length;
  const lk = c.links || { changes: [], findings: [] }, sm = c.sitemap || {};
  const tiles = [
    ['Canonical added', fmt(count('insert')), 'sky'], ['Canonical fixed', fmt(count('replace', 'dupes')), 'emerald'], ['Already right', fmt(count('ok')), 'indigo'],
    ['Redirected or removed pages', fmt(count('removed', 'redirect')), 'amber'], ['Links pointed at final page', fmt(lk.changes.length), 'purple'], ['Sitemap problems', fmt((sm.issues || []).length + (sm.missing || []).length), 'sky'],
  ].map(([label, value, tint]) => `<div class="p-4 rounded-2xl bg-gradient-to-br ${GRAD[tint]} text-white shadow-lg shadow-slate-900/10"><div class="text-lg sm:text-xl font-black text-white font-display leading-tight">${value}</div><div class="text-[11px] font-extrabold uppercase tracking-wider text-white/75 mt-1">${label}</div></div>`).join('\n          ');
  const rules = [...c.rules.map((r) => ({ line: r.line, used: `Yes: ${r.kindText}`, rule: r.raw, why: '' })), ...c.ignoredRules.map((r) => ({ line: r.line, used: 'No', rule: r.raw, why: r.why }))].sort((a, b) => a.line - b.line);
  const smNote = !sm.found ? `The site has no sitemap.xml; a recommended one with ${fmt(sm.newCount)} pages was prepared.` : sm.error ? sm.error : `${fmt(sm.entries)} addresses listed, ${fmt(sm.ok)} fine. A recommended sitemap with ${fmt(sm.newCount)} pages was prepared; it is not written to your website.`;
  return `<section id="seohead" class="space-y-6">
      ${head('Search Signals', 'Canonical Tags, Redirected Links &amp; Sitemap', `<div class="text-xs text-slate-500">Canonical domain <strong>${esc(c.domain)}</strong>${c.htaccess ? ` • .htaccess read: ${fmt(c.rules.length)} page rules, ${fmt(c.ignoredRules.length)} site-wide rules ignored` : ' • no .htaccess found'}</div>`)}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          ${tiles}
      </div>
      ${miniTable('canonical-tags', 'Canonical tag of every page', 'Every page uses the domain above plus its own path. Pages the site redirects or removes have no canonical.', [['path', 'Page'], ['action', 'What was done'], ['old', 'Canonical before'], ['url', 'Canonical now'], ['note', 'Note'], ['rule', '.htaccess rule']], pages.map((x) => ({ ...x, action: ACTION[x.action] || x.action })))}
      ${rules.length ? miniTable('htaccess-rules', '.htaccess rules read', 'Rules about one page are used; rules about the whole site are listed but never used.', [['line', 'Line'], ['used', 'Used for pages'], ['rule', 'Rule'], ['why', 'Why']], rules) : ''}
      ${miniTable('links-fixed', 'Links pointed at their final page', 'Links to a redirected (301) page now go straight to the page it leads to.', [['page', 'Page'], ['old', 'Link before'], ['new', 'Link now'], ['rule', 'Rule']], lk.changes)}
      ${lk.findings.length ? miniTable('links-to-check', 'Links to check by hand', 'Removed (410) pages, temporary redirects and redirect loops are not changed automatically.', [['page', 'Page'], ['href', 'Link'], ['issue', 'Problem']], lk.findings) : ''}
      ${miniTable('sitemap-issues', 'Sitemap check', smNote, [['loc', 'Address'], ['issue', 'Problem']], sm.issues || [])}
      ${(sm.missing || []).length ? miniTable('sitemap-missing', 'Live pages missing from the sitemap', 'These pages are indexable but not listed.', [['rel', 'Page'], ['url', 'Address it should have']], sm.missing) : ''}
      <p class="text-xs text-slate-500"><a href="/api/clients/${esc(d.slug)}/sitemap" class="font-bold text-brand-600 hover:underline">Download the recommended sitemap.xml</a></p>
    </section>`;
}

// ---------- titles, descriptions, headings, share tags and structured data ----------
export function headTagsBlock(d, head) {
  const log = d.headLog || [];
  if (!log.length) return '';
  const wrote = (k) => log.filter((x) => x.wrote?.[k]).length;
  const ogDone = (x) => x.after.og >= 5 && x.after.twitter >= 3;
  const schemaAdded = log.filter((x) => x.after.schema.some((t) => !x.before.schema.includes(t))).length;
  const tiles = [
    ['Titles written', fmt(wrote('title')), 'sky'], ['Descriptions written', fmt(wrote('description')), 'emerald'], ['Headings written', fmt(wrote('h1')), 'indigo'],
    ['Pages with complete share tags', `${fmt(log.filter(ogDone).length)} of ${fmt(log.length)}`, 'purple'], ['Pages given more structured data', fmt(schemaAdded), 'amber'], ['Old keywords tags removed', fmt(log.reduce((n, x) => n + (x.before.keywords || 0), 0)), 'sky'],
  ].map(([label, value, tint]) => `<div class="p-4 rounded-2xl bg-gradient-to-br ${GRAD[tint]} text-white shadow-lg shadow-slate-900/10"><div class="text-lg sm:text-xl font-black text-white font-display leading-tight">${value}</div><div class="text-[11px] font-extrabold uppercase tracking-wider text-white/75 mt-1">${label}</div></div>`).join('\n          ');
  const rows = log.map((x) => ({
    path: x.path, titleBefore: x.before.title, titleAfter: x.after.title, descBefore: x.before.description, descAfter: x.after.description, h1Before: x.before.h1, h1After: x.after.h1,
    lenBefore: `${x.before.title.length} / ${x.before.description.length}`, lenAfter: `${x.after.title.length} / ${x.after.description.length}`,
    shareBefore: `${x.before.og} og, ${x.before.twitter} twitter`, shareAfter: `${x.after.og} og, ${x.after.twitter} twitter`, image: x.after.ogImage,
    schemaBefore: x.before.schema.join(', ') || 'none', schemaAfter: x.after.schema.join(', ') || 'none', robots: x.after.robots, noAlt: `${x.before.noAlt} → ${x.after.noAlt}`,
  }));
  const pr = d.protectedPages || [];
  return `<section id="headtags" class="space-y-6">
      ${head('Search Signals', 'Titles, Descriptions, Share Tags &amp; Structured Data', '<div class="text-xs text-slate-500">What every page said before, and what it says now</div>')}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          ${tiles}
      </div>
      ${miniTable('head-tags', 'The head of every page, before and after', 'Title and description lengths are in characters. Share tags are counted as Open Graph and Twitter tags present. The export has the before columns too.', [['path', 'Page'], ['titleBefore', 'Title before', 1], ['titleAfter', 'Title now'], ['descBefore', 'Description before', 1], ['descAfter', 'Description now'], ['h1Before', 'Heading before', 1], ['h1After', 'Heading now'], ['lenBefore', 'Title / description length before', 1], ['lenAfter', 'Title / description length now'], ['shareBefore', 'Share tags before', 1], ['shareAfter', 'Share tags now'], ['image', 'Share image', 1], ['schemaBefore', 'Structured data before', 1], ['schemaAfter', 'Structured data now'], ['robots', 'Robots', 1], ['noAlt', 'Pictures without description', 1]], rows, 10)}
      ${pr.length ? miniTable('kept-as-they-were', 'Pages kept as they were', 'The new page would have scored lower than the page it replaces, so your website folder keeps the original.', [['path', 'Page'], ['before', 'Score now on your site'], ['after', 'Score of the new page']], pr) : ''}
    </section>`;
}
