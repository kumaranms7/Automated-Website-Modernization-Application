import crypto from 'node:crypto';
import { toHex, isColor, rgbToOklch, parseColor, oklchHex, hexToOklch, hueGap, rgbToOklab } from './color.js';
import { buildTheme, compactTheme, normaliseBase } from './engine.js';
import { INDUSTRIES, detectIndustry, presetBase } from './industry.js';

// Theme generation. Three strategies make the base colours (the website's own colours, an industry preset, the AI); the engine turns
// base colours into complete themes. Five variations are always made, and they differ in character, not by a shade: the first keeps
// the brand as it is, the others change how strong, how quiet, how rich or how fresh it feels.

export const STYLES = [
  { id: 'corporate', name: 'Corporate Professional', description: 'The brand as it is: trusted, clear and balanced. A deep secondary colour and one accent for calls to action.' },
  { id: 'minimal', name: 'Modern & Minimal', description: 'Quiet and airy. A softened brand colour, near-black text and a gentle accent, with plenty of white.' },
  { id: 'bold', name: 'Bold & High Contrast', description: 'Strong and direct. A richer brand colour, very dark neutrals and a vivid call-to-action colour from the opposite side of the wheel.' },
  { id: 'premium', name: 'Premium & Elegant', description: 'Deep and refined. A dark brand colour, charcoal and a warm gold accent on a soft ivory background.' },
  { id: 'fresh', name: 'Fresh & Contemporary', description: 'Lighter and lively. A neighbouring hue of the brand, a cool slate and a warm coral accent.' },
];

const ok = (l, c, h) => oklchHex(Math.min(0.98, Math.max(0.05, l)), Math.max(0, c), ((h % 360) + 360) % 360);
const idOf = (name, base) => `theme-${crypto.createHash('sha1').update(name + JSON.stringify(base)).digest('hex').slice(0, 8)}`;
const lab = (hex) => rgbToOklab(parseColor(hex));
const delta = (a, b) => { const x = lab(a), y = lab(b); return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b); };

// the base colours of the five variations from one anchor (the brand, or an industry preset).
// The brand hue is kept in every variation except the fresh one: they differ in how strong, quiet, deep or lively the brand feels.
export function variationBases(anchor) {
  const a = normaliseBase(anchor);
  const p = hexToOklch(a.primary), ac = hexToOklch(a.accent);
  // the fresh theme moves the hue to a neighbour: blues and violets towards teal, everything else a step towards blue
  const shift = p.h >= 235 && p.h <= 330 ? -50 : 40;
  const bases = {
    corporate: { ...a },
    // quiet: a lighter, softer brand colour, near-black text, a muted colour next to the brand as the accent
    minimal: { primary: ok(Math.max(0.6, p.l + 0.04), Math.max(0.045, p.c * 0.5), p.h), secondary: ok(0.22, 0.022, p.h), accent: ok(0.68, Math.max(0.08, p.c * 0.8), p.h + 38) },
    // strong: a richer, darker brand colour, very dark neutrals, a vivid call to action from the other side of the wheel
    bold: { primary: ok(Math.min(0.46, Math.max(0.36, p.l - 0.06)), Math.min(0.16, Math.max(0.12, p.c * 1.2)), p.h), secondary: ok(0.17, 0.035, p.h), accent: ok(0.77, 0.19, hueGap(ac.h, p.h) > 100 ? ac.h : p.h + 180) },
    // deep: a dark brand colour, charcoal, warm gold on ivory
    premium: { primary: ok(Math.min(0.32, Math.max(0.24, p.l - 0.08)), Math.max(0.05, p.c * 0.75), p.h), secondary: ok(0.25, 0.012, p.h), accent: ok(0.75, 0.125, 85), background: '#faf7f2' },
    // lively: a neighbouring hue, a cool slate, a warm coral
    fresh: { primary: ok(0.6, Math.max(0.12, p.c * 0.95), p.h + shift), secondary: ok(0.3, 0.05, p.h + shift), accent: ok(0.72, 0.16, 38) },
  };
  // five themes that look alike are no use. A variation whose primary and accent are both close to an earlier one gets another accent
  // hue, then another lightness: the brand hue of the primary is never turned.
  const ids = STYLES.map((x) => x.id);
  const close = (i) => ids.slice(0, i).some((j) => delta(bases[ids[i]].primary, bases[j].primary) < 0.07 && delta(bases[ids[i]].accent, bases[j].accent) < 0.12);
  for (let i = 1; i < ids.length; i += 1) {
    for (let t = 0; t < 6 && close(i); t += 1) {
      const b = bases[ids[i]], aa = hexToOklch(b.accent), pp = hexToOklch(b.primary);
      bases[ids[i]] = t % 2 === 0 ? { ...b, accent: ok(aa.l, aa.c, aa.h + 40) } : { ...b, primary: ok(pp.l + (pp.l > 0.45 ? -0.07 : 0.07), pp.c, pp.h) };
    }
  }
  return bases;
}

