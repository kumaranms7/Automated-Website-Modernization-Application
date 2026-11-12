// Shows which build of the app this is (sidebar), and warns when a newer portable file exists, with a button that restarts into it.
(() => {
  const when = (stamp) => (/^\d{14}$/.test(stamp || '') ? `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} ${stamp.slice(8, 10)}:${stamp.slice(10, 12)}` : '');

  async function check() {
    let v;
    try { v = await (await fetch('/api/version')).json(); } catch { return; }
    const tag = document.getElementById('app-ver');
    if (tag) tag.textContent = v.stamp ? `Version ${v.version} · build ${when(v.stamp)}` : `Version ${v.version} · development`;
    let bar = document.getElementById('ver-banner');
    if (!v.newer) { if (bar) bar.hidden = true; return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ver-banner';
      document.body.append(bar);
    }
    bar.hidden = false;
    bar.replaceChildren();
    const text = document.createElement('span');
    text.textContent = `A newer version is available (build ${when(v.newer.stamp)}). You are using build ${when(v.stamp)}, so your latest fixes may not be in this window.`;
    const go = document.createElement('button');
    go.className = 'btn sm2';
    go.type = 'button';
    go.textContent = 'Restart into the newer version';
    go.onclick = async () => {
      go.disabled = true;
      try { await fetch('/api/update-now', { method: 'POST' }); text.textContent = 'Restarting… this window closes and the newer version opens in a few seconds.'; go.remove(); } catch { go.disabled = false; }
    };
    const later = document.createElement('button');
    later.className = 'btn ghost sm2';
    later.type = 'button';
    later.textContent = 'Not now';
    later.onclick = () => { bar.hidden = true; };
    bar.append(text, go, later);
  }

  check();
  setInterval(check, 5 * 60 * 1000);
})();
