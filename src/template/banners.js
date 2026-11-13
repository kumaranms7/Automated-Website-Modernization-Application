import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import sharp from 'sharp';
import { clientDir } from '../config.js';

// Banner images of the designed template: one for the home page, one for the inner pages and one for the contact page. The picture
// is added in Design settings, stored with the website's template files, drawn as the hero of that kind of page, and copied to the
// built site as assets/banners/<file>. Previews read it from the same place, so what is previewed is what is built.

export const SLOTS = ['home', 'inner', 'contact'];
export const BANNER_DIR = 'assets/banners';
const MAX_BYTES = 12 * 1024 * 1024;
const WIDTH = 2000; // wide enough for a full-width hero on a large screen, small enough to load quickly

// the folder that holds assets/banners/…: it is also served as a fallback root by the previews
export const bannerRoot = (slug) => path.join(clientDir(slug), 'template', 'assets-root');
export const bannerFolder = (slug) => path.join(bannerRoot(slug), BANNER_DIR);

export const isBannerSrc = (src) => /^assets\/banners\/[\w.-]+\.(?:webp|jpe?g|png)$/i.test(String(src || ''));

// a picture the user chose, as a data URL. Returns the path the page uses.
export async function saveBanner(slug, slot, { dataUrl, name = '' }) {
  if (!SLOTS.includes(slot)) throw new Error('Choose home, inner or contact.');
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
  if (!m) throw new Error('Choose a JPG, PNG or WebP picture.');
  return storeBanner(slug, slot, Buffer.from(m[2], 'base64'), name);
}

// the picture, as bytes: checked, made into an optimised WebP of at most 2000px, and stored
async function storeBanner(slug, slot, input, name) {
  if (input.length > MAX_BYTES) throw new Error('That picture is larger than 12 MB. Choose a smaller one.');
  let meta;
  try { meta = await sharp(input).metadata(); } catch { throw new Error('That file is not a picture that can be read.'); }
  if (!meta.width || !meta.height) throw new Error('That file is not a picture that can be read.');
  if (meta.width < 800) throw new Error(`That picture is only ${meta.width}px wide. A banner needs at least 800px.`);
  // WebP, the picture's orientation applied and its metadata dropped
  const out = await sharp(input).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const file = `${slot}-${crypto.createHash('sha1').update(out.data).digest('hex').slice(0, 8)}.webp`;
  await fs.mkdir(bannerFolder(slug), { recursive: true });
  await fs.writeFile(path.join(bannerFolder(slug), file), out.data);
  return { src: `${BANNER_DIR}/${file}`, width: out.info.width, height: out.info.height, bytes: out.data.length, name: String(name).slice(0, 80), lowRes: out.info.width < 1400 };
}

// ---------- a picture from a link ----------
// The address is read once and the picture is kept with the template, like an uploaded one: the built site never depends on another
// website's picture. Only public web addresses are read.
const privateAddress = (ip) => /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip) || /^(::1?$|fc|fd|fe[89ab])/i.test(ip) || /^::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/i.test(ip);
async function assertPublic(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error('Enter a public http or https address.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new Error('Enter a public web address (not one on this computer or network).');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => { throw new Error(`The address ${host} could not be found.`); });
  if (!addrs.length || addrs.some((a) => privateAddress(a.address))) throw new Error('Enter a public web address (not one on this computer or network).');
}

export async function saveBannerFromUrl(slug, slot, link, { fetcher = fetch } = {}) {
  if (!SLOTS.includes(slot)) throw new Error('Choose home, inner or contact.');
  let u;
  try { u = new URL(String(link || '').trim()); } catch { throw new Error('Enter the full address of the picture, starting with https://'); }
  let res;
  // redirects are followed by hand so that every address on the way is checked
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublic(u);
    try { res = await fetcher(u.href, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { accept: 'image/webp,image/png,image/jpeg,*/*;q=0.5', 'user-agent': 'Mozilla/5.0 (compatible; SiteModernizer)' } }); } catch (e) { throw new Error(`The picture could not be downloaded (${e.name === 'TimeoutError' ? 'it took too long' : e.cause?.code || e.message}).`); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { u = new URL(res.headers.get('location'), u); continue; }
    break;
  }
  if (res.status >= 300 && res.status < 400) throw new Error('The address redirects too many times.');
  if (!res.ok) throw new Error(`The picture could not be downloaded (the website answered ${res.status}).`);
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type && !/^image\/(png|jpe?g|webp)/.test(type) && !/octet-stream/.test(type)) throw new Error(type.startsWith('text/html') ? 'That address is a web page, not a picture. Use the address of the picture itself (right-click the picture, then “Copy image address”).' : 'Only JPG, PNG and WebP pictures can be used.');
  const length = Number(res.headers.get('content-length') || 0);
  if (length > MAX_BYTES) throw new Error('That picture is larger than 12 MB. Choose a smaller one.');
  const chunks = []; let size = 0;
  for await (const c of res.body) { size += c.length; if (size > MAX_BYTES) throw new Error('That picture is larger than 12 MB. Choose a smaller one.'); chunks.push(c); }
  return storeBanner(slug, slot, Buffer.concat(chunks), decodeURIComponent(u.pathname.split('/').pop() || 'banner').slice(0, 80));
}

