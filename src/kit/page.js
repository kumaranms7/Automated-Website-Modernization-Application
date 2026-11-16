import { esc } from '../util/html.js';
import { patternFor } from './designs/shared.js';
import { iconName } from '../template/icons.js';
import { normalizeSpec, DEFAULT_SPEC, specCss } from '../template/spec.js';
import { KIT_ICONS } from './icons.js';
import { designById } from './designs.js';
import { HERO, LIBRARY, pageHero, pageHeroPhoto } from './sections.js';
import { chromeHtml } from './chrome.js';
import { motionDefaults } from './motion.js';
import { nav as defaultNav } from './content.js';
import { T } from './ui.js';
import { applyTones } from './tones.js';

// Draws a page of a kit design: header, the sections of the design's blueprint filled from the content, footer. Used for the placeholder
// previews (what the user approves) and, with the website's real content, for the pages that are built. The page carries no stylesheet of
// its own: the previews get the compiled Tailwind of the kit (css.js) and a build compiles the pages it wrote.

// the menu and the header's shadow: two data attributes, so the markup stays Tailwind-only
export const KIT_SCRIPT = `(function(){var d=document;var dw=d.querySelector('[data-k-drawer]'),dwb=null;function menu(on){if(!dw)return;dw.toggleAttribute('data-open',on);d.body.style.overflow=on?'hidden':'';d.querySelectorAll('[data-k-menu]').forEach(function(x){x.setAttribute('aria-expanded',on)});if(on){var c=dw.querySelector('[data-k-menu]');if(c)c.focus()}else if(dwb){dwb.focus()}}d.querySelectorAll('[data-k-menu]').forEach(function(b){b.addEventListener('click',function(){var on=!(dw&&dw.hasAttribute('data-open'));if(on)dwb=b;menu(on)})});if(dw){dw.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a)menu(false)});d.addEventListener('keydown',function(e){if(e.key==='Escape'&&dw.hasAttribute('data-open'))menu(false)})}var h=d.querySelector('[data-k-header]');if(h){var f=function(){h.toggleAttribute('data-scrolled',window.scrollY>12)};f();addEventListener('scroll',f,{passive:true});var hb=h.querySelector('[data-p="bar"]');if(hb&&hb.querySelector('[data-k-wide]')){var fit=function(){h.removeAttribute('data-k-compact');if(hb.scrollWidth>hb.clientWidth+1)h.setAttribute('data-k-compact','')};fit();addEventListener('resize',fit);addEventListener('load',fit)}}var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;var io=null;function arm(){var list=d.querySelectorAll('.k-a');if(!list.length)return;if(rm||!('IntersectionObserver' in window)){list.forEach(function(e){e.classList.add('k-in')});return}if(!io)io=new IntersectionObserver(function(es){es.forEach(function(x){var e=x.target;if(x.intersectionRatio>=.12||x.isIntersecting&&x.boundingClientRect.height>innerHeight*.7){e.classList.add('k-in');if(!e.hasAttribute('data-k-replay'))io.unobserve(e)}else if(!x.isIntersecting&&e.hasAttribute('data-k-replay')){e.classList.remove('k-in')}})},{threshold:[0,.12]});list.forEach(function(e){io.observe(e)})}arm();window.kitReplay=function(){d.querySelectorAll('.k-a').forEach(function(e){e.classList.remove('k-in');void e.offsetWidth});arm()};
/* the motion toolkit: reveal lines, count-up numbers, quote sliders, background video and one switch that pauses everything that moves */
var R=document.documentElement;
function seen(list,fn){if(!list.length)return;if(rm||!('IntersectionObserver' in window)){list.forEach(function(e){fn(e,true)});return}var o=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting&&(x.intersectionRatio>=.15||x.boundingClientRect.height>innerHeight*.5)){fn(x.target,false);o.unobserve(x.target)}})},{threshold:[0,.15,.35],rootMargin:'0px 0px -6% 0px'});list.forEach(function(e){o.observe(e)})}
var mo=d.body.getAttribute('data-k-motion')||'full';if(mo==='off')rm=true;
if(!rm&&d.querySelector('.k-spot'))d.addEventListener('pointermove',function(e){var c=e.target.closest&&e.target.closest('.k-spot');if(!c)return;var r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')},{passive:true});
if(mo==='full')d.querySelectorAll('[data-k-words]').forEach(function(h){if(h.getAttribute('data-kw')||h.querySelector('a,br,img,svg,b,strong,em,i,u'))return;h.setAttribute('data-kw','1');var n=0,nodes=[].slice.call(h.childNodes);h.setAttribute('aria-label',h.textContent.replace(/\\s+/g,' ').trim());h.textContent='';function put(text,cls){text.split(/(\\s+)/).forEach(function(w){if(!w)return;if(/^\\s+$/.test(w)){h.appendChild(d.createTextNode(' '));return}var o=d.createElement('span');o.className='k-wd';o.setAttribute('aria-hidden','true');var i=d.createElement('span');i.style.setProperty('--i',n++);if(cls)i.className=cls;i.textContent=w;o.appendChild(i);h.appendChild(o)})}nodes.forEach(function(x){if(x.nodeType===3)put(x.textContent,'');else if(x.nodeType===1)put(x.textContent,x.className)})});
function watch(list,fn){if(!list.length)return;if(rm){list.forEach(function(e){fn(e,true)});return}var pend=[].slice.call(list),tick=false;function run(){tick=false;var H=innerHeight,hit=[];pend=pend.filter(function(e){return !e.classList.contains('k-r-in')});for(var i=0;i<pend.length;i++){var r=pend[i].getBoundingClientRect();if(!(r.width||r.height))continue;if(r.bottom<=0){hit.push(pend[i]);continue}if(r.top<H){var vis=Math.min(r.bottom,H*.96)-Math.max(r.top,0);if(vis>=Math.min(r.height*.12,H*.1))hit.push(pend[i])}}if(hit.length){pend=pend.filter(function(e){return hit.indexOf(e)<0});hit.forEach(function(e){fn(e,false)})}if(!pend.length){removeEventListener('scroll',req);removeEventListener('resize',req)}}function req(){if(!tick){tick=true;requestAnimationFrame(run)}}addEventListener('scroll',req,{passive:true});addEventListener('resize',req);addEventListener('load',req);run()}
if(!rm&&'IntersectionObserver' in window){var ahead=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.querySelectorAll('img[loading="lazy"]').forEach(function(i){i.loading='eager'});ahead.unobserve(x.target)}})},{rootMargin:'120% 0px 120% 0px'});var secs=[];d.querySelectorAll('[data-k-reveal],[data-k-img]').forEach(function(e){var s=e.closest('section,footer')||e.parentNode;if(s&&secs.indexOf(s)<0){secs.push(s);ahead.observe(s)}})}
function shown(e){if(e.hasAttribute('data-k-img')){var up=e.parentElement&&e.parentElement.closest('[data-k-reveal]');if(up&&!up.classList.contains('k-r-in'))shown(up)}e.classList.add('k-r-in');if(e.hasAttribute('data-k-reveal')||e.hasAttribute('data-k-img')){setTimeout(function(){e.removeAttribute('data-k-reveal');e.removeAttribute('data-k-img');e.style.transitionDelay=''},(parseFloat(e.style.transitionDelay)||0)+1900)}}
watch(d.querySelectorAll('[data-k-line],[data-k-reveal],[data-k-words],[data-k-img]'),function(e,now){var im=!now&&e.hasAttribute('data-k-img')&&e.querySelector('img');if(im&&!im.complete){var done=false,go=function(){if(!done){done=true;shown(e)}};im.addEventListener('load',go);im.addEventListener('error',go);setTimeout(go,1200)}else shown(e)});
seen(d.querySelectorAll('[data-count]'),function(e,now){var t=e.getAttribute('data-count')||e.textContent,m=/^(\\D*)([\\d][\\d,.]*)(.*)$/.exec(t);if(!m){return}var end=parseFloat(m[2].replace(/,/g,'')),dec=(m[2].split('.')[1]||'').length,comma=/,/.test(m[2]);function fmt(v){var x=v.toFixed(dec);if(comma){var p=x.split('.');p[0]=p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g,',');x=p.join('.')}return m[1]+x+m[3]}if(now||R.classList.contains('k-paused')){e.textContent=fmt(end);return}var t0=null;function step(ts){if(t0===null)t0=ts;var k=Math.min(1,(ts-t0)/1400),v=end*(1-Math.pow(1-k,3));e.textContent=fmt(v);if(k<1)requestAnimationFrame(step)}e.textContent=fmt(0);requestAnimationFrame(step)});
d.querySelectorAll('[data-slider]').forEach(function(sl){var slides=[].slice.call(sl.querySelectorAll('[data-slide]')),cnt=sl.querySelector('[data-slider-count]'),i=0,timer=null,hover=false;if(slides.length<2)return;function pad(n){return(n<10?'0':'')+n}function show(n){i=(n+slides.length)%slides.length;slides.forEach(function(s,k){s.hidden=k!==i});if(cnt)cnt.textContent=pad(i+1)+' / '+pad(slides.length)}function auto(){clearInterval(timer);if(rm||sl.hasAttribute('data-manual'))return;timer=setInterval(function(){if(!hover&&!R.classList.contains('k-paused')&&!d.hidden)show(i+1)},6500)}var pv=sl.querySelector('[data-slider-prev]'),nx=sl.querySelector('[data-slider-next]');if(pv)pv.addEventListener('click',function(){show(i-1);auto()});if(nx)nx.addEventListener('click',function(){show(i+1);auto()});sl.addEventListener('mouseenter',function(){hover=true});sl.addEventListener('mouseleave',function(){hover=false});show(0);auto()});
var sc=[].slice.call(d.querySelectorAll('[data-k-parallax]')),vl=[].slice.call(d.querySelectorAll('[data-k-vline]')),tp=d.querySelector('[data-k-top]'),pg=d.querySelector('[data-k-progress]');
function onScroll(){var y=window.scrollY,vh=innerHeight,H=d.documentElement.scrollHeight-vh;if(pg)pg.style.transform='scaleX('+(H>0?Math.min(1,y/H):0).toFixed(4)+')';if(tp)tp.toggleAttribute('data-show',y>700);if(!rm&&mo==='full'&&!R.classList.contains('k-paused'))sc.forEach(function(e){var r=e.parentNode.getBoundingClientRect(),f=parseFloat(e.getAttribute('data-k-parallax'))||.12;if(r.bottom<-200||r.top>vh+200)return;e.style.transform='translate3d(0,'+((r.top+r.height/2-vh/2)*-f).toFixed(1)+'px,0) scale(1.14)'});vl.forEach(function(e){var r=e.getBoundingClientRect(),p=Math.max(0,Math.min(1,(vh*.65-r.top)/r.height)),i=e.firstElementChild;if(i)i.style.transform='scaleY('+p.toFixed(3)+')'})}
if(sc.length||vl.length||tp||pg){onScroll();var tick=false;addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){tick=false;onScroll()})},{passive:true})}
if(tp)tp.addEventListener('click',function(){window.scrollTo({top:0,behavior:rm?'auto':'smooth'})});
d.querySelectorAll('[data-scroller]').forEach(function(s){var tr=s.querySelector('[data-scroll-track]');if(!tr)return;function go(k){tr.scrollBy({left:k*tr.clientWidth*.8,behavior:rm?'auto':'smooth'})}var a=s.querySelector('[data-scroll-prev]'),b=s.querySelector('[data-scroll-next]');if(a)a.addEventListener('click',function(){go(-1)});if(b)b.addEventListener('click',function(){go(1)});function fit(){var more=tr.scrollWidth>tr.clientWidth+2;[a,b].forEach(function(x){if(x)x.style.display=more?'':'none'})}fit();addEventListener('resize',fit)});
function vids(on){d.querySelectorAll('video[data-k-video]').forEach(function(v){if(on){var p=v.play();if(p&&p.catch)p.catch(function(){})}else v.pause()});d.querySelectorAll('[data-k-vpause]').forEach(function(b){b.setAttribute('aria-pressed',on?'false':'true');b.setAttribute('aria-label',on?'Pause the background video':'Play the background video');b.toggleAttribute('data-paused',!on)})}
if(rm)d.querySelectorAll('video[data-k-video]').forEach(function(v){v.removeAttribute('autoplay');v.pause()});
d.querySelectorAll('[data-k-vpause]').forEach(function(b){b.addEventListener('click',function(){var v=d.querySelector('video[data-k-video]');vids(v?v.paused:true)})});
d.querySelectorAll('[data-k-pause]').forEach(function(b){b.addEventListener('click',function(){var on=!R.classList.contains('k-paused');R.classList.toggle('k-paused',on);d.querySelectorAll('[data-k-pause]').forEach(function(x){x.setAttribute('aria-pressed',on?'true':'false');x.textContent=on?'Play animations':'Pause animations'});vids(!on)})});
})();`;

