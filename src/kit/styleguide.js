import { esc, icon, T, head, btn, checkList, sec, stars } from './ui.js';
import { HERO, LIBRARY, quoteForm } from './sections.js';
import { context, wrapDocument } from './page.js';

// The style guide of a design: how every plain element and every basic content layout looks in it. Any page content, whatever its shape,
// is drawn with these, so the guide is what to approve before real pages are built.

const group = (title, note, inner) => `<section class="border-t border-default py-12"><div class="${T.wrap}"><div class="mb-8 grid gap-1"><h2 class="font-display text-2xl font-bold tracking-tight text-heading">${esc(title)}</h2>${note ? `<p class="text-sm text-muted">${esc(note)}</p>` : ''}</div>${inner}</div></section>`;
const tag = (t) => `<span class="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">${t}</span>`;
const callout = (kind, title, text) => {
  const c = { info: 'border-sky-500 bg-sky-500/10', success: 'border-emerald-500 bg-emerald-500/10', warning: 'border-amber-500 bg-amber-500/10', error: 'border-rose-500 bg-rose-500/10' }[kind];
  return `<div class="rounded-r-ks border-l-4 ${c} p-5"><b class="block text-heading">${title}</b><p class="mt-1 text-secondary">${text}</p></div>`;
};

export function styleGuide({ design, pc, spec, css }) {
  const K = context({ site: pc.site, pack: pc.pack, nav: [['Home', '/'], ['Services', '#'], ['About', '#'], ['Contact', '#']].map(([label, href]) => ({ label, href })) });
  const d = pc.data;
  const prose = `<div class="prose-k max-w-3xl"><h1>Heading one</h1><p class="${T.lead}">A lead paragraph introduces the page in a larger size and a calmer colour.</p><h2>Heading two</h2><p>Body text is set for reading: a comfortable size, generous line height and a measure that never gets too wide. It can hold <strong>strong text</strong>, <em>emphasis</em>, <mark>highlighted words</mark>, <a href="#">a link</a>, <code>inline code</code> and <small>small print</small>.</p><h3>Heading three</h3><ul><li>An unordered list item with a coloured marker</li><li>Another item that is long enough to wrap onto a second line so the spacing and hanging indent can be checked at a glance</li><li>A third item<ul><li>A nested item</li><li>Another nested item</li></ul></li></ul><h4>Heading four</h4><ol><li>The first numbered step</li><li>The second numbered step</li><li>The third numbered step</li></ol><h5>Heading five</h5><blockquote><p>A quotation stands out with a rule and a soft tint, in the design's own voice.</p></blockquote><hr><dl><dt>A term</dt><dd>Its description, set in the body colour.</dd><dt>Another term</dt><dd>And its description.</dd></dl><h6>Heading six</h6><details><summary>A native disclosure element</summary><p>Its content opens below the summary.</p></details></div>`;
  const table = `<div class="prose-k max-w-none overflow-x-auto"><table><thead><tr><th>What matters</th><th>This business</th><th>Others</th></tr></thead><tbody><tr><td>Same-day service</td><td>Available for most jobs</td><td>Often limited</td></tr><tr><td>Upfront pricing</td><td>Always in writing</td><td>Varies</td></tr><tr><td>Insured crews</td><td>Yes</td><td>Sometimes</td></tr></tbody></table></div>`;
  const figure = `<figure class="prose-k grid max-w-xl gap-2"><div class="${T.pic} aspect-[16/9]">${LIBRARY.gallery ? '' : ''}<div class="grid size-full place-items-center bg-linear-to-br from-brand to-accent text-white">${icon('image', 'size-12')}</div></div><figcaption>A figure with its caption, rounded with the design's corners.</figcaption></figure>`;
  const buttons = `<div class="flex flex-wrap items-center gap-3">${btn({ text: 'Primary', href: '#' }, 'primary')}${btn({ text: 'Accent', href: '#' }, 'accent')}${btn({ text: 'Ghost', href: '#' }, 'ghost')}${btn({ text: 'Large', href: '#' }, 'primary', true, true)}<span class="on-dark flex gap-3 rounded-k bg-night p-3">${btn({ text: 'Light', href: '#' }, 'light', false)}${btn({ text: 'Outline', href: '#' }, 'outline', false)}</span></div>`;
  const chips = `<div class="flex flex-wrap items-center gap-2.5">${[tag('Tag'), `<span class="${T.chip}">${icon('shield')}Chip</span>`, `<span class="rounded-full bg-accent px-3 py-1 text-xs font-extrabold tracking-wider text-white uppercase">Badge</span>`, stars()].join('')}<nav class="ml-4 flex gap-1.5 text-sm font-semibold text-muted" aria-label="Breadcrumb"><a class="hover:text-brand" href="#">Home</a><span>/</span><a class="hover:text-brand" href="#">Services</a><span>/</span><span class="text-heading">Page</span></nav></div><nav class="mt-6 flex gap-2" aria-label="Pagination">${['‹', '1', '2', '3', '›'].map((p, i) => `<a class="grid size-10 place-items-center rounded-ks border border-default font-bold ${i === 1 ? 'border-brand bg-brand text-white' : 'text-heading hover:border-brand'}" href="#">${p}</a>`).join('')}</nav>`;
  const forms = `<div class="form-k grid max-w-xl gap-4"><div class="grid gap-1.5"><label for="sg-1">Text input</label><input id="sg-1" placeholder="Your name"></div><div class="grid gap-1.5"><label for="sg-2">Select</label><select id="sg-2"><option>Choose a service</option><option>Another option</option></select></div><div class="grid gap-1.5"><label for="sg-3">Textarea</label><textarea id="sg-3" rows="3" placeholder="Your message"></textarea></div><div class="flex flex-wrap gap-6"><label class="flex items-center gap-2.5 font-semibold"><input type="checkbox" class="size-5 accent-[var(--th-brand-primary)]" checked> A checkbox</label><label class="flex items-center gap-2.5 font-semibold"><input type="radio" name="sg" class="size-5 accent-[var(--th-brand-primary)]" checked> A radio</label></div></div>`;
  const alerts = `<div class="grid max-w-3xl gap-3">${callout('info', 'Good to know', 'A neutral note that adds context.')}${callout('success', 'All set', 'Your request was received.')}${callout('warning', 'Check this', 'Something needs a second look.')}${callout('error', 'Something went wrong', 'Please try again.')}</div>`;
  const text = [{ t: 'html', html: '<p>Image and content side by side: the picture and the copy share a row, and swap sides from one section to the next.</p>' }, { t: 'html', html: '<p>The copy keeps its own paragraphs, links and lists, and stays easy to read at any width.</p>' }];
  const layouts = [
    ['Image and content, image right', LIBRARY.about['image-right']({ eyebrow: 'About', title: 'Image beside the content', blocks: text, items: ['A first point', 'A second point', 'A third point'] }, K)],
    ['Image and content, image left', LIBRARY.about['image-left']({ eyebrow: 'About', title: 'Image on the other side', blocks: text, items: ['A first point', 'A second point'] }, K)],
    ['Full-width content only', LIBRARY.about.full({ eyebrow: 'Content', title: 'A section of text on its own', blocks: [...text, ...text, ...text] }, K)],
    ['Narrow reading column', LIBRARY.about.plain({ blocks: text }, K)],
    ['Text with a sticky heading', LIBRARY.about.story({ eyebrow: 'Story', title: 'A heading that stays in view', blocks: [...text, ...text] }, K)],
    ['Centered statement', LIBRARY.about.centered({ eyebrow: 'Our promise', title: 'Centered content', blocks: text }, K)],
    ['Pull quote', LIBRARY.about.quote({ quote: 'A quote set large, on the brand colour, for the one sentence people should remember.' }, K)],
  ].map(([n, h]) => `<div class="border-t border-default"><p class="${T.wrap} pt-4 text-xs font-bold tracking-widest text-muted uppercase">${esc(n)}</p>${h}</div>`).join('');
  const body = [
    HERO[design.home[0].variant](pc.pages.home.hero, K),
    group('Typography, lists and inline elements', 'Headings h1 to h6, paragraphs, lead text, strong, em, mark, links, code, lists, nested lists, quotes, rules, definition lists, disclosure.', prose),
    group('Tables, images and figures', '', `<div class="grid gap-10">${table}${figure}</div>`),
    group('Buttons, tags, chips, breadcrumbs, pagination', '', buttons + `<div class="mt-8">${chips}</div>`),
    group('Forms', 'Inputs, select, textarea, checkbox, radio, labels and the lead form.', `<div class="grid gap-10 lg:grid-cols-2">${forms}${quoteForm(K, 'Request a quote', 'The lead form of the design.')}</div>`),
    group('Notices', '', alerts),
    group('Lists with icons', '', `<div class="grid gap-8 md:grid-cols-2">${checkList(['A check list item', 'Another check list item', 'And a third'])}${checkList(['Two columns', 'On wide screens', 'Of check items', 'In the design'], true)}</div>`),
    `<div class="border-t border-default pt-10"><div class="${T.wrap}"><h2 class="font-display text-2xl font-bold tracking-tight text-heading">Content layouts</h2></div></div>${layouts}`,
    `<div class="border-t border-default pt-10"><div class="${T.wrap}"><h2 class="font-display text-2xl font-bold tracking-tight text-heading">Sections</h2></div></div>`,
    LIBRARY.cta[(design.home.find((b) => b.type === 'cta') || { variant: 'gradient' }).variant](d.cta, K),
    LIBRARY.reviews[(design.home.find((b) => b.type === 'reviews') || { variant: 'grid' }).variant](d.reviews, K),
    LIBRARY.faq[(design.home.find((b) => b.type === 'faq') || { variant: 'accordion' }).variant](d.faq, K),
    LIBRARY.stats[(design.home.find((b) => b.type === 'stats') || { variant: 'cards' }).variant](d.stats, K),
    LIBRARY.tabs.horizontal(d.tabs, K),
    LIBRARY.compare.slider({}, K),
    LIBRARY.team.cards({}, K),
    LIBRARY.pricing.toggle({}, K),
    LIBRARY.blog.cards({}, K),
    LIBRARY.map.embed({}, K),
  ].join('\n');
  void sec; void head;
  return wrapDocument({ design, K, body, title: `${design.name} style guide`, active: spec, fontsBase: '/studio-fonts/', css });
}
