import fs from 'node:fs/promises';
import { loadScope, inScopePage } from '../scope.js';
import { APP } from '../app-settings.js';
import { readSource } from '../util/source.js';
import path from 'node:path';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { readHtml, plain } from '../util/html.js';
import { extractModel } from '../build/model.js';
import { loadGraph } from '../build/graph.js';
import { getProfile, profileToPrompt } from '../profile/store.js';
import { callTool, modelId, estimateCost } from '../ai/claude.js';
import { optionsOf } from '../options.js';
import { shingleSimilarity } from '../scanner/audit.js';
import { validateContent, normalizeContent, contentText, WORD_TARGETS } from './validate.js';
import { aiTypes, aiLevel } from '../scanner/page-types.js';
import { SEO } from '../rules.js';
import { collectUnits, checkChange, sanitizeUnit, similarity } from './units.js';

export const BUILD_TYPES = aiTypes();
// a kind whose own words are improved but never written again from nothing (a blog post, a product) is held to 'enhance'
const capMode = (mode, type) => (aiLevel(type) === 'enhance' && mode === 'rewrite' ? 'enhance' : mode);
const TITLE_TXT = `${SEO.title.max - 15}-${SEO.title.max}`, META_TXT = `${SEO.description.min + 10}-${SEO.description.max - 2}`;
const contentFile = (slug, rel) => path.join(clientDir(slug), 'content', rel.replace(/\.html?$/i, '') + '.json');

export async function loadContent(slug, rel) {
  return readJson(contentFile(slug, rel), null);
}
export async function saveContent(slug, rec) {
  await writeJson(contentFile(slug, rec.path), rec);
  return rec;
}
export async function listContent(slug) {
  const dir = path.join(clientDir(slug), 'content');
  const out = [];
  const walk = async (d) => {
    for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.json')) out.push(await readJson(p));
    }
  };
  await walk(dir);
  return out.filter(Boolean);
}

// ---------- planning ----------
// The user picks one content mode for the site: 'existing' (no AI), 'enhance' (default) or 'rewrite'.
const settingsFile = (slug) => path.join(clientDir(slug), 'build-settings.json');
export const CONTENT_MODES = ['existing', 'enhance', 'rewrite'];
// the other choices of a run (Content & build): true/false switches, which pages get new titles, and the pages to leave out
export const SWITCHES = { cleanUrls: false, fixLinks: true, headBatch: false, rewriteH1: false, brandInTitles: true, socialTags: true, schema: true, aiAlt: false, protectScore: true, reviewWording: false, autoAudit: true, skipNoindex: true, skipErrorPages: true, skipRedirected: true };
export async function loadBuildSettings(slug) {
  return { contentMode: 'enhance', scope: 'all', headScope: 'failing', excludePatterns: '', ...SWITCHES, ...(await readJson(settingsFile(slug), {})) };
}
export async function saveBuildSettings(slug, input) {
  const s = await loadBuildSettings(slug);
  if (input.contentMode !== undefined) { if (!CONTENT_MODES.includes(input.contentMode)) throw new Error('Unknown content mode'); s.contentMode = input.contentMode; }
  if (input.scope !== undefined) s.scope = input.scope === 'flagged' ? 'flagged' : 'all';
  for (const k of Object.keys(SWITCHES)) if (input[k] !== undefined) s[k] = Boolean(input[k]);
  if (input.headScope !== undefined) s.headScope = input.headScope === 'all' ? 'all' : 'failing';
  if (input.excludePatterns !== undefined) s.excludePatterns = String(input.excludePatterns).split('\n').map((x) => x.trim()).filter(Boolean).join('\n');
  await writeJson(settingsFile(slug), s);
  return s;
}

