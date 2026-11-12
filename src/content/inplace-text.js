import * as cheerio from 'cheerio';
import { plain } from '../util/html.js';

// Puts the AI's new wording back into the page it came from, and changes nothing else. Each change is a text unit with the words it had
// ("before") and the words it should have ("after"). The unit is found on the page by its words, and only its words are replaced: the
// element keeps its tag, its classes and attributes, and the pictures, links, forms, comments and scripts around it are never touched.
// A change whose formatting differs from the original (other tags, other list length) is not applied, and a change that would alter
// anything but words is taken back at once.

const SKIP_AREAS = 'header, nav, footer, aside, script, style, noscript';
const norm = (s) => plain(s).toLowerCase();
const tagsOf = (html) => (String(html).match(/<\/?[a-z][a-z0-9]*/gi) || []).map((t) => t.toLowerCase().replace('</', '/')).join(' ');

// the elements of the page's own content, in page order
function scope($) {
  const root = $('main').length ? $('main').first() : $('body');
  return root.find('*').toArray().filter((el) => !$(el).closest(SKIP_AREAS).length);
}

// the page without any words: every text is blanked (scripts and styles are kept), so two pages with the same skeleton differ only in wording
export function skeleton(html) {
  const $ = typeof html === 'string' ? cheerio.load(html) : html;
  const copy = cheerio.load($.html());
  const blank = (node) => {
    for (const c of node.children || []) {
      if (c.type === 'text') c.data = '';
      else if (c.type === 'tag' && !/^(script|style|noscript|textarea)$/i.test(c.name)) blank(c);
    }
  };
  blank(copy('body').get(0) || copy.root().get(0));
  return (copy('body').length ? copy('body').html() : copy.html()).replace(/\s+/g, ' ').trim();
}

// new words for an element that holds only text (and line breaks): the first text node gets them, the others are emptied, comments stay
function setWords($, el, words) {
  const texts = (el.children || []).filter((n) => n.type === 'text');
  const first = texts.find((n) => n.data.trim()) || texts[0];
  if (!first) { $(el).append(words); return; }
  const lead = first.data.match(/^\s*/)[0], trail = first.data.match(/\s*$/)[0];
  for (const n of texts) if (n !== first) n.data = '';
  first.data = `${lead}${words}${trail}`;
}

export function patchUnits(html, units) {
  const $ = cheerio.load(html);
  const els = scope($);
  const used = new Set();
  const applied = [], skipped = [];
  const skip = (u, why) => skipped.push({ id: u.id, why });
  const find = (test) => els.find((el) => !used.has(el) && test(el));
  const base = skeleton($);

  for (const u of units) {
    const want = norm(u.before);
    if (!want) { skip(u, 'empty'); continue; }
    let el = null, restore = null;
    if (u.kind === 'html') {
      const tag = (String(u.before).match(/^<([a-z0-9]+)/i) || [])[1]?.toLowerCase();
      el = find((e) => e.name === tag && norm($.html(e)) === want);
      if (!el) { skip(u, 'not found on the page'); continue; }
      const next = cheerio.load(`<div id="r">${u.after}</div>`, null, false)('#r').children().first();
      if (!next.length || next.get(0).name !== tag) { skip(u, 'a different kind of block'); continue; }
      restore = $(el).html();
      if (tag === 'ul' || tag === 'ol') {
        const a = $(el).children('li'), b = next.children('li');
        if (a.length !== b.length || a.length === 0) { skip(u, 'a different number of list items'); continue; }
        if (a.toArray().some((li, i) => tagsOf($(li).html()) !== tagsOf(b.eq(i).html()))) { skip(u, 'formatting changed'); continue; }
        a.each((i, li) => { $(li).html(b.eq(i).html()); });
      } else {
        if (tagsOf($(el).html()) !== tagsOf(next.html())) { skip(u, 'formatting changed'); continue; }
        $(el).html(next.html());
      }
    } else if (u.kind === 'inner') {
      el = find((e) => norm($(e).html()) === want && !$(e).children().filter((_, c) => $(c).is('p, ul, ol, div, section, table')).length);
      if (!el) { skip(u, 'not found on the page'); continue; }
      if (tagsOf($(el).html()) !== tagsOf(u.after)) { skip(u, 'formatting changed'); continue; }
      restore = $(el).html();
      $(el).html(u.after);
    } else {
      // plain text: a heading, a question, a card title; the deepest element that holds exactly these words
      const hits = els.filter((e) => !used.has(e) && norm($(e).text()) === want);
      el = hits.find((e) => !$(e).children().length) || hits.at(-1);
      if (!el) { skip(u, 'not found on the page'); continue; }
      if ($(el).children().toArray().some((c) => !/^(br|wbr)$/i.test(c.name))) { skip(u, 'the words are mixed with other markup'); continue; }
      restore = $(el).html();
      setWords($, el, u.after);
    }
    // nothing but words may have changed
    if (skeleton($) !== base) { $(el).html(restore); skip(u, 'it would change more than words'); continue; }
    used.add(el); applied.push(u.id);
  }
  return { html: $.html(), applied, skipped };
}
