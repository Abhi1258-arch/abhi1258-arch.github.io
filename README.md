# Portfolio website

A static site: plain HTML, CSS and JavaScript. No build step, no framework, no backend.

```
index.html  projects.html  about.html  404.html
inquiry/     index, quant, deception, observatory, inflation, upi, journal
expression/  index, poetry, poem (?id=), music, riff (?id=), anatomy, film, screenplay
assets/css/site.css          design system (colours, type, layout)
assets/js/site.js            header, footer, mobile menu, audio player
assets/js/content.js         ← most edits happen here
assets/js/journal-data.js    weekly journal entries (generated)
assets/js/backtest-data.js   backtest series (generated)
assets/js/charts.js          SVG charts for the quant page
assets/js/screenplay.js      screenplay reader (reads the PDF)
assets/audio  assets/docs  assets/img
tools/serve.ps1              local preview server
tools/extract-content.ps1    regenerates papers, journal and backtest data
```

## Run it locally

The screenplay reader loads the PDF with `fetch`, which browsers block for `file://` pages, so use the small local server:

```
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

Then open http://localhost:8080. Stop it with Ctrl+C. Any other static server works too.

## Live site

Published at **https://abhi1258-arch.github.io** from the public GitHub repository `Abhi1258-arch/abhi1258-arch.github.io` (GitHub Pages, branch `main`, root). To update it, open the matching folder in that repository on github.com, choose **Add file → Upload files**, drop in the changed files, and commit; the site updates within a minute or two. The repository also holds the source tools (`tools/`, `Open Portfolio.cmd`, this README) so the whole project lives in one place; only `.claude/` stays local.

## Deploy

Any static host works. Upload the clean copy in `..\Portfolio Website - deploy` (the site without `tools/`, `.claude/` and this README). Rebuild that copy after editing anything, so the live site gets the changes.

- **Netlify (simplest):** go to app.netlify.com → *Add new site* → *Deploy manually*, and drag this folder in.
- **GitHub Pages:** push the folder to a repository and enable Pages (branch `main`, root folder). If the repository is named `abhi1258-arch.github.io`, the site lives at the root and `404.html` works as is. If it is a project repository (served under `/repo-name/`), every page still works; only the custom 404 page's links would need the prefix added.
- **Cloudflare Pages / Vercel:** same as Netlify, with no build command and output directory `/`.

Fonts (Google Fonts) and pdf.js (cdnjs) load from CDNs. If they fail, the site falls back to system fonts, and the screenplay page falls back to showing the PDF.

## Editing content

Everything personal lives in `assets/js/content.js`:

| To… | Edit |
|---|---|
| Change the wordmark, add your name, school or location | `owner` |
| Change the footer links | `contact` (currently just GitHub) |
| Add a poem | add an object to `poems` (`id`, `title`, `text` with blank lines between stanzas) |
| Name a riff or add notes | `riffs[n].title`, set `titleIsTemporary: false`, fill `notes` / `details` |
| Add a riff or alternate take | put the audio in `assets/audio/`, then add to `riffs` or to a riff's `takes` |
| Update the "Black" study | fill the `anatomy[0].steps` fields and change `status` |
| Add a research note | add to `notes` with a PDF in `assets/docs/` |

**Journal entries** come from `Market Tracking\backup\Weekly Market Journal.docx`. To add weeks, add them to that document and run `tools\extract-content.ps1`; this also re-exports the paper PDFs and backtest data. (It reads only the backup copy. The live journal also contains entries written by the scheduled automation, and those are deliberately not published as your writing.)

**Live data:** when the site is opened through `Open Portfolio.cmd` (or `tools\serve.ps1`), three pages update themselves:
- *Observatory*: Nifty 50 (including a 1-day intraday chart), sectors, the strategy chart, CPI and the current repo rate refresh every minute. Prices come from Yahoo Finance and may be delayed up to 15 minutes.
- *Quant project*: a "Live tracking" section continues momentum and mean reversion past June 2026 with the paper's exact rules. It first re-runs the study period and only extends if it reproduces the paper's numbers. The paper's own results never change.
- *Market journal*: reads `Market Tracking\Converted\Weekly Market Journal.docx` directly, so each Sunday's new entry appears without any step. Weeks after `journal.authoredThrough` in `content.js` are labelled "Automated".

Opened any other way (a static host, double-clicking an HTML file), the pages show the saved snapshot and say so.

**Observatory snapshot (fallback):** run `powershell -ExecutionPolicy Bypass -File tools\update-observatory.ps1` to refresh prices (Yahoo Finance) and CPI (World Bank); the snapshot date on the page updates itself. After each RBI policy meeting that changes the rate, add a row to `assets/js/observatory-rbi.js` and update `checked` and `nextMeeting`.

**Screenplay:** replace `assets/docs/everything-was-already-alive.pdf`. The reader typesets whatever the PDF contains. If its scene numbers don't run 1…N, it shows the PDF instead.

## Content status

### Complete
- Both poems, verbatim.
- Three riffs with working players (play/pause, seek, duration, keyboard and screen-reader labels, no autoplay).
- The full screenplay: all 60 pages and 95 scenes. The typeset text was checked against the PDF and matches character for character. It also has a contents list, deep links (`screenplay.html#scene-25`) and a PDF download.
- The film page: logline, spoiler-free synopsis, treatment, and three excerpts pulled live from the PDF.
- The quant project: method, results charted from the real monthly CSVs, cost sensitivity, limitations, and links to the paper, code and dashboard.
- The Mathematics of Deception page, with an interactive version of the paper's question model and the 31-page PDF.
- The Indian Market Observatory dashboard: Nifty 50, 11 sector indices, CPI inflation, the RBI repo-rate timeline, strategy results, journal and notes. Data is a dated snapshot, not live (see below).
- The inflation and UPI pages, with PDFs of all five papers.
- The weekly journal: 28 original entries, 2 March to 13 September 2026.

### Placeholders (shown as placeholders, never as real information)
- Riff titles (currently "Riff 01–03"). Riff notes were removed on purpose.
- The Anatomy of a Sound: the "Black" study has listening notes; the riff experiment (steps 4–5) and its audio are still a plan.
- Tags on research notes: none yet.

### Files that would complete it
- Any stills, screenshots or notebook pages you want shown.
- Notes for each riff, and any tabs or diagrams.
- Recordings for the "Black" experiment, if and when they exist.
