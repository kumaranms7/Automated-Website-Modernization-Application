import * as cheerio from 'cheerio';
import { APP } from '../app-settings.js';

// The business details search engines read (the business node of the structured data, the share image, the profile links),
// kept in the Business profile. Details found on the live site are checked against what the site really says: anything the pages do
// not support is dropped, never guessed.

// the types offered in the profile are in app-settings.js
export const BUSINESS_TYPES = APP.businessTypes;
const STR = ['businessType', 'street', 'city', 'region', 'postal', 'country', 'priceRange', 'logo', 'shareImage'];
const LIST = ['hours', 'sameAs'];
export const emptyFacts = () => ({ businessType: 'LocalBusiness', street: '', city: '', region: '', postal: '', country: '', priceRange: '', logo: '', shareImage: '', hours: [], sameAs: [] });

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export function cleanFacts(input = {}) {
  const out = emptyFacts();
  for (const k of STR) out[k] = oneLine(input[k]) || out[k];
  if (!/^[A-Za-z]{3,40}$/.test(out.businessType)) out.businessType = 'LocalBusiness';
  for (const k of LIST) out[k] = [].concat(input[k] ?? []).flatMap((s) => String(s).split('\n')).map(oneLine).filter(Boolean);
  out.sameAs = out.sameAs.filter((u) => /^https?:\/\//i.test(u));
  return out;
}

export function cleanSeparator(s) {
  const t = oneLine(s);
  return ['|', '-', '–', '—', ':', '•', '·'].includes(t) ? t : '|';
}

const SOCIAL = /(facebook|instagram|linkedin|twitter|x|youtube|tiktok|pinterest|yelp|nextdoor|threads)\.com\/|youtu\.be\/|g\.page\/|maps\.app\.goo\.gl|google\.com\/maps/i;
const abs = (href, base) => { try { return new URL(href, base).href; } catch { return ''; } };

// what the pages show without any guessing: the logo, the share image and the links to the business's profiles
export function signalsFromPages(docs) {
  const home = docs[0];
  const out = { logo: '', shareImage: '', sameAs: [] };
  if (!home?.$) return out;
  const $ = home.$, base = home.finalUrl || home.url;
  const og = $('meta[property="og:image"]').attr('content');
  if (og) out.shareImage = abs(og, base);
  const logoImg = $('header img[src*="logo" i], .logo img, img[class*="logo" i], img[alt*="logo" i], header img').first().attr('src');
  if (logoImg) out.logo = abs(logoImg, base);
  const seen = new Set();
  for (const d of docs) d.$?.('a[href]').each((_, a) => {
    const h = d.$(a).attr('href') || '';
    if (/^https?:\/\//i.test(h) && SOCIAL.test(h) && !/sharer|share\?|intent\/tweet/i.test(h)) { const k = h.replace(/\/+$/, '').toLowerCase(); if (!seen.has(k)) { seen.add(k); out.sameAs.push(h.replace(/\/+$/, '')); } }
  });
  out.sameAs = out.sameAs.slice(0, 8);
  return out;
}

const compact = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// drops what the pages do not support; returns { facts, dropped: ['street (not found on the site)', ...] }
export function verifyFacts(facts, corpus) {
  const text = compact(corpus), dropped = [];
  const out = { ...cleanFacts(facts) };
  for (const k of ['street', 'city', 'region', 'postal', 'country']) if (out[k] && !text.includes(compact(out[k]))) { dropped.push(`${k} "${out[k]}"`); out[k] = ''; }
  if (out.priceRange && !/^\${1,4}$/.test(out.priceRange) && !text.includes(compact(out.priceRange))) { dropped.push(`price range "${out.priceRange}"`); out.priceRange = ''; }
  out.hours = out.hours.filter((h) => { const digits = h.replace(/\D/g, ''); const ok = digits.length >= 2 && (text.includes(compact(h)) || [...h.matchAll(/\d{1,2}(?::\d{2})?/g)].every((m) => text.includes(compact(m[0])))); if (!ok) dropped.push(`hours "${h}"`); return ok; });
  return { facts: out, dropped };
}

// the page text of the sites crawled, for the check above
// (the footer and the structured data are part of it: that is where the address is)
export const corpusOf = (docs) => docs.map((d) => `${d.title} ${d.text} ${d.contact || ''}`).join(' ');
export const loadHtml = (html) => cheerio.load(html);
