import path from 'node:path';
import * as cheerio from 'cheerio';
import { esc } from '../util/html.js';
import { repairJsonLd } from '../build/render.js';
import { fillPattern } from './own-fill.js';
import { isTrackingScript } from '../build/model.js';

// Converts a legacy page into one of the site's own modern pages. The modern page (the "template page") is kept as it is: its head
// (stylesheets, fonts, scripts), header, footer, hero and call-to-action band. What changes is the content: the page's title and
// metadata, the H1, the breadcrumb, the text between hero and footer, and the form. The text is written with the class names the
// template page itself uses for headings, paragraphs, lists and links, so the compiled stylesheet of the site already styles it.
// Cards, FAQs, reviews and link lists use the section designs of the pattern library (own-patterns.js), in page order.
//
//   convertPage({ model, templateHtml, templateRel, targetRel, patterns })  ->  { html, notes }
//
// model is the content model of the legacy page (build/model.js). Every decision that could not be made is reported in notes.

const SKIP = new Set(['script', 'style', 'noscript', 'link', 'meta', 'template']);
const PROSE = new Set(['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote', 'table', 'figure']);
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const wordsOf = ($, el) => norm($(el).text()).split(' ').filter(Boolean).length;
const PATTERN_OF = { cardgrid: 'cards', cards: 'cards', faq: 'faq', reviews: 'reviews', links: 'links', related: 'links', cta: 'cta' };

