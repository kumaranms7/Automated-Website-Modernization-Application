import { tokens } from '../build/graph.js';
import { WORD_TARGETS } from '../scanner/page-types.js';
import { SEO } from '../rules.js';

// Rule-based checks on AI output. "fail" blocks automatic acceptance; "warn" is shown to the reviewer.
// Every claim the AI makes must be traceable to the approved business profile or the page's own source text.

const STOPWORDS = new Set(['and', 'the', 'of', 'in', 'for', 'a', 'to', 'services', 'service', 'near', 'me', 'your', 'our', 'with', 'by', 'at']);
const content = (s) => tokens(s).filter((t) => !STOPWORDS.has(t));
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);

// the length of wording for each kind of page is in scanner/page-types.js
export { WORD_TARGETS };

// [pattern, evidence that must exist in the profile facts / source text, severity]
const CLAIMS = [
  [/24\s*\/\s*7|24[- ]hours?|around[- ]the[- ]clock/i, /24\s*\/\s*7|24[- ]hours?|around[- ]the[- ]clock/i, 'fail'],
  [/same[- ]day/i, /same[- ]day/i, 'fail'],
  [/\blicensed\b/i, /licensed/i, 'fail'],
  [/\binsured\b/i, /insured/i, 'fail'],
  [/guarantee|warrant(y|ies)/i, /guarantee|warrant/i, 'fail'],
  [/free (estimate|quote|inspection|consultation|camera)/i, /free (estimate|quote|inspection|consultation|camera)/i, 'fail'],
  [/family[- ](owned|operated)/i, /family[- ](owned|operated)/i, 'fail'],
  [/\bsince \d{4}\b|\b\d+\+? years\b|\bdecade/i, /since \d{4}|\d+\+? years|decade/i, 'fail'],
  [/award|accredited|\bbbb\b|top[- ]rated|#\s?1|number one|\bbest\b|lowest|cheapest|unbeatable|unmatched|unparalleled/i, /award|accredited|bbb|top[- ]rated|#\s?1|number one|best|lowest|cheapest/i, 'fail'],
  [/\bcertified\b/i, /certified/i, 'fail'],
  [/after[- ]hours|weekends?|holidays?/i, /after[- ]hours|weekends?|holidays?/i, 'fail'],
  [/upfront|no hidden fees|transparent pricing/i, /upfront|hidden fees|transparent/i, 'fail'],
  [/financing/i, /financing/i, 'fail'],
  [/\b(affordable|trusted|leading|premier|reliable|expert|top-notch|state-of-the-art|cutting-edge)\b/i, null, 'warn'],
];

const ALWAYS_BANNED = [
  [/\$\s?\d|\d+\s?%\s?off|discount|coupon|promo(tion)?s?\b|special offer|\bspecials?\b/i, 'prices, discounts and promotions change - never put them in page copy'],
  [/look no further|in today'?s (fast|world|busy)|when it comes to|second to none|one[- ]stop[- ]shop/i, 'filler / cliché phrase'],
];

const phoneRe = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

// "25 years", "500 customers", "12 plumbers": a number with a unit has to be in the approved facts or the original page.
// The people nouns follow the business: the type chosen in the profile (Plumber -> plumbers, Dentist -> dentists) is added to the usual ones.
const COUNT_UNITS = ['minutes?', 'hours?', 'days?', 'miles?', 'years?', '%', 'percent', 'customers', 'clients', 'patients', 'homes', 'jobs', 'projects', 'technicians', 'professionals', 'experts', 'specialists', 'employees'];
const NOT_A_ROLE = /^(LocalBusiness|Organization|Store|Restaurant|ProfessionalService|MedicalBusiness|AutomotiveBusiness|HomeAndConstructionBusiness|FinancialService|SecurityService|CleaningService|AccountingService|LegalService)$/;
export function countClaimRx(profile = {}) {
  const type = String(profile.facts?.businessType || '');
  const role = /^[A-Z][a-z]+$/.test(type) && !NOT_A_ROLE.test(type) ? [`${type.toLowerCase()}s`] : [];
  return new RegExp(`\\b\\d[\\d,.]*\\+?\\s?(${[...COUNT_UNITS, ...role].join('|')})\\b`, 'gi');
}

export function contentText(c) {
  return [
    c.lead?.heading, ...(c.lead?.paragraphs || []),
    ...(c.sections || []).flatMap((s) => [s.heading, ...(s.paragraphs || []), ...(s.bullets || [])]),
    ...(c.faq || []).flatMap((f) => [f.q, f.a]),
    c.ctaTitle, c.ctaText,
  ].filter(Boolean).join('\n');
}

function shingleSet(text) {
  const w = tokens(text);
  const set = new Set();
  for (let i = 0; i + 5 <= w.length; i++) set.add(w.slice(i, i + 5).join(' '));
  return set;
}
export function similarity(a, b) {
  const A = shingleSet(a), B = shingleSet(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

/**
 * @param c        AI output
 * @param ctx      { mode, type, h1, profile, sourceText, others: [{path,text}] }
 */
export function validateContent(c, ctx) {
  const issues = [];
  const add = (level, id, msg) => issues.push({ level, id, msg });
  const { profile, h1, mode } = ctx;
  const text = contentText(c);
  const lower = text.toLowerCase();
  // Claims must be backed by the APPROVED profile only; numbers may also come from the page's own text.
  const facts = [...profile.approvedFacts, profile.summary, ...profile.whatWeDo].join('\n').toLowerCase();
  const evidence = `${facts}\n${(ctx.sourceText || '').toLowerCase()}`;

  // --- metadata ---
  const title = (c.title || '').trim(), meta = (c.metaDescription || '').trim();
  const kw = content(h1);
  const share = (s) => (kw.length ? kw.filter((k) => tokens(s).includes(k)).length / kw.length : 1);
  if (!title) add('fail', 'title-missing', 'No title');
  else {
    if (title.length > SEO.title.max || title.length < SEO.title.min) add('fail', 'title-length', `Title is ${title.length} chars. It must be ${SEO.title.min}-${SEO.title.max}: write a different, complete title, do not cut it`);
    else if (/…|\.\.\.|[|\-–—:,&/]$/.test(title)) add('fail', 'title-cut', 'Title looks cut off: it must be a finished phrase');
    if (share(title) < 0.6) add('fail', 'title-keyword', 'Title is missing the page\'s main keyword');
    const brand = (profile.nap.name || '').replace(/,?\s*(llc|inc\.?|corp\.?)$/i, '').toLowerCase();
    const tail = title.split(/\s[|–—-]\s/).slice(1).join(' ').toLowerCase();
    if (tail && brand && !brand.includes(tail) && !tail.includes(brand)) add('fail', 'title-brand', `Title ends with "${tail}", which is not the business name`);
  }
  if (!meta) add('fail', 'meta-missing', 'No meta description');
  else {
    if (meta.length > SEO.description.max || meta.length < SEO.description.min) add('fail', 'meta-length', `Meta description is ${meta.length} chars. It must be ${SEO.description.min}-${SEO.description.max}: write different complete sentences, do not cut it`);
    else if (!/[.!?]$/.test(meta) || /…|\.\.\./.test(meta)) add('fail', 'meta-cut', 'Meta description must be complete sentences ending with a full stop');
    if (share(meta) < 0.5) add('warn', 'meta-keyword', 'Meta description is missing the main keyword');
  }

  // --- structure & length (rewrite only) ---
  if (mode === 'rewrite') {
    const [lo, hi] = WORD_TARGETS[ctx.type] || WORD_TARGETS.default;
    const wc = words(text).length;
    if (wc < lo * 0.7 || wc > hi * 1.4) add('fail', 'length', `${wc} words (target ${lo}-${hi})`);
    else if (wc < lo || wc > hi) add('warn', 'length', `${wc} words (target ${lo}-${hi})`);
    const n = (c.sections || []).length;
    if (n < 3 || n > 7) add('fail', 'sections', `${n} sections (need 3-7)`);
    const heads = [c.lead?.heading, ...(c.sections || []).map((s) => s.heading)].filter(Boolean).map((h) => h.toLowerCase());
    if (new Set(heads).size !== heads.length) add('fail', 'headings-duplicate', 'Two headings are identical');
    if (heads.length && heads.filter((h) => share(h) >= 0.99).length / heads.length > 0.5) add('warn', 'headings-stuffed', 'More than half the headings repeat the main keyword');
    const f = (c.faq || []).length;
    if (f < 3 || f > 6) add('warn', 'faq-count', `${f} FAQs (aim for 3-6)`);
    for (const p of [...(c.lead?.paragraphs || []), ...(c.sections || []).flatMap((s) => s.paragraphs || [])])
      if (words(p).length < 12 && !/[:]\s*$/.test(p.trim())) { add('warn', 'thin-paragraph', `Very short paragraph: "${p.slice(0, 50)}"`); break; }

    // keyword stuffing
    const phrase = h1.toLowerCase().replace(/\s+/g, ' ');
    const occ = phrase ? lower.split(phrase).length - 1 : 0;
    const density = (occ * words(phrase).length) / Math.max(1, words(text).length);
    if (density > 0.04) add('fail', 'stuffing', `Main keyword phrase used ${occ} times (${(density * 100).toFixed(1)}% of words)`);
    else if (density > 0.025) add('warn', 'stuffing', `Main keyword phrase used ${occ} times (${(density * 100).toFixed(1)}%)`);
    const openers = {};
    for (const s of text.split(/(?<=[.!?])\s+/)) { const o = words(s).slice(0, 3).join(' ').toLowerCase(); if (o) openers[o] = (openers[o] || 0) + 1; }
    const rep = Object.entries(openers).find(([, n2]) => n2 >= 4);
    if (rep) add('warn', 'repetitive', `${rep[1]} sentences start with "${rep[0]}"`);
  }

  // --- formatting ---
  if (/<[a-z/][^>]*>|\*\*|^#{1,6}\s/m.test(text + title + meta)) add('fail', 'markup', 'Contains HTML or markdown');
  if (/https?:\/\/|www\./i.test(text)) add('fail', 'links', 'Contains a URL');

  const all = `${title}\n${meta}\n${text}\n${(c.imageAlts || []).map((a) => a.alt).join('\n')}`;

  // --- truthfulness ---
  const phones = (all.match(phoneRe) || []).map((p) => p.replace(/\D/g, ''));
  const ok = (profile.nap.phone || '').replace(/\D/g, '');
  if (phones.some((p) => p !== ok)) add('fail', 'phone', 'Contains a phone number that is not the approved one');
  if (phones.length) add('warn', 'phone-in-copy', 'Phone numbers belong in the template, not in copy');

  for (const [re, why] of ALWAYS_BANNED) { const m = all.match(re); if (m) add('fail', 'banned', `"${m[0]}": ${why}`); }
  for (const [re, support, level] of CLAIMS) {
    const m = all.match(re);
    if (!m) continue;
    if (support && support.test(facts)) continue;
    if (!support) { add(level, 'soft-claim', `Subjective claim "${m[0]}"`); continue; }
    add(level, 'unsupported-claim', `"${m[0]}" is not in the approved business profile`);
  }
  for (const m of all.matchAll(countClaimRx(profile)))
    if (!evidence.includes(m[0].toLowerCase())) add('fail', 'unverified-number', `"${m[0]}" is not in the approved facts or the original page`);

  for (const bad of profile.forbiddenClaims || []) if (bad && lower.includes(bad.toLowerCase())) add('fail', 'forbidden-claim', `Uses forbidden claim "${bad}"`);
  for (const no of profile.whatWeDoNot || []) {
    const t = content(no).filter((w) => w.length > 3);
    if (t.length && t.every((w) => lower.includes(w))) add('fail', 'not-offered', `Mentions something the business does not do: "${no}"`);
  }

  // --- alt text ---
  for (const a of c.imageAlts || []) {
    if (!a.alt || a.alt.length > 125) add('warn', 'alt-length', `Alt text for ${a.src} is empty or over 125 chars`);
    else if (/^(image|picture|photo) of/i.test(a.alt)) add('warn', 'alt-prefix', `Alt text starts with "${a.alt.split(' ').slice(0, 2).join(' ')}"`);
  }

  // --- uniqueness against sibling pages ---
  if (mode === 'rewrite') {
    let worst = null;
    for (const o of ctx.others || []) { const s = similarity(text, o.text); if (!worst || s > worst.s) worst = { s, path: o.path }; }
    if (worst && worst.s >= 0.5) add('fail', 'duplicate', `${Math.round(worst.s * 100)}% similar to ${worst.path}`);
    else if (worst && worst.s >= 0.3) add('warn', 'similar', `${Math.round(worst.s * 100)}% similar to ${worst.path}`);
  }

  return issues;
}

// Models occasionally return nested arrays as JSON strings or maps; coerce to the expected shapes.
const parseMaybe = (x) => { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch { return x; } };
const asArray = (x) => { x = parseMaybe(x); return Array.isArray(x) ? x : x == null || x === '' ? [] : [x]; };
const strs = (x) => asArray(x).map((s) => String(s).trim()).filter(Boolean);

export function normalizeContent(raw) {
  const c = { ...raw };
  let alts = parseMaybe(c.imageAlts);
  if (alts && !Array.isArray(alts) && typeof alts === 'object') alts = Object.entries(alts).map(([src, alt]) => ({ src, alt }));
  c.imageAlts = asArray(alts).filter((a) => a && typeof a === 'object').map((a) => ({ src: String(a.src || ''), alt: String(a.alt || '').trim() })).filter((a) => a.src);
  c.reviewNotes = strs(c.reviewNotes);
  if (c.lead !== undefined) {
    const l = parseMaybe(c.lead) || {};
    c.lead = { heading: String(l.heading || '').trim(), paragraphs: strs(l.paragraphs) };
  }
  if (c.sections !== undefined)
    c.sections = asArray(c.sections).filter((s) => s && typeof s === 'object').map((s) => ({ heading: String(s.heading || '').trim(), paragraphs: strs(s.paragraphs), bullets: strs(s.bullets) }));
  if (c.faq !== undefined)
    c.faq = asArray(c.faq).filter((f) => f && typeof f === 'object').map((f) => ({ q: String(f.q || '').trim(), a: String(f.a || '').trim() })).filter((f) => f.q && f.a);
  for (const k of ['title', 'metaDescription', 'ctaTitle', 'ctaText']) if (c[k] !== undefined) c[k] = String(c[k]).trim();
  return c;
}

// Claims found in existing page copy that the approved business profile does not back up.
// Used to audit copy we did not write (template-only pages) so the owner can confirm or correct it.
export function findClaims(text, profile) {
  const facts = [...profile.approvedFacts, profile.summary, ...profile.whatWeDo].join('\n').toLowerCase();
  const found = new Map();
  const add = (phrase, kind) => { const k = phrase.toLowerCase().replace(/\s+/g, ' ').trim(); if (!found.has(k)) found.set(k, { phrase: k, kind }); };

  for (const [re, support, level] of CLAIMS) {
    if (level !== 'fail' || !support || /decade/.test(String(re))) continue;
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) if (!support.test(facts)) add(m[0], 'claim');
  }
  // experience claims: the exact number or year must appear in the approved facts
  for (const m of text.matchAll(/\b(\d+)\+?\s*years?\b/gi)) if (!new RegExp(`\\b${m[1]}\\b`).test(facts)) add(m[0], 'experience');
  for (const m of text.matchAll(/\b(since|established|est\.?)\s*(\d{4})\b/gi)) if (!facts.includes(m[2])) add(m[0], 'experience');
  for (const m of text.matchAll(/\bdecades?\b/gi)) if (!/decade/.test(facts)) add(m[0], 'experience');
  for (const [re, why] of ALWAYS_BANNED) for (const m of text.matchAll(new RegExp(re.source, 'gi'))) if (/\$|%|discount|coupon|promo|special/i.test(m[0])) add(m[0], 'promo');
  return [...found.values()];
}

// The "Marketing claims" check of the validation checklist and the SEO score: a page fails only when its copy contains one of the
// claims the owner listed under "Claims to never make". Claims that are merely not in the approved facts do not fail a page.
export function findForbiddenClaims(text, profile) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  const body = norm(text);
  const hits = [];
  for (const raw of profile.forbiddenClaims || []) {
    const bad = norm(raw);
    if (!bad) continue;
    const esc = bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${/^\w/.test(bad) ? '(?<!\\w)' : ''}${esc}${/\w$/.test(bad) ? '(?!\\w)' : ''}`);
    if (re.test(body)) hits.push({ phrase: bad, kind: 'forbidden' });
  }
  return hits;
}
