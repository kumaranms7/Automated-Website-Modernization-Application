import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, num, statsOf, groupsOf, introHtml, answerOf, initialsOf } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays } from './base.js';
import { stars } from '../ui.js';

// VERTEX: bold and structured. Condensed capitals for the headings, square corners, solid blocks of the brand's own colour and of the
// accent colour: a photograph (or a video) under a dark veil in the hero with a bar of the website's own links across its foot, cards with
// their heading set on the picture, figures on a dark band, a closing call split by a slanted block of the accent colour. A card steps
// off a hard shadow under the pointer; what comes into view slides in and pictures are wiped clear by a block of colour (the "slide"
// motion of the stylesheet). Its colours are the website's theme. Layout names start with vx-.

const STEEL = 'bg-[color-mix(in_srgb,var(--th-primary-700)_7%,var(--th-bg))]';
const CAPS = 'font-display tracking-[.08em] uppercase';
const HARD = 'relative rounded-[var(--k-r)] border border-primary-950/12 bg-surface transition duration-500 ease-out';
const STRIPES = 'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[repeating-linear-gradient(135deg,rgb(255_255_255/.04)_0_2px,transparent_2px_22px)]';

const { X, C } = sections({
  H2: 'font-display text-[clamp(2.2rem,1.3rem+3.2vw,4rem)] leading-[.98] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950 on-dark:text-white',
  H2S: 'font-display text-[clamp(1.6rem,1.25rem+1.4vw,2.4rem)] leading-[1.08] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950 on-dark:text-white',
  H3: 'font-display text-[clamp(1.3rem,1.15rem+.6vw,1.65rem)] leading-[1.1] font-[var(--k-h-weight)] tracking-[.01em] [text-transform:var(--k-h-case)] text-primary-950 on-dark:text-white',
  SHADOW: '', PLAIN: HARD, CARD: HARD,
  // a card steps up and to the left off a hard shadow of the brand's deepest colour
  LIFT: 'hover:-translate-x-1 hover:-translate-y-1 hover:border-primary-700 hover:shadow-[7px_7px_0_0_var(--th-primary-700)]',
  TILE: 'grid size-12 shrink-0 place-items-center rounded-[var(--k-r)] bg-primary-600/10 text-primary-950 transition duration-300',
  POP: `bg-popbtn text-white ${CAPS} hover:brightness-110`,
  BRAND: `bg-primary-700 text-white ${CAPS} hover:bg-primary-800`,
  LINE: `border-primary-700 bg-transparent text-primary-950 ${CAPS} hover:bg-primary-700 hover:text-white`,
  GLASSBTN: `border-white bg-transparent text-white ${CAPS} hover:bg-white hover:text-primary-950`,
  SEC: 'relative py-[calc(var(--k-sec-y)*.85)]',
  GAP: 'gap-[clamp(1rem,2vw,1.5rem)]',
  PICSHADOW: '',
  DEEP: `on-dark relative isolate overflow-hidden bg-primary-700 text-white ${STRIPES}`,
  TONE: 'text-popbtn on-dark:text-pop-400',
  NUM: 'font-display text-[2.6rem] leading-none font-bold text-transparent [-webkit-text-stroke:1.5px_var(--color-popbtn)]',
  UNDERHERO: 'py-[clamp(2.5rem,5vw,4.5rem)]',
}, (X, C) => ({
  eyebrow: (t) => (t ? `<span class="inline-flex items-center gap-3 font-display text-[.98rem] font-bold tracking-[.2em] text-popbtn uppercase on-dark:text-pop-400"><i class="block h-[3px] w-8 bg-current" data-k-line></i>${esc(t)}</span>` : ''),
  rule: () => '<i class="block h-[5px] w-16 bg-popbtn" data-k-line></i>',
  check: (cls = 'bg-popbtn text-white') => `<span class="mt-0.5 grid size-[1.4rem] shrink-0 place-items-center rounded-[calc(var(--k-r)*.7)] ${cls}">${icon('check', 'size-3 stroke-[4]')}</span>`,
  // a list: a tile for each line, a stroke of the accent colour down its side
  checklist: (list, cols = '') => `<ul class="m-0 grid list-none gap-2.5 p-0 ${cols}">${list.map((t) => `<li class="flex items-start gap-3.5 rounded-[var(--k-r)] border-l-4 border-popbtn bg-primary-600/8 px-4 py-3.5 leading-snug font-semibold text-primary-950 on-dark:bg-white/10 on-dark:text-white">${X.check()}<span>${esc(typeof t === 'string' ? t : t.title || t.text || '')}</span></li>`).join('')}</ul>`,
  listPanel: (lines, cols) => `<div data-k-reveal>${X.checklist(lines, cols)}</div>`,
  arrowLink: (label) => `<span class="mt-auto inline-flex items-center gap-2.5 pt-1 font-display text-[1rem] font-bold tracking-[.1em] text-primary-950 uppercase">${esc(label)}<span class="grid size-7 place-items-center rounded-[calc(var(--k-r)*.7)] bg-popbtn text-white transition duration-300 group-hover/card:translate-x-1.5">${icon('arrow', 'size-3.5')}</span></span>`,
  // a photograph: square, a block of the accent colour set behind its lower corner
  photo: (K, src, alt, { side = '', cls = '' } = {}) => `<div class="relative mb-4 ${side === 'right' ? 'mr-4' : 'ml-4'} ${cls}" data-k-reveal="${side || 'left'}"><div class="absolute -bottom-4 ${side === 'right' ? '-right-4' : '-left-4'} h-2/3 w-2/3 rounded-[var(--k-r)] bg-popbtn"></div><div class="relative overflow-hidden rounded-[var(--k-r)] bg-primary-700 [&_img]:h-auto [&_img]:max-h-[36rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div>`,
  mark: (K, src, alt, cls = '') => `<div class="grid w-fit place-items-center rounded-[var(--k-r)] border-b-4 border-popbtn ${STEEL} p-[clamp(1.25rem,3vw,2.25rem)] [&_img]:h-auto [&_img]:max-h-56 [&_img]:max-w-full ${cls}" data-k-reveal="zoom">${K.img(src, alt || '')}</div>`,

  // cards: with pictures, the heading stands on the picture over a dark veil and the line under it on white; without, hard-edged boxes
  cards: (s, K) => {
    const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
    const hasPics = list.some((c) => c.img);
    const Hn = s.title ? 'h3' : 'h2';
    const cell = (c, i) => {
      const label = c.title || c.text || c.label || '';
      const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
      const more = c.href ? X.arrowLink(c.cta || 'Learn more') : '';
      const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
      if (!c.img) return X.shell(`${X.tile(K, { ...c, photo: true }, i) || X.numMark(i)}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}`, { href: c.href, i, cls: 'grid content-start gap-3.5 p-[clamp(1.4rem,2.5vw,2rem)]', step: 90 });
      return X.shell(`<div class="relative aspect-[4/3] overflow-hidden rounded-t-[var(--k-r)] bg-primary-700 [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.08]">${K.img(c.img, c.imgAlt || label)}<div class="absolute inset-0 bg-linear-to-t from-primary-800 via-primary-800/45 to-transparent"></div>${ownIcon ? `<span class="absolute top-0 left-0 grid size-12 place-items-center rounded-br-[var(--k-r)] ${K.dims?.[ownIcon]?.light ? 'bg-popbtn' : 'bg-surface'} [&_img]:size-7! [&_img]:object-contain!">${K.img(ownIcon, '')}</span>` : ''}<div class="absolute inset-x-0 bottom-0 grid gap-1 p-5"><span class="font-display text-[.95rem] font-bold tracking-[.2em] text-pop-400">${num(i)}</span><${Hn} class="${C.H3} text-white!">${esc(label)}</${Hn}></div></div>${sub || more ? `<div class="grid flex-1 content-start gap-3 border-t-4 border-popbtn p-5">${sub}${more}</div>` : ''}`, { href: c.href, i, cls: 'flex flex-col overflow-hidden', step: 90, per: 3 });
    };
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K)}<div class="grid ${C.GAP} ${X.colsOf(list.length, { small: s.small, pics: hasPics })}">${list.map((c, i) => cell(c, i)).join('')}</div></div></section>`;
  },
  featureCard: (K, x, i, Hn) => `<div class="grid content-start gap-3 rounded-[var(--k-r)] border-l-4 border-popbtn ${STEEL} p-6" data-k-reveal style="transition-delay:${(i % 3) * 90}ms">${X.tile(K, x, i, 'benefits') || X.numMark(i)}<${Hn} class="${C.H3}">${esc(x.title)}</${Hn}>${x.text ? `<p class="${C.P} text-[.97rem]">${esc(x.text)}</p>` : ''}</div>`,
  // steps: boxes in a row, the number on a tab of the accent colour
  steps: (s, K) => {
    const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
    const Hn = s.title || !K.real ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="m-0 grid list-none ${C.GAP} p-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">${list.map((t, i) => `<li class="group/card ${C.CARD} ${C.LIFT} grid content-start gap-3 p-6 pt-14" data-k-reveal style="transition-delay:${i * 110}ms"><span class="absolute top-0 left-0 grid h-10 min-w-12 place-items-center rounded-tl-[var(--k-r)] rounded-br-[var(--k-r)] bg-popbtn px-3 font-display text-[1.25rem] font-bold tracking-[.06em] text-white">${num(i)}</span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
  },
  // figures: a dark band across the page, large condensed numerals, a stroke of the accent colour beside each
  stats: (s, K) => {
    const list = statsOf(s);
    const figures = `<dl class="m-0 grid gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-10 sm:grid-cols-2 ${s.img ? 'lg:grid-cols-3' : 'lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]'}">${list.map((x, i) => `<div class="grid gap-2 border-l-4 border-popbtn pl-5" data-k-reveal style="transition-delay:${i * 110}ms"><dd class="order-first m-0 font-display text-[clamp(3rem,1.8rem+3.6vw,5.2rem)] leading-[.9] font-bold tracking-[.01em] text-white" data-count="${esc(x.value)}">${esc(x.value)}</dd><dt class="font-display text-[1rem] leading-snug font-semibold tracking-[.14em] text-white/75 uppercase">${esc(x.label)}</dt></div>`).join('')}</dl>`;
    return `<section class="${C.DEEP} py-[clamp(3.25rem,7vw,5.5rem)]"><div class="${C.WRAP}">${s.title ? `<div class="${C.HEADGAP} grid max-w-3xl gap-4">${X.rule()}${X.h2(s.title)}</div>` : ''}${s.img ? `<div class="grid items-center gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[1.4fr_1fr]">${figures}<div class="overflow-hidden rounded-[var(--k-r)] border-b-4 border-popbtn [&_img]:h-auto [&_img]:max-h-80 [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(s.img, s.imgAlt || '')}</div></div>` : figures}</div></section>`;
  },
  reviewCard: (r, i, cls = '') => `<figure class="${C.PLAIN} m-0 grid content-between gap-6 border-t-4 border-t-popbtn p-7 ${cls}" data-k-reveal style="transition-delay:${(i % 3) * 100}ms"><div class="grid gap-4">${stars()}<blockquote class="m-0 text-[1.03rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center gap-3.5 border-t border-primary-950/12 pt-5"><span class="grid size-11 shrink-0 place-items-center rounded-[var(--k-r)] bg-primary-700 font-display text-[1.1rem] font-bold text-white">${esc(initialsOf(r.name))}</span><span class="grid"><b class="font-display text-[1.1rem] tracking-[.06em] text-primary-950 uppercase">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-muted">${esc(r.place || r.role)}</small>` : ''}</span></figcaption></figure>`,
  scrollBtn: (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="grid size-12 place-items-center rounded-[var(--k-r)] bg-primary-700 text-white transition hover:bg-popbtn">${icon('arrow', dir === 'prev' ? 'size-5 rotate-180' : 'size-5')}</button>`,
  faqRow: (f, i) => `<details class="group ${C.PLAIN} open:border-primary-700"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 70}ms"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 py-4 pr-4 pl-5 font-display text-[1.25rem] leading-tight font-bold tracking-[.01em] text-primary-950 [text-transform:var(--k-h-case)] marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="grid size-10 shrink-0 place-items-center rounded-[calc(var(--k-r)*.7)] bg-primary-700 text-white transition duration-300 group-open:rotate-45 group-open:bg-popbtn">${icon('plus', 'size-4')}</span></summary><div class="border-t border-primary-950/12 px-5 py-5">${answerOf(f.a)}</div></details>`,
  faqRows: (list) => `<div class="grid gap-2.5">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`,
  // the places served: a grid of hard-edged links that fill with the brand's colour under the pointer
  areas: (s, K) => {
    const groups = groupsOf(s).filter((g) => (g.links || []).length);
    const one = groups.length === 1;
    const title = s.title || (one ? groups[0].title : '');
    const Hn = title ? 'h3' : 'h2';
    const place = (l) => { const cls = 'flex h-full items-center justify-between gap-3 rounded-[var(--k-r)] border border-primary-950/12 bg-surface px-4 py-3 text-[.95rem] leading-snug font-semibold text-primary-950 transition duration-300'; return l.href ? `<a class="${cls} hover:border-primary-700 hover:bg-primary-700 hover:text-white" href="${esc(l.href)}">${esc(l.text)}${icon('arrow', 'size-3.5 shrink-0 text-popbtn')}</a>` : `<span class="${cls}">${esc(l.text)}</span>`; };
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top({ ...s, title }, K, { word: 'Service areas', lead: s.lead ? `<p>${esc(s.lead)}</p>` : '' })}<div class="grid gap-[clamp(1.75rem,4vw,3.5rem)] ${one ? '' : 'lg:grid-cols-2'}">${groups.map((g, i) => `<div class="grid content-start gap-4" data-k-reveal="${one ? 'up' : i % 2 ? 'right' : 'left'}">${g.title && !one ? `<${Hn} class="${C.H3} flex items-center gap-3 border-b-4 border-primary-700 pb-3"><span class="grid size-9 place-items-center rounded-[calc(var(--k-r)*.7)] bg-popbtn text-white">${icon('pin', 'size-4')}</span>${esc(g.title)}</${Hn}>` : ''}<ul class="m-0 grid list-none gap-2 p-0 ${one ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}">${g.links.map((l) => `<li>${place(l)}</li>`).join('')}</ul></div>`).join('')}</div></div></section>`;
  },
  // the closing call: a dark band across the page, split by a slanted block of the accent colour that carries the phone and the action
  cta: (s, K) => {
    const q = quoteTo(s, K), c = callTo(K);
    const pic = X.ctaPic(s, K);
    return `<section class="${C.DEEP} after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:-z-10 after:w-[42%] after:bg-popbtn after:[clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)] max-lg:after:hidden"><div class="${C.WRAP} grid items-center gap-x-[clamp(2rem,6vw,6rem)] gap-y-8 py-[clamp(3.25rem,7vw,5.5rem)] lg:grid-cols-[1.55fr_1fr]"><div class="grid gap-5 ${pic ? 'sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-8' : ''}" data-k-reveal="left">${pic}<div class="grid gap-4">${X.rule()}${X.h2(s.title || 'Ready to get started?', 'text-white', 'text-pop-400')}${s.text ? `<p class="max-w-2xl text-[1.05rem] leading-relaxed text-white/80">${esc(s.text)}</p>` : ''}</div></div><div class="grid justify-items-start gap-4 lg:justify-items-end lg:text-right" data-k-reveal="right">${c ? `<a class="font-display text-[clamp(2.2rem,1.5rem+2.6vw,3.6rem)] leading-none font-bold tracking-[.02em] text-white transition hover:opacity-85" href="${esc(c.href)}">${esc(K.site.phone.display)}</a>` : ''}${btn(q, `bg-white text-primary-950 ${'font-display tracking-[.08em] uppercase'} hover:bg-primary-700 hover:text-white max-lg:bg-popbtn max-lg:text-white`, true, true)}</div></div></section>`;
  },
  // a banner line: a bar of the accent colour, the claim in capitals
  callout: (s, K) => {
    const { say, act } = X.calloutParts(s, K, C.BRAND);
    return `<section class="k-same relative py-[clamp(1.25rem,3vw,2rem)]"><div class="${C.WRAP}"><div class="on-dark relative isolate flex flex-wrap items-center justify-between gap-x-8 gap-y-4 overflow-hidden rounded-[var(--k-r)] bg-popbtn px-[clamp(1.25rem,3vw,2.5rem)] py-[clamp(1rem,2.2vw,1.4rem)] text-white ${STRIPES}" data-k-reveal="left"><p class="m-0 font-display text-[clamp(1.3rem,1.1rem+.9vw,1.9rem)] leading-tight font-bold tracking-[.03em] uppercase">${esc(say)}</p>${act}</div></div></section>`;
  },
  wayRow: (K, c, i) => { const href = X.wayHref(c); const inner = `${X.wayMark(K, c)}<span class="grid gap-0.5"><b class="font-display text-[.98rem] font-bold tracking-[.14em] text-popbtn uppercase">${esc(c.label)}</b><span class="text-[1.05rem] leading-snug font-semibold text-primary-950">${esc(c.value)}</span></span>`; const cls = `group/card ${C.CARD} ${C.LIFT} flex items-center gap-4 p-4`; return `<li data-k-reveal="left" style="transition-delay:${i * 90}ms">${href ? `<a class="${cls}" href="${esc(href)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`}</li>`; },
}));
const { WRAP, POP, GLASSBTN, LINE } = C;
// the bands of a page: white, then a cool pale grey, in turn
const TONES = { alt: STEEL, tint: STEEL, dark: 'bg-primary-700 text-white on-dark', brand: 'bg-popbtn text-white on-dark', rotation: ['alt', 'none'] };

// ---------- hero ----------
const VEIL = {
  light: 'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--th-primary-700)_88%,transparent),color-mix(in_srgb,var(--th-primary-700)_55%,transparent)_55%,color-mix(in_srgb,var(--th-primary-700)_12%,transparent))]',
  medium: 'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--th-primary-700)_96%,transparent),color-mix(in_srgb,var(--th-primary-700)_74%,transparent)_55%,color-mix(in_srgb,var(--th-primary-700)_30%,transparent))]',
  strong: 'bg-[linear-gradient(90deg,color-mix(in_srgb,var(--th-primary-700)_99%,transparent),color-mix(in_srgb,var(--th-primary-700)_90%,transparent)_55%,color-mix(in_srgb,var(--th-primary-700)_62%,transparent))]',
};
const TALL = { standard: 'lg:min-h-[30rem]', tall: 'lg:min-h-[min(40rem,78vh)]', full: 'lg:min-h-[calc(100svh-12rem)]' };
function ground(h, K) {
  const w = web(K);
  const media = h.image?.src ? `<div class="absolute inset-0 -z-30 overflow-hidden [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover"><div class="${w.motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${groundImg(K, h.image.src, h.image.alt)}</div></div>` : '';
  const veil = h.image?.src || h.video?.src ? `<div class="absolute inset-0 -z-20 ${VEIL[w.hero?.overlay] || VEIL.medium}"></div>` : '';
  return `${media}${videoBg(h).replace('-z-20', '-z-30')}${veil}`;
}
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap gap-x-7 gap-y-2.5 p-0 text-[.98rem] font-semibold text-white/90">${list.map((t) => `<li class="inline-flex items-center gap-2.5">${X.check()}${esc(t)}</li>`).join('')}</ul>` : '');
// the bar across the foot of the home hero: the links the old hero offered, else the ways to reach the business and the main action
function bar(h, K) {
  const s = K.site;
  if (h.cards?.items?.length) {
    return `<div class="grid overflow-hidden rounded-t-[var(--k-r)] bg-surface shadow-[0_-18px_50px_-24px_rgb(0_0_0/.6)] lg:grid-cols-[minmax(0,15rem)_1fr]" data-k-reveal style="transition-delay:450ms">${h.cards.title ? `<p class="m-0 flex items-center bg-popbtn px-6 py-4 font-display text-[1.3rem] leading-[1.05] font-bold tracking-[.03em] text-white uppercase">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 grid list-none grid-cols-2 p-0 sm:grid-cols-4 ${h.cards.items.length > 4 ? 'xl:grid-cols-8' : ''} ${h.cards.title ? '' : 'lg:col-span-2'}">${h.cards.items.map((c) => { const label = c.text || c.title || c.label || ''; const inner = `${c.img ? `<span class="grid size-10 place-items-center [&_img]:size-full [&_img]:object-contain">${K.img(c.img, c.imgAlt || '')}</span>` : ''}<span>${esc(label)}</span>`; const cls = 'grid h-full content-center justify-items-center gap-2 border-t border-l border-primary-950/10 px-2 py-4 text-center text-[.8rem] leading-tight font-bold text-primary-950 transition duration-300'; return `<li>${c.href ? `<a class="${cls} hover:bg-primary-700 hover:text-white" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`; }).join('')}</ul></div>`;
  }
  const cell = (ic, label, value, href) => { const inner = `<span class="grid size-11 shrink-0 place-items-center rounded-[var(--k-r)] bg-primary-700 text-white">${icon(ic, 'size-5')}</span><span class="grid gap-0.5"><b class="font-display text-[.9rem] font-bold tracking-[.16em] text-popbtn uppercase">${label}</b><span class="leading-snug font-semibold text-primary-950">${esc(value)}</span></span>`; const cls = 'flex items-center gap-4 border-primary-950/10 px-6 py-5 max-lg:border-t lg:border-l'; return href ? `<a class="${cls} transition hover:bg-primary-50" href="${esc(href)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`; };
  const hours = web(K).hours || s.hours;
  const cells = [s.phone?.digits ? cell('phone', 'Call us', s.phone.display, `tel:${s.phone.digits}`) : !K.real ? cell('phone', 'Call us', '(555) 010-2030', '#') : '', s.address ? cell('pin', 'Find us', s.address) : !K.real ? cell('pin', 'Find us', 'Serving your local area') : '', hours ? cell('clock', 'Hours', hours) : ''].filter(Boolean);
  if (!cells.length) return '';
  return `<div class="grid overflow-hidden rounded-t-[var(--k-r)] bg-surface shadow-[0_-18px_50px_-24px_rgb(0_0_0/.6)] lg:grid-flow-col lg:auto-cols-fr [&>*:first-child]:border-0" data-k-reveal style="transition-delay:450ms">${cells.join('')}</div>`;
}

