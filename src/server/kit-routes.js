import path from 'node:path';
import { loadClient, clientDir, readJson } from '../config.js';
import { getProfile } from '../profile/store.js';
import { loadActive, saveDraft } from '../template/store.js';
import { DESIGNS, DESIGN_IDS, OFFERED_IDS } from '../kit/designs.js';
import { tailor } from '../kit/tailor.js';
import { DEFAULT_SPEC } from '../template/spec.js';
import { PACK_IDS, packById } from '../kit/packs.js';
import { placeholderContent } from '../kit/content.js';
import { renderKitPage, designCss, designVars, context } from '../kit/page.js';
import { kitCss } from '../kit/css.js';
import { LIBRARY, HERO, VARIANTS } from '../kit/sections.js';
import { applyTones } from '../kit/tones.js';
import { fromDesign, designOfLayout, INNER_HEROES } from '../kit/customize.js';
import { HEADER, FOOTER } from '../kit/chrome.js';
import { styleGuide } from '../kit/styleguide.js';
import { esc } from '../util/html.js';
import { PART_FIELDS, PRESETS, THEME_COLORS } from '../kit/parts.js';
import { themeOf } from '../template/spec.js';
import { cssVars } from '../theme/engine.js';

// The design kit in the portal: the gallery of designs drawn with placeholder content (the colours, fonts and shapes of the website's
// Configuration, its banners as the placeholder pictures, the icons and wording of its business type), the section library, the style
// guide, choosing a design, and choosing the sections of each kind of page.

const PAGES = ['home', 'inner', 'contact'];
const TITLES = { trust: 'Trust points', services: 'Services', about: 'About / text', features: 'Features', steps: 'Steps', stats: 'Numbers', reviews: 'Reviews', faq: 'FAQ', areas: 'Areas served', gallery: 'Gallery', compare: 'Before / after', pricing: 'Pricing', tabs: 'Tabs', team: 'Team', blog: 'Blog cards', map: 'Map', cta: 'Call to action', contact: 'Contact' };
const EDIT = `<style>[data-kit-sec],[data-kit-chrome]{cursor:pointer}[data-kit-sec]:hover,[data-kit-chrome]:hover{outline:2px dashed #6366f1;outline-offset:-2px}.kit-sel{outline:3px solid #6366f1!important;outline-offset:-3px}</style><script>(function(){function sec(t){return t&&t.closest?t.closest('[data-kit-sec]'):null}function chr(t){return t&&t.closest?t.closest('[data-kit-chrome]'):null}function mark(k,go){document.querySelectorAll('.kit-sel').forEach(function(x){x.classList.remove('kit-sel')});var e=typeof k==='number'?document.querySelector('[data-kit-sec="'+k+'"]'):document.querySelector('[data-kit-chrome="'+k+'"]');if(e){e.classList.add('kit-sel');if(go)e.scrollIntoView({behavior:'smooth',block:typeof k==='number'?'center':'nearest'})}}document.addEventListener('click',function(e){var s=sec(e.target),c=s?null:chr(e.target);if(!s&&!c)return;e.preventDefault();e.stopPropagation();if(s){var i=Number(s.getAttribute('data-kit-sec'));mark(i);parent.postMessage({kitSelect:i},'*')}else{var n=c.getAttribute('data-kit-chrome');mark(n);parent.postMessage({kitChrome:n},'*')}},true);window.addEventListener('message',function(e){if(!e.data)return;if(typeof e.data.kitMark==='number')mark(e.data.kitMark,true);if(typeof e.data.kitMarkChrome==='string')mark(e.data.kitMarkChrome,true);if(e.data.kitReplay&&window.kitReplay)window.kitReplay()});document.addEventListener('submit',function(e){e.preventDefault()},true)})();</script>`;


