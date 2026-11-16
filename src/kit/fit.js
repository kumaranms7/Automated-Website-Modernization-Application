import { esc, head, sec, checkList, T } from './ui.js';
import { LIBRARY, HERO, pageHero, pageHeroPhoto, quoteForm } from './sections.js';
import { chromeHtml } from './chrome.js';
import { motionDefaults, withMotion } from './motion.js';
import * as cheerio from 'cheerio';
import { composeHome } from '../template/home-compose.js';
import { plain } from '../util/html.js';
import { packById, packFor } from './packs.js';
import { tailor } from './tailor.js';
import { applyTones } from './tones.js';
import { restructure } from './restructure.js';
import { keyOf, labelOf, convertTo, optionsFor, kindOf, NEEDS_PIC, pullPicture, ROLE_NAMES, fromDesign, prefixOf, designOfLayout, HOME_HEROES, INNER_HEROES } from './customize.js';
import { context } from './page.js';
import { NEW_TYPED } from './designs/index.js';
import { placeholderContent } from './content.js';
import { rebase } from './rebase.js';
import { patternFor } from './designs/shared.js';

// while a preview is built, what every section could be drawn as is collected for the Customize sections panel
let collect = null;
export function collectSections(on) { collect = on ? {} : null; return collect; }

// Fitting a design to a website's own content.
//
// The approved design is the skeleton: its sections, in its order, in its layouts (the blueprint of the kind of page, as tailored to this
// website). The page's content is composed into typed sections (text, cards, FAQ, reviews, areas...), cleaned of the old design's markup,
// and poured into the blueprint's slots by kind: the page's cards fill the services slot, its questions the FAQ slot, and so on. A slot
// the page has no content for is left out; nothing is invented. Content that fits no slot is added in the design's own styles before the
// closing call to action, so nothing of the page is lost.

const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const clean = (s) => String(s || '').replace(/\s*\(current\)\s*/i, '').trim();

// ---------- the old page's markup is not carried over: only what the text says, with its links, pictures and tables ----------
const KEEP_ATTR = new Set(['href', 'src', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan', 'target', 'rel', 'srcset', 'sizes', 'loading', 'decoding', 'datetime', 'cite', 'start']);
export function cleanHtml(html) {
  if (!html || !html.includes('<')) return html;
  const $ = cheerio.load(`<div id="x">${html}</div>`, null, false);
  $('#x script, #x style').remove();
  $('#x *').each((_, e) => { for (const k of Object.keys(e.attribs || {})) if (!KEEP_ATTR.has(k)) delete e.attribs[k]; if (e.name === 'a' && e.attribs.target === '_blank' && !e.attribs.rel) e.attribs.rel = 'noopener'; });
  return $('#x').html();
}
const cleanBlocks = (list) => (list || []).map((b) => (b.t === 'html' || b.html ? { ...b, html: cleanHtml(b.html) } : b));
const cleanSection = (s) => ({ ...s, ...(s.blocks ? { blocks: cleanBlocks(s.blocks) } : {}), ...(s.intro ? { intro: cleanBlocks(s.intro) } : {}), ...(s.items && s.type === 'faq' ? { items: s.items.map((f) => ({ ...f, a: cleanHtml(f.a) })) } : {}) });

// ---------- groups of small pictures with a caption, and number + label pairs, are trust points and statistics ----------
const STAT_VALUE = /^[\d$£€][\d.,]*\s?[+%kKmM]?\+?$|^[A-Z][A-Za-z]{0,3}\+?$|^\d+(?:[.,]\d+)?\s?\/\s?\d+$/;
const iconish = (b, dims) => {
  const d = dims?.[b.src];
  return /\.svg(\?|$)|icon|badge|seal|logo|check|star|shield/i.test(b.src || '') || Boolean(d && d.w <= 256);
};
function splitTiles(s, dims) {
  if (s.type !== 'prose' || !s.blocks?.length) return [s];
  const bl = s.blocks;
  const short = (b, n = 60) => b?.t === 'html' && plain(b.html).length > 0 && plain(b.html).length <= n;
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) out.push({ ...s, title: out.length ? '' : s.title, blocks: buf }); buf = []; };
  let i = 0;
  while (i < bl.length) {
    // a run of small pictures, each followed by a short caption: trust points
    let j = i; const units = [];
    while (bl[j]?.t === 'img' && iconish(bl[j], dims)) {
      let k = j + 1; const cap = [];
      while (short(bl[k]) && cap.length < 2) { cap.push(plain(bl[k].html)); k += 1; }
      if (!cap.length) break;
      units.push({ title: cap.join(' '), img: { src: bl[j].src, alt: bl[j].alt || '' } }); j = k;
    }
    if (units.length >= 3) { flush(); out.push({ type: 'tiles', items: units }); i = j; continue; }
    // a run of a figure and its label ("300+", "5-Star Reviews"): statistics
    j = i; const pairs = [];
    while (short(bl[j], 12) && STAT_VALUE.test(plain(bl[j].html)) && short(bl[j + 1], 48)) { pairs.push({ value: plain(bl[j].html), label: plain(bl[j + 1].html) }); j += 2; }
    if (pairs.length >= 3) { flush(); out.push({ type: 'stats', items: pairs }); i = j; continue; }
    buf.push(bl[i]); i += 1;
  }
  flush();
  return out.length ? out : [s];
}

