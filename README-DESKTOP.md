# Site Modernizer, the desktop app

The portal in a window of its own (Electron). The portal still runs as its own process on a free port of this computer, so the
code is the same as `npm run portal`; the desktop app only starts it, shows it and stops it.

| Command | What it does |
| --- | --- |
| `npm run desktop` | Opens the app from the project folder, with the websites that are already in `clients/` |
| `npm run dist:dir` | Builds the app into `dist-desktop/win-unpacked/` (no installer; quick to try) |
| `npm run dist` | Builds the Windows installer `dist-desktop/Site Modernizer Setup <version>.exe` |

Run these from a normal terminal. If `ELECTRON_RUN_AS_NODE` is set in your environment, clear it first, or Electron starts as plain Node.

## Where things are kept
The first time the installed app starts it asks for one folder for the websites and settings (suggested: `Documents\Site Modernizer`).
That folder holds `clients/` and `settings.local.json` (the API key). Choose a folder that already has a `clients` folder to keep working
with existing websites. File > "Use another data folder…" changes it later. Logs: File > "Open the log folder".

## Needs on the computer
Microsoft Edge (it is used for the real-browser tests and for reading the theme of a template). Everything else comes with the app.

## Notes
- The app is shipped as plain folders (`asar: false`): the portal reads its own files and starts the stylesheet compiler from them.
- No settings or websites are put into the installer (`settings.local.json` and `clients/` are not packaged).
- The installer is not code-signed, so Windows SmartScreen may ask to confirm the first time.
- The icon is made by `scripts/make-icon.mjs`.
