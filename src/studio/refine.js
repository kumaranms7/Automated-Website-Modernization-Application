import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { callTool } from '../ai/claude.js';
import { clientDir } from '../config.js';
import { normalizePage, normalizeSpec, normalizeTweaks, OPTIONS, PAGE_LAYOUT_KEYS } from '../template/spec.js';
import { normalizeOps, applyHtmlOps, classesIn, OP_NAMES } from '../template/html-ops.js';
import { SECTION_TYPES, SECTION_PROPS, PROPS_FOR, HEADER_STYLES, FOOTER_STYLES, typeOfRef } from '../template/section-meta.js';
import { missingTailwindClasses } from '../template/tw-check.js';
import { specOf } from './variants.js';
import { canvasHtml, portalOrigin } from './canvas.js';
import { inspectPage } from './shots.js';
import { homeContent } from './home.js';
import { pageImages } from '../template/design.js';
import { newId } from './files.js';

// "Make this hero more premium", "put the image on the left", "make the cards bigger": the AI answers for ONE section.
// It has three tools, used in this order of preference:
//   1. the section's layout style and design properties (a fixed, safe list),
//   2. Tailwind utility classes added to or removed from parts of the section (any layout or spacing change),
//   3. a little scoped CSS, only for what Tailwind cannot express.
// It also sees the section's real HTML, so it can aim its changes precisely. Every proposal is drawn again and checked before
// the user sees it (classes must exist, selectors must match, no original content may disappear). Nothing is applied until the
// user accepts it.

const enumOf = (list) => ({ type: 'string', enum: list.map(String) });
export const TOOL = {
  name: 'propose_section_change',
  description: 'Propose changes for the selected section only.',
  input_schema: {
    type: 'object',
    properties: {
      explanation: { type: 'string', description: 'One or two plain sentences to the user: what you changed and why, or what you need to know if the request is unclear.' },
      variant: { type: 'string', description: 'The layout style for this section (must be one of the allowed styles).' },
      props: { type: 'object', properties: Object.fromEntries(Object.entries(SECTION_PROPS).map(([k, list]) => [k, enumOf(list)])) },
      matchTheme: { type: 'boolean', description: 'true to make the section follow the page theme (colours, fonts) instead of its own look.' },
      content: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' }, buttonText: { type: 'string' } }, description: 'Only when the user asked to change wording.' },
      headerStyle: enumOf(HEADER_STYLES), footerStyle: enumOf(FOOTER_STYLES),
      tweaks: {
        type: 'array',
        description: 'Tailwind utility classes to add to or remove from elements INSIDE the section. This is the main way to change layout, size, spacing, alignment, colour, borders and effects.',
        items: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'A CSS selector matched inside the section, copied from the section HTML you were given (tag, class, :nth-child). Use "section" for the section element itself.' },
            add: { type: 'array', items: { type: 'string' }, description: 'Tailwind classes to add, e.g. "grid-cols-4", "py-20", "text-center", "bg-brand", "rounded-card".' },
            remove: { type: 'array', items: { type: 'string' }, description: 'Classes to remove from those elements (only classes that are really there).' },
          },
          required: ['selector'],
        },
      },
      extra: {
        type: 'object',
        description: 'Structural options for the whole section.',
        properties: {
          columns: { type: 'integer', enum: [2, 3], description: 'Flow the section text into this many columns.' },
          align: { type: 'string', enum: ['center'] },
          background: { type: 'string', enum: ['white', 'soft', 'dark', 'brand'] },
          image: {
            type: 'object', description: 'Put one of the site images beside the text. Take src ONLY from the images list.',
            properties: { src: { type: 'string' }, alt: { type: 'string' }, side: { type: 'string', enum: ['left', 'right'] }, width: { type: 'string', enum: ['half', 'third'] } },
            required: ['src'],
          },
        },
      },
      htmlOps: {
        type: 'array',
        description: 'STRUCTURE changes that Tailwind classes cannot make, applied to the section markup: wrap elements in a container (for example to put two blocks side by side), unwrap, insert decorative markup (dividers, spacers, icon wrappers; never new copy), change a tag, or move an element. Use these to make the structure fit the layout you want, then style with tweaks.',
        items: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector matched inside the section, copied from the section HTML.' },
            op: { type: 'string', enum: OP_NAMES },
            html: { type: 'string', description: 'For wrap, before, after, prepend and append. For wrap: ONE element, for example <div class="grid gap-8 md:grid-cols-2"></div>. Put Tailwind classes in it. No scripts, forms or text copy.' },
            tag: { type: 'string', description: 'For op tag: the new tag name.' },
            target: { type: 'string', description: 'For move-before and move-after: selector of the element to move next to.' },
          },
          required: ['selector', 'op'],
        },
      },
      customCssReason: { type: 'string', description: 'Required only if customCss is used: which declaration, and why no Tailwind class, arbitrary value, arbitrary property, arbitrary variant or htmlOps structure change can do it.' },
      customCss: { type: 'string', description: 'FORBIDDEN unless Tailwind truly cannot do it. LAST RESORT, only for what Tailwind classes cannot do. Rules for this section, where & is the section, e.g. "& h2 { letter-spacing: .08em } & .card { clip-path: polygon(0 0, 100% 0, 100% 90%, 0 100%) }". No @import, no remote URLs.' },
      resetStyling: { type: 'boolean', description: 'true to first discard the earlier class tweaks, extras and custom CSS of this section (when the user wants to start over).' },
      pageLayout: {
        type: 'object',
        description: 'Only for the inner and contact pages: layout options for the WHOLE page (every page of that kind), such as the hero style, whether the inner page has a sidebar, where its form sits, or the contact layout.',
        properties: Object.fromEntries([...new Set(Object.values(PAGE_LAYOUT_KEYS).flat())].map((k) => [k, enumOf(OPTIONS[k])])),
      },
      cannotDo: { type: 'string', description: 'Only a part of the request that is truly impossible (for example new content that is not on the site). Leave empty otherwise.' },
    },
    required: ['explanation'],
  },
};

