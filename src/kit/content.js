import { packFor, packById, PACK_IDS } from './packs.js';

// Placeholder content for the kit: what a template is first drawn with, so the design can be judged and approved before it is fitted to
// the website's own content. It is built from the Business Profile (name, phone, address, services, areas) and the business-type pack.
// The result is { site, pack, data }: `data` maps each role (hero, services, reviews, faq...) to the section content the renderers take.

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const city = (p) => clean(p.facts?.city || (p.nap?.address || '').split(',').slice(-2, -1)[0]) || '';

export function siteFor(profile = {}, client = {}) {
  const nap = profile.nap || {};
  const f = profile.facts || {};
  const name = clean(nap.name || profile.brand || client.name || 'Your Business');
  const phone = clean(nap.phone || f.phone || '');
  const digits = phone.replace(/\D/g, '');
  const address = clean(nap.address || [f.street, f.city, f.region, f.postal].filter(Boolean).join(', '));
  return {
    name, phone: digits ? { display: phone, digits } : null, address, email: clean(f.email || ''), city: city(profile),
    logo: '', ctaLabel: 'Get a free quote', ctaHref: '#quote', ctaTitle: '', hours: Array.isArray(f.hours) && f.hours[1] ? `${f.hours[0]}: ${f.hours[1]}` : '',
    blurb: '',
  };
}

export function nav(current = '') {
  return [['Home', '/'], ['Services', '/#services'], ['About', '/#about'], ['Reviews', '/#reviews'], ['Contact', '/contact.html']].map(([label, href]) => ({ label, href, current: label === current }));
}

const obj = (rows, keys) => rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]])));

// packId: the business type chosen by hand; without it the type is read from the profile
export function placeholderContent(profile = {}, client = {}, packId = '') {
  const pack = PACK_IDS.includes(packId) ? packById(packId) : packFor(profile);
  const site = siteFor(profile, client);
  const where = site.city ? ` in ${site.city}` : '';
  // the business's own services, when the profile lists them, take the place of the pack's (keeping the pack's icons and wording of the rest)
  const own = (profile.services || profile.whatWeDo || []).map(clean).filter(Boolean).slice(0, 6);
  const services = pack.services.map(([title, icon, text], i) => (own[i] ? { title: own[i], text: `Professional ${own[i].toLowerCase()}${where}, with clear pricing, careful work and a team that stands behind it.`, href: '#' } : { title, text, icon, href: '#' }));
  const areas = (profile.serviceAreas || []).map(clean).filter(Boolean);
  const areaList = areas.length ? areas.slice(0, 16) : [site.city || 'Downtown', 'Northside', 'Westfield', 'Riverbend', 'Lakeview', 'Hillcrest', 'Oakwood', 'Eastgate', 'Harborview', 'Maple Heights'];
  const data = {
    hero: { eyebrow: pack.eyebrow, h1: pack.hero[0], lead: pack.hero[1] + (where ? ` Proudly serving${where} and nearby.` : ''), image: null },
    trust: { items: pack.trust.map(([title, icon]) => ({ title, icon })) },
    services: { eyebrow: 'What we do', title: 'Services built around you', lead: 'Everything you need from one trusted team, delivered properly the first time.', items: services },
    about: { eyebrow: `About ${site.name}`, title: `A local team that takes pride in the work`, blocks: [{ t: 'html', html: `<p>${site.name} is a locally owned business known for honest advice, careful work and a straightforward way of doing things. We are here to make a job easier, not harder.</p>` }, { t: 'html', html: '<p>Every project is handled by experienced people who treat your space and your time with respect, and every job is backed by our promise to make it right.</p>' }], items: pack.benefits.slice(0, 4).map(([title]) => ({ title })) },
    features: { eyebrow: 'Why choose us', title: 'The difference you will notice', lead: 'Small details done consistently are what customers remember.', items: pack.benefits.map(([title, icon, text]) => ({ title, icon, text })) },
    steps: { eyebrow: 'Simple process', title: 'How it works', lead: 'Four easy steps from first call to finished job.', items: pack.steps.map(([title, icon, text]) => ({ title, icon, text })) },
    stats: { items: pack.stats.map(([value, label]) => ({ value, label })) },
    reviews: { eyebrow: 'Reviews', title: 'Loved by customers', lead: 'Real feedback from the people we have helped.', items: obj(pack.reviews, ['quote', 'name', 'place']) },
    faq: { eyebrow: 'FAQ', title: 'Questions, answered', lead: 'Quick answers to what people ask us most.', items: obj(pack.faqs, ['q', 'a']) },
    areas: { eyebrow: 'Service area', title: `Areas we serve${where}`, lead: 'Fast, local service across the region.', groups: [{ title: `Areas we serve${where}`, links: areaList.map((text) => ({ text })) }] },
    gallery: { eyebrow: 'Our work', title: 'Recent projects', items: [] },
    pricing: {}, team: {}, blog: {}, compare: {}, map: {},
    tabs: { eyebrow: 'Our services', title: 'Everything we offer', lead: 'Browse what we do, one service at a time.', items: pack.services.slice(0, 4).map(([title, ic, text]) => ({ title, icon: ic, text, bullets: pack.benefits.slice(0, 3).map((b) => b[0]) })) },
    cta: { title: `Ready to get started${where ? where : ''}?`, text: 'Call us or request a free quote and we will reply today. Friendly advice, a clear price and no pressure.' },
    contact: { eyebrow: 'Contact', title: 'We would love to hear from you', lead: 'Call, message or send a request. A real person replies fast.', items: [] },
  };
  // the other pages
  const inner = { hero: { h1: services[0].title + where, lead: services[0].text + ' Clear pricing and a team that stands behind the work.', crumbs: [{ text: 'Home', href: '/' }, { text: 'Services', href: '/#services' }, { text: services[0].title }] }, data: { ...data, about: { ...data.about, eyebrow: services[0].title, title: `${services[0].title}, done properly`, img: null } } };
  const contact = { hero: { h1: 'Contact us', lead: 'Tell us about your project and we will reply within one business day.', crumbs: [{ text: 'Home', href: '/' }, { text: 'Contact' }] }, data };
  return { site, pack, data, pages: { home: { hero: data.hero, data }, inner, contact } };
}
