import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import { clientDir } from '../config.js';
import { callTool } from '../ai/claude.js';
import { regions, unitsOf, unitKey, relocate, newHead } from './own-convert.js';

// Converting an old page into the site's own modern template with the AI. The AI is given the HTML of the reference page (the template
// page the user chose) and the HTML of the old page, and returns the new page's content area: the reference's sections and markup,
// holding the old page's content. Everything around that area (the <head>, header, navigation, footer and their scripts) is never
// handed over for rewriting: the code keeps it as it is, so the reference cannot be damaged. The old page's tracking codes, form
// and structured data are put in by the code too. What the AI returns is checked before it is used (see check()); a page that does not
// pass is converted by the rule-based converter (own-convert.js) instead, and says so.
//
//   aiConvertPage({ slug, model, templateHtml, templateRel, targetRel, originalHtml, mode, vocab, allowCall })  ->  { html, notes, cached }

const MODE_RULES = {
  existing: 'EXISTING CONTENT. Keep the old page\'s wording exactly: every heading, paragraph, list item and link text of the old page, word for word and in the same order. You only decide where each piece goes in the reference\'s sections. Do not reword, shorten, add or remove any sentence.',
  enhance: 'ENHANCE CONTENT. Keep the old page\'s meaning, facts, numbers, names, services, places and structure. Improve the wording: clearer, more concise, active voice, better headings and short paragraphs. Do not add claims, numbers, awards, guarantees or services the old page does not state. Do not drop any fact.',
  rewrite: 'REWRITE CONTENT. Write the page\'s wording fresh in the voice of the reference page, for the same business, topic, services and places. Keep every fact (phone numbers, addresses, names, prices, years, service areas, licences). Do not invent claims, numbers, awards, reviews or guarantees that the old page does not state.',
};

const TOOL = {
  name: 'submit_page_content',
  description: 'Submit the content area of the converted page.',
  input_schema: {
    type: 'object',
    properties: {
      html: { type: 'string', description: 'The HTML of the content area: everything between the header and the footer of the new page.' },
      common_sections: { type: 'array', description: 'The adapted version of every section marked COMMON in the reference.', items: { type: 'object', properties: { n: { type: 'integer', description: 'The number of the section.' }, html: { type: 'string', description: 'The markup of the section, with only the wording about the service changed.' } }, required: ['n', 'html'] } },
      notes: { type: 'array', items: { type: 'string' }, description: 'Short notes about anything that could not be carried over or that you had to decide.' },
    },
    required: ['html'],
  },
};

