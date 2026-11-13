import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, statsOf, introHtml, answerOf, initialsOf, bodyOf, mapFrame } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays } from './base.js';
import { stars } from '../ui.js';

// LUMEN: soft and friendly. Everything is round: a header that floats as a pill, a hero whose words are centred over soft clouds of the
// theme's colours with the picture (or the video) on a wide rounded card under them, every second band a tinted panel set into the page,
// cards without borders that rise into a glow of the brand's colour, lists as chips, figures on glass tiles over a gradient panel and a
// footer that is a rounded panel of its own. What comes into view blooms out of a blur and pictures open from their centre (the "bloom"
// motion of the stylesheet). Its colours are the website's theme. Layout names start with lm-.

const SOFT = 'relative rounded-[var(--k-r)] bg-surface shadow-[0_2px_6px_rgb(15_23_42/.04),0_24px_48px_-28px_color-mix(in_srgb,var(--th-primary-900)_38%,transparent)] transition duration-500';
const PANEL = 'mx-[clamp(.5rem,1.6vw,1.5rem)] rounded-[clamp(1.5rem,3vw,2.75rem)]';
const TINT = `${PANEL} bg-[color-mix(in_srgb,var(--th-primary-50)_85%,var(--th-bg))]`;
// soft clouds of the theme's colours that drift slowly behind a hero
const CLOUDS = '<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true"><i class="k-drift absolute -top-40 -left-32 block size-[34rem] rounded-full bg-primary-200/70 blur-3xl"></i><i class="k-drift absolute -top-24 -right-40 block size-[30rem] rounded-full bg-pop-200/60 blur-3xl [animation-delay:-7s]"></i><i class="k-drift absolute top-1/2 left-1/2 block size-[26rem] -translate-x-1/2 rounded-full bg-primary-100/80 blur-3xl [animation-delay:-13s]"></i></div>';

