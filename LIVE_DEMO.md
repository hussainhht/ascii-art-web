# Frontend live demo

The `livedemo` branch adds a static version of ASCII Art Web for GitHub Pages.
The homepage and all four themes are derived from the original HTML templates;
the browser runs a real JavaScript port of the Go renderer. Visitors do not need
Go, a running application server, or an API account.

Expected project URL, derived from `origin`:
<https://hussainhht.github.io/ascii-art-web/>. A URL alone does not confirm a
successful deployment; check the repository's Pages workflow and public page.

## Preserved application

`backend/`, `main.go`, `go.mod`, `templates/`, `fonts/`, `frontend/`, the Dockerfile,
and the original executable remain available and unchanged. Run the full-stack
application as before with `go run .` at <http://localhost:8081>.

The static demo retains Mario, Terminal, Dark, and Normal; all four banner fonts;
custom and multiline text; original images, backgrounds, Mario font and coin
sound; themed validation; exact TXT downloads; and a browser-local generation
counter. Copy output and Ctrl+Enter / Command+Enter are also available. Enter
alone continues to insert a newline in the input.

The initial page remains the original theme chooser. It remembers the most
recent theme and offers a Continue link. Draft text and banner selection survive
theme navigation and refresh in the same tab. Restoring a draft does not count
as a generation.

## Rendering and compatibility

`demo/js/ascii-generator.js` ports `backend.ASCIIArt`, `backend.PrintLine`, and
`backend.PrintLineforbigmoney`. It removes CR characters, splits on LF, looks up
each printable ASCII character, concatenates glyph rows without trimming, and
adds precisely the same newlines as Go. Eight rows are rendered for Standard,
Shadow, and Thinkertoy; eleven for Bigmoney.

`demo/js/font-loader.js` parses the original `fonts/*.txt` assets. The first
three fonts have a leading separator and a nine-line character stride. Bigmoney
starts at line zero and uses an eleven-line stride. The parser maps characters
32 through 126 using the exact offsets from Go. It checks the font structure
and characters, normalizes line endings, and caches successful/in-flight loads.
Failed loads are evicted so the next attempt can retry. URLs are resolved
relative to the JavaScript module, including under a repository subpath.

Compatibility details:

- Empty input renders an empty string. Newline-only input keeps Go's blank-line
  behavior. Spaces, trailing spaces, and trailing LF are retained.
- Go's Bigmoney branch never clears its `first` flag. Its extra newline before
  subsequent nonempty input lines is deliberately preserved, including in TXT.
- Lone CR characters are removed, rather than treated as newlines, just as in Go.
- Non-ASCII text, tabs, and control characters are rejected with useful inline
  messages. No HTML is created from user input.
- The original UI's 1,000-character limit is enforced by JavaScript as well as
  HTML, bounding rendering work. Output is not truncated to 1,000 characters.
- The original handler counts some failed attempts. The demo deliberately counts
  successful nonempty results only, as required for this demo. Newline-only and
  space-only results count because their generated strings are nonempty.
- The counter uses namespaced `localStorage`, persists across browser sessions,
  and represents this browser only. Drafts use `sessionStorage`. If storage is
  blocked, generation and an in-memory counter still work; persistence is then
  unavailable. These stores do not read or overwrite the Go app's cookie.
- TXT is UTF-8 without a BOM and retains exact LF bytes on every OS. Windows may
  normalize clipboard line endings to CRLF; this does not affect rendering/TXT.
- The existing `ExportHandler` implements TXT only, despite its ZIP comments and
  README claim. ZIP was not added to the static application.
- Mario audio plays after a successful user-triggered generation. Browsers may
  block sound; playback rejection is handled without breaking the application.
- Validation is an inline browser message, not a simulated HTTP 400 or 500. The
  original generic error design becomes the real static `404.html`. A standalone
  `mario-404.html` also retains the Mario error video and design.

## Build and run locally

Use Node.js 22 or newer. The build uses only Node's standard library and needs
no `npm install`:

```sh
node scripts/build-demo.mjs
node scripts/serve-demo.mjs
```

Visit <http://127.0.0.1:4173/ascii-art-web/>. This server serves static files only;
it does not generate ASCII art. Opening HTML with `file://` will not work because
browser module imports and font fetching require HTTP(S).

The build writes a standalone site to ignored `dist/`. It copies the original
templates, removes Go expressions and backend form actions, attaches browser
handlers, and copies only required CSS, banner fonts, images, audio, and video.
The original files are never edited. Small additional CSS fixes scrolling,
keyboard focus, and responsive layout while preserving each theme's appearance.
Roboto is vendored under `demo/Assets/` with its OFL license, replacing external
Google Fonts imports in the generated CSS.

