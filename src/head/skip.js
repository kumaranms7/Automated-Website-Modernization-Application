import { matchRule } from '../canonical/index.js';

// Pages a run leaves out, and why: the ones the user listed, pages set to noindex, error pages and pages the .htaccess redirects or
// removes. A page left out is not rebuilt, so it stays exactly as it is in the website folder.

const rx = (pattern) => new RegExp(`^${String(pattern).trim().replace(/^\/+/, '').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');
export const patternList = (text) => String(text || '').split('\n').map((x) => x.trim()).filter(Boolean).map((p) => ({ p, rx: rx(p) }));

export function skipReason(page, settings, canon) {
  const rel = String(page.path || '').replace(/\\/g, '/');
  for (const { p, rx: r } of patternList(settings.excludePatterns)) if (r.test(rel) || (!/[*]/.test(p) && rel.startsWith(`${p.replace(/\/+$/, '')}/`))) return `listed to leave out (${p})`;
  if (settings.skipNoindex && /noindex/i.test(page.robots || '')) return 'set to noindex';
  if (settings.skipErrorPages && (/(^|[/_-])(404|403|500|error|not-?found)(\.|\/|$|[_-])/i.test(rel) || /\b(404|page not found)\b/i.test(page.title || ''))) return 'an error page';
  if (settings.skipRedirected && canon?.rules?.length) { const r = matchRule(canon.rules, rel, canon.cleanUrls); if (r) return `redirected or removed by the .htaccess (line ${r.line})`; }
  return '';
}