export async function planPages(slug) {
  const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const settings = await loadBuildSettings(slug);
  const existing = Object.fromEntries((await listContent(slug)).map((c) => [c.path, c]));
  // a website that keeps its design has its wording changed in place, home page included, in both modes
  const inPlace = !optionsOf(await loadClient(slug)).template;
  const types = settings.contentMode === 'rewrite' && !inPlace ? BUILD_TYPES : [...BUILD_TYPES, 'home'];
  const scope = await loadScope(slug);
  return scan
    .filter((p) => types.includes(p.type) && /\.(html?|php)$/i.test(p.path) && inScopePage(scope, p))
    .map((p) => {
      const codes = p.issues.map((i) => i.code);
      const flagged = codes.includes('duplicate-content') || codes.includes('thin-content');
      const inScope = settings.contentMode !== 'existing' && (settings.scope === 'all' || flagged);
      return {
        path: p.path, type: p.type, words: p.wordCount, h1: p.h1[0] || '',
        mode: inScope ? capMode(settings.contentMode, p.type) : 'existing', flagged,
        reason: flagged ? (codes.includes('duplicate-content') ? 'near-duplicate copy' : 'thin copy') : 'copy is usable',
        status: existing[p.path]?.status || 'none',
      };
    });
}

// ---------- context ----------
function sourceText(model, cap = 7000) {
  const parts = [];
  for (const b of model.blocks) {
    if (b.t === 'h') parts.push(`\n## ${b.text}`);
    else if (b.t === 'html') parts.push(plain(b.html));
    else if (b.t === 'callout') parts.push([b.title, b.text].filter(Boolean).join(': '));
    else if (b.t === 'faq') parts.push(b.items.map((f) => `Q: ${f.q} A: ${plain(f.a)}`).join('\n'));
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, cap);
}

function imagesWithContext(model) {
  const out = [];
  let heading = '';
  for (const b of model.blocks) {
    if (b.t === 'h') heading = b.text;
    if (b.t === 'img' && !/\.svg(\?|$)/i.test(b.src)) out.push({ src: b.src, currentAlt: b.alt || '', nearHeading: heading, file: b.src.split('/').pop() });
  }
  return out;
}

const countyName = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') + ' County';

async function buildContext(slug, client, rel, type, profile, graph) {
  const model = extractModel(await readSource(client, rel), rel);
  if (!model.ok) throw new Error('Unrecognised page layout');
  const ctx = { model, h1: model.hero.h1, type, images: imagesWithContext(model), source: sourceText(model), place: null, reference: '', avoidHeadings: [] };

  const combo = graph.combos.find((c) => c.path === rel);
  if (combo) {
    const city = graph.cities[combo.city];
    ctx.place = { city: city.name, county: countyName(city.county), service: combo.service ? graph.labels[combo.service] : combo.rest.replace(/-/g, ' ') };
    if (combo.service) {
      const svc = extractModel(await readSource(client, combo.service), combo.service);
      if (svc.ok) ctx.reference = sourceText(svc, 3500);
    }
    const sibs = graph.combos.filter((c) => c.path !== rel && (c.city === combo.city || (c.service && c.service === combo.service))).slice(0, 12);
    for (const s of sibs) {
      const rec = await loadContent(slug, s.path);
      if (rec?.content) ctx.avoidHeadings.push(...[rec.content.lead?.heading, ...(rec.content.sections || []).map((x) => x.heading)].filter(Boolean));
    }
    ctx.avoidHeadings = [...new Set(ctx.avoidHeadings)].slice(0, 30);
    const notes = (profile.localNotes || []).filter((n) => n.toLowerCase().startsWith(city.name.toLowerCase() + ':')).map((n) => n.slice(city.name.length + 1).trim());
    ctx.localNotes = notes;
  }
  return ctx;
}

