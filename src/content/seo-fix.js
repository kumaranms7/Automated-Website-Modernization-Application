import path from 'node:path';
import { SEO, TITLE_RANGE, META_RANGE } from '../rules.js';
import { clientDir, readJson, writeJson } from '../config.js';
import { callTool, modelId, estimateCost } from '../ai/claude.js';
import { findSimilar, SIMILAR } from '../head/similar.js';

// Titles, meta descriptions and (when asked) page headings must be the right length, finished (never cut to fit), different from
// every other page, and read as proper English. Text is never trimmed to meet a limit: what does not fit is written again.
// The AI writes the page's own part of the title; the business name and the separator are added here, so they always fit.

export const TITLE = TITLE_RANGE;
export const META = META_RANGE;
export const META_TARGET = [SEO.description.max - 20, SEO.description.max - 2];
export const H1_MAX = 70;
const seoFile = (slug) => path.join(clientDir(slug), 'seo-fixes.json');
export const loadSeoFixes = (slug) => readJson(seoFile(slug), {});

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase();
const DANGLING = /\b(and|or|the|a|an|in|of|for|to|with|at|by|from|on|as|is|are|our|your|that|which|near|into)$/i;

// the settings of this run (Content & build): which pages get new wording, the brand in titles, headings, one request for many pages
export async function headSettings(slug) {
  const s = await readJson(path.join(clientDir(slug), 'build-settings.json'), {});
  return { scope: s.headScope === 'all' ? 'all' : 'failing', batch: Boolean(s.headBatch), h1: Boolean(s.rewriteH1), brandInTitles: s.brandInTitles !== false };
}

// ---------- the title: the page's own words + separator + business name ----------
export const sepText = (sep) => { const s = clean(sep); return s ? ` ${s} ` : ' '; };
export const titleBudget = (sep, brand, max = TITLE[1]) => (brand ? max - sepText(sep).length - brand.length : max);
export function stripBrand(core, brand) {
  let t = clean(core);
  if (brand) t = t.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '');
  return t.replace(/\s{2,}/g, ' ').replace(/^[\s|\-–—:·•~/,]+|[\s|\-–—:·•~/,]+$/g, '');
}
export function buildTitle(core, sep, brand) {
  const c = stripBrand(core, brand);
  if (!brand) return c;
  return c ? `${c}${sepText(sep)}${brand}` : brand;
}

// what is wrong with this title on its own ('' = nothing)
// pass the business name to also catch a title that ends in only part of it ("| South Florida") or an abbreviation ("| SFPB")
export function titleProblem(t, brand = '') {
  t = clean(t);
  const tail = clean(t.split(/\s[|–—-]\s/).slice(1).join(' '));
  const full = clean(brand).toLowerCase();
  if (tail && full && full !== tail.toLowerCase() && full.startsWith(tail.toLowerCase())) return 'ends with only part of the business name';
  if (tail && tail.toLowerCase() !== full && /^[A-Z]{2,6}$/.test(tail)) return 'ends with an abbreviation';
  if (!t) return 'is missing';
  if (t.length < TITLE[0]) return `is too short (${t.length} characters, needs ${TITLE[0]}-${TITLE[1]})`;
  if (t.length > TITLE[1]) return `is too long (${t.length} characters, needs ${TITLE[0]}-${TITLE[1]})`;
  if (/…|\.\.\./.test(t) || /[|\-–—:,&/]$/.test(t) || DANGLING.test(t)) return 'looks cut off';
  return '';
}
export function metaProblem(m) {
  m = clean(m);
  if (!m) return 'is missing';
  if (m.length < META[0]) return `is too short (${m.length} characters, needs ${META[0]}-${META[1]})`;
  if (m.length > META[1]) return `is too long (${m.length} characters, needs ${META[0]}-${META[1]})`;
  if (/…|\.\.\./.test(m)) return 'looks cut off';
  if (!/[.!?]$/.test(m)) return 'does not end as a complete sentence';
  if (DANGLING.test(m.replace(/[.!?]$/, ''))) return 'looks cut off';
  return '';
}
export function h1Problem(h) {
  h = clean(h);
  if (!h) return 'is missing';
  if (h.length > H1_MAX) return `is too long (${h.length} characters, at most ${H1_MAX})`;
  return '';
}

