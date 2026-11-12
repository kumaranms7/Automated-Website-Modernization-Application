import { esc } from '../util/html.js';
import { imgTag } from '../images/optimize.js';
import { iconFor, iconSvg, iconNames } from './icons.js';

// Building blocks shared by the three layouts (home, inner, contact). Every visual choice is read from the design
// spec, so the same content renders differently for each site.

export const isExternal = (h) => /^https?:\/\//i.test(h || '');
export const attrs = (h) => (isExternal(h) ? ' target="_blank" rel="noopener"' : '');

export function makeUrl(depth, absolute = false) {
  // Error pages are served from any URL depth, so their asset links must be root-absolute.
  if (absolute) return (href) => href || '#';
  const prefix = depth ? '../'.repeat(depth) : './';
  return (href) => {
    if (!href) return '#';
    if (href === '/') return prefix;
    return href.startsWith('/') ? prefix + href.slice(1) : href;
  };
}


export const H = {
  h2: 'section-title font-display h-case text-3xl text-brand-dark sm:text-4xl',
  h3: 'font-display h-case text-2xl text-brand-dark',
  h3b: 'mt-6 font-display h-case text-2xl text-brand-text sm:text-3xl',
  label: 'font-display h-case text-xl text-brand-dark',
};

// ---------- hero ----------
export function heroTheme(variant) {
  return {
    gradient: { cls: 'hero hero-gradient', text: '', crumb: 'text-white/75', crumbNow: 'text-on-dark', b2: 'btn btn-ghost', align: '', onDark: true },
    split: { cls: 'hero hero-split', text: '', crumb: 'text-white/75', crumbNow: 'text-on-dark', b2: 'btn btn-ghost', align: '', onDark: true },
    centered: { cls: 'hero hero-centered', text: '', crumb: 'text-ink/70', crumbNow: 'text-ink', b2: 'btn btn-outline', align: 'text-center items-center justify-center', onDark: false },
    light: { cls: 'hero hero-light', text: '', crumb: 'text-ink/70', crumbNow: 'text-ink', b2: 'btn btn-outline', align: '', onDark: false },
    photo: { cls: 'hero hero-photo', text: '', crumb: 'text-white/80', crumbNow: 'text-on-dark', b2: 'btn btn-ghost', align: '', onDark: true, photo: true },
    dark: { cls: 'hero hero-dark', text: '', crumb: 'text-white/70', crumbNow: 'text-on-dark', b2: 'btn btn-ghost', align: '', onDark: true },
    editorial: { cls: 'hero hero-editorial', text: '', crumb: 'text-ink/70', crumbNow: 'text-ink', b2: 'btn btn-outline', align: '', onDark: false },
  }[variant];
}

// The photo for a photographic hero: the one chosen in the design, else a large landscape image the page already has.
// a banner added in Design settings is a file the platform keeps: its path is made right for the page that shows it
export const bannerSrc = (src, ctx) => (String(src).startsWith('assets/banners/') && ctx.siteUrl ? ctx.siteUrl('/' + src) : src);
// the banner of this page when it is used as a normal picture (not as the background)
export const bannerImage = (spec, ctx) => { const b = spec.extras?.heroImage; return b?.src && b.mode === 'image' ? { src: bannerSrc(b.src, ctx), alt: b.alt || '' } : null; };

export function heroPhoto(spec, ctx, fallback) {
  const chosen = spec.extras?.heroImage;
  if (chosen?.src) return { src: bannerSrc(chosen.src, ctx), alt: chosen.alt || '' };
  if (fallback?.src && (!ctx.dims || (ctx.dims[fallback.src]?.w || 0) >= 900)) return { src: fallback.src, alt: fallback.alt || '' };
  return ctx.heroCandidate || null;
}
export const heroBg = (photo, ctx) => imgTag({ src: photo.src, alt: photo.alt }, ctx, { cls: 'hero-bg', priority: true, sizes: '100vw' });

// Section heading in the style the design chose: accent rule (left), centred, or a vertical bar.
export function sectionTitle(text, spec, extra = '', left = false) {
  if (!text) return '';
  const m = left ? 'left' : spec?.layout?.sectionHead || 'left';
  return `<h2 class="${H.h2} ${m === 'center' ? 'centered text-center' : ''} ${m === 'bar' ? 'title-bar' : ''} ${extra}">${esc(text)}</h2>`;
}

