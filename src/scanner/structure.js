// How a website is laid out, worked out from its own file names. Nothing here knows about a trade, a city or a company.
//
// A local-service website usually has folders of city pages (/service-areas/boca-raton-plumber.html is the page of the city,
// /service-areas/boca-raton-backflow-repair.html is a service in that city), and hub pages that group the cities (/broward-plumber.html).
// What is looked for:
//   locationDirs     the folders that hold city pages: named like service areas / locations, or recognised by their file names
//   cityWord         the word that names a city's own page ("plumber" in boca-raton-plumber.html)
//   hubWords         the endings that make a page a hub (service-areas, locations ... and the city word)
//   serviceSuffixes  the words that end the pages of a service in a city (repair, installation ...)
//   placeStems       the names of the groups of cities (a folder broward-service-areas is the group "broward")
// Anything found can be changed for a website in client.json -> classify: locationDirs, cityWord, hubs, notHubs, notServices, stopWords.

export const AREA_DIR = /(^|-)(service-areas?|service-locations?|locations?|cities|areas-served|areas-we-serve)$/;
export const DEFAULT_HUB_WORDS = ['service-area', 'service-areas', 'service-location', 'service-locations', 'location', 'locations', 'areas-served', 'areas-we-serve', 'cities', 'counties'];
// pages of almost every website that are not a service
export const DEFAULT_NOT_SERVICE = /(^|\/)(index|contact|contact-us|financing|recent-projects|projects|gallery|reviews|testimonials|faq|faqs|blog|news|about|about-us|careers|coupons?|specials?|discounts?|residential-and-commercial|commercial-and-residential)(-|\.|$)|(^|-)discounts?\.html$/;

const PAGE = /\.(html?|shtml|php)$/i;
const stemOf = (f) => f.replace(PAGE, '');
const tok = (s) => s.split('-').filter(Boolean);
export const areaStem = (dir) => dir.replace(/-?(service-areas?|service-locations?|locations?|cities|areas-served|areas-we-serve)$/, '');

// the city pages of one folder: a name prefix that is shared by several pages and has a page of its own, one word after the prefix
function cityNodes(stems) {
  const toks = stems.map(tok);
  const kids = new Map(); // prefix -> Set of next words
  const ends = new Map(); // prefix -> Set of next words that finish a page
  const longer = new Set(); // prefixes that other pages continue
  for (const t of toks) {
    for (let l = 1; l < t.length; l += 1) {
      const key = t.slice(0, l).join('-');
      if (!kids.has(key)) { kids.set(key, new Set()); ends.set(key, new Set()); }
      kids.get(key).add(t[l]);
      if (l + 1 === t.length) ends.get(key).add(t[l]); else longer.add(t.slice(0, l + 1).join('-'));
    }
  }
  const nodes = [];
  for (const [key, set] of [...kids.entries()].sort((a, b) => a[0].split('-').length - b[0].split('-').length)) {
    // the shortest prefix wins: "west" is not a city when "west-palm-beach" is
    if (nodes.some((n) => key === n.prefix || key.startsWith(n.prefix + '-'))) continue;
    const leaves = [...ends.get(key)].filter((w) => !longer.has(`${key}-${w}`));
    if (set.size >= 2 && leaves.length) nodes.push({ prefix: key, leaves });
  }
  return nodes;
}

const commonest = (list) => { const n = {}; for (const w of list) n[w] = (n[w] || 0) + 1; return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };

// paths: every page path of the website (relative, with /); cfg: client.json -> classify
export function detectStructure(paths, cfg = {}) {
  const pages = paths.map((p) => String(p).replace(/\\/g, '/').toLowerCase()).filter((p) => PAGE.test(p));
  const byDir = new Map();
  for (const p of pages) { const i = p.indexOf('/'); if (i > 0) { const d = p.slice(0, i); if (!byDir.has(d)) byDir.set(d, []); byDir.get(d).push(p.slice(i + 1)); } }

  const notes = [];
  const locationDirs = new Set((cfg.locationDirs || []).map((d) => String(d).toLowerCase()));
  for (const d of byDir.keys()) if (AREA_DIR.test(d)) locationDirs.add(d);

  // a folder with an unusual name is a folder of cities when its file names say so
  const nodesOf = (d) => cityNodes((byDir.get(d) || []).filter((f) => !f.includes('/')).map(stemOf));
  for (const [d, files] of byDir) {
    if (locationDirs.has(d) || files.length < 8) continue;
    const nodes = nodesOf(d);
    const word = commonest(nodes.flatMap((n) => n.leaves))[0];
    if (!word || word[1] < 3) continue;
    const covered = files.filter((f) => nodes.some((n) => stemOf(f).startsWith(n.prefix + '-'))).length;
    if (covered / files.length >= 0.6) { locationDirs.add(d); notes.push(`The folder "${d}" holds city pages (recognised from its file names).`); }
  }

  const allNodes = [...locationDirs].flatMap((d) => nodesOf(d));
  // when two words tie (every city has "<city>-roofer" and "<city>-gutters"), the one that also ends a page outside the folders wins (a hub "<place>-roofer"), and a word that is a page of its own ("gutters.html") loses
  const rootEnds = (w) => pages.filter((p) => !p.includes('/') && stemOf(p).endsWith('-' + w)).length;
  const rootIs = (w) => pages.some((p) => !p.includes('/') && stemOf(p) === w);
  const wordCounts = commonest(allNodes.flatMap((n) => n.leaves)).sort((a, b) => b[1] - a[1] || rootEnds(b[0]) - rootEnds(a[0]) || Number(rootIs(a[0])) - Number(rootIs(b[0])) || a[0].localeCompare(b[0]));
  let cityWord = cfg.cityWord ? String(cfg.cityWord).toLowerCase() : '';
  if (!cityWord && wordCounts[0] && wordCounts[0][1] >= 2 && wordCounts[0][1] >= allNodes.length * 0.4) cityWord = wordCounts[0][0];
  // a website with a single city: the word is accepted when pages outside the folders end with it too (the hub "<place>-<word>.html")
  if (!cityWord && wordCounts[0] && wordCounts[0][0].length >= 4) {
    const rootEnds = pages.filter((p) => !p.includes('/') && stemOf(p).endsWith('-' + wordCounts[0][0])).length;
    if (rootEnds >= 1) cityWord = wordCounts[0][0];
  }
  if (cityWord) notes.push(`A city's own page ends with "-${cityWord}" (for example ${allNodes.find((n) => n.leaves.includes(cityWord))?.prefix || 'city'}-${cityWord}.html).`);

  // the page of each city: <folder>/<city>-<city word>.html
  const cityPages = [];
  if (cityWord) for (const d of locationDirs) for (const n of nodesOf(d)) if (n.leaves.includes(cityWord)) cityPages.push(`${d}/${n.prefix}-${cityWord}.html`);

  // the endings of the pages of a service in a city
  const tails = [];
  for (const d of locationDirs) for (const f of (byDir.get(d) || []).filter((x) => !x.includes('/')).map(stemOf)) {
    const t = tok(f), last = t.at(-1);
    if (last && last !== cityWord && t.length > 2) tails.push(last);
  }
  const serviceSuffixes = commonest(tails).filter(([, n]) => n >= 2).map(([w]) => w).slice(0, 24);

  const placeStems = [...locationDirs].map(areaStem).filter(Boolean);
  const hubWords = [...new Set([...DEFAULT_HUB_WORDS, ...(cityWord ? [cityWord] : [])])];
  return {
    locationDirs: [...locationDirs].sort(), cityWord, hubWords, serviceSuffixes, placeStems: [...new Set(placeStems)].sort(),
    cities: cityPages.length, cityPages, notes,
  };
}

// is a root page a hub (a page that groups cities or service areas)?
export function isHubFile(file, cfg = {}, h = {}) {
  if ((cfg.hubs || []).includes(file)) return true;
  if ((cfg.notHubs || []).includes(file)) return false;
  const ends = (w) => file === w || file.endsWith('-' + w);
  if (DEFAULT_HUB_WORDS.some(ends)) return true;
  if (h.cityWord && ends(h.cityWord)) return !tok(file).some((t) => (h.serviceSuffixes || []).includes(t));
  return false;
}