// ---------- slots ----------
const ROLE = { callout: 'cta', steps: 'steps', offers: 'trust', tiles: 'trust', prose: 'about', split: 'about', features: 'features', cardgrid: 'services', iconcards: 'services', stats: 'stats', reviews: 'reviews', faq: 'faq', areas: 'areas', contact: 'contact', contactform: 'contact', map: 'contact', cta: 'cta', listform: 'cta' };

// one typed section drawn in a layout of its slot
function draw(s, variant, K) {
  // a design that draws the website's sections itself (src/kit/designs) is given the section as it is, whatever its kind
  const own = NEW_TYPED[String(variant).slice(0, String(variant).indexOf('-') + 1)]?.[s.type];
  if (own) return own(s, K, variant);
  switch (s.type) {
    case '__added': return LIBRARY[s.role][variant](s.data, s.K); // a section of the library, with the library's placeholder content
    case 'offers': return LIBRARY.trust[variant]({ items: s.items.map((x) => ({ title: `${x.badge || ''} ${x.label || ''}`.trim() })), links: (s.links || []).map((l) => ({ text: l.text, href: l.href })) }, K);
    case 'tiles': return LIBRARY.trust[variant]({ items: s.items.map((x) => (typeof x === 'string' ? { title: x } : { title: x.title || x.text || x.label || '', img: x.img })) }, K);
    case 'cardgrid': {
      const hasImgs = s.items.some((c) => c.img);
      const v = s.small ? 'compact' : variant === 'image-cards' && !hasImgs ? 'icon-cards' : variant;
      return LIBRARY.services[v]({ title: s.title, intro: s.intro, items: s.items.map((c) => ({ title: c.title, text: c.text, href: c.href, img: c.img, imgAlt: c.imgAlt })) }, K);
    }
    case 'iconcards': return LIBRARY.services.compact({ title: s.title, items: s.items.map((c) => ({ title: c.title || c.text || c.label, text: '', href: c.href })) }, K);
    case 'features': {
      // a layout that shows only the headline of each point shows the whole sentence of it
      const whole = variant === 'checks';
      return LIBRARY.features[variant]({ title: s.title, intro: s.intro, items: s.items.map((t) => (typeof t === 'string' ? { title: t } : whole && t.text ? { ...t, title: t.full || `${t.title} ${t.text}`, text: '' } : t)) }, K);
    }
    case 'steps': return LIBRARY.steps[variant]({ title: s.title, lead: s.lead, items: s.items }, K);
    case 'stats': return LIBRARY.stats[variant]({ title: s.title, items: s.items }, K);
    case 'reviews': return LIBRARY.reviews[variant]({ title: s.title, items: s.items }, K);
    case 'faq': {
      const html = LIBRARY.faq[variant]({ title: s.title, intro: s.intro, items: s.items.map((f) => ({ q: f.q, a: f.a })) }, K);
      // the caption and picture that stood beside the old questions close the section
      const aside = (s.sideTitle ? `<p class="font-display text-xl font-bold text-heading">${esc(s.sideTitle)}</p>` : '') + (s.img ? K.img(s.img, s.imgAlt || '') : '');
      return aside ? html.replace(/<\/section>\s*$/, () => `<div class="${T.wrap} grid max-w-2xl justify-items-start gap-3 pb-[clamp(2.5rem,5vw,4rem)] [&_img]:h-auto [&_img]:w-full [&_img]:rounded-k">${aside}</div></section>`) : html;
    }
    case 'areas': return LIBRARY.areas[variant]({ groups: s.groups.map((g) => ({ title: g.title, links: (g.links || []).map((l) => ({ href: l.href, text: l.text })) })) }, K);
    case 'contact': return LIBRARY.contact.cards({ title: 'Contact', items: s.items.map((c) => ({ icon: c.icon && /^[a-z]+$/.test(c.icon) ? c.icon : '', title: c.title || c.label || '', text: c.text || c.value || strip(c.html), href: c.href })) }, K);
    case 'cta': return LIBRARY.cta[variant]({ title: s.title, text: s.text, href: s.href, label: s.label }, K);
    case 'listform': return sec(`<div class="grid items-center gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[1.2fr_1fr]"><div class="grid gap-5">${head('', s.title)}${s.items?.length ? checkList(s.items.map((t) => (typeof t === 'string' ? t : t.title || t.text || ''))) : ''}</div><div class="grid content-start gap-4">${(s.formBlocks || []).length ? `<div class="prose-k" data-p="content">${s.formBlocks.map((b) => b.html || '').join('')}</div>` : ''}${quoteForm(K, s.formTitle || 'Request a quote')}</div></div>`, { tone: 'tint' });
    default: { // text: a layout with a picture needs one; without, the same slot reads as text
      // a layout with a picture shows the picture that is in the text, when the section has none of its own
      if (NEEDS_PIC.test(variant) && !s.img) s = pullPicture(s) || s;
      const hasPic = Boolean(s.img);
      // a layout with a picture needs one; the pull-quote layout shows only a sentence, so it is not used for a page's text
      // a picture layout without a picture would be an empty panel: the heading-and-text layout of the same design carries the text
      const short = !s.items?.length && !hasPic && s.blocks.length <= 2 && s.blocks.every((b) => b.t === 'html' && !/<(table|ul|ol|a\b)/i.test(b.html) && String(b.html).replace(/<[^>]+>/g, '').length < 420);
      let v = s.wide ? 'wide' : NEEDS_PIC.test(variant) && !hasPic ? (short && s.title ? 'centered' : 'story') : variant;
      // text with no heading has nothing for the heading column of these layouts: it reads as one comfortable column
      if (!s.title && !hasPic && !s.eyebrow && ['story', 'centered', 'image-left', 'image-right'].includes(v)) v = 'plain';
      const html = LIBRARY.about[LIBRARY.about[v] ? v : 'story']({ title: s.title, blocks: s.blocks, items: s.items, img: s.img, imgAlt: s.imgAlt }, K);
      return s.form && K.formHtml ? `${html}${sec(quoteForm(K, 'Contact us'), { tone: 'tint' })}` : html;
    }
  }
}

