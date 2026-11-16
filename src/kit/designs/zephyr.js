import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, num, statsOf, introHtml, answerOf, initialsOf } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays, glowAt } from './base.js';
import { stars } from '../ui.js';

// ZEPHYR: soft and flowing. The hero stands on a pale ground that carries the website's pattern: the words on the left, the picture or
// the video on the right in a shape whose outline flows slowly, the light of its border travelling round it, a second shape of soft
// colour behind it and the figures of the business on small cards beside it. Sections are flat bands, white and pale in turn. Everything
// is cut like a leaf - one corner of a card, a picture, a mark is left almost square; cards carry the gradient border and its light;
// headings stand over a wavy line and their accent words over a scalloped one. What comes into view floats up softly (the "float" motion
// of the stylesheet). Its colours are the website's theme. Layout names start with zp-.

const SOFT = 'bg-[color-mix(in_srgb,var(--th-primary-50)_62%,var(--th-bg))]';
const PAT_LIGHT = '<i class="k-pat-layer k-pat-all [--k-pat-ink:#fff] [--k-pat-o:.09]" aria-hidden="true"></i>';
// a leaf: round corners, but for the lower left one
const LEAF = 'rounded-[var(--k-r)] rounded-bl-[.45rem]';
const PANEL = `relative ${LEAF} border border-primary-100 bg-surface shadow-[0_1px_2px_rgb(15_23_42/.04),0_22px_44px_-28px_color-mix(in_srgb,var(--th-primary-800)_45%,transparent)] transition-all duration-500`;
// soft shapes at the corner of a part of the brand's colour
const DRIFTS = '<i class="k-blob pointer-events-none absolute -top-24 -right-20 -z-10 block size-[22rem] bg-white/[.07]" aria-hidden="true"></i><i class="k-blob pointer-events-none absolute -bottom-28 right-[22%] -z-10 block size-[16rem] bg-white/[.06] [animation-delay:-8s]" aria-hidden="true"></i>';
// a wavy line: the mark of this design over a heading
const WAVE = '<svg class="h-2.5 w-16 text-pop-500 on-dark:text-pop-300" viewBox="0 0 64 10" fill="none" aria-hidden="true"><path d="M2 5c5-5 10 5 15 0s10-5 15 0 10 5 15 0 10-5 15 0" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

