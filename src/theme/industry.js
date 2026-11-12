// Industry presets: starting points for a theme, never fixed rules. A preset gives base colours (and sometimes a background); the
// generator then makes variations of them that suit the actual brand.

export const INDUSTRIES = {
  'home-services': { label: 'Home services', palette: 'Navy / Blue / Orange / White', base: { primary: '#2563eb', secondary: '#0f172a', accent: '#f97316' }, keywords: ['home service', 'handyman', 'repair', 'maintenance', 'residential', 'contractor', 'appliance'], types: ['LocalBusiness', 'HomeAndConstructionBusiness', 'Electrician', 'HVACBusiness', 'Locksmith', 'MovingCompany', 'CleaningService', 'PestControl'] },
  plumbing: { label: 'Plumbing', palette: 'Blue / Navy / White / Orange', base: { primary: '#1d6fd1', secondary: '#0b2545', accent: '#f28c28' }, keywords: ['plumb', 'drain', 'sewer', 'backflow', 'water heater', 'pipe', 'leak'], types: ['Plumber'] },
  roofing: { label: 'Roofing', palette: 'Charcoal / Blue / Orange / White', base: { primary: '#2f6fb5', secondary: '#2b2f36', accent: '#f26a21' }, keywords: ['roof', 'shingle', 'gutter', 'siding'], types: ['RoofingContractor'] },
  'law-firm': { label: 'Law firm', palette: 'Navy / Gold / Ivory', base: { primary: '#1b2a4a', secondary: '#12203a', accent: '#c9a227', background: '#faf7f0' }, keywords: ['law', 'attorney', 'lawyer', 'legal', 'litigation', 'counsel'], types: ['LegalService', 'Attorney'] },
  healthcare: { label: 'Healthcare', palette: 'Blue / Teal / White', base: { primary: '#1f77c9', secondary: '#0f766e', accent: '#14b8a6' }, keywords: ['health', 'medical', 'dental', 'dentist', 'clinic', 'doctor', 'patient', 'therapy', 'care'], types: ['Dentist', 'Physician', 'MedicalBusiness'] },
  technology: { label: 'Technology / SaaS', palette: 'Indigo / Violet / Slate', base: { primary: '#4f46e5', secondary: '#334155', accent: '#8b5cf6' }, keywords: ['software', 'saas', 'platform', 'app', 'cloud', 'developer', 'technology', 'it services', 'cyber'], types: [] },
  ai: { label: 'AI / Automation', palette: 'Deep navy / Electric blue / Purple', base: { primary: '#2f6bff', secondary: '#0a1230', accent: '#8b5cf6' }, keywords: ['artificial intelligence', ' ai ', 'automation', 'machine learning', 'chatbot', 'workflow'], types: [] },
  'pet-services': { label: 'Pet services', palette: 'Forest green / Cream / Warm orange', base: { primary: '#2f6b4f', secondary: '#1f3d2e', accent: '#f08a24', background: '#fbf6ea' }, keywords: ['pet', 'dog', 'cat', 'veterinar', 'grooming', 'kennel', 'animal'], types: [] },
  ecommerce: { label: 'E-commerce', palette: 'Brand-dependent / Neutral / High-contrast call to action', base: { primary: '#1f2937', secondary: '#111827', accent: '#e11d48' }, keywords: ['shop', 'store', 'ecommerce', 'e-commerce', 'product', 'cart', 'retail', 'boutique'], types: ['Store'] },
  construction: { label: 'Construction', palette: 'Charcoal / Yellow / White', base: { primary: '#374151', secondary: '#1f2937', accent: '#facc15' }, keywords: ['construction', 'builder', 'building', 'excavat', 'concrete', 'remodel', 'renovation', 'paving'], types: ['GeneralContractor'] },
  education: { label: 'Education', palette: 'Blue / Green / White', base: { primary: '#1e5bc6', secondary: '#15803d', accent: '#f59e0b' }, keywords: ['school', 'education', 'learning', 'tutor', 'university', 'course', 'academy', 'training'], types: [] },
  finance: { label: 'Finance', palette: 'Navy / Emerald / White', base: { primary: '#12315a', secondary: '#0b2038', accent: '#10b981' }, keywords: ['financ', 'bank', 'loan', 'invest', 'insurance', 'account', 'tax', 'wealth', 'mortgage', 'credit'], types: ['FinancialService', 'AccountingService', 'InsuranceAgency'] },
};

// the industry that best fits what is known about a business: its profile (industry, summary, services) and its schema type
export function detectIndustry(info = {}) {
  const text = ` ${[info.industry, info.summary, ...(info.services || []), ...(info.whatWeDo || []), info.name].filter(Boolean).join(' ')} `.toLowerCase();
  const type = String(info.businessType || '');
  const scores = Object.entries(INDUSTRIES).map(([id, ind]) => {
    let score = 0;
    if (type && ind.types.includes(type)) score += 6;
    for (const k of ind.keywords) { const hits = text.split(k).length - 1; if (hits) score += Math.min(hits, 3) * (k.length > 4 ? 2 : 1); }
    return [id, score];
  }).sort((a, b) => b[1] - a[1]);
  const [best, score] = scores[0];
  if (score >= 2) return { id: best, ...INDUSTRIES[best], score };
  // an unknown industry: a general-purpose professional starting point
  return null;
}

export const presetBase = (id) => (INDUSTRIES[id] ? { ...INDUSTRIES[id].base } : null);
export const industryList = () => Object.entries(INDUSTRIES).map(([id, i]) => ({ id, label: i.label, palette: i.palette, base: i.base }));
