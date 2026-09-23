/* Release check on the built index.html in real Chromium:
   1. a fresh start works;
   2. an autosave from an older simulation version is kept aside with a notice, not replayed;
   3. the shipped example save loads through the file picker and shows the five-year review and records. */
const { chromium } = require('playwright-core'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { pathToFileURL } = require('node:url');
const KEY = 'draft-room-kbo-v6-scouting';
(async () => {
  const root = path.resolve(__dirname, '..'),
    file = path.join(root, 'index.html');
  const legacy = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/legacy-v060-save.json'), 'utf8'));
  const example = path.join(root, 'examples/demo-five-seasons.json');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(pathToFileURL(file).href);
    assert.match(await page.title(), /v0\.7/);
    assert.equal(await page.locator('[data-action=start]').count(), 1);

    await page.evaluate(([key, g]) => localStorage.setItem(key, JSON.stringify({ game: g, selectedTeam: g.teamId, local: g.local, difficulty: g.difficulty, stars: [] })), [KEY, legacy.game]);
    await page.reload();
    assert.match(await page.locator('#main .callout').innerText(), /v0\.6/);
    assert(await page.evaluate((key) => !!localStorage.getItem(key + '-sim-0.6'), KEY), 'old autosave kept aside');
    assert.equal(await page.locator('[data-action=start]').count(), 1);

    await page.locator('#import-file').setInputFiles(example);
    await page.locator('[data-action=confirm-import]').click();
    assert.match(await page.locator('h1').innerText(), /다섯 시즌/);
    const signed = await page.evaluate((key) => {
      const { game } = DraftCore.loadSave(JSON.parse(localStorage.getItem(key)).save);
      return game.picks.length + game.devSigns.length;
    }, KEY);
    await page.locator('[data-action=records]').first().click();
    assert.equal(await page.locator('.record-table tbody tr').count(), signed);
    assert.deepEqual(errors, []);
    console.log(`PASS packaged build: fresh start, older autosave kept aside, example import (${signed} players in the records), no page errors.`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
