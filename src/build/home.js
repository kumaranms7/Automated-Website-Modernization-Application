import { plain } from '../util/html.js';
import { cleanHtml } from './model.js';

// An ADAPTER for websites built on one specific legacy markup (a home page with section.main-banner, section.serv-sec, section.reviews-sec ...).
// It runs only when that markup is found (build/model.js checks for section.main-banner); every other home page is read by the generic reader in model.js.
// The class names below belong to that markup, not to the platform. The home page has its own, richer layout (hero + offers + service cards + stats + reviews + FAQ + areas).
// Everything is read verbatim from the original sections; nothing is rewritten here.

const inner = ($, el) => {
  const html = cleanHtml($, el);
  return html.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '').trim();
};
const text = ($, el) => plain($(el).toArray().map((e) => $(e).html() || '').join(' '));

export function extractHome($, relPath, common) {
  const banner = $('section.main-banner').first();
  const left = banner.find('.left-banner-content').first();
  const h1 = text($, banner.find('h1').first());

  const hero = {
    h1,
    eyebrow: text($, left.find('> p').first()),
    bullets: left.find('> ul li').map((_, li) => text($, li)).get().filter(Boolean),
    buttons: left.find('.btn-list a').map((_, a) => ({ text: text($, $(a).clone().find('i').remove().end()), href: ($(a).attr('href') || '').trim(), accent: /og-bg/.test($(a).attr('class') || '') })).get(),
    cardsTitle: text($, banner.find('.free-quote h4').first()),
    cards: banner.find('.free-quote-desktop li a').map((_, a) => ({
      href: $(a).attr('href'), text: text($, $(a).find('span')),
      img: $(a).find('img.normal-state').attr('src') || $(a).find('img').first().attr('src') || '',
    })).get(),
  };

  const special = $('section.special-banner').first();
  const offers = special.find('.offer-box').map((_, b) => ({ badge: text($, $(b).find('.offer')), label: text($, $(b).find('h4')), last: $(b).hasClass('last') })).get();
  const offerLinks = special.find('.cta a').map((_, a) => ({ text: text($, a), href: ($(a).attr('href') || '').trim(), mobile: /hide-desktop/.test($(a).attr('class') || '') })).get();

  const help = $('section.how-can-help-sec').first();
  const helpData = {
    title: text($, help.find('h3').first()),
    left: help.find('.how-can-help-left > p').toArray().map((p) => inner($, p)),
    tiles: help.find('.how-to-help-inner-box').map((_, b) => ({ icon: $(b).find('img').attr('src') || '', text: text($, $(b).find('h5')) })).get(),
    right: help.find('.how-can-help-rgt p').toArray().map((p) => inner($, p)),
  };

  const serv = $('section.serv-sec').first();
  const services = {
    title: text($, serv.find('h3').first()),
    intro: serv.find('> .fixed-wrapper > p').toArray().map((p) => inner($, p)),
    cards: serv.find('.services-box').map((_, a) => ({
      href: $(a).attr('href'), img: $(a).find('figure img').attr('src') || '', imgAlt: $(a).find('figure img').attr('alt') || '',
      icon: $(a).find('.services-content i img').attr('src') || '', title: text($, $(a).find('h5')), text: text($, $(a).find('.services-content p')),
    })).get(),
  };

  const stats = {
    items: $('.projects-sec .project-box').map((_, b) => ({ value: text($, $(b).find('span')), label: text($, $(b).find('p')) })).get(),
    img: $('.projects-sec .project-rgt img').attr('src') || '',
  };

  const same = $('section.same-day-pllubling-sec').first();
  const sameDay = {
    title: text($, same.find('.same-day-serv-left h4')),
    items: same.find('.icon-list li').map((_, li) => text($, li)).get().filter(Boolean),
    formTitle: text($, same.find('.same-day-serv-right-outer h4')),
    formText: same.find('.same-day-serv-right-outer > p').toArray().map((p) => inner($, p)),
  };

  const reviews = {
    title: text($, $('section.reviews-sec h4').first()),
    items: $('section.reviews-sec .review-box').map((_, b) => ({ quote: text($, $(b).find('p')), name: text($, $(b).find('b')) })).get().filter((r, i, all) => all.findIndex((x) => x.quote === r.quote) === i),
  };

  const about = $('section.about-sec').first();
  const aboutData = {
    title: text($, about.find('h4').first()),
    blocks: about.find('> .fixed-wrapper').children().toArray().filter((e) => /^(p|ul)$/.test(e.name)).map((e) => (e.name === 'p' ? { p: inner($, e) } : { ul: $(e).find('li').map((_, li) => text($, li)).get() })),
  };
  const mission = $('section.top-plumbling-sec').not('.about-sec').not('.free-quote').first();
  const missionData = {
    title: text($, mission.find('h4').first()),
    intro: mission.find('> .fixed-wrapper > p').toArray().map((p) => inner($, p)),
    boxes: mission.find('.top-plumbling-box').map((_, b) => ({ icon: $(b).find('img').attr('src') || '', title: text($, $(b).find('h5')), text: inner($, $(b).find('p').first()) })).get(),
  };

  const faqSec = $('section.hm-faq-sec').first();
  const faq = {
    title: text($, faqSec.find('> .fixed-wrapper > h4')),
    intro: faqSec.find('> .fixed-wrapper > p').toArray().map((p) => inner($, p)),
    sideTitle: text($, faqSec.find('.hm-faq-left h5')),
    img: faqSec.find('.hm-faq-left img').attr('src') || '',
    items: faqSec.find('.accordian-tab').map((_, t) => ({ q: text($, $(t).find('.accordion-head')), a: $(t).find('.accordion-body').toArray().map((b) => inner($, b)).join('') })).get(),
  };

  const loc = $('div.location-sec').first();
  const buttons = loc.find('.tablinks').map((_, b) => text($, b)).get();
  const areas = loc.find('.tabcontent').map((i, t) => ({
    title: buttons[i] || '',
    links: $(t).find('a').map((_, a) => ({ href: $(a).attr('href'), text: text($, a) })).get(),
  })).get();

  const fam = $('section.family-mamber-sec').first();
  const family = { img: fam.find('img').attr('src') || '', imgAlt: fam.find('img').attr('alt') || '', title: text($, fam.find('h5').first()), paragraphs: fam.find('.family-mamber-rgt-inner p').toArray().map((p) => inner($, p)) };

  const contact = $('section.hm-map .contac-dts-list li').map((_, li) => ({ icon: $(li).find('img').attr('src') || '', title: text($, $(li).find('h6')), text: text($, $(li).find('p')) })).get();

  return {
    ok: true, kind: 'home', path: relPath,
    head: common.head,
    hero: { h1, crumbs: [] },
    home: { hero, offers, offerLinks, help: helpData, services, stats, sameDay, reviews, about: aboutData, mission: missionData, faq, areas, family, contact },
    blocks: [],
    sideForm: false,
    protected: common.protected,
    unhandled: [],
  };
}
