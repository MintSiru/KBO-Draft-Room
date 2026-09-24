/* Golden master: proves refactors do not change the simulation.
   `node tests/golden.cjs --write` records hashes; without it, compares.

   Two hashes per case:
   - `sim`: an explicit list of simulated values (generated talent, picks, roles, stats, growth, standings,
     moves, scores). Adding a new descriptive field does not change it; changing the simulation does.
   - `full`: everything, including wording. Only-wording changes may be re-recorded freely. */
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
const only = (o, keys) => (o == null ? o : Object.fromEntries(keys.map((k) => [k, o[k]])));
const numbersOf = (o) => (o == null ? o : Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'number')));

const PLAYER_KEYS = ['id', 'rank', 'name', 'role', 'type', 'pathway', 'region', 'currentInstitutionId', 'highSchoolId', 'birthday', 'age',
  'height', 'weight', 'throwHand', 'batHand', 'velocity', 'ready', 'scoutCeiling', 'floorGrade', 'ceilingGrade', 'publicScore', 'tools',
  'futureTools', 'trueTools', 'potentialTools', 'growthCurve', 'developmentRate', 'observerBias', 'risk', 'favoriteTeam', 'pickTags',
  'uncertainty', 'regionalEligible', 'quotaEligible'];
const simPlayer = (p) => ({ ...only(p, PLAYER_KEYS), record: numbersOf(p.record) });
const RECORD_KEYS = ['playerId', 'teamId', 'year', 'age', 'role', 'second', 'route', 'serviceType', 'roleTier', 'growth', 'scoutReady', 'scoutFV', 'publicTools', 'planScore', 'contribution', 'war', 'daysLost', 'limited'];
const simRecord = (r) => ({ ...only(r, RECORD_KEYS), stats: numbersOf(r.stats), futures: numbersOf(r.futures), end: only(r.endState, ['ability', 'tools', 'performance']) });
function simGame({ game: g, review, fans }) {
  return {
    picks: g.picks.map((s) => [s.overall, s.teamId, s.playerId, s.fit]),
    dev: (g.devSigns || []).map((s) => [s.overall, s.teamId, s.playerId]),
    budgets: g.budgets,
    talks: g.talks.map((t) => [t.teamId, t.playerId, t.ask, t.offer, t.result, t.counter, t.bonus]),
    gm: [g.gmChoice, g.gmAnswers],
    news: g.news.map((n) => [n.playerId, n.delta]),
    forecasts: g.forecasts.map((f) => f.picks.map((s) => [s.teamId, s.round, s.playerId])),
    scout: g.scoutReport.candidates.map((c) => c.playerId),
    plans: g.clubPlans,
    owner: g.owner && only(g.owner, ['score', 'grade', 'needScore', 'production', 'future', 'baseScore']),
    fans: fans.timeline.map((x) => [x.delta, x.score]),
    years: g.career.years.map((y) => ({
      records: y.records.map(simRecord),
      table: y.league.table.map((t) => [t.teamId, t.wins, t.losses, t.rank]),
      champion: y.league.champion,
      series: y.league.series.map((x) => [x.home, x.away, x.homeWins, x.awayWins]),
      awards: y.awards.map((a) => [a.id, a.playerId, a.teamId]),
      events: y.events.map((e) => [e.type, e.service, e.fromTeamId, e.toTeamId, ...e.playerIds]),
      international: (y.international || []).map((e) => [e.name, e.result, e.playerIds, e.exemptIds]),
    })),
    players: Object.values(g.career.players).map((s) => only(s, ['playerId', 'status', 'currentTeamId', 'ability', 'scoutReady', 'scoutFV', 'served', 'exempt', 'service', 'role', 'focus', 'twoWay', 'roleHistory', 'other'])),
    plans: g.devPlans || [],
    service: g.serviceOrders || [],
    review: review.map((x) => numbersOf(x)),
  };
}
function play([team, local, seed, difficulty, gm]) {
  const g = C.createGame(team, local, seed, difficulty);
  C.openScouting(g); C.beginDraft(g);
  while (g.phase === 'draft') C.addPick(g, C.aiChoice(g).id);
  C.signAll(g);
  C.signDevelopment(g, C.undrafted(g).slice(2, 2 + Math.min(3, Math.floor(C.budgetLeft(g) / C.tuning.contracts.devCost))).map((p) => p.id));
  C.chooseGM(g, gm, { first: ['now', 'project', 'fit'][seed.charCodeAt(seed.length - 1) % 3] });
  // First-season plans: focus our first pick on his first tool and move the first movable player.
  const opts = C.planOptions(g), plans = {};
  if (opts[0]) plans[opts[0].playerId] = { focus: opts[0].focusOptions[1] };
  const mover = opts.find((o) => o.roleOptions.length && o !== opts[0]);
  if (mover) plans[mover.playerId] = { role: mover.roleOptions[0] };
  C.runSeason(g, plans);
  while (g.career.years.length < C.Career.SEASONS) {
    // Every other season, send our first eligible player to Sangmu when he has a chance, else hold him back.
    const o = C.serviceOptions(g)[0];
    C.nextSeason(g, o && g.career.years.length % 2 ? { [o.playerId]: o.sangmu ? 'sangmu' : o.must ? 'army' : 'defer' } : {});
  }
  return { game: g, review: C.careerReview(g), fans: C.fanState(g) };
}
const result = {};
for (const seed of ['pool-a', 'pool-b', 'pool-c']) {
  const pool = D.generatePool(seed).players;
  result['pool:' + seed] = { sim: hash(pool.map(simPlayer)), full: hash(pool) };
}
for (const cfg of CONFIGS) {
  const out = play(cfg);
  result['game:' + cfg.join('/')] = { sim: hash(simGame(out)), full: hash(out) };
}
const expected = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
const diffs = [];
for (const [k, v] of Object.entries(expected?.hashes ?? {}))
  for (const kind of Object.keys(v)) if (result[k]?.[kind] !== v[kind]) diffs.push({ k, kind });
// `sim` is the simulation itself; `full` also covers wording and descriptive fields.
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
