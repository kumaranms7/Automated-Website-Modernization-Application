// The SEO limits, in one place. The audit, the AI prompts, the checks on a built page, the review box and the report all read these,
// so a page cannot pass one check and fail another.
export const SEO = {
  title: { min: 30, max: 60 },
  description: { min: 110, max: 160 },
};

export const TITLE_RANGE = [SEO.title.min, SEO.title.max];
export const META_RANGE = [SEO.description.min, SEO.description.max];
export const rangeText = (r) => `${r.min}-${r.max}`;

// the limits as the browser needs them (served at /api/rules)
export const rulesForUi = () => ({ title: { ...SEO.title }, description: { ...SEO.description } });
