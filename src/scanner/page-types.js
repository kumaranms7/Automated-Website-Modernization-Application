// The kinds of page the platform tells apart, and how each is treated. One table, so a new kind of page is one new row.
//   label     the name shown in tables and the report
//   thin      fewer words than this is a "thin page" in the audit (0: never flagged, the page is not made of words)
//   words     the length of wording the AI is asked to write when it writes a whole page
//   ai        what the content step may do: 'rewrite' (a whole page may be written again), 'enhance' (its own words are improved, nothing is
//             invented), false (the page is never changed by the AI)
//   related   the page gets the "related pages" links
//   plain     a page made of functions, not copy (contact, privacy): left out of duplicate and thin checks
//   schema    the kind of page markup it gets when it has none (see head/schema.js)
//   badge     colours in the report
export const PAGE_TYPES = {
  home:               { label: 'Home', thin: 400, words: [350, 800], ai: 'enhance', related: false, plain: false, schema: 'home', badge: 'emerald' },
  service:            { label: 'Service', thin: 350, words: [650, 1000], ai: 'rewrite', related: true, plain: false, schema: 'Service', badge: 'purple' },
  'location-service': { label: 'Service in a city', thin: 300, words: [450, 750], ai: 'rewrite', related: true, plain: false, schema: 'Service', badge: 'sky' },
  'location-hub':     { label: 'Area hub', thin: 300, words: [450, 800], ai: 'rewrite', related: true, plain: false, schema: 'CollectionPage', badge: 'indigo' },
  location:           { label: 'Location', thin: 200, words: [250, 700], ai: 'enhance', related: true, plain: false, schema: 'WebPage', badge: 'cyan' },
  blog:               { label: 'Blog', thin: 300, words: [600, 1500], ai: 'enhance', related: true, plain: false, schema: 'Article', badge: 'amber' },
  product:            { label: 'Product', thin: 80, words: [150, 600], ai: 'enhance', related: true, plain: false, schema: 'WebPage', badge: 'rose' },
  portfolio:          { label: 'Portfolio', thin: 80, words: [150, 700], ai: 'enhance', related: true, plain: false, schema: 'WebPage', badge: 'orange' },
  gallery:            { label: 'Gallery', thin: 0, words: [0, 400], ai: false, related: false, plain: false, schema: 'WebPage', badge: 'pink' },
  faq:                { label: 'FAQ', thin: 150, words: [300, 1000], ai: 'enhance', related: true, plain: false, schema: 'WebPage', badge: 'teal' },
  about:              { label: 'About', thin: 200, words: [300, 900], ai: 'enhance', related: false, plain: false, schema: 'AboutPage', badge: 'lime' },
  contact:            { label: 'Contact', thin: 0, words: [0, 400], ai: false, related: false, plain: true, schema: 'ContactPage', badge: 'slate' },
  utility:            { label: 'Utility', thin: 0, words: [0, 600], ai: false, related: false, plain: true, schema: 'WebPage', badge: 'slate' },
};

export const TYPE_IDS = Object.keys(PAGE_TYPES);
const info = (t) => PAGE_TYPES[t] || PAGE_TYPES.service;
export const typeLabel = (t) => (PAGE_TYPES[t] ? PAGE_TYPES[t].label : String(t));
export const isPlainType = (t) => Boolean(PAGE_TYPES[t]?.plain);
export const relatedFor = (t) => Boolean(PAGE_TYPES[t]?.related);
// every kind of page is rebuilt with the template
export const buildTypes = () => TYPE_IDS.slice();
// the kinds the content step may touch (home is handled by its own rule in planPages)
export const aiTypes = () => TYPE_IDS.filter((t) => PAGE_TYPES[t].ai && t !== 'home');
export const aiLevel = (t) => (PAGE_TYPES[t] ? PAGE_TYPES[t].ai : 'rewrite');
// the thin-page limit; a kind not in the table has none, a kind with 0 is never flagged
export const thinLimit = (t) => (PAGE_TYPES[t] ? PAGE_TYPES[t].thin : 0);
export const schemaKind = (t) => info(t).schema;

// the longest the wording of a kind may go on, and the table the old code called WORD_TARGETS
export const WORD_TARGETS = { ...Object.fromEntries(TYPE_IDS.map((t) => [t, PAGE_TYPES[t].words])), default: [350, 800] };

// the whole table for the browser (/api/page-types)
export const typesForUi = () => TYPE_IDS.map((id) => ({ id, label: PAGE_TYPES[id].label, badge: PAGE_TYPES[id].badge, plain: PAGE_TYPES[id].plain }));