async function load(slug, packId) {
  const client = await loadClient(slug);
  if (!client) throw new Error('Unknown website');
  const profile = (await getProfile(slug).catch(() => null)) || {};
  const { spec } = await loadActive(slug);
  // the business type: chosen by hand (the request, else the saved design), else read from the Business Profile
  const chosen = PACK_IDS.includes(packId) ? packId : spec.kit?.pack || '';
  const pc = placeholderContent(profile, client, chosen);
  // the banners of the Configuration are the pictures of the placeholder pages
  for (const kind of PAGES) {
    const b = spec.extras?.banners?.[kind];
    if (b?.src) pc.pages[kind].hero = { ...pc.pages[kind].hero, image: { src: `/original/${slug}/${b.src}`, alt: b.alt || '' } };
    if (b?.video?.src) pc.pages[kind].hero = { ...pc.pages[kind].hero, video: { src: `/original/${slug}/${b.video.src}` } };
  }
  return { client, profile, spec, pc, pack: pc.pack, seedKey: `${pc.site.name}|${pc.pack.id}` };
}

const designOf = (id, spec, seedKey) => tailor(id, { spec, seedKey });

// what the element editor offers: the colours of this website's theme, what can be set on each part, and the designs of the parts
function styleMeta(spec) {
  const vars = cssVars(themeOf(spec));
  const palette = THEME_COLORS.map(([key, label, css]) => { const m = /^var\((--[a-z0-9-]+)\)$/.exec(css); return { key, label, hex: m ? vars[m[1]] || '#888888' : css }; });
  return { palette, fields: PART_FIELDS, presets: PRESETS, vars };
}

export async function kitState(slug) {
  const { spec, pack, profile, seedKey } = await load(slug);
  const detected = placeholderContent(profile, {}).pack;
  const current = spec.kit?.design || OFFERED_IDS[0];
  const tailored = designOf(current, spec, seedKey);
  return {
    selected: spec.kit || { design: '', pack: '', sections: {} },
    pack: { id: pack.id, label: pack.label },
    detected: { id: detected.id, label: detected.label },
    packs: PACK_IDS.map((id) => ({ id, label: packById(id).label })),
    designs: OFFERED_IDS.map((id) => { const d = designOf(id, spec, seedKey); return { id, name: DESIGNS[id].name, badge: DESIGNS[id].badge, blurb: DESIGNS[id].blurb, fonts: d.fonts, header: d.header, footer: d.footer, sections: d.home.map((b) => `${b.type}:${b.variant}`) }; }),
    // the sections of the chosen design for each kind of page, and every layout that can be used in their place
    blueprints: { home: tailored.home, inner: tailored.inner, contact: tailored.contact },
    variants: ownVariants(tailored),
    style: styleMeta(spec),
    // the header, footer and top bar of the chosen design as they are now, and the layouts there are for them
    chrome: { header: tailored.header, footer: tailored.footer, topbar: Boolean(tailored.topbar), variants: { header: Object.keys(HEADER).filter((v) => (tailored.prefix ? v === tailored.header : !/^[a-z]{2}$/.test(v) || v === 'mini')), footer: Object.keys(FOOTER).filter((v) => (tailored.prefix ? v === tailored.footer : !/^[a-z]{2}$/.test(v))) } },
  };
}

// the layouts a design offers: its own (their names start with the design's prefix); a design without a prefix offers the shared ones
const ownLayout = (design, v) => (design.prefix ? String(v).startsWith(design.prefix) : !/^[a-z]{2}-/.test(String(v)));
const ownVariants = (design) => ({ hero: Object.keys(HERO).filter((v) => ownLayout(design, v) && v !== design.innerHero), ...Object.fromEntries(Object.entries(LIBRARY).map(([k, v]) => [k, Object.keys(v).filter((x) => ownLayout(design, x))]).filter(([, v]) => v.length)) });

