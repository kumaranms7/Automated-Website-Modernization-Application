import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

// The values the platform runs on, in one place: the AI model and what it costs, the business types, how many pages a sample build covers
// and how many things run at the same time.
//
// To change one, edit <data folder>/app-settings.json and restart the app. Put in it only what you want to change, for example
//   { "limits": { "samplePages": 20, "concurrency": { "aiWriting": 5 } }, "model": { "default": "claude-opus-5-5" } }
// <data folder>/app-settings.defaults.json is a fresh copy of every setting and its built-in value, rewritten at each start, to copy from.
// Objects are merged key by key; a list (the business types, the models offered) is replaced as a whole. A value that is not valid is ignored.

export const BUILT_IN = {
  model: {
    // the model used when none is chosen in Settings; the CLAUDE_MODEL setting or variable wins over it
    default: 'claude-sonnet-5-5',
    // the models offered in Settings (the live list from the API is added when a key exists)
    list: [
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — balanced (recommended)' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — highest quality, slower' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — fastest, lowest cost' },
      { id: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
    ],
  },
  // dollars per million tokens: [input, output]. A model that is not here is used but its cost is not shown.
  prices: {
    'claude-sonnet-5-5': [2, 10], 'claude-sonnet-5': [2, 10], 'claude-opus-5-5': [4, 20], 'claude-opus-5': [5, 25],
    'claude-haiku-5-5': [0.1, 0.5], 'claude-fable-5-1': [10, 50], 'claude-fable-5': [10, 50],
  },
  // what cached text costs compared with the input price: reading it back, and writing it the first time
  cache: { readOfInput: 0.1, writeOfInput: 1.25 },
  // the types offered in the business profile (schema.org names)
  businessTypes: [
    'LocalBusiness', 'Plumber', 'Electrician', 'HVACBusiness', 'RoofingContractor', 'GeneralContractor', 'HomeAndConstructionBusiness', 'LegalService', 'Attorney',
    'Dentist', 'Physician', 'MedicalBusiness', 'AutoRepair', 'AutomotiveBusiness', 'RealEstateAgent', 'FinancialService', 'AccountingService', 'InsuranceAgency',
    'Store', 'Restaurant', 'ProfessionalService', 'SecurityService', 'MovingCompany', 'Locksmith', 'PestControl', 'CleaningService',
  ],
  // further types that count as "a page that describes the business" when a page already has them
  recognisedBusinessTypes: ['Organization', 'HousePainter'],
  limits: {
    samplePages: 10, // the "sample pages" build
    browserTestPages: 12, // pages tested in a real browser
    profilePages: 8, // pages read when a business profile is drafted from a web address
    aiRetries: 4, // how often a request to the AI is repeated when it fails for a reason that can pass
    concurrency: {
      aiWriting: 3, // pages the AI writes at the same time
      browserTests: 3, // pages tested in a real browser at the same time
      images: 4, // images converted at the same time
      phpScan: 6, // PHP pages rendered at the same time while scanning
    },
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const warn = (msg) => console.warn(`app-settings.json: ${msg}`);

// the file's values over the built-in ones; only a value of the right kind is taken
export function mergeSettings(base, over, where = '') {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isObj(over)) return out;
  for (const [k, v] of Object.entries(over)) {
    if (k.startsWith('_')) continue;
    const at = where ? `${where}.${k}` : k;
    const cur = base[k];
    if (cur === undefined && !(where === 'prices')) { warn(`"${at}" is not a setting and is ignored`); continue; }
    if (where === 'prices') {
      if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && n >= 0)) out[k] = v; else warn(`"${at}" must be [input, output] in dollars per million tokens`);
    } else if (isObj(cur)) out[k] = mergeSettings(cur, v, at);
    else if (Array.isArray(cur)) {
      const ok = Array.isArray(v) && v.length && v.every((x) => (typeof cur[0] === 'string' ? typeof x === 'string' && x.trim() : isObj(x) && typeof x.id === 'string'));
      if (ok) out[k] = v; else warn(`"${at}" must be a list of the same kind as the built-in one and is ignored`);
    } else if (typeof cur === 'number') {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v; else warn(`"${at}" must be a number and is ignored`);
    } else if (typeof cur === 'string') {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim(); else warn(`"${at}" must be text and is ignored`);
    }
  }
  return out;
}

// numbers that count things stay whole and inside a sensible range
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(n)));
export function tidy(s) {
  const l = s.limits, c = l.concurrency;
  l.samplePages = clamp(l.samplePages, 1, 500); l.browserTestPages = clamp(l.browserTestPages, 1, 200); l.profilePages = clamp(l.profilePages, 1, 30); l.aiRetries = clamp(l.aiRetries, 0, 10);
  for (const k of Object.keys(c)) c[k] = clamp(c[k], 1, 16);
  s.businessTypes = [...new Set(s.businessTypes.map((t) => String(t).trim()).filter((t) => /^[A-Za-z]{3,40}$/.test(t)))];
  if (!s.businessTypes.length) s.businessTypes = BUILT_IN.businessTypes.slice();
  if (!s.model.list.some((m) => m.id === s.model.default)) s.model.list = [...s.model.list, { id: s.model.default, label: s.model.default }];
  return s;
}

export const settingsFile = () => path.join(DATA_DIR, 'app-settings.json');
export const defaultsFile = () => path.join(DATA_DIR, 'app-settings.defaults.json');

function readOverrides() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') warn(`could not be read (${e.message}); the built-in values are used`); return {}; }
}

export function loadSettings() {
  return tidy(mergeSettings(structuredClone(BUILT_IN), readOverrides()));
}

// the settings in use. Read once when the app starts; reloadSettings() reads the file again.
export const APP = loadSettings();
export function reloadSettings() {
  const next = loadSettings();
  for (const k of Object.keys(APP)) delete APP[k];
  Object.assign(APP, next);
  return APP;
}

// the file you edit is created empty on the first start, and the reference copy of every setting is refreshed
export function prepareSettingsFiles() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(settingsFile())) fs.writeFileSync(settingsFile(), JSON.stringify({ _help: 'Put here only the settings you want to change, then restart the app. See app-settings.defaults.json for every setting and its built-in value.' }, null, 2));
    fs.writeFileSync(defaultsFile(), JSON.stringify({ _help: 'A reference copy, rewritten at each start. Do not edit it: copy the settings you want to change into app-settings.json.', ...BUILT_IN }, null, 2));
  } catch { /* a read-only data folder: the built-in values are used */ }
}

// what the browser needs
export const settingsForUi = () => ({ model: { default: APP.model.default }, businessTypes: APP.businessTypes, limits: { samplePages: APP.limits.samplePages, browserTestPages: APP.limits.browserTestPages } });
