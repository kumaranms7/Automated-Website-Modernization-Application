import { DOWNLOAD_SCRIPT } from './download.js';
import { SEO } from '../rules.js';
import { esc } from '../util/html.js';
import { pairBars, bars, columns, donut } from './charts.js';

// The modernisation report as one self-contained HTML page (print it to PDF from the browser). Every table has an "Export CSV" button
// that downloads the full table, and the same tables are written as .csv files next to the report.

const n = (v) => Number(v) || 0;
const fmt = (v) => n(v).toLocaleString('en-US');
const bytes = (b) => { b = n(b); return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const date = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '–');
const delta = (v, unit = '', goodUp = true) => { v = n(v); if (!v) return '<span class="d0">no change</span>'; const good = goodUp ? v > 0 : v < 0; return `<span class="${good ? 'dg' : 'db'}">${v > 0 ? '+' : ''}${fmt(Math.round(v * 10) / 10)}${unit}</span>`; };
const cap = (s) => String(s || '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

// ---- tables ----
export function csvOf(def) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [def.cols.map((c) => q(c.label)).join(','), ...def.rows.map((r) => def.cols.map((c) => q(r[c.k])).join(','))].join('\r\n');
}

function tableHtml(def) {
  const limit = def.limit ?? 15;
  const head = def.cols.map((c) => `<th class="${c.num ? 'num' : ''}" data-k="${esc(c.k)}">${esc(c.label)}</th>`).join('');
  const body = def.rows.map((r, i) => `<tr${limit && i >= limit ? ' class="more" hidden' : ''}>${def.cols.map((c) => {
    const v = r[c.k];
    const text = c.html ? c.html(v, r) : esc(typeof v === 'string' && v.length > 240 ? `${v.slice(0, 237)}…` : v ?? '');
    return `<td class="${c.num ? 'num' : ''}"${typeof v === 'string' && v.length > 240 ? ` title="${esc(v.slice(0, 600))}"` : ''}>${text}</td>`;
  }).join('')}</tr>`).join('');
  const hidden = limit && def.rows.length > limit ? def.rows.length - limit : 0;
  return `<div class="tbl" id="t-${def.id}" data-id="${def.id}">
<div class="tbl-bar"><h4>${esc(def.title)} <small>${fmt(def.rows.length)} row${def.rows.length === 1 ? '' : 's'}</small></h4><span><input type="search" placeholder="Filter…" aria-label="Filter ${esc(def.title)}"><button type="button" data-csv="${def.id}">Export CSV</button></span></div>
${def.note ? `<p class="note">${def.note}</p>` : ''}
<div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${def.cols.length}" class="empty">Nothing to show.</td></tr>`}</tbody></table></div>
${hidden ? `<button type="button" class="show-all" data-all="${def.id}">Show all ${fmt(def.rows.length)} rows</button>` : ''}</div>`;
}

const scoreCell = (v) => `<span class="sc ${v >= 90 ? 'g' : v >= 75 ? 'm' : 'l'}">${v}</span>`;
const changeCell = (v) => (v == null ? '<span class="d0">n/a</span>' : delta(v));
const rateCell = (v) => (v == null ? '<span class="d0" title="This check could not be measured on the old page markup">n/a</span>' : esc(v));

// ---- the report ----
export function renderReport(d) {
  const A = d.areas || { template: true, images: true, content: true };
  const tables = {};
  const T = (id, title, cols, rows, o = {}) => { const def = { id, title, cols, rows, ...o }; tables[id] = def; return tableHtml(def); };
  const k = d.kpi, ip = d.imagesPages;
  const imgSaved = k.imageBytesBefore - k.imageBytesAfter;
  const imgPct = pct(imgSaved, k.imageBytesBefore);
  const total = d.scope.pages;

  const chk = (id) => { const c = d.checks.find((x) => x.id === id); return { a: c?.rateAfter ?? '–', b: c?.rateBefore == null ? 'not measurable on the old markup' : `${c.rateBefore}%` }; };
  const modernPct = (w, s, t) => pct(w + s, t);
  const highlights = [
    `<b>SEO score ${k.scoreBefore} → ${k.scoreAfter}</b> on average across ${fmt(total)} pages; ${fmt(k.improved)} pages improved, ${fmt(k.same)} unchanged${k.worse ? `, ${fmt(k.worse)} lower` : ''}.`,
    k.imagesProcessed ? `<b>${fmt(k.imagesProcessed)} images optimised</b>: ${bytes(k.imageBytesBefore)} → ${bytes(k.imageBytesAfter)} (<b>${imgPct}% smaller</b>), converted to WebP, with ${bytes(k.variantBytes)} of smaller responsive copies created.` : 'Images were not optimised in this project.',
    `<b>${fmt(ip.srcsetA)} images now carry a responsive srcset</b> (${fmt(ip.srcsetB)} before). On the site’s own images, JPG/PNG went from <b>${fmt(ip.legacyB)} to ${fmt(ip.legacyA)}</b> and WebP or SVG now make up <b>${modernPct(ip.webpA, ip.svgA, ip.imgA - ip.extA)}%</b> (${modernPct(ip.webpB, ip.svgB, ip.imgB - ip.extB)}% before). The old pages repeated many menu images (${fmt(ip.imgB)} images in total); the new pages load ${fmt(ip.imgA)}.`,
    `<b>${fmt(k.referencesRewritten)} image references were updated</b> in ${fmt(k.filesModified)} files so every page points to the new files.`,
    `<b>Template “${esc(d.spec.name || 'new template')}” v${d.spec.version}</b> applied to ${fmt(total)} pages with a new header, footer, hero, cards and call-to-action blocks.`,
    `Wording: <b>${esc(cap(d.contentMode))}</b> mode. <b>${fmt(k.aiPages)} pages</b> now carry AI-written or AI-enhanced wording that passed every automatic check; ${fmt(k.aiPagesReview)} more are waiting for your review and keep their original text meanwhile.`,
    `Image SEO: descriptive alt text on <b>${chk('img-alt-meaningful').a}%</b> of pages with content images; correct lazy loading on <b>${chk('img-lazy').a}%</b> of pages with below-the-fold images, with ${fmt(ip.eagerA)} above-the-fold images loaded eagerly (${fmt(ip.eagerB)} before); content images WebP/SVG on <b>${chk('img-modern').a}%</b> of pages (${chk('img-modern').b} before).`,
    k.backupId ? `Your originals are safe: verified backup <b>${esc(k.backupId)}</b> (${fmt(k.backupFiles)} files, ${bytes(k.backupBytes)}) and every replaced page is saved, so “Restore original files” can undo everything.` : '',
  ].filter(Boolean);

  const tile = (label, value, sub, cls = '') => `<div class="tile ${cls}"><small>${esc(label)}</small><b>${value}</b><span>${sub}</span></div>`;
  const tiles = [
    tile('SEO score', `${k.scoreBefore} <i>→</i> ${k.scoreAfter}`, `${delta(k.scoreAfter - k.scoreBefore)} points`, 'hero'),
    tile('Pages updated', fmt(k.pagesUpdated || total), `of ${fmt(d.scope.sitePages)} scanned`),
    tile('Image weight', `${imgPct}% <i>smaller</i>`, `${bytes(k.imageBytesBefore)} → ${bytes(k.imageBytesAfter)}`),
    tile('Modern image formats', `${modernPct(ip.webpA, ip.svgA, ip.imgA - ip.extA)}%`, `WebP or SVG (own images) · was ${modernPct(ip.webpB, ip.svgB, ip.imgB - ip.extB)}% · JPG/PNG ${fmt(ip.legacyB)} → ${fmt(ip.legacyA)}`),
    tile('Responsive (srcset)', fmt(ip.srcsetA), `was ${fmt(ip.srcsetB)} images`),
    tile('References updated', fmt(k.referencesRewritten), `in ${fmt(k.filesModified)} files`),
    tile('Checklist pass rate', k.validation ? `${k.validation.completion}%` : '–', k.validation ? `${fmt(k.validation.checksPassed)} of ${fmt(k.validation.checksApplicable)} checks` : 'run validation'),
    tile('AI spend', `$${n(k.aiCost).toFixed(2)}`, `${fmt(k.apiCalls)} calls, whole project`),
  ].join('');

  // ---- work completed
  const work = [
    { area: 'Business profile', did: 'Approved facts, services, areas and “claims to never make” recorded; the AI only writes from them.', result: 'Used by wording, titles and the claims check.' },
    { area: 'Site audit', did: `Every page of the site scanned (${fmt(d.scope.sitePages)} pages) for SEO, images, links and structure.`, result: 'Starting point for every before/after figure.' },
    { area: 'New template', did: `Design “${d.spec.name || 'template'}” v${d.spec.version}: fonts, colours, header, footer, hero, cards, call-to-action band, inner and contact page layouts.`, result: `Applied to ${fmt(total)} pages${d.templateRules?.everyPage ? `; ${d.templateRules.everyPage} hand-made change(s) apply to every inner page` : ''}.` },
    { area: 'Images', did: `${fmt(k.imagesProcessed)} images recompressed or converted to WebP; ${bytes(k.variantBytes)} of smaller copies for srcset; originals backed up.`, result: `${imgPct}% less image weight (${bytes(imgSaved)} saved).` },
    { area: 'References', did: `Every page, stylesheet and script that pointed at an old image file was rewritten to the new file.`, result: `${fmt(k.referencesRewritten)} references in ${fmt(k.filesModified)} files; no new broken images.` },
    { area: 'Content', did: `${cap(d.contentMode)} mode. Wording written or enhanced for ${fmt(k.aiPages)} pages and checked against the approved facts and the claims you ruled out.`, result: `${fmt(d.unitRows.length)} text sections changed.` },
    { area: 'Titles and descriptions', did: `Titles (${SEO.title.min}–${SEO.title.max}) and meta descriptions (${SEO.description.min}–${SEO.description.max}) written as complete sentences within the limits, unique on every page.`, result: d.keyChecks.length ? `${d.keyChecks.find((c) => c.id === 'title-length')?.rateAfter ?? '–'}% of titles and ${d.keyChecks.find((c) => c.id === 'meta-length')?.rateAfter ?? '–'}% of descriptions within limits.` : '' },
    { area: 'Image SEO', did: 'Descriptive alt text added where it was missing or only a file name, lazy loading below the fold, eager loading above it, width and height set.', result: `Descriptive alt text on ${chk('img-alt-meaningful').a}% of pages (was ${chk('img-alt-meaningful').b}%).` },
    { area: 'Website files', did: `${fmt(k.pagesUpdated)} pages and ${fmt(k.sharedFiles)} shared files written into the website folder after a verified backup.`, result: k.backupId ? `Backup ${esc(k.backupId)}; restorable.` : 'Not updated in the site folder yet.' },
    { area: 'Validation', did: 'Every page checked against the SEO checklist, links tested, and a sample opened in a real browser.', result: k.validation ? `${k.validation.completion}% of applicable checks pass.` : 'Not run yet.' },
  ];

  // ---- sections ----
  const sec = [];
  sec.push(`<section id="summary"><h2>Executive summary</h2>
