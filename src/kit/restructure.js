import * as cheerio from 'cheerio';
import { T } from './ui.js';

// A page's running text is rarely only prose: it holds question-and-answer pairs, steps, lists of benefits, a row of links, pictures that belong
// to the text next to them. This turns each of those back into the kind of section the design has for it, without losing a word or a link of it.

const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const FAQ_TITLE = /\bfaqs?\b|frequently asked|questions/i;
const STEP_TITLE = /how .*works?|how it works|getting started|steps?\b|process|what to expect|what happens/i;
const CTA_WORD = /quote|call|schedule|book|contact|get started|estimate|appointment|order|buy|request|free/i;
const DECOR = /wave|divider|shape|pattern|texture|separator|arrow|bullet|circle-point|logo|badge|seal|\.svg/i;
const LONG_RUN = 3;

// the top-level pieces of a section's blocks
function pieces(blocks) {
  const out = [];
  for (const b of blocks || []) {
    if (b.t === 'img') { out.push({ k: 'img', b }); continue; }
    if (b.t === 'h') { out.push({ k: 'h', text: b.text, level: b.level }); continue; }
    const $ = cheerio.load(`<div id="x">${b.html || ''}</div>`, null, false);
    $('#x li img, #x p img').each((_, im) => { const w = Number($(im).attr('width') || 0); if (DECOR.test($(im).attr('src') || '') || /^bullet|arrow|icon$/i.test($(im).attr('alt') || '') || (w && w <= 64)) $(im).remove(); });
    const kids = $('#x').children().toArray();
    // loose text or inline markup at the top (no paragraph around it) is one paragraph
    const loose = $('#x').contents().toArray().some((n) => (n.type === 'text' && n.data.trim()) || (n.type === 'tag' && /^(strong|b|em|i|a|span|br|small|u|mark|abbr)$/.test(n.tagName)));
    if (loose) { const h = $('#x').html().trim(); out.push({ k: 'p', html: `<p>${h}</p>`, text: strip(h) }); continue; }
    if (!kids.length) { out.push({ k: 'p', html: $('#x').html(), text: strip($('#x').html()) }); continue; }
    for (const el of kids) {
      const tag = el.tagName, html = $.html(el), text = strip(html);
      if (tag === 'ul' || tag === 'ol') out.push({ k: 'list', html, ordered: tag === 'ol', items: $(el).children('li').toArray().map((li) => ({ html: $(li).html().trim(), text: strip($(li).html()), linkOnly: $(li).find('a').length === 1 && strip($(li).find('a').text()) === strip($(li).text()), href: $(li).find('a').attr('href') || '' })) });
      else if (tag === 'table') out.push({ k: 'table', html });
      else if (tag === 'p') {
        const a = $(el).find('a');
        const link = a.length === 1 && strip(a.text()) === text;
        const strong = $(el).children('strong, b').length === 1 && strip($(el).children('strong, b').text()) === text;
        out.push({ k: 'p', html, text, link, href: a.attr('href') || '', strong, inner: $(el).html().trim() });
      } else out.push({ k: 'x', html, text });
    }
  }
  return out;
}
const asBlocks = (ps) => ps.map((p) => (p.k === 'img' ? p.b : p.k === 'h' ? { t: 'h', text: p.text, level: p.level } : { t: 'html', html: p.html || '' }));
const plainIntro = (ps) => ps.filter((p) => p.k === 'p' && !p.link).map((p) => ({ t: 'html', html: p.html }));

