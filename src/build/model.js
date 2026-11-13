import * as cheerio from 'cheerio';
import { plain } from '../util/html.js';
import { extractHome } from './home.js';

// Turns a legacy page into a template-independent content model:
//   { head, hero, blocks[], protected: { form, headScripts, bodyNoscript } }
// Anything the templates must not alter (tracking, form embed) is captured as raw HTML.

const KEEP_ATTR = new Set(['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'title', 'colspan', 'rowspan']);

export function cleanHtml($, el) {
  const c = $(el).clone();
  c.find('script, style').remove();
  c.find('*').addBack().each((_, n) => {
    if (n.type !== 'tag') return;
    for (const a of Object.keys(n.attribs)) if (!KEEP_ATTR.has(a)) delete n.attribs[a];
  });
  c.find('span').each((_, s) => { if (!Object.keys(s.attribs).length) $(s).replaceWith($(s).contents()); });
  return $.html(c).replace(/\s+/g, ' ').trim();
}

const isEmpty = ($el) => !plain($el.text()) && !$el.find('img, iframe, video').length;

function headingText($, el) {
  const $h = $(el).clone();
  $h.find('.head-icon, img').remove();
  const m = $h.find('.m-head-text');
  return plain((m.length ? m : $h).text());
}

const PROTECTED_FORM_RE = /<div id="mf_placeholder"[\s\S]*?<\/div>\s*<script>[\s\S]*?<\/script>/;

const isTag = (e) => e.type === 'tag';

// A group of repeated, similar blocks (service cards, feature boxes) -> card grid. Only blocks that carry a heading count,
// so ordinary bullet lists and paragraphs are never turned into cards.
function detectCardGrid($, node) {
  let kids = $(node).children().toArray().filter(isTag);
  for (let i = 0; i < 3 && kids.length === 1; i++) kids = $(kids[0]).children().toArray().filter(isTag);
  if (kids.length < 3 || kids.length > 24) return null;
  const sig = new Set(kids.map((k) => k.name + '.' + (($(k).attr('class') || '').split(/\s+/)[0] || '')));
  if (sig.size > 2) return null;
  const items = kids.map((k) => {
    const $k = $(k);
    const head = $k.find('h1,h2,h3,h4,h5,h6').first();
    const a = $k.is('a') ? $k : $k.find('a[href]').first();
    // the picture of the card is its first picture that is not an SVG; an SVG, or a second picture, is its icon
    const pics = $k.find('img').toArray();
    const isSvg = (i) => /\.svg(\?|$)/i.test($(i).attr('src') || '');
    // a card without a heading is named by its link or its bold line
    const title = plain(head.text()) || plain(a.text()) || plain($k.find('strong, b').first().text());
    // (the arrow of a button is decoration, not the card's icon)
    const decor = (i) => { const link = $(i).closest('a'); return /(^|[-_])(btn|arrow|ar|chevron|caret)([-_.]|$)/i.test(($(i).attr('src') || '').split('/').pop()) || (link.length > 0 && !link.is($k) && plain(link.text()) === title); };
    const photo = pics.find((i) => !isSvg(i) && !decor(i));
    const img = $(photo || []), icon = $(pics.find((i) => isSvg(i) && !decor(i)) || pics.find((i) => photo && i !== photo && !decor(i)) || []);
    const text = $k.find('p').toArray().map((p) => plain($(p).text())).filter((t) => t && t !== title).join(' ');
    return { title, text, href: a.attr('href') || '', img: img.attr('src') || '', imgAlt: img.attr('alt') || '', icon: icon.attr('src') || '' };
  }).filter((i) => i.title && (i.text || i.img));
  if (items.length < 3 || items.length < kids.length * 0.8) return null;
  if (items.some((i) => i.text.length > 700)) return null;
  const seen = new Set();
  return items.filter((i) => !seen.has(i.title + i.text) && seen.add(i.title + i.text));
}

function detectContact($, node) {
  const kids = $(node).children().toArray().filter(isTag);
  if (kids.length < 2 || kids.length > 6) return null;
  const items = kids.map((k) => {
    const $k = $(k);
    const head = $k.find('h1,h2,h3,h4,h5,h6,strong,b').first();
    const title = plain(head.text());
    const rest = $k.clone(); rest.find('h1,h2,h3,h4,h5,h6,strong,b').first().remove();
    const text = plain(rest.text());
    const a = $k.find('a[href^="tel:"], a[href^="mailto:"]').first();
    return { icon: $k.find('img').first().attr('src') || '', title, text, href: a.attr('href') || '' };
  }).filter((i) => i.text && i.text.length <= 160);
  if (items.length < 2 || items.length < kids.length) return null;
  const tells = items.filter((i) => /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|@[\w-]+\.[a-z]{2,}|\b\d{5}(?:-\d{4})?\b|\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b.*\d|\bhours\b/i.test(`${i.title} ${i.text}`)).length;
  return tells >= 2 ? items : null;
}

function detectReviews($, node) {
  const boxes = $(node).find('[class*="review-box"], [class*="testimonial-item"], [class*="review-item"]').toArray();
  if (boxes.length < 2) return null;
  const items = boxes.map((b) => ({ quote: plain($(b).find('p, blockquote').first().text()), name: plain($(b).find('b, strong, cite, h3, h4, h5, h6, [class*="name"], [class*="author"]').first().text()), place: '' })).filter((r) => r.quote.length > 30);
  const seen = new Set();
  const uniq = items.filter((r) => !seen.has(r.quote) && seen.add(r.quote));
  return uniq.length >= 2 ? uniq : null;
}

function walk($, nodes, ctx, out) {
  for (const node of nodes) {
    if (node.type === 'text') {
      const t = node.data.replace(/\s+/g, ' ').trim();
      if (t) out.push({ t: 'html', html: `<p>${$('<i>').text(t).html()}</p>`, zone: ctx.zone });
      continue;
    }
    if (node.type !== 'tag') continue;
    const $n = $(node);
    const cls = $n.attr('class') || '';
    const tag = node.name;

    if (/^(header|footer|nav)$/.test(tag) || /\b(btm-footer|fix-info|fixed-bottom-bar)\b/.test(cls)) continue;
    if (/\binner-main-cotent-right\b/.test(cls) && ($n.find('#mf_placeholder').length || $n.find('.get-quote-heading').length || !plain($n.text()))) {
      ctx.sideForm = true;
      ctx.quoteHeading = ctx.quoteHeading || {
        title: plain($n.find('.get-quote-heading').clone().children().remove().end().text()),
        sub: plain($n.find('.get-quote-heading span').text()),
      };
      continue;
    }
    if ($n.is('#mf_placeholder')) { out.push({ t: 'form', zone: ctx.zone }); continue; }
    if (/\bget-in-touch-today-sec\b/.test(cls)) {
      const a = $n.find('a[href^="tel:"]').first();
      const pic = $n.find('img').first();
      out.push({ t: 'cta', title: plain($n.find('h4').first().text()), text: plain($n.find('p').first().text()), href: (a.attr('href') || '').trim(), label: plain(a.text()) || 'Call now', ...(pic.attr('src') ? { img: pic.attr('src'), imgAlt: pic.attr('alt') || '' } : {}), zone: ctx.zone });
      continue;
    }
    if (/\bfree-quote\b/.test(cls)) {
      const items = $n.find('.free-quote-desktop li a').map((_, a) => ({
        href: $(a).attr('href'), text: plain($(a).find('span').text()), img: $(a).find('img.normal-state').attr('src') || $(a).find('img').first().attr('src') || '',
      })).get();
      if (items.length) out.push({ t: 'cards', title: plain($n.find('h4').first().text()), items, zone: ctx.zone });
      continue;
    }
    if (/display:\s*none/i.test($n.attr('style') || '')) continue;
    if (tag === 'i' && !plain($n.text())) continue; // decorative icon wrapper
    if (tag === 'script') {
      if (/mform|mf_placeholder|mf\.js/.test($n.html() || '')) continue;
      if ($n.attr('src') || ($n.html() || '').trim()) out.push({ t: 'raw', html: $.html($n), why: 'inline-script', zone: ctx.zone });
      continue;
    }
    if (tag === 'style' || tag === 'noscript' || tag === 'br' || tag === 'hr') continue;

    if (/\bcertifcation-sec\b/.test(cls)) {
      out.push({ t: 'callout', title: plain($n.find('h5').text()), text: plain($n.find('h6').text()), zone: ctx.zone });
      continue;
    }
    if (tag === 'figure' && /\breview\b/.test(cls)) {
      const item = { quote: plain($n.find('blockquote').text()), name: plain($n.find('figcaption > h3, figcaption h3').first().text()), place: plain($n.find('figcaption > span, figcaption span').last().text()) };
      const last = out.at(-1);
      if (last?.t === 'reviews') last.items.push(item);
      else out.push({ t: 'reviews', items: [item], zone: ctx.zone });
      continue;
    }
    if (/\baccordion\b/.test(cls)) {
      const items = [];
      $n.find('.accordion-head').each((_, h) => {
        items.push({ q: plain($(h).text()), a: cleanHtml($, $(h).next('.accordion-body')[0] || h).replace(/^<[^>]+>|<\/[^>]+>$/g, '') });
      });
      if (items.length) { out.push({ t: 'faq', items, zone: ctx.zone }); continue; }
    }
    if (tag === 'ul' && /\bsitemap\b/.test(cls)) {
      out.push({ t: 'links', items: $n.find('a').map((_, a) => ({ href: $(a).attr('href'), text: plain($(a).text()) })).get(), zone: ctx.zone });
      continue;
    }
    if (/^h[1-6]$/.test(tag)) {
      const text = headingText($, node);
      if (tag === 'h1' && ctx.skipH1 && text === ctx.skipH1) { ctx.skipH1 = null; continue; }
      if (text) out.push({ t: 'h', level: Number(tag[1]), text, zone: ctx.zone });
      continue;
    }
    if (tag === 'img') { out.push({ t: 'img', src: $n.attr('src') || '', alt: $n.attr('alt') || '', w: $n.attr('width'), h: $n.attr('height'), zone: ctx.zone }); continue; }
    if (tag === 'figure') {
      const img = $n.find('img').first();
      if (img.length) {
        const cap = plain($n.find('figcaption').text());
        out.push({ t: 'img', src: img.attr('src') || '', alt: img.attr('alt') || '', w: img.attr('width'), h: img.attr('height'), caption: cap, zone: ctx.zone });
        continue;
      }
    }
    if (tag === 'ul' || tag === 'ol') {
      // a list of the ways to reach the business, or of pictures with a linked title, is more than a list of words
      const ways = detectContact($, node);
      if (ways) { out.push({ t: 'contact', items: ways, zone: ctx.zone }); continue; }
      const grid = $n.find('img').length >= 3 ? detectCardGrid($, node) : null;
      if (grid) { out.push({ t: 'cardgrid', items: grid, zone: ctx.zone }); continue; }
    }
    if (['p', 'ul', 'ol', 'table', 'blockquote', 'dl', 'pre'].includes(tag)) {
      if (!isEmpty($n)) out.push({ t: 'html', html: cleanHtml($, node), zone: ctx.zone });
      continue;
    }
    if (tag === 'a') { out.push({ t: 'html', html: `<p>${cleanHtml($, node)}</p>`, zone: ctx.zone }); continue; }
    if (['iframe', 'video', 'form', 'audio', 'object', 'embed'].includes(tag)) {
      out.push({ t: 'raw', html: $.html($n), why: tag, zone: ctx.zone });
      continue;
    }
    if (['div', 'section', 'ul', 'ol', 'article'].includes(tag) && !/\binner-main-cotent-left\b/.test(cls)) {
      const rv = detectReviews($, node);
      if (rv && !$n.find('h1,h2').length) { out.push({ t: 'reviews', items: rv, zone: ctx.zone }); continue; }
      const ways = ['ul', 'div'].includes(tag) ? detectContact($, node) : null;
      if (ways) { out.push({ t: 'contact', items: ways, zone: ctx.zone }); continue; }
      const grid = detectCardGrid($, node);
      if (grid) { out.push({ t: 'cardgrid', items: grid, zone: ctx.zone }); continue; }
    }
    const prev = ctx.zone;
    if (/\binner-main-cotent-left\b/.test(cls)) ctx.zone = 'lead';
    walk($, node.children, ctx, out);
    if (/\binner-main-cotent-left\b/.test(cls)) ctx.zone = prev;
  }
}

// A head script of the old page that is tracking or a third-party widget (analytics, tag managers, ad and conversion pixels, chat and
// call-tracking loaders): it must survive a change of design. Scripts that only drive the old design (menus, sliders, the year in the
// footer, the site's own files) do not: the new template has its own.
const TRACKING_RE = /googletagmanager|gtag\(|dataLayer|google-analytics|googleads|googlesyndication|doubleclick|\bga\(|_gaq|fbq\(|facebook\.net|connect\.facebook|\bUET\b|bat\.bing|clarity\.ms|\bclarity\(|hotjar|\bhj\(|linkedin\.com|snap\.licdn|ttq\.|tiktok|twq\(|_paq|matomo|segment\.com|mixpanel|callrail|calltrk|realworklabs|podium|birdeye|leadconnector|gohighlevel|tawk\.to|livechat|intercom|drift\.com|hs-scripts|hubspot|hs-analytics|nextdoor|trustpilot|createElement\(\s*['"]script['"]\s*\)/i;
export const isTrackingScript = (s) => TRACKING_RE.test(String(s));

// Parts every page needs regardless of layout: head metadata, tracking scripts, the protected form embed.
export function commonParts($, html) {
  const headScripts = $('head script').filter((_, el) => {
    const type = ($(el).attr('type') || '').toLowerCase();
    const src = $(el).attr('src') || '';
    return type !== 'application/ld+json' && !/jquery/i.test(src);
  }).map((_, el) => $.html(el)).get();

  const metas = $('head meta').filter((_, m) => {
    const n = ($(m).attr('name') || $(m).attr('property') || '').toLowerCase();
    return n && !['viewport', 'description', 'robots'].includes(n);
  }).map((_, m) => $.html(m)).get();

  // The form embed is a div plus a loader script. Usually adjacent; on some pages the script sits at the end of the body.
  let form = (html.match(PROTECTED_FORM_RE) || [])[0] || null;
  if (!form) {
    const div = html.match(/<div id="mf_placeholder"[\s\S]*?<\/div>/);
    const script = $('script:not([src])').toArray().map((el) => $.html(el)).find((t) => /mf_placeholder/.test(t) && /mf\.js/.test(t));
    if (div) form = script ? div[0] + '\n' + script : div[0];
  }
  const noscript = $('body > noscript').first();
  return {
    head: {
      title: plain($('title').first().text()),
      description: $('meta[name="description"]').attr('content') || '',
      robots: $('meta[name="robots"]').attr('content') || '',
      canonical: $('link[rel="canonical"]').attr('href') || '',
      metas,
      links: $('head link').filter((_, l) => /icon|manifest|alternate|author/.test($(l).attr('rel') || '')).map((_, l) => $.html(l)).get(),
      jsonLd: $('script[type="application/ld+json"]').map((_, el) => $(el).text()).get(),
    },
    protected: { form, headScripts, bodyNoscript: noscript.length ? $.html(noscript) : '' },
  };
}

export function extractModel(html, relPath) {
  const $ = cheerio.load(html);
  const common = commonParts($, html);
  if (/^index\.html?$/i.test(relPath) && $('section.main-banner').length) return extractHome($, relPath, common);

  const banner = $('section.inner-banner-sec').first();
  // Outermost content sections, in source order. Chrome (header/footer/floating bars/banner) is excluded
  // wherever it sits, so malformed nesting in legacy pages cannot leak it into the content.
  const SECTION = 'section, div.all-serv-sec, div.location-sec, div.terms-sec, div.contact-map, div.section-code-example, div.container';
  const CHROME = 'header, footer, .btm-footer, .fix-info, .fixed-bottom-bar, .inner-banner-sec';
  const mains = $(SECTION).filter((_, e) => !$(e).is(CHROME) && !$(e).closest(CHROME).length && !$(e).parent().closest(SECTION).length);
  // Layout not known to the platform: take everything from the block holding the page's H1 down to the footer.
  let roots = mains.toArray();
  if (!roots.length && !banner.length) {
    const skipTags = new Set(['meta', 'link', 'title', 'script', 'style', 'noscript', 'footer', 'header', 'nav']);
    const kids = $('body').children().toArray().filter((e) => e.type === 'tag' && !skipTags.has(e.name) && !/(^|\s)(footer|cookie)/i.test($(e).attr('class') || ''));
    const i = kids.findIndex((e) => e.name === 'h1' || $(e).find('h1').length);
    roots = i >= 0 ? kids.slice(i) : kids;
  }
  const derivedH1 = common.head.title.split(/\s[|\u2013\u2014-]\s/)[0].trim();
  const h1 = plain(banner.find('h1').first().text()) || plain($('h1').first().text()) || derivedH1;
  if (!h1 || (!roots.length && !banner.length)) return { ok: false, reason: 'unrecognised-layout' };

  const crumbs = banner.find('ul li').map((_, li) => {
    const a = $(li).find('a').first();
    return { text: plain($(li).text()), href: a.attr('href') || null };
  }).get().filter((c) => c.text);

  const ctx = { zone: 'body', sideForm: false, quoteHeading: null, skipH1: banner.length ? null : h1 };
  const blocks = [];
  roots.forEach((el) => {
    blocks.push({ t: 'break' });
    walk($, [el], ctx, blocks);
  });

  return {
    ok: true,
    path: relPath,
    head: common.head,
    hero: { h1, crumbs, derived: !banner.length && !$('h1').length },
    blocks,
    sideForm: ctx.sideForm || (Boolean(common.protected.form) && !blocks.some((b) => b.t === 'form')),
    quoteHeading: ctx.quoteHeading,
    protected: common.protected,
    unhandled: [...new Set(blocks.filter((b) => b.t === 'raw').map((b) => b.why))],
  };
}
