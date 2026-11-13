import { esc, icon, btn, quoteTo, heroButtons, leadOf, factsOf, videoBg, vPause, longH1, footerOf, menuOf, crumbsOf, groundImg } from './shared.js';
import { sections, register, web, ctaOf } from './base.js';

// SIGNATURE: bright and assured. It keeps the page's own sections in the page's own order and gives each kind of section one considered
// layout (the sections of base.js, in their own look). Its colours are the website's theme: deep shades of the primary colour for the dark
// bands and the footer, a pale shade for every second band, and the theme's liveliest second colour ("pop") for the calls to action. Cards
// carry a gradient border with a light that travels round it. Layout names start with sg-.

const { X, C } = sections();
const { DEEP, WRAP, GLASS, POP, GLASSBTN, LINE } = C;
// the bands of a page: white, then a pale shade of the primary colour, in turn
const TONES = { alt: 'bg-[color-mix(in_srgb,var(--th-primary-50)_80%,var(--th-bg))]', tint: 'bg-[color-mix(in_srgb,var(--th-primary-50)_80%,var(--th-bg))]', dark: 'bg-primary-950 text-white on-dark', brand: 'bg-linear-to-br from-primary-700 to-primary-950 text-white on-dark', rotation: ['alt', 'none'] };
const wave = `<svg class="pointer-events-none absolute inset-x-0 -bottom-px h-[clamp(1.75rem,4.5vw,4.25rem)] w-full" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path class="fill-paper" d="M0 44c150-30 330-34 520-12s350 34 520 14 280-34 400-22v56H0z"/></svg>`;

// ---------- hero ----------
const OVERLAY = {
  light: 'bg-[linear-gradient(105deg,color-mix(in_srgb,var(--th-primary-950)_84%,transparent),color-mix(in_srgb,var(--th-primary-950)_58%,transparent)_50%,color-mix(in_srgb,var(--th-primary-900)_18%,transparent))]',
  medium: 'bg-[linear-gradient(105deg,color-mix(in_srgb,var(--th-primary-950)_95%,transparent),color-mix(in_srgb,var(--th-primary-950)_78%,transparent)_50%,color-mix(in_srgb,var(--th-primary-900)_38%,transparent))]',
  strong: 'bg-[linear-gradient(105deg,color-mix(in_srgb,var(--th-primary-950)_98%,transparent),color-mix(in_srgb,var(--th-primary-950)_90%,transparent)_50%,color-mix(in_srgb,var(--th-primary-900)_66%,transparent))]',
};
const HEIGHT = { standard: 'lg:min-h-[34rem]', tall: 'lg:min-h-[min(44rem,84vh)]', full: 'lg:min-h-[calc(100svh-6rem)]' };
// the ground of a hero: the picture (drifting slowly) or the video, under a veil of the brand's deepest colour
function ground(h, K) {
  const w = web(K);
  const media = h.image?.src ? `<div class="absolute inset-0 -z-30 overflow-hidden [&_img]:absolute [&_img]:inset-0 [&_img]:size-full [&_img]:object-cover"><div class="${w.motion?.zoom === false ? '' : 'k-zoom '}absolute inset-0">${groundImg(K, h.image.src, h.image.alt)}</div></div>` : '';
  const video = videoBg(h).replace('-z-20', '-z-30');
  const veil = h.image?.src || h.video?.src ? `<div class="absolute inset-0 -z-20 ${OVERLAY[w.hero?.overlay] || OVERLAY.medium}"></div>` : '';
  return `${media}${video}${veil}`;
}
const chip = (t) => (t ? `<span class="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[.74rem] font-bold tracking-[.16em] text-white uppercase backdrop-blur-md"><i class="relative block size-2 rounded-full bg-pop-400 after:absolute after:-inset-1 after:rounded-full after:border after:border-pop-400/60"></i>${esc(t)}</span>` : '');
const bullets = (list) => (list?.length ? `<ul class="m-0 flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0 text-[.95rem] font-semibold text-white/90">${list.map((t) => `<li class="inline-flex items-center gap-2.5">${X.check('bg-pop-500/25 text-pop-300')}${esc(t)}</li>`).join('')}</ul>` : '');
// what stands beside the words of the home hero: the links the old hero offered, else the website's figures
function heroPanel(h, K) {
  if (h.cards?.items?.length) {
    return `<aside class="${GLASS} p-5 sm:p-7" data-k-reveal="right" style="transition-delay:450ms">${h.cards.title ? `<p class="font-display text-[1.2rem] leading-tight font-bold text-white">${esc(h.cards.title)}</p>` : ''}<ul class="m-0 mt-5 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">${h.cards.items.map((c) => { const label = c.text || c.title || c.label || ''; const inner = `${c.img ? `<span class="grid size-12 place-items-center [&_img]:size-full [&_img]:object-contain">${K.img(c.img, c.imgAlt || '')}</span>` : ''}<span>${esc(label)}</span>`; const cls = 'group/card grid h-full content-start justify-items-center gap-2 rounded-2xl bg-white px-2 py-3.5 text-center text-[.8rem] leading-tight font-bold text-primary-950 shadow-[0_10px_24px_-14px_rgb(0_0_0/.5)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_30px_-14px_rgb(0_0_0/.6)]'; return `<li>${c.href ? `<a class="${cls}" href="${esc(c.href)}">${inner}</a>` : `<span class="${cls}">${inner}</span>`}</li>`; }).join('')}</ul></aside>`;
  }
  const f = factsOf(K).slice(0, 3);
  if (!f.length) return '';
  return `<aside class="${GLASS} grid divide-y divide-white/15 px-7 py-3" data-k-reveal="right" style="transition-delay:450ms">${f.map((x) => `<div class="flex items-baseline justify-between gap-6 py-5"><b class="font-display text-[clamp(2rem,1.4rem+1.8vw,2.9rem)] leading-none font-extrabold tracking-tight text-white" data-count="${esc(x.value)}">${esc(x.value)}</b><span class="max-w-[14ch] text-right text-[.92rem] leading-snug text-white/75">${esc(x.label)}</span></div>`).join('')}</aside>`;
}

