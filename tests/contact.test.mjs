import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { parseAddressLine, structuredBusiness, contactText, contactFromPages } from '../src/profile/contact.js';
import { pageText } from '../src/profile/fromUrl.js';
import { verifyFacts, corpusOf } from '../src/profile/facts.js';

const ADDR = { street: '2520 N Powerline Road, Suite 302', city: 'Pompano Beach', region: 'FL', postal: '33069' };
const doc = (html, url = 'https://x.test/') => ({ url, ...pageText(html) });

test('an address written in any of the usual ways is split into its parts', () => {
  for (const t of [
    '2520 N Powerline Road, Suite 302, Pompano Beach, FL 33069',
    'Address 2520 N Powerline Road, Suite 302, Pompano Beach, FL 33069 Phone Number (954) 592-6220',
    'Phone (954) 592-6220 2520 N Powerline Road, Suite 302, Pompano Beach, FL 33069 Hours Mon-Fri',
    '2520 N Powerline Road, Suite 302 | Pompano Beach | FL 33069',
  ]) assert.deepEqual(parseAddressLine(t), ADDR, t);
  assert.deepEqual(parseAddressLine('Call us 24/7. 2520 N Powerline Road, Pompano Beach, FL 33069'), { street: '2520 N Powerline Road', city: 'Pompano Beach', region: 'FL', postal: '33069' });
  assert.deepEqual(parseAddressLine('Visit 2520 N Powerline Road Pompano Beach, FL 33069'), { street: '2520 N Powerline Road', city: 'Pompano Beach', region: 'FL', postal: '33069' });
  assert.deepEqual(parseAddressLine('Find us at 100 King St W, Toronto, ON M5X 1A9'), { street: '100 King St W', city: 'Toronto', region: 'ON', postal: 'M5X 1A9' });
  assert.equal(parseAddressLine('We have served 12345 customers since 2001. Call today.'), null, 'a number that is not a postal code with a state is not an address');
  assert.equal(parseAddressLine(''), null);
});

const LD = (extra = '') => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: 'x' }, { '@type': ['LocalBusiness', 'Plumber'], name: 'Acme Plumbing', telephone: '+1-954-592-6220', priceRange: '$$', address: { '@type': 'PostalAddress', streetAddress: ADDR.street, addressLocality: ADDR.city, addressRegion: 'FL', postalCode: '33069', addressCountry: 'US' }, openingHoursSpecification: [{ dayOfWeek: ['Monday', 'Tuesday'], opens: '08:00:00', closes: '17:00:00' }], ...JSON.parse(extra || '{}') }] })}</script>`;

test('the structured data of a page gives the address, phone, hours and price range', () => {
  const s = structuredBusiness(cheerio.load(`<html><head>${LD()}</head><body>x</body></html>`));
  assert.deepEqual({ name: s.name, phone: s.phone, priceRange: s.priceRange, country: s.country, hours: s.hours }, { name: 'Acme Plumbing', phone: '+1-954-592-6220', priceRange: '$$', country: 'US', hours: ['Mo,Tu 08:00-17:00'] });
  assert.deepEqual({ street: s.street, city: s.city, region: s.region, postal: s.postal }, ADDR);
  const text = structuredBusiness(cheerio.load(`<head>${LD('{"address":"2520 N Powerline Road, Suite 302, Pompano Beach, FL 33069"}')}</head>`));
  assert.equal(text.city, 'Pompano Beach', 'an address written as one line is split too');
});

test('an address only in the footer is no longer thrown away with the footer', () => {
  const html = '<html><head><title>Acme</title></head><body><nav>Menu</nav><main><h1>Plumbing</h1><p>We fix pipes.</p></main><footer><p>Address 2520 N Powerline Road, Suite 302, Pompano Beach, FL 33069</p><p>Phone (954) 592-6220</p></footer></body></html>';
  const d = doc(html);
  assert.ok(!d.text.includes('Powerline'), 'the main text still leaves the footer out');
  assert.ok(d.contact.includes('2520 N Powerline Road'), 'the footer is kept for the profile');
  const found = contactFromPages([d]);
  assert.deepEqual({ street: found.street, city: found.city, region: found.region, postal: found.postal }, ADDR);
  assert.equal(found.line, '2520 N Powerline Road, Suite 302, Pompano Beach, FL 33069');
  assert.equal(found.source, 'the footer of the page');
  // and what is found is not dropped as "not on the site"
  const { facts, dropped } = verifyFacts({ ...ADDR, businessType: 'Plumber' }, corpusOf([d]));
  assert.deepEqual(dropped, []);
  assert.equal(facts.street, ADDR.street);
});

test('before the fix, the same address was dropped: the check only looked at the main text', () => {
  const d = doc('<html><body><main><p>We fix pipes.</p></main><footer>2520 N Powerline Road, Suite 302, Pompano Beach, FL 33069</footer></body></html>');
  const onlyMain = verifyFacts(ADDR, `${d.title} ${d.text}`);
  assert.ok(onlyMain.dropped.length >= 3, 'what the old corpus allowed');
  assert.deepEqual(verifyFacts(ADDR, corpusOf([d])).dropped, []);
});

test('the address tag, microdata and the contact page are read', () => {
  const tag = contactFromPages([doc('<html><body><main>x</main><address>2520 N Powerline Road, Suite 302<br>Pompano Beach, FL 33069</address></body></html>')]);
  assert.equal(tag.city, 'Pompano Beach');
  assert.equal(tag.source, 'the address of the page');
  const micro = contactFromPages([doc('<html><body><div itemscope itemtype="https://schema.org/PostalAddress"><span itemprop="streetAddress">9 Elm St</span><span itemprop="addressLocality">Austin</span><span itemprop="addressRegion">TX</span><span itemprop="postalCode">73301</span></div></body></html>')]);
  assert.deepEqual({ street: micro.street, city: micro.city, region: micro.region, postal: micro.postal }, { street: '9 Elm St', city: 'Austin', region: 'TX', postal: '73301' });
  // the home page says nothing, the contact page has it
  const pages = [doc('<html><body><main>Welcome</main></body></html>'), doc('<html><body><main>Contact us</main><footer>Find us: 9 Elm St, Austin, TX 73301</footer></body></html>', 'https://x.test/contact.html')];
  assert.equal(contactFromPages(pages).city, 'Austin');
});

test('a website that states no address gives no address, and a phone link is still found', () => {
  const found = contactFromPages([doc('<html><body><main>We fix pipes.</main><footer><a href="tel:+19545926220">Call</a></footer></body></html>')]);
  assert.equal(found.line, '');
  assert.equal(found.street, '');
  assert.equal(found.phone, '+19545926220');
});

test('the structured data wins over what is written in the footer', () => {
  const d = doc(`<html><head>${LD()}</head><body><main>x</main><footer>Old office: 1 Old Rd, Miami, FL 33101</footer></body></html>`);
  assert.equal(contactFromPages([d]).city, 'Pompano Beach');
  assert.ok(contactText(cheerio.load(`<head>${LD()}</head>`)).includes('Pompano Beach'), 'and the AI is shown it');
});
