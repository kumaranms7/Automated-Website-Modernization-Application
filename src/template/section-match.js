import fs from 'node:fs';
import * as cheerio from 'cheerio';

// Template changes made on the sample inner or contact page point at "section 3". Another page's section 3 may hold something else,
// so a change is carried to other pages by what a section is built from: its structure. A rule made on a section of the sample
// page applies to every section, on every page of that kind, that has the same structure (same elements in the same order,
// however many paragraphs or list items it has). Text and classes are not part of the structure.

const SKIP = new Set(['script', 'style', 'br', 'svg', 'noscript']);
const kids = (n) => (n.children || []).filter((c) => c.type === 'tag' && !SKIP.has(c.name));

// repeats collapse: "h3,p,h3,p" and "h3,p" are the same structure, and so are "p,p,p" and "p"
function collapse(parts) {
  const out = [...parts];
  for (let changed = true; changed;) {
    changed = false;
    for (let len = 1; len <= 3 && !changed; len += 1) {
      for (let i = 0; i + 2 * len <= out.length; i += 1) {
        if (out.slice(i, i + len).join('|') === out.slice(i + len, i + 2 * len).join('|')) { out.splice(i + len, len); changed = true; break; }
      }
    }
  }
  return out;
}
export function skeleton(node, depth = 0) {
  const inner = depth < 8 ? collapse(kids(node).map((c) => skeleton(c, depth + 1))) : [];
  return node.name + (inner.length ? `(${inner.join(',')})` : '');
}
// the exact element tree (no collapsing), used to line two versions of the same section up element by element
const exact = (n) => `${n.name}(${kids(n).map(exact).join(',')})`;

// the top-level sections of a page's <main>, with their editor ids and structures
export function sectionSignatures(html) {
  const $ = cheerio.load(html);
  return $('main').children('[data-sec]').toArray().map((el) => ({ id: $(el).attr('data-sec'), sig: skeleton(el) }));
}

// ---- hand edits that only changed classes can travel too ----
// the stylesheet's own component names (.prose-content, .card, .wrap...): stable names, not utilities
const UTILITY = /^(text|bg|border|ring|p|px|py|pt|pb|m|mx|my|mt|mb|w|h|min|max|flex|grid|gap|font|rounded|shadow|items|justify|self|space)-/;
const COMPONENT = (() => {
  try {
    const css = fs.readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
    return new Set([...css.matchAll(/\.([a-z][a-z0-9_-]*)/g)].map((m) => m[1]).filter((c) => !UTILITY.test(c) && c !== 'text-center'));
  } catch { return new Set(); }
})();
// "div.prose-content" or "aside#quote": a way to find this KIND of element on any page; null when it has no stable name
export function kindSelector(el) {
  const id = el.attribs?.id;
  if (id) return `${el.name}#${id}`;
  const own = String(el.attribs?.class || '').split(/\s+/).filter((c) => COMPONENT.has(c));
  return own.length ? `${el.name}.${own.join('.')}` : null;
}
// classes that change how a block is laid out; these only travel with the structure they were designed for
const STRUCTURAL = /^(?:[a-z0-9-]+:)*(flex|inline-flex|grid|inline-grid|contents|hidden|absolute|relative|fixed|sticky|float-|order-|col-|row-|basis-|grow|shrink|w-|columns-|gap-)/;

const classes = (n) => new Set(String(n.attribs?.class || '').split(/\s+/).filter(Boolean));
// element by element: which classes did the edit add or remove? null when the edit changed the structure (then it stays on its page)
export function classDiffs(genEl, editEl, secId) {
  if (exact(genEl) !== exact(editEl)) return null;
  const out = [];
  const walk = (g, e, path) => {
    const a = classes(g), b = classes(e);
    const add = [...b].filter((c) => !a.has(c)), remove = [...a].filter((c) => !b.has(c));
    if (add.length || remove.length) out.push({ selector: `[data-sec="${secId}"]${path.map((i) => ` > :nth-child(${i})`).join('')}`, add, remove, anchor: path.length ? kindSelector(g) : null });
    const gk = kids(g), ek = kids(e), all = (n) => (n.children || []).filter((c) => c.type === 'tag');
    gk.forEach((child, i) => walk(child, ek[i], [...path, all(g).indexOf(child) + 1]));
  };
  walk(genEl, editEl, []);
  return out;
}

