import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { localTarget } from '../validate/links.js';

// Any <img> that still lacks width/height (images inside legacy copy, SVG icons) gets its real size so the
// browser can reserve space and the page does not jump while loading. Missing loading hints are added too.

const cache = new Map();

export async function dimsOf(file) {
  if (cache.has(file)) return cache.get(file);
  let d = null;
  try {
    if (/\.svg$/i.test(file)) {
      const svg = await fs.readFile(file, 'utf8');
      const w = svg.match(/<svg[^>]*\swidth="([\d.]+)(?:px)?"/i), h = svg.match(/<svg[^>]*\sheight="([\d.]+)(?:px)?"/i);
      const vb = svg.match(/viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/i);
      if (w && h) d = { w: Math.round(w[1]), h: Math.round(h[1]) };
      else if (vb) d = { w: Math.round(vb[1]), h: Math.round(vb[2]) };
    } else {
      const m = await sharp(file, { failOnError: false }).metadata();
      if (m.width && m.height) d = { w: m.width, h: m.height };
    }
  } catch { /* leave without dimensions */ }
  cache.set(file, d);
  return d;
}

export async function fixImageTags(html, rel, { host, roots }) {
  const tags = [...new Set(html.match(/<img\b[^>]*>/gi) || [])];
  let out = html;
  for (const tag of tags) {
    let next = tag;
    if (!/\swidth=/i.test(tag) || !/\sheight=/i.test(tag)) {
      const src = (tag.match(/\ssrc="([^"]*)"/i) || [])[1];
      const target = src && localTarget(src.replace(/&amp;/g, '&'), rel, host);
      if (target) {
        for (const root of roots) {
          const d = await dimsOf(path.join(root, target));
          if (d) { next = next.replace(/\s(width|height)="[^"]*"/gi, '').replace(/<img\b/i, `<img width="${d.w}" height="${d.h}"`); break; }
        }
      }
    }
    if (!/\sloading=/i.test(next) && !/fetchpriority=/i.test(next)) next = next.replace(/<img\b/i, '<img loading="lazy"');
    if (!/\sdecoding=/i.test(next)) next = next.replace(/<img\b/i, '<img decoding="async"');
    if (next !== tag) out = out.split(tag).join(next);
  }
  return out;
}

// Real sizes of the images a page uses (keyed by the src string in the content), so layouts can decide whether a
// picture is big enough for a photo card or a hero.
export async function imageDims(model, rel, { host, roots }) {
  const srcs = new Set();
  const walk = (v, key = '') => {
    if (typeof v === 'string') { if (/^(img|src|image)$/.test(key) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v)) srcs.add(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'protected' || k === 'head') continue; walk(x, k); }
  };
  walk(model.blocks); walk(model.home);
  const out = {};
  for (const src of srcs) {
    const target = localTarget(src.replace(/&amp;/g, '&'), rel, host);
    if (!target) continue;
    for (const root of roots) {
      const d = await dimsOf(path.join(root, target));
      if (d) { out[src] = d; break; }
    }
  }
  return out;
}
