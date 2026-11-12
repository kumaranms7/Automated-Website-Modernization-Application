import { buildClient } from '../build/build.js';
import { chosenPages } from '../template/api.js';
import { specCss } from '../template/spec.js';
import { composerCss } from './css.js';
import { classesIn } from '../template/html-ops.js';

// Draws the home page for the editor: the real page content, rendered with a spec (and composed page) that has not been
// saved anywhere. No files are written and nothing is compiled except on the first call, so it takes a fraction of a second.

export const portalOrigin = () => globalThis.__portalOrigin || 'http://127.0.0.1:4310';

export const SLOTS = ['home', 'inner', 'contact'];

// One of the three page layouts (home, inner, contact), drawn on the real page chosen for it.
export async function renderSlot(slug, spec, slot = 'home') {
  const pages = await chosenPages(slug);
  if (!pages.home) throw new Error('No home page was found. Run a scan first.');
  const file = pages[slot];
  if (!file) throw new Error(slot === 'home' ? 'No home page was found.' : `No ${slot} page is chosen. Pick one on the Configuration tab (Pages to design on).`);
  const withPages = { ...spec, pages: { ...spec.pages, ...pages }, samples: pages };
  let got = null;
  await buildClient(slug, { only: [file], content: 'approved', spec: withPages, dry: true, outName: 'studio-dry', onPage: (p) => { got = p; } });
  if (!got) throw new Error(`The ${slot} page could not be drawn.`);
  return { html: got.html, result: got.result, path: file };
}
export const renderHome = (slug, spec) => renderSlot(slug, spec, 'home');

// which page layouts have a page to draw on
export async function availableSlots(slug) {
  const pages = await chosenPages(slug);
  return SLOTS.filter((s) => pages[s]);
}

const EDITOR = `<style>[data-sec]{cursor:pointer}.studio-hover{outline:2px dashed #6366f1;outline-offset:-2px}.studio-sel{outline:3px solid #6366f1;outline-offset:-3px}a,button,input,select,textarea{cursor:pointer}</style>
<script>(function(){
  var sel=null;
  function sec(t){return t&&t.closest?t.closest('[data-sec]'):null}
  function clear(c){document.querySelectorAll('.'+c).forEach(function(x){x.classList.remove(c)})}
  function mark(id,scroll){clear('studio-sel');var el=document.querySelector('[data-sec="'+id+'"]');if(el){el.classList.add('studio-sel');sel=el;if(scroll)el.scrollIntoView({behavior:'smooth',block:'center'})}}
  document.addEventListener('mouseover',function(e){var s=sec(e.target);clear('studio-hover');if(s&&s!==sel)s.classList.add('studio-hover')});
  document.addEventListener('click',function(e){var s=sec(e.target);e.preventDefault();e.stopPropagation();if(s){mark(s.getAttribute('data-sec'));parent.postMessage({type:'studio-select',id:s.getAttribute('data-sec')},'*')}},true);
  document.addEventListener('submit',function(e){e.preventDefault()},true);
  window.addEventListener('message',function(e){var d=e.data||{};if(d.type==='studio-mark')mark(d.id,d.scroll)});
  window.addEventListener('load',function(){parent.postMessage({type:'studio-ready'},'*')});
})();</script>`;

// full page HTML for the iframe (editor = true) or for the screenshot browser (absolute URLs, no editor script)
export async function canvasHtml(slug, spec, { origin = '', editor = true, slot = 'home' } = {}) {
  const { html, result, path: pagePath } = await renderSlot(slug, spec, slot);
  const secs = spec.page?.sections || [];
  const extra = [...(spec.tweaks || []), ...secs.flatMap((s) => s.tweaks || [])].flatMap((t) => t.add)
    .concat([...(spec.ops || []), ...secs.flatMap((s) => s.ops || [])].flatMap((o) => classesIn(o.html)), secs.flatMap((s) => classesIn(s.html)), (spec.htmlEdits || []).flatMap((e) => classesIn(e.html)));
  const css = (await composerCss(extra)) + '\n' + specCss(spec, `${origin}/studio-fonts/`);
  let out = html
    .replace(/<link rel="stylesheet" href="[^"]*site\.min\.css">/, () => `<style id="studio-css">${css}</style>`)
    .replace(/<link rel="preload"[^>]*>/g, '')
    .replace(/<script type="module"[^>]*><\/script>/g, '')
    .replace('<meta charset="utf-8">', () => `<meta charset="utf-8"><base href="${origin}/original/${slug}/">`);
  if (editor) out = out.replace('</body>', () => EDITOR + '</body>');
  return { html: out, result, path: pagePath };
}