const { X, C } = sections({
  PLAIN: PANEL, CARD: `k-glow ${PANEL}`,
  // a card is picked up: it rises, and its square corner rounds
  LIFT: 'hover:-translate-y-2 hover:rounded-bl-[var(--k-r)] hover:shadow-[0_2px_4px_rgb(15_23_42/.04),0_36px_60px_-30px_color-mix(in_srgb,var(--th-primary-800)_55%,transparent)]',
  TILE: 'grid size-[3.25rem] shrink-0 place-items-center rounded-[1.1rem] rounded-bl-[.3rem] bg-primary-100 text-primary-700 transition duration-300',
  DEEP: 'on-dark relative isolate overflow-hidden bg-linear-to-br from-primary-600 to-primary-800 text-white',
  // (the accent words of a heading stand over a scalloped line)
  TONE: 'k-scallop text-primary-600 on-dark:text-pop-200',
  NUM: 'grid size-10 place-items-center rounded-[.9rem] rounded-bl-[.25rem] bg-primary-100 font-display text-[.95rem] font-bold text-primary-700',
  PICSHADOW: 'shadow-[0_34px_64px_-34px_color-mix(in_srgb,var(--th-primary-900)_55%,transparent)]',
  UNDERHERO: 'py-[clamp(2.5rem,5vw,4.5rem)]',
}, (X, C) => ({
  eyebrow: (t) => (t ? `<span class="inline-flex w-fit items-center gap-2.5 rounded-full bg-primary-100 py-1.5 pr-4 pl-3 text-[.76rem] font-bold tracking-[.12em] text-primary-800 uppercase on-dark:bg-white/15 on-dark:text-white"><i class="block size-2.5 rounded-[.55rem] rounded-bl-[.1rem] bg-pop-500"></i>${esc(t)}</span>` : ''),
  rule: () => WAVE,
  check: (cls = 'bg-primary-100 text-primary-700') => `<span class="mt-0.5 grid size-[1.5rem] shrink-0 place-items-center rounded-[.6rem] rounded-bl-[.15rem] ${cls}">${icon('check', 'size-3 stroke-[3.5]')}</span>`,
  arrowLink: (label) => `<span class="mt-auto inline-flex items-center gap-2.5 pt-1 text-[.95rem] font-bold text-primary-800 on-dark:text-white">${esc(label)}<span class="grid size-8 place-items-center rounded-[.8rem] rounded-bl-[.2rem] bg-primary-100 text-primary-700 transition-all duration-300 group-hover/card:translate-x-1 group-hover/card:rounded-bl-[.8rem] group-hover/card:bg-popbtn group-hover/card:text-white on-dark:bg-white/15 on-dark:text-white">${icon('arrow', 'size-3.5')}</span></span>`,
  // a photograph: a large leaf, a soft flowing shape behind it and a small body of the accent colour that floats beside it
  photo: (K, src, alt, { side = '', cls = '' } = {}) => `<div class="relative isolate ${cls}" data-k-reveal="zoom"><i class="k-blob pointer-events-none absolute -inset-[5%] -z-10 block bg-linear-to-br from-primary-100 to-primary-200" aria-hidden="true"></i><i class="animate-k-bob pointer-events-none absolute ${side === 'right' ? '-left-4' : '-right-4'} top-[10%] block size-10 rounded-full bg-pop-300 shadow-[0_14px_26px_-12px_rgb(0_0_0/.35)]" aria-hidden="true"></i><div class="overflow-hidden rounded-[calc(var(--k-r)*1.5)] ${side === 'right' ? 'rounded-br-[.6rem]' : 'rounded-bl-[.6rem]'} ${C.PICSHADOW} [&_img]:h-auto [&_img]:max-h-[34rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div>`,
  // cards: the picture set into the head of each as a leaf of its own, the words under it
  cards: (s, K) => {
    const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
    const n = list.length, hasPics = list.some((c) => c.img);
    const Hn = s.title ? 'h3' : 'h2';
    const cell = (c, i) => {
      const label = c.title || c.text || c.label || '';
      const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
      const more = c.href ? X.arrowLink(c.cta || 'Learn more') : '';
      const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
      const chip = ownIcon ? `<span class="absolute -bottom-4 left-5 z-[1] grid size-12 place-items-center rounded-[1rem] rounded-bl-[.25rem] ${K.dims?.[ownIcon]?.light ? 'bg-primary-700' : 'bg-surface'} shadow-[0_12px_26px_-12px_rgb(0_0_0/.45)] ring-4 ring-white [&_img]:size-7! [&_img]:object-contain!">${K.img(ownIcon, '')}</span>` : '';
      if (c.img) return X.shell(`<div class="relative m-2.5 mb-0">${chip}<div class="aspect-[16/11] overflow-hidden rounded-[calc(var(--k-r)*.82)] rounded-bl-[.35rem] [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.07]">${K.img(c.img, c.imgAlt || label)}</div></div><div class="grid flex-1 content-start gap-2.5 p-5 ${chip ? 'pt-8' : ''}"><${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}</div>`, { href: c.href, i, cls: 'flex flex-col', step: 80, per: 4 });
      return X.shell(`${X.tile(K, { ...c, photo: true }, i) || X.numMark(i)}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}`, { href: c.href, i, cls: 'grid content-start gap-3.5 p-[clamp(1.4rem,2.5vw,2rem)]', step: 80 });
    };
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: !s.small })}<div class="grid ${C.GAP} ${X.colsOf(n, { small: s.small, pics: hasPics })}">${list.map(cell).join('')}</div></div></section>`;
  },
  // steps: a leaf for each, its number on a small leaf of colour; every other one stands a little lower, like stepping stones
  steps: (s, K) => {
    const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
    const Hn = s.title || !K.real ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true, word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="m-0 grid list-none ${C.GAP} p-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] lg:pb-6">${list.map((t, i) => `<li class="${i % 2 ? 'lg:translate-y-6' : ''}"><div class="group/card ${C.CARD} ${C.LIFT} grid h-full content-start gap-3.5 p-6" data-k-reveal style="transition-delay:${i * 100}ms;${glowAt(i)}"><span class="grid size-12 place-items-center rounded-[1.05rem] rounded-bl-[.3rem] ${i % 2 ? 'bg-popbtn' : 'bg-primary-700'} font-display text-[1.1rem] font-bold text-white">${num(i)}</span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</div></li>`).join('')}</ol></div></section>`;
  },
  // figures: a leaf for each with the gradient border; the picture that stood beside them is a leaf of the same row
  stats: (s, K) => {
    const list = statsOf(s);
    const cols = list.length === 2 ? 'grid-cols-2' : list.length === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4';
    const cells = list.map((x, i) => `<li class="${C.CARD} grid content-start gap-2.5 p-[clamp(1.1rem,2.4vw,1.75rem)]" data-k-reveal="zoom" style="transition-delay:${i * 90}ms;${glowAt(i)}"><span class="mb-1 block h-1.5 w-9 rounded-full ${i % 2 ? 'bg-pop-400' : 'bg-primary-500'}" aria-hidden="true"></span><b class="font-display text-[clamp(2rem,1.3rem+2.3vw,3.3rem)] leading-none font-bold tracking-tight text-primary-800" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="text-[.97rem] leading-snug font-medium text-secondary">${esc(x.label)}</span></li>`).join('');
    const pic = s.img ? `<div class="overflow-hidden rounded-[calc(var(--k-r)*1.3)] rounded-br-[.5rem] ${C.PICSHADOW} [&_img]:size-full [&_img]:max-h-72 [&_img]:object-cover lg:[&_img]:max-h-none" data-k-reveal="zoom" style="transition-delay:${list.length * 90}ms"><div class="h-full" data-k-img>${K.img(s.img, s.imgAlt || '')}</div></div>` : '';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${s.title ? `<div class="${C.HEADGAP} grid max-w-3xl gap-4">${X.rule()}${X.h2(s.title)}</div>` : ''}${pic ? `<div class="grid ${C.GAP} lg:grid-cols-[1.6fr_1fr]"><ul class="m-0 grid list-none ${C.GAP} p-0 ${cols.replace('lg:grid-cols-4', '')}">${cells}</ul>${pic}</div>` : `<ul class="m-0 grid list-none ${C.GAP} p-0 ${cols}">${cells}</ul>`}</div></section>`;
  },
  reviewCard: (r, i, cls = '') => `<figure class="${C.CARD} m-0 grid content-between gap-6 p-7 ${cls}" data-k-reveal style="transition-delay:${(i % 3) * 90}ms;${glowAt(i)}"><div class="grid gap-4"><div class="flex items-center justify-between gap-4">${stars()}<span class="grid size-11 place-items-center rounded-[1rem] rounded-bl-[.25rem] bg-pop-100 font-display text-[1.9rem] leading-none font-bold text-popbtn" aria-hidden="true"><span class="translate-y-[.2em]">”</span></span></div><blockquote class="m-0 text-[1.04rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center gap-3.5"><span class="grid size-12 shrink-0 place-items-center rounded-[1.05rem] rounded-bl-[.3rem] bg-primary-700 font-display text-sm font-bold text-white">${esc(initialsOf(r.name))}</span><span class="grid"><b class="text-primary-950">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-muted">${esc(r.place || r.role)}</small>` : ''}</span></figcaption></figure>`,
  scrollBtn: (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="grid size-12 place-items-center rounded-[1.05rem] ${dir === 'prev' ? 'rounded-br-[.3rem]' : 'rounded-bl-[.3rem]'} bg-primary-100 text-primary-800 transition hover:bg-primary-700 hover:text-white">${icon('arrow', dir === 'prev' ? 'size-5 rotate-180' : 'size-5')}</button>`,
  faqRow: (f, i) => `<details class="group k-glow ${C.PLAIN} open:shadow-[0_2px_4px_rgb(15_23_42/.04),0_30px_50px_-30px_color-mix(in_srgb,var(--th-primary-800)_50%,transparent)]"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 60}ms;${glowAt(i)}"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 py-4 pr-4 pl-6 font-display text-[1.08rem] leading-snug font-[var(--k-h-weight)] text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="grid size-10 shrink-0 place-items-center rounded-[.9rem] rounded-bl-[.25rem] bg-primary-100 text-primary-700 transition-all duration-300 group-open:rotate-45 group-open:rounded-full group-open:bg-primary-700 group-open:text-white">${icon('plus', 'size-4')}</span></summary><div class="px-6 pb-6">${answerOf(f.a)}</div></details>`,
  faqRows: (list) => `<div class="grid gap-3">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`,
  // the closing call: a large leaf of the brand's colour with the pattern and two soft shapes
  cta: (s, K) => {
    const q = quoteTo(s, K), c = callTo(K);
    const pic = s.img ? `<span class="grid size-[clamp(5rem,9vw,7rem)] shrink-0 place-items-center rounded-[1.6rem] rounded-bl-[.45rem] bg-surface p-3.5 shadow-[0_24px_44px_-20px_rgb(0_0_0/.5)] max-lg:justify-self-start [&_img]:size-full [&_img]:object-contain">${K.img(s.img, s.imgAlt || '')}</span>` : '';
    return `<section class="relative py-[clamp(2.5rem,5vw,4.5rem)]"><div class="${C.WRAP}"><div class="${C.DEEP} rounded-[calc(var(--k-r)*1.7)] rounded-bl-[.8rem] px-[clamp(1.5rem,5vw,4.5rem)] py-[clamp(2.5rem,5.5vw,4.5rem)] shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--th-primary-800)_80%,transparent)]" data-k-reveal="zoom">${PAT_LIGHT}${DRIFTS}<div class="grid items-center gap-8 ${pic ? 'lg:grid-cols-[auto_1.5fr_auto]' : 'lg:grid-cols-[1.5fr_auto]'}">${pic}<div class="grid gap-4">${X.h2(s.title || 'Ready to get started?', 'text-white')}${s.text ? `<p class="max-w-2xl text-[1.08rem] leading-relaxed text-white/85">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap gap-3.5">${btn(q, 'bg-surface text-primary-800 shadow-[0_14px_30px_-12px_rgb(0_0_0/.45)] hover:bg-pop-100', true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></div></div></section>`;
  },
}));
const { WRAP, POP, LINE } = C;
// the bands of a page: white (the first, under the hero's pale ground), then a pale shade of the brand colour, in turn
const TONES = { alt: `isolate ${SOFT}`, tint: `isolate ${SOFT}`, dark: 'on-dark isolate bg-primary-900 text-white', brand: 'on-dark isolate bg-linear-to-br from-primary-600 to-primary-800 text-white', rotation: ['none', 'alt'] };

