import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { KIT_ICONS } from '../src/kit/icons.js';
import { PACK_IDS, packById, packFor } from '../src/kit/packs.js';
import { DESIGNS, DESIGN_IDS } from '../src/kit/designs.js';
import { HERO, LIBRARY, VARIANTS } from '../src/kit/sections.js';
import { HEADER, FOOTER } from '../src/kit/chrome.js';
import { placeholderContent } from '../src/kit/content.js';
import { renderKitPage, context } from '../src/kit/page.js';
import { kitCss } from '../src/kit/css.js';
import { tailor } from '../src/kit/tailor.js';
import { styleGuide } from '../src/kit/styleguide.js';
import { fitPage, phonesOf, collectSections, pageKinds, setKindPool } from '../src/kit/fit.js';
import { normalizeSpec, DEFAULT_SPEC } from '../src/template/spec.js';
import { extractModel } from '../src/build/model.js';

const profile = (industry, services = []) => ({ industry, summary: industry, services, nap: { name: 'Acme Co', phone: '(555) 010-2030', address: '12 Main St, Tampa, FL' }, facts: { city: 'Tampa' } });

test('the business type is read from the profile, and each pack has its own icons and content', () => {
  assert.equal(packFor(profile('Junk removal and debris hauling')).id, 'junk-removal');
  assert.equal(packFor(profile('Plumbing, drain cleaning and water heaters')).id, 'plumbing');
  assert.equal(packFor(profile('Residential and commercial roofing')).id, 'roofing');
  assert.equal(packFor(profile('Personal injury law firm')).id, 'law-firm');
  assert.equal(packFor(profile('Dental clinic')).id, 'healthcare');
  assert.equal(packFor(profile('Something nobody has heard of')).id, 'generic');
  assert.ok(PACK_IDS.length >= 14);
  for (const id of PACK_IDS) {
    const p = packById(id);
    for (const group of ['services', 'benefits', 'steps']) for (const [title, ic, text] of p[group]) { assert.ok(title && text, `${id} ${group} text`); assert.ok(KIT_ICONS[ic], `${id}: icon ${ic}`); }
    for (const [, ic] of p.trust) assert.ok(KIT_ICONS[ic], `${id}: trust icon ${ic}`);
    assert.equal(p.reviews.length, 3); assert.ok(p.faqs.length >= 5); assert.equal(p.stats.length, 4);
  }
});

test('the kit has many section types, each with several layout variants', () => {
  assert.ok(VARIANTS.hero.length >= 8, 'hero variants');
  const total = Object.values(VARIANTS).reduce((n, v) => n + v.length, 0) + Object.keys(HEADER).length + Object.keys(FOOTER).length;
  assert.ok(total >= 55, `${total} variants`);
  for (const [type, list] of Object.entries(VARIANTS)) if (!['pricing', 'team', 'hero'].includes(type)) assert.ok(list.length >= 2, `${type} has ${list.length}`);
  assert.ok(Object.keys(LIBRARY).length >= 14);
});

test('every design names only section variants that exist', () => {
  assert.ok(DESIGN_IDS.length >= 6);
  for (const d of Object.values(DESIGNS)) {
    assert.ok(HEADER[d.header] && FOOTER[d.footer], d.id);
    for (const kind of ['home', 'inner', 'contact']) for (const b of d[kind]) assert.ok(b.type === 'hero' ? HERO[b.variant] : LIBRARY[b.type]?.[b.variant], `${d.id}.${kind}: ${b.type}:${b.variant}`);
    assert.equal(d.home[0].type, 'hero');
  }
});

