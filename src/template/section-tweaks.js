import * as cheerio from 'cheerio';
import { sectionAppliesHere } from './scope.js';
import { esc } from '../util/html.js';
import { imgTag } from '../images/optimize.js';

// Per-section changes chosen in the design chat: an image beside a section's text, text in columns, a different
// background, centred text. They are applied to the rendered page, so the content itself is never edited.

const BG = { white: 'bg-surface', soft: 'bg-soft', dark: 'bg-brand-dark text-on-dark', brand: 'bg-brand text-on-dark' };

export function applySectionTweaks(html, spec, layout, ctx) {
  const list = (spec.sections || []).filter((s) => sectionAppliesHere(s, spec, layout, ctx?.rel));
  if (!list.length) return html;
  const $ = cheerio.load(html, null, false);
  const secs = $.root().children('section').toArray();
  for (const t of list) {
    let el = t.index ? secs[t.index - 1] : null;
    if (!el && t.heading) el = secs.find((s) => $(s).find('h1,h2,h3').first().text().toLowerCase().includes(t.heading.toLowerCase()));
    if (!el) continue;
    const sec = $(el);
    const wrap = sec.children('.wrap').first();
    if (!wrap.length) continue;

    if (t.background) {
      const keep = (sec.attr('class') || '').split(/\s+/).filter((c) => c && !/^bg-/.test(c) && c !== 'text-on-dark');
      sec.attr('class', [...keep, BG[t.background]].join(' '));
    }
    if (t.align === 'center') wrap.addClass('text-center');

    const isGrid = /(^|\s)grid(\s|$)/.test(wrap.attr('class') || '');
    let body = wrap;
    if (t.image && !isGrid) {
      const inner = wrap.html();
      body = null;
      const fig = `<figure class="sec-fig">${imgTag({ src: t.image.src, alt: t.image.alt }, ctx, { cls: 'h-auto w-full rounded-card shadow-md', sizes: '(min-width: 1024px) 560px, 100vw' })}</figure>`;
      const cls = `sec-split ${t.image.side === 'left' ? 'img-left' : ''} ${t.image.width === 'third' ? 'w-third' : ''}`.replace(/\s+/g, ' ').trim();
      wrap.html(`<div class="${cls}"><div class="sec-body">${inner}</div>${fig}</div>`);
      body = wrap.find('.sec-body').first();
    } else if (t.image && isGrid) {
      // already a multi-column section: the image goes above the first column instead of breaking the grid
      const first = wrap.children().first();
      first.prepend(`<figure class="sec-fig mb-6">${imgTag({ src: t.image.src, alt: t.image.alt }, ctx, { cls: 'h-auto w-full rounded-card shadow-md', sizes: '(min-width: 1024px) 560px, 100vw' })}</figure>`);
    }
    if (t.columns) {
      const target = body && body.length ? (body.find('.prose-content').first().length ? body.find('.prose-content').first() : body) : wrap;
      target.attr('data-cols', String(t.columns));
    }
  }
  return $.html();
}