<p class="lead">This report compares the original website with the modernised website, page by page. “Before” is the original page exactly as it was; “after” is the page as it now stands in ${esc(d.scope.source)}. All figures are counted from the pages themselves, not estimated.</p>
<div class="tiles">${tiles}</div>
<h3>Highlights</h3><ul class="hl">${highlights.map((h) => `<li>${h}</li>`).join('')}</ul>
${T('work-completed', 'Work completed', [{ k: 'area', label: 'Area' }, { k: 'did', label: 'What was done' }, { k: 'result', label: 'Result' }], work, { limit: 0 })}</section>`);

  sec.push(`<section id="seo"><h2>SEO score: before and after</h2>
<p class="lead">Each page is scored on the same ${d.checks.length}-point checklist before and after (titles, descriptions, headings, images, structured data, links, accessibility and technical checks). A check is weighted by its importance; the score is the share of weighted checks that pass.</p>
<div class="two"><div><h4>Pages by score band</h4>${columns(d.hist)}</div><div><h4>Score by category (average)</h4>${pairBars(d.categories.map((c) => ({ label: c.category, a: c.before, b: c.after, aText: `${c.before}`, bText: `${c.after}` })), { width: 520, labelW: 190 })}</div></div>
${T('seo-categories', 'Score by category', [{ k: 'category', label: 'Category' }, { k: 'before', label: 'Before', num: true }, { k: 'after', label: 'After', num: true }, { k: 'change', label: 'Change', num: true, html: changeCell }], d.categories, { limit: 0 })}
<h3>The eight most important checks</h3>
<p>These are the checks that matter most for search. The update resolves them on every page where they apply.</p>
${pairBars(d.keyChecks.map((c) => ({ label: c.check, a: c.rateBefore ?? 0, b: c.rateAfter, aText: c.rateBefore == null ? 'n/a' : `${c.rateBefore}%`, bText: `${c.rateAfter}%` })), { labelW: 330, width: 900 })}
<p class="note">“n/a” = the check could not be measured on the old pages (for example images in the main content area, which the old markup did not have).</p>
${T('seo-key-checks', 'Most important checks', [{ k: 'check', label: 'Check' }, { k: 'applicable', label: 'Pages it applies to', num: true }, { k: 'passBefore', label: 'Passing before', num: true }, { k: 'passAfter', label: 'Passing after', num: true }, { k: 'failBefore', label: 'Failing before', num: true }, { k: 'failAfter', label: 'Failing after', num: true }, { k: 'rateBefore', label: 'Rate before %', num: true, html: rateCell }, { k: 'rateAfter', label: 'Rate after %', num: true }], d.keyChecks, { limit: 0 })}
<h3>Every check</h3>
${T('seo-all-checks', 'All checks (before and after)', [{ k: 'check', label: 'Check' }, { k: 'category', label: 'Category' }, { k: 'applicable', label: 'Applies to', num: true }, { k: 'passBefore', label: 'Pass before', num: true }, { k: 'passAfter', label: 'Pass after', num: true }, { k: 'rateBefore', label: 'Rate before %', num: true, html: rateCell }, { k: 'rateAfter', label: 'Rate after %', num: true }, { k: 'change', label: 'Change', num: true, html: changeCell }], d.checks, { limit: 12 })}
<h3>Every page</h3>
${T('seo-pages', 'Pages: score, titles, descriptions, headings, images', [
    { k: 'path', label: 'Page' }, { k: 'type', label: 'Type' }, { k: 'wording', label: 'Wording' }, { k: 'scoreBefore', label: 'Score before', num: true, html: scoreCell }, { k: 'scoreAfter', label: 'Score after', num: true, html: scoreCell }, { k: 'change', label: 'Change', num: true, html: changeCell },
    { k: 'titleBefore', label: 'Title before' }, { k: 'titleAfter', label: 'Title after' }, { k: 'titleLenBefore', label: 'Title chars before', num: true }, { k: 'titleLenAfter', label: 'Title chars after', num: true },
    { k: 'metaBefore', label: 'Description before' }, { k: 'metaAfter', label: 'Description after' }, { k: 'metaLenBefore', label: 'Desc. chars before', num: true }, { k: 'metaLenAfter', label: 'Desc. chars after', num: true },
    { k: 'h1Before', label: 'H1 before', num: true }, { k: 'h1After', label: 'H1 after', num: true }, { k: 'wordsBefore', label: 'Words before', num: true }, { k: 'wordsAfter', label: 'Words after', num: true },
    { k: 'imagesBefore', label: 'Images before', num: true }, { k: 'imagesAfter', label: 'Images after', num: true }, { k: 'legacyBefore', label: 'JPG/PNG before', num: true }, { k: 'legacyAfter', label: 'JPG/PNG after', num: true }, { k: 'webpBefore', label: 'WebP before', num: true }, { k: 'webpAfter', label: 'WebP after', num: true }, { k: 'srcsetBefore', label: 'srcset before', num: true }, { k: 'srcsetAfter', label: 'srcset after', num: true }, { k: 'lazyBefore', label: 'Lazy before', num: true }, { k: 'lazyAfter', label: 'Lazy after', num: true }, { k: 'eagerAfter', label: 'Eager after', num: true },
    { k: 'schemaBefore', label: 'Structured data before' }, { k: 'schemaAfter', label: 'Structured data after' }, { k: 'htmlKbBefore', label: 'HTML KB before', num: true }, { k: 'htmlKbAfter', label: 'HTML KB after', num: true },
  ], d.pageRows, { limit: 20, note: 'Click a column heading to sort. The CSV export has every column in full.' })}</section>`);

  if (A.template) sec.push(`<section id="template"><h2>The new template</h2>