export function crumbsHtml(model, site, u, th) {
  const items = model.hero.crumbs.map((c, i, a) => {
    const last = i === a.length - 1;
    return `<li class="flex items-center gap-2">${c.href && !last ? `<a class="hover:underline" href="${esc(u(c.href === site.host ? '/' : c.href))}">${esc(c.text)}</a>` : `<span aria-current="page" class="${th.crumbNow}">${esc(c.text)}</span>`}${last ? '' : '<span aria-hidden="true">/</span>'}</li>`;
  }).join('');
  return items ? `<nav aria-label="Breadcrumb"><ol class="mb-4 flex flex-wrap gap-2 text-sm ${th.crumb} ${th.align.includes('center') ? 'justify-center' : ''}">${items}</ol></nav>` : '';
}

export function heroButtons(site, u, th, ctaHref) {
  return `<div class="mt-6 flex flex-wrap gap-3 ${th.align.includes('center') ? 'justify-center' : ''}"><a class="btn btn-accent" href="tel:${site.phone.digits}">Call ${esc(site.phone.display)}</a>
  <a class="${th.b2}" href="${esc(ctaHref)}">${esc(site.ctaLabel || 'Request a quote')}</a></div>`;
}

export function innerHero(model, site, u, ctx, spec, heroImg0) {
  const banner = bannerImage(spec, ctx);
  const heroImg = banner || heroImg0;
  const v = banner && !['split', 'editorial'].includes(spec.layout.hero) ? 'split' : spec.layout.hero;
  const photo = v === 'photo' ? heroPhoto(spec, ctx, heroImg) : null;
  const th = heroTheme(v === 'photo' && !photo ? 'gradient' : v);
  const ctaHref = model.sideForm ? '#quote' : u(site.ctaHref);
  const h1 = `<h1 class="font-display h-case text-4xl leading-tight sm:text-5xl lg:text-6xl">${esc(model.hero.h1)}</h1>`;
  const text = `${crumbsHtml(model, site, u, th)}${h1}${heroButtons(site, u, th, ctaHref)}`;
  if (photo) { ctx.state.heroImage = true; return `<section class="${th.cls} hero-inner">${heroBg(photo, ctx)}<div class="wrap relative z-10 flex flex-col py-14 lg:py-20">${text}</div></section>`; }
  if (['split', 'editorial'].includes(v) && heroImg) {
    return `<section class="${th.cls}"><div class="wrap grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-16"><div>${text}</div><div>${imgTag(heroImg, ctx, { cls: 'hero-img h-auto w-full rounded-card shadow-xl', priority: true, sizes: '(min-width: 1024px) 560px, 100vw' })}</div></div></section>`;
  }
  return `<section class="${th.cls}"><div class="wrap flex flex-col ${th.align} py-12 lg:py-16">${text}</div></section>`;
}

// ---------- header / footer ----------
function navMarkup(site, u) {
  const link = 'block px-3 py-2 rounded-md text-[0.95rem] font-semibold text-ink hover:text-brand-text focus-visible:text-brand-text';
  return site.nav.map((item) => {
    if (!item.children.length) return `<li><a class="${link}" href="${esc(u(item.href))}">${esc(item.label)}</a></li>`;
    const mega = item.children.some((c) => c.children.length);
    const panel = mega
      ? `<div class="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2 lg:w-[34rem]">${item.children.map((c) => `
          <div><a class="block font-display h-case text-xl text-brand-dark hover:text-accent-text" href="${esc(u(c.href))}">${esc(c.label)}</a>
          <ul class="mt-1 grid grid-cols-2 gap-x-3">${c.children.map((k) => `<li><a class="block py-1 text-sm text-ink/80 hover:text-brand-text" href="${esc(u(k.href))}">${esc(k.label)}</a></li>`).join('')}</ul></div>`).join('')}</div>`
      : `<ul class="p-2 lg:w-80">${item.children.map((c) => `<li><a class="block rounded-md px-3 py-2 text-sm text-ink hover:bg-soft hover:text-brand-text" href="${esc(u(c.href))}">${esc(c.label)}</a></li>`).join('')}</ul>`;
    return `<li class="group relative">
      <div class="flex items-center"><a class="${link} grow" href="${esc(u(item.href))}">${esc(item.label)}</a>
      <button type="button" class="nav-toggle grid size-10 place-items-center text-ink lg:size-6" aria-expanded="false" aria-label="Show ${esc(item.label)} menu"><svg class="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.2 7.5 10 12.3l4.8-4.8-1.1-1.1L10 10.1 6.3 6.4z"/></svg></button></div>
      <div class="hidden rounded-card bg-surface shadow-xl ring-1 ring-black/5 data-[open=true]:block lg:absolute lg:left-0 lg:top-full lg:z-30 lg:group-hover:block lg:group-focus-within:block" data-panel>${panel}</div></li>`;
  }).join('');
}

