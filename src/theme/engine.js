import { parseColor, toHex, isHex, rgbToOklch, oklchHex, shadeScale, neutralScale, mix, withAlpha, contrast, readableOn, nearestReadable, grade, WCAG, STEPS, stepFor, hueGap } from './color.js';

// The Theme Engine: a theme is a few base colours (primary, secondary, accent, neutral, optionally a background) and everything else
// follows from them, in a light and a dark mode that are each worked out on their own (the dark mode is not the light one turned over):
// shade scales, brand, background, text, surface, border, status and interactive colours, and the WCAG checks on the pairs that matter.
// The same input always gives the same theme.
//
// Rules the engine keeps:
//   - the colours the user chose are kept exactly: brand.primary, brand.secondary and brand.accent are the base colours in every mode
//   - a colour that is used for text or as a button background is the closest shade of the same hue that reads well, and the check
//     says so ("adjusted"): it is never changed silently
//   - a token the user set by hand (overrides) is never overwritten when the base colours change

export const TOKEN_GROUPS = {
  brand: ['primary', 'primaryHover', 'primaryActive', 'primaryLight', 'primarySubtle', 'secondary', 'secondaryHover', 'secondaryLight', 'accent', 'accentHover', 'accentLight'],
  background: ['main', 'alternate', 'section', 'dark', 'light', 'muted', 'overlay'],
  text: ['primary', 'secondary', 'muted', 'inverse', 'heading', 'link', 'linkHover', 'onDark'],
  surface: ['card', 'cardHover', 'elevated', 'input', 'form', 'navigation', 'footer', 'modal'],
  border: ['default', 'light', 'strong', 'input', 'focus', 'divider'],
  status: ['success', 'successBackground', 'successText', 'warning', 'warningBackground', 'warningText', 'error', 'errorBackground', 'errorText', 'info', 'infoBackground', 'infoText'],
  interactive: ['primaryButton', 'primaryButtonHover', 'primaryButtonText', 'secondaryButton', 'secondaryButtonHover', 'secondaryButtonText', 'disabledButton', 'disabledButtonText', 'focusRing', 'selection'],
};
export const TOKEN_PATHS = Object.entries(TOKEN_GROUPS).flatMap(([g, keys]) => keys.map((k) => `${g}.${k}`));
export const SCALES = ['primary', 'secondary', 'accent', 'neutral'];
export const MODES = ['light', 'dark', 'auto'];

