import test from 'node:test';
import assert from 'node:assert/strict';
import { detectStructure, isHubFile } from '../src/scanner/structure.js';
import { classify } from '../src/scanner/classify.js';
import { buildGraph, relatedLinks } from '../src/build/graph.js';
import { hasBusinessNode, isBusinessType } from '../src/head/schema.js';
import { countClaimRx } from '../src/content/validate.js';

// the trade and the places are different in each website below: nothing may depend on one of them
const PLUMBER = [
  'index.html', 'contact.html', 'drain-cleaning.html', 'water-heater-repair.html', 'sewer-line-replacement.html', 'pipe-repair.html', 'leak-detection.html', 'gas-line-installation.html', 'emergency-plumbing.html',
  'broward-plumber.html', 'palm-beach-plumber.html', 'local-plumber.html', 'boca-raton-plumbing.html',
  ...['boca-raton', 'delray-beach', 'west-palm-beach'].flatMap((c) => [`palm-beach-service-areas/${c}-plumber.html`, `palm-beach-service-areas/${c}-drain-repair.html`, `palm-beach-service-areas/${c}-sewer-repair.html`, `palm-beach-service-areas/${c}-pipe-installation.html`]),
  ...['miami', 'hialeah'].flatMap((c) => [`broward-service-areas/${c}-plumber.html`, `broward-service-areas/${c}-drain-repair.html`, `broward-service-areas/${c}-pipe-installation.html`]),
];
const DENTIST = [
  'index.html', 'about.html', 'teeth-whitening.html', 'dental-implants.html', 'root-canal-treatment.html', 'invisalign.html', 'emergency-dentist.html', 'north-dentist.html', 'south-dentist.html',
  ...['springfield', 'shelbyville', 'capital-city', 'ogdenville'].flatMap((c) => [`locations/${c}-dentist.html`, `locations/${c}-teeth-whitening.html`, `locations/${c}-dental-implants.html`, `locations/${c}-invisalign.html`]),
];

test('the folders of city pages and the word of a city page are found from the file names', () => {
  const p = detectStructure(PLUMBER);
  assert.deepEqual(p.locationDirs, ['broward-service-areas', 'palm-beach-service-areas']);
  assert.equal(p.cityWord, 'plumber');
  assert.equal(p.cities, 5);
  assert.deepEqual(p.placeStems, ['broward', 'palm-beach']);
  assert.ok(p.serviceSuffixes.includes('repair') && p.serviceSuffixes.includes('installation'));
  // a website of another trade, with other folder names and other words
  const d = detectStructure(DENTIST);
  assert.deepEqual(d.locationDirs, ['locations']);
  assert.equal(d.cityWord, 'dentist');
  assert.equal(d.cities, 4);
});

test('a folder with an unusual name is recognised by what is in it', () => {
  const files = ['index.html', ...['austin', 'dallas', 'el-paso', 'san-antonio'].flatMap((c) => [`texas/${c}-roofer.html`, `texas/${c}-roof-repair.html`, `texas/${c}-roof-replacement.html`, `texas/${c}-gutter-cleaning.html`])];
  const s = detectStructure(files);
  assert.deepEqual(s.locationDirs, ['texas']);
  assert.equal(s.cityWord, 'roofer');
  assert.equal(classify('texas/austin-gutter-cleaning.html', {}, s), 'location-service');
});

test('a website with no folders of cities has none, and nothing breaks', () => {
  const s = detectStructure(['index.html', 'about.html', 'blog/post-one.html', 'blog/post-two.html', 'services/web-design.html', 'services/seo.html']);
  assert.deepEqual(s.locationDirs, []);
  assert.equal(s.cityWord, '');
  assert.equal(s.cities, 0);
  assert.equal(classify('services/seo.html', {}, s), 'service');
  const g = buildGraph([{ path: 'index.html', type: 'home' }, { path: 'seo.html', type: 'service', title: 'SEO' }], s);
  assert.equal(Object.keys(g.cities).length, 0);
  assert.equal(g.services.length, 1);
});

test('hubs are found by the word of the website, not by a trade', () => {
  const p = detectStructure(PLUMBER);
  assert.equal(classify('broward-plumber.html', {}, p), 'location-hub');
  assert.equal(classify('local-plumber.html', {}, p), 'location-hub');
  assert.equal(classify('boca-raton-plumbing.html', {}, p), 'service', 'a city landing page is not a hub');
  assert.equal(classify('pipe-repair.html', {}, p), 'service');
  assert.equal(classify('palm-beach-service-areas/delray-beach-plumber.html', {}, p), 'location-service');
  const d = detectStructure(DENTIST);
  assert.equal(classify('north-dentist.html', {}, d), 'location-hub');
  assert.equal(classify('emergency-dentist.html', {}, d), 'location-hub', 'any page of the form <x>-<city word> is a hub unless a setting says otherwise');
  assert.equal(classify('emergency-dentist.html', { notHubs: ['emergency-dentist'] }, d), 'service');
  assert.equal(classify('service-areas.html', {}, {}), 'location-hub', 'the usual hub names work with no hints at all');
  assert.equal(isHubFile('invisalign', {}, d), false);
});