const { X, C } = sections({
  H2: 'font-display text-[clamp(2rem,1.2rem+2.8vw,3.4rem)] leading-[1.08] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950 on-dark:text-white',
  H3: 'font-display text-[clamp(1.15rem,1.02rem+.5vw,1.4rem)] leading-snug font-[var(--k-h-weight)] tracking-[-.015em] [text-transform:var(--k-h-case)] text-primary-950 on-dark:text-white',
  SHADOW: 'shadow-[0_2px_6px_rgb(15_23_42/.04),0_24px_48px_-28px_color-mix(in_srgb,var(--th-primary-900)_38%,transparent)]',
  PLAIN: SOFT, CARD: SOFT,
  // a card rises into a glow of the brand's colour
  LIFT: 'hover:-translate-y-2 hover:shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--th-primary-400)_55%,transparent),0_34px_70px_-24px_color-mix(in_srgb,var(--th-primary-500)_60%,transparent)]',
  TILE: 'grid size-14 shrink-0 place-items-center rounded-full bg-linear-to-br from-primary-100 to-pop-100 text-primary-800 transition duration-300',
  POP: 'bg-linear-to-r from-popbtn to-pop-500 text-white shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--d-pop-btn,var(--th-secondary-700))_80%,transparent)] hover:brightness-110',
  BRAND: 'bg-primary-600 text-white shadow-[0_14px_30px_-14px_color-mix(in_srgb,var(--th-primary-600)_80%,transparent)] hover:bg-primary-700',
  LINE: 'border-primary-200 bg-surface text-primary-900 hover:border-primary-500 hover:text-primary-700',
  GLASSBTN: 'border-white/40 bg-white/15 text-white backdrop-blur-md hover:bg-white hover:text-primary-900',
  SEC: 'relative py-[calc(var(--k-sec-y)*.85)]',
  GAP: 'gap-[clamp(1rem,2vw,1.6rem)]',
  PICSHADOW: 'shadow-[0_34px_70px_-34px_color-mix(in_srgb,var(--th-primary-900)_65%,transparent)]',
  DEEP: 'on-dark relative isolate overflow-hidden bg-linear-to-br from-primary-700 via-primary-800 to-primary-950 text-white before:pointer-events-none before:absolute before:-top-32 before:-right-24 before:-z-10 before:size-[26rem] before:rounded-full before:bg-pop-400/25 before:blur-3xl after:pointer-events-none after:absolute after:-bottom-40 after:-left-24 after:-z-10 after:size-[30rem] after:rounded-full after:bg-primary-400/25 after:blur-3xl',
  TONE: 'text-primary-500 on-dark:text-pop-200',
  NUM: 'grid size-11 place-items-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 font-display text-[.95rem] font-bold text-white',
  UNDERHERO: 'py-[clamp(2.5rem,5vw,4.5rem)]',
}, (X, C) => ({
  eyebrow: (t) => (t ? `<span class="inline-flex w-fit items-center gap-2.5 rounded-full bg-primary-100 px-4 py-1.5 text-[.76rem] font-bold tracking-[.1em] text-primary-800 uppercase on-dark:bg-white/15 on-dark:text-white"><i class="block size-1.5 rounded-full bg-pop-500"></i>${esc(t)}</span>` : ''),
  rule: () => '<span class="flex gap-1.5" aria-hidden="true"><i class="block size-2 rounded-full bg-pop-500"></i><i class="block size-2 rounded-full bg-primary-400"></i><i class="block size-2 rounded-full bg-primary-200"></i></span>',
  check: (cls = 'bg-primary-100 text-primary-700') => `<span class="mt-0.5 grid size-[1.5rem] shrink-0 place-items-center rounded-full ${cls}">${icon('check', 'size-3 stroke-[3.5]')}</span>`,
  // a list: a chip for each line
  checklist: (list) => `<ul class="m-0 flex list-none flex-wrap gap-2.5 p-0">${list.map((t) => `<li class="inline-flex items-start gap-2.5 rounded-[1.4rem] bg-surface py-2.5 pr-5 pl-3 text-[.97rem] leading-snug font-semibold text-primary-950 shadow-[0_1px_2px_rgb(15_23_42/.06)] ring-1 ring-primary-100 on-dark:bg-white/12 on-dark:text-white on-dark:ring-white/20">${X.check()}<span>${esc(typeof t === 'string' ? t : t.title || t.text || '')}</span></li>`).join('')}</ul>`,
  listPanel: (lines) => `<div data-k-reveal>${X.checklist(lines)}</div>`,
  arrowLink: (label) => `<span class="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-primary-50 py-2 pr-2 pl-4 text-[.92rem] font-bold text-primary-800 transition duration-300 group-hover/card:bg-primary-600 group-hover/card:text-white">${esc(label)}<span class="grid size-7 place-items-center rounded-full bg-surface text-primary-700 transition duration-300 group-hover/card:translate-x-0.5">${icon('arrow', 'size-3.5')}</span></span>`,
  // a photograph: very round, on a white rim, a soft cloud of the theme's colours behind it
  photo: (K, src, alt, { cls = '' } = {}) => `<div class="relative ${cls}" data-k-reveal="zoom"><div class="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-linear-to-br from-primary-200/70 to-pop-200/60 blur-2xl"></div><div class="overflow-hidden rounded-[calc(var(--k-r)*1.35)] ring-[6px] ring-white ${C.PICSHADOW} [&_img]:h-auto [&_img]:max-h-[34rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div>`,
  mark: (K, src, alt, cls = '') => `<div class="grid w-fit place-items-center rounded-[calc(var(--k-r)*1.3)] bg-surface p-[clamp(1.25rem,3vw,2.25rem)] ${C.SHADOW} [&_img]:h-auto [&_img]:max-h-56 [&_img]:max-w-full ${cls}" data-k-reveal="zoom">${K.img(src, alt || '')}</div>`,

  // cards: the picture sits inside the card on a rim; the link is a pill
  cards: (s, K) => {
    const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
    const hasPics = list.some((c) => c.img);
    const Hn = s.title ? 'h3' : 'h2';
    const cell = (c, i) => {
      const label = c.title || c.text || c.label || '';
      const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
      const more = c.href ? X.arrowLink(c.cta || 'Learn more') : '';
      const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
      if (!c.img) return X.shell(`${X.tile(K, { ...c, photo: true }, i) || X.numMark(i)}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}`, { href: c.href, i, cls: 'grid content-start gap-4 p-[clamp(1.4rem,2.5vw,2rem)]', step: 90 });
      return X.shell(`<div class="relative"><div class="aspect-[16/11] overflow-hidden rounded-[calc(var(--k-r)*.72)] [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.07]">${K.img(c.img, c.imgAlt || label)}</div>${ownIcon ? `<span class="absolute -bottom-6 left-4 grid size-[3.4rem] place-items-center rounded-full ${K.dims?.[ownIcon]?.light ? 'bg-linear-to-br from-primary-500 to-primary-700' : 'bg-surface'} ring-4 ring-white [&_img]:size-8 [&_img]:object-contain">${K.img(ownIcon, '')}</span>` : ''}</div><div class="grid flex-1 content-start gap-2.5 px-3 pb-3 ${ownIcon ? 'pt-10' : 'pt-5'}"><${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}</div>`, { href: c.href, i, cls: 'flex flex-col p-3', step: 90, per: 3, reveal: 'zoom' });
    };
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: !s.small })}<div class="grid ${C.GAP} ${X.colsOf(list.length, { small: s.small, pics: hasPics })}">${list.map((c, i) => cell(c, i)).join('')}</div></div></section>`;
  },
  // a point with a line of its own: a soft tile of the brand's palest colour
  featureCard: (K, x, i, Hn) => `<div class="group/card grid content-start gap-3.5 rounded-[var(--k-r)] bg-linear-to-br from-primary-50 to-surface p-7 ring-1 ring-primary-100 transition duration-500 hover:-translate-y-1.5 hover:ring-primary-300" data-k-reveal="zoom" style="transition-delay:${(i % 3) * 90}ms">${X.tile(K, x, i, 'benefits') || X.numMark(i)}<${Hn} class="${C.H3}">${esc(x.title)}</${Hn}>${x.text ? `<p class="${C.P} text-[.97rem]">${esc(x.text)}</p>` : ''}</div>`,
  // a heading and a longer text: the heading over the text, both in one calm column
  textTitled: (sh, K, p) => `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="mx-auto grid max-w-4xl gap-6"><div class="grid justify-items-center gap-4 text-center">${p.label}${p.heading}</div><div class="grid gap-5" data-k-reveal>${X.flow(sh.s, K)}${p.list}</div></div></div></section>`,
  // steps: cards in a row, a round number each, a dotted line running behind them
  steps: (s, K) => {
    const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
    const Hn = s.title || !K.real ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true, word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="relative m-0 grid list-none ${C.GAP} p-0 before:absolute before:inset-x-12 before:top-[3.1rem] before:hidden before:border-t-2 before:border-dashed before:border-primary-200 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] lg:before:block">${list.map((t, i) => `<li class="group/card ${C.CARD} ${C.LIFT} grid content-start justify-items-center gap-3.5 p-7 text-center" data-k-reveal="zoom" style="transition-delay:${i * 110}ms"><span class="grid size-12 place-items-center rounded-full bg-linear-to-br from-primary-500 to-primary-700 font-display text-[1.05rem] font-bold text-white ring-[6px] ring-primary-50">${i + 1}</span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
  },
  // figures: glass tiles on a gradient panel of the brand set into the page
  stats: (s, K) => {
    const list = statsOf(s);
    const figures = `<dl class="m-0 grid gap-4 ${s.img || list.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]'}">${list.map((x, i) => `<div class="grid content-center justify-items-center gap-2 rounded-[calc(var(--k-r)*.85)] bg-white/10 px-4 py-7 text-center ring-1 ring-white/20 backdrop-blur-md" data-k-reveal="zoom" style="transition-delay:${i * 110}ms"><dd class="order-first m-0 font-display text-[clamp(2.2rem,1.4rem+2.4vw,3.6rem)] leading-none font-bold tracking-tight text-white" data-count="${esc(x.value)}">${esc(x.value)}</dd><dt class="text-[.95rem] leading-snug font-semibold text-white/80">${esc(x.label)}</dt></div>`).join('')}</dl>`;
    return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="${C.DEEP} rounded-[calc(var(--k-r)*1.4)] p-[clamp(1.25rem,3.5vw,3.25rem)] shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--th-primary-900)_75%,transparent)]" data-k-reveal="zoom">${s.title ? `<div class="mb-[clamp(1.25rem,3vw,2.25rem)] grid justify-items-center gap-4 text-center">${X.h2(s.title, 'text-white', 'text-pop-200')}</div>` : ''}${s.img ? `<div class="grid items-center gap-[clamp(1.25rem,3vw,2.5rem)] lg:grid-cols-[1.5fr_1fr]">${figures}<div class="overflow-hidden rounded-[calc(var(--k-r)*.85)] ring-4 ring-white/25 [&_img]:h-auto [&_img]:max-h-72 [&_img]:w-full [&_img]:object-cover">${K.img(s.img, s.imgAlt || '')}</div></div>` : figures}</div></div></section>`;
  },
  // a review: who said it first, then what was said
  reviewCard: (r, i, cls = '') => `<figure class="${C.CARD} m-0 grid content-start gap-5 p-7 ${cls}" data-k-reveal="zoom" style="transition-delay:${(i % 3) * 100}ms"><figcaption class="flex items-center gap-3.5"><span class="grid size-12 shrink-0 place-items-center rounded-full bg-linear-to-br from-primary-500 to-primary-800 font-display text-sm font-bold text-white ring-4 ring-primary-50">${esc(initialsOf(r.name))}</span><span class="grid"><b class="text-primary-950">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-muted">${esc(r.place || r.role)}</small>` : ''}</span><span class="ml-auto">${stars()}</span></figcaption><blockquote class="m-0 rounded-[calc(var(--k-r)*.7)] rounded-tl-md bg-primary-50 p-5 text-[1.02rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></figure>`,
  scrollBtn: (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="grid size-12 place-items-center rounded-full bg-surface text-primary-800 ${C.SHADOW} transition hover:bg-primary-600 hover:text-white">${icon('arrow', dir === 'prev' ? 'size-5 rotate-180' : 'size-5')}</button>`,
  faqRow: (f, i) => `<details class="group rounded-[1.6rem] bg-surface ring-1 ring-primary-100 transition duration-300 open:shadow-[0_24px_48px_-30px_color-mix(in_srgb,var(--th-primary-900)_45%,transparent)] open:ring-primary-300"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 70}ms"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 py-4 pr-4 pl-6 font-display text-[1.06rem] leading-snug font-[var(--k-h-weight)] text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="grid size-10 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700 transition duration-300 group-open:rotate-45 group-open:bg-linear-to-br group-open:from-primary-500 group-open:to-primary-700 group-open:text-white">${icon('plus', 'size-4')}</span></summary><div class="px-6 pb-6">${answerOf(f.a)}</div></details>`,
  faqRows: (list) => `<div class="grid gap-3">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`,
  // the closing call: a gradient panel of the brand set into the page, everything centred
  cta: (s, K) => {
    const q = quoteTo(s, K), c = callTo(K);
    const pic = X.ctaPic(s, K);
    return `<section class="relative py-[clamp(3rem,6vw,5rem)]"><div class="${C.WRAP}"><div class="${C.DEEP} grid justify-items-center gap-6 rounded-[calc(var(--k-r)*1.5)] px-[clamp(1.5rem,5vw,5rem)] py-[clamp(2.75rem,6vw,5rem)] text-center shadow-[0_40px_80px_-40px_color-mix(in_srgb,var(--th-primary-900)_80%,transparent)]" data-k-reveal="zoom">${pic}<div class="grid max-w-3xl justify-items-center gap-4">${X.h2(s.title || 'Ready to get started?', 'text-white', 'text-pop-200')}${s.text ? `<p class="text-[1.08rem] leading-relaxed text-white/85">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap justify-center gap-3.5">${btn(q, 'bg-surface text-primary-800 shadow-[0_14px_30px_-12px_rgb(0_0_0/.45)] hover:bg-pop-100', true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></div></section>`;
  },
  // a banner line: a pill of the brand's colour
  callout: (s, K) => {
    const { say, act } = X.calloutParts(s, K, 'bg-surface text-primary-800 hover:bg-pop-100');
    return `<section class="k-same relative py-[clamp(1.25rem,3vw,2rem)]"><div class="${C.WRAP}"><div class="on-dark flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[clamp(1.5rem,4vw,999px)] bg-linear-to-r from-primary-600 to-primary-800 py-[clamp(.9rem,2vw,1.15rem)] pr-[clamp(1rem,2vw,1.25rem)] pl-[clamp(1.25rem,3vw,2.25rem)] text-white shadow-[0_24px_48px_-26px_color-mix(in_srgb,var(--th-primary-700)_80%,transparent)]" data-k-reveal="zoom"><p class="m-0 flex items-center gap-3.5 font-display text-[clamp(1.08rem,1rem+.6vw,1.4rem)] leading-snug font-[var(--k-h-weight)]"><span class="grid size-10 shrink-0 place-items-center rounded-full bg-white/20">${icon('check', 'size-5 stroke-[3]')}</span>${esc(say)}</p>${act}</div></div></section>`;
  },
  // a statement: on a soft tile of its own
  textShort: (sh, K, p) => `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="mx-auto grid max-w-3xl justify-items-center gap-5 text-center">${p.label}${p.heading}<div class="${C.LEAD} [&_.not-prose]:justify-center" data-p="content" data-k-reveal="zoom">${bodyOf(sh.s)}</div></div></div></section>`,
  map: (s) => { const frame = s.html ? mapFrame(s.html) : `<div class="grid h-full place-items-center bg-primary-50"><span class="grid size-16 place-items-center rounded-full bg-popbtn text-white shadow-lg">${icon('pin', 'size-7')}</span></div>`; return `<section class="relative px-[clamp(.5rem,1.6vw,1.5rem)] pt-[clamp(1rem,3vw,2rem)]" aria-label="Map"><div class="h-[clamp(20rem,40vw,28rem)] w-full overflow-hidden rounded-[clamp(1.5rem,3vw,2.75rem)] [&_iframe]:block [&_iframe]:size-full [&_iframe]:border-0" data-k-reveal="zoom">${frame}</div></section>`; },
  wayRow: (K, c, i) => { const href = X.wayHref(c); const inner = `${X.wayMark(K, c)}<span class="grid gap-0.5"><b class="font-display text-[1.02rem] text-primary-950">${esc(c.label)}</b><span class="${C.P} text-[.98rem]">${esc(c.value)}</span></span>`; const cls = `group/card ${C.CARD} ${C.LIFT} flex items-center gap-4 rounded-[1.75rem] p-3.5 pr-6`; return `<li data-k-reveal="zoom" style="transition-delay:${i * 90}ms">${href ? `<a class="${cls}" href="${esc(href)}">${inner}</a>` : `<div class="${cls}">${inner}</div>`}</li>`; },
}));
const { WRAP, POP, LINE } = C;
// the bands of a page: white, then a tinted panel set into the page, in turn
const TONES = { alt: TINT, tint: TINT, dark: `${PANEL} bg-primary-950 text-white on-dark`, brand: `${PANEL} bg-linear-to-br from-primary-600 to-primary-900 text-white on-dark`, rotation: ['alt', 'none'] };