// the layout a piece of content that fits no slot is drawn in: the design's own layout for that kind of section
const extraVariant = (design, role, fallback) => { for (const k of ['home', 'inner', 'contact']) { const b = (design[k] || []).find((x) => x.type === role); if (b) return b.variant; } return fallback; };
const FALLBACK = { steps: 'cards', trust: 'strip', services: 'icon-cards', about: 'story', features: 'checks', stats: 'cards', reviews: 'grid', faq: 'accordion', areas: 'pills', cta: 'gradient' };

// every phone number the page shows (a business with several offices lists them all): none may be lost in a new design
export function phonesOf(html) {
  const $ = cheerio.load(html || '');
  const seen = new Map();
  $('a[href^="tel:"]').each((_, a) => { const digits = String($(a).attr('href')).replace(/\D/g, ''); const text = $(a).text().replace(/\s+/g, ' ').trim(); if (digits.length >= 7 && !seen.has(digits)) seen.set(digits, { digits, display: /\d/.test(text) && text.length <= 40 ? text : digits }); });
  return [...seen.values()].slice(0, 6);
}

export function kitContext({ site, spec, u, img, form = '', phones = [] }) {
  const pack = spec.kit?.pack ? packById(spec.kit.pack) : packFor({ industry: site.name });
  const nav = (site.nav || []).slice(0, 7).map((n) => ({ label: clean(n.label), href: n.href, children: (n.children || []).map((c) => ({ label: clean(c.label), href: c.href })) }));
  const plainImg = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" decoding="async">`;
  const base = { real: true, img: img || plainImg, site: { ...site, name: site.name, phone: site.phone, phones: phones.length ? phones : site.phone?.digits ? [site.phone] : [], email: site.email || '', ctaLabel: site.ctaLabel || 'Get a free quote', ctaHref: site.ctaHref || '#quote', city: '' }, pack, nav, u, formHtml: form };
  // the website's own icons and wording decide; the pack only fills what the content does not say
  const K = { ...base, stats: pack.stats };
  K.iconFor = (item, i, group = 'services') => {
    const w = item && (item.icon && /^[a-z]+$/.test(item.icon) ? item.icon : null);
    return w || (pack[group] || pack.services)[i % (pack[group] || pack.services).length][1];
  };
  return K;
}

// the pictures of a page that are fit to be the background of its hero: wide enough, not an icon, a logo or a decorative strip
const NOT_PHOTO = /icon|logo|sprite|badge|seal|\.svg|favicon|wave|divider|shape|pattern|texture|separator|arrow/i;
const pictureTags = (html) => [...String(html || '').matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi)].map((m) => ({ src: m[1], alt: (m[0].match(/\balt=["']([^"']*)["']/i) || [])[1] || '' }));
const picturesOf = (v, out = []) => {
  if (Array.isArray(v)) v.forEach((x) => picturesOf(x, out));
  else if (v && typeof v === 'object') {
    if (v.t === 'img' && v.src) out.push({ src: v.src, alt: v.alt || '' });
    if (v.t === 'html') out.push(...pictureTags(v.html));
    if (typeof v.img === 'string' && v.img) out.push({ src: v.img, alt: v.imgAlt || '' }); else if (v.img?.src) out.push({ src: v.img.src, alt: v.img.alt || '' });
    for (const x of Object.values(v)) if (x && typeof x === 'object') picturesOf(x, out);
  }
  return out;
};
export function bannerPictures(parts, dims) {
  const seen = new Set();
  return picturesOf(parts).filter((p) => {
    if (seen.has(p.src)) return false;
    seen.add(p.src); return true;
  }).map((p) => ({ ...p, w: dims?.[p.src]?.w || 0, h: dims?.[p.src]?.h || 0 }));
}
// a picture used as the hero is not used again in the body of the same page
const without = (v, src) => {
  if (Array.isArray(v)) return v.filter((x) => !(x && x.t === 'img' && x.src === src)).map((x) => without(x, src));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === 'img' && (x === src || x?.src === src)) continue;
      o[k] = k === 'html' && typeof x === 'string' ? x.replace(/<img\b[^>]*>/gi, (t) => (pictureTags(t)[0]?.src === src ? '' : t)) : without(x, src);
    }
    return o;
  }
  return v;
};
const emptyProse = (s) => s.type === 'prose' && !s.title && !s.img && !(s.items || []).length && !(s.blocks || []).some((b) => b.t !== 'html' || String(b.html || '').replace(/<[^>]*>/g, '').trim());

