import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { normaliseDomain, pagePath, canonicalUrl, urlPaths, parseHtaccess, matchRule, followRedirects, decideCanonical, canonicalFor, junkReason, siteKey } from '../src/canonical/index.js';
import { fixLinks, linkPath } from '../src/canonical/links.js';
import { parseSitemap, classifyPages, analyseSitemap } from '../src/canonical/sitemap.js';
import { finalizeHtml } from '../src/build/seo-final.js';
import { seoChecks } from '../src/validate/seo.js';

const HTACCESS = `
RewriteEngine On
RewriteCond %{HTTP_HOST} ^example\\.com [NC]
RewriteRule ^(.*)$ https://www.example.com/$1 [R=301,L]
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
Redirect 301 /moved-page.html https://www.example.com/new-page.html
Redirect 302 /temp-page.html /other.html
RedirectMatch 301 ^/archive/.*$ https://www.example.com/
RedirectMatch 410 ^/gone/.*$
RewriteRule ^moved/thing\\.html$ /new/thing.html [R=301,L]
RewriteRule ^(.+)\\.html$ /$1 [R=301,L]
RewriteRule ^secret\\.html$ - [G]
RewriteRule ^internal\\.html$ /x.html [L]
Redirect 404 /nothing.html
`;
const parsed = parseHtaccess(HTACCESS);
const CTX = { domain: 'https://www.example.com', rules: parsed.rules, ignored: parsed.ignored, cleanUrls: false, fixLinks: true };

test('the canonical domain is an origin: scheme and host, as typed', () => {
  assert.equal(normaliseDomain('https://www.Example.com/some/page?x=1'), 'https://www.example.com');
  assert.equal(normaliseDomain('http://example.com/'), 'http://example.com');
  assert.equal(normaliseDomain(''), '');
  assert.throws(() => normaliseDomain('www.example.com'), /http/);
  assert.throws(() => normaliseDomain('https://localhost'), /host name/);
  assert.equal(siteKey('https://www.example.com/a'), 'example.com');
});

test('a page\'s address: the file path, and the folder itself for index.html', () => {
  assert.equal(pagePath('index.html'), '/');
  assert.equal(pagePath('services/index.html'), '/services/');
  assert.equal(pagePath('services/a.html'), '/services/a.html');
  assert.equal(canonicalUrl('https://www.example.com/', 'a b.html'), 'https://www.example.com/a%20b.html');
  assert.deepEqual(urlPaths('x/a.html', true), ['/x/a.html', '/x/a', '/x/a/']);
});

test('.htaccess: 301, 302 and 410 rules that belong to one page are kept; site-wide rules are listed as ignored with the reason', () => {
  assert.deepEqual(parsed.rules.map((r) => `${r.kind}:${r.mode}`), ['301:path', '302:path', '301:regex', '410:regex', '301:rewrite', '410:rewrite']);
  const why = Object.fromEntries(parsed.ignored.map((i) => [i.raw.split(' ')[0] + i.line, i.why]));
  assert.ok(parsed.ignored.some((i) => /RewriteCond/.test(i.why)), 'a rule after a RewriteCond is a host / https rule');
  assert.ok(parsed.ignored.some((i) => /site-wide/.test(i.why)), 'a rule that sends to %{HTTP_HOST} is site-wide');
  assert.ok(parsed.ignored.some((i) => /catch-all/.test(i.why) && /\.html\$/.test(i.raw)), 'dropping .html from every address matches every page');
  assert.equal(parsed.rules.some((r) => /internal|nothing/.test(r.raw)), false, 'an internal rewrite and a 404 are not redirects');
  assert.ok(Object.keys(why).length >= 3);
});

test('which pages a rule takes away', () => {
  assert.equal(matchRule(parsed.rules, 'moved-page.html').kind, '301');
  assert.equal(matchRule(parsed.rules, 'temp-page.html').kind, '302');
  assert.equal(matchRule(parsed.rules, 'archive/2020/post.html').kind, '301');
  assert.equal(matchRule(parsed.rules, 'gone/a.html').kind, '410');
  assert.equal(matchRule(parsed.rules, 'moved/thing.html').kind, '301');
  assert.equal(matchRule(parsed.rules, 'secret.html').kind, '410');
  assert.equal(matchRule(parsed.rules, 'index.html'), null);
  assert.equal(matchRule(parsed.rules, 'services/a.html'), null);
  assert.equal(canonicalFor(CTX, 'moved-page.html').url, '');
  assert.match(canonicalFor(CTX, 'moved-page.html').rule, /301 redirect \(line \d+\)/);
});

test('copies, backups and tool reports are not tagged', () => {
  assert.match(junkReason('backup/a.html'), /backup/);
  assert.match(junkReason('a copy.html'), /copy/);
  assert.match(junkReason('seo_report_2026.html'), /report/);
  assert.equal(junkReason('services/a.html'), '');
});