// ---------- hero ----------
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap justify-center gap-2.5 p-0 text-[.93rem] font-semibold text-primary-950">${list.map((t) => `<li class="inline-flex items-center gap-2.5 rounded-full bg-white/80 py-2 pr-4 pl-2.5 ring-1 ring-primary-100 backdrop-blur">${X.check()}${esc(t)}</li>`).join('')}</ul>` : '');
// the picture or the video of a hero on a wide rounded card, the website's figures on glass chips at its corners
function stage(h, K, { facts = true, ratio = 'aspect-[4/3] sm:aspect-[21/9]' } = {}) {
  if (!h.image?.src && !h.video?.src) return '';
  const f = facts ? factsOf(K).slice(0, 2) : [];
  const chip = (x, pos, d) => `<div class="absolute ${pos} grid gap-0.5 rounded-[1.5rem] bg-white/90 px-5 py-4 shadow-[0_24px_48px_-22px_color-mix(in_srgb,var(--th-primary-900)_60%,transparent)] ring-1 ring-white/70 backdrop-blur-md max-sm:hidden" data-k-reveal="zoom" style="transition-delay:${d}ms"><b class="font-display text-[1.9rem] leading-none font-bold text-primary-700" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="max-w-[15ch] text-[.8rem] leading-snug font-semibold text-primary-950">${esc(x.label)}</span></div>`;
  return `<div class="relative mx-auto w-full max-w-6xl" data-k-reveal="zoom" style="transition-delay:300ms"><div class="relative ${ratio} overflow-hidden rounded-[calc(var(--k-r)*1.5)] bg-primary-100 ring-[7px] ring-white/85 shadow-[0_50px_100px_-50px_color-mix(in_srgb,var(--th-primary-900)_70%,transparent)] [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover" data-k-img><div class="${web(K).motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}</div>${videoBg(h).replace('-z-20', '')}${h.video ? vPause('right-4 bottom-4') : ''}</div>${f[0] ? chip(f[0], '-bottom-6 left-[5%]', 700) : ''}${f[1] ? chip(f[1], '-top-6 right-[5%]', 850) : ''}</div>`;
}
// the links the old hero offered: round tiles in a row under the picture
const quick = (h, K) => (h.cards?.items?.length ? `<div class="mx-auto w-full max-w-6xl" data-k-reveal style="transition-delay:450ms">${h.cards.title ? `<p class="mb-4 text-center font-display text-[1.15rem] leading-tight font-[var(--k-h-weight)] text-primary-950">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-4 lg:grid-cols-8">${h.cards.items.map((c) => { const label = c.text || c.title || c.label || ''; const inner = `${c.img ? `<span class="grid size-11 place-items-center [&_img]:size-full [&_img]:object-contain">${K.img(c.img, c.imgAlt || '')}</span>` : ''}<span>${esc(label)}</span>`; const cls = `grid h-full content-start justify-items-center gap-2 rounded-[1.4rem] bg-surface px-2 py-3.5 text-center text-[.8rem] leading-tight font-bold text-primary-950 ${C.SHADOW} transition duration-500`; return `<li>${c.href ? `<a class="${cls} hover:-translate-y-1.5 hover:text-primary-700" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`; }).join('')}</ul></div>` : '');

const hero = {
  // the home page: the words centred over soft clouds of the theme's colours, the picture or the video on a wide rounded card under them
  'lm-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.2rem,1.1rem+3.4vw,4rem)] leading-[1.06]' : 'text-[clamp(2.8rem,1.2rem+5vw,5.2rem)] leading-[1.03]';
    return `<section class="relative isolate overflow-hidden bg-[color-mix(in_srgb,var(--th-primary-50)_70%,var(--th-bg))]">${CLOUDS}<div class="${WRAP} grid grid-cols-[minmax(0,1fr)] gap-[clamp(2rem,4vw,3.25rem)] pt-[clamp(3rem,6vw,5rem)] pb-[clamp(3rem,6vw,5rem)]"><div class="mx-auto grid max-w-4xl justify-items-center gap-6 text-center">${X.eyebrow(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-2xl text-[clamp(1.08rem,1rem+.4vw,1.28rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap justify-center gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, LINE, false, true) : ''}</div><div data-k-reveal style="transition-delay:380ms">${bullets(h.bullets)}</div></div>${stage(h, K)}${quick(h, K)}</div></section>`;
  },
  // an inner page: the trail on a pill, the title and the page's actions centred over the clouds; the page's picture or video on a card under them
  'lm-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-primary-950">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-primary-700" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<span aria-hidden="true" class="text-primary-300">•</span>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(1.9rem,1.1rem+2.6vw,3.1rem)]' : 'text-[clamp(2.3rem,1.2rem+3.8vw,4.1rem)]';
    return `<section class="relative isolate overflow-hidden bg-[color-mix(in_srgb,var(--th-primary-50)_70%,var(--th-bg))]">${CLOUDS}<div class="${WRAP} grid grid-cols-[minmax(0,1fr)] gap-[clamp(2rem,4vw,3rem)] pt-[clamp(2.5rem,5vw,4rem)] pb-[clamp(2.75rem,5.5vw,4.5rem)]"><div class="mx-auto grid max-w-4xl justify-items-center gap-5 text-center"><nav class="flex flex-wrap items-center justify-center gap-2.5 rounded-full bg-white/80 px-5 py-2 text-[.84rem] font-semibold text-secondary ring-1 ring-primary-100 backdrop-blur" aria-label="Breadcrumb">${crumbs}</nav><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap justify-center gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${X.callBtn(K, LINE)}</div></div>${stage(h, K, { facts: false, ratio: 'aspect-[16/10] sm:aspect-[21/8]' })}</div></section>`;
  },
};

