import path from 'node:path';
import { APP } from './app-settings.js';
import { clientDir, writeJson, readJson, listClients, loadClient } from './config.js';
import { scanClient } from './scanner/scan.js';
import { buildClient } from './build/build.js';
import { extractSite } from './build/site.js';
import { planPages, estimate, generatePage } from './content/generate.js';
import { applySettings } from './settings.js';
import { planImages, startInplace, inplaceJob } from './images/inplace.js';
import { detectBrand } from './build/brand-detect.js';
import { saveDraft } from './template/store.js';
import { validateSite, loadValidation } from './validate/site.js';
import { createPackage, deployToFolder, rollbackFromFolder } from './publish/package.js';
import { pickSample, startBrowserRun, loadBrowserResults } from './validate/browser.js';

const [cmd, ...args] = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : undefined; };

async function main() {
  await applySettings();
  if (cmd === 'add-client') {
    const [slug, sourceDir, host, name] = args;
    if (!slug || !sourceDir || !host) throw new Error('Usage: add-client <slug> <sourceDir> <host> [name]');
    const file = path.join(clientDir(slug), 'client.json');
    if (await readJson(file)) throw new Error(`Client ${slug} already exists`);
    await writeJson(file, { name: name || slug, host, sourceDir: path.resolve(sourceDir), classify: {} });
    console.log(`Created clients/${slug}/client.json`);
  } else if (cmd === 'scan') {
    if (!args[0]) throw new Error('Usage: scan <slug>');
    console.log(JSON.stringify(await scanClient(args[0]), null, 2));
  } else if (cmd === 'site') {
    console.log(JSON.stringify(await extractSite(await loadClient(args[0]), args[0]), null, 2).slice(0, 1800));
  } else if (cmd === 'build') {
    const r = await buildClient(args[0], {
      limit: Number(opt('--limit')) || undefined, types: opt('--type')?.split(','),
      content: opt('--content'), only: opt('--paths')?.split(','), log: console.log,
    });
    console.log(JSON.stringify(r.totals));
  } else if (cmd === 'content') {
    const slug = args[0];
    const plan = await planPages(slug);
    if (args[1] === 'plan') {
      console.table(plan.slice(0, 60).map(({ path: p, type, mode, status }) => ({ path: p, type, mode, status })));
      console.log(plan.length, 'pages');
      return;
    }
    const paths = opt('--paths')
      ? opt('--paths').split(',')
      : plan.filter((p) => !opt('--mode') || p.mode === opt('--mode')).slice(0, Number(opt('--limit')) || plan.length).map((p) => p.path);
    if (args[1] === 'estimate') { console.log(await estimate(slug, paths)); return; }
    for (const p of paths) {
      const r = await generatePage(slug, p, { force: args.includes('--force') });
      console.log(r.status.padEnd(13), r.mode.padEnd(9), `$${r.cost}`, p, r.issues.map((i) => `${i.level[0]}:${i.id}`).join(','));
    }
  } else if (cmd === 'validate') {
    const v = await validateSite(args[0], { skipBuild: args.includes('--skip-build'), log: console.log });
    console.log(v.totals);
    const worst = Object.entries(v.checks).filter(([, c]) => c.failed).sort((a, b) => b[1].failed - a[1].failed).slice(0, 12);
    console.table(worst.map(([id, c]) => ({ check: id, applicable: c.applicable, failed: c.failed })));
  } else if (cmd === 'browser') {
    const v = await loadValidation(args[0]);
    if (!v) throw new Error('Run validate first');
    const paths = opt('--paths') ? opt('--paths').split(',') : pickSample(v, Number(opt('--limit')) || APP.limits.browserTestPages);
    const job = startBrowserRun(args[0], paths);
    while (job.running) { await new Promise((r) => setTimeout(r, 2000)); process.stdout.write(`\r${job.done}/${job.total} `); }
    const out = await loadBrowserResults(args[0]);
    console.log('\n', out?.summary, job.errors);
  } else if (cmd === 'package') {
    const canary = Number(opt('--canary')) || 0;
    const m = await createPackage(args[0], { scope: canary ? 'canary' : 'ready', count: canary || 10, note: opt('--note') || '' });
    console.log(m.id, m.totals);
  } else if (cmd === 'deploy-test') {
    console.log(await deployToFolder(args[0], args[1], args[2], { force: args.includes('--force') }));
  } else if (cmd === 'rollback-test') {
    console.log(await rollbackFromFolder(args[0], args[1], args[2], { force: args.includes('--force') }));
  } else if (cmd === 'brand-detect') {
    const colours = await detectBrand(args[0]);
    await saveDraft(args[0], { tokens: colours }, { note: 'Colours detected from the logo' });
    console.log(colours);
  } else if (cmd === 'images') {
    if (args[1] === 'plan') {
      const p = await planImages(args[0]);
      console.log({ site: p.site, counts: p.counts, bytes: p.bytes, rewriteFiles: p.rewriteFiles, broken: p.brokenCount, uncertain: p.uncertainDirs, warnings: p.warnings });
    } else {
      const job = startInplace(args[0], {});
      while (job.running) { await new Promise((r) => setTimeout(r, 1500)); process.stdout.write(`\r${job.phase} ${job.done}/${job.total}   `); }
      console.log('\n', job.error || job.result?.totals, job.result?.status);
    }
  } else if (cmd === 'list') {
    console.table((await listClients()).map(({ slug, name, host }) => ({ slug, name, host })));
  } else {
    console.log('Commands: add-client | scan <slug> | site <slug> | build <slug> [--limit N] [--content approved|all|none] [--paths a,b] | content <slug> plan|estimate|[--limit N --mode rewrite|optimize --paths a,b --force] | list');
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