// ---------- prompts ----------
const SYSTEM_RULES = `You are a senior local-SEO copywriter producing website copy for ONE real business. Your copy goes live under the business's name, so accuracy matters more than flair.

TRUTH RULES (a violation makes the page unusable)
- Use ONLY facts found in the BUSINESS PROFILE or the SOURCE CONTENT provided. Never invent or imply: years in business, awards, certifications, ratings, guarantees, response times, counts, prices, discounts, promotions or specials.
- Claims such as "24/7", "same-day", "licensed", "insured", "free estimate", "family-owned", "guarantee" may be used ONLY if the BUSINESS PROFILE's approved facts say so. When unsure, leave the claim out.
- Never mention or hint at any service listed under "DO NOT OFFER".
- Do not state facts about a city (landmarks, neighbourhoods, population, climate, housing age, water quality) unless they appear in LOCAL NOTES. Use the city and county names only as places the business serves.
- General, accurate knowledge of the business's own field is fine (how a service works, warning signs, what to expect). Do not overpromise outcomes.

QUALITY RULES
- Preserve what is valuable: keep the page's main keyword and its accurate points from SOURCE CONTENT, but rewrite them in fresh, natural wording.
- The main keyword is the H1. Use it in the title, once in the opening paragraph, and at most twice more in the body. Prefer natural variations. No keyword stuffing.
- Every heading must be distinct. Avoid sentence-opening repetition. Plain, friendly language at about an 8th-grade level. Active voice. Concrete detail over adjectives.
- The title must not contain a brand name or abbreviation (the template adds branding). Never shorten or invent a name for the business.
- Plain text only: no HTML, markdown, links, URLs, phone numbers, addresses or emoji. The page template adds contact details and buttons.
- Be genuinely different from other pages for nearby cities and related services: choose a different angle, order and examples, and do not reuse the headings listed under AVOID HEADINGS.

Respond by calling the provided tool exactly once.`;

const str = { type: 'string' };
const arr = (items) => ({ type: 'array', items });
const ALT = { type: 'object', properties: { src: str, alt: str }, required: ['src', 'alt'] };
const BASE_PROPS = {
  title: { type: 'string', description: `SEO title, ${TITLE_TXT} characters, starts with the main keyword.` },
  metaDescription: { type: 'string', description: `${META_TXT} characters, plain sentence with the main keyword and a soft call to action.` },
  imageAlts: { type: 'array', items: ALT, description: 'One entry for every image listed. Alt text under 110 characters describing the subject; no "image of"; no keyword stuffing; do not claim details you cannot know.' },
  reviewNotes: { type: 'array', items: str, description: 'Anything a human should double-check.' },
};
const OPTIMIZE_TOOL = { name: 'submit_page_metadata', description: 'Submit optimised metadata for the page.', input_schema: { type: 'object', properties: BASE_PROPS, required: ['title', 'metaDescription', 'imageAlts'] } };
const REWRITE_TOOL = {
  name: 'submit_page_content',
  description: 'Submit the rewritten page content.',
  input_schema: {
    type: 'object',
    properties: {
      ...BASE_PROPS,
      lead: { type: 'object', description: 'Opening block shown beside the quote form.', properties: { heading: str, paragraphs: arr(str) }, required: ['heading', 'paragraphs'] },
      sections: { type: 'array', description: '3-6 body sections.', items: { type: 'object', properties: { heading: str, paragraphs: arr(str), bullets: arr(str) }, required: ['heading', 'paragraphs'] } },
      faq: { type: 'array', description: '3-5 questions customers genuinely ask. Answers 25-70 words.', items: { type: 'object', properties: { q: str, a: str }, required: ['q', 'a'] } },
      ctaTitle: { type: 'string', description: 'Short closing headline, max 8 words.' },
      ctaText: { type: 'string', description: 'One or two closing sentences.' },
    },
    required: ['title', 'metaDescription', 'imageAlts', 'lead', 'sections', 'faq', 'ctaTitle', 'ctaText'],
  },
};

function userPrompt(ctx, mode, note) {
  const [lo, hi] = WORD_TARGETS[ctx.type] || WORD_TARGETS.default;
  const lines = [
    `PAGE TYPE: ${ctx.type}`,
    `H1 / MAIN KEYWORD: ${ctx.h1}`,
    ctx.place && `PLACE: ${ctx.place.city}, ${ctx.place.county}. Service focus: ${ctx.place.service}.`,
    ctx.localNotes?.length ? `LOCAL NOTES (the only city facts you may use):\n- ${ctx.localNotes.join('\n- ')}` : ctx.place ? 'LOCAL NOTES: none provided, so write no city-specific facts.' : '',
    mode === 'rewrite' ? `TARGET LENGTH: ${lo}-${hi} words in total across lead, sections and FAQ.` : 'TASK: keep the page body as it is. Only write the title, meta description and image alt text.',
    ctx.images.length ? `IMAGES (write alt text for each):\n${ctx.images.map((i) => `- src=${i.src} | file=${i.file} | under heading "${i.nearHeading}" | current alt "${i.currentAlt}"`).join('\n')}` : 'IMAGES: none.',
    `SOURCE CONTENT (current page copy; reuse accurate points, never copy sentences verbatim, and ignore any claim that is not in the business profile):\n${ctx.source}`,
    mode === 'rewrite' && ctx.reference ? `REFERENCE: the main service page for this topic, for accurate service detail:\n${ctx.reference}` : '',
    mode === 'rewrite' && ctx.avoidHeadings.length ? `AVOID HEADINGS (already used on sibling pages):\n- ${ctx.avoidHeadings.join('\n- ')}` : '',
    ctx.goals,
    note && `REVIEWER NOTE (follow this): ${note}`,
  ];
  return lines.filter(Boolean).join('\n\n');
}

