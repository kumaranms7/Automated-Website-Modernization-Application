import { esc, icon, T, btn, items, callTo, quoteTo, bodyOf, blocksOf, num, statsOf, revsOf, faqsOf, groupsOf, answerOf, initialsOf, shortIntro, plainText, introHtml, largePic, segments, asked, formHead, mapFrame, splitTitle, textShape, listShape, menuOf } from './shared.js';
import { quoteForm, contactItems } from '../sections2.js';
import { stars } from '../ui.js';

// The sections every design of this folder is made of.
//
// A design keeps the page's own sections in the page's own order and gives each kind of section one considered layout, which adapts to
// what the section holds (a picture or none, a heading or none, three items or thirty, a form beside it or not). How a section is READ is
// the same for every design (shared.js: textShape, listShape, ...); how it LOOKS is the design's: its class tokens (C) and the parts and
// sections it draws itself (own). Every part is called through X, so a part a design replaces is used everywhere it appears.
//
// The colours are always the website's theme: shades of the primary colour, and the theme's liveliest second colour ("pop") for the
// calls to action. The defaults below are the look of the Signature design.

export const web = (K) => K.web || {};
export const glowAt = (i) => `--k-glow-d:-${((i * 1.7) % 6).toFixed(1)}s`;
// the action a header, a drawer and the floating button offer: the one set in Design settings, else the website's own
export const ctaOf = (K) => ({ text: web(K).cta?.label || K.site.ctaLabel || 'Get a free quote', href: web(K).cta?.href || K.site.ctaHref || '#quote' });

const SHADOW = 'shadow-[0_1px_2px_rgb(15_23_42/.05),0_14px_34px_-20px_color-mix(in_srgb,var(--th-primary-900)_45%,transparent)]';
const PLAIN = `relative rounded-[calc(var(--k-r)*1.1)] border border-primary-100 bg-surface ${SHADOW} transition duration-300`;
export const CLS = {
  H2: 'font-display text-[clamp(1.85rem,1.15rem+2.5vw,3.1rem)] leading-[1.07] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950 on-dark:text-white',
  H2S: 'font-display text-[clamp(1.35rem,1.1rem+1.1vw,1.95rem)] leading-[1.2] font-[var(--k-h-weight)] tracking-[-.02em] [text-transform:var(--k-h-case)] text-balance text-primary-950 on-dark:text-white',
  H3: 'font-display text-[clamp(1.1rem,1rem+.45vw,1.32rem)] leading-snug font-[var(--k-h-weight)] tracking-[-.015em] [text-transform:var(--k-h-case)] text-primary-950 on-dark:text-white',
  P: 'text-[1rem] leading-relaxed text-secondary on-dark:text-white/75',
  LEAD: 'text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-secondary on-dark:text-white/80 [&_p_a]:font-semibold [&_p_a]:text-primary-700 [&_p_a]:underline on-dark:[&_p_a]:text-white [&_p+p]:mt-3',
  SHADOW, PLAIN,
  // (a card: the light on its border is the k-glow class of the stylesheet)
  CARD: `k-glow ${PLAIN}`,
  LIFT: 'hover:-translate-y-1.5 hover:border-primary-200 hover:shadow-[0_2px_4px_rgb(15_23_42/.05),0_30px_50px_-24px_color-mix(in_srgb,var(--th-primary-900)_55%,transparent)]',
  TILE: 'grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100 transition duration-300',
  GLASS: 'rounded-[calc(var(--k-r)*1.3)] border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgb(255_255_255/.18)] backdrop-blur-md',
  POP: 'bg-popbtn text-white shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--d-pop-btn,var(--th-secondary-700))_80%,transparent)] hover:brightness-110',
  GLASSBTN: 'border-white/35 bg-white/10 text-white backdrop-blur-md hover:border-white hover:bg-white/20',
  BRAND: 'bg-primary-700 text-white shadow-[0_14px_30px_-14px_color-mix(in_srgb,var(--th-primary-700)_80%,transparent)] hover:bg-primary-800',
  LINE: 'border-primary-200 bg-surface text-primary-900 hover:border-primary-700 hover:text-primary-700',
  WRAP: T.wrap,
  SEC: 'relative py-[calc(var(--k-sec-y)*.8)]',
  GAP: 'gap-[clamp(1rem,2vw,1.5rem)]',
  PICSHADOW: 'shadow-[0_30px_60px_-30px_color-mix(in_srgb,var(--th-primary-950)_60%,transparent)]',
  // a dark band of the brand: the deepest shade of the primary colour, a glow of the colour itself and a faint grid
  DEEP: 'on-dark relative isolate overflow-hidden bg-primary-950 text-white before:absolute before:-top-48 before:-left-40 before:-z-10 before:size-[44rem] before:rounded-full before:bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--th-primary-500)_38%,transparent),transparent)] after:absolute after:inset-0 after:-z-10 after:bg-[linear-gradient(rgb(255_255_255/.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/.04)_1px,transparent_1px)] after:bg-[size:3.5rem_3.5rem] after:[mask-image:radial-gradient(70%_80%_at_70%_30%,#000,transparent)]',
  // small words a design can set its own way
  TONE: 'text-primary-600 on-dark:text-pop-300', // the last words of a heading
  NUM: 'font-display text-[.95rem] font-extrabold tracking-[.14em] text-primary-600', // the number of a card that has no mark
  HEADGAP: 'mb-[clamp(1.75rem,3.5vw,3rem)]',
  // a row of offers or of points right under the hero: it overlaps the hero's edge
  UNDERHERO: 'z-10 -mt-[clamp(1.5rem,4.5vw,4rem)] pb-[clamp(2.5rem,5vw,4.5rem)]',
};

// a menu item of a header; one with pages under it opens a panel of them on hover and on keyboard focus
// (link, panel, item: the design's classes for the link, the panel and a link inside the panel)
export function menuItem(K, n, { link, panel, item, more = 'bg-primary-50 text-primary-700 hover:bg-primary-100' }) {
  const kids = n.children || [];
  const cur = n.current ? ' aria-current="page"' : '';
  if (!kids.length) return `<a class="${link}" data-p="navLink" href="${esc(K.u(n.href))}"${cur}>${esc(n.label)}</a>`;
  const shown = kids.slice(0, 14), wide = shown.length > 7;
  return `<div class="group/dd relative"><a class="${link}" data-p="navLink" href="${esc(K.u(n.href))}"${cur} aria-haspopup="true">${esc(n.label)}${icon('chevron', 'size-3.5 transition duration-300 group-hover/dd:rotate-180')}</a><div class="invisible absolute top-full left-1/2 z-50 ${wide ? 'w-[34rem]' : 'w-72'} -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition duration-200 group-focus-within/dd:visible group-focus-within/dd:translate-y-0 group-focus-within/dd:opacity-100 group-hover/dd:visible group-hover/dd:translate-y-0 group-hover/dd:opacity-100"><div class="${panel}"><ul class="m-0 grid list-none gap-0.5 p-0 ${wide ? 'grid-cols-2' : ''}">${shown.map((c) => `<li><a class="${item}" href="${esc(K.u(c.href))}">${esc(c.label)}${icon('arrow', 'size-3.5 shrink-0 opacity-0 transition group-hover/dd:opacity-40')}</a></li>`).join('')}</ul>${kids.length > shown.length ? `<a class="mt-1.5 flex items-center justify-center gap-2 px-3.5 py-2.5 text-[.9rem] font-bold transition ${more}" href="${esc(K.u(n.href))}">All ${esc(n.label.toLowerCase())}${icon('arrow', 'size-3.5')}</a>` : ''}</div></div></div>`;
}
// the strip over a header says: the announcement set in Design settings, else the hours, else the address (a preview: a placeholder line)
export function stripSays(K) {
  const w = web(K), s = K.site, a = w.announce || {};
  if (a.on !== false && a.text) return { text: a.text, href: a.href || '', icon: '' };
  if (w.hours || s.hours) return { text: w.hours || s.hours, href: '', icon: 'clock' };
  if (s.address) return { text: s.address, href: '', icon: 'pin' };
  return K.real ? null : { text: 'Serving your local area', href: '', icon: 'pin' };
}