// ---------- pages that need work ----------
// heads: [{ path, title, description, h1 }]; others: titles and descriptions of pages that are not being changed (they keep theirs)
// opts: { scope: 'failing' | 'all', h1: also the page heading }
export function findProblems(heads, others = [], brand = '', opts = {}) {
  const all = opts.scope === 'all';
  const count = (list) => { const m = new Map(); for (const x of list) m.set(norm(x), (m.get(norm(x)) || 0) + 1); return m; };
  const tOut = count(others.map((o) => o.title)), mOut = count(others.map((o) => o.description));
  const sorted = [...heads].sort((a, b) => a.path.localeCompare(b.path));
  const seenT = new Set(), seenM = new Set(), seenH = new Set();
  const out = [];
  for (const h of sorted) {
    const why = [];
    const tp = titleProblem(h.title, brand), mp = metaProblem(h.description);
    const tKey = norm(h.title), mKey = norm(h.description), hKey = norm(h.h1);
    let tBad = tp, mBad = mp, hBad = '';
    if (!tBad && (tOut.has(tKey) || seenT.has(tKey))) tBad = 'is the same as another page';
    if (!mBad && (mOut.has(mKey) || seenM.has(mKey))) mBad = 'is the same as another page';
    if (!tp) seenT.add(tKey);
    if (!mp) seenM.add(mKey);
    if (opts.h1) { hBad = h1Problem(h.h1) || (hKey && seenH.has(hKey) ? 'is the same as another page' : ''); if (hKey) seenH.add(hKey); }
    if (all) { tBad ||= 'is being rewritten'; mBad ||= 'is being rewritten'; if (opts.h1) hBad ||= 'is being rewritten'; }
    if (tBad) why.push(`title ${tBad}`);
    if (mBad) why.push(`meta description ${mBad}`);
    if (hBad) why.push(`heading ${hBad}`);
    if (why.length) out.push({ path: h.path, title: !!tBad, meta: !!mBad, h1: !!hBad, why });
  }
  return out;
}