// ---------- generation ----------
export async function generatePage(slug, rel, { mode, note, profile, graph, force } = {}) {
  const client = await loadClient(slug);
  profile ||= await getProfile(slug);
  graph ||= await loadGraph(slug);
  const prev = await loadContent(slug, rel);
  if (prev?.status === 'approved' && !force) return prev;

  const plan = (await planPages(slug)).find((p) => p.path === rel);
  if (!plan) throw new Error(`Not a buildable page: ${rel}`);
  mode ||= plan.mode;
  mode = capMode(mode, plan.type);
  if (mode === 'existing') throw new Error('This page uses its existing content; nothing to generate');
  // no new design: the same words-only pipeline for both modes (Re-write is bolder, the structure stays)
  if (!optionsOf(client).template && (mode === 'enhance' || mode === 'rewrite')) return enhancePage(slug, rel, { client, profile, plan, note, strength: mode });
  if (mode === 'enhance') return enhancePage(slug, rel, { client, profile, plan, note, strength: 'enhance' });

  const ctx = await buildContext(slug, client, rel, plan.type, profile, graph);
  ctx.goals = await auditGoals(slug, rel);
  const system = `${SYSTEM_RULES}\n\n=== BUSINESS PROFILE ===\n${profileToPrompt(profile)}`;
  const tool = mode === 'rewrite' ? REWRITE_TOOL : OPTIMIZE_TOOL;

  const others = (await listContent(slug)).filter((c) => c.path !== rel && c.mode === 'rewrite' && !c.inPlace && c.content && c.type === plan.type).map((c) => ({ path: c.path, text: contentText(c.content) }));
  const vctx = { mode, type: plan.type, h1: ctx.h1, profile, sourceText: ctx.source, others };

  let cost = 0, model = modelId();
  let r = await callTool({ slug, label: mode, system, user: userPrompt(ctx, mode, note), tool, maxTokens: mode === 'rewrite' ? 9000 : 2500 });
  cost += r.cost || 0;
  let content = normalizeContent(r.input);
  let issues = validateContent(content, vctx);
  let attempts = 1;

  if (issues.some((i) => i.level === 'fail')) {
    const fixes = issues.filter((i) => i.level === 'fail').map((i) => `- ${i.msg}`).join('\n');
    r = await callTool({
      slug, label: 'repair', system,
      user: `${userPrompt(ctx, mode, note)}\n\nYOUR PREVIOUS ANSWER:\n${JSON.stringify(content)}\n\nIt failed these automatic checks. Fix every one, change nothing else that was fine, and call the tool again with the full corrected answer:\n${fixes}`,
      tool, maxTokens: mode === 'rewrite' ? 9000 : 2500,
    });
    cost += r.cost || 0;
    content = normalizeContent(r.input);
    issues = validateContent(content, vctx);
    attempts = 2;
  }

  const rec = {
    path: rel, type: plan.type, mode, status: issues.some((i) => i.level === 'fail') ? 'needs-review' : 'generated',
    createdAt: new Date().toISOString(), model: r.model || model, attempts, cost: +cost.toFixed(5), note: note || '',
    source: { title: (await readJson(path.join(clientDir(slug), 'scan/pages.json'), [])).find((p) => p.path === rel)?.title, words: plan.words },
    content, issues,
  };
  return saveContent(slug, rec);
}

// ---------- batch runs ----------
const jobs = new Map();
export const jobStatus = (slug) => jobs.get(slug) || null;

