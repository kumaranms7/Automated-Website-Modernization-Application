// Mobile menu, dropdown toggles, back-to-top and footer year. No dependencies.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const nav = $('#site-nav');
const btn = $('#menu-btn');

function setOpen(el, open) {
  el.dataset.open = String(open);
}

btn?.addEventListener('click', () => {
  const open = nav.dataset.open !== 'true';
  setOpen(nav, open);
  btn.setAttribute('aria-expanded', String(open));
});

for (const t of $$('.nav-toggle')) {
  t.addEventListener('click', () => {
    const panel = t.closest('li').querySelector('[data-panel]');
    const open = panel.dataset.open !== 'true';
    setOpen(panel, open);
    t.setAttribute('aria-expanded', String(open));
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  $$('[data-open="true"]').forEach((el) => setOpen(el, false));
  $$('[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
});

const top = $('#to-top');
if (top) {
  const toggle = () => top.classList.toggle('hidden', scrollY < 600) || top.classList.toggle('grid', scrollY >= 600);
  addEventListener('scroll', toggle, { passive: true });
  top.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  toggle();
}

$$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
