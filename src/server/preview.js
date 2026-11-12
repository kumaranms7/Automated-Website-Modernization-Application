import fs from 'node:fs/promises';
import path from 'node:path';
import { clientDir, loadClient } from '../config.js';
import { readHtml } from '../util/html.js';
import { readSource } from '../util/source.js';
import { bannerRoot } from '../template/banners.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Side-by-side preview. /original/<slug>/ serves the untouched site; /preview/<slug>/ serves the
// rebuilt pages, falling back to the original site for images, fonts and scripts. HTML links are
// rewritten on the fly so root-relative and absolute URLs stay inside the preview. Build files are not changed.
export function previewHandler(mode) {
  return async (req, res) => {
    try {
      let [, slug, ...parts] = req.path.split('/');
      // /final/<site>/<build folder>/<page>: any of the three build folders (dry run, sample, full build)
      let outName = '';
      if (mode === 'final') { outName = parts.shift() || ''; if (!['build', 'build-dry', 'build-sample'].includes(outName)) return res.status(404).send('Unknown build'); }
      const client = await loadClient(slug);
      if (!client) return res.status(404).send('Unknown client');
      let rel = decodeURIComponent(parts.join('/'));
      if (!rel || rel.endsWith('/')) rel += 'index.html';

      const roots = mode === 'final' ? [path.join(clientDir(slug), outName), client.sourceDir]
        : mode === 'preview' ? [path.join(clientDir(slug), 'build'), client.sourceDir]
        : mode === 'draft' ? [path.join(clientDir(slug), 'template', 'preview'), client.sourceDir]
        : mode === 'ownpreview' ? [path.join(clientDir(slug), 'template', 'own-preview'), client.sourceDir]
          : [path.join(client.sourceDir, '_modernizer-backup', 'pre-build'), client.sourceDir]; // the original pages, even after the site files were updated
      // the banner pictures of the designed template are kept with its files, not in the site
      roots.push(bannerRoot(slug));
      for (const root of roots) {
        const base = path.resolve(root);
        const full = path.resolve(base, rel);
        if (!full.startsWith(base + path.sep)) continue;
        const st = await fs.stat(full).catch(() => null);
        if (!st?.isFile()) continue;
        const isPhp = /\.php$/i.test(full);
        const fromSource = path.resolve(root) === path.resolve(client.sourceDir);
        if (!/\.(html?|shtml)$/i.test(full) && !(isPhp && (!fromSource || client.php))) return res.sendFile(full);

        const prefix = mode === 'final' ? `/final/${slug}/${outName}/` : `/${mode}/${slug}/`;
        const host = escapeRe(client.host);
        const html = (isPhp && fromSource && client.php ? await readSource(client, rel) : await readHtml(full))
          .replace(/(\b(?:href|src|action)=["'])\/(?!\/)/gi, `$1${prefix}`)
          .replace(new RegExp(`https?://(?:www\\.)?${host}/?`, 'gi'), prefix);
        return res.type('html').send(html);
      }
      res.status(404).send('Not found');
    } catch (e) {
      res.status(400).send(e.message);
    }
  };
}
