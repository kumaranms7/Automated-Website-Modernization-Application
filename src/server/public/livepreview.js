// Live previews for the Template design Configuration tab: a small wireframe or sample beside every input, and one fixed
// preview page that redraws as soon as any input changes. Loaded before template.js; uses colorpicker.js helpers.
const LP_RADIUS = { none: ['0', '0'], sm: ['.375rem', '.3rem'], md: ['.75rem', '.5rem'], lg: ['1rem', '.65rem'], xl: ['1.5rem', '999px'] };
const LP_SHADOW = { none: 'none', soft: '0 1px 2px rgb(15 23 42 / .06), 0 4px 14px rgb(15 23 42 / .1)', medium: '0 4px 6px rgb(15 23 42 / .08), 0 14px 32px rgb(15 23 42 / .2)' };
const LP_DENSITY = { compact: 6, comfortable: 11, spacious: 17 };
const LP_WIDTH = { narrow: 74, normal: 86, wide: 98 };
const lpStack = (f, fonts) => `"${f}", ${(fonts || []).find((x) => x.name === f)?.kind === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif'}`;

// ---- wireframe thumbnails (they use the live colours through CSS variables) ----
const lpR = (x, y, w, h, c = 'ink', o = 0.25, rx = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="var(--w-${c})" opacity="${o}"/>`;
const lpLines = (x, y, w, n, c = 'ink', o = 0.3) => Array.from({ length: n }, (_, i) => lpR(x, y + i * 4, i === n - 1 ? w * 0.7 : w, 2, c, o)).join('');
const LP_BAR = {
  classic: `${lpR(0, 0, 96, 9, 'soft', 1, 0)}${lpR(4, 3, 14, 3, 'p', 1)}${lpR(46, 3.5, 8, 2)}${lpR(58, 3.5, 8, 2)}${lpR(70, 3.5, 8, 2)}${lpR(82, 2, 11, 5, 'a', 1, 2)}`,
  centered: `${lpR(0, 0, 96, 13, 'soft', 1, 0)}${lpR(37, 2, 22, 3, 'p', 1)}${lpR(24, 8, 9, 2)}${lpR(37, 8, 9, 2)}${lpR(50, 8, 9, 2)}${lpR(63, 8, 9, 2)}`,
  minimal: `${lpR(0, 0, 96, 9, 'soft', 1, 0)}${lpR(4, 3, 14, 3, 'p', 1)}${lpR(80, 2.5, 12, 1.4)}${lpR(80, 4.3, 12, 1.4)}${lpR(80, 6.1, 12, 1.4)}`,
};
const LP_HERO = {
  gradient: `${lpR(0, 0, 96, 30, 'p', 1, 0)}${lpR(0, 15, 96, 15, 'pd', 0.55, 0)}${lpR(8, 7, 40, 3, 'white', 0.95)}${lpR(8, 13, 30, 2, 'white', 0.6)}${lpR(8, 19, 14, 5, 'a', 1, 2)}`,
  split: `${lpR(0, 0, 96, 30, 'soft', 1, 0)}${lpR(6, 7, 36, 3, 'p', 1)}${lpLines(6, 13, 34, 2)}${lpR(6, 22, 12, 4, 'a', 1, 2)}${lpR(54, 3, 38, 24, 'p', 0.55, 3)}`,
  centered: `${lpR(0, 0, 96, 30, 'soft', 1, 0)}${lpR(24, 6, 48, 3, 'p', 1)}${lpR(30, 12, 36, 2)}${lpR(36, 22, 24, 5, 'a', 1, 2)}`,
  light: `${lpR(0, 0, 96, 30, 'white', 1, 0)}${lpR(6, 7, 44, 3, 'ink', 0.8)}${lpLines(6, 13, 40, 2)}${lpR(6, 22, 14, 4, 'p', 1, 2)}`,
  photo: `${lpR(0, 0, 96, 30, 'pd', 1, 0)}<circle cx="72" cy="9" r="4" fill="var(--w-white)" opacity=".35"/><path d="M40 30l18-14 14 9 12-7 12 12z" fill="var(--w-white)" opacity=".22"/>${lpR(8, 8, 40, 3, 'white', 0.95)}${lpR(8, 14, 28, 2, 'white', 0.6)}${lpR(8, 21, 14, 4, 'a', 1, 2)}`,
  dark: `${lpR(0, 0, 96, 30, 'ink', 0.92, 0)}${lpR(8, 8, 42, 3, 'white', 0.95)}${lpR(8, 14, 30, 2, 'white', 0.5)}${lpR(8, 21, 14, 4, 'a', 1, 2)}`,
  editorial: `${lpR(0, 0, 96, 30, 'soft', 1, 0)}${lpR(6, 6, 6, 1.6, 'a', 1)}${lpR(6, 10, 46, 5, 'ink', 0.85)}${lpR(6, 17, 34, 5, 'ink', 0.85)}${lpLines(60, 8, 30, 4)}`,
};
const LP_CARDS = {
  shadow: [0, 1, 2].map((i) => `<rect x="${6 + i * 30}" y="8" width="26" height="30" rx="3" fill="#fff" style="filter:drop-shadow(0 2px 2px rgb(15 23 42 / .22))"/>${lpR(9 + i * 30, 12, 8, 8, 'p', 0.9, 4)}${lpLines(9 + i * 30, 24, 20, 2)}`).join(''),
  outline: [0, 1, 2].map((i) => `<rect x="${6 + i * 30}" y="8" width="26" height="30" rx="3" fill="#fff" stroke="var(--w-p)" stroke-width="1.6"/>${lpR(9 + i * 30, 12, 8, 8, 'p', 0.9, 4)}${lpLines(9 + i * 30, 24, 20, 2)}`).join(''),
  flat: [0, 1, 2].map((i) => `${lpR(6 + i * 30, 8, 26, 30, 'soft', 1, 3)}${lpR(9 + i * 30, 12, 8, 8, 'p', 0.9, 4)}${lpLines(9 + i * 30, 24, 20, 2)}`).join(''),
};
const LP_FOOT = {
  dark: `${lpR(0, 6, 96, 24, 'ink', 0.92, 0)}${lpLines(6, 12, 24, 3, 'white', 0.5)}${lpLines(40, 12, 20, 3, 'white', 0.35)}${lpLines(68, 12, 20, 3, 'white', 0.35)}`,
  brand: `${lpR(0, 6, 96, 24, 'pd', 1, 0)}${lpLines(6, 12, 24, 3, 'white', 0.6)}${lpLines(40, 12, 20, 3, 'white', 0.4)}${lpLines(68, 12, 20, 3, 'white', 0.4)}`,
  light: `${lpR(0, 6, 96, 24, 'soft', 1, 0)}<rect x="0" y="6" width="96" height="1" fill="var(--w-ink)" opacity=".2"/>${lpLines(6, 12, 24, 3, 'ink', 0.4)}${lpLines(40, 12, 20, 3, 'ink', 0.3)}${lpLines(68, 12, 20, 3, 'ink', 0.3)}`,
};
const LP_WIRE = {
  header: (v) => LP_BAR[v] + lpR(8, 20, 80, 3, 'ink', 0.1) + lpR(8, 27, 60, 3, 'ink', 0.1),
  hero: (v) => lpR(0, 0, 96, 5, 'soft', 1, 0) + `<g transform="translate(0 6)">${LP_HERO[v] || ''}</g>`,
  cards: (v) => LP_CARDS[v] || '',
  footer: (v) => lpR(8, 2, 80, 3, 'ink', 0.1) + (LP_FOOT[v] || ''),
  sectionHead: (v) => ({
    left: lpR(8, 10, 36, 4, 'ink', 0.8) + lpR(8, 18, 70, 2) + lpR(8, 23, 54, 2),
    center: lpR(24, 10, 48, 4, 'ink', 0.8) + lpR(14, 18, 68, 2) + lpR(24, 23, 48, 2),
    bar: lpR(8, 8, 3, 18, 'a', 1) + lpR(15, 10, 36, 4, 'ink', 0.8) + lpR(15, 18, 66, 2) + lpR(15, 23, 50, 2),
  }[v] || ''),
  sections: (v) => (v === 'alternating' ? lpR(0, 0, 96, 12, 'white', 1, 0) + lpR(0, 12, 96, 14, 'soft', 1, 0) + lpR(0, 26, 96, 12, 'white', 1, 0) : lpR(0, 0, 96, 38, 'white', 1, 0)) + lpR(8, 4, 30, 3, 'ink', 0.6) + lpR(8, 17, 30, 3, 'ink', 0.6) + lpR(8, 30, 30, 3, 'ink', 0.6) + '<rect x="0" y="0" width="96" height="38" fill="none" stroke="var(--w-ink)" opacity=".15"/>',
  contactLayout: (v) => (v === 'split' ? lpR(6, 6, 40, 26, 'soft', 1, 2) + lpLines(10, 11, 32, 4) + lpR(52, 6, 38, 26, 'p', 0.25, 2) + lpR(56, 11, 30, 4, 'white', 0.9) + lpR(56, 18, 30, 4, 'white', 0.9) + lpR(56, 25, 12, 4, 'a', 1, 2) : lpR(10, 4, 76, 10, 'soft', 1, 2) + lpLines(14, 7, 60, 2) + lpR(10, 17, 76, 16, 'p', 0.25, 2) + lpR(14, 20, 68, 4, 'white', 0.9) + lpR(14, 27, 14, 4, 'a', 1, 2)),
  innerForm: (v) => (v === 'side' ? lpR(6, 5, 54, 30, 'soft', 1, 2) + lpLines(10, 10, 46, 5) + lpR(66, 5, 24, 30, 'p', 0.25, 2) + lpR(69, 10, 18, 4, 'white', 0.9) + lpR(69, 17, 18, 4, 'white', 0.9) + lpR(69, 25, 10, 4, 'a', 1, 2) : lpR(8, 3, 80, 16, 'soft', 1, 2) + lpLines(12, 7, 70, 3) + lpR(8, 22, 80, 14, 'p', 0.25, 2) + lpR(12, 25, 50, 4, 'white', 0.9) + lpR(12, 31, 12, 3, 'a', 1, 2)),
  homeStyle: (v) => (v === 'showcase' ? [0, 1, 2, 3].map((i) => lpR(6 + (i % 2) * 44, 4 + Math.floor(i / 2) * 18, 40, 14, i % 3 === 0 ? 'p' : 'soft', i % 3 === 0 ? 0.8 : 1, 2)).join('') : lpR(6, 4, 38, 14, 'p', 0.5, 2) + lpLines(50, 5, 40, 3) + lpLines(6, 24, 40, 3) + lpR(52, 22, 38, 14, 'p', 0.5, 2)),
};
function lpWire(kind, value) {
  const fn = LP_WIRE[kind];
  return fn ? `<svg viewBox="0 0 96 38" role="img" aria-label="${kind} ${value}" class="lp-wire">${fn(value)}</svg>` : '';
}

// ---- small samples next to the token inputs ----
function lpSample(kind) {
  const s = document.createElement('span');
  s.className = 'smp smp-' + kind; s.dataset.smp = kind;
  return s;
}

// ---- read the form as it is right now ----
function lpRead() {
  const v = (id) => document.getElementById(id)?.value;
  const t = {};
  COLORS.forEach(([k]) => (t[k] = v('tc_' + k) || '#888888'));
  t.fontHeading = v('tf_heading'); t.fontBody = v('tf_body');
  SECTIONS.tokens.forEach((k) => (t[k] = v('to_' + k)));
  const l = {};
  SECTIONS.layout.forEach((k) => (l[k] = v('to_' + k)));
  l.topbar = document.getElementById('to_topbar')?.checked;
  return { t, l };
}

function lpOn(hex, light = '#ffffff', dark = '#111827') { return cpRatio(hex, dark) >= cpRatio(hex, light) ? dark : light; }

// push the current values into every sample and the fixed preview
function lpSync() {
  const box = document.getElementById('td-view-config');
  if (!box || !document.getElementById('tc_primary')) return;
  const { t, l } = lpRead();
  const fonts = tp.state?.fonts || [];
  // colours for the wireframes and the preview
  const wrap = box.querySelector('.cfg-wrap');
  const css = { '--w-p': t.primary, '--w-pd': t.primaryDark, '--w-a': t.accent, '--w-ink': t.ink, '--w-soft': t.soft, '--w-white': '#fff' };
  Object.entries(css).forEach(([k, val]) => wrap.style.setProperty(k, val));

  // per-input samples
  const [rc, rb] = LP_RADIUS[t.radius] || LP_RADIUS.md;
  box.querySelectorAll('[data-smp]').forEach((s) => {
    const k = s.dataset.smp;
    if (k === 'fontHeading') { s.style.fontFamily = lpStack(t.fontHeading, fonts); s.style.fontWeight = t.headingWeight; s.style.textTransform = t.headingCase === 'none' ? 'none' : t.headingCase === 'uppercase' ? 'uppercase' : 'capitalize'; s.textContent = 'Fast, friendly service'; }
    if (k === 'fontBody') { s.style.fontFamily = lpStack(t.fontBody, fonts); s.textContent = 'The quick brown fox jumps over the lazy dog. 0123456789'; }
    if (k === 'radius') { s.style.borderRadius = rc; s.style.background = t.primary; }
    if (k === 'shadow') s.firstElementChild.style.boxShadow = LP_SHADOW[t.shadow];
    if (k === 'density') { s.style.gap = LP_DENSITY[t.density] / 2 + 'px'; }
    if (k === 'headingCase') { s.style.fontFamily = lpStack(t.fontHeading, fonts); s.style.textTransform = t.headingCase === 'none' ? 'none' : t.headingCase === 'uppercase' ? 'uppercase' : 'capitalize'; s.textContent = 'our services'; }
    if (k === 'headingWeight') { s.style.fontFamily = lpStack(t.fontHeading, fonts); s.style.fontWeight = t.headingWeight; s.textContent = 'Weight ' + t.headingWeight; }
    if (k === 'container') s.firstElementChild.style.width = LP_WIDTH[t.container] + '%';
    if (k === 'wire') s.innerHTML = lpWire(s.dataset.kind, document.getElementById('to_' + s.dataset.kind)?.value);
  });

  // the fixed preview page
  const p = document.getElementById('lp');
  if (!p) return;
  const set = (k, val) => p.style.setProperty(k, val);
  set('--p', t.primary); set('--pd', t.primaryDark); set('--a', t.accent); set('--ink', t.ink); set('--soft', t.soft);
  set('--on-a', lpOn(t.accent)); set('--on-p', lpOn(t.primary)); set('--on-pd', lpOn(t.primaryDark));
  set('--fh', lpStack(t.fontHeading, fonts)); set('--fb', lpStack(t.fontBody, fonts));
  set('--rc', rc); set('--rb', rb); set('--sh', LP_SHADOW[t.shadow]); set('--sy', LP_DENSITY[t.density] + 'px'); set('--cw', LP_WIDTH[t.container] + '%');
  set('--hc', t.headingCase === 'none' ? 'none' : t.headingCase === 'uppercase' ? 'uppercase' : 'capitalize'); set('--hw', t.headingWeight);
  p.dataset.header = l.header; p.dataset.hero = l.hero; p.dataset.cards = l.cards; p.dataset.footer = l.footer; p.dataset.sections = l.sections; p.dataset.head = l.sectionHead || 'left';
  p.querySelector('.lp-top').hidden = !l.topbar;
  // the home banner (added below, not necessarily saved yet): the preview's hero shows the picture, as a background or as a normal image
  const bn = tp.banners?.home;
  if (bn?.src) { set('--lp-banner', `url("/original/${slug}/${bn.src}")`); p.dataset.banner = bn.mode === 'image' ? 'img' : 'bg'; } else { p.style.removeProperty('--lp-banner'); delete p.dataset.banner; }
  const bnote = document.getElementById('lp-banner-note');
  if (bnote) bnote.textContent = bn?.src ? `Your home banner is shown ${bn.mode === 'image' ? 'as a normal image beside the heading' : 'behind the heading'}.` : '';
  const name = document.querySelector('#client option:checked')?.textContent?.trim() || 'Your Business';
  p.querySelectorAll('.lp-name').forEach((n) => (n.textContent = name));
  const ratio = cpRatio(t.ink, t.soft);
  const note = document.getElementById('lp-note');
  if (note) note.textContent = ratio < 4.5 ? `Text on the soft background has low contrast (${ratio.toFixed(1)}:1). Aim for at least 4.5:1.` : `Text contrast is good (${ratio.toFixed(1)}:1).`;
  if (note) note.className = 'lp-note ' + (ratio < 4.5 ? 'warn' : 'ok');
}

function lpHtml() {
  return `<div class="lp-frame"><div id="lp" class="lp">
    <div class="lp-top"><span>☎ (555) 010-2030</span><span>Open 24 hours · Free estimates</span></div>
    <div class="lp-head"><b class="lp-logo lp-name">Your Business</b><div class="lp-nav"><a>Home</a><a>Services</a><a>About</a><a>Contact</a></div><span class="lp-btn">Call now</span></div>
    <div class="lp-hero"><div class="lp-hero-in"><small>Trusted locally since 1998</small><h3>Fast, friendly service you can rely on</h3><p>Clear pricing, tidy work and a quick reply, every time.</p><div class="lp-ctas"><span class="lp-btn">Get a quote</span><span class="lp-btn ghost">Our services</span></div></div><div class="lp-hero-img"></div></div>
    <section class="lp-sec"><div class="lp-in"><div class="lp-sh"><h4>What we do</h4><p>Everything you need, handled by one team.</p></div>
      <div class="lp-cards">${['Repairs', 'Installations', 'Inspections'].map((x, i) => `<div class="lp-card"><i>${i + 1}</i><b>${x}</b><p>Short description of this service for your customers.</p></div>`).join('')}</div></div></section>
    <section class="lp-sec alt"><div class="lp-in"><div class="lp-sh"><h4>Why choose us</h4><p>Licensed, insured and local.</p></div>
      <div class="lp-stats"><div><b>25+</b><span>Years</span></div><div><b>4.9</b><span>Rating</span></div><div><b>24/7</b><span>Support</span></div></div></div></section>
    <footer class="lp-foot"><div class="lp-in"><b class="lp-name">Your Business</b><span>123 Main Street · (555) 010-2030</span></div></footer>
  </div></div>
  <div class="lp-legend"><span><i style="background:var(--w-p)"></i>Primary</span><span><i style="background:var(--w-pd)"></i>Dark</span><span><i style="background:var(--w-a)"></i>Accent</span><span><i style="background:var(--w-ink)"></i>Text</span><span><i style="background:var(--w-soft)"></i>Soft</span></div>
  <p id="lp-note" class="lp-note"></p><p id="lp-banner-note" class="lp-banner-note"></p>`;
}