const hero = {
  // the home page: the words on the left over the picture or the video, a glass panel on the right, a soft wave into the page
  'sg-hero': (h, K) => {
    const [b1, b2] = heroButtons(h, K);
    const panel = heroPanel(h, K);
    const size = longH1(h.h1) ? 'text-[clamp(2.15rem,1.1rem+3.3vw,3.9rem)] leading-[1.06]' : 'text-[clamp(2.7rem,1.2rem+5.2vw,5.4rem)] leading-[1.02]';
    return `<section class="${DEEP}">${ground(h, K)}<div class="${WRAP} grid items-center gap-[clamp(2rem,4vw,4.5rem)] pt-[clamp(3.5rem,8vw,6.5rem)] pb-[clamp(5rem,10vw,8.5rem)] ${HEIGHT[web(K).hero?.height] || HEIGHT.tall} ${panel ? 'lg:grid-cols-[1.12fr_.88fr]' : ''}"><div class="grid justify-items-start gap-6 ${panel ? '' : 'max-w-4xl'}">${chip(h.eyebrow)}<h1 class="font-display ${size} font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-white" data-k-words>${X.tone2(h.h1, 'text-pop-300')}</h1>${leadOf(h, 'max-w-2xl text-[clamp(1.08rem,1rem+.4vw,1.3rem)] leading-relaxed text-white/85 [&_a]:text-white [&_a]:underline')}<div class="mt-1 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(b1, POP, true, true)}${b2 ? btn(b2, GLASSBTN, false, true) : ''}</div><div data-k-reveal style="transition-delay:380ms">${bullets(h.bullets)}</div></div>${panel}</div>${wave}${h.video ? vPause('right-5 top-5') : ''}</section>`;
  },
  // an inner page: the breadcrumb, the title and its line on the brand's deep ground (over the page's picture or video when there is one)
  'sg-page': (h, K) => {
    const crumbs = crumbsOf(h, K).map((c) => (c.last ? `<span aria-current="page" class="text-white">${esc(c.text)}</span>` : `${c.href ? `<a class="transition hover:text-white" href="${esc(c.href)}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`}<span aria-hidden="true">/</span>`)).join('');
    const size = longH1(h.h1, 44) ? 'text-[clamp(1.9rem,1.1rem+2.6vw,3.1rem)]' : 'text-[clamp(2.3rem,1.2rem+3.8vw,4.1rem)]';
    return `<section class="${DEEP}">${ground(h, K)}<div class="${WRAP} pt-[clamp(2.75rem,6vw,4.75rem)] pb-[clamp(4.25rem,9vw,7rem)]"><nav class="mb-6 flex flex-wrap items-center gap-2 text-[.88rem] font-semibold text-white/65" aria-label="Breadcrumb">${crumbs}</nav><div class="grid max-w-4xl justify-items-start gap-5"><h1 class="font-display ${size} leading-[1.06] font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] text-balance text-white" data-k-words>${X.tone2(h.h1, 'text-pop-300')}</h1>${leadOf(h, 'max-w-3xl text-[clamp(1.04rem,1rem+.3vw,1.2rem)] leading-relaxed text-white/85 [&_a]:text-white [&_a]:underline')}<div class="mt-2 flex flex-wrap gap-3.5" data-k-reveal style="transition-delay:250ms">${btn(h.buttons?.[0] || quoteTo(null, K), POP, true)}${X.callBtn(K, GLASSBTN)}</div></div></div>${wave}${h.video ? vPause('right-5 top-5') : ''}</section>`;
  },
};

// ---------- header and footer ----------
const logo = (K, dark = false) => `<a class="inline-flex items-center gap-3 font-display text-[1.3rem] leading-none font-extrabold tracking-tight ${dark ? 'text-white' : 'text-primary-950'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto ${dark ? 'max-h-24' : 'max-h-14'} w-auto" src="${esc(K.u((dark && K.site.footerLogo) || K.site.logo))}" alt="${esc(K.site.name)}"${dark ? ' loading="lazy"' : ''}>` : `<span class="grid size-10 place-items-center rounded-2xl bg-linear-to-br from-primary-600 to-primary-900 text-[1.05rem] text-white">${esc(String(K.site.name || '?').trim()[0] || '?')}</span><span>${esc(K.site.name)}</span>`}</a>`;
// a menu item; one with pages under it opens a panel of them on hover and on keyboard focus
function navItem(K, n) {
  const base = 'relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[.95rem] font-semibold whitespace-nowrap text-primary-950 transition hover:bg-primary-50 hover:text-primary-700 aria-[current]:bg-primary-50 aria-[current]:text-primary-700';
  const kids = n.children || [];
  if (!kids.length) return `<a class="${base}" data-p="navLink" href="${esc(K.u(n.href))}"${n.current ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
  const shown = kids.slice(0, 14), wide = shown.length > 7;
  return `<div class="group/dd relative"><a class="${base}" data-p="navLink" href="${esc(K.u(n.href))}"${n.current ? ' aria-current="page"' : ''} aria-haspopup="true">${esc(n.label)}${icon('chevron', 'size-3.5 transition duration-300 group-hover/dd:rotate-180')}</a><div class="invisible absolute top-full left-1/2 z-50 ${wide ? 'w-[34rem]' : 'w-72'} -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition duration-200 group-focus-within/dd:visible group-focus-within/dd:translate-y-0 group-focus-within/dd:opacity-100 group-hover/dd:visible group-hover/dd:translate-y-0 group-hover/dd:opacity-100"><div class="rounded-[calc(var(--k-r)*1.1)] border border-primary-100 bg-surface p-2.5 shadow-[0_30px_60px_-24px_color-mix(in_srgb,var(--th-primary-950)_55%,transparent)]"><ul class="m-0 grid list-none gap-0.5 p-0 ${wide ? 'grid-cols-2' : ''}">${shown.map((c) => `<li><a class="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-[.93rem] font-semibold text-primary-950 transition hover:bg-primary-50 hover:text-primary-700" href="${esc(K.u(c.href))}">${esc(c.label)}${icon('arrow', 'size-3.5 shrink-0 opacity-0 transition group-hover/dd:opacity-40')}</a></li>`).join('')}</ul>${kids.length > shown.length ? `<a class="mt-1.5 flex items-center justify-center gap-2 rounded-xl bg-primary-50 px-3.5 py-2.5 text-[.9rem] font-bold text-primary-700 transition hover:bg-primary-100" href="${esc(K.u(n.href))}">All ${esc(n.label.toLowerCase())}${icon('arrow', 'size-3.5')}</a>` : ''}</div></div></div>`;
}
// the strip over the header: the announcement set in Design settings, else the address or the hours, and the phone
function strip(K) {
  const w = web(K), s = K.site, a = w.announce || {};
  const say = a.on !== false && a.text ? (a.href ? `<a class="underline-offset-4 hover:underline" href="${esc(a.href)}">${esc(a.text)}</a>` : esc(a.text)) : '';
  const left = say || (w.hours || s.hours ? `${icon('clock', 'size-3.5 text-pop-300')}${esc(w.hours || s.hours)}` : s.address ? `${icon('pin', 'size-3.5 text-pop-300')}${esc(s.address)}` : K.real ? '' : `${icon('pin', 'size-3.5 text-pop-300')}Serving your local area`);
  const phone = s.phone?.digits ? `<a class="inline-flex items-center gap-2 font-bold text-white hover:text-pop-200" data-p="phone" href="tel:${s.phone.digits}">${icon('phone', 'size-3.5 text-pop-300')}${esc(s.phone.display)}</a>` : '';
  if (!left && !phone) return '';
  return `<div class="on-dark bg-primary-950 text-white/85"><div class="${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[.84rem] font-semibold max-sm:justify-center"><span class="inline-flex items-center gap-2 ${phone ? 'max-sm:hidden' : ''}">${left}</span>${phone}</div></div>`;
}
const HEADER = {
  sg: (K) => `${strip(K)}<header class="sticky top-0 z-50 border-b border-primary-100 bg-paper/95 backdrop-blur-md transition duration-300 data-[scrolled]:shadow-[0_10px_30px_-18px_color-mix(in_srgb,var(--th-primary-950)_45%,transparent)]" data-k-header><div class="${WRAP} flex items-center gap-6 py-3" data-p="bar">${logo(K)}<nav class="mx-auto flex items-center gap-1 max-lg:hidden" aria-label="Main" data-k-wide>${menuOf(K).map((n) => navItem(K, n)).join('')}</nav><span class="max-lg:hidden" data-k-wide>${btn(ctaOf(K), POP, false)}</span><button class="ml-auto grid size-11 place-items-center rounded-full border border-primary-200 bg-surface text-primary-950 lg:hidden" type="button" aria-label="Open menu" aria-expanded="false" data-k-menu>${icon('menu', 'size-5')}</button></div></header>${X.drawer(K, logo(K))}`,
};
const FOOTER = {
  // the website's own footer: its columns of links, its credentials, its seal, its social pages and its legal pages, on the brand's deep ground
  sg: (K) => {
    const s = K.site, f = footerOf(K);
    // (the titles of the footer's columns are labels, not headings of the page)
    const h4 = 'mb-4 text-[.76rem] font-bold tracking-[.18em] text-white uppercase', li = 'transition hover:text-white';
    const social = f.social.length ? `<ul class="m-0 mt-6 flex list-none flex-wrap gap-2.5 p-0">${f.social.map((x) => `<li>${x.icon ? `<a class="grid size-10 place-items-center rounded-full border border-white/20 transition duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/15" href="${esc(x.href)}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><img class="size-[1.1rem] object-contain" src="${esc(K.u(x.icon))}" alt="" width="18" height="18" loading="lazy"></a>` : `<a class="inline-flex rounded-full border border-white/20 px-3.5 py-1.5 text-[.82rem] font-semibold text-white/85 transition hover:border-white hover:bg-white hover:text-primary-950" href="${esc(x.href)}" rel="noopener" target="_blank">${esc(x.label)}</a>`}</li>`).join('')}</ul>` : '';
    const brand = `<div>${logo(K, true)}${f.blurb ? `<p class="mt-5 max-w-sm leading-relaxed" data-p="footText">${esc(f.blurb)}</p>` : ''}${f.seal ? `<div class="mt-6 [&_a]:inline-block [&_img]:h-auto [&_img]:max-h-14 [&_img]:w-auto [&_img]:max-w-full">${f.seal}</div>` : ''}${social}</div>`;
    const cols = f.cols.map((c) => `<nav aria-label="${esc(c.title || 'Footer')}">${c.title ? `<p class="${h4}" data-p="footHeading">${esc(c.title)}</p>` : ''}<ul class="m-0 grid list-none gap-3 p-0">${c.links.map((l) => `<li>${l.href ? `<a class="${li}" data-p="footLink" href="${esc(K.u(l.href))}">${esc(l.text)}</a>` : `<span data-p="footText">${esc(l.text)}</span>`}</li>`).join('')}</ul></nav>`).join('');
    const reach = `${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} font-semibold text-white" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-4 shrink-0 text-pop-300')}<a class="${li} break-all" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(s.address || 'Your address here')}</span></li>` : ''}${f.hours ? `<li class="flex items-start gap-3">${icon('clock', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(f.hours)}</span></li>` : ''}`;
    const cred = f.credentials ? `<p class="${h4} mt-8" data-p="footHeading">${esc(f.credentials.title || 'Credentials')}</p><ul class="m-0 grid list-none gap-2.5 p-0">${f.credentials.items.map((t) => `<li class="flex items-start gap-3">${icon('check', 'mt-1 size-4 shrink-0 text-pop-300')}<span data-p="footText">${esc(t)}</span></li>`).join('')}</ul>` : '';
    const grid = f.cols.length >= 3 ? 'lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.25fr]' : f.cols.length === 2 ? 'lg:grid-cols-[1.4fr_1.1fr_.9fr_1.25fr]' : 'lg:grid-cols-[1.5fr_1fr_1.25fr]';
    return `<footer class="${DEEP} pt-[clamp(3.5rem,7vw,6rem)] text-white/70 max-sm:pb-20"><div class="${WRAP}"><div class="grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 ${grid}">${brand}${cols}<div><p class="${h4}" data-p="footHeading">Contact</p><ul class="m-0 grid list-none gap-3.5 p-0">${reach}</ul>${cred}</div></div><div class="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center justify-between gap-4 border-t border-white/15 py-6 text-[.88rem]" data-p="footLegal"><span>${esc(f.copyright)}</span><span class="flex flex-wrap items-center gap-x-5 gap-y-2">${f.legal.map((l) => `<a class="hover:text-white" href="${esc(K.u(l.href))}">${esc(l.text)}</a>`).join('')}${K.web?.motion?.level === 'off' ? '' : '<button type="button" data-k-pause aria-pressed="false" class="rounded-full border border-white/30 px-3.5 py-1.5 text-[.72rem] font-bold tracking-[.12em] uppercase transition hover:bg-white/10">Pause animations</button>'}</span></div></div></footer>${X.controls(K)}`;
  },
};

const R = register(X, 'sg-');
export const SIGNATURE = {
  design: {
    id: 'signature', name: 'Signature', badge: 'Bright & assured', blurb: 'Deep shades of the brand colour, pale bands in turn, glass over photographs, cards with a gradient border whose light travels round them, and headings that rise word by word.',
    fonts: { heading: 'Plus Jakarta Sans', body: 'Inter' }, vars: { '--k-r': '1.15rem', '--k-r-btn': '999px', '--k-h-weight': '800', '--k-h-track': '-.032em' },
    header: 'sg', footer: 'sg', offered: true, ...R.flags, tones: TONES, ...R.blueprint,
  },
  hero, library: R.library, typed: R.typed, header: HEADER, footer: FOOTER,
};