<p class="lead">The template is the one design every page is built from: typography, colours, header, footer, hero, cards, call-to-action band and the layouts of the home, inner and contact pages. It replaces the old hand-copied page code, so every page is consistent and loads less.</p>
<div class="swatches">${['primary', 'primaryDark', 'accent', 'ink', 'soft'].map((key) => `<div><i style="background:${esc(d.spec.tokens[key])}"></i><b>${esc(d.spec.tokens[key])}</b><small>${esc(cap(key.replace('primaryDark', 'dark primary')))}</small></div>`).join('')}<div class="font"><b style="font-family:'${esc(d.spec.tokens.fontHeading)}',sans-serif">${esc(d.spec.tokens.fontHeading)}</b><small>Headings</small></div><div class="font"><b style="font-family:'${esc(d.spec.tokens.fontBody)}',sans-serif">${esc(d.spec.tokens.fontBody)}</b><small>Body text</small></div></div>
${T('template-settings', 'Template settings', [{ k: 'setting', label: 'Setting' }, { k: 'value', label: 'Value' }], d.tokens, { limit: 14 })}
<h3>Old pages compared with new pages</h3>
<p>Averages over the ${fmt(total)} updated pages. Fewer files, fewer blocking scripts and smaller HTML make pages load faster; more structured data and social tags help search and sharing.</p>
${pairBars(d.tplFacts.filter((r) => r.measure !== 'Average HTML size (KB)').map((r) => ({ label: r.measure, a: r.before, b: r.after })), { labelW: 330, width: 900 })}
${T('template-compare', 'Technical comparison: original vs new template', [{ k: 'measure', label: 'Measure' }, { k: 'before', label: 'Original', num: true }, { k: 'after', label: 'New template', num: true }, { k: 'change', label: 'Change', num: true, html: (v) => delta(v, '', false) }], d.tplFacts, { limit: 0, note: 'A negative change is an improvement for files, scripts and size; for structured data and Open Graph a positive change is the improvement.' })}
${d.notCarried.length ? `<p class="note">${d.notCarried.length} hand edit(s) changed the structure of one sample page and stay on that page: ${d.notCarried.slice(0, 4).map(esc).join(', ')}.</p>` : ''}</section>`);

  if (A.images) sec.push(`<section id="images"><h2>Images: optimised, WebP, responsive</h2>
