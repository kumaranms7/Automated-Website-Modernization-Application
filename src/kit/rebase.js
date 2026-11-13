import path from 'node:path';

// The example of a kind comes from another page: its pictures and links are written from that page's folder. On the page that shows the
// example they are written from this page's folder instead.
const relTo = (ref, from, to) => {
  if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(ref)) return ref;
  const abs = path.posix.normalize(path.posix.join(path.posix.dirname(from), ref));
  const rel = path.posix.relative(path.posix.dirname(to), abs);
  return rel.startsWith('.') ? rel : `./${rel}`;
};
export function rebase(v, from, to) {
  if (!from || !to || path.posix.dirname(from) === path.posix.dirname(to)) return v;
  if (Array.isArray(v)) return v.map((x) => rebase(x, from, to));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === 'string' && (k === 'src' || k === 'img' || k === 'href')) o[k] = relTo(x, from, to);
      else if (typeof x === 'string' && (k === 'html' || k === 'a')) o[k] = x.replace(/\b(src|href)="([^"]*)"/gi, (m, a, ref) => `${a}="${relTo(ref, from, to)}"`);
      else o[k] = rebase(x, from, to);
    }
    return o;
  }
  return v;
}
