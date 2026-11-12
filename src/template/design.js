import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { chromium } from 'playwright-core';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';
import { clientDir, readJson, writeJson, loadClient } from '../config.js';
import { readSource } from '../util/source.js';
import { plain } from '../util/html.js';
import { callTool } from '../ai/claude.js';
import { getProfile } from '../profile/store.js';
import { OPTIONS, FONT_CATALOG, normalizeSpec, normalizeTweaks, DEFAULT_SPEC } from './spec.js';
import { missingTailwindClasses } from './tw-check.js';
import { ARCHETYPES, ARCHETYPE_NAMES, archetypeCatalog, guessArchetype, seedOf } from './archetypes.js';
import { loadActive, saveDraft, refsDir } from './store.js';

// AI-assisted design: the user supplies a brief plus references (website URLs, screenshots); Claude looks at them
// and chooses design tokens and layout variants from the options the renderer supports. It never writes templates,
// only a design spec, which is clamped to the allowed values and previewed before being accepted.

const refsFile = (slug) => path.join(clientDir(slug), 'template', 'refs.json');
export const listRefs = (slug) => readJson(refsFile(slug), []);

export async function addUrlRef(slug, url, note = '') {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname)) throw new Error('Enter a public http(s) address');
  const refs = await listRefs(slug);
  const ref = { id: crypto.randomBytes(4).toString('hex'), type: 'url', value: u.href, note: String(note).slice(0, 300) };
  refs.push(ref);
  await writeJson(refsFile(slug), refs.slice(-8));
  return ref;
}

export async function addImageRef(slug, name, dataUrl, note = '') {
  const m = String(dataUrl).match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
  if (!m) throw new Error('Upload a PNG, JPG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) throw new Error('Image is larger than 6 MB');
  await fs.mkdir(refsDir(slug), { recursive: true });
  const id = crypto.randomBytes(4).toString('hex');
  const file = `${id}.jpg`;
  await sharp(buf).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(path.join(refsDir(slug), file));
  const refs = await listRefs(slug);
  const ref = { id, type: 'image', value: file, name: String(name || 'reference').slice(0, 80), note: String(note).slice(0, 300) };
  refs.push(ref);
  await writeJson(refsFile(slug), refs.slice(-8));
  return ref;
}

export async function removeRef(slug, id) {
  const refs = await listRefs(slug);
  const ref = refs.find((r) => r.id === id);
  if (ref?.type === 'image') await fs.rm(path.join(refsDir(slug), ref.value), { force: true });
  await writeJson(refsFile(slug), refs.filter((r) => r.id !== id));
}

// Screenshot (top of page) plus what the page's own CSS says about fonts and colours.
export async function captureUrl(url) {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(1500);
    const facts = await page.evaluate(() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const h = document.querySelector('h1') || document.querySelector('h2');
      const btn = document.querySelector('a.btn, button, a[class*="button"], a[class*="btn"]');
      return {
        headingFont: cs(h)?.fontFamily, bodyFont: cs(document.body)?.fontFamily,
        bodyBg: cs(document.body)?.backgroundColor, headingColor: cs(h)?.color, buttonBg: cs(btn)?.backgroundColor, buttonRadius: cs(btn)?.borderRadius,
        themeColor: document.querySelector('meta[name="theme-color"]')?.content || '',
      };
    });
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 1366, height: 2400 }, fullPage: true });
    const jpg = await sharp(png).resize({ width: 1000 }).jpeg({ quality: 68 }).toBuffer();
    return { jpg, facts };
  } finally { await browser.close(); }
}

async function referenceBlocks(slug) {
  const refs = await listRefs(slug);
  const blocks = [];
  const notes = [];
  for (const r of refs.slice(0, 5)) {
    try {
      if (r.type === 'url') {
        const { jpg, facts } = await captureUrl(r.value);
        blocks.push({ type: 'text', text: `Reference ${blocks.filter((b) => b.type === 'image').length + 1}: ${r.value}${r.note ? ` (user note: ${r.note})` : ''}. Its CSS: ${JSON.stringify(facts)}` });
        blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpg.toString('base64') } });
      } else {
        const jpg = await fs.readFile(path.join(refsDir(slug), r.value));
        const small = await sharp(jpg).resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
        blocks.push({ type: 'text', text: `Reference ${blocks.filter((b) => b.type === 'image').length + 1}: uploaded image "${r.name}"${r.note ? ` (user note: ${r.note})` : ''}` });
        blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: small.toString('base64') } });
      }
    } catch (e) { notes.push(`Could not read reference ${r.value}: ${e.message}`); }
  }
  return { blocks, notes };
}

