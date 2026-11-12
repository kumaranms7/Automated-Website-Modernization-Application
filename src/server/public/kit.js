// Template design > Modern designs: the gallery of the design kit. Each design is drawn with placeholder content (the colours of the
// website's theme, the icons and wording of its business type), can be previewed on the home, inner and contact pages, and is chosen
// for the website. Pages are then built from the website's own content in the chosen design. Loaded after template.js.

const KT = { data: null, busy: false };

async function ktLoad(force) {
  if (!slug) return;
  if (!force && KT.data && KT.slug === slug) return;
  KT.data = await api(`/api/clients/${slug}/kit`);
  KT.slug = slug;
}

window.kitOpen = async () => {
  const host = $('td-view-designs');
  if (!host) return;
  host.innerHTML = '';
  host.append(el('small', 'Drawing the designs…', 'hint'));
  try { await ktLoad(true); } catch (e) { host.replaceChildren(el('div', e.message, 'cp-empty')); return; }
  ktRender();
};
window.kitInvalidate = () => { KT.data = null; };

const ktFrameUrl = (id, page) => `/kit/${slug}/${id}/${page}.html${KT.data.selected.pack ? `?pack=${KT.data.selected.pack}` : ''}`;

function ktRender() {
  const d = KT.data, host = $('td-view-designs');
  host.innerHTML = '';
  const sel = d.selected.design;
  const card = el('div', undefined, 'card kt-intro');
  const top = el('div', undefined, 'row between');
  top.append(el('div'), el('a', 'Open the section library', 'btn ghost sm2'));
  top.lastChild.href = `/kit/${slug}/library/${sel || ''}`; top.lastChild.target = '_blank'; top.lastChild.rel = 'noopener';
  const title = el('h2', 'Choose a design'); title.style.margin = '0';
  top.firstChild.append(title, el('small', 'Each design is a complete, modern website template. Pick the one you like: your pages are then built from your own content in that design.', 'hint'));
  // the business type: the icons and the placeholder wording follow it
  const typeRow = el('div', undefined, 'row kt-type');
  typeRow.append(el('span', 'Business type', 'kt-lab'));
  const pk = document.createElement('select'); pk.setAttribute('aria-label', 'Business type');
  pk.add(new Option(`Automatic: ${d.detected.label || d.pack.label} (from the Business Profile)`, ''));
  d.packs.forEach((p) => pk.add(new Option(p.label, p.id)));
  pk.value = d.selected.pack || '';
  pk.onchange = () => busy(pk, async () => { KT.data = await api(`/api/clients/${slug}/kit`, { method: 'PUT', body: { design: sel, pack: pk.value } }); ktRender(); toast('Business type saved. Icons and sample wording follow it.'); });
  typeRow.append(pk, el('small', `Colours come from Design settings. Change them there, then come back to see every design in them.`, 'hint'));
  card.append(top, typeRow);
  host.append(card);

  const grid = el('div', undefined, 'kt-grid');
  d.designs.forEach((dsg) => {
    const c = el('article', undefined, 'kt-card' + (dsg.id === sel ? ' on' : ''));
    const shot = el('div', undefined, 'kt-shot');
    const fr = document.createElement('iframe'); fr.src = ktFrameUrl(dsg.id, 'home'); fr.title = `${dsg.name} home page`; fr.loading = 'lazy'; fr.tabIndex = -1; fr.setAttribute('aria-hidden', 'true');
    shot.append(fr);
    new ResizeObserver(() => shot.style.setProperty('--kt-s', (shot.clientWidth / 1440).toFixed(4))).observe(shot);
    const open = el('button', 'Preview', 'kt-peek'); open.type = 'button'; open.onclick = () => ktPreview(dsg);
    shot.append(open);
    const body = el('div', undefined, 'kt-body');
    const h = el('div', undefined, 'row between'); h.append(el('b', dsg.name), el('span', dsg.badge, 'badge empty'));
    body.append(h, el('p', dsg.blurb, 'hint'), el('small', `${dsg.fonts.heading} + ${dsg.fonts.body} · ${dsg.sections.length} sections`, 'hint'));
    const row = el('div', undefined, 'row');
    const use = el('button', dsg.id === sel ? 'Selected' : 'Use this design', 'btn' + (dsg.id === sel ? ' ghost' : '')); use.type = 'button'; use.disabled = dsg.id === sel;
    use.onclick = () => ktChoose(dsg.id, use);
    const pv = el('button', 'Preview pages', 'btn ghost'); pv.type = 'button'; pv.onclick = () => ktPreview(dsg);
    row.append(use, pv);
    body.append(row);
    c.append(shot, body);
    grid.append(c);
  });
  host.append(grid);
  if (sel) {
    const reset = el('div', undefined, 'row'); reset.style.marginTop = '12px';
    const b = el('button', 'Go back to the classic template', 'btn ghost sm2'); b.type = 'button';
    b.onclick = () => busy(b, async () => { KT.data = await api(`/api/clients/${slug}/kit`, { method: 'PUT', body: { design: '' } }); await loadTemplateTab(); ktRender(); toast('The classic template is used again.'); });
    reset.append(b, el('small', 'The classic template stays available.', 'hint'));
    host.append(reset);
  }
}