// ---------- URLs ----------
// the template page may sit in another folder than the page being built: relative links in its chrome are re-pointed
export function relocate($, fromRel, toRel) {
  const fromDir = path.posix.dirname(fromRel), toDir = path.posix.dirname(toRel);
  if (fromDir === toDir) return;
  const fix = (v) => {
    if (!v || /^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(v.trim())) return v;
    const m = v.trim().match(/^([^?#]*)(.*)$/);
    const abs = path.posix.normalize(path.posix.join(fromDir, m[1]));
    if (abs.startsWith('..')) return v;
    return (path.posix.relative(toDir, abs) || path.posix.basename(abs)) + m[2];
  };
  $('[href], [src], [data-src], [poster], [action]').each((_, e) => {
    for (const a of ['href', 'src', 'data-src', 'poster', 'action']) if ($(e).attr(a) != null) $(e).attr(a, fix($(e).attr(a)));
  });
  $('[srcset], [data-srcset]').each((_, e) => {
    for (const a of ['srcset', 'data-srcset']) {
      const v = $(e).attr(a);
      if (v) $(e).attr(a, v.split(',').map((part) => { const [u, ...rest] = part.trim().split(/\s+/); return [fix(u), ...rest].join(' '); }).join(', '));
    }
  });
}

// ---------- finding the parts of the template page ----------
export function regions($) {
  const header = $('header').first().length ? $('header').first() : $('[id*="header" i], [class*="header" i]').first();
  const footer = $('footer').last().length ? $('footer').last() : $('[id*="footer" i], [class*="footer" i]').last();
  // the page holds everything between the header and the footer: the hero may sit outside <main>
  let region = $('body');
  if (header.length && footer.length) {
    const up = (n) => { const a = []; for (let e = n.parent; e; e = e.parent) a.push(e); return a; };
    const fa = new Set(up(footer.get(0)));
    const common = up(header.get(0)).find((e) => fa.has(e) && e.type === 'tag');
    if (common) region = $(common);
  } else if ($('main').first().length) region = $('main').first();
  else if (header.length) region = header.parent();
  else if (footer.length) region = footer.parent();
  return { header, footer, region };
}

export function unitsOf($, region, header, footer) {
  const hd = header.get(0), ft = footer.get(0), root = region.get(0);
  const topOf = (n) => { let e = n; while (e && e.parent !== root) e = e.parent; return e; };
  const pick = (parent, from, to) => {
    const all = $(parent).children().toArray();
    const hi = from ? all.indexOf(from) : -1, fi = to && all.includes(to) ? all.indexOf(to) : all.length;
    return all.filter((e, i) => e.type === 'tag' && !SKIP.has(e.name) && e !== hd && e !== ft && i > hi && i < fi && !/(?:^|\s)fixed(?:\s|$)/.test($(e).attr('class') || ''));
  };
  const open = (list) => list.flatMap((e) => (e.name === 'main' ? pick(e) : [e]));
  let kids = open(pick(root, hd ? topOf(hd) : null, ft ? topOf(ft) : null));
  // a single wrapper holding everything: look inside it
  for (let n = 0; n < 2 && kids.length === 1 && $(kids[0]).children().filter((_, c) => c.type === 'tag').length > 1; n += 1) kids = open(pick(kids[0]));
  return kids;
}

// a section on a dark background has light text: it is not where the running text of a page belongs
const DARK = /(?:^|\s)(?:bg-(?:brand-dark|black|slate-[89]00|gray-[89]00|zinc-[89]00|neutral-[89]00|stone-[89]00)|on-dark|text-on-dark)(?:\s|$|\/)/;
function hostScore($, unit) {
  let best = 0;
  $(unit).find('*').addBack().each((_, e) => {
    if (e.type !== 'tag' || SKIP.has(e.name) || ['aside', 'form', 'nav', 'header', 'footer'].includes(e.name) || $(e).closest('aside, form, nav').length) return;
    const kids = $(e).children().toArray().filter((c) => PROSE.has(c.name));
    if (kids.length < 2) return;
    best = Math.max(best, kids.length * 10 + kids.reduce((w, c) => w + wordsOf($, c), 0));
  });
  return best;
}
// a section is known by its id, else by its position
export const unitKey = ($, el, i) => $(el).attr('id') || `u${i}`;
export function classify($, units) {
  const infos = units.map((el) => {
    const u = $(el);
    // running text is made of long paragraphs; cards and lists of links have short ones
    const long = u.find('p').toArray().filter((p) => !$(p).closest('aside, form').length).reduce((n, p) => { const w = wordsOf($, p); return w >= 15 ? n + w : n; }, 0);
    const dark = DARK.test(u.attr('class') || '') || DARK.test(u.children().first().attr('class') || '');
    return { el, dark, host: hostScore($, el), words: wordsOf($, el), long, h1: u.is('h1') || u.find('h1').length > 0, form: u.find('form, #mf_placeholder').length > 0, tel: u.find('a[href^="tel:"]').length > 0, heads: u.find('h2, h3').length, paras: u.find('p').length, lists: u.find('ul, ol').length };
  });
  const hero = infos.find((i) => i.h1) || infos[0] || null;
  const rest = infos.filter((i) => i !== hero);
  const cta = rest.filter((i) => i.tel && i.words < 90 && !i.form);
  const others = rest.filter((i) => !cta.includes(i));
  const score = (i) => (i.host + i.words * 0.05) * (i.dark ? 0.1 : 1);
  const content = [...others].sort((a, b) => score(b) - score(a))[0] || (hero && hero.words > 150 ? hero : null);
  const hi = infos.indexOf(hero), ci = infos.indexOf(content);
  const bands = others.filter((i) => i !== content && infos.indexOf(i) > hi && infos.indexOf(i) < ci && i.heads === 0 && !i.form && i.words < 80);
  return { infos, hero, cta, content, bands, formUnit: others.find((i) => i.form && i !== content && !bands.includes(i)) || null };
}

// the element that holds the running text: the one with the most headings, paragraphs and lists as direct children
export function proseHost($, unit) {
  let best = null, bestN = 0;
  $(unit).find('*').addBack().each((_, e) => {
    if (e.type !== 'tag' || SKIP.has(e.name) || ['aside', 'form', 'nav', 'header', 'footer'].includes(e.name) || $(e).closest('aside, form, nav').length) return;
    const kids = $(e).children().toArray().filter((c) => PROSE.has(c.name));
    const n = kids.length >= 2 ? kids.length * 10 + kids.reduce((w, c) => w + wordsOf($, c), 0) : 0;
    if (n > bestN) { best = e; bestN = n; }
  });
  return best && bestN > 0 ? best : null;
}

// the class names the template page puts on each kind of text element
export function styleMap($, scope, fallback) {
  const out = {};
  const dark = (root, e) => $(e).parentsUntil(root).toArray().some((a) => DARK.test($(a).attr('class') || ''));
  for (const tag of ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'img', 'blockquote', 'table', 'figure']) {
    for (const root of [scope, fallback]) {
      const counts = new Map();
      let total = 0, classed = 0;
      $(root).find(tag).each((_, e) => {
        if ($(e).closest('header, footer, nav, aside, form').length || dark(root, e)) return;
        total += 1;
        const c = norm($(e).attr('class'));
        if (c) { classed += 1; counts.set(c, (counts.get(c) || 0) + Math.max(1, norm($(e).text()).length)); }
      });
      // most of them without a class: the look comes from the container (a prose rule), so the old text gets no class either
      if (total && classed / total < 0.5) break;
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) { out[tag] = top[0]; break; }
    }
  }
  // links inside running text, not buttons or menu items
  for (const root of [scope, fallback]) {
    const counts = new Map();
    $(root).find('p a, li a').each((_, e) => { if (!$(e).closest('header, footer, nav, aside, form').length && !dark(root, e) && !/\b(btn|button)\b/i.test($(e).attr('class') || '')) { const c = norm($(e).attr('class')); if (c) counts.set(c, (counts.get(c) || 0) + 1); } });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) { out.a = top[0]; break; }
  }
  return out;
}

