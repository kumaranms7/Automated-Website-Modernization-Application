import fs from 'node:fs/promises';
import path from 'node:path';
import { clientDir } from '../config.js';
import { collectReport } from './data.js';
import { renderReport } from './render.js';
import { renderExecutive } from './executive.js';

// The modernisation report: built on demand (it reads and scores both versions of every page, so it runs as a background job), saved as
// reports/modernization-report.html with every table also saved as reports/csv/<table>.csv.

export const REPORT_FILE = 'modernization-report.html';
const jobs = new Map();
export const reportJob = (slug) => jobs.get(slug) || null;
export const reportDir = (slug) => path.join(clientDir(slug), 'reports');

export async function reportInfo(slug) {
  const st = await fs.stat(path.join(reportDir(slug), REPORT_FILE)).catch(() => null);
  const csv = await fs.readdir(path.join(reportDir(slug), 'csv')).catch(() => []);
  return { exists: Boolean(st), generatedAt: st ? st.mtime.toISOString() : null, bytes: st?.size || 0, csv: csv.filter((f) => f.endsWith('.csv')).sort() };
}

export function startReport(slug) {
  if (jobs.get(slug)?.running) throw new Error('The report is already being prepared');
  const job = { running: true, phase: 'starting', done: 0, total: 0, current: '', startedAt: new Date().toISOString(), finishedAt: null, error: null };
  jobs.set(slug, job);
  (async () => {
    const data = await collectReport(slug, { onProgress: (p) => { job.phase = p.phase; job.done = p.done; job.total = p.total; job.current = p.path || ''; } });
    job.phase = 'writing';
    const { csv } = renderReport(data); // the detailed tables are kept as CSV files
    const html = renderExecutive(data);
    const dir = reportDir(slug);
    await fs.mkdir(path.join(dir, 'csv'), { recursive: true });
    for (const f of await fs.readdir(path.join(dir, 'csv')).catch(() => [])) await fs.rm(path.join(dir, 'csv', f), { force: true });
    for (const [id, text] of Object.entries(csv)) await fs.writeFile(path.join(dir, 'csv', `${id}.csv`), `﻿${text}`);
    await fs.writeFile(path.join(dir, REPORT_FILE), html);
    job.phase = 'done';
  })()
    .catch((e) => { job.error = e.message; job.phase = 'failed'; })
    .finally(() => { job.running = false; job.finishedAt = new Date().toISOString(); });
  return job;
}
