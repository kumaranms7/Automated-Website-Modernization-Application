import * as cheerio from 'cheerio';
import { plain } from '../util/html.js';

// Turns a page's content into the sections a home page is made of (hero, offers, services grid, stats, reviews,
// FAQ, areas ...). Two sources: the structured extraction of the pilot site's home page, or - for any other site -
// a classification of the generic content blocks by their shape.

const wrap = (htmls) => htmls.map((html) => ({ t: 'html', html: /^<(p|ul|ol|table|blockquote)\b/i.test(html) ? html : `<p>${html}</p>` }));

export function composeHome(model, site) {
  return model.home ? fromRecipe(model, site) : fromBlocks(model, site);
}

// ---------- the pilot site's recipe ----------
function fromRecipe(model, site) {
  const h = model.home;
  const hero = {
    eyebrow: h.hero.eyebrow, h1: h.hero.h1, leadHtml: '', bullets: h.hero.bullets, image: null,
    buttons: h.hero.buttons.map((b) => ({ text: b.text, href: b.href, accent: b.accent })),
    cards: h.hero.cards.length ? { title: h.hero.cardsTitle, items: h.hero.cards } : null,
  };
  const S = [];
  if (h.offers.length) S.push({ type: 'offers', items: h.offers, links: h.offerLinks });
  S.push({ type: 'prose', title: h.help.title, blocks: wrap([...h.help.left, ...h.help.right]) });
  if (h.help.tiles.length) S.push({ type: 'tiles', items: h.help.tiles });
  S.push({ type: 'cardgrid', title: h.services.title, intro: wrap(h.services.intro), items: h.services.cards });
  if (h.mission.title) S.push({ type: 'cardgrid', title: h.mission.title, intro: wrap(h.mission.intro), items: h.mission.boxes.map((b) => ({ icon: b.icon, title: b.title, text: plain(b.text) })), small: true });
  if (h.stats.items.length) S.push({ type: 'stats', items: h.stats.items, img: h.stats.img });
  S.push({ type: 'listform', title: h.sameDay.title, items: h.sameDay.items, formTitle: h.sameDay.formTitle, formBlocks: wrap(h.sameDay.formText) });
  if (h.reviews.items.length) S.push({ type: 'reviews', title: h.reviews.title, items: h.reviews.items });
  if (h.about.blocks.length) S.push({ type: 'prose', title: h.about.title, blocks: h.about.blocks.map((b) => (b.p ? { t: 'html', html: `<p>${b.p}</p>` } : { t: 'html', html: `<ul>${b.ul.map((i) => `<li>${i}</li>`).join('')}</ul>` })) });
  if (h.faq.items.length) S.push({ type: 'faq', title: h.faq.title, intro: wrap(h.faq.intro), sideTitle: h.faq.sideTitle, img: h.faq.img, items: h.faq.items });
  if (h.areas.length) S.push({ type: 'areas', groups: h.areas });
  if (h.family.title) S.push({ type: 'split', title: h.family.title, img: h.family.img, imgAlt: h.family.imgAlt, blocks: wrap(h.family.paragraphs) });
  if (h.contact.length) S.push({ type: 'contact', items: h.contact });
  return { hero, sections: S };
}

// ---------- any other site: classify content groups by shape ----------
const isStatValue = (t) => /^\d[\d.,]*\s?[+%kKmM]?[A-Za-z]{0,2}\+?$/.test(t.trim()) && t.trim().length <= 8;

function listItems(html) {
  const $ = cheerio.load(html);
  return $('ul > li, ol > li').map((_, li) => plain($(li).html())).get();
}
const isList = (b) => b.t === 'html' && /^<(ul|ol)\b/i.test(b.html);

function groupBlocks(blocks) {
  const groups = [];
  let cur = null;
  const flush = () => { if (cur && (cur.title || cur.blocks.length)) groups.push(cur); cur = null; };
  for (const b of blocks) {
    if (b.t === 'break') { flush(); continue; }
    if (b.t === 'h' && b.level <= 2) { if (cur && (cur.blocks.length || cur.title)) flush(); cur = { title: b.text, blocks: [] }; continue; }
    (cur ||= { title: '', blocks: [] }).blocks.push(b);
  }
  flush();
  return groups;
}

