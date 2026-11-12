// WCAG contrast helpers. Client brand colours are kept exactly as supplied for backgrounds and decoration;
// where a brand colour is used for text we derive the closest shade that meets AA (4.5:1) automatically.

const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (hex) => { const [r, g, b] = toRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Darken `hex` (towards black) until it reaches `min` contrast on `bg`.
export function ensureContrast(hex, bg = '#ffffff', min = 4.7) {
  if (contrast(hex, bg) >= min) return hex;
  const [r, g, b] = toRgb(hex);
  for (let t = 0.04; t <= 1; t += 0.02) {
    const c = toHex([r * (1 - t), g * (1 - t), b * (1 - t)]);
    if (contrast(c, bg) >= min) return c;
  }
  return '#000000';
}

// Text colour that reads best on a brand background (white or the dark ink).
export function onColor(bg, ink = '#1a2828') {
  return contrast('#ffffff', bg) >= 4.5 ? '#ffffff' : contrast(ink, bg) >= 4.5 ? ink : contrast('#ffffff', bg) > contrast('#000000', bg) ? '#ffffff' : '#000000';
}

// Lighten `hex` (towards white) until it reads on every dark background in `bgs`.
export function ensureContrastOnDark(hex, bgs, min = 4.6) {
  const [r, g, b] = toRgb(hex);
  for (let t = 0; t <= 1; t += 0.03) {
    const col = toHex([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t]);
    if (bgs.every((bg) => contrast(col, bg) >= min)) return col;
  }
  return '#ffffff';
}