<p class="lead">Every image was recompressed or converted to WebP at quality ${esc(d.imageSettings?.quality ?? 80)}, large images were limited to ${esc(d.imageSettings?.maxWidth ?? 1600)}px wide, and smaller copies (${esc((d.imageSettings?.widths || []).join(', '))}px) were created so phones download a smaller file (srcset). Logos, seals and favicons were left untouched. Your original images are in the backup${d.imageBackup?.id ? ` (${esc(d.imageBackup.id)})` : ''}.</p>
<div class="tiles small">${tile('Images optimised', fmt(k.imagesProcessed), `${fmt(k.imagesKept)} kept as they were`)}${tile('Weight before', bytes(k.imageBytesBefore), 'processed images')}${tile('Weight after', bytes(k.imageBytesAfter), `${imgPct}% smaller · ${bytes(imgSaved)} saved`, 'hero')}${tile('Smaller copies', bytes(k.variantBytes), 'for srcset (extra files)')}${tile('References updated', fmt(k.referencesRewritten), `${fmt(k.filesModified)} files`)}${tile('Unused images', fmt(k.unusedFiles), `${bytes(k.unusedBytes)} that no page uses`)}</div>
<div class="two"><div><h4>Image weight</h4>${pairBars([{ label: 'All optimised images', a: k.imageBytesBefore, b: k.imageBytesAfter, aText: bytes(k.imageBytesBefore), bText: bytes(k.imageBytesAfter) }], { width: 520, labelW: 150 })}<h4>On the pages (counted in the final files)</h4>${pairBars([
    { label: 'Images on all pages', a: ip.imgB, b: ip.imgA }, { label: 'JPG/PNG images', a: ip.legacyB, b: ip.legacyA }, { label: 'WebP images', a: ip.webpB, b: ip.webpA }, { label: 'With srcset', a: ip.srcsetB, b: ip.srcsetA }, { label: 'Lazy-loaded (below the fold only)', a: ip.lazyB, b: ip.lazyA }, { label: 'With width and height', a: ip.sizedB, b: ip.sizedA }, { label: 'Missing alt attribute', a: ip.noAltB, b: ip.noAltA }], { width: 520, labelW: 200 })}<p class="note">Before, almost every image was lazy-loaded, including the ones at the top of the page, which delays the first view. After, only images below the fold are lazy and the ones above it load at once.</p></div>
<div><h4>What happened to each image</h4>${donut([
    { label: 'Converted to WebP', v: d.imgEntries.filter((e) => e.action === 'converted').length }, { label: 'Recompressed (already WebP)', v: d.imgEntries.filter((e) => e.action === 'recompressed').length }, { label: 'Kept as it was', v: d.imgEntries.filter((e) => e.action === 'kept').length }], { centre: fmt(d.imgEntries.length), sub: 'images' })}<h4>Biggest savings</h4>${bars(d.imgEntries.slice(0, 8).map((e) => ({ label: e.original.split('/').pop(), v: e.saved, text: `${bytes(e.saved)} (${e.savedPct}%)` })), { width: 520, labelW: 190 })}</div></div>
${T('images-all', 'Every image: before and after', [{ k: 'original', label: 'Original file' }, { k: 'final', label: 'Final file' }, { k: 'action', label: 'Action' }, { k: 'bytesBefore', label: 'Bytes before', num: true }, { k: 'bytesAfter', label: 'Bytes after', num: true }, { k: 'saved', label: 'Saved bytes', num: true }, { k: 'savedPct', label: 'Saved %', num: true }, { k: 'widthBefore', label: 'Width before', num: true }, { k: 'heightBefore', label: 'Height before', num: true }, { k: 'width', label: 'Width after', num: true }, { k: 'height', label: 'Height after', num: true }, { k: 'smallerCopies', label: 'Smaller copies', num: true }, { k: 'smallerCopyWidths', label: 'Copy widths' }, { k: 'smallerCopiesBytes', label: 'Copies bytes', num: true }], d.imgEntries, { limit: 12 })}
${T('images-references', 'Files whose image references were updated', [{ k: 'file', label: 'File' }, { k: 'referencesRewritten', label: 'References rewritten', num: true }], d.imgModified, { limit: 10, note: 'Every reference to a renamed or converted image (src, srcset, CSS backgrounds, schema, social tags) was rewritten so nothing points at a missing file.' })}
${T('images-unused', 'Images no page uses', [{ k: 'file', label: 'File' }, { k: 'bytes', label: 'Bytes', num: true }], d.unusedImages, { limit: 8, note: 'These files were moved out of the way into the backup folder, not deleted. They can be restored.' })}
${d.preservedImages.length ? T('images-preserved', 'Images left untouched on purpose', [{ k: 'file', label: 'File' }, { k: 'bytes', label: 'Bytes', num: true }, { k: 'references', label: 'References', num: true }, { k: 'status', label: 'Status' }], d.preservedImages, { limit: 0 }) : ''}</section>`);

  if (A.content) sec.push(`<section id="content"><h2>Content: what was updated</h2>
