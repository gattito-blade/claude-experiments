// Render scenes to PNG with headless Chromium: node render.mjs [scene] [seed]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const [scene = 'saturn', seed = '7'] = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => { console.error(e); process.exitCode = 1; });
const url = pathToFileURL(join(here, 'index.html')).href + `?scene=${scene}&seed=${seed}`;
const t = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.done === true, null, { timeout: 120000 });
const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
const out = join(here, 'out', `${scene}-${seed}.png`);
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log(`${out} (${Date.now() - t} ms)`);
await browser.close();
