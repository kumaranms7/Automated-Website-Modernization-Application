// What a website is being updated for. Chosen when the website is added or edited, and it decides which steps are shown, which problems
// the audit counts, what the validation checks and what the report contains.
//   template: give the pages a new design (a new template, or one made from the site's own modern pages)
//   images:   WebP, responsive sizes, image sizes, lazy loading and alt text
//   content:  improve or re-write the wording with AI, and complete the search tags (titles, descriptions, canonical, share tags, structured data)
// Rules: a template can only be applied by building pages in Content & build, so Update Template always comes with Update Content.
// A website with nothing chosen (every website added before this existed) gets all three.

export const OPTION_INFO = [
  { id: 'template', label: 'Update Template', text: 'Give the pages a new design, built from a new template or from your own modern pages.' },
  { id: 'images', label: 'Update Images', text: 'Convert pictures to WebP, create responsive sizes and fix image details such as size and alt text.' },
  { id: 'content', label: 'Update Content', text: 'Improve or re-write the wording with AI and complete the titles, descriptions and search tags. The design is not changed.' },
];

// what is stored: { template, images, content }, always valid
export function normaliseOptions(input) {
  const o = input && typeof input === 'object' ? input : null;
  if (!o || !['template', 'images', 'content'].some((k) => o[k] !== undefined)) return { template: true, images: true, content: true };
  const out = { template: Boolean(o.template), images: Boolean(o.images), content: Boolean(o.content) };
  if (out.template) out.content = true;
  if (!out.template && !out.images && !out.content) throw new Error('Choose at least one thing to update.');
  return out;
}
export const optionsOf = (client) => normaliseOptions(client?.options);

// true when the options had to add Update Content because Update Template was chosen on its own
export const contentAddedFor = (input) => Boolean(input?.template) && !input?.content;

// The areas a website's checks, score and report cover. Content counts only when the wording is being changed: with "Use existing
// content" the search tags are left as they are, so there is nothing of them to check.
export function areasOf(client, settings = {}) {
  const o = optionsOf(client);
  return { template: o.template, images: o.images, content: o.content && settings.contentMode !== 'existing' };
}

// the checks of the checklist (src/validate/seo.js) that belong to each area
export const AREA_OF_CHECK = {
  'img-alt': 'images', 'img-alt-meaningful': 'images', 'img-dimensions': 'images', 'img-lazy': 'images', 'img-modern': 'images',
  landmarks: 'template', 'skip-link': 'template', viewport: 'template', lang: 'template', 'duplicate-id': 'template', 'mixed-content': 'template', 'blocking-scripts': 'template', 'html-size': 'template',
};
export const areaOfCheck = (id) => AREA_OF_CHECK[id] || 'content';
export const inScope = (id, areas) => Boolean(areas?.[areaOfCheck(id)]);

// the audit's problems that belong to each option (everything else is about the wording and the search tags)
const AUDIT_AREA = { 'img-alt': 'images', 'img-dimensions': 'images', 'img-legacy-format': 'images', 'no-viewport': 'template', 'no-lang': 'template', 'legacy-jquery': 'template', 'many-stylesheets': 'template', 'no-landmarks': 'template', 'html-heavy': 'template' };
export const auditAreaOf = (code) => AUDIT_AREA[code] || 'content';

// the scan as the audit shows it: only the problems of the options this website is being updated for
export function scopeScan(data, client) {
  const o = optionsOf(client);
  const keep = (i) => o[auditAreaOf(i.code)];
  const pages = (data.pages || []).map((p) => ({ ...p, issues: (p.issues || []).filter(keep) }));
  const issues = {};
  for (const p of pages) for (const i of p.issues) issues[i.code] = (issues[i.code] || 0) + 1;
  return { summary: data.summary ? { ...data.summary, issues } : data.summary, pages };
}
