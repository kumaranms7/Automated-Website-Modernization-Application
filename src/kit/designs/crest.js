import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, num, statsOf, groupsOf, introHtml, answerOf, initialsOf, mapFrame } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays } from './base.js';
import { stars } from '../ui.js';

// CREST: a curve, a pattern and tiles. The hero stands open on a pale ground that carries a pattern chosen for the kind of business (waves
// for a plumber, a plan's grid for a builder...): the words on the left, the picture or the video reaching the edge of the page on the
// right, cut by a wide curve that two lines of colour follow. The header is a plain white bar. Sections are full-width bands, white and
// a pale shade of the brand colour with the pattern in one of its corners, in turn. Inside them everything is a tile: cards, lists,
// figures on tiles of different fills, and the accent words of a heading on small tiles of the accent colour. What comes into view is
// put in place like a tile (the "assemble" motion of the stylesheet). Its colours are the website's theme. Layout names start with cr-.

const PALE = 'bg-[color-mix(in_srgb,var(--th-primary-50)_72%,var(--th-bg))]';
// the website's pattern laid in white inside a block of colour (k-pat-layer of the stylesheet draws it)
const PAT_LIGHT = '<i class="k-pat-layer k-pat-tl [--k-pat-ink:#fff] [--k-pat-o:.1]" aria-hidden="true"></i>';
// the curve of this design: what reaches the edge of the page (a picture, a block of colour) is cut by a wide arc. Under 1024px it
// stands under the words, and the arc is its head
const CURVE = 'max-lg:[clip-path:ellipse(108%_100%_at_50%_100%)] lg:[clip-path:ellipse(100%_108%_at_100%_50%)]';
const TILED = 'relative rounded-[var(--k-r)] bg-surface shadow-[0_0_0_1px_rgb(15_23_42/.06),0_18px_40px_-24px_rgb(15_23_42/.28)] transition duration-500';
// the fills a row of tiles takes in turn (figures): the brand, white, the accent colour, the brand's deepest shade
const FILLS = ['on-dark bg-linear-to-br from-primary-600 to-primary-800 text-white', 'bg-surface text-primary-950 shadow-[0_0_0_1px_rgb(15_23_42/.06)]', 'on-dark bg-popbtn text-white', 'on-dark bg-primary-950 text-white'];
const ARCS = 'before:pointer-events-none before:absolute before:-right-24 before:-bottom-32 before:-z-10 before:size-[28rem] before:rounded-full before:border-[3rem] before:border-white/[.07] after:pointer-events-none after:absolute after:-right-2 after:-bottom-10 after:-z-10 after:size-[15rem] after:rounded-full after:border-[2.5rem] after:border-white/[.07]';

