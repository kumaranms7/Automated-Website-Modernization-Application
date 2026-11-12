import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPage } from '../src/build/verify.js';

const page = (title, desc, extra = '') => `<!doctype html><html lang="en"><head><title>${title}</title><meta name="description" content="${desc}"><script>gtag("config","G-ABC12345")</script></head><body><h1>Heading</h1><p>Text.</p>${extra}</body></html>`;
const MODEL = { path: 'a.html', blocks: [], protected: { form: null, headScripts: ['<script>gtag("config","G-ABC12345")</script>'] } };
const DESC = 'A complete, well written description of the page that is long enough to pass the length rule of the checks, with room to spare.';

test('a title and description rewritten by the head fixer are checked for validity, not for being equal to the original', () => {
  const orig = page('Old title that is short', 'Old short description.');
  const out = page('A better, complete page title here', DESC);
  const failed = (v) => v.checks.filter((c) => c.level === 'fail').map((c) => c.id);
  assert.deepEqual(failed(verifyPage(MODEL, orig, out)).filter((id) => /title|meta/.test(id)), ['title', 'meta-desc'], 'an unexplained change still fails');
  const fixed = verifyPage(MODEL, orig, out, { headFixed: { title: true, description: true } });
  assert.deepEqual(failed(fixed).filter((id) => /title|meta/.test(id)), []);
  // a rewritten one that is still invalid fails
  const bad = verifyPage(MODEL, orig, page('x'.repeat(80), 'Too short.'), { headFixed: { title: true, description: true } });
  assert.deepEqual(failed(bad).filter((id) => /title|meta/.test(id)), ['title', 'meta-desc']);
});

test('tracking the template page already carries is not counted as lost', () => {
  const orig = page('T', DESC);
  const without = page('T', DESC).replace(/<script>[^<]*<\/script>/, '');
  const noOwn = verifyPage(MODEL, orig, without);
  assert.ok(noOwn.checks.some((c) => c.id === 'head-scripts'));
  const withTemplateTag = without.replace('</head>', '<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC12345"></script></head>');
  const own = verifyPage(MODEL, orig, withTemplateTag, { own: true });
  assert.ok(!own.checks.some((c) => c.id === 'head-scripts'));
});
