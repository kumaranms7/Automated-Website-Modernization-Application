// The site's existing accessibility widget needs jQuery. Load both only after the page is idle
// so they never block rendering.
const tag = document.querySelector('script[data-ada]');
const load = (src) => new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = src;
  s.onload = ok;
  s.onerror = fail;
  document.head.append(s);
});

const start = async () => {
  if (!tag || window.__adaLoaded) return;
  window.__adaLoaded = true;
  try {
    await load(tag.dataset.jquery);
    await load(tag.dataset.ada);
  } catch { /* widget unavailable; page still works */ }
};

if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 4000 });
else setTimeout(start, 2500);
