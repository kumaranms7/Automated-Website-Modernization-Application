import { esc, icon, text, para, introOf, T, art, picture, btn, actions, sec, head } from '../ui.js';

// Helpers the new designs share. Every layout of a design is its own markup (its own Tailwind classes); what is common is how content is
// read: the shape of the items, the heading of a section, the actions of a page, and the small marks that carry the design's motion.
export { esc, icon, text, para, introOf, T, art, picture, btn, actions, sec, head };

export const items = (s) => s.items || [];
export const callTo = (K) => (K.site.phone?.digits ? { text: `Call ${K.site.phone.display}`, href: `tel:${K.site.phone.digits}` } : null);
export const quoteTo = (s, K) => ({ text: s?.label || K.site.ctaLabel || 'Get a free quote', href: s?.href || K.site.ctaHref || '#quote' });
export const blocksOf = (list) => (list || []).map((b) => (b.t === 'html' ? para(b.html) : b.t === 'h' ? `<h3>${esc(b.text)}</h3>` : b.t === 'img' && b.src ? `<figure><img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy" decoding="async"></figure>` : '')).join('\n');
export const bodyOf = (s) => (s.blocks ? blocksOf(s.blocks) : para(s.text));
export const itemOf = (t) => (typeof t === 'string' ? { title: t } : t);
export const num = (i) => String(i + 1).padStart(2, '0');
export const statsOf = (s) => items(s).map((x) => (Array.isArray(x) ? { value: x[0], label: x[1] } : x));
export const revsOf = (s) => items(s).map((x) => (Array.isArray(x) ? { quote: x[0], name: x[1], place: x[2] } : x));
export const faqsOf = (s) => items(s).map((f) => (Array.isArray(f) ? { q: f[0], a: f[1] } : f));
export const groupsOf = (s) => s.groups || [{ title: s.title, links: (s.items || []).map((x) => (typeof x === 'string' ? { text: x } : x)) }];
export const answerOf = (a) => `<div class="prose-k">${/<\/?[a-z][\s\S]*>/i.test(String(a || '')) ? a : `<p>${esc(a)}</p>`}</div>`;
export const initialsOf = (name) => String(name || '?').replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

// the last word of a headline in the accent colour: the design's way of stressing one word (a heading that already has markup is left alone)
export const stress = (h1, cls = 'text-accent') => {
  const t = String(h1 || '');
  if (/<[a-z]/i.test(t)) return t;
  const w = t.trim().split(/\s+/);
  return w.length < 3 ? esc(t) : `${esc(w.slice(0, -1).join(' '))} <span class="${cls}">${esc(w[w.length - 1])}</span>`;
};
// the second half of a headline lighter than the first (two lines, the second a follow-on)
export const twoLines = (h1, lightCls = 'text-white/60') => {
  const t = String(h1 || '');
  if (/<[a-z]/i.test(t)) return t;
  const w = t.trim().split(/\s+/);
  if (w.length < 5) return esc(t);
  const cut = Math.ceil(w.length / 2);
  return `${esc(w.slice(0, cut).join(' '))} <span class="block ${lightCls}">${esc(w.slice(cut).join(' '))}</span>`; // (a block, not a <br>: the heading still reads as one sentence)
};

// the buttons a hero or a closing section shows: the page's own, else the quote action and the phone
export function heroButtons(h, K) {
  const list = h.buttons?.length ? h.buttons : [{ text: K.site.ctaLabel || 'Get a free quote', href: K.site.ctaHref || '#contact' }, callTo(K)].filter(Boolean);
  return [list[0], list[1]];
}
export const leadOf = (h, cls) => (h.lead || h.leadHtml ? `<div data-lead class="${cls}">${h.leadHtml ? h.leadHtml : esc(h.lead)}</div>` : '');

// what a place can offer at a glance: its phone, its quote action and where it is (placeholder text only in a preview)
export function quickActions(K, s = {}) {
  const site = K.site, out = [];
  if (site.phone?.digits || !K.real) out.push({ ic: 'phone', label: 'Call us', value: site.phone?.display || '(555) 010-2030', href: site.phone?.digits ? `tel:${site.phone.digits}` : '#' });
  out.push({ ic: 'calendar', label: 'Request a visit', value: site.ctaLabel || 'Get a free quote', href: site.ctaHref || '#quote' });
  if (site.address || !K.real) out.push({ ic: 'pin', label: 'Find us', value: site.address || 'Serving your local area', href: site.address ? `https://www.google.com/maps/search/${encodeURIComponent(site.address)}` : '#' });
  return out;
}