async function ktChoose(id, btn) {
  await busy(btn, async () => {
    KT.data = await api(`/api/clients/${slug}/kit`, { method: 'PUT', body: { design: id } });
    await loadTemplateTab();
    if (window.studioInvalidate) window.studioInvalidate();
    ktRender();
    toast(`“${KT.data.designs.find((x) => x.id === id).name}” is now the design of this website. Build the pages to fit it to your content.`);
  });
}

// a full-size preview of one design: home, inner and contact pages, on desktop, tablet and phone. Sections can be customised like the
// sections of a design variant: click one in the page (or in the outline), then change its layout (taken from any design), its background,
// its spacing, move it, remove it, or add another. Every change is saved and the page redraws.
const KT_TYPES = { trust: 'Trust points', services: 'Services', about: 'About / content', features: 'Features', steps: 'Process', stats: 'Statistics', reviews: 'Reviews', faq: 'FAQ', areas: 'Areas', gallery: 'Gallery', compare: 'Before / after', pricing: 'Pricing', tabs: 'Tabs', team: 'Team', blog: 'Blog cards', map: 'Map', cta: 'Call to action', contact: 'Contact' };
const KT_TONES = [['auto', 'Automatic (alternating)'], ['white', 'Page colour'], ['soft', 'Soft'], ['tint', 'Brand tint'], ['dark', 'Dark'], ['brand', 'Brand colour']];
const KT_SPACE = [['', 'Normal'], ['tight', 'Tight'], ['loose', 'Loose']];
const ktOpt = (sel, list, value) => { list.forEach(([v, t]) => sel.add(new Option(t, v))); sel.value = value; return sel; };
// ---- the element editor: the section and every part of it have a design, colours (the theme's or any), size, animation and text settings.
// Shared by the design preview and by Preview & refine. ctx: { b: { type, style, tone, space }, root: () => the element in the page, edit: (patch) => void,
// play: () => void }. Buttons and icons of different designs are parts of their own; the ones that look the same share one set of settings.
const KS = { open: {}, pop: '' };
const KS_ORDER = ['head', 'content', 'paragraph', 'contentHeading', 'contentLink', 'contentBold', 'contentList', 'contentQuote', 'eyebrow', 'heading', 'text', 'item', 'itemTitle', 'icon', 'tick', 'buttonPrimary', 'buttonAccent', 'buttonGhost', 'buttonLight', 'buttonOutline', 'button', 'image', 'bar', 'brand', 'navLink', 'phone', 'footHeading', 'footLink', 'footText', 'footLegal'];
const KS_CHROME = { header: 'This header', topbar: 'The top bar', footer: 'This footer', hero: 'This hero' };
const KS_INSIDE = { paragraph: 'p', contentHeading: 'h1,h2,h3,h4,h5,h6', contentLink: 'a', contentBold: 'strong,b', contentList: 'li', contentQuote: 'blockquote' };
const KS_NAMES = { content: 'Text block', paragraph: 'Paragraphs', contentHeading: 'Headings in the text', contentLink: 'Links in the text', contentBold: 'Bold text', contentList: 'Lists', contentQuote: 'Quotes', bar: 'Header bar', brand: 'Logo and name', navLink: 'Menu links', phone: 'Phone number', footHeading: 'Column headings', footLink: 'Links', footText: 'Text', footLegal: 'Bottom line', section: 'This section', head: 'Heading block', eyebrow: 'Small label', heading: 'Section heading', text: 'Intro text', itemTitle: 'Item headings', icon: 'Icons', tick: 'Check marks', button: 'Buttons', buttonPrimary: 'Main buttons', buttonAccent: 'Accent buttons', buttonGhost: 'Outline buttons', buttonLight: 'White buttons', buttonOutline: 'Glass buttons', image: 'Pictures' };
const KS_MOTION = ['entrance', 'hover', 'loop', 'speed', 'delay', 'easing', 'stagger', 'replay'];
const ksName = (part, type) => (part === 'section' && KS_CHROME[type] ? KS_CHROME[type] : part === 'item' ? ({ areas: 'Pills', trust: 'Chips and tiles', faq: 'Questions', reviews: 'Review cards', pricing: 'Plans' }[type] || 'Cards and items') : KS_NAMES[part]);
const ksGroups = (part) => (part === 'section'
  ? [['Background', (p) => ['preset', 'bg', 'textMode'].includes(p)], ['Size and space', (p) => ['contentWidth', 'padTop', 'padBottom'].includes(p)], ['Animation', () => true]]
  : [['Style', (p) => p === 'preset'], ['Colours', (p) => ['bg', 'color', 'border'].includes(p)], ['Shape', (p) => ['borderWidth', 'radius', 'shadow'].includes(p)], ['Size', (p) => ['width', 'maxWidth', 'position'].includes(p)], ['Animation', (p) => KS_MOTION.includes(p)], ['Text', () => true]]);
