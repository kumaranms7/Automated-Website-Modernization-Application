import * as cheerio from 'cheerio';
import { appliesHere } from './scope.js';

// Structure edits for composed pages. Tailwind classes cannot move, wrap or add elements, so these small, safe operations
// can: wrap an element in a container, unwrap it, insert decorative markup before, after or inside it, change its tag, move it.
// An operation never deletes content, inserted markup is sanitised (no scripts, forms, frames or event handlers), and a whole
// section can also be replaced by hand-edited HTML. Everything is checked afterwards so no original content can be lost.

export const OP_NAMES = ['wrap', 'unwrap', 'before', 'after', 'prepend', 'append', 'tag', 'move-before', 'move-after'];
const TAGS = new Set(['div', 'section', 'article', 'aside', 'ul', 'ol', 'li', 'p', 'span', 'figure', 'header', 'footer', 'nav', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'dl', 'dt', 'dd']);
const SELECTOR_OK = /^[\w\s.#:>+~*,()\[\]="'^$|&-]{1,400}$/;
const BLOCKED = 'script,style,iframe,object,embed,form,input,textarea,select,button,link,meta,base,noscript,template,svg script';

// markup that came from the AI or from a person: only structure, text, images, links and classes survive
export function sanitizeSnippet(html, max = 6000) {
  const $ = cheerio.load(String(html || '').slice(0, max * 2), null, false);
  $(BLOCKED).remove();
  $('*').each((_, el) => {
    for (const [k, v] of Object.entries(el.attribs || {})) {
      if (/^on/i.test(k) || /^\s*(javascript|vbscript|data:text)/i.test(v) || k === 'srcdoc') $(el).removeAttr(k);
    }
  });
  return $.html().trim().slice(0, max);
}

// The site's contact form embed is protected: the editor shows it as this placeholder and the exact original is put back when the
// page is drawn, so a hand edit can move it but never alter it.
export const FORM_MARK = '<div data-protected-form></div>';
const FORM_RE = /<div\s+data-protected-form(?:="")?\s*>\s*<\/div>/gi;
export const expandForm = (html, form) => String(html || '').replace(FORM_RE, () => form || '');

// a whole replacement section: must still be a <section>, keeps forms (the page's own form is part of the content)
export function sanitizeSection(html) {
  const raw = String(html || '').trim();
  if (!raw || !/<section\b/i.test(raw)) return '';
  const $ = cheerio.load(raw.slice(0, 120000), null, false);
  $('script,style,iframe,object,embed,link,meta,base,noscript,template').remove();
  $('*').each((_, el) => {
    for (const [k, v] of Object.entries(el.attribs || {})) {
      if (/^on/i.test(k) || /^\s*(javascript|vbscript|data:text)/i.test(v) || k === 'srcdoc') $(el).removeAttr(k);
    }
  });
  $('[data-sec],[data-ref]').removeAttr('data-sec').removeAttr('data-ref');
  $('div[data-protected-form]').each((_, n) => { n.attribs = { 'data-protected-form': '' }; $(n).empty(); });
  return $.html().trim();
}

export function normalizeOps(list, max = 40) {
  const out = [];
  for (const o of Array.isArray(list) ? list : []) {
    const op = String(o?.op || '');
    const selector = String(o?.selector || '').trim();
    if (!OP_NAMES.includes(op) || !SELECTOR_OK.test(selector) || /url\(|javascript:|expression/i.test(selector)) continue;
    const item = { layout: ['home', 'inner', 'contact', 'all'].includes(o?.layout) ? o.layout : 'all', selector, op };
    if (o?.file) item.file = String(o.file).replace(/[<>"]/g, '').slice(0, 200);
    if (['wrap', 'before', 'after', 'prepend', 'append'].includes(op)) {
      item.html = sanitizeSnippet(o.html, 1500);
      if (!item.html) continue;
      // inserted markup is decoration and layout, never new copy
      if (op !== 'wrap' && cheerio.load(item.html, null, false).root().text().trim().length > 40) continue;
    }
    if (op === 'tag') { const t = String(o.tag || '').toLowerCase(); if (!TAGS.has(t)) continue; item.tag = t; }
    if (op === 'move-before' || op === 'move-after') { const t = String(o.target || '').trim(); if (!SELECTOR_OK.test(t)) continue; item.target = t; }
    out.push(item);
  }
  return out.slice(0, max);
}

// hand-edited sections for the one page they were made on: { layout, file, index, html }
export function normalizeHtmlEdits(list) {
  const out = new Map();
  for (const e of Array.isArray(list) ? list : []) {
    const layout = ['inner', 'contact'].includes(e?.layout) ? e.layout : '';
    const index = Number(e?.index);
    const file = String(e?.file || '').replace(/[<>"]/g, '').slice(0, 200);
    const html = sanitizeSection(e?.html);
    if (!layout || !file || !Number.isInteger(index) || index < 1 || index > 60 || !html) continue;
    out.set(`${layout}|${file}|${index}`, { layout, file, index, html });
  }
  return [...out.values()].slice(0, 30);
}

const find = ($, selector, fragment) => {
  try {
    if (fragment && selector === 'section') return $.root().children('section').first();
    return fragment ? $.root().find(selector) : $(selector);
  } catch { return $([]); }
};

// fragment: html is one section (selectors are searched inside it); otherwise a whole page
export function applyHtmlOps(html, ops, { fragment = false, layout = 'all', rel = '', spec = {} } = {}) {
  const list = (ops || []).filter((o) => fragment || appliesHere(o, spec, layout, rel));
  if (!list.length) return html;
  const $ = fragment ? cheerio.load(html, null, false) : cheerio.load(html);
  let touched = 0;
  for (const o of list) {
    const sel = find($, o.selector, fragment);
    sel.each((_, el) => {
      if (!el.parent || ['html', 'body', 'head'].includes(el.name)) return;
      const $el = $(el);
      if (o.op === 'wrap') $el.wrap(o.html);
      else if (o.op === 'unwrap') { const p = el.parent; if (p && p.type === 'tag' && !['html', 'body', 'main'].includes(p.name) && !p.attribs?.['data-sec']) $el.unwrap(); }
      else if (o.op === 'before') $el.before(o.html);
      else if (o.op === 'after') $el.after(o.html);
      else if (o.op === 'prepend') $el.prepend(o.html);
      else if (o.op === 'append') $el.append(o.html);
      else if (o.op === 'tag') el.name = o.tag;
      else if (o.op === 'move-before' || o.op === 'move-after') {
        const t = find($, o.target, fragment).first();
        if (t.length && t[0] !== el && !$.contains(el, t[0])) { o.op === 'move-before' ? t.before($el) : t.after($el); }
      }
      touched += 1;
    });
  }
  return touched ? $.html() : html;
}

// replace the section at this 1-based position among a page's top-level sections, keeping its editor id
export function applyHtmlEdits(mainHtml, edits, layout, file, form = '') {
  const list = (edits || []).filter((e) => e.layout === layout && e.file === file);
  if (!list.length) return mainHtml;
  const $ = cheerio.load(mainHtml, null, false);
  const secs = $.root().children('section').toArray();
  for (const e of list) {
    const el = secs[e.index - 1];
    if (!el) continue;
    const id = $(el).attr('data-sec') || `s${e.index}`;
    const fresh = cheerio.load(expandForm(e.html, form), null, false);
    fresh.root().children('section').first().attr('data-sec', id);
    $(el).replaceWith(fresh.html());
  }
  return $.html();
}

// every Tailwind class an operation or an edited section brings in, so the editor's stylesheet can include them
export function classesIn(html) {
  const out = new Set();
  for (const m of String(html || '').matchAll(/\bclass="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach((c) => out.add(c));
  return [...out];
}

// readable markup for the editor dialog
export function prettyHtml(html) {
  const $ = cheerio.load(html, null, false);
  const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);
  const INLINE = new Set(['a', 'span', 'strong', 'em', 'b', 'i', 'small', 'code', 'sup', 'sub', 'u', 'mark', 'abbr', 'label']);
  const lines = [];
  const walk = (node, depth) => {
    const pad = '  '.repeat(depth);
    if (node.type === 'text') { const t = node.data.replace(/\s+/g, ' ').trim(); if (t) lines.push(pad + t); return; }
    if (node.type === 'comment') return;
    if (node.type !== 'tag') return;
    const attrs = Object.entries(node.attribs || {}).map(([k, v]) => (v === '' ? k : `${k}="${String(v).replace(/"/g, '&quot;')}"`)).join(' ');
    const open = `<${node.name}${attrs ? ' ' + attrs : ''}>`;
    if (VOID.has(node.name)) { lines.push(pad + open); return; }
    const kids = node.children || [];
    const simple = kids.every((k) => k.type === 'text' || (k.type === 'tag' && INLINE.has(k.name) && (k.children || []).every((x) => x.type === 'text')));
    if (simple) { lines.push(pad + open + $.html(kids).replace(/\s+/g, ' ').trim() + `</${node.name}>`); return; }
    lines.push(pad + open);
    kids.forEach((k) => walk(k, depth + 1));
    lines.push(pad + `</${node.name}>`);
  };
  $.root().contents().toArray().forEach((n) => walk(n, 0));
  return lines.join('\n');
}

// ---- header and footer ----
// The header and footer are shared by every page, and their links depend on how deep the page is. A hand-edited one is stored with
// links relative to the site root ("about.html", "images/logo.png", "/" for home) and given the right prefix for each page.
const LOCAL_URL = (v) => v && !/^(#|\/\/|[a-z][a-z0-9+.-]*:)/i.test(v.trim());

function mapUrls(html, fn) {
  const $ = cheerio.load(html, null, false);
  $('a[href],area[href],link[href]').each((_, el) => { const v = el.attribs.href; if (LOCAL_URL(v)) el.attribs.href = fn(v.trim()); });
  $('img[src],source[src],script[src]').each((_, el) => { const v = el.attribs.src; if (LOCAL_URL(v)) el.attribs.src = fn(v.trim()); });
  return $.html();
}
const stripRoot = (v) => v.replace(/^(?:\.{1,2}\/)+/, '').replace(/^\/+/, '');
export const canonUrls = (html) => mapUrls(html, (v) => stripRoot(v) || '/');
export const rebaseUrls = (html, depth, absolute = false) => {
  const prefix = absolute ? '/' : depth ? '../'.repeat(depth) : './';
  return mapUrls(html, (v) => prefix + stripRoot(v));
};

// a replacement header or footer: the same safety rules as a section, and it must still contain that element
export function sanitizeChrome(html, tag) {
  const raw = String(html || '').trim();
  if (!raw || !new RegExp('<' + tag + '\\b', 'i').test(raw)) return '';
  const $ = cheerio.load(raw.slice(0, 120000), null, false);
  $('script,style,iframe,object,embed,link,meta,base,noscript,template').remove();
  $('*').each((_, el) => {
    for (const [k, v] of Object.entries(el.attribs || {})) {
      if (/^on/i.test(k) || /^\s*(javascript|vbscript|data:text)/i.test(v) || k === 'srcdoc') $(el).removeAttr(k);
    }
  });
  $('[data-sec],[data-ref]').removeAttr('data-sec').removeAttr('data-ref');
  return $.html().trim();
}
