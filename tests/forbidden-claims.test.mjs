import test from 'node:test';
import assert from 'node:assert/strict';
import { findForbiddenClaims } from '../src/content/validate.js';

const profile = { forbiddenClaims: ['#1', '24/7', 'Lowest Price', "we're the best"], approvedFacts: [] };

test('a page fails the claims check only when it uses a claim from "Claims to never make"', () => {
  assert.deepEqual(findForbiddenClaims('Licensed, insured, family-owned since 1999. Free estimates.', profile), []);
  assert.deepEqual(findForbiddenClaims('We are open 24/7 for the LOWEST   price in town', profile).map((c) => c.phrase), ['24/7', 'lowest price']);
  assert.deepEqual(findForbiddenClaims('Voted #1 plumber', profile).map((c) => c.phrase), ['#1']);
  assert.deepEqual(findForbiddenClaims('We’re the best', profile).map((c) => c.phrase), ["we're the best"]);
});

test('whole words only, and an empty list never fails a page', () => {
  assert.deepEqual(findForbiddenClaims('Call #123 for help, 24/70 is not a thing', profile), []);
  assert.deepEqual(findForbiddenClaims('anything 24/7', { forbiddenClaims: [] }), []);
  assert.deepEqual(findForbiddenClaims('anything', {}), []);
});