// the theme and fonts of a design as the page's CSS (variables of the website's theme, @font-face of the design's fonts)
export function designCss(design, active, fontsBase = '/assets/fonts/') {
  const base = active?.tokens || DEFAULT_SPEC.tokens;
  const spec = normalizeSpec({ theme: active?.theme ?? null, tokens: { ...base, fontHeading: design.fonts.heading, fontBody: design.fonts.body } }, DEFAULT_SPEC);
  return specCss(spec, fontsBase);
}
export const designVars = (design) => Object.entries(design.vars || {}).map(([k, v]) => `${k}:${v}`).join(';');

export function context({ site, pack, stats, nav, u, img }) {
  const K = { site: { ...site, phones: site.phones || (site.phone?.digits ? [site.phone] : []) }, pack, stats: stats || pack.stats, nav, u: u || ((h) => h), img: img || ((src, alt) => `<img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy" decoding="async">`) };
  K.iconFor = (item, i, group = 'services') => {
    if (item?.icon && KIT_ICONS[item.icon]) return item.icon;
    const w = iconName(`${item?.title || ''} ${item?.text || ''}`);
    if (w && w !== 'check') return w;
    const list = pack[group] || pack.services;
    return list[i % list.length][1];
  };
  return K;
}

// the sections of one page. kind: home | inner | contact. content: { hero, data } (data maps roles to section content)
export function sectionsHtml(design, kind, content, K) {
  const out = [], entries = [], at = [];
  const blueprint = design[kind] || design.home;
  // a looping video chosen for this kind of page needs a hero that draws behind its text: the design's own, else the photographic one
  const videoHero = content.hero?.video ? (design.videoHero && HERO[design.videoHero] ? design.videoHero : 'photo') : '';
  if (kind === 'home') { out.push(HERO[videoHero || blueprint[0].variant](content.hero, K)); entries.push(blueprint[0]); at.push(0); } else { out.push(design.innerHero && HERO[design.innerHero] ? HERO[design.innerHero](content.hero, K) : content.hero?.video ? pageHeroPhoto(content.hero, K) : pageHero(content.hero, K)); entries.push({}); at.push(-1); }
  blueprint.forEach((b, i) => {
    if (kind === 'home' && i === 0) return;
    const d = content.data[b.type];
    const r = LIBRARY[b.type]?.[b.variant];
    if (!d || !r) return;
    out.push(`<!-- ${b.type}:${b.variant} -->${r(d, K)}`); entries.push(b); at.push(i);
  });
  // alternating colours, and the tone and spacing the user chose; every section knows its place in the blueprint (the editor selects by it)
  return applyTones(out, entries, { tagAll: true, motion: motionDefaults(design.id), tones: design.tones || null }).map((h, n) => (at[n] >= 0 ? h.replace('<section ', `<section data-kit-sec="${at[n]}" `) : h)).join('\n');
}