const fontList = () => Object.entries(FONT_CATALOG).map(([n, f]) => `${n} (${f.kind}, ${f.role.includes('h') ? 'headings' : ''}${f.role.includes('b') ? ' body' : ''})`).join('; ');
const enumProp = (list) => ({ type: 'string', enum: list.map(String) });
const hex = { type: 'string', description: '#RRGGBB' };

const DESIGN_TOOL = {
  name: 'submit_design',
  description: 'Submit the website design spec.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'A short name for this look, e.g. "Calm coastal".' },
      archetype: { type: 'string', enum: [...ARCHETYPE_NAMES, 'custom'], description: 'The style direction this design starts from. Use custom when none fits.' },
      rationale: { type: 'string', description: '2-4 sentences: how the design reflects the references and the brief.' },
      tokens: {
        type: 'object',
        properties: {
          primary: hex, primaryDark: { ...hex, description: 'darker shade of primary, for dark bands and hero' }, accent: { ...hex, description: 'call-to-action colour' },
          ink: { ...hex, description: 'main text colour, dark' }, soft: { ...hex, description: 'very light tint for alternate sections' },
          fontHeading: enumProp(Object.keys(FONT_CATALOG)), fontBody: enumProp(Object.keys(FONT_CATALOG)),
          headingCase: enumProp(OPTIONS.headingCase), headingWeight: enumProp(OPTIONS.headingWeight), radius: enumProp(OPTIONS.radius),
          shadow: enumProp(OPTIONS.shadow), density: enumProp(OPTIONS.density), container: enumProp(OPTIONS.container),
        },
      },
      layout: {
        type: 'object',
        properties: {
          header: enumProp(OPTIONS.header), topbar: { type: 'boolean' }, hero: enumProp(OPTIONS.hero), sections: enumProp(OPTIONS.sections), cards: enumProp(OPTIONS.cards),
          cardLayout: enumProp(OPTIONS.cardLayout), sectionHead: enumProp(OPTIONS.sectionHead), innerSidebar: enumProp(OPTIONS.innerSidebar), footer: enumProp(OPTIONS.footer), contactLayout: enumProp(OPTIONS.contactLayout), innerForm: enumProp(OPTIONS.innerForm), homeStyle: enumProp(OPTIONS.homeStyle),
        },
      },
      extras: {
        type: 'object',
        description: 'Add-ons the layout options cannot express. Only include a key when the user asked for it; keys you leave out are kept as they are.',
        properties: {
          heroImage: { type: 'object', description: 'Photo for the photographic hero (layout.hero = photo). src must come from the IMAGES ON THE ORIGINAL PAGE list and be large enough (about 1200px wide or more) to fill a full-width banner.', properties: { src: { type: 'string' }, alt: { type: 'string' } } },
          backToTop: { type: 'object', properties: { icon: { type: 'string', description: 'Image on the website itself, as a path like /images/top_arrow.svg or an https URL on the same domain. Empty string = the built-in arrow.' } } },
          floating: { type: 'object', description: 'Buttons fixed to the side edge of the screen (e.g. Financing, Schedule, Contact).', properties: { side: { type: 'string', enum: ['left', 'right'] }, items: { type: 'array', maxItems: 4, items: { type: 'object', properties: { label: { type: 'string', description: 'max 24 characters' }, href: { type: 'string', description: 'site path like /contact.html, an https URL, tel: or mailto:' } }, required: ['label', 'href'] } } } },
          headerButtons: { type: 'array', maxItems: 3, description: 'Extra call-to-action buttons in the header.', items: { type: 'object', properties: { label: { type: 'string' }, href: { type: 'string' } }, required: ['label', 'href'] } },
        },
      },
      sections: {
        type: 'array', maxItems: 24,
        description: 'Per-section layout changes, for things CSS alone cannot do: put an image beside a section\'s text, set the text in 2 or 3 columns, change a section\'s background, centre its text. index is the section number from the PAGE OUTLINE of that layout. Always return the COMPLETE list, keeping existing entries unless the request replaces them.',
        items: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: ['home', 'inner', 'contact', 'all'] },
            index: { type: 'integer', description: 'Section number (1 = first section in main).' },
            heading: { type: 'string', description: 'Optional: part of the section heading, used if the number is not known.' },
            columns: { type: 'integer', enum: [1, 2, 3], description: 'Text columns for the section content.' },
            image: { type: 'object', description: 'An image shown beside the text. src must come from the IMAGES ON THE ORIGINAL PAGE list.', properties: { src: { type: 'string' }, alt: { type: 'string', description: 'Describe what the image shows.' }, side: { type: 'string', enum: ['left', 'right'] }, width: { type: 'string', enum: ['third', 'half'] } }, required: ['src', 'alt'] },
            background: { type: 'string', enum: ['white', 'soft', 'dark', 'brand'] },
            align: { type: 'string', enum: ['left', 'center'] },
          },
          required: ['layout', 'index'],
        },
      },
      tweaks: {
        type: 'array', maxItems: 40,
        description: 'PREFERRED way to restyle one part of the page: Tailwind CSS utility classes added to (and old ones removed from) the elements matched by a CSS selector. Always return the COMPLETE list, keeping existing entries unless the request replaces them.',
        items: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: ['home', 'inner', 'contact', 'all'], description: 'The kind of page the tweak applies to. Use the selector given for the selected area.' },
            selector: { type: 'string', description: 'CSS selector, e.g. the one given for the SELECTED AREA, or "header", "footer", ".btn-accent".' },
            add: { type: 'array', items: { type: 'string' }, description: 'Tailwind utility classes to add, e.g. "py-20", "lg:grid-cols-3", "bg-brand-dark!", "text-on-dark", "rounded-3xl", "bg-[#e8eef3]". A trailing ! makes the class win over one the element already has.' },
            remove: { type: 'array', items: { type: 'string' }, description: 'Classes currently on the element that the new classes replace (look at the element html you were given).' },
          },
          required: ['layout', 'selector', 'add'],
        },
      },
      changes: { type: 'array', items: { type: 'string' }, description: 'One short line per change you made for this request, in plain words.' },
      unsupported: { type: 'array', items: { type: 'string' }, description: 'Anything the user asked for that the design options cannot do. Never leave a request unanswered: either make the change or list it here.' },
      customCss: { type: 'string', description: 'LAST RESORT, only for what Tailwind utility classes cannot express (pseudo-elements, keyframes, complex selectors). Optional, max 4000 chars. Always return ALL existing rules plus your changes, only to fine-tune what the options cannot express. Use the classes .hero, .card, .btn, .btn-accent, .section-title, .prose-content and CSS variables like var(--brand-primary). No @import, no remote URLs.' },
    },
    required: ['name', 'rationale', 'tokens', 'layout'],
  },
};

