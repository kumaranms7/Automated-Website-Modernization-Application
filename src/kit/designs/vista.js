import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, num, statsOf, introHtml, answerOf, initialsOf } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays, glowAt } from './base.js';
import { stars } from '../ui.js';

// VISTA: open and airy. The hero has no frame at all: the words stand on a pale ground that carries the website's pattern, and the
// picture or the video melts into that ground from the right edge of the page; the figures of the business stand on a card with the
// gradient border and its light, set over the picture. Sections are flat bands, white and a very pale shade of the brand colour in turn.
// Headings carry a fine line, their accent words a marker's stroke; cards carry the gradient border and its light, pictures a second
// outline set a little off; steps and figures are set in type alone, over hairlines. What comes into view settles into place from a
// little too large, and a picture draws nearer inside its frame (the "settle" motion of the stylesheet). Its colours are the website's
// theme. Layout names start with vs-.

const MIST = 'bg-[color-mix(in_srgb,var(--th-primary-50)_48%,var(--th-bg))]';
const PAT_LIGHT = '<i class="k-pat-layer k-pat-all [--k-pat-ink:#fff] [--k-pat-o:.1]" aria-hidden="true"></i>';
const PANEL = 'relative rounded-[var(--k-r)] border border-primary-100 bg-surface transition duration-300';
const SOFT = 'shadow-[0_24px_50px_-34px_color-mix(in_srgb,var(--th-primary-900)_50%,transparent)]';

