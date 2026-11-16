// Animation for sections and parts. Three kinds, which can be combined on one part:
//   entrance: plays once when the part scrolls into view (a small script marks it with .k-in)
//   hover:    a movement or glow while the pointer is over the part
//   loop:     a gentle movement that repeats
// Nothing is hidden without the script (the page gets .k-js from it), and visitors who ask for less motion get none.

const t = (o) => Object.entries(o);
export const ENTRANCE = { fade: 'ka-fade', 'fade-up': 'ka-fade-up', 'fade-down': 'ka-fade-down', 'fade-left': 'ka-fade-left', 'fade-right': 'ka-fade-right', 'zoom-in': 'ka-zoom-in', 'zoom-out': 'ka-zoom-out', 'slide-up': 'ka-slide-up', flip: 'ka-flip', blur: 'ka-blur', rotate: 'ka-rotate' };
export const LOOP = { float: ['ka-float', '3.4s'], pulse: ['ka-pulse', '2.4s'], wiggle: ['ka-wiggle', '2.8s'], bounce: ['ka-bounce', '1.8s'], swing: ['ka-swing', '3.2s'], spin: ['ka-spin', '14s'], glow: ['ka-glow', '2.6s'] };
// written out in full: the stylesheet is built from what is written in the source and in the pages
export const HOVER = {
  lift: 'hover:[transform:translateY(-6px)]! [transition-property:transform,box-shadow,filter]! [transition-duration:.3s]!',
  grow: 'hover:[transform:scale(1.06)]! [transition-property:transform,box-shadow,filter]! [transition-duration:.3s]!',
  shrink: 'hover:[transform:scale(.95)]! [transition-property:transform,box-shadow,filter]! [transition-duration:.3s]!',
  tilt: 'hover:[transform:rotate(-2.5deg)_scale(1.03)]! [transition-property:transform,box-shadow,filter]! [transition-duration:.3s]!',
  glow: 'hover:[box-shadow:0_14px_34px_-8px_color-mix(in_srgb,var(--th-brand-primary)_60%,transparent)]! [transition-property:transform,box-shadow,filter]! [transition-duration:.3s]!',
  brighten: 'hover:[filter:brightness(1.12)_saturate(1.1)]! [transition-property:transform,box-shadow,filter]! [transition-duration:.3s]!',
  'lift-glow': 'hover:[transform:translateY(-6px)]! hover:[box-shadow:0_18px_38px_-10px_color-mix(in_srgb,var(--th-brand-primary)_55%,transparent)]! [transition-property:transform,box-shadow,filter]! [transition-duration:.3s]!',
};
export const SPEED = { fast: '.4s', normal: '.7s', slow: '1.1s', slower: '1.6s' };
export const DELAY = { none: 0, short: 0.15, medium: 0.35, long: 0.6, longer: 1 };
export const EASING = { smooth: 'cubic-bezier(.2,.7,.2,1)', ease: 'ease-in-out', linear: 'linear', spring: 'cubic-bezier(.34,1.56,.64,1)' };
const CLS = {
  entrance: 'k-a [.k-js_&:not(.k-in)]:opacity-0 [&.k-in]:[animation:var(--k-a1,none),var(--k-a2,none)]',
  loop: '[animation:var(--k-a2,none)]',
  calm: 'motion-reduce:[animation:none]!',
};
const label = (k) => k.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const opts = (map, labels = {}) => Object.keys(map).map((k) => [k, labels[k] || label(k)]);
const off = [['off', 'None']];
const ON = [['yes', 'On'], ['no', 'Off']];

// what the panel offers: [property, label, kind, options]
export const MOTION_FIELDS = {
  entrance: ['entrance', 'Entrance', 'select', [...off, ...opts(ENTRANCE, { fade: 'Fade in', 'fade-up': 'Fade up', 'fade-down': 'Fade down', 'fade-left': 'Fade from the right', 'fade-right': 'Fade from the left', 'zoom-in': 'Zoom in', 'zoom-out': 'Zoom out', 'slide-up': 'Slide up', flip: 'Flip', blur: 'Blur in', rotate: 'Rotate in' })]],
  hover: ['hover', 'On hover', 'select', [...off, ...opts(HOVER, { 'lift-glow': 'Lift and glow', grow: 'Grow', shrink: 'Shrink' })]],
  loop: ['loop', 'Always moving', 'select', [...off, ...opts(LOOP, { swing: 'Swing', spin: 'Slow spin' })]],
  speed: ['speed', 'Speed', 'select', opts(SPEED, { fast: 'Fast', normal: 'Normal', slow: 'Slow', slower: 'Very slow' })],
  delay: ['delay', 'Start after', 'select', opts(DELAY, { none: 'No delay', short: '0.15 s', medium: '0.35 s', long: '0.6 s', longer: '1 s' })],
  easing: ['easing', 'Feel', 'select', opts(EASING, { smooth: 'Smooth', ease: 'Ease in and out', linear: 'Even', spring: 'Springy' })],
  stagger: ['stagger', 'One after the other', 'select', ON],
  replay: ['replay', 'Play every time it appears', 'select', ON],
};
// the tables the settings are checked against
export const MOTION_TABLES = { entrance: { ...ENTRANCE, off: '' }, hover: { ...HOVER, off: '' }, loop: { ...LOOP, off: '' }, speed: SPEED, delay: DELAY, easing: EASING, stagger: { yes: 1, no: 1 }, replay: { yes: 1, no: 1 } };
export const MOTION_PROPS = Object.keys(MOTION_FIELDS);
export const motionFields = (list) => list.map((k) => MOTION_FIELDS[k]);

