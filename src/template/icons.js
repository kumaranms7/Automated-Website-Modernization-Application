// Built-in line icons (24x24, stroke). They give service and feature cards a designed look when the site has no usable
// artwork of its own. An icon is picked from the card's own words, never invented content.

// each entry: list of path data strings; "c:cx,cy,r" draws a circle
export const ICONS = {
  wrench: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z'],
  droplet: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
  clock: ['c:12,12,10', 'M12 6v6l4 2'],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'],
  home: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  building: ['M3 21h18', 'M5 21V7l8-4v18', 'M19 21V11l-6-4', 'M9 9v.01M9 12v.01M9 15v.01M9 18v.01'],
  check: ['c:12,12,10', 'm9 12 2 2 4-4'],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
  dollar: ['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  thumbs: ['M7 10v12', 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z', 'c:12,10,3'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'c:9,7,4', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  award: ['c:12,8,6', 'M15.48 12.89 17 22l-5-3-5 3 1.52-9.11'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  snow: ['M2 12h20', 'M12 2v20', 'm4.93 4.93 14.14 14.14', 'm19.07 4.93-14.14 14.14'],
  truck: ['M10 17h4V5H2v12h3', 'M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5', 'M14 17h1', 'c:7.5,17.5,2.5', 'c:17.5,17.5,2.5'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  lock: ['M5 11h14v10H5z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  monitor: ['M2 3h20v14H2z', 'M8 21h8', 'M12 17v4'],
  calendar: ['M3 4h18v18H3z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z'],
  search: ['c:11,11,8', 'm21 21-4.3-4.3'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
  roof: ['M3 12 12 4l9 8', 'M5 10v10h14V10'],
  leaf: ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'],
  car: ['M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2', 'c:7,17,2', 'M9 17h6', 'c:17,17,2'],
  dumbbell: ['m6.5 6.5 11 11', 'm21 21-1-1', 'm3 3 1 1', 'm18 22 4-4', 'm2 6 4-4', 'm3 10 7-7', 'm14 21 7-7'],
  arrow: ['M5 12h14', 'm12 5 7 7-7 7'],
  tool: ['M12 2v4', 'M12 18v4', 'm4.93 4.93 2.83 2.83', 'm16.24 16.24 2.83 2.83', 'M2 12h4', 'M18 12h4', 'm4.93 19.07 2.83-2.83', 'm16.24 7.76 2.83-2.83'],
};

// first match wins, so the more specific words come first
const WORDS = [
  [/roof|shingle|gutter|siding/i, 'roof'], [/garage|door|gate|opener|spring/i, 'home'], [/electric|wiring|panel|outlet|lighting|power|generator/i, 'zap'],
  [/heat|furnace|boiler|fire/i, 'flame'], [/\bac\b|a\/c|air condition|cooling|hvac|cool/i, 'snow'], [/water heater|drain|pipe|plumb|leak|sewer|faucet|toilet|water|flow|clog|backflow/i, 'droplet'],
  [/junk|trash|waste|debris|dumpster|haul|remov|cleanout|demoli/i, 'trash'], [/truck|deliver|move|shipping|transport|fleet/i, 'truck'], [/lawn|landscap|tree|garden|yard/i, 'leaf'],
  [/auto|vehicle|car\b|tire|collision/i, 'car'], [/train|fitness|athlet|sport|coach|strength|workout|gym/i, 'dumbbell'], [/dog|pet|puppy|wellness|care|family|health|therap|love/i, 'heart'],
  [/secur|protect|safe|compliance|risk|insur|guarantee|licens|certif|bonded|assur/i, 'shield'], [/cyber|network|cloud|software|it\b|data|digital|monitor|tech|\bsoc\b|pen.?test|vulnerab/i, 'monitor'],
  [/price|cost|afford|financ|payment|quote|estimate|value|save|\$|%\s*off|discount|special|coupon/i, 'dollar'], [/24\/7|hour|same.?day|fast|quick|time|emergenc|schedule|hours|response/i, 'clock'],
  [/call|phone|contact|talk|reach/i, 'phone'], [/area|location|local|city|county|near|service area|serv(?:ing|e)/i, 'pin'], [/team|staff|technician|crew|people|expert|professional|employee/i, 'users'],
  [/review|rating|star|testimonial|rated/i, 'star'], [/year|experience|award|best|top|trusted|since|quality|craft/i, 'award'], [/inspect|diagnos|camera|detect|test|assess/i, 'search'],
  [/book|appointment|date|calendar|booking/i, 'calendar'], [/repair|fix|install|replac|maint|service|restor/i, 'wrench'], [/home|house|resident|kitchen|bath|remodel/i, 'home'], [/commercial|business|office|industr|enterprise|building/i, 'building'],
  [/report|plan|document|estimate|proposal|policy|process/i, 'file'], [/satisf|recommend|happy|promise|honest|reliab/i, 'thumbs'],
];

export function iconName(text) {
  for (const [re, name] of WORDS) if (re.test(text || '')) return name;
  return 'check';
}

// The size is also set inline, so a site's own broad CSS rules (for example one that resizes every svg in a card) cannot distort it.
export function iconSvg(name, cls = 'size-6') {
  const n = Number((cls.match(/size-(\d+)/) || [])[1]) || 6;
  const style = `width:${n / 4}rem;height:${n / 4}rem;margin:0`;
  const parts = (ICONS[name] || ICONS.check).map((d) => {
    if (d.startsWith('c:')) { const [cx, cy, r] = d.slice(2).split(','); return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`; }
    return `<path d="${d}"/>`;
  }).join('');
  return `<svg class="${cls}" style="${style}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts}</svg>`;
}

// Icons for a whole set of cards: chosen from each card's title (then its text), and different from one another where
// the words allow, so a grid of ten plumbing services is not ten droplets.
const POOL = ['wrench', 'shield', 'star', 'award', 'thumbs', 'tool', 'file', 'check'];
const matches = (t) => WORDS.filter(([re]) => re.test(t || '')).map(([, n]) => n);
export function iconNames(items) {
  const used = new Set();
  return items.map((it) => {
    const cands = [...new Set([...matches(it.title), ...matches(it.text)])];
    const pick = cands.find((n) => !used.has(n)) || POOL.find((n) => !used.has(n)) || cands[0] || 'check';
    used.add(pick);
    return pick;
  });
}
export const iconFor = (text, cls) => iconSvg(iconName(text), cls);
export const ICON_NAMES = Object.keys(ICONS);
