import fs from 'node:fs/promises';

// Legacy pages are a mix of UTF-8 and Windows-1252 bytes. Decoding blindly as UTF-8 turns
// curly quotes and non-breaking spaces into U+FFFD, so try strict UTF-8 first and fall back.
export async function readHtml(file) {
  const buf = await fs.readFile(file);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }
  return text.replace(/^﻿/, '');
}

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©' };
export const decodeEntities = (s) => String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
export const plain = (s) => decodeEntities(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
