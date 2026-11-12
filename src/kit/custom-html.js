import * as cheerio from 'cheerio';

// The HTML a person writes for one section of a page: it is theirs to change, but it is kept safe. No scripts, no inline event handlers,
// no javascript: addresses, no markers of the portal; a bounded size.
export const MAX_CUSTOM_HTML = 200000;

export function cleanCustomHtml(html) {
  const src = String(html || '').slice(0, MAX_CUSTOM_HTML).trim();
  if (!src) return '';
  const $ = cheerio.load(`<div id="kit-root">${src}</div>`, null, false);
  $('#kit-root script, #kit-root noscript, #kit-root object, #kit-root embed, #kit-root base, #kit-root meta, #kit-root link[rel="import"]').remove();
  $('#kit-root *').each((_, e) => {
    for (const [name, value] of Object.entries(e.attribs || {})) {
      if (/^on/i.test(name) || name === 'data-kit-key' || /^\s*(javascript|vbscript):/i.test(value) || (name === 'srcdoc')) delete e.attribs[name];
    }
    if (e.attribs?.class) e.attribs.class = e.attribs.class.split(/\s+/).filter((c) => c && c !== 'kit-cs-sel').join(' ');
  });
  return $('#kit-root').html().trim();
}
