import path from 'node:path';
import { clientDir, readJson, writeJson } from '../config.js';
import { normaliseDomain } from '../canonical/index.js';
import { emptyFacts, cleanFacts, cleanSeparator } from './facts.js';

export const EMPTY_PROFILE = {
  status: 'empty', // empty | draft | approved
  source: 'manual', // manual | url
  sourceUrl: '',
  canonicalDomain: '', // the address every page's canonical tag starts with, e.g. https://www.example.com
  brand: '', // the name shown at the end of page titles; empty = the business name
  titleSeparator: '|', // between the page title and the brand
  facts: emptyFacts(), // business type, address parts, hours, price range, profile links, logo, share image
  industry: '',
  summary: '', // what the company does, in plain words
  whatWeDo: [],
  whatWeDoNot: [], // hard exclusions: AI must never write about these
  services: [],
  serviceAreas: [],
  tone: '',
  approvedFacts: [], // licences, years in business, certifications, guarantees the AI may state
  forbiddenClaims: [], // e.g. "#1", "lowest price", "24/7" if not true
  localNotes: [], // "City: fact" lines; the only city-specific facts the AI may use
  nap: { name: '', phone: '', address: '' },
  updatedAt: null,
  approvedAt: null,
};

const LIST_FIELDS = ['whatWeDo', 'whatWeDoNot', 'services', 'serviceAreas', 'approvedFacts', 'forbiddenClaims', 'localNotes'];
const STR_FIELDS = ['industry', 'summary', 'tone', 'sourceUrl'];

const file = (slug) => path.join(clientDir(slug), 'profile.json');

export async function getProfile(slug) {
  return { ...EMPTY_PROFILE, ...(await readJson(file(slug), {})) };
}

// Whitelist + normalise whatever the portal or the AI sends.
function clean(input) {
  const out = {};
  for (const k of STR_FIELDS) out[k] = String(input[k] ?? '').trim();
  for (const k of LIST_FIELDS)
    out[k] = [].concat(input[k] ?? []).flatMap((s) => String(s).split('\n')).map((s) => String(s).trim()).filter(Boolean);
  out.canonicalDomain = normaliseDomain(input.canonicalDomain);
  out.brand = String(input.brand ?? '').replace(/\s+/g, ' ').trim();
  out.titleSeparator = cleanSeparator(input.titleSeparator);
  out.facts = cleanFacts(input.facts);
  out.nap = Object.fromEntries(['name', 'phone', 'address'].map((k) => [k, String(input.nap?.[k] ?? '').trim()]));
  out.source = input.source === 'url' ? 'url' : 'manual';
  return out;
}

// Any save is a draft; only approveProfile() can mark it approved, so edits after approval need re-approval.
export async function saveProfile(slug, input) {
  const profile = { ...EMPTY_PROFILE, ...clean(input), status: 'draft', updatedAt: new Date().toISOString(), approvedAt: null };
  await writeJson(file(slug), profile);
  return profile;
}

export async function approveProfile(slug) {
  const p = await getProfile(slug);
  if (p.status === 'empty') throw new Error('Nothing to approve');
  if (!p.summary || !p.whatWeDo.length) throw new Error('Add a business summary and at least one "what we do" item first');
  const approved = { ...p, status: 'approved', approvedAt: new Date().toISOString() };
  await writeJson(file(slug), approved);
  return approved;
}

// The block injected into every content-generation prompt (Phase 3). Refuses unapproved profiles.
export function profileToPrompt(p) {
  if (p.status !== 'approved') throw new Error('Business profile must be approved before AI content is generated');
  const list = (t, a) => (a.length ? `${t}:\n${a.map((x) => `- ${x}`).join('\n')}\n` : '');
  return [
    `BUSINESS: ${p.nap.name} (${p.industry})`,
    p.summary,
    list('SERVICES WE OFFER', p.whatWeDo),
    list('SERVICES WE DO NOT OFFER — never mention, imply or link to these', p.whatWeDoNot),
    list('SERVICE AREAS', p.serviceAreas),
    list('FACTS YOU MAY STATE (nothing else counts as fact)', p.approvedFacts),
    list('CLAIMS YOU MUST NEVER MAKE', p.forbiddenClaims),
    p.tone && `TONE: ${p.tone}`,
  ].filter(Boolean).join('\n');
}
