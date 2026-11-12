import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'render.php');
const CANDIDATES = ['php', 'E:\\xampp\\php\\php.exe', 'C:\\xampp\\php\\php.exe'];

let cached;
export async function phpAvailable(bin) {
  if (cached !== undefined && !bin) return Boolean(cached);
  for (const b of [bin, ...CANDIDATES].filter(Boolean)) {
    try { await run(b, ['-v']); cached = b; return true; } catch { /* try next */ }
  }
  cached = null;
  return false;
}

// Runs a PHP page like the web server would and returns the HTML. Read-only: pages run with no POST data,
// so form handlers and other scripts that need input produce no output and are classed "not a page".
export async function renderPhp(client, file) {
  const bin = client.php?.bin || cached || 'php';
  try {
    const { stdout } = await run(bin, ['-d', 'display_errors=0', SCRIPT, file, client.sourceDir, client.php?.host || client.host], { timeout: 20000, maxBuffer: 20 * 1024 * 1024, cwd: path.dirname(file) });
    return { ok: true, html: stdout };
  } catch (e) {
    return { ok: false, error: String(e.stderr || e.message).slice(0, 200), html: '' };
  }
}
export { fs };
