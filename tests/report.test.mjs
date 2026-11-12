import test from 'node:test';
import assert from 'node:assert/strict';
import { csvOf } from '../src/report/render.js';
import { pairBars, bars, columns, donut } from '../src/report/charts.js';

test('a table exports to CSV with every row, quoted, whatever the text contains', () => {
  const csv = csvOf({ cols: [{ k: 'page', label: 'Page' }, { k: 'note', label: 'Note, with comma' }, { k: 'n', label: 'Count' }], rows: [{ page: 'a.html', note: 'He said "hi"\nthen left', n: 3 }, { page: 'b.html', note: null, n: 0 }] });
  assert.equal(csv, '"Page","Note, with comma","Count"\r\n"a.html","He said ""hi""\nthen left","3"\r\n"b.html","","0"');
});

test('charts draw one bar per value, escape their labels and cope with empty or all-zero data', () => {
  assert.equal(pairBars([]), '');
  assert.equal(bars([]), '');
  const svg = pairBars([{ label: 'A <b>', a: 10, b: 5 }, { label: 'Zero', a: 0, b: 0 }]);
  assert.match(svg, /A &lt;b&gt;/);
  assert.equal((svg.match(/class="c-before"/g) || []).length, 2 + 1); // two rows + the legend swatch
  assert.doesNotMatch(svg, /NaN/);
  assert.doesNotMatch(columns([{ label: 'x', a: 0, b: 0 }]), /NaN/);
  assert.doesNotMatch(donut([{ label: 'none', v: 0 }]), /NaN/);
  assert.match(donut([{ label: 'a', v: 3 }, { label: 'b', v: 1 }], { centre: '4' }), /75%/);
});
