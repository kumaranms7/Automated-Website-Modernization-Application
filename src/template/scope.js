// Changes made to one numbered section of an inner or contact page ("section 3 of the inner page") only make sense on the page they
// were made on: on another page, section 3 holds different content. Such a change carries the file it was made on, and a change
// from before that was recorded (with no file) belongs to the sample page chosen for that kind of page. Everything else (home,
// header, footer, whole-page layout options) applies everywhere.

const INDEXED = /\[data-sec="s\d+"\]/;

// a tweak or operation: scoped when its selector points at a numbered section of an inner or contact page
export function appliesHere(item, spec, layout, rel) {
  if (item.layout && item.layout !== 'all' && item.layout !== layout) return false;
  if (!['inner', 'contact'].includes(layout)) return true;
  if (!INDEXED.test(item.selector || '') && !INDEXED.test(item.target || '')) return true;
  const file = item.file || spec.samples?.[layout];
  return Boolean(file) && file === rel;
}

// a per-section layout entry (columns, image, background): always numbered on inner and contact pages
export function sectionAppliesHere(item, spec, layout, rel) {
  if (item.layout !== 'all' && item.layout !== layout) return false;
  if (!['inner', 'contact'].includes(layout) || !item.index) return true;
  const file = item.file || spec.samples?.[layout];
  return Boolean(file) && file === rel;
}
