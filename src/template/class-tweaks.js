import * as cheerio from 'cheerio';
import { appliesHere } from './scope.js';

// Design tweaks made in the chat: Tailwind utility classes added to (or removed from) elements picked by a CSS selector.
// They are applied to the rendered page, and Tailwind generates the CSS for them because the stylesheet is compiled from
// the finished HTML. This is the preferred way to restyle one part of a page; custom CSS is only for what utilities cannot do.

// Tweaks for ONE section's markup (a fragment). The selector is searched inside the section; "section" means the section itself.
export function applySectionClassTweaks(html, tweaks) {
  if (!tweaks?.length) return html;
  const $ = cheerio.load(html, null, false);
  for (const t of tweaks) {
    let sel;
    try { sel = t.selector.trim() === 'section' ? $.root().children('section').first() : $.root().find(t.selector); } catch { continue; }
    sel.each((_, el) => {
      const $el = $(el);
      if (t.remove.length) $el.removeClass(t.remove.join(' '));
      if (t.add.length) $el.addClass(t.add.join(' '));
    });
  }
  return $.html();
}

export function applyClassTweaks(html, spec, layout, rel) {
  const list = (spec.tweaks || []).filter((t) => appliesHere(t, spec, layout, rel));
  if (!list.length) return html;
  const $ = cheerio.load(html);
  let touched = 0;
  for (const t of list) {
    let sel;
    try { sel = $(t.selector); } catch { continue; } // an invalid selector is skipped, never fatal
    if (!sel.length) continue;
    sel.each((_, el) => {
      const $el = $(el);
      if (t.remove.length) $el.removeClass(t.remove.join(' '));
      if (t.add.length) $el.addClass(t.add.join(' '));
    });
    touched += sel.length;
  }
  return touched ? $.html() : html;
}
