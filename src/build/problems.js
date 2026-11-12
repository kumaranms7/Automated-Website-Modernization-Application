// Plain names for the build's automatic checks, and what to do when one does not pass.
// Every failed or warned page shows these, so a result is never just "failed".
const CHECKS = {
  title: ['Page title', 'Edit the title in "Review title, description and heading", then build the page again. If the new title is fine as it is, use the new page anyway.'],
  'meta-desc': ['Meta description', 'Edit the description in "Review title, description and heading" (70-165 characters), then build the page again.'],
  canonical: ['Canonical address', 'The canonical link does not match the website address set in the Business profile. Check the domain there, then build the page again.'],
  h1: ['Main heading (H1)', 'The page needs exactly one H1 that matches the original. Edit the heading in the review box, or use the new page anyway if the change is intended.'],
  phones: ['Phone links', 'A tel: link of the original page is missing in the new one. Open the preview to find the phone number, or keep the original page.'],
  tracking: ['Tracking codes', 'A tracking ID (Analytics, Tag Manager, Ads) of the original is missing. Keep the original page, or use the new page anyway if that tracking is no longer wanted.'],
  php: ['PHP code', 'The page contains PHP that the new page does not keep. It is safest to keep the original page.'],
  'form-intact': ['Form', 'The form of the original page is missing or changed. Keep the original page so the form keeps working.'],
  'head-scripts': ['Scripts in the page head', 'A script or tracking code in the head of the original was not carried over. Keep the original page, or use the new page anyway if it is not needed.'],
  'content-text': ['Page text kept', 'Some text of the original page is missing in the new one. Open the preview to compare. Keep the original page, or use the new page anyway if the text was removed on purpose.'],
  'content-links': ['Links kept', 'A link of the original page was lost. Open the preview to compare. Keep the original page, or use the new page anyway if the link was removed on purpose.'],
  'content-images': ['Images kept', 'An image of the original page is not in the new one. Run the Images step again, or keep the original page.'],
  'schema-valid': ['Structured data valid', 'The JSON-LD of the page is not valid. Build the page again (the builder repairs it); if it still fails, keep the original page.'],
  'schema-present': ['Structured data present', 'The page has no structured data. Switch on "Complete the structured data" in More options and build again.'],
  'img-alt-attr': ['Image alt attribute', 'Some images have no alt attribute. Switch on AI alt text in the Images step and build again.'],
  'img-alt-text': ['Image alt text', 'Some images have an empty alt text. Switch on AI alt text in the Images step and build again.'],
  'img-dimensions': ['Image width and height', 'Some images have no width and height (the page can jump while loading). Run the Images step, then build the page again.'],
  'heading-order': ['Heading order', 'The headings skip a level (for example H2 then H4). This is a warning; it does not stop the page from being used.'],
  'home-text': ['Home page text kept', 'Text of the home page is missing in the new page. Keep the original page, or use the new page anyway if the text was changed on purpose.'],
  'home-links': ['Home page links kept', 'A link of the home page was lost. Keep the original page, or use the new page anyway if it was removed on purpose.'],
  'reviews-verbatim': ['Customer reviews kept', 'A customer review was changed or lost. Reviews must stay word for word, so build the page again without the AI wording, or keep the original page.'],
};

const words = (id) => String(id).replace(/[-_:]+/g, ' ').replace(/^./, (m) => m.toUpperCase());

// { id, level, msg } -> { id, level, msg, name, fix }
export function explainCheck(c) {
  const id = String(c.id || '');
  if (id.startsWith('ai:')) return { ...c, name: 'AI wording check', fix: 'The AI wording broke a rule, so this page kept its existing text. Use "Write the wording again" below, or keep the original wording.' };
  const known = CHECKS[id];
  return { ...c, name: known ? known[0] : words(id), fix: known ? known[1] : 'Open the preview to compare the original and the new page, then build the page again or keep the original.' };
}

export const explainRow = (row) => (row.checks ? { ...row, checks: row.checks.map(explainCheck) } : row);

// Why a page that was left out was left out
export function skipText(reason) {
  const r = String(reason || '');
  if (/unrecognised-layout/.test(r)) return { msg: 'The layout of this page was not recognised, so it could not be rebuilt.', fix: 'This page stays as it is. Change it by hand if it needs the new design.' };
  if (/would score lower/.test(r)) return { msg: r.replace(/^kept as it is: /, ''), fix: 'The original is better, so it was kept. Turn off "Never replace a page that would score lower" in More options to use the new page.' };
  return { msg: r || 'The page was left out of this run.', fix: 'The page stays as it is.' };
}