// ---------- the legacy home page, as the same kind of blocks as any other page ----------
const para = (h) => `<p>${h}</p>`;
export function homeBlocks(home) {
  const b = [];
  const H = (title) => title && b.push({ t: 'h', level: 2, text: title });
  const hp = home.help || {};
  H(hp.title); (hp.left || []).concat(hp.right || []).forEach((p) => b.push({ t: 'html', html: para(p) }));
  const sv = home.services || {};
  if ((sv.cards || []).length) b.push({ t: 'cardgrid', title: sv.title, items: sv.cards.map((c) => ({ title: c.title, text: c.text, href: c.href, img: c.img, imgAlt: c.imgAlt, icon: c.icon })) });
  else H(sv.title);
  (sv.intro || []).forEach((p) => b.push({ t: 'html', html: para(p) }));
  const sd = home.sameDay || {};
  if ((sd.items || []).length) { H(sd.title); b.push({ t: 'html', html: `<ul>${sd.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` }); }
  const ab = home.about || {};
  H(ab.title); (ab.blocks || []).forEach((x) => b.push({ t: 'html', html: x.p ? para(x.p) : `<ul>${(x.ul || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` }));
  const ms = home.mission || {};
  H(ms.title); (ms.intro || []).forEach((p) => b.push({ t: 'html', html: para(p) }));
  if ((ms.boxes || []).length) b.push({ t: 'cardgrid', items: ms.boxes.map((x) => ({ title: x.title, text: norm(x.text), icon: x.icon })) });
  const rv = home.reviews || {};
  if ((rv.items || []).length) b.push({ t: 'reviews', title: rv.title, items: rv.items });
  const fq = home.faq || {};
  if ((fq.items || []).length) { (fq.intro || []).forEach((p) => b.push({ t: 'html', html: para(p) })); b.push({ t: 'faq', title: fq.title, items: fq.items }); }
  const ar = home.areas || [];
  if (ar.length) b.push({ t: 'related', groups: ar.map((g) => ({ title: g.title, links: (g.links || []).map((l) => ({ href: l.href, t: l.text })) })) });
  const fm = home.family || {};
  H(fm.title); (fm.paragraphs || []).forEach((p) => b.push({ t: 'html', html: para(p) }));
  return b;
}

// ---------- the legacy page's content, written with the template's classes ----------
function styled(html, st) {
  const $f = cheerio.load(`<div id="r">${html}</div>`, null, false);
  for (const tag of ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'table', 'img', 'a']) {
    if (!st[tag]) continue;
    $f('#r').find(tag).each((_, e) => { if (!$f(e).attr('class')) $f(e).attr('class', st[tag]); });
  }
  $f('#r a[target="_blank"]').each((_, a) => { if (!$f(a).attr('rel')) $f(a).attr('rel', 'noopener'); });
  return $f('#r').html();
}

