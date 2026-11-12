import { buildClient } from './build.js';

// A page build that runs in the background and reports how far it has got, so the portal can show real progress.
const jobs = new Map();
export const buildJob = (slug) => jobs.get(slug) || null;

export function startBuildJob(slug, { limit } = {}) {
  if (jobs.get(slug)?.running) throw new Error('A build is already running');
  const job = { running: true, phase: 'starting', done: 0, total: 0, current: '', limit: limit || 0, startedAt: new Date().toISOString(), finishedAt: null, error: null, totals: null };
  jobs.set(slug, job);
  buildClient(slug, {
    limit,
    onProgress: (p) => {
      for (const k of ['total', 'done', 'phase']) if (p[k] !== undefined) job[k] = p[k];
      if (p.path) job.current = p.path;
    },
  })
    .then((r) => { job.totals = r.totals; job.phase = 'done'; job.done = job.total; })
    .catch((e) => { job.error = e.message; job.phase = 'failed'; })
    .finally(() => { job.running = false; job.finishedAt = new Date().toISOString(); });
  return job;
}
