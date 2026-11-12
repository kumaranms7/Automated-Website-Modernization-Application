import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { explainCheck, explainRow, skipText } from '../src/build/problems.js';

const { findNewer } = createRequire(import.meta.url)('../electron/updates.cjs');

test('every failed check is named in plain words and says what to do', () => {
  const c = explainCheck({ id: 'title', level: 'fail', msg: 'title missing or too long (104)' });
  assert.equal(c.name, 'Page title');
  assert.match(c.fix, /build the page again/i);
  assert.equal(c.msg, 'title missing or too long (104)');
});

test('a check nobody named still gets readable words and a next step', () => {
  const c = explainCheck({ id: 'some-new-check', level: 'warn', msg: 'x' });
  assert.equal(c.name, 'Some new check');
  assert.ok(c.fix.length > 10);
  assert.equal(explainCheck({ id: 'ai:claims', level: 'fail', msg: 'x' }).name, 'AI wording check');
});

test('a row keeps its checks and gains the explanation', () => {
  const row = explainRow({ path: 'a.html', checks: [{ id: 'phones', level: 'fail', msg: 'tel links lost: 555' }] });
  assert.equal(row.checks[0].name, 'Phone links');
  assert.deepEqual(explainRow({ path: 'b.html' }), { path: 'b.html' });
});

test('a page that was left out says why', () => {
  assert.match(skipText('unrecognised-layout').msg, /layout/i);
  assert.match(skipText('kept as it is: the new page would score lower (90 to 80)').msg, /score lower/);
  assert.ok(skipText('').msg.length > 5);
});

test('a newer portable file next to a started one is found', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-portable-'));
  try {
    const old = path.join(dir, 'Site-Modernizer-1.1.0-20261101100000-portable.exe');
    const fresh = path.join(dir, 'Site-Modernizer-1.1.0-20261102120000-portable.exe');
    fs.writeFileSync(old, 'x'); fs.writeFileSync(fresh, 'x');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    const list = path.join(dir, 'launchers.txt');
    fs.writeFileSync(list, `${old}\r\n${old}\r\n`);
    const newer = findNewer(list, '20261101100000');
    assert.equal(path.basename(newer.file), path.basename(fresh));
    assert.equal(newer.stamp, '20261102120000');
    assert.equal(findNewer(list, '20261102120000'), null, 'the newest one has nothing newer');
    assert.equal(findNewer(list, 'dev'), null, 'a development run is never told to update');
    assert.equal(findNewer(path.join(dir, 'missing.txt'), '20261101100000'), null);
    assert.equal(fs.readFileSync(list, 'utf8').trim().split(/\r?\n/).length, 1, 'the list keeps one line per file');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------- wording review and the activity lines ----------
import { wordingChanges, logLine } from '../src/build/final.js';

test('what the AI changed is listed edit by edit, with the refused ones', () => {
  const w = wordingChanges({
    mode: 'enhance', status: 'generated', inPlace: true, cost: 0.02, source: { title: 'Old title' },
    content: { title: 'New title', units: [{ kind: 'html', before: '<p>We fix <b>pipes</b>.</p>', after: '<p>We repair <b>pipes</b>.</p>' }, { kind: 'text', before: 'Same', after: 'Same' }], rejected: [{ before: '<p>Call 555</p>', after: '<p>Call us</p>', reason: 'A phone number was changed' }] },
    issues: [{ level: 'warn', msg: 'careful' }],
  });
  assert.equal(w.changes.length, 1, 'an edit that changes nothing is not listed');
  assert.equal(w.changes[0].before, 'We fix pipes.');
  assert.equal(w.rejected[0].reason, 'A phone number was changed');
  assert.deepEqual(w.title, { before: 'Old title', after: 'New title' });
  assert.equal(wordingChanges({ mode: 'existing' }), null, 'a page with its own wording has no AI changes');
  assert.equal(wordingChanges(null), null);
});

test('the activity lines keep only the latest ones', () => {
  const job = {};
  for (let i = 0; i < 60; i += 1) logLine(job, `line ${i}`);
  assert.equal(job.log.length, 40);
  assert.equal(job.log.at(-1).text, 'line 59');
  assert.equal(job.log[0].text, 'line 20');
});

// ---------- Download as HTML in saved reports ----------
import { withDownloadButton, DOWNLOAD_SCRIPT } from '../src/report/download.js';

const OLD_REPORT = '<html><head><title>R</title></head><body><button onclick="window.print()" class="no-print x"><i class="ph ph-printer"></i><span class="hidden 2xl:inline">Print / Save PDF</span></button><table></table></body></html>';
const count = (s, part) => s.split(part).length - 1;

test('a report made before the button gets the button, the script that saves it and the print layout, once each', () => {
  const html = withDownloadButton(OLD_REPORT);
  assert.equal(count(html, 'id="dl-html-btn"'), 1);
  assert.equal(count(html, 'async function downloadReportHtml'), 1);
  assert.equal(count(html, 'id="print-fix"'), 1);
  assert.ok(html.indexOf('dl-html-btn') < html.indexOf('window.print()'), 'the button is placed before Print');
  assert.match(html, /class="no-print x"[^>]*title/, 'it has the classes of the Print button');
  assert.equal(withDownloadButton(html), html, 'a second pass changes nothing');
});

test('a report that has the button but not the script behind it is repaired', () => {
  const broken = OLD_REPORT.replace('<button onclick', '<button type="button" id="dl-html-btn" onclick="downloadReportHtml()" class="a"><span>Download as HTML</span></button><button onclick');
  const html = withDownloadButton(broken);
  assert.equal(count(html, 'async function downloadReportHtml'), 1);
  assert.equal(count(html, 'id="dl-html-btn"'), 1, 'no second button');
});

test('the first floating version is replaced by the toolbar button', () => {
  const floating = OLD_REPORT.replace('</body>', '<style id="print-fix">@page{}</style><button type="button" id="dl-html-float" onclick="downloadReportHtml()">Download as HTML</button>' + DOWNLOAD_SCRIPT + '</body>');
  const html = withDownloadButton(floating);
  assert.equal(count(html, 'id="dl-html-float"'), 0);
  assert.equal(count(html, 'id="dl-html-btn"'), 1);
  assert.equal(count(html, 'async function downloadReportHtml'), 1);
});

test('a report without a Print button gets a floating button, and the script goes before the last body tag', () => {
  const html = withDownloadButton('<html><body><script>var s = "</body>";</script><p>x</p></body></html>');
  assert.equal(count(html, 'id="dl-html-float"'), 1);
  assert.ok(html.lastIndexOf('async function downloadReportHtml') > html.indexOf('var s ='));
});
