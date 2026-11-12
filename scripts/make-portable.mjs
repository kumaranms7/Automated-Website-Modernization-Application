// Wraps the unpacked app (dist-desktop/win-unpacked) in one portable .exe: node scripts/make-portable.mjs (npm run dist:portable does both steps)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const src = path.join(ROOT, 'dist-desktop', 'win-unpacked');
if (!fs.existsSync(path.join(src, 'Site Modernizer.exe'))) throw new Error('Run "npm run dist" first: dist-desktop/win-unpacked is missing.');
const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache', 'nsis');
const find = (dir) => { for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) { const p = path.join(dir, e.name); if (e.isFile() && e.name.toLowerCase() === 'makensis.exe') return p; if (e.isDirectory()) { const f = find(p); if (f) return f; } } return null; };
const makensis = find(cache);
if (!makensis) throw new Error('NSIS was not found in the electron-builder cache. Run "npm run dist" once so it is downloaded.');
const icon = fs.existsSync(path.join(ROOT, 'electron', 'icon.ico')) ? path.join(ROOT, 'electron', 'icon.ico') : path.join(ROOT, 'dist-desktop', '.icon-ico', 'icon.ico');
// a new build id for every run: the launcher keeps one unpacked copy per build, and the file name says which build it is
const builtAt = new Date();
const stamp = builtAt.toISOString().replace(/\D/g, '').slice(0, 14);
const build = `${pkg.version}-${stamp}`;
const out = path.join(ROOT, 'dist-desktop', `Site-Modernizer-${build}-portable.exe`);
// the app reads this to show which build it is and to find a newer portable file (electron/updates.cjs)
fs.writeFileSync(path.join(src, 'resources', 'app', 'build-info.json'), JSON.stringify({ version: pkg.version, stamp, builtAt: builtAt.toISOString() }, null, 2));
execFileSync(makensis, [`-DVER=${pkg.version}`, `-DBUILD=${build}`, `-DOUT=${out}`, `-DSRC=${src}`, `-DICON=${icon}`, path.join(ROOT, 'electron', 'portable.nsi')], { stdio: 'inherit' });
// older portable files are removed, so only the newest one is left to start by mistake
for (const f of fs.readdirSync(path.join(ROOT, 'dist-desktop'))) {
  if (/^Site-Modernizer-.*-portable\.exe$/i.test(f) && path.join(ROOT, 'dist-desktop', f) !== out) { try { fs.rmSync(path.join(ROOT, 'dist-desktop', f)); console.log(`Removed the older file ${f}`); } catch (e) { console.log(`Could not remove ${f}: ${e.message}`); } }
}
console.log(`Portable app: ${out} (${Math.round(fs.statSync(out).size / 1048576)} MB)`);
console.log(`Build ${build}`);