const { X, C } = sections({
  SHADOW: SOFT, PLAIN: PANEL, CARD: `k-glow ${PANEL}`,
  LIFT: 'hover:-translate-y-1.5 hover:shadow-[0_34px_60px_-34px_color-mix(in_srgb,var(--th-primary-900)_60%,transparent)]',
  TILE: 'grid size-12 shrink-0 place-items-center rounded-[.8rem] border border-primary-200 bg-surface text-primary-700 transition duration-300',
  DEEP: 'on-dark relative isolate overflow-hidden bg-primary-800 text-white',
  // (the accent words of a heading stand under a marker's stroke)
  TONE: 'k-marker text-primary-950 on-dark:bg-none on-dark:text-pop-300',
  NUM: 'font-display text-[.82rem] font-bold tracking-[.2em] text-primary-600',
  UNDERHERO: 'py-[clamp(2.5rem,5vw,4.5rem)]',
}, (X, C) => ({
  eyebrow: (t) => (t ? `<span class="inline-flex w-fit items-center gap-3 text-[.76rem] font-bold tracking-[.2em] text-primary-700 uppercase on-dark:text-pop-200"><i class="block h-px w-9 bg-current"></i>${esc(t)}</span>` : ''),
  rule: () => '<span class="block h-px w-16 bg-primary-600 on-dark:bg-white/60" aria-hidden="true"></span>',
  check: (cls = 'text-primary-700') => `<span class="mt-0.5 grid size-[1.4rem] shrink-0 place-items-center rounded-full border border-current ${cls}">${icon('check', 'size-3 stroke-[3.5]')}</span>`,
  // "learn more": the words and an arrow whose line grows
  arrowLink: (label) => `<span class="mt-auto inline-flex items-center gap-3 pt-1 text-[.93rem] font-bold text-primary-800 on-dark:text-white">${esc(label)}<span class="inline-flex items-center text-primary-600 transition duration-300 group-hover/card:translate-x-1.5 on-dark:text-pop-200"><i class="block h-px w-6 bg-current transition-all duration-300 group-hover/card:w-10"></i>${icon('arrow', '-ml-1.5 size-3.5')}</span></span>`,
  // a photograph: a second outline of its frame, set a little off
  photo: (K, src, alt, { side = '', cls = '' } = {}) => `<div class="relative isolate ${cls}" data-k-reveal="zoom"><i class="pointer-events-none absolute inset-0 -z-10 block ${side === 'right' ? '-translate-x-4' : 'translate-x-4'} translate-y-4 rounded-[calc(var(--k-r)*1.2)] border border-primary-300" aria-hidden="true"></i><div class="overflow-hidden rounded-[calc(var(--k-r)*1.2)] ${C.PICSHADOW} [&_img]:h-auto [&_img]:max-h-[34rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div>`,
  // cards: the picture at the head of each with its number on it, the words under it
  cards: (s, K) => {
    const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
    const n = list.length, hasPics = list.some((c) => c.img);
    const Hn = s.title ? 'h3' : 'h2';
    const cell = (c, i) => {
      const label = c.title || c.text || c.label || '';
      const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
      const more = c.href ? X.arrowLink(c.cta || 'Learn more') : '';
      const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
      const chip = ownIcon ? `<span class="absolute right-3 bottom-3 z-[1] grid size-11 place-items-center rounded-[.7rem] ${K.dims?.[ownIcon]?.light ? 'bg-primary-700' : 'bg-white'} shadow-[0_10px_24px_-10px_rgb(0_0_0/.45)] [&_img]:size-6! [&_img]:object-contain!">${K.img(ownIcon, '')}</span>` : '';
      if (c.img) return X.shell(`<div class="relative overflow-hidden rounded-t-[inherit]">${chip}<div class="aspect-[4/3] [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-[900ms] group-hover/card:[&_img]:scale-[1.06]">${K.img(c.img, c.imgAlt || label)}</div><span class="absolute top-3 left-3 rounded-full bg-primary-950/60 px-2.5 py-1 font-display text-[.72rem] font-bold tracking-[.16em] text-white backdrop-blur" aria-hidden="true">${num(i)}</span></div><div class="grid flex-1 content-start gap-2.5 p-5"><${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}</div>`, { href: c.href, i, cls: 'flex flex-col', step: 70, per: 4 });
      return X.shell(`${X.tile(K, { ...c, photo: true }, i) || X.numMark(i)}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}`, { href: c.href, i, cls: 'grid content-start gap-3.5 p-[clamp(1.4rem,2.5vw,2rem)]', step: 70 });
    };
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: false })}<div class="grid ${C.GAP} ${X.colsOf(n, { small: s.small, pics: hasPics })}">${list.map(cell).join('')}</div></div></section>`;
  },
  // steps: set in type alone - a large numeral in outline over a hairline for each
  steps: (s, K) => {
    const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
    const Hn = s.title || !K.real ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="m-0 grid list-none gap-x-[clamp(1.25rem,2.5vw,2.25rem)] gap-y-9 p-0 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">${list.map((t, i) => `<li class="group/card grid content-start gap-3 border-t border-primary-200 pt-5 transition-colors duration-500 hover:border-primary-600" data-k-reveal style="transition-delay:${i * 90}ms"><span class="font-display text-[clamp(2.6rem,1.8rem+2.4vw,3.8rem)] leading-none font-[var(--k-h-weight)] text-transparent transition-colors duration-500 [-webkit-text-stroke:1.5px_var(--th-primary-400)] group-hover/card:text-primary-600" aria-hidden="true">${num(i)}</span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
  },
  // figures: large numerals over hairlines; the picture that stood beside them keeps its place
  stats: (s, K) => {
    const list = statsOf(s);
    const cols = list.length === 2 ? 'grid-cols-2' : list.length === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4';
    const cells = list.map((x, i) => `<li class="grid content-start gap-3 border-t-2 border-primary-200 pt-5 transition-colors duration-500 hover:border-primary-600" data-k-reveal style="transition-delay:${i * 90}ms"><b class="font-display text-[clamp(2.3rem,1.4rem+2.8vw,4rem)] leading-none font-[var(--k-h-weight)] tracking-[-.04em] text-primary-900" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="max-w-[15rem] text-[.98rem] leading-snug font-medium text-secondary">${esc(x.label)}</span></li>`).join('');
    const pic = s.img ? `<div class="overflow-hidden rounded-[calc(var(--k-r)*1.2)] ${C.PICSHADOW} [&_img]:size-full [&_img]:max-h-72 [&_img]:object-cover lg:[&_img]:max-h-80" data-k-reveal="zoom"><div data-k-img>${K.img(s.img, s.imgAlt || '')}</div></div>` : '';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${s.title ? `<div class="${C.HEADGAP} grid max-w-3xl gap-4">${X.rule()}${X.h2(s.title)}</div>` : ''}${pic ? `<div class="grid items-center gap-[clamp(2rem,4vw,4rem)] lg:grid-cols-[1.5fr_1fr]"><ul class="m-0 grid list-none gap-x-8 gap-y-9 p-0 ${cols.replace('lg:grid-cols-4', '')}">${cells}</ul>${pic}</div>` : `<ul class="m-0 grid list-none gap-x-8 gap-y-9 p-0 ${cols}">${cells}</ul>`}</div></section>`;
  },
  reviewCard: (r, i, cls = '') => `<figure class="${C.CARD} m-0 grid content-between gap-6 p-7 ${cls}" data-k-reveal style="transition-delay:${(i % 3) * 80}ms;${glowAt(i)}"><div class="grid gap-4"><span class="font-display text-[3.2rem] leading-[.6] font-bold text-primary-300" aria-hidden="true">“</span><blockquote class="m-0 text-[1.05rem] leading-relaxed text-primary-950">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center justify-between gap-4 border-t border-primary-100 pt-5"><span class="flex items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-[.7rem] border border-primary-200 font-display text-sm font-bold text-primary-700">${esc(initialsOf(r.name))}</span><span class="grid"><b class="text-primary-950">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-muted">${esc(r.place || r.role)}</small>` : ''}</span></span>${stars()}</figcaption></figure>`,
  scrollBtn: (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="grid size-12 place-items-center rounded-[.8rem] border border-primary-200 bg-surface text-primary-900 transition hover:border-primary-700 hover:bg-primary-700 hover:text-white">${icon('arrow', dir === 'prev' ? 'size-5 rotate-180' : 'size-5')}</button>`,
  faqRow: (f, i) => `<details class="group k-glow ${C.PLAIN} open:shadow-[0_24px_50px_-34px_color-mix(in_srgb,var(--th-primary-900)_50%,transparent)]"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 50}ms;${glowAt(i)}"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 py-[1.15rem] pr-5 pl-6 font-display text-[1.08rem] leading-snug font-[var(--k-h-weight)] text-primary-950 marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="grid size-9 shrink-0 place-items-center text-primary-700 transition duration-300 group-open:rotate-45">${icon('plus', 'size-5')}</span></summary><div class="px-6 pb-6">${answerOf(f.a)}</div></details>`,
  faqRows: (list) => `<div class="grid gap-3">${list.map((f, i) => X.faqRow(f, i)).join('')}</div>`,
  // the closing call: a band of the brand's colour across the whole page, with the pattern in white
  cta: (s, K) => {
    const q = quoteTo(s, K), c = callTo(K);
    const pic = s.img ? `<span class="grid size-[clamp(4.5rem,8vw,6.5rem)] shrink-0 place-items-center rounded-[calc(var(--k-r)*1.1)] bg-surface p-3 shadow-[0_24px_44px_-20px_rgb(0_0_0/.5)] max-lg:justify-self-start [&_img]:size-full [&_img]:object-contain">${K.img(s.img, s.imgAlt || '')}</span>` : '';
    return `<section class="on-dark relative isolate overflow-hidden bg-primary-700 py-[clamp(3rem,6vw,5rem)] text-white">${PAT_LIGHT}<div class="${C.WRAP} grid items-center gap-8 ${pic ? 'lg:grid-cols-[auto_1.5fr_auto]' : 'lg:grid-cols-[1.5fr_auto]'}" data-k-reveal>${pic}<div class="grid gap-4">${X.h2(s.title || 'Ready to get started?', 'text-white')}${s.text ? `<p class="max-w-2xl text-[1.08rem] leading-relaxed text-white/85">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap gap-3.5">${btn(q, 'bg-surface text-primary-800 shadow-[0_14px_30px_-12px_rgb(0_0_0/.45)] hover:bg-pop-100', true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></section>`;
  },
}));
const { WRAP, POP, LINE } = C;
// the bands of a page: white (the first, under the hero's pale ground), then a very pale shade of the brand colour, in turn
const TONES = { alt: `isolate ${MIST}`, tint: `isolate ${MIST}`, dark: 'on-dark isolate bg-primary-900 text-white', brand: 'on-dark isolate bg-primary-700 text-white', rotation: ['none', 'alt'] };

