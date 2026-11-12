import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { clientDir, loadClient, readJson } from '../config.js';
import { readSource } from '../util/source.js';
import { regions, unitsOf, classify, unitKey, relocate } from './own-convert.js';
import { kindOfUnit } from './own-patterns.js';

// The outline of a template page, the way the Composer shows a designed page: the header and the footer apart, and every section of
// the page on its own row with the role it plays when old pages are poured into the template. The roles are worked out
// automatically; the user can change any of them, and the converter and the section-design library follow.

export const ROLES = [
  ['hero', 'Hero (gets the old page\'s title)'],
  ['text', 'Text area (the old text goes here)'],
  ['band', 'Keep as it is (a strip or figures on every page)'],
  ['common', 'Common section (kept; only the service wording changes)'],
  ['cards', 'Cards design'],
  ['faq', 'FAQ design'],
  ['reviews', 'Reviews design'],
  ['cta', 'Call-to-action band'],
  ['form', 'Form box'],
  ['drop', 'Do not copy'],
];
export const editFile = (slug, layout) => path.join(clientDir(slug), 'template', 'own-preview', `_edit-${layout}.html`);

// selecting sections on the canvas: a click tells the editor which section it was, and the editor can highlight one
const EDIT_STYLE = '<style>[data-sm-key]{cursor:pointer}[data-sm-key].sm-sel{outline:3px solid #7c3aed!important;outline-offset:-3px}[data-sm-key]:hover{outline:2px dashed #a78bfa;outline-offset:-2px}.reveal-up,.reveal-left,.reveal-right,[class*="reveal"]{opacity:1!important;transform:none!important}</style>';
const EDIT_SCRIPT = `<script>(function(){
document.addEventListener('click',function(e){var el=e.target.closest('[data-sm-key]');if(el){e.preventDefault();e.stopPropagation();parent.postMessage({sm:'select',key:el.getAttribute('data-sm-key')},'*');}},true);
window.addEventListener('message',function(e){if(!e.data||e.data.sm!=='select')return;document.querySelectorAll('.sm-sel').forEach(function(x){x.classList.remove('sm-sel');});var el=document.querySelector('[data-sm-key="'+e.data.key+'"]');if(el){el.classList.add('sm-sel');el.scrollIntoView({behavior:'smooth',block:'start'});}});
})();</script>`;

export async function describeTemplate(slug, layout) {
  if (!['home', 'inner', 'contact'].includes(layout)) throw new Error('Choose home, inner or contact.');
  const own = await readJson(path.join(clientDir(slug), 'template', 'own.json'), null);
  const rel = own?.[layout];
  if (!rel) throw new Error(`No ${layout} template page is chosen.`);
  const client = await loadClient(slug);
  const $ = cheerio.load(await readSource(client, rel));
  const { header, footer, region } = regions($);
  const units = unitsOf($, region, header, footer);
  const cl = classify($, units);
  const roles = own.roles?.[layout] || {};
  const text = (el, sel) => $(el).find(sel).first().text().replace(/\s+/g, ' ').trim();
  const sections = units.map((u, i) => {
    const info = cl.infos[i], key = unitKey($, u, i);
    const auto = info === cl.hero ? 'hero' : info === cl.content ? 'text' : cl.bands.includes(info) ? 'band' : cl.cta[cl.cta.length - 1] === info ? 'cta' : cl.formUnit === info ? 'form' : kindOfUnit($, u) || 'drop';
    const head = text(u, 'h1') || text(u, 'h2') || text(u, 'h3') || (info.words ? `“${$(u).text().replace(/\s+/g, ' ').trim().slice(0, 42)}…”` : '');
    $(u).attr('data-sm-key', key);
    return { key, kind: 'section', label: head || $(u).attr('id') || `Section ${i + 1}`, auto, role: roles[key] || auto, you: Boolean(roles[key]), words: info.words, headings: info.heads, form: info.form, id: $(u).attr('id') || '', classes: String($(u).attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 8).join(' ') };
  });
  if (header.length) header.attr('data-sm-key', 'header');
  if (footer.length) footer.attr('data-sm-key', 'footer');
  relocate($, rel, `_edit-${layout}.html`);
  $('head').append(EDIT_STYLE);
  $('body').append(EDIT_SCRIPT);
  await fs.mkdir(path.dirname(editFile(slug, layout)), { recursive: true });
  await fs.writeFile(editFile(slug, layout), $.html());
  const items = [
    ...(header.length ? [{ key: 'header', kind: 'header', label: 'Header and navigation', role: 'chrome', classes: String(header.attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 8).join(' '), links: header.find('a').length }] : []),
    ...sections,
    ...(footer.length ? [{ key: 'footer', kind: 'footer', label: 'Footer', role: 'chrome', classes: String(footer.attr('class') || '').split(/\s+/).filter(Boolean).slice(0, 8).join(' '), links: footer.find('a').length }] : []),
  ];
  return { layout, page: rel, items, roles: ROLES.map(([value, label]) => ({ value, label })), editUrl: `/ownpreview/${slug}/_edit-${layout}.html` };
}
