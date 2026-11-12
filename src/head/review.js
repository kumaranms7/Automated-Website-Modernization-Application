import path from 'node:path';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { getProfile } from '../profile/store.js';
import { callTool } from '../ai/claude.js';
import { titleProblem, metaProblem, h1Problem, stripBrand, TITLE, META, META_TARGET, H1_MAX } from '../content/seo-fix.js';
import { findSimilar, SIMILAR } from './similar.js';

// The review of one page's title, meta description and heading: see what the build wrote beside the original, check any wording
// against the same rules, ask the AI to write one field again (with your instruction), or type your own. What you save is used on
// every later build of that page and is never overwritten by the AI.

const manualFile = (slug) => path.join(clientDir(slug), 'head-manual.json');
export const loadManual = (slug) => readJson(manualFile(slug), {});
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const FIELDS = ['title', 'description', 'h1'];

async function context(slug, rel) {
  const client = await loadClient(slug);
  const profile = await getProfile(slug);
  const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const page = scan.find((p) => p.path === rel);
  if (!page) throw new Error('That page is not in the scan.');
  const last = await readJson(path.join(clientDir(slug), 'final-build.json'), null);
  const built = new Map((last?.head || []).map((h) => [h.path, h.after]));
  const now = built.get(rel);
  const manual = (await loadManual(slug))[rel] || {};
  const others = scan.filter((p) => p.path !== rel).map((p) => { const b = built.get(p.path); return { title: b?.title ?? p.title, description: b?.description ?? p.metaDescription, h1: b?.h1 ?? (p.h1 || [])[0] }; });
  return { client, profile, page, now, manual, others, last, brand: clean(profile.nap?.name || client.name) };
}

export function problemsOf(values, others, brand) {
  const out = { title: [], description: [], h1: [] };
  if ('title' in values) {
    const p = titleProblem(values.title, brand); if (p) out.title.push(`The title ${p}.`);
    // the business name at the end is the same on every page, so only the page's own words are compared
    const core = stripBrand(values.title, brand), sim = findSimilar(core, others.map((o) => stripBrand(o.title, brand)), SIMILAR.title); if (!p && sim) out.title.push(`Too like another page's title: "${sim}".`);
  }
  if ('description' in values) {
    const p = metaProblem(values.description); if (p) out.description.push(`The description ${p}.`);
    const sim = findSimilar(values.description, others.map((o) => o.description), SIMILAR.description); if (!p && sim) out.description.push(`Too like another page's description: "${sim.slice(0, 90)}…".`);
  }
  if ('h1' in values) {
    const p = h1Problem(values.h1); if (p) out.h1.push(`The heading ${p}.`);
    const sim = findSimilar(values.h1, others.map((o) => o.h1).filter(Boolean), SIMILAR.h1); if (!p && sim) out.h1.push(`Too like another page's heading: "${sim}".`);
  }
  return out;
}

export async function reviewData(slug, rel) {
  const c = await context(slug, rel);
  const original = { title: clean(c.page.title), description: clean(c.page.metaDescription), h1: clean((c.page.h1 || [])[0]) };
  const current = c.now ? { title: c.now.title, description: c.now.description, h1: c.now.h1 } : original;
  const values = { title: c.manual.title ?? current.title, description: c.manual.description ?? current.description, h1: c.manual.h1 ?? current.h1 };
  return {
    path: rel, original, current, values, manual: Object.fromEntries(FIELDS.filter((f) => c.manual[f]).map((f) => [f, true])),
    problems: problemsOf(values, c.others, c.brand),
    limits: { title: TITLE, description: META, descriptionTarget: META_TARGET, h1: [1, H1_MAX] },
  };
}

export async function checkHead(slug, rel, values) {
  const c = await context(slug, rel);
  const v = Object.fromEntries(FIELDS.filter((f) => values[f] !== undefined).map((f) => [f, clean(values[f])]));
  return { problems: problemsOf(v, c.others, c.brand) };
}

const TOOL = { name: 'submit_text', description: 'Submit the new wording.', input_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } };
const RULES = {
  title: `A page title of ${TITLE[0]}-${TITLE[1]} characters including spaces: a complete natural phrase that starts with the page's main keyword, ending with the business name after a separator if the current title has one. No ellipsis; never end on a separator, conjunction or preposition.`,
  description: `A meta description of ${META_TARGET[0]}-${META_TARGET[1]} characters (never more than ${META[1]}): one or two complete sentences ending with a full stop, with the main keyword and a soft call to action.`,
  h1: `A page heading of at most ${H1_MAX} characters: one complete heading with the main keyword.`,
};
export async function rewriteField(slug, rel, field, { instruction = '', value = '' } = {}) {
  if (!FIELDS.includes(field)) throw new Error('Choose the title, the description or the heading.');
  const c = await context(slug, rel);
  const cur = value || (await reviewData(slug, rel)).values[field];
  const system = `You rewrite one field of a local business web page. ${RULES[field]}
Use only what the page says; never invent claims, awards, prices, years in business, licences, guarantees or availability. Never shorten a sentence to make it fit: write a different sentence that fits. The wording must be clearly different from every other page of the site, and must follow the user's instruction.`;
  let feedback = '', best = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const user = [`BUSINESS: ${c.brand}`, `PAGE: ${rel}`, `PAGE HEADING: ${clean((c.page.h1 || [])[0])}`, `CURRENT ${field.toUpperCase()}: ${cur || '(none)'}`, instruction ? `INSTRUCTION: ${instruction}` : '', `OTHER PAGES' ${field.toUpperCase()}S (do not repeat or closely copy):\n${c.others.map((o) => o[field === 'description' ? 'description' : field]).filter(Boolean).slice(0, 25).map((t) => `- ${t}`).join('\n')}`, feedback ? `YOUR PREVIOUS ANSWER WAS REJECTED:\n${feedback}` : ''].filter(Boolean).join('\n\n');
    const r = await callTool({ slug, label: 'seo-review', system, user, tool: TOOL, maxTokens: 400 });
    best = clean(r.input.text);
    const p = problemsOf({ [field]: best }, c.others, c.brand)[field];
    if (!p.length) return { value: best, problems: [] };
    feedback = `"${best}": ${p.join(' ')}`;
  }
  return { value: best, problems: problemsOf({ [field]: best }, c.others, c.brand)[field] };
}

export async function saveManual(slug, rel, values) {
  const c = await context(slug, rel);
  const v = Object.fromEntries(FIELDS.filter((f) => values[f] !== undefined && clean(values[f])).map((f) => [f, clean(values[f])]));
  const bad = problemsOf(v, c.others, c.brand);
  const blocking = FIELDS.flatMap((f) => bad[f]);
  if (blocking.length) throw new Error(blocking.join(' '));
  const all = await loadManual(slug);
  all[rel] = { ...(all[rel] || {}), ...v, at: new Date().toISOString() };
  await writeJson(manualFile(slug), all);
  return all[rel];
}
export async function clearManual(slug, rel) {
  const all = await loadManual(slug);
  delete all[rel];
  await writeJson(manualFile(slug), all);
}
