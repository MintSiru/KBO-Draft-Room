/* Golden master: proves refactors do not change the simulation.
   `node tests/golden.cjs --write` records hashes; without it, compares.
   "numbers" ignores every string, so copy edits do not trip it. */
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const C = require('../src/core/engine.js'), D = require('../src/core/prospects.js');
const FILE = path.join(__dirname, 'fixtures/golden.json');
const CONFIGS = [
  ['lg', true, 'golden-a', 'normal', 'development'],
  ['kiwoom', false, 'golden-b', 'hard', 'immediate'],
  ['samsung', true, 'golden-c', 'easy', 'needs'],
  ['kia', false, 'golden-d', 'normal', 'needs'],
  ['hanwha', true, 'golden-e', 'hard', 'development'],
  ['nc', false, 'golden-f', 'easy', 'immediate'],
];
const hash = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const numbers = (x) =>
  typeof x === 'string' ? ''
  : Array.isArray(x) ? x.map(numbers)
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([, v]) => typeof v !== 'string').map(([k, v]) => [k, numbers(v)]))
  : x;
function play([team, local, seed, difficulty, gm]) {
  const g = C.createGame(team, local, seed, difficulty);
  C.openScouting(g); C.beginDraft(g);
  while (g.phase === 'draft') C.addPick(g, C.aiChoice(g).id);
  C.chooseGM(g, gm); C.runSeason(g);
  while (g.career.years.length < 5) C.nextSeason(g);
  return { game: g, review: C.careerReview(g), fans: C.fanState(g) };
}
const result = {};
for (const seed of ['pool-a', 'pool-b', 'pool-c']) {
  const pool = D.generatePool(seed).players;
  result['pool:' + seed] = { full: hash(pool), numbers: hash(numbers(pool)) };
}
for (const cfg of CONFIGS) {
  const out = play(cfg);
  const picks = out.game.picks.map((s) => s.playerId);
  result['game:' + cfg.join('/')] = { full: hash(out), numbers: hash(numbers(out)), picks: hash(picks) };
}
if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(result, null, 2) + '\n');
  console.log('wrote', FILE);
} else {
  const expected = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let failed = 0;
  for (const [k, v] of Object.entries(expected)) {
    for (const kind of Object.keys(v)) {
      const ok = result[k]?.[kind] === v[kind];
      if (!ok) failed++;
      console.log(`${ok ? 'same' : 'DIFF'}  ${kind.padEnd(7)} ${k}`);
    }
  }
  process.exit(failed && !process.argv.includes('--loose') ? 1 : 0);
}