const ksSample = (part) => (part === 'item' ? 'Card' : part === 'icon' || part === 'tick' ? '★' : part === 'eyebrow' ? 'LABEL' : part === 'section' ? '' : /^button/.test(part) ? 'Button' : '');
const KS_TONE = { white: 'theme:light', soft: 'theme:soft', tint: 'theme:primary-light', dark: 'theme:dark', brand: 'theme:primary' };
const ksMeta = () => (typeof KT !== 'undefined' && KT.data && KT.data.style) || { palette: [], fields: {}, presets: {}, vars: {} };
// the parts the page itself shows in this section
const ksParts = (root) => (root ? KS_ORDER.filter((p) => (KS_INSIDE[p] ? root.querySelector(KS_INSIDE[p].split(',').map((t) => `[data-p="content"] ${t}`).join(',')) : root.querySelector(`[data-p="${p}"]`)) || (p === 'icon' && root.querySelector('[data-p="item"] svg'))) : []);
const ksHex = (v) => { const m = /^theme:(.+)$/.exec(v || ''); return m ? (ksMeta().palette.find((c) => c.key === m[1])?.hex || '#888888') : (v || ''); };
const ksColorName = (v) => { const m = /^theme:(.+)$/.exec(v || ''); return m ? (ksMeta().palette.find((c) => c.key === m[1])?.label || m[1]) : (v ? v.toUpperCase() : 'Design'); };

