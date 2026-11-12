import * as cheerio from 'cheerio';
import { plain } from '../util/html.js';
import { findClaims } from './validate.js';

// "Enhance" works on text units: every paragraph, list, heading, FAQ entry and card text on a page, each with a stable id.
// The AI only returns the units it changed; every change is checked against the original before it is accepted.

const HTML_BLOCK = /^<(p|ul|ol|blockquote)\b/i;

// Returns the editable units of a model, each with get/set bound to that model object.
export function collectUnits(model) {
  const units = [];
  const add = (id, kind, obj, key) => { if (typeof obj[key] === 'string' && plain(obj[key]).split(' ').filter(Boolean).length >= 2) units.push({ id, kind, get: () => obj[key], set: (v) => { obj[key] = v; } }); };

  model.blocks.forEach((b, i) => {
    if (b.t === 'html' && HTML_BLOCK.test(b.html)) add(`b${i}`, 'html', b, 'html');
    else if (b.t === 'h') add(`b${i}`, 'text', b, 'text');
    else if (b.t === 'callout') { add(`b${i}.t`, 'text', b, 'title'); add(`b${i}.x`, 'text', b, 'text'); }
    else if (b.t === 'faq') b.items.forEach((f, j) => { add(`b${i}.q${j}`, 'text', f, 'q'); add(`b${i}.a${j}`, 'inner', f, 'a'); });
    else if (b.t === 'cardgrid') b.items.forEach((c, j) => { add(`b${i}.t${j}`, 'text', c, 'title'); add(`b${i}.x${j}`, 'text', c, 'text'); });
  });

  const h = model.home;
  if (h) {
    add('h.eyebrow', 'text', h.hero, 'eyebrow');
    h.hero.bullets.forEach((_, i) => add(`h.bullet${i}`, 'text', h.hero.bullets, i));
    add('h.help.title', 'text', h.help, 'title');
    h.help.left.forEach((_, i) => add(`h.help.l${i}`, 'inner', h.help.left, i));
    h.help.right.forEach((_, i) => add(`h.help.r${i}`, 'inner', h.help.right, i));
    add('h.serv.title', 'text', h.services, 'title');
    h.services.intro.forEach((_, i) => add(`h.serv.i${i}`, 'inner', h.services.intro, i));
    h.services.cards.forEach((c, i) => { add(`h.serv.c${i}.t`, 'text', c, 'title'); add(`h.serv.c${i}.x`, 'text', c, 'text'); });
    add('h.mission.title', 'text', h.mission, 'title');
    h.mission.intro.forEach((_, i) => add(`h.mission.i${i}`, 'inner', h.mission.intro, i));
    h.mission.boxes.forEach((c, i) => { add(`h.mission.b${i}.t`, 'text', c, 'title'); add(`h.mission.b${i}.x`, 'inner', c, 'text'); });
    h.sameDay.formText.forEach((_, i) => add(`h.same.f${i}`, 'inner', h.sameDay.formText, i));
    add('h.about.title', 'text', h.about, 'title');
    h.about.blocks.forEach((b, i) => { if (b.p) add(`h.about.p${i}`, 'inner', b, 'p'); });
    add('h.faq.title', 'text', h.faq, 'title');
    h.faq.intro.forEach((_, i) => add(`h.faq.i${i}`, 'inner', h.faq.intro, i));
    h.faq.items.forEach((f, i) => { add(`h.faq.q${i}`, 'text', f, 'q'); add(`h.faq.a${i}`, 'inner', f, 'a'); });
    add('h.family.title', 'text', h.family, 'title');
    h.family.paragraphs.forEach((_, i) => add(`h.family.p${i}`, 'inner', h.family.paragraphs, i));
  }
  return units;
}

// ---------- checks on one proposed change ----------
const words = (s) => plain(s).split(' ').filter(Boolean);
const hrefs = (s) => [...String(s).matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
const numbers = (s) => (plain(s).match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, '')).sort();
const count = (s, re) => (String(s).match(re) || []).length;

// word-level longest common subsequence ratio: 1 = identical, 0 = nothing in common
export function similarity(a, b) {
  const x = words(a).map((w) => w.toLowerCase()), y = words(b).map((w) => w.toLowerCase());
  if (!x.length && !y.length) return 1;
  const dp = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1));
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) dp[i][j] = x[i - 1] === y[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return (2 * dp[x.length][y.length]) / (x.length + y.length);
}

// loose: a re-write may change the wording much more than a copy edit (but never the facts, numbers, links or structure)
export function checkChange(kind, before, after, profile, { loose = false } = {}) {
  if (typeof after !== 'string' || !after.trim()) return 'empty';
  if (kind !== 'text') {
    if (JSON.stringify(hrefs(before)) !== JSON.stringify(hrefs(after))) return 'links changed';
    for (const re of [/<a\b/gi, /<li\b/gi, /<ul\b|<ol\b/gi, /<p\b/gi]) if (count(before, re) !== count(after, re)) return 'structure changed';
    if (/<(?!\/?(?:p|ul|ol|li|strong|em|b|i|br|a|blockquote)\b)[a-z]/i.test(after)) return 'unexpected markup';
  } else if (/[<>]/.test(after)) return 'markup in text';
  if (JSON.stringify(numbers(before)) !== JSON.stringify(numbers(after))) return 'numbers changed';
  const wb = words(before).length, wa = words(after).length;
  if (wa < wb * (loose ? 0.65 : 0.8) || wa > wb * (loose ? 1.45 : 1.25) + 2) return 'length changed too much';
  if (!loose && similarity(before, after) < (kind === 'text' ? 0.45 : 0.6)) return 'rewritten too heavily';
  const was = new Set(findClaims(plain(before), profile).map((c) => c.phrase));
  const added = findClaims(plain(after), profile).filter((c) => !was.has(c.phrase));
  if (added.length) return `adds a claim ("${added[0].phrase}")`;
  if (/https?:\/\/|@\w+\.\w+/.test(plain(after)) && !/https?:\/\/|@\w+\.\w+/.test(plain(before))) return 'adds a URL';
  return null;
}

// Cleans AI-returned html to the tags the units may contain, so nothing unsafe or unexpected can enter a page.
export function sanitizeUnit(kind, text) {
  if (kind === 'text') return plain(text);
  const $ = cheerio.load(`<div id="r">${text}</div>`, null, false);
  $('script,style,iframe,object').remove();
  $('#r *').each((_, el) => {
    const keep = el.name === 'a' ? ['href', 'target', 'rel', 'title'] : [];
    for (const a of Object.keys(el.attribs || {})) if (!keep.includes(a)) delete el.attribs[a];
  });
  return $('#r').html().trim();
}
