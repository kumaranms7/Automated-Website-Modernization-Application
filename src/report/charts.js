import { esc } from '../util/html.js';

// Small dependency-free SVG charts for the modernisation report. Colours come from CSS classes in the report page, so the charts follow its
// light/dark theme and print cleanly: .c-before (grey), .c-after (teal), .c-p0..c-p5 (categorical).

const n = (v) => Number(v) || 0;
const fmt = (v) => n(v).toLocaleString('en-US');

// before / after pairs, one row per item: [{ label, a, b, aText, bText }]
export function pairBars(items, { a = 'Before', b = 'After', width = 760, labelW = 230 } = {}) {
  if (!items.length) return '';
  const max = Math.max(...items.flatMap((i) => [n(i.a), n(i.b)]), 1);
  const rowH = 38, top = 28, plot = width - labelW - 110;
  const h = top + items.length * rowH + 6;
  const bar = (v, y, cls, text) => `<rect class="${cls}" x="${labelW}" y="${y}" width="${Math.max(2, (n(v) / max) * plot)}" height="12" rx="3"/><text class="c-val" x="${labelW + Math.max(2, (n(v) / max) * plot) + 6}" y="${y + 10}">${esc(text)}</text>`;
  const rows = items.map((i, k) => {
    const y = top + k * rowH;
    return `<text class="c-lab" x="${labelW - 10}" y="${y + 17}" text-anchor="end">${esc(String(i.label).slice(0, 38))}</text>${bar(i.a, y + 2, 'c-before', i.aText ?? fmt(i.a))}${bar(i.b, y + 18, 'c-after', i.bText ?? fmt(i.b))}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${h}" role="img" aria-label="${esc(a)} and ${esc(b)} compared">
<rect class="c-before" x="${labelW}" y="6" width="12" height="12" rx="3"/><text class="c-lab" x="${labelW + 18}" y="16">${esc(a)}</text><rect class="c-after" x="${labelW + 100}" y="6" width="12" height="12" rx="3"/><text class="c-lab" x="${labelW + 118}" y="16">${esc(b)}</text>${rows}</svg>`;
}

// one value per row: [{ label, v, text }]
export function bars(items, { width = 760, labelW = 230, cls = 'c-after' } = {}) {
  if (!items.length) return '';
  const max = Math.max(...items.map((i) => n(i.v)), 1);
  const rowH = 26, plot = width - labelW - 110, h = items.length * rowH + 6;
  const rows = items.map((i, k) => {
    const y = 3 + k * rowH, w = Math.max(2, (n(i.v) / max) * plot);
    return `<text class="c-lab" x="${labelW - 10}" y="${y + 14}" text-anchor="end">${esc(String(i.label).slice(0, 38))}</text><rect class="${i.cls || cls}" x="${labelW}" y="${y + 2}" width="${w}" height="15" rx="3"/><text class="c-val" x="${labelW + w + 6}" y="${y + 14}">${esc(i.text ?? fmt(i.v))}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${h}" role="img">${rows}</svg>`;
}

// vertical columns for two series over the same buckets: [{ label, a, b }]
export function columns(buckets, { a = 'Before', b = 'After', width = 760, height = 240 } = {}) {
  const max = Math.max(...buckets.flatMap((k) => [n(k.a), n(k.b)]), 1);
  const base = height - 34, plotH = height - 74, gap = (width - 40) / buckets.length;
  const cols = buckets.map((k, i) => {
    const x = 30 + i * gap, bw = Math.min(46, gap / 2 - 8);
    const ha = (n(k.a) / max) * plotH, hb = (n(k.b) / max) * plotH;
    return `<rect class="c-before" x="${x + gap / 2 - bw - 2}" y="${base - ha}" width="${bw}" height="${ha}" rx="3"/><text class="c-val" x="${x + gap / 2 - bw / 2 - 2}" y="${base - ha - 5}" text-anchor="middle">${fmt(k.a)}</text>`
      + `<rect class="c-after" x="${x + gap / 2 + 2}" y="${base - hb}" width="${bw}" height="${hb}" rx="3"/><text class="c-val" x="${x + gap / 2 + bw / 2 + 2}" y="${base - hb - 5}" text-anchor="middle">${fmt(k.b)}</text>`
      + `<text class="c-lab" x="${x + gap / 2}" y="${base + 18}" text-anchor="middle">${esc(k.label)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img"><line class="c-axis" x1="24" x2="${width - 10}" y1="${base}" y2="${base}"/>
<rect class="c-before" x="${width - 190}" y="6" width="12" height="12" rx="3"/><text class="c-lab" x="${width - 172}" y="16">${esc(a)}</text><rect class="c-after" x="${width - 100}" y="6" width="12" height="12" rx="3"/><text class="c-lab" x="${width - 82}" y="16">${esc(b)}</text>${cols}</svg>`;
}

// donut with a legend: [{ label, v }]
export function donut(parts, { size = 190, centre = '', sub = '' } = {}) {
  const total = parts.reduce((s, p) => s + n(p.v), 0) || 1;
  const r = size / 2 - 18, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let off = 0;
  const arcs = parts.map((p, i) => {
    const len = (n(p.v) / total) * C;
    const s = `<circle class="c-p${i % 6}s" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off += len;
    return s;
  }).join('');
  const legend = parts.map((p, i) => `<li><i class="c-p${i % 6}"></i>${esc(p.label)} <b>${fmt(p.v)}</b> <small>${Math.round((n(p.v) / total) * 100)}%</small></li>`).join('');
  return `<div class="donut"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">${arcs}<text class="c-big" x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(centre)}</text><text class="c-lab" x="${cx}" y="${cy + 22}" text-anchor="middle">${esc(sub)}</text></svg><ul class="legend">${legend}</ul></div>`;
}