export async function chooseDesign(slug, { design, pack, sections, pageSection, pageOrder, chrome, dropRelated, innerHero } = {}) {
  if (design && !DESIGNS[design]) throw new Error('Unknown design');
  const { spec } = await loadActive(slug);
  const kit = { design: design === undefined ? spec.kit?.design || '' : design, pack: pack === undefined ? spec.kit?.pack || '' : PACK_IDS.includes(pack) ? pack : '', sections: { ...(spec.kit?.sections || {}) }, pageSections: { ...(spec.kit?.pageSections || {}) }, pageOrder: { ...(spec.kit?.pageOrder || {}) }, kinds: { ...(spec.kit?.kinds || {}) }, chrome: { ...(spec.kit?.chrome || {}) }, ...(spec.kit?.dropRelated ? { dropRelated: true } : {}), ...(spec.kit?.innerHero ? { innerHero: spec.kit.innerHero } : {}) };
  // (a draft is merged with the version before it: what is taken back is saved as "none", a key only left out would come back)
  if (typeof dropRelated === 'boolean') kit.dropRelated = dropRelated;
  // a new design starts from its own sections
  if (design !== undefined && design !== spec.kit?.design) { kit.sections = { home: [], inner: [], contact: [] }; kit.pageSections = {}; kit.pageOrder = {}; kit.kinds = {}; kit.chrome = { header: {}, footer: {}, topbar: {} }; kit.dropRelated = false; kit.innerHero = ''; }
  // the hero of the inner pages: the one another design gives them (empty: this design's own again). It is the same on every inner page
  if (typeof innerHero === 'string') { if (INNER_HEROES.includes(innerHero) && HERO[innerHero] && !innerHero.startsWith(DESIGNS[kit.design]?.prefix || '?')) kit.innerHero = innerHero; else kit.innerHero = ''; }
  // the header, footer and top bar belong to the whole theme: what is sent for a zone replaces what was chosen for it
  if (chrome && typeof chrome === 'object') for (const zone of ['header', 'footer', 'topbar']) if (chrome[zone] && typeof chrome[zone] === 'object') kit.chrome[zone] = chrome[zone];
  // one section of one page: another layout, another kind of section, or back to the design's own
  if (pageSection?.path && pageSection?.key) {
    const page = { ...(kit.pageSections[pageSection.path] || {}) };
    const k = pageSection.key;
    // a layout, colour or style chosen for a kind of section is chosen for it on every page that has that kind
    const kid = /^k[a-z0-9]{3,12}$/.test(pageSection.kind || '') ? pageSection.kind : '';
    // a section of the library added to this page, after the section `after` (or at the end)
    if (pageSection.add && typeof pageSection.add === 'object') {
      const { role, variant, after } = pageSection.add;
      if (!LIBRARY[role]?.[variant]) throw new Error('That section is not in the library');
      let id; do { id = `a${Math.random().toString(36).slice(2, 9)}`; } while (page[id]);
      page[id] = { added: { role: String(role), variant: String(variant), after: /^[a-z0-9]{3,16}$/.test(after || '') ? after : '' } };
      kit.pageSections[pageSection.path] = page;
    } else if (page[k]?.added && 'hide' in pageSection && pageSection.hide) { // an added section that is removed is simply gone
      delete page[k];
      kit.pageSections[pageSection.path] = page;
    } else if (kid && k !== 'hero' && !('hide' in pageSection) && typeof pageSection.html !== 'string') {
      const cur = { ...(kit.kinds[kid] || {}) };
      const mineHere = { ...(page[k] || {}) };
      if (pageSection.reset) { delete kit.kinds[kid]; for (const f of ['role', 'variant', 'tone', 'style']) delete mineHere[f]; }
      else if ('style' in pageSection && !pageSection.variant && !pageSection.role) { if (pageSection.style && Object.keys(pageSection.style).length) cur.style = pageSection.style; else delete cur.style; }
      else { for (const f of ['role', 'variant', 'tone']) { if (pageSection[f]) cur[f] = pageSection[f]; else delete cur[f]; delete mineHere[f]; } }
      if (!pageSection.reset) { if (Object.keys(cur).length) kit.kinds[kid] = cur; else delete kit.kinds[kid]; }
      if (Object.keys(mineHere).length) page[k] = mineHere; else delete page[k];
    } else if (pageSection.reset) delete page[k];
    else if (k === 'hero' && 'bg' in pageSection) { // the background of the hero of an inner page: plain, or a picture of the page under an overlay
      const cur = { ...(page[k] || {}) };
      if (pageSection.bg === 'photo') { cur.bg = 'photo'; if (typeof pageSection.image === 'string' && pageSection.image) cur.image = pageSection.image.slice(0, 600); else delete cur.image; } else { cur.bg = 'plain'; delete cur.image; }
      if (Object.keys(cur).length) page[k] = cur; else delete page[k];
    } else if ('style' in pageSection && !pageSection.variant && !pageSection.role && !('html' in pageSection) && !('hide' in pageSection)) { // the styles of the parts of one section of one page
      const cur = { ...(page[k] || {}) };
      if (pageSection.style && Object.keys(pageSection.style).length) cur.style = pageSection.style; else delete cur.style;
      if (Object.keys(cur).length) page[k] = cur; else delete page[k];
    } else if ('hide' in pageSection && !pageSection.variant && !pageSection.role) { // remove the section from this page, or bring it back
      const cur = { ...(page[k] || {}) };
      if (pageSection.hide) cur.hide = true; else delete cur.hide;
      if (Object.keys(cur).length) page[k] = cur; else delete page[k];
    } else if (typeof pageSection.html === 'string') { // the section written by hand (empty: the design's own again)
      const cur = { ...(page[k] || {}) };
      if (pageSection.html.trim()) cur.html = pageSection.html; else delete cur.html;
      if (Object.keys(cur).length) page[k] = cur; else delete page[k];
    } else page[k] = { role: pageSection.role, variant: pageSection.variant, tone: pageSection.tone, ...(page[k]?.hide ? { hide: true } : {}), ...(page[k]?.added ? { added: { ...page[k].added, ...(pageSection.variant && LIBRARY[page[k].added.role]?.[pageSection.variant] ? { variant: pageSection.variant } : {}) } } : {}), ...(page[k]?.bg ? { bg: page[k].bg, ...(page[k].image ? { image: page[k].image } : {}) } : {}), ...(page[k]?.style ? { style: page[k].style } : {}) };
    kit.pageSections[pageSection.path] = page;
  }
  if (sections) for (const k of PAGES) if (Array.isArray(sections[k])) kit.sections[k] = sections[k];
  if (Array.isArray(pageOrder?.keys) && pageOrder.path) kit.pageOrder[pageOrder.path] = pageOrder.keys;
  const patch = { kit };
  if (design) {
    const vars = DESIGNS[design].vars || {};
    const weight = [400, 600, 700, 800].reduce((best, w) => (Math.abs(w - Number(vars['--k-h-weight'] || 700)) < Math.abs(best - Number(vars['--k-h-weight'] || 700)) ? w : best), 700);
    patch.tokens = { fontHeading: DESIGNS[design].fonts.heading, fontBody: DESIGNS[design].fonts.body, ...(design !== spec.kit?.design ? { headingWeight: weight, headingCase: vars['--k-h-case'] === 'uppercase' ? 'uppercase' : 'none', radius: DEFAULT_SPEC.tokens.radius } : {}) };
  }
  if (design !== undefined && design !== spec.kit?.design) Object.assign(patch, { tweaks: [], ops: [], htmlEdits: [] });
  await saveDraft(slug, patch, { note: chrome ? 'Header, footer or top bar customised' : pageSection || pageOrder || typeof innerHero === 'string' ? 'Section customised' : sections ? 'Design sections changed' : design ? `Design: ${DESIGNS[design].name}` : design === '' ? 'Classic template' : 'Business type' });
  return kitState(slug);
}

