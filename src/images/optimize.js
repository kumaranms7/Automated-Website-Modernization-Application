import path from 'node:path';
import { clientDir, readJson, writeJson } from '../config.js';
import { esc } from '../util/html.js';
import { resolveHref } from '../content/apply.js';

// Image settings and the <img> markup used by the page templates. The optimisation itself is in inplace.js.

export const DEFAULTS = {
  quality: 80,
  maxWidth: 1600,
  widths: [480, 800, 1200],
  iconWidth: 160,
  minSavingPct: 5,
  copyBackupTo: '',
  aiAlt: false,        // write missing or useless picture descriptions with the AI (otherwise the file name or the section heading is used)
  ignoreBackupFolders: false, // true: images used only by old copies in backup/old/archive folders count as unused
  // Approved branding and tiny UI assets are kept exactly as supplied (matched against the file path).
  preserve: ['logo', 'favicon', 'brand', 'badge', 'seal', 'bbb', 'apple-touch', 'android-chrome', 'sprite'],
};

const settingsFile = (slug) => path.join(clientDir(slug), 'images-settings.json');

export async function loadImageSettings(slug) {
  return { ...DEFAULTS, ...(await readJson(settingsFile(slug), {})) };
}

export async function saveImageSettings(slug, input) {
  const s = await loadImageSettings(slug);
  if (input.quality !== undefined) {
    const q = Number(input.quality);
    if (!(q >= 40 && q <= 95)) throw new Error('Quality must be between 40 and 95');
    s.quality = q;
  }
  if (input.maxWidth !== undefined) {
    const w = Number(input.maxWidth);
    if (!(w >= 400 && w <= 3000)) throw new Error('Max width must be between 400 and 3000');
    s.maxWidth = w;
  }
  if (input.preserve !== undefined) s.preserve = [].concat(input.preserve).flatMap((x) => String(x).split(',')).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (input.copyBackupTo !== undefined) s.copyBackupTo = String(input.copyBackupTo).trim();
  if (input.aiAlt !== undefined) s.aiAlt = Boolean(input.aiAlt);
  if (input.ignoreBackupFolders !== undefined) s.ignoreBackupFolders = Boolean(input.ignoreBackupFolders);
  await writeJson(settingsFile(slug), s);
  return s;
}

// Builds the <img> tag for a content image. If the image was optimised in place, the tag points at the new WebP file
// with responsive sizes; otherwise it keeps the original reference, so nothing can break.
export function imgTag({ src, alt, w, h }, ctx, { cls = '', sizes = '(min-width: 1024px) 800px, 100vw', priority = false, icon = false } = {}) {
  const key = ctx.imgs ? resolveHref(src, ctx.rel, ctx.host) : null;
  const e = key && ctx.imgs[key];
  const altAttr = ` alt="${esc(alt)}"`;
  const loading = priority ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"';
  if (!e) {
    const dims = w && h ? ` width="${esc(w)}" height="${esc(h)}"` : '';
    return `<img src="${esc(src)}"${altAttr}${dims}${loading} class="${cls}">`;
  }
  const url = (f) => esc(ctx.siteUrl('/' + f));
  const dims = icon ? ' width="56" height="56"' : ` width="${e.w}" height="${e.h}"`;
  const variants = e.variants || [];
  const srcset = variants.length ? ` srcset="${[...variants, { file: e.file, w: e.w }].map((v) => `${url(v.file)} ${v.w}w`).join(', ')}" sizes="${sizes}"` : '';
  return `<img src="${url(e.file)}"${srcset}${altAttr}${dims}${loading} class="${cls}">`;
}
