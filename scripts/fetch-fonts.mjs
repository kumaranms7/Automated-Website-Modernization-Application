// One-off developer script: downloads a curated set of open-licence (OFL) Google fonts, latin subset, and writes
// src/assets/fonts/catalog.json. The built websites then serve these files themselves, with no Google requests.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'fonts');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// role: h = good for headings, b = good for body text. serif/sans drives the fallback stack.
const FAMILIES = [
  ['Bebas Neue', [400], 'h', 'sans'], ['Oswald', [400, 600, 700], 'h', 'sans'], ['Montserrat', [400, 600, 700, 800], 'hb', 'sans'],
  ['Poppins', [400, 600, 700], 'hb', 'sans'], ['Playfair Display', [400, 600, 700], 'h', 'serif'], ['Lora', [400, 600, 700], 'hb', 'serif'],
  ['Raleway', [400, 600, 700], 'hb', 'sans'], ['DM Serif Display', [400], 'h', 'serif'], ['Inter', [400, 600, 700], 'hb', 'sans'],
  ['Merriweather', [400, 700], 'hb', 'serif'], ['Open Sans', [400, 600, 700], 'b', 'sans'], ['Lato', [400, 700], 'b', 'sans'],
  ['Source Sans 3', [400, 600, 700], 'b', 'sans'], ['Nunito', [400, 600, 700], 'b', 'sans'], ['Roboto', [400, 500, 700], 'b', 'sans'],
  ['Work Sans', [400, 600, 700], 'hb', 'sans'], ['Manrope', [400, 600, 700, 800], 'hb', 'sans'],
];


// The familiar modern families web designers reach for, added to the first set. Existing entries are kept: running the script again
// only fetches what is missing.
const MORE = [
  // sans, headings and body
  ['Plus Jakarta Sans', [400, 600, 700, 800], 'hb', 'sans'], ['DM Sans', [400, 500, 700], 'hb', 'sans'], ['Outfit', [400, 600, 700], 'hb', 'sans'],
  ['Sora', [400, 600, 700], 'hb', 'sans'], ['Space Grotesk', [400, 500, 700], 'hb', 'sans'], ['Urbanist', [400, 600, 700, 800], 'hb', 'sans'],
  ['Figtree', [400, 600, 700], 'hb', 'sans'], ['Lexend', [400, 600, 700], 'hb', 'sans'], ['Albert Sans', [400, 600, 700], 'hb', 'sans'],
  ['Rubik', [400, 500, 700], 'hb', 'sans'], ['Mulish', [400, 600, 700], 'hb', 'sans'], ['Barlow', [400, 600, 700], 'hb', 'sans'],
  ['Archivo', [400, 600, 700], 'hb', 'sans'], ['Bricolage Grotesque', [400, 600, 700], 'hb', 'sans'], ['Epilogue', [400, 600, 700], 'hb', 'sans'],
  ['Onest', [400, 600, 700], 'hb', 'sans'], ['Instrument Sans', [400, 600, 700], 'hb', 'sans'], ['Be Vietnam Pro', [400, 600, 700], 'hb', 'sans'],
  ['IBM Plex Sans', [400, 600, 700], 'hb', 'sans'], ['Public Sans', [400, 600, 700], 'hb', 'sans'], ['Libre Franklin', [400, 600, 700], 'hb', 'sans'],
  ['Red Hat Display', [400, 600, 700], 'hb', 'sans'], ['Jost', [400, 600, 700], 'hb', 'sans'], ['Josefin Sans', [400, 600, 700], 'hb', 'sans'],
  ['Quicksand', [400, 600, 700], 'hb', 'sans'], ['Fira Sans', [400, 600, 700], 'hb', 'sans'], ['Cabin', [400, 600, 700], 'hb', 'sans'],
  ['Karla', [400, 600, 700], 'hb', 'sans'], ['Heebo', [400, 600, 700], 'hb', 'sans'], ['Noto Sans', [400, 600, 700], 'b', 'sans'],
  ['Overpass', [400, 600, 700], 'hb', 'sans'], ['Hind', [400, 600, 700], 'b', 'sans'], ['PT Sans', [400, 700], 'b', 'sans'],
  ['Titillium Web', [400, 600, 700], 'hb', 'sans'], ['Exo 2', [400, 600, 700], 'hb', 'sans'], ['Space Mono', [400, 700], 'h', 'sans'],
  // bold display faces
  ['Anton', [400], 'h', 'sans'], ['Archivo Black', [400], 'h', 'sans'], ['Barlow Condensed', [400, 600, 700], 'h', 'sans'], ['Syne', [400, 600, 700, 800], 'h', 'sans'],
  ['League Spartan', [400, 600, 700], 'h', 'sans'], ['Teko', [400, 600, 700], 'h', 'sans'],
  // serif
  ['Source Serif 4', [400, 600, 700], 'hb', 'serif'], ['Libre Baskerville', [400, 700], 'hb', 'serif'], ['Cormorant Garamond', [400, 600, 700], 'h', 'serif'],
  ['EB Garamond', [400, 600, 700], 'hb', 'serif'], ['Crimson Pro', [400, 600, 700], 'hb', 'serif'], ['Fraunces', [400, 600, 700], 'h', 'serif'],
  ['Bitter', [400, 600, 700], 'hb', 'serif'], ['Roboto Slab', [400, 600, 700], 'hb', 'serif'], ['Spectral', [400, 600, 700], 'hb', 'serif'],
  ['PT Serif', [400, 700], 'hb', 'serif'], ['Newsreader', [400, 600, 700], 'hb', 'serif'], ['Noto Serif', [400, 600, 700], 'b', 'serif'],
  ['Cormorant', [400, 600, 700], 'h', 'serif'], ['Abril Fatface', [400], 'h', 'serif'], ['Prata', [400], 'h', 'serif'],
];
FAMILIES.push(...MORE);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const catalogFile = path.join(dir, 'catalog.json');
const catalog = JSON.parse(await fs.readFile(catalogFile, 'utf8').catch(() => '{}'));

for (const [family, wanted, role, kind] of FAMILIES) {
  if (catalog[family]) continue;
  let css = '', weights = wanted;
  for (const tryWeights of [wanted, wanted.filter((w) => w === 400 || w === 700), [400]]) {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${tryWeights.join(';')}&display=swap`;
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.ok) { css = await res.text(); weights = tryWeights; break; }
  }
  if (!css) { console.log(family.padEnd(18), 'not available, skipped'); continue; }
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)].filter((m) => m[1] === 'latin');
  const files = {};
  const byUrl = new Map();
  for (const m of blocks) {
    const w = Number((m[2].match(/font-weight:\s*(\d+)/) || [])[1]);
    const src = (m[2].match(/url\((https:[^)]+)\)/) || [])[1];
    if (!w || !src) continue;
    if (!byUrl.has(src)) {
      const name = `${slug(family)}-${w}.woff2`;
      const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
      await fs.writeFile(path.join(dir, name), buf);
      byUrl.set(src, name);
    }
    files[w] = byUrl.get(src);
  }
  catalog[family] = { role, kind, weights: files };
  console.log(family.padEnd(18), Object.entries(files).map(([w, f]) => `${w}:${f}`).join(' '));
}
await fs.writeFile(catalogFile, JSON.stringify(catalog, null, 2));
