import fs from 'node:fs/promises';
import path from 'node:path';
import { clientDir, readJson } from '../config.js';

// The canonical tag of every page, worked out the way the SEO Meta Tag Updater (v5.2) does it:
//  - one domain for the whole site, entered on the Business profile (https://www.example.com)
//  - the domain + the page's path; index.html is the folder's own address ("/" or "/folder/")
//  - the site's .htaccess is read for Redirect / RedirectMatch / RewriteRule rules (301, 302, 410). A page those rules send away
//    gets no canonical, and loses the one it has. Rules about the whole site (www / https, catch-alls) are listed, never used.
//  - a canonical that already names this page at the right address is left alone; a wrong host, a relative address, an empty one,
//    one that names another page of the site, or duplicates are fixed; one that points to ANOTHER website is kept and flagged

// ---------- the domain ----------
// "https://www.example.com/anything" -> "https://www.example.com"; throws a sentence the user can act on
export function normaliseDomain(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) throw new Error('The canonical domain must start with http:// or https://, for example https://www.example.com');
  let u;
  try { u = new URL(raw); } catch { throw new Error('The canonical domain is not a valid address, for example https://www.example.com'); }
  if (!u.hostname.includes('.')) throw new Error('The canonical domain needs a full host name, for example https://www.example.com');
  return `${u.protocol}//${u.host}`.toLowerCase();
}
const hostOf = (url) => { try { return new URL(url).host.toLowerCase(); } catch { return ''; } };
// the website a address belongs to: host without www and port
export const siteKey = (url) => { const h = hostOf(url).split('@').pop().split(':')[0]; return h.startsWith('www.') ? h.slice(4) : h; };

// ---------- the address of a page ----------
// the URL paths a file is served at; the clean-URL variants (/page, /page/) only when asked for
export function urlPaths(rel, cleanUrls = false) {
  const parts = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '').split('/');
  const name = parts.at(-1);
  if (/^index\.html?$/i.test(name)) {
    const d = parts.slice(0, -1).join('/');
    const base = d ? `/${d}` : '';
    const out = [`${base}/`, `${base}/${name}`];
    if (cleanUrls && base) out.push(base);
    return out;
  }
  const rel2 = parts.join('/');
  const out = [`/${rel2}`];
  if (cleanUrls) { const stem = `/${rel2.replace(/\.[^./]*$/, '')}`; out.push(stem, `${stem}/`); }
  return out;
}
export const pagePath = (rel) => urlPaths(rel)[0];
const quotePath = (p) => encodeURI(p).replace(/%25/g, '%').replace(/#/g, '%23').replace(/\?/g, '%3F');
export const canonicalUrl = (domain, rel) => domain.replace(/\/+$/, '') + quotePath(pagePath(rel));

// pages the tag must not be added to: copies, backups, system folders and the tools' own reports
const JUNK_DIRS = new Set(['backup', 'backups', '_notes', 'cgi-bin', 'node_modules', '.git', '_vti_cnf', '_backup', 'old', 'bkp', '_modernizer-backup']);
const COPY_RE = /(^|[\s_\-.(])(copy|kopie|backup|bak|old)([\s_\-.)]|$)|\(\d+\)/i;
export function junkReason(rel) {
  const parts = String(rel || '').replace(/\\/g, '/').split('/');
  if (parts.slice(0, -1).some((p) => JUNK_DIRS.has(p.toLowerCase()))) return 'backup / system folder';
  const name = parts.at(-1);
  if (/^(seo_report_|canonical_injector_report)/i.test(name)) return 'report file';
  if (COPY_RE.test(name.replace(/\.[^.]*$/, ''))) return 'looks like a copy / backup file';
  return '';
}

// ---------- .htaccess ----------
export const KIND_TEXT = { 301: '301 redirect', 302: '302 temporary redirect', 410: '410 gone' };
const STATUS = { 301: '301', permanent: '301', 308: '301', 302: '302', temp: '302', temporary: '302', 303: '302', seeother: '302', 307: '302', 410: '410', gone: '410' };
const statusOf = (tok) => STATUS[String(tok).toLowerCase()];

// the words of a configuration line, quotes respected
function tokens(line) {
  const out = []; let cur = '', q = '', has = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) { if (c === q) q = ''; else if (c === '\\' && q === '"' && i + 1 < line.length) { cur += line[i += 1]; } else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (c === '\\' && i + 1 < line.length) { cur += line[i += 1]; has = true; continue; }
    if (/\s/.test(c)) { if (cur || has) { out.push(cur); cur = ''; has = false; } continue; }
    cur += c;
  }
  if (cur || has) out.push(cur);
  return out;
}