// ---------- recognisers ----------
function faqOf(title, ps) {
  const isQ = (p) => (p.k === 'h') || (p.k === 'p' && p.text.length < 170 && (/^q\s*[:.)]/i.test(p.text) || (/\?$/.test(p.text) && (p.link || p.strong))));
  const qs = ps.filter(isQ).length;
  if (qs < 2 || !(FAQ_TITLE.test(title) || qs >= 3)) return null;
  const intro = [], items = [];
  for (const p of ps) {
    if (isQ(p)) { items.push({ q: p.text || '', parts: [] }); continue; }
    if (!items.length) { if (p.k === 'p') intro.push({ t: 'html', html: p.html }); else return null; continue; }
    items[items.length - 1].parts.push(p);
  }
  if (items.some((i) => !i.parts.length)) return null;
  return { type: 'faq', title: title || '', intro, items: items.map((i) => ({ q: i.q, a: i.parts.map((p) => (p.html || '')).join('') })) };
}
// "Label: text" / "Label — text" / "<strong>Label</strong> text"
function featOf(item) {
  const strong = /^<(strong|b)>([^<]{2,70})<\/\1>\s*[:\-–—]?\s*(.*)$/is.exec(item.html);
  if (strong) return { title: strip(strong[2]).replace(/[:\-–—]\s*$/, ''), text: strip(strong[3]), full: item.text };
  const st = /^(step\s*\d+\s*:)\s+(.+)$/is.exec(item.text);
  if (st) return { title: st[1], text: st[2].trim(), full: item.text };
  const m = /^(.{3,60}?)(?:\s*[:]\s+|\s+[—–]\s+)(.+)$/s.exec(item.text);
  return m ? { title: m[1].trim(), text: m[2].trim(), full: item.text } : { title: item.text, text: '', full: item.text };
}
const stepClean = (t) => t.replace(/^step\s*\d+\s*[:.)\-–—]\s*/i, '');
// a run of short lines with no sentence ends is a list the old page wrote as paragraphs
function shortRun(ps) {
  const isShort = (p) => p.k === 'p' && !p.link && p.text.length > 2 && p.text.length < 72 && !/[.!?:]$/.test(p.text);
  let i = 0;
  while (i < ps.length) {
    if (isShort(ps[i])) { let j = i; while (j < ps.length && isShort(ps[j])) j += 1; if (j - i >= LONG_RUN) return [i, j]; i = j; } else i += 1;
  }
  return null;
}

