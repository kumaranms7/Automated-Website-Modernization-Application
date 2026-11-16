import { esc, icon, btn, items, quoteTo, callTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg, statsOf, groupsOf, introHtml, answerOf, initialsOf, formHead } from './shared.js';
import { sections, register, web, ctaOf, menuItem, stripSays } from './base.js';
import { stars } from '../ui.js';

// NOVA: dark and luminous. The whole page stands on the deepest shade of the brand colour (the "night" skin of the stylesheet turns the
// theme's shades round, so every section reads light on dark), with soft lights of the theme's two colours drifting behind it. Cards are
// glass: a light follows the pointer across them and along their edge. The hero shows its picture (or video) in a glass frame that leans
// towards the reader, the last words of a heading shine, figures are set in light, and the website's own form stays a sheet of white paper.
// What comes into view rises out of the dark with a flash (the "glow" motion). Layout names start with nv-.

const GLASS = 'relative rounded-[var(--k-r)] border border-white/10 bg-white/[.045] shadow-[inset_0_1px_0_rgb(255_255_255/.07)] backdrop-blur-md transition duration-500';
const HALO = 'shadow-[0_40px_90px_-40px_color-mix(in_srgb,var(--o-p-400)_70%,transparent)]';
// a hairline of light
const beam = '<i class="pointer-events-none block h-px w-full bg-linear-to-r from-transparent via-day-400/70 to-transparent" aria-hidden="true"></i>';
// the lights behind a hero: two soft clouds of the theme's colours that drift, and a faint grid that fades out
const LIGHTS = '<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true"><i class="k-drift absolute -top-64 left-[4%] block size-[46rem] rounded-full bg-day-500/30 blur-[110px]"></i><i class="k-drift absolute top-[18%] -right-48 block size-[40rem] rounded-full bg-pop-500/20 blur-[120px] [animation-delay:-8s]"></i><i class="absolute inset-0 block bg-[linear-gradient(rgb(255_255_255/.045)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/.045)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(60%_70%_at_50%_30%,#000,transparent)]"></i></div>';

