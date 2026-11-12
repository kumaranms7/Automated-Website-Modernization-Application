import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, CLIENTS_DIR } from '../config.js';
import { tailwindBlock } from '../theme/engine.js';

const run = promisify(execFile);
const memo = new Map();

// The design kit is written with Tailwind classes only. Its stylesheet is Tailwind's own layers, the theme utilities of the website's
// colours (bg-primary, text-muted...), and src/styles/kit.css (tokens, keyframes, the look of plain content elements). The same entry
// compiles the previews (scanning the kit's own source for every class it can output) and the build (scanning the built pages).

const KIT_STYLES = readFileSync(path.join(ROOT, 'src/styles/kit.css'), 'utf8');
export const kitEntry = (rel, source) => `@import "${rel(path.join(ROOT, 'src/styles/tw-base.css'))}";
${tailwindBlock()}
${KIT_STYLES}
${source}
`;

async function newest(paths) {
  let t = 0;
  for (const p of paths) {
    const st = await fs.stat(p).catch(() => null);
    if (!st) continue;
    if (st.isDirectory()) t = Math.max(t, await newest((await fs.readdir(p)).map((f) => path.join(p, f))));
    else t = Math.max(t, st.mtimeMs);
  }
  return t;
}

// the stylesheet of the previews: every class the kit can output, compiled once and kept
export async function kitCss() {
  const stamp = await newest([path.join(ROOT, 'src/kit'), path.join(ROOT, 'src/styles/kit.css'), path.join(ROOT, 'src/theme/engine.js')]);
  const key = crypto.createHash('sha1').update(String(stamp)).digest('hex').slice(0, 12);
  if (memo.has(key)) return memo.get(key);
  const dir = path.join(CLIENTS_DIR, '_studio-cache');
  await fs.mkdir(dir, { recursive: true });
  const out = path.join(dir, `kit-${key}.css`);
  let css = await fs.readFile(out, 'utf8').catch(() => '');
  if (!css) {
    const rel = (p) => path.relative(dir, p).split(path.sep).join('/');
    await fs.writeFile(path.join(dir, `kit-entry-${key}.css`), kitEntry(rel, `@source "${rel(path.join(ROOT, 'src/kit'))}";`));
    const bin = path.join(ROOT, 'node_modules/@tailwindcss/cli/dist/index.mjs');
    await run(process.execPath, [bin, '-i', path.join(dir, `kit-entry-${key}.css`), '-o', out, '--minify'], { cwd: ROOT, timeout: 120000 });
    css = await fs.readFile(out, 'utf8');
    await fs.rm(path.join(dir, `kit-entry-${key}.css`), { force: true });
    for (const f of (await fs.readdir(dir)).filter((f) => f.startsWith('kit-') && f.endsWith('.css') && f !== `kit-${key}.css`)) await fs.rm(path.join(dir, f), { force: true });
  }
  memo.set(key, css);
  return css;
}
