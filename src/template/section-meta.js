// The catalogue of page sections: what kinds exist, which layout styles each one has, and which design properties can be
// set on a section. The renderer, the studio (variants, library, composer) and the portal all read this one list.

export const HERO_STYLES = ['gradient', 'split', 'centered', 'light', 'photo', 'dark', 'editorial'];

export const SECTION_TYPES = {
  hero:      { label: 'Hero',                variant: HERO_STYLES, group: 'hero' },
  offers:    { label: 'Offers bar',          variant: ['band'], group: 'trust' },
  tiles:     { label: 'Trust indicators',    variant: ['strip', 'cards', 'pills'], group: 'trust' },
  prose:     { label: 'About / introduction', variant: ['stacked', 'story', 'centered'], group: 'about' },
  split:     { label: 'Image and text',      variant: ['image-right', 'image-left'], group: 'about' },
  features:  { label: 'Benefits',            variant: ['checks', 'icons'], group: 'benefits' },
  cardgrid:  { label: 'Services and cards',  variant: ['grid', 'list'], group: 'services' },
  iconcards: { label: 'Quick links',         variant: ['grid'], group: 'services' },
  stats:     { label: 'Statistics',          variant: ['boxes', 'inline'], group: 'stats' },
  reviews:   { label: 'Testimonials',        variant: ['grid', 'featured', 'stacked'], group: 'testimonials' },
  faq:       { label: 'FAQ',                 variant: ['accordion', 'split'], group: 'faq' },
  listform:  { label: 'Lead form',           variant: ['split'], group: 'forms' },
  areas:     { label: 'Service areas',       variant: ['columns', 'pills'], group: 'areas' },
  contact:   { label: 'Contact details',     variant: ['band'], group: 'contact' },
  cta:       { label: 'Call to action',      variant: ['band', 'centered', 'split'], group: 'cta' },
};

// groups shown in the library filter (header and footer are not page sections but are part of the library)
export const LIBRARY_GROUPS = [
  ['header', 'Header'], ['hero', 'Hero'], ['trust', 'Trust indicators'], ['services', 'Services'], ['about', 'About'], ['benefits', 'Benefits'],
  ['stats', 'Statistics'], ['testimonials', 'Testimonials'], ['faq', 'FAQ'], ['forms', 'Lead forms'], ['areas', 'Service areas'], ['contact', 'Contact'], ['cta', 'Call to action'], ['footer', 'Footer'],
];

export const SECTION_PROPS = {
  bg: ['auto', 'white', 'soft', 'dark', 'brand'],
  align: ['auto', 'left', 'center'],
  spacing: ['tight', 'normal', 'loose'],
  head: ['inherit', 'left', 'center', 'bar'],
  cards: ['inherit', 'image', 'icon', 'numbered', 'overlay'],
  frame: ['plain', 'rounded', 'offset'],
};

export const HEADER_STYLES = ['classic', 'centered', 'minimal'];
export const FOOTER_STYLES = ['dark', 'brand', 'light'];

// "cardgrid:1" -> "cardgrid"; "hero" -> "hero"
export const typeOfRef = (ref) => String(ref).split(':')[0];
export const defaultVariant = (type) => (type === 'hero' ? '' : SECTION_TYPES[type]?.variant[0] || '');

// which properties are worth showing for a kind of section (the inspector shows only these)
export const PROPS_FOR = {
  hero: ['variant'],
  tiles: ['variant', 'bg', 'spacing'],
  prose: ['variant', 'bg', 'align', 'spacing', 'head'],
  split: ['variant', 'bg', 'spacing', 'head', 'frame'],
  features: ['variant', 'bg', 'align', 'spacing', 'head'],
  cardgrid: ['variant', 'bg', 'align', 'spacing', 'head', 'cards'],
  iconcards: ['bg', 'spacing', 'head'],
  stats: ['variant', 'bg', 'spacing'],
  reviews: ['variant', 'bg', 'align', 'spacing', 'head'],
  faq: ['variant', 'bg', 'spacing', 'head'],
  listform: ['bg', 'spacing', 'head'],
  areas: ['variant', 'bg', 'spacing', 'head'],
  contact: ['bg', 'spacing'],
  cta: ['variant', 'spacing'],
  offers: [],
};
