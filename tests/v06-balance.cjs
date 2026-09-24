/* Reproducible all-AI balance audit over the full career (C.Career.SEASONS seasons).
   These are game-design targets for fictional players, not official KBO statistics.
   BALANCE_SEEDS sets drafts per difficulty (default 200). */
const C = require('../src/core/engine.js'),
  D = require('../src/core/prospects.js'),
  fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');

const N = Number(process.env.BALANCE_SEEDS || 200),
  SEASONS = C.Career.SEASONS,
  T = C.tuning,
  results = [];
const pct = (a, b) => D.round((a * 100) / (b || 1), 2);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r3 = (x) => (x == null ? null : D.round(x, 3));

function playDraft(difficulty, i) {
  const g = C.createGame('kiwoom', i % 2 === 0, 'balance06-' + i, difficulty);
  C.openScouting(g);
  C.beginDraft(g);
  while (g.phase === 'draft') C.addPick(g, C.aiChoice(g).id);
  C.signDevelopment(g, C.undrafted(g).slice(0, i % 6).map((p) => p.id));
  C.chooseGM(g, ['immediate', 'development', 'needs'][i % 3]);
  C.runSeason(g);
  while (g.career.years.length < SEASONS) C.nextSeason(g);
  return g;
}

for (const difficulty of ['easy', 'normal', 'hard']) {
  const roundKeys = [...Array(C.ROUNDS + 1).keys(), 'dev'];
  const rounds = Object.fromEntries(roundKeys.map((k) => [k, { round: k, n: 0, rookieDebut: 0, debut: 0, regular: 0, fv: 0, fv60: 0 }]));
  const years = Array.from({ length: SEASONS }, (_, i) => ({ year: C.ENTRY_YEAR + i, n: 0, debut: 0, regular: 0, playing: 0, service: 0 }));
  const trans = { n: 0, healthySame: 0, healthyRetained: 0, healthyFutures: 0 };
  const hitters = [], starters = [], relievers = [], seasonWar = [], classWar = [], scores = [], enlistAges = [];
  const events = { trade: 0, release: 0, claim: 0, retire: 0, enlist: 0 };
  const service = { sangmu: 0, army: 0, social: 0, exempt: 0, overdue: 0, players: 0 };
  let near5 = 0, players = 0, maxW = 0, maxHR = 0, tenW = 0, twentyHR = 0, fv60Pools = 0, mlbPools = 0;

  for (let i = 0; i < N; i++) {
    const g = playDraft(difficulty, i),
      pool = C.poolFor(g);
    mlbPools += pool.players.some((p) => p.pathway === 'MLB 경험 복귀');
    fv60Pools += pool.players.filter((p) => p.scoutCeiling >= 60).length;
    for (const s of C.signed(g)) {
      const p = C.getPlayer(g, s.playerId),
        h = C.Career.history(g.career, p.id),
        st = g.career.players[p.id],
        r = rounds[s.dev ? 'dev' : s.round];
      r.n++;
      r.rookieDebut += h[0].stats.games > 0;
      r.debut += h.some((x) => x.stats.games > 0);
      r.regular += h.some((x) => x.route === 'regular');
      r.fv += p.scoutCeiling;
      r.fv60 += p.scoutCeiling >= 60;
      players++;
      near5 += p.upside - st.ability <= 5;
      service.players++;
      if (st.exempt) service.exempt++;
      if (st.status === 'active' && !st.served && !st.exempt && !st.service && h.at(-1).age > T.service.mustAge) service.overdue++;
      h.forEach((rec, j) => {
        const y = years[j],
          stats = rec.stats;
        y.n++;
        y.debut += stats.games > 0;
        y.regular += rec.route === 'regular';
        y.playing += !['released', 'retired'].includes(rec.route);
        y.service += rec.route === 'service';
        if (j && h[j - 1].route === 'regular' && !rec.limited && rec.teamId === h[j - 1].teamId && rec.route !== 'service') {
          trans.healthySame++;
          trans.healthyRetained += rec.route === 'regular';
          trans.healthyFutures += rec.route === 'futures';
        }
        if (stats.kind === 'pitcher') {
          maxW = Math.max(maxW, stats.wins);
          tenW += stats.wins >= 10;
          if (stats.gs >= 20) starters.push({ era: stats.era, ip: stats.outs / 3, w: stats.wins, k9: (stats.k * 27) / stats.outs, bb9: (stats.bb * 27) / stats.outs });
          if (!stats.gs && stats.games >= 40) relievers.push({ era: stats.era, sv: stats.saves, hld: stats.holds });
        } else {
          maxHR = Math.max(maxHR, stats.hr);
          twentyHR += stats.hr >= 20;
          if (stats.pa >= 400)
            hitters.push({ avg: stats.avg, obp: (stats.hits + stats.bb) / stats.pa, slg: (stats.hits + stats.doubles + 2 * stats.triples + 3 * stats.hr) / stats.ab, ops: stats.ops, hr: stats.hr });
        }
        if ((stats.kind === 'hitter' && stats.pa >= 400) || (stats.kind === 'pitcher' && stats.outs >= 300)) seasonWar.push(rec.war);
      });
    }
    for (const ev of g.career.events) {
      events[ev.type] = (events[ev.type] || 0) + 1;
      if (ev.type === 'enlist') {
        service[ev.service]++;
        enlistAges.push(ev.year + 1 - Number(C.getPlayer(g, ev.playerIds[0]).birthday.slice(0, 4)));
      }
    }
    for (const t of C.careerReview(g)) {
      scores.push(t.score);
      classWar.push(t.total);
    }
  }

  const roundRow = (r) => ({
    round: r.round,
    sample: r.n,
    rookieDebutPct: pct(r.rookieDebut, r.n),
    careerDebutPct: pct(r.debut, r.n),
    everRegularPct: pct(r.regular, r.n),
    meanFV: D.round(r.fv / (r.n || 1), 2),
    fv60plusPct: pct(r.fv60, r.n),
  });
  const enlisted = service.sangmu + service.army + service.social;
  const row = {
    difficulty,
    drafts: N,
    players,
    rounds: roundKeys.map((k) => roundRow(rounds[k])),
    years: years.map((y) => ({
      year: y.year,
      debutPct: pct(y.debut, y.n),
      regularPct: pct(y.regular, y.n),
      playingPct: pct(y.playing, y.n),
      servicePct: pct(y.service, y.n),
      regularsPerClub: D.round(y.regular / (N * 10), 2),
    })),
    transitions: { healthySameTeamSample: trans.healthySame, healthyRetentionPct: pct(trans.healthyRetained, trans.healthySame), healthyToFuturesPct: pct(trans.healthyFutures, trans.healthySame) },
    growth: { within5InternalCeilingPct: pct(near5, players) },
    stats: {
      qualifiedHitters: hitters.length,
      hitterMedian: { avg: r3(median(hitters.map((x) => x.avg))), obp: r3(median(hitters.map((x) => x.obp))), slg: r3(median(hitters.map((x) => x.slg))), ops: r3(median(hitters.map((x) => x.ops))) },
      hitterMeanHR: D.round(avg(hitters.map((x) => x.hr)), 2),
      qualifiedStarters: starters.length,
      starterMedianERA: median(starters.map((x) => x.era)),
      starterMeanIP: D.round(avg(starters.map((x) => x.ip)), 2),
      starterMeanWins: D.round(avg(starters.map((x) => x.w)), 2),
      starterMedianK9: r3(median(starters.map((x) => x.k9))),
      starterMedianBB9: r3(median(starters.map((x) => x.bb9))),
      relieverMedianERA: median(relievers.map((x) => x.era)),
      maxSPWins: maxW,
      maxHitterHR: maxHR,
      tenWinSeasons: tenW,
      twentyHRSeasons: twentyHR,
    },
    war: { qualifiedSeasonMedian: median(seasonWar), qualifiedSeasonMax: Math.max(...seasonWar), classTotalMedian: median(classWar) },
    service: {
      enlistedPerDraft: D.round(enlisted / N, 2),
      sangmuPct: pct(service.sangmu, enlisted),
      armyPct: pct(service.army, enlisted),
      socialPct: pct(service.social, enlisted),
      exemptPerDraft: D.round(service.exempt / N, 2),
      medianEnlistAge: median(enlistAges),
      overdue: service.overdue,
    },
    movesPerDraft: Object.fromEntries(Object.entries(events).map(([k, v]) => [k, D.round(v / N, 2)])),
    meanFinalScore: D.round(avg(scores), 2),
    mlbPools,
    meanFV60plusPerPool: D.round(fv60Pools / N, 2),
  };
  results.push(row);
  console.log(JSON.stringify(row, null, 2));

  const R = (k) => row.rounds.find((r) => r.round === k);
  assert(R(1).careerDebutPct >= 90, 'first-rounders almost all reach the first team');
  assert(R(1).everRegularPct >= 60 && R(1).everRegularPct <= 98, 'first-round establishment is likely, not certain');
  assert(R(C.ROUNDS).careerDebutPct >= 15 && R(C.ROUNDS).careerDebutPct <= 45, 'last-round debut is uncommon');
  assert(R(C.ROUNDS).everRegularPct <= 12, 'last-round regulars are rare');
  assert(R('dev').careerDebutPct <= 35, 'development contracts rarely debut');
  assert(Math.max(...row.years.map((y) => y.regularsPerClub)) <= 3.5, 'one class cannot fill a first-team roster');
  assert(row.transitions.healthyRetentionPct >= 70 && row.transitions.healthyRetentionPct <= 98, 'established role continuity');
  assert(row.transitions.healthyToFuturesPct < 3, 'no random healthy demotion');
  assert(row.growth.within5InternalCeilingPct >= 30 && row.growth.within5InternalCeilingPct <= 95, 'growth gap closes, not guaranteed');
  assert(row.stats.hitterMedian.ops >= 0.7 && row.stats.hitterMedian.ops <= 0.82, 'qualified hitters near KBO levels');
  assert(row.stats.starterMedianERA >= 3.5 && row.stats.starterMedianERA <= 4.8, 'qualified starters near KBO levels');
  assert(row.stats.starterMeanIP >= 130 && row.stats.starterMeanIP <= 180);
  assert(row.stats.hitterMeanHR >= 8 && row.stats.hitterMeanHR <= 20);
  assert(row.stats.maxSPWins >= 15 && row.stats.maxHitterHR >= 30 && tenW > 100 && twentyHR > 100, 'big seasons still happen');
  assert(row.service.overdue === 0, 'nobody stays unserved past the deadline');
  assert(row.service.sangmuPct >= 8 && row.service.sangmuPct <= 30, 'Sangmu is selective');
  assert(row.years.at(-1).playingPct >= 35 && row.years.at(-1).playingPct <= 70, 'many careers end within ten years');
  assert(row.meanFV60plusPerPool < 12);
  assert(R(3).fv60plusPct < 10);
  assert(R(C.ROUNDS).meanFV < R(1).meanFV - 8);
  assert(row.meanFinalScore >= 45 && row.meanFinalScore <= 80);
  assert(events.trade > 0 && events.retire > 0);
}
const report = {
  notice: 'Fictional all-AI balance audit over the full career. Thresholds are game-design targets, not official KBO statistics.',
  sim: C.SIM_VERSION,
  drafts: N * 3,
  results,
};
fs.writeFileSync(path.join(__dirname, 'v06-balance-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log('PASS balance checks (SIM ' + C.SIM_VERSION + ')');
