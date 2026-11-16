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

The design kit is written only with Tailwind classes. It offers ten designs. Every one of them keeps the sections of a page in the page's own order, with the pictures and icons of each section in that section, and follows the website's theme colours; they differ in layout, typography and motion:

| Design | Look | Motion |
|---|---|---|
| **Signature** | Deep shades of the brand colour, pale bands in turn, glass over photographs, cards with a gradient border whose light travels round them | Sections rise out of a blur, headings rise word by word |
| **Horizon** | A serif for the headings, a warm pale ground, hairlines instead of boxes, the hero picture under an arch, a light footer | Sections are uncovered like a page being turned up |
| **Vertex** | Condensed capitals, square corners, solid blocks of colour, headings set on the pictures of the cards, figures on a dark band | Sections slide in, pictures are wiped clear by a block of colour |
| **Lumen** | Round and light: a header that floats as a pill, tinted panels set into the page, lists as chips, figures on glass | Sections bloom out of a blur, pictures open from their centre |
| **Nova** | Dark and luminous: the whole page in the deepest shade of the brand colour, glass cards with a light that follows the pointer, the hero picture or video in a leaning glass frame, the form on a sheet of white paper | Sections rise out of the dark with a flash, a gleam passes over pictures |
| **Crest** | An open hero on a ground that carries a pattern chosen for the kind of business (waves for a plumber, the grid of a plan for a builder); its picture or video reaches the edge of the page under a wide curve; full-width bands, white and pale with the pattern in turn; cards, lists and figures are tiles, and accent words sit on tiles of their own | Tiles drop into place with a small spring, the hero picture comes in from its edge |
| **Orbit** | A hero on the deep shades of the brand colour with the business's pattern in white; the picture or video in a circle with the light of its border travelling round it, two rings turning about it and the figures of the business on the ring; icons and numbers on discs, figures inside rings of light | Parts swing in along an arc, pictures open like an iris |
| **Vista** | A hero without a frame: the picture or video melts into a pale patterned ground, the figures of the business on a card with the gradient border; fine lines, accent words under a marker's stroke, steps and figures set in type alone | Parts settle into place from a little too large, pictures draw nearer |
| **Facet** | The picture or video in a large diamond with the light round it, diamonds of the brand and accent colours beside it, figures in a ruled row; cards with a corner of the brand colour, icons on diamonds, pictures between corner brackets | Parts come in leaning and straighten, pictures are wiped clear on a diagonal |
| **Zephyr** | The picture or video in a shape whose outline flows slowly, the light round it, figures on small leaves beside it; cards, pictures and marks cut like a leaf, headings over a wavy line | Parts float up softly |

Orbit, Vista, Facet and Zephyr, like Crest, carry a background pattern chosen for the kind of business, and their cards carry the gradient border with a travelling light. How a page is read is the same for all ten (`src/kit/designs/shared.js` and `base.js`): the rows of the old page stay separate sections, the text that stood beside the form keeps the form beside it, a heading above a list stays its heading, several headings in one row become topics side by side, and a long text beside a picture goes on under both. The header and the footer use the website's own links, credentials, seal, social pages and legal pages. A contact page shows the contact details beside the form, then the website's questions, its closing call and the map. All motion stops for visitors who prefer less of it.

- **Configuration**: colours and fonts, banner pictures or a looping background video, and the website details a finished site needs: an announcement bar, the main call to action, a business line, opening hours, social pages, how the hero looks, the background pattern of the designs that carry one (automatic by the kind of business, or chosen from waves, dots, grid, fine lines, crosses, rings and honeycomb) and how much the page moves.
- **Modern designs**: preview each design with placeholder content, and open its section library. The inner template shows one example of every kind of section found on the website's inner pages.
- **Preview & refine**: the redesigned pages beside the originals, with a **Customize sections** panel that floats over the preview like a chat window.
- **Customize sections**:
  - A section opens on its **Layout** tab: the layout of the chosen design, the layout any other design gives the same content, and the other kinds of section the content can become. A layout borrowed from another design keeps that design's shapes and its light or dark skin, with the colours and fonts of the website.
  - The **Style** tab styles every element: theme colours or custom colours, buttons, cards, icons, text, spacing, width, max-width and position, similar to a page builder.
  - Add entrance, hover and loop animations.
  - Reorder, remove and restore sections, edit a section's HTML, or add a section from the section library (the layouts of every design).
  - Change the header, footer and top bar for the whole theme, and the hero per page. The hero can be the one another design gives the page; the hero chosen for an inner page is used on every inner page. An inner page's hero can use a photo of the page with an overlay.
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
