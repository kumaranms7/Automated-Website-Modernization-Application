import fs from 'node:fs/promises';
import path from 'node:path';
import { clientDir, loadClient, readJson } from '../config.js';
import { readSource } from '../util/source.js';
import { extractModel } from '../build/model.js';
import { convertPage } from './own-convert.js';
import { fillPattern } from './own-fill.js';
import { loadFamilies, familyOf } from './families.js';
import * as cheerio from 'cheerio';
import { ensurePatterns, patternsFor, learnFromSection, KINDS, KIND_LABEL } from './own-patterns.js';

// Converts one legacy page with the chosen template page and saves the result in template/own-preview/<page>, so it can be shown next
// to the original. Nothing in the website folder or the build is touched.

export const ownPreviewDir = (slug) => path.join(clientDir(slug), 'template', 'own-preview');

export async function previewConversion(slug, layout, rel) {
  if (!['home', 'inner', 'contact'].includes(layout)) throw new Error('Choose home, inner or contact.');
  const own = await readJson(path.join(clientDir(slug), 'template', 'own.json'), null);
  const templateRel = own?.[layout];
  if (!templateRel) throw new Error(`Choose and save a ${layout} template page first.`);
  const fam = await loadFamilies(slug);
  if (!fam) throw new Error('Detect the templates first.');
  rel = String(rel || '');
  if (!fam.pageMap[rel]) throw new Error('That page was not found in the audit.');
  if (familyOf(fam, rel) !== 'legacy') throw new Error('Choose a legacy page: modern pages are left as they are.');

  const client = await loadClient(slug);
  const model = extractModel(await readSource(client, rel), rel);
  const lib = await ensurePatterns(slug);
  const result = convertPage({ model, templateHtml: await readSource(client, templateRel), templateRel, targetRel: rel, patterns: patternsFor(lib, layout), vocab: new Set(lib.vocab || []), roles: own.roles?.[layout] || null, hints: lib.titleHints || null });
  const file = path.join(ownPreviewDir(slug), ...rel.split('/'));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, result.html);
  return { layout, page: rel, template: templateRel, notes: result.notes, at: new Date().toISOString() };
}

// sample content for every kind of section, the way an old page would have it
const sample = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));
const SAMPLE = {
  text: [{ t: 'h', level: 2, text: 'Running text' }, { t: 'html', html: '<p>This is how ordinary text looks on a converted page. It uses the headings, paragraphs, lists and links of your template page.</p><ul><li>A list item</li><li>Another list item</li></ul><p>A paragraph with <a href="#">a link</a>.</p>' }],
  cards: [{ t: 'cardgrid', title: 'Cards', items: sample(3, (i) => ({ title: `Card ${i}`, text: 'A short description of the card, as an old page would have it.', href: '#' })) }],
  faq: [{ t: 'faq', title: 'Frequently asked questions', items: sample(3, (i) => ({ q: `Question number ${i}?`, a: 'The answer to the question, written as a sentence or two.' })) }],
  reviews: [{ t: 'reviews', title: 'Reviews', items: sample(2, (i) => ({ quote: 'A kind review from a customer who was happy with the work.', name: `Customer ${i}` })) }],
  links: [{ t: 'related', groups: [{ title: 'Areas we serve', links: sample(6, (i) => ({ href: '#', t: `Area ${i}` })) }] }],
  cta: [{ t: 'cta', title: 'Ready to talk?', text: 'Call us today for a fast, friendly answer.', href: 'tel:5550100', label: 'Call now' }],
};
const TITLE = { text: 'Running text', ...KIND_LABEL };

