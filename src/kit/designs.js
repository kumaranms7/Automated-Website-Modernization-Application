// The kit designs. A design is a complete point of view: fonts, the shape language (corners, buttons, headings), the header and footer,
// and a blueprint for each kind of page naming, section by section, which layout variant to use. Roles are the kinds of section the
// content supplies (services, reviews, faq...); the same blueprint is filled with placeholder content for approval and with the
// website's own content afterwards.

import { NEW_DESIGNS } from './designs/index.js';

const R = (type, variant, extra = {}) => ({ type, variant, ...extra });

// the designs with layouts of their own come first (src/kit/designs), then the first six
export const DESIGNS = {
  ...NEW_DESIGNS,
  aurora: {
    id: 'aurora', name: 'Aurora', badge: 'Glass & gradient', blurb: 'Soft aurora gradients, glass cards and a floating pill header. Friendly, premium and very 2026.',
    fonts: { heading: 'Manrope', body: 'Inter' }, vars: { '--k-r': '1.5rem', '--k-r-btn': '999px', '--k-h-weight': '800', '--k-h-track': '-.035em' },
    header: 'pill', footer: 'dark', topbar: false,
    home: [R('hero', 'aurora'), R('trust', 'marquee'), R('services', 'bento'), R('about', 'image-right'), R('features', 'icon-grid'), R('steps', 'horizontal'), R('stats', 'dark'), R('reviews', 'featured'), R('faq', 'accordion'), R('areas', 'map'), R('cta', 'gradient')],
    inner: [R('about', 'image-right'), R('features', 'icon-grid'), R('steps', 'cards'), R('reviews', 'grid'), R('faq', 'sticky'), R('cta', 'gradient')],
    contact: [R('contact', 'form-map'), R('faq', 'accordion'), R('cta', 'gradient')],
  },
  bento: {
    id: 'bento', name: 'Bento', badge: 'Tiles & clarity', blurb: 'A modular bento hero with confident tiles, crisp cards and generous spacing. Organised and modern.',
    fonts: { heading: 'Poppins', body: 'Inter' }, vars: { '--k-r': '1.25rem', '--k-r-btn': '.9rem', '--k-h-weight': '700', '--k-h-track': '-.03em' },
    header: 'clean', footer: 'dark', topbar: false,
    home: [R('hero', 'bento'), R('trust', 'strip'), R('services', 'icon-cards'), R('about', 'image-left'), R('features', 'cards'), R('steps', 'cards'), R('stats', 'cards'), R('reviews', 'grid'), R('faq', 'grid'), R('areas', 'pills'), R('cta', 'center')],
    inner: [R('about', 'image-left'), R('features', 'cards'), R('steps', 'horizontal'), R('faq', 'accordion'), R('cta', 'center')],
    contact: [R('contact', 'cards'), R('faq', 'grid'), R('cta', 'center')],
  },
  midnight: {
    id: 'midnight', name: 'Midnight', badge: 'Dark spotlight', blurb: 'A dark spotlight hero with glowing accents and glass panels. Bold, technical and premium.',
    fonts: { heading: 'Manrope', body: 'Inter' }, vars: { '--k-r': '1.1rem', '--k-r-btn': '.8rem', '--k-h-weight': '800', '--k-h-track': '-.04em' },
    header: 'pill', footer: 'dark', topbar: false,
    home: [R('hero', 'spotlight'), R('trust', 'pills'), R('services', 'sticky'), R('steps', 'timeline'), R('stats', 'brand'), R('reviews', 'masonry'), R('about', 'quote'), R('faq', 'sticky'), R('cta', 'split')],
    inner: [R('about', 'story'), R('features', 'numbers'), R('steps', 'timeline'), R('faq', 'sticky'), R('cta', 'split')],
    contact: [R('contact', 'form-map'), R('cta', 'center')],
  },
  editorial: {
    id: 'editorial', name: 'Editorial', badge: 'Serif & whitespace', blurb: 'Oversized serif headlines, hairline rules and calm whitespace. Refined and timeless with a magazine feel.',
    fonts: { heading: 'DM Serif Display', body: 'Inter' }, vars: { '--k-r': '.5rem', '--k-r-btn': '.5rem', '--k-h-weight': '400', '--k-h-track': '-.02em' },
    header: 'center', footer: 'light', topbar: false,
    home: [R('hero', 'editorial'), R('trust', 'strip'), R('services', 'numbered'), R('about', 'story'), R('features', 'numbers'), R('stats', 'line'), R('reviews', 'featured'), R('faq', 'accordion'), R('areas', 'columns'), R('cta', 'banner')],
    inner: [R('about', 'story'), R('features', 'numbers'), R('faq', 'accordion'), R('cta', 'banner')],
    contact: [R('contact', 'minimal'), R('faq', 'accordion'), R('cta', 'banner')],
  },
  clarity: {
    id: 'clarity', name: 'Clarity', badge: 'Lead-first', blurb: 'A clean, conversion-focused layout with the quote form in the hero. Calm, trustworthy and fast to scan.',
    fonts: { heading: 'Inter', body: 'Inter' }, vars: { '--k-r': '1rem', '--k-r-btn': '.75rem', '--k-h-weight': '700', '--k-h-track': '-.035em' },
    header: 'clean', footer: 'light', topbar: true,
    home: [R('hero', 'form'), R('trust', 'strip'), R('services', 'image-cards'), R('about', 'image-right'), R('features', 'checks'), R('steps', 'timeline'), R('reviews', 'grid'), R('faq', 'accordion'), R('areas', 'columns'), R('cta', 'gradient')],
    inner: [R('about', 'image-right'), R('features', 'checks'), R('reviews', 'grid'), R('faq', 'accordion'), R('cta', 'split')],
    contact: [R('contact', 'form-map'), R('faq', 'grid'), R('cta', 'gradient')],
  },
  local: {
    id: 'local', name: 'Bold Local', badge: 'Big & confident', blurb: 'A full-bleed photo hero, big statistics and strong calls to action. Made for trades and local services.',
    fonts: { heading: 'Montserrat', body: 'Open Sans' }, vars: { '--k-r': '1rem', '--k-r-btn': '.7rem', '--k-h-weight': '800', '--k-h-track': '-.02em', '--k-h-case': 'uppercase' },
    header: 'clean', footer: 'dark', topbar: true,
    home: [R('hero', 'photo'), R('trust', 'pills'), R('services', 'icon-cards'), R('features', 'numbers'), R('stats', 'brand'), R('about', 'image-right'), R('reviews', 'featured'), R('faq', 'sticky'), R('areas', 'pills'), R('cta', 'banner')],
    inner: [R('about', 'image-left'), R('features', 'icon-grid'), R('steps', 'horizontal'), R('reviews', 'grid'), R('faq', 'sticky'), R('cta', 'banner')],
    contact: [R('contact', 'cards'), R('faq', 'accordion'), R('cta', 'banner')],
  },
};

export const DESIGN_IDS = Object.keys(DESIGNS);
// the designs a website can choose today. The others are kept only so that a template saved with one of them still draws.
export const OFFERED_IDS = DESIGN_IDS.filter((id) => DESIGNS[id].offered);
export const designById = (id) => DESIGNS[id] || DESIGNS.aurora;
