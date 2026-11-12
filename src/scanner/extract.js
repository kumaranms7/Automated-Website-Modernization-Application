import * as cheerio from 'cheerio';

const text = (s) => (s || '').replace(/\s+/g, ' ').trim();

// Pulls the structured facts the audit, rewriter and templates need from one page.
// PHP blocks are located in the raw source so they can later be protected byte-for-byte.
export function extractPage(html, relPath) {
  const phpBlocks = [...html.matchAll(/<\?(?:php|=)[\s\S]*?\?>/g)].map((m) => m[0]);
  const $ = cheerio.load(html);

  const schemaTypes = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === 'object') {
          if (n['@type']) schemaTypes.push(...[].concat(n['@type']));
          Object.values(n).forEach(walk);
        }
      };
      walk(JSON.parse($(el).text()));
    } catch {
      schemaTypes.push('INVALID_JSON');
    }
  });

  const scripts = $('script[src]').map((_, e) => $(e).attr('src')).get();
  const inline = $('script:not([src])').map((_, e) => $(e).text()).get().join('\n');
  const tracking = [
    ...new Set([
      ...(inline.match(/\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]+\b|\bUA-\d+-\d+\b|\bAW-\d+\b/g) || []),
      ...scripts.flatMap((s) => s.match(/\bG-[A-Z0-9]{6,}\b|\bGTM-[A-Z0-9]+\b/g) || []),
    ]),
  ];

  const images = $('img')
    .map((_, e) => ({
      src: $(e).attr('src') || $(e).attr('data-src') || '',
      alt: $(e).attr('alt'),
      width: $(e).attr('width') || null,
      height: $(e).attr('height') || null,
      lazy: $(e).attr('loading') === 'lazy',
    }))
    .get();

  const links = $('a[href]')
    .map((_, e) => ({ href: $(e).attr('href'), text: text($(e).text()) }))
    .get();
  const phones = [...new Set(links.filter((l) => l.href.trim().startsWith('tel:')).map((l) => l.href.trim().slice(4)))];

  const forms = $('form')
    .map((_, e) => ({ action: $(e).attr('action') || '', method: ($(e).attr('method') || 'get').toLowerCase() }))
    .get();

  // Body copy = everything except chrome, scripts and styles.
  const body = cheerio.load(html);
  body('script, style, noscript, header, nav, footer, svg, form').remove();
  const bodyText = text(body('body').text());

  return {
    path: relPath,
    title: text($('title').first().text()),
    metaDescription: text($('meta[name="description"]').attr('content')),
    canonical: $('link[rel="canonical"]').attr('href') || '',
    robots: $('meta[name="robots"]').attr('content') || '',
    h1: $('h1').map((_, e) => text($(e).text())).get(),
    h2: $('h2').map((_, e) => text($(e).text())).get(),
    h3: $('h3').map((_, e) => text($(e).text())).get(),
    wordCount: bodyText ? bodyText.split(' ').length : 0,
    bodyText,
    images,
    links,
    phones,
    forms,
    schemaTypes,
    tracking,
    phpBlockCount: phpBlocks.length,
    htmlBytes: Buffer.byteLength(html),
    // what marks an old design (Update Template): a missing viewport or language, jQuery, many stylesheets, no page landmarks
    viewport: /width=device-width/i.test($('meta[name="viewport"]').attr('content') || ''),
    lang: Boolean($('html').attr('lang')),
    jquery: $('script[src]').toArray().some((s) => /jquery/i.test($(s).attr('src') || '')),
    stylesheets: $('link[rel="stylesheet"]').length,
    landmarks: Boolean($('main').length && $('nav').length && $('header').length && $('footer').length),
  };
}