const SYSTEM = `You are a senior art director and web designer who designs high-converting small-business websites. The renderer supports a fixed set of design options; you choose among them deliberately, and may add a little custom CSS. Work like an expert, not a template filler.

DESIGN PRINCIPLES
- Hierarchy first: one clear focal point per screen. The hero states what the business does and gives one obvious action. Section headings are clearly larger than body text, and body text is comfortable to read.
- Restraint: a limited palette (primary, one accent, neutrals), one or two typefaces, consistent spacing. No decoration without a reason. Do not stack effects.
- Rhythm: alternate section backgrounds and layouts so the page does not look like one repeated block. Use whitespace generously; dense text blocks belong in narrower columns.
- Imagery: real photos carry credibility. Use a photographic hero only if the site has a large enough image (it must be listed); otherwise use a strong typographic hero. Never stretch small images; icon cards are better than tiny thumbnails.
- Contrast and accessibility: ink must be dark, soft a very light tint, primaryDark clearly darker than primary. White text sits on primary/primaryDark; ink text on soft/white. The accent colour is for calls to action only.
- Each business gets its own identity. Pick the style direction that fits what the business really is, then adapt colours, type and shapes to its brand. Two contractors should not look alike.
- Respect the brand: keep the logo colours unless the brief says otherwise. Never invent claims, awards, reviews or statistics.
- Fonts come only from the provided list. Pair a distinctive heading font with a readable body font, or use one family for both.
- If the user gave references, borrow their mood, density, colour feel and structure, not their branding or text. The user's brief overrides everything above.

OPTIONS AT YOUR DISPOSAL
- Besides the option lists you can set extras (heroImage, back-to-top icon, floating side buttons, extra header buttons), sections (an image beside one section's text, text columns, background, alignment) and customCss for small visual tweaks. Use them when a request needs them. Use only links that appear in the SITE LINKS list or that the user gave; never invent a URL.
- Use the sections field for structural changes to one section. Take images only from the IMAGES ON THE ORIGINAL PAGE list and describe them in alt. Only say something is unsupported if neither options, extras, sections nor customCss can do it.
- STYLE PRIORITY. To restyle a specific part of the page: (1) use the design options and tokens if one fits; (2) otherwise use tweaks, which add Tailwind utility classes to the element (spacing p-*/m-*/gap-*, grid-cols-*, text-*, font-*, bg-*, border, rounded-*, shadow-*, w-*/max-w-*, flex/items/justify, hidden and lg:block, with responsive prefixes md:/lg: and state prefixes hover:/focus:, plus arbitrary values such as bg-[#e8eef3]). The site colours are available as utilities: bg-brand, bg-brand-dark, bg-accent, bg-soft, text-ink, text-brand-text, text-accent-text, font-display, rounded-card, shadow-card. When the element already carries a conflicting class (you can see its classes in the element html), list that class in remove, or add your class with a trailing ! (for example bg-soft!). (3) Use customCss ONLY when Tailwind utilities cannot do it, and then say in changes why a utility was not possible.
- Always fill changes (what you changed) and unsupported (what you could not do). Do not return the design unchanged without saying why.
Respond by calling the tool once.`;