const { X, C } = sections({
  SHADOW: 'shadow-[0_30px_60px_-30px_rgb(0_0_0/.7)]',
  PLAIN: GLASS, CARD: `k-spot ${GLASS}`,
  LIFT: 'hover:-translate-y-1.5 hover:border-white/25 hover:shadow-[0_30px_70px_-34px_color-mix(in_srgb,var(--o-p-400)_75%,transparent)]',
  // (a mark stands on a white chip: the website's own icons were drawn for a light ground)
  TILE: 'grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-day-700 shadow-[0_10px_26px_-10px_rgb(0_0_0/.7)] transition duration-300',
  GLASS: 'rounded-[calc(var(--k-r)*1.3)] border border-white/15 bg-white/[.07] shadow-[inset_0_1px_0_rgb(255_255_255/.14)] backdrop-blur-md',
  POP: 'bg-popbtn text-white shadow-[0_0_0_1px_rgb(255_255_255/.14)_inset,0_16px_44px_-12px_color-mix(in_srgb,var(--color-pop-500)_90%,transparent)] hover:brightness-110',
  BRAND: 'bg-day-600 text-white shadow-[0_16px_44px_-14px_color-mix(in_srgb,var(--o-p-400)_80%,transparent)] hover:bg-day-500',
  LINE: 'border-white/25 bg-white/[.06] text-white backdrop-blur-md hover:border-white/60 hover:bg-white/[.12]',
  GLASSBTN: 'border-white/25 bg-white/[.06] text-white backdrop-blur-md hover:border-white/60 hover:bg-white/[.12]',
  SEC: 'relative py-[calc(var(--k-sec-y)*.85)]',
  PICSHADOW: HALO,
  DEEP: 'on-dark relative isolate overflow-hidden border border-white/12 bg-white/[.04] bg-[radial-gradient(120%_150%_at_0%_0%,color-mix(in_srgb,var(--o-p-600)_60%,transparent),transparent_60%),radial-gradient(110%_130%_at_100%_100%,color-mix(in_srgb,var(--color-pop-600)_40%,transparent),transparent_55%)] text-white',
  TONE: 'k-shine',
  NUM: 'k-shine font-display text-[1.02rem] font-bold tracking-[.16em]',
  UNDERHERO: 'py-[clamp(2.5rem,5vw,4.5rem)]',
}, (X, C) => ({
  eyebrow: (t) => (t ? `<span class="inline-flex w-fit items-center gap-2.5 rounded-full border border-white/12 bg-white/[.05] py-1.5 pr-4 pl-3 text-[.72rem] font-bold tracking-[.2em] text-white/85 uppercase backdrop-blur-md"><i class="relative block size-2 rounded-full bg-pop-400 shadow-[0_0_12px_2px_var(--color-pop-400)]"></i>${esc(t)}</span>` : ''),
  rule: () => '<i class="block h-[3px] w-16 rounded-full bg-linear-to-r from-day-300 to-pop-400 shadow-[0_0_18px_color-mix(in_srgb,var(--o-p-300)_80%,transparent)]" data-k-line></i>',
  check: (cls = 'bg-pop-500/20 text-pop-300 ring-1 ring-pop-400/40') => `<span class="mt-0.5 grid size-[1.4rem] shrink-0 place-items-center rounded-full ${cls}">${icon('check', 'size-3 stroke-[3.5]')}</span>`,
  arrowLink: (label) => `<span class="mt-auto inline-flex items-center gap-2 pt-1 text-[.95rem] font-bold text-white">${esc(label)}<span class="grid size-7 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 transition duration-300 group-hover/card:translate-x-1 group-hover/card:bg-popbtn group-hover/card:ring-transparent">${icon('arrow', 'size-3.5')}</span></span>`,
  tile: (K, c, i, group, cls = '') => {
    const pic = c.img?.src && !c.photo ? c.img.src : typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
    const name = typeof c.icon === 'string' && /^[a-z]+$/.test(c.icon) ? c.icon : '';
    if (pic) return `<span class="${C.TILE} ${cls} ${K.dims?.[pic]?.light ? 'bg-day-600! shadow-[0_0_24px_-4px_var(--o-p-400)]!' : ''} [&_img]:size-7 [&_img]:object-contain">${K.img(pic, c.img?.alt || '')}</span>`;
    if (name || !K.real) return `<span class="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/[.06] text-day-300 transition duration-300 group-hover/card:border-transparent group-hover/card:bg-popbtn group-hover/card:text-white ${cls}">${icon(name || K.iconFor(c, i, group), 'size-6')}</span>`;
    return '';
  },
  // a photograph: in a glass frame, a light of the brand's colour behind it
  photo: (K, src, alt, { cls = '' } = {}) => `<div class="relative ${cls}" data-k-reveal="zoom"><div class="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-linear-to-br from-day-500/35 to-pop-500/25 blur-3xl"></div><div class="overflow-hidden rounded-[calc(var(--k-r)*1.3)] border border-white/15 bg-white/5 p-1.5 ${HALO}"><div class="relative overflow-hidden rounded-[calc(var(--k-r)*1.1)] [&_img]:h-auto [&_img]:max-h-[34rem] [&_img]:w-full [&_img]:object-cover" data-k-img>${K.img(src, alt || '')}</div></div></div>`,
  mark: (K, src, alt, cls = '') => `<div class="grid w-fit place-items-center rounded-[calc(var(--k-r)*1.3)] bg-white p-[clamp(1.25rem,3vw,2.25rem)] ${HALO} [&_img]:h-auto [&_img]:max-h-56 [&_img]:max-w-full ${cls}" data-k-reveal="zoom">${K.img(src, alt || '')}</div>`,
  // the website's own form: a sheet of white paper in the dark (its fields were made for a light page)
  formCard: (K, s = {}) => {
    const f = formHead(K, s);
    if (K.pos?.stand) return `<div class="${C.PLAIN} grid min-h-[20rem] content-center justify-items-center gap-3 border-dashed p-[clamp(1.25rem,3vw,2.25rem)] text-center"><span class="grid size-12 place-items-center rounded-2xl bg-white/10 text-white">${icon('mail', 'size-6')}</span><p class="${C.H3} m-0 text-[1.3rem]">${esc(f.title)}</p><p class="${C.P} m-0 text-[.95rem]">The page's form stands here.</p></div>`;
    const intro = (s.formBlocks || []).map((b) => b.html || '').join('');
    if (K.formHtml) return `<div class="k-day prose-k form-k relative grid gap-4 overflow-hidden rounded-[var(--k-r)] bg-white p-[clamp(1.25rem,3vw,2.25rem)] shadow-[0_0_0_1px_rgb(255_255_255/.2),0_50px_100px_-40px_color-mix(in_srgb,var(--o-p-400)_80%,transparent)] before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-linear-to-r before:from-pop-500 before:to-day-500" id="quote"><h2 class="${C.H3} text-[1.45rem]">${esc(f.title)}</h2>${f.sub ? `<p class="${C.P} -mt-2">${esc(f.sub)}</p>` : ''}${intro ? `<div data-p="content">${intro}</div>` : ''}${K.formHtml}</div>`;
    return `<div class="${C.DEEP} grid gap-4 rounded-[calc(var(--k-r)*1.3)] p-[clamp(1.5rem,3vw,2.5rem)]"><h2 class="${C.H3} text-[1.45rem] text-white">${esc(f.title)}</h2>${intro ? `<div class="prose-k text-white/85" data-p="content">${intro}</div>` : ''}<div class="flex flex-wrap gap-3.5">${btn(quoteTo(null, K), C.POP, true)}${X.callBtn(K, C.GLASSBTN)}</div></div>`;
  },

  // cards: with pictures, the picture fills the head of a glass card and darkens into it; without, glass cards with a mark
  cards: (s, K) => {
    const list = items(s).map((c) => (typeof c === 'string' ? { title: c } : c));
    const hasPics = list.some((c) => c.img);
    const Hn = s.title ? 'h3' : 'h2';
    const cell = (c, i) => {
      const label = c.title || c.text || c.label || '';
      const sub = c.title && c.text ? `<p class="${C.P} text-[.97rem]">${esc(c.text)}</p>` : '';
      const more = c.href ? X.arrowLink(c.cta || 'Learn more') : '';
      const ownIcon = typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '';
      if (!c.img) return X.shell(`${X.tile(K, { ...c, photo: true }, i) || X.numMark(i)}<${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}`, { href: c.href, i, cls: 'grid content-start gap-3.5 p-[clamp(1.4rem,2.5vw,2rem)]', step: 80 });
      return X.shell(`<div class="relative aspect-[16/10] overflow-hidden rounded-t-[var(--k-r)] [&_img]:size-full [&_img]:object-cover [&_img]:transition [&_img]:duration-700 group-hover/card:[&_img]:scale-[1.07]">${K.img(c.img, c.imgAlt || label)}<div class="absolute inset-0 bg-linear-to-t from-[var(--n-bg)] via-transparent to-transparent opacity-80"></div>${ownIcon ? `<span class="absolute bottom-4 left-5 grid size-[3.1rem] place-items-center rounded-2xl ${K.dims?.[ownIcon]?.light ? 'bg-day-600 shadow-[0_0_26px_-4px_var(--o-p-400)]' : 'bg-white'} [&_img]:size-8! [&_img]:object-contain!">${K.img(ownIcon, '')}</span>` : ''}</div><div class="grid flex-1 content-start gap-2.5 p-6"><${Hn} class="${C.H3}">${esc(label)}</${Hn}>${sub}${more}</div>`, { href: c.href, i, cls: 'flex flex-col overflow-hidden', step: 80, per: 3 });
    };
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: !s.small })}<div class="grid ${C.GAP} ${X.colsOf(list.length, { small: s.small, pics: hasPics })}">${list.map((c, i) => cell(c, i)).join('')}</div></div></section>`;
  },
  // steps: glass cards on a line of light, a lit number each
  steps: (s, K) => {
    const list = items(s).map((t) => (typeof t === 'string' ? { title: t } : t));
    const Hn = s.title || !K.real ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top(s, K, { center: true, word: 'How it works', lead: s.lead ? `<p>${esc(s.lead)}</p>` : introHtml(s) })}<ol class="relative m-0 grid list-none ${C.GAP} p-0 before:absolute before:inset-x-8 before:top-[3.1rem] before:hidden before:h-px before:bg-linear-to-r before:from-transparent before:via-day-400/70 before:to-transparent sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] lg:before:block">${list.map((t, i) => `<li class="group/card ${C.CARD} ${C.LIFT} grid content-start gap-3.5 p-6" data-k-reveal style="transition-delay:${i * 90}ms"><span class="grid size-12 place-items-center rounded-full border border-white/20 bg-[var(--n-bg)] font-display text-[1.05rem] font-bold text-white shadow-[0_0_26px_-4px_var(--o-p-400)]">${i + 1}</span><${Hn} class="${C.H3}">${esc(t.title)}</${Hn}>${t.text ? `<p class="${C.P} text-[.97rem]">${esc(t.text)}</p>` : ''}</li>`).join('')}</ol></div></section>`;
  },
  // figures: numerals of light on a glass panel, a hairline of light between them
  stats: (s, K) => {
    const list = statsOf(s);
    const tight = list.length > 3 || list.some((x) => String(x.value || '').length > 6) || Boolean(s.img);
    const figures = `<dl class="m-0 grid gap-y-9 sm:grid-cols-2 ${s.img ? 'lg:grid-cols-3' : 'lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]'} lg:divide-x lg:divide-white/12">${list.map((x) => `<div class="grid gap-2.5 lg:px-[clamp(1rem,2.5vw,2.5rem)] lg:first:pl-0"><dd class="k-shine order-first m-0 w-fit font-display ${tight ? 'text-[clamp(2.3rem,1.4rem+2.3vw,3.5rem)]' : 'text-[clamp(2.8rem,1.6rem+3.4vw,4.6rem)]'} leading-none font-bold tracking-tight" data-count="${esc(x.value)}">${esc(x.value)}</dd><dt class="text-[.98rem] leading-snug font-semibold text-white/75">${esc(x.label)}</dt></div>`).join('')}</dl>`;
    return `<section class="${C.SEC}"><div class="${C.WRAP}"><div class="${C.DEEP} rounded-[calc(var(--k-r)*1.6)] px-[clamp(1.5rem,4vw,4rem)] py-[clamp(2.25rem,5vw,4rem)] ${HALO}" data-k-reveal="zoom">${s.title ? X.h2(s.title, 'mb-[clamp(1.5rem,3vw,2.5rem)] text-white') : ''}${s.img ? `<div class="grid items-center gap-[clamp(1.5rem,4vw,3.5rem)] lg:grid-cols-[1.5fr_1fr]">${figures}<div class="overflow-hidden rounded-[calc(var(--k-r)*1.1)] border border-white/15 [&_img]:h-auto [&_img]:max-h-72 [&_img]:w-full [&_img]:object-cover">${K.img(s.img, s.imgAlt || '')}</div></div>` : figures}</div></div></section>`;
  },
  reviewCard: (r, i, cls = '') => `<figure class="${C.CARD} m-0 grid content-between gap-6 p-7 ${cls}" data-k-reveal style="transition-delay:${(i % 3) * 90}ms"><div class="grid gap-4"><div class="flex items-center justify-between gap-4">${stars()}<span class="k-shine font-display text-[3.4rem] leading-[.5] font-bold" aria-hidden="true">”</span></div><blockquote class="m-0 text-[1.03rem] leading-relaxed text-white/90">${esc(r.quote || r.text || '')}</blockquote></div><figcaption class="flex items-center gap-3.5 border-t border-white/10 pt-5"><span class="grid size-11 shrink-0 place-items-center rounded-full bg-linear-to-br from-day-400 to-day-700 font-display text-sm font-bold text-white shadow-[0_0_22px_-4px_var(--o-p-400)]">${esc(initialsOf(r.name))}</span><span class="grid"><b class="text-white">${esc(r.name || '')}</b>${r.place || r.role ? `<small class="text-white/55">${esc(r.place || r.role)}</small>` : ''}</span></figcaption></figure>`,
  scrollBtn: (dir) => `<button type="button" data-scroll-${dir} aria-label="${dir === 'prev' ? 'Previous' : 'Next'} reviews" class="grid size-12 place-items-center rounded-full border border-white/20 bg-white/[.06] text-white backdrop-blur-md transition hover:border-transparent hover:bg-popbtn">${icon('arrow', dir === 'prev' ? 'size-5 rotate-180' : 'size-5')}</button>`,
  faqRow: (f, i) => `<details class="group ${C.PLAIN} open:border-white/25 open:bg-white/[.07] open:shadow-[0_30px_70px_-40px_color-mix(in_srgb,var(--o-p-400)_80%,transparent)]"${i === 0 ? ' open' : ''} data-k-reveal style="transition-delay:${Math.min(i, 5) * 50}ms"><summary class="flex cursor-pointer list-none items-center justify-between gap-5 px-6 py-5 font-display text-[1.08rem] leading-snug font-[var(--k-h-weight)] text-white marker:hidden [&::-webkit-details-marker]:hidden">${esc(f.q)}<span class="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[.06] text-white transition duration-300 group-open:rotate-45 group-open:border-transparent group-open:bg-popbtn">${icon('plus', 'size-4')}</span></summary><div class="px-6 pb-6">${answerOf(f.a)}</div></details>`,
  place: (l) => { const cls = 'inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[.05] px-4 py-2 text-[.93rem] font-semibold text-white/90 transition duration-300'; return l.href ? `<a class="${cls} hover:-translate-y-0.5 hover:border-transparent hover:bg-popbtn hover:text-white hover:shadow-[0_12px_30px_-10px_var(--color-pop-500)]" href="${esc(l.href)}">${icon('pin', 'size-3.5 text-pop-300')}${esc(l.text)}</a>` : `<span class="${cls}">${icon('pin', 'size-3.5 text-pop-300')}${esc(l.text)}</span>`; },
  areas: (s, K) => {
    const groups = groupsOf(s).filter((g) => (g.links || []).length);
    const one = groups.length === 1;
    const title = s.title || (one ? groups[0].title : '');
    const Hn = title ? 'h3' : 'h2';
    return `<section class="${C.SEC}"><div class="${C.WRAP}">${X.top({ ...s, title }, K, { center: true, word: 'Service areas', lead: s.lead ? `<p>${esc(s.lead)}</p>` : '' })}<div class="grid ${C.GAP} ${one ? '' : 'lg:grid-cols-2'}">${groups.map((g, i) => `<div class="${C.CARD} grid content-start gap-5 p-[clamp(1.25rem,3vw,2rem)]" data-k-reveal="${one ? 'up' : i % 2 ? 'right' : 'left'}">${g.title && !one ? `<${Hn} class="${C.H3} flex items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/[.06] text-pop-300">${icon('pin', 'size-5')}</span>${esc(g.title)}</${Hn}>` : ''}<ul class="m-0 flex list-none flex-wrap gap-2.5 p-0 ${one ? 'justify-center' : ''}">${g.links.map((l) => `<li>${X.place(l)}</li>`).join('')}</ul></div>`).join('')}</div></div></section>`;
  },
  // the closing call: a glass panel lit from two corners, a ring of light behind the words
  cta: (s, K) => {
    const q = quoteTo(s, K), c = callTo(K);
    const pic = s.img ? `<span class="grid size-[clamp(5rem,9vw,7.5rem)] shrink-0 place-items-center rounded-[calc(var(--k-r)*1.3)] bg-white p-3 max-lg:justify-self-start ${HALO} [&_img]:size-full [&_img]:object-contain">${K.img(s.img, s.imgAlt || '')}</span>` : '';
    return `<section class="relative py-[clamp(3rem,6vw,5rem)]"><div class="${C.WRAP}"><div class="${C.DEEP} k-glow rounded-[calc(var(--k-r)*1.6)] px-[clamp(1.5rem,5vw,5rem)] py-[clamp(2.75rem,6vw,5rem)] ${HALO}" data-k-reveal="zoom"><div class="grid items-center gap-8 ${pic ? 'lg:grid-cols-[auto_1.5fr_auto]' : 'lg:grid-cols-[1.5fr_auto]'}">${pic}<div class="grid gap-4">${X.h2(s.title || 'Ready to get started?', 'text-white')}${s.text ? `<p class="max-w-2xl text-[1.08rem] leading-relaxed text-white/80">${esc(s.text)}</p>` : ''}</div><div class="flex flex-wrap gap-3.5">${btn(q, C.POP, true, true)}${c && c.href !== q.href ? btn({ text: K.site.phone.display, href: c.href }, C.GLASSBTN, false, true) : ''}</div></div></div></div></section>`;
  },
  callout: (s, K) => {
    const { say, act } = X.calloutParts(s, K);
    return `<section class="k-same relative py-[clamp(1.25rem,3vw,2rem)]"><div class="${C.WRAP}"><div class="${C.DEEP} flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-[calc(var(--k-r)*1.3)] px-[clamp(1.25rem,3vw,2.5rem)] py-[clamp(1.1rem,2.5vw,1.6rem)]" data-k-reveal="zoom"><p class="m-0 flex items-center gap-3.5 font-display text-[clamp(1.1rem,1rem+.6vw,1.45rem)] leading-snug font-bold text-white"><span class="grid size-10 shrink-0 place-items-center rounded-full bg-pop-500/25 text-pop-300 shadow-[0_0_22px_-4px_var(--color-pop-400)]">${icon('check', 'size-5 stroke-[3]')}</span>${esc(say)}</p>${act}</div></div></section>`;
  },
  wayMark: (K, c) => (typeof c.icon === 'string' && /[./]/.test(c.icon) ? `<span class="${C.TILE} ${K.dims?.[c.icon]?.light ? 'bg-day-600!' : ''} [&_img]:size-6 [&_img]:object-contain">${K.img(c.icon, '')}</span>` : `<span class="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/[.06] text-pop-300 transition duration-300 group-hover/card:border-transparent group-hover/card:bg-popbtn group-hover/card:text-white">${icon(X.wayIcon(c), 'size-6')}</span>`),
  // the reading bar, the way back to the top and the action that follows the reader, on glass
  controls: (K) => {
    const c = web(K).controls || {};
    return `${c.progress === false ? '' : '<div class="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]"><i class="block h-full w-full bg-linear-to-r from-pop-400 to-day-300 shadow-[0_0_14px_var(--o-p-300)]" data-k-progress></i></div>'}${c.top === false ? '' : `<button type="button" data-k-top aria-label="Back to the top" class="fixed right-4 bottom-24 z-40 grid size-12 place-items-center rounded-full border border-white/20 bg-[var(--n-bg)]/80 text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-transparent hover:bg-popbtn sm:bottom-6">${icon('arrow', '-rotate-90 size-5')}</button>`}`;
  },
}));
const { WRAP, POP, GLASSBTN } = C;
// the bands of a page: the night itself, then a band a little lighter between two hairlines, in turn
const BAND = 'border-y border-white/[.07] bg-white/[.03]';
const TONES = { alt: BAND, tint: BAND, dark: 'bg-black/35', brand: 'bg-linear-to-br from-day-700/60 to-day-900/40', rotation: ['alt', 'none'] };

