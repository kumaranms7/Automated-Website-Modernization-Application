import * as cheerio from 'cheerio';
import { SEO } from '../rules.js';
import { extractPage } from '../scanner/extract.js';
import { plain } from '../util/html.js';
import { resolveHref } from '../content/apply.js';
import { localTarget } from '../validate/links.js';
import { decideCanonical } from '../canonical/index.js';
import { isTrackingScript } from './model.js';

const norm = (s) => cheerio.load(`<div>${s}</div>`).text().replace(/\s+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const ws = (s) => String(s || '').replace(/\s+/g, '');

// Preservation + quality checks comparing the original page with the rebuilt one.
// "fail" = something that must never ship; "warn" = review it.
// With opts.ai = { rec, host } the copy is expected to differ, so text/metadata checks switch to
// "is it still valid and is everything that must be kept still there".
export function verifyPage(model, originalHtml, outHtml, opts = {}) {
  const orig = extractPage(originalHtml, model.path);
  const out = extractPage(outHtml, model.path);
  const ai = opts.ai;
  const checks = [];
  const add = (id, level, ok, msg) => checks.push({ id, level, ok, msg: ok ? '' : msg });

  if (ai || opts.headFixed?.title) add('title', 'fail', out.title.length > 0 && out.title.length <= SEO.title.max, `title missing or too long (${out.title.length})`);
  else add('title', 'fail', orig.title === out.title, `title changed: "${orig.title}" → "${out.title}"`);
  if (ai || opts.headFixed?.description) add('meta-desc', 'fail', out.metaDescription.length >= SEO.description.min && out.metaDescription.length <= SEO.description.max, `meta description length ${out.metaDescription.length}`);
  else add('meta-desc', 'fail', orig.metaDescription === out.metaDescription, 'meta description changed');
  if (opts.canon) { const d = decideCanonical(out.canonical ? [out.canonical] : [], model.path, opts.canon); add('canonical', 'fail', ['ok', 'redirect', 'keep_foreign', 'junk'].includes(d.action), d.action === 'removed' ? `canonical kept on a redirected page: ${out.canonical}` : d.action === 'insert' ? 'canonical missing' : `canonical is "${out.canonical}", expected "${d.url}"`); }
  else add('canonical', 'fail', !orig.canonical || orig.canonical === out.canonical, 'canonical changed');
  add('h1', 'fail', (opts.headFixed?.h1 || plain(orig.h1[0]) === plain(out.h1[0]) || !orig.h1.length) && out.h1.length === 1, `H1 mismatch or not exactly one (${out.h1.length})`);

  // sections the user removed from this page are not lost content: their words, links and phone numbers are not expected back
  const rm = opts.removedHtml ? cheerio.load(`<div>${opts.removedHtml}</div>`) : null;
  const rmSquash = rm ? norm(opts.removedHtml).replace(/ /g, '') : '';
  const rmLinks = new Set(rm ? rm('a[href]').map((_, a) => rm(a).attr('href')).get() : []);
  const rmDigits = new Set([...rmLinks].filter((h) => /^tel:/i.test(h)).map((h) => h.replace(/\D/g, '')));
  const wasRemoved = (t) => Boolean(rmSquash) && rmSquash.includes(String(t).replace(/ /g, ''));
  const missingPhones = orig.phones.filter((p) => !out.phones.includes(p) && !rmDigits.has(String(p).replace(/\D/g, '')));
  add('phones', 'fail', !missingPhones.length, `tel links lost: ${missingPhones.join(', ')}`);
  const missingTrack = orig.tracking.filter((t) => !out.tracking.includes(t));
  add('tracking', 'fail', !missingTrack.length, `tracking IDs lost: ${missingTrack.join(', ')}`);
  add('php', 'fail', orig.phpBlockCount === out.phpBlockCount, 'PHP block count changed');

  if (model.protected.form) add('form-intact', 'fail', ws(outHtml).includes(ws(model.protected.form)), 'form embed missing or altered');
  const TRACK = /\b(G-[A-Z0-9]{6,}|UA-\d+-\d+|GTM-[A-Z0-9]+|AW-\d+)\b/g;
  const lostScripts = model.protected.headScripts.filter((s) => (!opts.own || isTrackingScript(s)) && !ws(outHtml).includes(ws(s)) && !(opts.own && (s.match(TRACK) || []).length && (s.match(TRACK) || []).every((id) => outHtml.includes(id))));
  add('head-scripts', 'fail', !lostScripts.length, `${lostScripts.length} head/tracking script(s) lost`);

  const outText = norm(out.bodyText);
  const htmlBlocks = model.blocks.filter((b) => b.t === 'html');
  const extraChunks = [...model.blocks.filter((b) => b.t === 'cardgrid').flatMap((b) => b.items.flatMap((i) => [i.title, i.text])), ...model.blocks.filter((b) => b.t === 'reviews').flatMap((b) => b.items.map((r) => r.quote))].map((t) => norm(t)).filter((t) => t.length > 12);
  if (!ai) {
    const lostText = [...htmlBlocks.map((b) => norm(b.html)), ...extraChunks].filter((t) => t.length > 12 && !outText.includes(t) && !wasRemoved(t));
    add('content-text', 'fail', !lostText.length, `${lostText.length} text block(s) missing: "${(lostText[0] || '').slice(0, 60)}…"`);
  } else {
    // Customer reviews are real testimonials: they must survive verbatim.
    const lostReviews = model.blocks.filter((b) => b.t === 'reviews').flatMap((b) => b.items).filter((r) => r.quote && !outText.includes(norm(r.quote)));
    add('reviews-verbatim', 'fail', !lostReviews.length, `${lostReviews.length} customer review(s) missing or changed`);
  }

  const contentLinks = [...new Set(htmlBlocks.flatMap((b) => {
    const $b = cheerio.load(b.html);
    return $b('a[href]').map((_, a) => $b(a).attr('href')).get().filter((h) => h && h !== '#'); // a bare # goes nowhere: nothing to keep
  }))];
  if (!ai) {
    const outLinks = new Set(out.links.map((l) => l.href));
    const lost = contentLinks.filter((h) => !outLinks.has(h) && !opts.linkFixes?.has(h) && !rmLinks.has(h)); // a link pointed at its final page is not lost
    add('content-links', 'fail', !lost.length, `content links lost: ${lost.slice(0, 3).join(', ')}`);
  } else {
    // Wording may change, but every page the old copy linked to must still be linked.
    const outTargets = new Set(out.links.map((l) => resolveHref(l.href, model.path, ai.host)).filter(Boolean));
    const lost = contentLinks.map((h) => ({ h, t: resolveHref(h, model.path, ai.host) })).filter((x) => x.t && !outTargets.has(x.t) && !opts.linkFixes?.has(x.h));
    add('content-links', 'fail', !lost.length, `internal links lost: ${lost.slice(0, 3).map((x) => x.h).join(', ')}`);
  }

  const imgs = model.blocks.filter((b) => b.t === 'img').map((b) => b.src);
  const outImgs = new Set(out.images.map((i) => i.src));
  // An image counts as kept if the original reference or its optimised replacement is present.
  const mapped = (s) => { const e = opts.imageMap?.[resolveHref(s, model.path, opts.host || '')]; return e ? e.file : null; };
  const rmImgs = new Set(rm ? rm('img[src]').map((_, i) => rm(i).attr('src')).get() : []); // a picture of a section the user removed is not lost
  const lostImgs = imgs.filter((s) => !outImgs.has(s) && !rmImgs.has(s) && ![...outImgs].some((o) => mapped(s) && (o.endsWith('/' + mapped(s)) || o === mapped(s))));
  add('content-images', 'fail', !lostImgs.length, `content image missing: ${lostImgs[0]}`);

  add('schema-valid', 'fail', !out.schemaTypes.includes('INVALID_JSON'), 'JSON-LD still invalid');
  add('schema-present', 'warn', out.schemaTypes.length > 0, 'no structured data');
  const noAlt = out.images.filter((i) => i.alt === undefined).length;
  add('img-alt-attr', 'warn', !noAlt, `${noAlt} image(s) without alt attribute`);
  const emptyAlt = out.images.filter((i) => i.alt === '' && !/\.svg(\?|$)/i.test(i.src) && i.width !== '56').length;
  add('img-alt-text', 'warn', !emptyAlt, `${emptyAlt} content image(s) with empty alt${ai ? '' : ' (AI phase will write it)'}`);

  const $ = cheerio.load(outHtml);
  const levels = $('h1,h2,h3,h4,h5,h6').map((_, h) => Number(h.name[1])).get();
  const noDim = out.images.filter((i) => !i.width || !i.height).length;
  add('img-dimensions', 'warn', !noDim, `${noDim} image(s) without width/height (layout shift)`);
  add('heading-order', 'warn', levels.every((l, i) => i === 0 || l - levels[i - 1] <= 1), 'heading levels skip');

  if (ai) {
    for (const i of ai.rec.issues) if (ai.rec.status !== 'approved' || i.level === 'warn') add(`ai:${i.id}`, i.level === 'fail' ? 'fail' : 'warn', false, i.msg);
  }

  if (model.kind === 'home') {
    // The home page is rebuilt from structured sections, so check the old page's visible copy and links directly.
    const $o = cheerio.load(originalHtml);
    $o('script, style, noscript, header, footer, svg, .btm-footer, .fix-info, .fixed-bottom-bar, [style*="display:none"], [style*="display: none"]').remove();
    const squash = (t) => t.replace(/ /g, '');
    const outSquash = squash(outText);
    const units = [...new Set($o('p, li, h1, h2, h3, h4, h5, h6, blockquote, .offer').toArray().map((e) => squash(norm($o(e).text()))).filter((t) => t.length >= 12))];
    const lostUnits = units.filter((t) => !outSquash.includes(t) && !wasRemoved(t));
    add('home-text', 'fail', !lostUnits.length, `${lostUnits.length} text block(s) from the old home page are missing: "${(lostUnits[0] || '').slice(0, 60)}…"`);
    const links = [...new Set($o('a[href]').toArray().map((e) => localTarget($o(e).attr('href') || '', model.path, opts.host || '')).filter((t) => t && /\.(html?|php|shtml)$/.test(t)))];
    const outTargets = new Set(out.links.map((l) => localTarget(l.href, model.path, opts.host || '')).filter(Boolean));
    const redirected = new Set([...(opts.linkFixes || [])].map((h) => localTarget(h, model.path, opts.host || '')));
    const rmTargets = new Set([...rmLinks].map((h) => localTarget(h, model.path, opts.host || '')).filter(Boolean));
    const lostLinks = links.filter((t) => !outTargets.has(t) && !redirected.has(t) && !rmTargets.has(t));
    add('home-links', 'fail', !lostLinks.length, `${lostLinks.length} link target(s) lost: ${lostLinks.slice(0, 3).join(', ')}`);
  }

  // checks about something this website is not being updated for (opts.skip) do not count
  const live = opts.skip?.length ? checks.filter((c) => !opts.skip.includes(c.id)) : checks;
  const status = live.some((c) => !c.ok && c.level === 'fail') ? 'fail' : live.some((c) => !c.ok) ? 'warn' : 'pass';
  return { status, checks: live.filter((c) => !c.ok), wordsBefore: orig.wordCount, wordsAfter: out.wordCount };
}