export async function estimate(slug, paths) {
  const plan = (await planPages(slug)).filter((p) => !paths || paths.includes(p.path));
  const model = modelId();
  let inTok = 0, outTok = 0;
  for (const p of plan) {
    const profileTok = 1500;
    if (p.mode === 'rewrite') { inTok += profileTok + 3200 + Math.min(p.words, 1800) * 1.4; outTok += 2600; }
    else if (p.mode === 'enhance') { inTok += profileTok + 900 + Math.min(p.words, 2200) * 1.5; outTok += 500 + Math.min(p.words, 2200) * 0.35; }
    else if (p.mode === 'existing') continue;
    else { inTok += profileTok + 700 + Math.min(p.words, 1800) * 1.0; outTok += 450; }
  }
  const retry = 1.15; // ~15% of pages need a repair pass
  const cost = estimateCost(model, inTok * retry, outTok * retry);
  return { pages: plan.filter((p) => p.mode !== 'existing').length, rewrite: plan.filter((p) => p.mode === 'rewrite').length, enhance: plan.filter((p) => p.mode === 'enhance').length, optimize: plan.filter((p) => p.mode === 'optimize').length, model, inputTokens: Math.round(inTok), outputTokens: Math.round(outTok), cost: cost === null ? null : +cost.toFixed(2) };
}

