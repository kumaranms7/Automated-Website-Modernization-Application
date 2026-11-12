// Style directions. Each one is a starting point inspired by a kind of business, expressed only through the options the
// renderer supports. The AI (or a person) picks one by what the business is, then adapts it to the brand's own colours
// and content. Colours are never taken from here: they always come from the client's logo and site.

export const ARCHETYPES = {
  'home-services': {
    label: 'Local home services',
    for: 'plumbing, roofing, garage doors, electrical, HVAC, pest control, cleaning and similar trades',
    feel: 'Trustworthy and direct. A confident hero with a phone or estimate call to action, a credibility strip, service cards, benefits and reviews.',
    tokens: { fontHeading: 'Montserrat', fontBody: 'Open Sans', headingCase: 'none', headingWeight: 800, radius: 'md', shadow: 'soft', density: 'comfortable', container: 'normal' },
    layout: { header: 'classic', topbar: true, hero: 'photo', sections: 'alternating', cards: 'shadow', cardLayout: 'icon', sectionHead: 'left', footer: 'dark', contactLayout: 'split', innerForm: 'side', homeStyle: 'showcase' },
  },
  'bold-contractor': {
    label: 'Bold contractor and equipment services',
    for: 'junk removal, dumpsters, hauling, construction, demolition, excavation, towing',
    feel: 'Heavy, high contrast, big type and big photos. Clearly separated service blocks and a very visible quote button.',
    tokens: { fontHeading: 'Oswald', fontBody: 'Work Sans', headingCase: 'uppercase', headingWeight: 700, radius: 'sm', shadow: 'medium', density: 'spacious', container: 'wide' },
    layout: { header: 'classic', topbar: true, hero: 'dark', sections: 'alternating', cards: 'outline', cardLayout: 'overlay', sectionHead: 'bar', footer: 'dark', contactLayout: 'split', innerForm: 'side', homeStyle: 'showcase' },
  },
  enterprise: {
    label: 'Enterprise and technology',
    for: 'IT, cybersecurity, SaaS, managed services, software and B2B companies',
    feel: 'Clean, sophisticated and spacious. A strong value proposition, structured solution sections and a consultation call to action.',
    tokens: { fontHeading: 'Manrope', fontBody: 'Inter', headingCase: 'none', headingWeight: 700, radius: 'md', shadow: 'soft', density: 'spacious', container: 'wide' },
    layout: { header: 'classic', topbar: false, hero: 'editorial', sections: 'flat', cards: 'flat', cardLayout: 'icon', sectionHead: 'center', footer: 'brand', contactLayout: 'split', innerForm: 'side', homeStyle: 'story' },
  },
  lifestyle: {
    label: 'Lifestyle and personal services',
    for: 'pet services, coaching, wellness, salons, studios, tutoring and other relationship-led businesses',
    feel: 'Warm and approachable. Soft shapes, generous space, authentic photography and a friendly booking call to action.',
    tokens: { fontHeading: 'Playfair Display', fontBody: 'Nunito', headingCase: 'none', headingWeight: 600, radius: 'xl', shadow: 'soft', density: 'spacious', container: 'normal' },
    layout: { header: 'centered', topbar: false, hero: 'photo', sections: 'alternating', cards: 'shadow', cardLayout: 'image', sectionHead: 'center', footer: 'light', contactLayout: 'split', innerForm: 'side', homeStyle: 'story' },
  },
  performance: {
    label: 'Sports and performance',
    for: 'athletic training, academies, gyms, fitness, performance coaching',
    feel: 'Energetic and bold. Condensed capital headings, strong imagery, numbered programme blocks and an enrol or book call to action.',
    tokens: { fontHeading: 'Bebas Neue', fontBody: 'Inter', headingCase: 'uppercase', headingWeight: 400, radius: 'none', shadow: 'medium', density: 'comfortable', container: 'wide' },
    layout: { header: 'minimal', topbar: false, hero: 'dark', sections: 'flat', cards: 'flat', cardLayout: 'numbered', sectionHead: 'bar', footer: 'dark', contactLayout: 'stacked', innerForm: 'below', homeStyle: 'showcase' },
  },
  conversion: {
    label: 'Marketing and conversion-focused',
    for: 'agencies, consultants, professional services, lead-generation and advisory businesses',
    feel: 'Benefit-led headlines, a clear value proposition, structured service explanations and repeated, well placed calls to action.',
    tokens: { fontHeading: 'DM Serif Display', fontBody: 'Work Sans', headingCase: 'none', headingWeight: 400, radius: 'lg', shadow: 'soft', density: 'spacious', container: 'normal' },
    layout: { header: 'classic', topbar: false, hero: 'centered', sections: 'alternating', cards: 'outline', cardLayout: 'numbered', sectionHead: 'center', footer: 'brand', contactLayout: 'split', innerForm: 'side', homeStyle: 'story' },
  },
};

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);

// Small stable number from a name, so choices between equally good options do not change on every regeneration.
export function seedOf(text) {
  let h = 2166136261;
  for (const c of String(text || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return Math.abs(h) % 1000;
}

export const archetypeCatalog = () => Object.entries(ARCHETYPES).map(([k, a]) => `- ${k} (${a.label}): for ${a.for}. ${a.feel}`).join('\n');

// First guess from the profile's industry text; the AI may override it.
export function guessArchetype(text) {
  const t = String(text || '').toLowerCase();
  if (/(junk|dumpster|haul|demoli|construct|excavat|tow)/.test(t)) return 'bold-contractor';
  if (/(cyber|security|\bit\b|software|saas|cloud|managed service|technology|network)/.test(t)) return 'enterprise';
  if (/(sport|athlet|fitness|gym|train(ing)? academy|performance)/.test(t)) return 'performance';
  if (/(dog|pet|groom|coach|wellness|salon|spa|yoga|tutor|therap|studio)/.test(t)) return 'lifestyle';
  if (/(agency|consult|marketing|advis|lead gen|law|account|financial|real estate)/.test(t)) return 'conversion';
  return 'home-services';
}