export const SYSTEM = `You are a senior web designer and front-end engineer refining ONE section of a website home page, working with Tailwind CSS.
You may change the layout, spacing, sizes, alignment, colours, borders, shadows and arrangement of the section freely, as long as every original heading, paragraph, list, link, image and form stays on the page and visible. Never hide content (no hidden, invisible, opacity-0, display:none).
Preference order: (1) the style and property choices, (2) Tailwind classes through tweaks (aim them with selectors taken from the section HTML). Tailwind covers almost everything: arbitrary values (tracking-[.08em], w-[22rem]), arbitrary properties ([clip-path:polygon(0_0,100%_0,100%_90%,0_100%)]), arbitrary variants ([&_h2]:tracking-widest, group-hover:), gradients, grid and flex, aspect ratios, filters. (3) htmlOps when the structure must change first (wrap two blocks in a grid, move an image, change a tag). (4) customCss ONLY for a declaration that none of these can express, and then customCssReason is mandatory. Never use customCss for spacing, colour, size, alignment, borders, shadows, typography, grid or flex.
Tailwind v4 is available with the usual utilities and responsive prefixes (sm:, md:, lg:). Theme colours are: brand, brand-dark, accent, brand-text, accent-text, ink, soft (for example bg-brand, text-accent, border-brand/30). Also rounded-card, rounded-btn, shadow-card, font-display.
Do not invent claims, awards, numbers or links. Make real, visible changes that match the request; do not return an empty answer. If the request is vague, make the most reasonable interpretation and say what you did.`;

// the section as drawn now, trimmed so the model can read its structure
export function sectionHtml(html, id) {
  const $ = cheerio.load(html);
  const node = $(`[data-sec="${id}"]`).first();
  if (!node.length) return '';
  const c = cheerio.load($.html(node), null, false);
  c('svg').each((_, n) => { c(n).replaceWith('<svg></svg>'); });
  c('[style]').removeAttr('style'); c('[srcset]').removeAttr('srcset'); c('script,style').remove();
  c('img').each((_, n) => { const a = c(n); a.attr('src', (a.attr('src') || '').split('/').pop()); });
  return c.html().replace(/\s+/g, ' ').slice(0, 7000);
}

// Tailwind first, enforced: an answer that contains custom CSS is sent back once to be redone with classes and structure. The CSS
// survives only if the second answer still needs it and says exactly why.
export async function tailwindGate({ slug, label, content, a, cost }) {
  if (!String(a.customCss || '').trim()) return { a, cost, note: '' };
  const again = await callTool({ slug, label: label + '-tailwind', tool: TOOL, maxTokens: 2500, system: SYSTEM, userContent: [...content, { type: 'text', text: `YOUR PREVIOUS ANSWER:
${JSON.stringify(a)}

It contains custom CSS. The rule is Tailwind first: custom CSS is not allowed when Tailwind can do it. Redo the whole answer with every part of that CSS expressed as Tailwind classes in tweaks (utilities, arbitrary values, arbitrary properties like [clip-path:...], arbitrary variants like [&_h2]:tracking-widest) and, where the structure is in the way, as htmlOps. Return customCss empty. Keep a declaration in customCss only if it is truly impossible in Tailwind, and then explain exactly why in customCssReason.` }] });
  const b = again.input;
  cost = (cost || 0) + (again.cost || 0);
  if (String(b.customCss || '').trim() && String(b.customCssReason || '').trim().length < 25) return { a: { ...b, customCss: '' }, cost, note: 'Custom CSS was not used because Tailwind classes can do this' };
  return { a: b, cost, note: '' };
}