function applyAiSpec(slug, current, ai, note, brief, { preset = false, fresh = false } = {}) {
  const arche = preset && ARCHETYPES[ai.archetype] ? ARCHETYPES[ai.archetype] : null;
  const patch = { name: ai.name, archetype: ai.archetype === 'custom' ? '' : ai.archetype || current.archetype, ...(brief !== undefined ? { brief } : {}), tokens: { ...(arche?.tokens || {}), ...(ai.tokens || {}) }, layout: { ...(arche?.layout || {}), ...(ai.layout || {}) }, ...(ai.extras ? { extras: ai.extras } : {}), ...(Array.isArray(ai.sections) ? { sections: ai.sections } : {}), ...(Array.isArray(ai.tweaks) ? { tweaks: ai.tweaks } : {}), customCss: ai.customCss ?? current.customCss };
  if (patch.tokens.headingWeight !== undefined) patch.tokens.headingWeight = Number(patch.tokens.headingWeight);
  return saveDraft(slug, patch, { note, fresh });
}

// fresh = a new design that ignores the current one (it stays in the version list); otherwise the current design is the starting point.
export async function designFromBrief(slug, { brief = '', archetype = '', fresh = false } = {}) {
  const opts = { archetype };
  let { spec: current } = await loadActive(slug);
  if (fresh) current = { ...current, customCss: '', extras: DEFAULT_SPEC.extras, sections: [], layout: DEFAULT_SPEC.layout, archetype: '' };
  const profile = await getProfile(slug);
  const { blocks, notes } = await referenceBlocks(slug);
  const text = [
    `Business: ${profile.nap.name || ''} - ${profile.industry || 'unknown industry'}. ${profile.summary || ''}`,
    profile.tone ? `Tone: ${profile.tone}` : '',
    `Current colours (from the logo or the previous design): ${JSON.stringify({ primary: current.tokens.primary, accent: current.tokens.accent })}. Keep them unless the brief or references say otherwise, since they match the logo.`,
    `Fonts you may use: ${fontList()}`,
    `STYLE DIRECTIONS (starting points; choose the one that fits this business, or custom):\n${archetypeCatalog()}`,
    `Suggested direction from the industry: ${opts.archetype && ARCHETYPES[opts.archetype] ? opts.archetype : guessArchetype(`${profile.industry} ${profile.summary}`)}. Variety seed: ${seedOf(profile.nap.name || slug)} (use it only to break ties between equally good options, so the result is stable).`,
    await pageImages(slug, current.pages?.home || (await loadClient(slug)).chromePage || 'index.html'),
    `User brief: ${brief || '(none: infer from the references and the business)'}`,
    blocks.length ? 'References follow.' : 'No references were provided.',
  ].filter(Boolean).join('\n');
  const { input, cost } = await callTool({
    slug, label: 'design', system: SYSTEM, userContent: [{ type: 'text', text }, ...blocks], tool: DESIGN_TOOL, maxTokens: 4500,
  });
  const spec = await applyAiSpec(slug, current, input, brief ? `AI design: ${brief.slice(0, 80)}` : 'AI design from references', brief, { preset: true, fresh });
  return { spec, rationale: input.rationale, cost, notes };
}