// Segments in page order: running text, and sections made with a pattern of the library. Without a pattern a block is plain text.
function renderBlocks(model, st, patterns, notes, formBox = false, mark = false, hints = null) {
  const tag = (kind, html) => (mark ? html.replace(/^(\s*<[a-z0-9-]+)/i, `$1 data-pattern="${kind}"`) : html);
  const cls = (t) => { const c = st[t] || (t === 'h4' ? st.h3 : ''); return c ? ` class="${esc(c)}"` : ''; };
  const blocks = (model.blocks && model.blocks.length ? model.blocks : model.home ? homeBlocks(model.home) : []).filter((b) => b.t !== 'break');
  // the heading over a form is the form box's title, not part of the page's outline
  // the outline of the old page: a heading is a sub-heading only when a shallower heading came before it and has not been closed by a
  // heading of its own level; headings of one level that follow each other are peers, whatever number the old page gave them
  const depth = new Map();
  { const stack = []; blocks.forEach((b, i) => { if (b.t !== 'h' || blocks[i + 1]?.t === 'form') return; const l = b.level === 1 ? 2 : b.level; while (stack.length && stack[stack.length - 1] >= l) stack.pop(); stack.push(l); depth.set(b, stack.length); }); }
  const levelOf = (b) => Math.min(4, 1 + (depth.get(b) || 1));
  const segs = [];
  let ctaData = null, form = false, seenHeading = false;
  const prose = (html) => { const last = segs[segs.length - 1]; if (last?.type === 'prose') last.html += `\n${html}`; else segs.push({ type: 'prose', html }); };
  const link = (l) => `<a${cls('a')} href="${esc(l.href)}">${esc(l.t || l.title || l.text || l.href)}</a>`;
  const used = new Set();
  const itemsOf = (b) => (b.t === 'links' ? (b.items || []).map((x) => ({ title: x.t || x.title || x.text, href: x.href })) : b.items || []);

  // text for a pattern block that has no pattern in the library
  const fallback = (b) => {
    switch (b.t) {
      case 'cardgrid': case 'cards': return `${b.title ? `<h2${cls('h2')}>${esc(b.title)}</h2>` : ''}${(b.items || []).map((i) => `<h3${cls('h3')}>${esc(i.title || i.text || '')}</h3>${i.title && i.text ? `<p${cls('p')}>${esc(i.text)}</p>` : ''}${i.href ? `<p${cls('p')}>${link({ href: i.href, t: 'Learn more' })}</p>` : ''}`).join('')}`;
      case 'faq': return `${b.title ? `<h2${cls('h2')}>${esc(b.title)}</h2>` : ''}${(b.items || []).map((f) => `<h3${cls('h3')}>${esc(f.q)}</h3>${/<[a-z]/i.test(f.a) ? f.a : `<p${cls('p')}>${esc(f.a)}</p>`}`).join('')}`;
      case 'reviews': return `${b.title ? `<h2${cls('h2')}>${esc(b.title)}</h2>` : ''}${(b.items || []).map((r) => `<blockquote${cls('blockquote')}><p>${esc(r.quote)}</p>${r.name ? `<cite>${esc(r.name)}</cite>` : ''}</blockquote>`).join('')}`;
      case 'links': return `${b.title ? `<h2${cls('h2')}>${esc(b.title)}</h2>` : ''}<ul${cls('ul')}>${itemsOf(b).map((i) => `<li${cls('li')}>${link(i)}</li>`).join('')}</ul>`;
      case 'related': return (b.groups || []).map((g) => `<h3${cls('h3')}>${esc(g.title)}</h3><ul${cls('ul')}>${(g.links || []).map((i) => `<li${cls('li')}>${link(i)}</li>`).join('')}</ul>`).join('');
      case 'cta': return `${b.title ? `<h3${cls('h3')}>${esc(b.title)}</h3>` : ''}${b.text ? `<p${cls('p')}>${esc(b.text)}</p>` : ''}${b.href ? `<p${cls('p')}>${link({ href: b.href, t: b.label || 'Call now' })}</p>` : ''}`;
      default: return '';
    }
  };

  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const kind = PATTERN_OF[b.t];
    if (kind === 'cta') { if (patterns?.cta) ctaData = { title: b.title, text: b.text, href: b.href, label: b.label }; else prose(fallback(b)); continue; }
    if (kind) {
      const rec = patterns?.[kind];
      if (!rec) { prose(fallback(b)); continue; }
      // a heading right before the section is the section's title
      let title = b.title;
      if (!title && (b.t === 'cardgrid' || b.t === 'cards') && hints?.length) {
        const mine = new Set((b.items || []).map((i) => String(i.title || '').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean));
        const hit = mine.size >= 3 && hints.find((h) => h.items.filter((t) => mine.has(t)).length >= Math.ceil(mine.size / 2));
        if (hit) title = hit.heading;
      }
      const before = segs[segs.length - 1];
      if (!title && before?.type === 'prose' && blocks[i - 1]?.t === 'h') {
        const m = before.html.match(/\n?<h[2-4][^>]*>([^<]*)<\/h[2-4]>\s*$/);
        if (m) { title = m[1]; before.html = before.html.slice(0, m.index).trimEnd(); if (!before.html) segs.pop(); }
      }
      if (b.t === 'related') for (const g of b.groups || []) segs.push({ type: 'section', kind, html: tag(kind, fillPattern(rec, { title: g.title, items: (g.links || []).map((x) => ({ title: x.t || x.title || x.text, href: x.href })) })) });
      else segs.push({ type: 'section', kind, html: tag(kind, fillPattern(rec, { title, items: itemsOf(b) })) });
      used.add(`${kind}:${rec.source}`);
      continue;
    }
    switch (b.t) {
      case 'h': { const lv = levelOf(b); const c = lv === 2 && seenHeading && st.h2next ? ` class="${esc(st.h2next)}"` : cls('h' + lv); seenHeading = true; prose(`<h${lv}${c}>${esc(b.text)}</h${lv}>`); break; }
      case 'html': prose(styled(b.html, st)); break;
      case 'img': prose(`<figure${cls('figure')}><img${cls('img')} src="${esc(b.src)}" alt="${esc(b.alt || '')}"${b.width ? ` width="${esc(b.width)}"` : ''}${b.height ? ` height="${esc(b.height)}"` : ''} loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`); break;
      case 'callout': prose(`${b.title ? `<h3${cls('h3')}>${esc(b.title)}</h3>` : ''}${b.text ? `<p${cls('p')}>${esc(b.text)}</p>` : ''}`); break;
      case 'form':
        if (model.protected?.form) {
          form = true;
          if (formBox) { const last = segs[segs.length - 1]; if (last?.type === 'prose' && blocks[i - 1]?.t === 'h') { last.html = last.html.replace(/\n?<h[2-4][^>]*>[^<]*<\/h[2-4]>\s*$/, '').trimEnd(); if (!last.html) segs.pop(); } } else prose(model.protected.form);
        }
        break;
      case 'raw': if (b.why === 'iframe') prose(`<div class="my-6">${b.html}</div>`); else notes.add(`A part of the old page ("${b.why}") could not be carried over.`); break;
      default: break;
    }
  }
  for (const u of used) { const [k, src] = u.split(':'); if (src === 'generated') notes.add(`The ${k} sections use a design generated in the template's style, because the template pages have none.`); }
  return { segs, form, ctaData };
}

