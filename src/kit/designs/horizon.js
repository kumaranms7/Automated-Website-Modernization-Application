import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, num, statsOf, groupsOf, introHtml, answerOf } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays } from './base.js';
import { stars } from '../ui.js';

// HORIZON: editorial and calm. A serif for the headings, a pale ground of the brand colour in turn with white, hairlines instead of boxes: lists are rows,
// topics are columns under a rule, figures stand in a row of large numerals. Photographs carry a thin outline set off their corner and the
// hero shows its picture under an arch. What comes into view is uncovered like a page being turned up (the "unfold" motion of the
// stylesheet). Its colours are the website's theme; the footer is light. Layout names start with hz-.

const SAND = 'bg-[color-mix(in_srgb,var(--th-primary-50)_72%,var(--th-bg))]';
const FLAT = 'relative rounded-[var(--k-r)] border border-primary-950/10 bg-surface transition duration-300';
const RING = 'before:pointer-events-none before:absolute before:-top-44 before:-right-44 before:-z-10 before:size-[38rem] before:rounded-full before:border before:border-primary-900/10 after:pointer-events-none after:absolute after:-top-20 after:-right-20 after:-z-10 after:size-[23rem] after:rounded-full after:border after:border-primary-900/10';

const { X, C } = sections({
  H2: 'font-display text-[clamp(2rem,1.2rem+2.8vw,3.5rem)] leading-[1.08] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950 on-dark:text-white',
  H2S: 'font-display text-[clamp(1.45rem,1.15rem+1.2vw,2.1rem)] leading-[1.2] font-[var(--k-h-weight)] tracking-[-.015em] [text-transform:var(--k-h-case)] text-balance text-primary-950 on-dark:text-white',
  H3: 'font-display text-[clamp(1.2rem,1.05rem+.55vw,1.5rem)] leading-snug font-[var(--k-h-weight)] tracking-[-.01em] [text-transform:var(--k-h-case)] text-primary-950 on-dark:text-white',
  SHADOW: '', PLAIN: FLAT, CARD: `k-edge ${FLAT}`,
  LIFT: 'hover:border-primary-950/25 hover:shadow-[0_26px_50px_-30px_rgb(15_23_42/.4)]',
  TILE: 'grid size-12 shrink-0 place-items-center rounded-[calc(var(--k-r)*.8)] border border-primary-200 bg-surface text-primary-800 transition duration-300',
  POP: 'bg-popbtn text-white hover:brightness-110',
  BRAND: 'bg-primary-900 text-white hover:bg-primary-800',
  LINE: 'border-primary-950/25 bg-transparent text-primary-950 hover:border-primary-950 hover:bg-primary-950 hover:text-white',
  GLASSBTN: 'border-white/40 bg-transparent text-white hover:border-white hover:bg-white hover:text-primary-950',
  SEC: 'relative py-[calc(var(--k-sec-y)*.9)]',
  GAP: 'gap-[clamp(1.25rem,2.5vw,2rem)]',
  PICSHADOW: '',
  DEEP: 'on-dark relative isolate overflow-hidden bg-primary-900 text-white before:pointer-events-none before:absolute before:-top-48 before:-right-48 before:-z-10 before:size-[40rem] before:rounded-full before:border before:border-white/10 after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:-z-10 after:size-[26rem] after:rounded-full after:border after:border-white/10',
  TONE: 'text-pop-600 on-dark:text-pop-300',
  NUM: 'font-display text-[1.7rem] leading-none text-pop-500',
}, (X, C) => {
  const baseTopics = X.topics;
  return {
    eyebrow: (t) => (t ? `<span class="inline-flex items-center gap-3.5 text-[.76rem] font-semibold tracking-[.22em] text-primary-800 uppercase on-dark:text-white/80"><i class="block h-px w-10 bg-current" data-k-line></i>${esc(t)}</span>` : ''),
    rule: () => '<i class="block h-px w-16 bg-primary-900 on-dark:bg-white/60" data-k-line></i>',
    check: (cls = 'border-primary-700 text-primary-700') => `<span class="mt-0.5 grid size-[1.35rem] shrink-0 place-items-center rounded-full border ${cls}">${icon('check', 'size-3 stroke-[3]')}</span>`,
    // a list: rows under hairlines, no box
    checklist: (list, cols = '') => `<ul class="m-0 grid list-none gap-x-12 border-t border-primary-950/15 p-0 on-dark:border-white/20 ${cols}">${list.map((t) => `<li class="flex items-start gap-3.5 border-b border-primary-950/10 py-3.5 leading-snug font-medium text-primary-950 on-dark:border-white/15 on-dark:text-white">${X.check()}<span>${esc(typeof t === 'string' ? t : t.title || t.text || '')}</span></li>`).join('')}</ul>`,
    listPanel: (lines, cols) => `<div data-k-reveal>${X.checklist(lines, cols)}</div>`,
    arrowLink: (label) => `<span class="mt-auto inline-flex items-center gap-2 pt-1 text-[.93rem] font-semibold text-primary-900 underline decoration-pop-400 decoration-2 underline-offset-[6px]">${esc(label)}${icon('arrow', 'size-4 transition duration-300 group-hover/card:translate-x-1.5')}</span>`,
    // a photograph: square-shouldered, with a thin outline set off its corner
    photo: (K, src, alt, { side = '', cls = '' } = {}) => `<div class="relative ${side === 'right' ? 'ml-4' : 'mr-4'} mb-4 ${cls}" data-k-reveal="${side || 'up'}"><div class="absolute inset-0 ${side === 'right' ? '-translate-x-4' : 'translate-x-4'} translate-y-4 rounded-[var(--k-r)] border border-primary-900/25"></div><div class="relative overflow-hidden rounded-[var(--k-r)] bg-primary-50 [&_img]:h-auto [&_img]:max-h-[36rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div>`,
    mark: (K, src, alt, cls = '') => `<div class="grid w-fit place-items-center rounded-[var(--k-r)] border border-primary-950/10 bg-surface p-[clamp(1.25rem,3vw,2.25rem)] [&_img]:h-auto [&_img]:max-h-56 [&_img]:max-w-full ${cls}" data-k-reveal>${K.img(src, alt || '')}</div>`,

    // cards: with pictures they are open (a picture, a number, a heading, a line and a link, no box); without, flat boxes
    cards: (s, K) => {
      const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
      const hasPics = list.some((c) => c.img);
      const Hn = s.title ? 'h3' : 'h2';
      const cell = (c, i) => {
        const label = c.title || c.text || c.label || '';
        const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
        const more = c.href ? X.arrowLink(c.cta || 'Learn more') : '';
        const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
        if (!c.img) return X.shell(`${X.tile(K, { ...c, photo: true }, i) || X.numMark(i)}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}`, { href: c.href, i, cls: 'grid content-start gap-3.5 p-[clamp(1.4rem,2.5vw,2rem)]', step: 60 });
        const inner = `<div class="relative"><div class="aspect-[4/3] overflow-hidden rounded-[var(--k-r)] bg-primary-50 [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-[900ms] group-hover/card:[&_img]:scale-[1.07]">${K.img(c.img, c.imgAlt || label)}</div>${ownIcon ? `<span class="absolute right-4 -bottom-5 grid size-12 place-items-center rounded-[calc(var(--k-r)*.8)] ${K.dims?.[ownIcon]?.light ? 'bg-primary-800' : 'border border-primary-950/10 bg-surface'} [&_img]:size-7 [&_img]:object-contain">${K.img(ownIcon, '')}</span>` : ''}</div><div class="mt-6 grid flex-1 content-start gap-2.5"><div class="flex items-baseline gap-3 border-t border-primary-950/15 pt-4 transition duration-300 group-hover/card:border-primary-900"><span class="font-display text-[1rem] text-pop-600">${num(i)}</span><${Hn} class="${C.H3}">${esc(label)}</${Hn}></div>${sub}${more}</div>`;
        const more2 = `data-k-reveal style="transition-delay:${(i % 3) * 60}ms"`;
        return c.href ? `<a class="group/card flex flex-col" href="${esc(c.href)}" ${more2}>${inner}</a>` : `<div class="group/card flex flex-col" ${more2}>${inner}</div>`;
      };
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: !s.small && !hasPics })}<div class="grid ${hasPics ? 'gap-x-[clamp(1.5rem,3vw,2.5rem)] gap-y-12' : C.GAP} ${X.colsOf(list.length, { small: s.small, pics: hasPics })}">${list.map((c, i) => cell(c, i)).join('')}</div></div></section>`;
    },
    // a point with a line of its own: under a rule, no box
    featureCard: (K, x, i, Hn) => `<div class="grid content-start gap-3 border-t-2 border-primary-900 pt-5" data-k-reveal style="transition-delay:${(i % 3) * 60}ms">${X.tile(K, x, i, 'benefits') || X.numMark(i)}<${Hn} class="${C.H3}">${esc(x.title)}</${Hn}>${x.text ? `<p class="${C.P} text-[.97rem]">${esc(x.text)}</p>` : ''}</div>`,
    // two or three topics: columns under a rule
    topics: (sh, K) => {
      if (X.topicRows(sh)) return baseTopics(sh, K);
      const Hn = sh.s.title ? 'h3' : 'h2';
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.topicsHead(sh)}<div class="grid gap-x-[clamp(2rem,4vw,4rem)] gap-y-10 ${sh.topics.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}">${sh.topics.map((t, i) => `<article class="grid content-start gap-4 border-t-2 border-primary-900 pt-6" data-k-reveal style="transition-delay:${i * 60}ms"><span class="${C.NUM}">${num(i)}</span><${Hn} class="${C.H3} text-[clamp(1.35rem,1.1rem+.9vw,1.75rem)]">${esc(t.title)}</${Hn}>${X.flowOf(t.blocks, K)}</article>`).join('')}</div></div></section>`;
    },
    // steps: a row under one line, a large numeral each
    steps: (s, K) => {
      const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
      const Hn = s.title || !K.real ? 'h3' : 'h2';
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="m-0 grid list-none gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))]">${list.map((t, i) => `<li class="relative grid content-start gap-3 border-t-2 border-primary-900 pt-6 before:absolute before:-top-[7px] before:left-0 before:size-3 before:rounded-full before:bg-pop-500" data-k-reveal style="transition-delay:${i * 60}ms"><span class="font-display text-[3.4rem] leading-none text-pop-500">${num(i)}</span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
    },
    // figures: a row of large numerals between hairlines, on the page's own ground
    stats: (s, K) => {
      const list = statsOf(s);
      const figures = `<dl class="m-0 grid gap-y-10 sm:grid-cols-2 ${s.img ? 'lg:grid-cols-3' : 'lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]'}">${list.map((x, i) => `<div class="grid gap-3 border-l border-primary-950/15 pl-[clamp(1rem,2vw,2rem)]" data-k-reveal style="transition-delay:${i * 60}ms"><dd class="order-first m-0 font-display text-[clamp(2.6rem,1.6rem+3vw,4.4rem)] leading-none font-[var(--k-h-weight)] text-primary-950" data-count="${esc(x.value)}">${esc(x.value)}</dd><dt class="text-[.8rem] leading-snug font-semibold tracking-[.14em] text-primary-800 uppercase">${esc(x.label)}</dt></div>`).join('')}</dl>`;
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${s.title ? `<div class="${C.HEADGAP} grid max-w-3xl gap-4">${X.rule()}${X.h2(s.title)}</div>` : ''}${s.img ? `<div class="grid items-center gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[1.4fr_1fr]">${figures}${X.photo(K, s.img, s.imgAlt || '', { side: 'right' })}</div>` : figures}</div></section>`;
    },
    reviewCard: (r, i, cls = '') => `<figure class="${C.PLAIN} m-0 grid content-between gap-7 p-[clamp(1.5rem,3vw,2.25rem)] ${cls}" data-k-reveal style="transition-delay:${(i % 3) * 60}ms"><div class="grid gap-5"><span class="font-display text-[4rem] leading-[.6] text-pop-500" aria-hidden="true">“</span><blockquote class="m-0 font-display text-[1.14rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center justify-between gap-4 border-t border-primary-950/15 pt-5"><span class="grid"><b class="text-[.8rem] tracking-[.14em] text-primary-950 uppercase">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="mt-1 text-muted">${esc(r.place || r.role)}</small>` : ''}</span>${stars()}</figcaption></figure>`,
    scrollBtn: (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="grid size-12 place-items-center rounded-full border border-primary-950/25 text-primary-950 transition hover:border-primary-900 hover:bg-primary-900 hover:text-white">${icon('arrow', dir === 'prev' ? 'size-5 rotate-180' : 'size-5')}</button>`,
    // questions: rows between hairlines
    faqRow: (f, i) => `<details class="group border-b border-primary-950/15"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 40}ms"><summary class="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-[1.2rem] leading-snug font-[var(--k-h-weight)] text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="grid size-9 shrink-0 place-items-center rounded-full border border-primary-950/25 text-primary-950 transition duration-300 group-open:rotate-45 group-open:border-primary-900 group-open:bg-primary-900 group-open:text-white">${icon('plus', 'size-4')}</span></summary><div class="pr-12 pb-6">${answerOf(f.a)}</div></details>`,
    faqRows: (list) => `<div class="border-t border-primary-950/15">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`,
    // the places served: lists under a rule, an arrow that appears under the pointer
    areas: (s, K) => {
      const groups = groupsOf(s).filter((g) => (g.links || []).length);
      const one = groups.length === 1;
      const title = s.title || (one ? groups[0].title : '');
      const Hn = title ? 'h3' : 'h2';
      const place = (l) => { const cls = 'group/a flex items-center justify-between gap-3 border-b border-primary-950/10 py-2.5 text-[.97rem] font-medium text-primary-950 transition duration-300'; return l.href ? `<a class="${cls} hover:border-primary-900 hover:pl-1.5 hover:text-pop-600" href="${esc(l.href)}"><span>${esc(l.text)}</span>${icon('arrow', 'size-3.5 shrink-0 -translate-x-1 opacity-0 transition duration-300 group-hover/a:translate-x-0 group-hover/a:opacity-100')}</a>` : `<span class="${cls}">${esc(l.text)}</span>`; };
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top({ ...s, title }, K, { word: 'Service areas', lead: s.lead ? `<p>${esc(s.lead)}</p>` : '' })}<div class="grid gap-x-[clamp(2rem,5vw,5rem)] gap-y-12 ${one ? '' : 'lg:grid-cols-2'}">${groups.map((g, i) => `<div class="grid content-start gap-4" data-k-reveal style="transition-delay:${i * 60}ms">${g.title && !one ? `<${Hn} class="${C.H3} border-b-2 border-primary-900 pb-4">${esc(g.title)}</${Hn}>` : ''}<ul class="m-0 grid list-none gap-x-8 p-0 ${one ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}">${g.links.map((l) => `<li>${place(l)}</li>`).join('')}</ul></div>`).join('')}</div></div></section>`;
    },
    // the closing call: a band of the brand's colour across the whole page
    cta: (s, K) => {
      const q = quoteTo(s, K), c = callTo(K);
      const pic = X.ctaPic(s, K);
      return `<section class="${C.DEEP} py-[clamp(3.5rem,7vw,6rem)]"><div class="${C.WRAP} grid items-center gap-[clamp(2rem,4vw,4rem)] ${pic ? 'lg:grid-cols-[auto_1.4fr_auto]' : 'lg:grid-cols-[1.4fr_auto]'}">${pic}<div class="grid gap-5">${X.rule()}${X.h2(s.title || 'Ready to get started?', 'text-white', 'text-pop-300')}${s.text ? `<p class="max-w-2xl text-[1.08rem] leading-relaxed text-white/80">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap gap-3.5 lg:flex-col" data-k-reveal="right">${btn(q, C.POP, true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></section>`;
    },
    // a banner line: a flat bar with a stroke of the accent colour down its side
    callout: (s, K) => {
      const { say, act } = X.calloutParts(s, K, C.BRAND);
      return `<section class="k-same relative py-[clamp(1.25rem,3vw,2rem)]"><div class="${C.WRAP}"><div class="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[var(--k-r)] border border-l-4 border-primary-950/10 border-l-pop-500 bg-surface px-[clamp(1.25rem,3vw,2.5rem)] py-[clamp(1.1rem,2.5vw,1.6rem)]" data-k-reveal><p class="m-0 font-display text-[clamp(1.2rem,1.05rem+.7vw,1.6rem)] leading-snug font-[var(--k-h-weight)] text-primary-950">${esc(say)}</p>${act.replace('text-white/85', 'text-primary-900')}</div></div></section>`;
    },
    // one way to reach the business: a row between hairlines
    wayRow: (K, c, i) => { const href = X.wayHref(c); const inner = `${X.wayMark(K, c)}<span class="grid gap-1"><b class="text-[.76rem] font-semibold tracking-[.16em] text-primary-800 uppercase">${esc(c.label)}</b><span class="font-display text-[1.15rem] leading-snug text-primary-950 transition duration-300 group-hover/card:text-pop-600">${esc(c.value)}</span></span>`; const cls = 'group/card flex items-center gap-5 border-b border-primary-950/15 py-4'; return `<li data-k-reveal style="transition-delay:${i * 60}ms">${href ? `<a class="${cls}" href="${esc(href)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`}</li>`; },
  };
});
const { WRAP, POP, LINE } = C;
// the bands of a page: white, then the pale ground, in turn
const TONES = { alt: SAND, tint: SAND, dark: 'bg-primary-900 text-white on-dark', brand: 'bg-primary-800 text-white on-dark', rotation: ['alt', 'none'] };