const hero = {
  // the home page: the words in capitals over the picture or the video under a dark veil, a bar of links across the foot
  'vx-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const foot = bar(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.6rem,1.3rem+4.2vw,5rem)] leading-[.98]' : 'text-[clamp(3.2rem,1.4rem+6.4vw,6.8rem)] leading-[.94]';
    return `<section class="${C.DEEP}">${ground(h, K)}<div class="${WRAP} grid content-center pt-[clamp(3.5rem,8vw,6.5rem)] pb-[clamp(3rem,6vw,5rem)] ${TALL[web(K).hero?.height] || TALL.tall}"><div class="grid max-w-4xl justify-items-start gap-6">${h.eyebrow ? `<span class="inline-flex items-center rounded-[calc(var(--k-r)*.8)] bg-popbtn px-3.5 py-1.5 font-display text-[.98rem] font-bold tracking-[.18em] text-white uppercase">${esc(h.eyebrow)}</span>` : ''}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-white" data-k-words>${X.tone2(h.h1, 'text-pop-400')}</h1>${leadOf(h, 'max-w-2xl border-l-4 border-popbtn pl-5 text-[clamp(1.08rem,1rem+.4vw,1.3rem)] leading-relaxed text-white/85 [&_a]:text-white [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, GLASSBTN, false, true) : ''}</div><div data-k-reveal style="transition-delay:380ms">${bullets(h.bullets)}</div></div></div>${foot ? `<div class="${WRAP} relative">${foot}</div>` : '<i class="block h-1.5 w-full bg-popbtn"></i>'}${h.video ? vPause('right-5 top-5') : ''}</section>`;
  },
  // an inner page: the trail and the title in capitals on the brand's colour (over the page's picture or video when there is one),
  // a slanted block of the accent colour at its side
  'vx-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-pop-400">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-white" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<span aria-hidden="true" class="text-white/35">//</span>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(2.2rem,1.3rem+3vw,3.8rem)]' : 'text-[clamp(2.8rem,1.4rem+4.8vw,5.2rem)]';
    const media = h.image?.src || h.video?.src;
    return `<section class="${C.DEEP} ${media ? '' : 'after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:-z-10 after:w-[26%] after:bg-popbtn after:[clip-path:polygon(46%_0,100%_0,100%_100%,0_100%)] max-md:after:hidden'}">${ground(h, K)}<div class="${WRAP} pt-[clamp(2.5rem,5.5vw,4.25rem)] pb-[clamp(2.75rem,6vw,4.75rem)]"><nav class="mb-6 flex flex-wrap items-center gap-2.5 font-display text-[1rem] font-semibold tracking-[.14em] text-white/70 uppercase" aria-label="Breadcrumb">${crumbs}</nav><div class="grid max-w-4xl justify-items-start gap-5"><h1 class="font-display ${size} leading-[.96] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-white" data-k-words>${X.tone2(h.h1, 'text-pop-400')}</h1>${leadOf(h, 'max-w-3xl border-l-4 border-popbtn pl-5 text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-white/85 [&_a]:text-white [&_a]:underline')}<div class="mt-2 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(h.buttons?.[0] || quoteTo(null, K), media ? POP : 'bg-white text-primary-950 font-display tracking-[.08em] uppercase hover:bg-popbtn hover:text-white', true)}${X.callBtn(K, GLASSBTN)}</div></div></div><i class="block h-1.5 w-full bg-popbtn"></i>${h.video ? vPause('right-5 top-5') : ''}</section>`;
  },
};

