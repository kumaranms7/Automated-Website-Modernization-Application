// Compiles the portal's Tailwind stylesheet (src/server/public/portal.src.css -> portal.css).
// Run by `npm run portal` and by the server on start when the stylesheet is missing or older than its sources.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'src/server/public');
const out = path.join(dir, 'portal.css');
const sources = ['portal.src.css', 'index.html', 'app.js', 'template.js', 'dt.js'].map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f));

export function uiStale() {
  if (!fs.existsSync(out)) return true;
  const built = fs.statSync(out).mtimeMs;
  return sources.some((f) => fs.statSync(f).mtimeMs > built);
}

export function buildUi({ force = false } = {}) {
  if (!force && !uiStale()) return false;
  const bin = path.join(ROOT, 'node_modules/@tailwindcss/cli/dist/index.mjs');
  execFileSync(process.execPath, [bin, '-i', path.join(dir, 'portal.src.css'), '-o', out, '--minify'], { cwd: ROOT, stdio: 'pipe' });
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = Date.now();
  const built = buildUi({ force: process.argv.includes('--force') });
  console.log(built ? `portal.css built in ${Date.now() - t} ms (${(fs.statSync(out).size / 1024).toFixed(1)} KB)` : 'portal.css is up to date');
}