// ---------- hero ----------
const bullets = (list) => (list?.length ? `<ul class="m-0 grid list-none gap-2.5 p-0 text-[.98rem] font-medium text-primary-950">${list.map((t) => `<li class="flex items-start gap-3">${X.check()}${esc(t)}</li>`).join('')}</ul>` : '');
// the picture or the video of the hero, under an arch, a thin outline set off it
function arch(h, K) {
  if (!h.image?.src && !h.video?.src) return '';
  const f = factsOf(K)[0];
  const fact = f ? `<div class="absolute bottom-10 -left-3 grid gap-1.5 rounded-[var(--k-r)] border border-primary-950/10 bg-surface px-6 py-5 shadow-[0_30px_60px_-30px_rgb(15_23_42/.55)] sm:-left-10" data-k-reveal style="transition-delay:350ms"><b class="font-display text-[2.5rem] leading-none font-[var(--k-h-weight)] text-primary-950" data-count="${esc(f.value)}">${esc(f.value)}</b><span class="max-w-[16ch] text-[.74rem] leading-snug font-semibold tracking-[.14em] text-primary-800 uppercase">${esc(f.label)}</span></div>` : '';
  return `<div class="relative mx-auto mr-5 mb-5 w-full max-w-[30rem] lg:mr-5 lg:ml-auto" data-k-reveal="right"><div class="absolute inset-0 translate-x-5 translate-y-5 rounded-t-[999px] rounded-b-[var(--k-r)] border border-primary-900/30"></div><div class="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[var(--k-r)] bg-primary-100 [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover" data-k-img><div class="${web(K).motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}</div>${videoBg(h).replace('-z-20', '')}${h.video ? vPause('right-4 bottom-4') : ''}</div>${fact}</div>`;
}
// the links the old hero offered: a row of them on a flat bar under the words
const quick = (h, K) => (h.cards?.items?.length ? `<div class="${WRAP} relative pb-[clamp(3.5rem,7vw,6rem)]"><div class="rounded-[var(--k-r)] border border-primary-950/10 bg-surface p-[clamp(1rem,2vw,1.6rem)] shadow-[0_30px_60px_-36px_rgb(15_23_42/.45)]" data-k-reveal style="transition-delay:300ms">${h.cards.title ? `<p class="mb-4 font-display text-[1.2rem] leading-tight font-[var(--k-h-weight)] text-primary-950">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 grid list-none grid-cols-2 gap-1.5 p-0 sm:grid-cols-4 lg:grid-cols-8">${h.cards.items.map((c) => { const label = c.text || c.title || c.label || ''; const inner = `${c.img ? `<span class="grid size-11 place-items-center [&_img]:size-full [&_img]:object-contain">${K.img(c.img, c.imgAlt || '')}</span>` : ''}<span>${esc(label)}</span>`; const cls = 'grid h-full content-start justify-items-center gap-2 rounded-[calc(var(--k-r)*.8)] px-2 py-3 text-center text-[.8rem] leading-tight font-semibold text-primary-950 transition duration-300'; return `<li>${c.href ? `<a class="${cls} hover:-translate-y-0.5 hover:bg-primary-50 hover:text-primary-800" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`; }).join('')}</ul></div></div>` : '');

const hero = {
  // the home page: the words on the left on the pale ground, the picture or the video under an arch on the right
  'hz-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const media = arch(h, K), row = quick(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.3rem,1.2rem+3.4vw,4rem)] leading-[1.06]' : 'text-[clamp(2.9rem,1.3rem+5vw,5.4rem)] leading-[1.02]';
    return `<section class="relative isolate overflow-hidden ${SAND} ${RING}"><div class="${WRAP} grid items-center gap-[clamp(2.5rem,5vw,5rem)] pt-[clamp(3rem,6vw,5.5rem)] ${row ? 'pb-[clamp(2.5rem,5vw,4rem)]' : 'pb-[clamp(4.5rem,9vw,7.5rem)]'} ${media ? 'lg:grid-cols-[1.1fr_.9fr]' : ''}"><div class="grid justify-items-start gap-6 ${media ? '' : 'max-w-4xl'}">${X.eyebrow(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-xl text-[clamp(1.08rem,1rem+.4vw,1.28rem)] leading-relaxed text-secondary [&_a]:text-primary-800 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, LINE, false, true) : ''}</div><div data-k-reveal style="transition-delay:300ms">${bullets(h.bullets)}</div></div>${media}</div>${row}</section>`;
  },
  // an inner page: the trail, the title and the page's actions on the pale ground; the page's picture or video as a wide band under them
  'hz-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-primary-950">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-pop-600" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<span aria-hidden="true" class="text-primary-950/30">—</span>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(2rem,1.2rem+2.6vw,3.2rem)]' : 'text-[clamp(2.4rem,1.3rem+3.8vw,4.3rem)]';
    const media = h.image?.src || h.video?.src ? `<div class="relative mt-[clamp(2rem,4vw,3.25rem)] aspect-[21/8] overflow-hidden rounded-[var(--k-r)] bg-primary-100 [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover" data-k-img>${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}${videoBg(h).replace('-z-20', '')}${h.video ? vPause('right-4 bottom-4') : ''}</div>` : '<i class="mt-[clamp(2rem,4vw,3rem)] block h-px w-full bg-primary-950/15" data-k-line></i>';
    return `<section class="relative isolate overflow-hidden ${SAND} ${RING}"><div class="${WRAP} pt-[clamp(2.5rem,5vw,4.25rem)] pb-[clamp(2.5rem,5vw,4rem)]"><nav class="mb-7 flex flex-wrap items-center gap-2.5 text-[.78rem] font-semibold tracking-[.12em] text-primary-800/80 uppercase" aria-label="Breadcrumb">${crumbs}</nav><div class="grid items-end gap-x-12 gap-y-7 lg:grid-cols-[minmax(0,1.5fr)_auto]"><div class="grid gap-5"><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-secondary [&_a]:text-primary-800 [&_a]:underline')}</div><div class="flex flex-wrap gap-3.5 lg:pb-2" data-k-reveal="right" style="transition-delay:250ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${X.callBtn(K, LINE)}</div></div>${media}</div></section>`;
  },
};

