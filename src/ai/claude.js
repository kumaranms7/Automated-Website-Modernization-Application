import Anthropic from '@anthropic-ai/sdk';
import { APP } from '../app-settings.js';
import path from 'node:path';
import { clientDir, readJson, writeJson } from '../config.js';

// $ per million tokens (input, output) and the cache prices come from app-settings.js
export const modelId = () => process.env.CLAUDE_MODEL || APP.model.default;
export const ratesFor = (model) => APP.prices[model] || null;

export function costOf(model, u) {
  const r = APP.prices[model];
  if (!r) return 0;
  const inTok = u.input_tokens || 0, cacheR = u.cache_read_input_tokens || 0, cacheW = u.cache_creation_input_tokens || 0, out = u.output_tokens || 0;
  return ((inTok + cacheW * APP.cache.writeOfInput) * r[0] + cacheR * r[0] * APP.cache.readOfInput + out * r[1]) / 1e6;
}

export function estimateCost(model, inTokens, outTokens) {
  const r = APP.prices[model];
  return r ? (inTokens * r[0] + outTokens * r[1]) / 1e6 : null;
}

let client;
const getClient = () => (client ||= new Anthropic({ maxRetries: APP.limits.aiRetries }));

async function recordUsage(slug, model, usage, label) {
  if (!slug) return;
  const file = path.join(clientDir(slug), 'usage.json');
  const u = await readJson(file, { calls: 0, input: 0, output: 0, cost: 0, byLabel: {} });
  u.calls += 1;
  u.input += (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  u.output += usage.output_tokens || 0;
  const c = costOf(model, usage);
  u.cost = +(u.cost + c).toFixed(5);
  u.byLabel[label] = +((u.byLabel[label] || 0) + c).toFixed(5);
  await writeJson(file, u);
  return c;
}

// One structured call. The model is asked to call `tool` once; forced tool_choice is not supported
// on current models, so a plain-text JSON answer is accepted as a fallback.
export async function callTool({ slug, label, system, user, userContent, tool, maxTokens = 8000 }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  const model = modelId();
  const res = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    tools: [tool],
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: userContent || user }],
  });
  const cost = await recordUsage(slug, model, res.usage, label);
  const block = res.content.find((b) => b.type === 'tool_use');
  let input = block?.input;
  if (!input) {
    const raw = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    try { input = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { /* handled below */ }
  }
  if (!input) throw new Error(res.stop_reason === 'max_tokens' ? 'AI response was cut off' : 'AI returned no structured answer');
  return { input, usage: res.usage, cost, model };
}