// an icon, a logo or a badge is not a hero picture: only a picture that is large enough is used
const usableHero = (image, candidate, dims) => {
  // a decorative strip (wave, divider, pattern) or a small mark is not a picture to put in a hero
  const ok = (i) => { const d = dims?.[i.src] || (i.width && i.height ? { w: Number(i.width), h: Number(i.height) } : null); return !NOT_PHOTO.test(String(i.src).split('/').pop()) && !(d && d.w / (d.h || 1) > 3.2); };
  if (candidate?.src) return ok(candidate) ? candidate : null;
  if (!image?.src || !ok(image)) return null;
  const d = dims?.[image.src];
  return !dims || (d && d.w >= 700) ? image : null;
};
// heroes that need a picture to look right give way to one that does not when the page has none

// the page's content as typed sections (a text, a list of points, questions, ...), the same way for every page of a website
function typedSections({ comp, h, heroShown, design, dims, kind }) {
  const sections = comp.sections.flatMap((s) => splitTiles(cleanSection(s), dims));
  // (the hero of an inner page shows no picture of its own: the page's first picture stays in the body unless it is chosen as the hero background)
  if (h.image?.src && (kind !== 'home' || heroShown !== h.image.src)) {
    const back = { t: 'img', src: h.image.src, alt: h.image.alt || '' };
    if (sections[0]?.type === 'prose') sections[0] = { ...sections[0], blocks: [back, ...sections[0].blocks] }; else sections.unshift({ type: 'prose', title: '', blocks: [back] });
  }
  // (tiles are split out of the first text now that the picture is back in it)
  const reTiled = sections.flatMap((x, i) => (i === 0 && x.type === 'prose' ? splitTiles(x, dims) : [x]));
  const out = restructure(reTiled, design);
  return design.keepOrder ? lonePictures(out) : out;
}
// a picture that stands alone between two texts belongs to one of them: the text after it, else the text before it (the page's order is kept,
// the picture is shown beside that text instead of on a row of its own)
function lonePictures(list) {
  const isText = (s) => s && (s.type === 'prose' || s.type === 'split');
  const picOnly = (s) => isText(s) && !s.title && !s.img && (s.blocks || []).length === 1 && s.blocks[0].t === 'img' && s.blocks[0].src;
  const takes = (s) => isText(s) && !s.img && !s.wide && (s.blocks || []).some((b) => b.t === 'html') && !(s.blocks || []).some((b) => b.t === 'img');
  const out = [];
  const src = list.slice();
  for (let i = 0; i < src.length; i += 1) {
    const s = src[i];
    if (picOnly(s)) {
      const b = s.blocks[0];
      if (takes(src[i + 1])) { src[i + 1] = { ...src[i + 1], img: b.src, imgAlt: b.alt || '' }; continue; }
      if (takes(out[out.length - 1])) { out[out.length - 1] = { ...out[out.length - 1], img: b.src, imgAlt: b.alt || '' }; continue; }
    }
    out.push(s);
  }
  return out;
}

