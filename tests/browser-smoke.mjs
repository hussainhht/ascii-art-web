import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import { server } from '../scripts/serve-demo.mjs';

if (!server.listening) await once(server, 'listening');
const base = `http://127.0.0.1:${process.env.PORT ?? 4173}${process.env.SITE_BASE_PATH ?? '/ascii-art-web/'}`;
const fixtures = JSON.parse(await readFile(new URL('./golden/outputs.json', import.meta.url), 'utf8'));
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const errors = [];
const requests = [];
let assertions = 0;
function check(actual, expected, label) { assert.equal(actual, expected, label); assertions++; }
async function text(page) { return page.locator('[data-output]').evaluate(node => node.tagName === 'TEXTAREA' ? node.value : node.textContent); }
async function generate(page, banner, input) {
  await page.locator('[data-generator] [name=inputText]').fill(input);
  await page.locator(`[name=banner][value=${banner}]`).click();
  await page.locator('[data-generator][aria-busy]').waitFor({ state: 'detached' });
}
function observe(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
}
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    observe(page);
    await page.goto(base);
    await page.locator('.button-group').waitFor();
    check(await page.locator('.button-group button').count(), 4, 'four original theme buttons');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'home fits viewport');
    await page.screenshot({ path: `test-results/home-${viewport.width}.png`, fullPage: true });
    for (const theme of ['mario', 'terminal', 'normal', 'dark']) {
      await page.locator(`[name=style][value=${theme}]`).click();
      await page.waitForURL(`${base}${theme}.html`);
      await page.locator('[name=banner][aria-pressed]').first().waitFor();
      const startingCount = Number(await page.locator('.demo-counter [data-count]').textContent());
      for (const [index, banner] of ['standard', 'shadow', 'thinkertoy', 'bigmoney'].entries()) {
        const input = 'Hello\nWorld';
        await generate(page, banner, input);
        const expected = fixtures.find(item => item.banner === banner && item.input === input).output;
        check(await text(page), expected, `${viewport.width} ${theme}/${banner} exact Go output`);
        check(Number(await page.locator('.demo-counter [data-count]').textContent()), startingCount + index + 1, 'counter increments once');
        if (viewport.width === 1440) {
          const downloadPromise = page.waitForEvent('download');
          await page.locator('[data-download]').click();
          const download = await downloadPromise;
          check(await readFile(await download.path(), 'utf8'), expected, 'download bytes match Go');
          check(download.suggestedFilename().endsWith('.txt'), true, 'TXT filename');
          await page.locator('[data-copy]').click();
          await page.waitForFunction(() => document.querySelector('[data-status]').textContent.includes('copied'));
          // Windows' OS clipboard converts LF to CRLF; generation/TXT stay exact.
          check((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), expected, 'clipboard content matches Go');
        }
      }
      const successfulCount = Number(await page.locator('.demo-counter [data-count]').textContent());
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `test-results/${theme}-${viewport.width}.png`, fullPage: true });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${theme} fits ${viewport.width}`);
      await page.reload();
      await page.locator('[data-result]:not([hidden])').waitFor();
      check(await text(page), fixtures.find(item => item.banner === 'bigmoney' && item.input === 'Hello\nWorld').output, 'reload restores output');
      check(Number(await page.locator('.demo-counter [data-count]').textContent()), successfulCount, 'reload does not increment count');
      await generate(page, 'standard', 'é😀');
      check(await page.locator('[data-error]').isVisible(), true, 'unsupported input shows validation');
      check(await page.locator('[data-result]').isVisible(), false, 'invalid input clears stale output');
      await generate(page, 'standard', '');
      check(await text(page), '', 'empty input matches Go');
      check(Number(await page.locator('.demo-counter [data-count]').textContent()), successfulCount, 'invalid/empty inputs do not increment');
      await generate(page, 'standard', '\n');
      check(await text(page), '\n', 'newline-only matches Go');
      await generate(page, 'standard', 'W'.repeat(1000));
      check(await page.locator('[data-output]').evaluate(node => node.scrollWidth > node.clientWidth), true, 'wide output scrolls');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'wide output stays inside viewport');
      await page.locator('[data-generator] [name=inputText]').fill('Keyboard');
      await page.locator('[data-generator] [name=inputText]').press('Control+Enter');
      await page.waitForFunction(() => document.querySelector('[data-status]').textContent === 'ASCII art generated.');
      check((await text(page)).length > 0, true, 'keyboard generation');
      await page.getByRole('button', { name: 'Back to Home' }).click();
      await page.waitForURL(url => url.pathname.endsWith('/index.html'));
      check(await page.locator('[data-resume]').getAttribute('href'), `${theme}.html`, 'theme preference persists');
    }
    await context.close();
    console.log(`Passed all themes and banners at ${viewport.width}px.`);
  }
  // Fresh sessions exercise font failures, retries, safe output, and blocked storage.
  const context = await browser.newContext();
  const page = await context.newPage();
  // Expected 404 font errors are isolated from the clean network/console check.
  let fail = true;
  await page.route('**/fonts/standard.txt', route => fail ? route.fulfill({ status: 404, body: '' }) : route.continue());
  await page.goto(`${base}normal.html`);
  await generate(page, 'standard', 'Hello');
  check(await page.locator('[data-error]').isVisible(), true, 'missing font shows error');
  fail = false;
  await generate(page, 'standard', 'Hello');
  check(await text(page), fixtures.find(item => item.banner === 'standard' && item.input === 'Hello').output, 'font failure can be retried');
  await page.route('**/fonts/shadow.txt', route => route.fulfill({ status: 200, body: 'corrupted' }));
  await generate(page, 'shadow', 'Hello');
  check(await page.locator('[data-error]').isVisible(), true, 'corrupted font shows error');
  await generate(page, 'standard', '<script>alert(1)</script>');
  check(await page.locator('[data-output] script').count(), 0, 'user input never becomes markup');
  await page.locator('[data-generator]').evaluate(form => {
    form.elements.inputText.value = 'a'.repeat(1001);
    form.requestSubmit(form.querySelector('[value=standard]'));
  });
  await page.locator('[data-error]:not([hidden])').waitFor();
  check((await page.locator('[data-error]').textContent()).includes('1000'), true, 'oversized input rejected');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } });
  });
  await page.goto(`${base}dark.html`);
  await generate(page, 'standard', 'Hello');
  check((await text(page)).length > 0, true, 'storage unavailable does not break generation');
  check(await page.locator('.demo-counter [data-count]').textContent(), '1', 'in-memory counter works');
  await context.close();
  const missing = await fetch(`${base}missing/nested/page`);
  check(missing.status, 404, 'real static 404 response');
  check((await missing.text()).includes('<base href="/ascii-art-web/">'), true, 'nested 404 resolves assets to repo path');
  check(errors.length, 0, `browser errors: ${errors.join('; ')}`);
  check(requests.every(request => request.method === 'GET'), true, 'all runtime network requests are static GETs');
  check(requests.every(request => request.url.startsWith(base)), true, 'all requests stay within the static site; no external service');
  check(requests.some(request => request.url.includes('/fonts/bigmoney.txt')), true, 'fonts really fetched');
  console.log(`Browser smoke passed: ${assertions} assertions, 48 theme/font/viewport combinations, exact TXT and clipboard checks, no console errors or backend requests.`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
