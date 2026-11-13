import { toneClass } from './ui.js';
import { tagParts, cleanStyle, applySection } from './parts.js';
import { withMotion } from './motion.js';

// Alternating colours for the sections of a page. A section that has no background of its own takes the next one of a short rotation
// (page, soft, page, tint), never the same as the section before it, so a long page reads in bands. A section a design gives its own
// background (a dark statistics band, a tinted card section) keeps it, and a tone chosen by the user for a section wins over all of this.

export const TONE_NAMES = ['auto', 'white', 'soft', 'tint', 'dark', 'brand'];
const KEY = { white: 'none', soft: 'alt', tint: 'tint', dark: 'dark', brand: 'brand' };
const OWN = ['alt', 'tint', 'dark', 'brand'].map((k) => [k, toneClass(k)]);
const ROTATION = ['alt', 'none', 'tint', 'none'];
const SPACE = { tight: 'py-[calc(var(--k-sec-y)*.6)]', loose: 'py-[calc(var(--k-sec-y)*1.5)]' };
const OPEN = /^(\s*(?:<!--[\s\S]*?-->\s*)?)<section((?:\s+[\w-]+="[^"]*")*?)\s+class="([^"]*)"/;

export function applyTones(parts, entries = [], { tagAll = false, motion = null, tones = null } = {}) {
  const clsOf = (k) => tones?.[k] || toneClass(k);
  const rotation = tones?.rotation || ROTATION;
  let prev = 'none', turn = 0;
  return toned(parts, entries).map((html, i) => {
    const e = entries[i] || {};
    const mine = cleanStyle(e.style);
    // what the design does by itself, under what was chosen; the first part of a page (its hero) stays still unless told to move
    const style = motion && i > 0 ? cleanStyle(withMotion(motion, mine)) : mine;
    const styled = Object.keys(style).length > 0;
    if (!styled && !tagAll) return html;
    // the section itself (background, text mode, space), and its parts: marked, and carrying what was chosen for them
    if (style.section) html = applySection(html, style.section);
    return tagParts(html, styled ? style : null);
  });

  function toned(parts, entries) {
    return parts.map((html, i) => {
    const m = OPEN.exec(html);
    const e = entries[i] || {};
    if (!m) { prev = 'own'; return html; }
    let cls = m[3];
    const own = OWN.find(([, c]) => cls.includes(c))?.[0] || null;
    let rest = cls;
    for (const [, c] of OWN) rest = rest.split(c).join(' ');
    const plainBg = !/(^|\s)bg-/.test(rest);
    // a section with a background of its own that is not one of the tones (a hero, the trust row) is left alone
    if (!own && !plainBg) { prev = 'own'; return html; }
    let want = KEY[e.tone] || null;
    // (a section marked k-same stands on the ground of the section before it: a slim bar between two parts of the same band)
    if (!want && /(^|\s)k-same(\s|$)/.test(cls)) want = prev === 'own' ? 'none' : prev;
    else if (!want) {
      if (own) want = own;
      else {
        const options = [0, 1, 2, 3].map((k) => rotation[(turn + k) % rotation.length]);
        want = options.find((o) => o !== prev) || 'none';
        turn += 1;
      }
    }
    for (const [, c] of OWN) cls = cls.split(c).join(' ');
    if (want !== 'none') cls = `${cls} ${clsOf(want)}`;
    if (e.space && SPACE[e.space]) cls = cls.replace('py-[var(--k-sec-y)]', SPACE[e.space]);
    prev = want;
    return html.replace(OPEN, `${m[1]}<section${m[2]} class="${cls.replace(/\s+/g, ' ').trim()}"`);
    });
  }
}
