import { esc } from '../util/html.js';
import { icon as rawIcon } from './icons.js';

// Building blocks of the kit sections. Everything is Tailwind: T holds the class strings the sections share (written out in full so the
// Tailwind scanner sees every class), and the helpers return finished markup. Colours are the website's theme (bg-brand, text-heading,
// border-default...), the shape of a design comes from the --k-* variables (rounded-k, shadow-k2...).

export { esc };
export const icon = (name, cls = 'size-[1.35rem] shrink-0') => rawIcon(name, cls);
export const isHtml = (t) => /<\/?[a-z][\s\S]*>/i.test(String(t || ''));
export const text = (t) => (isHtml(t) ? String(t) : esc(t));
export const para = (t) => (t ? (isHtml(t) && /^\s*<(p|ul|ol|div|table)\b/i.test(t) ? t : `<p>${text(t)}</p>`) : '');
// the intro paragraphs of a section (HTML, kept whole: its links and emphasis are part of the content)
export const introOf = (s) => (s.intro || []).map((b) => (b.t === 'html' || b.html ? para(b.html) : '')).join('\n') || s.lead || '';
export const initials = (name) => String(name || '?').replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export const T = {
  wrap: 'mx-auto w-[min(100%-2.5rem,var(--k-wrap))]',
  rise: '', riseOld: 'supports-[animation-timeline:view()]:animate-k-rise supports-[animation-timeline:view()]:[animation-timeline:view()] supports-[animation-timeline:view()]:[animation-range:entry_0%_entry_35%] motion-reduce:animate-none',
  h1: 'font-display text-heading on-dark:text-on-dark font-[var(--k-h-weight)] tracking-[calc(var(--k-h-track)-.01em)] [text-transform:var(--k-h-case)] leading-[1.02] text-balance text-[clamp(2.5rem,1.2rem+5.4vw,4.9rem)]',
  h2: 'font-display text-heading on-dark:text-on-dark font-[var(--k-h-weight)] tracking-[var(--k-h-track)] [text-transform:var(--k-h-case)] leading-[1.08] text-balance text-[clamp(1.9rem,1.1rem+2.7vw,3.1rem)]',
  h3: 'font-display text-heading on-dark:text-on-dark font-[var(--k-h-weight)] tracking-[-.015em] [text-transform:var(--k-h-case)] leading-tight text-balance text-[clamp(1.15rem,1rem+.5vw,1.4rem)]',
  lead: 'max-w-2xl text-[clamp(1.08rem,1rem+.35vw,1.3rem)] leading-relaxed text-secondary on-dark:text-on-dark/75 [&_a]:font-bold [&_a]:text-brand [&_a]:underline [&_p+p]:mt-3',
  muted: 'text-secondary on-dark:text-on-dark/70',
  eyebrow: 'inline-flex w-fit items-center gap-2 rounded-full border border-brand/20 bg-brand/10 py-1.5 pr-3.5 pl-3 text-xs font-bold tracking-[.08em] text-brand uppercase before:size-2 before:rounded-full before:bg-accent before:shadow-[0_0_0_4px_color-mix(in_srgb,var(--th-brand-accent)_25%,transparent)] before:content-[\'\'] on-dark:border-white/20 on-dark:bg-white/10 on-dark:text-on-dark',
  btn: 'group/btn inline-flex items-center justify-center gap-2.5 rounded-kb border-[1.5px] border-transparent px-6 py-4 text-base leading-none font-bold whitespace-nowrap transition duration-200 hover:-translate-y-0.5 active:translate-y-0 max-sm:w-full',
  btnLg: 'px-8 py-[1.15rem] text-[1.05rem]',
  btnPrimary: 'bg-button text-button shadow-kglow hover:bg-primary-hover',
  btnAccent: 'bg-accent text-white shadow-[0_10px_30px_-8px_color-mix(in_srgb,var(--th-brand-accent)_60%,transparent)]',
  btnGhost: 'border-ink/20 text-heading hover:border-brand hover:bg-brand/5 hover:text-brand',
  btnLight: 'bg-white text-slate-900 shadow-[0_10px_30px_-10px_rgb(0_0_0/.4)]',
  btnOutLight: 'border-white/40 bg-white/10 text-white backdrop-blur-sm hover:border-white hover:bg-white/20',
  grad: 'bg-linear-to-br from-brand to-[color-mix(in_oklab,var(--th-brand-primary)_55%,var(--th-brand-accent))]',
  card: 'rounded-k border border-light bg-surface shadow-k1 transition duration-300 on-dark:border-white/10 on-dark:bg-white/5 on-dark:shadow-none',
  lift: 'hover:-translate-y-1 hover:border-brand/30 hover:shadow-k2',
  glass: 'rounded-k border border-white/55 bg-surf/70 shadow-k2 backdrop-blur-xl backdrop-saturate-150',
  ico: 'grid size-[3.2rem] shrink-0 place-items-center rounded-[calc(var(--k-r)*.7)] bg-brand/10 text-brand transition duration-300 on-dark:bg-white/10 on-dark:text-white group-hover/card:rotate-[-4deg] group-hover/card:scale-105 group-hover/card:bg-brand group-hover/card:text-white',
  icoLg: 'size-16',
  chip: 'inline-flex items-center gap-2 rounded-full border border-default bg-surface px-4 py-2 text-sm font-semibold text-heading shadow-k1 [&_svg]:size-4 [&_svg]:text-brand',
  pic: 'overflow-hidden rounded-k bg-paper-alt [&_img]:size-full [&_img]:object-cover',
  checks: 'grid list-none gap-3 p-0',
  checkLi: 'flex items-start gap-3 leading-snug font-semibold text-heading on-dark:text-on-dark',
};
export const tick = () => `<span class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand/15 text-brand on-dark:bg-white/15 on-dark:text-white">${icon('check', 'size-3.5 stroke-[3]')}</span>`;
export const checkList = (list, cols = false) => `<ul class="${T.checks} ${cols ? 'sm:grid-cols-2 sm:gap-x-8' : ''}">${list.map((t) => `<li class="${T.checkLi}">${tick()}<span>${esc(t)}</span></li>`).join('\n')}</ul>`;

