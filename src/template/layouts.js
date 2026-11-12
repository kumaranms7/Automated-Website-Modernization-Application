import { esc } from '../util/html.js';
import { applySectionTweaks } from './section-tweaks.js';
import { applySectionClassTweaks } from './class-tweaks.js';
import { applyHtmlOps, expandForm } from './html-ops.js';
import { imgTag } from '../images/optimize.js';
import { composeHome, refsOf } from './home-compose.js';
import { renderSection, headingHtml, CHECK, bgFor } from './sections.js';
import { themeVars } from './spec.js';
import { H, blockHtml, cardGrid, faqList, reviewsGrid, formCard, heroTheme, heroButtons, innerHero, crumbsHtml, heroPhoto, heroBg, bannerImage, sectionTitle, innerSidebar } from './components.js';
import { iconFor, iconSvg, iconNames } from './icons.js';

// The three layouts every site template has: home, inner pages, contact. Each is styled by the design spec.

// ---------- headings ----------
function normaliseHeadings(blocks) {
  for (const b of blocks) if (b.t === 'h' && b.level === 1) b.level = 2;
  const levels = blocks.filter((b) => b.t === 'h').map((b) => b.level);
  if (!levels.length) return;
  const shift = Math.min(...levels) - 2;
  for (const b of blocks) if (b.t === 'h') b.level = Math.min(4, Math.max(2, b.level - shift));
  let prev = 1;
  for (const b of blocks) {
    if (b.t !== 'h') continue;
    b.level = Math.min(b.level, prev + 1);
    prev = b.level;
  }
}

// Numbers the top-level sections of an inner or contact page (s1, s2...) so the editor can select them and design changes can
// point at them. The number is the section's position, the same one section tweaks use.
function tagPage(html) {
  let n = 0;
  return html.replace(/<section\b(?![^>]*\bdata-sec=)/g, () => `<section data-sec="s${++n}"`);
}

// ---------- inner pages ----------
export function renderInner(model, site, u, ctx, spec) {
  const blocks = model.blocks.map((b) => ({ ...b }));
  normaliseHeadings(blocks);

  // the split hero shows the page's first image, so it is not repeated in the content
  let heroImg = null;
  if (spec.layout.hero === 'split' && !bannerImage(spec, ctx)) {
    const i = blocks.findIndex((b) => b.t === 'img');
    if (i >= 0) { heroImg = blocks[i]; blocks.splice(i, 1); ctx.state.heroImage = true; }
  }
  const render = (list) => list.map((b) => (b.t === 'h' ? headingHtml(b) : blockHtml(b, u, ctx))).join('');

  const runs = [];
  let cur = null;
  for (const b of blocks) {
    if (b.t === 'break') { cur = null; continue; }
    const startsH2 = b.t === 'h' && b.level === 2 && cur && cur.list.some((x) => x.t === 'h' && x.level === 2);
    if (!cur || cur.zone !== b.zone || startsH2) { cur = { zone: b.zone, list: [] }; runs.push(cur); }
    cur.list.push(b);
  }

  const below = spec.layout.innerForm === 'below';
  let band = 0, formPlaced = false;
  // pages without a form get a contact and navigation sidebar beside their first block of copy
  let sidebarNext = !model.sideForm && spec.layout.innerSidebar !== 'off' && runs.length > 0;
  const out = runs.map((run) => {
    const withForm = model.sideForm && run.zone === 'lead' && !formPlaced;
    if (withForm) {
      formPlaced = true;
      if (below) return `<section class="sec ${bgFor(spec, band++)}"><div class="wrap"><div class="prose-content max-w-5xl">${render(run.list)}</div></div></section><section class="sec bg-surface"><div class="wrap max-w-2xl">${formCard(model, { sticky: false })}</div></section>`;
      return `<section class="sec bg-surface"><div class="wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem]"><div class="prose-content">${render(run.list)}</div>${formCard(model)}</div></section>`;
    }
    if (sidebarNext) {
      sidebarNext = false;
      return `<section class="sec ${bgFor(spec, band++)}"><div class="wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]"><div class="prose-content">${render(run.list)}</div>${innerSidebar(site, u, model)}</div></section>`;
    }
    return `<section class="sec ${bgFor(spec, band++)}"><div class="wrap"><div class="prose-content max-w-5xl">${render(run.list)}</div></div></section>`;
  }).join('');
  const orphanForm = model.sideForm && !formPlaced ? `<section class="sec bg-surface"><div class="wrap max-w-xl">${formCard(model, { sticky: false })}</div></section>` : '';
  return tagPage(`${innerHero(model, site, u, ctx, spec, heroImg)}\n${out}${orphanForm}`);
}