// consecutive link-only paragraphs are a row of buttons, the first one the call to action
function linkRow(links) {
  const hasCta = links.findIndex((l) => CTA_WORD.test(l.text));
  return `<div class="not-prose mt-6 flex flex-wrap items-center gap-3">${links.map((l, i) => `<a class="${T.btn} ${i === (hasCta < 0 ? 0 : hasCta) ? T.btnPrimary : T.btnGhost}" href="${l.href}">${l.text}</a>`).join(' ')}</div>`;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function withLinkRows(ps) {
  const out = [];
  for (let i = 0; i < ps.length; i += 1) {
    const p = ps[i];
    const cand = (x) => x && ((x.k === 'p' && x.link) || (x.k === 'list' && x.items.length && x.items.every((it) => it.linkOnly)));
    if (cand(p)) {
      const links = [];
      let j = i;
      while (cand(ps[j])) { if (ps[j].k === 'p') links.push({ text: ps[j].text, href: esc(ps[j].href) }); else ps[j].items.forEach((it) => links.push({ text: it.text, href: esc(it.href) })); j += 1; }
      if (links.length >= 2 || links.some((l) => CTA_WORD.test(l.text))) { out.push({ k: 'p', html: linkRow(links), text: '' }); i = j - 1; continue; }
    }
    out.push(p);
  }
  return out;
}

// a list beside a picture is the picture-and-text layout with its check list
const itemText = (i) => (typeof i === 'string' ? i : i.full || [i.title, i.text].filter(Boolean).join(' '));
const introBlocks = (v) => (Array.isArray(v) ? v : v ? [{ t: 'html', html: /^\s*</.test(v) ? v : `<p>${esc(v)}</p>` }] : []);
const toAbout = (f) => (f.items.some((i) => /<a\b/.test(itemText(i))) ? f : { type: 'prose', title: f.title, blocks: introBlocks(f.intro || f.lead), items: f.items.map(itemText), img: f.img, imgAlt: f.imgAlt });

// ---------- one section ----------
function convert(s, design) {
  const title = s.title || '';
  const ps = withLinkRows(pieces(s.blocks));
  if (!ps.length) return [s];

  const faq = faqOf(title, ps.filter((p) => !(p.k === 'p' && p.html.includes('not-prose'))));
  if (faq && !ps.some((p) => p.k === 'p' && p.html.includes('not-prose'))) return s.img ? [faq, { type: 'prose', title: '', blocks: [{ t: 'img', src: s.img, alt: s.imgAlt || '' }] }] : [faq]; // (the picture of the section is not lost)

  // steps: a titled section whose list reads as a sequence
  const list = ps.find((p) => p.k === 'list' && p.items.length >= 3 && !p.items.every((it) => it.linkOnly));
  if (list) {
    const at = ps.indexOf(list);
    const before = ps.slice(0, at), after = ps.slice(at + 1);
    const stepLike = STEP_TITLE.test(title) || list.ordered || list.items.filter((it) => /^step\s*\d/i.test(it.text)).length >= 2;
    const items = list.items.map(featOf);
    const shortList = list.items.every((it) => it.text.length <= 190);
    if (shortList && !before.some((p) => p.k === 'table' || p.k === 'img') && before.length <= 2 && before.every((p) => p.k === 'p' && !p.link)) {
      const intro = before.map((p) => ({ t: 'html', html: p.html }));
      const main = stepLike
        ? { type: 'steps', title, intro, lead: strip(before.map((p) => p.text).join(' ')), items }
        : { type: 'features', title, intro, items };
      if (stepLike && before.some((p) => /<a\b/.test(p.html))) { /* a link in the lead would be lost in a plain lead: keep it as its own text */ main.lead = ''; }
      const tail = after.length ? [{ type: 'prose', title: '', blocks: asBlocks(after) }] : [];
      if (s.img && !stepLike) return [toAbout({ ...main, img: s.img, imgAlt: s.imgAlt }), ...tail];
      return [main, ...tail];
    }
  }
  // short lines written as paragraphs are a list as well
  const run = shortRun(ps);
  if (run && ps.slice(0, run[0]).every((p) => p.k === 'p' && !p.link) && run[0] <= 2) {
    const before = ps.slice(0, run[0]), after = ps.slice(run[1]);
    const items = ps.slice(run[0], run[1]).map((p) => ({ title: p.text, text: '' }));
    const tail = after.length ? [{ type: 'prose', title: '', blocks: asBlocks(after) }] : [];
    const feat = { type: 'features', title, intro: before.map((p) => ({ t: 'html', html: p.html })), items };
    return [s.img ? toAbout({ ...feat, img: s.img, imgAlt: s.imgAlt }) : feat, ...tail];
  }
  // pictures with a caption, side by side
  const imgs = ps.filter((p) => p.k === 'img').length;
  if (imgs >= 2 && imgs === ps.filter((p) => p.k === 'p' && !p.link).length) {
    const cards = []; let cur = null;
    for (const p of ps) { if (p.k === 'img') { cur = { b: p.b, caps: [] }; cards.push(cur); } else if (cur && p.k === 'p') cur.caps.push(p.html); else return [{ ...s, blocks: asBlocks(ps) }]; }
    const html = `<div class="not-prose grid gap-[var(--k-gap)] sm:grid-cols-2 lg:grid-cols-3">${cards.map((c) => `<figure class="m-0 grid content-start gap-3 overflow-hidden rounded-k border border-default bg-surface p-3 shadow-k1"><img class="aspect-[4/3] w-full rounded-[calc(var(--k-r)*.7)] object-cover" src="${esc(c.b.src)}" alt="${esc(c.b.alt || '')}" loading="lazy" decoding="async"><figcaption class="px-2 pb-2 text-secondary">${c.caps.map((h) => h.replace(/^<p>|<\/p>$/g, '')).join('<br>')}</figcaption></figure>`).join('')}</div>`;
    return [{ type: 'prose', title, wide: true, blocks: [{ t: 'html', html }] }];
  }
  return [{ ...s, blocks: asBlocks(ps) }];
}

// the pictures of a page are shared out: a picture with no text of its own goes to the text next to it
export function restructure(sections, design) {
  const out = [];
  for (let s of sections) {
    if ((s.type === 'prose' || s.type === 'split') && s.blocks) {
      if (s.img && DECOR.test(String(s.img).split('/').pop().replace(/\.svg$/i, ''))) s = { ...s, img: '' };
      out.push(...convert(s, design));
    } else out.push(s);
  }
  // a section of one picture only
  const picOnly = (s) => s.type === 'prose' && !s.title && s.blocks?.length === 1 && s.blocks[0].t === 'img';
  const res = [];
  let held = null;
  for (let i = 0; i < out.length; i += 1) {
    const s = out[i];
    if (picOnly(s)) {
      const b = s.blocks[0];
      const next = out.slice(i + 1).find((x) => !picOnly(x));
      const prev = res[res.length - 1];
      const takes = (x) => x && ['prose', 'split', 'features'].includes(x.type) && !x.img && x.title;
      if (takes(next) && next === out[i + 1]) { held = b; continue; }
      if (takes(prev)) { Object.assign(prev, prev.type === 'features' ? toAbout({ ...prev, img: b.src, imgAlt: b.alt }) : { img: b.src, imgAlt: b.alt }); continue; }
      res.push(s); continue;
    }
    if (held && ['prose', 'split', 'features'].includes(s.type) && !s.img) { res.push(s.type === 'features' ? toAbout({ ...s, img: held.src, imgAlt: held.alt }) : { ...s, img: held.src, imgAlt: held.alt }); held = null; continue; }
    if (held) { res.push({ type: 'prose', title: '', blocks: [held] }); held = null; }
    res.push(s);
  }
  if (held) res.push({ type: 'prose', title: '', blocks: [held] });
  return res;
}
