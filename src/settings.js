import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { DATA_DIR, readJson, writeJson } from './config.js';
import { APP } from './app-settings.js';

// Stored locally, git-ignored, and never sent back to the browser (only a masked hint is).
const FILE = process.env.SETTINGS_FILE || path.join(DATA_DIR, 'settings.local.json');
// the default model and the models offered are in app-settings.js
export const MODELS = APP.model.list;

export async function applySettings() {
  const s = await readJson(FILE, {});
  if (s.apiKey) process.env.ANTHROPIC_API_KEY = s.apiKey;
  if (s.model) process.env.CLAUDE_MODEL = s.model;
}

export async function getPublicSettings() {
  const key = process.env.ANTHROPIC_API_KEY || '';
  return {
    hasKey: Boolean(key),
    keyHint: key ? `${key.slice(0, 7)}…${key.slice(-4)}` : '',
    model: process.env.CLAUDE_MODEL || APP.model.default,
  };
}

export async function saveSettings({ apiKey, model }) {
  const s = await readJson(FILE, {});
  if (apiKey !== undefined && apiKey !== '') {
    // Tolerate quotes, "Bearer ", "KEY=" prefixes and stray whitespace from copy/paste.
    const k = String(apiKey).replace(/\s+/g, '').replace(/^["']|["']$/g, '').replace(/^(Bearer|ANTHROPIC_API_KEY=)/i, '');
    if (!/^sk-[\w-]{20,}$/.test(k)) throw new Error('That does not look like an Anthropic API key (it starts with sk-ant-)');
    s.apiKey = k;
  }
  if (model) {
    if (!/^[\w.-]{3,80}$/.test(String(model))) throw new Error('Invalid model id');
    s.model = String(model).trim();
  }
  await writeJson(FILE, s);
  await applySettings();
  return getPublicSettings();
}

export async function clearKey() {
  const s = await readJson(FILE, {});
  delete s.apiKey;
  await writeJson(FILE, s);
  delete process.env.ANTHROPIC_API_KEY;
  return getPublicSettings();
}

export async function testConnection() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('No API key saved yet');
  try {
    await new Anthropic().messages.create({
      model: process.env.CLAUDE_MODEL || APP.model.default,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });
    return { ok: true };
  } catch (e) {
    const why = e.status === 401 ? 'Anthropic rejected this key (401) — check it was copied in full'
      : e.status === 404 ? 'That model is not available to this key — pick another model'
      : e.status === 400 && /credit/i.test(e.message) ? 'The key is valid but the account has no credit — add billing at console.anthropic.com'
      : `Connection failed: ${e.message}`;
    throw new Error(why);
  }
}

// Live list from the API when a key exists; falls back to the built-in list.
export async function listModels() {
  const base = MODELS.map((m) => ({ ...m }));
  if (!process.env.ANTHROPIC_API_KEY) return base;
  try {
    const page = await new Anthropic().models.list({ limit: 50 });
    const known = new Set(base.map((m) => m.id));
    for (const m of page.data) if (!known.has(m.id)) base.push({ id: m.id, label: m.display_name || m.id });
  } catch { /* offline or key lacks access: keep built-in list */ }
  return base;
}
