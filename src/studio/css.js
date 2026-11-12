import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, CLIENTS_DIR } from '../config.js';

const run = promisify(execFile);
const memo = new Map();

// The editor needs every section style available at once, so one stylesheet is compiled from the renderer's own source
// (every class it can ever output). Theme colours and fonts are not in it: they are appended per page as plain CSS, which
// is why changing a colour in the editor is instant. Classes added by design tweaks are compiled in on top.
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

export async function composerCss(extraClasses = []) {
  const stamp = await newest([path.join(ROOT, 'src/template'), path.join(ROOT, 'src/build/render.js'), path.join(ROOT, 'src/styles/main.css')]);
  const extra = [...new Set(extraClasses)].sort();
  const key = crypto.createHash('sha1').update(stamp + '|' + extra.join(' ')).digest('hex').slice(0, 12);
  if (memo.has(key)) return memo.get(key);
  const dir = path.join(CLIENTS_DIR, '_studio-cache');
  await fs.mkdir(dir, { recursive: true });
  const out = path.join(dir, `composer-${key}.css`);
  let css = await fs.readFile(out, 'utf8').catch(() => '');
  if (!css) {
    const rel = (p) => path.relative(dir, p).split(path.sep).join('/');
    await fs.writeFile(path.join(dir, `extra-${key}.html`), `<div class="${extra.join(' ')}"></div>`);
    await fs.writeFile(path.join(dir, `entry-${key}.css`), [
      `@import "${rel(path.join(ROOT, 'src/styles/main.css'))}";`,
      `@source "${rel(path.join(ROOT, 'src/template'))}";`,
      `@source "${rel(path.join(ROOT, 'src/build/render.js'))}";`,
      `@source "./extra-${key}.html";`,
      '@source inline("{sm:,lg:,}grid-cols-{2,3,4,5}");', // class names the renderer builds from numbers
    ].join('\n'));
    const bin = path.join(ROOT, 'node_modules/@tailwindcss/cli/dist/index.mjs');
    await run(process.execPath, [bin, '-i', path.join(dir, `entry-${key}.css`), '-o', out, '--minify'], { cwd: ROOT, timeout: 120000 });
    css = await fs.readFile(out, 'utf8');
    await fs.rm(path.join(dir, `entry-${key}.css`), { force: true });
    await fs.rm(path.join(dir, `extra-${key}.html`), { force: true });
    // keep the cache small: only the few newest stylesheets
    const old = (await fs.readdir(dir)).filter((f) => f.startsWith('composer-') && f !== `composer-${key}.css`);
    const withTime = await Promise.all(old.map(async (f) => [f, (await fs.stat(path.join(dir, f))).mtimeMs]));
    for (const [f] of withTime.sort((a, b) => b[1] - a[1]).slice(4)) await fs.rm(path.join(dir, f), { force: true });
  }
  memo.set(key, css);
  return css;
}