Only `dist/` is publishable. It contains no Go code, executables, tests, repository
metadata, unused assets, Node packages, credentials, or development configuration.
Never point a static web server at the whole repository for public deployment.

## Verification

Install the browser test dependency (there are no runtime dependencies):

```sh
npm ci
npm run build
npm test
go test ./...
go run ./tests/golden
git diff --exit-code -- tests/golden/outputs.json
npx playwright install chromium
npm run test:browser
```

On Windows, the installed Edge browser can be used instead of downloading
Chromium:

```powershell
$env:BROWSER_CHANNEL = 'msedge'
npm run test:browser
```

`tests/golden/main.go` calls the unchanged Go backend to capture 100 representative
cases in `tests/golden/outputs.json`, including all printable ASCII characters
and unsupported input. Unit tests compare the JavaScript output character for
character, including trailing whitespace and blank lines. Other tests check
limits, font errors/retry/cache, blocked storage, TXT bytes, exact-case asset
paths, and the artifact's contents.

The browser smoke test starts its own static server on port 4173. Stop any local
preview on that port first. It checks all 48 combinations of four themes, four
banners, and desktop/tablet/mobile widths (1440, 768, 390), generation against Go,
downloaded file contents, clipboard, validation, reload, persistence, keyboard
submission, wide output scrolling, missing/corrupt fonts, unavailable storage,
and runtime network/console errors. Screenshots go to ignored `test-results/`.
CI installs Chromium and its Linux dependencies automatically.

## GitHub Pages

The workflow is `.github/workflows/deploy-livedemo.yml`. It runs on pushes to
`livedemo` and manual dispatch, and refuses deployment from another branch.
It checks Go fixtures, builds the static files, runs unit and browser checks,
configures Pages, uploads only `dist/`, then deploys with the official GitHub
Pages actions in the `github-pages` environment. It uses `contents: read`,
`pages: write`, and `id-token: write`; builds and deployments share a concurrency
group. `.nojekyll` is included in the artifact.

For initial setup, select **Settings → Pages → Build and deployment → Source →
GitHub Actions** in `hussainhht/ascii-art-web`. Allow `livedemo` in the
`github-pages` environment's deployment rules if the environment restricts
branches. Push the tested branch with `git push origin livedemo`. The push
triggers deployment; a new workflow file on this branch can also be dispatched
with GitHub's workflow API using `ref: livedemo`. Some GitHub UI controls only
list workflows present on the default branch; deployment never requires a
change to `main`.

Inspect the workflow run's deployment result and verify the public URL before
announcing the site as live. If a repository policy requires deployment review,
an authorized reviewer must approve the pending environment deployment.

## Asset paths and troubleshooting

All normal pages and asset URLs use relative references. Theme links point to
real `.html` files, so direct visits and refresh work on GitHub Pages. The two
error pages use a base path because a 404 can be served at an arbitrary nested
URL. The builder derives this path from `GITHUB_REPOSITORY` in Actions or the
actual Git origin locally. For this repository it is `/ascii-art-web/`.

- For missing fonts, serve the built `dist/` and check that `fonts/standard.txt`
  returns text rather than an HTML error page. Font failures can be retried.
- GitHub hosting is case-sensitive. The build corrects the original Mario CSS's
  `inputbox.png` reference to the actual `inputBox.png`; the static audit checks
  filenames case-sensitively even on Windows.
- For a custom domain or different hosting path, set `SITE_BASE_PATH=/` (or the
  desired `/path/`) when building and previewing. This chiefly affects 404 links.
- If deployment fails with a Pages-not-enabled error, select GitHub Actions as
  the Pages source and rerun the workflow. Check environment rules if it waits.
- Storage/clipboard can be restricted in private or embedded browsers. Copy then
  selects output and provides keyboard instructions. Downloads remain available.
- Fonts load on demand. Cached banners can be reused without another request
  within a page; an uncached banner still needs its static asset. This is not an
  installable/offline PWA and does not register a service worker.

Action versions were checked against the official release pages:
[checkout](https://github.com/actions/checkout/releases),
[setup-node](https://github.com/actions/setup-node/releases),
[setup-go](https://github.com/actions/setup-go/releases),
[configure-pages](https://github.com/actions/configure-pages/releases),
[upload-pages-artifact](https://github.com/actions/upload-pages-artifact/releases),
and [deploy-pages](https://github.com/actions/deploy-pages/releases).
