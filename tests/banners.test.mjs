import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

// the data folder is chosen before the modules that read it are loaded
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-banners-'));
process.env.SM_DATA_DIR = DATA;
const { saveBanner, copyBanners, isBannerSrc, bannerFolder, bannerRoot } = await import('../src/template/banners.js');
const { normalizeSpec, DEFAULT_SPEC, specForPage } = await import('../src/template/spec.js');
const { heroPhoto, innerHero } = await import('../src/template/components.js');

const jpeg = async (w, h) => `data:image/jpeg;base64,${(await sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } }).jpeg().toBuffer()).toString('base64')}`;

test('a banner picture is stored as an optimised WebP no wider than 2000px', async () => {
  const r = await saveBanner('site', 'home', { dataUrl: await jpeg(3000, 1000), name: 'Hero Shot.jpg' });
  assert.match(r.src, /^assets\/banners\/home-[0-9a-f]{8}\.webp$/);
  assert.equal(r.width, 2000);
  assert.ok(isBannerSrc(r.src));
  const meta = await sharp(fs.readFileSync(path.join(bannerFolder('site'), path.basename(r.src)))).metadata();
  assert.equal(meta.format, 'webp');
  assert.ok(bannerFolder('site').startsWith(bannerRoot('site')));
});

test('a picture that cannot be a banner is refused with a reason', async () => {
  await assert.rejects(saveBanner('site', 'home', { dataUrl: await jpeg(500, 300) }), /only 500px wide/);
  await assert.rejects(saveBanner('site', 'home', { dataUrl: 'data:image/gif;base64,R0lGOD' }), /JPG, PNG or WebP/);
  await assert.rejects(saveBanner('site', 'home', { dataUrl: 'data:image/jpeg;base64,AAAA' }), /can be read/);
  await assert.rejects(saveBanner('site', 'footer', { dataUrl: await jpeg(1200, 400) }), /home, inner or contact/);
});

test('the design keeps one banner for each kind of page, and drops a path that is not a picture', () => {
  const s = normalizeSpec({ extras: { banners: { home: { src: 'assets/banners/home-abc12345.webp', alt: 'A <b>van</b>' }, inner: { src: '../secret.txt' }, contact: { src: '' } } } }, DEFAULT_SPEC);
  assert.equal(s.extras.banners.home.src, 'assets/banners/home-abc12345.webp');
  assert.equal(s.extras.banners.home.alt, 'A bvan/b');
  assert.equal(s.extras.banners.inner.src, '');
  assert.deepEqual(Object.keys(s.extras.banners), ['home', 'inner', 'contact']);
  // saving other extras keeps the banners
  const again = normalizeSpec({ extras: { ...s.extras, backToTop: { icon: '' } } }, s);
  assert.equal(again.extras.banners.home.src, s.extras.banners.home.src);
});

test('a page with a banner is drawn with a photographic hero showing it, and only that kind of page', () => {
  const s = normalizeSpec({ layout: { hero: 'gradient' }, extras: { banners: { inner: { src: 'assets/banners/inner-abc12345.webp', alt: 'Crew' } } } }, DEFAULT_SPEC);
  const inner = specForPage(s, 'inner'), home = specForPage(s, 'home');
  assert.equal(inner.layout.hero, 'photo');
  assert.equal(inner.extras.heroImage.src, 'assets/banners/inner-abc12345.webp');
  assert.equal(home.layout.hero, 'gradient');
  const ctx = { siteUrl: (p) => '../..' + p, state: {}, dims: null };
  assert.equal(heroPhoto(inner, ctx, null).src, '../../assets/banners/inner-abc12345.webp');
  const html = innerHero({ hero: { h1: 'Title', crumbs: [] }, protected: {} }, { phone: { digits: '5550100', display: '555-0100' }, ctaLabel: 'Quote', ctaHref: '/c.html' }, (p) => p, ctx, inner, null);
  assert.match(html, /hero hero-photo hero-inner/);
  assert.match(html, /<img src="\.\.\/\.\.\/assets\/banners\/inner-abc12345\.webp" alt="Crew"/);
});