const dec = (hrefs, rel = 'services/a.html', ctx = CTX) => decideCanonical(hrefs, rel, ctx);
test('the canonical decision, like the SEO app: add, keep, fix, clean up, flag', () => {
  assert.equal(dec([]).action, 'insert');
  assert.equal(dec(['https://www.example.com/services/a.html']).action, 'ok');
  assert.equal(dec(['https://www.example.com/services/a']).action, 'ok', 'a clean-URL form of the same page is left alone');
  const wrongHost = dec(['https://example.com/services/a.html']);
  assert.equal(wrongHost.action, 'replace'); assert.match(wrongHost.note, /wrong host/);
  assert.match(dec(['/services/a.html']).note, /relative/);
  const other = dec(['https://www.example.com/services/b.html']);
  assert.equal(other.action, 'replace'); assert.equal(other.otherPage, true);
  assert.equal(dec(['']).action, 'replace');
  assert.equal(dec(['https://www.example.com/services/a.html', 'https://www.example.com/x.html']).action, 'dupes');
  const foreign = dec(['https://another-site.com/page.html']);
  assert.equal(foreign.action, 'keep_foreign'); assert.match(foreign.note, /another domain/);
  assert.equal(dec(['https://www.example.com/moved-page.html'], 'moved-page.html').action, 'removed');
  assert.equal(dec([], 'moved-page.html').action, 'redirect');
  assert.equal(dec(['https://www.example.com/'], 'index.html').action, 'ok');
  assert.equal(dec([], 'copy of a.html').action, 'junk');
});

test('where a link really ends up', () => {
  const site = 'example.com';
  const f = followRedirects(parsed.rules, '/moved-page.html', site);
  assert.equal(f.finalPath, '/new-page.html');
  assert.equal(followRedirects(parsed.rules, '/gone/a.html', site).gone, true);
  assert.equal(followRedirects(parsed.rules, '/temp-page.html', site).temp, true);
  assert.equal(followRedirects(parsed.rules, '/services/a.html', site), null);
  const ext = followRedirects(parseHtaccess('Redirect 301 /x.html https://other.com/y.html').rules, '/x.html', site);
  assert.match(ext.external, /other\.com/);
  const loop = followRedirects(parseHtaccess('Redirect 301 /a.html /b.html\nRedirect 301 /b.html /a.html').rules, '/a.html', site);
  assert.equal(loop.loop, true);
});

test('links to a redirected page are pointed at the final page, in the style they were written; the rest is only reported', () => {
  const $ = cheerio.load(`<body>
<a href="/moved-page.html#top">root</a><a href="https://www.example.com/moved-page.html?x=1">full</a><a href="../moved-page.html">rel</a>
<a href="/gone/a.html">gone</a><a href="/temp-page.html">temp</a><a href="/services/ok.html">fine</a><a href="mailto:a@b.c">mail</a><a href="https://other.com/moved-page.html">other</a></body>`);
  const r = fixLinks($, 'services/a.html', CTX);
  assert.equal($('a').eq(0).attr('href'), '/new-page.html#top');
  assert.equal($('a').eq(1).attr('href'), 'https://www.example.com/new-page.html?x=1');
  assert.equal($('a').eq(2).attr('href'), '../new-page.html');
  assert.equal($('a').eq(5).attr('href'), '/services/ok.html');
  assert.equal($('a').eq(7).attr('href'), 'https://other.com/moved-page.html', 'a link to another website is never touched');
  assert.equal(r.changes.length, 3);
  assert.equal(r.findings.length, 2);
  assert.match(r.findings[0].issue, /gone \(410\)/);
  assert.match(r.findings[1].issue, /302/);
  assert.equal(linkPath('#x', 'a.html', 'example.com'), null);
});

const PAGE = (head, body = '') => `<!doctype html><html lang="en"><head><title>T</title>${head}</head><body><h1>Hi</h1><main><p>x</p>${body}</main></body></html>`;
const finalize = (head, rel, body) => { const r = finalizeHtml(PAGE(head, body), { rel, canonicalHost: 'www.example.com', host: 'example.com', canon: CTX }); return { ...r, $: cheerio.load(r.html) }; };

test('a page without a canonical gets one; a wrong one is replaced; a right one is left alone; extras go', () => {
  const a = finalize('', 'services/a.html');
  assert.equal(a.$('link[rel="canonical"]').attr('href'), 'https://www.example.com/services/a.html');
  assert.equal(a.canon.action, 'insert');
  const b = finalize('<link rel="canonical" href="https://example.com/services/a.html">', 'services/a.html');
  assert.equal(b.$('link[rel="canonical"]').attr('href'), 'https://www.example.com/services/a.html');
  assert.equal(b.canon.action, 'replace'); assert.equal(b.canon.old, 'https://example.com/services/a.html');
  assert.equal(finalize('<link rel="canonical" href="https://www.example.com/services/a.html">', 'services/a.html').canon.action, 'ok');
  assert.equal(finalize('<link rel="canonical" href="x"><link rel="canonical" href="y">', 'a.html').$('link[rel="canonical"]').length, 1);
  const f = finalize('<link rel="canonical" href="https://another-site.com/p.html">', 'a.html');
  assert.equal(f.$('link[rel="canonical"]').attr('href'), 'https://another-site.com/p.html', 'a canonical to another website is kept');
  assert.equal(f.canon.action, 'keep_foreign');
});