export function sections(C0 = {}, own = () => ({})) {
  const C = { ...CLS, ...C0 };
  const X = {};

  // ---------- the head of a section ----------
  // the last words of a heading in the brand's colour (the heading's own words, only their colour changes)
  X.tone2 = (title, cls = C.TONE) => {
    const t = String(title || '');
    if (/<[a-z]/i.test(t)) return t;
    const [a, b] = splitTitle(t);
    return b ? `${esc(a)} <span class="${cls}">${esc(b)}</span>` : esc(a);
  };
  // a heading of a section; one that is a whole sentence is set smaller, in one colour
  X.h2 = (title, cls = '', tone) => (plainText(title).length > 64 ? `<h2 class="${C.H2S} ${cls}">${/<[a-z]/i.test(String(title)) ? title : esc(title)}</h2>` : `<h2 class="${C.H2} ${cls}" data-k-words>${tone ? X.tone2(title, tone) : X.tone2(title)}</h2>`);
  X.eyebrow = (t) => (t ? `<span class="inline-flex items-center gap-2.5 text-[.74rem] font-bold tracking-[.18em] text-primary-700 uppercase on-dark:text-primary-200"><i class="relative block size-2.5 rounded-full bg-pop-500 after:absolute after:-inset-1 after:rounded-full after:border after:border-pop-500/50"></i>${esc(t)}</span>` : '');
  X.rule = () => '<i class="block h-1 w-14 rounded-full bg-linear-to-r from-pop-500 to-pop-300" data-k-line></i>';
  // a small label over a section that has none of its own, named after the kind of section (never when the heading already says it)
  X.labelOf = (s, K, word) => (s.eyebrow ? s.eyebrow : K.real && web(K).labels !== false && word && !new RegExp(word.split(' ')[0], 'i').test(s.title || '') ? word : '');
  // the head of a section: its label (or a short rule), its heading and its introduction
  X.top = (s, K, { center = false, word = '', lead, cls = '' } = {}) => {
    const e = X.labelOf(s, K, word), l = lead === undefined ? introHtml(s) : lead;
    if (!s.title && !e && !l) return '';
    return `<div class="${C.HEADGAP} grid gap-4 ${center ? 'mx-auto max-w-3xl justify-items-center text-center' : 'max-w-3xl'} ${cls}">${e ? X.eyebrow(e) : s.title ? X.rule() : ''}${s.title ? X.h2(s.title) : ''}${l ? `<div class="${C.LEAD}">${l}</div>` : ''}</div>`;
  };
  // (the label and the heading of a text, apart: a text places them itself)
  X.label = (s) => X.eyebrow(s.eyebrow) || (s.title ? X.rule() : '');

  // ---------- small parts ----------
  X.check = (cls = 'bg-primary-700 text-white') => `<span class="mt-0.5 grid size-[1.4rem] shrink-0 place-items-center rounded-full ${cls}">${icon('check', 'size-3 stroke-[3.5]')}</span>`;
  X.checklist = (list, cols = '') => `<ul class="m-0 grid list-none gap-x-10 gap-y-3.5 p-0 ${cols}">${list.map((t) => `<li class="flex items-start gap-3 leading-snug font-semibold text-primary-950 on-dark:text-white">${X.check()}<span>${esc(typeof t === 'string' ? t : t.title || t.text || '')}</span></li>`).join('')}</ul>`;
  // the panel a short list stands on
  X.listPanel = (lines, cols) => `<div class="${C.PLAIN} p-[clamp(1.25rem,3vw,2.25rem)]" data-k-reveal>${X.checklist(lines, cols)}</div>`;
  X.arrowLink = (label) => `<span class="mt-auto inline-flex items-center gap-2 pt-1 text-[.95rem] font-bold text-primary-700">${esc(label)}<span class="grid size-7 place-items-center rounded-full bg-primary-50 transition duration-300 group-hover/card:translate-x-1 group-hover/card:bg-primary-700 group-hover/card:text-white">${icon('arrow', 'size-3.5')}</span></span>`;
  X.callBtn = (K, kind = C.BRAND) => (callTo(K) ? btn(callTo(K), kind, false) : '');
  X.numMark = (i) => `<span class="${C.NUM}">${num(i)}</span>`;
  // the mark of an item on a tile: the website's own small picture, else a named icon (a preview draws the business type's icons)
  X.tile = (K, c, i, group, cls = '') => {
    const pic = c.img?.src && !c.photo ? c.img.src : typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
    const name = typeof c.icon === 'string' && /^[a-z]+$/.test(c.icon) ? c.icon : '';
    // (a mark drawn in white stands on the brand's colour)
    if (pic) return `<span class="${C.TILE} ${cls} ${K.dims?.[pic]?.light ? 'bg-primary-700! ring-primary-700!' : ''} [&_img]:size-7 [&_img]:object-contain">${K.img(pic, c.img?.alt || '')}</span>`;
    if (name || !K.real) return `<span class="${C.TILE} ${cls} group-hover/card:bg-primary-700 group-hover/card:text-white group-hover/card:ring-primary-700">${icon(name || K.iconFor(c, i, group), 'size-6')}</span>`;
    return '';
  };
  // a card: a link when it leads somewhere; it comes into view after the one before it
  X.shell = (inner, { href = '', i = 0, cls = '', tag = 'div', step = 80, per = 4, reveal = '' } = {}) => {
    const all = `group/card ${C.CARD} ${C.LIFT} ${cls}`;
    const more = `data-k-reveal${reveal ? `="${reveal}"` : ''} style="transition-delay:${(i % per) * step}ms;${glowAt(i)}"`;
    return href ? `<a class="${all}" href="${esc(href)}" ${more}>${inner}</a>` : `<${tag} class="${all}" ${more}>${inner}</${tag}>`;
  };
  // the website's form on a card (the form itself is the website's own embed, untouched); without a form, the ways to call
  X.formCard = (K, s = {}) => {
    const f = formHead(K, s);
    // (in the preview of the inner template: where the page's form stands beside an example taken from another page)
    if (K.pos?.stand) return `<div class="${C.PLAIN} grid min-h-[20rem] content-center justify-items-center gap-3 border-dashed p-[clamp(1.25rem,3vw,2.25rem)] text-center"><span class="${C.TILE}">${icon('mail', 'size-6')}</span><p class="${C.H3} m-0 text-[1.3rem]">${esc(f.title)}</p><p class="${C.P} m-0 text-[.95rem]">The page's form stands here.</p></div>`;
    const intro = (s.formBlocks || []).map((b) => b.html || '').join('');
    if (K.formHtml) return `<div class="${C.PLAIN} prose-k form-k grid gap-4 overflow-hidden p-[clamp(1.25rem,3vw,2.25rem)] before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-linear-to-r before:from-pop-500 before:to-primary-500" id="quote"><h2 class="${C.H3} text-[1.45rem]">${esc(f.title)}</h2>${f.sub ? `<p class="${C.P} -mt-2">${esc(f.sub)}</p>` : ''}${intro ? `<div data-p="content">${intro}</div>` : ''}${K.formHtml}</div>`;
    if (K.real) return `<div class="${C.DEEP} grid gap-4 rounded-[calc(var(--k-r)*1.4)] p-[clamp(1.5rem,3vw,2.5rem)]"><h2 class="${C.H3} text-[1.45rem] text-white">${esc(f.title)}</h2>${intro ? `<div class="prose-k text-white/85" data-p="content">${intro}</div>` : ''}<div class="flex flex-wrap gap-3.5">${btn(quoteTo(null, K), C.POP, true)}${X.callBtn(K, C.GLASSBTN)}</div></div>`;
    return quoteForm(K, f.title);
  };
  // a section that carries the page's form beside it, as the old page did: the content on the left, the form on a card that stays in view
  X.sided = (K, s) => Boolean(K.pos?.aside || (s.form && K.formHtml));
  X.frame = (K, s, inner) => `<section class="${C.SEC}"><div class="${C.WRAP} grid items-start gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.85fr)]"><div class="grid gap-6">${inner}</div><aside class="lg:sticky lg:top-28" data-k-reveal="right">${X.formCard(K, s)}</aside></div></section>`;

  // ---------- trust ----------
  // offers and coupons: tickets with the offer set large; right under the hero they overlap its edge
  X.offers = (s, K) => {
    const list = items(s).map((x) => (typeof x === 'string' ? { label: x } : x));
    const links = (s.links || []).filter((l) => l?.text && !l.mobile);
    return `<section class="relative ${K.pos?.first ? C.UNDERHERO : 'py-[clamp(2.5rem,5vw,4.5rem)]'}"><div class="${C.WRAP}">${X.top(s, K)}<ul class="m-0 grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fit,minmax(13.5rem,1fr))]">${list.map((x, i) => `<li class="group/card ${C.CARD} ${C.LIFT} grid content-start gap-1.5 overflow-hidden p-5 pl-7 before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-linear-to-b before:from-pop-400 before:to-pop-600" data-k-reveal style="transition-delay:${i * 70}ms;${glowAt(i)}">${x.badge ? `<b class="font-display text-[1.5rem] leading-none font-extrabold tracking-tight text-popbtn">${esc(x.badge)}</b>` : ''}<span class="text-[.95rem] leading-snug font-semibold text-primary-950">${esc(x.label || x.title || x.text || '')}</span></li>`).join('')}</ul>${links.length ? `<div class="mt-7 flex flex-wrap justify-center gap-3.5">${links.map((l, i) => btn(l, i ? C.LINE : C.BRAND, !i)).join('')}</div>` : ''}</div></section>`;
  };
  // short points of trust: a mark and a line each
  X.points = (s, K) => {
    const list = items(s).map((x) => (typeof x === 'string' ? { title: x } : x));
    return `<section class="relative ${K.pos?.first ? C.UNDERHERO : 'py-[clamp(2.5rem,5vw,4.5rem)]'}"><div class="${C.WRAP}">${X.top(s, K)}<ul class="m-0 grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fit,minmax(14.5rem,1fr))]">${list.map((x, i) => `<li class="group/card ${C.CARD} ${C.LIFT} flex items-center gap-4 p-4 pr-5" data-k-reveal style="transition-delay:${i * 70}ms;${glowAt(i)}">${X.tile(K, x, i, 'trust') || `<span class="${C.TILE}">${icon('check', 'size-5 stroke-[3]')}</span>`}<span class="font-display text-[1.02rem] leading-snug font-bold text-primary-950">${esc(x.title || x.text || x.label || '')}</span></li>`).join('')}</ul></div></section>`;
  };

  // ---------- cards ----------
  // how many columns a grid of n cards takes
  X.colsOf = (n, { small = false, pics = false } = {}) => (n === 1 ? 'mx-auto max-w-xl' : n === 2 ? 'sm:grid-cols-2' : n === 4 || n === 8 || (small && !pics) ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3');
  // services and other cards: with pictures they are picture cards (the website's own icon on the edge of the picture), else icon or numbered cards
  X.cards = (s, K) => {
    const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
    const hasPics = list.some((c) => c.img);
    const Hn = s.title ? 'h3' : 'h2';
    const body = (c, i) => {
      const label = c.title || c.text || c.label || '';
      const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
      const mark = X.tile(K, { ...c, photo: true }, i) || X.numMark(i);
      const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
      if (c.img) return `<div class="relative"><div class="aspect-[16/10] overflow-hidden rounded-t-[calc(var(--k-r)*1.1)] [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.06]">${K.img(c.img, c.imgAlt || label)}</div>${ownIcon ? `<span class="absolute -bottom-6 left-5 grid size-[3.25rem] place-items-center rounded-2xl ${K.dims?.[ownIcon]?.light ? 'bg-primary-700' : 'bg-surface ring-1 ring-primary-100'} shadow-[0_10px_24px_-10px_rgb(0_0_0/.35)] [&_img]:size-8 [&_img]:object-contain">${K.img(ownIcon, '')}</span>` : ''}</div><div class="grid flex-1 content-start gap-2.5 p-6 ${ownIcon ? 'pt-9' : ''}"><${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${c.href ? X.arrowLink(c.cta || 'Learn more') : ''}</div>`;
      return `<div class="grid flex-1 content-start gap-3.5 p-6">${mark}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${c.href ? X.arrowLink(c.cta || 'Learn more') : ''}</div>`;
    };
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: !s.small })}<div class="grid ${C.GAP} ${X.colsOf(list.length, { small: s.small, pics: hasPics })}">${list.map((c, i) => X.shell(body(c, i), { href: c.href, i, cls: 'flex flex-col' })).join('')}</div></div></section>`;
  };

  // ---------- pictures ----------
  // pictures with a line each (a caption or a link): a picture card
  X.picCard = (K, { img, cap }, i) => `<figure class="group/card ${C.CARD} ${C.LIFT} m-0 flex flex-col overflow-hidden" data-k-reveal style="transition-delay:${(i % 3) * 80}ms;${glowAt(i)}"><div class="aspect-[16/10] overflow-hidden [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.06]">${K.img(img.src, img.alt || '')}</div><figcaption class="p-5 font-display text-[1.02rem] leading-snug font-bold text-primary-950 [&_a]:text-primary-950 [&_a]:no-underline [&_a]:transition hover:[&_a]:text-primary-700 [&_p]:m-0">${cap.t === 'h' ? esc(cap.text) : cap.html}</figcaption></figure>`;
  // a photograph: framed, with a soft block of the brand's colours behind its corner
  X.photo = (K, src, alt, { side = '', cls = '' } = {}) => `<div class="relative ${cls}" data-k-reveal="${side || 'zoom'}"><div class="absolute inset-0 -z-10 ${side === 'right' ? '-translate-x-3' : 'translate-x-3'} translate-y-3 rounded-[calc(var(--k-r)*1.7)] bg-linear-to-br from-primary-100 to-pop-100"></div><div class="overflow-hidden rounded-[calc(var(--k-r)*1.6)] ${C.PICSHADOW} [&_img]:h-auto [&_img]:max-h-[34rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div>`;
  // a small picture (a badge, a seal, an illustration) keeps its own size, on a tile
  X.mark = (K, src, alt, cls = '') => `<div class="grid w-fit place-items-center rounded-[calc(var(--k-r)*1.6)] bg-surface p-[clamp(1.25rem,3vw,2.25rem)] ring-1 ring-primary-100 ${C.SHADOW} [&_img]:h-auto [&_img]:max-h-56 [&_img]:max-w-full ${cls}" data-k-reveal="zoom">${K.img(src, alt || '')}</div>`;
  X.picture = (K, src, alt, opts = {}) => (largePic(K, src) ? X.photo(K, src, alt, opts) : X.mark(K, src, alt, opts.cls));
  X.prose = (html) => `<div class="prose-k max-w-none" data-p="content">${html}</div>`;
  // the body of a text: its paragraphs as they are; a picture inside it is drawn where the text has it; a run of pictures with a line each
  // becomes a grid of picture cards
  X.flowOf = (blocks, K) => {
    const out = [];
    for (const g of segments(blocks)) {
      if (g.kind === 'pairs') { out.push(`<div class="grid gap-4 sm:grid-cols-2 ${g.list.length === 2 || g.list.length === 4 ? '' : 'xl:grid-cols-3'}">${g.list.map((p, n) => X.picCard(K, p, n)).join('')}</div>`); continue; }
      let run = [];
      const flush = () => { if (run.length) out.push(X.prose(blocksOf(run))); run = []; };
      for (const b of g.blocks) { if (b.t === 'img' && b.src) { flush(); out.push(X.picture(K, b.src, b.alt)); } else run.push(b); }
      flush();
    }
    return out.length > 1 ? `<div class="grid gap-7">${out.join('')}</div>` : out.join('');
  };
  X.flow = (s, K) => (Array.isArray(s.blocks) ? X.flowOf(s.blocks, K) : X.prose(bodyOf(s)));

  // ---------- text ----------
  // several headings, each with its own text: two or three stand side by side as cards; many, or long ones, are rows (the heading beside its text)
  X.topicRows = (sh) => sh.topics.length > 4 || (sh.topics.length > 2 && sh.long > 700);
  X.topicsHead = (sh) => (sh.s.title || sh.opening.length ? `<div class="${C.HEADGAP} grid max-w-3xl gap-4">${sh.s.title ? `${X.rule()}${X.h2(sh.s.title)}` : ''}${sh.opening.length ? `<div class="${C.LEAD}" data-p="content">${blocksOf(sh.opening)}</div>` : ''}</div>` : '');
  X.topics = (sh, K) => {
    const list = sh.topics, n = list.length;
    const Hn = sh.s.title ? 'h3' : 'h2';
    const head = X.topicsHead(sh);
    if (X.topicRows(sh)) return `<section class="${C.SEC}"><div class="${C.WRAP}">${head}<div class="border-t border-primary-200">${list.map((t) => `<div class="grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-3 border-b border-primary-100 py-[clamp(1.4rem,3vw,2.1rem)] lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.5fr)]" data-k-reveal><${Hn} class="${C.H3} text-[clamp(1.2rem,1rem+.8vw,1.55rem)]">${esc(t.title)}</${Hn}>${X.flowOf(t.blocks, K)}</div>`).join('')}</div></div></section>`;
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${head}<div class="grid ${C.GAP} ${n === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}">${list.map((t, i) => X.shell(`<span class="font-display text-[.95rem] font-extrabold tracking-[.14em] text-pop-500">${num(i)}</span><${Hn} class="${C.H3} text-[clamp(1.25rem,1.05rem+.8vw,1.6rem)]">${esc(t.title)}</${Hn}>${X.flowOf(t.blocks, K)}`, { i, tag: 'article', cls: 'grid content-start gap-4 p-[clamp(1.4rem,3vw,2.25rem)]', step: 90, per: 3 })).join('')}</div></div></section>`;
  };
  // a text and its picture, side by side; a long text goes on under both, in two columns
  X.textPicture = (sh, K, p) => {
    const right = (K.pos?.picture || 0) % 2 === 1;
    const body = sh.side ? X.flowOf(sh.side, K) : X.flow(sh.s, K);
    const more = sh.under.length ? `<div class="mt-[clamp(2rem,4vw,3.25rem)] border-t border-primary-100 pt-[clamp(2rem,4vw,3.25rem)]" data-k-reveal><div class="prose-k max-w-none lg:columns-2 lg:gap-x-[clamp(2.5rem,5vw,5rem)] [&>*]:mt-0! [&>*]:mb-5 [&>*]:break-inside-avoid [&>h3]:break-after-avoid" data-p="content">${blocksOf(sh.under)}</div>${p.list}${p.call}</div>` : '';
    return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="grid ${sh.under.length ? 'items-start' : 'items-center'} gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-2"><div class="${right ? 'lg:order-2' : ''}">${X.photo(K, sh.pic.src, sh.pic.alt, { side: right ? 'right' : 'left' })}</div><div class="grid content-center gap-5" data-k-reveal="${right ? 'left' : 'right'}">${p.label}${p.heading}${body}${sh.under.length ? '' : `${p.list}${p.call}`}</div></div>${more}</div></section>`;
  };
  // a heading and a longer text: the heading stays in view while its text is read
  X.textTitled = (sh, K, p) => `<section class="${C.SEC}"><div class="${C.WRAP} grid items-start gap-x-[clamp(2rem,5vw,5rem)] gap-y-6 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.5fr)]"><div class="grid gap-4 lg:sticky lg:top-32">${p.label}${p.heading}</div><div class="grid gap-5 ${shortIntro(sh.s) ? '[&_.prose-k>p:first-child]:text-[1.14rem] [&_.prose-k>p:first-child]:leading-relaxed [&_.prose-k>p:first-child]:text-primary-950' : ''}" data-k-reveal>${X.flow(sh.s, K)}${p.list}</div></div></section>`;
  X.textShort = (sh, K, p) => `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="mx-auto grid max-w-3xl justify-items-center gap-5 text-center">${p.label}${p.heading}<div class="${C.LEAD} [&_.not-prose]:justify-center" data-p="content" data-k-reveal>${bodyOf(sh.s)}</div></div></div></section>`;
  // a text and a small picture: the mark stands beside the text
  X.textMark = (sh, K, p) => `<section class="${C.SEC}"><div class="${C.WRAP} grid items-center gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,.55fr)]"><div class="grid gap-5" data-k-reveal>${p.label}${p.heading}${X.flow(sh.s, K)}${p.list}</div><div class="justify-self-center lg:justify-self-end">${X.mark(K, sh.pic.src, sh.pic.alt)}</div></div></section>`;
  // text: what it holds decides its form (see textShape)
  X.text = (s0, K) => {
    const sh = textShape(s0, K, { sided: X.sided(K, s0) });
    if (sh.kind === 'topics') return X.topics(sh, K);
    const s = sh.s;
    const p = {
      label: X.label(s), heading: s.title ? X.h2(s.title) : '',
      list: s.items?.length ? `<div class="mt-1">${X.checklist(s.items, s.items.length > 3 ? 'sm:grid-cols-2' : '')}</div>` : '',
      call: callTo(K) ? `<div class="mt-2 flex flex-wrap gap-3.5">${X.callBtn(K)}</div>` : '',
    };
    switch (sh.kind) {
      // nothing but pictures with a line each: a grid of picture cards under the heading
      case 'pairs': return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true })}<div class="grid ${C.GAP} sm:grid-cols-2 ${sh.list.length === 2 || sh.list.length === 4 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}">${sh.list.map((x, i) => X.picCard(K, x, i)).join('')}</div></div></section>`;
      // nothing but pictures: shown wide and centred
      case 'pictures': return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="mx-auto grid max-w-4xl justify-items-center gap-5 ${sh.list.length > 1 ? 'sm:grid-cols-2' : ''}">${sh.list.map((b) => X.picture(K, b.src, b.alt)).join('')}</div></div></section>`;
      // beside the page's form: the text as the page has it, its picture where the page had it
      case 'side': {
        const pic = sh.pic ? X.picture(K, sh.pic.src, sh.pic.alt) : '';
        return X.frame(K, s, `${p.label || p.heading ? `<div class="grid gap-4">${p.label}${p.heading}</div>` : ''}${sh.pic && !sh.pic.after ? pic : ''}${X.flow(s, K)}${p.list}${sh.pic?.after ? pic : ''}`);
      }
      case 'mark': return X.textMark(sh, K, p);
      case 'picture': return X.textPicture(sh, K, p);
      case 'plain': return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="mx-auto grid max-w-3xl gap-5" data-k-reveal>${X.flow(s, K)}${p.list}</div></div></section>`;
      case 'wide': return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="mb-[clamp(1.5rem,3vw,2.5rem)] grid max-w-3xl gap-4">${p.label}${p.heading}</div>${X.flow(s, K)}${p.list}</div></section>`;
      case 'short': return X.textShort(sh, K, p);
      default: return X.textTitled(sh, K, p);
    }
  };

  // ---------- lists ----------
  // a point that has a line of its own: a card
  X.featureCard = (K, x, i, Hn) => X.shell(`${X.tile(K, x, i, 'benefits') || `<span class="${C.NUM}">${num(i)}</span>`}<${Hn} class="${C.H3}">${esc(x.title)}</${Hn}>${x.text ? `<p class="${C.P} text-[.97rem]">${esc(x.text)}</p>` : ''}`, { i, cls: 'grid content-start gap-3.5 p-6', per: 3 });
  // a list of points: cards when every point has a line of its own, a calm checklist when they are short; the text before the list
  // introduces it, the text after the list follows it
  X.features = (s, K) => {
    const f = listShape(s);
    const side = X.sided(K, s);
    const Hn = s.title ? 'h3' : 'h2';
    const after = f.after ? X.prose(f.after) : '';
    const pic = s.img ? X.picture(K, s.img, s.imgAlt || '') : '';
    if (f.rich) {
      const cols = side || f.list.length === 2 || f.list.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';
      const grid = `<div class="grid ${C.GAP} ${cols}">${f.list.map((x, i) => X.featureCard(K, x, i, Hn)).join('')}</div>`;
      if (side) return X.frame(K, s, `${X.top(s, K, { cls: 'mb-0' })}${grid}${after}${pic}`);
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K)}${pic ? `<div class="grid items-start gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)]"><div class="grid gap-6">${grid.replace('lg:grid-cols-3', '')}${after}</div>${pic}</div>` : `${grid}${after ? `<div class="mt-8 max-w-3xl">${after}</div>` : ''}`}</div></section>`;
    }
    const wide = !s.title && !f.before && !side;
    const panel = X.listPanel(f.lines, f.lines.length > 3 ? (f.short && f.lines.length >= 6 && wide ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2') : '');
    if (side) return X.frame(K, s, `${X.top(s, K, { cls: 'mb-0' })}${panel}${after}${pic}`);
    if (wide) return `<section class="${C.SEC}"><div class="${C.WRAP} grid gap-6">${panel}${after ? `<div class="max-w-3xl">${after}</div>` : ''}${pic}</div></section>`;
    return `<section class="${C.SEC}"><div class="${C.WRAP} grid items-start gap-x-[clamp(2rem,5vw,5rem)] gap-y-6 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.35fr)]"><div class="grid gap-6 lg:sticky lg:top-32">${X.top(s, K, { cls: 'mb-0' })}${pic}</div><div class="grid gap-6">${panel}${after}</div></div></section>`;
  };

  // steps: numbered cards
  X.steps = (s, K) => {
    const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
    const Hn = s.title || !K.real ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true, word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="relative m-0 grid list-none ${C.GAP} p-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))]">${list.map((t, i) => `<li class="group/card ${C.CARD} ${C.LIFT} grid content-start gap-3 overflow-hidden p-6" data-k-reveal style="transition-delay:${i * 100}ms;${glowAt(i)}"><span class="pointer-events-none absolute top-2 right-4 font-display text-[4.5rem] leading-none font-extrabold text-primary-50 transition duration-300 group-hover/card:text-pop-100" aria-hidden="true">${num(i)}</span><span class="relative grid size-11 place-items-center rounded-full bg-primary-700 font-display text-sm font-bold text-white">${i + 1}</span><${Hn} class="${C.H3} relative">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} relative text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
  };

  // figures: a deep panel of the brand set into the page, the numbers counting up; the picture that stood beside them stays beside them
  X.stats = (s, K) => {
    const list = statsOf(s);
    // four figures, or a long one, are set a size smaller so that none runs into the next
    const tight = list.length > 3 || list.some((x) => String(x.value || '').length > 6) || Boolean(s.img);
    const figures = `<dl class="m-0 grid gap-y-9 sm:grid-cols-2 ${s.img ? 'lg:grid-cols-3' : 'lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]'} lg:divide-x lg:divide-white/15">${list.map((x) => `<div class="grid gap-2 lg:px-[clamp(1rem,2.5vw,2.5rem)] lg:first:pl-0"><dd class="order-first m-0 font-display ${tight ? 'text-[clamp(2.1rem,1.3rem+2vw,3.1rem)]' : 'text-[clamp(2.6rem,1.6rem+3.2vw,4.4rem)]'} leading-none font-extrabold tracking-tight text-white" data-count="${esc(x.value)}">${esc(x.value)}</dd><dt class="text-[.98rem] leading-snug font-semibold text-white/75">${esc(x.label)}</dt></div>`).join('')}</dl>`;
    return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="${C.DEEP} rounded-[calc(var(--k-r)*1.8)] px-[clamp(1.5rem,4vw,4rem)] py-[clamp(2.25rem,5vw,4rem)] shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--th-primary-950)_80%,transparent)]" data-k-reveal="zoom">${s.title ? X.h2(s.title, 'mb-[clamp(1.5rem,3vw,2.5rem)] text-white', 'text-pop-300') : ''}${s.img ? `<div class="grid items-center gap-[clamp(1.5rem,4vw,3.5rem)] lg:grid-cols-[1.5fr_1fr]">${figures}<div class="overflow-hidden rounded-[calc(var(--k-r)*1.3)] ring-1 ring-white/15 [&_img]:h-auto [&_img]:max-h-72 [&_img]:w-full [&_img]:object-cover">${K.img(s.img, s.imgAlt || '')}</div></div>` : figures}</div></div></section>`;
  };

  // reviews: cards; a row to scroll through when there are many
  X.reviewCard = (r, i, cls = '') => `<figure class="${C.CARD} m-0 grid content-between gap-6 p-7 ${cls}" data-k-reveal style="transition-delay:${(i % 3) * 90}ms;${glowAt(i)}"><div class="grid gap-4"><div class="flex items-center justify-between gap-4">${stars()}<span class="font-display text-[3.2rem] leading-[.5] font-extrabold text-pop-300" aria-hidden="true">”</span></div><blockquote class="m-0 text-[1.03rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center gap-3.5 border-t border-primary-100 pt-5"><span class="grid size-11 shrink-0 place-items-center rounded-full bg-linear-to-br from-primary-600 to-primary-900 font-display text-sm font-bold text-white">${esc(initialsOf(r.name))}</span><span class="grid"><b class="text-primary-950">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-muted">${esc(r.place || r.role)}</small>` : ''}</span></figcaption></figure>`;
  X.scrollBtn = (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="grid size-12 place-items-center rounded-full border border-primary-200 bg-surface text-primary-900 transition hover:border-primary-700 hover:bg-primary-700 hover:text-white">${icon('arrow', dir === 'prev' ? 'size-5 rotate-180' : 'size-5')}</button>`;
  X.reviews = (s, K) => {
    const list = revsOf(s);
    if (list.length > 6) return `<section class="${C.SEC}"><div class="${C.WRAP}" data-scroller><div class="flex flex-wrap items-end justify-between gap-6">${X.top(s, K, { word: 'Reviews' })}<div class="${C.HEADGAP} flex gap-2.5">${X.scrollBtn('prev')}${X.scrollBtn('next')}</div></div><div data-scroll-track class="flex gap-5 overflow-x-auto pb-4" tabindex="0" aria-label="Reviews">${list.map((r, i) => X.reviewCard(r, i, 'w-[min(24rem,84vw)] shrink-0')).join('')}</div></div></section>`;
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true, word: 'Reviews' })}<div class="grid ${C.GAP} ${list.length === 1 ? 'mx-auto max-w-2xl' : list.length === 2 || list.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}">${list.map((r, i) => X.reviewCard(r, i)).join('')}</div></div></section>`;
  };

  // questions fold; topics (headings that are not questions) are shown open, each heading beside its text
  X.faqRow = (f, i) => `<details class="group ${C.PLAIN} open:border-primary-300 open:shadow-[0_2px_4px_rgb(15_23_42/.05),0_30px_50px_-28px_color-mix(in_srgb,var(--th-primary-900)_55%,transparent)]"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 60}ms"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 px-6 py-5 font-display text-[1.08rem] leading-snug font-bold text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="grid size-9 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700 transition duration-300 group-open:rotate-45 group-open:bg-primary-700 group-open:text-white">${icon('plus', 'size-4')}</span></summary><div class="px-6 pb-6">${answerOf(f.a)}</div></details>`;
  X.faqRows = (list) => `<div class="grid gap-3.5">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`;
  X.faq = (s, K) => {
    const list = faqsOf(s);
    const side = X.sided(K, s);
    const Hn = s.title ? 'h3' : 'h2';
    const pic = s.img ? X.picture(K, s.img, s.imgAlt || s.sideTitle || '', { side: 'right' }) : '';
    const sideTitle = s.sideTitle ? `<p class="font-display text-[1.15rem] font-bold text-primary-950">${esc(s.sideTitle)}</p>` : '';
    if (!asked(list)) {
      const rows = `<div class="border-t border-primary-200">${list.map((f) => `<div class="grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-3 border-b border-primary-100 py-[clamp(1.4rem,3vw,2.1rem)] ${side || s.img ? '' : 'lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.5fr)]'}" data-k-reveal><${Hn} class="${C.H3} text-[clamp(1.2rem,1rem+.8vw,1.55rem)]">${esc(f.q)}</${Hn}>${answerOf(f.a)}</div>`).join('')}</div>`;
      if (side) return X.frame(K, s, `${X.top(s, K, { cls: 'mb-0' })}${rows}${s.img ? `<div class="grid gap-3">${sideTitle}${pic}</div>` : ''}`);
      // the picture that stood beside the text stays beside it
      if (s.img) return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K)}<div class="grid items-start gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.7fr)]">${rows}<div class="grid gap-3 lg:sticky lg:top-32">${sideTitle}${pic}</div></div></div></section>`;
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K)}${rows}</div></section>`;
    }
    const rows = X.faqRows(list);
    if (side) return X.frame(K, s, `${X.top(s, K, { word: 'Questions', cls: 'mb-0' })}${rows}${s.img ? `<div class="grid gap-3">${sideTitle}${pic}</div>` : ''}`);
    if (!s.title && !introHtml(s) && !s.sideTitle && !s.img) return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="mx-auto max-w-3xl">${X.top(s, K, { center: true, word: 'Questions' })}${rows}</div></div></section>`;
    return `<section class="${C.SEC}"><div class="${C.WRAP} grid items-start gap-x-[clamp(2rem,5vw,5rem)] gap-y-8 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.4fr)]"><div class="grid gap-5 lg:sticky lg:top-32">${X.top(s, K, { word: 'Questions', cls: 'mb-0' })}${sideTitle}${pic}${callTo(K) ? `<div class="flex flex-wrap gap-3.5">${X.callBtn(K)}</div>` : ''}</div>${rows}</div></section>`;
  };

  // the places served: every group on a card of its own, the places as pills
  X.place = (l) => { const cls = 'inline-flex items-center gap-2 rounded-full border border-primary-100 bg-surface px-4 py-2 text-[.93rem] font-semibold text-primary-950 transition duration-300'; return l.href ? `<a class="${cls} hover:-translate-y-0.5 hover:border-primary-700 hover:bg-primary-700 hover:text-white" href="${esc(l.href)}">${icon('pin', 'size-3.5 opacity-60')}${esc(l.text)}</a>` : `<span class="${cls}">${icon('pin', 'size-3.5 opacity-60')}${esc(l.text)}</span>`; };
  X.areas = (s, K) => {
    const groups = groupsOf(s).filter((g) => (g.links || []).length);
    const one = groups.length === 1;
    const title = s.title || (one ? groups[0].title : '');
    const Hn = title ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top({ ...s, title }, K, { center: true, word: 'Service areas', lead: s.lead ? `<p>${esc(s.lead)}</p>` : '' })}<div class="grid ${C.GAP} ${one ? '' : 'lg:grid-cols-2'}">${groups.map((g, i) => `<div class="${C.CARD} grid content-start gap-5 p-[clamp(1.25rem,3vw,2rem)]" data-k-reveal="${one ? 'up' : i % 2 ? 'right' : 'left'}" style="${glowAt(i)}">${g.title && !one ? `<${Hn} class="${C.H3} flex items-center gap-3"><span class="${C.TILE} size-10">${icon('pin', 'size-5')}</span>${esc(g.title)}</${Hn}>` : ''}<ul class="m-0 flex list-none flex-wrap gap-2.5 p-0 ${one ? 'justify-center' : ''}">${g.links.map((l) => `<li>${X.place(l)}</li>`).join('')}</ul></div>`).join('')}</div></div></section>`;
  };

  // ---------- calls ----------
  // the picture a website shows with its closing call
  X.ctaPic = (s, K) => (s.img ? `<span class="grid shrink-0 place-items-center max-lg:justify-self-start [&_img]:h-[clamp(4.5rem,9vw,7.5rem)] [&_img]:w-auto [&_img]:drop-shadow-[0_14px_24px_rgb(0_0_0/.35)]">${K.img(s.img, s.imgAlt || '')}</span>` : '');
  // the closing call: a panel of the brand's deep colour set into the page; the picture the website shows with it stands in it
  X.cta = (s, K) => {
    const q = quoteTo(s, K), c = callTo(K);
    const pic = X.ctaPic(s, K);
    return `<section class="relative py-[clamp(3rem,6vw,5rem)]"><div class="${C.WRAP}"><div class="${C.DEEP} rounded-[calc(var(--k-r)*1.8)] bg-linear-to-br from-primary-900 to-primary-950 px-[clamp(1.5rem,5vw,5rem)] py-[clamp(2.75rem,6vw,5rem)] shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--th-primary-950)_80%,transparent)]" data-k-reveal="zoom"><div class="grid items-center gap-8 ${pic ? 'lg:grid-cols-[auto_1.5fr_auto]' : 'lg:grid-cols-[1.5fr_auto]'}">${pic}<div class="grid gap-4">${X.h2(s.title || 'Ready to get started?', 'text-white', 'text-pop-300')}${s.text ? `<p class="max-w-2xl text-[1.08rem] leading-relaxed text-white/80">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap gap-3.5">${btn(q, C.POP, true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></div></div></section>`;
  };
  // what a banner line says, and what it asks (a call when it speaks of calling)
  X.calloutParts = (s, K, kind = C.POP) => {
    const c = callTo(K);
    return { say: s.title || s.text || '', act: s.title && s.text ? (c && /call|phone|dial|speak|talk/i.test(s.text) ? btn({ text: s.text, href: c.href }, kind, true) : `<span class="font-semibold text-white/85">${esc(s.text)}</span>`) : '' };
  };
  // a banner line of the old page (a short claim and a call): a slim bar of the brand's colour, on the ground of the section before it
  X.callout = (s, K) => {
    const { say, act } = X.calloutParts(s, K);
    return `<section class="k-same relative py-[clamp(1.25rem,3vw,2rem)]"><div class="${C.WRAP}"><div class="${C.DEEP} flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[calc(var(--k-r)*1.4)] bg-linear-to-r from-primary-800 to-primary-950 px-[clamp(1.25rem,3vw,2.5rem)] py-[clamp(1.1rem,2.5vw,1.6rem)]" data-k-reveal="zoom"><p class="m-0 flex items-center gap-3.5 font-display text-[clamp(1.1rem,1rem+.6vw,1.45rem)] leading-snug font-bold text-white"><span class="grid size-10 shrink-0 place-items-center rounded-full bg-pop-500/25 text-pop-300">${icon('check', 'size-5 stroke-[3]')}</span>${esc(say)}</p>${act}</div></div></section>`;
  };
  // a list beside the website's form: the points on the left, the form on a card that stays in view
  X.listform = (s, K) => {
    const lines = items(s).map((t) => (typeof t === 'string' ? t : t.title || t.text || ''));
    return `<section class="${C.SEC}"><div class="${C.WRAP} grid items-start gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-[1.15fr_.85fr]"><div class="grid gap-6" data-k-reveal="left">${X.top(s, K, { cls: 'mb-0' })}${lines.length ? X.checklist(lines, lines.length > 4 ? 'sm:grid-cols-2' : '') : ''}</div><div class="lg:sticky lg:top-32" data-k-reveal="right">${X.formCard(K, s)}</div></div></section>`;
  };

  // ---------- contact ----------
  // the ways to reach the business: a row for each (its own icon when the page has one)
  // (a page that lists none of its own shows the website's real details; made-up ones are for previews with placeholder content only)
  const siteWays = (K) => { const s = K.site; return [...(s.phones || []).map((p) => ({ icon: 'phone', title: 'Call us', text: p.display, href: `tel:${p.digits}` })), ...(s.email ? [{ icon: 'mail', title: 'Email', text: s.email, href: `mailto:${s.email}` }] : []), ...(s.address ? [{ icon: 'pin', title: 'Visit', text: s.address }] : []), ...(s.hours ? [{ icon: 'clock', title: 'Hours', text: s.hours }] : [])]; };
  X.ways = (s, K) => (s.items?.length ? s.items : K.real ? siteWays(K) : contactItems(K)).map((c) => ({ ...c, label: c.title || c.label || '', value: c.text || c.value || plainText(c.html) }));
  X.wayIcon = (c) => (typeof c.icon === 'string' && /^[a-z]+$/.test(c.icon) ? c.icon : /@/.test(c.value) ? 'mail' : /\d{3}.*\d{4}/.test(c.value) && !/[a-z]{4}/i.test(c.value) ? 'phone' : /\b(?:mon|tue|wed|thu|fri|sat|sun|hours)/i.test(`${c.label} ${c.value}`) ? 'clock' : 'pin');
  X.wayHref = (c) => c.href || (/@/.test(c.value) && !/\s/.test(c.value) ? `mailto:${c.value}` : /^[+\d][\d\s().-]{6,}$/.test(c.value) ? `tel:${c.value.replace(/[^\d+]/g, '')}` : '');
  X.wayMark = (K, c) => `<span class="${C.TILE} ${typeof c.icon === 'string' && /[./]/.test(c.icon) ? `${K.dims?.[c.icon]?.light ? 'bg-primary-700! ring-primary-700!' : ''} [&_img]:size-6 [&_img]:object-contain` : 'group-hover/card:bg-primary-700 group-hover/card:text-white'}">${typeof c.icon === 'string' && /[./]/.test(c.icon) ? K.img(c.icon, '') : icon(X.wayIcon(c), 'size-6')}</span>`;
  // one way to reach the business, as a row
  X.wayRow = (K, c, i) => { const href = X.wayHref(c); const inner = `${X.wayMark(K, c)}<span class="grid gap-0.5"><b class="font-display text-[1.02rem] text-primary-950">${esc(c.label)}</b><span class="${C.P} text-[.98rem]">${esc(c.value)}</span></span>`; const cls = `group/card ${C.CARD} ${C.LIFT} flex items-start gap-4 p-5`; return `<li data-k-reveal="left" style="transition-delay:${i * 90}ms">${href ? `<a class="${cls}" href="${esc(href)}" style="${glowAt(i)}">${inner}</a>` : `<div class="${cls}" style="${glowAt(i)}">${inner}</div>`}</li>`; };
  // on a page of its own: the ways on the left, the form on the right
  X.contactForm = (s, K) => {
    const rows = `<ul class="m-0 grid list-none gap-3.5 p-0">${X.ways(s, K).map((c, i) => X.wayRow(K, c, i)).join('')}</ul>`;
    const head = X.top(s, K, { word: 'Get in touch', cls: 'mb-0' });
    if (!K.formHtml && K.real) return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="mx-auto grid max-w-3xl gap-7">${head}${rows}<div class="flex flex-wrap gap-3.5">${btn(quoteTo(null, K), C.POP, true)}${X.callBtn(K)}</div></div></div></section>`;
    return `<section class="${C.SEC}"><div class="${C.WRAP} grid items-start gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]"><div class="grid gap-7">${head}${rows}</div><div data-k-reveal="right">${X.formCard(K, s)}</div></div></section>`;
  };
  // inside another page: a card for each way
  X.contactCards = (s, K) => {
    const Hn = s.title ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top({ ...s, title: s.title || '' }, K, { center: true, word: 'Get in touch' })}<div class="grid ${C.GAP} [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">${X.ways(s, K).map((c, i) => X.shell(`${X.wayMark(K, c)}<span class="grid gap-1"><${Hn} class="font-display text-[1.05rem] font-bold text-primary-950">${esc(c.label)}</${Hn}><span class="${C.P} text-[.97rem]">${esc(c.value)}</span></span>`, { href: X.wayHref(c), i, cls: 'flex items-start gap-4 p-6', step: 90, per: 99 })).join('')}</div></div></section>`;
  };
  // the map: across the whole page
  X.map = (s) => {
    const frameHtml = s.html ? mapFrame(s.html) : `<div class="grid h-full place-items-center bg-primary-50 bg-[linear-gradient(color-mix(in_srgb,var(--th-primary-500)_16%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--th-primary-500)_16%,transparent)_1px,transparent_1px)] bg-[size:3rem_3rem]"><span class="grid size-16 place-items-center rounded-full bg-popbtn text-white shadow-lg">${icon('pin', 'size-7')}</span></div>`;
    return `<section class="relative" aria-label="Map"><div class="h-[clamp(20rem,42vw,30rem)] w-full overflow-hidden [&_iframe]:block [&_iframe]:size-full [&_iframe]:border-0" data-k-reveal>${frameHtml}</div></section>`;
  };

  // ---------- the parts of a header and a footer every design shares ----------
  // the menu of a phone: a full screen of its own (outside the header, whose blur would otherwise hold it in)
  X.drawer = (K, logo) => `<div class="fixed inset-0 z-[80] hidden content-start gap-5 overflow-auto bg-paper p-5 data-[open]:grid" data-k-drawer><div class="flex items-center justify-between">${logo}<button class="grid size-11 place-items-center rounded-full border border-primary-200 text-primary-950" type="button" aria-label="Close menu" data-k-menu>${icon('close', 'size-5')}</button></div><nav class="grid gap-1" aria-label="Mobile">${menuOf(K).map((n) => ((n.children || []).length ? `<details class="group rounded-2xl open:bg-primary-50"><summary class="flex cursor-pointer list-none items-center justify-between rounded-2xl px-4 py-3.5 font-display text-[1.2rem] font-bold text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(n.label)}${icon('chevron', 'size-4 transition group-open:rotate-180')}</summary><ul class="m-0 grid list-none gap-0.5 p-0 px-2 pb-3"><li><a class="block rounded-xl px-3.5 py-2.5 font-bold text-primary-700" href="${esc(K.u(n.href))}">${esc(n.label)}</a></li>${n.children.slice(0, 40).map((c) => `<li><a class="block rounded-xl px-3.5 py-2.5 font-semibold text-primary-950" href="${esc(K.u(c.href))}">${esc(c.label)}</a></li>`).join('')}</ul></details>` : `<a class="rounded-2xl px-4 py-3.5 font-display text-[1.2rem] font-bold text-primary-950 hover:bg-primary-50" href="${esc(K.u(n.href))}">${esc(n.label)}</a>`)).join('')}</nav><div class="grid gap-3">${btn(ctaOf(K), C.POP, true, true)}${X.callBtn(K, C.LINE)}</div></div>`;
  // the reading bar, the way back to the top and the action that follows the reader: the controls the toolkit drives
  X.controls = (K) => {
    const c = web(K).controls || {};
    return `${c.progress === false ? '' : '<div class="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]"><i class="block h-full w-full bg-linear-to-r from-pop-500 to-primary-400" data-k-progress></i></div>'}${c.top === false ? '' : `<button type="button" data-k-top aria-label="Back to the top" class="fixed right-4 bottom-24 z-40 grid size-12 place-items-center rounded-full border border-primary-200 bg-surface text-primary-900 shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--th-primary-950)_50%,transparent)] transition hover:-translate-y-0.5 hover:bg-primary-700 hover:text-white sm:bottom-6">${icon('arrow', '-rotate-90 size-5')}</button>`}${c.sticky === false ? '' : `<a data-k-sticky class="fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-2.5 rounded-full bg-popbtn px-6 py-3.5 font-bold whitespace-nowrap text-white shadow-[0_16px_34px_-12px_color-mix(in_srgb,var(--d-pop-btn,var(--th-secondary-700))_85%,transparent)] transition hover:-translate-y-0.5 sm:inline-flex" href="${esc(ctaOf(K).href)}">${esc(ctaOf(K).text)}${icon('arrow', 'size-4')}</a>`}`;
  };

  Object.assign(X, own(X, C));
  return { X, C };
}

