import { esc } from '../util/html.js';
import { imgTag } from '../images/optimize.js';
import { H, blockHtml, cardGrid, faqList, reviewsGrid, sectionTitle } from './components.js';
import { iconFor, iconSvg, iconNames } from './icons.js';

// Renders one home-page section. Every section type has several layout styles (s.variant); the page composer chooses the
// style per section. `o` carries the per-section design properties (background, alignment, spacing).

export const CHECK = (cls) => `<svg class="mt-1 size-5 shrink-0 ${cls}" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm4 6.6-4.6 5a.9.9 0 0 1-1.3 0L6 10.9l1.2-1.2 1.5 1.5 3.9-4.3 1.4 1.2Z"/></svg>`;
export const bgFor = (spec, i) => (spec.layout.sections === 'flat' ? 'bg-surface border-t border-black/5' : i % 2 === 0 ? 'bg-soft' : 'bg-surface');
export const headingHtml = (b) => `<h${b.level} class="${b.level === 2 ? H.h2 : H.h3b}">${esc(b.text)}</h${b.level}>`;

const ARROW = (cls = 'size-5') => iconSvg('arrow', cls);
const BG_CLASS = { white: 'bg-surface', soft: 'bg-soft', dark: 'bg-brand-dark text-on-dark on-dark', brand: 'bg-brand text-on-dark on-dark' };

// applies the per-section properties to the finished section markup
function restyle(html, o = {}) {
  if (!html || !o) return html;
  let out = html;
  out = out.replace(/<section class="([^"]*)"/, (m, cls) => {
    let toks = cls.split(/\s+/).filter(Boolean);
    if (o.bg && o.bg !== 'auto' && BG_CLASS[o.bg]) {
      toks = toks.filter((t) => !/^bg-/.test(t) && !['text-on-dark', 'border-t', 'border-black/5', 'on-dark'].includes(t));
      toks.push(...BG_CLASS[o.bg].split(' '));
    }
    if (o.spacing === 'tight' && toks.includes('sec')) toks.push('sec-tight');
    if (o.spacing === 'loose' && toks.includes('sec')) toks.push('sec-loose');
    return `<section class="${[...new Set(toks)].join(' ')}"`;
  });
  if (o.align === 'center') out = out.replace(/class="wrap([^"]*)"/, 'class="wrap$1 text-center"');
  return out;
}