export function startRun(slug, paths, { mode, force, concurrency = APP.limits.concurrency.aiWriting } = {}) {
  if (jobs.get(slug)?.running) throw new Error('A generation run is already in progress');
  const job = { running: true, total: paths.length, done: 0, failed: 0, cost: 0, errors: [], startedAt: new Date().toISOString(), cancel: false };
  jobs.set(slug, job);
  (async () => {
    const profile = await getProfile(slug);
    const graph = await loadGraph(slug);
    const queue = [...paths];
    const worker = async () => {
      while (queue.length && !job.cancel) {
        const rel = queue.shift();
        try {
          const rec = await generatePage(slug, rel, { mode, profile, graph, force });
          job.cost = +(job.cost + (rec.cost || 0)).toFixed(4);
        } catch (e) {
          job.failed += 1;
          job.errors.push({ path: rel, error: e.message });
        }
        job.done += 1;
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    job.running = false;
    job.cancelled = Boolean(job.cancel);
    job.finishedAt = new Date().toISOString();
  })().catch((e) => { job.running = false; job.errors.push({ path: '*', error: e.message }); });
  return job;
}
export const cancelRun = (slug) => { const j = jobs.get(slug); if (j) j.cancel = true; return j; };

export async function setStatus(slug, rel, status, edits) {
  const rec = await loadContent(slug, rel);
  if (!rec) throw new Error('No generated content for that page');
  if (!['approved', 'rejected', 'generated'].includes(status)) throw new Error('Bad status');
  if (status === 'approved' && rec.issues.some((i) => i.level === 'fail')) rec.overridden = true;
  if (edits?.title !== undefined) rec.content.title = String(edits.title).trim();
  if (edits?.metaDescription !== undefined) rec.content.metaDescription = String(edits.metaDescription).trim();
  if (Array.isArray(edits?.keep)) rec.keep = edits.keep.map(String);
  rec.status = status;
  rec.reviewedAt = new Date().toISOString();
  return saveContent(slug, rec);
}

export async function contentOverview(slug) {
  const plan = await planPages(slug);
  const recs = Object.fromEntries((await listContent(slug)).map((c) => [c.path, c]));
  const usage = await readJson(path.join(clientDir(slug), 'usage.json'), { cost: 0, calls: 0 });
  return {
    usage,
    pages: plan.map((p) => {
      const r = recs[p.path];
      return { ...p, genMode: r?.mode, fails: r ? r.issues.filter((i) => i.level === 'fail').length : 0, warns: r ? r.issues.filter((i) => i.level === 'warn').length : 0, cost: r?.cost || 0 };
    }),
  };
}

export async function contentItem(slug, rel) {
  const client = await loadClient(slug);
  const plan = (await planPages(slug)).find((p) => p.path === rel);
  if (!plan) throw new Error('Unknown page');
  const model = extractModel(await readSource(client, rel), rel);
  const lines = [];
  for (const b of model.blocks) {
    if (b.t === 'h') lines.push(['h', b.text]);
    else if (b.t === 'html') lines.push([/^<(ul|ol)/.test(b.html) ? 'p' : 'p', plain(b.html)]);
    else if (b.t === 'callout') lines.push(['p', [b.title, b.text].filter(Boolean).join(': ')]);
  }
  return {
    plan, record: await loadContent(slug, rel),
    original: { title: model.head.title, meta: model.head.description, h1: model.hero.h1, lines: lines.slice(0, 80) },
  };
}

export async function approveMany(slug, paths) {
  for (const p of paths) await setStatus(slug, p, 'approved');
  return { approved: paths.length };
}

// ---------- enhance: fix grammar and clarity, keep everything else ----------
const ENHANCE_SYSTEM = `You are a careful copy editor for a business website. You receive the page's text as numbered units and fix only what is wrong.

WHAT TO FIX: spelling, grammar, punctuation, capitalisation, awkward or unclear phrasing, repeated words, inconsistent tense, and obvious typos. Use US English and a clear, natural tone that matches the original.

HARD RULES
- Keep the meaning, facts, order, keywords, brand and place names, numbers, phone numbers and links exactly. Do not add or remove information. Do not add claims, superlatives, prices, years or guarantees.
- Keep the HTML of "html" and "inner" units exactly as it is: same tags, same <a href> values, same list items. Change only the words inside.
- Do not merge or split units. Keep each unit's length within about -15% to +20%.
- If a unit is already correct, do NOT return it. Return ONLY the units you changed, with their ids.
- Also write the page title (${TITLE_TXT} characters, starting with the main keyword), the meta description (${META_TXT} characters) and alt text for each listed image (under 110 characters, describing the subject, no "image of"). Never include a brand name in the title.
Respond by calling the tool once.`;

// re-write of a page that keeps its design: new wording for each block, the same blocks in the same order
const REWRITE_UNITS_SYSTEM = `You are a senior local-SEO copywriter. You receive the page's text as numbered units and write fresh, clear, engaging wording for them. The page keeps its design: every unit stays the same kind of block in the same place.

WHAT TO DO: re-write each paragraph, list item, heading, FAQ question and answer and card text in your own words: natural, specific, easy to read, US English, varied sentence openings, a friendly professional tone that matches the business. Re-write every unit unless it is already excellent. Make each page read differently from the other pages of the business.

HARD RULES
- Keep the meaning, facts, order, keywords, brand and place names, numbers, phone numbers and links exactly. Do not add information the page or the business profile does not give. Do not add claims, superlatives, prices, years or guarantees.
- Keep the HTML of "html" and "inner" units exactly in shape: the same tags, the same <a href> values, the same number of list items. Change only the words inside.
- Do not merge or split units. Keep each unit's length within about -30% to +40%.
- Return ONLY the units you changed, with their ids.
- Also write the page title (${TITLE_TXT} characters, starting with the main keyword), the meta description (${META_TXT} characters) and alt text for each listed image (under 110 characters, describing the subject, no "image of").
Respond by calling the tool once.`;

const ENHANCE_TOOL = {
  name: 'submit_enhanced_page',
  description: 'Submit only the changed text units and the page metadata.',
  input_schema: {
    type: 'object',
    properties: {
      units: { type: 'array', description: 'Only the units you changed.', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] } },
      title: { type: 'string' }, metaDescription: { type: 'string' },
      imageAlts: { type: 'array', items: { type: 'object', properties: { src: { type: 'string' }, alt: { type: 'string' } }, required: ['src', 'alt'] } },
      reviewNotes: { type: 'array', items: { type: 'string' }, description: 'Anything a human should double-check, e.g. contradictions in the copy.' },
    },
    required: ['units', 'title', 'metaDescription', 'imageAlts'],
  },
};