const page404 = (res) => res.status(404).send('Not found');

export function kitRoutes(app, wrap) {
  app.get('/api/clients/:slug/kit', wrap(async (req, res) => res.json(await kitState(req.params.slug))));
  app.put('/api/clients/:slug/kit', wrap(async (req, res) => res.json(await chooseDesign(req.params.slug, { design: req.body?.design, pack: req.body?.pack, sections: req.body?.sections, pageSection: req.body?.pageSection, pageOrder: req.body?.pageOrder, chrome: req.body?.chrome, dropRelated: req.body?.dropRelated, innerHero: req.body?.innerHero }))));
  // the section library for the Customize sections panel: every kind of section in every layout, drawn with placeholder content, to add one to a page
  app.get('/api/clients/:slug/template/library', wrap(async (req, res) => {
    const { pc, spec, seedKey } = await load(req.params.slug, '');
    const design = designOf(spec.kit?.design || 'aurora', spec, seedKey);
    const K = context({ site: pc.site, pack: pc.pack, nav: [['Home', '/'], ['Services', '#'], ['About', '#'], ['Contact', '#']].map(([label, href]) => ({ label, href })) });
    const types = [];
    for (const [type, variants] of Object.entries(LIBRARY)) {
      const layouts = [];
      // (the layouts of this design first, then the layouts the other offered designs give the same kind of section)
      for (const [variant, fn] of Object.entries(variants)) {
        const own = ownLayout(design, variant), from = designOfLayout(variant);
        if (!own && !(design.prefix && from)) continue;
        try { layouts.push({ variant, own, design: from ? from.name : '', html: applyTones([fromDesign(fn(pc.data[type] || {}, K), variant, design)], [{}])[0] }); } catch { /* a layout that cannot be drawn here is not offered */ }
      }
      layouts.sort((a, b) => Number(b.own) - Number(a.own));
      if (layouts.length) types.push({ type, title: TITLES[type] || type, layouts });
    }
    res.json({ design: design.id, types });
  }));

  // what the sections of a previewed page can be drawn as (collected when the preview was built)
  app.get('/api/clients/:slug/template/sections', wrap(async (req, res) => {
    const file = path.join(clientDir(req.params.slug), 'template', 'preview-sections.json');
    const all = await readJson(file, {});
    const list = all[String(req.query.page || '')] || [];
    const key = String(req.query.key || '');
    res.json(key ? { section: list.find((s) => s.key === key) || null } : { sections: list.map(({ options, ...s }) => ({ ...s, count: options.length })) });
  }));

  // a design, one of its pages, drawn with placeholder content
  app.get('/kit/:slug/:design/:page', async (req, res, next) => {
    if (req.params.design === 'library') return next(); // the section library has its own route
    try {
      const page = String(req.params.page).replace(/\.html$/, '');
      if (!DESIGNS[req.params.design]) return page404(res);
      const { pc, spec, seedKey } = await load(req.params.slug, String(req.query.pack || ''));
      const design = designOf(req.params.design, spec, seedKey);
      if (page === 'styleguide') return res.type('html').send(styleGuide({ design, pc, spec, css: await kitCss() }));
      if (!PAGES.includes(page)) return page404(res);
      const base = `/kit/${req.params.slug}/${req.params.design}`;
      const map = { '/': `${base}/home.html`, '/contact.html': `${base}/contact.html` };
      const nav = [['Home', '/'], ['Services', '/#services'], ['About', '/#about'], ['Reviews', '/#reviews'], ['Contact', '/contact.html']].map(([label, href]) => ({ label, href, current: (page === 'contact' && label === 'Contact') || (page === 'home' && label === 'Home') }));
      res.type('html').send(renderKitPage({ edit: req.query.edit === '1', design, kind: page, content: pc.pages[page], site: pc.site, pack: pc.pack, active: spec, fontsBase: '/studio-fonts/', css: await kitCss(), u: (h) => map[h] || (page === 'inner' ? '#' : h.startsWith('/#') ? h.slice(1) : '#'), nav, bodyEnd: req.query.edit === '1' ? EDIT : '' }));
    } catch (e) { res.status(400).send(`<pre>${esc(e.message)}</pre>`); }
  });

  // every kind of section in every layout, drawn with placeholder content in the website's colours
  app.get('/kit/:slug/library{/:design}', async (req, res) => {
    try {
      const { pc, spec, seedKey } = await load(req.params.slug, String(req.query.pack || ''));
      const design = designOf(req.params.design || spec.kit?.design || 'aurora', spec, seedKey);
      const K = context({ site: pc.site, pack: pc.pack, nav: [['Home', '/'], ['Services', '#'], ['About', '#'], ['Contact', '#']].map(([label, href]) => ({ label, href })) });
      // one accordion per kind of section; inside it every layout of that kind, one under the other
      const label = (t, v) => `<div class="lib-tag"><b>${esc(t)}</b><span>${esc(v)}</span></div>`;
      const groups = [];
      groups.push(['hero', 'Hero', Object.entries(HERO).filter(([v]) => ownLayout(design, v)).map(([v, fn]) => label('hero', v) + fn(pc.pages.home.hero, K))]);
      for (const [type, variants] of Object.entries(LIBRARY)) { const list = Object.entries(variants).filter(([v]) => ownLayout(design, v)).map(([v, fn]) => label(type, v) + fn(pc.data[type] || {}, K)); if (list.length) groups.push([type, TITLES[type] || type, list]); }
      groups.push(['header', 'Header', Object.entries(HEADER).filter(([v]) => (design.prefix ? v === design.header : !/^[a-z]{2}$/.test(v))).map(([v, fn]) => label('header', v) + fn(K))]);
      groups.push(['footer', 'Footer', Object.entries(FOOTER).filter(([v]) => (design.prefix ? v === design.footer : !/^[a-z]{2}$/.test(v))).map(([v, fn]) => label('footer', v) + fn(K))]);
      const toc = groups.map(([id, title, list]) => `<a href="#lib-${id}" data-open="lib-${id}">${esc(title)} <i>${list.length}</i></a>`).join('');
      const acc = groups.map(([id, title, list]) => `<details class="lib-acc" id="lib-${id}"><summary><span>${esc(title)}</span><small>${list.length} layout${list.length === 1 ? '' : 's'}</small></summary><div class="lib-body">${list.join('\n')}</div></details>`).join('\n');
      const LIB_CSS = '.lib-bar{position:sticky;top:0;z-index:90;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;background:#0f172a;color:#fff;font:600 13px/1 system-ui}.lib-bar b{font-size:15px;margin-right:8px}.lib-bar a{color:#cbd5e1;text-decoration:none;padding:6px 10px;border-radius:999px;background:rgb(255 255 255/.08)}.lib-bar a:hover{background:rgb(255 255 255/.2);color:#fff}.lib-bar i{font-style:normal;opacity:.6;margin-left:4px}.lib-bar button{margin-left:auto;cursor:pointer;border:0;border-radius:8px;padding:7px 12px;font:inherit;background:#6366f1;color:#fff}.lib-bar button+button{margin-left:0;background:rgb(255 255 255/.14)}.lib-acc{border-bottom:1px solid #e2e8f0;background:#f8fafc}.lib-acc{scroll-margin-top:var(--bar,46px)}.lib-acc>summary{position:sticky;top:var(--bar,46px);z-index:80;display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer;list-style:none;padding:16px 20px;background:#fff;color:#0f172a;font:800 17px/1.2 system-ui;border-bottom:1px solid #e2e8f0}.lib-acc>summary::-webkit-details-marker{display:none}.lib-acc>summary::after{content:"+";font-size:22px;font-weight:600;color:#6366f1}.lib-acc[open]>summary::after{content:"\u2212"}.lib-acc>summary small{margin-left:auto;font:500 13px system-ui;color:#64748b}.lib-tag{display:flex;gap:10px;align-items:center;padding:8px 16px;background:#1e293b;color:#fff;font:600 12px/1 system-ui}.lib-tag span{opacity:.7;text-transform:capitalize}.lib-body{display:block}';
      const LIB_JS = 'var bar=document.querySelector(".lib-bar");function fit(){document.documentElement.style.setProperty("--bar",bar.offsetHeight+"px")}fit();addEventListener("resize",fit);document.querySelectorAll("[data-open]").forEach(function(a){a.addEventListener("click",function(){var d=document.getElementById(a.dataset.open);if(d)d.open=true})});document.getElementById("lib-all").onclick=function(){document.querySelectorAll(".lib-acc").forEach(function(d){d.open=true})};document.getElementById("lib-none").onclick=function(){document.querySelectorAll(".lib-acc").forEach(function(d){d.open=false})};if(location.hash){var t=document.getElementById(location.hash.slice(1));if(t&&t.tagName==="DETAILS")t.open=true}else{var f=document.querySelector(".lib-acc");if(f)f.open=true}';
      const blocks = [`<div class="lib-bar"><b>Section library</b>${toc}<button id="lib-all" type="button">Expand all</button><button id="lib-none" type="button">Collapse all</button></div>`, acc];
      res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Section library</title><style>${designCss(design, spec, '/studio-fonts/')}</style><style>${await kitCss()}</style><style>${LIB_CSS}</style></head><body class="k-body" style="${designVars(design)}">${blocks.join('\n')}<script>${LIB_JS}</script></body></html>`);
    } catch (e) { res.status(400).send(`<pre>${esc(e.message)}</pre>`); }
  });
}
