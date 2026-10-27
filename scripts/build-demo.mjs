import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'dist');
// No destructive cleanup: overwrite only known site files, then audit the artifact.
await mkdir(destination, { recursive: true });
await cp(path.join(root, 'demo'), destination, { recursive: true });
await cp(path.join(root, 'fonts'), path.join(destination, 'fonts'), { recursive: true });
await mkdir(path.join(destination, 'Assets', 'Audio'), { recursive: true });
const assets = ['background.gif', 'errorBg1.mp4', 'favicon.png', 'goomba.png', 'inputBox.png', 'mario-coin.gif', 'super-mario-bros-nes.otf', 'Audio/coinCollect.mp3'];
for (const asset of assets) await cp(path.join(root, 'frontend/Assets', asset), path.join(destination, 'Assets', asset));
for (const name of await readdir(path.join(root, 'frontend/css'))) {
  let css = await readFile(path.join(root, 'frontend/css', name), 'utf8');
  css = css.replaceAll('/Assets/', '../Assets/').replaceAll('inputbox.png', 'inputBox.png');
  // Keep the original Roboto appearance without third-party runtime requests.
  css = css.replace(/@import url\('https:\/\/fonts.googleapis.com\/[^']+'\);/g, '');
  // Remove the original forced desktop minimum, which breaks tablet layouts.
  if (name === 'home-style.css') css = css.replace(/@media \(min-width: 600px\)[\s\S]*$/, '');
  await writeFile(path.join(destination, 'css', name), css);
}

const count = '<p class="demo-counter">Generations in this browser: <span data-count>0</span></p>';
const feedback = '<div class="demo-feedback"><p class="demo-error" data-error role="alert" hidden></p><p class="demo-status" data-status role="status" aria-live="polite"></p>' + count + '</div>';
const controls = buttonClass => `<div class="demo-actions"><button type="button" class="download-btn ${buttonClass}" data-download>Download .txt</button><button type="button" class="download-btn ${buttonClass}" data-copy>Copy output</button></div>`;

for (const [theme, template] of Object.entries({ home: 'homepage', mario: 'index', terminal: 'terminal', normal: 'normal', dark: 'dark' })) {
  let html = await readFile(path.join(root, 'templates', `${template}.html`), 'utf8');
  html = html.replaceAll('/css/', 'css/').replaceAll('/Assets/', 'Assets/').replaceAll('http://localhost:8081', 'index.html');
  html = html.replace(/<form action="\/" method="get"/g, '<form action="index.html" method="get"');
  html = html.replace(/action="\/(?:mario|terminal|normal|dark)\/ascii-art" method="post"/g, 'data-generator');
  html = html.replace(/action="\/ascii-art" method="POST"/g, 'action="index.html" method="get"');
  html = html.replace(/<form method="POST" action="\/export"[\s\S]*?<\/form>/g, controls(['mario', 'terminal'].includes(theme) ? 'bannerBtn' : 'bannerButton'));
  html = html.replace(/&#215;\{\{printf "%02d" \.CoinCount\}\}/g, '&#215;<span data-count="coin">00</span>');
  html = html.replace(/\{\{\.StartTime\}\}/g, '<span data-time></span>');
  html = html.replace(/\{\{(?:if \.Output|end)\}\}/g, '');
  html = html.replace(/<textarea([^>]*)>\s*\{\{\.Input\}\}<\/textarea>/g, '<textarea$1></textarea>');
  html = html.replaceAll('{{.Output}}', '');
  html = html.replace('<body>', `<body data-theme="${theme}">`);
  if (!html.includes('name="viewport"')) html = html.replace('</head>', '<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>');
  if (!html.includes('rel="shortcut icon"')) html = html.replace('</head>', '<link rel="shortcut icon" href="Assets/favicon.png">\n</head>');
  html = html.replace('</head>', '<link rel="stylesheet" href="css/demo.css">\n</head>');
  if (theme === 'home') {
    html = html.replace('<div class="footer">', '<a class="demo-resume" data-resume hidden></a><div class="footer">' + count);
  } else {
    html = html.replace(/<(section|div) id="(outputSection|outputContainer)"/g, '<$1 data-result hidden id="$2"');
    html = html.replace(/<pre id="asciiOutput">/g, '<pre id="asciiOutput" data-output tabindex="0" aria-label="Generated ASCII art">');
    html = html.replace('id="outputTextarea"', 'id="outputTextarea" data-output aria-label="Generated ASCII art"');
    html = html.replace(/maxlength="1000" disabled/g, 'readonly spellcheck="false"');
    html = html.replace(/<audio autoplay>/g, '<audio preload="none">');
    html = html.replace('<textarea name="inputText" id="inputTextarea"', '<textarea aria-label="Enter text" name="inputText" id="inputTextarea"');
    html = html.replace('</main>', feedback + '</main>');
  }
  html = html.replace('</body>', '<noscript><p>This demo needs JavaScript to generate ASCII art.</p></noscript><script type="module" src="js/app.js"></script>\n</body>');
  if (/\{\{/.test(html)) throw new Error(`Unconverted template expression in ${theme}`);
  await writeFile(path.join(destination, theme === 'home' ? 'index.html' : `${theme}.html`), html);
}

// GitHub serves 404.html at arbitrary nested URLs. Give only error pages a base.
let repository = process.env.GITHUB_REPOSITORY;
if (!repository) repository = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim().replace(/\.git$/, '').split(/[:/]/).slice(-2).join('/');
const [owner, repo] = repository.split('/');
const base = process.env.SITE_BASE_PATH ?? (repo.toLowerCase() === `${owner}.github.io`.toLowerCase() ? '/' : `/${repo}/`);
if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base)) throw new Error('SITE_BASE_PATH must be an absolute path with a trailing slash.');
for (const [template, filename] of [['errdefault', '404.html'], ['errorPage', 'mario-404.html']]) {
  let html = await readFile(path.join(root, 'templates', `${template}.html`), 'utf8');
  html = html.replace('<head>', `<head>\n<base href="${base}">\n<link rel="icon" href="Assets/favicon.png">\n<meta name="viewport" content="width=device-width, initial-scale=1">`);
  html = html.replaceAll('/css/', 'css/').replaceAll('/Assets/', 'Assets/').replaceAll('href="/"', 'href="index.html"');
  html = html.replaceAll('{{.StatusCode}}', '404').replaceAll('{{.Msg}}', "The page you're looking for is in another castle.").replace(/\{\{printf "%02d" \.CoinCount\}\}/g, '00');
  html = html.replace('style="font-size: 80px;"', 'style="font-size: clamp(28px, 8vw, 80px);"');
  html = html.replace('</head>', '<style>body{min-height:100vh;height:auto}.glow-box{max-width:100%;box-sizing:border-box}.errorContainer{max-width:95%;animation-delay:0s}.ascii{overflow:auto;max-width:100%}#errBody{overflow:auto}</style></head>');
  await writeFile(path.join(destination, filename), html);
}
await writeFile(path.join(destination, '.nojekyll'), '');
console.log(`Built static site in dist/ for ${base} (no backend or runtime packages).`);
