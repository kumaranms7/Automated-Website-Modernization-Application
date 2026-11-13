import { esc } from '../util/html.js';
import { resolveHref } from '../content/apply.js';
import { makeUrl, header, footer, ctaBand } from '../template/components.js';
import { renderInner, renderContact, renderHome } from '../template/layouts.js';
import { DEFAULT_SPEC, preloadFonts, specForPage } from '../template/spec.js';
import { applyHtmlEdits, applyHtmlOps, rebaseUrls } from '../template/html-ops.js';
import { expandNumberedRules } from '../template/section-match.js';
import { plain } from '../util/html.js';
import { applySectionTweaks } from '../template/section-tweaks.js';
import { applyClassTweaks } from '../template/class-tweaks.js';
import { fitPage } from '../kit/fit.js';
import { designCss, designVars, KIT_SCRIPT } from '../kit/page.js';
import { imgTag } from '../images/optimize.js';

// Page renderer: content model + site chrome + design spec -> one HTML page. The spec decides the look; this file
// only assembles the document (head, metadata, structured data, scripts) and picks which of the three layouts to use.

export function repairJsonLd(raw) {
  for (const text of [raw, raw.replace(/[\u0000-\u001f]+/g, ' ')]) {
    try { return { json: JSON.stringify(JSON.parse(text)), repaired: text !== raw }; } catch { /* try next */ }
  }
  return { json: null, repaired: false };
}

const CONTACT_WORDS = /contact|schedule|quote|book|appointment|get-in-touch|request/i;

// home | contact | inner. The spec can pin a page to a layout; otherwise it is inferred from the page itself.
export function layoutFor(model, rel, spec) {
  if (model.kind === 'home' || (spec.pages.home && rel === spec.pages.home)) return 'home';
  if (spec.pages.contact && rel === spec.pages.contact) return 'contact';
  const words = model.blocks.filter((b) => b.t === 'html').reduce((n, b) => n + plain(b.html).split(' ').length, 0);
  if (model.protected.form && CONTACT_WORDS.test(`${rel} ${model.hero.h1}`) && words < 450) return 'contact';
  return 'inner';
}

// the composed page may choose its own header and footer style
const pageChrome = (spec, part) => {
  const v = spec.page?.[part]?.variant;
  return v ? { ...spec, layout: { ...spec.layout, [part]: v } } : spec;
};