// ---------- hero ----------
const HEIGHT = { standard: 'lg:min-h-[32rem]', tall: 'lg:min-h-[min(42rem,82vh)]', full: 'lg:min-h-[calc(100svh-7rem)]' };
const chip = (t) => (t ? `<span class="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[.06] py-2 pr-4 pl-3 text-[.74rem] font-bold tracking-[.16em] text-white uppercase backdrop-blur-md"><i class="relative block size-2 rounded-full bg-pop-400 shadow-[0_0_12px_2px_var(--color-pop-400)]"></i>${esc(t)}</span>` : '');
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0 text-[.95rem] font-semibold text-white/90">${list.map((t) => `<li class="inline-flex items-center gap-2.5">${X.check()}${esc(t)}</li>`).join('')}</ul>` : '');
// the picture or the video of the hero in a glass frame that leans towards the reader, the website's figures on glass chips beside it
function frame(h, K) {
  const facts = factsOf(K).slice(0, 2);
  if (!h.image?.src && !h.video?.src) {
    if (!facts.length) return '';
    const all = factsOf(K).slice(0, 3);
    return `<aside class="${C.GLASS} grid divide-y divide-white/12 px-7 py-3" data-k-reveal="right" style="transition-delay:300ms">${all.map((x) => `<div class="flex items-baseline justify-between gap-6 py-5"><b class="k-shine font-display text-[clamp(2rem,1.4rem+1.8vw,2.9rem)] leading-none font-bold tracking-tight" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="max-w-[14ch] text-right text-[.92rem] leading-snug text-white/75">${esc(x.label)}</span></div>`).join('')}</aside>`;
  }
  const fact = (x, pos, d) => `<div class="absolute ${pos} grid gap-1 rounded-2xl border border-white/20 bg-[color-mix(in_srgb,var(--n-bg)_70%,transparent)] px-5 py-4 shadow-[0_24px_50px_-20px_rgb(0_0_0/.8)] backdrop-blur-xl max-sm:hidden" data-k-reveal="zoom" style="transition-delay:${d}ms"><b class="k-shine w-fit font-display text-[1.9rem] leading-none font-bold" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="max-w-[15ch] text-[.8rem] leading-snug font-semibold text-white/80">${esc(x.label)}</span></div>`;
  return `<div class="relative" data-k-reveal="right" style="transition-delay:250ms"><div class="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-linear-to-br from-day-500/40 to-pop-500/25 blur-3xl"></div><div class="transition duration-[900ms] ease-out [transform:perspective(1600px)_rotateY(-9deg)_rotateX(3deg)] hover:[transform:perspective(1600px)] max-lg:[transform:none]"><div class="k-glow relative rounded-[calc(var(--k-r)*1.5)] border border-white/15 bg-white/[.06] p-2 shadow-[0_60px_120px_-50px_color-mix(in_srgb,var(--o-p-400)_90%,transparent)]"><div class="relative aspect-[4/3] overflow-hidden rounded-[calc(var(--k-r)*1.25)] bg-black/30 [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover" data-k-img><div class="${web(K).motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}</div>${videoBg(h).replace('-z-20', '')}${h.video ? vPause('right-4 bottom-4') : ''}</div></div></div>${facts[0] ? fact(facts[0], '-bottom-7 -left-4 sm:-left-8', 650) : ''}${facts[1] ? fact(facts[1], '-top-6 right-2 sm:-right-4', 800) : ''}</div>`;
}
// the links the old hero offered: a dock of glass under the words
const dock = (h, K) => (h.cards?.items?.length ? `<div class="${WRAP} relative pb-[clamp(3rem,6vw,5rem)]"><div class="${C.GLASS} p-[clamp(1rem,2vw,1.5rem)]" data-k-reveal style="transition-delay:450ms">${h.cards.title ? `<p class="mb-4 font-display text-[1.15rem] leading-tight font-[var(--k-h-weight)] text-white">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-4 lg:grid-cols-8">${h.cards.items.map((c) => { const label = c.text || c.title || c.label || ''; const inner = `${c.img ? `<span class="grid size-12 place-items-center rounded-2xl bg-white p-1.5 shadow-[0_10px_24px_-10px_rgb(0_0_0/.7)] transition duration-300 group-hover/card:shadow-[0_0_26px_-2px_var(--o-p-300)] [&_img]:size-full [&_img]:object-contain">${K.img(c.img, c.imgAlt || '')}</span>` : ''}<span>${esc(label)}</span>`; const cls = 'group/card grid h-full content-start justify-items-center gap-2.5 rounded-2xl px-2 py-3 text-center text-[.8rem] leading-tight font-semibold text-white/90 transition duration-300'; return `<li>${c.href ? `<a class="${cls} hover:-translate-y-1 hover:bg-white/[.07] hover:text-white" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`; }).join('')}</ul></div></div>` : '');

const hero = {
  // the home page: the words on the left in the dark, the picture or the video in a leaning glass frame on the right, lights drifting behind
  'nv-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const media = frame(h, K), row = dock(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.15rem,1.1rem+3.3vw,3.9rem)] leading-[1.06]' : 'text-[clamp(2.7rem,1.2rem+5.2vw,5.4rem)] leading-[1.02]';
    return `<section class="relative isolate overflow-hidden">${LIGHTS}<div class="${WRAP} grid items-center gap-[clamp(2.5rem,5vw,5rem)] pt-[clamp(3.5rem,8vw,6.5rem)] ${row ? 'pb-[clamp(3rem,6vw,4.5rem)]' : 'pb-[clamp(4.5rem,9vw,7.5rem)]'} ${HEIGHT[web(K).hero?.height] || HEIGHT.tall} ${media ? 'lg:grid-cols-[1.08fr_.92fr]' : ''}"><div class="grid justify-items-start gap-6 ${media ? '' : 'max-w-4xl'}">${chip(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-white" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-2xl text-[clamp(1.08rem,1rem+.4vw,1.3rem)] leading-relaxed text-white/80 [&_a]:text-white [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, GLASSBTN, false, true) : ''}</div><div data-k-reveal style="transition-delay:380ms">${bullets(h.bullets)}</div></div>${media}</div>${row}${beam}</section>`;
  },
  // an inner page: the trail, the title and the page's actions in the dark (the page's picture or video far behind them when there is one)
  'nv-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-white">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-white" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<span aria-hidden="true" class="text-white/30">/</span>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(1.9rem,1.1rem+2.6vw,3.1rem)]' : 'text-[clamp(2.3rem,1.2rem+3.8vw,4.1rem)]';
    const back = h.image?.src || h.video?.src ? `<div class="absolute inset-0 -z-20 overflow-hidden [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover">${h.image?.src ? groundImg(K, h.image.src, h.image.alt) : ''}${videoBg(h).replace('-z-20', '')}<div class="absolute inset-0 bg-[linear-gradient(100deg,var(--n-bg)_20%,color-mix(in_srgb,var(--n-bg)_78%,transparent)_60%,color-mix(in_srgb,var(--n-bg)_45%,transparent))]"></div></div>` : '';
    return `<section class="relative isolate overflow-hidden">${back}${LIGHTS}<div class="${WRAP} pt-[clamp(2.75rem,6vw,4.75rem)] pb-[clamp(3rem,6.5vw,5rem)]"><nav class="mb-6 flex flex-wrap items-center gap-2.5 text-[.86rem] font-semibold text-white/60" aria-label="Breadcrumb">${crumbs}</nav><div class="grid max-w-4xl justify-items-start gap-5"><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-white" data-k-words>${X.tone2(h.h1)}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-white/80 [&_a]:text-white [&_a]:underline')}<div class="mt-2 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${X.callBtn(K, GLASSBTN)}</div></div></div>${beam}${h.video ? vPause('right-5 top-5') : ''}</section>`;
  },
};

