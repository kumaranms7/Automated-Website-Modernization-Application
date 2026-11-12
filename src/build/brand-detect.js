import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { clientDir, loadClient, readJson, writeJson } from '../config.js';

// Reads the client's logo and derives a starting colour palette from it, so a new client does not begin
// with another client's colours. The palette is only a suggestion: it is saved to brand.json and editable
// on the Templates tab.

const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const mix = (rgb, to, t) => rgb.map((v, i) => v + (to[i] - v) * t);

async function findLogo(client, site) {
  const base = path.basename((site?.logo || '').split('?')[0]);
  const candidates = [path.join(client.sourceDir, (site?.logo || '').replace(/^\//, '')), path.join(client.sourceDir, base)];
  for (const c of candidates) if (base && (await fs.stat(c).catch(() => null))?.isFile()) return c;
  return null;
}

export async function detectBrand(slug) {
  const client = await loadClient(slug);
  const site = await readJson(path.join(clientDir(slug), 'site.json'));
  const file = await findLogo(client, site);
  if (!file) throw new Error('Logo file not found in the site folder; set colours manually on the Templates tab');

  const { data, info } = await sharp(file, { failOnError: false }).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    const [h, s, l] = hsl(r, g, b);
    if (s < 0.3 || l < 0.12 || l > 0.9) continue; // skip white, black and greys
    const k = `${r >> 4},${g >> 4},${b >> 4}`;
    const e = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0, h };
    e.n += 1; e.r += r; e.g += g; e.b += b;
    buckets.set(k, e);
  }
  const ranked = [...buckets.values()].sort((x, y) => y.n - x.n).map((e) => ({ n: e.n, rgb: [e.r / e.n, e.g / e.n, e.b / e.n], h: hsl(e.r / e.n, e.g / e.n, e.b / e.n)[0] }));
  if (!ranked.length) throw new Error('The logo has no distinct colours; set colours manually');

  const primary = ranked[0];
  const second = ranked.find((c) => hueGap(c.h, primary.h) >= 40);
  const brand = {
    primary: toHex(...primary.rgb),
    primaryDark: toHex(...mix(primary.rgb, [0, 0, 0], 0.4)),
    accent: second ? toHex(...second.rgb) : toHex(...mix(primary.rgb, [255, 140, 40], 0.7)),
    soft: toHex(...mix(primary.rgb, [255, 255, 255], 0.94)),
    detectedFrom: path.basename(file),
  };
  return brand;
}