// the labels the editor shows
export const TOKEN_LABELS = {
  'brand.primary': 'Primary', 'brand.primaryHover': 'Primary hover', 'brand.primaryActive': 'Primary active', 'brand.primaryLight': 'Primary light', 'brand.primarySubtle': 'Primary subtle',
  'brand.secondary': 'Secondary', 'brand.secondaryHover': 'Secondary hover', 'brand.secondaryLight': 'Secondary light', 'brand.accent': 'Accent', 'brand.accentHover': 'Accent hover', 'brand.accentLight': 'Accent light',
  'background.main': 'Main background', 'background.alternate': 'Alternate background', 'background.section': 'Section background', 'background.dark': 'Dark background', 'background.light': 'Light background', 'background.muted': 'Muted background', 'background.overlay': 'Overlay background',
  'text.primary': 'Primary text', 'text.secondary': 'Secondary text', 'text.muted': 'Muted text', 'text.inverse': 'Inverse text', 'text.heading': 'Heading text', 'text.link': 'Link text', 'text.linkHover': 'Link hover', 'text.onDark': 'Text on dark bands',
  'surface.card': 'Card background', 'surface.cardHover': 'Card hover', 'surface.elevated': 'Elevated surface', 'surface.input': 'Input background', 'surface.form': 'Form background', 'surface.navigation': 'Navigation background', 'surface.footer': 'Footer background', 'surface.modal': 'Modal background',
  'border.default': 'Default border', 'border.light': 'Light border', 'border.strong': 'Strong border', 'border.input': 'Input border', 'border.focus': 'Focus border', 'border.divider': 'Divider',
  'status.success': 'Success', 'status.successBackground': 'Success background', 'status.successText': 'Success text', 'status.warning': 'Warning', 'status.warningBackground': 'Warning background', 'status.warningText': 'Warning text',
  'status.error': 'Error', 'status.errorBackground': 'Error background', 'status.errorText': 'Error text', 'status.info': 'Information', 'status.infoBackground': 'Information background', 'status.infoText': 'Information text',
  'interactive.primaryButton': 'Primary button', 'interactive.primaryButtonHover': 'Primary button hover', 'interactive.primaryButtonText': 'Primary button text', 'interactive.secondaryButton': 'Secondary button', 'interactive.secondaryButtonHover': 'Secondary button hover', 'interactive.secondaryButtonText': 'Secondary button text',
  'interactive.disabledButton': 'Disabled button', 'interactive.disabledButtonText': 'Disabled button text', 'interactive.focusRing': 'Focus ring', 'interactive.selection': 'Selection colour',
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const STATUS_BASE = { success: '#16a34a', warning: '#d97706', error: '#dc2626', info: '#0284c7' };

// ---------- the base colours ----------
// Accepts anything, returns six-digit colours. A missing secondary, accent or neutral is worked out from the primary.
export function normaliseBase(input = {}) {
  const primary = toHex(input.primary, '#2563eb');
  const p = rgbToOklch(parseColor(primary));
  const secondary = toHex(input.secondary, oklchHex(0.27, Math.min(0.06, Math.max(0.02, p.c * 0.35)), p.h));
  const accent = toHex(input.accent, oklchHex(0.7, Math.max(0.14, Math.min(0.2, p.c)), (p.h + 180) % 360));
  const nb = toHex(input.neutral, null);
  const neutral = nb || oklchHex(0.55, 0.012, p.h);
  const background = toHex(input.background, null);
  return { primary, secondary, accent, neutral, ...(background ? { background } : {}) };
}

export function scalesOf(base) {
  const n = rgbToOklch(parseColor(base.neutral));
  return { primary: shadeScale(base.primary), secondary: shadeScale(base.secondary), accent: shadeScale(base.accent), neutral: neutralScale(n.h, clamp(n.c, 0, 0.03)) };
}

// the closest step of a scale to a colour, for "the next darker" and "the next lighter"
const stepIndex = (scale, hex) => { const s = stepFor(hex); return STEPS.indexOf(s); };
const stepAt = (scale, i) => scale[STEPS[clamp(i, 0, STEPS.length - 1)]];

// A button background from a base colour and the text on it. The base colour is used when text reads on it (white or the dark text);
// else the nearest darker shade (lighter in dark mode) that does. `adjusted` says the base colour was not used.
function buttonFor(base, scale, textDark, dark) {
  const first = readableOn(base, { dark: textDark });
  if (first.ok) return { bg: base, text: first.text, adjusted: false };
  const i0 = stepIndex(scale, base);
  const order = dark ? [...Array(STEPS.length).keys()].filter((i) => i !== i0).sort((a, b) => Math.abs(a - i0) - Math.abs(b - i0) || b - a) : [...Array(STEPS.length - 1 - i0).keys()].map((k) => i0 + 1 + k);
  for (const i of order) { const c = readableOn(scale[STEPS[i]], { dark: textDark }); if (c.ok) return { bg: scale[STEPS[i]], text: c.text, adjusted: true }; }
  return { bg: base, text: first.text, adjusted: false, failed: true };
}

// ---------- light mode ----------
function lightTokens(base, sc, notes) {
  const P = sc.primary, S = sc.secondary, A = sc.accent, N = sc.neutral;
  const bgMain = base.background || '#ffffff';
  const alternate = base.background ? mix(bgMain, N[200], 0.35) : N[50];
  const textDark = N[900];
  const pi = stepIndex(P, base.primary), si = stepIndex(S, base.secondary), ai = stepIndex(A, base.accent);
  const link = nearestReadable(nearestReadable(base.primary, bgMain, WCAG.text), alternate, WCAG.text);
  const primaryBtn = buttonFor(base.primary, P, textDark, false);
  const secondaryBtn = buttonFor(base.secondary, S, textDark, false);
  if (primaryBtn.adjusted) notes.push(`Primary button uses a ${primaryBtn.bg} shade of the primary colour, so its text reads (the brand colour itself is unchanged).`);
  if (secondaryBtn.adjusted) notes.push(`Secondary button uses a ${secondaryBtn.bg} shade of the secondary colour, so its text reads.`);
  if (link !== base.primary) notes.push(`Links use ${link}, the closest shade of the primary colour that reads on the background.`);
  const ring = [P[500], P[600], P[700], P[800]].find((c) => contrast(c, bgMain) >= WCAG.ui) || P[800];
  const dk = (hex) => mix(hex, N[950], 0.0);
  const status = (name) => { const s = shadeScale(STATUS_BASE[name]); return { [name]: s[600], [`${name}Background`]: s[50], [`${name}Text`]: nearestReadable(s[800], s[50], WCAG.text) }; };
  return {
    brand: {
      primary: base.primary, primaryHover: stepAt(P, pi + 1), primaryActive: stepAt(P, pi + 2), primaryLight: P[100], primarySubtle: P[50],
      secondary: base.secondary, secondaryHover: stepAt(S, si + 1), secondaryLight: S[100], accent: base.accent, accentHover: stepAt(A, ai + 1), accentLight: A[100],
    },
    background: { main: bgMain, alternate, section: base.background ? mix(bgMain, N[300], 0.3) : N[100], dark: S[950] && contrast(S[900], '#ffffff') >= 7 ? S[900] : N[900], light: '#ffffff', muted: N[100], overlay: withAlpha(N[950], 0.6) },
    text: { primary: N[900], secondary: nearestReadable(N[600], bgMain, WCAG.text), muted: nearestReadable(N[500], bgMain, WCAG.text), inverse: '#ffffff', heading: N[950], link, linkHover: nearestReadable(stepAt(P, stepIndex(P, link) + 1), alternate, WCAG.text), onDark: '#ffffff' },
    surface: { card: '#ffffff', cardHover: N[50], elevated: '#ffffff', input: '#ffffff', form: N[50], navigation: '#ffffff', footer: S[900] && contrast(S[900], '#ffffff') >= 7 ? S[900] : N[900], modal: '#ffffff' },
    border: { default: N[200], light: N[100], strong: N[300], input: [N[400], N[500], N[600]].find((c) => contrast(c, '#ffffff') >= WCAG.ui) || N[600], focus: ring, divider: N[200] },
    status: { ...status('success'), ...status('warning'), ...status('error'), ...status('info') },
    interactive: {
      primaryButton: primaryBtn.bg, primaryButtonHover: stepAt(P, stepIndex(P, primaryBtn.bg) + 1), primaryButtonText: primaryBtn.text,
      secondaryButton: secondaryBtn.bg, secondaryButtonHover: stepAt(S, stepIndex(S, secondaryBtn.bg) + 1), secondaryButtonText: secondaryBtn.text,
      disabledButton: N[200], disabledButtonText: N[500], focusRing: ring, selection: P[200],
    },
  };
}

// ---------- dark mode: its own backgrounds, surfaces, text, borders and buttons ----------
function darkTokens(base, sc, notes) {
  const P = sc.primary, S = sc.secondary, A = sc.accent, N = sc.neutral;
  const bgMain = N[950];
  const textLight = N[50];
  // a brand colour that cannot be seen on the dark background (a dark navy) is shown as its closest lighter shade; the base colour stays the token of the light mode
  const visible = (hex, scale, name) => {
    if (contrast(hex, bgMain) >= WCAG.ui) return hex;
    const i0 = stepIndex(scale, hex);
    for (let i = i0 - 1; i >= 0; i -= 1) if (contrast(scale[STEPS[i]], bgMain) >= WCAG.ui) { notes.push(`In dark mode the ${name} colour is shown as ${scale[STEPS[i]]}: ${hex} would be hard to see on the dark background.`); return scale[STEPS[i]]; }
    return hex;
  };
  const primary = visible(base.primary, P, 'primary'), secondary = visible(base.secondary, S, 'secondary'), accent = visible(base.accent, A, 'accent');
  const pi = stepIndex(P, primary), si = stepIndex(S, secondary), ai = stepIndex(A, accent);
  const link = nearestReadable(nearestReadable(base.primary, bgMain, WCAG.text), N[900], WCAG.text);
  const primaryBtn = buttonFor(base.primary, P, N[950], true);
  const secondaryBtn = buttonFor(secondary, S, N[950], true);
  const ring = [P[400], P[300], P[500], P[200]].find((c) => contrast(c, bgMain) >= WCAG.ui) || P[200];
  const status = (name) => { const s = shadeScale(STATUS_BASE[name]); return { [name]: s[400], [`${name}Background`]: s[950], [`${name}Text`]: nearestReadable(s[200], s[950], WCAG.text) }; };
  const light = (hex, by) => mix(hex, '#ffffff', by);
  return {
    brand: {
      primary, primaryHover: stepAt(P, pi - 1), primaryActive: stepAt(P, pi - 2), primaryLight: P[900], primarySubtle: P[950],
      secondary, secondaryHover: stepAt(S, si - 1), secondaryLight: S[900], accent, accentHover: stepAt(A, ai - 1), accentLight: A[900],
    },
    background: { main: bgMain, alternate: N[900], section: mix(N[900], N[800], 0.5), dark: mix(N[950], '#000000', 0.45), light: N[800], muted: N[800], overlay: withAlpha('#000000', 0.7) },
    text: { primary: textLight, secondary: nearestReadable(N[300], bgMain, WCAG.text), muted: nearestReadable(N[400], bgMain, WCAG.text), inverse: N[950], heading: light(N[50], 0.5), link, linkHover: nearestReadable(light(link, 0.18), N[900], WCAG.text), onDark: N[50] },
    surface: { card: N[900], cardHover: N[800], elevated: N[800], input: N[900], form: N[900], navigation: N[950], footer: mix(N[950], '#000000', 0.3), modal: N[800] },
    border: { default: N[700], light: N[800], strong: N[600], input: [N[600], N[500], N[400]].find((c) => contrast(c, N[900]) >= WCAG.ui) || N[400], focus: ring, divider: N[800] },
    status: { ...status('success'), ...status('warning'), ...status('error'), ...status('info') },
    interactive: {
      primaryButton: primaryBtn.bg, primaryButtonHover: stepAt(P, stepIndex(P, primaryBtn.bg) - 1), primaryButtonText: primaryBtn.text,
      secondaryButton: secondaryBtn.bg, secondaryButtonHover: stepAt(S, stepIndex(S, secondaryBtn.bg) - 1), secondaryButtonText: secondaryBtn.text,
      disabledButton: N[800], disabledButtonText: N[500], focusRing: ring, selection: P[800],
    },
  };
}

// ---------- overrides: tokens the user set by hand ----------
const getPath = (t, path) => { const [g, k] = path.split('.'); return t[g]?.[k]; };
function applyOverrides(tokens, over = {}) {
  for (const [path, value] of Object.entries(over)) {
    if (!TOKEN_PATHS.includes(path)) continue;
    const hex = toHex(value, null);
    if (!hex && !/^#[0-9a-f]{8}$/i.test(String(value))) continue;
    const [g, k] = path.split('.');
    tokens[g][k] = hex || String(value).toLowerCase();
  }
  return tokens;
}

// ---------- the checks ----------
// pairs that must be readable: text on its background (4.5), large text and UI parts (3)
const PAIRS = [
  ['text.primary', 'background.main', 'Body text on the page', WCAG.text],
  ['text.secondary', 'background.main', 'Secondary text on the page', WCAG.text],
  ['text.muted', 'background.main', 'Muted text on the page', WCAG.text],
  ['text.heading', 'background.main', 'Headings on the page', WCAG.largeText],
  ['text.primary', 'background.alternate', 'Body text on the alternate background', WCAG.text],
  ['text.link', 'background.main', 'Links on the page', WCAG.text],
  ['text.link', 'background.alternate', 'Links on the alternate background', WCAG.text],
  ['text.primary', 'surface.card', 'Text on cards', WCAG.text],
  ['text.primary', 'surface.input', 'Text in form fields', WCAG.text],
  ['text.onDark', 'background.dark', 'Text on the dark background', WCAG.text],
  ['text.onDark', 'surface.footer', 'Text on the footer', WCAG.text],
  ['interactive.primaryButtonText', 'interactive.primaryButton', 'Primary button text', WCAG.text],
  ['interactive.secondaryButtonText', 'interactive.secondaryButton', 'Secondary button text', WCAG.text],
  ['interactive.focusRing', 'background.main', 'Focus ring on the page', WCAG.ui],
  ['border.input', 'surface.input', 'Form field border', WCAG.ui],
  ['brand.primary', 'background.main', 'Primary colour as a graphic on the page', WCAG.ui],
  ['status.successText', 'status.successBackground', 'Success message', WCAG.text],
  ['status.warningText', 'status.warningBackground', 'Warning message', WCAG.text],
  ['status.errorText', 'status.errorBackground', 'Error message', WCAG.text],
  ['status.infoText', 'status.infoBackground', 'Information message', WCAG.text],
];
const LEVEL = { pass: 'Pass', 'needs-improvement': 'Needs improvement', poor: 'Poor contrast' };

export function checksFor(tokens) {
  return PAIRS.map(([fgPath, bgPath, label, min]) => {
    const fg = getPath(tokens, fgPath), bg = getPath(tokens, bgPath);
    const ratio = contrast(fg.slice(0, 7), bg.slice(0, 7));
    const status = grade(ratio, min);
    const out = { id: `${fgPath}|${bgPath}`, label, fg: fgPath, bg: bgPath, fgHex: fg, bgHex: bg, min, ratio: +ratio.toFixed(2), status, level: LEVEL[status] };
    if (status !== 'pass') {
      // the closest colour of the same hue that reads, the brand colours themselves are not changed
      out.suggestion = { hex: nearestReadable(fg, bg, min), ratio: +contrast(nearestReadable(fg, bg, min), bg).toFixed(2), alternative: readableOn(bg, { min }).text };
    }
    return out;
  });
}

// ---------- the theme ----------
let counter = 0;
export function buildTheme(input = {}) {
  const base = normaliseBase(input.base || input);
  const sc = scalesOf(base);
  const notes = { light: [], dark: [] };
  const overrides = { light: { ...(input.overrides?.light || {}) }, dark: { ...(input.overrides?.dark || {}) } };
  const light = applyOverrides(lightTokens(base, sc, notes.light), overrides.light);
  const dark = applyOverrides(darkTokens(base, sc, notes.dark), overrides.dark);
  const checks = { light: checksFor(light), dark: checksFor(dark) };
  const mode = MODES.includes(input.mode) ? input.mode : 'light';
  const score = (list) => ({ pass: list.filter((c) => c.status === 'pass').length, needsImprovement: list.filter((c) => c.status === 'needs-improvement').length, poor: list.filter((c) => c.status === 'poor').length, total: list.length });
  return {
    id: String(input.id || `theme-${String(++counter).padStart(3, '0')}`),
    name: String(input.name || 'Custom theme').slice(0, 60),
    description: String(input.description || '').slice(0, 240),
    category: String(input.category || '').slice(0, 40),
    style: String(input.style || '').slice(0, 40),
    source: ['extracted', 'industry', 'ai', 'custom', 'imported', 'local'].includes(input.source) ? input.source : 'custom',
    mode, base, overrides, scales: sc, light, dark, notes, checks, summary: { light: score(checks.light), dark: score(checks.dark) },
  };
}

// the tokens of one mode as they are used on the website ('auto' uses the light tokens as its main set)
export const tokensOf = (theme, mode = theme.mode) => (mode === 'dark' ? theme.dark : theme.light);

// ---------- changing a theme ----------
// A base colour changed: everything derived from it is worked out again, the tokens the user set by hand stay.
// A token set directly (a heading colour, a background): it is kept as an override in that mode.
export function updateTheme(theme, patch = {}) {
  const input = { id: theme.id, name: theme.name, description: theme.description, category: theme.category, style: theme.style, source: theme.source === 'ai' || theme.source === 'extracted' || theme.source === 'industry' ? 'custom' : theme.source, mode: theme.mode, base: { ...theme.base }, overrides: { light: { ...theme.overrides.light }, dark: { ...theme.overrides.dark } } };
  for (const k of ['name', 'description', 'category', 'style']) if (patch[k] !== undefined) input[k] = patch[k];
  if (patch.mode && MODES.includes(patch.mode)) input.mode = patch.mode;
  for (const [k, v] of Object.entries(patch.base || {})) { const hex = toHex(v, null); if (hex && ['primary', 'secondary', 'accent', 'neutral', 'background'].includes(k)) input.base[k] = hex; }
  const mode = patch.editMode === 'dark' ? 'dark' : 'light';
  for (const [path, v] of Object.entries(patch.tokens || {})) {
    if (!TOKEN_PATHS.includes(path)) continue;
    if (v === null) delete input.overrides[mode][path];
    else if (toHex(v, null)) input.overrides[mode][path] = toHex(v);
  }
  // all hand-set tokens at once (the editor saves its whole state): only real tokens with real colours are kept
  if (patch.overrides) {
    input.overrides = { light: {}, dark: {} };
    for (const m of ['light', 'dark']) for (const [path, v] of Object.entries(patch.overrides[m] || {})) if (TOKEN_PATHS.includes(path) && toHex(v, null)) input.overrides[m][path] = toHex(v);
  }
  if (patch.clearOverrides) input.overrides = { light: {}, dark: {} };
  return buildTheme(input);
}

// only what has to be saved: the base colours, what the user set by hand, and the labels. The rest is always worked out again.
export const compactTheme = (t) => ({ id: t.id, name: t.name, description: t.description, category: t.category, style: t.style, source: t.source, mode: t.mode, base: t.base, overrides: t.overrides });

// ---------- the CSS of a theme ----------
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase();
const VAR_NAME = {
  'background.main': 'bg', 'background.alternate': 'bg-alt', 'background.section': 'bg-section', 'background.dark': 'bg-dark', 'background.light': 'bg-light', 'background.muted': 'bg-muted', 'background.overlay': 'bg-overlay',
  'interactive.primaryButton': 'btn-primary', 'interactive.primaryButtonHover': 'btn-primary-hover', 'interactive.primaryButtonText': 'btn-primary-text',
  'interactive.secondaryButton': 'btn-secondary', 'interactive.secondaryButtonHover': 'btn-secondary-hover', 'interactive.secondaryButtonText': 'btn-secondary-text',
  'interactive.disabledButton': 'btn-disabled', 'interactive.disabledButtonText': 'btn-disabled-text', 'interactive.focusRing': 'focus-ring', 'interactive.selection': 'selection',
};
// --th-brand-primary, --th-text-link-hover, --th-status-success-bg ...
export const varName = (path) => `--th-${VAR_NAME[path] || path.replace('.', '-').split('-').map((p, i) => (i < 2 ? p : kebab(p))).join('-').replace(/([a-z])([A-Z])/g, (_, x, y) => `${x}-${y.toLowerCase()}`).replace(/-background$/, '-bg')}`;

// every variable of one mode: all tokens and the shade scales
export function cssVars(theme, mode = theme.mode === 'dark' ? 'dark' : 'light') {
  const tokens = mode === 'dark' ? theme.dark : theme.light;
  const out = {};
  for (const path of TOKEN_PATHS) out[varName(path)] = getPath(tokens, path);
  for (const name of SCALES) for (const s of STEPS) out[`--th-${name}-${s}`] = theme.scales[name][s];
  return out;
}

// the stylesheet part of a theme: light as the base, dark when the mode asks for it ('dark' on its own, 'auto' by the visitor's setting)
export function themeCss(theme) {
  const block = (vars) => Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join('\n  ');
  const light = block(cssVars(theme, 'light')), dark = block(cssVars(theme, 'dark'));
  if (theme.mode === 'dark') return `:root {\n  color-scheme: dark;\n  ${dark}\n}`;
  if (theme.mode === 'auto') return `:root {\n  color-scheme: light dark;\n  ${light}\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n  ${dark}\n  }\n}`;
  return `:root {\n  color-scheme: light;\n  ${light}\n}`;
}

// the Tailwind utilities that read the variables above (written into src/styles/main.css, and checked against this table by a test)
export const TW_UTILITIES = (() => {
  const u = [];
  const add = (prefix, name, path, prop = 'color') => u.push([`${prefix}-${name}`, varName(path), prop]);
  for (const [n, p] of [['primary', 'brand.primary'], ['primary-hover', 'brand.primaryHover'], ['primary-active', 'brand.primaryActive'], ['primary-light', 'brand.primaryLight'], ['primary-subtle', 'brand.primarySubtle'],
    ['secondary', 'brand.secondary'], ['secondary-hover', 'brand.secondaryHover'], ['secondary-light', 'brand.secondaryLight'], ['accent-hover', 'brand.accentHover'], ['accent-tint', 'brand.accentLight'],
    ['background', 'background.main'], ['background-alt', 'background.alternate'], ['section', 'background.section'], ['dark', 'background.dark'], ['muted', 'background.muted'], ['overlay', 'background.overlay'],
    ['surface', 'surface.card'], ['surface-hover', 'surface.cardHover'], ['elevated', 'surface.elevated'], ['input', 'surface.input'], ['nav', 'surface.navigation'], ['footer', 'surface.footer'], ['modal', 'surface.modal'],
    ['success', 'status.success'], ['success-soft', 'status.successBackground'], ['warning', 'status.warning'], ['warning-soft', 'status.warningBackground'], ['error', 'status.error'], ['error-soft', 'status.errorBackground'], ['info', 'status.info'], ['info-soft', 'status.infoBackground'],
    ['button', 'interactive.primaryButton'], ['button-hover', 'interactive.primaryButtonHover'], ['button-secondary', 'interactive.secondaryButton'], ['button-secondary-hover', 'interactive.secondaryButtonHover'], ['button-disabled', 'interactive.disabledButton']]) add('bg', n, p);
  for (const [n, p] of [['primary', 'text.primary'], ['secondary', 'text.secondary'], ['muted', 'text.muted'], ['inverse', 'text.inverse'], ['heading', 'text.heading'], ['link', 'text.link'], ['link-hover', 'text.linkHover'], ['on-dark', 'text.onDark'],
    ['brand', 'brand.primary'], ['success', 'status.successText'], ['warning', 'status.warningText'], ['error', 'status.errorText'], ['info', 'status.infoText'], ['button', 'interactive.primaryButtonText'], ['button-secondary', 'interactive.secondaryButtonText'], ['button-disabled', 'interactive.disabledButtonText']]) add('text', n, p);
  for (const [n, p] of [['default', 'border.default'], ['light', 'border.light'], ['strong', 'border.strong'], ['input', 'border.input'], ['focus', 'border.focus'], ['divider', 'border.divider'], ['primary', 'brand.primary']]) add('border', n, p);
  add('divide', 'default', 'border.default');
  add('ring', 'focus', 'interactive.focusRing');
  add('outline', 'focus', 'interactive.focusRing');
  return u;
})();

const PROP = { bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color', outline: 'outline-color' };
// dividers colour the lines between the children of the element, not the element itself
const utilityRule = (name, v) => (name.startsWith('divide-') ? `@utility ${name} { & > :not(:last-child) { border-color: var(${v}); } }` : `@utility ${name} { ${PROP[name.split('-')[0]]}: var(${v}); }`);
export function tailwindBlock() {
  const scales = SCALES.flatMap((n) => STEPS.map((s) => `  --color-${n}-${s}: var(--th-${n}-${s});`)).join('\n');
  const utils = TW_UTILITIES.map(([name, v]) => utilityRule(name, v)).join('\n');
  return `@theme inline {\n${scales}\n}\n${utils}`;
}

// the colours the template's own (older) variables are given from a theme: the sections read these
export function legacyTokens(theme, mode = theme.mode === 'dark' ? 'dark' : 'light') {
  const t = tokensOf(theme, mode);
  const P = theme.scales.primary;
  // the dark band colour must carry white text
  const dark = [P[800], P[900], P[700], P[950]].find((c) => contrast(c, '#ffffff') >= 7) || P[950];
  return { primary: t.brand.primary, primaryDark: mode === 'dark' ? t.background.dark : dark, accent: t.brand.accent, ink: t.text.primary, soft: t.background.alternate };
}
