import { siteKey, canonicalUrl, decideCanonical, canonicalFor } from './index.js';

// Checks sitemap.xml against the real pages and builds the recommended one. A sitemap should list exactly the pages meant to be
// found: live (not redirected or removed), indexable (no noindex), under their own canonical address.

const STATUS_TEXT = { 301: 'a 301 redirect', 302: 'a 302 temporary redirect', 410: 'gone (410)', noindex: 'set to noindex', junk: 'a copy or backup file', canon_other: 'canonical to another page', canon_foreign: 'canonical to another website', error: 'an error page' };
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// scheme and www are ignored, "/index.html" is "/", a trailing slash is ignored
function key(url) {
  let u; try { u = new URL(String(url).trim()); } catch { return String(url); }
  let p = dec(u.pathname || '/');
  if (/\/index\.html?$/i.test(p)) p = `${p.slice(0, p.lastIndexOf('/'))}/`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return siteKey(u.href) + p;
}
function relCandidates(loc) {
  let p = ''; try { p = dec(new URL(loc).pathname || '/').replace(/^\/+/, ''); } catch { return []; }
  return p === '' || p.endsWith('/') ? [`${p}index.html`, `${p}index.htm`] : [p, `${p}.html`, `${p}/index.html`];
}

export function parseSitemap(text) {
  const out = { kind: '', urls: [], children: [], extras: false, error: '' };
  const t = String(text || '');
  if (!/<(urlset|sitemapindex)\b/i.test(t)) { out.error = 'cannot read the sitemap: it is not a sitemap file'; return out; }
  out.kind = /<sitemapindex\b/i.test(t) ? 'index' : 'urlset';
  out.extras = /<(image|video|news|xhtml|mobile):/i.test(t);
  for (const m of t.matchAll(/<(url|sitemap)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const loc = (m[2].match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i) || [])[1];
    if (!loc || !loc.trim()) continue;
    const lm = (m[2].match(/<lastmod\b[^>]*>([\s\S]*?)<\/lastmod>/i) || [])[1] || '';
    const item = { loc: loc.trim().replace(/&amp;/g, '&'), lastmod: lm.trim() };
    (out.kind === 'index' ? out.children : out.urls).push(item);
  }
  return out;
}

// pages: [{ rel, noindex, html?, canonicals: [hrefs], mtime }] for every page of the website; ctx: the canonical context.
// Returns the pages with their status, and the report.
export function classifyPages(pages, ctx, { rebuilt = new Map() } = {}) {
  return pages.map((p) => {
    const want = canonicalFor(ctx, p.rel);
    const expected = want.url || canonicalUrl(ctx.domain, p.rel);
    if (want.redirected) return { rel: p.rel, url: expected, status: want.kind, canonical: '', mtime: p.mtime || '' };
    if (want.junk) return { rel: p.rel, url: expected, status: 'junk', canonical: '', mtime: p.mtime || '' };
    if (p.noindex) return { rel: p.rel, url: expected, status: 'noindex', canonical: '', mtime: p.mtime || '' };
    const now = rebuilt.get(p.rel);
    const d = decideCanonical(now !== undefined ? [now].filter(Boolean) : p.canonicals || [], p.rel, ctx);
    const canonical = d.action === 'ok' || d.action === 'dupes' ? d.url : d.old || '';
    const status = d.action === 'keep_foreign' ? 'canon_foreign' : d.otherPage ? 'canon_other' : 'live';
    return { rel: p.rel, url: expected, status, canonical, mtime: p.mtime || '' };
  });
}

export function analyseSitemap(text, ctx, pages) {
  const rep = { found: text != null, kind: '', error: '', entries: 0, ok: 0, issues: [], missing: [], livePages: 0, extras: false, newXml: '', newCount: 0 };
  const live = pages.filter((p) => p.status === 'live');
  rep.livePages = live.length;
  const byKey = new Map(live.filter((p) => p.url).map((p) => [key(p.url), p]));
  const byRel = new Map(pages.map((p) => [p.rel, p]));
  const oldLastmod = new Map();
  const listed = new Set();
  if (rep.found) {
    const sm = parseSitemap(text);
    rep.kind = sm.kind; rep.error = sm.error; rep.extras = sm.extras;
    if (rep.kind === 'index') rep.error ||= 'this is a sitemap index (it lists other sitemaps): check each file on its own; it is not rewritten';
    const seen = new Set();
    const base = new URL(ctx.domain);
    for (const u of sm.urls) {
      rep.entries += 1;
      if (u.lastmod) oldLastmod.set(key(u.loc), u.lastmod);
      const k = key(u.loc);
      if (seen.has(k)) { rep.issues.push({ loc: u.loc, issue: 'listed more than once' }); continue; }
      seen.add(k);
      const problems = [];
      let sp; try { sp = new URL(u.loc); } catch { sp = null; }
      if (sp && siteKey(u.loc) !== siteKey(ctx.domain)) problems.push('belongs to another website');
      else if (sp && (sp.host.toLowerCase() !== base.host.toLowerCase() || sp.protocol !== base.protocol)) problems.push(`wrong www / http form: should start with ${base.protocol}//${base.host}`);
      const pg = relCandidates(u.loc).map((c) => byRel.get(c)).find(Boolean);
      if (!pg) problems.push('no page file found for this address');
      else if (pg.status !== 'live') problems.push(`page is ${STATUS_TEXT[pg.status] || pg.status}${pg.canonical && pg.status.startsWith('canon') ? ` (${pg.canonical})` : ''}`);
      else {
        listed.add(pg.rel);
        if (pg.canonical && key(pg.canonical) !== k && siteKey(pg.canonical) === siteKey(u.loc)) problems.push(`page's canonical is ${pg.canonical}: list that address instead`);
        else if (sp && /\/index\.html?$/i.test(sp.pathname)) problems.push('use the folder address instead of /index.html');
      }
      if (problems.length) for (const pr of problems) rep.issues.push({ loc: u.loc, issue: pr }); else rep.ok += 1;
    }
  }
  rep.missing = live.filter((p) => !listed.has(p.rel) && p.url).map((p) => ({ rel: p.rel, url: p.url }));
  const rows = live.filter((p) => p.url).sort((a, b) => a.url.toLowerCase().localeCompare(b.url.toLowerCase())).map((p) => [p.url, oldLastmod.get(key(p.url)) || p.mtime]);
  rep.newCount = rows.length;
  rep.newXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.map(([u, lm]) => `  <url>\n    <loc>${xml(u)}</loc>\n${lm ? `    <lastmod>${xml(lm)}</lastmod>\n` : ''}  </url>`).join('\n')}\n</urlset>\n`;
  return rep;
}