async function samplePage(slug, name, kinds, title, patterns) {
  const own = await readJson(path.join(clientDir(slug), 'template', 'own.json'), null);
  const layout = own?.inner ? 'inner' : own?.home ? 'home' : 'contact';
  const templateRel = own?.[layout];
  if (!templateRel) throw new Error('Choose and save the template pages first.');
  const lib = await ensurePatterns(slug);
  const client = await loadClient(slug);
  const model = {
    ok: true, path: name,
    head: { title, description: 'The section designs used when old pages are converted.', robots: 'noindex', canonical: '', metas: [], jsonLd: [] },
    hero: { h1: title, crumbs: [{ text: 'Home', href: '/' }, { text: title, href: null }] },
    blocks: kinds.flatMap((k) => SAMPLE[k]),
    protected: { form: null, headScripts: [], bodyNoscript: '' },
  };
  const result = convertPage({ model, templateHtml: await readSource(client, templateRel), templateRel, targetRel: name, patterns: { ...patternsFor(lib, layout), ...(patterns || {}) }, vocab: new Set(lib.vocab || []), markPatterns: true });
  // the call-to-action band replaces one the template page has; a template without one gets the example above its footer
  const merged = { ...patternsFor(lib, layout), ...(patterns || {}) };
  let html = result.html;
  if (kinds.includes('cta') && merged.cta && !html.includes('data-pattern="cta"')) {
    const band = fillPattern(merged.cta, { title: 'Ready to talk?', text: 'Call us today for a fast, friendly answer.', href: 'tel:5550100', label: 'Call now' }).replace(/^(\s*<[a-z0-9-]+)/i, '$1 data-pattern="cta"');
    html = /<footer[\s>]/i.test(html) ? html.replace(/<footer[\s>]/i, (m) => band + m) : html.replace('</body>', band + '</body>');
  }
  // sections that fade in as they scroll into view are shown at once
  html = html.replace('</head>', '<style>.reveal-up,.reveal-left,.reveal-right,[class*="reveal"]{opacity:1!important;transform:none!important}</style></head>');
  return { html, templateRel };
}
const save = async (slug, name, html) => { const file = path.join(ownPreviewDir(slug), name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, html); };

// One section design with sample content, in the page chrome of the template. With a page and a section chosen, the design of that
// section is tried instead (nothing is saved).
export async function previewPattern(slug, kind, choice = null) {
  if (!KINDS.includes(kind)) throw new Error('Unknown section kind.');
  let patterns = null, name = `_pattern-${kind}.html`;
  if (choice?.page) { patterns = { [kind]: await learnFromSection(slug, kind, choice.page, choice.key) }; name = `_pattern-${kind}-try.html`; }
  const { html, templateRel } = await samplePage(slug, name, [kind], TITLE[kind].split(' (')[0], patterns);
  await save(slug, name, html);
  return { kind, file: name, url: `/ownpreview/${slug}/${name}`, template: templateRel };
}

// One page with an example of every section design (text, cards, FAQ, reviews, link lists, call-to-action); a bar at the top links to
// each of the sections
export async function previewPatterns(slug) {
  const { html, templateRel } = await samplePage(slug, '_patterns.html', ['text', ...KINDS], 'Section patterns');
  const $ = cheerio.load(html);
  const found = [];
  $('[data-pattern]').each((_, e) => { const k = $(e).attr('data-pattern'); if (!found.includes(k)) { found.push(k); $(e).attr('id', `pattern-${k}`); } });
  const links = found.map((k) => `<a href="#pattern-${k}">${TITLE[k].split(' (')[0]}</a>`).join('');
  $('head').append('<style>html{scroll-behavior:smooth}[id^=pattern-]{scroll-margin-top:64px}#sm-nav{position:fixed;top:0;left:0;right:0;z-index:2147483000;display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:10px 16px;background:#111827;color:#fff;font:600 14px/1.2 system-ui,sans-serif;box-shadow:0 2px 8px #0005}#sm-nav span{opacity:.7;margin-right:6px}#sm-nav a{color:#fff;text-decoration:none;padding:6px 12px;border-radius:999px;background:#ffffff1f}#sm-nav a:hover{background:#7c3aed}body{padding-top:48px}header.fixed,header.sticky,header[class*="fixed"],header[class*="sticky"],nav.fixed,.fixed.top-0{top:48px!important}</style>');
  $('body').prepend(`<nav id="sm-nav"><span>Sections</span>${links}</nav>`);
  await save(slug, '_patterns.html', $.html());
  return { template: templateRel, sections: found, at: new Date().toISOString() };
}