// ---------- header and footer ----------
// the logo: the one the website drew for a dark ground when it has one; else its logo on a white chip, so it can always be read
const logo = (K, foot = false) => {
  const s = K.site, dark = s.footerLogo && s.footerLogo !== s.logo ? s.footerLogo : '';
  const size = foot ? 'max-h-24' : 'max-h-14';
  const mark = dark ? `<img class="h-auto ${size} w-auto" src="${esc(K.u(dark))}" alt="${esc(s.name)}"${foot ? ' loading="lazy"' : ''}>` : s.logo ? `<span class="inline-flex rounded-2xl bg-white px-3 py-1.5"><img class="h-auto ${foot ? 'max-h-16' : 'max-h-11'} w-auto" src="${esc(K.u(s.logo))}" alt="${esc(s.name)}"${foot ? ' loading="lazy"' : ''}></span>` : `<span class="grid size-10 place-items-center rounded-2xl bg-linear-to-br from-day-400 to-day-700 text-[1.05rem] text-white shadow-[0_0_24px_-4px_var(--o-p-400)]">${esc(String(s.name || '?').trim()[0] || '?')}</span><span>${esc(s.name)}</span>`;
  return `<a class="inline-flex items-center gap-3 font-display text-[1.3rem] leading-none font-bold tracking-tight text-white" data-p="brand" href="${esc(K.u('/'))}">${mark}</a>`;
};
const NAV = {
  link: 'relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[.95rem] font-semibold whitespace-nowrap text-white/80 transition duration-300 hover:bg-white/[.08] hover:text-white aria-[current]:bg-white/[.08] aria-[current]:text-white',
  panel: 'rounded-[calc(var(--k-r)*1.1)] border border-white/12 bg-[color-mix(in_srgb,var(--o-p-900)_55%,var(--n-bg))] p-2.5 shadow-[0_30px_70px_-20px_rgb(0_0_0/.85)]',
  item: 'flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-[.93rem] font-semibold text-white/85 transition hover:bg-white/[.08] hover:text-white',
  more: 'rounded-xl bg-white/[.08] text-white hover:bg-white/[.14]',
};
// the lights of the page: two soft clouds of the theme's colours far behind everything, still while the page is read
const SKY = '<div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true"><i class="absolute -top-[20%] -left-[10%] block size-[60vw] rounded-full bg-day-600/15 blur-[140px]"></i><i class="absolute -right-[12%] bottom-[-25%] block size-[55vw] rounded-full bg-pop-600/10 blur-[150px]"></i></div>';
function strip(K) {
  const say = stripSays(K), s = K.site;
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-bold text-white transition hover:text-pop-300" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-pop-300')}${esc(s.phone.display)}</a>` : '';
  if (!say && !phone) return '';
  const left = say ? `${say.icon ? icon(say.icon, 'size-3.5 text-pop-300') : ''}${say.href ? `<a class="underline-offset-4 hover:underline" href="${esc(say.href)}">${esc(say.text)}</a>` : esc(say.text)}` : '';
  return `<div class="border-b border-white/[.07] bg-black/30 text-white/75"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[.84rem] font-semibold max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  nv: (K) => `${SKY}${strip(K)}<header class="sticky top-0 z-50 border-b border-white/10 bg-[color-mix(in_srgb,var(--n-bg)_72%,transparent)] backdrop-blur-xl transition duration-300 data-[scrolled]:shadow-[0_18px_40px_-20px_rgb(0_0_0/.9)]" data-k-header><div class="${WRAP} flex items-center gap-6 py-3" data-p="bar">${logo(K)}<nav class="mx-auto flex items-center gap-1 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => menuItem(K, n, NAV)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, false)}</span><button class="ml-auto grid size-11 place-items-center rounded-full border border-white/20 bg-white/[.06] text-white lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // the website's own footer in the deepest dark, a hairline of light above it
  nv: (K) => {
    const s = K.site, f = footerOf(K);
    const h4 = 'mb-4 text-[.76rem] font-bold tracking-[.18em] text-white uppercase', li = 'transition hover:text-white';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2.5 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-10 place-items-center rounded-full border border-white/15 bg-white/[.05] transition duration-300 hover:-translate-y-0.5 hover:border-transparent hover:bg-popbtn" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-full border border-white/15 bg-white/[.05] px-3.5 py-1.5 text-[.82rem] font-semibold text-white/85 transition hover:border-transparent hover:bg-popbtn hover:text-white" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-3 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} font-semibold text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.4fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="relative isolate overflow-hidden bg-black/40 text-white/65 max-sm:pb-20">${beam}<div class="pointer-events-none absolute -top-56 left-1/2 -z-10 size-[44rem] -translate-x-1/2 rounded-full bg-day-600/20 blur-[120px]" aria-hidden="true"></div><div class="${WRAP} pt-[clamp(3.5rem,7vw,6rem)]"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6 text-[.88rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="transition hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-full border border-white/25 px-3.5 py-1.5 text-[.72rem] font-bold tracking-[.12em] uppercase transition hover:bg-white/10">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'nv-');
export const NOVA = {
  design: {
    id: 'nova', name: 'Nova', badge: 'Dark & luminous', blurb: 'The whole page in the deepest shade of the brand colour, lit by soft lights of the theme: glass cards with a light that follows the pointer, the hero picture or video in a leaning glass frame, headings whose last words shine, figures set in light and the form on a sheet of white paper. Sections rise out of the dark with a flash.',
    fonts: { heading: 'Sora', body: 'Manrope' }, vars: { '--k-r': '1.25rem', '--k-r-btn': '999px', '--k-h-weight': '600', '--k-h-track': '-.035em' },
    header: 'nv', footer: 'nv', offered: true, anim: 'glow', skin: 'night', ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