// one renderer per kind of section; the same ones draw the website's own sections (typed) and the placeholder content of a preview
export function register(X, prefix) {
  const v = (n) => `${prefix}${n}`;
  const trust = (s, K) => (items(s).some((x) => x && typeof x === 'object' && x.badge) ? X.offers(s, K) : X.points(s, K));
  // (a preview with placeholder content, and a contact page, show the ways beside the form; inside another page they are cards)
  const contact = (s, K) => (!K.real || K.pos?.kind === 'contact' ? X.contactForm(s, K) : X.contactCards(s, K));
  const library = {
    trust: { [v('trust')]: trust }, services: { [v('cards')]: X.cards }, about: { [v('text')]: X.text }, features: { [v('features')]: X.features }, steps: { [v('steps')]: X.steps },
    stats: { [v('stats')]: X.stats }, reviews: { [v('reviews')]: X.reviews }, faq: { [v('faq')]: X.faq }, areas: { [v('areas')]: X.areas }, cta: { [v('cta')]: (s, K) => (s.type === 'callout' ? X.callout(s, K) : X.cta(s, K)) }, contact: { [v('contact')]: contact }, map: { [v('map')]: X.map },
  };
  const typed = { offers: X.offers, tiles: X.points, cardgrid: X.cards, iconcards: X.cards, prose: X.text, split: X.text, features: X.features, steps: X.steps, stats: X.stats, reviews: X.reviews, faq: X.faq, areas: X.areas, cta: X.cta, callout: X.callout, listform: X.listform, contact: X.contactCards, contactform: X.contactForm, map: X.map };
  const layouts = { trust: v('trust'), services: v('cards'), about: v('text'), features: v('features'), steps: v('steps'), stats: v('stats'), reviews: v('reviews'), faq: v('faq'), areas: v('areas'), cta: v('cta'), contact: v('contact') };
  const R = (type) => ({ type, variant: layouts[type] });
  const blueprint = {
    home: [{ type: 'hero', variant: v('hero') }, R('trust'), R('about'), R('services'), R('features'), R('steps'), R('stats'), R('reviews'), R('faq'), R('areas'), R('cta')],
    inner: [R('about'), R('features'), R('steps'), R('reviews'), R('faq'), R('cta')],
    contact: [R('contact'), R('faq'), R('cta'), { type: 'map', variant: v('map') }],
  };
  // what every design of this folder is: it keeps the page's order and bands, draws the website's sections itself and shows its hero's cards
  const flags = { fixed: true, keepOrder: true, bands: true, heroCards: true, prefix, videoHero: v('hero'), innerHero: v('page'), autoHeroPhoto: false, layouts, topbar: false };
  return { library, typed, layouts, blueprint, flags };
}
