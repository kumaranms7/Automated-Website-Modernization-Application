import * as cheerio from 'cheerio';
import { plain } from '../util/html.js';

// Menu/footer/contact extraction for sites that do not use the class names of the first pilot site.
// Works from semantics only: the first <nav>, <footer>, tel: links and the logo image.

const PHONE_RE = /\(?\b\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/;

function normHref(href, host) {
  if (!href) return href;
  const m = href.match(/^https?:\/\/(?:www\.)?([^/]+)(\/.*)?$/i);
  if (m && m[1].toLowerCase() === host.replace(/^www\./, '')) return m[2] || '/';
  return href.replace(/^\.\//, '/').replace(/^(?!\/|#|https?:|tel:|mailto:)/, '/');
}

export function genericSite(html, client) {
  const $ = cheerio.load(html);
  const host = client.host;
  const label = (a) => plain($(a).clone().find('img, svg').remove().end().text());
  const link = (a) => ({ label: label(a), href: normHref($(a).attr('href'), host), children: [] });

  const nav = $('nav').first();
  let nav_items = [];
  const topLis = nav.find('li').filter((_, li) => !$(li).parentsUntil(nav).filter('li').length).toArray();
  if (topLis.length) {
    nav_items = topLis.map((li) => {
      const a = $(li).children('a').first().length ? $(li).children('a').first() : $(li).find('a').first();
      const kids = $(li).find('li a, ul a').toArray().filter((x) => x !== a[0]).map(link).filter((k) => k.label && k.href && !/^#/.test(k.href));
      const seen = new Set();
      return { ...link(a), children: kids.filter((k) => !seen.has(k.href) && seen.add(k.href)).slice(0, 12) };
    });
  } else {
    nav_items = nav.find('a').toArray().slice(0, 8).map(link);
  }
  nav_items = nav_items.filter((i) => i.label && i.href && i.href !== '#');

  const text = (sel) => plain($(sel).text());
  const tel = $('a[href^="tel:"]').first();
  const phoneText = tel.length ? plain(tel.text()) : (text('footer') + ' ' + text('header')).match(PHONE_RE)?.[0] || '';
  const digits = (tel.attr('href') || phoneText).replace(/^tel:/, '').replace(/\D/g, '');

  const logo = $('img.logo, header img[src*="logo" i], img[src*="logo" i]').first().attr('src') || $('img').first().attr('src') || '';
  const footer = $('footer').first();
  const cols = footer.find('ul').toArray().map((ul) => {
    const head = $(ul).prevAll('h1,h2,h3,h4,h5,h6,p').first();
    return { title: plain(head.text()).slice(0, 40), items: $(ul).find('a').toArray().map((a) => ({ text: label(a), href: normHref($(a).attr('href'), host) })).filter((i) => i.text && i.href) };
  }).filter((c) => c.items.length).slice(0, 3);

  const legal = footer.find('a').toArray().map((a) => ({ text: label(a), href: normHref($(a).attr('href'), host) })).filter((l) => /privacy|terms|sitemap|accessib/i.test(l.text) && l.href);
  const contact = nav_items.find((i) => /contact/i.test(i.label))?.href || '/';

  return {
    name: client.name,
    host,
    phone: { display: phoneText || digits, digits },
    address: plain(footer.find('address').first().text()) || '',
    logo: normHref(logo, host),
    footerLogo: normHref(logo, host),
    bbbSealHtml: '',
    nav: nav_items,
    footerCols: cols,
    credentials: { title: '', items: [] },
    social: [],
    legal,
    copyrightName: client.name,
    sitemapHref: legal.find((x) => /sitemap/i.test(x.text))?.href || '',
    ctaHref: contact,
    ctaLabel: 'Contact us',
    ctaTitle: 'Talk to our team',
    generic: true,
  };
}