const { X, C } = sections({
  SHADOW: 'shadow-[0_0_0_1px_rgb(15_23_42/.06),0_18px_40px_-24px_rgb(15_23_42/.28)]',
  PLAIN: TILED, CARD: TILED,
  // a tile is picked up: it rises and turns a little
  LIFT: 'hover:-translate-y-1.5 hover:-rotate-[.6deg] hover:shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--th-primary-400)_70%,transparent),0_30px_60px_-28px_color-mix(in_srgb,var(--th-primary-700)_60%,transparent)]',
  TILE: 'grid size-12 shrink-0 place-items-center rounded-[.9rem] bg-pop-50 text-popbtn ring-1 ring-pop-100 transition duration-300',
  POP: 'bg-popbtn text-white shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--d-pop-btn,var(--th-secondary-700))_80%,transparent)] hover:brightness-110',
  BRAND: 'bg-primary-700 text-white shadow-[0_14px_30px_-14px_color-mix(in_srgb,var(--th-primary-700)_80%,transparent)] hover:bg-primary-800',
  LINE: 'border-primary-200 bg-surface text-primary-900 hover:border-primary-700 hover:text-primary-700',
  GLASSBTN: 'border-white/35 bg-white/10 text-white backdrop-blur-md hover:border-white hover:bg-white/20',
  GAP: 'gap-[clamp(.85rem,1.6vw,1.25rem)]',
  PICSHADOW: 'shadow-[0_30px_60px_-30px_color-mix(in_srgb,var(--th-primary-950)_60%,transparent)]',
  DEEP: `on-dark relative isolate overflow-hidden bg-linear-to-br from-primary-600 to-primary-800 text-white ${ARCS}`,
  // (the accent words of a heading sit on small tiles of the accent colour)
  TONE: 'rounded-[.22em] bg-pop-100 px-[.16em] text-popbtn [box-decoration-break:clone] [-webkit-box-decoration-break:clone] on-dark:bg-white/15 on-dark:text-white',
  NUM: 'grid size-10 place-items-center rounded-[.75rem] bg-primary-700 font-display text-[.95rem] font-extrabold text-white',
  UNDERHERO: 'py-[clamp(2.5rem,5vw,4.5rem)]',
}, (X, C) => {
  return {
    eyebrow: (t) => (t ? `<span class="inline-flex w-fit items-center gap-2 rounded-[.6rem] bg-primary-700 px-3 py-1.5 text-[.72rem] font-extrabold tracking-[.14em] text-white uppercase on-dark:bg-white on-dark:text-primary-800"><i class="block size-1.5 rounded-[2px] bg-pop-400"></i>${esc(t)}</span>` : ''),
    // three small tiles: the mark of this design over a heading
    rule: () => '<span class="flex gap-1.5" aria-hidden="true"><i class="block size-2.5 rounded-[3px] bg-primary-700 on-dark:bg-white"></i><i class="block size-2.5 rounded-[3px] bg-pop-500"></i><i class="block size-2.5 rounded-[3px] bg-primary-300 on-dark:bg-white/40"></i></span>',
    check: (cls = 'bg-primary-700 text-white') => `<span class="mt-0.5 grid size-[1.45rem] shrink-0 place-items-center rounded-[.45rem] ${cls}">${icon('check', 'size-3 stroke-[3.5]')}</span>`,
    // a list: a small tile for each line
    checklist: (list, cols = '') => `<ul class="m-0 grid list-none gap-2.5 p-0 ${cols}">${list.map((t) => `<li class="flex items-start gap-3 rounded-[calc(var(--k-r)*.6)] bg-surface px-4 py-3.5 leading-snug font-semibold text-primary-950 shadow-[0_0_0_1px_rgb(15_23_42/.06)] on-dark:bg-white/10 on-dark:text-white on-dark:shadow-none">${X.check()}<span>${esc(typeof t === 'string' ? t : t.title || t.text || '')}</span></li>`).join('')}</ul>`,
    listPanel: (lines, cols) => `<div data-k-reveal>${X.checklist(lines, cols)}</div>`,
    arrowLink: (label) => `<span class="mt-auto inline-flex items-center gap-2.5 pt-1 text-[.95rem] font-extrabold text-primary-800 on-dark:text-white">${esc(label)}<span class="grid size-8 place-items-center rounded-[.6rem] bg-primary-700 text-white transition duration-300 group-hover/card:translate-x-1 group-hover/card:bg-popbtn on-dark:bg-white on-dark:text-primary-800">${icon('arrow', 'size-3.5')}</span></span>`,
    // a photograph: a tile, with a tile of the brand's colour turned a little behind it and a small tile of the accent colour at its corner
    photo: (K, src, alt, { side = '', cls = '' } = {}) => `<div class="relative ${cls}" data-k-reveal="zoom"><div class="absolute inset-0 -z-10 ${side === 'right' ? '-rotate-[4deg]' : 'rotate-[4deg]'} rounded-[calc(var(--k-r)*1.15)] bg-linear-to-br from-primary-500 to-primary-700"></div><div class="absolute -top-4 ${side === 'right' ? '-left-4' : '-right-4'} -z-10 size-16 rotate-12 rounded-[1rem] bg-pop-400"></div><div class="overflow-hidden rounded-[calc(var(--k-r)*1.15)] ring-[5px] ring-white ${C.PICSHADOW} [&_img]:h-auto [&_img]:max-h-[34rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div>`,
    mark: (K, src, alt, cls = '') => `<div class="relative grid w-fit place-items-center rounded-[calc(var(--k-r)*1.15)] bg-surface p-[clamp(1.25rem,3vw,2.25rem)] ${C.SHADOW} [&_img]:h-auto [&_img]:max-h-56 [&_img]:max-w-full ${cls}" data-k-reveal="zoom"><i class="absolute -top-3 -right-3 block size-9 rotate-12 rounded-[.6rem] bg-pop-400" aria-hidden="true"></i>${K.img(src, alt || '')}</div>`,

    // cards: tiles. Five, nine or thirteen with pictures make a mosaic: the first one is a large tile whose picture fills it
    cards: (s, K) => {
      const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
      const n = list.length;
      const hasPics = list.some((c) => c.img);
      const mosaic = hasPics && list[0].img && n >= 5 && (n - 1) % 4 === 0;
      const Hn = s.title ? 'h3' : 'h2';
      const cell = (c, i) => {
        const label = c.title || c.text || c.label || '';
        const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
        const more = c.href ? X.arrowLink(c.cta || 'Learn more') : '';
        const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
        const chip = ownIcon ? `<span class="absolute top-3 left-3 z-[1] grid size-12 place-items-center rounded-[.9rem] ${K.dims?.[ownIcon]?.light ? 'bg-primary-700' : 'bg-surface'} shadow-[0_10px_24px_-10px_rgb(0_0_0/.45)] [&_img]:size-7! [&_img]:object-contain!">${K.img(ownIcon, '')}</span>` : '';
        // the large tile: a tile of the brand's colour, the picture at its head in its own size, the words set larger under it
        if (mosaic && i === 0) return X.shell(`<div class="relative p-2.5 pb-0">${chip}<div class="aspect-[16/10] overflow-hidden rounded-[calc(var(--k-r)*.72)] [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.05]">${K.img(c.img, c.imgAlt || label)}</div></div><div class="on-dark grid flex-1 content-center gap-3.5 p-[clamp(1.25rem,2.5vw,2.25rem)]"><${Hn} class="${C.H3} text-[clamp(1.45rem,1.1rem+1.1vw,2rem)] text-white">${esc(label)}</${Hn}>${c.title && c.text ? `<p class="text-[1.05rem] leading-relaxed text-white/85">${esc(c.text)}</p>` : ''}${more}</div>`, { href: c.href, i, cls: 'isolate flex flex-col overflow-hidden bg-linear-to-br from-primary-700 to-primary-950 sm:col-span-2 lg:row-span-2', reveal: 'zoom' });
        if (c.img) return X.shell(`<div class="relative p-2.5 pb-0">${chip}<div class="aspect-[16/10] overflow-hidden rounded-[calc(var(--k-r)*.72)] [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.07]">${K.img(c.img, c.imgAlt || label)}</div></div><div class="grid flex-1 content-start gap-2.5 p-5"><${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}</div>`, { href: c.href, i, cls: 'flex flex-col', step: 70, per: 4, reveal: 'zoom' });
        return X.shell(`${X.tile(K, { ...c, photo: true }, i) || X.numMark(i)}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}`, { href: c.href, i, cls: 'grid content-start gap-3.5 p-[clamp(1.4rem,2.5vw,2rem)]', step: 70, reveal: 'zoom' });
      };
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: !s.small && !mosaic })}<div class="grid ${C.GAP} ${mosaic ? 'sm:grid-cols-2 lg:grid-cols-4' : X.colsOf(n, { small: s.small, pics: hasPics })}">${list.map((c, i) => cell(c, i)).join('')}</div></div></section>`;
    },
    // steps: a tile for each, its number on a tile of its own, an arrow to the next
    steps: (s, K) => {
      const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
      const Hn = s.title || !K.real ? 'h3' : 'h2';
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true, word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="m-0 grid list-none ${C.GAP} p-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">${list.map((t, i) => `<li class="group/card ${C.CARD} ${C.LIFT} grid content-start gap-3.5 p-6" data-k-reveal="zoom" style="transition-delay:${i * 90}ms"><span class="flex items-center justify-between"><span class="grid size-12 place-items-center rounded-[.9rem] ${i % 2 ? 'bg-popbtn' : 'bg-primary-700'} font-display text-[1.15rem] font-extrabold text-white">${num(i)}</span>${i < list.length - 1 ? `<span class="text-primary-300 max-lg:hidden">${icon('arrow', 'size-5')}</span>` : ''}</span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
    },
    // figures: a tile for each, the fills in turn; the picture that stood beside them is a tile of the same row
    stats: (s, K) => {
      const list = statsOf(s);
      const tiles = list.map((x, i) => `<div class="relative isolate grid content-end gap-2 overflow-hidden rounded-[var(--k-r)] p-[clamp(1.25rem,2.5vw,2rem)] ${FILLS[i % FILLS.length]} ${i % FILLS.length === 0 ? ARCS : ''}" data-k-reveal="zoom" style="transition-delay:${i * 90}ms"><dd class="order-first m-0 font-display text-[clamp(2.4rem,1.5rem+2.6vw,3.9rem)] leading-none font-extrabold tracking-tight" data-count="${esc(x.value)}">${esc(x.value)}</dd><dt class="text-[.98rem] leading-snug font-semibold opacity-85">${esc(x.label)}</dt></div>`).join('');
      const cols = list.length === 2 ? 'sm:grid-cols-2' : list.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
      const pic = s.img ? `<div class="overflow-hidden rounded-[var(--k-r)] ring-[5px] ring-white ${C.PICSHADOW} [&_img]:size-full [&_img]:max-h-80 [&_img]:object-cover lg:[&_img]:max-h-none" data-k-reveal="zoom" style="transition-delay:${list.length * 90}ms">${K.img(s.img, s.imgAlt || '')}</div>` : '';
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${s.title ? `<div class="${C.HEADGAP} grid max-w-3xl gap-4">${X.rule()}${X.h2(s.title)}</div>` : ''}${pic ? `<div class="grid ${C.GAP} lg:grid-cols-[1.6fr_1fr]"><dl class="m-0 grid ${C.GAP} ${cols.replace('lg:grid-cols-4', '')}">${tiles}</dl>${pic}</div>` : `<dl class="m-0 grid ${C.GAP} ${cols}">${tiles}</dl>`}</div></section>`;
    },
    reviewCard: (r, i, cls = '') => `<figure class="${C.CARD} m-0 grid content-between gap-6 p-7 ${cls}" data-k-reveal="zoom" style="transition-delay:${(i % 3) * 80}ms"><div class="grid gap-4"><div class="flex items-center justify-between gap-4"><span class="grid size-11 place-items-center rounded-[.8rem] bg-pop-100 font-display text-[2rem] leading-none font-extrabold text-popbtn" aria-hidden="true"><span class="translate-y-[.18em]">”</span></span>${stars()}</div><blockquote class="m-0 text-[1.03rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center gap-3.5 border-t border-primary-100 pt-5"><span class="grid size-11 shrink-0 place-items-center rounded-[.8rem] bg-primary-700 font-display text-sm font-extrabold text-white">${esc(initialsOf(r.name))}</span><span class="grid"><b class="text-primary-950">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-muted">${esc(r.place || r.role)}</small>` : ''}</span></figcaption></figure>`,
    scrollBtn: (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="grid size-12 place-items-center rounded-[.9rem] bg-primary-700 text-white transition hover:bg-popbtn">${icon('arrow', dir === 'prev' ? 'size-5 rotate-180' : 'size-5')}</button>`,
    faqRow: (f, i) => `<details class="group ${C.PLAIN} open:shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--th-primary-400)_70%,transparent),0_30px_50px_-30px_color-mix(in_srgb,var(--th-primary-800)_55%,transparent)]"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 50}ms"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 py-4 pr-4 pl-6 font-display text-[1.08rem] leading-snug font-[var(--k-h-weight)] text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="grid size-10 shrink-0 place-items-center rounded-[.75rem] bg-primary-50 text-primary-700 transition duration-300 group-open:rotate-45 group-open:bg-primary-700 group-open:text-white">${icon('plus', 'size-4')}</span></summary><div class="px-6 pb-6">${answerOf(f.a)}</div></details>`,
    faqRows: (list) => `<div class="grid gap-2.5">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`,
    // the places served: a tile for each group, the places as small tiles
    areas: (s, K) => {
      const groups = groupsOf(s).filter((g) => (g.links || []).length);
      const one = groups.length === 1;
      const title = s.title || (one ? groups[0].title : '');
      const Hn = title ? 'h3' : 'h2';
      const place = (l) => { const cls = 'inline-flex items-center gap-2 rounded-[.7rem] bg-primary-50 px-3.5 py-2 text-[.93rem] font-semibold text-primary-950 transition duration-300'; return l.href ? `<a class="${cls} hover:-translate-y-0.5 hover:bg-primary-700 hover:text-white" href="${esc(l.href)}">${icon('pin', 'size-3.5 opacity-60')}${esc(l.text)}</a>` : `<span class="${cls}">${icon('pin', 'size-3.5 opacity-60')}${esc(l.text)}</span>`; };
      return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top({ ...s, title }, K, { center: true, word: 'Service areas', lead: s.lead ? `<p>${esc(s.lead)}</p>` : '' })}<div class="grid ${C.GAP} ${one ? '' : 'lg:grid-cols-2'}">${groups.map((g, i) => `<div class="${C.CARD} grid content-start gap-5 p-[clamp(1.25rem,3vw,2rem)]" data-k-reveal="${one ? 'zoom' : i % 2 ? 'right' : 'left'}">${g.title && !one ? `<${Hn} class="${C.H3} flex items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-[.75rem] ${i % 2 ? 'bg-popbtn' : 'bg-primary-700'} text-white">${icon('pin', 'size-5')}</span>${esc(g.title)}</${Hn}>` : ''}<ul class="m-0 flex list-none flex-wrap gap-2 p-0 ${one ? 'justify-center' : ''}">${g.links.map((l) => `<li>${place(l)}</li>`).join('')}</ul></div>`).join('')}</div></div></section>`;
    },
    // the closing call: a large tile of the brand's colour with two arcs; the picture the website shows with it on a white tile
    cta: (s, K) => {
      const q = quoteTo(s, K), c = callTo(K);
      const pic = s.img ? `<span class="grid size-[clamp(5rem,9vw,7.5rem)] shrink-0 -rotate-6 place-items-center rounded-[calc(var(--k-r)*.9)] bg-surface p-3 shadow-[0_24px_44px_-20px_rgb(0_0_0/.5)] max-lg:justify-self-start [&_img]:size-full [&_img]:object-contain">${K.img(s.img, s.imgAlt || '')}</span>` : '';
      return `<section class="relative py-[clamp(2.5rem,5vw,4.5rem)]"><div class="${C.WRAP}"><div class="${C.DEEP} rounded-[calc(var(--k-r)*1.3)] px-[clamp(1.5rem,5vw,4.5rem)] py-[clamp(2.5rem,5.5vw,4.5rem)] shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--th-primary-800)_80%,transparent)]" data-k-reveal="zoom">${PAT_LIGHT}<div class="grid items-center gap-8 ${pic ? 'lg:grid-cols-[auto_1.5fr_auto]' : 'lg:grid-cols-[1.5fr_auto]'}">${pic}<div class="grid gap-4">${X.h2(s.title || 'Ready to get started?', 'text-white')}${s.text ? `<p class="max-w-2xl text-[1.08rem] leading-relaxed text-white/85">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap gap-3.5">${btn(q, 'bg-surface text-primary-800 shadow-[0_14px_30px_-12px_rgb(0_0_0/.45)] hover:bg-pop-100', true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></div></div></section>`;
    },
    // a banner line: a white tile, a tile of the brand's colour at its head
    callout: (s, K) => {
      const { say, act } = X.calloutParts(s, K, C.POP);
      return `<section class="k-same relative py-[clamp(1.25rem,3vw,2rem)]"><div class="${C.WRAP}"><div class="${C.PLAIN} flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-2.5 pr-[clamp(1rem,2.5vw,1.5rem)]" data-k-reveal="zoom"><p class="m-0 flex items-center gap-4 font-display text-[clamp(1.1rem,1rem+.6vw,1.45rem)] leading-snug font-[var(--k-h-weight)] text-primary-950"><span class="grid size-14 shrink-0 place-items-center rounded-[calc(var(--k-r)*.7)] bg-primary-700 text-white">${icon('check', 'size-6 stroke-[3]')}</span>${esc(say)}</p>${act.replace('text-white/85', 'text-primary-900')}</div></div></section>`;
    },
    // the map: a tile like the others
    map: (s) => {
      const frame = s.html ? mapFrame(s.html) : `<div class="grid h-full place-items-center bg-primary-50"><span class="grid size-16 place-items-center rounded-[1rem] bg-popbtn text-white shadow-lg">${icon('pin', 'size-7')}</span></div>`;
      return `<section class="relative py-[clamp(2rem,4vw,3.5rem)]" aria-label="Map"><div class="${C.WRAP}"><div class="h-[clamp(20rem,40vw,28rem)] w-full overflow-hidden rounded-[calc(var(--k-r)*1.15)] ring-[5px] ring-white ${C.PICSHADOW} [&_iframe]:block [&_iframe]:size-full [&_iframe]:border-0" data-k-reveal="zoom">${frame}</div></div></section>`;
    },
  };
});
const { WRAP, POP, LINE, DEEP } = C;
// the bands of a page: white (the first, under the hero's pale ground), then a pale shade of the brand colour that carries the website's
// pattern in one of its upper corners, in turn
const TONES = { alt: `k-pat k-pat-tr ${PALE}`, tint: `k-pat k-pat-tl ${PALE}`, dark: 'on-dark k-pat k-pat-tr bg-primary-950 text-white [--k-pat-ink:#fff] [--k-pat-o:.07]', brand: 'on-dark k-pat k-pat-tr bg-linear-to-br from-primary-600 to-primary-800 text-white [--k-pat-ink:#fff] [--k-pat-o:.1]', rotation: ['none', 'alt', 'none', 'tint'] };

