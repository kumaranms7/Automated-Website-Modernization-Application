import { esc, icon, btn, T } from './ui.js';
import { tagParts, applySection, cleanStyle } from './parts.js';
import { NEW_HEADER, NEW_FOOTER } from './designs/index.js';

// The header and the footer of the kit designs (Tailwind), each in a few styles.

const logo = (K, dark = false) => `<a class="inline-flex items-center gap-2.5 font-display text-[1.35rem] leading-none font-extrabold tracking-tight ${dark ? 'text-white' : 'text-heading'}" data-p="brand" href="${esc(K.u('/'))}">${K.site.logo ? `<img class="h-auto max-h-10 w-auto" src="${esc(K.u(K.site.logo))}" alt="${esc(K.site.name)}">` : `<span class="grid size-10 place-items-center rounded-xl text-white shadow-kglow ${T.grad}">${icon(K.pack.services[0][1], 'size-[1.35rem]')}</span><span>${esc(K.site.name)}</span>`}</a>`;
const navLink = 'rounded-full px-3.5 py-2 text-[.96rem] font-semibold whitespace-nowrap text-secondary transition hover:bg-ink/5 hover:text-heading aria-[current]:bg-ink/5 aria-[current]:text-heading';
const navLinks = (K, list) => list.map((n) => `<a class="${navLink}" data-p="navLink" href="${esc(K.u(n.href))}"${n.current ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('\n');
const cta = (K) => `<div class="flex items-center gap-3">${K.site.phone?.digits ? `<a class="inline-flex items-center gap-2 font-bold whitespace-nowrap text-heading max-xl:hidden" data-p="phone" href="tel:${K.site.phone.digits}">${icon('phone', 'size-[1.2rem] text-brand')}<span>${esc(K.site.phone.display)}</span></a>` : ''}<span class="max-lg:hidden">${btn({ text: K.site.ctaLabel || 'Get a quote', href: K.u(K.site.ctaHref || '#contact') }, 'primary', false)}</span></div>`;
const menuBtn = (label = 'Open menu', ic = 'menu') => `<button class="ml-auto grid size-11 place-items-center rounded-xl border border-default bg-surface text-heading lg:hidden" type="button" aria-label="${label}" aria-expanded="false" data-k-menu>${icon(ic, 'size-5')}</button>`;
const drawer = (K, nav) => `<div class="fixed inset-0 z-[60] hidden content-start gap-6 overflow-auto bg-background p-5 data-[open]:grid" data-k-drawer><div class="flex items-center justify-between">${logo(K)}<button class="grid size-11 place-items-center rounded-xl border border-default bg-surface text-heading" type="button" aria-label="Close menu" data-k-menu>${icon('close', 'size-5')}</button></div><nav class="grid" aria-label="Mobile">${nav.map((n) => `<a class="border-b border-light px-2 py-4 font-display text-2xl leading-tight font-bold text-heading" href="${esc(K.u(n.href))}">${esc(n.label)}</a>`).join('\n')}</nav>${btn({ text: K.site.ctaLabel || 'Get a quote', href: K.u(K.site.ctaHref || '#contact') }, 'primary', true, true)}</div>`;

export function topbar(K) {
  if (K.real && !K.site.address && !K.site.hours && !(K.site.phones || []).length) return '';
  return `<div class="on-dark bg-secondary text-sm text-on-dark"><div class="${T.wrap} flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 max-sm:justify-center"><span class="inline-flex items-center gap-2">${K.site.address || !K.real ? `${icon('pin', 'size-4 text-accent')}${esc(K.site.address || 'Serving your local area')}` : ''}</span><span class="inline-flex items-center gap-2 max-sm:hidden">${K.site.hours || !K.real ? `${icon('clock', 'size-4 text-accent')}${esc(K.site.hours || 'Open today until 6:00 pm')}` : ''}</span><span class="inline-flex flex-wrap gap-x-4">${(K.site.phones || []).map((p) => `<a class="inline-flex items-center gap-2 hover:underline" href="tel:${p.digits}">${icon('phone', 'size-4 text-accent')}${esc(p.display)}</a>`).join('\n')}</span></div></div>`;
}

export const HEADER = {
  pill: (K) => `<header class="sticky top-0 z-50 pt-4 pb-2" data-k-header><div class="${T.wrap}"><div class="flex items-center gap-6 rounded-full border border-default bg-paper/80 py-2.5 pr-2.5 pl-5 shadow-k2 backdrop-blur-xl backdrop-saturate-150" data-p="bar">${logo(K)}<nav class="mx-auto flex items-center gap-1 max-lg:hidden" aria-label="Main">${navLinks(K, K.nav)}</nav>${cta(K)}${menuBtn()}</div></div>${drawer(K, K.nav)}</header>`,
  clean: (K) => `<header class="sticky top-0 z-50 border-b border-light bg-paper/90 py-3 backdrop-blur-md transition data-[scrolled]:shadow-k1" data-k-header><div class="${T.wrap} flex items-center gap-6">${logo(K)}<nav class="mx-auto flex items-center gap-1 max-lg:hidden" aria-label="Main">${navLinks(K, K.nav)}</nav>${cta(K)}${menuBtn()}</div>${drawer(K, K.nav)}</header>`,
  center: (K) => { const h = Math.ceil(K.nav.length / 2); return `<header class="sticky top-0 z-50 border-b border-light bg-paper/90 py-3.5 backdrop-blur-md transition data-[scrolled]:shadow-k1" data-k-header><div class="${T.wrap} flex items-center gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]"><nav class="flex items-center gap-1 max-lg:hidden" aria-label="Main">${navLinks(K, K.nav.slice(0, h))}</nav><span class="lg:justify-self-center">${logo(K)}</span><nav class="flex items-center justify-end gap-1 max-lg:hidden" aria-label="More">${navLinks(K, K.nav.slice(h))}${btn({ text: K.site.ctaLabel || 'Get a quote', href: K.u(K.site.ctaHref || '#contact') }, 'primary', false)}</nav>${menuBtn()}</div>${drawer(K, K.nav)}</header>`; },
};

Object.assign(HEADER, NEW_HEADER);
const social = () => `<div class="mt-6 flex gap-2.5">${[['globe', 'Facebook'], ['camera', 'Instagram'], ['mail', 'Email']].map(([i, l]) => `<a class="grid size-10 place-items-center rounded-full border border-current/20 transition hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-white" href="#" aria-label="${l}">${icon(i, 'size-[1.1rem]')}</a>`).join('')}</div>`;
const cols = (K, dark) => {
  const s = K.site;
  const h4 = `mb-4 text-[.85rem] font-bold tracking-widest uppercase ${dark ? 'text-white' : 'text-heading'}`;
  const li = dark ? 'transition hover:text-white' : 'transition hover:text-brand';
  return `<div class="relative grid gap-[clamp(2rem,4vw,4rem)] sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]"><div>${logo(K, dark)}${K.site.blurb || !K.real ? `<p class="mt-4 max-w-sm" data-p="footText">${esc(K.site.blurb || K.pack.hero[1])}</p>` : ''}${K.real ? '' : social()}</div>
  <div><h4 class="${h4}" data-p="footHeading">Company</h4><ul class="m-0 grid list-none gap-3 p-0">${K.nav.slice(0, 5).map((n) => `<li><a class="${li}" data-p="footLink" href="${esc(K.u(n.href))}">${esc(n.label)}</a></li>`).join('\n')}</ul></div>
  <div>${K.real && !(K.serviceLinks || []).length ? '' : `<h4 class="${h4}" data-p="footHeading">Services</h4><ul class="m-0 grid list-none gap-3 p-0">${(K.real ? K.serviceLinks.map((l) => [l.label, l.href]) : K.pack.services.slice(0, 5).map(([t]) => [t, '/#services'])).map(([t, href]) => `<li><a class="${li}" data-p="footLink" href="${esc(K.u(href))}">${esc(t)}</a></li>`).join('\n')}</ul>`}</div>
  <div><h4 class="${h4}" data-p="footHeading">Contact</h4><ul class="m-0 grid list-none gap-3 p-0">${(s.phones || []).map((p) => `<li class="flex items-start gap-3">${icon('phone', 'mt-1 size-[1.1rem] text-accent')}<a class="${li}" data-p="footLink" href="tel:${p.digits}">${esc(p.display)}</a></li>`).join('\n')}${s.email || !K.real ? `<li class="flex items-start gap-3">${icon('mail', 'mt-1 size-[1.1rem] text-accent')}<a class="${li}" data-p="footLink" href="mailto:${esc(s.email || 'hello@example.com')}">${esc(s.email || 'hello@example.com')}</a></li>` : ''}${s.address || !K.real ? `<li class="flex items-start gap-3">${icon('pin', 'mt-1 size-[1.1rem] text-accent')}<span>${esc(s.address || '123 Main Street, Your City')}</span></li>` : ''}</ul></div></div>`;
};
const legal = (K, border = 'border-current/15') => `<div class="relative mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap justify-between gap-4 border-t ${border} py-6 text-sm" data-p="footLegal"><span>© ${new Date().getFullYear()} ${esc(K.site.name)}. All rights reserved.</span><span><a class="hover:underline" href="${esc(K.u('/privacy.html'))}">Privacy</a> · <a class="hover:underline" href="${esc(K.u('/terms.html'))}">Terms</a></span></div>`;
export const FOOTER = {
  dark: (K) => `<footer class="on-dark relative overflow-hidden bg-night pt-[clamp(3.5rem,7vw,6rem)] text-on-dark/80 max-sm:pb-20 before:absolute before:inset-x-0 before:top-0 before:h-88 before:bg-[radial-gradient(50%_100%_at_50%_0%,color-mix(in_srgb,var(--th-brand-primary)_28%,transparent),transparent_70%)] before:content-['']"><div class="${T.wrap} relative">${cols(K, true)}${legal(K)}</div></footer>`,
  light: (K) => `<footer class="border-t border-default bg-paper-alt pt-[clamp(3.5rem,7vw,6rem)] text-secondary max-sm:pb-20"><div class="${T.wrap}">${cols(K, false)}${legal(K, 'border-default')}</div></footer>`,
  mini: (K) => `<footer class="border-t border-default bg-paper-alt text-secondary max-sm:pb-20"><div class="${T.wrap}">${legal(K, 'border-transparent').replace('mt-[clamp(2.5rem,5vw,4rem)]', 'mt-0')}</div></footer>`,
};

Object.assign(FOOTER, NEW_FOOTER);
export const mobileCta = (K) => (K.site.phone?.digits ? `<div class="fixed inset-x-3 bottom-3 z-40 flex gap-2.5 sm:hidden"><a class="${T.btn} ${T.btnPrimary} flex-1 shadow-k3" href="tel:${K.site.phone.digits}">${icon('phone', 'size-5')}Call now</a><a class="${T.btn} ${T.btnLight} flex-1 border-default shadow-k3" href="${esc(K.u(K.site.ctaHref || '#contact'))}">${esc(K.real && K.site.ctaLabel && K.site.ctaLabel.length <= 18 ? K.site.ctaLabel : 'Free quote')}</a></div>` : '');

// edit: the roots are marked so the editor can select them
export function chromeHtml(design, K, { edit = false } = {}) {
  const c = design.chrome || {};
  const dress = (html, key) => {
    if (!html) return html;
    const style = cleanStyle(c[key]?.style);
    const styled = Object.keys(style).length > 0;
    if (!styled && !edit) return html;
    let out = html;
    if (style.section) out = applySection(out, style.section);
    // inside the header and footer only what is marked as a part, and the buttons, are parts
    out = tagParts(out, styled ? style : null, { auto: ['button'] });
    return edit ? out.replace(/<(header|footer|div)\b/, `<$1 data-kit-chrome="${key}"`) : out;
  };
  return {
    topbar: design.topbar ? dress(topbar(K), 'topbar') : '',
    header: dress(HEADER[design.header](K), 'header'),
    footer: dress(FOOTER[design.footer](K), 'footer'),
    mobile: mobileCta(K),
  };
}
