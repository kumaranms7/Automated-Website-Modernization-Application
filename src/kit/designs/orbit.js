import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, num, statsOf, introHtml, answerOf, initialsOf } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays, glowAt } from './base.js';
import { stars } from '../ui.js';

// ORBIT: circles and rings. The hero stands on the brand's colour running into its deeper shades, with the website's pattern in white:
// the words on the left, the picture or the video in a circle on the right, the light of the border travelling round it, two rings
// turning slowly about it and the figures of the business on small glass plates on the ring. Sections are flat bands, white and pale in
// turn; cards carry the gradient border and its light; icons, numbers and marks stand on discs with a ring; figures stand inside rings
// of light on a dark band. What comes into view swings in along an arc, and pictures open like an iris (the "orbit" motion of the
// stylesheet). Its colours are the website's theme. Layout names start with ob-.

const PALE = 'bg-[color-mix(in_srgb,var(--th-primary-50)_68%,var(--th-bg))]';
// the dark ground of the hero and of the dark parts: the brand's colour running into its deeper shades
const SPACE = 'on-dark relative isolate overflow-hidden bg-linear-to-br from-primary-700 via-primary-800 to-primary-950 text-white';
// the website's pattern in white on that ground, and a glow of the brand's colour
const PAT = '<i class="k-pat-layer k-pat-tl [--k-pat-ink:#fff] [--k-pat-o:.12]" aria-hidden="true"></i>';
const HALO = '<i class="pointer-events-none absolute -top-56 right-[4%] -z-10 block size-[44rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--th-primary-400)_40%,transparent),transparent)]" aria-hidden="true"></i>';
// two rings at the corner of a dark part
const RINGS = '<i class="pointer-events-none absolute -right-44 -bottom-60 -z-10 block size-[40rem] rounded-full border border-white/10" aria-hidden="true"></i><i class="pointer-events-none absolute -right-20 -bottom-36 -z-10 block size-[24rem] rounded-full border border-dashed border-white/15" aria-hidden="true"></i>';
const DISC = 'grid shrink-0 place-items-center rounded-full';
const PANEL = 'relative rounded-[var(--k-r)] border border-primary-100 bg-surface shadow-[0_1px_2px_rgb(15_23_42/.04),0_18px_38px_-24px_color-mix(in_srgb,var(--th-primary-900)_40%,transparent)] transition duration-300';