<p class="lead">Mode used: <b>${esc(cap(d.contentMode))}</b>${d.contentMode === 'enhance' ? ' (the same meaning, facts and numbers, with clearer and more complete wording)' : d.contentMode === 'rewrite' ? ' (new wording written from the approved business profile)' : ' (the existing wording is kept)'}. Every piece of wording was checked against the approved facts and the “claims to never make” list before it was used.</p>
${d.settingMode !== d.contentMode ? `<p class="note">The Content & build setting is currently “${esc(cap(d.settingMode))}”; this report shows what the pages on the site actually use.</p>` : ''}<div class="two"><div><h4>Wording by mode</h4>${donut(d.modeCount.map((m) => ({ label: cap(m.k), v: m.v })), { centre: fmt(total), sub: 'pages' })}</div><div><h4>Review status</h4>${donut(d.statusCount.map((m) => ({ label: cap(m.k), v: m.v })), { centre: fmt(d.contentRows.length), sub: 'written' })}</div></div>
${T('content-pages', 'Wording by page', [{ k: 'path', label: 'Page' }, { k: 'type', label: 'Type' }, { k: 'mode', label: 'Mode' }, { k: 'status', label: 'Status' }, { k: 'onSite', label: 'Used on the site' }, { k: 'sections', label: 'Sections', num: true }, { k: 'sectionsChanged', label: 'Sections changed', num: true }, { k: 'rejected', label: 'Rejected', num: true }, { k: 'wordsBefore', label: 'Words before', num: true }, { k: 'wordsAfter', label: 'Words after', num: true }, { k: 'reviewNotes', label: 'Review notes', num: true }, { k: 'note', label: 'Notes for review' }, { k: 'cost', label: 'AI cost $', num: true }, { k: 'model', label: 'Model' }], d.contentRows, { limit: 15, note: '“Needs review” means the wording passed the automatic checks but the AI flagged points to confirm (for example a year or a claim that is not in the approved facts).' })}
${T('content-changes', 'Updated content: before and after', [{ k: 'path', label: 'Page' }, { k: 'kind', label: 'Block' }, { k: 'before', label: 'Before' }, { k: 'after', label: 'After' }], d.unitRows, { limit: 10, note: 'Each row is one text section that changed. Long text is shortened on screen; the CSV export has the full text.' })}</section>`);

  sec.push(`<section id="fixes"><h2>What the build fixed automatically</h2>
<p class="lead">These problems are fixed on every page during the build, whatever the wording mode, so the most important SEO checks pass without manual work.</p>
${bars(d.buildFixes.map((f) => ({ label: f.fix, v: f.count })), { labelW: 380, width: 900 })}
${T('build-fixes', 'Automatic fixes made by the build', [{ k: 'fix', label: 'Fix' }, { k: 'count', label: 'Count', num: true }], d.buildFixes, { limit: 0 })}</section>`);

  if ((A.template || A.content)) sec.push(`<section id="cta"><h2>Call-to-action cards</h2>
<p class="lead">Every page now ends with the same clear call-to-action: a heading, a click-to-call button with the approved phone number and a contact button. ${fmt(d.ctaSummary.pagesAfter)} pages have one now, compared with ${fmt(d.ctaSummary.pagesBefore)} before.</p>
${pairBars([{ label: 'Pages with a call-to-action card', a: d.ctaSummary.pagesBefore, b: d.ctaSummary.pagesAfter }], { width: 760, labelW: 250 })}
${T('cta-cards', 'Call-to-action cards: before and after', [{ k: 'path', label: 'Page' }, { k: 'type', label: 'Type' }, { k: 'ctaBefore', label: 'CTA blocks before', num: true }, { k: 'ctaAfter', label: 'CTA blocks after', num: true }, { k: 'titleBefore', label: 'Heading before' }, { k: 'titleAfter', label: 'Heading after' }, { k: 'textBefore', label: 'Text before' }, { k: 'textAfter', label: 'Text after' }, { k: 'buttonsBefore', label: 'Buttons before' }, { k: 'buttonsAfter', label: 'Buttons after' }], d.ctaRows, { limit: 12 })}</section>`);

  if (d.canonical) {
    const c = d.canonical, cp = c.pages || [], n = (...a) => cp.filter((x) => a.includes(x.action)).length;
    const ACTION = { insert: 'Added', replace: 'Fixed', ok: 'Already right', dupes: 'Duplicates removed', keep_foreign: 'Another website (kept)', removed: 'Removed (redirected page)', redirect: 'None (redirected page)', junk: 'Skipped (copy / backup)' };
    const sm = c.sitemap || {}, lk = c.links || { changes: [], findings: [] };
    sec.push(`<section id="canonical"><h2>Canonical tags, links and sitemap</h2>
<p class="lead">Every page declares one canonical address: <b>${esc(c.domain)}</b> plus the page's own path, with the folder address for index pages. A page the site's .htaccess redirects (301, 302) or removes (410) has no canonical.${c.htaccess ? ` The .htaccess was read: ${fmt(c.rules.length)} page rule${c.rules.length === 1 ? '' : 's'} used and ${fmt(c.ignoredRules.length)} site-wide rule${c.ignoredRules.length === 1 ? '' : 's'} ignored.` : ' The site has no .htaccess, so no redirects were checked.'}</p>
<div class="tiles small">${tile('Added', fmt(n('insert')), 'Pages that had none', 'check')}${tile('Fixed', fmt(n('replace', 'dupes')), 'Wrong, relative or duplicate', 'check')}${tile('Already right', fmt(n('ok')), 'Left as they were', 'check')}${tile('Redirected or removed', fmt(n('removed', 'redirect')), 'No canonical', 'check')}${tile('Another website', fmt(n('keep_foreign')), 'Kept, please check', 'check')}</div>
${T('canonical-tags', 'Canonical tag of every page', [{ k: 'path', label: 'Page' }, { k: 'action', label: 'What was done' }, { k: 'old', label: 'Canonical before' }, { k: 'url', label: 'Canonical now' }, { k: 'note', label: 'Note' }, { k: 'rule', label: '.htaccess rule' }], cp.map((x) => ({ ...x, action: ACTION[x.action] || x.action })), { limit: 25 })}
${c.htaccess ? T('htaccess-rules', '.htaccess rules read', [{ k: 'line', label: 'Line', num: true }, { k: 'use', label: 'Used for pages' }, { k: 'rule', label: 'Rule' }, { k: 'why', label: 'Why' }], [...c.rules.map((r) => ({ line: r.line, use: 'Yes: ' + r.kindText, rule: r.raw, why: '' })), ...c.ignoredRules.map((r) => ({ line: r.line, use: 'No', rule: r.raw, why: r.why }))].sort((x, y) => x.line - y.line), { limit: 25 }) : ''}
<h3>Links to redirected pages</h3>
<p class="lead">${fmt(lk.changes.length)} link${lk.changes.length === 1 ? ' was' : 's were'} pointed straight at the final page instead of going through a redirect.${lk.findings.length ? ` ${fmt(lk.findings.length)} more need a look (removed pages, temporary redirects, redirect loops).` : ''}</p>
${T('links-fixed', 'Links pointed at their final page', [{ k: 'page', label: 'Page' }, { k: 'old', label: 'Link before' }, { k: 'new', label: 'Link now' }, { k: 'rule', label: 'Rule' }], lk.changes, { limit: 25 })}
${T('links-to-check', 'Links to check by hand', [{ k: 'page', label: 'Page' }, { k: 'href', label: 'Link' }, { k: 'issue', label: 'Problem' }], lk.findings, { limit: 25 })}
<h3>Sitemap</h3>
<p class="lead">${!sm.found ? `The site has no sitemap.xml. A recommended one with ${fmt(sm.newCount || 0)} pages was prepared.` : sm.error ? esc(sm.error) : `${fmt(sm.entries)} address${sm.entries === 1 ? ' is' : 'es are'} listed: ${fmt(sm.ok)} fine, ${fmt((sm.issues || []).length)} problem${(sm.issues || []).length === 1 ? '' : 's'} found, ${fmt((sm.missing || []).length)} live page${(sm.missing || []).length === 1 ? ' is' : 's are'} missing. A recommended sitemap with ${fmt(sm.newCount || 0)} pages was prepared (it is not written to your website).`} <a href="/api/clients/${esc(d.slug)}/sitemap">Download the recommended sitemap.xml</a></p>
${T('sitemap-issues', 'Sitemap addresses with a problem', [{ k: 'loc', label: 'Address' }, { k: 'issue', label: 'Problem' }], sm.issues || [], { limit: 25 })}
${T('sitemap-missing', 'Live pages missing from the sitemap', [{ k: 'rel', label: 'Page' }, { k: 'url', label: 'Address it should have' }], sm.missing || [], { limit: 25 })}</section>`);
  }

  if ((A.images || A.template)) sec.push(`<section id="performance"><h2>Speed in a real browser</h2>
