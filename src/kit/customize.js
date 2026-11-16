import { LIBRARY } from './sections.js';
import { applyTones } from './tones.js';
import { NEW_DESIGNS } from './designs/index.js';

// Customising one section of a real page: what it can be drawn as. The same kind of section has several layouts; a list can also be
// drawn as another kind of list. Nothing is changed unless all of the section's content survives in the new form.

const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export const ROLE_NAMES = { trust: 'Trust points', services: 'Services / cards', about: 'Text', features: 'Features', steps: 'Steps', stats: 'Numbers', reviews: 'Reviews', faq: 'Questions', areas: 'Areas', cta: 'Call to action', contact: 'Contact' };
const TYPE_OF = { features: 'features', steps: 'steps', services: 'cardgrid' };

// a short stable name for a section, so a choice made for it is found again when the page is rebuilt
export function keyOf(s) {
  const text = JSON.stringify([s.type, s.title || '', s.blocks?.[0], s.items?.[0], s.groups?.[0], s.quote || '']).slice(0, 400);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `s${(h >>> 0).toString(36)}`;
}
export function labelOf(s) {
  const first = s.title || strip(s.blocks?.find((b) => b.html)?.html) || (typeof s.items?.[0] === 'string' ? s.items[0] : s.items?.[0]?.title || s.items?.[0]?.q) || s.type;
  return String(first).slice(0, 70);
}


// The kind of a section, from what it holds and how it is built, not from the page it is on: the same kind of section on any page of the
// website is the same kind, and gets the same layout. Coarse on purpose, so a website has a handful of kinds, not one per section.
const bucket = (n, cuts) => { const i = cuts.findIndex((c) => n <= c); return i < 0 ? cuts.length : i; };
export function kindOf(s, role) {
  const blocks = s.blocks || [];
  const html = blocks.filter((b) => b.html).map((b) => b.html).join(' ');
  const items = (s.items || []).length;
  const itemsOf = (s.items || []).filter((x) => x && typeof x === 'object');
  const parts = {
    role,
    head: s.title || blocks.some((b) => b.t === 'h') ? 'heading' : 'no heading',
    pic: s.img || blocks.some((b) => b.t === 'img') ? 'picture' : 'no picture',
    table: /<table/i.test(html) ? 'table' : '',
    list: /<(ul|ol)\b/i.test(html) ? 'list' : '',
    quote: /<blockquote/i.test(html) ? 'quote' : '',
    links: (html.match(/<a\b/gi) || []).length >= 3 ? 'links' : '',
    n: items ? ['1-3', '4+'][bucket(items, [3])] : '',
    thumbs: itemsOf.some((x) => x.img) ? 'pictures' : '',
    go: itemsOf.some((x) => x.href) ? 'links' : '',
    form: s.form ? 'form' : '',
    small: s.small ? 'small' : '',
  };
  // (what is added to the signature only when it is there, so the kinds a website already has keep their names)
  const heads = blocks.filter((b) => b.t === 'h').length;
  const topics = (s.type === 'prose' || s.type === 'split') && heads >= 2 ? (heads >= 4 ? '4+ topics' : `${heads} topics`) : '';
  const banner = s.type === 'callout' ? 'banner line' : '';
  const more = [topics, banner].filter(Boolean);
  const sig = Object.values(parts).join('|') + (more.length ? `|${more.join('|')}` : '');
  let h = 2166136261;
  for (let i = 0; i < sig.length; i += 1) { h ^= sig.charCodeAt(i); h = Math.imul(h, 16777619); }
  const words = [banner ? 'Banner line' : ROLE_NAMES[role] || role, parts.head, parts.pic, topics, parts.n && `${parts.n} items`, parts.thumbs && 'with pictures', parts.table, parts.list, parts.quote, parts.links && 'many links', parts.form].filter(Boolean);
  return { id: `k${(h >>> 0).toString(36)}`, sig, label: words.join(' · ') };
}

// layouts that show a picture beside, above or behind the text need one
export const NEEDS_PIC = /^image-|^overlay$/;
// a text that holds a picture of its own: the first picture taken out of the text, so that the layouts with a picture can show it
export function pullPicture(s) {
  if (!s || s.img || !(s.type === 'prose' || s.type === 'split') || !Array.isArray(s.blocks)) return null;
  const at = s.blocks.findIndex((b) => b.t === 'img' && b.src);
  if (at < 0) return null;
  const rest = s.blocks.filter((_, i) => i !== at);
  if (!rest.some((b) => b.t !== 'img')) return null; // the picture is all there is: nothing to put beside
  return { ...s, img: s.blocks[at].src, imgAlt: s.blocks[at].alt || '', blocks: rest };
}

