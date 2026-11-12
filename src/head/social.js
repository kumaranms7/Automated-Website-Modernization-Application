import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { siteKey } from '../canonical/index.js';

// The share tags of a page (Open Graph and Twitter), finished the way the SEO Meta Tag Updater does it:
// title and description in step with the page, the page's best picture (or the site's default one) as the share image with its size,
// the canonical as og:url, the business name as og:site_name, a card size that fits the picture, a robots tag when there is none,
// and no old "keywords" tag.

const SKIP_IMG = /(^|[\/_.-])(logo|icon|sprite|avatar|favicon|pixel|spacer|blank|badge|seal|arrow|bullet)([\/_.-]|\d|$)/i;
const MIN_SHARE = { width: 200, height: 200 }, GOOD_WIDTH = 600;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const quote = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// the file a web address or a page's src points at, inside the website folder or the build folder
async function localFile(src, rel, domain, roots) {
  let p = String(src || '').trim().split(/[?#]/)[0];
  if (!p || /^data:/i.test(p)) return '';
  if (/^https?:\/\//i.test(p) || p.startsWith('//')) {
    let u; try { u = new URL(p, domain); } catch { return ''; }
    if (siteKey(u.href) !== siteKey(domain)) return ''; // another website: it cannot be checked here
    p = decodeURIComponent(u.pathname);
  } else p = decodeURIComponent(p);
  const dir = path.posix.dirname(`/${rel.replace(/\\/g, '/')}`);
  const web = p.startsWith('/') ? path.posix.normalize(p) : path.posix.normalize(path.posix.join(dir, p));
  for (const root of roots) {
    const f = path.join(root, ...web.split('/').filter(Boolean));
    try { if ((await fs.stat(f)).isFile()) return f; } catch { /* not in this folder */ }
  }
  return '';
}
async function dims(file) {
  try { const m = await sharp(file).metadata(); return m.width && m.height ? { width: m.width, height: m.height } : null; } catch { return null; }
}
const absUrl = (domain, web) => domain.replace(/\/+$/, '') + encodeURI(web).replace(/%25/g, '%');
const webPath = (file, roots) => { for (const r of roots) { const rel = path.relative(r, file); if (!rel.startsWith('..') && !path.isAbsolute(rel)) return `/${rel.split(path.sep).join('/')}`; } return ''; };

// the picture that stands for the page: the first big picture of its own content; else the default share image; else none
export async function pickShareImage($, { rel, domain, roots, defaultImage }) {
  const cands = [];
  $('img[src]').each((_, el) => {
    if ($(el).closest('header, nav, footer, aside').length) return;
    const src = $(el).attr('src');
    if (/\.svg(\?|$)/i.test(src) || SKIP_IMG.test(src.split('/').pop())) return;
    cands.push(src);
  });
  let best = null;
  for (const src of [...new Set(cands)].slice(0, 12)) {
    const f = await localFile(src, rel, domain, roots);
    if (!f) continue;
    const d = await dims(f);
    if (!d || d.width < MIN_SHARE.width || d.height < MIN_SHARE.height) continue;
    const web = webPath(f, roots);
    if (!web) continue;
    const c = { url: absUrl(domain, web), ...d, source: 'page' };
    if (!best || (best.width < GOOD_WIDTH && c.width > best.width)) best = c;
    if (best.width >= GOOD_WIDTH) break;
  }
  if (best) return best;
  if (defaultImage) {
    const f = await localFile(defaultImage, rel, domain, roots);
    if (f) { const d = await dims(f); return { url: /^https?:/i.test(defaultImage) ? defaultImage : absUrl(domain, webPath(f, roots) || defaultImage), ...(d || {}), source: 'default' }; }
    if (/^https?:\/\//i.test(defaultImage)) return { url: defaultImage, source: 'default' }; // another website's address cannot be checked
  }
  return null;
}

// one meta tag: its value set (or left alone when it is only wanted if missing)
function setMeta($, attr, key, content, onlyIfMissing = false) {
  if (content == null || content === '') return false;
  const el = $(`head meta[${attr}="${key}"]`).first();
  if (el.length) {
    if (onlyIfMissing || el.attr('content') === content) return false;
    el.attr('content', content); return true;
  }
  $('head').append(`<meta ${attr}="${key}" content="${quote(content)}">\n`);
  return true;
}

// returns what changed
export function applySocial($, { title, description, canonical, brand, image, pageKind, social = true }) {
  const out = { og: 0, twitter: 0, robots: false, keywords: 0, image: image?.url || '', imageSource: image?.source || '' };
  const keywords = $('head meta[name="keywords"]');
  out.keywords = keywords.length; keywords.remove();
  if (!$('head meta[name="robots"]').length && !/noindex/i.test($('head meta[name="googlebot"]').attr('content') || '')) { $('head').append('<meta name="robots" content="index, follow">\n'); out.robots = true; }
  if (!social) return out;
  const og = (k, v, only) => { if (setMeta($, 'property', k, v, only)) out.og += 1; };
  const tw = (k, v) => { if (setMeta($, 'name', k, v)) out.twitter += 1; };
  og('og:title', clean(title)); og('og:description', clean(description));
  og('og:type', pageKind === 'Article' ? 'article' : 'website', true);
  if (brand) og('og:site_name', brand);
  if (canonical) og('og:url', canonical);
  if (image) {
    og('og:image', image.url);
    if (image.width && image.height) { og('og:image:width', String(image.width)); og('og:image:height', String(image.height)); }
  }
  tw('twitter:card', image?.width >= GOOD_WIDTH ? 'summary_large_image' : 'summary');
  tw('twitter:title', clean(title)); tw('twitter:description', clean(description));
  if (image) tw('twitter:image', image.url);
  return out;
}
