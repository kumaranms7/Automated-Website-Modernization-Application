// Colour maths for the Theme Engine: parsing, conversion between sRGB, HSL and OKLCH, shade scales, WCAG contrast.
// Shades are made in OKLCH (perceptually even lightness, steady hue), never by adding or subtracting RGB values.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, d = 4) => +n.toFixed(d);

// ---------- parsing and formatting ----------
const NAMED = { white: '#ffffff', black: '#000000', transparent: null };

// '#abc', '#aabbcc', 'rgb(1 2 3)', 'rgb(1,2,3)', 'hsl(210 50% 40%)', 'oklch(0.6 0.15 250)' -> { r, g, b } (0-255) or null
export function parseColor(input) {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase();
  if (s in NAMED) return NAMED[s] ? parseColor(NAMED[s]) : null;
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
  m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) { const n = parseInt(m[1], 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
  m = s.match(/^rgba?\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)(%?)(?:[\s,/]+[\d.%]+)?\s*\)$/);
  if (m) {
    const v = (x, pct) => clamp(Math.round(pct ? (parseFloat(x) / 100) * 255 : parseFloat(x)), 0, 255);
    return { r: v(m[1], m[2]), g: v(m[3], m[4]), b: v(m[5], m[6]) };
  }
  m = s.match(/^hsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+[\d.%]+)?\s*\)$/);
  if (m) return hslToRgb(((parseFloat(m[1]) % 360) + 360) % 360, clamp(parseFloat(m[2]) / 100, 0, 1), clamp(parseFloat(m[3]) / 100, 0, 1));
  m = s.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+(-?[\d.]+)(?:deg)?(?:\s*\/\s*[\d.%]+)?\s*\)$/);
  if (m) return oklchToRgb({ l: m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1]), c: parseFloat(m[3]), h: parseFloat(m[4]) });
  return null;
}
export const isColor = (v) => parseColor(v) !== null;

const hx = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
export const rgbToHex = ({ r, g, b }) => `#${hx(r)}${hx(g)}${hx(b)}`;
// any supported colour -> '#rrggbb' (lower case), or the fallback
export function toHex(input, fallback = null) { const c = parseColor(input); return c ? rgbToHex(c) : fallback; }
export const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v));

// ---------- sRGB <-> linear <-> OKLab <-> OKLCH ----------
const toLinear = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fromLinear = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklab({ r, g, b }) {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s };
}
function oklabToLinear({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
export function rgbToOklch(rgb) {
  const { L, a, b } = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  return { l: L, c, h: c < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}
const inGamut = (lin) => lin.every((v) => v >= -0.0005 && v <= 1.0005);
// OKLCH -> sRGB; a colour outside the sRGB gamut keeps its lightness and hue and loses chroma until it fits
export function oklchToRgb({ l, c, h }) {
  const L = clamp(l, 0, 1);
  const at = (cc) => oklabToLinear({ L, a: cc * Math.cos((h * Math.PI) / 180), b: cc * Math.sin((h * Math.PI) / 180) });
  let cc = Math.max(0, c), lin = at(cc);
  if (!inGamut(lin)) {
    let lo = 0, hi = cc;
    for (let i = 0; i < 24; i += 1) { const mid = (lo + hi) / 2; if (inGamut(at(mid))) lo = mid; else hi = mid; }
    cc = lo; lin = at(cc);
  }
  const [r, g, b] = lin.map((v) => fromLinear(clamp(v, 0, 1)));
  return { r: clamp(Math.round(r), 0, 255), g: clamp(Math.round(g), 0, 255), b: clamp(Math.round(b), 0, 255) };
}
export const oklchHex = (l, c, h) => rgbToHex(oklchToRgb({ l, c, h }));
export const hexToOklch = (hex) => rgbToOklch(parseColor(hex));

// ---------- HSL (for the editor's read-out) ----------
export function rgbToHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: ((h * 60) + 360) % 360, s, l };
}
export function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))); };
  return { r: Math.round(f(0)), g: Math.round(f(8)), b: Math.round(f(4)) };
}
export const describe = (hex) => {
  const c = parseColor(hex);
  if (!c) return null;
  const hsl = rgbToHsl(c), ok = rgbToOklch(c);
  return { hex: rgbToHex(c), rgb: `rgb(${c.r} ${c.g} ${c.b})`, hsl: `hsl(${Math.round(hsl.h)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}%)`, oklch: `oklch(${round(ok.l, 3)} ${round(ok.c, 3)} ${Math.round(ok.h)})` };
};

