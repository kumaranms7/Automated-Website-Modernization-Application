import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { allowedHosts, refuseRequest, siteFolderProblem } from '../src/server/guard.js';

const hosts = allowedHosts(4310);

test('the portal answers its own address only', () => {
  assert.equal(refuseRequest({ host: '127.0.0.1:4310' }, hosts), null);
  assert.equal(refuseRequest({ host: 'localhost:4310' }, hosts), null);
  assert.equal(refuseRequest({ host: '[::1]:4310' }, hosts), null);
  assert.ok(refuseRequest({ host: 'evil.example' }, hosts), 'a DNS name that was pointed at this computer is refused');
  assert.ok(refuseRequest({ host: 'evil.example:4310' }, hosts));
  assert.ok(refuseRequest({ host: '127.0.0.1:9999' }, hosts), 'another port is refused');
  assert.ok(refuseRequest({}, hosts), 'no address at all is refused');
});

test('a page of another website cannot use the portal', () => {
  const ok = { host: '127.0.0.1:4310' };
  assert.equal(refuseRequest({ ...ok, origin: 'http://127.0.0.1:4310' }, hosts), null, 'the portal itself');
  assert.equal(refuseRequest({ ...ok, origin: 'http://localhost:4310' }, hosts), null);
  assert.ok(refuseRequest({ ...ok, origin: 'http://evil.example' }, hosts));
  assert.ok(refuseRequest({ ...ok, origin: 'http://127.0.0.1:8080' }, hosts), 'another local page is another site');
  assert.ok(refuseRequest({ ...ok, origin: 'null' }, hosts), 'a sandboxed or file page');
  assert.ok(refuseRequest({ ...ok, 'sec-fetch-site': 'cross-site' }, hosts));
  assert.equal(refuseRequest({ ...ok, 'sec-fetch-site': 'same-origin' }, hosts), null);
  assert.equal(refuseRequest({ ...ok, 'sec-fetch-site': 'none' }, hosts), null, 'typing the address in the browser');
});

test('another address can be allowed on purpose', () => {
  const more = allowedHosts(4310, 'office-pc:4310, Other:80');
  assert.equal(refuseRequest({ host: 'office-pc:4310' }, more), null);
  assert.equal(refuseRequest({ host: 'other:80' }, more), null);
});

test('a website folder cannot be a drive, a system folder or the home folder', () => {
  const home = os.homedir();
  assert.ok(siteFolderProblem(path.parse(home).root));
  assert.ok(siteFolderProblem(home));
  assert.ok(siteFolderProblem(path.join(home, 'Documents')));
  assert.ok(siteFolderProblem(path.join(home, 'Desktop')));
  if (process.platform === 'win32') {
    assert.ok(siteFolderProblem(process.env.SystemRoot || 'C:\\Windows'));
    assert.ok(siteFolderProblem(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')));
    assert.ok(siteFolderProblem(process.env.ProgramFiles || 'C:\\Program Files'));
    assert.ok(siteFolderProblem(path.join(home, 'AppData', 'Roaming', 'x')));
    assert.ok(siteFolderProblem('C:\\Users'));
  }
});

test('a folder of one website is fine, also inside Documents', () => {
  assert.equal(siteFolderProblem(path.join(os.homedir(), 'Documents', 'my-site')), null);
  assert.equal(siteFolderProblem(path.join(os.tmpdir().slice(0, 3), 'sites', 'plumber')), null);
});

test('a website cannot be where the portal keeps its own data', () => {
  const data = path.join(os.tmpdir(), 'sm-data-guard');
  assert.ok(siteFolderProblem(data, [data]), 'the data folder itself');
  assert.ok(siteFolderProblem(path.join(data, 'clients', 'x'), [data]), 'inside it');
  assert.ok(siteFolderProblem(os.tmpdir(), [data]), 'a folder that contains it');
  assert.equal(siteFolderProblem(path.join(os.tmpdir().slice(0, 3), 'sm-other-site'), [data]), null);
});
