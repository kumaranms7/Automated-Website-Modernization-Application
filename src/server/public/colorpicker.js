// A modern colour picker: a swatch button that opens a popover with a saturation/brightness field, a hue slider, a hex box,
// preset swatches, the browser eyedropper (where it exists) and a contrast badge. Loaded before template.js.
const CP_PRESETS = ['#19858E', '#0F766E', '#2563EB', '#4F46E5', '#7C3AED', '#C026D3', '#E11D48', '#E47229', '#F59E0B', '#16A34A', '#0EA5E9', '#1A2828', '#334155', '#64748B', '#F2F6F6', '#FFFFFF'];
const cpHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

function cpToHsv(hex) {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
}
function cpToHex({ h, s, v }) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function cpLum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const cpRatio = (a, b) => { const x = cpLum(a), y = cpLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

let cpOpen = null; // the picker that is open now
document.addEventListener('pointerdown', (e) => { if (cpOpen && !cpOpen.root.contains(e.target)) cpOpen.close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cpOpen) { cpOpen.close(true); } });

// colorPicker({ id, label, value, onChange }) -> element. A hidden input with the given id holds the value, so a form can read it.
function colorPicker({ id, label, value, onChange }) {
  let hsv = cpToHsv(cpHex(value) ? value : '#000000'), lock = cpHex(value) ? value : null; // lock keeps an exact hex until the colour is moved
  const root = document.createElement('div');
  root.className = 'cp';
  root.innerHTML = `
    <div class="cp-row">
      <button type="button" class="cp-sw" aria-haspopup="dialog" aria-expanded="false"><span class="cp-chip"></span></button>
      <input class="cp-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off">
    </div>
    <input type="hidden">
    <div class="cp-pop" role="dialog" hidden>
      <div class="cp-sv" tabindex="0" role="slider" aria-label="Saturation and brightness"><i class="cp-knob"></i></div>
      <div class="cp-hue" tabindex="0" role="slider" aria-label="Hue" aria-valuemin="0" aria-valuemax="360"><i class="cp-knob"></i></div>
      <div class="cp-tools"><span class="cp-prev"></span><span class="cp-contrast"></span><button type="button" class="cp-eye" title="Pick a colour from the screen" hidden>Eyedropper</button></div>
      <div class="cp-presets"></div>
    </div>`;
  const hidden = root.querySelector('input[type=hidden]'), hexIn = root.querySelector('.cp-hex'), btn = root.querySelector('.cp-sw'), chip = root.querySelector('.cp-chip');
  const pop = root.querySelector('.cp-pop'), sv = root.querySelector('.cp-sv'), hue = root.querySelector('.cp-hue');
  hidden.id = id; btn.setAttribute('aria-label', `${label}: choose colour`); hexIn.setAttribute('aria-label', `${label} hex value`);

  const current = () => lock || cpToHex(hsv);
  const paint = (fromText) => {
    const hx = current();
    hidden.value = hx; chip.style.background = hx; root.style.setProperty('--cp', hx);
    if (!fromText) hexIn.value = hx;
    sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hsv.h} 100% 50%))`;
    sv.firstElementChild.style.left = hsv.s * 100 + '%'; sv.firstElementChild.style.top = (1 - hsv.v) * 100 + '%';
    hue.firstElementChild.style.left = (hsv.h / 360) * 100 + '%';
    sv.setAttribute('aria-valuetext', hx); hue.setAttribute('aria-valuenow', Math.round(hsv.h));
    root.querySelector('.cp-prev').style.background = hx;
    const onWhite = cpRatio(hx, '#FFFFFF'), onDark = cpRatio(hx, '#111827');
    root.querySelector('.cp-contrast').innerHTML = `<b>${onWhite.toFixed(1)}</b> on white ${onWhite >= 4.5 ? '✓' : '✕'} · <b>${onDark.toFixed(1)}</b> on dark ${onDark >= 4.5 ? '✓' : '✕'}`;
  };
  const set = (hx, { silent = false } = {}) => { hsv = cpToHsv(hx); lock = hx; paint(); if (!silent && onChange) onChange(current()); };

  // dragging on the field and the hue slider
  const drag = (el, fn) => {
    const move = (e) => { lock = null; const r = el.getBoundingClientRect(); fn(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))); paint(); if (onChange) onChange(current()); };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.focus(); move(e); el.onpointermove = move; });
    el.addEventListener('pointerup', () => { el.onpointermove = null; });
  };
  drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
  drag(hue, (x) => { hsv.h = x * 360; });
  sv.addEventListener('keydown', (e) => {
    const st = e.shiftKey ? 0.1 : 0.02, k = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
    if (!k) return; e.preventDefault(); lock = null; hsv.s = Math.min(1, Math.max(0, hsv.s + k[0])); hsv.v = Math.min(1, Math.max(0, hsv.v + k[1])); paint(); if (onChange) onChange(current());
  });
  hue.addEventListener('keydown', (e) => {
    const st = e.shiftKey ? 20 : 4, d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -st : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? st : 0;
    if (!d) return; e.preventDefault(); lock = null; hsv.h = (hsv.h + d + 360) % 360; paint(); if (onChange) onChange(current());
  });

  // hex box
  hexIn.addEventListener('input', () => {
    let v = hexIn.value.trim(); if (v && v[0] !== '#') v = '#' + v;
    hexIn.classList.toggle('bad', !cpHex(v));
    if (cpHex(v)) { hsv = cpToHsv(v); lock = v; paint(true); if (onChange) onChange(current()); }
  });
  hexIn.addEventListener('blur', () => { hexIn.classList.remove('bad'); hexIn.value = current(); });

  // presets
  const presets = root.querySelector('.cp-presets');
  CP_PRESETS.forEach((c) => {
    const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.title = c; b.setAttribute('aria-label', c);
    b.onclick = () => set(c);
    presets.append(b);
  });

  // eyedropper
  if ('EyeDropper' in window) {
    const eye = root.querySelector('.cp-eye'); eye.hidden = false;
    eye.onclick = async () => { try { const r = await new EyeDropper().open(); set(r.sRGBHex.toUpperCase()); } catch { /* cancelled */ } };
  }

  const api = {
    root,
    open() { if (cpOpen && cpOpen !== api) cpOpen.close(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); cpOpen = api; const r = root.getBoundingClientRect(); root.classList.toggle('up', innerHeight - r.bottom < 330); root.classList.toggle('left', innerWidth - r.left < 280); },
    close(refocus) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (cpOpen === api) cpOpen = null; if (refocus) btn.focus(); },
    set, get value() { return current(); },
  };
  btn.onclick = () => (pop.hidden ? api.open() : api.close());
  paint();
  return api;
}
