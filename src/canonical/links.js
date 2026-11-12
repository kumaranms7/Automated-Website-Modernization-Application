import posix from 'node:path/posix';
import { siteKey, followRedirects, KIND_TEXT } from './index.js';

// Internal links that point at a page the site redirects (301) or has removed (410).
//  - a link to a 301-redirected page is rewritten to point straight at the final page, in the same style as the link was written
//    (full address, root-relative or relative); the query and #fragment are kept
//  - a link to a gone (410) page, a temporary (302) redirect, a redirect loop or a redirect to another website is only reported

const SKIP = /^(mailto:|tel:|javascript:|data:|sms:|whatsapp:|#)/i;
const pageDir = (rel) => posix.dirname(`/${String(rel).replace(/\\/g, '/').replace(/^\/+/, '')}`) || '/';
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const enc = (p) => encodeURI(p).replace(/%25/g, '%').replace(/#/g, '%23').replace(/\?/g, '%3F');

// { path, query, fragment, style } for an internal link, or null for anything else
export function linkPath(href, rel, site) {
  const h = String(href || '').trim();
  if (!h || SKIP.test(h)) return null;
  let u, style, p;
  if (/^https?:\/\//i.test(h)) { try { u = new URL(h); } catch { return null; } if (siteKey(h) !== site) return null; style = 'absolute'; p = u.pathname || '/'; }
  else if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('//')) return null;
  else {
    u = new URL(h, 'http://x.invalid/');
    const raw = h.split(/[?#]/)[0];
    if (!raw) return null; // "?x" or "#x" only
    if (h.startsWith('/')) { style = 'root'; p = u.pathname; }
    else { style = 'relative'; p = posix.normalize(posix.join(pageDir(rel), raw)); if (raw.endsWith('/') && !p.endsWith('/')) p += '/'; }
  }
  return { path: dec(p), query: (u.search || '').replace(/^\?/, ''), fragment: (u.hash || '').replace(/^#/, ''), style };
}

function newHref(style, newPath, query, frag, rel, base) {
  let out;
  if (style === 'absolute') out = base + enc(newPath);
  else if (style === 'root') out = enc(newPath);
  else {
    out = posix.relative(pageDir(rel), newPath.replace(/\/+$/, '') || '/');
    out = enc(out);
    if (newPath.endsWith('/') && !out.endsWith('/')) out += '/';
    if (out === '' || out === '.') out = './';
  }
  if (query) out += `?${query}`;
  if (frag) out += `#${frag}`;
  return out;
}

// edits the cheerio document; returns { changes: [{ page, old, new, rule }], findings: [{ page, href, issue }] }
export function fixLinks($, rel, ctx) {
  const changes = [], findings = [];
  if (!ctx.rules.length) return { changes, findings };
  if ($('base[href]').length) return { changes, findings: [{ page: rel, href: '', issue: 'page has a <base href>, so its links were not checked' }] };
  const site = siteKey(ctx.domain), base = ctx.domain.replace(/\/+$/, '');
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href');
    const lp = linkPath(href, rel, site);
    if (!lp) return;
    const f = followRedirects(ctx.rules, lp.path, site);
    if (!f) return;
    const label = `${KIND_TEXT[f.rule.kind]} (line ${f.rule.line})`;
    if (f.gone) { findings.push({ page: rel, href, issue: f.hops === 0 ? 'links to a page that is gone (410): remove or replace this link' : 'redirects to a page that is gone (410): remove or replace this link' }); return; }
    if (f.temp) { findings.push({ page: rel, href, issue: 'temporary (302) redirect, left as it is' }); return; }
    if (f.external) { findings.push({ page: rel, href, issue: `redirects to another website (${f.external.slice(0, 80)}), left as it is` }); return; }
    if (f.loop || f.unresolved) { findings.push({ page: rel, href, issue: 'redirect loop or unreadable target, left as it is' }); return; }
    if (f.finalPath === lp.path) return;
    const next = newHref(lp.style, f.finalPath, f.finalQuery.replace(/^\?/, '') || lp.query, lp.fragment, rel, base);
    if (next === href) return;
    $(a).attr('href', next);
    changes.push({ page: rel, old: href, new: next, rule: label });
  });
  return { changes, findings };
}
