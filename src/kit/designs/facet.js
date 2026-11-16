import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, num, statsOf, introHtml, answerOf, initialsOf } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays, glowAt } from './base.js';
import { stars } from '../ui.js';

// FACET: cut like a stone. The hero stands on a pale ground that carries the website's pattern: the words on the left, the picture or
// the video in a large diamond on the right with the light of its border travelling round it, a diamond of the brand's colour and one
// of the accent colour beside it; the figures of the business in a ruled row under both. Sections are flat bands, white and pale with
// the pattern in turn. Cards carry the gradient border and its light and a small corner of the brand's colour; icons, numbers and marks
// stand on diamonds; pictures stand between two corner brackets; accent words stand over a bar of the accent colour. What comes into
// view comes in leaning and straightens, and pictures are wiped clear on a diagonal (the "shear" motion of the stylesheet). Its colours
// are the website's theme. Layout names start with fc-.

const PALE = 'bg-[color-mix(in_srgb,var(--th-primary-50)_70%,var(--th-bg))]';
const PAT_LIGHT = '<i class="k-pat-layer k-pat-all [--k-pat-ink:#fff] [--k-pat-o:.1]" aria-hidden="true"></i>';
// a diamond: a square turned on its corner (what stands on it is turned back)
const GEM = 'grid shrink-0 rotate-45 place-items-center [&>*]:-rotate-45';
// outlines of large diamonds at the corner of a part of the brand's colour
const CUTS = '<i class="pointer-events-none absolute -right-28 top-1/2 -z-10 block size-[26rem] -translate-y-1/2 rotate-45 rounded-[2.5rem] border border-white/15" aria-hidden="true"></i><i class="pointer-events-none absolute -right-10 top-1/2 -z-10 block size-[15rem] -translate-y-1/2 rotate-45 rounded-[1.6rem] border border-white/15 bg-white/[.04]" aria-hidden="true"></i>';
// (a card carries a small corner of the brand's colour)
const PANEL = 'relative rounded-[var(--k-r)] border border-primary-100 bg-surface shadow-[0_1px_2px_rgb(15_23_42/.05),0_16px_32px_-22px_color-mix(in_srgb,var(--th-primary-900)_45%,transparent)] transition duration-300';
const CORNER = 'before:pointer-events-none before:absolute before:top-0 before:right-0 before:z-[1] before:size-0 before:rounded-tr-[inherit] before:border-t-[1.5rem] before:border-l-[1.5rem] before:border-t-primary-700 before:border-l-transparent before:transition before:duration-300 hover:before:border-t-pop-500';

