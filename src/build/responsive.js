import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import * as cheerio from 'cheerio';

// Responsive images for every content image that does not have them yet. Step 4 skips pictures that are already WebP, so those
// pages ship one large file to phones. Here each such image gets smaller copies (written into the build, and from there into the
// site folder, so a restore removes them again) and a srcset that lets the browser choose the right one.

const WIDTHS = [320, 480, 800, 1200, 1600];
const MIN_NATURAL = 376;  // below this a smaller copy would save almost nothing
const RATIO = 0.85;       // a copy must be clearly smaller than the original to be worth making
const NO_SRCSET = /\.(svg|gif|ico)(\?|$)/i;

// the path of an image inside the site, whichever way the page spells it ("../images/a.webp", "/images/a.webp"...)
export const siteRelative = (src) => decodeURIComponent(String(src || '').split('#')[0].split('?')[0]).replace(/^(?:\.{1,2}\/)+/, '').replace(/^\/+/, '');

export function variantWidths(natural) {
  return WIDTHS.filter((w) => w <= natural * RATIO);
}

export async function addResponsiveImages(html, { rel, siteDir, buildDir, cache = new Map(), write = true }) {
  const $ = cheerio.load(html);
  const jobs = [];
  const out = { images: 0, files: 0 };
  const dirPrefix = (src) => { const i = src.split('?')[0].lastIndexOf('/'); return i >= 0 ? src.slice(0, i + 1) : ''; };

  for (const el of $('img').toArray()) {
    const $i = $(el);
    const src = $i.attr('src') || '';
    if ($i.attr('srcset') || !src || /^(https?:)?\/\//i.test(src) || NO_SRCSET.test(src) || /^data:/i.test(src)) continue;
    const shown = Number($i.attr('width')) || 0;
    if (shown && shown < 200) continue; // icons and badges
    const file = siteRelative(src);
    let info = cache.get(file);
    if (!info) {
      const full = path.join(siteDir, ...file.split('/'));
      info = await sharp(full).metadata().then((m) => ({ w: m.width || 0, ok: true })).catch(() => ({ w: 0, ok: false }));
      cache.set(file, info);
    }
    if (!info.ok || info.w < MIN_NATURAL) continue;
    const widths = variantWidths(info.w);
    if (!widths.length) continue;
    const base = file.replace(/\.[a-z0-9]+$/i, '');
    const names = widths.map((w) => ({ w, file: `${base}-${w}w.webp` }));
    jobs.push({ names, file });
    const prefix = dirPrefix(src);
    const url = (f) => prefix + f.split('/').pop();
    const cand = [...names.map((n) => `${url(n.file)} ${n.w}w`), `${src} ${info.w}w`];
    $i.attr('srcset', cand.join(', '));
    if (!$i.attr('sizes')) $i.attr('sizes', `(min-width: 768px) ${Math.min(shown || info.w, info.w)}px, 100vw`);
    out.images += 1;
  }

  if (write) {
    for (const j of jobs) {
      const src = path.join(siteDir, ...j.file.split('/'));
      for (const n of j.names) {
        const dest = path.join(buildDir, ...n.file.split('/'));
        const have = cache.get('made:' + n.file) || await fs.stat(dest).catch(() => null) || await fs.stat(path.join(siteDir, ...n.file.split('/'))).catch(() => null);
        if (have) { cache.set('made:' + n.file, true); continue; }
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await sharp(src).resize({ width: n.w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest);
        cache.set('made:' + n.file, true);
        out.files += 1;
      }
    }
  }
  return { html: out.images ? $.html() : html, ...out };
}
