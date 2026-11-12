'use strict';
// Finds a newer portable Site Modernizer file than the one that is running.
// Every portable file is named Site-Modernizer-<version>-<build>-portable.exe (the build is the time it was made, yyyymmddhhmmss), and each start
// of one adds its own path to launchers.txt, so this looks in the folders the portable files have been started from.
const fs = require('node:fs');
const path = require('node:path');

const FILE = /^Site-Modernizer-(\d+\.\d+\.\d+)-(\d{14})-portable\.exe$/i;

function folders(listFile) {
  let lines = [];
  try { lines = fs.readFileSync(listFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean); } catch { return []; }
  const dirs = [...new Set(lines.map((l) => path.dirname(l)))].filter((d) => fs.existsSync(d));
  // the list only needs one line per file: keep it short
  try { fs.writeFileSync(listFile, [...new Set(lines)].filter((l) => fs.existsSync(l)).join('\r\n') + '\r\n'); } catch { /* read-only: fine */ }
  return dirs;
}

// { file, stamp, version } of the newest portable file that is newer than myStamp, or null
function findNewer(listFile, myStamp) {
  if (!listFile || !myStamp || !/^\d{14}$/.test(myStamp)) return null;
  let best = null;
  for (const dir of folders(listFile)) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      const m = FILE.exec(n);
      if (m && m[2] > myStamp && (!best || m[2] > best.stamp)) best = { file: path.join(dir, n), stamp: m[2], version: m[1] };
    }
  }
  return best;
}

module.exports = { findNewer, FILE };