const { X, C } = sections({
  PLAIN: PANEL, CARD: `k-glow ${PANEL} ${CORNER}`,
  LIFT: 'hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgb(15_23_42/.05),0_30px_50px_-26px_color-mix(in_srgb,var(--th-primary-900)_60%,transparent)]',
  TILE: `${GEM} m-1.5 size-11 rounded-[.6rem] bg-primary-50 text-primary-700 ring-1 ring-primary-200 transition duration-300`,
  DEEP: 'on-dark relative isolate overflow-hidden bg-linear-to-br from-primary-600 to-primary-800 text-white',
  // (the accent words of a heading stand over a bar of the accent colour)
  TONE: 'border-b-[.1em] border-pop-500 text-primary-700 on-dark:text-white',
  NUM: 'font-display text-[.9rem] font-bold tracking-[.14em] text-primary-700',
  UNDERHERO: 'py-[clamp(2.5rem,5vw,4.5rem)]',
}, (X, C) => ({
  eyebrow: (t) => (t ? `<span class="inline-flex w-fit items-center gap-3 text-[.76rem] font-bold tracking-[.18em] text-primary-800 uppercase on-dark:text-white"><i class="block size-2.5 shrink-0 rotate-45 bg-pop-500"></i>${esc(t)}</span>` : ''),
  // three small diamonds: the mark of this design over a heading
  rule: () => '<span class="flex items-center gap-2.5 pl-1" aria-hidden="true"><i class="block size-2.5 rotate-45 bg-primary-700 on-dark:bg-white"></i><i class="block size-2.5 rotate-45 bg-pop-500"></i><i class="block size-2.5 rotate-45 border border-primary-400 on-dark:border-white/60"></i></span>',
  check: (cls = 'bg-primary-700 text-white') => `<span class="${GEM} mx-0.5 mt-1 size-[1.15rem] rounded-[.2rem] ${cls}">${icon('check', 'size-3 stroke-[3.5]')}</span>`,
  arrowLink: (label) => `<span class="mt-auto inline-flex items-center gap-3.5 pt-1 text-[.95rem] font-bold text-primary-800 on-dark:text-white">${esc(label)}<span class="${GEM} size-7 rounded-[.35rem] bg-primary-700 text-white transition duration-300 group-hover/card:translate-x-1 group-hover/card:bg-popbtn on-dark:bg-white on-dark:text-primary-800">${icon('arrow', 'size-3.5')}</span></span>`,
  // a photograph: between two corner brackets, a diamond of the brand's colour on its edge
  photo: (K, src, alt, { side = '', cls = '' } = {}) => `<div class="relative isolate ${cls}" data-k-reveal="zoom"><i class="pointer-events-none absolute -top-3 ${side === 'right' ? '-right-3 border-r-4' : '-left-3 border-l-4'} -z-10 block size-24 border-t-4 border-pop-500" aria-hidden="true"></i><i class="pointer-events-none absolute -bottom-3 ${side === 'right' ? '-left-3 border-l-4' : '-right-3 border-r-4'} -z-10 block size-24 border-b-4 border-primary-700" aria-hidden="true"></i><div class="overflow-hidden rounded-[var(--k-r)] ${C.PICSHADOW} [&_img]:h-auto [&_img]:max-h-[34rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div><i class="pointer-events-none absolute ${side === 'right' ? '-left-4' : '-right-4'} top-[16%] block size-8 rotate-45 rounded-[.4rem] bg-primary-700 shadow-[0_12px_24px_-10px_rgb(0_0_0/.5)]" aria-hidden="true"></i></div>`,
  // cards: the picture at the head of each, its foot cut on a slant; the words under it
  cards: (s, K) => {
    const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
    const n = list.length, hasPics = list.some((c) => c.img);
    const Hn = s.title ? 'h3' : 'h2';
    const cell = (c, i) => {
      const label = c.title || c.text || c.label || '';
      const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
      const more = c.href ? X.arrowLink(c.cta || 'Learn more') : '';
      const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
      const chip = ownIcon ? `<span class="${GEM} absolute bottom-0 left-6 z-[1] size-11 rounded-[.6rem] ${K.dims?.[ownIcon]?.light ? 'bg-primary-700' : 'bg-surface'} shadow-[0_10px_24px_-10px_rgb(0_0_0/.45)] [&_img]:size-6! [&_img]:object-contain!">${K.img(ownIcon, '')}</span>` : '';
      if (c.img) return X.shell(`<div class="relative">${chip}<div class="aspect-[16/11] overflow-hidden rounded-t-[var(--k-r)] [clip-path:polygon(0_0,100%_0,100%_86%,0_100%)] [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.07]">${K.img(c.img, c.imgAlt || label)}</div></div><div class="grid flex-1 content-start gap-2.5 p-5 ${chip ? 'pt-6' : ''}"><${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}</div>`, { href: c.href, i, cls: 'flex flex-col', step: 70, per: 4 });
      return X.shell(`${X.tile(K, { ...c, photo: true }, i) || X.numMark(i)}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}`, { href: c.href, i, cls: 'grid content-start gap-3.5 p-[clamp(1.4rem,2.5vw,2rem)]', step: 70 });
    };
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: !s.small })}<div class="grid ${C.GAP} ${X.colsOf(n, { small: s.small, pics: hasPics })}">${list.map(cell).join('')}</div></div></section>`;
  },
  // steps: a card for each, its number on a diamond
  steps: (s, K) => {
    const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
    const Hn = s.title || !K.real ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true, word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="m-0 grid list-none ${C.GAP} p-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">${list.map((t, i) => `<li class="group/card ${C.CARD} ${C.LIFT} grid content-start gap-4 p-6" data-k-reveal style="transition-delay:${i * 90}ms;${glowAt(i)}"><span class="${GEM} m-2 size-11 rounded-[.6rem] ${i % 2 ? 'bg-popbtn' : 'bg-primary-700'} font-display text-[1rem] font-bold text-white"><span>${num(i)}</span></span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
  },
  // figures: on a band of the brand's colour with the pattern, set apart by slanted lines; the picture that stood beside them keeps its place
  stats: (s, K) => {
    const list = statsOf(s);
    const cols = list.length === 2 ? 'grid-cols-2' : list.length === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4';
    const cells = list.map((x, i) => `<li class="relative grid content-start gap-2.5 py-1 sm:pl-[clamp(1.25rem,2.5vw,2.25rem)] sm:before:absolute sm:before:inset-y-0 sm:before:left-0 sm:before:w-[2px] sm:before:-skew-x-[14deg] sm:before:bg-white/30" data-k-reveal style="transition-delay:${i * 90}ms"><b class="font-display text-[clamp(2.2rem,1.4rem+2.6vw,3.8rem)] leading-none font-bold tracking-tight text-white" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="max-w-[14rem] text-[.98rem] leading-snug font-medium text-white/85">${esc(x.label)}</span></li>`).join('');
    const pic = s.img ? `<div class="overflow-hidden rounded-[var(--k-r)] ring-4 ring-white/20 [&_img]:size-full [&_img]:max-h-72 [&_img]:object-cover" data-k-reveal="zoom"><div data-k-img>${K.img(s.img, s.imgAlt || '')}</div></div>` : '';
    return `<section class="on-dark relative isolate overflow-hidden bg-primary-700 py-[calc(var(--k-sec-y)*.7)] text-white">${PAT_LIGHT}<div class="${C.WRAP}">${s.title ? `<div class="${C.HEADGAP} grid max-w-3xl gap-4">${X.rule()}${X.h2(s.title)}</div>` : ''}${pic ? `<div class="grid items-center gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[1.6fr_1fr]"><ul class="m-0 grid list-none gap-x-6 gap-y-9 p-0 ${cols.replace('lg:grid-cols-4', '')}">${cells}</ul>${pic}</div>` : `<ul class="m-0 grid list-none gap-x-6 gap-y-9 p-0 ${cols}">${cells}</ul>`}</div></section>`;
  },
  reviewCard: (r, i, cls = '') => `<figure class="${C.CARD} m-0 grid content-between gap-6 p-7 ${cls}" data-k-reveal style="transition-delay:${(i % 3) * 80}ms;${glowAt(i)}"><div class="grid gap-5"><div class="flex items-center gap-4"><span class="${GEM} m-1 size-9 rounded-[.45rem] bg-primary-50 font-display text-[1.6rem] leading-none font-bold text-primary-700 ring-1 ring-primary-200" aria-hidden="true"><span class="translate-y-[.2em]">”</span></span>${stars()}</div><blockquote class="m-0 text-[1.03rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center gap-4 border-t border-primary-100 pt-5"><span class="${GEM} m-1 size-9 rounded-[.45rem] bg-primary-700 font-display text-[.78rem] font-bold text-white"><span>${esc(initialsOf(r.name))}</span></span><span class="grid"><b class="text-primary-950">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-muted">${esc(r.place || r.role)}</small>` : ''}</span></figcaption></figure>`,
  scrollBtn: (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="${GEM} m-2 size-10 rounded-[.5rem] bg-primary-700 text-white transition hover:bg-popbtn">${icon('arrow', dir === 'prev' ? 'size-4 rotate-180' : 'size-4')}</button>`,
  faqRow: (f, i) => `<details class="group k-glow ${C.PLAIN} open:shadow-[0_2px_4px_rgb(15_23_42/.05),0_30px_50px_-30px_color-mix(in_srgb,var(--th-primary-800)_55%,transparent)]"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 50}ms;${glowAt(i)}"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 py-4 pr-5 pl-6 font-display text-[1.08rem] leading-snug font-[var(--k-h-weight)] text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="${GEM} m-1 size-8 rounded-[.4rem] bg-primary-50 text-primary-700 ring-1 ring-primary-200 transition duration-300 group-open:bg-primary-700 group-open:text-white group-open:ring-primary-700 [&>*]:transition [&>*]:duration-300 group-open:[&>*]:rotate-0">${icon('plus', 'size-4')}</span></summary><div class="px-6 pb-6">${answerOf(f.a)}</div></details>`,
  faqRows: (list) => `<div class="grid gap-3">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`,
  // the closing call: a part of the brand's colour with the pattern and the outlines of two large diamonds
  cta: (s, K) => {
    const q = quoteTo(s, K), c = callTo(K);
    const pic = s.img ? `<span class="grid size-[clamp(4.5rem,8vw,6.5rem)] shrink-0 place-items-center rounded-[var(--k-r)] bg-surface p-3 shadow-[0_24px_44px_-20px_rgb(0_0_0/.5)] max-lg:justify-self-start [&_img]:size-full [&_img]:object-contain">${K.img(s.img, s.imgAlt || '')}</span>` : '';
    return `<section class="relative py-[clamp(2.5rem,5vw,4.5rem)]"><div class="${C.WRAP}"><div class="${C.DEEP} rounded-[calc(var(--k-r)*1.6)] px-[clamp(1.5rem,5vw,4.5rem)] py-[clamp(2.5rem,5.5vw,4.5rem)] shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--th-primary-800)_80%,transparent)]" data-k-reveal="zoom">${PAT_LIGHT}${CUTS}<div class="grid items-center gap-8 ${pic ? 'lg:grid-cols-[auto_1.5fr_auto]' : 'lg:grid-cols-[1.5fr_auto]'}">${pic}<div class="grid gap-4">${X.h2(s.title || 'Ready to get started?', 'text-white')}${s.text ? `<p class="max-w-2xl text-[1.08rem] leading-relaxed text-white/85">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap gap-3.5">${btn(q, 'bg-surface text-primary-800 shadow-[0_14px_30px_-12px_rgb(0_0_0/.45)] hover:bg-pop-100', true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></div></div></section>`;
  },
}));
const { WRAP, POP, LINE } = C;
// the bands of a page: white (the first, under the hero's pale ground), then a pale shade of the brand colour with the website's pattern
// in one of its upper corners, in turn
const TONES = { alt: `k-pat k-pat-tr ${PALE}`, tint: `k-pat k-pat-tl ${PALE}`, dark: 'on-dark k-pat k-pat-tr bg-primary-950 text-white [--k-pat-ink:#fff] [--k-pat-o:.07]', brand: 'on-dark k-pat k-pat-tr bg-primary-700 text-white [--k-pat-ink:#fff] [--k-pat-o:.1]', rotation: ['none', 'alt', 'none', 'tint'] };

