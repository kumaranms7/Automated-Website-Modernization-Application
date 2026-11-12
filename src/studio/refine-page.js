import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { callTool } from '../ai/claude.js';
import { clientDir } from '../config.js';
import { normalizeSpec, normalizeTweaks, normalizeSections, normalizePageLayout, safeSectionCss, PAGE_LAYOUT_KEYS, OPTIONS } from '../template/spec.js';
import { HEADER_STYLES, FOOTER_STYLES } from '../template/section-meta.js';
import { missingTailwindClasses } from '../template/tw-check.js';
import { specOf } from './variants.js';
import { canvasHtml, portalOrigin } from './canvas.js';
import { inspectPage } from './shots.js';
import { homeContent } from './home.js';
import { pageImages } from '../template/design.js';
import { newId } from './files.js';
import { TOOL, SYSTEM, sectionHtml, tailwindGate, vetOps, opLine } from './refine.js';
import { normalizeOps } from '../template/html-ops.js';

// AI refinement for the inner page and the contact page. Their content is whatever the page says, so they are not rebuilt from
// reusable sections; instead the AI changes the page's layout options, adds Tailwind classes to parts of one section (aimed with
// the section's real HTML), sets section extras (columns, an image beside the text, a background) or, last of all, adds scoped
// CSS. Every proposal is drawn again and checked before it is shown, and nothing applies until the user accepts it.