// A contact page drawn by a design that arranges it: the contact details and the form side by side, the rest of the page in its own order,
// the map at the end across the page. A map is an embedded frame of a map service found anywhere in the page's text.
const MAP_FRAME = /<iframe\b[^>]*\bsrc=["'][^"']*(?:google\.[a-z.]+\/maps|maps\.google|openstreetmap|bing\.com\/maps|mapbox)[^"']*["'][^>]*>\s*(?:<\/iframe>)?/gi;
function contactOrder(list, common = null, path = '') {
  const maps = [];
  const rest = [];
  let details = null;
  for (const s of list) {
    if (s.type === 'contact' && !details) { details = s; continue; }
    if ((s.type === 'prose' || s.type === 'split') && Array.isArray(s.blocks)) {
      const blocks = [];
      for (const b of s.blocks) {
        const html = String(b.html || '');
        const found = html.match(MAP_FRAME);
        if (found) { maps.push(...found); const left = html.replace(MAP_FRAME, '').replace(/<p>\s*<\/p>/g, '').trim(); if (left.replace(/<[^>]+>/g, '').trim()) blocks.push({ ...b, html: left }); } else blocks.push(b);
      }
      if (blocks.length || s.title || s.img) rest.push({ ...s, blocks });
      continue;
    }
    rest.push(s);
  }
  // (the website's own questions and its own closing call stand between the form and the map on a contact page that has none)
  const lend = (s) => (s ? [{ ...rebase(s, s.from || common.from, path), borrowed: true }] : []);
  const faq = common?.faq && !rest.some((s) => s.type === 'faq') ? lend(common.faq) : [];
  const cta = common?.cta && !rest.some((s) => s.type === 'cta' || s.type === 'callout') ? lend(common.cta) : [];
  const tail = rest.filter((s) => s.type === 'cta');
  return [{ type: 'contactform', title: details?.title || '', intro: details?.intro || [], items: details?.items || [] }, ...rest.filter((s) => s.type !== 'cta'), ...faq, ...tail, ...cta, ...maps.map((html) => ({ type: 'map', html }))];
}

// The kinds of section on the inner pages of a website, found the same way a build finds them: [{ s, role, kind }] for one page
export function pageKinds({ model, site, spec, dims = null }) {
  const design = tailor(spec.kit.design, { spec, seedKey: `${site.name}|${spec.kit.pack}` });
  const comp = composeHome(model, site, { keepPictures: Boolean(design.keepOrder), bands: Boolean(design.bands) });
  return typedSections({ comp, h: comp.hero, heroShown: '', design, dims, kind: 'inner' }).map((s) => ({ s, role: ROLE[s.type], kind: kindOf(s, ROLE[s.type]) }));
}

// Two blocks written one straight after the other (the items of a list, a heading and its text) read as one run-on word to anything
// that reads the page as text (a search engine's snippet, a screen reader's copy, the content checks): a line break is put between them.
// The markup of the website's own embeds (a form's script, preformatted text) is left exactly as it is.
const KEEP_AS_IS = /(<(script|style|pre|textarea)\b[\s\S]*?<\/\2>)/gi;
const apart = (html) => String(html).split(KEEP_AS_IS).map((part, i) => (i % 3 ? (i % 3 === 1 ? part : '') : part.replace(/<\/(li|p|h[1-6]|div|dt|dd|summary|figcaption|blockquote|figure|ul|ol|dl|details|section|aside|article|nav)>(?=<)/g, '</$1>\n'))).join('');

// the kinds of section found on the other inner pages of the website: shown, with the page's own, in the preview of the inner template
let kindPool = null;
export function setKindPool(pool) { kindPool = pool || null; }

// the whole page body for a real page. model: the page's content model; returns the markup of header, main and footer
export function fitPage({ model, site, spec, u, img, kind, heroCandidate = null, dims = null, phones = [] }) {
  const design = tailor(spec.kit.design, { spec, seedKey: `${site.name}|${spec.kit.pack}` });
  const K = kitContext({ site, spec, u, img, phones, form: model.protected?.form || '' });
  K.web = design.web || {};
  // the links the old header showed beside its menu: its main action is the website's call to action, the others follow the menu
  const more = (site.headerLinks || []).filter((l) => l && l.text && l.href);
  const mainAction = more.find((l) => l.main);
  if (mainAction && !site.ctaLabel) { K.site.ctaLabel = mainAction.text; K.site.ctaHref = mainAction.href; }
  const inMenu = new Set(K.nav.flatMap((n) => [n.href, ...(n.children || []).map((c) => c.href)]));
  const labels = new Set(K.nav.map((n) => String(n.label).toLowerCase()));
  K.navMore = more.filter((l) => !l.main && !inMenu.has(l.href) && !labels.has(String(l.text).toLowerCase())).map((l) => ({ label: l.text, href: l.href, children: [] }));
  // (a design that carries a pattern: the one of this website)
  design.pattern = design.patterned || design.prefix ? patternFor(K.web.pattern, K.pack, site.name) : 'none';
  if (K.web.cta?.label) K.site.ctaLabel = K.web.cta.label;
  if (K.web.cta?.href) K.site.ctaHref = K.web.cta.href;
  if (K.web.hours) K.site.hours = K.web.hours;
  if (K.web.tagline) K.site.blurb = K.web.tagline;
  const comp = composeHome(model, site, { keepPictures: Boolean(design.keepOrder) && kind !== 'home', bands: Boolean(design.bands) });
  const h = comp.hero;
  const banner = spec.extras?.banners?.[kind]?.src ? { src: spec.extras.banners[kind].src, alt: spec.extras.banners[kind].alt } : null;
  const image = (() => { const i = usableHero(h.image, heroCandidate, dims); return i ? { src: i.src, alt: i.alt || '' } : null; })();
  // a looping background video chosen in Design settings for this kind of page
  const bv = spec.extras?.banners?.[kind]?.video?.src;
  const video = bv ? { src: u(`/${bv}`) } : null;
  const hero = { video, cards: h.cards?.items?.length ? h.cards : null, eyebrow: h.eyebrow, h1: h.h1, leadHtml: cleanHtml(h.leadHtml), lead: '', bullets: h.bullets, image: image || (banner ? { src: u(`/${banner.src}`), alt: banner.alt || '' } : null), buttons: h.buttons?.length ? h.buttons.map((b) => ({ text: b.text, href: b.href })) : null, crumbs: (model.hero.crumbs || []).map((c) => ({ text: c.text, href: c.href ? u(c.href === site.host ? '/' : c.href) : '' })) };

  // the blueprint of this kind of page, and the page's content as typed sections
  const blueprint = (design[kind] || design.home).filter((b) => b.type !== 'hero');
  const sections = typedSections({ comp, h, heroShown: hero.image?.src, design, dims, kind });
  // the cards of the old hero (a "free quote" box of links) have no place in a hero layout: they come last, as a small grid of links
  if (h.cards?.items?.length && !design.heroCards) sections.push({ type: 'cardgrid', small: true, title: h.cards.title || '', items: h.cards.items.map((c) => (typeof c === 'string' ? { title: c } : c)) });
  // the hero of an inner page: plain, or over one of the page's own pictures (which then leaves the body of the page)
  const mine = spec.kit?.pageSections?.[model.path] || {};
  const heroChoice = mine.hero || {};
  const bannerPics = kind === 'home' ? [] : bannerPictures([h.image?.src ? { t: 'img', src: h.image.src, alt: h.image.alt || '' } : null, sections], dims);
  // (a design can take the page's wide lead picture by itself, unless a plain hero was chosen for the page)
  const lead = design.autoHeroPhoto && kind !== 'home' && !heroChoice.bg ? bannerPics.slice(0, 2).find((p) => p.w >= 800 && p.w / (p.h || 1) >= 1.4 && !NOT_PHOTO.test(String(p.src).split('/').pop())) : null;
  const heroBg = heroChoice.bg === 'photo' && bannerPics.length ? bannerPics.find((p) => p.src === heroChoice.image) || bannerPics[0] : lead || null;
  if (heroBg) {
    const rest = without(sections, heroBg.src).filter((s) => !emptyProse(s));
    sections.splice(0, sections.length, ...rest);
  }
  if (design.keepOrder && kind === 'contact') sections.splice(0, sections.length, ...contactOrder(sections, site.common || null, model.path));
  K.quote = model.quoteHeading || null;
  K.facts = {
    stats: sections.filter((s) => s.type === 'stats').flatMap((s) => s.items).slice(0, 4).map((x) => [x.value, x.label]),
    trust: sections.filter((s) => s.type === 'tiles' || s.type === 'offers').flatMap((s) => s.items).slice(0, 4).map((x) => [x.title || `${x.badge || ''} ${x.label || ''}`.trim(), 'check']).filter(([t]) => t),
  };
  // the services of the page's own menu, for the footer
  K.serviceLinks = ((site.nav || []).find((n) => (n.children || []).length)?.children || []).slice(0, 6).map((c) => ({ label: clean(c.label), href: c.href }));
  // a design that keeps the page's own order draws every section where the website had it; the others fill their blueprint first
  const ordered = Boolean(design.keepOrder);
  const pool = sections.map((s) => ({ s, role: ROLE[s.type], used: false }));
  const slots = ordered ? [] : blueprint.map((b) => ({ b, hit: pool.find((p) => !p.used && p.role === b.type) || null }));
  for (const sl of slots) if (sl.hit) sl.hit.used = true;
  const extras = ordered ? [] : pool.filter((p) => !p.used);

  // what is drawn, in order: the design's slots first, what fits no slot just before the closing call to action
  const placed = [];
  const taken = new Map();
  const keyFor = (s) => { const k = keyOf(s); const n = (taken.get(k) || 0) + 1; taken.set(k, n); return n > 1 ? `${k}${n}` : k; };
  let flip = 0;
  let extrasDone = false;
  const flushExtras = () => {
    if (extrasDone) return;
    extrasDone = true;
    for (const p of extras) {
      let v = extraVariant(design, p.role, FALLBACK[p.role] || 'story');
      if (/^image-/.test(v)) v = flip++ % 2 ? 'image-left' : 'image-right';
      placed.push({ s: p.s, role: p.role, variant: v, entry: p.role === 'about' ? { space: 'tight' } : {}, key: keyFor(p.s) });
    }
  };
  for (const { b, hit } of slots) {
    if (b.type === 'cta') flushExtras();
    if (hit) placed.push({ s: hit.s, role: hit.role, variant: b.variant, entry: b, key: keyFor(hit.s) });
  }
  flushExtras();
  if (ordered) for (const p of pool) placed.push({ s: p.s, role: p.role, variant: design.layouts?.[p.role] || extraVariant(design, p.role, FALLBACK[p.role] || 'story'), entry: {}, key: keyFor(p.s) });

  // the kinds of section found on the website's other inner pages are shown in the preview of the inner template, before its closing call to action
  for (const p of placed) p.kind = kindOf(p.s, p.role);
  if (collect && kind === 'inner' && kindPool?.page === model.path) {
    const have = new Set(placed.map((p) => p.kind.id));
    const at = placed.findLastIndex((p) => p.role === 'cta');
    const more = kindPool.kinds.filter((k) => !have.has(k.id)).map((k) => ({ s: k.s, role: k.role, kind: { id: k.id, label: k.label }, key: `x${k.id}`, external: true }));
    placed.splice(at < 0 ? placed.length : at, 0, ...more);
  }
  // the layout of a kind of section is the same on every inner page: the design's own layout for that kind (never a position in the page)
  if (ordered) for (const p of placed) { if (!p.variant) p.variant = design.layouts?.[p.role] || extraVariant(design, p.role, FALLBACK[p.role] || 'story'); if (!p.entry) p.entry = {}; }
  if (kind === 'inner' && !ordered) {
    for (const p of placed) {
      const b = blueprint.find((x) => x.type === p.role);
      let v = b ? b.variant : extraVariant(design, p.role, FALLBACK[p.role] || 'story');
      if (/^image-/.test(v)) v = p.kind.id.charCodeAt(p.kind.id.length - 1) % 2 ? 'image-left' : 'image-right';
      p.variant = v; p.entry = b || (p.role === 'about' ? { space: 'tight' } : {});
    }
  }

  // sections of the library added to this page, each after the section it was added below
  const addedHere = Object.entries(spec.kit?.pageSections?.[model.path] || {}).filter(([, c]) => c.added && LIBRARY[c.added.role]?.[c.added.variant]);
  if (addedHere.length) {
    const ph = placeholderContent({}, { name: site.name }, spec.kit?.pack || K.pack?.id || '');
    const Kadd = context({ site: K.site, pack: K.pack, nav: K.nav, u: K.u });
    for (const [key, c] of addedHere) {
      const role = c.added.role;
      const item = { s: { type: '__added', role, data: ph.data[role] || {}, K: Kadd, title: `${ROLE_NAMES[role] || role} · from the library` }, role, variant: c.variant && LIBRARY[role][c.variant] ? c.variant : c.added.variant, entry: {}, key, added: true, kind: { id: 'added', label: 'Added from the library' } };
      const after = c.added.after ? placed.findIndex((p) => p.key === c.added.after) : -1;
      const end = placed.findLastIndex((p) => p.role === 'cta');
      placed.splice(after >= 0 ? after + 1 : c.added.after === 'hero' ? 0 : end < 0 ? placed.length : end, 0, item);
    }
  }

  const parts = [], entries = [];
  // the hero: the design's own, or the layout and styles chosen for this page
  let heroVariant = (design.home[0] || { variant: 'aurora' }).variant;
  if (kind === 'home' && heroChoice.variant && HERO[heroChoice.variant]) heroVariant = heroChoice.variant;
  if (kind === 'home' && video && !heroChoice.variant) heroVariant = design.videoHero && HERO[design.videoHero] ? design.videoHero : 'photo'; // a video needs a hero that draws behind its text
  K.dims = dims;
  const innerPic = heroBg ? { src: heroBg.src, alt: heroBg.alt } : banner ? { src: u(`/${banner.src}`), alt: banner.alt || '' } : null;
  // (the hero of the inner pages can be the one another design gives them: chosen once, for every inner page)
  const innerHero = design.prefix && spec.kit?.innerHero && INNER_HEROES.includes(spec.kit.innerHero) && HERO[spec.kit.innerHero] ? spec.kit.innerHero : design.innerHero;
  const heroShown = kind === 'home' ? heroVariant : innerHero || '';
  let heroHtml = kind === 'home' ? HERO[heroVariant](hero, K) : innerHero && HERO[innerHero] ? HERO[innerHero]({ ...hero, image: innerPic }, K) : heroBg || video ? pageHeroPhoto({ ...hero, image: heroBg ? { src: heroBg.src, alt: heroBg.alt } : hero.image }, K) : pageHero(hero, K);
  heroHtml = fromDesign(heroHtml, heroShown, design);
  if (collect) heroHtml = heroHtml.replace(/<section\b/, '<section data-kit-key="hero"');
  parts.push(heroHtml);
  const heroEntry = kind === 'home' ? design.home[0] || {} : {};
  entries.push(heroChoice.style ? { ...heroEntry, style: withMotion(heroEntry.style, heroChoice.style) } : heroEntry);
  // the points of the old hero: a hero layout that has no place for them gets them as a short list just below it
  const points = (hero.bullets || []).filter((b) => typeof b === 'string' && b.trim());
  if (points.length && !heroHtml.includes(esc(points[0]))) { parts.push(sec(`<div class="mx-auto max-w-3xl">${checkList(points)}</div>`, { tone: 'tint' })); entries.push({}); }
  // the order chosen for this page; a section it does not know keeps its place after the one before it
  const saved = spec.kit?.pageOrder?.[model.path] || [];
  if (saved.length) {
    const rank = new Map(saved.map((k, i) => [k, i]));
    const known = placed.filter((p) => rank.has(p.key)).sort((a, b) => rank.get(a.key) - rank.get(b.key));
    placed.forEach((p, i) => { if (rank.has(p.key)) return; const before = placed[i - 1]; const at = before ? known.indexOf(before) : -1; known.splice(at + 1, 0, p); });
    placed.splice(0, placed.length, ...known);
  }
  const removed = [];
  const info = [];
  let shown = 0, pictures = 0;
  const sideForm = ordered && kind === 'inner' && Boolean(K.formHtml) && !placed.some((p) => p.s.type === 'listform' || p.s.form);
  let formPlaced = false;
  const formAll = K.formHtml;
  let formDrawn = false;
  // (the section that stood beside the form on the old page carries it; a page that had none: its first text)
  const HOSTS = ['prose', 'split', 'faq', 'features'];
  const formHost = sideForm ? placed.find((p) => p.s.lead && HOSTS.includes(p.s.type)) || placed.find((p) => HOSTS.includes(p.s.type)) : null;
  for (const p of placed) {
    // a choice made for this section on this page (another layout of its kind, or another kind of section) wins over the design's
    // (what is chosen for a kind of section is chosen for it on every page; a choice made for this one page wins over it)
    const kv = spec.kit?.kinds?.[p.kind.id], own = mine[p.key];
    const { hide: _kh, html: _kx, ...kvc } = kv || {};
    const ov = kv || own ? { ...kvc, ...(own || {}), ...(kvc.style || own?.style ? { style: withMotion(kvc.style, own?.style) } : {}) } : undefined;
    const kindInfo = { kind: p.kind.id, kindLabel: p.kind.label, pages: kindPool?.kinds.find((k) => k.id === p.kind.id)?.count || 0, external: Boolean(p.external), kindChoice: Boolean(kv) };
    if (ov?.hide || (spec.kit?.dropRelated && /^explore related pages$/i.test(String(p.s.title || '').trim()))) {
      let gone = ''; try { gone = draw(p.s, p.variant, K); } catch { /* nothing to keep */ }
      removed.push(gone);
      if (collect) info.push({ key: p.key, role: p.role, variant: p.variant, label: labelOf(p.s), choice: true, hidden: true, options: [], ...kindInfo });
      continue;
    }
    let s = p.s, role = p.role, variant = p.variant, entry = p.entry;
    // (a design that keeps the page's order knows where the section stands: the first one meets the hero on the page's own ground)
    const hostsForm = sideForm && !formPlaced && p === formHost && !ov?.html;
    if (hostsForm) formPlaced = true;
    const stand = Boolean(p.external && p.s.lead && sideForm && HOSTS.includes(p.s.type) && !ov?.html);
    K.pos = { index: shown, first: shown === 0, picture: pictures, aside: hostsForm || stand, stand, kind, hero: prefixOf(heroShown) };
    if (ordered && shown === 0 && !ov?.tone) entry = { ...entry, tone: design.firstTone || 'white' };
    shown += 1;
    if (p.s.img || (p.s.blocks || []).some((b) => b.t === 'img')) pictures += 1;
    if (ov) {
      const to = ov.role && ov.role !== role ? convertTo(p.s, ov.role) : null;
      if (to) { s = to; role = ov.role; }
      if (ov.variant && LIBRARY[role]?.[ov.variant]) variant = ov.variant; else if (to) variant = Object.keys(LIBRARY[role])[0];
      if (ov.tone) entry = { ...entry, tone: ov.tone };
    }
    let html;
    // (the form's embed can stand on a page only once)
    if (formDrawn) K.formHtml = '';
    if (ov?.html) {
      // a section written by hand: what the design drew for it is not expected back
      try { removed.push(draw(p.s, p.variant, K)); } catch { /* nothing to keep */ }
      html = /^<section\b/i.test(ov.html) ? ov.html : `<section class="py-[var(--k-sec-y)]">${ov.html}</section>`;
    } else try { html = fromDesign(draw(s, variant, K), variant, design); } catch (e) { html = `<!-- kit: ${s.type} not drawn (${esc(e.message)}) -->`; }
    if (!formDrawn && formAll && /\bid="quote"/.test(html)) formDrawn = true;
    if (collect) html = html.replace(/<section\b/, `<section data-kit-key="${p.key}"`);
    parts.push(html); entries.push(ov?.style ? { ...entry, style: withMotion(entry.style, ov.style) } : entry);
    if (collect) info.push({ key: p.key, role, variant, from: designOfLayout(variant)?.name || '', label: labelOf(p.s), choice: Boolean(ov), edited: Boolean(ov?.html), style: ov?.style || {}, options: optionsFor(p, { K, design }, draw), ...kindInfo });
    K.pos = null;
  }
  K.formHtml = formAll;
  if (collect) {
    // the hero: this design's own layout, and the hero the other offered designs give the same page
    const heroDraw = (v) => (kind === 'home' ? HERO[v](hero, K) : HERO[v]({ ...hero, image: innerPic }, K));
    const heroNames = design.prefix ? (kind === 'home' ? HOME_HEROES : INNER_HEROES).filter((v) => HERO[v]) : kind === 'home' ? Object.keys(HERO).filter((v) => !/^[a-z]{2}-/.test(v)) : [];
    const heroOptions = [];
    for (const v of heroNames) {
      const from = designOfLayout(v), own = !design.prefix || v.startsWith(design.prefix);
      try { heroOptions.push({ id: `hero:${v}`, role: 'hero', variant: v, group: 'same', own, design: from ? from.name : '', label: from ? from.name : v.replace(/-/g, ' '), note: '', html: applyTones([fromDesign(heroDraw(v), v, design)], [{}])[0] }); } catch { /* a hero that cannot show this page is not offered */ }
    }
    heroOptions.sort((x, y) => Number(y.own) - Number(x.own));
    collect[model.path] = [{ key: 'hero', role: 'hero', variant: heroShown || heroVariant, from: designOfLayout(heroShown)?.name || '', label: 'Hero', hero: true, inner: kind !== 'home', choice: Boolean(mine.hero) || (kind !== 'home' && innerHero !== design.innerHero), style: heroChoice.style || {}, options: heroOptions, ...(kind === 'home' ? {} : { bg: { type: heroBg ? 'photo' : 'plain', image: heroBg?.src || '', images: bannerPics.map((p) => ({ src: p.src, alt: p.alt, w: p.w, h: p.h, url: (K.img(p.src, '', true).match(/\bsrc="([^"]+)"/) || [])[1] || p.src })) } }) }, ...info];
  }
  // a page with a form that no section placed: the form closes the page
  if (model.protected?.form && !parts.some((p) => /id="quote"/.test(p))) parts.push(sec(`<div class="mx-auto max-w-2xl">${quoteForm(K, 'Contact us')}</div>`, { tone: 'tint' }));
  // a picture keeps the size it really has: an old page's small icon is not stretched to the width of the column
  const sized = applyTones(parts, entries, { motion: motionDefaults(design.id), tagAll: Boolean(collect), tones: design.tones || null }).join('\n').replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (m, pre, src, post) => { const d = dims?.[src] || (/\.svg(\?|$)/i.test(src) ? { w: 64, h: 64 } : null); if (!d || /\bwidth=/.test(m)) return m; const icon = Math.abs(d.w / d.h - 1) < 0.12 && d.w <= 640; /* a small square picture is an icon or an illustration: it keeps a modest size */ const w = icon ? Math.min(d.w, 112) : d.w, h2 = icon ? Math.round((w * d.h) / d.w) : d.h; return `<img${pre}src="${src}"${post} width="${w}" height="${h2}">`; });
  const chrome = chromeHtml(design, K, { edit: Boolean(collect) });
  return { header: `${chrome.topbar}${chrome.header}`, main: apart(sized), footer: chrome.footer, mobile: chrome.mobile, design, removedHtml: removed.join('\n') };
}