// ---------- a background video ----------
// A short looping clip behind the heading of a banner. It is checked by its first bytes, kept with the template like a picture (an uploaded
// file, or one downloaded once from a public link) and copied to the built site as assets/banners/<file>.
const VIDEO_MAX = 25 * 1024 * 1024;
export const isBannerVideo = (src) => /^assets\/banners\/[\w.-]+\.(?:mp4|webm)$/i.test(String(src || ''));
const videoKind = (buf) => (buf.length > 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp' ? 'mp4' : buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3 ? 'webm' : '');

async function storeVideo(slug, slot, input, name) {
  if (input.length > VIDEO_MAX) throw new Error('That video is larger than 25 MB. Use a shorter or more compressed clip (10 to 15 seconds is plenty).');
  const kind = videoKind(input);
  if (!kind) throw new Error('Choose an MP4 or WebM video.');
  const file = `${slot}-v${crypto.createHash('sha1').update(input).digest('hex').slice(0, 8)}.${kind}`;
  await fs.mkdir(bannerFolder(slug), { recursive: true });
  await fs.writeFile(path.join(bannerFolder(slug), file), input);
  return { src: `${BANNER_DIR}/${file}`, bytes: input.length, type: kind, name: String(name).slice(0, 80) };
}

export async function saveBannerVideo(slug, slot, { dataUrl, name = '' }) {
  if (!SLOTS.includes(slot)) throw new Error('Choose home, inner or contact.');
  const m = /^data:video\/(mp4|webm|quicktime)[^,]*;base64,([A-Za-z0-9+/=]+)$/i.exec(String(dataUrl || ''));
  if (!m) throw new Error('Choose an MP4 or WebM video.');
  return storeVideo(slug, slot, Buffer.from(m[2], 'base64'), name);
}

export async function saveBannerVideoFromUrl(slug, slot, link, { fetcher = fetch } = {}) {
  if (!SLOTS.includes(slot)) throw new Error('Choose home, inner or contact.');
  let u;
  try { u = new URL(String(link || '').trim()); } catch { throw new Error('Enter the full address of the video file, starting with https://'); }
  let res;
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublic(u);
    try { res = await fetcher(u.href, { redirect: 'manual', signal: AbortSignal.timeout(60000), headers: { accept: 'video/mp4,video/webm,*/*;q=0.5', 'user-agent': 'Mozilla/5.0 (compatible; SiteModernizer)' } }); } catch (e) { throw new Error(`The video could not be downloaded (${e.message}).`); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { u = new URL(res.headers.get('location'), u); continue; }
    break;
  }
  if (res.status >= 300 && res.status < 400) throw new Error('The address redirects too many times.');
  if (!res.ok) throw new Error(`The video could not be downloaded (the website answered ${res.status}).`);
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type.startsWith('text/html')) throw new Error('That address is a web page, not a video file. A YouTube or Vimeo page cannot be used as a background: use the address of an MP4 or WebM file.');
  if (Number(res.headers.get('content-length') || 0) > VIDEO_MAX) throw new Error('That video is larger than 25 MB. Use a shorter or more compressed clip.');
  const chunks = []; let size = 0;
  for await (const c of res.body) { size += c.length; if (size > VIDEO_MAX) throw new Error('That video is larger than 25 MB. Use a shorter or more compressed clip.'); chunks.push(c); }
  return storeVideo(slug, slot, Buffer.concat(chunks), decodeURIComponent(u.pathname.split('/').pop() || 'video').slice(0, 80));
}

// the published copy: every picture a design uses, into the built site
export async function copyBanners(slug, spec, buildDir) {
  const used = new Set([...SLOTS.map((s) => spec.extras?.banners?.[s]?.src).filter(isBannerSrc), ...SLOTS.map((s) => spec.extras?.banners?.[s]?.video?.src).filter(isBannerVideo)].map((s) => path.basename(s)));
  if (!used.size) return 0;
  await fs.mkdir(path.join(buildDir, BANNER_DIR), { recursive: true });
  let n = 0;
  for (const f of used) { try { await fs.copyFile(path.join(bannerFolder(slug), f), path.join(buildDir, BANNER_DIR, f)); n += 1; } catch { /* a picture that is gone: the page shows the usual hero */ } }
  return n;
}
