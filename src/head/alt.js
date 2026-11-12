import path from 'node:path';
import { clientDir, readJson, writeJson } from '../config.js';
import { callTool } from '../ai/claude.js';

// Picture descriptions (alt text) written with the AI, only for pictures whose description is missing or says nothing
// ("image", "IMG_2041", the file name). The AI sees the file name, the heading and the text around the picture and describes what the
// page says about it; it never adds names, claims or details the page does not give. Answers are kept, so a rebuild costs nothing.

export const ALT_MAX = 125;
const altFile = (slug) => path.join(clientDir(slug), 'alt-fixes.json');
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const stem = (src) => decodeURIComponent(String(src || '').split(/[?#]/)[0].split('/').pop() || '').replace(/\.[a-z0-9]{2,5}$/i, '');

// a description that tells a visitor nothing
export function poorAlt(alt, src) {
  const a = clean(alt).toLowerCase();
  if (!a) return true;
  if (/^(img|image|images|photo|photos|picture|pic|dsc|dscn|screenshot|untitled|banner|graphic|icon)[\s_-]*\d*$/.test(a)) return true;
  if (/^[a-z]{0,5}[\s_-]?\d{3,}$/.test(a)) return true;
  const s = stem(src).toLowerCase().replace(/[-_.\s]+/g, ' ').trim();
  return Boolean(s) && a.replace(/[-_.\s]+/g, ' ') === s;
}
export const capAlt = (t, max = ALT_MAX) => {
  const x = clean(t).replace(/^(image|picture|photo|graphic) of\s+/i, '');
  if (x.length <= max) return x;
  const cut = x.slice(0, max + 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).replace(/[\s,;:-]+$/, '');
};

// the content pictures of a page that need a better description
export function imagesNeedingAlt($) {
  const out = [];
  let heading = '';
  $('main').find('h1,h2,h3,h4,img').each((_, el) => {
    if (el.name !== 'img') { heading = clean($(el).text()) || heading; return; }
    const i = $(el);
    if (i.closest('header, footer').length || i.attr('aria-hidden') === 'true' || i.attr('role') === 'presentation') return;
    const src = i.attr('src') || i.attr('data-src');
    if (!src || !poorAlt(i.attr('alt'), src)) return;
    const near = i.closest('figure, li, div').first();
    out.push({ src, alt: clean(i.attr('alt')), heading, context: clean(near.text()).slice(0, 220) });
  });
  return out;
}

const TOOL = {
  name: 'submit_alt_texts',
  description: 'Submit a description for each picture.',
  input_schema: { type: 'object', properties: { alts: { type: 'array', items: { type: 'object', properties: { n: { type: 'number' }, alt: { type: 'string' } }, required: ['n', 'alt'] } } }, required: ['alts'] },
};
const SYSTEM = `You write alt text (picture descriptions for screen readers and search engines) for a local business website.
Each description: at most ${ALT_MAX} characters, one short natural phrase that says what the picture shows, in the context of the page. Do not start with "image of" or "picture of". No keyword stuffing, no quotation marks.
Use only what the file name, the heading and the text around the picture tell you. Never invent names, places, people, numbers or claims. If the file name says nothing, describe the picture by the section it belongs to.`;

// pictures: from imagesNeedingAlt; returns Map(src -> alt). Without the AI (dry run) only answers kept from an earlier run are used.
export async function aiAlts({ slug, rel, pictures, h1, ai = true }) {
  const out = new Map();
  if (!pictures.length) return out;
  const cache = await readJson(altFile(slug), {});
  const need = [];
  for (const p of pictures) { const hit = cache[`${rel}|${p.src}`]; if (hit) out.set(p.src, hit); else need.push(p); }
  if (!need.length || !ai) return out;
  const user = [`PAGE: ${rel}`, `PAGE HEADING: ${h1}`, ...need.map((p, i) => `PICTURE ${i + 1}\n  file: ${stem(p.src)}\n  section heading: ${p.heading || '(none)'}\n  text around it: ${p.context || '(none)'}\n  current alt: ${p.alt || '(none)'}`), `Return one description for each of the ${need.length} pictures, with n as given.`].join('\n\n');
  let r;
  try { r = await callTool({ slug, label: 'alt-text', system: SYSTEM, user, tool: TOOL, maxTokens: 150 * need.length + 200 }); } catch { return out; } // the file-name fallback stays
  let changed = false;
  for (const a of r.input.alts || []) {
    const p = need[Number(a.n) - 1];
    const alt = capAlt(a.alt);
    if (p && alt.length >= 6 && !poorAlt(alt, p.src)) { out.set(p.src, alt); cache[`${rel}|${p.src}`] = alt; changed = true; }
  }
  if (changed) await writeJson(altFile(slug), cache);
  return out;
}
