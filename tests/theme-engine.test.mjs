import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rgbToHex, rgbToOklch, oklchToRgb, contrast, shadeScale, STEPS, parseColor, toHex, describe, hueGap } from '../src/theme/color.js';
import { buildTheme, updateTheme, compactTheme, cssVars, themeCss, tailwindBlock, legacyTokens, TOKEN_PATHS } from '../src/theme/engine.js';
import { detectIndustry, INDUSTRIES } from '../src/theme/industry.js';
import { localThemes, validateAiThemes } from '../src/theme/generate.js';
import { themeFromJson } from '../src/theme/store.js';

const get = (tokens, p) => p.split('.').reduce((o, k) => o?.[k], tokens);
const base = { primary: '#3168b5', secondary: '#1f2937', accent: '#e47229', neutral: '#6b7280', background: '#ffffff' };

test('colour maths: known WCAG ratios and an OKLCH round trip', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrast('#767676', '#ffffff').toFixed(2), '4.54');
  for (const hex of ['#3168b5', '#e47229', '#0b858a', '#777777']) {
    const back = oklchToRgb(rgbToOklch(parseColor(hex)));
    assert.equal(rgbToHex(back), hex);
  }
  assert.deepEqual(Object.keys(describe('#3168b5')).sort(), ['hex', 'hsl', 'oklch', 'rgb']);
});

test('a shade scale has 11 steps, gets darker, keeps its hue and holds the base colour', () => {
  const sc = shadeScale('#3168b5');
  assert.deepEqual(Object.keys(sc).map(Number), STEPS);
  const lights = STEPS.map((s) => rgbToOklch(parseColor(sc[s])).l);
  for (let i = 1; i < lights.length; i++) assert.ok(lights[i] < lights[i - 1], `step ${STEPS[i]} is darker`);
  assert.ok(Object.values(sc).includes('#3168b5'), 'the base colour is one of the steps');
  const hues = STEPS.slice(1, -1).map((s) => rgbToOklch(parseColor(sc[s])).h);
  assert.ok(Math.max(...hues.map((h) => hueGap(h, hues[0]))) < 12, 'hue stays consistent');
});