test('every variant of every section draws with placeholder content, with no leftovers', () => {
  const pc = placeholderContent(profile('Plumbing and drain cleaning', ['Emergency plumbing', 'Drain cleaning']), { name: 'Acme' });
  assert.equal(pc.pack.id, 'plumbing');
  assert.equal(pc.data.services.items[0].title, 'Emergency plumbing', 'the business\'s own services come first');
  const { context } = pc.__ctx ? pc : { context: null };
  void context;
  for (const id of DESIGN_IDS) for (const kind of ['home', 'inner', 'contact']) {
    const html = renderKitPage({ design: id, kind, content: pc.pages[kind], site: pc.site, pack: pc.pack, active: null });
    assert.ok(!/undefined|NaN|\[object/.test(html.replace(/<style>[\s\S]*?<\/style>/g, '')), `${id}/${kind} has a stray value`);
    const $ = cheerio.load(html);
    assert.equal($('h1').length, 1, `${id}/${kind} has one h1`);
    assert.ok($('main section').length >= 3, `${id}/${kind} sections`);
    assert.ok($('a[href^="tel:"]').length >= 1, `${id}/${kind} phone`);
    assert.ok($('body.k-body').length === 1 && $('title').text());
  }
});

test('the kit is written with Tailwind only: utility classes in the markup, one compiled stylesheet', async () => {
  const css = await kitCss();
  assert.match(css, /clamp\(/); assert.match(css, /color-mix\(/); assert.match(css, /backdrop-filter/); assert.match(css, /prefers-reduced-motion/); assert.match(css, /--th-brand-primary/);
  assert.match(css, /\.prose-k h2/, 'the base look of plain elements');
  assert.match(css, /group-has/, 'tabs and the pricing switch without script');
  const pc = placeholderContent(profile('Plumbing'), { name: 'Acme' });
  const html = renderKitPage({ design: 'aurora', kind: 'home', content: pc.pages.home, site: pc.site, pack: pc.pack, active: null });
  assert.ok(!/class="[^"]*(?<![w-])k-(sec|wrap|card|btn|hero)(?![w-])/.test(html), 'no hand-written component classes');
  assert.ok(!/<style>[^<]*\.k-(sec|wrap|card)/.test(html));
  assert.ok((html.match(/class="/g) || []).length > 200);
});

test('every variant is drawn: the optional sections too (tabs, before/after, team, map, blog, pricing toggle)', () => {
  for (const [type, v] of [['tabs', 'horizontal'], ['tabs', 'vertical'], ['compare', 'slider'], ['team', 'cards'], ['map', 'embed'], ['blog', 'cards'], ['blog', 'featured'], ['blog', 'list'], ['pricing', 'toggle'], ['pricing', 'comparison'], ['gallery', 'mosaic']]) assert.ok(LIBRARY[type]?.[v], `${type}:${v}`);
  const pc = placeholderContent(profile('Roofing'), { name: 'Acme' });
  const K = context({ site: pc.site, pack: pc.pack, nav: [] });
  assert.match(LIBRARY.tabs.horizontal(pc.data.tabs, K), /type="radio"/);
  assert.match(LIBRARY.compare.slider({}, K), /type="range"/);
  assert.match(LIBRARY.map.embed({}, { ...K, site: { ...K.site, address: '1 Main St, Tampa' } }), /google\.com\/maps\?q=1%20Main%20St/);
  assert.match(LIBRARY.pricing.toggle({}, K), /id="bill"/);
});

test('the style guide shows every basic element and content layout in a design', () => {
  const pc = placeholderContent(profile('Plumbing'), { name: 'Acme' });
  const html = styleGuide({ design: tailor('editorial', {}), pc, spec: null, css: '' });
  const $ = cheerio.load(html);
  for (const sel of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li ul', 'strong', 'em', 'blockquote', 'table', 'figure', 'hr', 'dl', 'details', 'input', 'select', 'textarea', 'code', 'mark', 'nav[aria-label="Breadcrumb"]']) assert.ok($(sel).length > 0, sel);
  for (const name of ['Image and content, image right', 'Image and content, image left', 'Full-width content only', 'Narrow reading column', 'Pull quote']) assert.ok(html.includes(name), name);
  assert.ok($('.prose-k').length >= 3);
});

test('a design is tailored to the website: the configuration, a stable seed, and the sections the user chose', () => {
  const spec = normalizeSpec({ layout: { header: 'centered', footer: 'light', hero: 'photo', topbar: false }, tokens: { radius: 'none', shadow: 'none', container: 'wide', headingCase: 'capitalize' } }, DEFAULT_SPEC);
  const d = tailor('aurora', { spec, seedKey: 'a' });
  assert.equal(d.header, 'center'); assert.equal(d.footer, 'light'); assert.equal(d.home[0].variant, 'photo'); assert.equal(d.topbar, false);
  assert.equal(d.vars['--k-r'], '0rem'); assert.equal(d.vars['--k-wrap'], '88rem'); assert.equal(d.vars['--k-h-case'], 'capitalize'); assert.equal(d.vars['--k-shadow-2'], 'none');
  // a setting left at the platform's default does not override the design
  const plain = tailor('midnight', { spec: normalizeSpec({}, DEFAULT_SPEC), seedKey: 'a' });
  assert.equal(plain.header, DESIGNS.midnight.header);
  // the same website always gets the same design; another website gets another page from the same direction
  const again = tailor('aurora', { spec, seedKey: 'a' });
  assert.deepEqual(again.home, d.home);
  const layouts = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => JSON.stringify(tailor('aurora', { spec: normalizeSpec({}, DEFAULT_SPEC), seedKey: k }).home)));
  assert.ok(layouts.size >= 3, `${layouts.size} different pages from one direction`);
  // sections the user swapped, added or removed win
  const mine = normalizeSpec({ kit: { design: 'aurora', sections: { inner: [{ type: 'faq', variant: 'grid' }, { type: 'tabs', variant: 'vertical' }, { type: 'nope', variant: 'x' }] } } }, DEFAULT_SPEC);
  assert.deepEqual(tailor('aurora', { spec: mine, seedKey: 'a' }).inner, [{ type: 'faq', variant: 'grid' }, { type: 'tabs', variant: 'vertical' }]);
  assert.deepEqual(mine.kit.sections.home, []);
});

const SITE = { name: 'Acme', host: 'acme.test', phone: { display: '(555) 010-2030', digits: '5550102030' }, nav: [{ label: 'Home', href: '/', children: [] }, { label: 'Services', href: '/services.html', children: [] }], ctaLabel: 'Contact us', ctaHref: '/contact.html' };
const PAGE = `<html><head><title>Roof repair | Acme</title></head><body><header><nav><a href="/">Home</a></nav></header><main>
<h1>Roof Repair in Tampa</h1><p>We repair leaking roofs quickly and fix flashing, shingles and gutters for homes across Tampa Bay since 2004.</p>
<h2>Why choose us</h2><ul><li>Licensed and insured crew</li><li>Same day inspections</li><li>Written warranty on all work</li><li>Fair upfront pricing</li></ul>
<h2>Frequently asked questions</h2><h3>How long does a repair take?</h3><p>Most repairs are finished in a single day.</p>
<p>Call <a href="tel:5550102030">(555) 010-2030</a> or <a href="tel:5550104444">(555) 010-4444</a> today.</p></main><footer>f</footer></body></html>`;

test('a website\'s own content is poured into the approved design, and nothing is lost', () => {
  const model = extractModel(PAGE, 'roof/repair.html');
  const spec = normalizeSpec({ kit: { design: 'bento', pack: 'roofing' } }, DEFAULT_SPEC);
  const kit = fitPage({ model, site: SITE, spec, u: (h) => h, kind: 'inner', phones: phonesOf(PAGE) });
  const $ = cheerio.load(`<main>${kit.main}</main>`);
  assert.equal($('h1').text(), 'Roof Repair in Tampa');
  const text = $('main').text().replace(/\s+/g, ' ');
  for (const t of ['leaking roofs quickly', 'Licensed and insured crew', 'Written warranty on all work', 'Most repairs are finished in a single day']) assert.ok(text.includes(t), t);
  assert.ok($('a[href="tel:5550104444"]').length === 1, 'a phone number in the content stays');
  // placeholder wording never reaches a real page
  assert.ok(!/Clear it out|Loved by customers|How it works/.test(text));
  assert.match(kit.header, /<header/); assert.match(kit.footer, /<footer/);
  // every number the page showed is available to the header and the footer
  assert.deepEqual(phonesOf(PAGE).map((p) => p.digits), ['5550102030', '5550104444']);
  assert.match(kit.header + kit.footer, /tel:5550104444/);
});

test('an icon or a logo is never used as the hero picture', () => {
  const html = '<html><body><header>h</header><main><h1>Title</h1><p>Intro text of the page that is long enough to be a lead paragraph for the hero.</p><img src="/images/clock-icon.png" alt=""><h2>More</h2><p>Body text of the section goes here and is long enough.</p></main><footer>f</footer></body></html>';
  const model = extractModel(html, 'index.html');
  const spec = normalizeSpec({ kit: { design: 'aurora' } }, DEFAULT_SPEC);
  const kit = fitPage({ model, site: SITE, spec, u: (h) => h, kind: 'home' });
  assert.ok(!/clock-icon/.test(kit.main.split('<h2')[0]), 'no icon in the hero');
  const withHero = fitPage({ model, site: SITE, spec, u: (h) => h, kind: 'home', heroCandidate: { src: '/images/crew.jpg', alt: 'Crew' } });
  assert.match(withHero.main, /crew\.jpg/);
});

test('the design is part of the saved template, and an unknown design is dropped', () => {
  const a = normalizeSpec({ kit: { design: 'aurora', pack: 'plumbing' } }, DEFAULT_SPEC);
  assert.deepEqual(a.kit, { design: 'aurora', pack: 'plumbing', sections: { home: [], inner: [], contact: [] }, pageSections: {}, pageOrder: {}, kinds: {}, chrome: { header: {}, footer: {}, topbar: {} } });
  assert.equal(normalizeSpec({}, a).kit.design, 'aurora', 'kept when a later save does not mention it');
  assert.equal(normalizeSpec({ kit: { design: 'nope', pack: 'nope' } }, DEFAULT_SPEC).kit.design, '');
  assert.equal(DEFAULT_SPEC.kit.design, '');
});

// ---------- real content in the approved design ----------
const RICH = `<html><head><title>Junk removal | Acme</title></head><body><header><a href="/">Home</a></header><main>
<h1>Junk Removal in Tampa</h1><p>We haul away furniture, appliances and debris from homes and job sites across Tampa Bay.</p>
<img src="/img/shield-icon.svg" alt=""><p>Licensed</p><p>and insured</p><img src="/img/star-icon.svg" alt=""><p>300+</p><p>5-star reviews</p><img src="/img/bbb-badge.svg" alt=""><p>BBB</p><p>Accredited</p>
<h2>What we remove</h2><p>Furniture, mattresses, appliances, yard waste and construction debris, loaded and gone in one visit.</p><p>See our <a href="/pricing.html">pricing page</a> for typical costs.</p>
<h2>Frequently asked questions</h2><h3>How soon can you come?</h3><p>Most jobs are scheduled the same day.</p><h3>Do you recycle?</h3><p>Yes, usable items are donated.</p>
<p>Call <a href="tel:5550102030">(555) 010-2030</a>.</p></main><footer>f</footer></body></html>`;

test('icon-and-caption groups become trust points, and the content fills the approved slots in their order', () => {
  const model = extractModel(RICH, 'junk/index.html');
  const spec = normalizeSpec({ kit: { design: 'midnight' } }, DEFAULT_SPEC);
  const { main, design } = fitPage({ model, site: SITE, spec, u: (h) => h, kind: 'home' });
  const $ = cheerio.load(`<main>${main}</main>`);
  // the small pictures with captions are the design's trust row, each keeping its own picture
  assert.ok($('img[src="/img/shield-icon.svg"]').length === 1 && $('img[src="/img/bbb-badge.svg"]').length === 1);
  assert.match($('main').text(), /Licensed and insured/);
  // the numbers with their labels are statistics, not loose paragraphs
  assert.ok(/300\+/.test($('main').text()) && /5-star reviews/.test($('main').text()));
  assert.equal($('h1').length, 1);
  // the design's own sections, in its own order: the trust row comes before the text, the call to action last
  const order = design.home.map((b) => b.type);
  assert.equal(order[0], 'hero');
  assert.ok(main.indexOf('Licensed') < main.indexOf('What we remove'));
  // all of the page's text and links are there
  for (const t of ['loaded and gone in one visit', 'How soon can you come?', 'Most jobs are scheduled the same day', 'Yes, usable items are donated']) assert.ok($('main').text().includes(t), t);
  assert.ok($('a[href="/pricing.html"]').length === 1 && $('a[href="tel:5550102030"]').length >= 1);
});

test('a real page shows nothing the website did not say: no made-up figures, claims, pictures, address or links', () => {
  const model = extractModel(RICH, 'junk/index.html');
  for (const design of DESIGN_IDS) {
    const spec = normalizeSpec({ kit: { design, pack: 'junk-removal' } }, DEFAULT_SPEC);
    const kit = fitPage({ model, site: { ...SITE, address: '', logo: '' }, spec, u: (h) => h, kind: 'home' });
    const all = `${kit.header}${kit.main}${kit.footer}`;
    const text = cheerio.load(all).text();
    for (const invented of ['25,000+', '2,500+', 'Trusted by', '4.9 / 5', '123 Main Street', 'hello@example.com', 'Image placeholder', 'Open today until', 'Serving your local area', 'Same-day service', 'Eco-friendly disposal']) assert.ok(!text.includes(invented) && !all.includes(invented), `${design}: ${invented}`);
  }
});

test('the old design\'s markup is not carried over: classes, styles and ids are removed, text and links stay', async () => {
  const { cleanHtml } = await import('../src/kit/fit.js');
  const out = cleanHtml('<div class="old-box" style="color:red" id="x" onclick="evil()"><p class="lead" data-x="1">Text with <a class="btn" href="/a.html" target="_blank">a link</a> and <img class="w-full" src="/i.png" alt="A" width="10"></p></div>');
  assert.ok(!/class=|style=|id=|onclick|data-x/.test(out));
  assert.match(out, /<a href="\/a\.html" target="_blank">a link<\/a>/);
  assert.match(out, /<img src="\/i\.png" alt="A" width="10">/);
});

test('a layout that shows only part of its content is not used for a page\'s own content', () => {
  const html = `<html><body><header>h</header><main><h1>Title</h1><p>Intro text of the page that is long enough to be a lead paragraph for the hero.</p><h2>About us</h2><p>${'We have been serving the area with honest work since the beginning. '.repeat(6)}</p><p>A second paragraph with a <a href="/more.html">link to more</a>.</p></main><footer>f</footer></body></html>`;
  const model = extractModel(html, 'about.html');
  const spec = normalizeSpec({ kit: { design: 'midnight', sections: { home: [{ type: 'hero', variant: 'spotlight' }, { type: 'about', variant: 'quote' }] } } }, DEFAULT_SPEC);
  const { main } = fitPage({ model, site: SITE, spec, u: (h) => h, kind: 'home' });
  assert.match(main, /link to more/);
  assert.match(main, /A second paragraph/);
});

test('the hero of an inner page can sit on a picture of the page, which is then not used again in the page', () => {
  const html = `<html><body><header>h</header><main><h1>Title</h1><p>Intro text of the page that is long enough to be a lead paragraph for the hero.</p><h2>About us</h2><p>${'We have been serving the area with honest work. '.repeat(6)}</p><img src="/images/crew.jpg" alt="Crew"><h2>Our work</h2><p>${'More about the work that we do every day. '.repeat(6)}</p><img src="/images/van.jpg" alt="Van"></main><footer>f</footer></body></html>`;
  const model = extractModel(html, 'about.html');
  const dims = { '/images/crew.jpg': { w: 1600, h: 900 }, '/images/van.jpg': { w: 400, h: 300 } };
  const run = (hero, collected) => {
    const spec = normalizeSpec({ kit: { design: 'midnight', pageSections: { 'about.html': { hero } } } }, DEFAULT_SPEC);
    const c = collectSections(Boolean(collected));
    const kit = fitPage({ model, site: SITE, spec, u: (h) => h, kind: 'inner', dims });
    collectSections(false);
    return { kit, c };
  };
  const plain = run({}, true);
  const bg = plain.c['about.html'][0].bg;
  assert.equal(bg.type, 'plain');
  assert.deepEqual(bg.images.map((p) => p.src), ['/images/crew.jpg', '/images/van.jpg'], 'every picture of the page can be chosen');
  assert.equal((plain.kit.main.match(/crew\.jpg/g) || []).length, 1, 'plain: the picture stays in the body');
  const photo = run({ bg: 'photo', image: '/images/crew.jpg' });
  assert.equal((photo.kit.main.match(/crew\.jpg/g) || []).length, 1, 'photo: used once, as the hero');
  assert.ok(/crew\.jpg/.test(photo.kit.main.split('</section>')[0]), 'photo: it is in the hero');
});

test('"Explore related pages" can be removed from every page of the template at once', () => {
  const html = `<html><body><header>h</header><main><h1>Title</h1><p>Intro text of the page that is long enough to be a lead paragraph for the hero.</p><h2>About us</h2><p>${'We have been serving the area with honest work. '.repeat(6)}</p><h2>Explore related pages</h2><ul><li><a href="/a.html">Page A</a></li><li><a href="/b.html">Page B</a></li><li><a href="/c.html">Page C</a></li></ul></main><footer>f</footer></body></html>`;
  const model = extractModel(html, 'x.html');
  const run = (kit) => fitPage({ model, site: SITE, spec: normalizeSpec({ kit: { design: 'midnight', ...kit } }, DEFAULT_SPEC), u: (h) => h, kind: 'inner' });
  assert.match(run({}).main, /Explore related pages/);
  const off = run({ dropRelated: true });
  assert.doesNotMatch(off.main, /Explore related pages/);
  assert.match(off.removedHtml, /Explore related pages/, 'what was taken out is not reported as lost');
});

test('the kinds of section of a website are found from its pages, and a kind has one layout on every page, also when it is chosen once', () => {
  const para = (n) => `<p>${'We have been serving the area with honest work. '.repeat(n)}</p>`;
  const page = (name, body) => extractModel(`<html><body><header>h</header><main><h1>${name}</h1><p>Intro text of the page that is long enough to be a lead paragraph for the hero.</p>${body}</main><footer>f</footer></body></html>`, `${name}.html`);
  const a = page('A', `<h2>First</h2>${para(8)}<h2>Second</h2>${para(8)}`);
  const b = page('B', `<h2>Only here</h2>${para(8)}`);
  const c = page('C', `<h2>Quote</h2>${para(8)}<blockquote>${para(2)}</blockquote>`);
  const spec = normalizeSpec({ kit: { design: 'midnight' } }, DEFAULT_SPEC);
  const ka = pageKinds({ model: a, site: SITE, spec }), kb = pageKinds({ model: b, site: SITE, spec });
  assert.ok(ka.length >= 1 && kb.length >= 1);
  assert.equal(ka[0].kind.id, kb[0].kind.id, 'the same kind of section has the same id on every page');
  assert.notEqual(pageKinds({ model: c, site: SITE, spec })[0].kind.id, ka[0].kind.id, 'a section of another shape is another kind');
  const variants = (model, kit) => { const c = collectSections(true); fitPage({ model, site: SITE, spec: normalizeSpec({ kit: { design: 'midnight', ...kit } }, DEFAULT_SPEC), u: (h) => h, kind: 'inner' }); collectSections(false); return c[model.path].filter((x) => !x.hero).map((x) => [x.kind, x.variant]); };
  const va = variants(a, {}), vb = variants(b, {});
  const of = (list, id) => [...new Set(list.filter(([k]) => k === id).map(([, v]) => v))];
  assert.equal(of(va, ka[0].kind.id).length, 1, 'one layout for a kind within a page');
  assert.deepEqual(of(va, ka[0].kind.id), of(vb, ka[0].kind.id), 'and the same layout on another page');
  const chosen = variants(b, { kinds: { [ka[0].kind.id]: { role: 'about', variant: 'full' } } });
  assert.deepEqual(of(chosen, ka[0].kind.id), ['full'], 'a layout chosen for a kind is used by every page that has the kind');
  // the preview of the inner template shows the kinds of the other pages as well
  setKindPool({ page: 'B.html', kinds: ka.map(({ s, role, kind }) => ({ id: kind.id, label: kind.label, role, count: 3, pages: ['A.html'], s })) });
  const c2 = collectSections(true);
  fitPage({ model: b, site: SITE, spec, u: (h) => h, kind: 'inner' });
  collectSections(false); setKindPool(null);
  const all = c2['B.html'].filter((x) => !x.hero);
  for (const k of [...ka, ...kb]) assert.ok(all.some((x) => x.kind === k.kind.id), `kind ${k.kind.label} is in the preview`);
});

// ---------- alternating section colours, and the tone and spacing of a section ----------
test('plain sections alternate in colour, sections with a background of their own keep it, and a chosen tone wins', async () => {
  const { applyTones } = await import('../src/kit/tones.js');
  const plain = '<section class="relative py-[var(--k-sec-y)] "><div>x</div></section>';
  const alt = '<section class="relative py-[var(--k-sec-y)] bg-paper-alt "><div>x</div></section>';
  const hero = '<section class="relative isolate bg-[radial-gradient(60%_80%_at_90%_0%,red,transparent)]"><div>h</div></section>';
  const bg = (html) => (/bg-night/.test(html) ? 'dark' : /bg-paper-alt/.test(html) ? 'alt' : /color-mix\(in_srgb,var\(--th-brand-primary\)_5%/.test(html) ? 'tint' : 'none');
  const out = applyTones([hero, plain, plain, plain, plain, plain, plain], []);
  const tones = out.slice(1).map(bg);
  for (let i = 1; i < tones.length; i++) assert.notEqual(tones[i], tones[i - 1], `section ${i} differs from the one before`);
  assert.ok(new Set(tones).size >= 3, 'at least three different backgrounds');
  assert.equal(bg(applyTones([alt], [])[0]), 'alt', 'a design\'s own tone is kept');
  assert.equal(applyTones([hero], [])[0], hero, 'a hero is left alone');
  assert.equal(bg(applyTones([alt], [{ tone: 'dark' }])[0]), 'dark', 'the chosen tone wins');
  assert.match(applyTones([plain], [{ tone: 'dark' }])[0], /on-dark/);
  assert.match(applyTones([plain], [{ space: 'tight' }])[0], /\*\.6/);
  assert.match(applyTones([plain], [{ space: 'loose' }])[0], /\*1\.5/);
  assert.equal(bg(applyTones([alt], [{ tone: 'white' }])[0]), 'none');
});

test('a section of the blueprint keeps its tone and spacing, and every section of a preview page knows its place', () => {
  const spec = normalizeSpec({ kit: { design: 'aurora', sections: { home: [{ type: 'hero', variant: 'aurora' }, { type: 'services', variant: 'numbered', tone: 'dark', space: 'tight' }, { type: 'faq', variant: 'grid', tone: 'nope', space: 'huge' }] } } }, DEFAULT_SPEC);
  assert.deepEqual(spec.kit.sections.home[1], { type: 'services', variant: 'numbered', tone: 'dark', space: 'tight' });
  assert.deepEqual(spec.kit.sections.home[2], { type: 'faq', variant: 'grid' }, 'an unknown tone or spacing is dropped');
  const pc = placeholderContent(profile('Plumbing'), { name: 'Acme' });
  const html = renderKitPage({ design: tailor('aurora', { spec, seedKey: 'a' }), kind: 'home', content: pc.pages.home, site: pc.site, pack: pc.pack, active: null });
  const $ = cheerio.load(html);
  assert.deepEqual($('[data-kit-sec]').map((_, e) => $(e).attr('data-kit-sec')).get(), ['0', '1', '2']);
  assert.match($('[data-kit-sec="1"]').attr('class'), /bg-night/);
});

test('a section customised for one page: kept in the settings, lists convert only when nothing is lost', async () => {
  const { convertTo, keyOf, optionsFor } = await import('../src/kit/customize.js');
  const feat = { type: 'features', title: 'Why us', items: [{ title: 'Fast', text: 'Same day' }, { title: 'Fair', text: 'Upfront pricing' }, 'Insured'] };
  const steps = convertTo(feat, 'steps');
  assert.equal(steps.type, 'steps');
  assert.equal(steps.items.length, 3);
  // a card with a link or a picture cannot become plain points
  const cards = { type: 'cardgrid', title: 'Services', items: [{ title: 'A', href: '/a' }, { title: 'B', href: '/b' }, { title: 'C', href: '/c' }] };
  assert.equal(convertTo(cards, 'features'), null);
  assert.equal(convertTo(cards, 'services').items[0].href, '/a');
  // a stable key, the same for the same content
  assert.equal(keyOf(feat), keyOf({ ...feat }));
  assert.notEqual(keyOf(feat), keyOf(cards));
  const { normalizeSpec } = await import('../src/template/spec.js');
  const spec = normalizeSpec({ kit: { design: 'aurora', pageSections: { 'index.html': { [keyOf(feat)]: { role: 'steps', variant: 'cards', tone: 'dark' }, bad: { variant: 'x' } } } } });
  assert.deepEqual(spec.kit.pageSections['index.html'][keyOf(feat)], { role: 'steps', variant: 'cards', tone: 'dark' });
  assert.equal(Object.keys(spec.kit.pageSections['index.html']).length, 1);
  assert.equal(typeof optionsFor, 'function');
});

test('reordering and removing the sections of one page are kept in the settings', async () => {
  const { normalizeSpec } = await import('../src/template/spec.js');
  const spec = normalizeSpec({ kit: { design: 'aurora', pageSections: { 'index.html': { sabc123: { hide: true }, sdef456: { variant: 'cards', role: 'steps' }, bad: { hide: true } } }, pageOrder: { 'index.html': ['sdef456', 'sabc123', 'nope', 'x'] } } });
  assert.deepEqual(spec.kit.pageSections['index.html'].sabc123, { hide: true });
  assert.equal(spec.kit.pageSections['index.html'].bad, undefined);
  assert.deepEqual(spec.kit.pageOrder['index.html'], ['sdef456', 'sabc123']);
});

test('hand-written section html is kept, without scripts, handlers or portal markers', async () => {
  const { cleanCustomHtml } = await import('../src/kit/custom-html.js');
  const out = cleanCustomHtml('<section class="a kit-cs-sel" data-kit-key="s1" onclick="x()"><h2>Hi</h2><script>alert(1)</script><a href="javascript:bad()">x</a><a href="/ok">y</a></section>');
  assert.ok(out.includes('<h2>Hi</h2>') && out.includes('href="/ok"'));
  assert.ok(!/script|onclick|data-kit-key|kit-cs-sel|javascript:/i.test(out));
  const { normalizeSpec } = await import('../src/template/spec.js');
  const spec = normalizeSpec({ kit: { design: 'aurora', pageSections: { 'index.html': { sabc123: { html: '<section><p>Own</p><script>1</script></section>' } } } } });
  assert.equal(spec.kit.pageSections['index.html'].sabc123.html, '<section><p>Own</p></section>');
});

test('the parts of a section can be styled: designs, theme or custom colours, text settings; only known values are kept', async () => {
  const { cleanStyle, tagParts, cssColor, PRESETS, THEME_COLORS } = await import('../src/kit/parts.js');
  const { applyTones } = await import('../src/kit/tones.js');
  assert.deepEqual(cleanStyle({ item: { preset: 'tint', bg: '#fde68a', border: 'url(x)', radius: 'md', evil: 'red', color: 'theme:accent' }, button: { preset: 'nope', transform: 'uppercase', size: '9xl' }, nope: { bg: '#fff' } }), { item: { preset: 'tint', bg: '#fde68a', radius: 'md', color: 'theme:accent' }, button: { transform: 'uppercase' } });
  assert.equal(cssColor('theme:accent'), 'var(--th-brand-accent)');
  assert.equal(cssColor('theme:made-up'), '');
  assert.ok(THEME_COLORS.length >= 12 && Object.keys(PRESETS.button).length >= 6 && PRESETS.item && PRESETS.icon && PRESETS.eyebrow);
  const html = '<section class="relative py-[var(--k-sec-y)]"><a class="inline-flex items-center gap-2 rounded-full border border-default bg-surface px-4" href="/a">Miami <svg class="size-4"></svg></a><a class="rounded-kb px-6" href="/b">Go</a><h2 class="font-display text-heading leading-[1.08]">Title</h2></section>';
  const tagged = tagParts(html);
  assert.ok(tagged.includes('data-p="item"') && tagged.includes('data-p="button"') && tagged.includes('data-p="heading"'));
  assert.ok(!/--k-(bg|fg|bd|rd|ic|tt|ta)\b/.test(tagged), 'nothing is added without a choice');
  const styled = tagParts(html, { item: { preset: 'tint', bg: '#fde68a' }, icon: { color: 'theme:accent' }, button: { preset: 'gradient', transform: 'uppercase' }, heading: { align: 'center', size: '4xl' } });
  assert.ok(styled.includes('--k-bg:#fde68a'), 'a custom colour wins over the design');
  assert.ok(styled.includes('--k-ic:var(--th-brand-accent)') && styled.includes('[&_svg]:[color:var(--k-ic)]!'), 'an icon in a pill takes its colour');
  assert.ok(styled.includes('--k-tt:uppercase') && styled.includes('--k-ta:center') && styled.includes('[text-align:var(--k-ta)]!'));
  assert.ok(styled.includes('linear-gradient'), 'a design can have a gradient');
  const out = applyTones([html], [{ style: { button: { bg: 'theme:dark' } } }]);
  assert.ok(out[0].includes('--k-bg:var(--th-bg-dark)'));
  assert.equal(applyTones([html], [{}])[0].includes('data-p='), false);
  const { normalizeSpec } = await import('../src/template/spec.js');
  const spec = normalizeSpec({ kit: { design: 'aurora', sections: { home: [{ type: 'areas', variant: 'pills', style: { item: { bg: '#fde68a' }, junk: 1 } }] } } });
  assert.deepEqual(spec.kit.sections.home[0].style, { item: { bg: '#fde68a' } });
});

test('buttons of different designs are styled apart, the same design together; elements can be removed; the section has colours and space', async () => {
  const { tagParts, cleanStyle, applySection, PART_FIELDS, PRESETS } = await import('../src/kit/parts.js');
  const { applyTones } = await import('../src/kit/tones.js');
  const html = '<section class="relative py-[var(--k-sec-y)] bg-paper-alt"><a class="rounded-kb bg-button" href="/a">A</a><a class="rounded-kb bg-button" href="/a2">A2</a><a class="rounded-kb border-ink/20 text-heading" href="/b">B</a><h3 class="font-display text-heading leading-tight">T</h3></section>';
  const tagged = tagParts(html);
  assert.equal((tagged.match(/data-p="buttonPrimary"/g) || []).length, 2);
  assert.equal((tagged.match(/data-p="buttonGhost"/g) || []).length, 1);
  assert.ok(PART_FIELDS.buttonGhost && PRESETS.buttonGhost.gradient && PART_FIELDS.section && PRESETS.section.dark);
  // one design styled: the other is untouched; the two of the same design share it
  const out = tagParts(html, { buttonGhost: { preset: 'dark' } });
  const ghost = /<a[^>]*data-p="buttonGhost"[^>]*>/.exec(out)[0];
  assert.ok(ghost.includes('--k-bg:var(--th-bg-dark)'));
  assert.ok(!/<a[^>]*data-p="buttonPrimary"[^>]*--k-bg/.test(out));
  const both = tagParts(html, { buttonPrimary: { bg: '#112233' } });
  assert.equal((both.match(/--k-bg:#112233/g) || []).length, 2);
  // a choice made before buttons were told apart still applies to every button
  assert.ok((tagParts(html, { button: { bg: '#445566' } }).match(/--k-bg:#445566/g) || []).length >= 3);
  // an element can be removed
  const gone = tagParts(html, { itemTitle: { hide: 'yes' } });
  assert.ok(/<h3[^>]*\[display:none\]!/.test(gone));
  assert.deepEqual(cleanStyle({ itemTitle: { hide: 'yes' }, icon: { hide: 'no' } }), { itemTitle: { hide: 'yes' } });
  // the section: a colour (theme or custom), text mode follows how dark it is, space above and below
  const dark = applySection('<section class="relative py-[var(--k-sec-y)] bg-paper-alt"><p>x</p></section>', { bg: '#0f172a', padTop: 'lg' });
  assert.ok(dark.includes('on-dark') && dark.includes('text-on-dark') && dark.includes('--k-bg:#0f172a') && dark.includes('--k-pt:'));
  const light = applySection('<section class="relative bg-night text-on-dark on-dark"><p>x</p></section>', { bg: '#fde68a' });
  assert.ok(!/\bon-dark\b/.test(light.replace(/text-on-dark/g, '')) && !light.includes('text-on-dark'));
  const themed = applyTones(['<section class="relative bg-paper-alt"><p>x</p></section>'], [{ style: { section: { preset: 'gradient' } } }]);
  assert.ok(themed[0].includes('--k-bi:linear-gradient') && themed[0].includes('on-dark'));
});

test('the header, top bar and footer are chosen for the whole theme: a layout and the styles of their parts', async () => {
  const { normalizeSpec } = await import('../src/template/spec.js');
  const { tailor } = await import('../src/kit/tailor.js');
  const { chromeHtml } = await import('../src/kit/chrome.js');
  const { context } = await import('../src/kit/page.js');
  const { packById } = await import('../src/kit/packs.js');
  const spec = normalizeSpec({ kit: { design: 'aurora', chrome: { header: { variant: 'center', style: { navLink: { transform: 'uppercase' }, junk: { x: 1 } } }, footer: { variant: 'nope', style: { footLink: { color: 'theme:accent' }, section: { preset: 'dark' } } }, topbar: { show: 'yes' } } } });
  assert.equal(spec.kit.chrome.header.variant, 'center');
  assert.equal(spec.kit.chrome.footer.variant, undefined, 'an unknown layout is dropped');
  assert.deepEqual(spec.kit.chrome.header.style, { navLink: { transform: 'uppercase' } });
  assert.equal(spec.kit.chrome.topbar.show, 'yes');
  const design = tailor('aurora', { spec, seedKey: 'x' });
  assert.equal(design.header, 'center');
  assert.equal(design.topbar, true);
  const K = context({ site: { name: 'Acme', phone: { digits: '5551234567', display: '555 123 4567' } }, pack: packById('plumbing'), nav: [{ label: 'Home', href: '/' }, { label: 'Contact', href: '/contact.html' }] });
  const c = chromeHtml(design, K);
  assert.ok(/data-p="navLink"[^>]*--k-tt:uppercase/.test(c.header), 'the menu links carry what was chosen');
  assert.ok(/data-p="footLink"[^>]*--k-fg:var\(--th-brand-accent\)/.test(c.footer));
  assert.ok(c.footer.includes('--k-bg:var(--th-bg-dark)') && c.footer.includes('on-dark'), 'the footer itself has a background');
  assert.ok(!c.header.includes('data-kit-chrome'), 'no editor marks in a page');
  assert.ok(chromeHtml(design, K, { edit: true }).header.includes('data-kit-chrome="header"'));
  // nothing chosen: the design\'s own
  const plain = tailor('aurora', { spec: normalizeSpec({ kit: { design: 'aurora' } }), seedKey: 'x' });
  assert.equal(plain.header, 'pill');
});

test('sections and parts can be animated: entrance, hover and loop; checked values only, one after the other, calm for reduced motion', async () => {
  const { motionOf, ENTRANCE, HOVER, LOOP } = await import('../src/kit/motion.js');
  const { tagParts, cleanStyle, applySection, PART_FIELDS } = await import('../src/kit/parts.js');
  assert.ok(Object.keys(ENTRANCE).length >= 10 && Object.keys(HOVER).length >= 6 && Object.keys(LOOP).length >= 6);
  assert.deepEqual(motionOf({}), { classes: [], vars: {}, attrs: '' });
  const m = motionOf({ entrance: 'zoom-in', speed: 'slow', delay: 'short', easing: 'spring', hover: 'lift', loop: 'float', stagger: 'yes', replay: 'yes' }, 2);
  assert.ok(m.vars['--k-a1'].startsWith('ka-zoom-in 1.1s cubic-bezier(.34,1.56,.64,1) 0.33s'), 'the delay adds the place in the row');
  assert.ok(m.vars['--k-a2'].startsWith('ka-float') && m.attrs === ' data-k-replay');
  assert.ok(m.classes.some((c) => c.includes('motion-reduce')) && m.classes.some((c) => c.includes('.k-js_&:not(.k-in)')), 'hidden only when the script is there; calm when asked');
  assert.deepEqual(cleanStyle({ item: { entrance: 'fade-up', hover: 'explode', speed: 'fast', stagger: 'yes' }, section: { entrance: 'zoom-in', hover: 'lift' } }), { item: { entrance: 'fade-up', speed: 'fast', stagger: 'yes' }, section: { entrance: 'zoom-in' } });
  assert.ok(PART_FIELDS.item.some(([p]) => p === 'entrance') && PART_FIELDS.section.some(([p]) => p === 'replay') && !PART_FIELDS.section.some(([p]) => p === 'hover'));
  const html = '<section class="relative"><a class="inline-flex rounded-full border border-default bg-surface" href="/a">A</a><a class="inline-flex rounded-full border border-default bg-surface" href="/b">B</a></section>';
  const out = tagParts(html, { item: { entrance: 'fade-up', stagger: 'yes' } });
  assert.ok(out.includes('0.00s') && out.includes('0.09s'), 'each one starts a little after the one before');
  assert.ok(applySection(html, { entrance: 'fade' }).includes('--k-a1:ka-fade'));
  assert.equal(tagParts(html, { item: { hide: 'yes', entrance: 'fade' } }).includes('--k-a1'), false, 'a removed part does not animate');
  assert.equal(tagParts(html).includes('k-a '), false, 'nothing moves unless chosen');
});

test('the existing layouts move by themselves, every time they appear; what is chosen replaces it and "none" turns it off', async () => {
  const { DEFAULT_MOTION, motionDefaults, withMotion, motionOf } = await import('../src/kit/motion.js');
  const { applyTones } = await import('../src/kit/tones.js');
  const { cleanStyle } = await import('../src/kit/parts.js');
  for (const id of ['aurora', 'bento', 'midnight', 'editorial', 'clarity', 'local']) {
    const d = motionDefaults(id);
    assert.ok(d.section.entrance && d.section.replay === 'yes' && d.item.stagger === 'yes' && d.item.replay === 'yes', id + ' moves, and replays');
  }
  assert.deepEqual(Object.keys(DEFAULT_MOTION).sort(), ['aurora', 'bento', 'clarity', 'editorial', 'local', 'midnight']);
  const sec = '<section class="relative py-[var(--k-sec-y)]"><a class="inline-flex rounded-full border border-default bg-surface" href="/a">A</a></section>';
  const motion = motionDefaults('aurora');
  const parts = [sec, sec];
  const out = applyTones(parts, [{}, {}], { motion });
  assert.equal(out[0].includes('k-a'), false, 'the first part of a page (its hero) keeps still');
  assert.ok(out[1].includes('data-k-replay') && out[1].includes('--k-a1:ka-fade-up'), 'the other sections enter, and again each time');
  assert.ok(/data-p="item"[^>]*--k-a1:ka-zoom-in/.test(out[1]), 'the cards of the design enter too');
  // what was chosen wins; "none" switches it off; the rest of the defaults stay
  const mine = applyTones(parts, [{}, { style: { section: { entrance: 'off' }, item: { entrance: 'fade-down', replay: 'no' } } }], { motion })[1];
  assert.equal(/<section[^>]*k-a/.test(mine), false);
  assert.ok(mine.includes('ka-fade-down') && !/data-p="item"[^>]*data-k-replay/.test(mine));
  assert.deepEqual(cleanStyle({ section: { entrance: 'off' }, item: { loop: 'off', replay: 'no', hover: 'nope' } }), { section: { entrance: 'off' }, item: { loop: 'off', replay: 'no' } });
  assert.equal(withMotion({ item: { entrance: 'fade', replay: 'yes' } }, { item: { entrance: 'zoom-in' } }).item.replay, 'yes');
  assert.deepEqual(motionOf({ entrance: 'off', hover: 'off' }), { classes: [], vars: {}, attrs: '' });
});

test('width, max width and position of parts, the heading block, and the content width of a section', async () => {
  const { tagParts, cleanStyle, applySection, PART_FIELDS } = await import('../src/kit/parts.js');
  const head = '<div class="mb-[clamp(2rem,4vw,3.5rem)] grid gap-4 max-w-3xl"><div class="grid gap-4"><h2 class="font-display text-heading leading-[1.08]">A long heading that could use the room</h2><p class="max-w-2xl text-secondary">Intro</p></div></div>';
  const tagged = tagParts(head);
  assert.ok(tagged.includes('data-p="head"') && tagged.includes('data-p="heading"') && tagged.includes('data-p="text"'));
  for (const part of ['head', 'heading', 'text', 'item', 'button', 'image']) assert.ok(PART_FIELDS[part].some(([p]) => p === 'maxWidth') && PART_FIELDS[part].some(([p]) => p === 'width'), part + ' has a size');
  const out = tagParts(head, { head: { maxWidth: 'none', width: '75', position: 'center' }, text: { maxWidth: '64' } });
  const block = /<div[^>]*data-p="head"[^>]*>/.exec(out)[0];
  assert.ok(block.includes('--k-mw:none') && block.includes('--k-w:75%') && block.includes('[max-width:var(--k-mw)]!'));
  assert.ok(block.includes('--k-ml:auto') && block.includes('--k-mr:auto'), 'a block of limited width can sit in the middle');
  assert.ok(/<p[^>]*data-p="text"[^>]*--k-mw:64rem/.test(out));
  assert.deepEqual(cleanStyle({ head: { maxWidth: 'huge', width: '33', position: 'left' } }), { head: { width: '33', position: 'left' } });
  const sec = applySection('<section class="relative"><div class="mx-auto w-[min(100%-2.5rem,var(--k-wrap))]"></div></section>', { contentWidth: 'wide' });
  assert.ok(sec.includes('--k-wrap:1400px'));
  assert.ok(PART_FIELDS.section.some(([p]) => p === 'contentWidth'));
});

test('on a real page every section, the hero, the header and the footer can be styled: per page for the page, for the whole theme for the header and footer', async () => {
  const { normalizeSpec } = await import('../src/template/spec.js');
  const spec = normalizeSpec({ kit: { design: 'aurora', pageSections: { 'index.html': { hero: { variant: 'photo', style: { buttonLight: { preset: 'dark' }, junk: { x: 1 } } }, sabc123: { style: { item: { bg: '#fde68a' } } }, other: { style: { item: { bg: '#fff' } } } } } } });
  const page = spec.kit.pageSections['index.html'];
  assert.deepEqual(page.hero, { variant: 'photo', style: { buttonLight: { preset: 'dark' } } }, 'the hero has a choice of its own');
  assert.deepEqual(page.sabc123.style, { item: { bg: '#fde68a' } });
  assert.equal(page.other, undefined, 'only a section or the hero can be named');
  const { fitPage, collectSections } = await import('../src/kit/fit.js');
  assert.equal(typeof fitPage, 'function');
  assert.equal(typeof collectSections, 'function');
});

test('the text of the page can be styled: its block, and the paragraphs, headings, links, bold text, lists and quotes inside it', async () => {
  const { tagParts, cleanStyle, PART_FIELDS, PARTS } = await import('../src/kit/parts.js');
  const { DESC_CLASS } = await import('../src/kit/desc-classes.js');
  const fs = await import('node:fs');
  const html = '<section class="x"><div class="prose-k max-w-3xl"><p>One</p><p>Two <a href="/a">link</a> <strong>bold</strong></p><ul><li>a</li><li>b</li></ul></div></section>';
  assert.ok(tagParts(html).includes('data-p="content"'));
  for (const part of ['content', 'paragraph', 'contentHeading', 'contentLink', 'contentBold', 'contentList', 'contentQuote']) assert.ok(PARTS.includes(part) && PART_FIELDS[part].length, part);
  assert.ok(PART_FIELDS.paragraph.some(([p]) => p === 'gap') && PART_FIELDS.contentLink.some(([p]) => p === 'underline'));
  assert.ok(PART_FIELDS.content.some(([p]) => p === 'maxWidth'), 'the block has a width');
  assert.equal(PART_FIELDS.paragraph.some(([p]) => p === 'hide' || p === 'entrance'), false, 'what is inside the text moves and goes with it');
  const out = tagParts(html, { paragraph: { color: 'theme:accent', size: 'lg', gap: 'md' }, contentLink: { underline: 'none', color: '#112233' }, contentList: { gap: 'sm' }, content: { align: 'center' } });
  const block = /<div[^>]*data-p="content"[^>]*>/.exec(out)[0];
  assert.ok(block.includes('--k-pa-fg:var(--th-brand-accent)') && block.includes('--k-pa-fs:1.125rem') && block.includes('--k-pa-mt:1.4rem'));
  assert.ok(block.includes('--k-cl-td:none') && block.includes('--k-cl-fg:#112233') && block.includes('--k-cs-mt:.9rem') && block.includes('--k-ta:center'));
  assert.ok(block.includes('[&_p]:[color:var(--k-pa-fg)]!') && block.includes('[&_p+p]:[margin-top:var(--k-pa-mt)]!') && block.includes('[&_li+li]:[margin-top:var(--k-cs-mt)]!'));
  // every class written for them is written out in full in the source, where the stylesheet is built from
  const src = fs.readFileSync(new URL('../src/kit/desc-classes.js', import.meta.url), 'utf8');
  for (const cls of Object.values(DESC_CLASS)) assert.ok(src.includes(cls));
  assert.deepEqual(cleanStyle({ paragraph: { color: 'theme:accent', hide: 'yes', entrance: 'fade', gap: 'huge' } }), { paragraph: { color: 'theme:accent' } });
  assert.equal(tagParts(html, { paragraph: { color: 'theme:accent' } }).includes('--k-pa-fg'), true);
  assert.equal(tagParts('<div class="grid"><p>x</p></div>', { paragraph: { color: 'theme:accent' } }).includes('--k-pa-fg'), false, 'only a block of text carries them');
});