<p class="lead">${d.browserRows.length ? `${fmt(d.browserRows.length)} sample pages were opened in a real browser (${esc(d.browserProfile)}), original against modernised.` : 'The real-browser test has not been run yet. Press “Test 12 sample pages” on the Validation & Report page, then regenerate this report.'}</p>
${d.browser ? `<div class="tiles small">${tile('Largest content paint', `${fmt(d.browser.lcpBefore)} <i>→</i> ${fmt(d.browser.lcpAfter)} ms`, `${delta(pct(d.browser.lcpBefore - d.browser.lcpAfter, d.browser.lcpBefore), '% faster')}`, 'hero')}${tile('Page weight', `${bytes(d.browser.bytesBefore)} <i>→</i> ${bytes(d.browser.bytesAfter)}`, `${pct(d.browser.bytesBefore - d.browser.bytesAfter, d.browser.bytesBefore)}% lighter`)}${tile('Requests per page', `${fmt(d.browser.requestsBefore)} <i>→</i> ${fmt(d.browser.requestsAfter)}`, 'fewer files to load')}${tile('Layout shift', `${d.browser.clsBefore} <i>→</i> ${d.browser.clsAfter}`, 'lower is better')}</div>
${pairBars([{ label: 'Largest content paint (ms)', a: d.browser.lcpBefore, b: d.browser.lcpAfter }, { label: 'Page weight (KB)', a: Math.round(d.browser.bytesBefore / 1024), b: Math.round(d.browser.bytesAfter / 1024) }, { label: 'Requests per page', a: d.browser.requestsBefore, b: d.browser.requestsAfter }], { labelW: 230 })}` : ''}
${d.browserRows.length ? T('browser-pages', 'Real-browser results by page', [{ k: 'path', label: 'Page' }, { k: 'lcpBefore', label: 'LCP ms before', num: true }, { k: 'lcpAfter', label: 'LCP ms after', num: true }, { k: 'kbBefore', label: 'KB before', num: true }, { k: 'kbAfter', label: 'KB after', num: true }, { k: 'requestsBefore', label: 'Requests before', num: true }, { k: 'requestsAfter', label: 'Requests after', num: true }, { k: 'clsBefore', label: 'CLS before', num: true }, { k: 'clsAfter', label: 'CLS after', num: true }, { k: 'overflow', label: 'Sideways scroll on phone' }, { k: 'accessibility', label: 'Accessibility findings' }], d.browserRows, { limit: 12 }) : ''}</section>`);

  sec.push(`<section id="validation"><h2>Validation</h2>
<p class="lead">${k.validation ? `Validated ${fmt(k.validation.pages)} pages on ${date(k.validatedAt)}: <b>${fmt(k.validation.ready)}</b> ready, <b>${fmt(k.validation.blocked)}</b> blocked, <b>${k.validation.completion}%</b> of ${fmt(k.validation.checksApplicable)} applicable checks pass. Links: ${fmt(k.validation.links.broken)} broken, of which ${fmt(k.validation.links.preExisting)} were already broken on the original site and ${fmt(k.validation.links.newlyBroken)} are new.` : 'Validation has not been run. Press “Run validation” on the Validation & Report page, then regenerate this report.'}</p>
${k.validation ? T('validation-checks', 'Checklist results', [{ k: 'check', label: 'Check' }, { k: 'applicable', label: 'Applies to', num: true }, { k: 'passed', label: 'Passed', num: true }, { k: 'failed', label: 'Failed', num: true }, { k: 'rate', label: 'Pass rate %', num: true }], d.checklist, { limit: 12 }) : ''}
${k.validation ? T('validation-blocked', 'Pages that need attention', [{ k: 'path', label: 'Page' }, { k: 'status', label: 'Status' }, { k: 'reasons', label: 'Why' }], d.blocked, { limit: 12 }) : ''}</section>`);

  sec.push(`<section id="files"><h2>Website files, backup and restore</h2>