// ---------- the new head ----------
export function newHead($, model, templateHtml) {
  const head = $('head');
  head.find('title, meta[name="description"], link[rel="canonical"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], script[type="application/ld+json"]').remove();
  const h = model.head;
  const lines = [`<title>${esc(h.title)}</title>`, `<meta name="description" content="${esc(h.description)}">`];
  if (h.robots) lines.push(`<meta name="robots" content="${esc(h.robots)}">`);
  if (h.canonical) lines.push(`<link rel="canonical" href="${esc(h.canonical)}">`);
  lines.push(...(h.metas || []));
  for (const raw of h.jsonLd || []) { const r = repairJsonLd(raw); if (r.json) lines.push(`<script type="application/ld+json">${r.json}</script>`); }
  // tracking of the old page stays only when the template page does not already carry it
  // (the old design's own scripts, such as its menu, are not carried over: the template has its own)
  const IDS = /\b(G-[A-Z0-9]{6,}|UA-\d+-\d+|GTM-[A-Z0-9]+|AW-\d+)\b/g;
  const ws = (t) => String(t).replace(/\s+/g, '');
  for (const s of model.protected?.headScripts || []) {
    if (!isTrackingScript(s) || ws(templateHtml).includes(ws(s))) continue;
    const ids = s.match(IDS) || [];
    if (ids.length && ids.every((id) => templateHtml.includes(id))) continue;
    lines.push(s);
  }
  head.find('meta[name="viewport"]').first().length ? head.find('meta[name="viewport"]').first().after(lines.join('\n')) : head.prepend(lines.join('\n'));
}