// ---------- contact page ----------
export function renderContact(model, site, u, ctx, spec) {
  const blocks = model.blocks.map((b) => ({ ...b })).filter((b) => b.t !== 'form');
  normaliseHeadings(blocks);
  const content = blocks.filter((b) => b.t !== 'break').map((b) => (b.t === 'h' ? headingHtml(b) : blockHtml(b, u, ctx))).join('');
  const form = model.protected.form ? formCard(model, { sticky: spec.layout.contactLayout === 'split' }) : '';
  const body = spec.layout.contactLayout === 'stacked'
    ? `<section class="sec bg-soft"><div class="wrap"><div class="prose-content max-w-4xl">${content}</div></div></section><section class="sec bg-surface"><div class="wrap max-w-2xl">${form}</div></section>`
    : `<section class="sec bg-surface"><div class="wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_28rem]"><div class="prose-content">${content}${contactFacts(site)}</div>${form}</div></section>`;
  return tagPage(`${innerHero({ ...model, sideForm: Boolean(model.protected.form) }, site, u, ctx, spec, null)}\n${body}`);
}

// Address / phone are shown beside the form when the page's own copy did not already carry them.
function contactFacts(site) {
  const rows = [[site.address, 'Address'], [site.phone.display, 'Phone']].filter(([v]) => v);
  return rows.length ? `<ul class="plain mt-8 grid gap-4 sm:grid-cols-2">${rows.map(([v, k]) => `<li class="card p-4"><p class="${H.label}">${k}</p><p class="mt-1">${k === 'Phone' ? `<a class="font-semibold text-brand-text hover:underline" href="tel:${site.phone.digits}">${esc(v)}</a>` : esc(v)}</p></li>`).join('')}</ul>` : '';
}

// ---------- home ----------
function homeHero(hero0, site, u, ctx, spec, model) {
  const banner = bannerImage(spec, ctx);
  const hero = banner ? { ...hero0, image: banner } : hero0;
  const v = banner && spec.layout.hero === 'photo' ? 'split' : spec.layout.hero;
  const photo = v === 'photo' ? heroPhoto(spec, ctx, hero.image) : null;
  const th = heroTheme(v === 'photo' && !photo ? 'gradient' : v);
  const buttons = (hero.buttons || [{ text: `Call ${site.phone.display}`, href: `tel:${site.phone.digits}`, accent: true }, { text: site.ctaLabel || 'Contact us', href: u(site.ctaHref), accent: false }])
    .map((b) => `<a class="${b.accent ? 'btn btn-accent' : th.b2}" href="${esc(/^(tel:|https?:)/i.test(b.href) ? b.href : b.href.startsWith('/') ? u(b.href) : b.href)}">${esc(b.text)}</a>`).join('');
  const center = th.align.includes('center');
  const left = `${hero.eyebrow ? `<p class="mb-4 inline-block rounded-full ${th.onDark ? 'bg-white/15' : 'bg-brand/10 text-brand-text'} px-4 py-1 text-sm font-semibold uppercase tracking-wider">${esc(hero.eyebrow)}</p>` : ''}
    <h1 class="font-display h-case text-4xl leading-tight sm:text-5xl lg:text-6xl">${esc(hero.h1)}</h1>
    ${hero.leadHtml ? `<div class="mt-5 max-w-2xl text-lg ${center ? 'mx-auto' : ''} opacity-90 [&_a]:underline">${hero.leadHtml}</div>` : ''}
    ${hero.bullets.length ? `<ul class="plain mt-6 space-y-2 text-lg ${center ? 'mx-auto max-w-xl text-left' : ''}">${hero.bullets.map((b) => `<li class="flex gap-2">${CHECK(th.onDark ? 'text-accent-light' : 'text-accent-text')}<span>${esc(b)}</span></li>`).join('')}</ul>` : ''}
    <div class="mt-8 flex flex-wrap gap-3 ${center ? 'justify-center' : ''}">${buttons}</div>`;
  const cards = hero.cards ? `<div class="card p-5 text-ink"><h2 class="${H.h3}">${esc(hero.cards.title)}</h2><ul class="plain mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">${hero.cards.items.map((c) => `<li><a class="flex h-full flex-col items-center gap-2 rounded-card bg-soft p-3 text-center text-xs font-semibold text-brand-dark ring-1 ring-black/5 hover:text-accent-text" href="${esc(c.href)}">${c.img ? imgTag({ src: c.img, alt: '' }, ctx, { cls: 'size-12', icon: true }) : ''}<span>${esc(c.text)}</span></a></li>`).join('')}</ul></div>` : '';
  const usesAsBg = photo && hero.image && photo.src === hero.image.src;
  const image = hero.image && !photo ? imgTag(hero.image, ctx, { cls: 'hero-img h-auto w-full rounded-card shadow-xl', priority: true, sizes: '(min-width: 1024px) 560px, 100vw' }) : '';
  ctx.state.heroImage = ctx.state.heroImage || Boolean(hero.image) || Boolean(photo);
  const side = cards || image;
  if (photo) return `<section class="${th.cls}">${heroBg(photo, ctx)}<div class="wrap relative z-10 grid items-center gap-10 py-16 lg:py-28 ${side ? 'lg:grid-cols-[1.1fr_1fr]' : ''}"><div class="max-w-3xl">${left}</div>${side ? `<div>${side}</div>` : ''}</div></section>`;
  if (center || !side) return `<section class="${th.cls}"><div class="wrap flex flex-col ${center ? 'items-center text-center' : ''} py-14 lg:py-20">${left}</div></section>${center && side ? `<section class="sec bg-surface"><div class="wrap max-w-4xl">${side}</div></section>` : ''}`;
  return `<section class="${th.cls}"><div class="wrap grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20"><div>${left}</div><div>${side}</div></div></section>`;
}