// ---------- WCAG ----------
// relative luminance (WCAG 2.x), from linearised sRGB, not from a plain RGB average
export const luminance = (color) => { const c = parseColor(color); return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b); };
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const WCAG = { text: 4.5, largeText: 3, ui: 3 };
export const grade = (ratio, min) => (ratio >= min ? 'pass' : ratio >= min * 0.8 ? 'needs-improvement' : 'poor');

// the colour of the same hue and chroma whose lightness is moved the least that reaches `min` contrast on `bg`
export function nearestReadable(color, bg, min = WCAG.text) {
  const base = rgbToOklch(parseColor(color));
  if (contrast(color, bg) >= min) return rgbToHex(parseColor(color));
  const bgDark = luminance(bg) < 0.4;
  const dir = bgDark ? 1 : -1; // on a dark background lighten, on a light one darken
  for (let i = 1; i <= 80; i += 1) {
    const hex = oklchHex(clamp(base.l + dir * i * 0.0125, 0, 1), base.c, base.h);
    if (contrast(hex, bg) >= min) return hex;
  }
  return bgDark ? '#ffffff' : '#000000';
}
// white or a dark text, whichever reads better on `bg` (the dark text keeps the hue of `ink`)
export function readableOn(bg, { light = '#ffffff', dark = '#111827', min = WCAG.text } = {}) {
  const a = contrast(light, bg), b = contrast(dark, bg);
  if (a >= min && (a >= b || b < min)) return { text: light, ratio: a, ok: true };
  if (b >= min) return { text: dark, ratio: b, ok: true };
  return a >= b ? { text: light, ratio: a, ok: false } : { text: dark, ratio: b, ok: false };
}

// ---------- shade scales ----------
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// lightness of each step of an even scale (OKLCH L); the base colour is anchored at the step nearest to its own lightness
const L_STEP = { 50: 0.975, 100: 0.945, 200: 0.89, 300: 0.82, 400: 0.73, 500: 0.64, 600: 0.55, 700: 0.46, 800: 0.38, 900: 0.3, 950: 0.22 };

export function stepFor(color) {
  const l = rgbToOklch(parseColor(color)).l;
  return STEPS.reduce((best, s) => (Math.abs(L_STEP[s] - l) < Math.abs(L_STEP[best] - l) ? s : best), 500);
}

// An 11-step scale from one colour. The colour itself is kept exactly at the step closest to its own lightness (so shade 500 is not
// assumed to be the colour); the other steps follow an even lightness curve through it, with one hue and a chroma that fades at the
// light and dark ends.
export function shadeScale(color) {
  const base = parseColor(color) || parseColor('#6b7280');
  const ok = rgbToOklch(base);
  const anchor = stepFor(rgbToHex(base));
  const top = L_STEP[50], bottom = L_STEP[950];
  const out = {};
  for (const s of STEPS) {
    if (s === anchor) { out[s] = rgbToHex(base); continue; }
    // lightness: the even curve, bent so that it passes through the colour's own lightness at its step
    let l;
    if (s < anchor) l = ok.l + (Math.max(top, ok.l) - ok.l) * ((L_STEP[s] - L_STEP[anchor]) / (L_STEP[50] - L_STEP[anchor] || 1));
    else l = ok.l - (ok.l - Math.min(bottom, ok.l)) * ((L_STEP[anchor] - L_STEP[s]) / (L_STEP[anchor] - L_STEP[950] || 1));
    // chroma: the colour's own chroma through the middle, fading towards white and black; one hue throughout
    const edge = Math.min(l, 1 - l) * 2;
    const c = ok.c * (0.22 + 0.78 * Math.min(1, edge * 1.35));
    out[s] = oklchHex(clamp(l, 0.04, 0.985), c, ok.h);
  }
  return out;
}

// a neutral scale carrying a trace of a hue (so greys feel part of the brand)
export function neutralScale(hue = 250, chroma = 0.012) {
  const out = {};
  for (const s of STEPS) out[s] = oklchHex(L_STEP[s] + (s === 50 ? 0.01 : s === 950 ? -0.07 : 0), chroma * (s === 50 || s === 950 ? 0.7 : 1), hue);
  return out;
}

// mix two colours in OKLab
export function mix(a, b, t) {
  const x = rgbToOklab(parseColor(a)), y = rgbToOklab(parseColor(b));
  const L = x.L + (y.L - x.L) * t, A = x.a + (y.a - x.a) * t, B = x.b + (y.b - x.b) * t;
  const [r, g, bl] = oklabToLinear({ L, a: A, b: B }).map((v) => fromLinear(clamp(v, 0, 1)));
  return rgbToHex({ r, g, b: bl });
}
export const withAlpha = (hex, alpha) => `${rgbToHex(parseColor(hex))}${hx(alpha * 255)}`;
export const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
