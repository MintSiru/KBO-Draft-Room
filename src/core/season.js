/* Season simulation: role decisions, tool-driven counting stats, growth and the first-year evaluation.
   All constants are fictional tuning, not an empirical KBO model. */
(function (root) {
  'use strict';
  const S = root.DraftScouting || (typeof require !== 'undefined' ? require('./scouting.js') : null);
  const D = root.DraftData || (typeof require !== 'undefined' ? require('./prospects.js') : null),
    G = D.grades;
  const { rng, clamp, round, normal, mean } = D;
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  function emptyStats(p) {
    return ['SP', 'RP'].includes(p.role)
      ? {
          kind: 'pitcher',
          games: 0,
          gs: 0,
          qs: 0,
          outs: 0,
          er: 0,
          era: null,
          k: 0,
          bb: 0,
          wins: 0,
          holds: 0,
          saves: 0,
        }
      : {
          kind: 'hitter',
          games: 0,
          ab: 0,
          pa: 0,
          hits: 0,
          bb: 0,
          k: 0,
          hr: 0,
          doubles: 0,
          triples: 0,
          avg: null,
          ops: null,
          rbi: 0,
          sb: 0,
        };
  }
  function poisson(lambda, r) {
    let product = 1,
      n = 0,
      limit = Math.exp(-lambda);
    do {
      n++;
      product *= r();
    } while (product > limit && n < 100);
    return n - 1;
  }
  function statsFor(p, games, tools, level, r, context = {}) {
    if (!games) return emptyStats(p);
    const farm = level === 'futures',
      regular = level === 'regular',
      pitcher = ['SP', 'RP'].includes(p.role);
    if (!pitcher) {
      const pa = round(
        games * (regular ? (context.core ? 4.25 : 3.95) : farm ? 3.6 : context.cameo ? 1.8 : 2.55),
      );
      let ab = 0,
        hits = 0,
        bb = 0,
        k = 0,
        hr = 0,
        doubles = 0,
        triples = 0;
      const avgTarget = clamp(
        0.2 + (tools.contact - 30) * 0.0027 + (farm ? 0.035 : 0) + normal(r) * 0.018,
        0.16,
        0.355,
      );
      const hrChance = clamp(0.007 + (tools.power - 32) * 0.00145 + (farm ? 0.004 : 0), 0.001, 0.085),
        walk = clamp(0.04 + (tools.eye - 30) * 0.002, 0.025, 0.16),
        strikeout = clamp(0.3 - (tools.contact - 30) * 0.003, 0.1, 0.36);
      for (let i = 0; i < pa; i++) {
        if (r() < walk) {
          bb++;
          continue;
        }
        ab++;
        if (r() < hrChance) {
          hr++;
          hits++;
          continue;
        }
        if (r() < clamp((avgTarget - hrChance) / (1 - hrChance), 0.08, 0.38)) {
          hits++;
          const b = r();
          if (b < clamp((tools.speed - 30) * 0.0009, 0, 0.035)) triples++;
          else if (b < 0.18 + (tools.power - 40) * 0.0025) doubles++;
        } else if (r() < strikeout / Math.max(0.5, 1 - avgTarget)) k++;
      }
      const avg = ab ? round(hits / ab, 3) : null,
        ops = ab ? round((hits + bb) / pa + (hits + doubles + 2 * triples + 3 * hr) / ab, 3) : null;
      return {
        kind: 'hitter',
        games,
        pa,
        ab,
        hits,
        bb,
        k,
        hr,
        doubles,
        triples,
        avg,
        ops,
        rbi: round(hits * 0.32 + hr * 1.65),
        sb: Math.min(hits + bb, round(((games * Math.max(0, tools.speed - 25)) / 205) * (0.6 + r() * 0.6))),
      };
    }
    let outs = 0,
      er = 0,
      k = 0,
      bb = 0,
      wins = 0,
      holds = 0,
      saves = 0,
      qs = 0;
    const gs = p.role === 'SP' ? (regular || farm ? games : Math.floor(games * 0.65)) : 0;
    const targetERA = clamp(
      7.75 -
        tools.stuff * 0.025 -
        tools.command * 0.029 -
        tools.breaking * 0.016 -
        (farm ? 0.95 : 0) +
        normal(r) * 0.45,
      1.9,
      8.5,
    );
    for (let i = 0; i < games; i++) {
      const start = i < gs,
        ip = start
          ? clamp(3.45 + tools.stamina * 0.047 + (regular ? 0.05 : -0.45) + normal(r) * 1.1, 2.5, 7.6)
          : clamp(0.85 + normal(r) * 0.7, 0.33, 2);
      const o = round(ip * 3),
        e = poisson((targetERA * o) / 27, r);
      outs += o;
      er += e;
      k += Math.min(
        o,
        poisson((o / 27) * clamp(1.0 + (tools.stuff - 20) * 0.22 + tools.breaking * 0.02, 3.5, 13), r),
      );
      bb += poisson((o / 27) * clamp(6.2 - tools.command * 0.066, 1.1, 5.6), r);
      if (start && o >= 18 && e <= 3) qs++;
      if (start) {
        if (
          o >= 15 &&
          r() < clamp(0.3 + (5 - e) * 0.075 + (11 - (context.teamRank || 6)) * 0.01, 0.08, 0.78) &&
          r() < 0.86
        )
          wins++;
      } else {
        const u = r();
        if (u < 0.045) wins++;
        else if (regular && context.closer && u < 0.57) saves++;
        else if (!farm && u < 0.29) holds++;
      }
    }
    return {
      kind: 'pitcher',
      games,
      gs,
      qs,
      outs,
      er,
      era: round((er * 27) / outs, 2),
      k,
      bb,
      wins,
      holds,
      saves,
    };
  }
  function simulatePlayer(p, selection, g, team, fit, previous = null, yearIndex = 0, context = {}) {
    const tools = { ...(previous?.tools || p.trueTools) },
      abilityBefore = G.overall(tools, p.role);
    const r = rng(g.seed + '-performance-v6-' + yearIndex + '-' + p.id + '-' + team.id),
      healthR = rng(g.seed + '-health-v6-' + yearIndex + '-' + p.id),
      growR = rng(g.seed + '-growth-v6-' + yearIndex + '-' + p.id);
    const limited = healthR() < p.risk,
      daysLost = limited
        ? healthR() < 0.22
          ? 65 + Math.floor(healthR() * 66)
          : 7 + Math.floor(healthR() * 28)
        : 0;
    const impact = abilityBefore + normal(r) * 3,
      priorRegular = previous?.route === 'regular',
      priorBackup = previous?.route === 'backup';
    const investment =
      (selection.round <= 1 ? 0.18 : selection.round === 2 ? 0.1 : selection.round === 3 ? 0.04 : 0) *
      (yearIndex === 0 ? 1 : yearIndex === 1 ? 0.2 : 0);
    let route = 'futures',
      reason = 'development-first';
    if (daysLost >= 105) {
      route = 'rehab';
      reason = 'long-rehab';
    } else if (priorRegular) {
      const lastPerformance = previous.performance ?? 0,
        retention = clamp(0.87 + (impact - 48) * 0.009 + lastPerformance * 0.018, 0.66, 0.97);
      if (r() < retention) {
        route = 'regular';
        reason = 'role-retained';
      } else if (impact < 38 && lastPerformance < -0.8) {
        route = 'futures';
        reason = 'poor-form-and-ability';
      } else {
        route = 'backup';
        reason = lastPerformance < -0.5 ? 'poor-form' : 'role-competition';
      }
    } else {
      const chance = clamp(
        0.025 +
          sigmoid((impact - 40) / 3.6) * 0.83 +
          investment +
          (priorBackup ? 0.08 : 0) +
          (fit >= 80 ? 0.045 : 0),
        0.015,
        0.98,
      );
      if (r() < chance) {
        const regularChance = clamp(
          sigmoid((impact - (yearIndex === 0 ? 47 : 45)) / 3.6) * (yearIndex === 0 ? 0.68 : 0.86) +
            (priorBackup ? 0.08 : 0),
          0.01,
          0.95,
        );
        route =
          r() < regularChance ? 'regular' : r() < clamp((impact - 30) / 25, 0.2, 0.83) ? 'backup' : 'cameo';
        reason = route === 'regular' ? 'earned-role' : 'trial-opportunity';
      }
    }
    if (context.blockedRegular && route === 'regular') {
      route = 'backup';
      reason = 'cohort-competition';
    }
    const core = route === 'regular' && impact >= 55 && yearIndex >= 1,
      roleTier = core ? 'core' : route;
    const pitcher = ['SP', 'RP'].includes(p.role),
      mature = yearIndex >= 2;
    let games = 0;
    if (route === 'regular')
      games =
        p.role === 'SP'
          ? (yearIndex === 0 ? 20 : yearIndex === 1 ? 24 : 26) + Math.floor(r() * (mature ? 6 : 5))
          : p.role === 'RP'
            ? 44 + Math.floor(r() * 21)
            : (yearIndex === 0 ? 88 : yearIndex === 1 ? 105 : 120) + Math.floor(r() * (mature ? 21 : 25));
    if (route === 'backup')
      games =
        p.role === 'SP'
          ? 9 + Math.floor(r() * 11)
          : p.role === 'RP'
            ? 22 + Math.floor(r() * 19)
            : 40 + Math.floor(r() * 36);
    if (route === 'cameo') games = pitcher ? 2 + Math.floor(r() * 7) : 5 + Math.floor(r() * 15);
    games = round(games * (1 - daysLost / 165));
    const statR = rng(g.seed + '-counting-v6-' + yearIndex + '-' + p.id + '-' + team.id);
    const stats = statsFor(p, games, tools, route === 'regular' ? 'regular' : 'major', statR, {
      core,
      cameo: route === 'cameo',
      closer: context.closer,
      teamRank: team.rank,
    });
    const performance = !games
      ? 0
      : stats.kind === 'pitcher'
        ? clamp((4.5 - stats.era) / 1.3, -2, 2)
        : clamp((stats.ops - 0.72) / 0.12, -2, 2);
    const age = D.bio.ageAt(p.birthday, `${D.bio.ENTRY_YEAR + yearIndex}-12-31`),
      after = {};
    const rate =
      p.growthCurve === 'early'
        ? Math.max(0.2, 0.43 - yearIndex * 0.045)
        : p.growthCurve === 'late'
          ? yearIndex < 2
            ? 0.14
            : 0.44
          : 0.32;
    for (const [key, v] of Object.entries(tools)) {
      const gap = p.potentialTools[key] - v,
        aging = Math.max(0, age - (key === 'speed' ? 26 : 29)) * (key === 'speed' ? 0.38 : 0.28);
      const gain =
        gap * rate * p.developmentRate * (key === 'speed' ? 0.6 : 1) * (1 - daysLost / 210) +
        normal(growR) * 0.65 -
        aging -
        (daysLost > 100 ? 0.6 : 0);
      after[key] = round(clamp(v + clamp(gain, -2.5, 8), 20, p.potentialTools[key]), 3);
    }
    const abilityAfter = G.overall(after, p.role),
      growth = round(abilityAfter - abilityBefore, 2),
      observed = G.observe(
        after,
        p.role,
        p,
        yearIndex + 1,
        rng(g.seed + '-report-v6-' + yearIndex + '-' + p.id),
      );
    const startGrade = previous?.scoutReady ?? p.ready,
      startTools = previous?.publicTools ?? p.tools;
    const contribution = !games
      ? 0
      : stats.kind === 'pitcher'
        ? clamp((stats.outs / 3) * 0.42 + (4.7 - stats.era) * 7, 0, 100)
        : clamp(stats.pa * 0.095 + (stats.ops - 0.7) * 45 + (tools.defense - 45) * 0.15, 0, 100);
    let futuresGames =
      route === 'rehab'
        ? 0
        : route === 'regular'
          ? pitcher
            ? 2
            : 5
          : route === 'backup'
            ? pitcher
              ? 9
              : 35
            : pitcher
              ? 20 + Math.floor(r() * 8)
              : 80 + Math.floor(r() * 25);
    futuresGames = round(futuresGames * (1 - daysLost / 165));
    if (!pitcher) futuresGames = Math.min(futuresGames, 144 - games);
    const futures = statsFor(
      p,
      futuresGames,
      tools,
      'futures',
      rng(g.seed + '-farm-v6-' + yearIndex + '-' + p.id),
      { teamRank: team.rank },
    );
    const expectedGrowth = Math.max(
      0.65,
      (p.scoutCeiling - startGrade) * (p.ceilingGrade - startGrade >= 20 && yearIndex < 2 ? 0.13 : 0.2),
    );
    const progress = startGrade >= p.scoutCeiling - 2 ? 1 : clamp(growth / expectedGrowth, 0, 1.3);
    const planScore = round(
      clamp(
        28 + progress * 43 + (games ? 8 : 0) + (route === 'regular' ? 8 : 0) - (daysLost > 60 ? 4 : 0),
        10,
        100,
      ),
    );
    const routeLabel = {
      regular: core ? (pitcher ? '핵심 투수' : '핵심 주전') : '1군 안착',
      backup: '백업·보조 역할',
      cameo: '짧은 1군 경험',
      futures: '퓨처스 육성',
      rehab: '장기 재활',
    }[route];
    const reasons = {
      'development-first': '시즌 시작 기량으로는 1군 경쟁 문턱을 넘지 못해 퓨처스 실전을 우선했습니다.',
      'long-rehab': `장기 건강 문제로 ${daysLost}일의 출전 공백이 생겨 재활에 집중했습니다.`,
      'role-retained': '전년도 1군 보직과 축적된 경험을 바탕으로 자리를 이어갔습니다.',
      'poor-form-and-ability':
        '전년도 큰 부진과 낮아진 시즌 시작 기량을 함께 반영해 퓨처스에서 재정비했습니다.',
      'poor-form': '전년도 성적 부진을 반영해 백업으로 역할을 줄이고 다시 평가했습니다.',
      'role-competition': '기존 1군 자리는 유지하되 올해 보직 경쟁에서 출전 비중이 줄었습니다.',
      'cohort-competition': '동기 내 같은 포지션의 보직 정원이 차 백업부터 경쟁했습니다.',
      'earned-role': '시즌 시작 기량과 적응, 포지션 기회를 바탕으로 1군 보직을 확보했습니다.',
      'trial-opportunity': `현재 기량과 ${investment > 0 ? '상위 지명에 대한 시험 기회, ' : ''}포지션 수요를 반영해 제한적인 1군 기회를 받았습니다.`,
    };
    const note =
      reasons[reason] +
      (limited && route !== 'rehab' ? ` 건강 문제로 ${daysLost}일의 출전 공백이 있었습니다.` : '');
    const bestTool = Object.keys(after).sort((a, b) => after[b] - tools[b] - (after[a] - tools[a]))[0];
    const growthLabel =
      growth >= 3
        ? '뚜렷한 성장'
        : growth >= 1.4
          ? '꾸준한 발전'
          : growth >= 0.3
            ? '기술 발전'
            : growth >= 0
              ? '완성도 유지'
              : '기량 후퇴';
    return {
      playerId: p.id,
      label: selection.label,
      year: D.bio.ENTRY_YEAR + yearIndex,
      teamId: team.id,
      age,
      route,
      roleTier,
      routeLabel,
      stats,
      futures,
      growth,
      growthLabel,
      developmentNote: `${G.LABELS[bestTool]} 중심 훈련 · 현재 기량 ${startGrade} → ${observed.ready}`,
      note,
      routeReason: reason,
      limited,
      daysLost,
      contribution: round(contribution),
      planScore,
      target: p.ready >= 45 ? '1군 경쟁 도전' : '퓨처스 적응·기술 발전',
      unexpected: route === 'regular' && selection.round >= 4,
      startGrade,
      startTools: { ...startTools },
      publicTools: observed.tools,
      scoutReady: observed.ready,
      endState: {
        ability: round(abilityAfter, 3),
        tools: after,
        publicTools: observed.tools,
        scoutReady: observed.ready,
        route,
        roleTier,
        limited,
        daysLost,
        age,
        performance,
      },
    };
  }
  function evaluate(g, season, players, team) {
    const roles = new Set(players.map((p) => p.role));
    const needScore = round(S.needCoverage(players, team));
    const production = round(mean(season.map((s) => s.planScore))),
      future = round(
        clamp(
          50 + (mean(players.map((p) => p.scoutCeiling)) - 45) * 3 + mean(season.map((s) => s.growth)) * 4,
          0,
          100,
        ),
      ),
      score = round(needScore * 0.4 + production * 0.25 + future * 0.35);
    const majorCount = season.filter((s) => s.stats.games > 0).length,
      regularCount = season.filter((s) => s.route === 'regular').length;
    return {
      score,
      grade: score >= 89 ? 'A' : score >= 77 ? 'B' : score >= 63 ? 'C' : 'D',
      needScore,
      production,
      future,
      text: '첫해 보직과 성장 과정을 함께 본 평가입니다.',
      missing: team.needs.filter((role) => !roles.has(role)).map((role) => D.ROLES[role]),
      majorCount,
      regularCount,
      developmentCount: season.length - majorCount,
      planMessage: `1군 경험 ${majorCount}명 · 안착 ${regularCount}명. 보강은 포지션과 세부 유형 적합도를 함께 봅니다. 미래 평가는 공개 전망과 관측된 발전에 근거합니다.`,
    };
  }
  const api = { simulatePlayer, evaluate, emptyStats, statsFor };
  root.DraftSeason = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
