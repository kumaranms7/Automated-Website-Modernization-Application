'use strict';
// Site Modernizer, the desktop app: a window around the portal. The portal (src/server/index.js) runs as a separate process on a free
// port of this computer, so a crash in a build can never close the window, and everything the portal needs (Node, the stylesheet
// compiler, the browser driver) comes with the app. Nothing here is reachable from other computers: the portal listens on 127.0.0.1 only.

const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { spawn, execFile } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const NAME = 'Site Modernizer';
app.setName(NAME);
app.setAppUserModelId('com.toptenwebsitemarketing.sitemodernizer');

const appRoot = app.getAppPath();
const serverEntry = path.join(appRoot, 'src', 'server', 'index.js');
const iconFile = path.join(appRoot, 'electron', 'icon.png');
// which build this is: written next to the app when the portable file is made (none when run from the project folder)
const info = (() => { const base = { version: app.getVersion(), stamp: 'dev', builtAt: '' }; try { return { ...base, ...JSON.parse(fs.readFileSync(path.join(appRoot, 'build-info.json'), 'utf8')) }; } catch { return base; } })();
const launchersFile = () => path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'Site Modernizer Portable', 'launchers.txt');
const buildLabel = () => `${info.version}${info.stamp === 'dev' ? ' (development)' : ` build ${info.stamp.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2}).*$/, '$1-$2-$3 $4:$5')}`}`;
const locationFile = () => path.join(app.getPath('userData'), 'location.json');
const logsDir = () => path.join(app.getPath('userData'), 'logs');

let win = null, server = null, origin = '', dataDir = '', quitting = false;

// ---------- where the websites and settings are kept ----------
function readLocation() { try { const d = JSON.parse(fs.readFileSync(locationFile(), 'utf8')).dataDir; return d && fs.existsSync(d) ? d : ''; } catch { return ''; } }
function saveLocation(dir) { fs.mkdirSync(path.dirname(locationFile()), { recursive: true }); fs.writeFileSync(locationFile(), JSON.stringify({ dataDir: dir }, null, 2)); }

function chooseFolder(title) {
  const r = dialog.showOpenDialogSync({ title, properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Use this folder' });
  return r?.[0] || '';
}

function resolveDataDir() {
  const saved = readLocation();
  if (saved) return saved;
  // run from the project folder (npm run desktop): keep working with the websites that are already there
  if (!app.isPackaged && fs.existsSync(path.join(appRoot, 'clients'))) return appRoot;
  const suggested = path.join(app.getPath('documents'), NAME);
  const pick = dialog.showMessageBoxSync({
    type: 'question', title: `Welcome to ${NAME}`, message: 'Where should the websites and settings be kept?',
    detail: `Everything you do here (scans, builds, backups, reports and your settings) is stored in one folder, so it is easy to back up.\n\nSuggested folder:\n${suggested}\n\nIf you already use the portal from a project folder, choose that folder (the one that contains "clients") to keep working with your websites.`,
    buttons: ['Use the suggested folder', 'Choose another folder…', 'Quit'], defaultId: 0, cancelId: 2, noLink: true,
  });
  if (pick === 2) return '';
  let dir = suggested;
  if (pick === 1) { dir = chooseFolder('Choose the folder for your websites and settings'); if (!dir) return ''; }
  fs.mkdirSync(dir, { recursive: true });
  saveLocation(dir);
  return dir;
}

// ---------- the portal process ----------
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function startServer() {
  const port = await freePort();
  fs.mkdirSync(logsDir(), { recursive: true });
  const log = fs.createWriteStream(path.join(logsDir(), 'portal.log'), { flags: 'a' });
  log.write(`\n--- ${new Date().toISOString()} starting the portal on port ${port}, data in ${dataDir}\n`);
  server = spawn(process.execPath, [serverEntry], {
    cwd: appRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(port), SM_DATA_DIR: dataDir, SM_DESKTOP: '1', SM_BUILD_STAMP: info.stamp, SM_LAUNCHERS_FILE: launchersFile(), SM_PARENT_PID: String(process.pid) },
  });
  server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
  const mine = server;
  mine.on('exit', (code) => {
    log.write(`--- the portal stopped (code ${code})\n`);
    if (server === mine) server = null;
    if (!quitting) onServerGone(code);
  });
  origin = `http://127.0.0.1:${port}`;
  const until = Date.now() + 90000;
  while (Date.now() < until) {
    if (!server) throw new Error('The portal stopped while starting. See the log for the reason.');
    try { const r = await fetch(`${origin}/`); if (r.ok) return; } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('The portal did not start within 90 seconds.');
}

function stopServer() {
  const s = server; server = null;
  if (!s || s.exitCode !== null) return;
  // the portal may have started a browser for a test: end the whole tree
  if (process.platform === 'win32') execFile('taskkill', ['/PID', String(s.pid), '/T', '/F'], () => {});
  else s.kill('SIGTERM');
}

async function onServerGone(code) {
  if (!win || win.isDestroyed()) return;
  const r = await dialog.showMessageBox(win, { type: 'error', title: NAME, message: 'The portal stopped unexpectedly.', detail: `Your files are safe. Exit code ${code}.\nThe log is in:\n${logsDir()}`, buttons: ['Restart', 'Open the log folder', 'Quit'], defaultId: 0, cancelId: 2, noLink: true });
  if (r.response === 1) { shell.openPath(logsDir()); return onServerGone(code); }
  if (r.response === 0) { try { await startServer(); if (win && !win.isDestroyed()) win.loadURL(origin); } catch (e) { dialog.showErrorBox(NAME, e.message); app.quit(); } } else app.quit();
}

// ---------- the window ----------
const SPLASH = `data:text/html;charset=utf-8,${encodeURIComponent('<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;height:100vh;font:600 18px Segoe UI,sans-serif;color:#5b21b6;background:linear-gradient(135deg,#f5f3ff,#ede9fe)"><div style="text-align:center"><div style="font-size:30px;margin-bottom:8px">Site Modernizer</div>Starting…</div>')}`;

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 950, minWidth: 1100, minHeight: 700, title: NAME, icon: iconFile, show: false, backgroundColor: '#f5f3ff',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  win.once('ready-to-show', () => win.show());
  // the title always names the build, so an old copy cannot be mistaken for the new one
  win.setTitle(`${NAME} ${buildLabel()}`);
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('closed', () => { win = null; });
  // links to other websites open in the browser; pages of the portal itself (a report, a preview) open in their own window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (origin && url.startsWith(origin)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1280, height: 900, icon: iconFile, title: NAME, autoHideMenuBar: true } };
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (origin && !url.startsWith(origin) && !url.startsWith('data:')) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); } });
  // copy and paste on a right click
  win.webContents.on('context-menu', (_e, p) => {
    const items = [];
    if (p.isEditable) items.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
    else if (p.selectionText) items.push({ role: 'copy' });
    if (p.linkURL && /^https?:/i.test(p.linkURL)) items.push({ label: 'Open the link in the browser', click: () => shell.openExternal(p.linkURL) });
    if (items.length) Menu.buildFromTemplate(items).popup();
  });
  win.loadURL(SPLASH);
}