// Links and buttons the current website already has, so requests like "add the same buttons as the current site" can be answered with real URLs.
async function siteLinks(slug) {
  try {
    const client = await loadClient(slug);
    const html = await readSource(client, client.chromePage || 'index.html');
    const $ = cheerio.load(html);
    const seen = new Set(), out = [];
    $('a[href]').each((_, a) => {
      const text = plain($(a).text()).slice(0, 40);
      let href = $(a).attr('href');
      try { const x = new URL(href, `https://${client.host}/`); if (x.hostname.replace(/^www\./, '') === String(client.host).replace(/^www\./, '')) href = x.pathname; } catch { /* keep as is */ }
      const cls = ($(a).attr('class') || '') + ' ' + ($(a).parent().attr('class') || '');
      const inHead = $(a).closest('header, .main-header, .top-header, .header, nav, .menus').length > 0;
      if (!text || /^(#|javascript:)/i.test(href)) return;
      if (!(inHead || /btn|button|cta|finan|schedule|quote/i.test(cls + text))) return;
      const key = href;
      if (!seen.has(key)) { seen.add(key); out.push(`- "${text}" -> ${href}`); }
    });
    const imgs = [...new Set($('img[src]').map((_, i) => $(i).attr('src')).get().filter((s) => /arrow|top|up\.|chevron|scroll/i.test(s)))].slice(0, 8);
    return `SITE LINKS (from the current website):\n${out.slice(0, 120).join('\n')}${imgs.length ? '\nIMAGES THAT MAY BE ICONS: ' + imgs.join(', ') : ''}`;
  } catch { return ''; }
}

// Images on the original page (with the heading they sit under), so a request like "add the van image" can use the real file.
export async function pageImages(slug, page) {
  try {
    const client = await loadClient(slug);
    const $ = cheerio.load(await readSource(client, page));
    const out = [], seen = new Set();
    let heading = '';
    $('h1,h2,h3,img').each((_, n) => {
      if (n.tagName !== 'img') { heading = plain($(n).text()).slice(0, 60); return; }
      let src = $(n).attr('src') || '';
      try { const x = new URL(src, `https://${client.host}/`); if (x.hostname.replace(/^www\./, '') === String(client.host).replace(/^www\./, '')) src = x.pathname; else return; } catch { return; }
      const w = Number($(n).attr('width')) || 0;
      if (!src || seen.has(src) || /logo|sprite|icon|spacer|pixel|arrow|star|badge|seal/i.test(src) || (w && w < 120)) return;
      seen.add(src);
      out.push(`- ${src} | alt "${plain($(n).attr('alt') || '').slice(0, 80)}" | under heading "${heading}"${w ? ' | width ' + w : ''}`);
    });
    return out.length ? `IMAGES ON THE ORIGINAL PAGE (the only images you may use for sections):\n${out.slice(0, 30).join('\n')}\n\n` : '';
  } catch { return ''; }
}

const flat = (o, p = '') => Object.entries(o || {}).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, JSON.stringify(v)]]));
function specDiff(a, b) {
  const x = Object.fromEntries(flat({ tokens: a.tokens, layout: a.layout, extras: a.extras, sections: a.sections, tweaks: a.tweaks, customCss: a.customCss }));
  const y = Object.fromEntries(flat({ tokens: b.tokens, layout: b.layout, extras: b.extras, sections: b.sections, tweaks: b.tweaks, customCss: b.customCss }));
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => x[k] !== y[k]);
}

const TEXT_EXT = /\.(txt|md|markdown|csv|json|html?|css)$/i;
const docxText = (buf) => {
  const xml = new AdmZip(buf).readAsText('word/document.xml');
  return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
};