// ---------- hero ----------
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0 text-[.96rem] font-semibold text-primary-950" data-k-reveal style="transition-delay:260ms">${list.map((t) => `<li class="inline-flex items-center gap-2.5">${X.check()}${esc(t)}</li>`).join('')}</ul>` : '');
// the picture or the video of a hero: it reaches the edge of the page and melts into the ground towards the words (under 1024px it
// stands under them and melts upwards)
const media = (h, K, cls) => `<div class="${cls} max-lg:[mask-image:linear-gradient(180deg,transparent,#000_38%)] lg:[mask-image:linear-gradient(90deg,transparent_3%,rgb(0_0_0/.28)_30%,#000_64%)]" data-k-reveal="zoom" style="transition-delay:100ms"><div class="absolute inset-0 isolate overflow-hidden [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover"><div class="${web(K).motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}</div>${videoBg(h).replace('-z-20', '')}</div></div>`;
// the figures of the business on a card with the gradient border and its light (without figures, the way to call)
const facts = (K, cls) => {
  const list = factsOf(K).slice(0, 3), c = callTo(K);
  const body = list.length
    ? `<dl class="m-0 grid ${['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'][list.length]}">${list.map((x) => `<div class="grid content-start gap-1.5 px-[clamp(.85rem,1.6vw,1.4rem)] first:pl-0 last:pr-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-primary-100"><dt class="order-last text-[.8rem] leading-snug font-semibold text-secondary">${esc(x.label)}</dt><dd class="m-0 font-display text-[clamp(1.5rem,1.1rem+1.2vw,2.2rem)] leading-none font-[var(--k-h-weight)] tracking-[-.03em] text-primary-900" data-count="${esc(x.value)}">${esc(x.value)}</dd></div>`).join('')}</dl>`
    : c ? `<a class="flex items-center gap-4" href="${esc(c.href)}"><span class="grid size-12 shrink-0 place-items-center rounded-[.8rem] bg-primary-700 text-white">${icon('phone', 'size-5')}</span><span class="grid gap-1"><span class="text-[.76rem] font-bold tracking-[.16em] text-secondary uppercase">Call us</span><b class="font-display text-[clamp(1.3rem,1.1rem+.8vw,1.7rem)] leading-none font-[var(--k-h-weight)] text-primary-950">${esc(K.site.phone.display)}</b></span></a>` : '';
  return body ? `<div class="k-glow ${cls} z-10 rounded-[calc(var(--k-r)*1.2)] bg-white/90 p-[clamp(1.1rem,2vw,1.5rem)] shadow-[0_30px_60px_-30px_color-mix(in_srgb,var(--th-primary-950)_60%,transparent)] backdrop-blur-md" data-k-reveal style="transition-delay:340ms">${body}</div>` : '';
};
// the links the old hero offered: a white row across the foot of the hero, each link beside its own picture
const quick = (h, K) => {
  const list = h.cards?.items || [];
  if (!list.length) return '';
  const link = (c) => {
    const label = c.text || c.title || c.label || '';
    const inner = `${c.img ? `<span class="grid size-10 shrink-0 place-items-center rounded-[.7rem] border border-primary-200 ${K.dims?.[c.img]?.light ? 'bg-primary-700' : 'bg-surface'} transition duration-300 group-hover/q:-translate-y-0.5 group-hover/q:border-primary-600 [&_img]:size-6 [&_img]:object-contain">${K.img(c.img, c.imgAlt || '')}</span>` : `<i class="block h-px w-5 shrink-0 bg-primary-400 transition-all duration-300 group-hover/q:w-8 group-hover/q:bg-primary-700"></i>`}<span>${esc(label)}</span>`;
    const cls = 'group/q flex items-center gap-3 text-[.9rem] leading-tight font-semibold text-primary-950 transition duration-300 hover:text-primary-700';
    return `<li>${c.href ? `<a class="${cls}" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`;
  };
  return `<div class="relative border-t border-primary-100 bg-surface"><div class="${WRAP} grid items-center gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-5 py-[clamp(1.25rem,2.4vw,1.85rem)] ${h.cards.title ? 'lg:grid-cols-[minmax(0,13rem)_1fr]' : ''}" data-k-reveal style="transition-delay:380ms">${h.cards.title ? `<p class="m-0 font-display text-[clamp(1.1rem,1rem+.5vw,1.35rem)] leading-tight font-[var(--k-h-weight)] text-primary-950">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-4 p-0 sm:grid-cols-3 lg:grid-cols-4">${list.map(link).join('')}</ul></div></div>`;
};

const hero = {
  // the home page: the words on the patterned ground; the picture or the video melts into it from the right edge; the figures of the
  // business on a card over the picture; the website's quick links across the foot
  'vs-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.1rem,1.1rem+3.1vw,3.7rem)] leading-[1.06]' : 'text-[clamp(2.6rem,1.2rem+4.8vw,5rem)] leading-[1.03]';
    const has = Boolean(h.image?.src || h.video?.src);
    return `<section class="k-pat k-pat-tl relative isolate overflow-hidden [--k-pat-o:.2] ${MIST}"><div class="relative flex flex-col">${has ? media(h, K, 'relative max-lg:order-last max-lg:h-[clamp(15rem,62vw,26rem)] lg:absolute lg:inset-y-0 lg:right-0 lg:w-[62%]') : '<i class="k-pat-layer k-pat-tr [--k-pat-o:.2]" aria-hidden="true"></i>'}<div class="${WRAP} relative grid lg:min-h-[clamp(31rem,43vw,41rem)]"><div class="grid content-center justify-items-start gap-6 pt-[clamp(2.75rem,6vw,5.5rem)] pb-[clamp(1.5rem,6vw,5.5rem)] lg:w-[50%]">${X.eyebrow(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-2xl text-[clamp(1.06rem,1rem+.35vw,1.25rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3" data-k-reveal style="transition-delay:180ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, LINE, false, true) : ''}</div>${bullets(h.bullets)}</div>${facts(K, 'relative max-lg:mb-6 lg:absolute lg:right-0 lg:bottom-[clamp(1.5rem,3vw,2.5rem)] lg:max-w-[30rem]')}</div>${h.video ? vPause('right-5 top-5') : ''}</div>${quick(h, K)}</section>`;
  },
  // an inner page: the trail, the title and the page's actions on the patterned ground; the page's picture or video melts into it
  'vs-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-primary-950">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-primary-700" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<i class="block h-px w-4 bg-primary-300" aria-hidden="true"></i>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(1.9rem,1.1rem+2.6vw,3.1rem)]' : 'text-[clamp(2.3rem,1.2rem+3.6vw,3.9rem)]';
    const has = Boolean(h.image?.src || h.video?.src);
    return `<section class="k-pat k-pat-tl relative isolate overflow-hidden [--k-pat-o:.2] ${MIST}"><div class="relative flex flex-col">${has ? media(h, K, 'relative max-lg:order-last max-lg:h-[clamp(12rem,48vw,19rem)] lg:absolute lg:inset-y-0 lg:right-0 lg:w-[52%]') : '<i class="k-pat-layer k-pat-tr [--k-pat-o:.2]" aria-hidden="true"></i>'}<div class="${WRAP} relative grid lg:min-h-[clamp(15rem,20vw,19rem)]"><div class="grid content-center justify-items-start gap-5 py-[clamp(2.25rem,4.5vw,4rem)] ${has ? 'lg:w-[56%]' : 'max-w-4xl'}"><nav class="flex flex-wrap items-center gap-2.5 text-[.86rem] font-semibold text-secondary" aria-label="Breadcrumb">${crumbs}</nav><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-primary-950" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-secondary [&_a]:text-primary-700 [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3" data-k-reveal style="transition-delay:180ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${X.callBtn(K, LINE)}</div></div></div>${h.video ? vPause('right-5 top-5') : ''}</div></section>`;
  },
};