// ---------- hero ----------
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0 text-[.96rem] font-semibold text-primary-950" data-k-reveal style="transition-delay:260ms">${list.map((t) => `<li class="inline-flex items-center gap-2.5">${X.check('bg-primary-700 text-white')}${esc(t)}</li>`).join('')}</ul>` : '');
// a figure of the business on a small leaf beside the picture
const note = (x, pos, d) => `<div class="k-glow absolute ${pos} z-10 grid max-w-[10.5rem] min-w-[6.5rem] gap-1 rounded-[1.25rem] rounded-bl-[.35rem] bg-surface px-4 py-3 shadow-[0_22px_40px_-20px_color-mix(in_srgb,var(--th-primary-900)_55%,transparent)] max-sm:max-w-[7.75rem] max-sm:min-w-0 max-sm:px-3 max-sm:py-2" data-k-reveal="zoom" style="transition-delay:${d}ms"><b class="font-display text-[clamp(1.25rem,1rem+.9vw,1.75rem)] leading-none font-bold text-primary-800" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="text-[.76rem] leading-snug font-semibold text-secondary max-sm:text-[.68rem]">${esc(x.label)}</span></div>`;
const SPOTS = ['left-0 bottom-[10%] sm:-left-7', 'right-0 top-[9%] sm:-right-5', 'right-[4%] -bottom-3 sm:right-[2%]'];
// the picture or the video of a hero in a shape whose outline flows: the light of the border travels round it, a second shape of soft
// colour flows behind it. Without a picture the shape is the brand's colour with the pattern, and says how to call
const bloom = (h, K, size, facts = []) => {
  const has = Boolean(h.image?.src || h.video?.src), c = callTo(K);
  const inside = has
    ? `<div class="${web(K).motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}</div>${videoBg(h).replace('-z-20', '')}`
    : `<${c ? `a href="${esc(c.href)}"` : 'div'} class="group/call absolute inset-0 isolate grid content-center justify-items-center gap-2 bg-linear-to-br from-primary-500 to-primary-800 text-center text-white">${PAT_LIGHT}${c ? `<span class="grid size-14 place-items-center rounded-[1.2rem] rounded-bl-[.35rem] bg-white/15 transition duration-300 group-hover/call:scale-110 group-hover/call:bg-popbtn">${icon('phone', 'size-6')}</span><span class="mt-2 text-[.8rem] font-bold tracking-[.14em] text-white/80 uppercase">Call us</span><b class="font-display text-[clamp(1.3rem,1rem+1vw,1.9rem)] leading-none font-bold">${esc(K.site.phone.display)}</b>` : ''}</${c ? 'a' : 'div'}>`;
  return `<div class="relative isolate mx-auto aspect-[1/1.02] ${size}"><i class="k-blob pointer-events-none absolute -inset-[7%] -z-10 block bg-linear-to-br from-primary-200 to-primary-100 [animation-delay:-7s]" aria-hidden="true"></i><i class="animate-k-bob pointer-events-none absolute top-[3%] left-[6%] block size-9 rounded-full bg-pop-300 shadow-[0_14px_26px_-12px_rgb(0_0_0/.35)]" aria-hidden="true"></i><i class="animate-k-bob pointer-events-none absolute right-[14%] -bottom-2 block size-5 rounded-full bg-primary-400 [animation-delay:-3s]" aria-hidden="true"></i><div class="absolute inset-0" data-k-reveal="zoom" style="transition-delay:120ms"><div class="k-glow k-blob absolute inset-0 isolate overflow-hidden bg-primary-100 shadow-[0_44px_84px_-38px_color-mix(in_srgb,var(--th-primary-900)_65%,transparent)] [--k-glow-w:4px] [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover">${inside}</div></div>${facts.map((x, i) => note(x, SPOTS[i], 320 + i * 120)).join('')}${has && h.video ? vPause('right-[16%] bottom-[14%]') : ''}</div>`;
};
// the links the old hero offered: a white row across the foot of the hero, each link beside its own picture on a small leaf
const quick = (h, K) => {
  const list = h.cards?.items || [];
  if (!list.length) return '';
  const link = (c) => {
    const label = c.text || c.title || c.label || '';
    const inner = `${c.img ? `<span class="grid size-11 shrink-0 place-items-center rounded-[1rem] rounded-bl-[.25rem] ${K.dims?.[c.img]?.light ? 'bg-primary-700' : 'bg-primary-100'} transition-all duration-300 group-hover/q:-translate-y-1 group-hover/q:rounded-bl-[1rem] [&_img]:size-6 [&_img]:object-contain">${K.img(c.img, c.imgAlt || '')}</span>` : `<i class="block size-2.5 shrink-0 rounded-[.55rem] rounded-bl-[.1rem] bg-pop-500"></i>`}<span>${esc(label)}</span>`;
    const cls = 'group/q flex items-center gap-3 text-[.9rem] leading-tight font-semibold text-primary-950 transition duration-300 hover:text-primary-700';
    return `<li>${c.href ? `<a class="${cls}" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`;
  };
  return `<div class="relative bg-surface shadow-[0_-20px_40px_-34px_color-mix(in_srgb,var(--th-primary-900)_45%,transparent)]"><div class="${WRAP} grid items-center gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-5 py-[clamp(1.25rem,2.4vw,1.85rem)] ${h.cards.title ? 'lg:grid-cols-[minmax(0,13rem)_1fr]' : ''}" data-k-reveal style="transition-delay:380ms">${h.cards.title ? `<p class="m-0 font-display text-[clamp(1.1rem,1rem+.5vw,1.35rem)] leading-tight font-[var(--k-h-weight)] text-primary-950">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-4 p-0 sm:grid-cols-3 lg:grid-cols-4">${list.map(link).join('')}</ul></div></div>`;
};
// two soft lights on the ground of a hero
const GLOWS = '<i class="pointer-events-none absolute -top-40 -left-32 -z-10 block size-[34rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--th-primary-200)_70%,transparent),transparent)]" aria-hidden="true"></i><i class="pointer-events-none absolute -right-24 -bottom-48 -z-10 block size-[30rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--th-primary-100)_90%,transparent),transparent)]" aria-hidden="true"></i>';

const hero = {
  // the home page: the words on the patterned ground; beside them the picture or the video in its flowing shape with the business's
  // figures on small leaves; the website's quick links across the foot
  'zp-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.1rem,1.1rem+3.1vw,3.7rem)] leading-[1.06]' : 'text-[clamp(2.6rem,1.2rem+4.8vw,5rem)] leading-[1.03]';
    return `<section class="k-pat k-pat-tl relative isolate overflow-hidden [--k-pat-o:.18] ${SOFT}">${GLOWS}<div class="${WRAP} grid items-center gap-[clamp(3rem,5vw,4.5rem)] py-[clamp(3rem,6.5vw,5.5rem)] lg:min-h-[clamp(32rem,45vw,43rem)] lg:grid-cols-[1.1fr_.9fr]"><div class="grid justify-items-start gap-6">${X.eyebrow(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-2xl text-[clamp(1.06rem,1rem+.35vw,1.25rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:180ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, LINE, false, true) : ''}</div>${bullets(h.bullets)}</div>${bloom(h, K, 'w-[min(84%,30rem)] max-lg:mb-4', factsOf(K).slice(0, 3))}</div>${quick(h, K)}</section>`;
  },
  // an inner page: the trail, the title and the page's actions on the patterned ground; beside them the page's picture or video in a
  // small flowing shape, or soft shapes alone
  'zp-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-primary-950">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-primary-700" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<span aria-hidden="true" class="text-primary-300">/</span>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(1.9rem,1.1rem+2.6vw,3.1rem)]' : 'text-[clamp(2.3rem,1.2rem+3.6vw,3.9rem)]';
    const has = Boolean(h.image?.src || h.video?.src);
    const side = has ? bloom(h, K, 'w-[min(66%,17rem)] max-lg:my-3') : '<div class="pointer-events-none relative isolate mx-auto aspect-square w-[14rem] max-lg:hidden" aria-hidden="true"><i class="k-blob absolute inset-[6%] block bg-linear-to-br from-primary-500 to-primary-700 shadow-[0_30px_50px_-26px_color-mix(in_srgb,var(--th-primary-900)_60%,transparent)]"></i><i class="k-blob absolute -inset-[4%] -z-10 block bg-primary-200 [animation-delay:-7s]"></i><i class="animate-k-bob absolute top-0 right-[8%] block size-9 rounded-full bg-pop-300"></i></div>';
    return `<section class="k-pat k-pat-tl relative isolate overflow-hidden [--k-pat-o:.18] ${SOFT}">${GLOWS}<div class="${WRAP} grid items-center gap-[clamp(2rem,4vw,4rem)] py-[clamp(2.25rem,4.5vw,3.75rem)] lg:grid-cols-[1fr_auto]"><div class="grid justify-items-start gap-5"><nav class="flex w-fit flex-wrap items-center gap-2 rounded-full bg-surface px-4 py-1.5 text-[.84rem] font-semibold text-secondary shadow-[0_8px_20px_-14px_color-mix(in_srgb,var(--th-primary-900)_50%,transparent)]" aria-label="Breadcrumb">${crumbs}</nav><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:180ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${X.callBtn(K, LINE)}</div></div><div class="lg:w-[19rem]">${side}</div></div></section>`;
  },
};