<p class="lead">${d.scope.updatedInSite ? `The website folder <code>${esc(d.client.sourceDir)}</code> was updated on ${date(d.scope.appliedAt)}. Nothing has been uploaded anywhere: upload the changed files when you are ready.` : 'The website folder has not been updated yet; the finished pages are in the build folder.'}</p>
<div class="tiles small">${tile('Pages written', fmt(k.pagesUpdated), 'into the website folder')}${tile('Shared files', fmt(k.sharedFiles), 'stylesheet, scripts, fonts, images')}${tile('Not updated', fmt(k.pagesNotUpdated), 'kept exactly as they were')}${tile('Backup', esc(k.backupId || '–'), `${fmt(k.backupFiles)} files · ${bytes(k.backupBytes)}`)}</div>
<p>Restoring is one button (“Restore original files” on the Content & build page): every replaced page returns from its saved copy and every added file is removed. The verified zip backup${k.backupId ? ` (${esc(k.backupId)}.zip, ${bytes(k.backupZipBytes)})` : ''} is a second, independent copy of the complete original site.</p>
${T('files-shared', 'Shared files written to the website folder', [{ k: 'file', label: 'File' }, { k: 'kind', label: 'Type' }, { k: 'result', label: 'Result' }], d.appliedFiles, { limit: 12 })}
${T('files-not-updated', 'Pages left as they were', [{ k: 'path', label: 'Page' }, { k: 'reason', label: 'Reason' }], d.notUpdated, { limit: 12 })}</section>`);

  sec.push(`<section id="cost"><h2>AI use and cost</h2>
<p class="lead">${d.usage ? `${fmt(d.usage.calls)} AI requests, ${fmt(d.usage.input)} words read and ${fmt(d.usage.output)} written (tokens), costing <b>$${n(d.usage.cost).toFixed(2)}</b> for the whole project including design work. The AI only used the approved business profile and the pages’ own text.` : 'No AI usage recorded.'}</p>
${d.costRows.length ? `${bars(d.costRows.slice(0, 10).map((c) => ({ label: cap(c.task), v: c.cost, text: `$${c.cost.toFixed(2)}` })), { labelW: 200 })}${T('cost-tasks', 'AI cost by task', [{ k: 'task', label: 'Task' }, { k: 'cost', label: 'Cost $', num: true }], d.costRows, { limit: 0 })}` : ''}</section>`);

  sec.push(`<section id="method"><h2>How to read this report</h2>
<ul class="hl"><li><b>Before</b> is the original page: the copy saved before the first update, so it never changes after the site is updated.</li>
<li><b>After</b> is the page as it now stands in ${esc(d.scope.source)}.</li>
<li>The <b>SEO score</b> runs the same ${d.checks.length} checks on both. A check that does not apply to a page (for example a FAQ schema on a page without FAQs) is not counted for it.</li>
<li>“Claims” are checked only against the “Claims to never make” list in the business profile.</li>
<li>Every table has an <b>Export CSV</b> button that downloads all of its rows. The same files are saved in <code>clients/${esc(d.slug)}/reports/csv/</code>.</li>
<li>Use your browser’s Print → Save as PDF to keep a copy.</li></ul>
<p class="note">Report generated ${date(d.generatedAt)}. Pages in this report: ${fmt(total)} of ${fmt(d.scope.sitePages)} scanned.</p></section>`);

  const nav = [['summary', 'Summary'], ['seo', 'SEO score'], ['template', 'Template'], ['images', 'Images'], ['content', 'Content'], ['fixes', 'Auto fixes'], ['cta', 'CTA cards'], ['performance', 'Speed'], ['validation', 'Validation'], ['files', 'Files & backup'], ['cost', 'AI cost'], ['method', 'Method']];
  const data = JSON.stringify(Object.fromEntries(Object.values(tables).map((t) => [t.id, { title: t.title, cols: t.cols.map((c) => ({ k: c.k, label: c.label })), rows: t.rows }]))).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Modernisation report - ${esc(d.client.name)}</title>
<style>${CSS}</style></head><body>
<header class="top"><div><small>Website modernisation report</small><h1>${esc(d.client.name)}</h1><p>${esc(d.client.host)} · generated ${date(d.generatedAt)} · ${fmt(total)} pages compared</p></div><div class="top-actions"><button type="button" id="dl-html-btn" onclick="downloadReportHtml()">Download as HTML</button><button type="button" onclick="window.print()">Print / Save as PDF</button></div></header>
<nav class="toc">${nav.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav>
<main>${sec.join('\n')}</main>
<script type="application/json" id="tdata">${data}</script><script>${JS}</script>${DOWNLOAD_SCRIPT}</body></html>`;
  return { html, csv: Object.fromEntries(Object.values(tables).map((t) => [t.id, csvOf(t)])) };
}