// ---------- header and footer ----------
const logo = (K, dark = false) => `<a class="inline-flex items-center gap-3 font-display text-[1.3rem] leading-none font-bold tracking-tight ${dark ? 'text-white' : 'text-primary-950'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto ${dark ? 'max-h-24' : 'max-h-12'} w-auto" src="${esc(K.u((dark && K.site.footerLogo) || K.site.logo))}" alt="${esc(K.site.name)}"${dark ? ' loading="lazy"' : ''}>` : `<span class="grid size-10 place-items-center rounded-full bg-linear-to-br from-primary-500 to-primary-800 text-[1.05rem] text-white">${esc(String(K.site.name || '?').trim()[0] || '?')}</span><span>${esc(K.site.name)}</span>`}</a>`;
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[.95rem] font-semibold whitespace-nowrap text-primary-950 transition duration-300 hover:bg-primary-100 hover:text-primary-800 aria-[current]:bg-primary-100 aria-[current]:text-primary-800',
  panel: 'rounded-[1.6rem] bg-surface p-2.5 shadow-[0_30px_60px_-24px_color-mix(in_srgb,var(--th-primary-950)_50%,transparent)] ring-1 ring-primary-100',
  item: 'flex items-center justify-between gap-3 rounded-full px-4 py-2.5 text-[.93rem] font-semibold text-primary-950 transition hover:bg-primary-50 hover:text-primary-700',
  more: 'rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100',
};
// the strip over the header: what the website says first and its phone, on the brand's palest colour
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-bold text-primary-800 transition hover:text-primary-600" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-pop-600')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `${say.icon ? icon(say.icon, 'size-3.5 text-pop-600') : ''}${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="bg-[color-mix(in_srgb,var(--th-primary-50)_70%,var(--th-bg))] text-primary-900"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pt-2.5 pb-1 text-[.82rem] font-semibold max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  // a header that floats: a pill of frosted glass that stays with the reader
  lm: (K) => `${strip(K)}<header class="sticky top-0 z-50 bg-[color-mix(in_srgb,var(--th-primary-50)_70%,var(--th-bg))] px-[clamp(.5rem,1.6vw,1.5rem)] py-2.5 transition duration-300 data-[scrolled]:bg-transparent" data-k-header><div class="mx-auto flex max-w-[calc(var(--k-wrap,76rem)+2rem)] items-center gap-5 rounded-full bg-white/90 py-2 pr-2.5 pl-5 shadow-[0_18px_40px_-22px_color-mix(in_srgb,var(--th-primary-950)_45%,transparent)] ring-1 ring-primary-100 backdrop-blur-xl" data-p="bar">${logo(K)}<nav class="mx-auto flex items-center gap-0.5 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, false)}</span><button class="ml-auto grid size-11 place-items-center rounded-full bg-primary-100 text-primary-900 lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // the website's own footer as a rounded gradient panel set into the page
  lm: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-4 font-display text-[1.05rem] font-bold text-white', li = 'transition hover:text-white';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2.5 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-11 place-items-center rounded-full bg-white/12 ring-1 ring-white/20 transition duration-300 hover:-translate-y-1 hover:bg-white/25" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-full bg-white/12 px-4 py-2 text-[.84rem] font-semibold text-white ring-1 ring-white/20 transition hover:bg-white hover:text-primary-900" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-2.5 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-200')}<a class="${li} font-semibold text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-200')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-200')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-200')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-200')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.3fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="px-[clamp(.5rem,1.6vw,1.5rem)] pt-[clamp(1rem,3vw,2.5rem)] pb-[clamp(.5rem,1.6vw,1.5rem)] max-sm:pb-20"><div class="${C.DEEP} rounded-[clamp(1.5rem,3vw,2.75rem)] pt-[clamp(3rem,6vw,5rem)] text-white/75"><div class="${WRAP}"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/15 py-6 text-[.86rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-full bg-white/12 px-4 py-1.5 text-[.72rem] font-bold tracking-[.1em] uppercase ring-1 ring-white/25 transition hover:bg-white/25">Pause animations</button>'}</span></div></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'lm-');
export const LUMEN = {
  design: {
    id: 'lumen', name: 'Lumen', badge: 'Soft & friendly', blurb: 'Round and light: a header that floats as a pill, a centred headline over soft clouds of the brand colours with the picture or the video on a wide rounded card, tinted panels set into the page, cards that rise into a glow, lists as chips and figures on glass. Sections bloom out of a blur.',
    fonts: { heading: 'Outfit', body: 'Figtree' }, vars: { '--k-r': '1.75rem', '--k-r-btn': '999px', '--k-h-weight': '600', '--k-h-track': '-.03em' },
    header: 'lm', footer: 'lm', offered: true, anim: 'bloom', ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