// the points of a section, when it is a list of points
function listOf(s) {
  if (['features', 'steps', 'cardgrid', 'iconcards'].includes(s.type)) return s.items.map((t) => (typeof t === 'string' ? { title: t } : { title: t.title || t.text || t.label || '', text: t.title ? t.text || '' : '', href: t.href, img: t.img, imgAlt: t.imgAlt, full: t.full }));
  if ((s.type === 'prose' || s.type === 'split') && Array.isArray(s.blocks)) { // several pictures, each with its own description: a gallery of cards
    const pics = s.blocks.filter((b) => b.t === 'img' && b.src);
    return pics.length >= 2 && pics.every((b) => b.alt) ? pics.map((b) => ({ title: b.alt, img: b.src, imgAlt: b.alt })) : null;
  }
  if (s.type === 'tiles') return s.items.some((t) => t && t.img) ? null : s.items.map((t) => (typeof t === 'string' ? { title: t } : { title: t.title || t.text || t.label || '' }));
  if (s.type === 'faq') return s.items.some((f) => /<a\b|<ul|<ol|<table/i.test(f.a || '')) ? null : s.items.map((f) => ({ title: f.q, text: strip(f.a) }));
  return null;
}
// the section as another kind of section, or null when something of it would be lost
export function convertTo(s, role) {
  const list = listOf(s);
  const type = TYPE_OF[role];
  if (!list || !type) return null;
  if (role !== 'services' && list.some((i) => i.href || i.img)) return null;
  const intro = s.intro || ((s.type === 'prose' || s.type === 'split') ? s.blocks.filter((b) => b.t !== 'img') : undefined); // (the text around the pictures stays as the introduction)
  if (role === 'steps') {
    const lead = Array.isArray(intro) ? (intro.some((b) => /<a\b/i.test(b.html || '')) ? null : strip(intro.map((b) => b.html).join(' '))) : intro || s.lead || '';
    if (lead === null) return null;
    return { type, title: s.title || '', lead, items: list.map((i) => ({ title: i.title, text: i.text, full: i.full })) };
  }
  if (role === 'features') return { type, title: s.title || '', intro, items: list.map((i) => ({ title: i.title, text: i.text, full: i.full })) };
  return { type, title: s.title || '', intro, items: list.map((i) => ({ title: i.title, text: i.text, href: i.href, img: i.img, imgAlt: i.imgAlt })) };
}

// The designs that are offered, by the prefix of their layout names. A section of a page drawn in one of them can be drawn in the layout any
// other of them gives the same content.
const OFFERED = Object.values(NEW_DESIGNS).filter((d) => d.offered && d.prefix);
const BY_PREFIX = Object.fromEntries(OFFERED.map((d) => [d.prefix, d]));
export const prefixOf = (variant) => { const v = String(variant || ''); return v.slice(0, v.indexOf('-') + 1); };
export const designOfLayout = (variant) => BY_PREFIX[prefixOf(variant)] || null;
// the hero layouts of the offered designs: of the home page, and of an inner page
export const HOME_HEROES = OFFERED.map((d) => d.videoHero);
export const INNER_HEROES = OFFERED.map((d) => d.innerHero);

// A section drawn in the layout of another design keeps the shapes of that design (its corners, the weight and the case of its headings)
// and its skin: a section of a design drawn at night is a dark band on a page drawn by day, and a section of a day design is a sheet of
// paper on a page drawn at night. The fonts and the colours stay those of the page.
export function fromDesign(html, variant, design) {
  const src = designOfLayout(variant);
  if (!src || !design?.prefix || src.prefix === design.prefix) return html;
  const vars = Object.entries(src.vars || {}).map(([k, v]) => `${k}:${v}`).join(';');
  const skin = (src.skin || 'day') === (design.skin || 'day') ? '' : src.skin === 'night' ? 'k-night' : 'k-day';
  return String(html).replace(/<section\b((?:[^>"]|"[^"]*")*)>/, (m, attrs) => {
    let a = attrs;
    if (vars) a = /\sstyle="/.test(a) ? a.replace(/\sstyle="/, () => ` style="${vars};`) : ` style="${vars}"${a}`;
    if (skin) a = /\sclass="/.test(a) ? a.replace(/\sclass="([^"]*)"/, (x, cls) => ` class="${skin}${/(^|\s)bg-/.test(cls) ? '' : ' bg-paper'} ${cls}"`) : `${a} class="${skin} bg-paper"`;
    return `<section data-k-from="${src.id}"${a}>`;
  });
}

// every layout the section can be drawn in: of its own kind, then of the kinds it can become
export function optionsFor(p, { K, design }, draw) {
  const out = [];
  const used = {};
  for (const k of ['home', 'inner', 'contact']) for (const b of design[k] || []) (used[`${b.type}:${b.variant}`] ||= []).push(k);
  const add = (role, s, group) => {
    for (const variant of Object.keys(LIBRARY[role] || {})) {
      // a design with layouts of its own offers them, and the layouts of the other offered designs; a design without offers the shared ones
      const from = designOfLayout(variant);
      const own = !design.prefix || variant.startsWith(design.prefix);
      if (design.prefix ? !own && !from : /^[a-z]{2}-/.test(variant) && !(used[`${role}:${variant}`] || []).length) continue;
      if (variant === 'wide' && !s.wide) continue;
      // a picture layout needs a picture: one in the text is taken out of it
      const shown = NEEDS_PIC.test(variant) && !s.img ? pullPicture(s) : s;
      if (NEEDS_PIC.test(variant) && !shown?.img) continue;
      try {
        const html = applyTones([fromDesign(draw(shown, variant, K), variant, design)], [p.entry || {}])[0];
        out.push({ id: `${role}:${variant}`, role, variant, group, own, design: from ? from.name : '', label: from ? from.name : variant.replace(/-/g, ' '), note: (used[`${role}:${variant}`] || []).join(', '), html });
      } catch { /* a layout that cannot show this content is not offered */ }
    }
  };
  add(p.role, p.s, 'same');
  for (const role of Object.keys(TYPE_OF)) {
    if (role === p.role) continue;
    const to = convertTo(p.s, role);
    if (to) add(role, to, 'convert');
  }
  // (this design's own layouts first)
  return [...out.filter((o) => o.own), ...out.filter((o) => !o.own)];
}