const { X, C } = sections({
  PLAIN: PANEL, CARD: `k-glow ${PANEL}`,
  LIFT: 'hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgb(15_23_42/.05),0_32px_56px_-28px_color-mix(in_srgb,var(--th-primary-800)_60%,transparent)]',
  // an icon stands on a white disc with a ring round it
  TILE: `${DISC} size-[3.25rem] bg-surface text-primary-700 ring-1 ring-primary-200 shadow-[0_0_0_6px_color-mix(in_srgb,var(--th-primary-100)_65%,transparent)] transition duration-300`,
  DEEP: SPACE,
  TONE: 'text-primary-600 on-dark:text-pop-300',
  NUM: `${DISC} size-10 bg-primary-700 font-display text-[.9rem] font-extrabold text-white ring-4 ring-primary-100`,
  UNDERHERO: 'py-[clamp(2.5rem,5vw,4.5rem)]',
}, (X, C) => ({
  eyebrow: (t) => (t ? `<span class="inline-flex w-fit items-center gap-3 rounded-full border border-primary-200 bg-surface py-1.5 pr-4 pl-3.5 text-[.74rem] font-bold tracking-[.16em] text-primary-800 uppercase on-dark:border-white/25 on-dark:bg-white/10 on-dark:text-white"><i class="relative block size-2 rounded-full bg-pop-500 before:absolute before:-inset-[5px] before:rounded-full before:border before:border-pop-400"></i>${esc(t)}</span>` : ''),
  // a ring, its path and a small body on it: the mark of this design over a heading
  rule: () => '<span class="flex items-center gap-2" aria-hidden="true"><i class="block size-3 rounded-full border-[3px] border-primary-600 on-dark:border-white"></i><i class="block h-px w-12 bg-primary-300 on-dark:bg-white/40"></i><i class="block size-1.5 rounded-full bg-pop-500"></i></span>',
  check: (cls = 'bg-primary-700 text-white') => `<span class="mt-0.5 ${DISC} size-[1.45rem] ${cls}">${icon('check', 'size-3 stroke-[3.5]')}</span>`,
  arrowLink: (label) => `<span class="mt-auto inline-flex items-center gap-2.5 pt-1 text-[.95rem] font-bold text-primary-800 on-dark:text-white">${esc(label)}<span class="${DISC} size-8 border border-primary-300 text-primary-700 transition duration-300 group-hover/card:translate-x-1 group-hover/card:border-primary-700 group-hover/card:bg-primary-700 group-hover/card:text-white on-dark:border-white/40 on-dark:text-white">${icon('arrow', 'size-3.5')}</span></span>`,
  // a photograph: a large ring behind one of its upper corners, a small body of the accent colour at the opposite one
  photo: (K, src, alt, { side = '', cls = '' } = {}) => `<div class="relative isolate ${cls}" data-k-reveal="zoom"><i class="pointer-events-none absolute ${side === 'right' ? '-left-7' : '-right-7'} -top-7 -z-10 block size-40 rounded-full border-[10px] border-primary-100" aria-hidden="true"></i><i class="pointer-events-none absolute ${side === 'right' ? '-right-3' : '-left-3'} -bottom-3 -z-10 block size-14 rounded-full bg-pop-400" aria-hidden="true"></i><div class="overflow-hidden rounded-[calc(var(--k-r)*1.5)] ${C.PICSHADOW} [&_img]:h-auto [&_img]:max-h-[34rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div>`,
  // steps: a card for each, its number on a disc; a dotted path runs behind the row from one to the next
  steps: (s, K) => {
    const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
    const Hn = s.title || !K.real ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true, word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="relative m-0 grid list-none ${C.GAP} p-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] lg:before:absolute lg:before:inset-x-10 lg:before:top-[3.1rem] lg:before:border-t-2 lg:before:border-dashed lg:before:border-primary-200">${list.map((t, i) => `<li class="group/card ${C.CARD} ${C.LIFT} grid content-start gap-3.5 p-6" data-k-reveal style="transition-delay:${i * 90}ms;${glowAt(i)}"><span class="${DISC} size-[3.25rem] ${i % 2 ? 'bg-popbtn' : 'bg-primary-700'} font-display text-[1.1rem] font-extrabold text-white ring-[6px] ring-primary-100">${num(i)}</span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
  },
  // figures: each inside a ring of light, on the dark ground; the picture that stood beside them in a circle of its own
  stats: (s, K) => {
    const list = statsOf(s);
    const cols = list.length === 2 ? 'grid-cols-2' : list.length === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4';
    const rings = list.map((x, i) => `<li class="grid content-start justify-items-center gap-4 text-center" data-k-reveal="zoom" style="transition-delay:${i * 90}ms"><span class="k-glow relative grid aspect-square w-[min(100%,11rem)] place-items-center rounded-full bg-white/[.06] [--k-glow-w:3px]" style="${glowAt(i)}"><b class="font-display text-[clamp(1.7rem,1.1rem+2vw,2.8rem)] leading-none font-extrabold tracking-tight text-white" data-count="${esc(x.value)}">${esc(x.value)}</b></span><span class="max-w-[13rem] text-[.98rem] leading-snug font-semibold text-white/80">${esc(x.label)}</span></li>`).join('');
    const pic = s.img ? `<div class="relative mx-auto aspect-square w-[min(100%,19rem)]" data-k-reveal="zoom" style="transition-delay:${list.length * 90}ms"><i class="pointer-events-none absolute -inset-[8%] block rounded-full border border-dashed border-white/25" aria-hidden="true"></i><div class="size-full overflow-hidden rounded-full ring-[6px] ring-white/15 [&_img]:size-full [&_img]:object-cover" data-k-img>${K.img(s.img, s.imgAlt || '')}</div></div>` : '';
    return `<section class="${SPACE} py-[calc(var(--k-sec-y)*.8)]">${PAT}${RINGS}<div class="${C.WRAP}">${s.title ? `<div class="${C.HEADGAP} grid max-w-3xl gap-4">${X.rule()}${X.h2(s.title)}</div>` : ''}${pic ? `<div class="grid items-center gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[1.55fr_1fr]"><ul class="m-0 grid list-none gap-x-6 gap-y-9 p-0 ${cols.replace('lg:grid-cols-4', '')}">${rings}</ul>${pic}</div>` : `<ul class="m-0 grid list-none gap-x-6 gap-y-9 p-0 ${cols}">${rings}</ul>`}</div></section>`;
  },
  reviewCard: (r, i, cls = '') => `<figure class="${C.CARD} m-0 grid content-between gap-6 p-7 ${cls}" data-k-reveal style="transition-delay:${(i % 3) * 80}ms;${glowAt(i)}"><div class="grid gap-4"><div class="flex items-center justify-between gap-4">${stars()}<span class="${DISC} size-10 border border-primary-200 font-display text-[1.7rem] leading-none font-extrabold text-primary-600" aria-hidden="true"><span class="translate-y-[.2em]">”</span></span></div><blockquote class="m-0 text-[1.03rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center gap-3.5 border-t border-primary-100 pt-5"><span class="${DISC} size-11 bg-primary-700 font-display text-sm font-extrabold text-white ring-4 ring-primary-100">${esc(initialsOf(r.name))}</span><span class="grid"><b class="text-primary-950">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-muted">${esc(r.place || r.role)}</small>` : ''}</span></figcaption></figure>`,
  faqRow: (f, i) => `<details class="group k-glow ${C.PLAIN} open:shadow-[0_2px_4px_rgb(15_23_42/.05),0_30px_50px_-30px_color-mix(in_srgb,var(--th-primary-800)_55%,transparent)]"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 50}ms;${glowAt(i)}"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 py-4 pr-4 pl-6 font-display text-[1.08rem] leading-snug font-[var(--k-h-weight)] text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="${DISC} size-10 border border-primary-200 text-primary-700 transition duration-300 group-open:rotate-45 group-open:border-primary-700 group-open:bg-primary-700 group-open:text-white">${icon('plus', 'size-4')}</span></summary><div class="px-6 pb-6">${answerOf(f.a)}</div></details>`,
  faqRows: (list) => `<div class="grid gap-3">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`,
  // the closing call: a rounded part of the dark ground, with the pattern and the rings; the picture the website shows with it on a white disc
  cta: (s, K) => {
    const q = quoteTo(s, K), c = callTo(K);
    const pic = s.img ? `<span class="${DISC} size-[clamp(5.5rem,9vw,7.5rem)] bg-surface p-[1.1rem] shadow-[0_24px_44px_-20px_rgb(0_0_0/.5)] ring-[6px] ring-white/15 max-lg:justify-self-start [&_img]:size-full [&_img]:object-contain">${K.img(s.img, s.imgAlt || '')}</span>` : '';
    return `<section class="relative py-[clamp(2.5rem,5vw,4.5rem)]"><div class="${C.WRAP}"><div class="${SPACE} rounded-[calc(var(--k-r)*1.6)] px-[clamp(1.5rem,5vw,4.5rem)] py-[clamp(2.5rem,5.5vw,4.5rem)] shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--th-primary-800)_80%,transparent)]" data-k-reveal="zoom">${PAT}${RINGS}<div class="grid items-center gap-8 ${pic ? 'lg:grid-cols-[auto_1.5fr_auto]' : 'lg:grid-cols-[1.5fr_auto]'}">${pic}<div class="grid gap-4">${X.h2(s.title || 'Ready to get started?', 'text-white')}${s.text ? `<p class="max-w-2xl text-[1.08rem] leading-relaxed text-white/85">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap gap-3.5">${btn(q, C.POP, true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></div></div></section>`;
  },
}));
const { WRAP, POP, GLASSBTN } = C;
// the bands of a page: white (the first, under the dark hero), then a pale shade of the brand colour, in turn
const TONES = { alt: `isolate ${PALE}`, tint: `isolate ${PALE}`, dark: 'on-dark isolate bg-primary-950 text-white', brand: SPACE, rotation: ['none', 'alt'] };

// ---------- hero ----------
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0 text-[.96rem] font-semibold text-white/90" data-k-reveal style="transition-delay:260ms">${list.map((t) => `<li class="inline-flex items-center gap-2.5">${X.check('bg-white/15 text-pop-200 ring-1 ring-white/25')}${esc(t)}</li>`).join('')}</ul>` : '');
// a figure of the business on the ring: a small glass plate
const plate = (x, pos, d) => `<div class="absolute ${pos} z-10 grid max-w-[10.5rem] min-w-[6.75rem] gap-1 rounded-[1.1rem] border border-white/25 bg-primary-950/55 px-4 py-3 text-white max-sm:max-w-[7.75rem] max-sm:min-w-0 max-sm:px-3 max-sm:py-2 shadow-[0_18px_36px_-18px_rgb(0_0_0/.6)] backdrop-blur-md" data-k-reveal="zoom" style="transition-delay:${d}ms"><b class="font-display text-[clamp(1.25rem,1rem+.9vw,1.75rem)] leading-none font-extrabold" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="text-[.76rem] leading-snug font-semibold text-white/85 max-sm:text-[.68rem]">${esc(x.label)}</span></div>`;
const PLACES = ['left-0 top-[4%] sm:-left-6', 'right-0 top-[45%] sm:-right-8', 'left-[5%] -bottom-2 sm:left-[1%]'];
// the picture or the video of a hero in a circle: the light of the border travels round it, two rings turn about it, each with a small
// body on it. Without a picture the circle is the brand's colour with the pattern, and says how to call
const orb = (h, K, size, facts = []) => {
  const has = Boolean(h.image?.src || h.video?.src), c = callTo(K);
  const inside = has
    ? `<div class="absolute inset-[9px] isolate overflow-hidden rounded-full bg-primary-900 [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover"><div class="${web(K).motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}</div>${videoBg(h).replace('-z-20', '')}</div>${h.video ? vPause('right-[13%] bottom-[13%]') : ''}`
    : `<${c ? `a href="${esc(c.href)}"` : 'div'} class="group/call absolute inset-[9px] isolate grid content-center justify-items-center gap-2 overflow-hidden rounded-full bg-linear-to-br from-primary-500 to-primary-800 text-center text-white">${PAT.replace('k-pat-tl', 'k-pat-all')}${c ? `<span class="${DISC} size-14 bg-white/15 transition duration-300 group-hover/call:scale-110 group-hover/call:bg-popbtn">${icon('phone', 'size-6')}</span><span class="mt-2 text-[.8rem] font-bold tracking-[.14em] text-white/80 uppercase">Call us</span><b class="font-display text-[clamp(1.3rem,1rem+1vw,1.9rem)] leading-none font-extrabold">${esc(K.site.phone.display)}</b>` : ''}</${c ? 'a' : 'div'}>`;
  return `<div class="relative mx-auto aspect-square ${size}"><i class="k-turn pointer-events-none absolute -inset-[9%] block rounded-full border border-white/20" aria-hidden="true"><i class="absolute top-1/2 -left-[6px] block size-3 rounded-full bg-pop-400 shadow-[0_0_16px_3px_var(--d-pop-400,var(--th-secondary-400))]"></i></i><i class="k-turn k-turn-back pointer-events-none absolute -inset-[20%] block rounded-full border border-dashed border-white/15 [--k-turn-s:75s]" aria-hidden="true"><i class="absolute -top-1 left-1/2 block size-2 rounded-full bg-white/80"></i></i><div class="k-glow absolute inset-0 rounded-full bg-white/10 shadow-[0_40px_90px_-30px_rgb(0_0_0/.65)] [--k-glow-w:4px]" data-k-reveal="zoom" style="transition-delay:120ms">${inside}</div>${facts.map((x, i) => plate(x, PLACES[i], 320 + i * 120)).join('')}</div>`;
};
// the links the old hero offered: a row across the foot of the hero, each under its own picture on a disc
const dock = (h, K) => {
  const list = h.cards?.items || [];
  if (!list.length) return '';
  const pics = list.some((c) => c.img);
  const link = (c) => {
    const label = c.text || c.title || c.label || '';
    const inner = pics
      ? `<span class="${DISC} size-12 sm:size-[3.75rem] ${K.dims?.[c.img]?.light ? 'bg-white/15' : 'bg-white'} ring-1 ring-white/30 shadow-[0_0_0_6px_rgb(255_255_255/.08)] transition duration-300 group-hover/q:-translate-y-1.5 group-hover/q:shadow-[0_0_0_9px_rgb(255_255_255/.14)] [&_img]:size-6 [&_img]:object-contain sm:[&_img]:size-8">${c.img ? K.img(c.img, c.imgAlt || '') : icon('arrow', 'size-5 text-primary-700')}</span><span>${esc(label)}</span>`
      : `${esc(label)}${icon('arrow', 'size-3.5 opacity-70 transition duration-300 group-hover/q:translate-x-1')}`;
    const cls = pics ? 'group/q flex items-center gap-3 text-[.84rem] leading-tight font-bold text-white sm:grid sm:justify-items-center sm:gap-3 sm:text-center' : 'group/q inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-[.9rem] font-bold text-white transition duration-300 hover:border-white hover:bg-white/10';
    return `<li>${c.href ? `<a class="${cls}" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`;
  };
  return `<div class="relative border-t border-white/12 bg-black/15"><div class="${WRAP} grid items-center gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-5 py-[clamp(1.25rem,2.6vw,2rem)] ${h.cards.title ? 'lg:grid-cols-[minmax(0,14rem)_1fr]' : ''}" data-k-reveal style="transition-delay:380ms">${h.cards.title ? `<p class="m-0 font-display text-[clamp(1.15rem,1rem+.6vw,1.45rem)] leading-tight font-[var(--k-h-weight)] text-white">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 list-none p-0 ${pics ? 'grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-6 lg:grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))]' : 'flex flex-wrap gap-2.5'}">${list.map(link).join('')}</ul></div></div>`;
};

const hero = {
  // the home page: the words on the dark ground; beside them the picture or the video in its circle with the business's figures on the
  // ring; the website's quick links across the foot
  'ob-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.1rem,1.1rem+3.1vw,3.7rem)] leading-[1.06]' : 'text-[clamp(2.6rem,1.2rem+4.8vw,5rem)] leading-[1.03]';
    return `<section class="${SPACE}">${PAT}${HALO}<div class="${WRAP} grid items-center gap-[clamp(3.5rem,6vw,5rem)] py-[clamp(3rem,6.5vw,5.5rem)] lg:min-h-[clamp(32rem,45vw,43rem)] lg:grid-cols-[1.1fr_.9fr]"><div class="grid justify-items-start gap-6">${X.eyebrow(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-white" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-2xl text-[clamp(1.06rem,1rem+.35vw,1.25rem)] leading-relaxed text-white/85 [&_a]:text-white [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:180ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, GLASSBTN, false, true) : ''}</div>${bullets(h.bullets)}</div>${orb(h, K, 'w-[min(86%,31rem)] max-lg:mb-4', factsOf(K).slice(0, 3))}</div>${dock(h, K)}</section>`;
  },
  // an inner page: the trail, the title and the page's actions on the dark ground; beside them the page's picture or video in a small
  // circle, or the rings alone
  'ob-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-white">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-white" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<span aria-hidden="true" class="text-white/40">/</span>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(1.9rem,1.1rem+2.6vw,3.1rem)]' : 'text-[clamp(2.3rem,1.2rem+3.6vw,3.9rem)]';
    const has = Boolean(h.image?.src || h.video?.src);
    const side = has ? orb(h, K, 'w-[min(62%,17rem)] max-lg:my-4') : '<div class="pointer-events-none relative mx-auto aspect-square w-[15rem] max-lg:hidden" aria-hidden="true"><i class="k-turn absolute inset-0 block rounded-full border border-white/20"><i class="absolute top-1/2 -left-[6px] block size-3 rounded-full bg-pop-400"></i></i><i class="k-turn k-turn-back absolute inset-[18%] block rounded-full border border-dashed border-white/20 [--k-turn-s:60s]"><i class="absolute -top-1 left-1/2 block size-2 rounded-full bg-white/80"></i></i><i class="absolute inset-[38%] block rounded-full bg-white/10 ring-1 ring-white/25"></i></div>';
    return `<section class="${SPACE}">${PAT}${HALO}<div class="${WRAP} grid items-center gap-[clamp(2rem,4vw,4rem)] py-[clamp(2.5rem,5vw,4.25rem)] lg:grid-cols-[1fr_auto]"><div class="grid justify-items-start gap-5"><nav class="flex flex-wrap items-center gap-2 text-[.86rem] font-semibold text-white/65" aria-label="Breadcrumb">${crumbs}</nav><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-white" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-white/85 [&_a]:text-white [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:180ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${X.callBtn(K, GLASSBTN)}</div></div><div class="lg:w-[19rem]">${side}</div></div></section>`;
  },
};

// ---------- header and footer ----------
const logo = (K, dark = false) => `<a class="inline-flex items-center gap-3 font-display text-[1.3rem] leading-none font-extrabold tracking-tight ${dark ? 'text-white' : 'text-primary-950'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto ${dark ? 'max-h-24' : 'max-h-12'} w-auto" src="${esc(K.u((dark && K.site.footerLogo) || K.site.logo))}" alt="${esc(K.site.name)}"${dark ? ' loading="lazy"' : ''}>` : `<span class="${DISC} size-10 bg-primary-700 text-[1.05rem] text-white ring-4 ring-primary-100">${esc(String(K.site.name || '?').trim()[0] || '?')}</span><span>${esc(K.site.name)}</span>`}</a>`;
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[.95rem] font-semibold whitespace-nowrap text-primary-950 transition duration-300 hover:bg-primary-50 hover:text-primary-700 aria-[current]:bg-primary-50 aria-[current]:text-primary-700',
  panel: `${PANEL} p-2.5`,
  item: 'flex items-center justify-between gap-3 rounded-full px-4 py-2.5 text-[.93rem] font-semibold text-primary-950 transition hover:bg-primary-50 hover:text-primary-700',
  more: 'rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100',
};
// the line over the header: what the website announces (else its hours, else its address) and its phone, on the brand's deepest shade
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-bold text-white transition hover:text-pop-200" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-pop-300')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `${say.icon ? icon(say.icon, 'size-3.5 text-pop-300') : ''}${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="on-dark bg-primary-950 text-white/80"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[.82rem] font-semibold max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  // a white bar across the page that stays at its head: the logo, the menu in the middle, the action
  ob: (K) => `${strip(K)}<header class="sticky top-0 z-50 border-b border-primary-100 bg-white/95 backdrop-blur-md transition duration-300 data-[scrolled]:shadow-[0_14px_34px_-22px_color-mix(in_srgb,var(--th-primary-950)_55%,transparent)]" data-k-header><div class="${WRAP} flex items-center gap-[clamp(1rem,2.5vw,2.5rem)] py-3" data-p="bar">${logo(K)}<nav class="mx-auto flex items-center gap-0.5 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, true)}</span><button class="${DISC} ml-auto size-11 border border-primary-200 bg-surface text-primary-950 transition hover:border-primary-700 lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // the website's own footer on the brand's deepest shade, with the pattern and the rings
  ob: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-4 flex items-center gap-2.5 text-[.76rem] font-bold tracking-[.16em] text-white uppercase before:block before:size-2 before:rounded-full before:border-2 before:border-pop-400', li = 'transition hover:text-white';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2.5 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="${DISC} size-11 border border-white/20 transition duration-300 hover:-translate-y-1 hover:border-pop-400 hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-full border border-white/20 px-4 py-2 text-[.84rem] font-semibold text-white transition hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-2.5 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} font-bold text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.3fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="on-dark relative isolate overflow-hidden bg-primary-950 pt-[clamp(3.5rem,7vw,5.5rem)] text-white/70 max-sm:pb-20">${PAT.replace('[--k-pat-o:.12]', '[--k-pat-o:.07]')}${RINGS}<div class="${WRAP}"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/12 py-6 text-[.88rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-full border border-white/25 px-3.5 py-1.5 text-[.72rem] font-bold tracking-[.1em] uppercase transition hover:bg-white/10">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'ob-');
export const ORBIT = {
  design: {
    id: 'orbit', name: 'Orbit', badge: 'Circles and rings', blurb: 'A hero on the deep shades of the brand colour with the pattern of the business in white: the picture or the video in a circle with the light of its border travelling round it, two rings turning about it and the figures of the business on the ring. Cards carry the gradient border and its light, icons and numbers stand on discs, and figures stand inside rings of light on a dark band. What comes into view swings in along an arc.',
    fonts: { heading: 'Red Hat Display', body: 'Onest' }, vars: { '--k-r': '1.4rem', '--k-r-btn': '999px', '--k-h-weight': '800', '--k-h-track': '-.03em' },
    header: 'ob', footer: 'ob', offered: true, anim: 'orbit', patterned: true, ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