// ---------- hero ----------
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0 text-[.96rem] font-semibold text-primary-950" data-k-reveal style="transition-delay:260ms">${list.map((t) => `<li class="inline-flex items-center gap-3">${X.check()}${esc(t)}</li>`).join('')}</ul>` : '');
// the picture or the video of a hero in a large diamond: the light of the border travels round it; a diamond of the brand's colour and
// one of the accent colour stand beside it. Without a picture the diamond is the brand's colour with the pattern, and says how to call
const gem = (h, K, size) => {
  const has = Boolean(h.image?.src || h.video?.src), c = callTo(K);
  const inside = has
    ? `<div class="absolute -inset-[21%] isolate -rotate-45 [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover"><div class="${web(K).motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}</div>${videoBg(h).replace('-z-20', '')}</div>`
    : `<${c ? `a href="${esc(c.href)}"` : 'div'} class="group/call absolute -inset-[21%] isolate grid -rotate-45 content-center justify-items-center gap-2 bg-linear-to-br from-primary-500 to-primary-800 text-center text-white">${PAT_LIGHT}${c ? `<span class="grid size-14 place-items-center rounded-[.8rem] bg-white/15 transition duration-300 group-hover/call:scale-110 group-hover/call:bg-popbtn">${icon('phone', 'size-6')}</span><span class="mt-2 text-[.8rem] font-bold tracking-[.14em] text-white/80 uppercase">Call us</span><b class="font-display text-[clamp(1.2rem,1rem+.9vw,1.75rem)] leading-none font-bold">${esc(K.site.phone.display)}</b>` : ''}</${c ? 'a' : 'div'}>`;
  return `<div class="relative mx-auto aspect-square ${size}"><i class="absolute top-[2%] left-[2%] block size-[26%] rotate-45 rounded-[1.1rem] bg-linear-to-br from-primary-600 to-primary-800 shadow-[0_24px_44px_-20px_color-mix(in_srgb,var(--th-primary-900)_70%,transparent)]" data-k-reveal="zoom" style="transition-delay:300ms" aria-hidden="true"></i><i class="absolute right-[3%] bottom-[4%] block size-[19%] rotate-45 rounded-[.9rem] bg-pop-400 shadow-[0_18px_34px_-16px_rgb(0_0_0/.4)]" data-k-reveal="zoom" style="transition-delay:420ms" aria-hidden="true"></i><i class="pointer-events-none absolute top-[5%] right-[7%] block size-[10%] rotate-45 rounded-[.5rem] border-2 border-primary-400" aria-hidden="true"></i><i class="pointer-events-none absolute bottom-[9%] left-[9%] block size-[7%] rotate-45 rounded-[.35rem] border-2 border-pop-400" aria-hidden="true"></i><div class="absolute inset-[15%]" data-k-reveal="zoom" style="transition-delay:120ms"><div class="k-glow absolute inset-0 rotate-45 overflow-hidden rounded-[clamp(1.4rem,3vw,2.4rem)] bg-primary-100 shadow-[0_44px_80px_-36px_color-mix(in_srgb,var(--th-primary-950)_70%,transparent)] [--k-glow-w:4px]">${inside}</div></div>${has && h.video ? vPause('right-[6%] top-[46%]') : ''}</div>`;
};
// the figures of the business: a ruled row under the words and the picture, set apart by slanted lines
const ledger = (K) => {
  const list = factsOf(K).slice(0, 4);
  return list.length ? `<dl class="m-0 grid ${['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-2 sm:grid-cols-3', 'grid-cols-2 lg:grid-cols-4'][list.length]} gap-y-5 border-t-2 border-primary-200 py-[clamp(1.1rem,2.2vw,1.6rem)]" data-k-reveal style="transition-delay:340ms">${list.map((x, i) => `<div class="relative flex items-center gap-3.5 ${i ? 'sm:pl-[clamp(1rem,2.4vw,2.25rem)] sm:before:absolute sm:before:inset-y-0 sm:before:left-0 sm:before:w-[2px] sm:before:-skew-x-[14deg] sm:before:bg-primary-200' : ''} pr-3"><dt class="order-last max-w-[11rem] text-[.86rem] leading-snug font-semibold text-secondary">${esc(x.label)}</dt><dd class="m-0 font-display text-[clamp(1.8rem,1.3rem+1.5vw,2.6rem)] leading-none font-bold tracking-tight text-primary-800" data-count="${esc(x.value)}">${esc(x.value)}</dd></div>`).join('')}</dl>` : '';
};
// the links the old hero offered: a band of the brand's colour across the foot of the hero, each link beside its own picture on a diamond
const quick = (h, K) => {
  const list = h.cards?.items || [];
  if (!list.length) return '';
  const pics = list.some((c) => c.img);
  const link = (c) => {
    const label = c.text || c.title || c.label || '';
    const inner = pics
      ? `<span class="${GEM} m-1.5 size-10 rounded-[.55rem] ${K.dims?.[c.img]?.light ? 'bg-white/15 ring-1 ring-white/30' : 'bg-white'} shadow-[0_12px_24px_-12px_rgb(0_0_0/.55)] transition duration-300 group-hover/q:-translate-y-1 [&_img]:size-6 [&_img]:object-contain">${c.img ? K.img(c.img, c.imgAlt || '') : icon('arrow', 'size-4 text-primary-700')}</span><span>${esc(label)}</span>`
      : `<i class="block size-2 shrink-0 rotate-45 bg-pop-300"></i>${esc(label)}`;
    const cls = 'group/q flex items-center gap-3 text-[.86rem] leading-tight font-bold text-white transition duration-300 hover:text-pop-200';
    return `<li>${c.href ? `<a class="${cls}" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`;
  };
  return `<div class="on-dark relative isolate overflow-hidden bg-primary-700 text-white">${PAT_LIGHT}<div class="${WRAP} grid items-center gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-5 py-[clamp(1.25rem,2.6vw,2rem)] ${h.cards.title ? 'lg:grid-cols-[minmax(0,13rem)_1fr]' : ''}" data-k-reveal style="transition-delay:380ms">${h.cards.title ? `<p class="m-0 font-display text-[clamp(1.15rem,1rem+.6vw,1.45rem)] leading-tight font-[var(--k-h-weight)] text-white">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 grid list-none grid-cols-2 gap-x-5 gap-y-4 p-0 sm:grid-cols-3 lg:grid-cols-4">${list.map(link).join('')}</ul></div></div>`;
};

const hero = {
  // the home page: the words on the patterned ground; beside them the picture or the video in its diamond; the figures of the business
  // in a ruled row under both; the website's quick links across the foot
  'fc-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.1rem,1.1rem+3.1vw,3.7rem)] leading-[1.06]' : 'text-[clamp(2.6rem,1.2rem+4.8vw,5rem)] leading-[1.03]';
    return `<section class="k-pat k-pat-tl relative isolate overflow-hidden [--k-pat-o:.2] ${PALE}"><div class="${WRAP}"><div class="grid items-center gap-[clamp(2rem,4vw,4rem)] pt-[clamp(2.5rem,5.5vw,4.75rem)] pb-[clamp(2rem,4vw,3.25rem)] lg:min-h-[clamp(28rem,40vw,38rem)] lg:grid-cols-[1.1fr_.9fr]"><div class="grid justify-items-start gap-6">${X.eyebrow(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-2xl text-[clamp(1.06rem,1rem+.35vw,1.25rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3" data-k-reveal style="transition-delay:180ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, LINE, false, true) : ''}</div>${bullets(h.bullets)}</div>${gem(h, K, 'w-[min(88%,31rem)]')}</div>${ledger(K)}</div>${quick(h, K)}</section>`;
  },
  // an inner page: the trail, the title and the page's actions on the patterned ground; beside them the page's picture or video in a
  // small diamond, or the diamonds alone
  'fc-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-primary-950">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-primary-700" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<i class="block size-1.5 rotate-45 bg-pop-500" aria-hidden="true"></i>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(1.9rem,1.1rem+2.6vw,3.1rem)]' : 'text-[clamp(2.3rem,1.2rem+3.6vw,3.9rem)]';
    const has = Boolean(h.image?.src || h.video?.src);
    const side = has ? gem(h, K, 'w-[min(70%,18rem)] max-lg:my-2') : '<div class="pointer-events-none relative mx-auto aspect-square w-[14rem] max-lg:hidden" aria-hidden="true"><i class="absolute inset-[18%] block rotate-45 rounded-[1.4rem] bg-linear-to-br from-primary-600 to-primary-800 shadow-[0_30px_50px_-26px_color-mix(in_srgb,var(--th-primary-900)_70%,transparent)]"></i><i class="absolute top-[4%] right-[6%] block size-[24%] rotate-45 rounded-[.7rem] bg-pop-400"></i><i class="absolute bottom-[6%] left-[4%] block size-[17%] rotate-45 rounded-[.5rem] border-2 border-primary-400"></i></div>';
    return `<section class="k-pat k-pat-tl relative isolate overflow-hidden [--k-pat-o:.2] ${PALE}"><div class="${WRAP} grid items-center gap-[clamp(2rem,4vw,4rem)] py-[clamp(2.25rem,4.5vw,3.75rem)] lg:grid-cols-[1fr_auto]"><div class="grid justify-items-start gap-5"><nav class="flex flex-wrap items-center gap-3 text-[.86rem] font-semibold text-secondary" aria-label="Breadcrumb">${crumbs}</nav><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3" data-k-reveal style="transition-delay:180ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${X.callBtn(K, LINE)}</div></div><div class="lg:w-[19rem]">${side}</div></div></section>`;
  },
};