// a layout derived for one section: the page's design with this section's own choices laid over it
export function sectionSpec(spec, sec) {
  const layout = { ...spec.layout };
  if (sec.props.head !== 'inherit') layout.sectionHead = sec.props.head;
  if (sec.props.cards !== 'inherit') layout.cardLayout = sec.props.cards;
  // a hero style of its own, unless the page has a banner (added in Design settings): the banner decides how the hero is drawn
  if (sec.ref === 'hero' && sec.variant && !spec.extras?.heroImage?.mode) layout.hero = sec.variant;
  return { ...spec, layout };
}

// marks the section for the editor and, if it keeps its own look, carries that design's theme inline
function tagSection(html, sec, spec) {
  let style = '';
  if (sec.adapt === 'own' && sec.own) {
    const vars = themeVars({ tokens: { ...spec.tokens, ...sec.own }, layout: spec.layout });
    style = ' style="' + Object.entries(vars).map(([k, v]) => `${k}:${String(v).replace(/"/g, "'")}`).join(';') + '"';
  }
  return html.replace(/<section\b/, `<section data-sec="${sec.id}" data-ref="${sec.ref}"${style}`);
}

// the home page drawn from a composed page: sections in the chosen order, each in its chosen style
function renderComposed(model, site, u, ctx, spec, comp) {
  const refs = refsOf(comp);
  const out = [];
  let shown = 0;
  for (const sec of spec.page.sections) {
    if (sec.hidden) continue;
    const target = refs.get(sec.ref);
    if (!target) continue; // the content this section pointed at is no longer on the page
    const secSpec = sectionSpec(spec, sec);
    const prev = ctx.spec;
    ctx.spec = secSpec;
    const c = sec.content || {};
    let html;
    if (target.type === 'hero') {
      const hero = { ...target.hero };
      if (c.title) hero.h1 = c.title;
      if (c.text) hero.leadHtml = `<p>${esc(c.text)}</p>`;
      if (c.buttonText && hero.buttons?.length) hero.buttons = hero.buttons.map((b, k) => (k === 0 ? { ...b, text: c.buttonText, href: c.buttonHref || b.href } : b));
      html = homeHero(hero, site, u, ctx, secSpec, model);
    } else {
      const s = { ...target.s, variant: sec.variant };
      if (c.title) s.title = c.title;
      if (c.text && 'text' in s) s.text = c.text;
      if (c.buttonText && s.type === 'cta') { s.label = c.buttonText; if (c.buttonHref) s.href = c.buttonHref; }
      html = renderSection(s, shown, ctx, secSpec, u, site, model, sec.props);
    }
    ctx.spec = prev;
    if (html && sec.html) html = expandForm(sec.html, model.protected.form); // a hand-edited section replaces what the design drew
    if (html && sec.ops?.length) html = applyHtmlOps(html, sec.ops, { fragment: true });
    if (html && sec.extra) html = applySectionTweaks(html, { sections: [{ layout: 'all', ...sec.extra, index: 1 }] }, 'home', ctx);
    if (html && sec.tweaks?.length) html = applySectionClassTweaks(html, sec.tweaks);
    if (html) { out.push(tagSection(html, sec, spec)); shown += 1; }
  }
  const orphanForm = model.protected.form && !comp.sections.some((s) => s.type === 'listform') ? `<section class="sec bg-surface"><div class="wrap max-w-xl">${formCard(model, { sticky: false })}</div></section>` : '';
  return out.join('\n') + orphanForm;
}

export function renderHome(model, site, u, ctx, spec) {
  const comp = composeHome(model, site);
  if (spec.page?.sections?.length) return renderComposed(model, site, u, ctx, spec, comp);
  const body = comp.sections.map((s, i) => renderSection(s, i, ctx, spec, u, site, model)).join('\n');
  const orphanForm = model.protected.form && !comp.sections.some((s) => s.type === 'listform') ? `<section class="sec bg-surface"><div class="wrap max-w-xl">${formCard(model, { sticky: false })}</div></section>` : '';
  return `${homeHero(comp.hero, site, u, ctx, spec, model)}\n${body}${orphanForm}`;
}