// five themes from an anchor
export function localThemes(anchor, { category = '', source = 'local', mode = 'light' } = {}) {
  const bases = variationBases(anchor);
  return STYLES.map((st) => {
    const base = bases[st.id];
    return buildTheme({ id: idOf(st.name, base), name: st.name, description: st.description, category, style: st.id, source, mode, base });
  });
}

// ---------- the AI strategy ----------
const HEX = /^#[0-9a-f]{6}$/i;
const STYLE_IDS = STYLES.map((s) => s.id);

export const AI_TOOL = {
  name: 'submit_color_themes',
  description: 'Submit the colour themes. Colours only: the platform works out shades, backgrounds, text, borders, status and button colours itself.',
  input_schema: {
    type: 'object',
    properties: {
      themes: {
        type: 'array', minItems: 3, maxItems: 5,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'A short name for the look, 2-4 words.' },
            style: { type: 'string', enum: STYLE_IDS, description: 'The closest of the five styles.' },
            description: { type: 'string', description: 'One sentence: what this theme feels like and who it suits.' },
            primary: { type: 'string', description: 'Brand colour, #rrggbb.' },
            secondary: { type: 'string', description: 'A deeper or contrasting structural colour, #rrggbb.' },
            accent: { type: 'string', description: 'Call-to-action colour, #rrggbb. Clearly different from the primary.' },
            neutral: { type: 'string', description: 'Optional: a grey with a trace of the brand hue, #rrggbb.' },
            background: { type: 'string', description: 'Optional: the page background if it should not be white, #rrggbb.' },
          },
          required: ['name', 'primary', 'secondary', 'accent'],
        },
      },
    },
    required: ['themes'],
  },
};

// what the AI sent, checked: every colour must be a real colour, every theme complete and different from the others. Nothing else is accepted.
export function validateAiThemes(input) {
  const out = [], problems = [];
  const list = Array.isArray(input?.themes) ? input.themes : [];
  if (!list.length) problems.push('The AI sent no themes.');
  list.slice(0, 8).forEach((t, i) => {
    const colors = {};
    for (const k of ['primary', 'secondary', 'accent']) { const hex = isColor(t?.[k]) ? toHex(t[k]) : null; if (!hex) problems.push(`Theme ${i + 1}: "${k}" is not a colour.`); colors[k] = hex; }
    if (!colors.primary || !colors.secondary || !colors.accent) return;
    for (const k of ['neutral', 'background']) if (t[k] !== undefined && t[k] !== '' && isColor(t[k])) colors[k] = toHex(t[k]);
    if (colors.primary === colors.secondary || colors.primary === colors.accent) { problems.push(`Theme ${i + 1}: the colours are not different enough.`); return; }
    if (out.some((o) => delta(o.base.primary, colors.primary) < 0.04 && delta(o.base.accent, colors.accent) < 0.06)) { problems.push(`Theme ${i + 1}: it is almost the same as an earlier one.`); return; }
    const name = String(t.name || '').replace(/[<>]/g, '').trim().slice(0, 40) || `AI theme ${out.length + 1}`;
    const style = STYLE_IDS.includes(t.style) ? t.style : '';
    out.push({ name, style, description: String(t.description || '').replace(/[<>]/g, '').trim().slice(0, 200), base: colors });
  });
  return { themes: out.slice(0, 5), problems };
}