// the classes, variables and attributes that make a part move; index is its place among the parts of its kind in the section
export function motionOf(cfg, index = 0) {
  const classes = [], vars = {};
  let attrs = '';
  const enter = cfg && ENTRANCE[cfg.entrance], loop = cfg && LOOP[cfg.loop], hover = cfg && HOVER[cfg.hover];
  if (!enter && !loop && !hover) return { classes, vars, attrs };
  const ease = EASING[cfg.easing] || EASING.smooth;
  const delay = (DELAY[cfg.delay] || 0) + (cfg.stagger === 'yes' ? index * 0.09 : 0);
  if (enter) {
    vars['--k-a1'] = `${ENTRANCE[cfg.entrance]} ${SPEED[cfg.speed] || SPEED.normal} ${ease} ${delay.toFixed(2)}s both`;
    classes.push(CLS.entrance);
    if (cfg.replay === 'yes') attrs = ' data-k-replay';
  }
  if (loop) {
    vars['--k-a2'] = `${LOOP[cfg.loop][0]} ${LOOP[cfg.loop][1]} ease-in-out infinite`;
    if (!enter) classes.push(CLS.loop);
  }
  if (hover) classes.push(HOVER[cfg.hover]);
  if (enter || loop) classes.push(CLS.calm);
  return { classes, vars, attrs };
}
void t;

// ---------- what the existing layouts do by themselves ----------
// every design moves a little: its sections enter as they come into view (and again each time they do), its cards follow one after the other,
// its buttons lift, its pictures grow in. Anything chosen for a part replaces it; "None" turns it off.
const ENTER = (entrance, extra = {}) => ({ entrance, replay: 'yes', ...extra });
const PROFILE = (section, item, speed = 'normal') => ({
  section: ENTER(section, { speed }),
  item: ENTER(item, { speed, stagger: 'yes', delay: 'short' }),
  image: ENTER('zoom-in', { speed: 'slow' }),
  button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' },
});
export const DEFAULT_MOTION = {
  aurora: PROFILE('fade-up', 'zoom-in'),
  bento: PROFILE('zoom-in', 'zoom-in', 'fast'),
  midnight: PROFILE('fade', 'fade-up', 'slow'),
  editorial: PROFILE('fade-up', 'fade', 'slow'),
  clarity: PROFILE('fade', 'fade-up', 'fast'),
  local: PROFILE('fade-up', 'fade-up'),
  // (Signature moves through the motion toolkit: its buttons lift, the rest is set on its own markup)
  signature: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  crest: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  zephyr: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  facet: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  vista: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  orbit: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  nova: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  lumen: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  vertex: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  horizon: { button: { hover: 'lift' }, buttonPrimary: { hover: 'lift' }, buttonAccent: { hover: 'lift' }, buttonGhost: { hover: 'lift' }, buttonLight: { hover: 'lift' }, buttonOutline: { hover: 'lift' } },
  harbor: PROFILE('fade-up', 'fade-up', 'slow'),
  operator: PROFILE('fade-up', 'fade-up'),
  atlas: PROFILE('fade', 'fade-up', 'slow'),
  meridian: PROFILE('fade-up', 'zoom-in'),
};
export const motionDefaults = (designId) => DEFAULT_MOTION[designId] || {};
// the defaults with what was chosen on top: per part, per setting
export function withMotion(defaults, style) {
  const out = {};
  for (const part of new Set([...Object.keys(defaults || {}), ...Object.keys(style || {})])) {
    const merged = { ...(defaults?.[part] || {}) };
    for (const [k, v] of Object.entries(style?.[part] || {})) merged[k] = v;
    out[part] = merged;
  }
  return out;
}
