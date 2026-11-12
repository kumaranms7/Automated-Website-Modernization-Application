# Site Modernizer

A local web portal (also available as a Windows desktop app) that redesigns existing websites with a Tailwind-only design kit, without losing what makes them rank: the wording, meta tags, headings, links, forms and tracking code of every page are kept and checked.

Point it at a website's folder, describe the business, pick a design, review the result side by side with the original, and publish a package that is ready to upload.

Built by Top Ten Website Marketing.

## What it does

- **Scans and audits** a website: classifies every page (home, inner, contact, and more), measures SEO and structure problems, and shows what needs attention.
- **Redesigns** the site with a library of modern designs. The site's own content is fitted into the chosen design, page by page.
- **Preserves the important parts**: titles, meta descriptions, canonical tags, H1s, content text and links, phone numbers, forms and tracking IDs. A page that loses any of them fails its checks and is not finalised.
- **Optimises images** in place: modern formats, responsive sizes, alt text and dimensions.
- **Writes and improves content** with Claude, checked against the business profile and a list of forbidden claims. Content can also be left untouched.
- **Validates** the finished site (SEO, links, accessibility, real-browser checks) and produces a report.
- **Packages** the build for deployment, with a rollback.

## The workflow

The portal is a seven-step flow, one tab each:

1. **Business profile**: what the company does and does not do, its address, phone and services.
2. **Site audit**: scan the website folder and review the findings.
3. **Template design**: choose and customize a modern design (see below).
4. **Images**: optimise the website's pictures.
5. **Content & build**: generate or keep the content, then build the pages.
6. **Validation & Report**: run the checks and produce the report.
7. **Settings**: API key, model and application options.

## Template design

The design kit is written only with Tailwind classes. It ships several designs (aurora, bento, midnight, editorial, clarity and local), each with its own layouts, fonts and shapes drawn in the website's own colours.

- **Modern designs**: browse the designs and a section library with every kind of section in every layout.
- **Preview & refine**: the redesigned pages beside the originals, with a **Customize sections** panel that floats over the preview like a chat window.
- **Customize sections**:
  - Choose another layout for a section, or another kind of section the content can become.
  - Style every element: theme colours or custom colours, buttons, cards, icons, text, spacing, width, max-width and position, similar to a page builder.
  - Add entrance, hover and loop animations.
  - Reorder, remove and restore sections, edit a section's HTML, or add a section from the section library.
  - Change the header, footer and top bar for the whole theme, and the hero per page. An inner page's hero can use a photo of the page with an overlay.
- **One template for every inner page**: the portal scans all the inner pages of a website, finds each unique kind of section, and shows one example of each in the inner page preview. A layout chosen for a kind applies to every page that has it, so built pages match the finalised template.

## Requirements

- **Node.js** 22 or newer (developed on Node 26).
- **Microsoft Edge**, used for real-browser tests and for reading the theme of a template.
- An **Anthropic API key** for the content and AI features. Auditing, designing, image optimisation and building work without it.

## Getting started

```bash
npm install
cp .env.example .env     # (Windows: copy .env.example .env) then add your ANTHROPIC_API_KEY
npm run portal
```

Open the address printed in the terminal. The default port is `4310`; change it with `PORT` in `.env`.

### Configuration

`.env`:

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | API key for the AI features |
| `CLAUDE_MODEL` | Model used for content (default `claude-sonnet-5-5`) |
| `PORT` | Port of the portal (default `4310`) |

Application settings live in `app-settings.json`. Put only the values you want to change there; `app-settings.defaults.json` lists every setting and its built-in value. The key can also be saved in `settings.local.json` from the Settings tab (this file is not committed).

## Working with a website

Each website is a **client** in the `clients/` folder. Create one in the portal, or from the command line:

```bash
node src/cli.js add-client <slug> <path-to-website-folder> <host> "Business name"
node src/cli.js scan <slug>
node src/cli.js build <slug> --limit 10
node src/cli.js validate <slug>
```

The original website folder is never written to. Builds go to `clients/<slug>/build/`.

## Desktop app

The portal also runs in its own window (Electron).

| Command | What it does |
| --- | --- |
| `npm run desktop` | Open the app from the project folder |
| `npm run dist:dir` | Build the app into `dist-desktop/win-unpacked/` |
| `npm run dist` | Build the Windows installer |
| `npm run dist:portable` | Build a portable version |

See [README-DESKTOP.md](README-DESKTOP.md) for where data is kept and other notes.

## Project layout

| Folder | Contents |
| --- | --- |
| `src/server/` | Express server, API routes and the portal UI (`public/`) |
| `src/kit/` | The Tailwind design kit: designs, section library, fitting real content, customization |
| `src/template/` | Template spec, page selection and finalising |
| `src/build/` | Builds pages and verifies each one against the original |
| `src/scanner/`, `src/validate/` | Page scanning, audit, SEO, link and browser checks |
| `src/content/`, `src/ai/` | Content generation and the Claude client |
| `src/images/`, `src/head/`, `src/canonical/` | Image optimisation, head tags and schema, canonical URLs |
| `src/publish/` | Packaging, deploying and rolling back |
| `electron/` | Desktop app shell |
| `tests/` | Automated tests |

## Tests

```bash
npm test
```

## Notes

- Customer websites and their generated builds live in `clients/` and are not part of the application. Keep them out of a public repository.
- Never commit `.env` or `settings.local.json`; both can hold an API key.
- The Windows installer is not code-signed, so SmartScreen may ask for confirmation the first time.