// the tone of a placeholder picture
const ART = [
  'bg-linear-to-br from-[color-mix(in_srgb,var(--th-brand-primary)_85%,#000)] to-[color-mix(in_srgb,var(--th-brand-primary)_40%,var(--th-brand-accent))] text-white',
  'bg-linear-to-br from-[var(--th-brand-secondary)] to-[color-mix(in_srgb,var(--th-brand-primary)_70%,#000)] text-white',
  'bg-linear-to-br from-[color-mix(in_srgb,var(--th-brand-accent)_80%,#fff)] to-[color-mix(in_srgb,var(--th-brand-primary)_60%,#000)] text-white',
  'bg-linear-to-br from-[color-mix(in_srgb,var(--th-brand-primary)_14%,var(--th-bg))] to-[color-mix(in_srgb,var(--th-brand-accent)_16%,var(--th-bg))] text-brand',
];
export const TONES = [0, 1, 2, 3];
const ART_MESH = 'before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(60%_60%_at_20%_15%,rgb(255_255_255/.35),transparent_60%),radial-gradient(50%_50%_at_85%_85%,color-mix(in_srgb,var(--th-brand-accent)_70%,transparent),transparent_65%)] after:absolute after:inset-0 after:-z-10 after:k-mask-grid after:bg-[linear-gradient(rgb(255_255_255/.09)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/.09)_1px,transparent_1px)] after:bg-[size:2.2rem_2.2rem]';
export const art = (name, tone = 0, extra = '', plain = false) => `<div class="relative isolate grid min-h-56 place-items-center overflow-hidden rounded-k ${ART[tone % 4]} ${ART_MESH} ${extra}" ${plain ? 'aria-hidden="true"' : 'role="img" aria-label="Image placeholder"'}>${plain ? '' : icon(name, 'size-1/4 max-w-24 min-w-10 h-auto aspect-square stroke-[1.25] opacity-90 drop-shadow-lg')}</div>`;

// a picture: the real one when there is one, else a placeholder drawn in the theme colours
export function picture(K, img, fallbackIcon = 'image', tone = 0, cls = '') {
  if (img?.src) return `<div class="${T.pic} ${cls}">${K.img(img.src, img.alt || '')}</div>`;
  return art(fallbackIcon, tone, K.real ? `${cls} max-md:hidden` : cls, Boolean(K.real));
}

export const stars = (n = 5) => `<span class="inline-flex gap-0.5 text-amber-500" role="img" aria-label="${n} out of 5 stars">${rawIcon('star', 'size-4 fill-current stroke-current').repeat(n)}</span>`;

export function head(eyebrow, title, lead, { center = false, split = false, action = '' } = {}) {
  if (!title && !eyebrow && !lead) return '';
  return `<div class="mb-[clamp(2rem,4vw,3.5rem)] grid gap-4 ${center ? 'mx-auto max-w-3xl justify-items-center text-center' : 'max-w-3xl'} ${split ? 'max-w-none grid-cols-[1fr_auto] items-end max-sm:grid-cols-1' : ''}"><div class="grid gap-4 ${center ? 'justify-items-center' : ''}">${eyebrow ? `<span class="${T.eyebrow}">${esc(eyebrow)}</span>` : ''}${title ? `<h2 class="${T.h2}">${text(title)}</h2>` : ''}${lead ? (isHtml(lead) ? `<div class="${T.lead}">${lead}</div>` : `<p class="${T.lead}">${esc(lead)}</p>`) : ''}</div>${action}</div>`;
}

export const btn = (b, kind = 'primary', arrow = true, lg = false) => {
  if (!(b?.href || b?.text)) return '';
  const k = { primary: T.btnPrimary, accent: T.btnAccent, ghost: T.btnGhost, light: T.btnLight, outline: T.btnOutLight }[kind] || kind;
  return `<a class="${T.btn} ${k} ${lg ? T.btnLg : ''}" href="${esc(b.href || '#')}">${esc(b.text || 'Learn more')}${arrow ? icon('arrow', 'size-[1.15rem] transition group-hover/btn:translate-x-1') : ''}</a>`;
};
export const actions = (inner, cls = '') => `<div class="mt-8 flex flex-wrap gap-3.5 ${cls}">${inner}</div>`;

const TONE = {
  alt: 'bg-paper-alt',
  tint: 'bg-[color-mix(in_srgb,var(--th-brand-primary)_5%,var(--th-bg))]',
  dark: 'bg-night text-on-dark on-dark',
  brand: `${T.grad} text-white on-dark`,
};
// the section wrapper: background tone, id, and the scroll-in motion
export function sec(inner, { tone = '', cls = '', id = '', rise = true } = {}) {
  return `<section class="relative py-[var(--k-sec-y)] ${TONE[tone] || ''} ${cls}"${id ? ` id="${esc(id)}"` : ''}><div class="${T.wrap} ${rise ? T.rise : ''}">${inner}</div></section>`;
}
export const toneClass = (tone) => TONE[tone] || '';
export const TONE_KEYS = Object.keys(TONE);