export async function proposePageChange(slug, { slot, spec: design, page, sectionId, instruction }) {
  if (!['inner', 'contact'].includes(slot)) throw new Error('Unknown page layout');
  if (!instruction.trim()) throw new Error('Describe the change you want');
  const base = await specOf(slug, { spec: design || {}, page });
  const isHeader = sectionId === 'header', isFooter = sectionId === 'footer', whole = sectionId === 'page';
  const num = /^s\d+$/.test(sectionId) ? Number(sectionId.slice(1)) : 0;
  if (!isHeader && !isFooter && !whole && !num) throw new Error('Select a section first');
  const scopeSel = whole ? '' : `[data-sec="${sectionId}"]`;

  const before = await canvasHtml(slug, base, { origin: portalOrigin(), editor: false, slot });
  const tmp = path.join(clientDir(slug), 'studio', 'tmp', newId('t'));
  let image = null;
  try {
    const shot = await inspectPage({ html: before.html, outDir: tmp, ids: whole ? [] : [sectionId], measure: false, coverName: '_page' });
    const f = whole ? '_page' : sectionId;
    if (whole || shot.thumbs[sectionId]) image = (await fs.readFile(path.join(tmp, `${f}.jpg`))).toString('base64');
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
  const markup = whole ? '' : sectionHtml(before.html, sectionId);

  const $ = cheerio.load(before.html);
  const outline = $('main > [data-sec]').toArray().map((n) => `${$(n).attr('data-sec')}: ${$(n).find('h1,h2,h3').first().text().replace(/\s+/g, ' ').trim().slice(0, 60) || '(no heading)'}`).join('\n');
  let images = '';
  try { images = (await pageImages(slug, (await homeContent(slug)).path)).split('\n').slice(1).join('\n').trim(); } catch { /* optional */ }

  const mine = (base.tweaks || []).filter((t) => t.selector.includes(scopeSel || '\u0000') && t.layout === (isHeader || isFooter ? 'all' : slot));
  const keys = PAGE_LAYOUT_KEYS[slot];
  const eff = { ...base.layout, ...(base.pageLayout?.[slot] || {}) };
  const intro = [
    `You are changing the ${slot === 'inner' ? 'INNER PAGE (service, location and content pages)' : 'CONTACT PAGE'} layout of the site design. The page is drawn from the page's own content; you cannot add or remove content.`,
    whole ? 'Selected: the whole page.' : isHeader || isFooter ? `Selected: the ${sectionId} (shared by every page).` : `Selected: section ${sectionId} of this page.`,
    `Page layout options now (you may set these for the whole ${slot} page): ${keys.map((k) => `${k} = ${eff[k]} [${OPTIONS_TEXT(k)}]`).join('; ')}.`,
    isHeader ? `Header styles: ${HEADER_STYLES.join('|')} (change those on the home composer; here use class tweaks only).` : isFooter ? `Footer styles: ${FOOTER_STYLES.join('|')} (use class tweaks only here).` : '',
    mine.length ? `Class tweaks already on this section: ${mine.map((t) => `${t.selector} +[${t.add.join(' ')}] -[${t.remove.join(' ')}]`).join('; ')}.` : '',
    `PAGE SECTIONS (id: heading):\n${outline}`,
    markup ? `SECTION HTML (copy selectors from it; selectors are matched inside the section, "section" is the section itself):\n${markup}` : whole ? 'For a whole-page request prefer the page layout options; for class tweaks you may use a selector that starts with the section id, written as [data-sec="s2"] h2.' : '',
    images ? `IMAGES ON THE SITE (for extra.image):\n${images}` : '',
    `User request: ${instruction}`,
  ].filter(Boolean).join('\n\n');
  const content = [{ type: 'text', text: intro }];
  if (image) content.push({ type: 'text', text: whole ? 'The page as it looks now (top of the page):' : 'The section as it looks now:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });

  const first = await callTool({ slug, label: 'studio-refine-page', tool: TOOL, maxTokens: 2500, system: SYSTEM, userContent: content });
  let a = first.input, cost = first.cost || 0;
  const gated = await tailwindGate({ slug, label: 'studio-refine-page', content, a, cost });
  a = gated.a; cost = gated.cost;

  const fragment = cheerio.load(markup || '<section></section>', null, false);
  const matches = (selector) => { try { return !markup || selector.trim() === 'section' || fragment.root().find(selector).length > 0; } catch { return false; } };
  const check = async (input) => {
    const t = normalizeTweaks(input.tweaks);
    return { t, noMatch: t.filter((x) => !matches(x.selector)).map((x) => x.selector), badClasses: await missingTailwindClasses(t.flatMap((x) => x.add)).catch(() => []) };
  };
  let chk = await check(a);
  if (chk.noMatch.length || chk.badClasses.length) {
    const problems = [chk.noMatch.length && `These selectors match nothing inside the section: ${chk.noMatch.join(' | ')}.`, chk.badClasses.length && `These Tailwind classes give no CSS: ${chk.badClasses.join(', ')}.`].filter(Boolean).join('\n');
    const again = await callTool({ slug, label: 'studio-refine-page-fix', tool: TOOL, maxTokens: 2500, system: SYSTEM, userContent: [...content, { type: 'text', text: `YOUR PREVIOUS ANSWER:\n${JSON.stringify(a)}\n\n${problems}\nReturn the complete answer again with these fixed.` }] });
    a = again.input; cost += again.cost || 0; chk = await check(a);
  }
  const dropped = gated.note ? [gated.note] : [];
  const bad = new Set(chk.badClasses);
  const tweaks = chk.t.filter((x) => { if (!matches(x.selector)) { dropped.push(`selector "${x.selector}" matches nothing`); return false; } return true; })
    .map((x) => ({ ...x, add: x.add.filter((c) => { if (bad.has(c)) { dropped.push(c); return false; } return true; }) }))
    .filter((x) => x.add.length || x.remove.length);

  const vet = await vetOps(a, markup);
  dropped.push(...vet.dropped);

  // the candidate: new values for the parts of the spec that change
  const changes = [];
  const patch = {};
  const layoutScope = isHeader || isFooter ? 'all' : slot;
  let ops = [...(base.ops || [])], tw = [...(base.tweaks || [])], secs = [...(base.sections || [])], css = base.customCss || '';
  if (a.resetStyling && scopeSel) {
    tw = tw.filter((t) => !(t.selector.includes(scopeSel) && t.layout === layoutScope));
    ops = ops.filter((o) => !(o.selector.includes(scopeSel) && o.layout === layoutScope));
    secs = secs.filter((x) => !(x.layout === slot && x.index === num));
    changes.push('Earlier changes to this section cleared');
  }
  if (tweaks.length) {
    const here = layoutScope === 'all' ? {} : { file: before.path }; // a change to a numbered section belongs to the page it was made on
    const scoped = tweaks.map((t) => ({ ...t, ...here, layout: layoutScope, selector: t.selector.trim() === 'section' ? (scopeSel || 'main > section') : scopeSel && !t.selector.includes('data-sec') ? `${scopeSel} ${t.selector}` : t.selector }));
    tw = [...tw, ...scoped];
    tweaks.forEach((t) => changes.push(`${t.selector === 'section' ? 'Section' : t.selector}: ${[t.add.length && '+' + t.add.join(' +'), t.remove.length && '-' + t.remove.join(' -')].filter(Boolean).join(' ')}`));
  }
  if (vet.ops.length) {
    const scopeOp = (sel) => (sel.trim() === 'section' ? (scopeSel || 'main > section') : scopeSel && !sel.includes('data-sec') ? `${scopeSel} ${sel}` : sel);
    ops = [...ops, ...vet.ops.map((o) => ({ ...o, ...(layoutScope === 'all' ? {} : { file: before.path }), layout: layoutScope, selector: scopeOp(o.selector), ...(o.target ? { target: scopeOp(o.target) } : {}) }))];
    vet.ops.forEach((o) => changes.push(opLine(o)));
  }
  if (a.extra && typeof a.extra === 'object' && num) {
    const e = { ...(secs.find((x) => x.layout === slot && x.index === num) || {}) };
    if (a.extra.image?.src) a.extra.image = { ...a.extra.image, src: String(a.extra.image.src).replace(/^\/+/, '') };
    for (const k of ['columns', 'align', 'background', 'image']) if (a.extra[k]) { e[k] = a.extra[k]; changes.push(k === 'image' ? 'Image beside the text' : k === 'columns' ? `${a.extra[k]} columns` : `${k}: ${a.extra[k]}`); }
    secs = normalizeSections([...secs.filter((x) => !(x.layout === slot && x.index === num)), { ...e, layout: slot, index: num, file: before.path }]);
  }
  if (a.customCss && a.customCss.trim()) {
    const safe = safeSectionCss(a.customCss);
    if (safe) { css = [css, `body[data-layout="${slot}"][data-page="${before.path}"] ${scopeSel || 'main'} { ${safe} }`].filter(Boolean).join('\n'); changes.push('Custom CSS, because Tailwind cannot do this: ' + String(a.customCssReason || '').slice(0, 120)); }
  }
  let pl = base.pageLayout;
  if (a.pageLayout && typeof a.pageLayout === 'object') {
    const pick = Object.fromEntries(Object.entries(a.pageLayout).filter(([k, v]) => keys.includes(k) && eff[k] !== v));
    if (Object.keys(pick).length) { pl = normalizePageLayout({ ...base.pageLayout, [slot]: { ...(base.pageLayout?.[slot] || {}), ...pick } }); Object.entries(pick).forEach(([k, v]) => changes.push(`${slot} page ${k}: ${v}`)); }
  }
  const candSpec = normalizeSpec({ ...base, tweaks: tw, sections: secs, customCss: css, pageLayout: pl, ops: normalizeOps(ops) }, base);
  Object.assign(patch, { ops: candSpec.ops, tweaks: candSpec.tweaks, sections: candSpec.sections, customCss: candSpec.customCss, pageLayout: candSpec.pageLayout });

  let rejected = '';
  if (changes.length) {
    const after = await canvasHtml(slug, candSpec, { origin: '', editor: false, slot });
    const failsBefore = new Set((before.result.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg));
    const introduced = (after.result.checks || []).filter((c) => c.level === 'fail' && !failsBefore.has(c.msg));
    if (introduced.length) rejected = `This change would remove original content (${introduced[0].msg}), so it was not proposed.`;
  }
  const notes = [a.cannotDo, ...dropped.map((d) => `Left out: ${d}`)].filter((x) => x && String(x).trim()).map((x) => String(x).slice(0, 200));
  const ok = !rejected && changes.length;
  return {
    sectionId, slot,
    explanation: String(a.explanation || (changes.length ? '' : 'I could not find a change that fits that request. Try describing what it should look like instead.')).slice(0, 500),
    cannotDo: notes.join('; ').slice(0, 400), changes, page: null, patch: ok ? patch : null, rejected, cost,
  };
}

function OPTIONS_TEXT(k) { return (OPTIONS[k] || []).join('|'); }