// ---------- header and footer ----------
const logo = (K, dark = false) => `<a class="inline-flex items-center gap-3 font-display text-[1.3rem] leading-none font-bold tracking-tight ${dark ? 'text-white' : 'text-primary-950'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto ${dark ? 'max-h-24' : 'max-h-12'} w-auto" src="${esc(K.u((dark && K.site.footerLogo) || K.site.logo))}" alt="${esc(K.site.name)}"${dark ? ' loading="lazy"' : ''}>` : `<span class="grid size-10 place-items-center rounded-[1rem] rounded-bl-[.25rem] bg-primary-700 text-[1.05rem] text-white">${esc(String(K.site.name || '?').trim()[0] || '?')}</span><span>${esc(K.site.name)}</span>`}</a>`;
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 rounded-[.9rem] rounded-bl-[.25rem] px-3.5 py-2 text-[.95rem] font-semibold whitespace-nowrap text-primary-950 transition-all duration-300 hover:bg-primary-100 hover:text-primary-800 aria-[current]:bg-primary-100 aria-[current]:text-primary-800',
  panel: `${PANEL} p-2.5`,
  item: 'flex items-center justify-between gap-3 rounded-[.9rem] px-3.5 py-2.5 text-[.93rem] font-semibold text-primary-950 transition hover:bg-primary-50 hover:text-primary-700',
  more: 'rounded-[.9rem] bg-primary-50 text-primary-700 hover:bg-primary-100',
};
// the line over the header: what the website announces (else its hours, else its address) and its phone, on a soft shade of the brand
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-bold text-primary-900 transition hover:text-primary-600" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-popbtn')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `${say.icon ? icon(say.icon, 'size-3.5 text-popbtn') : ''}${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="bg-primary-100 text-primary-900"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[.82rem] font-semibold max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  // a white bar across the page that stays at its head: the logo, the menu, the action
  zp: (K) => `${strip(K)}<header class="sticky top-0 z-50 bg-white/95 backdrop-blur-md transition duration-300 data-[scrolled]:shadow-[0_16px_36px_-24px_color-mix(in_srgb,var(--th-primary-950)_50%,transparent)]" data-k-header><div class="${WRAP} flex items-center gap-[clamp(1rem,2.5vw,2.5rem)] py-3" data-p="bar">${logo(K)}<nav class="mx-auto flex items-center gap-1 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, true)}</span><button class="ml-auto grid size-11 place-items-center rounded-[1rem] rounded-bl-[.25rem] bg-primary-100 text-primary-900 transition hover:bg-primary-200 lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // the website's own footer on a deep shade of the brand, with the pattern and two soft shapes
  zp: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-4 inline-flex rounded-full bg-white/10 px-3.5 py-1 text-[.74rem] font-bold tracking-[.14em] text-white uppercase', li = 'transition hover:text-white';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2.5 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-11 place-items-center rounded-[1rem] rounded-bl-[.25rem] bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:rounded-bl-[1rem] hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-full bg-white/10 px-4 py-2 text-[.84rem] font-semibold text-white transition hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-2.5 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} font-bold text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.3fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="on-dark relative isolate overflow-hidden bg-primary-900 pt-[clamp(3.5rem,7vw,5.5rem)] text-white/75 max-sm:pb-20">${PAT_LIGHT.replace('k-pat-all', 'k-pat-tl').replace('[--k-pat-o:.09]', '[--k-pat-o:.07]')}${DRIFTS}<div class="${WRAP}"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/12 py-6 text-[.88rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-full bg-white/10 px-3.5 py-1.5 text-[.72rem] font-bold tracking-[.1em] uppercase transition hover:bg-white/20">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'zp-');
export const ZEPHYR = {
  design: {
    id: 'zephyr', name: 'Zephyr', badge: 'Soft and flowing', blurb: 'A hero on a pale ground that carries the pattern of the business: the picture or the video in a shape whose outline flows slowly, the light of its border travelling round it, with the figures of the business on small leaves beside it. Cards, pictures and marks are cut like a leaf, one corner left almost square, and cards carry the gradient border and its light; headings stand over a wavy line. What comes into view floats up softly.',
    fonts: { heading: 'Lexend', body: 'Be Vietnam Pro' }, vars: { '--k-r': '1.75rem', '--k-r-btn': '999px', '--k-h-weight': '700', '--k-h-track': '-.035em' },
    header: 'zp', footer: 'zp', offered: true, anim: 'float', patterned: true, ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
