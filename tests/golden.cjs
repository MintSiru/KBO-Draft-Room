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
const expected = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
const diffs = [];
for (const [k, v] of Object.entries(expected?.hashes ?? {}))
  for (const kind of Object.keys(v)) if (result[k]?.[kind] !== v[kind]) diffs.push({ k, kind });
// `full` includes wording; `numbers` and `picks` are the simulation itself.
const behaviourChanged = diffs.some((d) => d.kind !== 'full');
const sameSim = expected?.sim === C.SIM_VERSION;

if (process.argv.includes('--write')) {
  if (expected && behaviourChanged && sameSim) {
    console.error(`Simulation results changed but SIM_VERSION is still '${C.SIM_VERSION}'.
Bump SIM_VERSION in src/core/engine.js first: saves from '${C.SIM_VERSION}' would otherwise replay into different histories.`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ sim: C.SIM_VERSION, hashes: result }, null, 2) + '\n');
  console.log(`wrote ${FILE} (SIM_VERSION ${C.SIM_VERSION})`);
} else {
  for (const d of diffs) console.log(`DIFF  ${d.kind.padEnd(7)} ${d.k}`);
  let problem = null;
  if (!sameSim && !behaviourChanged)
    problem = `SIM_VERSION changed ('${expected.sim}' -> '${C.SIM_VERSION}') but the simulation did not. Revert the bump, or re-record with --write.`;
  else if (!sameSim) problem = `SIM_VERSION is now '${C.SIM_VERSION}'. Re-record the baseline: node tests/golden.cjs --write`;
  else if (behaviourChanged)
    problem = `Simulation results changed. If intended, bump SIM_VERSION in src/core/engine.js, then run: node tests/golden.cjs --write`;
  else if (diffs.length) problem = 'Only wording changed. Re-record the baseline: node tests/golden.cjs --write';
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  console.log(`golden: ${Object.keys(result).length} cases unchanged (SIM_VERSION ${C.SIM_VERSION})`);
}