test('a redirected or removed page has no canonical, and loses the one it had; its links are still corrected', () => {
  const a = finalize('<link rel="canonical" href="https://www.example.com/moved-page.html">', 'moved-page.html');
  assert.equal(a.$('link[rel="canonical"]').length, 0);
  assert.equal(a.canon.action, 'removed');
  assert.match(a.canon.rule, /301 redirect/);
  assert.equal(finalize('', 'moved-page.html').canon.action, 'redirect');
  assert.equal(finalize('', 'gone/x.html').canon.action, 'redirect');
  const l = finalize('', 'services/a.html', '<a href="/moved-page.html">x</a>');
  assert.equal(l.$('a').attr('href'), '/new-page.html');
  assert.equal(l.canon.links.changes.length, 1);
});

test('the og:url of a page follows its canonical', () => {
  const a = finalize('<meta property="og:url" content="https://example.com/a.html">', 'a.html');
  assert.equal(a.$('meta[property="og:url"]').attr('content'), 'https://www.example.com/a.html');
});

test('validation uses the same rule', () => {
  const run = (head, rel) => seoChecks({ html: PAGE(head), rel, type: 'service', host: 'example.com', phoneDigits: '', titles: new Map(), metas: new Map(), canon: CTX }).find((c) => c.id === 'canonical');
  assert.equal(run('<link rel="canonical" href="https://www.example.com/a.html">', 'a.html').ok, true);
  assert.equal(run('<link rel="canonical" href="https://example.com/a.html">', 'a.html').ok, false);
  assert.equal(run('', 'a.html').ok, false);
  assert.equal(run('', 'moved-page.html').ok, true);
  assert.equal(run('<link rel="canonical" href="https://www.example.com/moved-page.html">', 'moved-page.html').ok, false);
  assert.equal(run('<link rel="canonical" href="https://another-site.com/a.html">', 'a.html').ok, false, 'a canonical on another website is flagged');
});

const SITEMAP = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://www.example.com/index.html</loc><lastmod>2026-01-01</lastmod></url>
<url><loc>https://www.example.com/services/a.html</loc></url>
<url><loc>https://www.example.com/services/a.html</loc></url>
<url><loc>https://www.example.com/moved-page.html</loc></url>
<url><loc>http://example.com/services/b.html</loc></url>
<url><loc>https://www.example.com/missing.html</loc></url>
<url><loc>https://other.com/x.html</loc></url></urlset>`;

test('the sitemap check: what is wrong with the listed pages and which live pages are missing; the new sitemap lists only live pages', () => {
  assert.equal(parseSitemap(SITEMAP).urls.length, 7);
  const pages = classifyPages([
    { rel: 'index.html', noindex: false, canonicals: ['https://www.example.com/'], mtime: '2026-02-02' },
    { rel: 'services/a.html', noindex: false, canonicals: [], mtime: '2026-03-03' },
    { rel: 'services/b.html', noindex: false, canonicals: ['https://www.example.com/services/b.html'], mtime: '' },
    { rel: 'services/c.html', noindex: false, canonicals: ['https://www.example.com/services/c.html'], mtime: '' },
    { rel: 'moved-page.html', noindex: false, canonicals: [], mtime: '' },
    { rel: 'private.html', noindex: true, canonicals: [], mtime: '' },
  ], CTX, { rebuilt: new Map([['services/a.html', 'https://www.example.com/services/a.html']]) });
  assert.deepEqual(pages.map((p) => p.status), ['live', 'live', 'live', 'live', '301', 'noindex']);
  const rep = analyseSitemap(SITEMAP, CTX, pages);
  const issues = rep.issues.map((i) => i.issue).join(' | ');
  assert.match(issues, /listed more than once/);
  assert.match(issues, /301 redirect/);
  assert.match(issues, /wrong www \/ http form/);
  assert.match(issues, /use the folder address/);
  assert.match(issues, /no page file found/);
  assert.match(issues, /another website/);
  assert.deepEqual(rep.missing.map((m) => m.rel), ['services/c.html']);
  assert.equal(rep.newCount, 4);
  assert.doesNotMatch(rep.newXml, /moved-page|private/);
  assert.match(rep.newXml, /<loc>https:\/\/www\.example\.com\/<\/loc>\s*<lastmod>2026-01-01<\/lastmod>/, 'an existing lastmod is kept');
});
