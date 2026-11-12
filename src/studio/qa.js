// Visual quality assurance. The browser measures a rendered page (what is actually on screen, at three screen sizes) and the
// numbers below turn those measurements into issues and a score. Every deduction comes from a concrete check, so the score
// is explainable; it is a guide, not a guarantee of expert design.

export const WEIGHTS = { hierarchy: 20, spacing: 20, typography: 15, imagery: 15, responsive: 15, consistency: 10, accessibility: 5 };
export const VIEWPORTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1100 }, mobile: { width: 390, height: 844 } };

// runs inside the page
export function collect() {
  const vw = innerWidth, vh = innerHeight;
  const q = (s, r = document) => [...r.querySelectorAll(s)];
  const rect = (el) => el.getBoundingClientRect();
  const cs = (el) => getComputedStyle(el);
  const visible = (el) => { const r = rect(el), c = cs(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && c.opacity !== '0'; };
  const label = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p[3] === undefined ? 1 : p[3] }; };
  const bgOf = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = cs(n); if (c.backgroundImage !== 'none') return null; const p = parse(c.backgroundColor); if (p && p.a > 0.9) return p.rgb; } return [255, 255, 255]; };

  const m = { vw, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight };
  m.overflowX = m.docW > vw + 1;
  m.overflowers = m.overflowX ? q('body *').filter((e) => visible(e) && rect(e).right > vw + 2 && cs(e).position !== 'fixed' && !e.closest('.sr-only')).slice(0, 4).map(label) : [];
  m.brokenImages = q('img').filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && !i.src.startsWith('data:')).slice(0, 6).map((i) => i.getAttribute('src'));
  m.distortedImages = q('img').filter((i) => visible(i) && i.naturalWidth > 0 && cs(i).objectFit === 'fill' && !/\.svg(\?|$)/i.test(i.currentSrc || i.src) && Math.abs(rect(i).width / rect(i).height / (i.naturalWidth / i.naturalHeight) - 1) > 0.12).slice(0, 6).map((i) => i.getAttribute('src'));
  m.noAlt = q('img').filter((i) => i.getAttribute('alt') === null).length;
  m.clipped = q('h1,h2,h3,h4,p,li,a,button,span').filter((e) => visible(e) && cs(e).overflow !== 'visible' && e.scrollWidth > e.clientWidth + 2 && !e.closest('.sr-only')).slice(0, 5).map(label);

  const h = (t) => q(t).filter(visible);
  const fs = (e) => parseFloat(cs(e).fontSize);
  const h1 = h('h1')[0], h2s = h('h2'), h3s = h('h3');
  const lines = (e) => Math.round(rect(e).height / (parseFloat(cs(e).lineHeight) || fs(e) * 1.2));
  m.h1Count = h('h1').length;
  m.h1Size = h1 ? fs(h1) : 0;
  m.h1Lines = h1 ? lines(h1) : 0;
  m.h2Size = h2s.length ? h2s.reduce((n, e) => n + fs(e), 0) / h2s.length : 0;
  m.h3Size = h3s.length ? h3s.reduce((n, e) => n + fs(e), 0) / h3s.length : 0;
  m.maxHeadingLines = Math.max(0, ...q('h1,h2,h3').filter(visible).map(lines));
  const sizes = q('main p').filter(visible).map(fs).sort((a, b) => a - b);
  m.bodySize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0; // the typical paragraph, not an eyebrow or a caption
  m.lineLen = Math.max(0, ...q('main p').filter(visible).map((p) => { const c = fs(p) * 0.5; return rect(p).width / c; }));
  m.families = [...new Set(q('h1,h2,h3,p,a,li').filter(visible).map((e) => cs(e).fontFamily.split(',')[0].replace(/["']/g, '').trim()))].slice(0, 8);
  const order = q('h1,h2,h3,h4').filter(visible).map((e) => Number(e.tagName[1]));
  m.headingSkips = order.reduce((n, l, i) => n + (i && l > order[i - 1] + 1 ? 1 : 0), 0);

  const secs = q('[data-sec]').filter((e) => e.matches('section') && visible(e));
  m.sections = secs.length;
  m.padTops = secs.filter((e) => /\bsec\b/.test(e.className) && !/sec-(tight|loose)/.test(e.className)).map((e) => parseFloat(cs(e).paddingTop));
  const wraps = q('.wrap').filter((e) => visible(e) && !/max-w-/.test(e.className));
  m.wrapLefts = [...new Set(wraps.map((e) => Math.round(rect(e).left)))];
  m.sectionBgs = secs.map((e) => cs(e).backgroundColor);
  const btns = q('.btn').filter(visible);
  m.btnRadii = [...new Set(btns.map((e) => cs(e).borderRadius))];
  m.btnCount = btns.length;
  m.ctaAboveFold = btns.some((e) => rect(e).top < vh && rect(e).top > 0);
  m.smallTargets = q('.btn, nav button, input:not([type=hidden]), select, textarea').filter((e) => visible(e) && rect(e).height < 36).length;
  m.cardRadii = [...new Set(q('.card').filter(visible).map((e) => cs(e).borderRadius))].slice(0, 5);

  const textEls = q('h1,h2,h3,h4,p,li,a,figcaption,.btn,span,label').filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)).slice(0, 140);
  let low = 0, checked = 0;
  const lowList = [];
  for (const e of textEls) {
    const fg = parse(cs(e).color), bg = bgOf(e);
    if (!fg || !bg) continue;
    checked += 1;
    const a = lum(fg.rgb), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = fs(e), bold = Number(cs(e).fontWeight) >= 700;
    if (ratio < (size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5)) { low += 1; if (lowList.length < 4) lowList.push(label(e) + ' ' + ratio.toFixed(1) + ':1'); }
  }
  m.contrastChecked = checked; m.lowContrast = low; m.lowContrastList = lowList;
  return m;
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const spread = (a) => (a.length < 2 ? 0 : (Math.max(...a) - Math.min(...a)) / (Math.max(...a) || 1));

// metrics -> { total, parts, issues }
export function scoreMetrics({ desktop, tablet, mobile, console: logs = [], failed = [], contentFails = [] }) {
  const issues = [];
  const add = (severity, area, message, viewport = '', id = '') => issues.push({ id, severity, area, message, viewport });
  const part = {};

  // hierarchy
  let h = 100;
  if (desktop.h1Count !== 1) { h -= 15; add('med', 'hierarchy', desktop.h1Count ? `${desktop.h1Count} headings of the top level (one is expected)` : 'No main heading (h1) found'); }
  if (desktop.h1Size && desktop.h2Size && desktop.h1Size < desktop.h2Size * 1.15) { h -= 25; add('high', 'hierarchy', `The main heading (${Math.round(desktop.h1Size)}px) is barely larger than section headings (${Math.round(desktop.h2Size)}px)`, 'desktop'); }
  if (desktop.h2Size && desktop.h3Size && desktop.h2Size < desktop.h3Size * 1.1) { h -= 10; add('low', 'hierarchy', 'Section headings and sub-headings are almost the same size', 'desktop'); }
  if (!desktop.ctaAboveFold) { h -= 15; add('med', 'hierarchy', 'No call-to-action button is visible without scrolling', 'desktop'); }
  if (desktop.bodySize && desktop.bodySize < 15) { h -= 10; add('med', 'hierarchy', `Body text is small (${Math.round(desktop.bodySize)}px)`, 'desktop'); }
  part.hierarchy = clamp(h);

  // spacing and alignment
  let s = 100;
  for (const [vp, m] of Object.entries({ desktop, tablet, mobile })) {
    if (m.overflowX) { s -= 25; add('high', 'spacing', `The page scrolls sideways (content wider than the screen: ${m.overflowers.join(', ') || 'unknown element'})`, vp, 'overflow-x'); }
  }
  if (desktop.wrapLefts.length > 1) { const d = Math.max(...desktop.wrapLefts) - Math.min(...desktop.wrapLefts); if (d > 3) { s -= 15; add('med', 'spacing', `Section containers are not aligned (${d}px apart)`, 'desktop'); } }
  const sp = spread(desktop.padTops);
  if (sp > 0.3) { s -= 12; add('low', 'spacing', 'Vertical spacing between sections is uneven', 'desktop'); }
  part.spacing = clamp(s);

  // typography
  let t = 100;
  if (desktop.families.length > 3) { t -= 20; add('med', 'typography', `${desktop.families.length} different fonts are used (${desktop.families.slice(0, 4).join(', ')})`); }
  if (desktop.lineLen > 100) { t -= 10; add('low', 'typography', 'Some paragraphs run very wide (long lines are hard to read)', 'desktop', 'wide-paragraphs'); }
  if (desktop.h1Lines > 4) { t -= 15; add('med', 'typography', `The main heading wraps onto ${desktop.h1Lines} lines`, 'desktop', 'h1-lines'); }
  const clip = (desktop.clipped.length + tablet.clipped.length + mobile.clipped.length);
  if (clip) { t -= Math.min(30, clip * 10); add('high', 'typography', `Text is cut off (${[...new Set([...desktop.clipped, ...mobile.clipped])].slice(0, 3).join(', ')})`); }
  part.typography = clamp(t);

  // images
  let i = 100;
  const broken = [...new Set([...desktop.brokenImages, ...mobile.brokenImages])];
  if (broken.length) { i -= Math.min(60, broken.length * 25); add('high', 'imagery', `${broken.length} image(s) failed to load: ${broken.slice(0, 3).join(', ')}`); }
  if (desktop.distortedImages.length) { i -= 20; add('med', 'imagery', `${desktop.distortedImages.length} image(s) are stretched out of proportion`, 'desktop'); }
  if (desktop.noAlt) { i -= Math.min(15, desktop.noAlt * 3); add('low', 'imagery', `${desktop.noAlt} image(s) have no alt attribute`); }
  part.imagery = clamp(i);

  // responsive
  let r = 100;
  for (const [vp, m] of Object.entries({ tablet, mobile })) if (m.overflowX) { r -= 30; }
  if (mobile.smallTargets > 2) { r -= 12; add('med', 'responsive', `${mobile.smallTargets} buttons or fields are too small to tap comfortably`, 'mobile', 'tap-targets'); }
  if (mobile.maxHeadingLines > 5) { r -= 12; add('med', 'responsive', `A heading wraps onto ${mobile.maxHeadingLines} lines on a phone`, 'mobile'); }
  if (mobile.h1Size && mobile.h1Size > 44) { r -= 8; add('low', 'responsive', `The main heading is very large on a phone (${Math.round(mobile.h1Size)}px)`, 'mobile'); }
  part.responsive = clamp(r);

  // consistency
  let c = 100;
  if (desktop.btnRadii.length > 1) { c -= 15; add('low', 'consistency', 'Buttons use different corner shapes'); }
  if (desktop.cardRadii.length > 2) { c -= 10; add('low', 'consistency', 'Cards use several different corner shapes'); }
  const same = desktop.sectionBgs.filter((b, k) => k && b === desktop.sectionBgs[k - 1]).length;
  if (same >= 3) { c -= 12; add('low', 'consistency', 'Several neighbouring sections share the same background, so the page lacks rhythm', 'desktop'); }
  if (logs.length) { c -= Math.min(30, logs.length * 10); add('high', 'consistency', `${logs.length} browser error(s): ${logs.slice(0, 2).join(' | ')}`); }
  if (failed.length) { c -= Math.min(30, failed.length * 8); add('med', 'consistency', `${failed.length} file(s) could not be loaded: ${failed.slice(0, 2).join(', ')}`); }
  if (contentFails.length) { c -= 30; add('high', 'consistency', `Original content is missing: ${contentFails[0]}`); }
  part.consistency = clamp(c);

  // accessibility
  let a = 100;
  const low = Math.max(desktop.lowContrast, mobile.lowContrast);
  if (low) { a -= Math.min(60, low * 8); add(low > 4 ? 'high' : 'med', 'accessibility', `${low} text element(s) have too little contrast (${(desktop.lowContrastList[0] || mobile.lowContrastList[0] || '').trim()})`); }
  if (desktop.headingSkips) { a -= 20; add('low', 'accessibility', 'Heading levels skip (for example a section heading followed directly by a smaller sub-sub-heading)'); }
  part.accessibility = clamp(a);

  const total = Math.round(Object.entries(WEIGHTS).reduce((n, [k, w]) => n + (part[k] * w) / 100, 0));
  const order = { high: 0, med: 1, low: 2 };
  issues.sort((x, y) => order[x.severity] - order[y.severity]);
  return { total, parts: part, weights: WEIGHTS, issues };
}