// ---------- header and footer ----------
const logo = (K) => `<a class="inline-flex items-center gap-3 font-display text-[1.45rem] leading-none font-[var(--k-h-weight)] tracking-tight text-primary-950" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto max-h-14 w-auto" src="${esc(K.u(K.site.logo))}" alt="${esc(K.site.name)}">` : `<span class="grid size-10 place-items-center rounded-full border border-primary-900 text-[1.1rem] text-primary-900">${esc(String(K.site.name || '?').trim()[0] || '?')}</span><span>${esc(K.site.name)}</span>`}</a>`;
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 px-3 py-2 text-[.95rem] font-medium whitespace-nowrap text-primary-950 transition after:absolute after:inset-x-3 after:bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-pop-500 after:transition after:duration-300 hover:text-pop-600 hover:after:scale-x-100 aria-[current]:after:scale-x-100',
  panel: 'rounded-[var(--k-r)] border border-primary-950/10 bg-surface p-2 shadow-[0_30px_60px_-28px_rgb(15_23_42/.45)]',
  item: 'flex items-center justify-between gap-3 rounded-[calc(var(--k-r)*.7)] px-3.5 py-2.5 text-[.93rem] font-medium text-primary-950 transition hover:bg-primary-50 hover:text-primary-800',
  more: 'rounded-[calc(var(--k-r)*.7)] bg-primary-50 text-primary-800 hover:bg-primary-100',
};
// the strip over the header: what the website says first (an announcement, its hours or its address) and its phone, on the pale ground
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-semibold text-primary-950 transition hover:text-pop-600" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-pop-600')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `${say.icon ? icon(say.icon, 'size-3.5 text-pop-600') : ''}${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="border-b border-primary-950/10 ${SAND} text-primary-900"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[.82rem] font-medium max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  hz: (K) => `${strip(K)}<header class="sticky top-0 z-50 border-b border-primary-950/10 bg-paper/95 backdrop-blur-md transition duration-300 data-[scrolled]:shadow-[0_14px_30px_-22px_rgb(15_23_42/.5)]" data-k-header><div class="${WRAP} flex items-center gap-5 py-3.5" data-p="bar">${logo(K)}<nav class="ml-auto flex items-center gap-0.5 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, false)}</span><button class="ml-auto grid size-11 place-items-center rounded-[var(--k-r)] border border-primary-950/20 text-primary-950 lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // a light footer: the website's columns of links under hairlines, its seal and its social pages on chips of the brand's colour (they were
  // drawn for a dark ground), a closing bar of the brand's colour with the legal pages
  hz: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-5 border-b border-primary-950/15 pb-3 font-display text-[1.12rem] font-[var(--k-h-weight)] text-primary-950', li = 'transition hover:text-pop-600';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-10 place-items-center rounded-full bg-primary-900 transition duration-300 hover:-translate-y-0.5 hover:bg-pop-600" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.05rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="17" height="17" loading="lazy"></a>` : `<a class="inline-flex rounded-full border border-primary-950/20 px-3.5 py-1.5 text-[.82rem] font-semibold text-primary-950 transition hover:border-primary-900 hover:bg-primary-900 hover:text-white" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 w-fit rounded-[var(--k-r)] bg-primary-900 p-3 [&_a]:block [&_img]:h-auto [&_img]:max-h-12 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-2.5 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-600')}<a class="${li} font-semibold text-primary-950" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-600')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-600')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-600')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-600')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.3fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="border-t border-primary-950/10 ${SAND} pt-[clamp(3.5rem,7vw,5.5rem)] text-secondary"><div class="${WRAP} pb-[clamp(2.5rem,5vw,4rem)]"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div></div><div class="on-dark bg-primary-900 text-white/75 max-sm:pb-20"><div class="${WRAP} flex flex-wrap items-center justify-between gap-4 py-5 text-[.86rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-[var(--k-r-btn)] border border-white/30 px-3.5 py-1.5 text-[.72rem] font-bold tracking-[.12em] uppercase transition hover:bg-white/10">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'hz-');
export const HORIZON = {
  design: {
    id: 'horizon', name: 'Horizon', badge: 'Editorial & calm', blurb: 'A serif for the headings, a pale ground of the brand colour in turn with white, hairlines instead of boxes, the hero picture under an arch and photographs with a thin outline set off their corner. Sections are uncovered as they come into view.',
    fonts: { heading: 'Fraunces', body: 'DM Sans' }, vars: { '--k-r': '.6rem', '--k-r-btn': '.45rem', '--k-h-weight': '500', '--k-h-track': '-.022em' },
    header: 'hz', footer: 'hz', offered: true, anim: 'unfold', ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