// a pattern that matches (almost) every page describes the whole site, not one page
const PROBES = ['/a.html', '/about.html', '/x/y.html', '/x/y/z-w.html', '/services/page.html', '/x/index.html'];
const catchAll = (rx, rewrite) => PROBES.filter((p) => rx.test(rewrite ? p.replace(/^\//, '') : p)).length >= 4;

// { found, rules: [{ kind, mode, pattern, raw, line, rx, target }], ignored: [{ raw, line, why }] }
export function parseHtaccess(text) {
  const out = { found: true, rules: [], ignored: [] };
  const lines = []; let buf = '', start = 0;
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    if (!buf) start = i + 1;
    if (raw.trimEnd().endsWith('\\')) { buf += `${raw.trimEnd().slice(0, -1)} `; return; }
    lines.push([start, buf + raw]); buf = '';
  });
  if (buf) lines.push([start, buf]);

  let engineOn = false, conds = 0;
  for (const [no, raw] of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('<')) continue;
    const low = line.toLowerCase();
    if (/^rewriteengine\s+on\b/.test(low)) { engineOn = true; continue; }
    if (/^rewriteengine\s+off\b/.test(low)) { engineOn = false; continue; }
    if (low.startsWith('rewritecond')) { conds += 1; continue; }
    const tok = tokens(line);
    if (!tok.length) continue;
    const d = tok[0].toLowerCase();

    if (['redirect', 'redirectpermanent', 'redirecttemp'].includes(d)) {
      let kind, rest;
      if (d === 'redirectpermanent') { kind = '301'; rest = tok.slice(1); }
      else if (d === 'redirecttemp') { kind = '302'; rest = tok.slice(1); }
      else if (tok.length > 1 && !tok[1].startsWith('/') && (statusOf(tok[1]) || /^\d+$/.test(tok[1]))) { kind = statusOf(tok[1]); rest = tok.slice(2); if (!kind) continue; } // 401, 403, 404 are not redirects
      else { kind = '302'; rest = tok.slice(1); }
      if (!rest.length) continue;
      if (rest[0].replace(/\/+$/, '') === '') { out.ignored.push({ raw: line, line: no, why: 'applies to the whole site' }); continue; }
      out.rules.push({ kind, mode: 'path', pattern: rest[0], raw: line, line: no, rx: null, target: rest[1] || '' });
      continue;
    }

    if (d === 'redirectmatch') {
      let kind = '302', rest = tok.slice(1);
      if (tok.length > 1 && (statusOf(tok[1]) || /^\d+$/.test(tok[1])) && !/^[\^/(]/.test(tok[1])) { kind = statusOf(tok[1]); rest = tok.slice(2); if (!kind) continue; }
      if (!rest.length) continue;
      let rx;
      try { rx = new RegExp(rest[0]); } catch { out.ignored.push({ raw: line, line: no, why: 'pattern could not be read' }); continue; }
      if (catchAll(rx, false)) { out.ignored.push({ raw: line, line: no, why: 'catch-all — matches every page, so it is not used' }); continue; }
      out.rules.push({ kind, mode: 'regex', pattern: rest[0], raw: line, line: no, rx, target: rest[1] || '' });
      continue;
    }

    if (d === 'rewriterule') {
      const had = conds; conds = 0; // conditions belong to the next rule only
      if (!engineOn || tok.length < 3) continue;
      const [, pat, subst] = tok;
      const flags = tok.length > 3 ? tok[3].replace(/^\[|\]$/g, '').toUpperCase().split(',') : [];
      let kind = null;
      if (flags.includes('G')) kind = '410';
      else for (const f of flags) if (f === 'R' || f.startsWith('R=')) { const code = f.includes('=') ? f.slice(2) : '302'; kind = STATUS[code.toLowerCase()] || (/^\d+$/.test(code) ? '302' : null); break; }
      if (!kind) continue; // an internal rewrite, not a redirect
      if (had) { out.ignored.push({ raw: line, line: no, why: 'has RewriteCond (host / https / user-agent rule)' }); continue; }
      if (/%\{/.test(subst) || /^(https?:\/\/)?%\d+\/?$/.test(subst)) { out.ignored.push({ raw: line, line: no, why: 'site-wide host / https rule' }); continue; }
      let rx;
      try { rx = new RegExp(pat, flags.includes('NC') ? 'i' : ''); } catch { out.ignored.push({ raw: line, line: no, why: 'pattern could not be read' }); continue; }
      if (catchAll(rx, true) || (kind !== '410' && subst.replace(/\//g, '') === '')) { out.ignored.push({ raw: line, line: no, why: 'catch-all — matches every page, so it is not used' }); continue; }
      out.rules.push({ kind, mode: 'rewrite', pattern: pat, raw: line, line: no, rx, target: subst === '-' ? '' : subst });
    }
  }
  return out;
}

// the first rule (in file order) that hits this page file
export function matchRule(rules, rel, cleanUrls = false) {
  const paths = urlPaths(rel, cleanUrls);
  for (const r of rules || []) {
    if (r.mode === 'path') { const p = r.pattern.replace(/\/+$/, ''); if (paths.some((u) => u === p || u.startsWith(`${p}/`))) return r; }
    else if (r.mode === 'regex') { if (paths.some((u) => r.rx.test(u))) return r; }
    else if (paths.some((u) => r.rx.test(u.replace(/^\/+/, '')))) return r; // a RewriteRule in .htaccess sees the path without the leading slash
  }
  return null;
}

// the first rule that hits a URL path (used for links); [rule, found]
function hit(rules, p) {
  const variants = [p];
  if (p.endsWith('/')) variants.push(`${p}index.html`);
  else if (/\/index\.html?$/i.test(p)) variants.push(`${p.slice(0, p.lastIndexOf('/'))}/`);
  for (const r of rules) for (const u of variants) {
    if (r.mode === 'path') { const b = r.pattern.replace(/\/+$/, ''); if (u === b || u.startsWith(`${b}/`)) return [r, u]; }
    else { const m = r.rx.exec(r.mode === 'regex' ? u : u.replace(/^\/+/, '')); if (m) return [r, m]; }
  }
  return null;
}
function targetOf(r, found) {
  if (!r.target) return '';
  if (r.mode === 'path') { const b = r.pattern.replace(/\/+$/, ''); const rest = typeof found === 'string' ? found.slice(b.length) : ''; return rest ? r.target.replace(/\/+$/, '') + rest : r.target; }
  return r.target.replace(/\$(\d)/g, (_, n) => found[Number(n)] ?? '');
}
// where does a link to this path really end up? null when no rule applies
export function followRedirects(rules, p, site, depth = 6) {
  const first = hit(rules, p);
  if (!first) return null;
  const out = { rule: first[0], kind: first[0].kind, finalPath: p, finalQuery: '', gone: false, temp: false, external: '', loop: false, unresolved: false, hops: 0 };
  let cur = p; const seen = new Set([p]);
  for (let i = 0; i < depth; i += 1) {
    const h = hit(rules, cur);
    if (!h) return out;
    const [r, found] = h;
    if (r.kind === '410') { Object.assign(out, { gone: true, finalPath: cur }); return out; }
    if (r.kind === '302') { Object.assign(out, { temp: true, finalPath: cur }); return out; }
    const tgt = targetOf(r, found);
    if (!tgt) { Object.assign(out, { unresolved: true, finalPath: cur }); return out; }
    let next;
    if (/^https?:\/\//i.test(tgt)) {
      if (siteKey(tgt) !== site) { Object.assign(out, { external: tgt, finalPath: cur }); return out; }
      const u = new URL(tgt); next = u.pathname || '/'; out.finalQuery = u.search;
    } else { next = tgt.split('?')[0].split('#')[0]; next = next.startsWith('/') ? next : `/${next}`; out.finalQuery = tgt.includes('?') ? `?${tgt.split('?')[1].split('#')[0]}` : ''; }
    out.hops += 1;
    if (seen.has(next)) { Object.assign(out, { loop: true, finalPath: cur }); return out; }
    seen.add(next); cur = next; out.finalPath = cur;
  }
  out.loop = true; // too many hops
  return out;
}

// everything a build needs to know about canonicals, read once
export async function loadCanonicalContext(slug, client) {
  const profile = await readJson(path.join(clientDir(slug), 'profile.json'), {});
  const settings = await readJson(path.join(clientDir(slug), 'build-settings.json'), {});
  let domain = '';
  try { domain = normaliseDomain(profile.canonicalDomain); } catch { domain = ''; }
  if (!domain) domain = `https://${client.host}`.toLowerCase();
  let parsed = { found: false, rules: [], ignored: [] };
  try { parsed = parseHtaccess(await fs.readFile(path.join(client.sourceDir, '.htaccess'), 'utf8')); } catch { /* the site has no .htaccess */ }
  return { domain, rules: parsed.rules, ignored: parsed.ignored, htaccess: parsed.found, cleanUrls: Boolean(settings.cleanUrls), fixLinks: settings.fixLinks !== false, fromProfile: Boolean(profile.canonicalDomain) };
}

// what a page's canonical should be: { url, redirected, kind, rule, junk }; url is '' for a page the site redirects or removes
export function canonicalFor(ctx, rel) {
  const junk = junkReason(rel);
  const r = matchRule(ctx.rules, rel, ctx.cleanUrls);
  return { url: r || junk ? '' : canonicalUrl(ctx.domain, rel), redirected: Boolean(r), kind: r?.kind || '', rule: r ? `${KIND_TEXT[r.kind]} (line ${r.line}): ${r.raw}` : '', junk };
}

// what to do with the canonical tag(s) a page has (hrefs: the href of every canonical link, in order)
// action: insert | ok | replace | dupes | keep_foreign | removed | redirect | junk
export function decideCanonical(hrefs, rel, ctx) {
  const want = canonicalFor(ctx, rel);
  if (want.junk) return { action: 'junk', url: '', old: hrefs[0] || '', note: want.junk };
  if (want.redirected) return { action: hrefs.length ? 'removed' : 'redirect', url: '', old: hrefs[0] || '', rule: want.rule, kind: want.kind, note: hrefs.length ? 'canonical removed from a redirected page' : 'redirected page, no canonical added' };
  const url = want.url;
  if (!hrefs.length) return { action: 'insert', url, old: '', note: '' };
  const href = String(hrefs[0] || '').trim();
  const extras = hrefs.length > 1;
  let resolved = '';
  try { resolved = href ? new URL(href, url).href : ''; } catch { resolved = ''; }
  const d = { action: 'replace', url, old: href, note: '' };
  let sameForm = false;
  if (resolved) {
    if (/^https?:\/\//i.test(href) && siteKey(resolved) !== siteKey(url)) return { action: 'keep_foreign', url, old: href, note: `canonical points to another domain (${href}) — kept` };
    const ep = new URL(resolved), sp = new URL(ctx.domain);
    const hostOk = ep.protocol.toLowerCase() === sp.protocol.toLowerCase() && ep.host.toLowerCase() === sp.host.toLowerCase();
    const variants = new Set(urlPaths(rel, true));
    let p = ep.pathname; try { p = decodeURIComponent(p); } catch { /* keep as is */ }
    const samePage = !ep.search && (variants.has(p) || variants.has(p.replace(/\/+$/, '')) || variants.has(`${p.replace(/\/+$/, '')}/`));
    if (!/^https?:\/\//i.test(href)) d.note = 'relative canonical made absolute';
    else if (samePage && hostOk) sameForm = true;
    else if (samePage) d.note = 'canonical had the wrong host / scheme';
    else { d.note = 'canonical pointed to a different page of this site'; d.otherPage = true; }
  } else d.note = 'empty canonical replaced';
  if (sameForm && !extras) return { action: 'ok', url: resolved, old: href, note: '' };
  if (sameForm) return { action: 'dupes', url: resolved, old: href, note: 'duplicate canonical tags cleaned up' };
  return d;
}
