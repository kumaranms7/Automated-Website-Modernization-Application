import path from 'node:path';
import { clientDir, readJson } from '../config.js';

// Picks the three pages a template is designed on: the home page, a typical inner page, and the contact page.
// Each suggestion comes with the reason, plus runners-up, so it can be overridden by hand.

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export async function suggestPages(slug) {
  const pages = await readJson(path.join(clientDir(slug), 'scan/pages.json'), []);
  const usable = pages.filter((p) => !/\.(php|shtml)$/i.test(p.path) || true);

  const home = usable
    .map((p) => ({ p, score: (p.type === 'home' ? 100 : 0) + (/^index\.(html?|php)$/i.test(p.path) ? 60 : 0) + (p.path.split('/').length === 1 && /^(home|default)\./i.test(p.path) ? 30 : 0) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
    .map((x) => ({ path: x.p.path, title: x.p.title, why: x.p.type === 'home' ? 'Detected as the home page' : 'Site root index page' }));

  const contact = usable
    .map((p) => {
      const hay = `${p.path} ${p.h1?.[0] || ''} ${p.title}`.toLowerCase();
      const score = (/contact/.test(hay) ? 6 : 0) + (/schedule|quote|book|appointment|get-in-touch/.test(hay) ? 3 : 0) + (p.forms?.length ? 3 : 0) + (p.wordCount < 400 ? 2 : 0) - (/thank/.test(hay) ? 10 : 0) - (p.path.split('/').length > 2 ? 2 : 0);
      return { p, score };
    })
    .filter((x) => x.score >= 5).sort((a, b) => b.score - a.score)
    .map((x) => ({ path: x.p.path, title: x.p.title, why: `Looks like the contact page (${x.p.forms?.length ? 'has a form, ' : ''}${x.p.wordCount} words)` }));

  // A typical inner page: representative length, well structured, not a duplicate, has an image.
  const content = usable.filter((p) => ['service', 'location-service', 'location-hub'].includes(p.type));
  const med = median(content.map((p) => p.wordCount));
  const inner = content
    .map((p) => {
      const dup = p.issues.some((i) => i.code === 'duplicate-content');
      const score = Math.min(p.h2.length, 6) * 2 + (p.images.length ? 2 : 0) + (dup ? -3 : 2) - Math.abs(p.wordCount - med) / Math.max(med, 1) * 4 + (p.path.split('/').length === 1 ? 1 : 0);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => ({ path: x.p.path, title: x.p.title, why: `Typical content page: ${x.p.wordCount} words, ${x.p.h2.length} sections, ${x.p.images.length} image(s)` }));

  const top = (list) => ({ pick: list[0] || null, alternatives: list.slice(1, 6) });
  return {
    home: top(home),
    inner: top(inner),
    contact: top(contact),
    all: pages.map((p) => ({ path: p.path, title: p.title, type: p.type, words: p.wordCount })),
  };
}