// Turns what the user attached in the chat into content blocks: images are shrunk, PDFs go to the model as documents,
// Word and text files become text.
async function attachmentBlocks(list) {
  const blocks = [], notes = [];
  let total = 0;
  for (const a of (Array.isArray(list) ? list : []).slice(0, 5)) {
    try {
      const m = String(a.dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/s);
      if (!m) throw new Error('unreadable');
      const buf = Buffer.from(m[2], 'base64');
      total += buf.length;
      if (buf.length > 9 * 1024 * 1024 || total > 24 * 1024 * 1024) throw new Error('file too large');
      const name = String(a.name || 'file').slice(0, 80);
      const mime = m[1].toLowerCase();
      if (/^image\/(png|jpe?g|webp|gif)$/.test(mime)) {
        const small = await sharp(buf).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
        blocks.push({ type: 'text', text: `Attached image "${name}":` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: small.toString('base64') } });
      } else if (mime === 'application/pdf') {
        blocks.push({ type: 'text', text: `Attached document "${name}" (PDF):` }, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: m[2] } });
      } else if (/\.docx$/i.test(name) || mime.includes('wordprocessingml')) {
        blocks.push({ type: 'text', text: `Attached document "${name}" (Word):\n${docxText(buf).slice(0, 15000)}` });
      } else if (mime.startsWith('text/') || TEXT_EXT.test(name)) {
        blocks.push({ type: 'text', text: `Attached file "${name}":\n${buf.toString('utf8').slice(0, 15000)}` });
      } else notes.push(`${name}: this file type is not supported (use images, PDF, Word or text files)`);
    } catch (e) { notes.push(`${a?.name || 'file'}: ${e.message}`); }
  }
  return { blocks, notes };
}

// Screenshots of the page being discussed, plus close-ups of any area the user pointed at.
async function previewShots(slug, baseUrl, page, targets) {
  const blocks = [], notes = [];
  if (!baseUrl || !page) return { blocks, notes };
  let browser;
  const png = async (buf, width = 1000, maxH = 3600) => {
    const img = sharp(buf).resize({ width, withoutEnlargement: true });
    const meta = await sharp(await img.clone().png().toBuffer()).metadata();
    return (meta.height > maxH ? img.extract({ left: 0, top: 0, width: meta.width, height: maxH }) : img).jpeg({ quality: 72 }).toBuffer();
  };
  const add = async (label, buf, maxH) => { blocks.push({ type: 'text', text: label }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: (await png(buf, 1000, maxH)).toString('base64') } }); };
  try {
    browser = await chromium.launch({ channel: 'msedge' });
    const pg = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const open = async (route) => { await pg.goto(`${baseUrl}/${route}/${slug}/${page}?t=${Date.now()}`, { waitUntil: 'load', timeout: 30000 }); await pg.waitForTimeout(700); };
    await open('draft');
    await add('Screenshot of the CURRENT new design for this page (full page, top part):', await pg.screenshot({ fullPage: true }), 3600);
    for (const t of targets.filter((x) => x.frame !== 'original' && x.selector).slice(0, 2)) {
      try { await add(`Close-up of the area the user selected (${t.label}):`, await pg.locator(t.selector).first().screenshot({ timeout: 4000 }), 1400); } catch { /* element not visible */ }
    }
    // the original page is always included, so "like the original header" can be answered from what it really looks like
    const orig = targets.filter((x) => x.frame === 'original');
    {
      await open('original');
      await add('Screenshot of the ORIGINAL page before modernisation (full page, top part). Words like "original", "old", "current site" or "before" refer to this:', await pg.screenshot({ fullPage: true }), 3600);
      for (const t of orig.slice(0, 2)) {
        try { await add(`Close-up of the selected area on the ORIGINAL page (${t.label}):`, await pg.locator(t.selector).first().screenshot({ timeout: 4000 }), 1400); } catch { /* ignore */ }
      }
    }
  } catch (e) { notes.push('Could not take a screenshot of the preview: ' + e.message); } finally { await browser?.close(); }
  return { blocks, notes };
}

const clip = (v, n) => String(v ?? '').slice(0, n);