// ---------- rules only: no AI, nothing trimmed ----------
const titleCase = (s) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase());
const pathName = (p) => titleCase(path.posix.basename(p).replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').trim());
const sentences = (text) => clean(text).split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(clean).filter((s) => /[.!?]$/.test(s) && s.length >= 40 && s.length <= META[1] && !/https?:|@|\|/.test(s));

export function ruleTitle(h, { brand, sep = '|', takenTitles }) {
  const base = [clean(h.h1), pathName(h.path)].filter(Boolean);
  const out = [];
  for (const b of base) for (const t of [b, `${b}${sepText(sep)}${brand}`, `${b} - ${brand}`, `${brand}: ${b}`, `${b} Near You`, `${b} for Homes and Businesses`, `${b} Services`]) out.push(clean(t));
  return out.find((t) => !titleProblem(t, brand) && !takenTitles.has(norm(t))) || '';
}

export function ruleMeta(h, { brand, phone, takenMetas }) {
  const own = sentences(h.text || '');
  const cands = [];
  for (let i = 0; i < own.length; i += 1) { cands.push(own[i]); if (own[i + 1]) cands.push(`${own[i]} ${own[i + 1]}`); }
  const topic = clean(h.h1) || pathName(h.path);
  const lower = topic.charAt(0).toLowerCase() + topic.slice(1);
  cands.push(
    `${topic} from ${brand}. ${phone ? `Call ${phone} to ask a question or arrange a visit.` : 'Get in touch to ask a question or arrange a visit.'}`,
    `${brand} offers ${lower} for homes and businesses. Contact us today to ask a question or arrange a visit.`,
    `Learn about ${lower} from ${brand}, and contact the team to ask a question or arrange a visit.`,
  );
  return cands.map(clean).find((m) => !metaProblem(m) && !takenMetas.has(norm(m))) || '';
}

// ---------- AI ----------
const OPENING_STYLES = [
  "open with the customer's problem, then the solution",
  'open with the concrete benefit or outcome the customer gets',
  'open with the exact service and place, then a differentiator',
  "open with a question the customer would type into Google",
  'open with a trust signal that is actually stated on the page (experience, licensing, guarantee)',
  "open with what makes this page's offer different from similar pages",
];
const styleOf = (p) => OPENING_STYLES[[...String(p)].reduce((n, c) => n + c.charCodeAt(0), 0) % OPENING_STYLES.length];

const ITEM = (h1) => ({ title: { type: 'string', description: 'The page-specific part of the title only (the business name is added afterwards).' }, metaDescription: { type: 'string' }, ...(h1 ? { h1: { type: 'string' } } : {}) });
const TOOL = (h1) => ({
  name: 'submit_page_metadata',
  description: 'Submit the title and meta description for the page.',
  input_schema: { type: 'object', properties: ITEM(h1), required: ['title', 'metaDescription'] },
});
const BATCH_TOOL = (h1) => ({
  name: 'submit_pages_metadata',
  description: 'Submit the title and meta description of every page, in the same order.',
  input_schema: { type: 'object', properties: { pages: { type: 'array', items: { type: 'object', properties: { n: { type: 'number', description: 'The number of the page, as given.' }, ...ITEM(h1) }, required: ['n', 'title', 'metaDescription'] } } }, required: ['pages'] },
});
const system = (ctx) => `You write the SEO title and meta description${ctx.h1 ? ' and the main heading' : ''} for pages of a local business website.
TITLE: ${ctx.cmin}-${ctx.cmax} characters including spaces. ${ctx.brand ? `Write only the page's own words: "${ctx.sep ? sepText(ctx.sep) : ' '}${ctx.brand}" is added after your text, so never include the business name, a part of it, an abbreviation of it or a separator. ` : ''}A complete, natural phrase that starts with the page's main keyword. It must not end with a separator, a conjunction or a preposition. No ellipsis.
META DESCRIPTION: ${META_TARGET[0]}-${META_TARGET[1]} characters including spaces (never more than ${META[1]}). One or two complete, grammatically correct sentences that end with a full stop. Include the main keyword and a soft call to action.
${ctx.h1 ? `MAIN HEADING: at most ${H1_MAX} characters, one complete heading with the main keyword. If the current heading is already good and different from every other page, return it exactly unchanged.\n` : ''}Never shorten a sentence to make it fit: write a different sentence that fits. Use only what the page says. Never invent claims, awards, prices, years in business, licences, guarantees or availability (such as 24/7 or same-day). Avoid words such as expert, best, top, trusted, licensed, certified, guaranteed, free, affordable, cheap or leading unless the page text itself uses them. No keyword stuffing, no capital letters for emphasis, no emoji.
Every page needs its own wording: many pages are alike (the same service in different places), so use what is specific to THIS page (its exact service, place, audience, selling point) and never reuse the opening words, sentence shape or call to action of another page. The title, description${ctx.h1 ? ' and heading' : ''} must each be clearly different from every item in the ALREADY USED lists.`;

function related(h, pool, limit) {
  const keys = new Set(norm(`${h.h1} ${pathName(h.path)}`).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  return pool.map((p) => ({ p, s: norm(p).split(/[^a-z0-9]+/).filter((w) => keys.has(w)).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.p);
}
const pageBlock = (h, ctx, n) => [
  n ? `PAGE ${n}: ${h.path}` : `PAGE: ${h.path}`, `MAIN HEADING (main keyword): ${h.h1}`, `PAGE TYPE: ${h.type}`,
  `CURRENT TITLE: ${h.title || '(none)'}${h.titleWhy ? `  <- ${h.titleWhy}` : ''}`,
  `CURRENT META DESCRIPTION: ${h.description || '(none)'}${h.metaWhy ? `  <- ${h.metaWhy}` : ''}`,
  ctx.h1 ? `CURRENT HEADING: ${h.h1 || '(none)'}${h.h1Why ? `  <- ${h.h1Why}` : ''}` : '',
  `DESCRIPTION OPENING STYLE: ${styleOf(h.path)}`,
  `PAGE TEXT:\n${clean(h.text).slice(0, n ? 500 : 900)}`,
].filter(Boolean).join('\n');
const usedBlock = (h, ctx) => [
  `ALREADY USED TITLES (do not repeat or closely copy):\n${related(h, ctx.usedTitles, 20).map((t) => `- ${t}`).join('\n') || '- (none)'}`,
  `ALREADY USED META DESCRIPTIONS (write something different):\n${related(h, ctx.usedMetas, 8).map((t) => `- ${t}`).join('\n') || '- (none)'}`,
  ctx.h1 ? `ALREADY USED HEADINGS:\n${related(h, ctx.usedH1s, 8).map((t) => `- ${t}`).join('\n') || '- (none)'}` : '',
].filter(Boolean).join('\n\n');

async function askAi(slug, h, ctx, feedback) {
  const user = [`BUSINESS: ${ctx.brandName}`, pageBlock(h, ctx), usedBlock(h, ctx), feedback ? `YOUR PREVIOUS ANSWER WAS REJECTED:\n${feedback}\nWrite everything again.` : ''].filter(Boolean).join('\n\n');
  const r = await callTool({ slug, label: 'seo-meta', system: system(ctx), user, tool: TOOL(ctx.h1), maxTokens: 600 });
  return { title: clean(r.input.title), description: clean(r.input.metaDescription), h1: clean(r.input.h1), cost: r.cost || 0 };
}
// one request for up to ten pages
async function askAiBatch(slug, hs, ctx) {
  const user = [`BUSINESS: ${ctx.brandName}`, ...hs.map((h, i) => pageBlock(h, ctx, i + 1)), usedBlock(hs[0], ctx), `Return one entry for each of the ${hs.length} pages, with n as given.`].join('\n\n');
  const r = await callTool({ slug, label: 'seo-meta', system: system(ctx), user, tool: BATCH_TOOL(ctx.h1), maxTokens: 400 * hs.length + 300 });
  const by = new Map((r.input.pages || []).map((p) => [Number(p.n), p]));
  return { items: hs.map((_, i) => { const p = by.get(i + 1); return p ? { title: clean(p.title), description: clean(p.metaDescription), h1: clean(p.h1) } : null; }), cost: r.cost || 0 };
}

// The function the build calls with every page's head: returns what to change. AI writes the wording; rules are the fallback
// (and the only method when ai is false, such as in a dry run).
export function makeHeadFixer({ slug, ai = true, persist = true, onProgress = () => {} }) {
  const stats = { titles: 0, metas: 0, h1s: 0, ai: 0, byRule: 0, reused: 0, unresolved: [], cost: 0, aiError: '' };
  async function fix(heads, { scan = [], site = {}, profile = {} }) {
    const set = await headSettings(slug);
    const scope = ai ? set.scope : 'failing'; // without the AI there is no way to write a better title than the one the page has
    const inRun = new Set(heads.map((h) => h.path));
    const others = scan.filter((p) => !inRun.has(p.path)).map((p) => ({ title: p.title, description: p.metaDescription, h1: (p.h1 || [])[0] || '' }));
    const bizName = clean(site.name || profile.nap?.name || '');
    const brand = set.brandInTitles ? clean(profile.brand || bizName) : '';
    const sep = profile.titleSeparator || '|';
    const budget = titleBudget(sep, brand);
    const useBrand = Boolean(brand) && budget >= 18; // a very long name leaves no room for the page's own words
    const cmax = useBrand ? budget : TITLE[1], cmin = Math.max(TITLE[0] - (useBrand ? sepText(sep).length + brand.length : 0), Math.min(18, cmax - 8));
    const fullOf = (core) => (useBrand ? buildTitle(core, sep, brand) : stripBrand(core, ''));
    const problems = findProblems(heads, others, bizName, { scope, h1: set.h1 });
    const stored = await loadSeoFixes(slug);
    const phone = site.phone?.display || profile.nap?.phone || '';
    const byPath = new Map(heads.map((h) => [h.path, h]));
    const keep = (kind) => heads.filter((h) => !problems.some((p) => p.path === h.path && p[kind]));
    // everything that is on the site once the run is done, so a new wording can be checked against it
    const takenTitles = new Set([...others.map((o) => norm(o.title)), ...keep('title').map((h) => norm(h.title))]);
    const takenMetas = new Set([...others.map((o) => norm(o.description)), ...keep('meta').map((h) => norm(h.description))]);
    const takenH1 = new Set([...others.map((o) => norm(o.h1)), ...keep('h1').map((h) => norm(h.h1))].filter(Boolean));
    const coreOf = (t) => stripBrand(t, brand || bizName);
    const cores = [...takenTitles].map(coreOf), metaList = [...takenMetas], h1List = [...takenH1];
    const ctx = { brand: useBrand ? brand : '', brandName: bizName, sep, cmin, cmax, h1: set.h1, usedTitles: [...takenTitles], usedMetas: metaList, usedH1s: h1List };
    const result = new Map();
    const next = [...problems];
    let done = 0;
    onProgress({ phase: 'seo', done: 0, total: problems.length });

    // is this wording acceptable? returns a list of what is wrong
    const judge = (kind, r, h) => {
      if (kind === 'title') {
        const core = stripBrand(r.title, brand || bizName), full = fullOf(core);
        if (!core) return ['the title is empty'];
        if (useBrand && core.length > cmax) return [`title "${core}" is ${core.length} characters; the page's own part may be at most ${cmax} (the business name is added after it)`];
        const p = titleProblem(full, bizName);
        if (p) return [`title "${full}" ${p}`];
        if (takenTitles.has(norm(full))) return [`title "${full}" is the same as another page`];
        const sim = findSimilar(core, cores, SIMILAR.title);
        return sim ? [`title "${core}" is too similar to an existing title: "${sim}"`] : [];
      }
      if (kind === 'meta') {
        const p = metaProblem(r.description);
        if (p) return [`meta description "${r.description}" ${p}`];
        if (takenMetas.has(norm(r.description))) return [`meta description "${r.description}" is the same as another page`];
        const sim = findSimilar(r.description, metaList, SIMILAR.description);
        return sim ? [`meta description "${r.description}" is too similar to an existing one: "${sim}"`] : [];
      }
      const p = h1Problem(r.h1);
      if (p) return [`heading "${r.h1}" ${p}`];
      if (norm(r.h1) === norm(h.h1)) return []; // returned unchanged
      if (takenH1.has(norm(r.h1))) return [`heading "${r.h1}" is the same as another page`];
      const sim = findSimilar(r.h1, h1List, SIMILAR.h1);
      return sim ? [`heading "${r.h1}" is too similar to an existing heading: "${sim}"`] : [];
    };

    async function one(pr, first) {
      const h = byPath.get(pr.path);
      const out = {};
      const accept = (kind, value, how) => {
        if (kind === 'title') { takenTitles.add(norm(value)); cores.push(coreOf(value)); }
        else if (kind === 'meta') { takenMetas.add(norm(value)); metaList.push(value); }
        else { takenH1.add(norm(value)); h1List.push(value); }
        out[kind === 'title' ? 'title' : kind === 'meta' ? 'description' : 'h1'] = value;
        stats[kind === 'title' ? 'titles' : kind === 'meta' ? 'metas' : 'h1s'] += 1;
        if (how === 'ai') stats.ai += 1; else if (how === 'rule') stats.byRule += 1; else stats.reused += 1;
      };
      // 1. an earlier run already wrote a fix for exactly this page text
      const old = stored[pr.path];
      const sameBase = old && old.base && norm(old.base.title) === norm(h.title) && norm(old.base.description) === norm(h.description) && norm(old.base.h1 ?? h.h1) === norm(h.h1);
      if (sameBase) {
        if (pr.title && old.title && !titleProblem(old.title, bizName) && !takenTitles.has(norm(old.title))) accept('title', old.title, 'reused');
        if (pr.meta && old.description && !metaProblem(old.description) && !takenMetas.has(norm(old.description))) accept('meta', old.description, 'reused');
        if (pr.h1 && old.h1 && !h1Problem(old.h1) && !takenH1.has(norm(old.h1))) accept('h1', old.h1, 'reused');
      }
      let h1ok = false; // the heading was returned unchanged: it was already good
      const need = () => ({ t: pr.title && !out.title, m: pr.meta && !out.description, h: pr.h1 && !out.h1 && !h1ok });
      // 2. AI wording, checked here, with up to three attempts that each say exactly what was wrong
      if (ai && (need().t || need().m || need().h)) {
        let feedback = '', r = first || null;
        for (let attempt = 0; attempt < 3 && Object.values(need()).some(Boolean); attempt += 1) {
          if (!r) {
            try { r = await askAi(slug, { ...h, titleWhy: pr.title ? `needs rewriting: ${pr.why.find((w) => w.startsWith('title'))}` : '', metaWhy: pr.meta ? `needs rewriting: ${pr.why.find((w) => w.startsWith('meta'))}` : '', h1Why: pr.h1 ? `needs rewriting: ${pr.why.find((w) => w.startsWith('heading'))}` : '' }, ctx, feedback); stats.cost += r.cost; } catch (e) { stats.aiError = e.message; break; } // the rules below take over, and the run reports why
          }
          const bad = [];
          const n = need();
          if (n.t) { const p = judge('title', r, h); if (p.length) bad.push(...p); else accept('title', fullOf(stripBrand(r.title, brand || bizName)), 'ai'); }
          if (n.m) { const p = judge('meta', r, h); if (p.length) bad.push(...p); else accept('meta', r.description, 'ai'); }
          if (n.h) { const p = judge('h1', r, h); if (p.length) bad.push(...p); else if (norm(r.h1) !== norm(h.h1)) accept('h1', r.h1, 'ai'); else h1ok = true; }
          feedback = bad.join('\n');
          r = null;
        }
      }
      // 3. rules
      if (pr.title && !out.title) { const t = ruleTitle(h, { brand: brand || bizName, sep, takenTitles }); if (t) accept('title', t, 'rule'); }
      if (pr.meta && !out.description) { const m = ruleMeta(h, { brand: bizName, phone, takenMetas }); if (m) accept('meta', m, 'rule'); }
      if (pr.title && !out.title) stats.unresolved.push({ path: pr.path, why: 'a title within the limits could not be written' });
      if (pr.meta && !out.description) stats.unresolved.push({ path: pr.path, why: 'a meta description within the limits could not be written' });
      const row = Object.fromEntries(Object.entries(out).filter(([, v]) => v));
      if (Object.keys(row).length) result.set(pr.path, row);
      done += 1;
      onProgress({ phase: 'seo', done, total: problems.length, path: pr.path });
    }

    // many pages in one request (up to ten), when asked for; a page whose answer is not acceptable is asked again on its own
    if (ai && set.batch && next.length > 1) {
      for (let i = 0; i < next.length; i += 10) {
        const group = next.slice(i, i + 10);
        let items = [];
        try { const r = await askAiBatch(slug, group.map((pr) => ({ ...byPath.get(pr.path), titleWhy: pr.title ? 'needs rewriting' : '', metaWhy: pr.meta ? 'needs rewriting' : '', h1Why: pr.h1 ? 'needs rewriting' : '' })), ctx); items = r.items; stats.cost += r.cost; } catch (e) { stats.aiError = e.message; items = []; }
        for (let k = 0; k < group.length; k += 1) await one(group[k], items[k] || null);
      }
      next.length = 0;
    }
    await Promise.all(Array.from({ length: ai ? 3 : 1 }, async () => { while (next.length) await one(next.shift()); }));

    if (persist && result.size) {
      const fresh = { ...stored };
      for (const [p, v] of result) { const h = byPath.get(p); fresh[p] = { ...(fresh[p]?.base && norm(fresh[p].base.title) === norm(h.title) ? fresh[p] : {}), ...v, base: { title: h.title, description: h.description, h1: h.h1 }, at: new Date().toISOString() }; }
      await writeJson(seoFile(slug), fresh);
    }
    return result;
  }
  fix.stats = stats;
  return fix;
}