const CSS = `
:root{--bg:#f4f7f8;--card:#fff;--ink:#14262b;--mute:#5b6f75;--line:#dbe4e7;--a:#0f8f86;--a2:#0b6f68;--before:#a3b1b8;--good:#0e9f6e;--bad:#d64545;--warn:#d98a0b;--soft:#eaf3f3}
@media (prefers-color-scheme:dark){:root{--bg:#0f1a1d;--card:#16262a;--ink:#e6f0f1;--mute:#93a9ae;--line:#274248;--a:#2bc4b6;--a2:#6fe0d4;--before:#5f747b;--soft:#1b3237}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
.top{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-end;padding:34px max(20px,calc((100% - 1180px)/2)) 22px;background:linear-gradient(135deg,#0b5f63,#0f8f86 60%,#33b3a0);color:#fff}
.top small{opacity:.85;letter-spacing:.08em;text-transform:uppercase;font-weight:700}.top h1{margin:.1em 0;font-size:clamp(26px,4vw,40px)}.top p{margin:0;opacity:.9}
button{font:inherit;cursor:pointer}.top-actions button{background:#fff;color:#0b5f63;border:0;border-radius:999px;padding:9px 18px;font-weight:700}
.toc{position:sticky;top:0;z-index:5;display:flex;gap:4px;overflow-x:auto;padding:8px max(20px,calc((100% - 1180px)/2));background:var(--card);border-bottom:1px solid var(--line)}
.toc a{white-space:nowrap;text-decoration:none;color:var(--mute);font-weight:600;font-size:13px;padding:6px 12px;border-radius:999px}.toc a:hover{background:var(--soft);color:var(--a2)}
main{max-width:1180px;margin:0 auto;padding:10px 20px 60px}section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:26px 28px;margin:22px 0;box-shadow:0 10px 30px -22px rgba(0,0,0,.35)}
h2{margin:0 0 6px;font-size:24px}h3{margin:26px 0 8px;font-size:18px}h4{margin:14px 0 6px;font-size:14px;color:var(--mute);text-transform:uppercase;letter-spacing:.04em}.lead{color:var(--mute);max-width:900px;margin:0 0 18px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:14px 0 8px}.tile{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:var(--soft)}.tile small{display:block;color:var(--mute);font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.05em}
.tile b{display:block;font-size:26px;line-height:1.2;margin:4px 0}.tile b i{font-style:normal;color:var(--mute);font-size:.7em}.tile span{color:var(--mute);font-size:13px}.tile.hero{background:linear-gradient(135deg,#0f8f86,#0b6f68);border:0}.tile.hero *{color:#fff!important}
.tiles.small .tile b{font-size:21px}.hl{padding-left:20px}.hl li{margin:7px 0}.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:22px;align-items:start}
.chart{width:100%;height:auto;max-width:100%}.c-lab{font:12px system-ui;fill:var(--mute)}.c-val{font:700 12px system-ui;fill:var(--ink)}.c-big{font:800 26px system-ui;fill:var(--ink)}.c-axis{stroke:var(--line)}
.c-before{fill:var(--before)}.c-after{fill:var(--a)}.c-p0{background:#0f8f86}.c-p1{background:#e47229}.c-p2{background:#5b6bd6}.c-p3{background:#d64f87}.c-p4{background:#c8a21a}.c-p5{background:#7a8c93}
.c-p0s{stroke:#0f8f86}.c-p1s{stroke:#e47229}.c-p2s{stroke:#5b6bd6}.c-p3s{stroke:#d64f87}.c-p4s{stroke:#c8a21a}.c-p5s{stroke:#7a8c93}
.donut{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.legend{list-style:none;margin:0;padding:0;display:grid;gap:6px}.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px}.legend small{color:var(--mute)}
.tbl{margin:20px 0}.tbl-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.tbl-bar h4{margin:0;text-transform:none;font-size:15px;color:var(--ink);letter-spacing:0}.tbl-bar small{color:var(--mute);font-weight:500}
.tbl-bar input{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;margin-right:8px;width:160px}.tbl-bar button,.show-all{background:var(--soft);color:var(--a2);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-weight:700}
.show-all{margin-top:8px}.scroll{overflow:auto;max-height:560px;border:1px solid var(--line);border-radius:12px;margin-top:8px}table{border-collapse:collapse;width:max-content;min-width:100%;font-size:13px}
th{position:sticky;top:0;background:var(--soft);text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;z-index:1}td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top;max-width:340px;min-width:70px;overflow-wrap:break-word}td:first-child{min-width:150px}
tr:hover td{background:var(--soft)}.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.empty{text-align:center;color:var(--mute);padding:20px}
.sc{display:inline-block;min-width:34px;text-align:center;border-radius:8px;padding:1px 6px;font-weight:800;color:#fff}.sc.g{background:var(--good)}.sc.m{background:var(--warn)}.sc.l{background:var(--bad)}
.dg{color:var(--good);font-weight:700}.db{color:var(--bad);font-weight:700}.d0{color:var(--mute)}.note{color:var(--mute);font-size:13px;margin:6px 0}code{background:var(--soft);padding:1px 6px;border-radius:6px;font-size:.9em}
.swatches{display:flex;flex-wrap:wrap;gap:12px;margin:10px 0 14px}.swatches>div{display:grid;gap:2px;min-width:110px;border:1px solid var(--line);border-radius:12px;padding:10px}.swatches i{height:34px;border-radius:8px;border:1px solid var(--line)}.swatches b{font-size:13px}.swatches small{color:var(--mute)}.swatches .font b{font-size:20px}
@page{size:A4 landscape;margin:10mm}@media print{.toc,.top-actions,.tbl-bar span,.show-all{display:none}body{background:#fff;color:#000}section{box-shadow:none}.scroll{max-height:none;overflow:visible;border:0}table{width:100%;min-width:0;font-size:8pt}th,td{white-space:normal;max-width:none;min-width:0;overflow-wrap:anywhere;word-break:break-word;padding:3px 4px}th{position:static}.num{white-space:normal}thead{display:table-header-group}tr{break-inside:avoid}.more{display:table-row!important}.top{color:#000;background:#fff;border-bottom:2px solid #0f8f86}}
`;

const JS = `
const D = JSON.parse(document.getElementById('tdata').textContent);
const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-csv]');
  if (b) {
    const t = D[b.dataset.csv];
    const text = '\\ufeff' + [t.cols.map((c) => q(c.label)).join(','), ...t.rows.map((r) => t.cols.map((c) => q(r[c.k])).join(','))].join('\\r\\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = b.dataset.csv + '.csv';
    document.body.append(a); a.click(); a.remove();
    return;
  }
  const s = e.target.closest('[data-all]');
  if (s) { document.querySelectorAll('#t-' + s.dataset.all + ' tr.more').forEach((r) => { r.hidden = false; r.classList.remove('more'); }); s.remove(); return; }
  const th = e.target.closest('th[data-k]');
  if (th) {
    const body = th.closest('table').tBodies[0], idx = [...th.parentNode.children].indexOf(th), dir = th.dataset.dir === 'asc' ? -1 : 1;
    th.parentNode.querySelectorAll('th').forEach((x) => delete x.dataset.dir); th.dataset.dir = dir === 1 ? 'asc' : 'desc';
    const val = (r) => { const t = r.children[idx].textContent.trim().replace(/,/g, ''); const n = parseFloat(t); return Number.isNaN(n) || !/^[-+]?[\\d.]/.test(t) ? t.toLowerCase() : n; };
    const rows = [...body.rows].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
    rows.forEach((r) => body.append(r));
  }
});
document.addEventListener('input', (e) => {
  const i = e.target.closest('.tbl-bar input'); if (!i) return;
  const wrap = i.closest('.tbl'), needle = i.value.toLowerCase();
  wrap.querySelectorAll('tbody tr').forEach((r) => { const hit = !needle || r.textContent.toLowerCase().includes(needle); r.hidden = !hit && true; if (hit && !needle && r.classList.contains('more')) r.hidden = true; });
  if (needle) wrap.querySelectorAll('tbody tr').forEach((r) => { if (r.textContent.toLowerCase().includes(needle)) r.hidden = false; });
});
`;