// the problems the audit found on one page that its wording can fix, as lines for the prompt
const FIXABLE = new Set(['title-missing', 'title-long', 'title-short', 'title-duplicate', 'meta-missing', 'meta-length', 'h1-missing', 'h1-multiple', 'thin-content', 'duplicate-content']);
async function auditGoals(slug, rel) {
  const page = (await readJson(path.join(clientDir(slug), 'scan/pages.json'), [])).find((p) => p.path === rel);
  const goals = (page?.issues || []).filter((i) => FIXABLE.has(i.code)).map((i) => `- ${i.msg}`);
  return goals.length ? `AUDIT FOUND THESE PROBLEMS ON THIS PAGE (fix them with your wording; do not mention them in the copy):\n${goals.join('\n')}` : '';
}

// a page's wording as it will be: its units with the accepted changes applied
const finalText = (model, changes) => {
  const done = new Map((changes || []).map((u) => [u.id, u.after]));
  return collectUnits(model).map((u) => plain(done.get(u.id) ?? u.get())).join(' ');
};
const DUPE_AT = 0.5; // the audit calls pages this alike near-duplicates

async function enhancePage(slug, rel, { client, profile, plan, note, strength = 'enhance' }) {
  const model = extractModel(await readSource(client, rel), rel);
  if (!model.ok) throw new Error('Unrecognised page layout');
  const units = collectUnits(model);
  const byId = new Map(units.map((u) => [u.id, u]));
  const images = imagesWithContext(model);
  // pages the audit found nearly the same as this one: the new wording must read differently from them
  const dupInfo = ((await readJson(path.join(clientDir(slug), 'scan/pages.json'), [])).find((p) => p.path === rel)?.duplicates || []).filter((d) => d.similarity >= DUPE_AT).slice(0, 3);
  const siblings = [];
  for (const d of dupInfo) {
    try {
      const m = extractModel(await readSource(client, d.path), d.path);
      if (m.ok) siblings.push({ path: d.path, audited: d.similarity, model: m, rec: await loadContent(slug, d.path), text: sourceText(m, 1500) });
    } catch { /* a sibling that cannot be read is simply not compared */ }
  }
  const dupe = siblings.length > 0;
  const goals = await auditGoals(slug, rel);
  const user = [
    `PAGE TYPE: ${plan.type}`, `H1 / MAIN KEYWORD: ${model.hero.h1}`,
    images.length ? `IMAGES (write alt text for each):\n${images.map((i) => `- src=${i.src} | file=${i.file} | under heading "${i.nearHeading}" | current alt "${i.currentAlt}"`).join('\n')}` : 'IMAGES: none.',
    `UNITS (id, kind, text). kind "html" = a block with its tags, "inner" = inline html, "text" = plain text:`,
    JSON.stringify(units.map((u) => ({ id: u.id, kind: u.kind, text: u.get() }))),
    goals,
    dupe && `NEAR-DUPLICATE PAGES: the audit found this page nearly the same as the pages below. Write it so it no longer duplicates them: a different angle, a different order of ideas, different examples and different sentence openings, while keeping this page's own subject, place, facts and numbers. Never reuse their phrasing.\n${siblings.map((x) => `--- ${x.path} (${Math.round(x.audited * 100)}% the same)\n${x.text}`).join('\n')}`,
    note && `REVIEWER NOTE (follow this): ${note}`,
  ].filter(Boolean).join('\n\n');

  const rewrite = strength === 'rewrite' || dupe; // a duplicate needs a real re-write, not a copy edit
  const system = `${rewrite ? REWRITE_UNITS_SYSTEM : ENHANCE_SYSTEM}\n\n=== BUSINESS PROFILE (for terminology only; never add claims from it) ===\n${profileToPrompt(profile)}`;
  let r = await callTool({ slug, label: rewrite ? 'rewrite-units' : 'enhance', system, user, tool: ENHANCE_TOOL, maxTokens: rewrite ? 12000 : 8000 });
  let out = r.input;
  let cost = r.cost || 0;

  // the accepted and the rejected edits of one answer
  const sift = (answer) => {
    const changed = [], reverted = [];
    for (const u of Array.isArray(answer.units) ? answer.units : []) {
      const unit = byId.get(String(u?.id));
      if (!unit) continue;
      const before = unit.get();
      const after = sanitizeUnit(unit.kind, String(u.text ?? ''));
      if (after === before || plain(after) === plain(before) && unit.kind === 'text') continue;
      const why = checkChange(unit.kind, before, after, profile, { loose: rewrite });
      if (why) reverted.push({ id: unit.id, kind: unit.kind, before, after, reason: why });
      else changed.push({ id: unit.id, kind: unit.kind, before, after });
    }
    return { changed, reverted };
  };
  // how alike the new wording is to each near-duplicate page (as that page will read too), by the audit's own measure
  const compare = (changes) => {
    const mine = finalText(model, changes);
    return siblings.map((x) => ({ path: x.path, before: x.audited, after: +shingleSimilarity(mine, finalText(x.model, x.rec?.content?.units)).toFixed(2) }));
  };
  let { changed, reverted } = sift(out);
  let dupes = dupe ? compare(changed) : [];
  // still too alike: one more try, told which pages and how much
  if (dupe && dupes.some((d) => d.after >= DUPE_AT)) {
    const again = await callTool({
      slug, label: 'rewrite-duplicate', system, maxTokens: 12000, tool: ENHANCE_TOOL,
      user: `${user}\n\nYOUR PREVIOUS ANSWER:\n${JSON.stringify(out.units || [])}\n\nThe page is still too like ${dupes.filter((d) => d.after >= DUPE_AT).map((d) => `${d.path} (${Math.round(d.after * 100)}% the same)`).join(', ')}. Write it again with clearly different sentences, structure of ideas and examples. Return every unit you change, with its id.`,
    });
    cost += again.cost || 0;
    const second = sift(again.input), secondDupes = compare(second.changed);
    if (Math.max(...secondDupes.map((d) => d.after)) < Math.max(...dupes.map((d) => d.after))) { r = again; out = again.input; ({ changed, reverted } = second); dupes = secondDupes; }
  }

  let meta = normalizeContent({ title: out.title, metaDescription: out.metaDescription, imageAlts: out.imageAlts, reviewNotes: out.reviewNotes });
  const vctx = { mode: 'optimize', type: plan.type, h1: model.hero.h1, profile, sourceText: sourceText(model), others: [] };
  let issues = validateContent(meta, vctx);
  if (issues.some((i) => i.level === 'fail')) {
    const fixes = issues.filter((i) => i.level === 'fail').map((i) => `- ${i.msg}`).join('\n');
    const fix = await callTool({ slug, label: 'enhance-meta', system, tool: ENHANCE_TOOL, maxTokens: 1500, user: `${user.split('UNITS')[0]}\nReturn an empty units list. Your previous metadata failed these checks, fix them:\n${fixes}\nPrevious: ${JSON.stringify({ title: meta.title, metaDescription: meta.metaDescription })}` });
    cost += fix.cost || 0;
    meta = normalizeContent({ title: fix.input.title, metaDescription: fix.input.metaDescription, imageAlts: fix.input.imageAlts?.length ? fix.input.imageAlts : meta.imageAlts, reviewNotes: meta.reviewNotes });
    issues = validateContent(meta, vctx);
  }
  for (const d of dupes) if (d.after >= DUPE_AT) issues.push({ level: 'warn', id: 'still-duplicate', msg: `Still ${Math.round(d.after * 100)}% the same as ${d.path} (was ${Math.round(d.before * 100)}%): edit the wording by hand or add a reviewer note` });
  if (reverted.length && reverted.length > (changed.length + reverted.length) * 0.35) issues.push({ level: 'warn', id: 'edits-rejected', msg: `${reverted.length} of ${changed.length + reverted.length} suggested edits were rejected by the safety checks` });

  const rec = {
    path: rel, type: plan.type, mode: strength, inPlace: !optionsOf(client).template, status: issues.some((i) => i.level === 'fail') ? 'needs-review' : 'generated',
    createdAt: new Date().toISOString(), model: r.model, attempts: 1, cost: +cost.toFixed(5), note: note || '',
    source: { title: model.head.title, words: plan.words },
    summary: { units: units.length, changed: changed.length, rejected: reverted.length },
    ...(dupes.length ? { duplicates: dupes } : {}),
    content: { ...meta, units: changed, rejected: reverted }, keep: [], issues,
  };
  return saveContent(slug, rec);
}
