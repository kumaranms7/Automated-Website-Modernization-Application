import { callTool } from '../ai/claude.js';
import { getProfile } from '../profile/store.js';
import { loadActive } from '../template/store.js';
import { SECTION_TYPES } from '../template/section-meta.js';
import { DIRECTIONS, DEFAULT_DIRECTIONS, directionCatalog } from './directions.js';
import { homeContent } from './home.js';
import { readBrief, writeBrief } from './files.js';

// The design brief: what this website is, who it is for, what it must keep, and which art directions suit it. The facts
// come from the site itself; the AI only interprets them. It never adds business claims.

const arr = (item) => ({ type: 'array', items: item });
const str = { type: 'string' };
const BRIEF_TOOL = {
  name: 'submit_design_brief',
  description: 'Submit the design brief for this website.',
  input_schema: {
    type: 'object',
    properties: {
      industry: { ...str, description: 'The industry in a few words.' },
      businessType: { ...str, description: 'e.g. local service company, B2B software firm, studio, retailer.' },
      audience: { ...str, description: 'Who the site is for, one sentence.' },
      conversionGoal: { ...str, description: 'The main thing a visitor should do, e.g. call, request a quote, book.' },
      tone: arr(str),
      directions: { ...arr({ type: 'string', enum: Object.keys(DIRECTIONS) }), description: 'Exactly four different art directions that suit this business, best first.' },
      paletteNotes: { ...str, description: 'How the existing brand colours should be used.' },
      typographyNotes: { ...str, description: 'What kind of type suits the brand.' },
      risks: { ...arr(str), description: 'Content or design risks to watch for (thin content, small images, long headings...).' },
    },
    required: ['industry', 'businessType', 'audience', 'conversionGoal', 'tone', 'directions'],
  },
};

export async function buildBrief(slug) {
  const home = await homeContent(slug);
  const profile = await getProfile(slug);
  const { spec } = await loadActive(slug);
  const t = spec.tokens;
  const images = home.model.blocks.filter((b) => b.t === 'img').length + (home.comp.hero.image ? 1 : 0);
  const inventory = {
    page: home.path,
    sections: home.refs.map((r) => ({ ref: r.ref, type: r.type, label: SECTION_TYPES[r.type]?.label || r.type, title: r.title, count: r.count })),
    images, hasForm: Boolean(home.model.protected.form), trackingScripts: home.model.protected.headScripts.length,
    phone: home.site.phone?.display || '', address: home.site.address || '', menu: (home.site.nav || []).map((n) => n.label).slice(0, 10),
  };
  const facts = [
    `Business: ${profile.nap?.name || home.client.name}. Industry (from the profile): ${profile.industry || 'not set'}. ${profile.summary || ''}`,
    profile.tone ? `Tone of voice: ${profile.tone}` : '',
    `Home page content: ${inventory.sections.map((s) => `${s.label}${s.title ? ` "${s.title}"` : ''}${s.count ? ` (${s.count} items)` : ''}`).join('; ')}.`,
    `Images on the home page: ${images}. Contact form: ${inventory.hasForm ? 'yes' : 'no'}. Menu: ${inventory.menu.join(', ')}.`,
    `Current brand colours: primary ${t.primary}, accent ${t.accent}.`,
    spec.brief ? `What the client wrote about how the site should feel (follow it): ${spec.brief}` : '',
    `Art directions to choose from:\n${directionCatalog()}`,
  ].filter(Boolean).join('\n');
  let ai;
  try {
    const r = await callTool({
      slug, label: 'studio-brief', tool: BRIEF_TOOL, maxTokens: 1500,
      system: 'You are a senior brand and web strategist. From the facts given, write a short design brief for a website redesign. Use only what the facts support; never invent claims, awards or numbers. Choose exactly four different art directions that fit this kind of business, with the most suitable first.',
      user: facts,
    });
    ai = r.input;
  } catch (e) {
    ai = { industry: profile.industry || 'Not specified', businessType: 'Business website', audience: 'Visitors looking for this company\'s services', conversionGoal: inventory.phone ? 'Call or contact the company' : 'Contact the company', tone: [], directions: DEFAULT_DIRECTIONS, paletteNotes: '', typographyNotes: '', risks: [`The AI brief could not be written (${e.message}); defaults were used.`] };
  }
  const dirs = [...new Set([...(ai.directions || []).filter((d) => DIRECTIONS[d]), ...DEFAULT_DIRECTIONS])].slice(0, 4);
  const brief = {
    createdAt: new Date().toISOString(),
    userBrief: spec.brief || '',
    brand: { primary: t.primary, accent: t.accent, ink: t.ink, soft: t.soft, primaryDark: t.primaryDark },
    preserve: [
      'All headings, paragraphs, lists and links from the original home page',
      inventory.phone && `Phone number ${inventory.phone}`, inventory.address && `Address ${inventory.address}`,
      inventory.hasForm && 'The contact form, its fields and its action', inventory.trackingScripts && 'Analytics and tracking scripts', 'Page title, description and structured data',
    ].filter(Boolean),
    inventory, ai: { ...ai, directions: dirs },
  };
  await writeBrief(slug, brief);
  return brief;
}

// The colours and the written wishes live on the Configuration tab; the brief always reads them from there.
export async function syncedBrief(slug) {
  const have = await readBrief(slug);
  if (!have) return null;
  const { spec } = await loadActive(slug);
  const t = spec.tokens;
  return { ...have, brand: { primary: t.primary, accent: t.accent, ink: t.ink, soft: t.soft, primaryDark: t.primaryDark }, userBrief: spec.brief || '' };
}

export async function ensureBrief(slug, { refresh = false } = {}) {
  const have = await readBrief(slug);
  const { spec } = await loadActive(slug);
  // the written wishes changed on the Configuration tab: interpret them again
  if (!have || refresh || (have.userBrief || '') !== (spec.brief || '')) return buildBrief(slug);
  return syncedBrief(slug);
}