// ---- carrying rules to a page ----
const INDEXED = /\[data-sec="s(\d+)"\]/;
const sameN = (n) => new RegExp(`\\[data-sec="s${n}"\\]`, 'g');

// rules that point at a numbered section become rules for the sections of THIS page with the same structure
export function expandNumberedRules({ spec, layout, rel, mainHtml, sigsByFile }) {
  if (!['inner', 'contact'].includes(layout) || !sigsByFile) return spec;
  const here = sectionSignatures(mainHtml);
  const targets = (file, n) => {
    const sig = sigsByFile[file]?.[n - 1];
    return sig ? here.filter((s) => s.sig === sig).map((s) => s.id.replace(/^s/, '')) : [];
  };
  const numberOf = (item) => { const m = String(item.selector || '').match(INDEXED) || String(item.target || '').match(INDEXED); return m ? Number(m[1]) : 0; };
  const swap = (text, from, to) => String(text).replace(sameN(from), `[data-sec="s${to}"]`);

  const keepTweaks = [], keepOps = [], keepSecs = [];
  const tweaks = [], ops = [], sections = [];
  for (const t of spec.tweaks || []) {
    const n = layout === t.layout || t.layout === 'all' ? numberOf(t) : 0;
    if (!n || t.layout === 'all') { keepTweaks.push(t); continue; }
    for (const k of targets(t.file || spec.samples?.[layout], n)) tweaks.push({ ...t, selector: swap(t.selector, n, k), file: rel });
  }
  for (const o of spec.ops || []) {
    const n = o.layout === layout ? numberOf(o) : 0;
    if (!n) { keepOps.push(o); continue; }
    for (const k of targets(o.file || spec.samples?.[layout], n)) ops.push({ ...o, selector: swap(o.selector, n, k), ...(o.target ? { target: swap(o.target, n, k) } : {}), file: rel });
  }
  for (const s of spec.sections || []) {
    if (s.layout !== layout || !s.index) { keepSecs.push(s); continue; }
    for (const k of targets(s.file || spec.samples?.[layout], s.index)) sections.push({ ...s, index: Number(k), file: rel });
  }
  return { ...spec, tweaks: [...keepTweaks, ...tweaks], ops: [...keepOps, ...ops], sections: [...keepSecs, ...sections] };
}

// Changes aimed at an identifiable element (a stable id or component class) with safe visual classes apply to that element on
// every page, not only to the section they were made in. Layout changes (rows, grids, widths) stay with their structure.
export function kindRules(items) {
  const seen = new Set(), out = [];
  const push = (layout, anchor, add, remove, id) => {
    if (!anchor || (!add.length && !remove.length)) return;
    if (!id && [...add, ...remove].some((c) => STRUCTURAL.test(c))) return;
    const key = JSON.stringify([layout, anchor, add, remove]);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ layout, selector: `main ${anchor}`, add, remove, kind: true });
  };
  for (const t of items) {
    if (!['inner', 'contact'].includes(t.layout)) continue;
    if (t.anchor !== undefined) { push(t.layout, t.anchor, t.add, t.remove, /#/.test(t.anchor || '')); continue; } // derived from a hand edit
    const m = String(t.selector || '').match(/^\[data-sec="s\d+"\]\s+(.+)$/);
    if (!m) continue;
    const last = m[1].split(/[\s>+~]+/).filter(Boolean).at(-1) || '';
    const id = /#[\w-]+/.test(last);
    const comp = (last.match(/\.([a-z][a-z0-9_-]*)/g) || []).some((c) => COMPONENT.has(c.slice(1)));
    if (!/:nth-/.test(m[1]) && (id || comp)) push(t.layout, m[1], t.add, t.remove, id);
  }
  return out;
}
