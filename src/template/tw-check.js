import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, CLIENTS_DIR } from '../config.js';

const run = promisify(execFile);

// "Does Tailwind actually produce CSS for this class?" Compiles a probe page that uses the classes and looks for each one
// in the output. A class that is misspelt, or that Tailwind does not have, gives no rule and so would silently do nothing.
const cssEscape = (c) => c.replace(/[^A-Za-z0-9_-]/g, (ch) => '\\' + ch);

export async function missingTailwindClasses(classes) {
  const list = [...new Set(classes)].filter(Boolean);
  if (!list.length) return [];
  const dir = path.join(CLIENTS_DIR, '_probe-' + crypto.randomBytes(4).toString('hex'));
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.writeFile(path.join(dir, 'probe.html'), `<div class="${list.join(' ')}"></div>`);
    const main = path.relative(dir, path.join(ROOT, 'src/styles/main.css')).split(path.sep).join('/');
    await fs.writeFile(path.join(dir, 'entry.css'), `@import "${main}";\n@source "./probe.html";\n`);
    const bin = path.join(ROOT, 'node_modules/@tailwindcss/cli/dist/index.mjs');
    await run(process.execPath, [bin, '-i', path.join(dir, 'entry.css'), '-o', path.join(dir, 'out.css'), '--minify'], { cwd: ROOT, timeout: 60000 });
    const css = await fs.readFile(path.join(dir, 'out.css'), 'utf8');
    return list.filter((c) => !css.includes('.' + cssEscape(c)));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
}
