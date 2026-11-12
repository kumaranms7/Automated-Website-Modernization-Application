import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BUILT_IN, mergeSettings, tidy } from '../src/app-settings.js';
import { costOf, estimateCost } from '../src/ai/claude.js';

const fresh = () => structuredClone(BUILT_IN);
const merged = (over) => tidy(mergeSettings(fresh(), over));

test('the built-in values are the ones the code used before they were moved', () => {
  assert.equal(BUILT_IN.model.default, 'claude-sonnet-5-5');
  assert.deepEqual(BUILT_IN.prices['claude-sonnet-5-5'], [2, 10]);
  assert.deepEqual(BUILT_IN.prices['claude-opus-5-5'], [4, 20]);
  assert.deepEqual(BUILT_IN.cache, { readOfInput: 0.1, writeOfInput: 1.25 });
  assert.equal(BUILT_IN.limits.samplePages, 10);
  assert.equal(BUILT_IN.limits.browserTestPages, 12);
  assert.deepEqual(BUILT_IN.limits.concurrency, { aiWriting: 3, browserTests: 3, images: 4, phpScan: 6 });
  assert.equal(BUILT_IN.limits.aiRetries, 4);
  assert.equal(BUILT_IN.limits.profilePages, 8);
  assert.equal(BUILT_IN.businessTypes.length, 26);
  assert.ok(BUILT_IN.businessTypes.includes('Plumber') && BUILT_IN.businessTypes.includes('Dentist'));
});

test('a value in the file replaces the built-in one, the rest stays', () => {
  const s = merged({ limits: { samplePages: 25, concurrency: { aiWriting: 6 } }, model: { default: 'claude-opus-5-5' } });
  assert.equal(s.limits.samplePages, 25);
  assert.equal(s.limits.concurrency.aiWriting, 6);
  assert.equal(s.limits.concurrency.images, 4, 'a value that is not in the file keeps its built-in value');
  assert.equal(s.model.default, 'claude-opus-5-5');
  assert.equal(s.limits.browserTestPages, 12);
});

test('a list is replaced as a whole, a price table is added to', () => {
  const s = merged({ businessTypes: ['Dentist', 'Orthodontist'], prices: { 'my-model': [1, 3] } });
  assert.deepEqual(s.businessTypes, ['Dentist', 'Orthodontist']);
  assert.deepEqual(s.prices['my-model'], [1, 3]);
  assert.deepEqual(s.prices['claude-sonnet-5-5'], [2, 10], 'the other prices are still there');
});

test('a value that is not valid is ignored, never half-used', () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const s = merged({ limits: { samplePages: 'many', concurrency: { aiWriting: -2, images: 'x' } }, businessTypes: [], model: { default: '' }, prices: { bad: [1], worse: ['a', 'b'] }, notASetting: 5, _help: 'text' });
    assert.equal(s.limits.samplePages, 10);
    assert.equal(s.limits.concurrency.aiWriting, 3);
    assert.equal(s.limits.concurrency.images, 4);
    assert.equal(s.businessTypes.length, 26);
    assert.equal(s.model.default, 'claude-sonnet-5-5');
    assert.ok(!('bad' in s.prices) && !('worse' in s.prices));
    assert.ok(!('notASetting' in s));
  } finally { console.warn = warn; }
});

test('numbers that count things are kept whole and in a sensible range', () => {
  const s = merged({ limits: { samplePages: 0, browserTestPages: 5000, aiRetries: 99, concurrency: { aiWriting: 0, images: 400, phpScan: 2.6 } } });
  assert.equal(s.limits.samplePages, 1);
  assert.equal(s.limits.browserTestPages, 200);
  assert.equal(s.limits.aiRetries, 10);
  assert.deepEqual(s.limits.concurrency, { aiWriting: 1, browserTests: 3, images: 16, phpScan: 3 });
});

test('business types are kept only when they are schema names, and the chosen model is always offered', () => {
  const s = merged({ businessTypes: ['Plumber', 'not a type!', 'Plumber', 'X'], model: { default: 'brand-new-model' } });
  assert.deepEqual(s.businessTypes, ['Plumber']);
  assert.ok(s.model.list.some((m) => m.id === 'brand-new-model'));
});

test('the price table decides what a request costs', () => {
  assert.equal(estimateCost('claude-sonnet-5-5', 1_000_000, 1_000_000), 12);
  assert.equal(estimateCost('claude-opus-5-5', 1_000_000, 0), 4);
  assert.equal(estimateCost('no-such-model', 1000, 1000), null);
  // cached text: read back at a tenth of the input price, written at one and a quarter
  assert.equal(+costOf('claude-sonnet-5-5', { input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 0 }).toFixed(6), 0.2);
  assert.equal(+costOf('claude-sonnet-5-5', { input_tokens: 0, cache_creation_input_tokens: 1_000_000, output_tokens: 0 }).toFixed(6), 2.5);
});

test('a settings file in the data folder changes what the app runs on', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-settings-'));
  try {
    fs.writeFileSync(path.join(dir, 'app-settings.json'), JSON.stringify({ limits: { samplePages: 30, concurrency: { aiWriting: 7 } }, model: { default: 'claude-haiku-5-5' }, businessTypes: ['Dentist'], prices: { 'claude-haiku-5-5': [0.2, 1] } }));
    const run = (code) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), env: { ...process.env, SM_DATA_DIR: dir, ELECTRON_RUN_AS_NODE: '' }, encoding: 'utf8' }));
    const out = run(`
      import { APP, prepareSettingsFiles } from './src/app-settings.js';
      import { modelId, ratesFor } from './src/ai/claude.js';
      import { BUSINESS_TYPES } from './src/profile/facts.js';
      prepareSettingsFiles();
      console.log(JSON.stringify({ sample: APP.limits.samplePages, ai: APP.limits.concurrency.aiWriting, model: modelId(), rates: ratesFor('claude-haiku-5-5'), types: BUSINESS_TYPES }));`);
    assert.deepEqual(out, { sample: 30, ai: 7, model: 'claude-haiku-5-5', rates: [0.2, 1], types: ['Dentist'] });
    // the file you edit is left as you wrote it, and a reference copy of every setting is written next to it
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'app-settings.json'), 'utf8')).limits.samplePages, 30);
    const ref = JSON.parse(fs.readFileSync(path.join(dir, 'app-settings.defaults.json'), 'utf8'));
    assert.equal(ref.limits.samplePages, 10);
    assert.ok(ref.prices['claude-sonnet-5-5']);
    // with no file at all the built-in values are used and an empty file is created to edit
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-settings-'));
    const out2 = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `import { APP, prepareSettingsFiles } from './src/app-settings.js'; prepareSettingsFiles(); console.log(JSON.stringify({ sample: APP.limits.samplePages, model: APP.model.default }));`], { env: { ...process.env, SM_DATA_DIR: empty, ELECTRON_RUN_AS_NODE: '' }, encoding: 'utf8' }));
    assert.deepEqual(out2, { sample: 10, model: 'claude-sonnet-5-5' });
    assert.ok(fs.existsSync(path.join(empty, 'app-settings.json')));
    fs.rmSync(empty, { recursive: true, force: true });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
