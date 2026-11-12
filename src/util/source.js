import fs from 'node:fs';
import path from 'node:path';
import { readHtml } from './html.js';
import { renderPhp } from '../php/render.js';

// One entry point for "give me the HTML of this page as a visitor sees it". Static pages are read as-is; PHP pages
// are executed with the PHP CLI (read-only, no input) so includes and variables are resolved. Results are cached
// for the life of the process because rendering spawns a process.
const cache = new Map();

export async function readSource(client, rel) {
  const key = `${client.sourceDir}|${rel}`;
  if (cache.has(key)) return cache.get(key);
  // once Content & build has updated the site folder, the original page is the copy saved before it was replaced
  const saved = path.join(client.sourceDir, '_modernizer-backup', 'pre-build', ...rel.split('/'));
  const full = !/\.php$/i.test(rel) && fs.existsSync(saved) ? saved : path.join(client.sourceDir, rel);
  let html;
  if (/\.php$/i.test(rel) && client.php) {
    const r = await renderPhp(client, full);
    if (!r.ok) throw new Error(`Could not render ${rel}: ${r.error}`);
    html = r.html.replace(/^﻿/, '');
  } else {
    html = await readHtml(full);
  }
  cache.set(key, html);
  return html;
}
