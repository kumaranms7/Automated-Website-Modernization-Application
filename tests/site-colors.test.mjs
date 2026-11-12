import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { tokensFrom, hslHex } from '../src/template/site-colors.js';
import { palette, hsl } from '../src/template/own-theme.js';

const col = (hex, bg = 0, text = 0, border = 0) => ({ hex, bg, text, border });
const raw = (colors, buttons = [], extra = {}) => ({ colors, buttons, body: { color: '#222222', bg: '#ffffff' }, linkColor: null, ...extra });
const btn = (bg, n) => ({ bg, color: '#ffffff', n });

test('colours are converted from hue, saturation and lightness', () => {
  assert.equal(hslHex(0, 1, 0.5), '#ff0000');
  assert.equal(hslHex(120, 1, 0.5), '#00ff00');
  assert.equal(hslHex(240, 1, 0.5), '#0000ff');
  assert.equal(hslHex(0, 0, 1), '#ffffff');
  assert.equal(hslHex(0, 0, 0), '#000000');
  const back = hsl(hslHex(200, 0.6, 0.4));
  assert.ok(Math.abs(back.h - 200) <= 2 && Math.abs(back.s - 0.6) < 0.03 && Math.abs(back.l - 0.4) < 0.02);
});

test('the brand colour is the one drawn most, the buttons give the accent', () => {
  // a teal brand drawn on large areas, orange buttons (the same orange on buttons of two shapes counts together)
  const r = raw([col('#19858e', 245, 111), col('#e47229', 53, 251), col('#0b858a', 0, 244), col('#f6f5f6', 400), col('#1a2828', 300)], [btn('#ffffff', 19), btn('#e47229', 2), btn('#19858e', 2), btn('#e47229', 2)]);
  const t = tokensFrom(r);
  assert.equal(t.primary, '#19858e');
  assert.equal(t.accent, '#e47229');
  assert.ok(hsl(t.primaryDark).l < hsl(t.primary).l * 0.7, 'the dark shade is clearly darker');
  assert.ok(Math.abs(hsl(t.primaryDark).h - hsl(t.primary).h) <= 3, 'and the same hue');
  assert.ok(hsl(t.ink).l < 0.3, 'text is dark');
  assert.ok(hsl(t.soft).l > 0.9, 'the soft background is a light tint');
});

test('many words in one colour do not make it the brand', () => {
  // orange links all over the text, but the page is filled with blue
  const t = tokensFrom(raw([col('#e47229', 5, 900), col('#2563eb', 180, 40, 2)], [btn('#e47229', 3)]));
  assert.equal(t.primary, '#2563eb');
  assert.equal(t.accent, '#e47229');
});

test('a website with one colour gets the opposite hue for its call to action', () => {
  const t = tokensFrom(raw([col('#3168b5', 123, 205, 2), col('#ef4444', 0, 9), col('#fbbf24', 0, 4)], [btn('#3168b5', 8)]));
  assert.equal(t.primary, '#3168b5');
  assert.ok(Math.min(Math.abs(hsl(t.accent).h - hsl(t.primary).h), 360 - Math.abs(hsl(t.accent).h - hsl(t.primary).h)) > 100, 'a colour far from the brand hue');
});

test('a website of greys keeps the starter brand colours and takes only its text and background', () => {
  const t = tokensFrom(raw([col('#444444', 100, 100), col('#f4f4f4', 300)], [btn('#444444', 3)], { body: { color: '#111111', bg: '#ffffff' } }));
  assert.equal(t.primary, undefined);
  assert.equal(t.accent, undefined);
  assert.equal(t.ink, '#111111');
  assert.equal(t.soft, '#f4f4f4');
});

test('every colour handed to the template is a six-digit hex', () => {
  const t = tokensFrom(raw([col('#c026d3', 200, 50), col('#fde047', 40, 10)], [btn('#fde047', 4)]));
  for (const v of Object.values(t)) assert.match(v, /^#[0-9a-f]{6}$/);
  assert.equal(Object.keys(t).sort().join(), 'accent,ink,primary,primaryDark,soft');
});

test('the palette reader still names the roles', () => {
  const p = palette({ colors: [{ hex: '#19858e', text: 1, bg: 100, border: 0 }, { hex: '#f6f5f6', text: 0, bg: 300, border: 0 }], buttons: [], linkColor: null, body: { color: '#000000', bg: '#ffffff' } });
  assert.ok(p.some((x) => x.role === 'Primary' && x.hex === '#19858e'));
});

test('a new template starts from the colours read from the website, and from the starter colours when none were read', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-colors-'));
  try {
    fs.mkdirSync(path.join(dir, 'clients', 'a', 'template'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'clients', 'b'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'clients', 'a', 'template', 'site-colors.json'), JSON.stringify({ tokens: { primary: '#3168b5', primaryDark: '#1d3a62', accent: '#d28d2d' } }));
    const code = `
      import { loadActive } from './src/template/store.js';
      const a = await loadActive('a'), b = await loadActive('b');
      console.log(JSON.stringify({ a: [a.source, a.spec.tokens.primary, a.spec.tokens.accent, a.spec.tokens.ink], b: [b.source, b.spec.tokens.primary, b.spec.tokens.accent] }));`;
    const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), env: { ...process.env, SM_DATA_DIR: dir, ELECTRON_RUN_AS_NODE: '' }, encoding: 'utf8' }));
    assert.deepEqual(out.a.slice(0, 3), ['default', '#3168b5', '#d28d2d']);
    assert.match(out.a[3], /^#[0-9a-f]{6}$/i, 'a colour the website did not give stays at the starter value');
    assert.equal(out.b[0], 'default');
    assert.equal(out.b[1].toLowerCase(), '#19858e', 'with nothing read: the starter colours');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