function buildMenu() {
  const dev = !app.isPackaged || process.env.SM_DEVTOOLS;
  const template = [
    { label: 'File', submenu: [
      { label: 'Open the data folder', click: () => shell.openPath(dataDir) },
      { label: 'Show the settings file', click: () => { const f = path.join(dataDir, 'app-settings.json'); if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ _help: 'Put here only the settings you want to change, then restart the app. See app-settings.defaults.json for every setting.' }, null, 2)); shell.showItemInFolder(f); } },
      { label: 'Open the log folder', click: () => { fs.mkdirSync(logsDir(), { recursive: true }); shell.openPath(logsDir()); } },
      { label: 'Use another data folder…', click: () => {
        const dir = chooseFolder('Choose the folder for your websites and settings');
        if (!dir) return;
        saveLocation(dir); app.relaunch(); app.quit();
      } },
      { type: 'separator' }, { role: 'quit', label: 'Exit' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, ...(dev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : [])] },
    { label: 'Help', submenu: [{ label: `About ${NAME}`, click: () => dialog.showMessageBox(win, { type: 'info', title: NAME, message: `${NAME} ${buildLabel()}`, detail: `Top Ten Website Marketing\n\nRunning from:\n${path.dirname(process.execPath)}\n\nData folder:\n${dataDir}`, buttons: ['OK'], noLink: true }) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// closes this copy and starts another one a moment later (the new one cannot start while this one still holds the single-instance lock)
function restartInto(exec) {
  quitting = true; stopServer();
  spawn('cmd.exe', ['/c', `ping -n 4 127.0.0.1 >nul & start "" "${exec}"`], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
  app.exit(0);
}

// ---------- start and stop ----------
if (!app.requestSingleInstanceLock({ stamp: info.stamp, exec: process.execPath })) app.quit();
else {
  app.on('second-instance', (_e, _argv, _cwd, other) => {
    // a newer build was started while this older one is open: close this one and open the newer one
    if (other?.stamp && other.exec && info.stamp !== 'dev' && other.stamp > info.stamp) { restartInto(other.exec); return; }
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      if (other?.stamp && info.stamp !== 'dev' && other.stamp < info.stamp) dialog.showMessageBox(win, { type: 'info', title: NAME, message: 'An older copy was opened.', detail: `This window is the newer build (${buildLabel()}), so it stays open.`, buttons: ['OK'], noLink: true });
    }
  });
  app.whenReady().then(async () => {
    dataDir = resolveDataDir();
    if (!dataDir) { app.quit(); return; }
    buildMenu();
    createWindow();
    try { await startServer(); } catch (e) {
      dialog.showErrorBox(`${NAME} could not start`, `${e.message}\n\nThe log is in:\n${logsDir()}`);
      app.quit(); return;
    }
    if (win) win.loadURL(origin);
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { quitting = true; stopServer(); });
  app.on('will-quit', () => stopServer());
}
