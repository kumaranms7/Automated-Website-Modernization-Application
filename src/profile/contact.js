// The business's address, phone, hours and name as the pages state them.
// Pages put these in the footer, in an <address> tag, on the contact page and in LocalBusiness structured data. All of those are read here,
// without any guessing, so the profile starts from what the site itself says.
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// the text of an element with a space between its blocks and a comma at each line break (plain .text() runs "33069" and "Phone" together)
const BLOCKS = 'p, div, li, ul, h1, h2, h3, h4, h5, h6, td, th, tr, dd, dt, section, article, address, strong, b';
export function spacedText($, el) {
  const c = $(el).clone();
  c.find('br').replaceWith(' , ');
  c.find(BLOCKS).each((_, n) => { $(n).prepend(' ').append(' '); });
  return c.text();
}
const FIELDS = ['street', 'city', 'region', 'postal', 'country'];
const US_ZIP = /\b(\d{5}(?:-\d{4})?)\b(?!\d)/g;
const CA_POSTAL = /\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/g;
const HOUSE_NUMBER = /\d{1,6}\s+[A-Za-z#]/;

// "2520 N Powerline Road, Suite 302, Pompano Beach, FL 33069" -> { street, city, region, postal }, or null when it holds no address
export function parseAddressLine(text) {
  const t = oneLine(text).replace(/\s*[|•·]\s*/g, ', ');
  const zips = [];
  for (const m of t.matchAll(US_ZIP)) zips.push({ at: m.index, postal: m[1] });
  for (const m of t.matchAll(CA_POSTAL)) zips.push({ at: m.index, postal: `${m[1]} ${m[2]}` });
  // the last postal code first: an address ends with it
  for (const z of zips.sort((a, b) => b.at - a.at)) {
    const before = t.slice(Math.max(0, z.at - 150), z.at).replace(/[\s,]+$/, '');
    const st = before.match(/([A-Z]{2})$/);
    if (!st || (before.length > 2 && !/[\s,]/.test(before.at(-3)))) continue;
    const head = before.slice(0, before.length - 2).replace(/[\s,]+$/, '');
    const parts = head.split(',').map(oneLine).filter(Boolean);
    if (!parts.length) continue;
    // no comma between the street and the city: "2520 N Powerline Road Pompano Beach"
    if (parts.length === 1) {
      const m = parts[0].match(/(\d{1,6}\s+[A-Za-z#].*?\b(?:Road|Rd|Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Highway|Hwy|Parkway|Pkwy|Place|Pl|Suite|Ste|Unit|#\S+))\.?\s+([A-Z][A-Za-z.'-]*(?:\s[A-Z][A-Za-z.'-]*){0,2})$/);
      if (m) return { street: oneLine(m[1]), city: m[2], region: st[1], postal: z.postal };
      return { street: '', city: parts[0].replace(/^.*\s(?=[A-Z][a-z])/, (s) => (parts[0].split(' ').length > 3 ? s.slice(s.lastIndexOf(' ') + 1) : s)), region: st[1], postal: z.postal };
    }
    const city = parts.at(-1);
    const rest = parts.slice(0, -1);
    // the street starts at the last part that starts with a house number, and takes the suite or unit parts after it
    let from = -1;
    rest.forEach((p, i) => { if (HOUSE_NUMBER.test(p)) from = i; });
    let street = '';
    if (from >= 0) street = [rest[from].slice(rest[from].search(HOUSE_NUMBER)), ...rest.slice(from + 1)].join(', ');
    return { street: oneLine(street), city: oneLine(city), region: st[1], postal: z.postal };
  }
  return null;
}

const DAYS = { monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su' };
const dayName = (d) => DAYS[String(d).split('/').pop().toLowerCase()] || String(d).slice(0, 2);

// the business node of the page's JSON-LD: name, phone, address, hours, price range
export function structuredBusiness($) {
  const out = { name: '', phone: '', street: '', city: '', region: '', postal: '', country: '', hours: [], priceRange: '' };
  const nodes = [];
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { nodes.push(n); if (n['@graph']) walk(n['@graph']); } };
      walk(JSON.parse($(s).html() || ''));
    } catch { /* not readable: skipped */ }
  });
  const isBiz = (n) => /Business|Organization|Plumber|Store|Service|Contractor|Dentist|Attorney|Physician|Restaurant|Locksmith/i.test([].concat(n['@type'] || []).join(' '));
  const node = nodes.find((n) => n.address && isBiz(n)) || nodes.find((n) => n.address) || nodes.find((n) => n.telephone);
  if (!node) return out;
  out.name = oneLine(node.name);
  out.phone = oneLine([].concat(node.telephone || [])[0]);
  out.priceRange = oneLine(node.priceRange);
  const a = [].concat(node.address || [])[0];
  if (typeof a === 'string') Object.assign(out, parseAddressLine(a) || {});
  else if (a && typeof a === 'object') {
    out.street = oneLine(a.streetAddress); out.city = oneLine(a.addressLocality); out.region = oneLine(a.addressRegion); out.postal = oneLine(a.postalCode);
    out.country = oneLine(typeof a.addressCountry === 'object' ? a.addressCountry?.name : a.addressCountry);
  }
  for (const h of [].concat(node.openingHours || [])) if (oneLine(h)) out.hours.push(oneLine(h));
  for (const s of [].concat(node.openingHoursSpecification || [])) {
    if (!s || !s.opens || !s.closes) continue;
    out.hours.push(`${[].concat(s.dayOfWeek || []).map(dayName).join(',')} ${String(s.opens).slice(0, 5)}-${String(s.closes).slice(0, 5)}`.trim());
  }
  return out;
}

// the footer, header and address blocks of a page as plain text (the reader of the main text takes them out), and what the structured data says
export function contactText($) {
  const bits = [];
  const add = (s) => { const t = oneLine(s).slice(0, 600); if (t.length > 6 && !bits.includes(t)) bits.push(t); };
  $('address').each((_, e) => add(spacedText($, e)));
  $('[itemprop="address"], [itemtype*="PostalAddress" i], [class*="address" i], [id*="address" i], [class*="contact" i], [id*="contact" i], footer, [class*="footer" i], [id*="footer" i], header').each((_, e) => add(spacedText($, e)));
  const tel = $('a[href^="tel:"]').map((_, a) => $(a).attr('href').replace(/^tel:/i, '')).get().filter(Boolean);
  const s = structuredBusiness($);
  const sb = Object.entries(s).filter(([, v]) => (Array.isArray(v) ? v.length : v)).map(([k, v]) => `${k}: ${[].concat(v).join('; ')}`).join(', ');
  return [sb && `Business data in the page's structured data: ${sb}`, tel.length && `Phone links: ${[...new Set(tel)].slice(0, 4).join(', ')}`, ...bits].filter(Boolean).join(' | ').slice(0, 3000);
}

// what the pages state, with the structured data first. Each part is '' when the pages do not state it.
export function contactFromPages(docs) {
  const found = { name: '', phone: '', street: '', city: '', region: '', postal: '', country: '', hours: [], priceRange: '', line: '', source: '' };
  const take = (s, source) => {
    if (!s) return;
    if (!found.street && !found.city && (s.street || s.city)) { for (const k of FIELDS) found[k] = s[k] || ''; found.source = source; }
    if (!found.name && s.name) found.name = s.name;
    if (!found.phone && s.phone) found.phone = s.phone;
    if (!found.priceRange && s.priceRange) found.priceRange = s.priceRange;
    if (!found.hours.length && s.hours?.length) found.hours = s.hours;
  };
  for (const d of docs) if (d.$) take(structuredBusiness(d.$), 'the structured data of the page');
  if (!found.street && !found.city) {
    for (const d of docs) {
      if (!d.$) continue;
      const $ = d.$;
      const m = { street: oneLine($('[itemprop="streetAddress"]').first().text()), city: oneLine($('[itemprop="addressLocality"]').first().text()), region: oneLine($('[itemprop="addressRegion"]').first().text()), postal: oneLine($('[itemprop="postalCode"]').first().text()) };
      if (m.street || m.city) { take(m, 'the address markup of the page'); break; }
      let hit = null;
      $('address').each((_, e) => { if (!hit) hit = parseAddressLine(spacedText($, e)); });
      if (hit) { take(hit, 'the address of the page'); break; }
    }
  }
  if (!found.street && !found.city) {
    for (const d of docs) {
      const parsed = d.contact ? parseAddressLine(d.contact) : null;
      if (parsed) { take(parsed, 'the footer of the page'); break; }
    }
  }
  if (!found.phone) for (const d of docs) { const t = d.$?.('a[href^="tel:"]').first().attr('href'); if (t) { found.phone = oneLine(t.replace(/^tel:/i, '')); break; } }
  found.line = [found.street, [found.city, [found.region, found.postal].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  return found;
}