// ---------- the page ----------
// paragraphs, lists and headings need room: spacing classes the stylesheet already has are added where the template's own classes carry none
function addSpacing(st, vocab, hostClass) {
  if (!vocab || /(?:^|\s)(?:prose|space-y-\d+)(?:\s|$)/.test(hostClass || '')) return st;
  const pick = (c) => c.find((t) => vocab.has(t)) || '';
  const out = { ...st };
  const add = (tag, cls, test) => { if (cls && !test.test(out[tag] || '')) out[tag] = `${out[tag] || ''} ${cls}`.trim(); };
  add('p', pick(['mb-4', 'mb-5', 'mb-3', 'mb-6']), /(?:^|\s)(?:[a-z-]+:)*-?m[by]?-/);
  add('ul', pick(['mb-4', 'mb-6', 'mb-5']), /(?:^|\s)(?:[a-z-]+:)*-?m[by]?-|space-y/);
  add('ol', pick(['mb-4', 'mb-6', 'mb-5']), /(?:^|\s)(?:[a-z-]+:)*-?m[by]?-|space-y/);
  for (const h of ['h2', 'h3', 'h4']) add(h, pick(['mt-8', 'mt-6', 'mt-10']), /(?:^|\s)(?:[a-z-]+:)*-?m[ty]?-/);
  // a heading after the first one of the text needs room above, even where the template's lead heading has a small top margin
  const room = pick(['mt-10', 'mt-8', 'mt-6']);
  if (out.h2 && room) out.h2next = `${out.h2.split(/\s+/).filter((t) => !/^mt-\d+$/.test(t)).join(' ')} ${room}`.trim();
  return out;
}