// the figures of a website: its own on a real page, the business type's in a preview
export const factsOf = (K) => (K.real ? (K.facts?.stats || []) : (K.stats || [])).slice(0, 4).map((x) => (Array.isArray(x) ? { value: x[0], label: x[1] } : x));

// a pause switch for everything that moves on the page (read by the motion toolkit)
export const pauseSwitch = (cls = '') => `<button type="button" data-k-pause aria-pressed="false" class="rounded-full border border-current/25 px-3.5 py-1.5 text-xs font-bold tracking-wide uppercase transition hover:bg-current/10 ${cls}">Pause animations</button>`;

// the hero's background video and its pause button (the toolkit plays, pauses and stills it)
export const videoBg = (h) => (h.video?.src ? `<video class="absolute inset-0 -z-20 size-full object-cover" data-k-video autoplay muted loop playsinline preload="metadata"${h.image?.src ? ` poster="${esc(h.image.src)}"` : ''} aria-hidden="true"><source src="${esc(h.video.src)}" type="${/\.webm(\?|$)/i.test(h.video.src) ? 'video/webm' : 'video/mp4'}"></video>` : '');
export const vPause = (cls = 'right-5 bottom-5') => `<button type="button" data-k-vpause aria-pressed="false" aria-label="Pause the background video" class="absolute z-10 grid size-11 place-items-center rounded-full border border-white/40 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 ${cls}"><svg data-pause viewBox="0 0 24 24" class="size-4 fill-current" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg><svg data-play viewBox="0 0 24 24" class="size-4 fill-current" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>`;
// the links under the "Services" item of the menu: the website's own, else the business type's
export const menuLinks = (K) => (K.real ? (K.serviceLinks || []).map((l) => ({ label: l.label, href: l.href })) : K.pack.services.slice(0, 6).map(([t]) => ({ label: t, href: '/#services' })));
// back to the top and the reading bar: the controls the toolkit drives
export const pageControls = () => `<div class="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5"><i class="block h-full w-full bg-accent" data-k-progress></i></div><button type="button" data-k-top aria-label="Back to the top" class="fixed right-4 bottom-24 z-40 grid size-12 place-items-center rounded-full border border-default bg-surface text-heading shadow-k3 transition hover:-translate-y-0.5 hover:bg-brand hover:text-white sm:bottom-6">${icon('arrow', '-rotate-90 size-5')}</button>`;

// a long heading (the website's own, often a whole sentence) is set smaller than a short one, so it still fits a few lines
export const longH1 = (h1, n = 38) => String(h1 || '').replace(/<[^>]+>/g, '').trim().length > n;

// is the first paragraph of a text short enough to be set large as a statement? (a long one is set as ordinary text)
export const shortIntro = (s, n = 260) => {
  const first = (s.blocks || []).find((b) => b.t === 'html' && b.html);
  const t = String(first ? first.html : s.text || '').replace(/<[^>]+>/g, ' ').replace(/ +/g, ' ').trim();
  return t.length > 0 && t.length <= n;
};