// ---------- header and footer ----------
const logo = (K, dark = false) => `<a class="inline-flex items-center gap-3.5 font-display text-[1.3rem] leading-none font-bold tracking-tight ${dark ? 'text-white' : 'text-primary-950'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto ${dark ? 'max-h-24' : 'max-h-12'} w-auto" src="${esc(K.u((dark && K.site.footerLogo) || K.site.logo))}" alt="${esc(K.site.name)}"${dark ? ' loading="lazy"' : ''}>` : `<span class="${GEM} m-1 size-8 rounded-[.45rem] bg-primary-700 text-[.95rem] text-white"><span>${esc(String(K.site.name || '?').trim()[0] || '?')}</span></span><span>${esc(K.site.name)}</span>`}</a>`;
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 px-3 py-2 text-[.95rem] font-semibold whitespace-nowrap text-primary-950 transition duration-300 hover:text-primary-700 aria-[current]:text-primary-700 aria-[current]:shadow-[inset_0_-2px_0_var(--th-primary-600)]',
  panel: `${PANEL} p-2.5`,
  item: 'flex items-center justify-between gap-3 rounded-[.4rem] px-3.5 py-2.5 text-[.93rem] font-semibold text-primary-950 transition hover:bg-primary-50 hover:text-primary-700',
  more: 'rounded-[.4rem] bg-primary-50 text-primary-700 hover:bg-primary-100',
};
// the line over the header: what the website announces (else its hours, else its address) and its phone, on the brand's colour
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-bold text-white transition hover:text-pop-200" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-pop-300')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `<i class="block size-1.5 shrink-0 rotate-45 bg-pop-300"></i>${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="on-dark bg-primary-800 text-white/90"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[.82rem] font-semibold max-sm:justify-center"><span class="inline-flex items-center gap-2.5 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  // a white bar across the page that stays at its head, a line of the brand's colour under it: the logo, the menu, the action
  fc: (K) => `${strip(K)}<header class="sticky top-0 z-50 border-b-2 border-primary-700 bg-white/95 backdrop-blur-md transition duration-300 data-[scrolled]:shadow-[0_14px_34px_-22px_color-mix(in_srgb,var(--th-primary-950)_55%,transparent)]" data-k-header><div class="${WRAP} flex items-center gap-[clamp(1rem,2.5vw,2.5rem)] py-3" data-p="bar">${logo(K)}<nav class="ml-auto flex items-center gap-1 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, true)}</span><button class="ml-auto grid size-11 place-items-center rounded-[.5rem] bg-primary-700 text-white transition hover:bg-primary-800 lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // the website's own footer on the brand's deepest shade, with the pattern and the outlines of two large diamonds
  fc: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-5 flex items-center gap-3 text-[.76rem] font-bold tracking-[.18em] text-white uppercase before:block before:size-2 before:rotate-45 before:bg-pop-400', li = 'transition hover:text-white';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2.5 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-11 place-items-center rounded-[.5rem] bg-white/10 transition duration-300 hover:-translate-y-1 hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-[.5rem] bg-white/10 px-4 py-2 text-[.84rem] font-semibold text-white transition hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-2.5 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} font-bold text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.3fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="on-dark relative isolate overflow-hidden border-t-4 border-pop-500 bg-primary-950 pt-[clamp(3.5rem,7vw,5.5rem)] text-white/70 max-sm:pb-20"><i class="k-pat-layer k-pat-tl [--k-pat-ink:#fff] [--k-pat-o:.07]" aria-hidden="true"></i>${CUTS.replace('top-1/2', 'top-[70%]').replace('top-1/2', 'top-[70%]')}<div class="${WRAP}"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/12 py-6 text-[.88rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-[.4rem] bg-white/10 px-3.5 py-1.5 text-[.72rem] font-bold tracking-[.1em] uppercase transition hover:bg-white/20">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'fc-');
export const FACET = {
  design: {
    id: 'facet', name: 'Facet', badge: 'Cut like a stone', blurb: 'A hero on a pale ground that carries the pattern of the business: the picture or the video in a large diamond with the light of its border travelling round it, a diamond of the brand colour and one of the accent colour beside it, and the figures of the business in a ruled row. Cards carry the gradient border and its light and a small corner of the brand colour; icons and numbers stand on diamonds, pictures between corner brackets. What comes into view comes in leaning and straightens.',
    fonts: { heading: 'Space Grotesk', body: 'IBM Plex Sans' }, vars: { '--k-r': '.55rem', '--k-r-btn': '.45rem', '--k-h-weight': '700', '--k-h-track': '-.03em' },
    header: 'fc', footer: 'fc', offered: true, anim: 'shear', patterned: true, ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