// ---------- hero ----------
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0 text-[.95rem] font-semibold text-primary-950" data-k-reveal style="transition-delay:260ms">${list.map((t) => `<li class="inline-flex items-center gap-2.5">${X.check()}${esc(t)}</li>`).join('')}</ul>` : '');
// the picture or the video of a hero: it reaches the edge of the page and is cut by the curve, which two lines of colour follow
const media = (h, K, cls) => `<div class="${cls}" data-k-reveal="curve" style="transition-delay:120ms"><i class="absolute inset-0 bg-primary-600 ${CURVE} max-lg:-translate-y-4 lg:-translate-x-6" aria-hidden="true"></i><i class="absolute inset-0 bg-pop-400 ${CURVE} max-lg:-translate-y-2 lg:-translate-x-3" aria-hidden="true"></i><div class="absolute inset-0 isolate overflow-hidden bg-primary-100 ${CURVE} [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover"><div class="${web(K).motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}</div>${videoBg(h).replace('-z-20', '')}${h.video ? vPause('right-4 bottom-4') : ''}</div></div>`;
// where a hero has no picture to show: the same curve as a block of the brand's colour with the pattern, and on it the way to call
// (it stands beside the words from 1024px up; under that the page's call button says it)
const panel = (K, cls) => {
  const c = callTo(K);
  const inner = `<i class="absolute inset-0 bg-pop-400 -translate-x-3 [clip-path:ellipse(100%_108%_at_100%_50%)]" aria-hidden="true"></i><span class="absolute inset-0 isolate grid content-center justify-items-center gap-2 overflow-hidden bg-linear-to-br from-primary-600 to-primary-800 pl-[14%] text-center text-white [clip-path:ellipse(100%_108%_at_100%_50%)]">${PAT_LIGHT.replace('k-pat-tl', 'k-pat-all')}${c ? `<span class="grid size-14 place-items-center rounded-full bg-white/15 transition duration-300 group-hover/call:scale-110 group-hover/call:bg-popbtn">${icon('phone', 'size-6')}</span><span class="mt-2 text-[.8rem] font-bold tracking-[.14em] text-white/80 uppercase">Call us</span><b class="font-display text-[clamp(1.4rem,1rem+1.2vw,2.1rem)] leading-none font-extrabold">${esc(K.site.phone.display)}</b>` : ''}</span>`;
  return c ? `<a class="on-dark group/call ${cls} max-lg:hidden" href="${esc(c.href)}" data-k-reveal="curve" style="transition-delay:120ms">${inner}</a>` : `<div class="on-dark ${cls} max-lg:hidden" aria-hidden="true" data-k-reveal="curve" style="transition-delay:120ms">${inner}</div>`;
};
// the figures of the website: a row of numerals under a hairline
const figures = (K) => {
  const list = factsOf(K).slice(0, 3);
  return list.length ? `<dl class="m-0 mt-1 grid w-full ${['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'][list.length]} border-t border-primary-200 pt-6" data-k-reveal style="transition-delay:340ms">${list.map((x) => `<div class="grid content-start gap-1.5 pr-[clamp(1rem,2.2vw,2rem)] [&:not(:first-child)]:border-l [&:not(:first-child)]:border-primary-200 [&:not(:first-child)]:pl-[clamp(1rem,2.2vw,2rem)]"><dt class="order-last text-[.86rem] leading-snug font-semibold text-secondary">${esc(x.label)}</dt><dd class="m-0 font-display text-[clamp(1.8rem,1.3rem+1.5vw,2.6rem)] leading-none font-extrabold tracking-tight text-primary-800" data-count="${esc(x.value)}">${esc(x.value)}</dd></div>`).join('')}</dl>` : '';
};
// the links the old hero offered: a band of the brand's colour across the foot of the hero, each link under its own picture in a disc
const quick = (h, K) => {
  const list = h.cards?.items || [];
  if (!list.length) return '';
  const pics = list.some((c) => c.img);
  const link = (c) => {
    const label = c.text || c.title || c.label || '';
    const inner = pics
      ? `<span class="grid size-12 shrink-0 place-items-center rounded-full sm:size-[3.75rem] ${K.dims?.[c.img]?.light ? 'bg-white/15 ring-1 ring-white/30' : 'bg-white'} shadow-[0_14px_26px_-14px_rgb(0_0_0/.55)] transition duration-300 group-hover/q:-translate-y-1.5 group-hover/q:scale-105 [&_img]:size-6 [&_img]:object-contain sm:[&_img]:size-8">${c.img ? K.img(c.img, c.imgAlt || '') : icon('arrow', 'size-5 text-primary-700')}</span><span>${esc(label)}</span>`
      : `${esc(label)}${icon('arrow', 'size-3.5 opacity-70 transition duration-300 group-hover/q:translate-x-1')}`;
    const cls = pics ? 'group/q flex items-center gap-3 text-[.84rem] leading-tight font-bold text-white sm:grid sm:justify-items-center sm:gap-2.5 sm:text-center' : 'group/q inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-[.9rem] font-bold text-white transition duration-300 hover:border-white hover:bg-white/10';
    return `<li>${c.href ? `<a class="${cls}" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`;
  };
  return `<div class="on-dark relative isolate overflow-hidden bg-linear-to-r from-primary-700 to-primary-800 text-white">${PAT_LIGHT.replace('k-pat-tl', 'k-pat-all')}<div class="${WRAP} grid items-center gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-5 py-[clamp(1.25rem,2.6vw,2rem)] ${h.cards.title ? 'lg:grid-cols-[minmax(0,14rem)_1fr]' : ''}" data-k-reveal style="transition-delay:380ms">${h.cards.title ? `<p class="m-0 font-display text-[clamp(1.15rem,1rem+.6vw,1.45rem)] leading-tight font-[var(--k-h-weight)] text-white">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 list-none p-0 ${pics ? 'grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5 lg:grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))]' : 'flex flex-wrap gap-2.5'}">${list.map(link).join('')}</ul></div></div>`;
};

const hero = {
  // the home page: the words stand open on the patterned ground (the headline, the lead, the actions, what the business promises and
  // its figures); the picture or the video reaches the edge of the page under the curve; the website's quick links cross the foot
  'cr-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.1rem,1.1rem+3.1vw,3.7rem)] leading-[1.06]' : 'text-[clamp(2.6rem,1.2rem+4.8vw,5rem)] leading-[1.03]';
    const has = Boolean(h.image?.src || h.video?.src);
    const side = has ? media(h, K, 'relative max-lg:mt-2 max-lg:h-[clamp(15rem,62vw,26rem)] lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%]') : panel(K, 'absolute inset-y-0 right-0 w-[36%]');
    return `<section class="k-pat k-pat-tl relative isolate overflow-hidden [--k-pat-o:.2] ${PALE}"><div class="relative"><div class="${WRAP} grid lg:min-h-[clamp(30rem,42vw,40rem)]"><div class="grid content-center justify-items-start gap-6 py-[clamp(2.5rem,5vw,4.5rem)] ${has ? 'lg:w-[50%]' : 'lg:w-[58%]'}">${X.eyebrow(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-2xl text-[clamp(1.06rem,1rem+.35vw,1.25rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3" data-k-reveal style="transition-delay:180ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, LINE, false, true) : ''}</div>${bullets(h.bullets)}${figures(K)}</div></div>${side}</div>${quick(h, K)}</section>`;
  },
  // an inner page: the trail, the title and the page's actions on the patterned ground; beside them the page's picture or video under
  // the curve, or the curve as a block of colour with the way to call
  'cr-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-primary-950">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-primary-700" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<span aria-hidden="true" class="text-primary-300">/</span>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(1.9rem,1.1rem+2.6vw,3.1rem)]' : 'text-[clamp(2.3rem,1.2rem+3.6vw,3.9rem)]';
    const has = Boolean(h.image?.src || h.video?.src);
    const side = has ? media(h, K, 'relative max-lg:h-[clamp(12rem,48vw,19rem)] lg:absolute lg:inset-y-0 lg:right-0 lg:w-[36%]') : panel(K, 'absolute inset-y-0 right-0 w-[30%]');
    const call = X.callBtn(K, LINE);
    return `<section class="k-pat k-pat-tl relative isolate overflow-hidden [--k-pat-o:.2] ${PALE}"><div class="${WRAP} grid lg:min-h-[clamp(16rem,21vw,20rem)]"><div class="grid content-center justify-items-start gap-5 py-[clamp(2.25rem,4.5vw,4rem)] lg:w-[58%]"><nav class="flex flex-wrap items-center gap-2 text-[.86rem] font-semibold text-secondary" aria-label="Breadcrumb">${crumbs}</nav><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3" data-k-reveal style="transition-delay:180ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${has || !call ? call : `<span class="max-lg:contents lg:hidden">${call}</span>`}</div></div></div>${side}</section>`;
  },
};
// ---------- header and footer ----------
const logo = (K, dark = false) => `<a class="inline-flex items-center gap-3 font-display text-[1.3rem] leading-none font-extrabold tracking-tight ${dark ? 'text-white' : 'text-primary-950'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto ${dark ? 'max-h-24' : 'max-h-12'} w-auto" src="${esc(K.u((dark && K.site.footerLogo) || K.site.logo))}" alt="${esc(K.site.name)}"${dark ? ' loading="lazy"' : ''}>` : `<span class="grid size-10 place-items-center rounded-[.8rem] bg-primary-700 text-[1.05rem] text-white">${esc(String(K.site.name || '?').trim()[0] || '?')}</span><span>${esc(K.site.name)}</span>`}</a>`;
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 rounded-[.7rem] px-3 py-2 text-[.95rem] font-bold whitespace-nowrap text-primary-950 transition duration-300 hover:bg-primary-50 hover:text-primary-700 aria-[current]:text-primary-700 aria-[current]:after:absolute aria-[current]:after:inset-x-3 aria-[current]:after:bottom-0 aria-[current]:after:h-[3px] aria-[current]:after:rounded-full aria-[current]:after:bg-pop-500',
  panel: `${TILED} p-2.5`,
  item: 'flex items-center justify-between gap-3 rounded-[.7rem] px-3.5 py-2.5 text-[.93rem] font-semibold text-primary-950 transition hover:bg-primary-50 hover:text-primary-700',
  more: 'rounded-[.7rem] bg-primary-50 text-primary-700 hover:bg-primary-100',
};
// the line over the header: what the website announces (else its hours, else its address) and its phone, on the brand's colour
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-extrabold text-white transition hover:text-pop-200" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-pop-300')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `${say.icon ? icon(say.icon, 'size-3.5 text-pop-300') : ''}${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="on-dark bg-primary-700 text-white/90"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[.82rem] font-semibold max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  // a plain white bar across the page that stays at its head: the logo, the menu, the action
  cr: (K) => `${strip(K)}<header class="sticky top-0 z-50 border-b border-primary-100 bg-white/95 backdrop-blur-md transition duration-300 data-[scrolled]:shadow-[0_14px_34px_-22px_color-mix(in_srgb,var(--th-primary-950)_55%,transparent)]" data-k-header><div class="${WRAP} flex items-center gap-[clamp(1rem,2.5vw,2.5rem)] py-3" data-p="bar">${logo(K)}<nav class="ml-auto flex items-center gap-0.5 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, true)}</span><button class="ml-auto grid size-11 place-items-center rounded-[.8rem] bg-primary-50 text-primary-950 transition hover:bg-primary-100 lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // the website's own footer: a band of the brand's deepest shade with the pattern and two arcs
  cr: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-4 inline-flex rounded-[.5rem] bg-white/10 px-2.5 py-1 text-[.74rem] font-extrabold tracking-[.14em] text-white uppercase', li = 'transition hover:text-white';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-11 place-items-center rounded-[.8rem] bg-white/10 transition duration-300 hover:-translate-y-1 hover:-rotate-3 hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-[.7rem] bg-white/10 px-3.5 py-2 text-[.84rem] font-semibold text-white transition hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-2.5 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} font-bold text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.3fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="on-dark relative isolate overflow-hidden bg-primary-950 pt-[clamp(3.5rem,7vw,5.5rem)] text-white/70 max-sm:pb-20 ${ARCS}">${PAT_LIGHT.replace('[--k-pat-o:.1]', '[--k-pat-o:.07]')}<div class="${WRAP}"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/12 py-6 text-[.88rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-[.6rem] bg-white/10 px-3.5 py-1.5 text-[.72rem] font-extrabold tracking-[.1em] uppercase transition hover:bg-white/20">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'cr-');
export const CREST = {
  design: {
    id: 'crest', name: 'Crest', badge: 'Curve and pattern', blurb: 'An open hero on a ground that carries a pattern chosen for the kind of business (waves for a plumber, the grid of a plan for a builder), its picture or video reaching the edge of the page under a wide curve that two lines of colour follow. Sections are full-width bands, white and a pale shade of the brand colour with the pattern, in turn. Inside them cards, lists and figures are tiles, accent words sit on tiles of their own, and what comes into view is put in place like a tile.',
    fonts: { heading: 'Urbanist', body: 'Albert Sans' }, vars: { '--k-r': '1.5rem', '--k-r-btn': '.95rem', '--k-h-weight': '800', '--k-h-track': '-.035em' },
    header: 'cr', footer: 'cr', offered: true, anim: 'assemble', patterned: true, ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