// structure operations from the AI: kept only when their selectors match, with unknown Tailwind classes removed from inserted markup
export async function vetOps(input, markup) {
  const fragment = cheerio.load(markup || '<section></section>', null, false);
  const dropped = [];
  const ops = normalizeOps(input.htmlOps).filter((o) => {
    let hit = true;
    try { hit = !markup || o.selector.trim() === 'section' || fragment.root().find(o.selector).length > 0; } catch { hit = false; }
    if (!hit) dropped.push('structure change on "' + o.selector + '" (matches nothing)');
    return hit;
  });
  const bad = await missingTailwindClasses(ops.flatMap((o) => classesIn(o.html))).catch(() => []);
  const badSet = new Set(bad);
  bad.forEach((c) => dropped.push(c));
  const clean = ops.map((o) => (o.html ? { ...o, html: o.html.replace(/\bclass="([^"]*)"/g, (m, c) => 'class="' + c.split(/\s+/).filter((x) => x && !badSet.has(x)).join(' ') + '"') } : o));
  return { ops: clean, dropped };
}
export const opLine = (o) => ({ wrap: 'Wrap', unwrap: 'Unwrap', before: 'Insert before', after: 'Insert after', prepend: 'Insert at start of', append: 'Insert at end of', tag: 'Change tag of', 'move-before': 'Move', 'move-after': 'Move' }[o.op] + ' ' + (o.selector === 'section' ? 'the section' : o.selector) + (o.tag ? ' to <' + o.tag + '>' : '') + (o.target ? ' (next to ' + o.target + ')' : ''));

const describe = (cur) => [
  cur.tweaks?.length ? `Class tweaks now: ${cur.tweaks.map((t) => `${t.selector} +[${t.add.join(' ')}] -[${t.remove.join(' ')}]`).join('; ')}.` : '',
  cur.extra && (cur.extra.columns || cur.extra.image || cur.extra.background || cur.extra.align) ? `Extras now: ${JSON.stringify({ columns: cur.extra.columns, align: cur.extra.align, background: cur.extra.background, image: cur.extra.image })}.` : '',
  cur.css ? `Custom CSS now: ${cur.css}` : '',
  cur.ops?.length ? `Structure changes now: ${cur.ops.map(opLine).join('; ')}.` : '',
  cur.html ? 'This section was hand-edited as raw HTML; the SECTION HTML below is that version.' : '',
].filter(Boolean).join('\n');

export async function proposeChange(slug, { page, spec: design, sectionId, instruction }) {
  if (!instruction.trim()) throw new Error('Describe the change you want');
  const base = await specOf(slug, { spec: design || {}, page });
  const pg = base.page;
  const isHeader = sectionId === 'header', isFooter = sectionId === 'footer';
  const sec = pg.sections.find((s) => s.id === sectionId);
  if (!sec && !isHeader && !isFooter) throw new Error('Select a section first');
  const type = sec ? typeOfRef(sec.ref) : sectionId;
  const meta = SECTION_TYPES[type];
  const allowed = sec ? PROPS_FOR[type] || [] : [];
  const styles = sec ? meta.variant : isHeader ? HEADER_STYLES : FOOTER_STYLES;

  // a picture and the markup of the section as it is now
  const tmp = path.join(clientDir(slug), 'studio', 'tmp', newId('t'));
  let image = null;
  const before = await canvasHtml(slug, base, { origin: portalOrigin(), editor: false });
  try {
    const shot = await inspectPage({ html: before.html, outDir: tmp, ids: [sectionId], measure: false });
    if (shot.thumbs[sectionId]) image = (await fs.readFile(path.join(tmp, `${sectionId}.jpg`))).toString('base64');
  } finally { await fs.rm(tmp, { recursive: true, force: true }); }
  const markup = sectionHtml(before.html, sectionId);

  // the site's own images, so "add the van photo" has real files to choose from
  let images = '';
  try { images = (await pageImages(slug, (await homeContent(slug)).path)).split('\n').slice(1).join('\n').trim(); } catch { /* the list is optional */ }

  const current = sec ? `Selected section: ${meta.label} (${sec.ref}). Style now: ${sec.variant || base.layout.hero}. Properties now: ${Object.entries(sec.props).map(([k, v]) => `${k}: ${v}`).join(', ')}. Theme: ${sec.adapt === 'own' ? 'keeps its own look' : 'follows the page theme'}.\n${describe(sec)}`
    : `Selected: the ${sectionId}. Style now: ${pg[sectionId]?.variant || base.layout[sectionId]}. For the ${sectionId} you can change its style and add Tailwind class tweaks (selectors are matched inside it); extras and customCss do not apply.`;
  const rules = [
    `Allowed styles for this section: ${styles.join(', ') || '(none)'}.`,
    sec ? `Properties you may set: ${allowed.filter((p) => p !== 'variant').join(', ') || '(none)'}. Values: ${Object.entries(SECTION_PROPS).filter(([k]) => allowed.includes(k)).map(([k, v]) => `${k} = ${v.join('|')}`).join('; ')}.` : '',
    'Change only the selected section, and only what the request needs. Keep the wording unless the user asks to change it.',
  ].filter(Boolean).join('\n');
  const intro = `${current}\n${rules}\n\nSECTION HTML (what you are changing; copy selectors and existing classes from it):\n${markup || '(not available)'}\n\n${images ? `IMAGES ON THE SITE (for extra.image):\n${images}\n\n` : ''}User request: ${instruction}`;
  const content = [{ type: 'text', text: intro }];
  if (image) content.push({ type: 'text', text: 'The section as it looks now:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });

  const first = await callTool({ slug, label: 'studio-refine', tool: TOOL, maxTokens: 2500, system: SYSTEM, userContent: content });
  let a = first.input;
  let cost = first.cost || 0;
  const gated = await tailwindGate({ slug, label: 'studio-refine', content, a, cost });
  a = gated.a; cost = gated.cost;

  // Tailwind classes must produce CSS and selectors must match something inside the section; one repair round, then drop what is invalid
  const fragment = cheerio.load(markup || '<section></section>', null, false);
  const matches = (selector) => { try { return selector.trim() === 'section' || fragment.root().find(selector).length > 0; } catch { return false; } };
  const check = async (input) => {
    const t = normalizeTweaks(input.tweaks);
    const noMatch = t.filter((x) => markup && !matches(x.selector)).map((x) => x.selector);
    const badClasses = await missingTailwindClasses(t.flatMap((x) => x.add)).catch(() => []);
    return { t, noMatch, badClasses };
  };
  let chk = await check(a);
  if (chk.noMatch.length || chk.badClasses.length) {
    const problems = [chk.noMatch.length && `These selectors match nothing inside the section: ${chk.noMatch.join(' | ')}. Use selectors that exist in the SECTION HTML.`, chk.badClasses.length && `These Tailwind classes do not exist or give no CSS: ${chk.badClasses.join(', ')}. Use valid utilities.`].filter(Boolean).join('\n');
    const again = await callTool({ slug, label: 'studio-refine-fix', tool: TOOL, maxTokens: 2500, system: SYSTEM, userContent: [...content, { type: 'text', text: `YOUR PREVIOUS ANSWER:\n${JSON.stringify(a)}\n\n${problems}\nReturn the complete answer again with these fixed.` }] });
    a = again.input; cost += again.cost || 0;
    chk = await check(a);
  }
  const dropped = gated.note ? [gated.note] : [];
  const badSet = new Set(chk.badClasses);
  const tweaks = chk.t
    .filter((x) => { const ok = !markup || matches(x.selector); if (!ok) dropped.push(`selector "${x.selector}" matches nothing`); return ok; })
    .map((x) => ({ ...x, add: x.add.filter((c) => { if (badSet.has(c)) { dropped.push(c); return false; } return true; }) }))
    .filter((x) => x.add.length || x.remove.length);

  const vet = await vetOps(a, markup);
  dropped.push(...vet.dropped);

  // the proposal as a candidate page, checked before it is shown
  const cand = JSON.parse(JSON.stringify(pg));
  const changes = [];
  let specTweaks = null, specOps = null;
  const tweakLines = (list) => list.forEach((t) => changes.push(`${t.selector === 'section' ? 'Section' : t.selector}: ${[t.add.length && '+' + t.add.join(' +'), t.remove.length && '-' + t.remove.join(' -')].filter(Boolean).join(' ')}`));
  if (sec) {
    const c = cand.sections.find((s) => s.id === sectionId);
    if (a.resetStyling) { c.tweaks = []; c.extra = null; c.css = ''; c.ops = []; c.html = ''; changes.push('Earlier class, structure and CSS changes cleared (including any hand-edited HTML)'); }
    if (a.variant && styles.includes(a.variant) && a.variant !== (c.variant || '')) { c.variant = a.variant; changes.push(`Style: ${a.variant}`); }
    for (const [k, v] of Object.entries(a.props || {})) if (allowed.includes(k) && SECTION_PROPS[k]?.includes(v) && c.props[k] !== v) { c.props[k] = v; changes.push(`${k}: ${v}`); }
    if (a.matchTheme && c.adapt === 'own') { c.adapt = 'page'; c.own = null; changes.push('Follows the page theme'); }
    for (const [k, v] of Object.entries(a.content || {})) if (typeof v === 'string' && v.trim() && c.content[k] !== v.trim()) { c.content[k] = v.trim(); changes.push(`Wording: ${k}`); }
    if (vet.ops.length) { c.ops = [...(c.ops || []), ...vet.ops]; vet.ops.forEach((o) => changes.push(opLine(o))); }
    if (tweaks.length) { c.tweaks = [...(c.tweaks || []), ...tweaks]; tweakLines(tweaks); }
    if (a.extra && typeof a.extra === 'object') {
      const e = { ...(c.extra || {}) };
      if (a.extra.image?.src) a.extra.image = { ...a.extra.image, src: String(a.extra.image.src).replace(/^\/+/, '') }; // relative to the site, like the page's own images
      for (const k of ['columns', 'align', 'background', 'image']) if (a.extra[k]) { e[k] = a.extra[k]; changes.push(k === 'image' ? 'Image beside the text' : k === 'columns' ? `${a.extra[k]} columns` : `${k}: ${a.extra[k]}`); }
      c.extra = e;
    }
    if (a.customCss && a.customCss.trim()) { c.css = [c.css, a.customCss.trim()].filter(Boolean).join('\n'); changes.push('Custom CSS, because Tailwind cannot do this: ' + String(a.customCssReason || '').slice(0, 120)); }
  } else {
    if (isHeader && a.headerStyle && HEADER_STYLES.includes(a.headerStyle)) { cand.header = { variant: a.headerStyle }; changes.push(`Header style: ${a.headerStyle}`); }
    if (isFooter && a.footerStyle && FOOTER_STYLES.includes(a.footerStyle)) { cand.footer = { variant: a.footerStyle }; changes.push(`Footer style: ${a.footerStyle}`); }
    const scope = (sel) => (sel === 'section' ? `[data-sec="${sectionId}"]` : `[data-sec="${sectionId}"] ${sel}`);
    if (tweaks.length) {
      // the header and footer are drawn outside the composed sections, so their changes live with the page design
      specTweaks = normalizeTweaks([...(base.tweaks || []), ...tweaks.map((t) => ({ ...t, selector: scope(t.selector), layout: 'all' }))]);
      tweakLines(tweaks);
    }
    if (vet.ops.length) {
      specOps = normalizeOps([...(base.ops || []), ...vet.ops.map((o) => ({ ...o, selector: scope(o.selector), ...(o.target ? { target: scope(o.target) } : {}), layout: 'all' }))]);
      vet.ops.forEach((o) => changes.push(opLine(o)));
    }
  }
  const next = normalizePage(cand);
  const candSpec = normalizeSpec({ ...base, page: next, ...(specTweaks ? { tweaks: specTweaks } : {}), ...(specOps ? { ops: specOps } : {}) }, base);
  const patch = specTweaks || specOps ? { ...(specTweaks ? { tweaks: candSpec.tweaks } : {}), ...(specOps ? { ops: candSpec.ops } : {}) } : null;

  let rejected = '';
  if (changes.length) {
    const after = await canvasHtml(slug, candSpec, { origin: '', editor: false });
    const failsBefore = new Set((before.result.checks || []).filter((c) => c.level === 'fail').map((c) => c.msg));
    const introduced = (after.result.checks || []).filter((c) => c.level === 'fail' && !failsBefore.has(c.msg));
    if (introduced.length) rejected = `This change would remove original content (${introduced[0].msg}), so it was not proposed.`;
  }
  const notes = [a.cannotDo, ...dropped.map((d) => `Left out: ${d}`)].filter((x) => x && String(x).trim()).map((x) => String(x).slice(0, 200));
  const ok = !rejected && changes.length;
  return {
    sectionId,
    explanation: String(a.explanation || (changes.length ? '' : 'I could not find a change that fits that request. Try describing what it should look like instead.')).slice(0, 500),
    cannotDo: notes.join('; ').slice(0, 400), changes, page: ok ? next : null, patch: ok ? patch : null, rejected, cost,
  };
}