function classify(g, ctx) {
  const bl = g.blocks;
  const has = (t) => bl.find((b) => b.t === t);
  const rest = (skip) => bl.filter((b) => !skip.includes(b));
  if (has('faq')) return { type: 'faq', title: g.title, intro: rest([has('faq')]).filter((b) => b.t === 'html'), items: has('faq').items };
  if (has('reviews')) return { type: 'reviews', title: g.title, items: has('reviews').items };
  if (has('cardgrid')) return { type: 'cardgrid', title: g.title, intro: rest([has('cardgrid')]).filter((b) => b.t === 'html'), items: has('cardgrid').items };
  if (has('cards')) return { type: 'iconcards', title: has('cards').title || g.title, items: has('cards').items };
  if (has('cta')) return { type: 'cta', ...has('cta') };
  const links = has('links');
  if (links) return { type: 'areas', groups: [{ title: g.title, links: links.items }] };
  const lists = bl.filter(isList);
  const anchors = lists.find((b) => (b.html.match(/<li>\s*<a /g) || []).length >= 10);
  if (anchors) { const $ = cheerio.load(anchors.html); return { type: 'areas', groups: [{ title: g.title, links: $('a').map((_, a) => ({ href: $(a).attr('href'), text: plain($(a).text()) })).get() }] }; }

  // numeric highlights: value followed by a label, three or more times
  const texts = bl.filter((b) => b.t === 'html').map((b) => plain(b.html));
  const pairs = [];
  for (let i = 0; i < texts.length - 1; i++) if (isStatValue(texts[i]) && texts[i + 1] && texts[i + 1].length < 60) { pairs.push({ value: texts[i], label: texts[i + 1] }); i++; }
  if (pairs.length >= 3 && texts.length <= pairs.length * 2 + 1) return { type: 'stats', items: pairs, title: g.title };

  const imgs = bl.filter((b) => b.t === 'img');
  const paras = bl.filter((b) => b.t === 'html' && !isList(b));
  if (lists.length === 1 && paras.length <= 3 && !imgs.length) {
    const items = listItems(lists[0].html);
    if (items.length >= 4 && items.length <= 12 && items.every((i) => i.length <= 110)) return { type: 'features', title: g.title, intro: paras, items };
  }
  if (imgs.length === 1 && paras.length >= 1 && ctx.canSplit) return { type: 'split', title: g.title, img: imgs[0].src, imgAlt: imgs[0].alt, imgBlock: imgs[0], blocks: bl.filter((b) => b !== imgs[0]) };
  if (has('form')) return { type: 'prose', title: g.title, blocks: bl.filter((b) => b.t !== 'form'), form: true };
  return { type: 'prose', title: g.title, blocks: bl };
}

function fromBlocks(model) {
  const all = model.blocks.map((b) => ({ ...b }));
  const content = all.filter((b) => b.t !== 'break');
  const firstHead = content.findIndex((b) => b.t === 'h');
  const lead = content.findIndex((b) => b.t === 'html' && /^<p\b/i.test(b.html) && plain(b.html).length <= 320);
  const hero = { eyebrow: '', h1: model.hero.h1, leadHtml: '', bullets: [], image: null, buttons: null, cards: null };
  const taken = new Set();
  if (lead >= 0 && (firstHead === -1 || lead < firstHead)) {
    hero.leadHtml = content[lead].html;
    taken.add(content[lead]);
    const next = content[lead + 1];
    if (next && isList(next)) { const items = listItems(next.html); if (items.length >= 2 && items.length <= 5 && items.every((i) => i.length <= 90)) { hero.bullets = items; taken.add(next); } }
  }
  const img = content.findIndex((b) => b.t === 'img');
  if (img >= 0 && (firstHead === -1 || img < firstHead || firstHead < 2)) { hero.image = content[img]; taken.add(content[img]); }
  const groups = groupBlocks(all.filter((b) => !taken.has(b)));
  const ctx = { canSplit: true };
  let n = 0;
  const sections = groups.map((g) => { const s = classify(g, ctx); if (s.type === 'split') s.flip = n++ % 2 === 1; return s; });
  return { hero, sections };
}

// Stable names for the pieces of home content: "hero", then "<type>:<n>" counted per type ("cardgrid:0", "cardgrid:1").
export function refsOf(comp) {
  const map = new Map([['hero', { type: 'hero', hero: comp.hero }]]);
  const count = {};
  for (const s of comp.sections) {
    const n = (count[s.type] = (count[s.type] ?? -1) + 1);
    map.set(`${s.type}:${n}`, { type: s.type, s });
  }
  return map;
}

// The page as it is drawn when no composition has been chosen: the content in its natural order, default styles.
export function defaultPage(comp) {
  return { sections: [...refsOf(comp).keys()].map((ref) => ({ ref })) };
}
