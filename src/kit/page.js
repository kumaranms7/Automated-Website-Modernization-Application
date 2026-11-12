import { esc } from '../util/html.js';
import { iconName } from '../template/icons.js';
import { normalizeSpec, DEFAULT_SPEC, specCss } from '../template/spec.js';
import { KIT_ICONS } from './icons.js';
import { designById } from './designs.js';
import { HERO, LIBRARY, pageHero } from './sections.js';
import { chromeHtml } from './chrome.js';
import { motionDefaults } from './motion.js';
import { nav as defaultNav } from './content.js';
import { T } from './ui.js';
import { applyTones } from './tones.js';

// Draws a page of a kit design: header, the sections of the design's blueprint filled from the content, footer. Used for the placeholder
// previews (what the user approves) and, with the website's real content, for the pages that are built. The page carries no stylesheet of
// its own: the previews get the compiled Tailwind of the kit (css.js) and a build compiles the pages it wrote.

// the menu and the header's shadow: two data attributes, so the markup stays Tailwind-only
export const KIT_SCRIPT = `(function(){var d=document;d.querySelectorAll('[data-k-menu]').forEach(function(b){b.addEventListener('click',function(){var o=d.querySelector('[data-k-drawer]');if(!o)return;var on=o.toggleAttribute('data-open');d.body.style.overflow=on?'hidden':'';d.querySelectorAll('[data-k-menu]').forEach(function(x){x.setAttribute('aria-expanded',on)})})});var h=d.querySelector('[data-k-header]');if(h){var f=function(){h.toggleAttribute('data-scrolled',window.scrollY>12)};f();addEventListener('scroll',f,{passive:true})}var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;var io=null;function arm(){var list=d.querySelectorAll('.k-a');if(!list.length)return;if(rm||!('IntersectionObserver' in window)){list.forEach(function(e){e.classList.add('k-in')});return}if(!io)io=new IntersectionObserver(function(es){es.forEach(function(x){var e=x.target;if(x.intersectionRatio>=.12||x.isIntersecting&&x.boundingClientRect.height>innerHeight*.7){e.classList.add('k-in');if(!e.hasAttribute('data-k-replay'))io.unobserve(e)}else if(!x.isIntersecting&&e.hasAttribute('data-k-replay')){e.classList.remove('k-in')}})},{threshold:[0,.12]});list.forEach(function(e){io.observe(e)})}arm();window.kitReplay=function(){d.querySelectorAll('.k-a').forEach(function(e){e.classList.remove('k-in');void e.offsetWidth});arm()};})();`;

// the theme and fonts of a design as the page's CSS (variables of the website's theme, @font-face of the design's fonts)
export function designCss(design, active, fontsBase = '/assets/fonts/') {
  const base = active?.tokens || DEFAULT_SPEC.tokens;
  const spec = normalizeSpec({ theme: active?.theme ?? null, tokens: { ...base, fontHeading: design.fonts.heading, fontBody: design.fonts.body } }, DEFAULT_SPEC);
  return specCss(spec, fontsBase);
}
export const designVars = (design) => Object.entries(design.vars || {}).map(([k, v]) => `${k}:${v}`).join(';');

export function context({ site, pack, stats, nav, u, img }) {
  const K = { site: { ...site, phones: site.phones || (site.phone?.digits ? [site.phone] : []) }, pack, stats: stats || pack.stats, nav, u: u || ((h) => h), img: img || ((src, alt) => `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" decoding="async">`) };
  K.iconFor = (item, i, group = 'services') => {
    if (item?.icon && KIT_ICONS[item.icon]) return item.icon;
    const w = iconName(`${item?.title || ''} ${item?.text || ''}`);
    if (w && w !== 'check') return w;
    const list = pack[group] || pack.services;
    return list[i % list.length][1];
  };
  return K;
}

// the sections of one page. kind: home | inner | contact. content: { hero, data } (data maps roles to section content)
export function sectionsHtml(design, kind, content, K) {
  const out = [], entries = [], at = [];
  const blueprint = design[kind] || design.home;
  if (kind === 'home') { out.push(HERO[blueprint[0].variant](content.hero, K)); entries.push(blueprint[0]); at.push(0); } else { out.push(pageHero(content.hero, K)); entries.push({}); at.push(-1); }
  blueprint.forEach((b, i) => {
    if (kind === 'home' && i === 0) return;
    const d = content.data[b.type];
    const r = LIBRARY[b.type]?.[b.variant];
    if (!d || !r) return;
    out.push(`<!-- ${b.type}:${b.variant} -->${r(d, K)}`); entries.push(b); at.push(i);
  });
  // alternating colours, and the tone and spacing the user chose; every section knows its place in the blueprint (the editor selects by it)
  return applyTones(out, entries, { tagAll: true, motion: motionDefaults(design.id) }).map((h, n) => (at[n] >= 0 ? h.replace('<section ', `<section data-kit-sec="${at[n]}" `) : h)).join('\n');
}

// the document around a body of sections: head, design variables and fonts, header, footer, the menu script
export function wrapDocument({ design, K, body, title, description = '', active, fontsBase, css = '', head = '', bodyEnd = '', edit = false }) {
  const chrome = chromeHtml(design, K, { edit });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title || `${K.site.name} | ${design.name}`)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<script>document.documentElement.classList.add('k-js')</script>
<style>${designCss(design, active, fontsBase)}</style>
${css ? `<style>${css}</style>` : ''}
${head}
</head>
<body class="k-body" style="${designVars(design)}">
<a class="absolute -left-[999px] z-[99] rounded-lg bg-white px-4 py-2.5 focus:top-4 focus:left-4" href="#main">Skip to content</a>
${chrome.topbar}${chrome.header}
<main id="main">
${body}
</main>
${chrome.footer}
${chrome.mobile}
<script>${KIT_SCRIPT}</script>
${bodyEnd}
</body>
</html>
`;
}

export function renderKitPage({ design: designOrId, kind = 'home', content, site, pack, active, title, description = '', nav, u, img, fontsBase, css = '', head = '', bodyEnd = '', edit = false }) {
  const design = typeof designOrId === 'string' ? designById(designOrId) : designOrId;
  const K = context({ site, pack, stats: content.data?.stats?.items?.map((x) => [x.value, x.label]), nav: nav || defaultNav(kind === 'contact' ? 'Contact' : kind === 'home' ? 'Home' : 'Services'), u, img });
  return wrapDocument({ design, K, body: sectionsHtml(design, kind, content, K), title, description, active, fontsBase, css, head, bodyEnd, edit });
}
void T;