test('the built site gets the pictures the design uses, and only those', async () => {
  const a = await saveBanner('site2', 'home', { dataUrl: await jpeg(1600, 500) });
  await saveBanner('site2', 'inner', { dataUrl: await jpeg(1700, 500) }); // stored but not in use
  const spec = normalizeSpec({ extras: { banners: { home: { src: a.src, alt: '' } } } }, DEFAULT_SPEC);
  const out = fs.mkdtempSync(path.join(DATA, 'build-'));
  assert.equal(await copyBanners('site2', spec, out), 1);
  assert.deepEqual(fs.readdirSync(path.join(out, 'assets/banners')), [path.basename(a.src)]);
  assert.equal(await copyBanners('site2', DEFAULT_SPEC, fs.mkdtempSync(path.join(DATA, 'none-'))), 0);
});

test.after(() => { try { fs.rmSync(DATA, { recursive: true, force: true, maxRetries: 5 }); } catch { /* the temp folder is removed by the system later */ } });

// ---------- a picture from a link ----------
const { saveBannerFromUrl } = await import('../src/template/banners.js');
const reply = (status, headers, body) => ({ status, ok: status >= 200 && status < 300, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, body: (async function* () { if (body) yield body; })() });
const picture = async (w) => sharp({ create: { width: w, height: 500, channels: 3, background: '#aa5533' } }).png().toBuffer();

test('a picture link is downloaded once and stored like an uploaded picture', async () => {
  const buf = await picture(1800);
  const seen = [];
  const r = await saveBannerFromUrl('site3', 'inner', 'https://93.184.216.34/photos/Van%20Crew.png', { fetcher: async (u) => { seen.push(u); return reply(200, { 'content-type': 'image/png' }, buf); } });
  assert.deepEqual(seen, ['https://93.184.216.34/photos/Van%20Crew.png']);
  assert.match(r.src, /^assets\/banners\/inner-[0-9a-f]{8}\.webp$/);
  assert.equal(r.name, 'Van Crew.png');
  assert.ok(fs.existsSync(path.join(bannerFolder('site3'), path.basename(r.src))));
});

test('a link must be a public picture: not this computer, not a web page, not too small, not too large', async () => {
  const buf = await picture(1800);
  const ok = async () => reply(200, { 'content-type': 'image/png' }, buf);
  await assert.rejects(saveBannerFromUrl('site3', 'home', 'not a link', { fetcher: ok }), /full address/);
  await assert.rejects(saveBannerFromUrl('site3', 'home', 'ftp://93.184.216.34/a.png', { fetcher: ok }), /http or https/);
  for (const bad of ['http://localhost/a.png', 'http://127.0.0.1/a.png', 'http://192.168.1.5/a.png', 'http://10.0.0.2/a.png', 'http://172.20.1.1/a.png', 'http://169.254.169.254/latest', 'http://[::1]/a.png', 'http://printer.local/a.png']) {
    await assert.rejects(saveBannerFromUrl('site3', 'home', bad, { fetcher: ok }), /public web address/, bad);
  }
  await assert.rejects(saveBannerFromUrl('site3', 'home', 'https://93.184.216.34/page', { fetcher: async () => reply(200, { 'content-type': 'text/html; charset=utf-8' }, Buffer.from('<html>')) }), /web page, not a picture/);
  await assert.rejects(saveBannerFromUrl('site3', 'home', 'https://93.184.216.34/a.gif', { fetcher: async () => reply(200, { 'content-type': 'image/gif' }, Buffer.from('GIF89a')) }), /JPG, PNG and WebP/);
  await assert.rejects(saveBannerFromUrl('site3', 'home', 'https://93.184.216.34/gone.png', { fetcher: async () => reply(404, {}, null) }), /answered 404/);
  await assert.rejects(saveBannerFromUrl('site3', 'home', 'https://93.184.216.34/small.png', { fetcher: async () => reply(200, { 'content-type': 'image/png' }, await picture(400)) }), /only 400px/);
  await assert.rejects(saveBannerFromUrl('site3', 'home', 'https://93.184.216.34/huge.png', { fetcher: async () => reply(200, { 'content-type': 'image/png', 'content-length': String(30 * 1024 * 1024) }, null) }), /larger than 12 MB/);
});