test('a website can correct what was found', () => {
  const p = detectStructure(PLUMBER, { cityWord: 'plumbing', locationDirs: ['extra-dir'] });
  assert.equal(p.cityWord, 'plumbing');
  assert.ok(p.locationDirs.includes('extra-dir'));
  assert.equal(classify('extra-dir/x.html', { locationDirs: ['extra-dir'] }, {}), 'location-service');
  assert.equal(classify('my-landing.html', { hubs: ['my-landing'] }, {}), 'location-hub');
});

const asPages = (paths, hints, cfg = {}) => paths.map((path) => ({ path, type: classify(path, cfg, hints), title: path.replace(/[-/.]/g, ' '), h1: [] }));

test('the graph of a plumbing website and of a dentist website are built the same way', () => {
  for (const [paths, word, cities, firstService] of [[PLUMBER, 'plumber', 5, 'drain-cleaning.html'], [DENTIST, 'dentist', 4, 'dental-implants.html']]) {
    const hints = detectStructure(paths);
    const g = buildGraph(asPages(paths, hints), hints);
    assert.equal(Object.keys(g.cities).length, cities, `${word}: cities`);
    assert.ok(g.services.some((s) => s.path === firstService), `${word}: services`);
    assert.equal(g.combos.length, paths.filter((x) => x.includes('/')).length - cities, `${word}: every page of a service in a city`);
    assert.ok(g.combos.every((c) => g.cities[c.city]), `${word}: every combo belongs to a city`);
    assert.ok(!g.services.some((s) => s.path === 'contact.html' || s.path === 'about.html' || s.path === 'index.html'), `${word}: contact, about and home are not services`);
    assert.ok(g.countyHubs.length >= 1, `${word}: hubs`);
  }
});

test('a city landing page and a page that only ends with the city word are told apart', () => {
  const paths = [...PLUMBER, 'palm-beach-service-areas/boca-raton-cast-iron-pipe-plumber.html', 'palm-beach-service-areas/boca-raton-cast-iron-pipe-repair.html', 'palm-beach-service-areas/boca-raton-cast-iron-pipe-inspection.html'];
  const hints = detectStructure(paths);
  const g = buildGraph(asPages(paths, hints), hints);
  assert.equal(Object.keys(g.cities).length, 5, 'a service in a city is not another city');
  assert.ok(g.combos.some((c) => c.path.endsWith('cast-iron-pipe-plumber.html')));
  assert.ok(!g.services.some((s) => s.path === 'boca-raton-plumbing.html'), 'a landing page of a city is not a service');
});

test('links between pages come from the graph of the website', () => {
  const hints = detectStructure(DENTIST);
  const g = buildGraph(asPages(DENTIST, hints), hints);
  const links = relatedLinks(g, 'locations/springfield-invisalign.html');
  assert.ok(links.some((l) => l.group === 'city' && l.path === 'locations/springfield-dentist.html'));
  assert.ok(links.some((l) => l.group === 'same-service' && l.path.endsWith('-invisalign.html')));
});

test('the business markup of a page is recognised for any business type', () => {
  assert.equal(hasBusinessNode([JSON.stringify({ '@type': 'Dentist', name: 'x' })]), true);
  assert.equal(hasBusinessNode([JSON.stringify({ '@graph': [{ '@type': 'WebPage' }, { '@type': ['Thing', 'Plumber'] }] })]), true);
  assert.equal(hasBusinessNode([JSON.stringify({ '@type': 'WebPage' }), 'not json']), false);
  assert.equal(isBusinessType('SomethingBusiness'), true);
});

test('the numbers that need proof follow the type of business', () => {
  const find = (t, bt) => [...t.matchAll(countClaimRx({ facts: { businessType: bt } }))].map((m) => m[0]);
  assert.deepEqual(find('25 plumbers and 30 years', 'Plumber'), ['25 plumbers', '30 years']);
  assert.deepEqual(find('25 plumbers and 12 dentists', 'Dentist'), ['12 dentists']);
  assert.deepEqual(find('500 customers', 'LocalBusiness'), ['500 customers']);
});

test('two one-word pages in every city: the word that also ends a hub is the word of the city page', () => {
  const files = ['index.html', 'gutters.html', 'austin-roofer.html', ...['austin', 'dallas', 'el-paso'].flatMap((c) => [`texas/${c}-roofer.html`, `texas/${c}-gutters.html`, `texas/${c}-roof-repair.html`, `texas/${c}-roof-replacement.html`])];
  assert.equal(detectStructure(files).cityWord, 'roofer');
});