// ---------- header and footer ----------
const logo = (K, dark = false) => `<a class="inline-flex items-center gap-3 font-display text-[1.3rem] leading-none font-bold tracking-tight ${dark ? 'text-white' : 'text-primary-950'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto ${dark ? 'max-h-24' : 'max-h-12'} w-auto" src="${esc(K.u((dark && K.site.footerLogo) || K.site.logo))}" alt="${esc(K.site.name)}"${dark ? ' loading="lazy"' : ''}>` : `<span class="grid size-10 place-items-center rounded-[.7rem] border border-primary-300 text-[1.05rem] text-primary-800 ${dark ? 'border-white/40 text-white' : ''}">${esc(String(K.site.name || '?').trim()[0] || '?')}</span><span>${esc(K.site.name)}</span>`}</a>`;
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 px-3 py-2 text-[.95rem] font-semibold whitespace-nowrap text-primary-950 transition duration-300 after:absolute after:inset-x-3 after:bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-primary-700 after:transition after:duration-300 hover:text-primary-700 hover:after:scale-x-100 aria-[current]:text-primary-700 aria-[current]:after:scale-x-100',
  panel: `${PANEL} ${SOFT} p-2.5`,
  item: 'flex items-center justify-between gap-3 rounded-[.6rem] px-3.5 py-2.5 text-[.93rem] font-semibold text-primary-950 transition hover:bg-primary-50 hover:text-primary-700',
  more: 'rounded-[.6rem] bg-primary-50 text-primary-700 hover:bg-primary-100',
};
// the line over the header: what the website announces (else its hours, else its address) and its phone, in small type on white
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-bold text-primary-900 transition hover:text-primary-600" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-primary-600')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `${say.icon ? icon(say.icon, 'size-3.5 text-primary-600') : ''}${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="border-b border-primary-100 bg-surface text-secondary"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[.82rem] font-medium max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  // a white bar across the page that stays at its head: the logo, the menu with a fine line under the page you are on, the action
  vs: (K) => `${strip(K)}<header class="sticky top-0 z-50 border-b border-primary-100 bg-white/95 backdrop-blur-md transition duration-300 data-[scrolled]:shadow-[0_14px_34px_-24px_color-mix(in_srgb,var(--th-primary-950)_50%,transparent)]" data-k-header><div class="${WRAP} flex items-center gap-[clamp(1rem,2.5vw,2.5rem)] py-3.5" data-p="bar">${logo(K)}<nav class="ml-auto flex items-center gap-1 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, true)}</span><button class="ml-auto grid size-11 place-items-center rounded-[.7rem] border border-primary-200 bg-surface text-primary-950 transition hover:border-primary-700 lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // the website's own footer on the brand's deepest shade, its columns under fine lines
  vs: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-5 flex items-center gap-3 text-[.76rem] font-bold tracking-[.2em] text-white uppercase before:block before:h-px before:w-6 before:bg-pop-400', li = 'transition hover:text-white';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2.5 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-11 place-items-center rounded-[.7rem] border border-white/20 transition duration-300 hover:-translate-y-1 hover:border-white hover:bg-white/10" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-[.7rem] border border-white/20 px-4 py-2 text-[.84rem] font-semibold text-white transition hover:bg-white/10" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-2.5 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} font-bold text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.3fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="on-dark relative isolate overflow-hidden bg-primary-950 pt-[clamp(3.5rem,7vw,5.5rem)] text-white/70 max-sm:pb-20"><i class="k-pat-layer k-pat-tr [--k-pat-ink:#fff] [--k-pat-o:.07]" aria-hidden="true"></i><div class="${WRAP}"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/12 py-6 text-[.88rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-[.6rem] border border-white/25 px-3.5 py-1.5 text-[.72rem] font-bold tracking-[.1em] uppercase transition hover:bg-white/10">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'vs-');
export const VISTA = {
  design: {
    id: 'vista', name: 'Vista', badge: 'Open and airy', blurb: 'A hero without a frame: the words on a pale ground that carries the pattern of the business, and the picture or the video melting into that ground from the edge of the page, with the figures of the business on a card whose gradient border carries a travelling light. Cards carry the same border; headings stand over a fine line and their accent words under a marker\'s stroke; steps and figures are set in type alone. What comes into view settles into place.',
    fonts: { heading: 'Bricolage Grotesque', body: 'Instrument Sans' }, vars: { '--k-r': '.9rem', '--k-r-btn': '.65rem', '--k-h-weight': '700', '--k-h-track': '-.035em' },
    header: 'vs', footer: 'vs', offered: true, anim: 'settle', patterned: true, ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
