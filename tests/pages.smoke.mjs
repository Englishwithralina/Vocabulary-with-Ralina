import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from '@playwright/test';

const base = '/Vocabulary-with-Ralina/', directory = resolve('dist');
const html = await readFile(resolve(directory, 'index.html'), 'utf8');
assert.ok(html.includes(`${base}assets/`), 'Run npm run build:pages before this check.');
assert.ok(!html.includes('/src/main.js'), 'Deploy built assets, not the source entry point.');
const files = await readdir(directory, { recursive: true });
assert.ok(!files.some(file => /(^|[/\\])(?:\.env[^/\\]*|node_modules|src|firestore\.rules)([/\\]|$)/u.test(file)), 'Build output must not contain environment files or server/source files.');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

// Deliberately no SPA fallback: like Pages, only real static paths are served.
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === base.slice(0, -1)) { res.writeHead(301, { Location: base + url.search }); res.end(); return; }
  if (!url.pathname.startsWith(base)) { res.writeHead(404); res.end(); return; }
  const path = resolve(directory, decodeURIComponent(url.pathname.slice(base.length) || 'index.html'));
  if (!path.startsWith(directory + sep)) { res.writeHead(404); res.end(); return; }
  try { const data = await readFile(path); res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  // Verify every emitted asset at its production URL, including lazy teacher/world chunks.
  for (const file of files.filter(file => file.startsWith('assets/') || file.startsWith('assets\\'))) {
    const response = await fetch(origin + base + file.replaceAll('\\', '/'));
    assert.equal(response.status, 200, 'A compiled asset is missing from its repository path.');
  }
  browser = await chromium.launch(process.env.CI ? {} : { channel: 'chrome' });
  const page = await browser.newPage();
  let runtimeErrors = 0, failedAssets = 0;
  page.on('pageerror', () => { runtimeErrors++; });
  page.on('response', response => { if (response.url().startsWith(origin + base + 'assets/') && response.status() >= 400) failedAssets++; });
  // Smoke checks never contact the live Firebase project or print configuration values.
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin + base);
  await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
  await page.getByLabel('Email address').waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.fonts.status), 'loaded');
  const teacherChunk = files.find(file => /^assets[/\\]teacher-.*\.js$/u.test(file));
  assert.ok(teacherChunk, 'The lazy Teacher Studio bundle must be present.');
  assert.equal(await page.evaluate(async url => typeof (await import(url)).teacherApp, origin + base + teacherChunk.replaceAll('\\', '/')), 'function');
  await page.reload();
  await page.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
  // The slash makes this ID intentionally invalid, so the existing data layer returns
  // "unavailable" without a network request. This proves the public route bypasses sign-in.
  for (const entry of [base, base + 'index.html']) {
    await page.goto(origin + entry + '?practice=invalid%2Fid');
    await page.getByRole('heading', { name: 'This practice isn’t available.', exact: true }).waitFor();
    assert.equal(await page.locator('#login').count(), 0);
    await page.reload();
    await page.getByRole('heading', { name: 'This practice isn’t available.', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('practice'), 'invalid/id');
  }
  assert.equal((await fetch(origin + base + 'not-an-app-route')).status, 404, 'The test server must not hide missing routes with a fallback.');
  assert.equal(runtimeErrors, 0, 'Production JavaScript failed.');
  assert.equal(failedAssets, 0, 'Production asset loading failed.');
  console.log('Pages production smoke passed: repository asset paths, sign-in initialization, lazy Teacher Studio import, reload, direct query links and index.html links. Live Firebase requests blocked.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
