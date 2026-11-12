import { AREA_DIR, isHubFile } from './structure.js';

// Page-type heuristics. Per-client overrides live in client.json -> classify:
//   { utility: ["thank-you", ...], locationDirs: ["broward-service-areas"], hubs: ["local-plumber"], notHubs: [...], cityWord: "plumber", skip: ["regex"],
//     typeRules: [{ "dir": "resources", "type": "blog" }, { "match": "^lp-", "type": "service" }] }
// hints: what scanner/structure.js worked out from the website's own file names (the folders of city pages, the word that names a city page ...)
// page:  what was read from the page itself (structured data, headings, images, words); used when the name says nothing
//
// The kinds (see page-types.js): home, service, location-service (a service in a city), location-hub (a page that groups areas), location
// (the page of one place), blog, product, portfolio, gallery, faq, about, contact, utility.
const DEFAULT_UTILITY = [
  'thank-you', 'privacy', 'terms', 'disclaimer', 'sitemap', '404', 'schedule', 'landing-page',
];

// folder names and file names (whole words) that say what a page is
const BY_NAME = {
  blog: { dirs: ['blog', 'blogs', 'news', 'article', 'articles', 'post', 'posts', 'journal', 'insights', 'stories', 'press', 'updates'], files: ['blog', 'news', 'articles', 'journal', 'insights', 'press'], starts: ['blog', 'news', 'post'] },
  product: { dirs: ['product', 'products', 'shop', 'catalog', 'catalogue', 'store-products', 'merchandise'], files: ['product', 'products', 'shop', 'catalog', 'catalogue'], starts: ['product'] },
  portfolio: { dirs: ['portfolio', 'portfolios', 'project', 'projects', 'work', 'our-work', 'case-study', 'case-studies', 'showcase', 'recent-projects'], files: ['portfolio', 'projects', 'our-work', 'case-studies', 'showcase', 'recent-projects', 'work'], starts: ['portfolio', 'case-study'] },
  gallery: { dirs: ['gallery', 'galleries', 'photos', 'photo-gallery'], files: ['gallery', 'galleries', 'photos', 'photo-gallery', 'photo-galleries'], starts: ['gallery'] },
  faq: { dirs: ['faq', 'faqs'], files: ['faq', 'faqs', 'frequently-asked-questions', 'questions', 'common-questions'], starts: ['faq'] },
  about: { dirs: ['about', 'about-us', 'company'], files: ['about', 'about-us', 'our-story', 'who-we-are', 'our-team', 'team', 'meet-the-team', 'company', 'our-company', 'history', 'our-mission', 'mission'], starts: [] },
  contact: { dirs: ['contact', 'contact-us'], files: ['contact', 'contact-us', 'contacts', 'get-in-touch', 'reach-us', 'contact-form'], starts: [] },
  location: { dirs: [], files: ['location', 'our-location', 'directions', 'find-us', 'visit-us', 'store-locator'], starts: [] },
};
// the order matters: the first kind that fits is the kind
const ORDER = ['contact', 'faq', 'about', 'gallery', 'portfolio', 'product', 'blog', 'location'];

const wholeWord = (file, list) => list.includes(file);
function byName(dirs, file) {
  for (const type of ORDER) {
    const r = BY_NAME[type];
    if (wholeWord(file, r.files) || r.starts.some((s) => file === s || file.startsWith(s + '-'))) return type;
    if (dirs.some((d) => r.dirs.includes(d))) return type;
  }
  return null;
}

// what the page itself says, for a page whose name says nothing
function byContent(page) {
  if (!page) return null;
  const types = (page.schemaTypes || []).map((t) => String(t));
  // many service pages carry Product or Offer markup to get review stars: a product is a page that sells (Product markup and a cart, a stock line or a SKU)
  if (types.some((t) => /^(Product|ProductGroup)$/.test(t)) && /add to (cart|basket|bag)|buy now|checkout|in stock|\bsku\b/i.test(page.bodyText || '')) return 'product';
  if (types.some((t) => /^(BlogPosting|NewsArticle|Article)$/.test(t))) return 'blog';
  if (types.some((t) => /^(ImageGallery)$/.test(t))) return 'gallery';
  if (types.includes('ContactPage')) return 'contact';
  if (types.includes('AboutPage')) return 'about';
  // a page that is mostly questions
  const heads = [...(page.h2 || []), ...(page.h3 || [])];
  const questions = heads.filter((h) => /\?\s*$/.test(h)).length;
  if (questions >= 5 && questions >= heads.length * 0.6) return 'faq';
  // a page that is mostly pictures
  if ((page.images || []).length >= 12 && (page.wordCount || 0) < 120) return 'gallery';
  return null;
}

export function classify(relPath, cfg = {}, hints = {}, page = null) {
  const p = relPath.toLowerCase();
  const parts = p.split('/');
  const file = parts.at(-1).replace(/\.(html?|php|shtml)$/, '');
  const dirs = parts.slice(0, -1);

  if (p === 'index.html' || p === 'index.php') return 'home';
  // what the website's own settings say comes first
  for (const r of cfg.typeRules || []) {
    if ((r.dir && dirs.includes(String(r.dir).toLowerCase())) || (r.match && new RegExp(r.match, 'i').test(p)) || (r.file && file === String(r.file).toLowerCase())) return r.type;
  }
  const locDirs = new Set([...(cfg.locationDirs || []), ...(hints.locationDirs || [])].map((d) => String(d).toLowerCase()));
  const inAreaDir = dirs.some((d) => locDirs.has(d) || AREA_DIR.test(d));
  // a folder of places: cities with services when the file names say so, else one page for each place
  if (inAreaDir) return hints.cityWord || (cfg.locationDirs || []).length ? 'location-service' : 'location';
  if ((cfg.utility || DEFAULT_UTILITY).some((u) => file.includes(u))) return 'utility';
  const named = byName(dirs, file);
  if (named) return named;
  if (isHubFile(file, cfg, hints)) return 'location-hub';
  return byContent(page) || 'service';
}

export function isSkipped(relPath, cfg = {}) {
  const p = relPath.toLowerCase();
  if (/ - copy|-copy|\.bak|~$/.test(p)) return 'backup-copy';
  if (/(^|\/)(seo_report|canonical_injector_report)/.test(p)) return 'tool-report';
  return (cfg.skip || []).some((r) => new RegExp(r, 'i').test(p)) ? 'client-skip' : null;
}