// a colour: the colours of the theme first, then any colour of your own
function ksColorField(label, cur, set, id) {
  const wrap = el('div', undefined, 'kt-cf');
  const line = el('div', undefined, 'kt-prop'); line.append(el('label', label));
  const sw = el('button', undefined, 'kt-sw'); sw.type = 'button'; sw.title = 'Choose a colour';
  const dot = el('i'); dot.style.background = cur ? ksHex(cur) : 'repeating-conic-gradient(#cbd5e1 0 25%, #fff 0 50%) 50% / 10px 10px';
  sw.append(dot, el('span', ksColorName(cur)));
  const x = el('button', '×', 'kt-x'); x.type = 'button'; x.title = 'Back to the design'; x.disabled = !cur; x.onclick = () => set('');
  line.append(sw, x);
  const pop = el('div', undefined, 'kt-pop'); pop.hidden = KS.pop !== id;
  sw.onclick = () => { KS.pop = KS.pop === id ? '' : id; pop.hidden = KS.pop !== id; };
  pop.append(el('small', 'Theme colours', 'hint'));
  const grid = el('div', undefined, 'kt-pal');
  ksMeta().palette.forEach((c) => {
    const b = el('button', undefined, 'kt-chip' + (cur === `theme:${c.key}` ? ' on' : '')); b.type = 'button'; b.title = c.label;
    b.style.background = c.key === 'transparent' ? 'repeating-conic-gradient(#cbd5e1 0 25%, #fff 0 50%) 50% / 8px 8px' : c.hex;
    b.onclick = () => set(`theme:${c.key}`);
    grid.append(b);
  });
  pop.append(grid, el('small', 'Custom colour', 'hint'));
  const custom = el('div', undefined, 'kt-custom');
  const pick = document.createElement('input'); pick.type = 'color'; pick.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#888888';
  const hex = document.createElement('input'); hex.type = 'text'; hex.placeholder = '#RRGGBB'; hex.maxLength = 9; hex.value = /^#/.test(cur) ? cur : '';
  pick.onchange = () => set(pick.value);
  hex.onchange = () => { const v = hex.value.trim(); if (/^#[0-9a-f]{3,8}$/i.test(v)) set(v); else if (!v) set(''); else toast('Use a colour like #E47229', true); };
  custom.append(pick, hex);
  pop.append(custom);
  wrap.append(line, pop);
  return wrap;
}

// a small picture of each design of a part, drawn in the website's own colours
function ksPresetGallery(part, cur, set) {
  const gal = el('div', undefined, 'kt-presets');
  gal.style.cssText = Object.entries(ksMeta().vars).map(([k, v]) => `${k}:${v}`).join(';');
  const one = (key, p) => {
    const b = el('button', undefined, 'kt-ps' + ((cur || '') === key ? ' on' : '')); b.type = 'button'; b.title = p ? p.label : 'The design’s own';
    const s = el('span', p ? ksSample(part) : 'Default', 'kt-sample');
    if (p) s.style.cssText = `background-color:${p.bg || 'transparent'};${p.bi ? `background-image:${p.bi};` : ''}color:${p.color || (p.mode === 'light' ? '#fff' : 'var(--th-text-heading)')};border:${p.bw || '1px'} solid ${p.border || 'var(--th-border-default)'};${p.sh ? `box-shadow:${p.sh};` : ''}${part === 'section' ? 'min-height:44px;' : ''}`;
    b.append(s, el('small', p ? p.label : 'Design'));
    b.onclick = () => set(key);
    gal.append(b);
  };
  one('', null);
  Object.entries(ksMeta().presets[part] || {}).forEach(([k, p]) => one(k, p));
  return gal;
}

function ktStyleBox(ctx) {
  const b = ctx.b, edit = ctx.edit;
  const wrap = el('div', undefined, 'kt-style');
  wrap.append(el('b', 'Design'), el('small', 'The section and each part of it. Parts that look the same share their settings; parts that look different have their own. Only this section changes.', 'hint'));
  const root = ctx.root();
  const parts = ['section', ...ksParts(root)];
  const hasBox = Boolean(root?.querySelector('[data-p="icon"], [data-p="tick"]'));
  if (parts.length === 1) wrap.append(el('small', 'The parts of this section appear once the page has loaded. Select it again if they do not.', 'hint'));
  parts.forEach((part) => {
    const det = document.createElement('details'); det.className = 'kt-part'; det.open = KS.open[part] !== undefined ? KS.open[part] : part === 'section' || Boolean(b.style?.[part]);
    det.addEventListener('toggle', () => { KS.open[part] = det.open; });
    const mine = b.style?.[part] || {};
    const sum = el('summary', ksName(part, b.type));
    if (mine.hide === 'yes') sum.append(el('em', 'removed')); else if (Object.keys(mine).length || (part === 'section' && (b.tone || b.space))) sum.append(el('em', 'edited'));
    det.append(sum);
    const write = (patch, clear = []) => {
      const style = { ...(b.style || {}) }; const next = { ...(style[part] || {}) };
      clear.forEach((k) => delete next[k]);
      Object.entries(patch).forEach(([k, v]) => { if (v) next[k] = v; else delete next[k]; });
      if (Object.keys(next).length) style[part] = next; else delete style[part];
      KS.open[part] = true;
      // the section's colour and space replace the older background and spacing choices
      edit({ style: Object.keys(style).length ? style : undefined, ...(part === 'section' ? { tone: undefined, space: undefined } : {}) });
    };
    const fields = (ksMeta().fields[part] || []).filter(([prop]) => !(['icon', 'tick'].includes(part) && !hasBox) || prop === 'color' || prop === 'hide');
    const groups = ksGroups(part);
    groups.forEach(([title, test], gi) => {
      const list = fields.filter(([prop, , kind]) => kind !== 'toggle' && test(prop) && !groups.slice(0, gi).some(([, t]) => t(prop)));
      if (!list.length) return;
      const grp = el('div', undefined, 'kt-grp'); grp.append(el('h5', title));
      if (title === 'Animation' && ctx.play) { const play = el('button', '▶ Play', 'kt-play'); play.type = 'button'; play.title = 'Play the animations of this page again'; play.onclick = ctx.play; grp.querySelector('h5').append(play); }
      list.forEach(([prop, label, kind, options]) => {
        const cur = mine[prop] || (part === 'section' && prop === 'bg' ? KS_TONE[b.tone] || '' : '');
        if (kind === 'preset') grp.append(ksPresetGallery(part, cur, (v) => write({ preset: v }, part === 'section' ? ['bg'] : ['bg', 'color', 'border', 'borderWidth', 'radius', 'shadow'])));
        else if (kind === 'color') grp.append(ksColorField(label, cur, (v) => write({ [prop]: v }), `${part}:${prop}`));
        else if (kind === 'align') {
          const line = el('div', undefined, 'kt-prop'); line.append(el('label', label));
          const seg = el('div', undefined, 'kt-seg');
          [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']].forEach(([v, t]) => { const y = el('button', t, cur === v ? 'on' : ''); y.type = 'button'; y.onclick = () => write({ [prop]: cur === v ? '' : v }); seg.append(y); });
          line.append(seg); grp.append(line);
        } else {
          const line = el('div', undefined, 'kt-prop'); line.append(el('label', label));
          const s = document.createElement('select'); ktOpt(s, [['', 'Design default'], ...options], cur); s.onchange = () => write({ [prop]: s.value });
          line.append(s); grp.append(line);
        }
      });
      det.append(grp);
    });
    const acts = el('div', undefined, 'kt-acts');
    if (fields.some(([prop]) => prop === 'hide')) {
      const gone = mine.hide === 'yes';
      const rm = el('button', gone ? 'Show this element again' : 'Remove this element', 'btn ghost sm2' + (gone ? '' : ' danger')); rm.type = 'button'; rm.title = gone ? 'Bring it back' : 'Take it off this section';
      rm.onclick = () => write({ hide: gone ? '' : 'yes' });
      acts.append(rm);
    }
    if (Object.keys(mine).length) { const rs = el('button', 'Reset', 'btn ghost sm2'); rs.type = 'button'; rs.onclick = () => write({}, Object.keys(mine)); acts.append(rs); }
    if (acts.children.length) det.append(acts);
    wrap.append(det);
  });
  return wrap;
}

function ktPreview(dsg) {
  let dlg = $('kt-dlg');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'kt-dlg'; dlg.className = 'kt-dlg'; document.body.append(dlg); }
  const st = { page: 'home', w: '100%', edit: false, sel: null, nonce: 0 };
  let timer = null;
  const list = () => KT.data.blueprints[st.page] || [];
  const frameUrl = () => `${ktFrameUrl(dsg.id, st.page)}${ktFrameUrl(dsg.id, st.page).includes('?') ? '&' : '?'}${st.edit ? 'edit=1&' : ''}v=${st.nonce}`;
  const reload = () => {
    st.nonce += 1;
    const fr = dlg.querySelector('iframe');
    if (!fr) return;
    let y = 0; try { y = fr.contentWindow.scrollY; } catch { /* not reachable */ }
    fr.onload = () => {
      try {
        const doc = fr.contentDocument;
        const zone = typeof st.sel === 'string';
        const sec = st.sel != null ? doc.querySelector(zone ? `[data-kit-chrome="${st.sel}"]` : `[data-kit-sec="${st.sel}"]`) : null;
        if (sec) { if (zone) fr.contentWindow.scrollTo(0, st.sel === 'footer' ? doc.documentElement.scrollHeight : 0); else sec.scrollIntoView({ block: 'center' }); fr.contentWindow.postMessage(zone ? { kitMarkChrome: st.sel } : { kitMark: st.sel }, '*'); } else fr.contentWindow.scrollTo(0, y);
      } catch { /* not reachable */ }
      refresh(); // the parts of the section are known once the page has loaded
    };
    fr.src = frameUrl();
  };
  // the blueprint is replaced as a whole: the list as it is now, with the change
  const commit = (next) => {
    KT.data.blueprints[st.page] = next; refresh();
    clearTimeout(timer);
    timer = setTimeout(async () => { try { KT.data = await api(`/api/clients/${slug}/kit`, { method: 'PUT', body: { design: dsg.id, sections: { [st.page]: next } } }); reload(); refresh(); } catch (e) { toast(e.message, true); } }, 450);
  };
  const row = (label, node) => { const f = el('div', undefined, 'f'); f.append(el('label', label), node); return f; };
  const sectionDoc = (i) => { try { return dlg.querySelector('iframe')?.contentDocument?.querySelector(typeof i === 'string' ? `[data-kit-chrome="${i}"]` : `[data-kit-sec="${i}"]`); } catch { return null; } };
  const styleBox = (b, edit) => ktStyleBox({ b, edit, root: () => sectionDoc(st.sel), play: () => dlg.querySelector('iframe')?.contentWindow?.postMessage({ kitReplay: true }, '*') });
  // what can be changed for the selected section: it opens right under its row in the list
  const inspector = (b, items) => {
    const box = el('div', undefined, 'kt-insp kt-here');
    const edit = (patch) => { const next = items.map((x, i) => (i === st.sel ? { ...x, ...patch } : x)); commit(next); };
    const lay = document.createElement('select'); ktOpt(lay, (KT.data.variants[b.type] || [b.variant]).map((v) => [v, v.replace(/-/g, ' ')]), b.variant); lay.onchange = () => edit({ variant: lay.value });
    box.append(row('Layout (from any design)', lay));
    if (b.type !== 'hero') {
      const mv = el('div', undefined, 'row');
      const mk = (label, title, fn, dis, cls = 'btn ghost sm2') => { const y = el('button', label, cls); y.type = 'button'; y.title = title; y.disabled = Boolean(dis); y.onclick = fn; return y; };
      mv.append(
        mk('↑ Up', 'Move up', () => { const n = items.slice(); [n[st.sel - 1], n[st.sel]] = [n[st.sel], n[st.sel - 1]]; st.sel -= 1; commit(n); }, st.sel === 0 || items[st.sel - 1]?.type === 'hero'),
        mk('↓ Down', 'Move down', () => { const n = items.slice(); [n[st.sel + 1], n[st.sel]] = [n[st.sel], n[st.sel + 1]]; st.sel += 1; commit(n); }, st.sel === items.length - 1),
        mk('Remove section', 'Take this whole section off the page', () => { const n = items.filter((_, i) => i !== st.sel); st.sel = null; commit(n); }, false, 'btn ghost sm2 danger'),
      );
      box.append(mv);
    }
    box.append(styleBox(b, edit));
    return box;
  };

  const panel = () => {
    const side = el('aside', undefined, 'kt-side');
    const items = list();
    side.append(el('b', `Sections of the ${st.page === 'inner' ? 'inner' : st.page} page`), el('small', 'Click a section in the page, or choose it here. Its options open right below it.', 'hint'));
    const out = el('div', undefined, 'kt-out');
    const zoneRow = (name, label, note) => {
      const x = el('button', undefined, 'kt-o' + (st.sel === name ? ' on' : '')); x.type = 'button';
      x.append(el('b', label), el('small', note + (chromeNow()[name]?.style ? ' · styled' : '')));
      x.onclick = () => { st.sel = st.sel === name ? null : name; refresh(); if (st.sel === name) dlg.querySelector('iframe')?.contentWindow?.postMessage({ kitMarkChrome: name }, '*'); };
      out.append(x);
      if (st.sel === name) out.append(chromeInspector(name));
    };
    out.append(el('small', 'Whole theme (all pages)', 'hint kt-zone'));
    if (KT.data.chrome?.topbar || chromeNow().topbar?.show === 'yes') zoneRow('topbar', 'Top bar', 'Address and hours');
    zoneRow('header', 'Header', (chromeNow().header?.variant || KT.data.chrome?.header || '').replace(/-/g, ' '));
    out.append(el('small', 'Sections of this page', 'hint kt-zone'));
    items.forEach((b, i) => {
      const x = el('button', undefined, 'kt-o' + (i === st.sel ? ' on' : '')); x.type = 'button';
      x.append(el('b', b.type === 'hero' ? 'Hero' : KT_TYPES[b.type] || b.type), el('small', b.variant.replace(/-/g, ' ') + (b.style ? ' · styled' : '')));
      x.onclick = () => { st.sel = st.sel === i ? null : i; refresh(); if (st.sel === i) dlg.querySelector('iframe')?.contentWindow?.postMessage({ kitMark: i }, '*'); };
      out.append(x);
      if (i === st.sel) out.append(inspector(b, items));
    });
    out.append(el('small', 'Whole theme (all pages)', 'hint kt-zone'));
    zoneRow('footer', 'Footer', (chromeNow().footer?.variant || KT.data.chrome?.footer || '').replace(/-/g, ' '));
    side.append(out);
    const add = el('div', undefined, 'kt-insp');
    add.append(el('b', 'Add a section'));
    const t = document.createElement('select'); ktOpt(t, Object.entries(KT_TYPES), 'services');
    const v = document.createElement('select');
    const fill = () => { v.innerHTML = ''; ktOpt(v, (KT.data.variants[t.value] || []).map((x) => [x, x.replace(/-/g, ' ')]), (KT.data.variants[t.value] || [])[0]); }; fill(); t.onchange = fill;
    const plus = el('button', 'Add', 'btn ghost sm2'); plus.type = 'button';
    plus.onclick = () => { const n = items.slice(); const at = n.findIndex((x) => x.type === 'cta'); n.splice(at < 0 ? n.length : at, 0, { type: t.value, variant: v.value }); st.sel = at < 0 ? n.length - 1 : at; commit(n); };
    add.append(row('Section', t), row('Layout', v), plus);
    side.append(add);
    const reset = el('button', 'Reset this page to the design', 'btn ghost sm2'); reset.type = 'button';
    reset.onclick = () => busy(reset, async () => { KT.data = await api(`/api/clients/${slug}/kit`, { method: 'PUT', body: { design: dsg.id, sections: { [st.page]: [] } } }); st.sel = null; reload(); refresh(); });
    side.append(reset);
    return side;
  };
  // the panel is drawn again after a change: it keeps its scroll, and the selected section stays in view
  // the header, top bar and footer are for the whole theme: every page of the design, not one page type
  const chromeNow = () => KT.data.selected.chrome || {};
  let chromeTimer = null;
  const commitChrome = (name, patch) => {
    const next = { ...(chromeNow()[name] || {}) };
    if ('style' in patch) { if (patch.style) next.style = patch.style; else delete next.style; }
    for (const k of ['variant', 'show']) if (k in patch) { if (patch[k]) next[k] = patch[k]; else delete next[k]; }
    KT.data.selected.chrome = { ...chromeNow(), [name]: next };
    refresh();
    clearTimeout(chromeTimer);
    chromeTimer = setTimeout(async () => { try { KT.data = await api(`/api/clients/${slug}/kit`, { method: 'PUT', body: { design: dsg.id, chrome: { [name]: next } } }); reload(); refresh(); } catch (e) { toast(e.message, true); } }, 450);
  };
  const chromeInspector = (name) => {
    const zone = chromeNow()[name] || {};
    const box = el('div', undefined, 'kt-insp kt-here');
    box.append(el('small', 'A change here is made for the whole theme: every page uses it.', 'hint'));
    const info = KT.data.chrome || { variants: {} };
    if (name === 'topbar') {
      const sel = document.createElement('select'); ktOpt(sel, [['yes', 'Show the top bar'], ['no', 'Hide the top bar']], zone.show || (info.topbar ? 'yes' : 'no')); sel.onchange = () => commitChrome(name, { show: sel.value });
      box.append(row('Top bar', sel));
    } else {
      const sel = document.createElement('select'); ktOpt(sel, (info.variants[name] || []).map((v) => [v, v.replace(/-/g, ' ')]), zone.variant || info[name]); sel.onchange = () => commitChrome(name, { variant: sel.value });
      box.append(row('Layout', sel));
    }
    box.append(styleBox({ type: name, style: zone.style || {} }, (patch) => commitChrome(name, patch)));
    return box;
  };
  const refresh = () => {
    const side = dlg.querySelector('.kt-side');
    if (!side) return;
    const top = side.scrollTop;
    const next = panel();
    side.replaceWith(next);
    next.scrollTop = top;
    next.querySelector('.kt-o.on')?.scrollIntoView({ block: 'nearest' });
  };
  dlg.onmessage = null;
  const onMsg = (e) => { if (!e.data || !dlg.open) return; if (typeof e.data.kitSelect === 'number') { st.sel = e.data.kitSelect; refresh(); } else if (typeof e.data.kitChrome === 'string') { st.sel = e.data.kitChrome; refresh(); } };
  window.removeEventListener('message', window.__ktMsg || (() => {})); window.__ktMsg = onMsg; window.addEventListener('message', onMsg);
  const draw = () => {
    dlg.innerHTML = '';
    const bar = el('div', undefined, 'kt-bar');
    bar.append(el('b', dsg.name));
    const pages = el('div', undefined, 'seg');
    [['home', 'Home'], ['inner', 'Inner page'], ['contact', 'Contact']].forEach(([k, tt]) => { const x = el('button', tt); x.type = 'button'; if (st.page === k) x.classList.add('on'); x.onclick = () => { st.page = k; st.sel = null; draw(); }; pages.append(x); });
    const dev = el('div', undefined, 'seg');
    [['100%', 'Desktop'], ['820px', 'Tablet'], ['390px', 'Phone']].forEach(([w, tt]) => { const x = el('button', tt); x.type = 'button'; if (st.w === w) x.classList.add('on'); x.onclick = () => { st.w = w; draw(); }; dev.append(x); });
    const sg = el('a', 'Style guide', 'btn ghost'); sg.href = ktFrameUrl(dsg.id, 'styleguide'); sg.target = '_blank'; sg.rel = 'noopener';
    const ed = el('button', st.edit ? 'Done editing' : 'Customize sections', 'btn ghost'); ed.type = 'button'; ed.onclick = () => { st.edit = !st.edit; st.sel = null; draw(); };
    const use = el('button', KT.data.selected.design === dsg.id ? 'Selected' : 'Use this design', 'btn'); use.type = 'button'; use.disabled = KT.data.selected.design === dsg.id;
    use.onclick = async () => { await ktChoose(dsg.id, use); dlg.close(); };
    const x = el('button', 'Close', 'btn ghost'); x.type = 'button'; x.onclick = () => dlg.close();
    bar.append(pages, dev, sg, ed, use, x);
    const body = el('div', undefined, 'kt-body-wrap' + (st.edit ? ' with-side' : ''));
    const stage = el('div', undefined, 'kt-stage');
    const fr = document.createElement('iframe'); fr.src = frameUrl(); fr.title = `${dsg.name} ${st.page}`; fr.style.width = st.w;
    stage.append(fr); body.append(stage);
    if (st.edit && KT.data.selected.design === dsg.id) body.append(panel());
    else if (st.edit) body.append(el('aside', 'Use this design first, then customize its sections.', 'kt-side'));
    dlg.append(bar, body);
  };
  draw();
  dlg.showModal();
}