export function renderSection(s, i, ctx, spec, u, site, model, o = {}) {
  const bg = bgFor(spec, i);
  const wrapSec = (inner, cls = bg) => `<section class="sec ${cls}"><div class="wrap">${inner}</div></section>`;
  const centerHead = spec.layout.sectionHead === 'center';
  const title = (t, center, left) => sectionTitle(t, spec, center ? 'centered text-center' : '', left);
  const intro = (list) => `<div class="prose-content max-w-3xl ${centerHead ? 'mx-auto text-center' : ''}">${(list || []).map((b) => blockHtml(b, u, ctx)).join('')}</div>`;
  const prose = (blocks) => `<div class="prose-content">${(blocks || []).map((b) => (b.t === 'h' ? headingHtml({ ...b, level: Math.max(3, b.level) }) : blockHtml(b, u, ctx))).join('')}</div>`;
  const story = spec.layout.homeStyle === 'story';
  const v = s.variant || '';
  const frame = { plain: 'rounded-card shadow-md', rounded: 'rounded-[2rem] shadow-xl', offset: 'rounded-card img-offset' }[o.frame || 'plain'];
  const imageOf = (src, alt, cls) => imgTag({ src, alt: alt || '' }, ctx, { cls, sizes: '(min-width: 1024px) 560px, 100vw' });
  const phone = site.phone?.digits ? `<a class="btn btn-ghost" href="tel:${site.phone.digits}">Call ${esc(site.phone.display)}</a>` : '';

  const html = (() => {
    switch (s.type) {
      case 'offers':
        return `<section class="bg-brand-dark py-6 text-on-dark on-dark"><div class="wrap flex flex-col items-center gap-5 lg:flex-row lg:justify-between">
        <ul class="plain grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">${s.items.map((x) => `<li class="text-center lg:text-left"><span class="block font-display h-case text-2xl text-accent-light">${esc(x.badge)}</span>${x.label ? `<span class="block text-sm">${esc(x.label)}</span>` : ''}</li>`).join('')}</ul>
        <div class="flex gap-3">${s.links.map((l) => `<a class="btn btn-accent ${l.mobile ? 'lg:hidden' : 'hidden lg:inline-flex'}" href="${esc(l.href)}">${esc(l.text)}</a>`).join('')}</div></div></section>`;

      case 'prose': {
        const pv = v || (story ? 'story' : 'stacked');
        if (pv === 'story') return wrapSec(`<div class="grid gap-8 lg:grid-cols-[1fr_1.6fr]"><div>${title(s.title, false, true)}</div>${prose(s.blocks)}</div>`);
        if (pv === 'centered') return wrapSec(`<div class="mx-auto max-w-3xl">${title(s.title, true)}${prose(s.blocks)}</div>`);
        return wrapSec(`${title(s.title)}<div class="max-w-4xl">${prose(s.blocks)}</div>`);
      }

      case 'tiles': {
        const n = Math.min(4, Math.max(2, s.items.length));
        const icon = (t) => (t.icon ? `<img src="${esc(u(t.icon.replace(/^\.\//, '/')))}" alt="" width="48" height="48" loading="lazy" decoding="async" class="size-11 shrink-0">` : `<span class="icon-badge shrink-0">${iconFor(t.text, 'size-6')}</span>`);
        if (v === 'cards') return `<section class="bg-soft py-8"><div class="wrap"><ul class="plain grid gap-4 sm:grid-cols-2 lg:grid-cols-${n}">${s.items.map((t) => `<li class="card flex items-center gap-3 p-4">${icon(t)}<span class="font-semibold leading-snug text-brand-dark">${esc(t.text)}</span></li>`).join('')}</ul></div></section>`;
        if (v === 'pills') return `<section class="bg-brand-dark py-4 text-on-dark on-dark"><div class="wrap"><ul class="plain flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-semibold">${s.items.map((t) => `<li class="flex items-center gap-2">${CHECK('!mt-0 text-accent-light')}<span>${esc(t.text)}</span></li>`).join('')}</ul></div></section>`;
        return `<section class="trust-strip"><div class="wrap"><ul class="plain grid sm:grid-cols-2 lg:grid-cols-${n}">${s.items.map((t) => `<li class="trust-item">${icon(t)}<span class="font-semibold leading-snug text-brand-dark">${esc(t.text)}</span></li>`).join('')}</ul></div></section>`;
      }

      case 'features': {
        if (v === 'icons') {
          const names = iconNames(s.items.map((t) => ({ title: t })));
          return wrapSec(`${title(s.title)}${intro(s.intro)}<ul class="plain mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${s.items.map((t, k) => `<li class="card card-icon flex items-start gap-3 p-4"><span class="icon-badge shrink-0">${iconSvg(names[k], 'size-6')}</span><span class="pt-1 font-semibold">${esc(t)}</span></li>`).join('')}</ul>`);
        }
        return wrapSec(`${title(s.title)}${intro(s.intro)}<ul class="plain mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 ${centerHead ? 'mx-auto max-w-4xl' : ''}">${s.items.map((t) => `<li class="flex gap-2">${CHECK('text-accent-text')}<span>${esc(t)}</span></li>`).join('')}</ul>`);
      }

      case 'cardgrid': {
        if (v === 'list') {
          const rows = s.items.map((c, k) => {
            const inner = `<span class="font-display text-3xl text-accent-text">${String(k + 1).padStart(2, '0')}</span><span><span class="block font-display h-case text-2xl text-brand-dark">${esc(c.title)}</span>${c.text ? `<span class="mt-1 block text-ink/80">${esc(c.text)}</span>` : ''}</span><span class="hidden text-accent-text sm:block">${c.href ? ARROW('size-6') : ''}</span>`;
            return c.href ? `<li><a class="group grid items-center gap-4 py-6 transition hover:bg-black/[.03] sm:grid-cols-[4.5rem_1fr_auto]" href="${esc(c.href)}">${inner}</a></li>` : `<li class="grid items-center gap-4 py-6 sm:grid-cols-[4.5rem_1fr_auto]">${inner}</li>`;
          });
          return wrapSec(`${title(s.title)}${intro(s.intro)}<ul class="plain mt-6 divide-y divide-default border-y border-black/10">${rows.join('')}</ul>`);
        }
        return wrapSec(`${title(s.title)}${intro(s.intro)}${s.small ? smallCards(s.items, u, ctx) : cardGrid(s.items, ctx, u)}`);
      }

      case 'iconcards':
        return wrapSec(`${title(s.title)}<ul class="plain my-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">${s.items.map((c) => `<li><a class="card flex h-full flex-col items-center gap-3 p-4 text-center text-sm font-semibold text-brand-dark hover:text-accent-text" href="${esc(c.href)}">${c.img ? imgTag({ src: c.img, alt: '' }, ctx, { cls: 'size-14', icon: true }) : ''}<span>${esc(c.text)}</span></a></li>`).join('')}</ul>`);

      case 'stats': {
        const pic = s.img ? `<div>${imageOf(s.img, '', `h-auto w-full ${frame}`)}</div>` : '';
        if (v === 'inline') return `<section class="sec bg-surface"><div class="wrap grid items-center gap-10 ${s.img ? 'lg:grid-cols-2' : ''}"><ul class="plain grid gap-8 text-center sm:grid-cols-3 sm:divide-x sm:divide-default">${s.items.map((x) => `<li class="px-4"><span class="block font-display h-case text-5xl text-brand-text lg:text-6xl">${esc(x.value)}</span><span class="mt-2 block text-sm font-semibold uppercase tracking-wider text-ink/70">${esc(x.label)}</span></li>`).join('')}</ul>${pic}</div></section>`;
        return `<section class="sec bg-surface"><div class="wrap grid items-center gap-8 ${s.img ? 'lg:grid-cols-2' : ''}"><ul class="plain grid gap-4 sm:grid-cols-3">${s.items.map((x) => `<li class="rounded-card bg-brand-dark p-6 text-center text-on-dark"><span class="block font-display h-case text-5xl text-accent-light">${esc(x.value)}</span><span class="mt-1 block text-sm uppercase tracking-wider">${esc(x.label)}</span></li>`).join('')}</ul>${pic}</div></section>`;
      }

      case 'listform':
        return `<section class="sec ${bg}"><div class="wrap grid gap-10 lg:grid-cols-[1fr_26rem]"><div>${title(s.title)}<ul class="plain mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">${s.items.map((x) => `<li class="flex gap-2">${CHECK('text-accent-text')}<span>${esc(x)}</span></li>`).join('')}</ul></div>
        <aside id="quote" class="card border-t-4 !border-t-accent p-5"><p class="${H.h3}">${esc(s.formTitle)}</p><div class="prose-content mb-3 mt-2 text-sm">${(s.formBlocks || []).map((b) => blockHtml(b, u, ctx)).join('')}</div>${model.protected.form || ''}</aside></div></section>`;

      case 'reviews': {
        if (v === 'featured' && s.items.length > 1) {
          const [first, ...rest] = s.items;
          const mini = (r) => `<figure class="card p-5"><blockquote><p>${esc(r.quote)}</p></blockquote><figcaption class="mt-3 text-sm"><strong class="text-brand-dark">${esc(r.name)}</strong>${r.place ? `<span class="block text-ink/75">${esc(r.place)}</span>` : ''}</figcaption></figure>`;
          return wrapSec(`${title(s.title)}<div class="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]"><figure class="rounded-card bg-brand-dark p-8 text-on-dark lg:p-12"><span class="quote-mark">“</span><blockquote class="mt-4 font-display text-2xl leading-snug sm:text-3xl"><p>${esc(first.quote)}</p></blockquote><figcaption class="mt-6 text-sm"><strong class="text-accent-light">${esc(first.name)}</strong>${first.place ? `<span class="block text-white/75">${esc(first.place)}</span>` : ''}</figcaption></figure><div class="grid gap-4">${rest.slice(0, 3).map(mini).join('')}</div></div>`, 'bg-surface');
        }
        if (v === 'stacked') return wrapSec(`${title(s.title)}<div class="mx-auto mt-6 max-w-3xl divide-y divide-default">${s.items.map((r) => `<figure class="py-6"><blockquote class="text-lg leading-relaxed"><p>“${esc(r.quote)}”</p></blockquote><figcaption class="mt-3 text-sm font-bold text-brand-dark">${esc(r.name)}${r.place ? ` <span class="font-normal text-ink/70">· ${esc(r.place)}</span>` : ''}</figcaption></figure>`).join('')}</div>`, 'bg-surface');
        return wrapSec(`${title(s.title)}${reviewsGrid(s.items)}`, 'bg-surface');
      }

      case 'faq': {
        const side = s.img || s.sideTitle ? `<div class="mt-8 grid gap-8 lg:grid-cols-[22rem_1fr]"><div>${s.sideTitle ? `<p class="mb-3 ${H.h3}">${esc(s.sideTitle)}</p>` : ''}${s.img ? imgTag({ src: s.img, alt: '' }, ctx, { cls: 'h-auto w-full rounded-card shadow-md', sizes: '(min-width: 1024px) 352px, 100vw' }) : ''}</div>${faqList(s.items)}</div>` : faqList(s.items);
        if (v === 'split') return wrapSec(`<div class="grid gap-10 lg:grid-cols-[1fr_1.7fr]"><div class="lg:sticky lg:top-28 lg:self-start">${title(s.title, false, true)}<div class="prose-content">${(s.intro || []).map((b) => blockHtml(b, u, ctx)).join('')}</div>${s.sideTitle ? `<p class="mt-6 ${H.h3}">${esc(s.sideTitle)}</p>` : ''}${s.img ? `<div class="mt-4">${imgTag({ src: s.img, alt: '' }, ctx, { cls: 'h-auto w-full rounded-card shadow-md', sizes: '(min-width: 1024px) 352px, 100vw' })}</div>` : ''}</div>${faqList(s.items)}</div>`, 'bg-surface');
        return wrapSec(`${title(s.title)}<div class="prose-content max-w-4xl">${(s.intro || []).map((b) => blockHtml(b, u, ctx)).join('')}</div>${side}`, 'bg-surface');
      }

      case 'areas': {
        if (v === 'pills') return wrapSec(s.groups.map((g) => `<div class="mb-6">${g.title ? `<h2 class="${H.label}">${esc(g.title)}</h2>` : ''}<ul class="plain mt-4 flex flex-wrap gap-2">${g.links.map((l) => `<li><a class="inline-block rounded-full border border-black/15 bg-surface px-4 py-1.5 text-sm font-semibold text-brand-text transition hover:border-accent hover:text-accent-text" href="${esc(l.href)}">${esc(l.text)}</a></li>`).join('')}</ul></div>`).join(''));
        return wrapSec(`<div class="grid gap-10 ${s.groups.length > 1 ? 'lg:grid-cols-2' : ''}">${s.groups.map((g) => `<div>${g.title ? `<h2 class="${H.label}">${esc(g.title)}</h2>` : ''}<ul class="plain mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">${g.links.map((l) => `<li><a class="text-brand-text hover:text-accent-text" href="${esc(l.href)}">${esc(l.text)}</a></li>`).join('')}</ul></div>`).join('')}</div>`);
      }

      case 'split': {
        const img = s.img ? imageOf(s.img, s.imgAlt, `h-auto w-full ${frame}`) : '';
        const flip = v ? v === 'image-right' : s.flip || (story && i % 2 === 1);
        return wrapSec(`<div class="grid items-center gap-10 lg:grid-cols-2"><div class="${flip ? 'lg:order-2' : ''}">${img}</div><div>${title(s.title)}${prose(s.blocks)}</div></div>`, story ? bg : 'bg-surface');
      }

      case 'contact':
        return `<section class="sec bg-brand-dark text-on-dark on-dark"><div class="wrap"><ul class="plain grid gap-6 md:grid-cols-3">${s.items.map((c) => `<li class="flex items-start gap-4">${c.icon ? `<img src="${esc(u(c.icon.replace(/^\.\//, '/')))}" alt="" width="40" height="40" loading="lazy" decoding="async" class="size-10 invert">` : ''}<div><p class="font-display h-case text-xl text-accent-light">${esc(c.title)}</p><p class="text-white/90">${/\d{3}[\s.-]\d{3}[\s.-]\d{4}/.test(c.text) ? `<a class="underline" href="tel:${site.phone.digits}">${esc(c.text)}</a>` : esc(c.text)}</p></div></li>`).join('')}</ul></div></section>`;

      case 'cta': {
        const heading = esc(s.title || site.ctaTitle || 'Talk to our team');
        const btn = s.href ? `<a class="btn btn-accent" href="${esc(s.href)}">${esc(s.label || 'Contact us')}</a>` : '';
        if (v === 'centered') return `<section class="sec bg-brand-dark text-on-dark on-dark"><div class="wrap mx-auto max-w-3xl text-center"><p class="font-display h-case text-4xl sm:text-5xl">${heading}</p>${s.text ? `<p class="mt-4 text-lg text-white/85">${esc(s.text)}</p>` : ''}<div class="mt-8 flex flex-wrap justify-center gap-3">${btn}${phone}</div></div></section>`;
        if (v === 'split') return `<section class="bg-brand-dark text-on-dark on-dark"><div class="grid lg:grid-cols-2"><div class="px-6 py-14 lg:px-16"><p class="font-display h-case text-3xl sm:text-4xl">${heading}</p>${s.text ? `<p class="mt-3 text-white/85">${esc(s.text)}</p>` : ''}</div><div class="flex flex-col justify-center gap-3 bg-accent px-6 py-14 lg:px-16" style="color:var(--brand-on-accent)"><p class="text-sm font-bold uppercase tracking-wider">${site.phone?.digits ? 'Call us' : 'Get in touch'}</p>${site.phone?.digits ? `<a class="font-display text-4xl" href="tel:${site.phone.digits}">${esc(site.phone.display)}</a>` : ''}${s.href ? `<a class="font-semibold underline" href="${esc(s.href)}">${esc(s.label || 'Contact us')}</a>` : ''}</div></div></section>`;
        return `<section class="sec bg-brand-dark text-on-dark on-dark"><div class="wrap flex flex-col items-start justify-between gap-5 md:flex-row md:items-center"><div><p class="font-display h-case text-3xl sm:text-4xl">${heading}</p>${s.text ? `<p class="mt-2 text-white/85">${esc(s.text)}</p>` : ''}</div>${btn}</div></section>`;
      }

      default:
        return '';
    }
  })();
  return restyle(html, o);
}

export function smallCards(items, u, ctx) {
  const mode = ctx?.spec?.layout?.cardLayout;
  const names = iconNames(items);
  return `<ul class="plain mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">${items.map((b, i) => `<li class="card card-icon p-6">${mode === 'numbered' ? `<span class="num font-display text-4xl leading-none text-accent-text">${String(i + 1).padStart(2, '0')}</span>` : b.icon ? `<img src="${esc(u(b.icon.replace(/^\.\//, '/')))}" alt="" width="44" height="44" loading="lazy" decoding="async" class="size-11">` : `<span class="icon-badge">${iconSvg(names[i], 'size-6')}</span>`}<h3 class="mt-3 ${H.h3}">${esc(b.title)}</h3><p class="mt-2 text-[0.95rem] text-ink/85">${esc(b.text)}</p></li>`).join('')}</ul>`;
}