const SYSTEM = `You convert a website page from its old design to the website's new template.

You receive (1) the REFERENCE: the content area of a page that is already in the new template, with its real HTML, and (2) the OLD PAGE: the content area of the page to convert. Return the content area of the new page.

Rules, all of them strict:
- The new page must look exactly like the reference: the same sections, in the same order, with the same design. The reference is shown as numbered sections (<!--SECTION n-->). Go through them in order and, for each one, write the new page's version of it: the same wrappers, element order, layout and class names, holding the old page's content in place of the reference's. Use only class names that appear in the reference; never invent a class, never use inline styles, <script>, <style> or <iframe>.
- Map the old page's content onto the reference's sections: the old page's main heading and its opening text go in the reference's hero; its pictures go in the reference's picture sections; its headed text sections go one by one into the reference's card, feature or text sections (repeat a card's markup for each of them); its lists go in the reference's list sections; its questions in the FAQ section; its testimonials in the review section; its call to action in the reference's call-to-action band. Remove a reference section only when the old page has nothing at all for it. Do not leave the old page's content in one block when the reference spreads it over several sections.
- Sections marked <!--SECTION n COMMON...--> are common sections of the template: they have the same design and the same wording on every page, and only the wording that names the reference page's service changes. Put the marker <!--KEEP n--> once in the new page, in the place where the section belongs, and return the section's adapted markup in common_sections (n and html). In it, copy the section's markup, classes, links, pictures, icons and phone numbers exactly; change only the words, phrases and headings that name the reference page's service or topic (for example "Residential Junk Removal") so that they name the new page's service or topic instead, in the same grammatical form and capitalisation. Keep the business name, places, generic wording and every other sentence word for word. If a common section does not mention the service, return it unchanged.
- Sections marked <!--KEEP n: ...--> are part of the template and the same on every page. Do not rewrite them: put the marker <!--KEEP n--> exactly once in the new page, in the place where the section belongs (the order of the reference). You may also use <!--KEEP n--> for a numbered section whose content is generic for the business and true for the old page.
- Keep to the structure of the reference: an element with a class goes in the same kind of parent it has in the reference. A card or column that holds only a heading is wrong. Copy every part of a section's markup, including the icons, shapes, frames and wrappers that hold no text (an svg is shown as @@keepN@@: copy it as it is): without them the section's layout falls apart. Long text goes in the element of the reference that holds a section's body text; a card that has room for two lines holds two lines, so a long passage becomes several cards or goes to the reference's text section.
- Replace the reference's own content (its headings, paragraphs, list items, card texts, button labels, image alt text) with the old page's content. Nothing of the reference's own wording may remain, except short generic labels of the template that suit the old page too (such as "Call now"). Repeat or drop a reference section as the old page's content needs: a section the old page has nothing for is removed; a part of the old page the reference has no section for is written with the reference's text styles.
- Keep every image of the old page, with its exact src, alt, width and height attributes, in the reference's image markup. Do not use the reference's own pictures for the old page's content, and do not invent images.
- Keep every link of the old page with its exact href. A tel: or mailto: link stays as it is.
- The page has exactly one <h1>, with the old page's main heading. The reference's breadcrumb, if it has one, is rebuilt from the old page's breadcrumb.
- Where the old page has a form, put the comment <!--OLD_FORM--> in the place of the reference's form box. If the old page has no form, leave the reference's form out.
- Keep the phone numbers, addresses, e-mail addresses, prices, names and years exactly as the old page has them.
- Mode: follow the CONTENT MODE given in the request.
- Return only the HTML of the content area through the tool. No <html>, <head>, <body>, header, nav or footer elements.`;

// ---------- the parts of a page ----------
// The content area: the sections of the page between its header and footer, the same ones the Section preview lists (unitsOf), each with
// the key its role is saved under. Menus (the mobile navigation and the like) belong to the template's chrome: they stay as they are and
// are not handed over. Where the new content goes: right after `anchor`, or first in `parent` when nothing comes before it.
export function contentArea($) {
  const { header, footer, region } = regions($);
  if (!region.length) return null;
  const all = unitsOf($, region, header, footer);
  const keyOf = new Map(all.map((u, i) => [u, unitKey($, u, i)]));
  const nodes = all.filter((n) => !isChrome($, n));
  if (!nodes.length) return null;
  const first = nodes[0], parent = first.parent;
  let anchor = null;
  for (const n of parent.children) { if (n === first) break; if (n.type === 'tag') anchor = n; }
  return { nodes, keys: nodes.map((n) => keyOf.get(n)), parent, anchor };
}

const isChrome = ($, n) => {
  if (n.type !== 'tag' || ['script', 'style', 'noscript', 'link'].includes(n.name)) return false;
  const e = $(n), id = `${e.attr('id') || ''} ${e.attr('class') || ''}`;
  const words = e.text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  const links = e.find('a[href]').length;
  return (n.name === 'nav' || /(^|[\s_-])(nav|navigation|menu|offcanvas|drawer|topbar|breadcrumbs?)([\s_-]|$)/i.test(id)) && words < 150 && links >= 3 && !e.find('h1, h2, form').length;
};

// the old page's own content area: between its header and footer, else its main part, else the body
function oldArea($) {
  const area = contentArea($);
  if (area) return area.nodes.filter((n) => n.type === 'tag' && !['script', 'style', 'noscript', 'link'].includes(n.name));
  const main = $('main').first();
  if (main.length) return [main.get(0)];
  $('header, footer, nav, script, style, noscript').remove();
  return $('body').children().toArray();
}

const FORM_MARK = '<!--OLD_FORM-->';