// what is already fixed for the current page text, with no AI: used by every ordinary build
export async function storedFixes(slug, heads) {
  const stored = await loadSeoFixes(slug);
  const out = new Map();
  for (const h of heads) {
    const f = stored[h.path];
    if (!f?.base || norm(f.base.title) !== norm(h.title) || norm(f.base.description) !== norm(h.description) || norm(f.base.h1 ?? h.h1) !== norm(h.h1)) continue;
    const v = {};
    if (f.title && !titleProblem(f.title)) v.title = f.title;
    if (f.description && !metaProblem(f.description)) v.description = f.description;
    if (f.h1 && !h1Problem(f.h1)) v.h1 = f.h1;
    if (Object.keys(v).length) out.set(h.path, v);
  }
  return out;
}

// before a run: how many pages will need new wording, and roughly what it costs (from the scan, so it is quick)
export async function estimateHeadFixes(slug, scan, paths) {
  const set = await headSettings(slug);
  const inRun = new Set(paths);
  const heads = scan.filter((p) => inRun.has(p.path)).map((p) => ({ path: p.path, title: p.title || '', description: p.metaDescription || '', h1: (p.h1 || [])[0] || '' }));
  const others = scan.filter((p) => !inRun.has(p.path)).map((p) => ({ title: p.title, description: p.metaDescription }));
  const stored = await loadSeoFixes(slug);
  const need = findProblems(heads, others, '', { scope: set.scope, h1: set.h1 }).filter((p) => { const f = stored[p.path]; const h = heads.find((x) => x.path === p.path); return !(f?.base && norm(f.base.title) === norm(h.title) && norm(f.base.description) === norm(h.description) && norm(f.base.h1 ?? h.h1) === norm(h.h1)); });
  const per = set.batch ? 700 : 1300;
  const cost = need.length ? estimateCost(modelId(), need.length * per, need.length * (set.h1 ? 200 : 160)) : 0;
  return { pages: need.length, titles: need.filter((p) => p.title).length, metas: need.filter((p) => p.meta).length, h1s: need.filter((p) => p.h1).length, cost: cost === null ? null : +cost.toFixed(2), scope: set.scope };
}