// ---------- header and footer ----------
const logo = (K, dark = false) => `<a class="inline-flex items-center gap-3 font-display text-[1.6rem] leading-none font-bold tracking-[.04em] uppercase ${dark ? 'text-white' : 'text-primary-950'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto ${dark ? 'max-h-24' : 'max-h-14'} w-auto" src="${esc(K.u((dark && K.site.footerLogo) || K.site.logo))}" alt="${esc(K.site.name)}"${dark ? ' loading="lazy"' : ''}>` : `<span class="grid size-10 place-items-center rounded-[var(--k-r)] bg-popbtn text-[1.2rem] text-white">${esc(String(K.site.name || '?').trim()[0] || '?')}</span><span>${esc(K.site.name)}</span>`}</a>`;
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 px-3 py-2 font-display text-[1.08rem] font-semibold tracking-[.08em] whitespace-nowrap text-primary-950 uppercase transition after:absolute after:inset-x-3 after:-bottom-0.5 after:h-[3px] after:origin-left after:scale-x-0 after:bg-popbtn after:transition after:duration-300 hover:text-popbtn hover:after:scale-x-100 aria-[current]:after:scale-x-100',
  panel: 'rounded-[var(--k-r)] border-t-4 border-popbtn bg-surface p-2 shadow-[0_30px_60px_-24px_rgb(0_0_0/.5)]',
  item: 'flex items-center justify-between gap-3 rounded-[calc(var(--k-r)*.7)] px-3.5 py-2.5 text-[.93rem] font-semibold text-primary-950 transition hover:bg-primary-700 hover:text-white',
  more: 'rounded-[calc(var(--k-r)*.7)] bg-primary-700 text-white hover:bg-popbtn',
};
// the strip over the header: what the website says first and its phone, on the brand's colour
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-display text-[1.15rem] font-bold tracking-[.06em] text-white transition hover:text-pop-400" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-4 text-pop-400')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `${say.icon ? icon(say.icon, 'size-3.5 text-pop-400') : ''}${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="on-dark bg-primary-700 text-white/85"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5 text-[.84rem] font-semibold max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  vx: (K) => `${strip(K)}<header class="sticky top-0 z-50 border-b-[3px] border-popbtn bg-paper transition duration-300 data-[scrolled]:shadow-[0_14px_30px_-18px_rgb(0_0_0/.45)]" data-k-header><div class="${WRAP} flex items-center gap-6 py-3" data-p="bar">${logo(K)}<nav class="ml-auto flex items-center gap-0.5 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, true)}</span><button class="ml-auto grid size-11 place-items-center rounded-[var(--k-r)] bg-primary-700 text-white lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const INK = 'bg-primary-700';
const FOOTER = {
  // the website's own footer on the brand's colour: column titles in capitals over a bar of the accent colour
  vx: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-5 font-display text-[1.25rem] font-bold tracking-[.1em] text-white uppercase after:mt-2.5 after:block after:h-[3px] after:w-10 after:bg-popbtn', li = 'transition hover:text-pop-400';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-10 place-items-center rounded-[var(--k-r)] bg-white/10 transition duration-300 hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-[var(--k-r)] bg-white/10 px-3.5 py-2 font-display text-[.95rem] font-semibold tracking-[.08em] text-white uppercase transition hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-2.5 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-400')}<a class="${li} font-display text-[1.25rem] font-bold tracking-[.04em] text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-400')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-400')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-400')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-400')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.3fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="on-dark relative isolate overflow-hidden border-t-[6px] border-popbtn ${INK} pt-[clamp(3.25rem,6.5vw,5.5rem)] text-white/70 ${STRIPES}"><div class="${WRAP}"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/15 py-5 text-[.86rem] max-sm:pb-24" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-[var(--k-r)] border border-white/30 px-3.5 py-1.5 font-display text-[.9rem] font-semibold tracking-[.12em] uppercase transition hover:bg-white/10">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'vx-');
export const VERTEX = {
  design: {
    id: 'vertex', name: 'Vertex', badge: 'Bold & structured', blurb: 'Condensed capitals, square corners and solid blocks of colour: the headline over a photograph or a video with a bar of links across its foot, headings set on the pictures of the cards, figures on a dark band and a closing call split by a slanted block of the accent colour. Sections slide in and pictures are wiped clear.',
    fonts: { heading: 'Barlow Condensed', body: 'Barlow' }, vars: { '--k-r': '.3rem', '--k-r-btn': '.25rem', '--k-h-weight': '700', '--k-h-track': '.005em', '--k-h-case': 'uppercase' },
    header: 'vx', footer: 'vx', offered: true, anim: 'slide', ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
