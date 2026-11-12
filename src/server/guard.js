import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Two protections for a portal that runs on this computer only:
//  1. requests must be addressed to the portal itself (127.0.0.1, localhost or ::1 on its own port) and, when a browser says which web page
//     sent them, that page must be the portal. A web page from another site (or a DNS name that was pointed at this computer) is refused.
//  2. a website's folder cannot be a system folder, a drive, the home folder or the place the portal keeps its own data.

// ---- 1. who may talk to the portal ----
export function allowedHosts(port, extra = '') {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  for (const h of String(extra).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) hosts.add(h);
  return hosts;
}

// null when the request is fine, else the reason it is refused
export function refuseRequest(headers, hosts) {
  const host = String(headers.host || '').toLowerCase();
  if (!hosts.has(host)) return 'This address is not allowed. Open the portal at http://127.0.0.1 with its own port.';
  const origin = headers.origin;
  if (origin !== undefined && origin !== 'null') {
    let o = '';
    try { o = new URL(origin).host.toLowerCase(); } catch { /* not an address */ }
    if (!hosts.has(o)) return 'Requests from other websites are not allowed.';
  } else if (origin === 'null') return 'Requests from other websites are not allowed.';
  // a browser also says whether the request came from another site, even when it sends no origin
  if (String(headers['sec-fetch-site'] || '') === 'cross-site') return 'Requests from other websites are not allowed.';
  return null;
}

// ---- 2. which folders may be a website ----
// the real name of a folder: short Windows names (CGVAK-~1), links and different capitals all lead to the same place; a folder that is not there yet keeps its name
const real = (x) => {
  const r = path.resolve(String(x || ''));
  // the nearest folder that exists is resolved, and the rest of the name is kept
  for (let cur = r, rest = ''; ; ) {
    try { return path.join(fs.realpathSync.native(cur), rest); } catch { /* not there */ }
    const up = path.dirname(cur);
    if (up === cur) return r;
    rest = path.join(path.basename(cur), rest); cur = up;
  }
};
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const inside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

// null when the folder may be used, else why not. dataDirs: where the portal keeps its own files.
export function siteFolderProblem(dir, dataDirs = []) {
  const p = real(dir);
  if (path.parse(p).root === p) return 'That is a whole drive. Choose the folder of one website.';
  const env = (k) => process.env[k] || '';
  const home = os.homedir();
  // system and program folders: nothing inside them is a website
  const systemTrees = ['SystemRoot', 'windir', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'ProgramData'].map(env).filter(Boolean);
  if (process.platform !== 'win32') systemTrees.push('/bin', '/boot', '/dev', '/etc', '/lib', '/proc', '/sbin', '/sys', '/usr', '/var', '/System', '/Library', '/Applications');
  if (systemTrees.some((t) => inside(p, real(t)))) return 'That is a system or program folder. Choose the folder of one website.';
  // the home folder and the usual folders in it are too broad: a website lives in a folder of its own inside them
  const broad = [home, env('USERPROFILE'), ...['Desktop', 'Documents', 'Downloads', 'Pictures', 'Videos', 'Music', 'OneDrive', 'AppData'].map((d) => path.join(home, d)), path.dirname(home)].filter(Boolean).map(real);
  if (broad.some((b) => same(b, p))) return 'That folder is too broad (it holds many other things). Choose the folder of one website inside it.';
  if (inside(p, real(path.join(home, 'AppData')))) return 'That is inside the application data of this computer. Choose the folder of one website.';
  // the portal's own files: a website cannot be where they live, inside them, or a folder that contains them
  for (const d of dataDirs.filter(Boolean).map(real)) {
    if (inside(p, d) || inside(d, p)) return 'That folder holds the portal\'s own data. Choose the folder of one website.';
  }
  return null;
}
