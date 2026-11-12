import * as cheerio from 'cheerio';
import { readSource } from '../util/source.js';
import path from 'node:path';
import { clientDir, readJson, writeJson } from '../config.js';
import { readHtml, plain } from '../util/html.js';
import { genericSite } from './site-generic.js';

// Site-wide chrome (nav, footer, contact details) is read once from the home page into
// clients/<slug>/site.json. It is editable, so one change updates every page on the next build.

function normHref(href, host) {
  if (!href) return href;
  const m = href.match(/^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/i);
  if (m && m[1].toLowerCase() === host.replace(/^www\./, '')) return m[2] || '/';
  return href.replace(/^\.\//, '/').replace(/^(?!\/|#|https?:|tel:|mailto:)/, '/');
}

function navItem($, li, host) {
  const a = $(li).children('a').first();
  const label = plain(a.clone().children().remove().end().text());
  const sub = $(li).children('ul').first();
  return {
    label,
    href: normHref(a.attr('href'), host),
    children: sub.length ? sub.children('li').map((_, c) => navItem($, c, host)).get() : [],
  };
}

export async function extractSite(client, slug) {
  const html = await readSource(client, client.chromePage || 'index.html');
  const $ = cheerio.load(html);
  if (!$('.menus').length) {
    const g = genericSite(html, client);
    await writeJson(path.join(clientDir(slug), 'site.json'), g);
    return g;
  }
  const host = client.host;
  const tel = $('a[href^="tel:"]').first();
  const phoneDigits = (tel.attr('href') || '').replace(/^tel:/, '').replace(/\D/g, '');
  const src = (sel) => $(sel).first().attr('src') || '';

  const cols = $('footer .foot-col').not('.foot-abt').map((_, c) => {
    const $c = $(c);
    if ($c.find('.follow-us').length) return null; // handled below, merged into the licence column
    return {
      title: plain($c.children('h6').first().text()),
      items: $c.find('> ul > li').map((_, li) => {
        const a = $(li).find('a').first();
        return { text: plain($(li).text()), href: a.length ? normHref(a.attr('href'), host) : null };
      }).get(),
    };
  }).get().filter(Boolean);

  const lic = $('footer .f-tos');
  const site = {
    name: client.name,
    host,
    phone: { display: plain(tel.text()) || phoneDigits, digits: phoneDigits },
    address: plain($('.top-left p').first().text()),
    logo: normHref(src('.main-header .logo img'), host),
    footerLogo: normHref(src('footer .f-logo img'), host),
    bbbSealHtml: $.html($('footer .f-logo a').first()),
    nav: $('.menus > ul > li').map((_, li) => navItem($, li, host)).get(),
    footerCols: cols,
    credentials: {
      title: plain(lic.children('h6').first().text()),
      items: lic.find('> ul > li').map((_, li) => plain($(li).text())).get(),
    },
    social: lic.find('.follow-us a').map((_, a) => ({
      href: $(a).attr('href'), label: $(a).attr('aria-label') || '', icon: normHref($(a).find('img').attr('src'), host), alt: $(a).find('img').attr('alt') || '',
    })).get(),
    legal: $('.btm-footer-right a[href]').map((_, a) => ({ text: plain($(a).text()), href: normHref($(a).attr('href'), host) })).get().filter((l) => l.href !== '#'),
    copyrightName: plain($('.btm-footer-right a[href="#"]').first().text()) || client.name,
    sitemapHref: '/sitemap.html',
    ctaHref: '/contact.html',
  };
  await writeJson(path.join(clientDir(slug), 'site.json'), site);
  return site;
}

export async function loadSite(client, slug) {
  return (await readJson(path.join(clientDir(slug), 'site.json'))) || extractSite(client, slug);
}