export async function refineDesign(slug, instruction, history = [], ctx = {}) {
  const { spec: current } = await loadActive(slug);
  const targets = (Array.isArray(ctx.targets) ? ctx.targets : []).slice(0, 3).map((t) => ({ frame: t.frame === 'original' ? 'original' : 'new', label: clip(t.label, 120), selector: clip(t.selector, 400), tag: clip(t.tag, 20), text: clip(t.text, 200), html: clip(t.html, 1200), style: t.style || {} }));
  const outline = (Array.isArray(ctx.outline) ? ctx.outline : []).slice(0, 40).map((o) => clip(o, 160));
  const att = await attachmentBlocks(ctx.attachments);
  // the page being discussed; when that layout has no page chosen, use any page that is previewed
  if (!ctx.page) {
    const st = await readJson(path.join(clientDir(slug), 'template', 'preview-state.json'), null);
    ctx = { ...ctx, page: Object.values(st?.pages || {}).find(Boolean) || '', layout: Object.entries(st?.pages || {}).find(([, v]) => v)?.[0] || ctx.layout };
  }
  const shots = await previewShots(slug, ctx.baseUrl, clip(ctx.page, 300).replace(/\.\./g, ''), targets);

  const convo = history.length ? 'Conversation so far (for context, e.g. "make it bigger" refers to the last change):\n' + history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${clip(m.text, 300)}`).join('\n') + '\n\n' : '';
  const where = ctx.page ? `The user is looking at the "${ctx.layout || 'inner'}" layout, previewed on the page ${ctx.page}.\n` : '';
  const outlineText = outline.length ? `PAGE OUTLINE (top to bottom; the numbers are the section numbers the user sees on the page):\n${outline.join('\n')}\n\n` : '';
  const origOutline = (Array.isArray(ctx.originalOutline) ? ctx.originalOutline : []).slice(0, 40).map((o) => clip(o, 160));
  const origText = origOutline.length ? `ORIGINAL PAGE OUTLINE (how the original page, before modernisation, is laid out top to bottom; "the original" always means this page):\n${origOutline.join('\n')}\n\n` : '';
  const targetText = targets.length
    ? 'SELECTED AREA (the user clicked this, so it is exactly what they mean by "this", "here" or "it"):\n' + targets.map((t, i) => `${i + 1}. [${t.frame === 'original' ? 'ORIGINAL page' : 'NEW design'}] ${t.label} | <${t.tag}> | CSS selector: ${t.selector || '(none)'} | text: "${t.text}" | style: ${JSON.stringify(t.style)}\n   html: ${t.html}`).join('\n') + '\n\n'
    : '';
  const text = `Current design spec:\n${JSON.stringify({ name: current.name, tokens: current.tokens, layout: current.layout, extras: current.extras, sections: current.sections, tweaks: current.tweaks, customCss: current.customCss })}\n\nFonts you may use: ${fontList()}\n\n${await siteLinks(slug)}\n\n${where}${outlineText}${origText}${ctx.page ? await pageImages(slug, clip(ctx.page, 300)) : ''}${targetText}${convo}Change request from the user: ${instruction || '(no text: follow the attached file(s))'}\n\nHow to apply it:\n- Resolve which part of the page is meant from the SELECTED AREA first, then the section numbers/headings in the PAGE OUTLINE, then the screenshots. If you are not sure which part is meant, change nothing and ask one short question in rationale.\n- Site-wide looks use tokens and layout options. For a tweak to one specific area, add CSS rules to customCss using the selector given for that area (selectors beginning body[data-layout=...] affect only that kind of page). Keep every existing customCss rule unless the request replaces it.\n- When the user compares with the original ("like the original", "same as before"), study the ORIGINAL screenshot and outline and reproduce that look as closely as the options, extras and customCss allow. Keep the new template's own content and structure; copy the original's look, not its code.\n- Return the complete updated spec. Change only what the request implies. Fill changes and unsupported. In rationale reply to the user directly in one or two friendly sentences saying what you did.`;

  const userContent = [{ type: 'text', text }, ...att.blocks, ...shots.blocks];
  let { input, cost } = await callTool({ slug, label: 'design-refine', system: SYSTEM, userContent, tool: DESIGN_TOOL, maxTokens: 5000 });
  const droppedClasses = [];
  const used = (inp) => normalizeTweaks(inp.tweaks).flatMap((t) => [...t.add]);
  let bad = await missingTailwindClasses(used(input)).catch(() => []);
  if (bad.length) {
    // one repair round: the classes that give no CSS must be replaced, or Tailwind cannot do it and custom CSS is allowed
    const again = await callTool({
      slug, label: 'design-refine-classes', system: SYSTEM, tool: DESIGN_TOOL, maxTokens: 5000,
      userContent: [...userContent, { type: 'text', text: `YOUR PREVIOUS ANSWER:\n${JSON.stringify(input)}\n\nThese Tailwind classes do not exist or produce no CSS, so they would do nothing: ${bad.join(', ')}.\nReturn the complete answer again. Replace each one with a valid Tailwind utility (check the spelling and the theme colour names). Only if Tailwind genuinely cannot do it, express it in customCss and say so in changes.` }],
    });
    input = again.input; cost = (cost || 0) + (again.cost || 0);
    bad = await missingTailwindClasses(used(input)).catch(() => []);
  }
  if (bad.length) {
    // still not valid: leave those classes out rather than saving something that silently does nothing
    const set = new Set(bad);
    input.tweaks = normalizeTweaks(input.tweaks).map((t) => ({ ...t, add: t.add.filter((c) => !set.has(c)) })).filter((t) => t.add.length || t.remove.length);
    droppedClasses.push(...bad);
  }
  const before = current;
  let spec = await applyAiSpec(slug, current, input, `AI refine: ${(instruction || 'attached file').slice(0, 80)}`);
  let changed = specDiff(before, spec);
  if (!changed.length && instruction && (input.unsupported?.length || !(input.changes || []).length)) {
    // The model gave up or changed nothing. Almost every visual request can be done with Tailwind tweaks or scoped custom CSS, so ask once more.
    const retry = await callTool({
      slug, label: 'design-refine-retry', system: SYSTEM, tool: DESIGN_TOOL, maxTokens: 5000,
      userContent: [...userContent, { type: 'text', text: `YOUR PREVIOUS ANSWER changed nothing${input.unsupported?.length ? ` and said these could not be done: ${input.unsupported.join('; ')}` : ''}.\nThat is almost never true. Almost any visual or layout request can be done with the options, Tailwind class tweaks, section changes or customCss, aimed with the selectors from the SELECTED AREA, the page outline and the screenshots. Do it now: return the complete updated spec with a real change. Only if the request is truly impossible (new content that does not exist on the site) or you cannot tell which part is meant, keep the design and say exactly why in unsupported.` }],
    });
    cost = (cost || 0) + (retry.cost || 0);
    const bad2 = await missingTailwindClasses(used(retry.input)).catch(() => []);
    if (bad2.length) { const set = new Set(bad2); retry.input.tweaks = normalizeTweaks(retry.input.tweaks).map((t) => ({ ...t, add: t.add.filter((c) => !set.has(c)) })).filter((t) => t.add.length || t.remove.length); droppedClasses.push(...bad2); }
    const spec2 = await applyAiSpec(slug, current, retry.input, `AI refine: ${(instruction || 'attached file').slice(0, 80)}`);
    const changed2 = specDiff(before, spec2);
    if (changed2.length) { spec = spec2; changed = changed2; input = retry.input; }
    else if (retry.input.unsupported?.length) input = { ...input, unsupported: retry.input.unsupported, rationale: retry.input.rationale || input.rationale };
  }
  const unsupported = [...(input.unsupported || []), ...att.notes, ...(droppedClasses.length ? [`These Tailwind classes were not valid and were left out: ${droppedClasses.join(', ')}`] : [])];
  return { spec, rationale: input.rationale, changes: input.changes || [], unsupported, changed, unchanged: !changed.length, cost, notes: shots.notes };
}


// Used by the "Expert review" button: the assistant critiques screenshots of its own design and fixes what matters most.
export const EXPERT_REVIEW = `Act as a senior art director reviewing this website design like a client who expects agency-level quality. Look critically at the screenshots of the current design (and the original for reference). Judge: first-impression and hero strength, visual hierarchy, typography scale and pairing, spacing and rhythm between sections, colour balance and contrast, how images and icons are used, card and button consistency, and whether the page feels specific to this business rather than generic. Pick the 4 to 6 changes that would improve the design most, and make them now using the available options, extras, sections and customCss. Do not change the brand colours or invent content. In rationale, state in plain words what you judged weakest and what you fixed.`;