// ---------- reading a section: what it holds decides which form of a layout is used (shared by the designs that draw sections themselves) ----------
export const plainText = (t) => String(t || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export const introHtml = (s) => (s.intro?.length ? s.intro.map((b) => b.html || '').join('') : s.lead ? `<p>${esc(s.lead)}</p>` : '');
// is the picture large enough to fill a column? (a small one, or an SVG mark, keeps its own size)
export const largePic = (K, src) => { const d = K.dims?.[src]; return d ? d.w >= 480 : !/\.svg(\?|$)/i.test(String(src)); };
// a text that holds a picture of its own: the first picture is taken out of the text, to be shown beside it
export const withPic = (s) => {
  if (s.img || !Array.isArray(s.blocks)) return s;
  const at = s.blocks.findIndex((b) => b.t === 'img' && b.src);
  if (at < 0) return s;
  const rest = s.blocks.filter((_, i) => i !== at);
  return rest.some((b) => b.t !== 'img') ? { ...s, img: s.blocks[at].src, imgAlt: s.blocks[at].alt || '', blocks: rest } : s;
};
// a text without a heading of its own takes its first sub-heading as the heading
export const promote = (s) => {
  if (s.title || !Array.isArray(s.blocks)) return s;
  const at = s.blocks.findIndex((b) => b.t !== 'img');
  const b = s.blocks[at];
  return at < 0 || b?.t !== 'h' || !b.text ? s : { ...s, title: b.text, blocks: s.blocks.filter((_, i) => i !== at) };
};
const isCap = (b) => b && (b.t === 'h' || (b.t === 'html' && plainText(b.html).length > 0 && plainText(b.html).length <= 90 && !/<(ul|ol|table|iframe)/i.test(b.html)));
// the text of a section as a row of segments: plain text, and runs of pictures with a line each (a caption or a link), in either order
export function segments(blocks) {
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) out.push({ kind: 'text', blocks: buf }); buf = []; };
  const list = blocks || [];
  let i = 0;
  while (i < list.length) {
    const first = list[i]?.t === 'img' ? 'img' : 'cap';
    const run = [];
    let j = i;
    while (j + 1 < list.length) {
      const [x, y] = [list[j], list[j + 1]];
      if (first === 'img' && x.t === 'img' && isCap(y) && y.t !== 'img') run.push({ img: x, cap: y });
      else if (first === 'cap' && isCap(x) && x.t !== 'img' && y.t === 'img') run.push({ img: y, cap: x });
      else break;
      j += 2;
    }
    if (run.length >= 2) { flush(); out.push({ kind: 'pairs', list: run }); i = j; continue; }
    buf.push(list[i]); i += 1;
  }
  flush();
  return out;
}
// a list of "questions" that are really questions (most end with a question mark); the others are topics and are shown open
export const asked = (list) => list.filter((f) => /\?\s*$/.test(String(f.q || ''))).length >= list.length / 2;
// the heading and the line of the website's form
export const formHead = (K, s = {}) => ({ title: s.formTitle || K.quote?.title || 'Request a quote', sub: K.quote?.sub || '' });
// an embedded map, loaded when it comes into view
export const mapFrame = (html) => String(html || '').replace(/<iframe\b(?![^>]*\bloading=)/i, '<iframe loading="lazy"').replace(/<iframe\b(?![^>]*\btitle=)/i, '<iframe title="Map"');
// the mark of a card: the website's own small picture, a named icon, or nothing
export const markOf = (c) => ({ pic: c.img?.src && !c.title ? c.img.src : typeof c.icon === 'string' && /[./]/.test(c.icon) ? c.icon : '', name: typeof c.icon === 'string' && /^[a-z]+$/.test(c.icon) ? c.icon : '' });
// a heading in two parts: its last word or two apart, for a second colour
export const splitTitle = (title) => { const w = String(title || '').trim().split(/\s+/); if (w.length < 3) return [w.join(' '), '']; const n = w.length >= 7 ? 2 : 1; return [w.slice(0, -n).join(' '), w.slice(-n).join(' ')]; };