// hand the AI a lighter page: pictures drawn inline (svg) and embedded data are replaced by short placeholders and put back afterwards
function lighten(html) {
  const store = [];
  const put = (v) => { store.push(v); return `@@keep${store.length - 1}@@`; };
  let out = html.replace(/<svg\b[\s\S]*?<\/svg>/gi, (m) => put(m));
  out = out.replace(/(["'(])(data:[^"')]{200,})/g, (_, q, d) => q + put(d));
  out = out.replace(/<!--(?!OLD_FORM|KEEP |SECTION )[\s\S]*?-->/g, '').replace(/\n\s*\n+/g, '\n').replace(/[ \t]{2,}/g, ' ');
  return { text: out, store };
}
const restore = (html, store) => html.replace(/@@keep(\d+)@@/g, (m, i) => (store[Number(i)] != null ? store[Number(i)] : m));

// the sections of the content area: its elements, in order (a section has the number it has here in every marker)
export const sectionsOf = (area) => area.nodes.filter((n) => n.type === 'tag' && !['script', 'style', 'noscript', 'link'].includes(n.name));
// A section the template shows the same on its other pages (a call-to-action band, a "why choose us" block, the areas list) is part of the
// template, not of the page: it is kept exactly as it is and not handed over to be rewritten.
export function commonSections($, sections, siblings = []) {
  const sets = [];
  for (const html of siblings) {
    try {
      const $s = cheerio.load(html), a = contentArea($s);
      if (a) for (const n of sectionsOf(a)) sets.push(new Set(words($s(n).text())));
    } catch { /* a page that cannot be read says nothing */ }
  }
  const same = (x, y) => { let i = 0; for (const w of x) if (y.has(w)) i += 1; return i / (x.size + y.size - i || 1); };
  return new Set(sections.map((n, k) => [n, k]).filter(([n]) => {
    const mine = new Set(words($(n).text()));
    return mine.size >= 4 && sets.some((o) => same(mine, o) >= 0.85);
  }).map(([, k]) => k));
}

// what the AI sees of the reference: every section as it is, numbered; template sections the AI must not rewrite are only named
function referenceHtml($, sections, { exact, adapt, dropped, hints }) {
  const frag = cheerio.load('<div id="r"></div>', null, false);
  const holder = frag('#r');
  sections.forEach((n, k) => {
    if (dropped.has(k)) return;
    if (exact.has(k)) holder.append(`<!--KEEP ${k}: ${$(n).text().replace(/\s+/g, ' ').trim().slice(0, 90).replace(/-->/g, '')}-->`);
    else {
      holder.append(`<!--SECTION ${k}${adapt.has(k) ? ' COMMON: keep it, change only the wording about the reference page\'s service' : hints.get(k) ? ` (${hints.get(k)})` : ''}-->`);
      holder.append($.html(n));
    }
  });
  holder.find('script, style, noscript').remove();
  return holder.html();
}

// A common section the user marked: the same markup and the same wording, except the wording that names the reference page's service,
// which now names this page's service. Nothing else about it may change.
export function adaptProblems(original, adapted, n) {
  const load = (h) => cheerio.load(`<div id="x">${h}</div>`, null, false);
  const skel = (h) => { const $ = load(h); return $('#x *').toArray().map((e) => `${e.name}.${($(e).attr('class') || '').split(/\s+/).filter(Boolean).sort().join('.')}|${$(e).attr('href') || ''}|${$(e).attr('src') || ''}`); };
  const a = skel(original), b = skel(adapted);
  const problems = [];
  if (a.length !== b.length || a.some((x, i) => x !== b[i])) problems.push(`Common section ${n}: its markup, links and pictures must stay exactly as in the reference; only the wording about the service may change.`);
  const wa = words(load(original)('#x').text()), wb = new Set(words(load(adapted)('#x').text()));
  const kept = wa.filter((w) => wb.has(w)).length;
  if (wa.length && kept / wa.length < 0.5) problems.push(`Common section ${n}: too much of its wording changed. Change only the words that name the reference page's service.`);
  const phones = (h) => (load(h)('#x').text().match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || []).map((p) => p.replace(/\D/g, ''));
  const have = new Set(phones(adapted));
  if (phones(original).some((p) => !have.has(p))) problems.push(`Common section ${n}: its phone numbers must stay.`);
  return problems;
}

function oldHtml(original, model) {
  const $ = cheerio.load(original);
  $('script, style, noscript, link, meta, template').remove();
  if (model.protected?.form) $('#mf_placeholder').replaceWith(FORM_MARK);
  const nodes = oldArea($);
  const frag = cheerio.load('<div id="o"></div>', null, false);
  const holder = frag('#o');
  for (const n of nodes) holder.append($.html(n));
  // what the AI does not need to read: the old design's classes, styles and ids
  holder.find('*').each((_, e) => { for (const a of ['class', 'style', 'id', 'data-aos', 'role', 'tabindex']) frag(e).removeAttr(a); for (const k of Object.keys(e.attribs || {})) if (/^(on|data-(?!src))/i.test(k)) frag(e).removeAttr(k); });
  holder.find('svg').each((_, e) => { frag(e).replaceWith('<svg></svg>'); });
  return holder.html();
}

const words = (t) => String(t || '').toLowerCase().replace(/&[a-z]+;/g, ' ').match(/[a-z0-9]+(?:['’][a-z]+)?/g) || [];
const textOf = (html) => { const $ = cheerio.load(`<div>${html}</div>`, null, false); $('script, style').remove(); return $('div').text().replace(/\s+/g, ' ').trim(); };
const baseName = (u) => String(u || '').split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/i, '').split('/').pop().toLowerCase();
const hrefKey = (h) => String(h || '').trim().replace(/^https?:\/\/(www\.)?[^/]+/i, '').split('#')[0].replace(/\/$/, '').toLowerCase();

// ---------- the checks ----------
export function check({ html, oldContent, referenceText, mode, h1 }) {
  const problems = [];
  const $ = cheerio.load(`<div id="x">${html}</div>`, null, false);
  const $old = cheerio.load(`<div id="x">${oldContent}</div>`, null, false);
  const outText = $('#x').text().replace(/\s+/g, ' ').trim();
  const oldText = $old('#x').text().replace(/\s+/g, ' ').trim();

  if ($('h1').length !== 1) problems.push(`The page must have exactly one <h1> (it has ${$('h1').length}).`);
  if ($('header, footer, nav[class*="main" i], html, body, head').length) problems.push('The content area must not contain a header, footer, <html>, <head> or <body>.');

  // pictures: every picture of the old page, by file name
  const have = new Set($('img').map((_, e) => baseName($(e).attr('src') || $(e).attr('data-src'))).get());
  const missing = [...new Set($old('img').map((_, e) => $old(e).attr('src')).get().filter(Boolean))].filter((s) => !have.has(baseName(s)));
  if (missing.length) problems.push(`These pictures of the old page are missing (keep each with its exact src): ${missing.slice(0, 8).join(', ')}.`);

  // links
  const outLinks = new Set($('a[href]').map((_, e) => hrefKey($(e).attr('href'))).get());
  const oldLinks = [...new Set($old('a[href]').map((_, e) => $old(e).attr('href')).get().filter((h) => h && !/^#|^javascript:/i.test(h)))];
  const lost = oldLinks.filter((h) => !outLinks.has(hrefKey(h)));
  const allowed = mode === 'rewrite' ? Math.floor(oldLinks.length * 0.3) : 0;
  const telLost = lost.filter((h) => /^(tel|mailto):/i.test(h));
  if (telLost.length) problems.push(`These links must stay: ${telLost.join(', ')}.`);
  else if (lost.length > allowed) problems.push(`These links of the old page are missing (keep each with its exact href): ${lost.slice(0, 8).join(', ')}.`);

  // the facts
  const facts = (t) => [...new Set([...(t.match(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || []), ...(t.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []), ...(t.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) || []), ...(t.match(/\b(?:19|20)\d{2}\b/g) || [])])];
  const outAll = outText + ' ' + $('a[href^="tel:"], a[href^="mailto:"]').map((_, e) => $(e).attr('href')).get().join(' ');
  const squash = (s) => s.replace(/[^\w@.$]/g, '');
  const gone = facts(oldText).filter((f) => !squash(outAll).includes(squash(f)));
  if (gone.length) problems.push(`These facts of the old page are missing: ${gone.slice(0, 8).join(' | ')}.`);

  // the wording
  if (mode === 'existing') {
    const need = new Map(); for (const w of words(oldText)) need.set(w, (need.get(w) || 0) + 1);
    for (const w of words(outText)) if (need.has(w)) need.set(w, need.get(w) - 1);
    const deficit = [...need.values()].filter((n) => n > 0).reduce((a, b) => a + b, 0);
    const total = words(oldText).length || 1;
    if (deficit / total > 0.03) problems.push(`The old wording must be kept word for word: ${Math.round((deficit / total) * 100)}% of its words are missing or changed.`);
  } else if (words(outText).length < Math.max(10, words(oldText).length * (mode === 'rewrite' ? 0.5 : 0.7))) problems.push('The page has much less text than the old page. Do not drop content.');

  // nothing of the reference's own wording stays
  const sentences = referenceText.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => words(s).length >= 7);
  const norm = (s) => words(s).join(' ');
  const oldNorm = norm(oldText), outNorm = norm(outText);
  const leaked = sentences.filter((s) => outNorm.includes(norm(s)) && !oldNorm.includes(norm(s)));
  if (leaked.length) problems.push(`Wording of the reference page is still on the page; replace it with the old page's content: "${leaked[0].slice(0, 90)}…"`);
  if (h1 && mode === 'existing' && $('h1').length === 1 && words($('h1').text()).join(' ') !== words(h1).join(' ')) problems.push(`The <h1> must be "${h1}".`);
  return problems;
}

// ---------- the structure of the reference ----------
// every classed element of the answer must sit in the kind of parent it sits in on the reference page; a card heading inside a hero, or a
// card layout holding what the reference's cards never hold, would break the design
const sig = ($, e) => `${e.name}.${($(e).attr('class') || '').split(/\s+/).filter(Boolean).sort().join('.')}`;
const edgesOf = (html) => {
  const $ = cheerio.load(`<div id="x">${html}</div>`, null, false);
  const out = new Set();
  $('#x *').each((_, e) => {
    if (!$(e).attr('class')) return;
    let p = e.parent;
    while (p && p.attribs && !p.attribs.class && p.attribs.id !== 'x') p = p.parent;
    out.add(`${p && p.attribs?.class ? sig($, p) : '^'}>${sig($, e)}`);
  });
  return out;
};
export function structureProblems(html, referenceHtml) {
  const ref = edgesOf(referenceHtml);
  const refTop = new Set([...ref].map((e) => e.split('>')[1]));
  const bad = [...edgesOf(html)].filter((e) => !ref.has(e) && !(e.startsWith('^>') && refTop.has(e.split('>')[1])));
  if (!bad.length) return [];
  const show = bad.slice(0, 6).map((e) => { const [p, c] = e.split('>'); return `${c} inside ${p === '^' ? 'the page' : p}`; });
  return [`These parts do not follow the reference's structure (an element in a parent the reference never puts it in): ${show.join('; ')}. Copy the reference's markup for each section exactly.`];
}

// The parts of a section that hold no wording (icons, decorative shapes, image frames) cannot be left out for lack of content: a card
// without its icon box falls out of its layout. Every element of the answer must have the textless parts every such element has on the
// reference page.
const decorationsOf = (html) => {
  const $ = cheerio.load(`<div id="x">${html}</div>`, null, false);
  const kids = new Map();
  $('#x *').each((_, e) => {
    if (!$(e).attr('class')) return;
    let p = e.parent;
    while (p && p.attribs && !p.attribs.class && p.attribs.id !== 'x') p = p.parent;
    if (p && p.attribs?.class) { if (!kids.has(p)) kids.set(p, new Map()); kids.get(p).set(sig($, e), !$(e).text().replace(/@@keep\d+@@/g, '').trim() && !$(e).find('img').length ? 'bare' : 'text'); }
  });
  const bySig = new Map();
  $('#x *').each((_, e) => { if ($(e).attr('class')) { const s = sig($, e); if (!bySig.has(s)) bySig.set(s, []); bySig.get(s).push(kids.get(e) || new Map()); } });
  return bySig;
};
export function decorationProblems(html, referenceHtml) {
  const ref = decorationsOf(referenceHtml), out = decorationsOf(html);
  const bad = [];
  for (const [s, instances] of out) {
    const rs = ref.get(s);
    if (!rs) continue;
    const need = [...rs[0]].filter(([c, kind]) => kind === 'bare' && rs.every((m) => m.get(c) === 'bare')).map(([c]) => c);
    for (const c of need) if (instances.some((m) => !m.has(c))) bad.push(`${c} inside ${s}`);
  }
  // an icon (svg) every such element has on the reference page
  const svgs = (h) => { const $ = cheerio.load(`<div id="x">${h}</div>`, null, false); const m = new Map(); $('#x *').each((_, e) => { if (!$(e).attr('class')) return; const s = sig($, e), has = $(e).find('svg').length > 0; m.set(s, [...(m.get(s) || []), has]); }); return m; };
  const rs = svgs(referenceHtml), os = svgs(html);
  for (const [s, list] of os) if (rs.get(s)?.every(Boolean) && !list.every(Boolean)) bad.push(`the icon (an svg shown as @@keepN@@) of ${s}`);
  return bad.length ? [`These parts of the reference's markup were left out (icons, shapes and frames stay, even where they hold no text): ${[...new Set(bad)].slice(0, 6).join('; ')}.`] : [];
}

// ---------- tidy up what comes back ----------
export function tidy(html, { vocab, store, form, notes }) {
  const $ = cheerio.load(`<div id="x">${html}</div>`, null, false);
  let stripped = 0;
  $('script, style, iframe, object, embed, link, meta, base').remove();
  $('#x *').each((_, e) => {
    for (const k of Object.keys(e.attribs || {})) {
      if (/^on/i.test(k) || (['href', 'src', 'action'].includes(k) && /^\s*javascript:/i.test(e.attribs[k])) || k === 'style') { $(e).removeAttr(k); stripped += 1; }
    }
    // a class the stylesheet of the site does not have does nothing, and would show the page unstyled: it is dropped
    const cls = $(e).attr('class');
    if (cls && vocab) {
      const keep = cls.split(/\s+/).filter((c) => c && vocab.has(c));
      if (keep.length !== cls.split(/\s+/).filter(Boolean).length) stripped += 1;
      keep.length ? $(e).attr('class', keep.join(' ')) : $(e).removeAttr('class');
    }
  });
  let out = restore($('#x').html(), store);
  out = form ? out.split(FORM_MARK).join(form) : out.split(FORM_MARK).join('');
  if (stripped) notes.add(`${stripped} attribute(s) the AI added that the template does not use were removed.`);
  return out;
}

export const classVocab = (html) => new Set([...String(html).matchAll(/\bclass\s*=\s*["']([^"']*)["']/gi)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));

// ---------- the call, with a stored answer ----------
const VERSION = 8;
async function ask({ slug, label, user, key, allowCall, call }) {
  const dir = path.join(clientDir(slug), 'template', 'own-ai');
  const file = path.join(dir, `${key}.json`);
  try { return { ...JSON.parse(await fs.readFile(file, 'utf8')), cached: true }; } catch { /* not asked before */ }
  if (!allowCall) throw new Error('The AI conversion of this page has not been run yet.');
  const { input, cost } = await (call || callTool)({ slug, label, system: SYSTEM, user, tool: TOOL, maxTokens: 12000 });
  const out = { html: String(input.html || ''), common: Array.isArray(input.common_sections) ? input.common_sections.map((c) => ({ n: Number(c.n), html: String(c.html || '') })) : [], notes: Array.isArray(input.notes) ? input.notes.map(String) : [], cost };
  return out;
}
const save = async (slug, key, data) => { const dir = path.join(clientDir(slug), 'template', 'own-ai'); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify(data)); };

// the markers of kept sections in an answer: each section the template shows on all its pages must be placed exactly once
export function keepProblems(html, common, count) {
  const seen = new Map();
  for (const m of html.matchAll(/<!--\s*KEEP\s+(\d+)[^>]*?-->/g)) seen.set(Number(m[1]), (seen.get(Number(m[1])) || 0) + 1);
  const problems = [];
  const missing = [...common].filter((k) => !seen.has(k)), twice = [...seen].filter(([, n]) => n > 1).map(([k]) => k), unknown = [...seen.keys()].filter((k) => k >= count);
  if (missing.length) problems.push(`These template sections must be placed in the page, each exactly once, with their marker: ${missing.map((k) => `<!--KEEP ${k}-->`).join(' ')}.`);
  if (twice.length) problems.push(`These markers are used more than once: ${twice.join(', ')}.`);
  if (unknown.length) problems.push(`These markers do not exist: ${unknown.join(', ')}.`);
  return problems;
}

// how much of the reference's design the page uses: its sections by their classes
const sigOf = ($, n) => `${n.name}.${($(n).attr('class') || '').split(/\s+/).filter(Boolean).sort().join('.')}`;
export function coverageProblems(html, $ref, sections, common, oldWords) {
  if (oldWords < 250) return [];
  const want = new Map();
  sections.forEach((n, k) => { if (!common.has(k) && $ref(n).attr('class')) want.set(sigOf($ref, n), $ref(n).attr('class').split(/\s+/)[0]); });
  if (want.size < 3) return [];
  const $o = cheerio.load(`<div id="x">${html}</div>`, null, false);
  const used = new Set($o('#x').find('*').toArray().filter((e) => $o(e).attr('class')).map((e) => sigOf($o, e)));
  const missing = [...want].filter(([s]) => !used.has(s)).map(([, c]) => c);
  return missing.length > want.size / 2 ? [`The page uses too few of the reference's sections. Build it in the reference's section designs and order, filling each with the old page's content. These sections of the reference are not used: ${missing.slice(0, 8).join(', ')}.`] : [];
}

export async function aiConvertPage({ slug, model, templateHtml, templateRel, targetRel, originalHtml, mode = 'existing', vocab = null, allowCall = true, call = null, store = true, siblings = [], roles = null }) {
  if (!model?.ok) throw new Error('The old page could not be read (unrecognised layout).');
  const $ = cheerio.load(templateHtml);
  relocate($, templateRel, targetRel);
  const area = contentArea($);
  if (!area) throw new Error('The template page has no content area between its header and footer.');
  const sections = sectionsOf(area);

  // what the user decided about the template's sections (Section preview), and what the template shows the same on all its pages
  const roleAt = (k) => (roles || {})[area.keys[k]] || '';
  const dropped = new Set(sections.map((_, k) => k).filter((k) => roleAt(k) === 'drop'));
  const adapt = new Set(sections.map((_, k) => k).filter((k) => roleAt(k) === 'common'));
  const auto = commonSections($, sections, siblings);
  const exact = new Set([...auto, ...sections.map((_, k) => k).filter((k) => roleAt(k) === 'band')].filter((k) => !adapt.has(k) && !dropped.has(k)));
  const must = new Set([...exact, ...adapt]);
  const hints = new Map(sections.map((_, k) => [k, { hero: 'the hero', text: 'the text area', cards: 'cards', faq: 'FAQ', reviews: 'reviews', cta: 'call-to-action band', form: 'form box' }[roleAt(k)]]).filter(([, v]) => v).map(([k, v]) => [k, `the user says this is ${v}`]));
  const skip = new Set([...must, ...dropped]);

  const ref = lighten(referenceHtml($, sections, { exact, adapt, dropped, hints }));
  const old = lighten(oldHtml(originalHtml, model));
  if (ref.text.length > 110000) throw new Error('The template page is too large to hand to the AI.');
  if (old.text.length > 110000) throw new Error('The old page is too large to hand to the AI.');
  const refRestored = restore(ref.text, ref.store);
  const referenceText = textOf(refRestored);
  const oldContent = restore(old.text, old.store);
  const refTopic = $('h1').first().text().replace(/\s+/g, ' ').trim() || $('title').text().trim();
  const key = crypto.createHash('sha1').update(JSON.stringify([VERSION, mode, ref.text, old.text, model.hero.h1, refTopic])).digest('hex').slice(0, 20);

  const topics = adapt.size ? `\nTHE REFERENCE PAGE'S SERVICE / TOPIC (its heading): ${refTopic}\nTHIS PAGE'S SERVICE / TOPIC (its heading): ${model.hero.h1}${model.head?.title ? ` (title: ${model.head.title})` : ''}\n` : '';
  const base = `CONTENT MODE\n${MODE_RULES[mode] || MODE_RULES.existing}\n\nTHE PAGE'S MAIN HEADING (h1): ${model.hero.h1}\n${model.protected?.form ? 'The old page has a form: put <!--OLD_FORM--> in its place.' : 'The old page has no form.'}${topics}\n=== REFERENCE (the new template; content area of ${templateRel}) ===\n${ref.text}\n\n=== OLD PAGE (content area of ${targetRel}) ===\n${old.text}`;
  const notes = new Set();
  let answer = await ask({ slug, label: `own-convert ${targetRel}`, user: base, key, allowCall, call });
  const run = (a) => {
    const html = tidy(a.html, { vocab, store: [...ref.store, ...old.store], form: model.protected?.form || '', notes });
    // the adapted common sections: tidied the same way, and checked against the reference's own markup
    const adapted = new Map(), problems = [];
    for (const k of adapt) {
      const got = (a.common || []).find((c) => c.n === k);
      if (!got) { problems.push(`Common section ${k} is missing from common_sections.`); continue; }
      const text = tidy(got.html, { vocab: null, store: [...ref.store, ...old.store], form: '', notes: new Set() });
      problems.push(...adaptProblems($.html(sections[k]), text, k));
      adapted.set(k, text);
    }
    return { html, adapted, problems: [...problems, ...check({ html, oldContent, referenceText, mode, h1: model.hero.h1 }), ...structureProblems(html, refRestored), ...decorationProblems(html, refRestored), ...keepProblems(html, must, sections.length), ...coverageProblems(html, $, sections, skip, words(textOf(oldContent)).length)] };
  };
  let result = run(answer);
  if (result.problems.length && allowCall && !answer.cached) {
    // one more try, with what was wrong
    const again = await ask({ slug, label: `own-convert ${targetRel} (fix)`, user: `${base}\n\n=== YOUR PREVIOUS ANSWER WAS REFUSED ===\nProblems:\n${result.problems.map((p) => `- ${p}`).join('\n')}\n\nPrevious answer:\n${answer.html}\n${JSON.stringify(answer.common || [])}\n\nReturn the corrected content area (and common_sections).`, key: `${key}-retry`, allowCall, call });
    const second = run(again);
    if (second.problems.length < result.problems.length || !second.problems.length) { answer = again; result = second; }
  }
  if (result.problems.length) throw new Error(`The AI's page did not pass the checks: ${result.problems.slice(0, 3).join(' ')}`);
  if (!answer.cached && store) await save(slug, key, { html: answer.html, common: answer.common || [], notes: answer.notes });
  for (const n of answer.notes || []) notes.add(n);
  if (adapt.size) notes.add(`${adapt.size} common section(s) kept from the reference with the wording about its service changed to this page's.`);

  // the new page: the reference as it is, with its content sections replaced, and the head of the old page.
  // Sections the template shows on every page are copied from the reference; common sections come in with their adapted wording.
  const kept = new Set();
  const withKept = result.html.replace(/<!--\s*KEEP\s+(\d+)[^>]*?-->/g, (m, k) => {
    const n = sections[Number(k)];
    if (!n) return '';
    kept.add(n);
    return result.adapted.get(Number(k)) ?? $.html(n);
  });
  const scripts = [];
  for (const n of area.nodes) if (!kept.has(n)) {
    const $n = $(n);
    $n.find('script').add($n.filter('script')).each((_, s) => { const t = $(s).html() || ''; if (!(model.protected?.form && /mf_placeholder|mform|mf\.js/i.test(t + ($(s).attr('src') || '')))) scripts.push($.html(s)); });
  }
  const keepScripts = scripts.filter((s) => !/application\/ld\+json/i.test(s));
  const fresh = `\n${withKept}\n${keepScripts.join('\n')}\n`;
  if (area.anchor) $(area.anchor).after(fresh); else $(area.parent).prepend(fresh);
  for (const n of area.nodes) $(n).remove();
  newHead($, model, templateHtml);
  return { html: $.html(), notes: [...notes, `Converted with the AI (${mode} content) from the reference page ${templateRel}.`], cached: Boolean(answer.cached) };
}