// Links added through the design extras: a path stays inside the site, anything else (https, tel, mailto) is used as given.
const extraHref = (u, h) => (/^(https:|tel:|mailto:|#)/i.test(h) ? h : u(h.startsWith('/') ? h : '/' + h));

export function header(site, u, spec) {
  const tel = `tel:${site.phone.digits}`;
  const v = spec.layout.header;
  const topbar = spec.layout.topbar && v !== 'minimal' && (site.address || site.phone.display)
    ? `<div class="hidden bg-brand-dark text-on-dark lg:block"><div class="wrap flex items-center justify-between py-1.5 text-sm">
    <p class="flex items-center gap-2">${site.address ? `<svg class="size-4 text-accent-light" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5a6 6 0 0 0-6 6c0 4.2 6 11 6 11s6-6.8 6-11a6 6 0 0 0-6-6Zm0 8.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z"/></svg>${esc(site.address)}` : ''}</p>
    <a class="font-semibold hover:text-accent-light" href="${tel}">${esc(site.phone.display)}</a></div></div>` : '';
  const logo = `<a href="${esc(u('/'))}" aria-label="${esc(site.name)} home"><img src="${esc(u(site.logo))}" alt="${esc(site.name)}" width="220" height="56" class="h-12 w-auto sm:h-14"></a>`;
  const menuBtn = `<button id="menu-btn" type="button" class="grid size-11 place-items-center rounded-md text-ink ring-1 ring-black/10 lg:hidden" aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>`;
  const navCls = 'hidden absolute inset-x-0 top-full max-h-[80vh] overflow-y-auto bg-surface px-4 pb-4 shadow-lg data-[open=true]:block lg:static lg:block lg:max-h-none lg:overflow-visible lg:p-0 lg:shadow-none';
  const nav = (extra = '') => `<nav id="site-nav" aria-label="Main" class="${navCls} ${extra}"><ul class="lg:flex lg:items-center lg:gap-1 ${extra.includes('center') ? 'lg:justify-center' : ''}">${navMarkup(site, u)}</ul></nav>`;
  const more = (spec.extras?.headerButtons || []).map((b) => `<a href="${esc(extraHref(u, b.href))}" class="btn btn-accent hidden lg:inline-flex">${esc(b.label)}</a>`).join('');
  const call = `${more}<a href="${tel}" class="btn btn-accent hidden sm:inline-flex lg:hidden xl:inline-flex">Call ${esc(site.phone.display)}</a>`;

  let bar;
  if (v === 'centered') {
    bar = `<div class="wrap relative flex flex-col items-center gap-1 py-3"><div class="flex w-full items-center justify-between lg:justify-center"><span class="lg:hidden"></span>${logo}${menuBtn}</div>${nav('lg:justify-center center')}</div>`;
  } else if (v === 'minimal') {
    bar = `<div class="wrap flex items-center justify-between gap-4 py-2">${logo}${nav()}<div class="flex items-center gap-3"><a href="${tel}" class="hidden font-semibold text-brand-text hover:underline sm:block">${esc(site.phone.display)}</a>${menuBtn}</div></div>`;
  } else {
    bar = `<div class="wrap flex items-center justify-between gap-4 py-2.5">${logo}${nav()}<div class="flex items-center gap-2">${call}${menuBtn}</div></div>`;
  }
  return `<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
<header class="sticky top-0 z-40 bg-surface shadow-sm">${topbar}${bar}</header>`;
}

const FOOT = {
  dark: { bg: 'bg-ink text-on-dark', muted: 'text-white/75', border: 'border-white/10', head: 'text-on-dark', phone: 'text-accent-light', hover: 'hover:text-accent-light', fine: 'text-white/70' },
  brand: { bg: 'bg-brand-dark text-on-dark', muted: 'text-white/80', border: 'border-white/15', head: 'text-on-dark', phone: 'text-accent-light', hover: 'hover:text-accent-light', fine: 'text-white/75' },
  light: { bg: 'bg-soft text-ink', muted: 'text-ink/80', border: 'border-black/10', head: 'text-brand-dark', phone: 'text-brand-text', hover: 'hover:text-brand-text', fine: 'text-ink/75' },
};

function sized(html) {
  if (!html) return '';
  return html.replace(/rel="nofollow"/gi, 'rel="nofollow noopener"').replace(/<img\b(?![^>]*\bwidth=)([^>]*?src="[^"]*-(\d{2,4})-(\d{2,3})-[^"]*"[^>]*)>/i, '<img width="$2" height="$3" loading="lazy" $1>');
}

export function footer(site, u, spec) {
  const f = FOOT[spec.layout.footer];
  const col = (c) => `<div>${c.title ? `<h2 class="font-display h-case text-xl ${f.head}">${esc(c.title)}</h2>` : ''}<ul class="mt-3 space-y-2 text-sm">${c.items.map((i) => `<li>${i.href ? `<a class="${f.muted} ${f.hover}" href="${esc(u(i.href))}"${attrs(i.href)}>${esc(i.text)}</a>` : `<span class="${f.muted}">${esc(i.text)}</span>`}</li>`).join('')}</ul></div>`;
  const cred = site.credentials.items.length ? col({ title: site.credentials.title, items: site.credentials.items.map((t) => ({ text: t })) }) : '';
  return `<footer class="${f.bg}"><div class="wrap grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
  <div><img src="${esc(u(site.footerLogo))}" alt="${esc(site.name)}" width="200" height="52" loading="lazy" class="h-12 w-auto ${spec.layout.footer === 'light' ? '' : ''}">
    <p class="mt-4 text-sm ${f.muted}">${esc(site.address)}</p>
    <p class="mt-2"><a class="font-semibold ${f.phone}" href="tel:${site.phone.digits}">${esc(site.phone.display)}</a></p>
    <div class="mt-4">${sized(site.bbbSealHtml)}</div></div>
  ${site.footerCols.map(col).join('')}${cred}
  </div>
  ${site.social.length ? `<div class="wrap pb-8"><ul class="flex gap-3">${site.social.map((s) => `<li><a class="grid size-10 place-items-center rounded-full bg-black/10 hover:bg-accent" href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="${esc(s.alt || s.label)}"><img src="${esc(u(s.icon))}" alt="" width="20" height="20" loading="lazy" class="size-5"></a></li>`).join('')}</ul></div>` : ''}
  <div class="border-t ${f.border}"><div class="wrap flex flex-col gap-2 py-5 text-sm ${f.fine} sm:flex-row sm:justify-between">
    <p>&copy; <span data-year>${new Date().getFullYear()}</span> ${esc(site.copyrightName)}. All rights reserved.</p>
    <ul class="flex flex-wrap gap-4">${site.sitemapHref ? `<li><a class="${f.hover}" href="${esc(u(site.sitemapHref))}">Sitemap</a></li>` : ''}${site.legal.filter((x) => !/sitemap/i.test(x.text)).map((l) => `<li><a class="${f.hover}" href="${esc(u(l.href))}">${esc(l.text)}</a></li>`).join('')}</ul></div></div>
</footer>
<div class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 bg-brand-dark text-on-dark lg:hidden">
  <a class="py-3.5 text-center font-semibold" href="tel:${site.phone.digits}">Call now</a><a class="bg-accent py-3.5 text-center font-semibold text-[color:var(--brand-on-accent)]" href="${esc(u(site.ctaHref))}">Contact</a></div>
${backToTop(site, u, spec)}
${floating(u, spec)}`;
}

export function ctaBand(site, u) {
  return `<section class="sec bg-brand-dark text-on-dark"><div class="wrap flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
  <div><p class="font-display h-case text-3xl sm:text-4xl">${esc(site.ctaTitle || 'Talk to our team')}</p><p class="mt-1 text-white/80">${esc(site.name)}</p></div>
  <div class="flex flex-wrap gap-3"><a class="btn btn-accent" href="tel:${site.phone.digits}">Call ${esc(site.phone.display)}</a><a class="btn btn-ghost" href="${esc(u(site.ctaHref))}">Contact us</a></div></div></section>`;
}

// ---------- form ----------
export function formCard(model, { sticky = true } = {}) {
  const q = model.quoteHeading;
  return `<aside id="quote" class="card border-t-4 !border-t-accent p-5 ${sticky ? 'lg:sticky lg:top-28' : ''}">
  ${q?.title ? `<p class="font-display h-case text-2xl text-brand-dark">${esc(q.title)}</p>` : ''}
  ${q?.sub ? `<p class="mb-3 text-sm font-semibold text-accent-text">${esc(q.sub)}</p>` : ''}
  ${model.protected.form || ''}</aside>`;
}

// ---------- content blocks ----------
export function blockHtml(b, u, ctx) {
  switch (b.t) {
    case 'html': return b.html.replace(/<a ([^>]*)target="_blank"(?![^>]*rel=)/g, '<a $1target="_blank" rel="noopener"');
    case 'img': {
      const first = !ctx.state.heroImage;
      ctx.state.heroImage = true; // the first content image is the likely LCP element
      return `<figure class="my-6">${imgTag(b, ctx, { cls: 'h-auto max-w-full rounded-card shadow-md', priority: first })}${b.caption ? `<figcaption class="mt-2 text-sm text-ink/75">${esc(b.caption)}</figcaption>` : ''}</figure>`;
    }
    case 'callout': return `<div class="my-6 rounded-card border-l-4 border-accent bg-accent/10 p-5">${b.title ? `<p class="font-display h-case text-2xl text-brand-dark">${esc(b.title)}</p>` : ''}${b.text ? `<p class="mt-1 font-semibold">${esc(b.text)}</p>` : ''}</div>`;
    case 'links': return `<ul class="plain my-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">${b.items.map((i) => `<li><a class="card flex items-center justify-between px-4 py-3 font-semibold text-brand-dark hover:text-accent-text" href="${esc(i.href)}">${esc(i.text)}<span aria-hidden="true">→</span></a></li>`).join('')}</ul>`;
    case 'reviews': return reviewsGrid(b.items, 'md:grid-cols-2');
    case 'faq': return faqList(b.items);
    case 'cta': return `<div class="my-8 flex flex-col gap-4 rounded-card bg-brand-dark p-6 text-on-dark sm:flex-row sm:items-center sm:justify-between"><div>${b.title ? `<p class="font-display h-case text-3xl">${esc(b.title)}</p>` : ''}${b.text ? `<p class="mt-2 text-white/85">${esc(b.text)}</p>` : ''}</div>${b.href ? `<a class="btn btn-accent shrink-0" href="${esc(b.href)}">${esc(b.label)}</a>` : ''}</div>`;
    case 'cards': return `${b.title ? `<h2 class="${H.h2}">${esc(b.title)}</h2>` : ''}<ul class="plain my-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">${b.items.map((i) => `<li><a class="card flex h-full flex-col items-center gap-3 p-4 text-center text-sm font-semibold text-brand-dark hover:text-accent-text" href="${esc(i.href)}">${i.img ? imgTag({ src: i.img, alt: '' }, ctx, { cls: 'size-14', icon: true }) : ''}<span>${esc(i.text)}</span></a></li>`).join('')}</ul>`;
    case 'cardgrid': return cardGrid(b.items, ctx, u);
    case 'related': return `<div class="my-6 grid gap-5 md:grid-cols-2">${b.groups.map((g) => `<div class="card p-5"><p class="${H.label}">${esc(g.title)}</p><ul class="plain mt-3 space-y-1.5 text-[0.95rem]">${g.links.map((l) => `<li><a class="text-brand-text hover:text-accent-text" href="${esc(u(l.href))}">${esc(l.text)}</a></li>`).join('')}</ul></div>`).join('')}</div>`;
    case 'form': return ctx.model.protected.form ? `<div class="my-6 max-w-xl">${formCard(ctx.model, { sticky: false })}</div>` : '';
    case 'raw': return b.why === 'iframe' ? `<div class="my-6 h-[22rem] w-full overflow-hidden rounded-card shadow-md">${b.html.replace(/\s(width|height)="[^"]*"/gi, '').replace(/<iframe\b/i, '<iframe class="h-full w-full" loading="lazy"' + (/\stitle=/i.test(b.html) ? '' : ' title="Map"'))}</div>` : `<div class="my-6">${b.html}</div>`;
    default: return '';
  }
}

export function reviewsGrid(items, cols = 'md:grid-cols-2 lg:grid-cols-3') {
  return `<div class="my-6 grid gap-5 ${cols}">${items.map((r) => `<figure class="card flex h-full flex-col p-6"><span class="quote-mark" aria-hidden="true">“</span><blockquote class="grow text-ink/90"><p>${esc(r.quote)}</p></blockquote><figcaption class="mt-4 text-sm"><strong class="text-brand-dark">${esc(r.name)}</strong>${r.place ? `<span class="block text-ink/75">${esc(r.place)}</span>` : ''}</figcaption></figure>`).join('')}</div>`;
}

export function faqList(items) {
  return `<div class="card my-6 divide-y divide-default">${items.map((f) => `<details class="group p-4"><summary class="flex cursor-pointer list-none items-center justify-between font-semibold text-brand-dark">${esc(f.q)}<span class="ml-4 text-accent-text transition group-open:rotate-45" aria-hidden="true">+</span></summary><div class="prose-content mt-2">${f.a}</div></details>`).join('')}</div>`;
}

// Card layouts. "auto" uses photos only when most of the cards have a photo big enough to look good, and otherwise
// icon cards, so small thumbnails are never stretched or left floating in white space.
export function cardGrid(items, ctx, u) {
  const want = ctx.spec?.layout?.cardLayout || 'auto';
  const big = (c) => c.img && (!ctx.dims || (ctx.dims[c.img]?.w || 0) >= 480);
  const enough = items.filter(big).length >= Math.ceil(items.length * 0.6);
  let mode = want === 'auto' ? (enough ? 'image' : 'icon') : want;
  if ((mode === 'image' || mode === 'overlay') && !enough) mode = 'icon';
  const cols = items.length % 3 === 0 || items.length > 4 ? 'sm:grid-cols-2 lg:grid-cols-3' : items.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2';
  const names = iconNames(items);
  const own = (c, i) => iconSvg(names[i], 'size-6');
  const more = (c) => (c.href ? `<span class="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-accent-text">Learn more ${iconSvg('arrow', 'size-4')}</span>` : '');
  const wrap = (c, cls, inner) => (c.href ? `<li><a class="${cls} group" href="${esc(c.href)}">${inner}</a></li>` : `<li class="${cls}">${inner}</li>`);
  return `<ul class="plain my-6 grid gap-6 ${cols}">${items.map((c, i) => {
    if (mode === 'overlay') return wrap(c, 'card-overlay relative block overflow-hidden rounded-card', `${imgTag({ src: c.img, alt: c.imgAlt || '' }, ctx, { cls: 'aspect-[4/3] w-full object-cover', sizes: '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw' })}<span class="card-shade"></span><span class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-on-dark"><span class="font-display h-case text-2xl leading-tight">${esc(c.title)}</span>${c.href ? iconSvg('arrow', 'size-6 shrink-0') : ''}</span>`);
    if (mode === 'image') {
      const inner = `${c.img ? imgTag({ src: c.img, alt: c.imgAlt || '' }, ctx, { cls: 'aspect-[3/2] w-full rounded-t-card object-cover', sizes: '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw' }) : ''}<div class="flex flex-1 flex-col gap-2 p-5"><h3 class="font-display h-case text-2xl text-brand-dark">${esc(c.title)}</h3>${c.text ? `<p class="text-[0.95rem] text-ink/80">${esc(c.text)}</p>` : ''}${more(c)}</div>`;
      return wrap(c, 'card flex h-full flex-col overflow-hidden transition hover:shadow-lg', inner);
    }
    if (mode === 'numbered') return wrap(c, 'card card-num flex h-full flex-col gap-2 p-6 transition hover:shadow-lg', `<span class="num font-display text-5xl leading-none text-accent-text">${String(i + 1).padStart(2, '0')}</span><h3 class="mt-2 font-display h-case text-2xl text-brand-dark">${esc(c.title)}</h3>${c.text ? `<p class="text-[0.95rem] text-ink/80">${esc(c.text)}</p>` : ''}${more(c)}`);
    return wrap(c, 'card card-icon flex h-full flex-col gap-3 p-6 transition hover:shadow-lg', `<span class="icon-badge">${own(c, i)}</span><h3 class="font-display h-case text-2xl text-brand-dark">${esc(c.title)}</h3>${c.text ? `<p class="text-[0.95rem] text-ink/80">${esc(c.text)}</p>` : ''}${more(c)}`);
  }).join('')}</ul>`;
}

// Back-to-top button. A custom icon must be an image on the site itself (or https); the built-in arrow shows until it loads.
function backToTop(site, u, spec) {
  let icon = spec.extras?.backToTop?.icon || '';
  if (/^https:/i.test(icon)) {
    try { const x = new URL(icon); icon = x.hostname.replace(/^www\./, '') === String(site.host).replace(/^www\./, '') ? u(x.pathname) : ''; } catch { icon = ''; }
  } else if (icon) icon = u(icon.startsWith('/') ? icon : '/' + icon);
  const inner = icon ? `<img src="${esc(icon)}" alt="" width="44" height="44" class="size-full object-contain">` : '↑';
  const look = icon ? 'size-12 bg-transparent' : 'size-11 rounded-full bg-brand text-on-dark shadow-lg';
  return `<button id="to-top" type="button" class="fixed bottom-20 right-4 z-30 hidden ${look} place-items-center lg:bottom-6" aria-label="Back to top">${inner}</button>`;
}

function floating(u, spec) {
  const f = spec.extras?.floating;
  if (!f?.items.length) return '';
  return `<nav class="fab" aria-label="Quick actions">${f.items.map((i) => `<a href="${esc(extraHref(u, i.href))}">${esc(i.label)}</a>`).join('')}</nav>`;
}

// Sidebar for inner pages that have no form: how to reach the business, and where else to go. Uses only details the site already has.
export function innerSidebar(site, u, model) {
  const nav = (site.nav || []).filter((n) => n.href && n.href !== '/' && !/^#/.test(n.href)).slice(0, 6);
  return `<aside class="grid content-start gap-5 lg:sticky lg:top-28" aria-label="Contact and related pages">
  <div class="card border-t-4 !border-t-accent p-5">
    <p class="font-display h-case text-2xl text-brand-dark">${esc(site.ctaTitle || 'Talk to our team')}</p>
    ${site.phone?.digits ? `<p class="mt-3"><a class="inline-flex items-center gap-2 text-2xl font-bold text-brand-text hover:text-accent-text" href="tel:${site.phone.digits}">${iconSvg('phone', 'size-6')}${esc(site.phone.display)}</a></p>` : ''}
    <a class="btn btn-accent mt-4 w-full" href="${esc(u(site.ctaHref))}">${esc(site.ctaLabel || 'Contact us')}</a>
  </div>
  ${nav.length ? `<nav class="card p-5" aria-label="More on this site"><p class="${H.label}">Explore</p><ul class="plain mt-3 space-y-1.5 text-[0.95rem]">${nav.map((n) => `<li><a class="flex items-center justify-between text-brand-text hover:text-accent-text" href="${esc(u(n.href))}">${esc(n.label)}${iconSvg('arrow', 'size-4')}</a></li>`).join('')}</ul></nav>` : ''}
</aside>`;
}
