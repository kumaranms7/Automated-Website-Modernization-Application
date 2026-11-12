import { DOWNLOAD_BUTTON, DOWNLOAD_SCRIPT } from './download.js';
import { SEO } from '../rules.js';
import { TYPE_IDS, typeLabel } from '../scanner/page-types.js';
import fs from 'node:fs';
import { esc } from '../util/html.js';
import { summaryBox, imageResult, contentBlock, canonicalBlock, headTagsBlock } from './executive-parts.js';

// The executive modernisation report: the reference design (Tailwind, Chart.js, Phosphor icons) filled with the figures of the site.
// Every number is counted from the pages (see data.js); nothing is typed in.

const CLIENT_JS = fs.readFileSync(new URL('./executive-client.js', import.meta.url), 'utf8');

const n = (v) => Number(v) || 0;
const fmt = (v, d = 0) => n(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const kb = (b) => `${fmt(n(b) / 1024, n(b) >= 10240 ? 0 : 1)} KB`;
const size = (b) => (n(b) >= 1048576 ? `${fmt(n(b) / 1048576, 1)} MB` : `${fmt(n(b) / 1024)} KB`);
const pctOf = (a, b) => (b ? (a / b) * 100 : 0);
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const cap = (s) => String(s || '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// ---------- word-level before/after text, like the reference's copy cards ----------
const tok = (s) => String(s).split(/\s+/).filter(Boolean);
function lcsOps(a, b, max = 400) {
  const A = a.slice(0, max), B = b.slice(0, max);
  const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i -= 1) for (let j = B.length - 1; j >= 0; j -= 1) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const before = [], after = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { before.push({ t: A[i], c: false }); after.push({ t: B[j], c: false }); i += 1; j += 1; } else if (dp[i + 1][j] >= dp[i][j + 1]) { before.push({ t: A[i], c: true }); i += 1; } else { after.push({ t: B[j], c: true }); j += 1; }
  }
  for (; i < A.length; i += 1) before.push({ t: A[i], c: true });
  for (; j < B.length; j += 1) after.push({ t: B[j], c: true });
  return { before, after };
}
function markup(words, cls) {
  const first = words.findIndex((w) => w.c), last = words.length - 1 - [...words].reverse().findIndex((w) => w.c);
  if (first < 0) return `${esc(words.slice(0, 28).map((w) => w.t).join(' '))}${words.length > 28 ? ' ...' : ''}`;
  const from = Math.max(0, first - 10), to = Math.min(words.length, last + 11);
  const out = [];
  for (let k = from; k < to;) {
    if (words[k].c) { let e = k; while (e < to && words[e].c) e += 1; out.push(`<span class="${cls}">${esc(words.slice(k, e).map((w) => w.t).join(' '))}</span>`); k = e; } else { out.push(esc(words[k].t)); k += 1; }
  }
  return `${from > 0 ? '... ' : ''}${out.join(' ')}${to < words.length ? ' ...' : ''}`;
}
const LABELS = [
  ['Heading & Typo Fix', 'bg-sky-50 text-sky-700 border-sky-200'],
  ['Spelling & Clarity', 'bg-indigo-50 text-indigo-700 border-indigo-200'],
  ['Factual Accuracy Fix', 'bg-amber-50 text-amber-700 border-amber-200'],
  ['Repetitive Sentence Dedup', 'bg-purple-50 text-purple-700 border-purple-200'],
  ['Grammar & Clarity', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
];
const bigrams = (t) => { const x = String(t).toLowerCase().replace(/\s+/g, ' '); const m = new Map(); for (let i = 0; i < x.length - 1; i += 1) { const g = x.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
function dice(a, b) {
  const A = bigrams(a), B = bigrams(b);
  let hit = 0, sa = 0, sb = 0;
  for (const [g, c] of A) { hit += Math.min(c, B.get(g) || 0); sa += c; }
  for (const c of B.values()) sb += c;
  return sa + sb ? (2 * hit) / (sa + sb) : 0;
}
function classify(u, ops) {
  const removed = ops.before.filter((w) => w.c).map((w) => w.t).join(' '), changed = ops.before.filter((w) => w.c).length;
  if (/\b(decades?|years?|since|established|\d{4})\b/i.test(removed)) return 'Factual Accuracy Fix';
  if (u.kind === 'text' && u.before.length <= 140 && changed <= 6) return 'Heading & Typo Fix';
  if (u.after.length < u.before.length * 0.8) return 'Repetitive Sentence Dedup';
  if (changed <= 4) return 'Spelling & Clarity';
  return 'Grammar & Clarity';
}
function diffCards(units) {
  const picked = new Map();
  const seen = new Set();
  const pool = units.filter((u) => u.before && u.after && u.before !== u.after && u.before.length >= 25 && u.before.length <= 700).slice(0, 1500);
  const scored = pool.map((u) => { const ops = lcsOps(tok(u.before), tok(u.after)); return { u, ops, label: classify(u, ops), changed: ops.before.filter((w) => w.c).length + ops.after.filter((w) => w.c).length, sim: dice(u.before, u.after) }; })
    .filter((x) => x.changed > 0 && x.changed <= 40 && x.sim >= 0.45 && x.ops.after.some((w) => w.c))
    .sort((a, b) => b.sim - a.sim || a.u.before.length - b.u.before.length);
  for (const [label] of LABELS) {
    const c = scored.find((x) => x.label === label && !seen.has(x.u.path));
    if (c) { picked.set(label, c); seen.add(c.u.path); }
  }
  for (const c of scored) { if (picked.size >= 4) break; if (!seen.has(c.u.path)) { picked.set(`${c.label} ${picked.size}`, c); seen.add(c.u.path); } }
  return [...picked.values()].slice(0, 4).map((c) => {
    const badge = (LABELS.find(([l]) => l === c.label) || LABELS[4])[1];
    return `<div class="bg-white rounded-3xl border border-slate-200/80 shadow-card-glass p-6 space-y-3">
          <div class="flex justify-between items-center text-xs">
            <span class="font-mono text-slate-500 font-semibold truncate max-w-[280px]" title="${esc(c.u.path)}">${esc(c.u.path.split('/').pop())}</span>
            <span class="px-2.5 py-0.5 rounded-md ${badge} font-bold border">${esc(c.label)}</span>
          </div>
          <div class="space-y-2 text-xs">
            <div class="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-slate-700 font-sans">
              <span class="block text-[10px] font-bold uppercase text-rose-600 mb-1">Original Text:</span>
              "${markup(c.ops.before, 'diff-del')}"
            </div>
            <div class="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 text-slate-800 font-sans">
              <span class="block text-[10px] font-bold uppercase text-teal-700 mb-1">Modernized ${esc(d_year)} Revision:</span>
              "${markup(c.ops.after, 'diff-ins')}"
            </div>
          </div>
        </div>`;
  }).join('\n');
}
let d_year = '2026';

// What the AI did, counted over every changed text section
const KIND_TEXT = {
  'Heading & Typo Fix': ['text-t', 'sky', 'Headings and short lines: typos, capitalisation and punctuation, such as a missing question mark.'],
  'Spelling & Clarity': ['check-circle', 'indigo', 'A few words in a sentence corrected or made clearer.'],
  'Factual Accuracy Fix': ['seal-check', 'amber', 'Experience, year and "since" claims made to match the approved business facts, or removed when they could not be backed up.'],
  'Repetitive Sentence Dedup': ['copy', 'purple', 'Repeated or padded sentences removed so the text says each thing once.'],
  'Grammar & Clarity': ['pencil-simple-line', 'emerald', 'Sentences reworded for grammar, flow and readability, keeping the same meaning.'],
};
const MODE_LINE = { enhance: 'Enhance', optimize: 'Optimise', rewrite: 'Re-write', existing: 'Existing content' };
function diffIntro(d) {
  const units = d.unitRows.filter((u) => u.before && u.after && u.before !== u.after);
  const counts = Object.fromEntries(Object.keys(KIND_TEXT).map((k) => [k, 0]));
  for (const u of units) { const ops = lcsOps(tok(u.before), tok(u.after), 160); counts[classify(u, ops)] += 1; }
  const pages = new Set(units.map((u) => u.path)).size;
  const f0 = (v) => Number(v).toLocaleString('en-US');
  const tiles = Object.entries(KIND_TEXT).map(([label, [icon, tint, text]]) => `<div class="p-4 rounded-2xl bg-gradient-to-br from-white to-${tint}-50/60 border border-${tint}-100">
            <div class="flex items-center gap-2.5"><div class="w-8 h-8 rounded-lg bg-${tint}-100 text-${tint}-600 flex items-center justify-center"><i class="ph-bold ph-${icon} text-base"></i></div><div class="text-xl font-black font-display text-slate-900">${f0(counts[label])}</div></div>
            <div class="mt-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">${label}</div>
            <p class="mt-1 text-xs text-slate-500 leading-relaxed">${text}</p>
          </div>`).join('\n          ');
  return `<div class="bg-white rounded-3xl border border-slate-200/80 shadow-card-glass p-6 sm:p-8 space-y-5">
        <div class="flex items-start gap-4">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-accent-pink flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0"><i class="ph-fill ph-brain text-2xl"></i></div>
          <div class="space-y-2">
            <h4 class="text-lg font-bold font-display text-slate-900">What the AI did to the wording</h4>
            <p class="text-sm text-slate-600 leading-relaxed">In <strong>${MODE_LINE[d.contentMode] || d.contentMode}</strong> mode the AI read the existing text of each page together with the approved business facts, and rewrote only the <strong>wording</strong> of its text sections: headings, paragraphs, lists and FAQs. It did not touch the layout, images, links, phone numbers or prices. Across <strong>${f0(pages)} pages</strong> it edited <strong>${f0(units.length)} text sections</strong>, grouped below by the kind of fix.</p>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          ${tiles}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100"><strong class="text-slate-800">Same meaning, same facts.</strong> Names, places, numbers and phone numbers were kept; only the way they are written changed.</div>
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100"><strong class="text-slate-800">Checked automatically.</strong> Every edit was tested against the approved facts and the claims you ruled out; invented numbers, prices and promises were rejected.${d.kpi.aiPagesReview ? ` ${f0(d.kpi.aiPagesReview)} pages that needed review keep their original text until you approve them.` : ''}</div>
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-100"><strong class="text-slate-800">Reversible.</strong> The original wording is saved with the page backup, so the old text can be restored at any time.</div>
        </div>
        <p class="text-xs text-slate-500">Four real examples follow. <span class="diff-del">Red crossed-out text</span> was removed from the original; <span class="diff-ins">green text</span> was added in the new version.</p>
      </div>`;
}

// ---------- the pieces ----------
const CAT_STYLE = {
  'Titles, meta and social': { name: 'Titles, Meta and Social', icon: 'ph-tag', ic: 'text-sky-500', bar: 'from-sky-500 to-indigo-500', num: 'text-brand-600' },
  'Content and links': { name: 'Content and Links', icon: 'ph-link', ic: 'text-indigo-500', bar: 'from-indigo-500 to-purple-500', num: 'text-indigo-600' },
  Images: { name: 'Images Optimization & Delivery', icon: 'ph-image', ic: 'text-amber-500', bar: 'from-amber-500 to-orange-500', num: 'text-amber-600' },
  'Structured data': { name: 'Structured Data (Schema.org / JSON-LD)', icon: 'ph-brackets-curly', ic: 'text-purple-500', bar: 'from-purple-500 to-pink-500', num: 'text-purple-600' },
  'Technical and accessibility': { name: 'Technical Web Accessibility (ARIA & CWV)', icon: 'ph-universal-access', ic: 'text-emerald-500', bar: 'from-emerald-500 to-teal-500', num: 'text-emerald-600' },
};
const CHECK_NAME = {
  'img-alt-meaningful': 'Content images have descriptive alt text', 'img-lazy': 'Below-the-fold images are lazy-loaded', 'title-length': `Title fits ${SEO.title.min}–${SEO.title.max} characters`,
  'meta-length': `Meta description fits ${SEO.description.min}–${SEO.description.max} characters`, 'title-unique': 'Title unique across entire site', 'meta-unique': 'Meta description unique across site',
  'h1-single': 'Exactly one H1 element per page', canonical: 'Canonical is absolute, HTTPS and self-referencing',
};
const card = (label, tint, icon, value, sub, subCls = 'text-slate-500 font-medium') => `<div class="bg-gradient-to-br from-white to-${tint}-50/60 p-5 rounded-2xl border border-${tint}-100 shadow-card-glass hover:shadow-card-hover transition">
        <div class="flex items-center justify-between text-${tint}-500 mb-2">
          <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500">${label}</span>
          <div class="w-8 h-8 rounded-lg bg-${tint}-100 flex items-center justify-center text-${tint}-600"><i class="ph-bold ph-${icon} text-base"></i></div>
        </div>
        <div class="text-2xl font-black text-slate-900 font-display">${value}</div>
        <p class="text-xs ${subCls} mt-1.5">${sub}</p>
      </div>`;

const head = (eyebrow, title, right) => `<div class="flex flex-col sm:flex-row justify-between sm:items-end gap-3 border-b border-slate-200 pb-4">
        <div>
          <span class="text-xs font-extrabold text-brand-600 uppercase tracking-wider">${eyebrow}</span>
          <h3 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">${title}</h3>
        </div>
        ${right}
      </div>`;

export function renderExecutive(d) {
  d_year = String(new Date(d.generatedAt).getFullYear());
  const k = d.kpi, ip = d.imagesPages, total = d.scope.pages;
  const name = esc(d.client.name);
  const host = esc(d.client.host);
  const run = day(d.generatedAt);
  const imgSaved = k.imageBytesBefore - k.imageBytesAfter;
  const imgPct = Math.round(pctOf(imgSaved, k.imageBytesBefore));
  const own = (w, s, t, e) => Math.round(pctOf(w + s, t - e));
  const modernNow = own(ip.webpA, ip.svgA, ip.imgA, ip.extA);
  const gain = k.scoreAfter - k.scoreBefore;
  const gainPct = k.scoreBefore ? ((gain / k.scoreBefore) * 100).toFixed(1) : '0.0';
  const checks = d.checks.length;
  const rows = d.pageRows;
  const band = (s) => (s < 40 ? 0 : s < 70 ? 1 : s < 80 ? 2 : s < 90 ? 3 : 4);
  const bands = { before: [0, 0, 0, 0, 0], after: [0, 0, 0, 0, 0] };
  for (const r of rows) { bands.before[band(r.scoreBefore)] += 1; bands.after[band(r.scoreAfter)] += 1; }
  const top = bands.after[4];
  const jq = d.tplFacts.find((r) => r.measure === 'Pages loading jQuery') || { before: 0, after: 0 };
  const css = d.tplFacts.find((r) => r.measure === 'Stylesheet files per page') || { before: 0, after: 0 };
  const scripts = d.tplFacts.find((r) => r.measure === 'External script files per page') || { before: 0, after: 0 };
  const htmlKb = d.tplFacts.find((r) => r.measure === 'Average HTML size (KB)') || { before: 0, after: 0 };
  const applied = d.scope.updatedInSite;
  const s = d.spec.tokens, lay = d.spec.layout;

  // ---- category bars
  const catBars = d.categories.map((c) => {
    const st = CAT_STYLE[c.category] || CAT_STYLE['Technical and accessibility'];
    return `<div class="space-y-2">
                <div class="flex justify-between text-xs font-bold">
                  <span class="text-slate-800 flex items-center gap-2"><i class="ph-fill ${st.icon} ${st.ic}"></i> ${esc(st.name)}</span>
                  <span class="font-mono text-slate-500">${c.before} → <strong class="${st.num}">${c.after}</strong> (${c.change >= 0 ? '+' : ''}${c.change})</span>
                </div>
                <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div class="bg-slate-300 h-full" style="width: ${c.before}%"></div>
                  <div class="bg-gradient-to-r ${st.bar} h-full" style="width: ${Math.max(0, c.after - c.before)}%"></div>
                </div>
              </div>`;
  }).join('\n');

  // ---- the 8 critical checks
  const keyRows = d.keyChecks.map((c) => {
    const nb = c.rateBefore == null;
    let status, cls = 'bg-emerald-50 text-emerald-700 font-bold border-emerald-200';
    if (nb) status = c.rateAfter >= 100 ? '100% Fixed' : 'Resolved';
    else if (c.change > 0) status = `+${fmt(c.change, 1)}%`;
    else if (c.change < 0) { status = `${fmt(c.change, 1)}%`; cls = 'bg-rose-50 text-rose-700 font-bold border-rose-200'; } else if (c.rateAfter >= 100) status = 'Perfect';
    else { status = 'Preserved'; cls = 'bg-slate-100 text-slate-600 font-semibold border-slate-200'; }
    return `<tr class="hover:bg-slate-50/60 transition">
                <td class="py-3 px-6 font-semibold text-slate-900">${esc(CHECK_NAME[c.id] || c.check)}</td>
                <td class="py-3 px-4 font-mono">${fmt(c.applicable)}</td>
                <td class="py-3 px-4 font-mono ${nb || c.passBefore === 0 ? 'text-slate-400' : 'text-slate-500'}">${fmt(c.passBefore)}</td>
                <td class="py-3 px-4 font-mono font-bold text-brand-600">${fmt(c.passAfter)}</td>
                <td class="py-3 px-4 text-xs font-mono ${nb ? 'text-slate-400' : 'text-slate-500'}">${nb ? 'n/a' : `${fmt(c.rateBefore, c.rateBefore % 1 ? 1 : 0)}%`}</td>
                <td class="py-3 px-4 text-xs font-mono font-bold ${c.rateAfter > (c.rateBefore ?? 0) ? 'text-emerald-600' : 'text-slate-700'}">${fmt(c.rateAfter, c.rateAfter % 1 ? 1 : 0)}%</td>
                <td class="py-3 px-6 text-right"><span class="px-2.5 py-1 rounded-md text-xs border ${cls}">${status}</span></td>
              </tr>`;
  }).join('\n');
  const regressions = d.keyChecks.filter((c) => c.change != null && c.change < 0).length;

  // ---- real browser
  const b = d.browser;
  const speedCards = b ? (() => {
    const lcpUp = pctOf(b.lcpBefore - b.lcpAfter, b.lcpBefore), kbDiff = (b.bytesBefore - b.bytesAfter) / 1024, reqDown = pctOf(b.requestsBefore - b.requestsAfter, b.requestsBefore);
    return `<div class="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-3">
          <div class="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between"><span>Largest Contentful Paint</span><span class="text-emerald-600 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded">${lcpUp >= 0 ? '+' : ''}${fmt(lcpUp)}% Faster</span></div>
          <div class="text-3xl font-black text-slate-900 font-display">${fmt(b.lcpBefore)} <span class="text-brand-600 font-sans text-xl">→ ${fmt(b.lcpAfter)} ms</span></div>
          <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full" style="width: ${Math.min(100, pctOf(b.lcpAfter, b.lcpBefore)).toFixed(0)}%"></div></div>
          <div class="flex justify-between text-[11px] text-slate-400 font-medium"><span>Baseline: ${(b.lcpBefore / 1000).toFixed(2)}s</span><span class="text-emerald-700 font-bold">Goal: &lt; 2.5s</span></div>
        </div>
        <div class="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-3">
          <div class="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between"><span>Average Page Weight</span><span class="text-sky-600 font-mono font-bold bg-sky-50 px-2 py-0.5 rounded">-${fmt(kbDiff)} KB / page</span></div>
          <div class="text-3xl font-black text-slate-900 font-display">${fmt(b.bytesBefore / 1024)} <span class="text-sky-600 font-sans text-xl">→ ${fmt(b.bytesAfter / 1024)} KB</span></div>
          <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-gradient-to-r from-sky-400 to-indigo-500 h-full rounded-full" style="width: ${Math.min(100, pctOf(b.bytesAfter, b.bytesBefore)).toFixed(0)}%"></div></div>
          <div class="flex justify-between text-[11px] text-slate-400 font-medium"><span>Original pages</span><span class="text-sky-700 font-bold">${fmt(pctOf(b.bytesBefore - b.bytesAfter, b.bytesBefore))}% Lighter</span></div>
        </div>
        <div class="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-3">
          <div class="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between"><span>HTTP Requests / Page</span><span class="text-purple-600 font-mono font-bold bg-purple-50 px-2 py-0.5 rounded">-${fmt(reqDown)}% Traffic</span></div>
          <div class="text-3xl font-black text-slate-900 font-display">${fmt(b.requestsBefore)} <span class="text-purple-600 font-sans text-xl">→ ${fmt(b.requestsAfter)} reqs</span></div>
          <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-gradient-to-r from-purple-400 to-pink-500 h-full rounded-full" style="width: ${Math.min(100, pctOf(b.requestsAfter, b.requestsBefore)).toFixed(0)}%"></div></div>
          <div class="flex justify-between text-[11px] text-slate-400 font-medium"><span>Multiple blocking CSS/JS</span><span class="text-purple-700 font-bold">Bundled Asset Execution</span></div>
        </div>
        <div class="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-3">
          <div class="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between"><span>Cumulative Layout Shift</span><span class="text-emerald-600 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded">${n(b.clsAfter) === 0 ? 'Zero Jitter' : 'Lower is better'}</span></div>
          <div class="text-3xl font-black text-slate-900 font-display">${b.clsBefore} <span class="text-emerald-600 font-sans text-xl">→ ${Number(b.clsAfter).toFixed(2)}</span></div>
          <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-gradient-to-r from-emerald-400 to-teal-400 h-full rounded-full" style="width: ${n(b.clsBefore) ? Math.min(100, 100 - pctOf(b.clsAfter, b.clsBefore)).toFixed(0) : 100}%"></div></div>
          <div class="flex justify-between text-[11px] text-slate-400 font-medium"><span>Mobile shift ${n(b.clsAfter) === 0 ? 'eliminated' : 'reduced'}</span><span class="text-emerald-700 font-bold">Aspect Ratios Fixed</span></div>
        </div>`;
  })() : `<div class="sm:col-span-2 lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-card-glass text-sm text-slate-500">The real-browser test has not been run for this site yet. Press <strong>Test 12 sample pages</strong> on the Validation &amp; Report page, then generate the report again.</div>`;
  const routeName = (p) => (p.includes('/') ? `.../${p.split('/').pop()}` : `/${p}`);
  const browserRows = d.browserRows.map((r) => {
    const up = pctOf(r.lcpBefore - r.lcpAfter, r.lcpBefore);
    const cls = n(r.clsBefore) > 0 && n(r.clsAfter) !== n(r.clsBefore) ? `${r.clsBefore} → ${Number(r.clsAfter).toFixed(2)}` : Number(r.clsAfter).toFixed(2);
    return `<tr class="hover:bg-slate-50/80">
                <td class="py-2 px-4 font-sans font-medium text-slate-900 truncate max-w-xs" title="${esc(r.path)}">${esc(routeName(r.path))}</td>
                <td class="py-2 px-3 text-slate-400">${fmt(r.lcpBefore)} ms</td>
                <td class="py-2 px-3 text-brand-600 font-bold">${fmt(r.lcpAfter)} ms</td>
                <td class="py-2 px-3 ${up >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-semibold">${up >= 0 ? '+' : ''}${up.toFixed(1)}%</td>
                <td class="py-2 px-3">${fmt(r.kbBefore)} → ${fmt(r.kbAfter)}</td>
                <td class="py-2 px-3">${fmt(r.requestsBefore)} → ${fmt(r.requestsAfter)}</td>
                <td class="py-2 px-4 text-emerald-600 font-bold">${cls}</td>
              </tr>`;
  }).join('\n');

  // ---- images
  const act = (a) => d.imgEntries.filter((e) => e.action === a).length;
  const imgData = [act('converted'), act('recompressed'), act('kept')];
  const imgTotal = d.imgEntries.length || 1;
  const imgLegend = [['bg-sky-500', 'Converted to WebP', imgData[0]], ['bg-accent-coral', 'Recompressed WebP', imgData[1]], ['bg-slate-400', 'Retained Unchanged', imgData[2]]].map(([c, l, v], i) => `<div class="flex justify-between items-center py-1.5${i < 2 ? ' border-b border-slate-100' : ''}">
              <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full ${c}"></span> ${l}</span>
              <span class="font-bold font-mono">${v} (${Math.round(pctOf(v, imgTotal))}%)</span>
            </div>`).join('\n');
  const topSavings = d.imgEntries.filter((e) => e.saved > 0).slice(0, 6).map((e) => `<div>
              <div class="flex justify-between text-xs font-medium mb-1">
                <span class="font-mono text-slate-700 truncate">${esc(e.original)}${e.action === 'recompressed' ? ' (Recompressed)' : ''}</span>
                <span class="font-mono font-bold text-emerald-600">-${fmt(e.saved / 1024, 1)} KB (${fmt(e.savedPct, 1)}%)</span>
              </div>
              <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex"><div class="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full" style="width: ${Math.min(100, e.savedPct)}%"></div></div>
            </div>`).join('\n');
  const iset = d.imageSettings || {};

  // ---- template
  const swatches = [['primary', 'Primary Colour', 'Headers, Hero Accents, Primary CTAs'], ['primaryDark', 'Dark Primary', 'Deep footer, high contrast badges'], ['accent', 'Accent Colour', 'Call-Now buttons, urgent notifications'], ['ink', 'Ink Body', 'Optimal editorial readability'], ['soft', 'Soft Tint', 'Alternating row & card backgrounds']].map(([key, label, use]) => `<div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-lg shadow-sm" style="background-color: ${esc(s[key])};"></div>
                <div><div class="font-bold text-slate-900">${label}</div><div class="text-[10px] text-slate-500">${use}</div></div>
              </div>
              <span class="font-mono font-bold text-slate-600">${esc(s[key])}</span>
            </div>`).join('\n');
  const words = (v) => cap(v);
  const typo = [
    ['Heading Typography', `${esc(s.fontHeading)} (Weight ${esc(s.headingWeight)})`, 'font-bold text-slate-900 font-display'],
    ['Body Typography', `${esc(s.fontBody)} (${words(s.density)} Spacing)`, 'font-bold text-slate-900'],
    ['Header Style', `${words(lay.header)}${lay.topbar ? ' with Top Quick Bar (On)' : ''}`, 'font-semibold text-slate-900'],
    ['Hero Style', words(lay.hero), 'font-semibold text-slate-900'],
    ['Inner Sidebar Form', `Sidebar ${words(lay.innerSidebar)} • Form ${words(lay.innerForm)}`, 'font-semibold text-slate-900'],
    ['Border Radius & Shadow', `Radius ${esc(String(s.radius).toUpperCase())} • ${words(s.shadow)} Soft Depth`, 'font-semibold text-slate-900'],
  ].map(([t, v, c]) => `<div class="pt-2 flex justify-between"><dt class="text-slate-500 font-medium">${t}</dt><dd class="${c}">${v}</dd></div>`).join('\n');
  const arch = [
    ['Legacy jQuery Stripped', 'Eliminated obsolete blocking scripts', `${fmt(jq.before)} → ${fmt(jq.after)} pages`],
    ['Stylesheets Consolidated', 'Aggregated into single production bundle', `${fmt(css.before, 1)} → ${fmt(css.after, 1)} files`],
    ['Script Count Slashed', 'Asynchronous execution pipeline', `${fmt(scripts.before, 1)} → ${fmt(scripts.after, 1)} files`],
    ['HTML File Density', 'Cleaned inline markup & junk comments', `${fmt(htmlKb.before, 1)} → ${fmt(htmlKb.after, 1)} KB`],
  ].map(([t, sub, v]) => `<div class="p-3 rounded-2xl bg-slate-50 flex items-center justify-between">
              <div><div class="font-bold text-slate-800">${t}</div><div class="text-[11px] text-slate-500">${sub}</div></div>
              <span class="font-mono font-bold text-emerald-600">${v}</span>
            </div>`).join('\n');

  // ---- pages directory
  const pagesData = rows.map((r) => ({ path: r.path, type: r.type, mode: r.wording, before: r.scoreBefore, after: r.scoreAfter, change: r.change, title: r.titleBefore || r.titleAfter, newTitle: r.titleAfter }));
  const typeOpts = TYPE_IDS.map((id) => [id, `${id} (${typeLabel(id)})`]);
  const known = new Set(typeOpts.map(([v]) => v));
  const typeOptions = [...typeOpts.filter(([v]) => rows.some((r) => r.type === v)), ...[...new Set(rows.map((r) => r.type))].filter((t) => !known.has(t)).map((t) => [t, t])].map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('\n            ');

  const A = d.areas || { template: true, images: true, content: true };
  const nav = [['summary', 'Executive Summary'], ['benchmarks', 'SEO & Checks'], ...(A.images || A.template ? [['speed', 'Core Web Vitals']] : []), ...(A.images ? [['assets', 'Image Engine']] : []), ...(A.template ? [['template', d.templateOwn ? 'Template' : `Template v${d.spec.version}`]] : []), ...(d.headLog?.length ? [['headtags', 'Head Tags']] : []), ...(d.canonical ? [['seohead', 'Canonical & Links']] : []), ['catalog', `${fmt(total)}-Page Audit`], ...(A.content ? [['diffs', 'Copy Diffs']] : [])].map(([id, l]) => `<a href="#${id}" class="px-3 py-1.5 rounded-xl hover:text-brand-600 hover:bg-sky-50 transition">${esc(l)}</a>`).join('\n        ');

  const tplSection = d.templateOwn ? `<section id="template" class="space-y-6">
      ${head('Design System', 'Existing template Specs', `<div class="text-xs text-slate-500 font-medium">Your own stylesheet is reused • ${fmt(d.templateOwn.converted)} legacy pages converted • ${fmt(d.templateOwn.modern)} modern pages left untouched</div>`)}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-4">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2"><i class="ph ph-layout text-brand-600"></i> Template Pages</h4>
          <dl class="space-y-3 text-xs divide-y divide-slate-100">
            ${[['Home', d.templateOwn.pages.home], ['Inner page', d.templateOwn.pages.inner], ['Contact page', d.templateOwn.pages.contact]].map(([k, v]) => `<div class="pt-2 flex justify-between gap-3"><dt class="text-slate-500 font-medium">${k}</dt><dd class="font-mono font-semibold text-slate-900 break-all text-right">${v ? esc(v) : 'Inner page template used'}</dd></div>`).join('\n')}
          </dl>
          <p class="text-[11px] text-slate-500">The header, footer and styles of the Home template page are used on every converted page.</p>
        </div>
        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-4">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2"><i class="ph ph-squares-four text-indigo-600"></i> Section Designs</h4>
          <dl class="space-y-3 text-xs divide-y divide-slate-100">
            ${d.templateOwn.patterns.map((p) => `<div class="pt-2 flex justify-between gap-3"><dt class="text-slate-500 font-medium">${esc(({ cta: 'Call-to-action', faq: 'FAQ', cards: 'Cards', reviews: 'Reviews', links: 'Link lists' })[p.kind] || cap(p.kind))}</dt><dd class="font-semibold text-slate-900 text-right">${p.source === 'template' ? 'From your template page' : 'Generated in the template\u2019s style'}</dd></div>`).join('\n')}
          </dl>
        </div>
        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-4">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2"><i class="ph ph-cpu text-accent-violet"></i> Architecture Modernization</h4>
          <div class="space-y-3 text-xs">
            ${arch}
          </div>
        </div>
      </div>
    </section>` : `    <section id="template" class="space-y-6">
      ${head('Design System', 'New template Specs', `<div class="text-xs text-slate-500 font-medium">Unified CSS: ${d.cssBytes ? `${fmt(d.cssBytes / 1024, 1)} KB compiled` : 'compiled per build'} • ${jq.after ? `${fmt(jq.after)} pages still load jQuery` : 'Zero jQuery dependencies'}</div>`)}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-4">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2"><i class="ph ph-palette text-brand-600"></i> Color Tokens</h4>
          <div class="space-y-2.5 text-xs">
            ${swatches}
          </div>
        </div>
        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-4">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2"><i class="ph ph-text-t text-indigo-600"></i> Typography &amp; Layout</h4>
          <dl class="space-y-3 text-xs divide-y divide-slate-100">
            ${typo}
          </dl>
        </div>
        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-4">
          <h4 class="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2"><i class="ph ph-cpu text-accent-violet"></i> Architecture Modernization</h4>
          <div class="space-y-3 text-xs">
            ${arch}
          </div>
        </div>
      </div>
    </section>`;

  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Modernisation Executive Report (${d_year}) | ${name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: {
        colors: {
          brand: { DEFAULT: '#0ea5e9', 50: '#f0f9ff', 100: '#e0f2fe', 500: '#0284c7', 600: '#0369a1', 700: '#075985', 800: '#0c4a6e', 900: '#082f49' },
          accent: { violet: '#8b5cf6', indigo: '#6366f1', pink: '#ec4899', amber: '#f59e0b', emerald: '#10b981', coral: '#f97316' },
          surface: { 50: '#f8fafc', 100: '#f1f5f9', 800: '#0f172a', 900: '#090d16', 950: '#040711' }
        },
        fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], display: ['"Outfit"', 'sans-serif'], mono: ['"Fira Code"', 'monospace'] },
        boxShadow: {
          'glow-cyan': '0 0 35px -5px rgba(14, 165, 233, 0.35)', 'glow-violet': '0 0 35px -5px rgba(139, 92, 246, 0.35)', 'glow-coral': '0 0 35px -5px rgba(249, 115, 22, 0.35)',
          'card-glass': '0 10px 30px -5px rgba(15, 23, 42, 0.06), 0 4px 6px -2px rgba(15, 23, 42, 0.02)', 'card-hover': '0 20px 40px -8px rgba(99, 102, 241, 0.15)'
        }
      } }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js"></script>
  <script src="https://unpkg.com/@phosphor-icons/web"></script>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; color: #0f172a !important; font-size: 10pt; }
      .page-break { page-break-after: always; }
      .print-shadow-none { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
      /* tables: no scrolling box, no clipped columns, every row; the page is landscape and the table is as wide as the page */
      @page { size: A4 landscape; margin: 10mm; }
      .overflow-x-auto, .overflow-auto, .overflow-hidden, .custom-scrollbar { overflow: visible !important; max-height: none !important; }
      table { width: 100% !important; min-width: 0 !important; table-layout: auto; font-size: 7.5pt !important; }
      th, td { white-space: normal !important; overflow-wrap: anywhere; word-break: break-word; padding: 3px 4px !important; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
      .sticky { position: static !important; }
      .print-more { display: table-row !important; }
      #pagesTableBody tr, #imageTable tbody tr { display: table-row; }
    }
    .print-more { display: none; }
    .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    .diff-del { background: linear-gradient(135deg, #fee2e2, #fecaca); color: #b91c1c; text-decoration: line-through; padding: 0.15rem 0.4rem; border-radius: 0.375rem; font-weight: 500; }
    .diff-ins { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #15803d; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 0.375rem; border-bottom: 2px solid #22c55e; }
  </style>
  ${DOWNLOAD_SCRIPT}
</head>
<body class="bg-[#f8fafc] text-slate-800 antialiased font-sans selection:bg-brand-500 selection:text-white relative min-h-screen">

  <div class="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-60">
    <div class="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-tr from-sky-400/25 via-indigo-400/20 to-purple-400/20 blur-[130px]"></div>
    <div class="absolute top-[35%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-pink-400/20 via-orange-400/15 to-amber-300/20 blur-[140px]"></div>
    <div class="absolute -bottom-[20%] left-[20%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-t from-emerald-400/20 via-cyan-400/15 to-blue-400/20 blur-[130px]"></div>
  </div>

  <header class="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 transition-all shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div></div>
      <nav class="hidden lg:flex items-center justify-center gap-1 text-[13px] font-semibold text-slate-600 whitespace-nowrap">
        ${nav}
      </nav>
      <div class="flex items-center justify-end gap-2 col-start-3">
        ${DOWNLOAD_BUTTON('no-print hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition active:scale-95')}
        <button onclick="window.print()" class="no-print hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition active:scale-95"><i class="ph ph-printer"></i><span class="hidden 2xl:inline">Print / Save PDF</span></button>
        <a href="#catalog" class="inline-flex items-center gap-2 whitespace-nowrap bg-gradient-to-r from-brand-500 via-indigo-600 to-accent-violet text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-500/25 hover:shadow-brand-500/40 hover:opacity-95 transition transform active:scale-95"><i class="ph-bold ph-table"></i> Explore ${fmt(total)} Pages</a>
      </div>
    </div>
  </header>

  <main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

    <section id="summary" class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-950 via-slate-900 to-indigo-950 text-white p-8 lg:p-12 shadow-2xl border border-indigo-900/40">
      <div class="absolute -right-24 -bottom-24 w-96 h-96 bg-gradient-to-bl from-cyan-500/30 to-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute right-1/3 -top-24 w-72 h-72 bg-gradient-to-tr from-accent-coral/20 to-accent-pink/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div class="lg:col-span-8 space-y-5">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider border border-cyan-400/30 backdrop-blur-md"><i class="ph ph-sparkle text-amber-400"></i> Full Digital Infrastructure Transformation</div>
          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tracking-tight text-white leading-tight">Comprehensive Digital Overhaul: <span class="bg-gradient-to-r from-cyan-300 via-indigo-300 to-pink-300 bg-clip-text text-transparent">${fmt(total)} of ${fmt(d.scope.sitePages)} Pages</span> Modernized</h2>
          <p class="text-slate-300 text-base sm:text-lg max-w-2xl font-light leading-relaxed">This executive report compares the original website against the modernized production release. Figures are counted directly from compiled pages, eliminating approximations. Full backups remain restorable in one click.</p>
          <div class="pt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-200">
            <div class="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2.5 transition"><i class="ph ph-buildings text-cyan-300 text-base"></i><span class="text-slate-400 font-medium">Client</span><span>${name}</span></div>
            <div class="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2.5 transition"><i class="ph ph-globe text-emerald-300 text-base"></i><span class="text-slate-400 font-medium">Website</span><span><a href="https://${host}" target="_blank" class="hover:text-cyan-300 underline decoration-cyan-400/50 underline-offset-4">${host}</a></span></div>
            <div class="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 rounded-xl px-3.5 py-2.5 transition"><i class="ph ph-calendar-blank text-amber-300 text-base"></i><span class="text-slate-400 font-medium">Report Date</span><span>${run}</span></div>
          </div>
        </div>
        <div class="lg:col-span-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          <div class="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/20 rounded-full blur-xl"></div>
          <div class="text-xs uppercase tracking-widest text-indigo-200 font-bold mb-2">Composite SEO Quality Score</div>
          <div class="flex items-center justify-center gap-3 my-3">
            <span class="text-3xl sm:text-4xl font-mono text-slate-400 line-through opacity-80">${k.scoreBefore}</span>
            <i class="ph-bold ph-arrow-right text-amber-400 text-2xl"></i>
            <span class="text-6xl sm:text-7xl font-black font-display text-white tracking-tight drop-shadow-md">${k.scoreAfter}</span>
          </div>
          <div class="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-emerald-300 text-sm font-bold rounded-full border border-emerald-400/40 mb-4"><i class="ph-bold ph-trend-up"></i> ${gain >= 0 ? '+' : ''}${gain} Points (${gain >= 0 ? '+' : ''}${gainPct}% ${gain >= 0 ? 'Increase' : 'Change'})</div>
          <p class="text-xs text-slate-300 leading-relaxed font-light">Evaluated on a rigorous ${checks}-point checklist covering Meta, OpenGraph, JSON-LD Schemas, Landmarks, Layout Shift, and Speed.</p>
        </div>
      </div>
    </section>

    ${summaryBox(d)}

    <section class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      ${card('SEO Score', 'sky', 'chart-line-up', `${k.scoreBefore} <span class="text-brand-600">→ ${k.scoreAfter}</span>`, `${gain >= 0 ? '+' : ''}${gain} pt Site Average`, 'text-emerald-600 font-bold')}
      ${card('Pages Updated', 'indigo', 'file-text', fmt(k.pagesUpdated || total), `${Math.round(pctOf(k.pagesUpdated || total, d.scope.sitePages))}% of Site Scanned`, 'text-indigo-600 font-bold')}
      ${A.images ? card('Image Weight', 'amber', 'arrows-in-cardinal', `${imgPct}% <span class="text-xs font-normal text-slate-400">cut</span>`, `${size(k.imageBytesBefore)} → ${size(k.imageBytesAfter)}`, 'text-emerald-600 font-bold') : ''}
      ${A.images ? card('Next-Gen WebP', 'emerald', 'file-image', `${modernNow}%`, `JPG/PNG: ${fmt(ip.legacyB)} → ${fmt(ip.legacyA)}`) : ''}
      ${A.images ? card('Srcset Tags', 'purple', 'devices', fmt(ip.srcsetA), `Was ${fmt(ip.srcsetB)} responsive`, 'text-purple-600 font-bold') : ''}
      ${card('Checklist Pass', 'teal', 'seal-check', k.validation ? `${k.validation.completion}%` : '–', k.validation ? `${fmt(k.validation.checksPassed)} / ${fmt(k.validation.checksApplicable)} Checks` : 'Run validation')}
    </section>

    <section id="benchmarks" class="space-y-6">
      ${head('Performance Audit', 'Score &amp; SEO Progression', `<div class="text-sm text-slate-500">Evaluated via identical ${checks}-point algorithmic audit checklist</div>`)}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass flex flex-col justify-between">
          <div>
            <h4 class="text-lg font-bold font-display text-slate-900 mb-1">Score by Architectural Category</h4>
            <p class="text-xs text-slate-500 mb-6">Average score pass rate across ${fmt(total)} individual page runs</p>
            <div class="space-y-5">
              ${catBars}
            </div>
          </div>
          <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 bg-slate-300 rounded-md"></span> Original Baseline</span>
            <span class="flex items-center gap-1.5"><span class="w-3.5 h-3.5 bg-gradient-to-r from-brand-500 to-indigo-500 rounded-md"></span> Modernized ${d_year} Target</span>
          </div>
        </div>
        <div class="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass">
          <div class="flex justify-between items-center mb-4">
            <div><h4 class="text-lg font-bold font-display text-slate-900">Pages by Score Band</h4><p class="text-xs text-slate-500">Count distribution across score ranges</p></div>
            <span class="text-xs font-mono bg-sky-50 text-sky-800 font-bold px-2.5 py-1 rounded-lg">${fmt(total)} Total</span>
          </div>
          <div class="h-64 relative"><canvas id="scoreBandsChart"></canvas></div>
          <p class="text-xs text-slate-500 text-center mt-3"><span class="text-brand-600 font-bold">${fmt(top)} / ${fmt(total)} pages (${Math.round(pctOf(top, total))}%)</span> now achieve the top 90–100 quality tier.</p>
        </div>
      </div>
      <div class="bg-white rounded-3xl border border-slate-200/80 shadow-card-glass overflow-hidden">
        <div class="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
          <div><h4 class="text-base font-bold font-display text-slate-900">The 8 Critical High-Impact Search Signals</h4><p class="text-xs text-slate-500">Prerequisites directly impacting Google crawling &amp; ranking</p></div>
          <span class="px-3 py-1 text-xs font-bold ${regressions ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'} rounded-full flex items-center gap-1.5 border"><i class="ph-bold ph-${regressions ? 'warning' : 'check'}"></i> ${regressions ? `${regressions} Regression${regressions > 1 ? 's' : ''}` : 'Zero Regressions'}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead class="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-200">
              <tr><th class="py-3 px-6">Check Description</th><th class="py-3 px-4">Applies To</th><th class="py-3 px-4">Pass Before</th><th class="py-3 px-4">Pass After</th><th class="py-3 px-4">Rate Before</th><th class="py-3 px-4">Rate After</th><th class="py-3 px-6 text-right">Status</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700 font-medium">
              ${keyRows}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    ${(A.images || A.template) ? `<section id="speed" class="space-y-6">
      ${head('Device Laboratory Audit', 'Real-World Browser Benchmarking', `<div class="text-xs font-mono bg-sky-50 text-sky-800 font-bold px-3 py-1.5 rounded-xl border border-sky-200">${esc(d.browserProfile ? d.browserProfile.replace(/^Emulated phone \(390px\)/, 'Simulated: Mobile 390px') : 'Simulated: Mobile 390px • Slow 4G (1.6 Mbps / 150ms) • 4x CPU Throttling')}</div>`)}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${speedCards}
      </div>
      ${d.browserRows.length ? `<div class="bg-white rounded-3xl border border-slate-200/80 shadow-card-glass overflow-hidden">
        <div class="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center">
          <h4 class="text-sm font-bold font-display text-slate-900">Sample Page-by-Page Real Browser Performance (${d.browserRows.length} representative paths)</h4>
          <span class="text-xs text-slate-500 font-mono">Chrome Headless Benchmark</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead class="bg-slate-100/70 text-slate-600 uppercase font-semibold">
              <tr><th class="py-2.5 px-4 font-sans">Page Route</th><th class="py-2.5 px-3">LCP Before</th><th class="py-2.5 px-3">LCP After</th><th class="py-2.5 px-3">Speedup</th><th class="py-2.5 px-3">Weight (KB)</th><th class="py-2.5 px-3">Requests</th><th class="py-2.5 px-4">CLS Shift</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${browserRows}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    </section>` : ''}

    ${A.images ? `<section id="assets" class="space-y-6">
      ${head('Asset Pipeline', 'Image Weight &amp; Responsive Delivery', `<div class="text-xs text-slate-500">Conversion quality target: ${esc(iset.quality ?? 80)}% WebP • Max dimension ${esc(iset.maxWidth ?? 1600)}px • Responsive breakpoints: ${esc((iset.widths || [480, 800, 1200]).map((w) => `${w}w`).join(', '))}</div>`)}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div class="lg:col-span-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass">
          <h4 class="text-base font-bold font-display text-slate-900 mb-1">Image Pipeline Action</h4>
          <p class="text-xs text-slate-500 mb-4">Total ${fmt(d.imgEntries.length)} images processed in media library</p>
          <div class="h-56 relative"><canvas id="imageActionsChart"></canvas></div>
          <div class="mt-4 space-y-2 text-xs">
            ${imgLegend}
          </div>
        </div>
        <div class="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-card-glass space-y-4">
          <div class="flex justify-between items-center">
            <div><h4 class="text-base font-bold font-display text-slate-900">Top Individual Asset Savings</h4><p class="text-xs text-slate-500">Largest individual payload cuts from unoptimized camera files</p></div>
            <span class="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">Saved ${size(imgSaved)} total</span>
          </div>
          <div class="space-y-3 pt-2">
            ${topSavings}
          </div>
          <div class="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center text-xs text-slate-500 gap-2">
            <span><strong>${fmt(k.referencesRewritten)} image references</strong> updated in ${fmt(k.filesModified)} HTML/CSS files without breaking hyperlinks.</span>
            <span>${fmt(k.unusedFiles)} unused images (${size(k.unusedBytes)}) moved to safety archive.</span>
          </div>
        </div>
      </div>
      ${imageResult(d)}
    </section>` : ''}

    ${A.template ? tplSection : ''}

    ${headTagsBlock(d, head)}

    ${canonicalBlock(d, head)}

    <section id="catalog" class="space-y-6">
      ${A.content ? contentBlock(d) : ''}
      <div class="flex flex-col sm:flex-row justify-between sm:items-end gap-3 border-b border-slate-200 pb-4">
        <div>
          <span class="text-xs font-extrabold text-brand-600 uppercase tracking-wider">Complete Dataset</span>
          <h3 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900">Modernized Pages Directory</h3>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="exportPagesCSV()" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition active:scale-95"><i class="ph-bold ph-download-simple text-sm text-brand-600"></i> Export Clean CSV</button>
        </div>
      </div>
      <div class="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-card-glass grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div class="sm:col-span-6 relative">
          <i class="ph-bold ph-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-base"></i>
          <input type="text" id="pageSearchInput" onkeyup="filterPagesTable()" placeholder="Search route, city, keyword (e.g. coral-springs, cast-iron, polypipe)..." class="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition font-medium">
        </div>
        <div class="sm:col-span-3">
          <select id="typeFilter" onchange="filterPagesTable()" class="w-full py-2.5 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium">
            <option value="">All Page Types</option>
            ${typeOptions}
          </select>
        </div>
        <div class="sm:col-span-3">
          <select id="statusFilter" onchange="filterPagesTable()" class="w-full py-2.5 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium">
            <option value="">All Scores</option>
            <option value="100">Perfect 100 Score</option>
            <option value="gain20">Score Gain &ge; +20</option>
            <option value="gain15">Score Gain &ge; +15</option>
          </select>
        </div>
      </div>
      <div class="bg-white rounded-3xl border border-slate-200/80 shadow-card-glass overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar max-h-[620px]">
          <table class="w-full text-left text-xs" id="pagesTable">
            <thead class="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
              <tr><th class="py-3 px-5">Target Page Path</th><th class="py-3 px-3">Type</th><th class="py-3 px-3">Mode</th><th class="py-3 px-3 text-center">Score Before</th><th class="py-3 px-3 text-center">Score After</th><th class="py-3 px-3 text-center">Gain</th></tr>
            </thead>
            <tbody id="pagesTableBody" class="divide-y divide-slate-100 text-slate-700 font-medium"></tbody>
          </table>
        </div>
        <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-500 gap-2">
          <span id="pageCountDisplay" class="font-semibold text-slate-700">Showing pages...</span>
          <span class="font-mono text-slate-400">Data verified against ${applied ? 'the website folder' : 'the build folder'}</span>
        </div>
      </div>
    </section>

    ${A.content ? `<section id="diffs" class="space-y-6">
      ${head('Editorial Integrity', 'AI Copy Enhancement &amp; Grammar Diffs', `<div class="text-xs text-slate-500">${fmt(d.unitRows.length)} text sections modernized • Strictly validated against "claims to never make"</div>`)}
      ${diffIntro(d)}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${diffCards(d.unitRows) || '<div class="md:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-card-glass p-6 text-sm text-slate-500">No wording was changed on this site, so there are no copy differences to show.</div>'}
      </div>
    </section>` : ''}


  </main>

  <footer class="bg-surface-950 text-white/80 py-8 border-t border-slate-800 relative z-10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm font-medium">Report prepared by Top Ten Website Marketing for ${name}</div>
  </footer>

  <script>
    const pagesData = ${json(pagesData)};
    const BAND_DATA = ${json(bands)};
    const IMG_DATA = ${json(imgData)};
    const CSV_NAME = ${json(`${d.slug}_modernisation_audit_${rows.length}_pages.csv`)};
${CLIENT_JS}
  </script>
</body>
</html>`;
}
