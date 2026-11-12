import { loadClient } from '../config.js';
import { readSource } from '../util/source.js';
import { extractModel } from '../build/model.js';
import { loadSite } from '../build/site.js';
import { chosenPages } from '../template/api.js';
import { composeHome, refsOf } from '../template/home-compose.js';
import { plain } from '../util/html.js';

// The site's own home content, split into the pieces the studio designs with (hero, services, reviews, FAQ...).
export async function homeContent(slug) {
  const client = await loadClient(slug);
  const pages = await chosenPages(slug);
  if (!pages.home) throw new Error('No home page was found. Run a scan first.');
  const model = extractModel(await readSource(client, pages.home), pages.home);
  if (!model.ok) throw new Error('The home page could not be read: ' + model.reason);
  const site = await loadSite(client, slug);
  const comp = composeHome(model, site);
  const refs = [...refsOf(comp)].map(([ref, v]) => ({
    ref, type: v.type,
    title: plain(v.type === 'hero' ? v.hero.h1 : v.s.title || v.s.formTitle || v.s.sideTitle || '').slice(0, 70),
    count: v.s?.items?.length || v.s?.groups?.length || v.s?.blocks?.length || 0,
  }));
  return { client, model, site, comp, refs, path: pages.home };
}
