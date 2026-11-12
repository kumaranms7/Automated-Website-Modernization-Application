import * as cheerio from 'cheerio';

// Fills a section recipe (see own-patterns.js) with a page's data.

const isHtml = (v) => /<[a-z][\s\S]*>/i.test(String(v));
function slot($, root, name) { return root.find(`[data-slot~="${name}"]`).addBack(`[data-slot~="${name}"]`); }
function setValue(el, v) { if (isHtml(v)) el.html(v); else el.text(String(v ?? '')); }

function fillItem(html, it) {
  const $ = cheerio.load(html, null, false);
  const root = $.root().children().first();
  const get = (n) => slot($, root, n);
  const val = (n, v) => { const el = get(n); if (!el.length) return; if (v == null || v === '') el.remove(); else setValue(el, v); };
  val('title', it.title); val('text', it.text);
  if (get('q').length) setValue(get('q'), it.q);
  if (get('a').length) setValue(get('a'), it.a);
  if (get('quote').length) setValue(get('quote'), it.quote);
  val('name', it.name);
  const link = get('link');
  if (link.length) { if (it.href) link.attr('href', it.href); else link.removeAttr('href'); }
  if (get('label').length) get('label').text(it.title || it.label || '');
  const img = get('img'); if (img.length) { if (it.img) img.attr('src', it.img).attr('alt', it.imgAlt || '').removeAttr('srcset').removeAttr('sizes'); else img.remove(); }
  const icon = get('icon'); if (icon.length) { if (it.icon) icon.attr('src', it.icon); else icon.remove(); }
  root.find('[data-slot]').addBack('[data-slot]').removeAttr('data-slot');
  return $.html(root);
}

export function fillPattern(recipe, data) {
  const $ = cheerio.load(recipe.wrapperHtml, null, false);
  const root = $.root().children().first();
  const title = slot($, root, 'title');
  if (title.length) {
    if (data.title) setValue(title, data.title);
    else {
      // no title: the block that held the template's label, title, intro and rule goes with it, so no empty gap is left
      const head = title.parent();
      if (head.length && !head.is(root) && !head.is('[data-slot~="items"]') && !head.find('[data-slot~="items"]').length) head.remove(); else title.remove();
    }
  }
  const box = slot($, root, 'items');
  if (box.length && recipe.itemHtml) box.append((data.items || []).map((it) => fillItem(recipe.itemHtml, it)).join('\n'));
  const text = slot($, root, 'text'); if (text.length && !box.length) { if (data.text) setValue(text, data.text); else text.remove(); }
  const btn = slot($, root, 'btn');
  if (btn.length) { if (data.href) btn.attr('href', data.href); btn.text(data.label || 'Call now'); }
  root.find('[data-slot]').addBack('[data-slot]').removeAttr('data-slot');
  return $.html(root);
}