export function renderPage(model, site, rel, opts = {}) {
  const spec = opts.spec || DEFAULT_SPEC;
  const depth = rel.split('/').length - 1;
  const u = makeUrl(depth, /(^|\/)404\.[a-z]+$/i.test(rel));
  const dims = opts.dims || null;
  // a hand-edited header or footer replaces the drawn one on every page, with its links made right for this page's depth
  const chromeHtml = (part, drawn) => {
    const own = spec.page?.[part]?.html;
    if (!own) return drawn();
    const tag = part === 'header' ? 'header' : 'footer';
    return rebaseUrls(own, depth, /(^|\/)404\.[a-z]+$/i.test(rel)).replace(new RegExp('<' + tag + '\\b'), '<' + tag + ' data-sec="' + part + '"');
  };
  const ctx = { model, rel, host: opts.host || site.host, imgs: opts.imageMap || null, used: new Set(), siteUrl: u, state: {}, spec, dims, heroCandidate: null };
  // a large landscape picture the page already has can serve as the photographic hero
  if (dims) {
    const srcs = [model.home?.hero?.image?.src, ...model.blocks.filter((b) => b.t === 'img').map((b) => b.src)].filter(Boolean);
    const pick = srcs.find((s) => dims[s] && dims[s].w >= 900 && dims[s].w / dims[s].h >= 1.25);
    if (pick) ctx.heroCandidate = { src: pick, alt: '' };
  }
  const p = u('/assets/');
  const ld = model.head.jsonLd.map(repairJsonLd);
  const h = model.head;
  const host = opts.host || site.host;
  const canonical = h.canonical || `https://${opts.canonicalHost || host}/${rel.replace(/index\.html$/, '')}`;
  const hasMeta = (name) => h.metas.some((m) => m.includes(`"${name}"`));
  const firstImg = model.blocks.find((b) => b.t === 'img');
  const firstImgUrl = firstImg ? (() => { const key = ctx.imgs ? resolveHref(firstImg.src, rel, host) : null; const e = key && ctx.imgs[key]; return e ? `https://${opts.canonicalHost || host}/${e.file}` : /^https?:/i.test(firstImg.src) ? firstImg.src : `https://${opts.canonicalHost || host}/${(resolveHref(firstImg.src, rel, host) || '')}`; })() : '';
  const filled = [];
  if (!hasMeta('og:title')) filled.push(`<meta property="og:title" content="${esc(h.title)}">`);
  if (!hasMeta('og:description')) filled.push(`<meta property="og:description" content="${esc(h.description)}">`);
  if (!hasMeta('og:url')) filled.push(`<meta property="og:url" content="${esc(canonical)}">`);
  if (!hasMeta('og:type')) filled.push('<meta property="og:type" content="website">');
  if (!hasMeta('og:image') && firstImgUrl) filled.push(`<meta property="og:image" content="${esc(firstImgUrl)}">`);
  if (!hasMeta('twitter:card')) filled.push('<meta name="twitter:card" content="summary_large_image">');

  const layout = layoutFor(model, rel, spec);
  const pageSpec = specForPage(spec, layout);
  if (ctx.spec === spec) ctx.spec = pageSpec;
  // a site with an approved kit design is drawn by the kit: its header, sections and footer, with the site's own content
  const kit = spec.kit?.design ? fitPage({ model, site: { ...site, host }, spec, u, kind: layout === 'home' ? 'home' : layout === 'contact' ? 'contact' : 'inner', heroCandidate: ctx.heroCandidate, dims, phones: opts.phones || [], img: (src, alt, priority) => imgTag({ src, alt }, ctx, { cls: '', priority, sizes: priority ? '100vw' : '(min-width: 1024px) 560px, 100vw' }) }) : null;
  const rawMain = kit ? kit.main : layout === 'home' ? renderHome(model, site, u, ctx, pageSpec)
    : layout === 'contact' ? renderContact(model, site, u, ctx, pageSpec)
      : renderInner(model, site, u, ctx, pageSpec);
  // changes made to a numbered section of the sample inner or contact page reach every section with the same structure on this page
  const rules = opts.sectionSigs ? expandNumberedRules({ spec, layout, rel, mainHtml: rawMain, sigsByFile: opts.sectionSigs }) : spec;
  const main = kit ? rawMain : applySectionTweaks(applyHtmlEdits(rawMain, spec.htmlEdits, layout, rel, model.protected.form), rules, layout, ctx);
  const band = kit || layout === 'home' || model.blocks.some((b) => b.t === 'cta') ? '' : ctaBand(site, u);

  return {
    layout,
    removedHtml: kit ? kit.removedHtml : '',
    schemaRepaired: ld.filter((x) => x.repaired).length,
    schemaBroken: ld.filter((x) => !x.json).length,
    // getter: the list is only complete after the html template below has been evaluated
    get imagesUsed() { return [...ctx.used]; },
    html: applyClassTweaks(applyHtmlOps(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(h.title)}</title>
<meta name="description" content="${esc(h.description)}">
${h.robots ? `<meta name="robots" content="${esc(h.robots)}">` : ''}
${opts.skipCanon && !h.canonical ? '' : `<link rel="canonical" href="${esc(canonical)}">`}
${h.metas.join('\n')}
${filled.join('\n')}
${h.links.join('\n')}
${preloadFonts(spec).map((f) => `<link rel="preload" href="${u('/assets/fonts/' + f)}" as="font" type="font/woff2" crossorigin>`).join('\n')}
${kit ? `<script>document.documentElement.classList.add('k-js')</script>
<style>${designCss(kit.design, spec, u('/assets/fonts/'))}</style>
` : ''}<link rel="stylesheet" href="${p}css/site.min.css">
${ld.filter((x) => x.json).map((x) => `<script type="application/ld+json">${x.json}</script>`).join('\n')}
${(model.head.extraLd || []).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
${model.protected.headScripts.join('\n')}
</head>
<body data-layout="${layout}" data-page="${esc(rel)}" ${kit ? `class="k-body" data-k-motion="${kit.design.motion || 'full'}" data-k-anim="${kit.design.anim || 'rise'}" data-k-skin="${kit.design.skin || 'day'}" data-k-pat="${kit.design.pattern || 'none'}" style="${designVars(kit.design)}"` : 'class="bg-surface font-sans text-ink antialiased"'}>
${model.protected.bodyNoscript}
${kit ? kit.header : chromeHtml('header', () => header(site, u, pageChrome(spec, 'header')).replace('<header class=', '<header data-sec="header" class='))}
<main id="main">
${main}
</main>
${band}
${kit ? kit.footer + kit.mobile : chromeHtml('footer', () => footer(site, u, pageChrome(spec, 'footer')).replace('<footer class=', '<footer data-sec="footer" class='))}
${kit ? `<script>${KIT_SCRIPT}</script>` : `<script type="module" src="${p}js/nav.js"></script>`}
<script type="module" src="${p}js/ada.js" data-jquery="${u('/js/jquery-3.7.1.min.js')}" data-ada="${u('/js/ada.min.js')}"></script>
</body>
</html>
`, rules.ops, { layout, rel, spec: rules }), rules, layout, rel),
  };
}