// the brief for the AI
export function aiPrompt({ name, host, profile, brand, industry, style, prefer, avoid, count }) {
  const lines = [
    `BUSINESS: ${name || host || 'unknown'}${profile?.industry ? ` (${profile.industry})` : ''}`,
    profile?.summary ? `DESCRIPTION: ${profile.summary}` : '',
    industry ? `INDUSTRY PRESET (a starting point, not a rule): ${industry.label}: ${industry.palette}` : '',
    brand?.found ? `THE WEBSITE'S OWN COLOURS (keep the brand recognisable): primary ${brand.primary?.hex}${brand.secondary ? `, secondary ${brand.secondary.hex}` : ''}${brand.accent ? `, accent ${brand.accent.hex}` : ''}${brand.neutral ? `, text ${brand.neutral.hex}` : ''}` : 'THE WEBSITE HAS NO CLEAR BRAND COLOURS YET: choose them to suit the business.',
    brand?.logo?.length ? `LOGO COLOURS: ${brand.logo.map((c) => c.hex).join(', ')}` : '',
    style ? `PREFERRED DESIGN STYLE: ${style}` : '',
    prefer?.length ? `THE USER LIKES: ${prefer.join(', ')}` : '',
    avoid?.length ? `THE USER WANTS TO AVOID: ${avoid.join(', ')}` : '',
    `Make ${count} different themes (for example Corporate Professional, Modern & Minimal, Bold & High Contrast, Premium & Elegant, Fresh & Contemporary). They must differ in character, with different primary and accent colours, not a lighter or darker version of one. Keep the website's own colours in the first one. Text must be readable: the platform checks contrast and will not change your colours.`,
  ];
  return lines.filter(Boolean).join('\n');
}
export const AI_SYSTEM = 'You are a senior brand and web designer choosing colour themes for a small-business website. Return restrained, professional palettes that suit the business and could go into production: a brand colour, a deeper structural colour and one call-to-action colour per theme. Never use neon, gradients or decorative colours without a purpose. Call the tool exactly once.';

// ---------- the whole generation ----------
// ctx: { name, host, profile, brand (extractBrand result or null), callAi (async (prompt) => input) }
export async function generateThemes(ctx, { strategy = 'auto', style = '', prefer = [], avoid = [], industryId = '', mode = 'light', count = 5 } = {}) {
  const warnings = [];
  const brand = ctx.brand && ctx.brand.found ? ctx.brand : null;
  const detected = industryId && INDUSTRIES[industryId] ? { id: industryId, ...INDUSTRIES[industryId] } : detectIndustry({ ...ctx.profile, name: ctx.name, businessType: ctx.profile?.facts?.businessType });
  // which colours the variations start from
  let anchorFrom = 'default';
  let anchor = { primary: '#2563eb', secondary: '#0f172a', accent: '#f97316' };
  let category = '';
  const useBrand = strategy === 'extracted' || ((strategy === 'auto' || strategy === 'ai') && brand);
  if (useBrand && brand?.base) { anchor = { ...(detected ? presetBase(detected.id) : {}), ...brand.base }; anchorFrom = 'extracted'; category = detected?.id || ''; if (!brand.base.secondary || !brand.base.accent) anchor = { ...anchor, ...(brand.base.secondary ? {} : { secondary: undefined }), ...(brand.base.accent ? {} : { accent: undefined }) }; }
  else if (strategy === 'extracted') warnings.push('No colours of the website could be found, so an industry preset was used.');
  if (anchorFrom !== 'extracted') {
    if (detected) { anchor = presetBase(detected.id); anchorFrom = 'industry'; category = detected.id; } else if (strategy === 'industry') warnings.push('The industry could not be recognised, so a general professional palette was used.');
  }
  // keep missing parts of an extracted brand worked out from its primary (the engine does that when a part is absent)
  for (const k of Object.keys(anchor)) if (anchor[k] === undefined) delete anchor[k];

  const source = anchorFrom === 'extracted' ? 'extracted' : anchorFrom === 'industry' ? 'industry' : 'local';
  let themes = localThemes(anchor, { category, source, mode });
  let ai = null;
  if (strategy === 'ai') {
    if (!ctx.callAi) warnings.push('The AI is not set up (no key), so the themes were made by the platform.');
    else {
      try {
        const raw = await ctx.callAi(aiPrompt({ name: ctx.name, host: ctx.host, profile: ctx.profile, brand, industry: detected, style, prefer, avoid, count }));
        const v = validateAiThemes(raw);
        warnings.push(...v.problems);
        ai = v.themes;
        if (!ai.length) warnings.push('None of the AI themes could be used, so the themes were made by the platform.');
      } catch (e) { warnings.push(`The AI could not be reached (${e.message}), so the themes were made by the platform.`); }
    }
  }
  if (ai?.length) {
    const built = ai.map((t) => buildTheme({ id: idOf(t.name, t.base), name: t.name, description: t.description, category, style: t.style, source: 'ai', mode, base: t.base }));
    // fill up to five with the local variations whose styles the AI did not cover
    const covered = new Set(built.map((b) => b.style).filter(Boolean));
    for (const l of themes) { if (built.length >= count) break; if (!covered.has(l.style)) built.push({ ...l, source: 'local' }); }
    themes = built;
  }
  themes = themes.slice(0, count);
  return { themes, meta: { strategy, anchorFrom, industry: detected ? { id: detected.id, label: detected.label, palette: detected.palette } : null, brandFound: Boolean(brand), usedAi: Boolean(ai?.length), warnings } };
}

export { compactTheme };
