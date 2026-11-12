import path from 'node:path';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';
import { detectStructure, areaStem, DEFAULT_NOT_SERVICE } from '../scanner/structure.js';

// Site graph: which pages are cities, services and city+service combinations.
// Built from scan results (no AI) so internal linking and prompts use real, existing URLs.
// Nothing here is written for one trade or one website: the words that name a city page, a hub or the ending of a service come from
// scanner/structure.js (the website's own file names), and a website can correct them in client.json -> classify.

const BASE_STOP = ['and', 'the', 'of', 'in', 'for', 'a', 'to', 'services', 'service', 'near', 'me'];
export const tokens = (s) => String(s || '').toLowerCase().replace(/&amp;|&/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
const titleCase = (slug) => slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// hints: the structure of the website (scanner/structure.js); cfg: client.json -> classify
export function buildGraph(pages, hints = detectStructure(pages.map((p) => p.path)), cfg = {}) {
  const byPath = Object.fromEntries(pages.map((p) => [p.path, p]));
  const label = (p) => (p.h1?.[0] || p.title || p.path).replace(/\s+/g, ' ').trim();
  const cityWord = hints.cityWord || '';
  const stop = new Set([...BASE_STOP, ...(cityWord ? [cityWord] : []), ...(hints.serviceSuffixes || []), ...(cfg.stopWords || []).map((w) => String(w).toLowerCase())]);
  const core = (s) => tokens(s).filter((t) => !stop.has(t));

  // Cities come from "<city>-<city word>.html" files inside the folders of city pages.
  const cityRx = cityWord ? new RegExp(`^([^/]+)/(.+)-${escapeRe(cityWord)}\\.html?$`) : null;
  // the cities the structure found; a page that merely ends with the same word ("boca-raton-cast-iron-pipe-plumber") is a service in a city
  const cityPages = new Set((hints.cityPages || []).map((x) => x.toLowerCase()));
  const cities = {};
  for (const p of pages) {
    const m = cityRx && p.type === 'location-service' && (!cityPages.size || cityPages.has(p.path.toLowerCase())) ? p.path.match(cityRx) : null;
    if (!m) continue;
    cities[`${m[1]}/${m[2]}`] = { slug: m[2], dir: m[1], county: areaStem(m[1]), name: titleCase(m[2]), hub: p.path, pages: [] };
  }

  // Root-level service pages; a city's landing page (boca-raton-something.html) and the usual non-service pages are not services.
  const citySlugs = Object.values(cities).map((c) => c.slug);
  const extraNot = (cfg.notServices || []).map((x) => String(x).toLowerCase().replace(/\.html?$/, ''));
  const isCityLanding = (file) => citySlugs.some((s) => file === s || file.startsWith(s + '-'));
  const notService = (p) => {
    const file = path.posix.basename(p).replace(/\.[a-z]+$/i, '').toLowerCase();
    return DEFAULT_NOT_SERVICE.test(p.toLowerCase()) || extraNot.includes(file) || isCityLanding(file);
  };
  const services = pages.filter((p) => p.type === 'service' && !p.path.includes('/') && !notService(p.path));
  // a word in most of the service pages' names ("plumbing" on a plumbing website) tells one service from another nothing
  if (services.length >= 6) {
    const seen = {};
    for (const p of services) for (const t of new Set(tokens(p.path.replace(/\.[a-z]+$/i, '')))) seen[t] = (seen[t] || 0) + 1;
    for (const [t, n] of Object.entries(seen)) if (n >= services.length * 0.45) stop.add(t);
  }
  const serviceList = services.map((p) => ({ path: p.path, label: label(p), core: core(p.path.replace(/\.[a-z]+$/i, '') + ' ' + label(p)) }));

  const matchService = (rest) => {
    const t = core(rest);
    let best = null, score = 0;
    for (const s of serviceList) {
      const inter = t.filter((x) => s.core.includes(x)).length;
      const sc = inter / (new Set([...t, ...s.core]).size || 1);
      if (inter && sc > score) { score = sc; best = s; }
    }
    return best;
  };

  const combos = [];
  for (const p of pages) {
    if (p.type !== 'location-service' || Object.values(cities).some((c) => c.hub === p.path)) continue;
    const dir = p.path.split('/')[0];
    const file = p.path.split('/').pop().replace(/\.html?$/, '');
    const cand = Object.values(cities).filter((c) => c.dir === dir && (file === c.slug || file.startsWith(c.slug + '-'))).sort((a, b) => b.slug.length - a.slug.length)[0];
    if (!cand) continue;
    const rest = file.slice(cand.slug.length + 1);
    const svc = matchService(rest);
    const combo = { path: p.path, city: `${cand.dir}/${cand.slug}`, rest, service: svc?.path || null, label: label(p) };
    combos.push(combo);
    cand.pages.push(p.path);
  }

  // Hubs that group the cities of one place (a folder "broward-service-areas" is the group "broward"; its hub is "broward-<city word>.html").
  const stems = new Set(Object.values(cities).map((c) => c.county).filter(Boolean));
  const hubs = pages.filter((p) => p.type === 'location-hub');
  const named = hubs.filter((p) => [...stems].some((s) => p.path.startsWith(s + '-') || p.path.startsWith(s + '.')));
  const countyHubs = (named.length ? named : hubs).map((p) => ({ path: p.path, label: label(p) }));
  return { cities, services: serviceList, combos, countyHubs, stop: [...stop], labels: Object.fromEntries(pages.map((p) => [p.path, label(p)])), byPath: Object.keys(byPath) };
}

export async function loadGraph(slug) {
  const file = path.join(clientDir(slug), 'graph.json');
  const cached = await readJson(file);
  const scan = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const cfg = (await loadClient(slug))?.classify || {};
  const hints = detectStructure(scan.map((p) => p.path), cfg);
  const sig = JSON.stringify([hints, cfg.notServices || [], cfg.stopWords || []]);
  if (cached && cached.scanned === scan.length && cached.sig === sig) return cached.graph;
  const graph = buildGraph(scan, hints, cfg);
  await writeJson(file, { scanned: scan.length, sig, graph });
  return graph;
}

// Internal links for a page, always pointing at pages that exist.
export function relatedLinks(graph, pagePath, extraHrefs = []) {
  const stopSet = new Set(graph.stop || BASE_STOP);
  const core = (s) => tokens(s).filter((t) => !stopSet.has(t));
  const L = graph.labels;
  const out = [];
  const add = (group, p) => p && p !== pagePath && L[p] && out.push({ group, path: p, text: L[p] });
  const combo = graph.combos.find((c) => c.path === pagePath);

  if (combo) {
    const city = graph.cities[combo.city];
    const mine = graph.combos.filter((c) => c.city === combo.city && c.path !== pagePath);
    add('city', city.hub);
    if (combo.service) add('service', combo.service);
    mine.slice(0, 8).forEach((c) => add('same-city', c.path));
    graph.combos
      .filter((c) => c.service && c.service === combo.service && c.city !== combo.city && graph.cities[c.city].county === city.county)
      .sort((a, b) => Number(b.rest === combo.rest) - Number(a.rest === combo.rest))
      .slice(0, 8).forEach((c) => add('same-service', c.path));
    graph.countyHubs.filter((h) => h.path.startsWith(city.county)).forEach((h) => add('county', h.path));
  } else if (graph.services.some((s) => s.path === pagePath)) {
    const me = graph.services.find((s) => s.path === pagePath);
    graph.services.filter((s) => s.path !== pagePath)
      .map((s) => ({ s, sc: s.core.filter((t) => me.core.includes(t)).length }))
      .sort((a, b) => b.sc - a.sc).slice(0, 6).forEach(({ s }) => add('related-service', s.path));
    graph.countyHubs.forEach((h) => add('county', h.path));
  } else if (graph.services.length) {
    graph.services.slice(0, 8).forEach((s) => add('service', s.path));
  } else {
    // Unknown naming scheme: link to the pages in the same folder that share the most words with this one.
    const dir = path.posix.dirname(pagePath);
    const mine = core(path.posix.basename(pagePath).replace(/\.[a-z]+$/, ''));
    graph.byPath
      .filter((p) => p !== pagePath && path.posix.dirname(p) === dir && L[p])
      .map((p) => ({ p, sc: core(path.posix.basename(p).replace(/\.[a-z]+$/, '')).filter((t) => mine.includes(t)).length }))
      .filter((x) => x.sc > 0).sort((x, y) => y.sc - x.sc).slice(0, 8)
      .forEach((x) => add('related-service', x.p));
  }

  const seen = new Set();
  return out.filter((l) => !seen.has(l.path) && seen.add(l.path));
}