export function convertPage({ model, templateHtml, templateRel, targetRel, patterns = null, vocab = null, roles = null, markPatterns = false, hints = null }) {
  if (!model?.ok) throw new Error('The old page could not be read (unrecognised layout).');
  const $ = cheerio.load(templateHtml);
  const notes = new Set();
  relocate($, templateRel, targetRel);

  const { header, footer, region } = regions($);
  const units = unitsOf($, region, header, footer);
  const auto = classify($, units);
  let { hero, cta, content, formUnit, bands } = auto;
  // roles chosen by the user for the template's sections win over the automatic ones
  if (roles) {
    units.forEach((u, i) => {
      const r = roles[unitKey($, u, i)], info = auto.infos[i];
      if (!r) return;
      cta = cta.filter((c) => c !== info); bands = bands.filter((b) => b !== info);
      if (formUnit === info) formUnit = null;
      if (r === 'hero') hero = info; else if (r === 'text') content = info; else if (r === 'band') bands = [...bands, info]; else if (r === 'cta') cta = [...cta, info]; else if (r === 'form') formUnit = info;
    });
  }
  if (!hero) throw new Error('The template page has no main content area.');
  if (!content || (content.words < 30 && content.heads + content.paras < 3)) throw new Error('The template page has no text area the converter can fill. Choose a page with a text section.');

  // hero: the page's own title, a short line from its description, a rebuilt breadcrumb
  const h1 = $(hero.el).find('h1').first().length ? $(hero.el).find('h1').first() : $(hero.el).filter('h1');
  if (h1.length) h1.text(model.hero.h1);
  const sub = h1.nextAll('p').first();
  if (sub.length) {
    let d = norm(model.head.description);
    // a description cut off in the middle of a sentence loses the unfinished part
    if (d && !/[.!?]$/.test(d)) { const done = d.match(/^.*[.!?](?=\s)/); d = done ? done[0] : d; }
    if (d && d.length <= 200) sub.text(d); else sub.remove();
  }
  const crumbNav = $(hero.el).find('nav[aria-label*="readcrumb" i], [class*="breadcrumb" i]').first();
  if (crumbNav.length) {
    const lis = crumbNav.find('li');
    const crumbs = model.hero.crumbs || [];
    if (!lis.length || !crumbs.length) { if (!crumbs.length) crumbNav.remove(); else notes.add('The breadcrumb of the template page has no list items, so it was left as it is.'); } else {
      const first = lis.first(), last = lis.length > 1 ? lis.last() : lis.first();
      const parent = first.parent();
      const items = crumbs.map((c, i) => {
        const li = (i === crumbs.length - 1 ? last : first).clone();
        const a = li.find('a').first();
        if (a.length) { a.text(c.text); if (c.href && i < crumbs.length - 1) a.attr('href', c.href); else if (i === crumbs.length - 1) a.removeAttr('href'); } else li.find('span').first().length ? li.find('span').first().text(c.text) : li.text(c.text);
        return $.html(li);
      });
      lis.remove();
      parent.append(items.join(''));
    }
  } else if ((model.hero.crumbs || []).length) notes.add('The template page has no breadcrumb, so the breadcrumb of the old page was dropped.');

  // the text and the sections
  const host = proseHost($, content.el) || $(content.el).children().filter((_, c) => c.type === 'tag' && !SKIP.has(c.name)).first().get(0) || content.el;
  const st = addSpacing(styleMap($, host, region.get(0)), vocab, $(host).attr('class'));
  // a picture in the text: its natural height, with the rounded corners and shadow the template's pictures have when the stylesheet has them
  { const has = (c) => !vocab || vocab.has(c); const base = String(st.img || '').split(/\s+/).filter((c) => c && c !== 'h-full' && c !== 'object-cover'); const add = [['h-auto', /^h-/], ['rounded-2xl', /^rounded/], ['shadow-lg', /^shadow/]].filter(([c, re]) => has(c) && !base.some((b) => re.test(b))).map(([c]) => c); st.img = [...new Set([...(base.length ? base : ['w-full']), ...add])].join(' '); }
  // the template's form box (not the header's search box): found before the text is poured in
  const tplForm = $(region).find('form, #mf_placeholder').filter((_, f) => !$(f).closest('header, footer, nav').length).first();
  const { segs, form: formInBody, ctaData } = renderBlocks(model, st, patterns, notes, Boolean(tplForm.length), markPatterns, hints);
  const keepH1 = $(host).find('h1').first().length ? $.html($(host).find('h1').first()) : '';
  const sidebar = $(content.el).find('aside, form, #mf_placeholder').length > 0;
  const sections = segs.filter((s) => s.type === 'section');
  if (!sections.length || sidebar || content.el === hero.el) {
    // one text area: all text in it; sections (if any) follow it as full-width bands
    $(host).html(`${keepH1}\n${segs.filter((s) => s.type === 'prose').map((s) => s.html).join('\n')}\n`);
    if (sections.length) $(content.el).after(sections.map((s) => s.html).join('\n'));
  } else {
    // text and sections in the order of the old page: the text area is repeated for every stretch of text
    const hostIndex = host === content.el ? -1 : $(content.el).find('*').toArray().indexOf(host);
    const pieces = segs.map((s) => {
      if (s.type === 'section') return s.html;
      const proto = $(content.el).clone();
      const h = hostIndex < 0 ? proto : $($(proto).find('*').toArray()[hostIndex]);
      h.html(`${s.html}\n`);
      return $.html(proto);
    });
    $(content.el).replaceWith(pieces.join('\n'));
  }

  // the form
  const holder = (f) => { const a = f.closest('aside'); if (a.length) return a; const p = f.parent(); return p.length && !p.is(region) && wordsOf($, p.get(0)) < 60 ? p : f; };
  if (tplForm.length) {
    if (model.protected?.form) {
      tplForm.nextAll('script').filter((_, sc) => /mf_placeholder|mform/i.test($(sc).html() || '')).first().remove();
      tplForm.replaceWith(model.protected.form);
    } else { holder(tplForm).remove(); notes.add('The old page has no form, so the form of the template page was removed.'); }
  } else if (model.protected?.form && !formInBody) notes.add('The old page has a form, but the template page has no form area to put it in.');

  // everything else in the main area belonged to the template page's own subject; only the closing call-to-action band stays
  const band = cta.length ? [cta[cta.length - 1]] : [];
  const keep = new Set([...units.filter((u, i) => roles?.[unitKey($, u, i)] === 'common'), hero.el, content.el, ...(formUnit ? [formUnit.el] : []), ...band.map((c) => c.el), ...bands.map((c) => c.el)]);
  let removed = 0;
  for (const u of units) { if (!keep.has(u) && !$(u).find($(content.el)).length && !$(content.el).closest(u).length) { $(u).remove(); removed += 1; } }
  if (removed) notes.add(`${removed} section(s) of the template page that belong to its own subject (cards, reviews, FAQ...) were not copied.`);
  if (formUnit && !$(formUnit.el).find('form, #mf_placeholder').length && !$(formUnit.el).text().trim()) $(formUnit.el).remove();

  // the closing band carries the old page's own call to action when it has one
  if (ctaData && patterns?.cta && band.length) { const filled = fillPattern(patterns.cta, ctaData); $(band[0].el).replaceWith(markPatterns ? filled.replace(/^(\s*<[a-z0-9-]+)/i, '$1 data-pattern="cta"') : filled); }

  newHead($, model, templateHtml);
  return { html: $.html(), notes: [...notes] };
}