test('a redirect is followed only to a public address', async () => {
  const buf = await picture(1600);
  const hops = [];
  const r = await saveBannerFromUrl('site3', 'contact', 'https://93.184.216.34/short', { fetcher: async (u) => { hops.push(u); return hops.length === 1 ? reply(302, { location: '/real.png' }, null) : reply(200, { 'content-type': 'image/png' }, buf); } });
  assert.deepEqual(hops, ['https://93.184.216.34/short', 'https://93.184.216.34/real.png']);
  assert.ok(r.src.startsWith('assets/banners/contact-'));
  await assert.rejects(saveBannerFromUrl('site3', 'contact', 'https://93.184.216.34/x', { fetcher: async () => reply(302, { location: 'http://127.0.0.1:4310/api/clients' }, null) }), /public web address/);
  await assert.rejects(saveBannerFromUrl('site3', 'contact', 'https://93.184.216.34/loop', { fetcher: async () => reply(302, { location: '/loop' }, null) }), /redirects too many/);
});

// ---------- a banner as a background or as a normal image ----------
test('a banner used as a normal image sits beside the heading instead of behind it', () => {
  const s = normalizeSpec({ layout: { hero: 'gradient' }, extras: { banners: { inner: { src: 'assets/banners/inner-abc12345.webp', alt: 'Crew', mode: 'image' }, home: { src: 'assets/banners/home-abc12345.webp', alt: 'Van' } } } }, DEFAULT_SPEC);
  assert.equal(s.extras.banners.inner.mode, 'image');
  assert.equal(s.extras.banners.home.mode, 'background', 'background is the default');
  const inner = specForPage(s, 'inner');
  assert.equal(inner.layout.hero, 'gradient', 'the design\'s own hero style is kept');
  assert.equal(inner.extras.heroImage.mode, 'image');
  const ctx = { siteUrl: (p) => '..' + p, state: {}, dims: null };
  const html = innerHero({ hero: { h1: 'Title', crumbs: [] }, protected: {} }, { phone: { digits: '5550100', display: '555-0100' }, ctaLabel: 'Quote', ctaHref: '/c.html' }, (p) => p, ctx, inner, null);
  assert.match(html, /hero-split/);
  assert.match(html, /<img src="\.\.\/assets\/banners\/inner-abc12345\.webp" alt="Crew"[^>]*class="hero-img/);
  assert.doesNotMatch(html, /hero-bg/);
  // a photographic design becomes the split hero, which has room for the picture
  const photo = normalizeSpec({ layout: { hero: 'photo' }, extras: { banners: { contact: { src: 'assets/banners/contact-abc12345.webp', mode: 'image' } } } }, DEFAULT_SPEC);
  assert.equal(specForPage(photo, 'contact').layout.hero, 'split');
  // as a background the same picture is the hero background
  const bg = specForPage(normalizeSpec({ extras: { banners: { inner: { src: 'assets/banners/inner-abc12345.webp', mode: 'background' } } } }, DEFAULT_SPEC), 'inner');
  assert.match(innerHero({ hero: { h1: 'Title', crumbs: [] }, protected: {} }, { phone: { digits: '5550100', display: '555-0100' }, ctaLabel: 'Quote', ctaHref: '/c.html' }, (p) => p, ctx, bg, null), /hero-bg/);
});

// ---------- what the Configuration sets, the design variants wear ----------
const { diffSpecs, recordConfig, loadConfig, wear, configKey } = await import('../src/studio/wear.js');

test('only the settings that were changed in a save are kept for the variants', async () => {
  const before = normalizeSpec({ tokens: { fontHeading: 'Oswald', radius: 'md' }, layout: { footer: 'dark', hero: 'gradient' } }, DEFAULT_SPEC);
  const after = normalizeSpec({ tokens: { fontHeading: 'Montserrat', radius: 'md' }, layout: { footer: 'dark', hero: 'photo' }, extras: { banners: { home: { src: 'assets/banners/home-abc12345.webp' } } } }, before);
  const d = diffSpecs(before, after);
  assert.deepEqual(Object.keys(d.tokens), ['fontHeading']);
  assert.deepEqual(Object.keys(d.layout), ['hero']);
  assert.deepEqual(Object.keys(d.extras), ['banners']);
  assert.equal(await recordConfig('wear-site', before, before), 0, 'a save that changes nothing records nothing');
  assert.equal(await recordConfig('wear-site', before, after), 3);
  // the next change to the same setting replaces it; the others stay
  const later = normalizeSpec({ tokens: { fontHeading: 'Oswald' } }, after);
  await recordConfig('wear-site', after, later);
  const cfg = await loadConfig('wear-site');
  assert.equal(cfg.tokens.fontHeading, 'Oswald');
  assert.equal(cfg.layout.hero, 'photo');
});

test('a variant keeps its own design except for the colours and the settings saved in the Configuration', async () => {
  const variant = { spec: { tokens: { primary: '#111111', primaryDark: '#000000', accent: '#222222', ink: '#333333', soft: '#eeeeee', fontHeading: 'Oswald', radius: 'lg', shadow: 'soft' }, layout: { header: 'centered', hero: 'split', footer: 'dark' }, extras: { floating: { side: 'left', items: [] } } }, page: { header: { variant: 'centered' }, footer: { variant: 'dark' }, sections: [{ ref: 'hero', variant: 'split' }, { ref: 'cards:1', variant: 'grid' }] } };
  const active = { tokens: { primary: '#aa0000', primaryDark: '#550000', accent: '#ffaa00', ink: '#202020', soft: '#faf0f0' }, theme: null };
  const plain = wear(variant, active);
  assert.equal(plain.tokens.primary, '#aa0000');
  assert.equal(plain.tokens.fontHeading, 'Oswald');
  assert.equal(plain.layout.hero, 'split');
  const cfg = { tokens: { fontHeading: 'Montserrat' }, layout: { footer: 'light', hero: 'photo' }, extras: { banners: { home: { src: 'assets/banners/home-abc12345.webp' } } } };
  const w = wear(variant, active, cfg);
  assert.equal(w.tokens.fontHeading, 'Montserrat');
  assert.equal(w.tokens.radius, 'lg', 'a setting nobody changed stays the variant\'s own');
  assert.equal(w.layout.footer, 'light');
  assert.equal(w.layout.header, 'centered');
  assert.equal(w.extras.floating.side, 'left');
  assert.equal(w.extras.banners.home.src, 'assets/banners/home-abc12345.webp');
  assert.equal(w.page.footer.variant, '', 'the page\'s own footer style no longer wins over the one chosen');
  assert.equal(w.page.header.variant, 'centered');
  assert.equal(w.page.sections.find((s) => s.ref === 'hero').variant, '');
  assert.equal(w.page.sections.find((s) => s.ref === 'cards:1').variant, 'grid');
  assert.equal(variant.page.footer.variant, 'dark', 'the stored variant is not changed');
  assert.notEqual(configKey(active, cfg), configKey(active), 'a new setting makes the drawings out of date');
});

test('a hero style a section of a composed home page has of its own does not hide the banner', async () => {
  const { sectionSpec } = await import('../src/template/layouts.js');
  const sec = { ref: 'hero', variant: 'dark', props: { head: 'inherit', cards: 'inherit' } };
  const plain = specForPage(normalizeSpec({ layout: { hero: 'gradient' } }, DEFAULT_SPEC), 'home');
  assert.equal(sectionSpec(plain, sec).layout.hero, 'dark', 'without a banner the section keeps its own hero style');
  for (const mode of ['background', 'image']) {
    const withBanner = specForPage(normalizeSpec({ layout: { hero: 'gradient' }, extras: { banners: { home: { src: 'assets/banners/home-abc12345.webp', mode } } } }, DEFAULT_SPEC), 'home');
    assert.equal(sectionSpec(withBanner, sec).layout.hero, mode === 'background' ? 'photo' : 'gradient', mode);
  }
});