// the document around a body of sections: head, design variables and fonts, header, footer, the menu script
export function wrapDocument({ design, K, body, title, description = '', active, fontsBase, css = '', head = '', bodyEnd = '', edit = false }) {
  const chrome = chromeHtml(design, K, { edit });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title || `${K.site.name} | ${design.name}`)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<script>document.documentElement.classList.add('k-js')</script>
<style>${designCss(design, active, fontsBase)}</style>
${css ? `<style>${css}</style>` : ''}
${head}
</head>
<body class="k-body" data-k-motion="${design.motion || 'full'}" data-k-anim="${design.anim || 'rise'}" data-k-skin="${design.skin || 'day'}" data-k-pat="${design.pattern || (design.patterned || design.prefix ? patternFor(K.web?.pattern, K.pack, K.site?.name) : 'none')}" style="${designVars(design)}">
<a class="absolute -left-[999px] z-[99] rounded-lg bg-white px-4 py-2.5 focus:top-4 focus:left-4" href="#main">Skip to content</a>
${chrome.topbar}${chrome.header}
<main id="main">
${body}
</main>
${chrome.footer}
${chrome.mobile}
<script>${KIT_SCRIPT}</script>
${bodyEnd}
</body>
</html>
`;
}

export function renderKitPage({ design: designOrId, kind = 'home', content, site, pack, active, title, description = '', nav, u, img, fontsBase, css = '', head = '', bodyEnd = '', edit = false }) {
  const design = typeof designOrId === 'string' ? designById(designOrId) : designOrId;
  const K = context({ site, pack, stats: content.data?.stats?.items?.map((x) => [x.value, x.label]), nav: nav || defaultNav(kind === 'contact' ? 'Contact' : kind === 'home' ? 'Home' : 'Services'), u, img });
  K.web = design.web || {};
  return wrapDocument({ design, K, body: sectionsHtml(design, kind, content, K), title, description, active, fontsBase, css, head, bodyEnd, edit });
}
void T;