test('a theme has every token in both modes, and 20 contrast checks that pass for a sound brand', () => {
  const t = buildTheme({ name: 'T', base });
  for (const m of ['light', 'dark']) {
    for (const p of TOKEN_PATHS) assert.match(String(get(t[m], p)), /^#[0-9a-f]{6}([0-9a-f]{2})?$/i, `${m} ${p}`);
  }
  assert.equal(t.checks.light.length, 20);
  assert.ok(t.checks.light.every((c) => c.status === 'pass'), 'light mode passes');
  assert.ok(t.checks.dark.every((c) => c.ratio >= 3), 'dark mode readable');
});

test('dark mode is calculated, not inverted', () => {
  const t = buildTheme({ name: 'T', base });
  const l = rgbToOklch(parseColor(t.dark.background.main)).l;
  assert.ok(l < 0.3, 'dark background');
  assert.notEqual(t.dark.background.main, t.light.text.primary);
  assert.notEqual(t.dark.text.primary, t.light.background.main);
  assert.ok(contrast(t.dark.text.primary, t.dark.background.main) >= 7);
  // the brand colour is the same colour family in both modes
  assert.ok(hueGap(rgbToOklch(parseColor(t.dark.brand.primary)).h, rgbToOklch(parseColor(t.light.brand.primary)).h) < 8);
});

test('a hand-set token survives a base-colour change, and is reported', () => {
  const t = buildTheme({ name: 'T', base });
  const a = updateTheme(t, { tokens: { 'text.heading': '#111111' }, editMode: 'light' });
  assert.equal(a.light.text.heading, '#111111');
  const b = updateTheme(a, { base: { primary: '#0f766e' } });
  assert.equal(b.light.text.heading, '#111111');
  assert.equal(b.base.primary, '#0f766e');
  assert.notEqual(b.light.brand.primary, t.light.brand.primary);
  const c = updateTheme(b, { clearOverrides: true });
  assert.notEqual(c.light.text.heading, '#111111');
});

test('a poor pair is flagged with a suggestion and the brand colour is not changed silently', () => {
  const t = updateTheme(buildTheme({ name: 'T', base }), { tokens: { 'text.primary': '#bbbbbb' }, editMode: 'light' });
  const bad = t.checks.light.filter((c) => c.status !== 'pass');
  assert.ok(bad.length > 0);
  assert.ok(bad.some((c) => c.suggestion));
  assert.equal(t.light.brand.primary, '#3168b5');
});

test('the five variations are complete and clearly different', () => {
  const themes = localThemes(base);
  assert.ok(themes.length >= 5);
  const prim = new Set(themes.map((t) => t.base.primary + t.base.accent));
  assert.equal(prim.size, themes.length);
  for (const t of themes) assert.ok(t.checks.light.every((c) => c.ratio >= 3), t.name);
  assert.equal(new Set(themes.map((t) => t.name)).size, themes.length);
});

test('industry presets: twelve, each valid, and detected from the text', () => {
  const ids = Object.keys(INDUSTRIES);
  assert.equal(ids.length, 12);
  for (const id of ids) assert.equal(buildTheme({ name: id, base: INDUSTRIES[id].base }).checks.light.length, 20, id);
  assert.equal(detectIndustry({ summary: 'emergency plumbing, drain cleaning and water heater repair' }).id, 'plumbing');
});

test('css: variables and Tailwind utilities come from one place', () => {
  const t = buildTheme({ name: 'T', base });
  const vars = cssVars(t, 'light');
  assert.equal(vars['--th-brand-primary'], '#3168b5');
  assert.ok('--th-text-primary' in vars);
  assert.match(themeCss({ ...t, mode: 'auto' }), /prefers-color-scheme:\s*dark/);
  const tw = tailwindBlock();
  for (const u of ['bg-primary', 'bg-surface', 'text-muted', 'text-inverse', 'border-default', 'ring-focus']) assert.ok(tw.includes(`@utility ${u}`), u);
  const css = fs.readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');
  assert.ok(css.includes(tailwindBlock().trim()), 'main.css holds the current generated block');
  const legacy = legacyTokens(t);
  assert.ok(contrast('#ffffff', legacy.primaryDark) >= 7);
});

test('AI output is checked and the unusable parts are dropped', () => {
  const ok = { themes: [{ name: 'A', description: 'd', primary: '#3168b5', secondary: '#1f2937', accent: '#e47229', neutral: '#6b7280', background: '#ffffff' }] };
  assert.equal(validateAiThemes(ok).themes.length, 1);
  const bad = validateAiThemes({ themes: [{ name: 'B', primary: 'blue-ish', secondary: '#111111', accent: '#e47229' }] });
  assert.equal(bad.themes.length, 0);
  assert.ok(bad.problems.length > 0);
  assert.equal(validateAiThemes(null).themes.length, 0);
});

test('import accepts the plain brief shape and rejects junk', () => {
  const r = themeFromJson({ name: 'Brief', brand: { primary: '#2563eb', secondary: '#0f172a', accent: '#f59e0b' }, text: { primary: '#111827' }, border: { default: '#e5e7eb' } });
  assert.equal(r.base.primary, '#2563eb');
  assert.equal(r.overrides.light['text.primary'], '#111827');
  assert.throws(() => themeFromJson('{nope'), /not valid JSON/);
  assert.throws(() => themeFromJson({ brand: { primary: 'zzz' } }), /valid colour/);
  assert.throws(() => themeFromJson({ x: 1 }), /no theme colours/);
  const t = buildTheme({ name: 'Round', base });
  assert.equal(themeFromJson({ format: 'site-modernizer-theme', theme: compactTheme(t) }).base.primary, '#3168b5');
});

test('a template with a theme writes the variables, follows light/dark/auto, and keeps layout when the theme changes', async () => {
  const { normalizeSpec, DEFAULT_SPEC, specCss } = await import('../src/template/spec.js');
  const mk = (b, mode) => normalizeSpec({ theme: compactTheme(buildTheme({ name: 'T', base: b, mode })) }, DEFAULT_SPEC);
  const a = mk(base, 'light'), b = mk({ ...base, primary: '#0f766e' }, 'auto');
  assert.match(specCss(a), /--th-brand-primary:\s*#3168b5/i);
  assert.doesNotMatch(specCss(a), /prefers-color-scheme:\s*dark/);
  assert.match(specCss(b), /prefers-color-scheme:\s*dark/);
  assert.deepEqual({ ...a, theme: null, tokens: null }, { ...b, theme: null, tokens: null }, 'only colours differ');
});