// ---------- the form a section takes (one decision for every design: what a section holds decides how it is laid out; how each form looks is the design's) ----------
export const lengthOf = (blocks) => (blocks || []).reduce((n, b) => n + plainText(b.html || b.text || '').length, 0);
// how much room a block takes in a column of the given width (px, roughly)
const roomOf = (b, width) => {
  const perLine = Math.max(30, width / 8.2);
  if (b.t === 'h') return Math.ceil(String(b.text || '').length / (perLine * 0.6)) * 32 + 30;
  if (b.t === 'img') return 300;
  const html = String(b.html || '');
  return Math.ceil(plainText(html).length / perLine) * 27 + (html.match(/<li\b/gi) || []).length * 10 + 22;
};
// a text beside its picture: what fits beside the picture stays beside it, the rest runs under both, so a long text never leaves a picture
// alone at the top of a tall column
export function beside(blocks, K, src, { col = 560, max = 540, head = 0 } = {}) {
  const d = K.dims?.[src];
  const room = (d && d.w ? Math.min(max, (col * d.h) / d.w) : 380) - head;
  const list = blocks || [];
  let used = 0, cut = list.length;
  for (let i = 0; i < list.length; i += 1) {
    const r = roomOf(list[i], col);
    if (i > 0 && used + r * 0.6 > room) { cut = i; break; }
    used += r;
  }
  while (cut > 1 && list[cut - 1]?.t === 'h') cut -= 1; // (a sub-heading is not left alone at the end)
  const under = list.slice(cut);
  return lengthOf(under) < 380 ? { side: list, under: [] } : { side: list.slice(0, cut), under };
}
// the topics of a text: every sub-heading with what follows it; what stands before the first one is the opening
export function topicsOf(blocks) {
  const opening = [], topics = [];
  for (const b of blocks || []) {
    if (b.t === 'h') topics.push({ title: b.text, blocks: [] });
    else if (topics.length) topics[topics.length - 1].blocks.push(b);
    else opening.push(b);
  }
  return { opening, topics };
}
// What a text is drawn as:
//   pairs     pictures with a line each                       a grid of picture cards
//   pictures  nothing but pictures
//   side      it carries the page's form beside it            the text with its pictures in their place, the form on a card
//   topics    several headings, each with its own text        a column, a card or a row for each
//   picture   a text and its picture                          side by side; what does not fit beside the picture runs under both
//   mark      a text and a small picture (a badge, a seal)    the text, the mark beside it
//   short     a heading and a few lines                       a statement
//   titled    a heading and a longer text
//   plain     a text without a heading
export function textShape(s0, K, { sided = false, col = 560 } = {}) {
  let raw = s0;
  const segs = Array.isArray(raw.blocks) ? segments(raw.blocks) : [];
  if (!sided && !raw.img && segs.length === 1 && segs[0].kind === 'pairs') return { kind: 'pairs', s: promote(raw), list: segs[0].list };
  if (!sided && !raw.title && !raw.img && (raw.blocks || []).length && raw.blocks.every((b) => b.t === 'img')) return { kind: 'pictures', s: raw, list: raw.blocks };
  if (sided) { const s = promote(raw); return { kind: 'side', s, pic: s.img ? { src: s.img, alt: s.imgAlt || '', after: Boolean(s.imgAfter) } : null }; }
  // (a first heading that ranks above every other one is the heading of the section, the others are its topics)
  const heads = (raw.blocks || []).filter((b) => b.t === 'h');
  if (!raw.title && raw.blocks?.[0]?.t === 'h' && heads.length > 2 && heads.slice(1).every((h) => (h.level || 9) > (heads[0].level || 0))) raw = promote(raw);
  const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const hasPic = Boolean(raw.img) || blocks.some((b) => b.t === 'img');
  const t = topicsOf(blocks);
  if (!hasPic && !raw.items?.length && !raw.wide && t.topics.length >= 2 && t.topics.every((x) => x.blocks.length)) {
    return { kind: 'topics', s: raw, opening: t.opening, topics: t.topics, long: Math.max(...t.topics.map((x) => lengthOf(x.blocks))) };
  }
  const s = withPic(promote(raw));
  if (s.img && ((s.blocks || []).some((b) => b.t !== 'img') || s.title || s.text)) {
    if (!largePic(K, s.img)) return { kind: 'mark', s, pic: { src: s.img, alt: s.imgAlt || '' } };
    const share = Array.isArray(s.blocks) ? beside(s.blocks, K, s.img, { col, head: s.title ? 110 : 0 }) : { side: null, under: [] };
    return { kind: 'picture', s, pic: { src: s.img, alt: s.imgAlt || '' }, side: share.side, under: share.under };
  }
  if (!s.title) return { kind: 'plain', s };
  if (s.wide) return { kind: 'wide', s };
  const length = plainText(bodyOf(s)).length;
  const short = !s.items?.length && (s.blocks || []).length <= 2 && length < 380 && !/<(table|ul|ol)/i.test(bodyOf(s));
  return { kind: short ? 'short' : 'titled', s, length };
}
// a list of points: the points, whether each has a line of its own, the text before the list and the text after it
export function listShape(s) {
  const list = items(s).map(itemOf);
  const lines = list.map((f) => f.full || [f.title, f.text].filter(Boolean).join(' '));
  return { list, lines, rich: list.filter((f) => f.text).length >= Math.max(2, list.length / 2), short: lines.every((t) => t.length <= 44), before: introHtml(s), after: (s.after || []).map((b) => b.html || '').join('') };
}
// the footer of a website: its own columns of links (else its menu and its services), its credentials, its social pages and its legal pages
export function footerOf(K) {
  const s = K.site, w = K.web || {};
  const own = K.real ? (s.footerCols || []).filter((c) => (c.items || []).some((i) => i.href)).slice(0, 3).map((c) => ({ title: c.title || '', links: c.items.filter((i) => i.text).map((i) => ({ text: i.text, href: i.href || '' })) })) : [];
  const services = K.real ? (K.serviceLinks || []).map((l) => ({ text: l.label, href: l.href })) : K.pack.services.slice(0, 5).map(([t]) => ({ text: t, href: '/#services' }));
  const cols = own.length ? own : [{ title: 'Explore', links: K.nav.slice(0, 6).map((n) => ({ text: n.label, href: n.href })) }, { title: 'Services', links: services }].filter((c) => c.links.length);
  const named = [['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['tiktok', 'TikTok'], ['google', 'Google'], ['yelp', 'Yelp']];
  const mine = K.real ? (s.social || []).filter((x) => x.href) : [];
  const has = (k) => mine.some((x) => new RegExp(k === 'x' ? 'twitter|//x\\.com' : k, 'i').test(`${x.href} ${x.alt || ''} ${x.label || ''}`));
  const social = [...mine.map((x) => ({ href: x.href, label: x.alt || x.label || 'Social page', icon: x.icon || '' })), ...named.filter(([k]) => w.social?.[k] && !has(k)).map(([k, label]) => ({ href: w.social[k], label, icon: '' }))];
  const legal = K.real ? [...(s.legal || []).filter((l) => l.href && l.text), ...(s.sitemapHref && !(s.legal || []).some((l) => /sitemap/i.test(l.text)) ? [{ text: 'Sitemap', href: s.sitemapHref }] : [])] : [{ text: 'Privacy', href: '#' }, { text: 'Terms', href: '#' }];
  return {
    cols, social, legal,
    blurb: w.tagline || s.blurb || (K.real ? '' : K.pack.hero[1]),
    credentials: K.real && s.credentials?.items?.length ? s.credentials : null,
    seal: K.real ? String(s.bbbSealHtml || '').replace(/\sstyle="[^"]*"/gi, '').replace(/<img\b(?![^>]*\bloading=)/i, '<img loading="lazy"').replace(/<img\b(?![^>]*\bwidth=)(?=[^>]*\bsrc="[^"]*?-(\d{2,4})-(\d{2,3})-[^"]*")/i, '<img width="$1" height="$2"') : '',
    hours: w.hours || s.hours || '',
    copyright: `© ${new Date().getFullYear()} ${s.copyrightName || s.name}. All rights reserved.`,
  };
}
// the menu of a design's header: the website's menu, then the other links its old header showed
export const menuOf = (K) => [...K.nav, ...(K.navMore || [])];
// the trail of an inner page: every step but the last is a link (the first one leads home when the page gave it no address)
export function crumbsOf(h, K) {
  const list = h.crumbs?.length ? h.crumbs : [{ text: 'Home', href: K.u('/') }, { text: plainText(h.h1) }];
  return list.map((c, i, a) => ({ text: c.text, href: i === a.length - 1 ? '' : c.href && c.href !== '#' ? c.href : i === 0 ? K.u('/') : '', last: i === a.length - 1 }));
}
// a picture that fills the ground of a hero: its size is given so the page does not wait to know its shape
export const groundImg = (K, src, alt) => { const t = K.img(src, alt || '', true); return /\bwidth=/.test(t) || K.dims?.[src] ? t : t.replace(/<img\b/, '<img width="1600" height="900"'); };

// ---------- the pattern of a website's grounds ----------
// A design that carries a pattern on its banner and its bands takes the one chosen in Design settings; left on "automatic", one that suits
// the kind of business (water for a plumber, a plan's grid for a builder, a cross for a clinic...), else one picked by the website's name,
// so two websites of the same design do not look the same. The drawings are in the stylesheet (data-k-pat on the body).
export const PATTERNS = ['waves', 'dots', 'grid', 'hatch', 'plus', 'rings', 'hex'];
const BY_TRADE = { plumbing: 'waves', 'junk-removal': 'hatch', roofing: 'hatch', 'law-firm': 'rings', healthcare: 'plus', ai: 'hex', technology: 'hex', 'pet-services': 'rings', finance: 'grid', education: 'dots', ecommerce: 'dots', construction: 'grid', 'home-services': 'dots' };
export function patternFor(choice, pack, name = '') {
  if (choice === 'none') return 'none';
  if (PATTERNS.includes(choice)) return choice;
  if (BY_TRADE[pack?.id]) return BY_TRADE[pack.id];
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ['dots', 'rings', 'grid', 'hatch'][h % 4];
}
