/* Five-year draft-class careers. Pure deterministic transitions; no live roster dependency. */
(function (root) {
  'use strict';
  const D = root.DraftData || (typeof require !== 'undefined' ? require('./prospects.js') : null);
  const M = root.DraftSeason || (typeof require !== 'undefined' ? require('./season.js') : null);
  const TEAMS = root.DraftClubs || (typeof require !== 'undefined' ? require('./clubs.js') : null);
  const byTeam = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
  const { rng, normal, clamp, round, mean } = D;
  const { TUNING: T, letter } = root.DraftTuning || (typeof require !== 'undefined' ? require('./tuning.js') : null);
  const S = root.DraftScouting || (typeof require !== 'undefined' ? require('./scouting.js') : null);
  const SEASONS = 10;
  const fit = (p, t) => S.fit(p, t);
  function create(picks, byId, seed = '', boosts = {}) {
    return {
      seed,
      boosts, // teamId → growth-rate bonus for its own signings in their first seasons (unspent budget)
      years: [],
      players: Object.fromEntries(
        picks.map((s) => {
          const p = byId[s.playerId];
          return [
            p.id,
            {
              playerId: p.id,
              originTeamId: s.teamId,
              currentTeamId: s.teamId,
              status: 'active',
              ability: p.trueReady,
              tools: { ...p.trueTools },
              publicTools: { ...p.tools },
              scoutReady: p.ready,
              route: null,
              limited: false,
              age: p.age,
              scoutFV: p.scoutCeiling,
              fvRaw: p.scoutCeiling,
              // Some independent-league players and returnees have already done their service.
              served: rng(seed + '-served-' + p.id)() < (T.service.servedAtDraft[p.pathway] ?? 0),
              exempt: null,
              service: null,
              routeBefore: null,
              absentDays: 0,
              debuted: false,
              noGameStreak: 0,
              rehabStreak: 0,
              injuryDays: 0,
            },
          ];
        }),
      ),
      events: [],
    };
  }
  function totalStats(records, key = 'stats') {
    const first = records[0]?.[key];
    if (!first) return null;
    const out = { kind: first.kind };
    const keys =
      first.kind === 'pitcher'
        ? ['games', 'gs', 'qs', 'outs', 'er', 'k', 'bb', 'wins', 'holds', 'saves']
        : ['games', 'ab', 'pa', 'hits', 'bb', 'k', 'hr', 'doubles', 'triples', 'rbi', 'sb'];
    for (const k of keys) out[k] = records.reduce((n, x) => n + (x[key]?.[k] || 0), 0);
    if (out.kind === 'pitcher') out.era = out.outs ? round((out.er * 27) / out.outs, 2) : null;
    else {
      out.avg = out.ab ? round(out.hits / out.ab, 3) : null;
      out.ops = out.ab
        ? round(
            (out.hits + out.bb) / (out.ab + out.bb) +
              (out.hits + out.doubles + 2 * out.triples + 3 * out.hr) / out.ab,
            3,
          )
        : null;
    }
    return out;
  }
  function standings(seed, year, records) {
    const L = T.league,
      Rt = L.rating;
    const winChance = (a, b) => 1 / (1 + Math.exp((ratings[b.teamId] - ratings[a.teamId]) / L.logisticScale));
    const ratings = {},
      table = TEAMS.map((t) => ({
        teamId: t.id,
        wins: 0,
        losses: 0,
        games: (TEAMS.length - 1) * T.league.gamesPerPair,
        rookieContribution: records.filter((x) => x.teamId === t.id).reduce((a, x) => a + x.contribution, 0),
      }));
    for (const t of TEAMS) {
      const r = rng(seed + '-background-' + year + '-' + t.id);
      ratings[t.id] =
        Rt.base +
        (Rt.rankPivot - t.rank) * Rt.perRank +
        normal(r) * Rt.noise +
        Math.min(Rt.rookieMax, table.find((x) => x.teamId === t.id).rookieContribution / Rt.rookieScale);
    }
    const r = rng(seed + '-schedule-' + year);
    for (let i = 0; i < 10; i++)
      for (let j = i + 1; j < 10; j++)
        for (let n = 0; n < L.gamesPerPair; n++) {
          const a = table[i],
            b = table[j],
            chance = winChance(a, b);
          const [w, l] = r() < chance ? [a, b] : [b, a];
          w.wins++;
          l.losses++;
        }
    table.sort(
      (a, b) => b.wins - a.wins || ratings[b.teamId] - ratings[a.teamId] || a.teamId.localeCompare(b.teamId),
    );
    table.forEach((x, i) => (x.rank = i + 1));
    const post = rng(seed + '-postseason-' + year),
      series = [];
    function play(a, b, need, label, advantage = 0) {
      let aw = advantage,
        bw = 0;
      while (aw < need && bw < need) {
        if (post() < winChance(a, b)) aw++;
        else bw++;
      }
      const winner = aw > bw ? a : b;
      series.push({
        label,
        home: a.teamId,
        away: b.teamId,
        homeWins: aw,
        awayWins: bw,
        winner: winner.teamId,
      });
      return winner;
    }
    let winner = play(table[3], table[4], 2, '와일드카드', 1);
    winner = play(table[2], winner, 3, '준플레이오프');
    winner = play(table[1], winner, 3, '플레이오프');
    winner = play(table[0], winner, 4, '한국시리즈');
    return { table, champion: winner.teamId, series };
  }
  function awards(year, records, league) {
    const out = [];
    function best(kind, title, min, score) {
      const list = records
        .filter((x) => x.stats.kind === kind && min(x.stats))
        .map((x) => ({ x, score: score(x.stats) }))
        .sort((a, b) => b.score - a.score || a.x.playerId.localeCompare(b.x.playerId));
      if (list[0]) {
        const x = list[0].x;
        out.push({
          id: year + '-' + kind,
          title,
          scope: 'draft-class',
          year,
          playerId: x.playerId,
          teamId: x.teamId,
        });
      }
    }
    const H = T.awards.hitter,
      P = T.awards.pitcher;
    best(
      'hitter',
      '드래프트 동기 올해의 타자',
      (s) => s.pa >= H.minPA,
      (s) => s.pa * H.perPA + (s.ops - H.opsPivot) * H.perOps + s.hr * H.perHR,
    );
    best(
      'pitcher',
      '드래프트 동기 올해의 투수',
      (s) => s.outs >= P.minOuts,
      (s) => s.outs * P.perOut + (P.eraPivot - s.era) * P.perEra + s.k * P.perK,
    );
    for (const x of records.filter((x) => x.teamId === league.champion && x.stats.games > 0))
      out.push({
        id: year + '-champion-' + x.playerId,
        title: '한국시리즈 우승 멤버',
        scope: 'team',
        year,
        playerId: x.playerId,
        teamId: x.teamId,
      });
    return out;
  }
  // ---------------------------------------------------------------- military service

  const ageIn = (p, yearIndex) => D.bio.ageAt(p.birthday, `${D.bio.ENTRY_YEAR + yearIndex}-12-31`);
  const inService = (s) => !!s.service;
  const canPlay = (s) => s.status === 'active' && !s.service;
  const needsService = (s) => s.status === 'active' && !s.served && !s.exempt && !s.service;

  /** Chance that Sangmu accepts the player this year (0 if too old). */
  function sangmuChance(state, p, yearIndex) {
    const Sg = T.service.sangmu;
    if (ageIn(p, yearIndex) > Sg.maxAge) return 0;
    return clamp((state.scoutReady - Sg.minGrade) * Sg.perGrade + (state.debuted ? Sg.playedBonus : 0), Sg.min, Sg.max);
  }
  /** Social-service (공익) classification; injuries make it more likely. Fixed per player once rolled. */
  function socialService(state, seed) {
    const So = T.service.social;
    return rng(seed + '-physical-' + state.playerId)() < clamp(So.base + state.injuryDays * So.perInjuryDay, 0, So.max);
  }
  const gamesSoon = (yearIndex) =>
    T.international.filter((e) => e.ageLimit && e.year >= D.bio.ENTRY_YEAR + yearIndex && e.year <= D.bio.ENTRY_YEAR + yearIndex + 1);

  /** Players the club may send to service before season `yearIndex`, with what they could do. */
  function serviceOptions(career, byId, yearIndex) {
    const Sv = T.service;
    if (yearIndex < Sv.firstYear || yearIndex >= SEASONS) return [];
    return Object.values(career.players)
      .filter(needsService)
      .sort((a, b) => a.playerId.localeCompare(b.playerId))
      .map((s) => {
        const p = byId[s.playerId],
          age = ageIn(p, yearIndex);
        return { playerId: s.playerId, teamId: s.currentTeamId, age, must: age >= Sv.mustAge, sangmu: sangmuChance(s, p, yearIndex) };
      });
  }

  /** Discharges, then enlistments before season `yearIndex`. `orders`: playerId → 'auto'|'sangmu'|'army'|'defer'. */
  function serviceStep(career, byId, seed, yearIndex, orders) {
    const Sv = T.service,
      R = T.retirement,
      year = D.bio.ENTRY_YEAR + yearIndex - 1, // the offseason after last season
      events = [];
    const states = Object.values(career.players).sort((a, b) => a.playerId.localeCompare(b.playerId));
    for (const s of states) {
      s.absentDays = 0;
      if (!s.service || s.service.until !== yearIndex) continue;
      const share = s.service.returnShare;
      s.service = null;
      s.served = true;
      s.route = s.routeBefore;
      s.performance = 0;
      if (s.scoutReady <= R.afterService.maxGrade && rng(seed + '-retire-service-' + s.playerId)() < R.afterService.chance) {
        s.status = 'retired';
        events.push({ id: `${year}-retire-${s.playerId}`, type: 'retire', year, fromTeamId: s.currentTeamId, toTeamId: null, playerIds: [s.playerId], reason: '전역 후 팀에 복귀하지 않고 은퇴했다.' });
        s.currentTeamId = null;
        continue;
      }
      s.absentDays = Math.round((1 - share) * T.health.playingDays);
    }
    for (const o of serviceOptions(career, byId, yearIndex)) {
      const s = career.players[o.playerId],
        p = byId[o.playerId],
        r = rng(`${seed}-enlist-${year}-${o.playerId}`);
      const social = socialService(s, seed),
        army = social ? 'social' : 'army';
      let order = orders[o.playerId] || 'auto',
        type = null,
        note = null;
      if (order === 'defer' && o.must) order = 'auto';
      if (order === 'sangmu') {
        if (!social && r() < o.sangmu) type = 'sangmu';
        else if (o.must) type = army;
        else note = social ? '사회복무요원 판정이라 상무에 지원할 수 없었다.' : '상무에 지원했지만 합격하지 못했다.';
      } else if (order === 'army') type = army;
      else if (order === 'auto') {
        const held = !o.must && s.scoutReady >= Sv.holdForGames && gamesSoon(yearIndex).some((e) => ageIn(p, e.year - D.bio.ENTRY_YEAR) <= e.ageLimit);
        const factor = Sv.enlistByAge.find(([maxAge]) => o.age <= maxAge)?.[1] ?? Sv.enlistByAge.at(-1)[1];
        const want = o.must || (!held && r() < clamp((Sv.enlistByRoute[s.route] ?? Sv.enlistByRoute.futures) * factor, 0, 0.95));
        if (want) {
          if (social) type = 'social';
          else if (s.scoutReady >= Sv.sangmu.clubMinGrade && r() < o.sangmu) type = 'sangmu';
          else if (o.must || o.age >= 26 || s.scoutReady < Sv.sangmu.clubMinGrade) type = 'army';
        }
      }
      if (note)
        events.push({ id: `${year}-sangmu-miss-${o.playerId}`, type: 'note', year, fromTeamId: s.currentTeamId, toTeamId: null, playerIds: [o.playerId], reason: note });
      if (!type) continue;
      const term = Sv.terms[type];
      s.service = { type, from: yearIndex, until: yearIndex + term.seasons, returnShare: term.returnShare };
      s.routeBefore = s.route;
      events.push({
        id: `${year}-enlist-${o.playerId}`,
        type: 'enlist',
        service: type,
        year,
        fromTeamId: s.currentTeamId,
        toTeamId: null,
        playerIds: [o.playerId],
        reason: `${M.SERVICE_LABELS[type]} 입대${o.must ? ' (입대 기한)' : ''}.`,
      });
    }
    return events;
  }

  /** National-team events in season `yearIndex`: selection from public grades, a result, exemptions. */
  function internationalStep(career, byId, seed, yearIndex) {
    const year = D.bio.ENTRY_YEAR + yearIndex,
      out = [];
    for (const e of T.international.filter((x) => x.year === year)) {
      const pool = Object.values(career.players).filter((s) => s.status === 'active' && (!s.service || s.service.type === 'sangmu'));
      const score = (s) => s.scoutReady + (s.route === 'regular' ? 3 : 0) + (s.scoutFV || 0) / 100;
      const byScore = (a, b) => score(b) - score(a) || a.playerId.localeCompare(b.playerId);
      const young = pool.filter((s) => (!e.ageLimit || ageIn(byId[s.playerId], yearIndex) <= e.ageLimit) && s.scoutReady >= e.minGrade).sort(byScore).slice(0, e.max);
      const wild = e.wildcard
        ? pool.filter((s) => !young.includes(s) && ageIn(byId[s.playerId], yearIndex) <= e.wildcard.maxAge && s.scoutReady >= e.wildcard.minGrade).sort(byScore).slice(0, e.wildcard.count)
        : [];
      const team = [...young, ...wild];
      const roll = rng(seed + '-intl-' + year)(),
        result = e.results.find(([limit]) => roll < limit)?.[1] ?? null;
      const exempt = e.exempt.includes(result) ? team.filter((s) => !s.served && !s.exempt) : [];
      for (const s of exempt) {
        s.exempt = e.name;
        if (s.service) s.service.returnShare = 1; // early discharge after the Games
      }
      out.push({ year, name: e.name, playerIds: team.map((s) => s.playerId), result, exemptIds: exempt.map((s) => s.playerId) });
    }
    return out;
  }

  // ---------------------------------------------------------------- offseason: retirement, release, trade

  function offseason(seed, yearIndex, career, records, byId) {
    const events = [];
    if (yearIndex < 1 || yearIndex >= SEASONS - 1) return events;
    const year = D.bio.ENTRY_YEAR + yearIndex,
      states = Object.values(career.players).sort((a, b) => a.playerId.localeCompare(b.playerId)),
      Rt = T.retirement;
    const retire = (s, reason) => {
      events.push({ id: `${year}-retire-${s.playerId}`, type: 'retire', year, fromTeamId: s.currentTeamId, toTeamId: null, playerIds: [s.playerId], reason });
      s.status = 'retired';
      s.currentTeamId = null;
    };
    // Released a year ago and still unsigned.
    for (const s of states) if (s.status === 'released') retire(s, '새 팀을 찾지 못하고 은퇴했다.');
    // Choosing to stop.
    for (const s of states) {
      if (!canPlay(s)) continue;
      const r = rng(seed + '-retire-' + year + '-' + s.playerId);
      const reason =
        s.noGameStreak >= Rt.stalled.seasons && s.age >= Rt.stalled.minAge && s.scoutReady < Rt.stalled.maxGrade && r() < Rt.stalled.chance
          ? '1군 기회가 오지 않아 스스로 유니폼을 벗었다.'
          : s.rehabStreak >= 2 && r() < Rt.rehab
            ? '거듭된 재활 끝에 은퇴를 결정했다.'
            : s.age >= Rt.veteran.minAge && s.scoutReady < Rt.veteran.maxGrade && r() < Rt.veteran.chance
              ? '기량이 떨어지면서 은퇴를 택했다.'
              : null;
      if (reason) retire(s, reason);
    }
    const counts = Object.fromEntries(TEAMS.map((t) => [t.id, states.filter((s) => s.status === 'active' && s.currentTeamId === t.id).length]));
    const touched = new Set(),
      Rl = T.offseason.release,
      Tr = T.offseason.trade,
      Cl = Rt.claim;
    for (const s of states) {
      if (!canPlay(s) || counts[s.currentTeamId] <= Rl.minClubSize) continue;
      const p = byId[s.playerId],
        rec = records.find((x) => x.playerId === s.playerId),
        r = rng(seed + '-release-' + year + '-' + p.id);
      const old = career.years.at(-1)?.records.find((x) => x.playerId === s.playerId);
      // Stalled: old enough, below the grade bar and two straight seasons without a first-team game.
      const stalled =
        yearIndex >= Rl.fromYear && s.age >= Rl.minAge && s.scoutReady < Rl.maxGrade && rec.stats.games === 0 && old?.stats.games === 0 && old.route !== 'service';
      const chance = stalled
        ? clamp(Rl.base + (Rl.maxGrade - s.scoutReady) * Rl.perGrade + Math.max(0, s.age - Rl.minAge) * Rl.perAge, 0, Rl.max)
        : 0;
      if (r() < chance) {
        const from = s.currentTeamId;
        events.push({
          id: year + '-release-' + p.id,
          type: 'release',
          year,
          fromTeamId: from,
          toTeamId: null,
          playerIds: [p.id],
          reason: '2년 연속 1군 기록이 없고 공개 기량이 40에 못 미쳐 방출됐다.',
        });
        counts[from]--;
        touched.add(p.id);
        // Another club may take a chance on him.
        if (s.age <= Cl.maxAge && r() < clamp((s.scoutReady - Cl.minGrade) * Cl.perGrade, 0, Cl.max)) {
          const to = TEAMS.filter((t) => t.id !== from).sort((a, b) => counts[a.id] - counts[b.id] || a.id.localeCompare(b.id))[0].id;
          events.push({ id: year + '-claim-' + p.id, type: 'claim', year, fromTeamId: from, toTeamId: to, playerIds: [p.id], reason: '방출 뒤 입단 테스트를 거쳐 새 팀과 계약했다.' });
          counts[to]++;
          s.currentTeamId = to;
        } else {
          s.status = 'released';
          s.currentTeamId = null;
        }
      }
    }
    const rr = rng(seed + '-trade-' + year);
    if (rr() < Tr.chance) {
      const active = states.filter(
          (s) =>
            canPlay(s) &&
            !touched.has(s.playerId) &&
            !records.some((x) => x.playerId === s.playerId && x.route === 'regular' && x.contribution >= Tr.protectContribution),
        ),
        pairs = [];
      const plans = S.plans(seed, TEAMS);
      const V = Tr.value;
      const publicValue = (s) =>
        s.scoutReady * V.perReady +
        (s.scoutFV ?? byId[s.playerId].scoutCeiling) * V.perFV -
        Math.max(0, s.age - V.agePivot) * V.perAge +
        (records.find((x) => x.playerId === s.playerId)?.contribution || 0) * V.perContribution;
      for (let i = 0; i < active.length; i++)
        for (let j = i + 1; j < active.length; j++) {
          const a = active[i],
            b = active[j],
            pa = byId[a.playerId],
            pb = byId[b.playerId];
          if (a.currentTeamId === b.currentTeamId || pa.role === pb.role) continue;
          const ta = { ...byTeam[a.currentTeamId], ...plans[a.currentTeamId] },
            tb = { ...byTeam[b.currentTeamId], ...plans[b.currentTeamId] },
            gainA = fit(pb, ta) - fit(pa, ta),
            gainB = fit(pa, tb) - fit(pb, tb);
          if (gainA < 0 || gainB < 0 || gainA + gainB < Tr.minCombinedGain || Math.abs(publicValue(a) - publicValue(b)) > Tr.maxValueGap)
            continue;
          pairs.push({
            a,
            b,
            score: gainA + gainB - Math.abs(publicValue(a) - publicValue(b)) * Tr.gapWeight + rr() * Tr.noise,
          });
        }
      pairs.sort((a, b) => b.score - a.score || a.a.playerId.localeCompare(b.a.playerId));
      if (pairs[0]) {
        const { a, b } = pairs[0],
          from = a.currentTeamId,
          to = b.currentTeamId;
        events.push({
          id: year + '-trade-' + a.playerId + '-' + b.playerId,
          type: 'trade',
          year,
          fromTeamId: from,
          toTeamId: to,
          playerIds: [a.playerId, b.playerId],
          reason: '서로 필요한 포지션을 보완하고 공개 평가 가치가 비슷한 자원을 교환했습니다.',
        });
        a.currentTeamId = to;
        b.currentTeamId = from;
      }
    }
    return events;
  }

  const OUT_OF_BASEBALL = {
    released: ['방출 · 무소속', '무소속이라 이 해의 기록이 없습니다.'],
    retired: ['은퇴', '은퇴해 기록이 없습니다.'],
  };

  /**
   * Plays season `yearIndex` for every signed player: service changes, national team, each player's
   * season, standings and awards, then the offseason. `orders` are the user's service choices.
   */
  function advance(career, picks, byId, seed, orders = {}) {
    const yearIndex = career.years.length;
    if (yearIndex >= SEASONS) throw Error(SEASONS + '시즌이 모두 끝났습니다.');
    const year = D.bio.ENTRY_YEAR + yearIndex,
      plans = S.plans(seed, TEAMS),
      rankings = {};
    if (yearIndex) {
      const moves = serviceStep(career, byId, seed, yearIndex, orders);
      career.years[yearIndex - 1].events.push(...moves);
      career.events.push(...moves);
    }
    const international = internationalStep(career, byId, seed, yearIndex);
    for (const t of TEAMS)
      for (const role of Object.keys(D.ROLES)) {
        rankings[t.id + '-' + role] = Object.values(career.players)
          .filter((s) => canPlay(s) && s.currentTeamId === t.id && byId[s.playerId].role === role)
          .sort(
            (a, b) =>
              b.ability + (b.route === 'regular' ? 5 : 0) - (a.ability + (a.route === 'regular' ? 5 : 0)) ||
              a.playerId.localeCompare(b.playerId),
          )
          .map((s) => s.playerId);
      }
    const records = picks.map((sel) => {
      const p = byId[sel.playerId],
        state = career.players[p.id];
      if (state.status !== 'active') {
        const [routeLabel, note] = OUT_OF_BASEBALL[state.status];
        return {
          playerId: p.id,
          label: sel.label,
          year,
          teamId: null,
          age: ageIn(p, yearIndex),
          route: state.status,
          routeLabel,
          stats: M.emptyStats(p),
          futures: M.emptyStats(p),
          growth: 0,
          growthLabel: '프로 기록 없음',
          developmentNote: '이전 기록만 남아 있습니다.',
          note,
          limited: false,
          contribution: 0,
          war: 0,
          planScore: null,
          target: '경력 보존',
          scoutReady: state.scoutReady,
          scoutFV: state.scoutFV,
        };
      }
      const t = { ...byTeam[state.currentTeamId], ...plans[state.currentTeamId] };
      let rec;
      if (state.service) rec = M.serviceSeason(p, sel, { seed }, t, state, yearIndex, state.service.type);
      else {
        const rank = rankings[t.id + '-' + p.role].indexOf(p.id),
          capacity = T.roles.cohortCapacity[p.role];
        rec = M.simulatePlayer(p, sel, { seed }, t, fit(p, t), yearIndex ? state : null, yearIndex, {
          // Development-contract players cannot be regulars in their first season.
          blockedRegular: rank >= capacity || (sel.dev && yearIndex === 0),
          closer: p.role === 'RP' && rank === 0 && state.ability >= T.roles.closer.minAbility && yearIndex >= T.roles.closer.fromYear,
          absentDays: state.absentDays || 0,
          growthBoost: state.currentTeamId === sel.teamId && yearIndex < T.contracts.growthBoost.seasons ? career.boosts?.[sel.teamId] || 0 : 0,
        });
      }
      Object.assign(state, rec.endState);
      if (rec.route !== 'service') {
        state.debuted = state.debuted || rec.stats.games > 0;
        state.noGameStreak = rec.stats.games > 0 ? 0 : (state.noGameStreak || 0) + 1;
        state.rehabStreak = rec.route === 'rehab' ? (state.rehabStreak || 0) + 1 : 0;
        state.injuryDays = (state.injuryDays || 0) + rec.daysLost;
      }
      return rec;
    });
    const league = standings(seed, year, records),
      honors = awards(year, records, league);
    for (const e of international)
      for (const id of e.playerIds)
        honors.push({ id: `${year}-national-${id}`, title: `${e.name} ${e.result ?? '국가대표'}`, scope: 'national', year, playerId: id, teamId: career.players[id].currentTeamId });
    const events = offseason(seed, yearIndex, career, records, byId);
    const row = { year, records, league, awards: honors, events, international };
    career.years.push(row);
    career.events.push(...events);
    return row;
  }
  function history(career, id) {
    return career.years.map((y) => y.records.find((s) => s.playerId === id)).filter(Boolean);
  }
  function review(career, picks, byId, lost = {}) {
    return TEAMS.map((t) => {
      const own = picks.filter((s) => s.teamId === t.id),
        size = own.length + (lost[t.id] || 0),
        ids = new Set(own.map((s) => s.playerId)),
        records = career.years.flatMap((y) => y.records.filter((r) => ids.has(r.playerId)));
      const total = records.reduce((n, r) => n + (r.war || 0), 0),
        atHome = records.filter((r) => r.teamId === t.id).reduce((n, r) => n + (r.war || 0), 0);
      const debut = own.filter((s) => history(career, s.playerId).some((r) => r.stats.games > 0)).length;
      const established = own.filter((s) =>
        history(career, s.playerId).some((r) => r.route === 'regular'),
      ).length;
      const development = mean(
        own.map((s) => {
          const h = history(career, s.playerId);
          return (h.at(-1)?.scoutReady ?? byId[s.playerId].ready) - byId[s.playerId].ready;
        }),
      );
      const club = { ...t, ...S.plans(career.seed, TEAMS)[t.id] };
      const needs = S.needCoverage(
        own.map((s) => byId[s.playerId]),
        club,
      );
      const Rv = T.review;
      const production = clamp((Math.max(0, total) / (Math.max(1, size) * Math.max(1, career.years.length) * Rv.warPerSeason)) * 100, 0, 100);
      const growth = clamp(development * Rv.growth.perPoint + Rv.growth.base, 0, 100);
      const score = round(needs * Rv.weights.need + production * Rv.weights.production + growth * Rv.weights.growth);
      return {
        teamId: t.id,
        count: own.length,
        refused: lost[t.id] || 0,
        total: round(total, 1),
        atHome: round(atHome, 1),
        debut,
        established,
        development: round(development, 1),
        score,
        grade: letter(score, Rv.gradeCuts),
        pending: own.filter((s) => {
          const st = career.players[s.playerId];
          return st.status === 'active' && st.age <= Rv.pendingMaxAge && st.scoutReady < st.scoutFV;
        }).length,
        released: own.filter((s) => career.players[s.playerId].status === 'released').length,
        retired: own.filter((s) => career.players[s.playerId].status === 'retired').length,
        national: new Set(career.years.flatMap((y) => y.awards).filter((a) => ids.has(a.playerId) && a.scope === 'national').map((a) => a.playerId)).size,
        awards: career.years
          .flatMap((y) => y.awards)
          .filter((a) => ids.has(a.playerId) && a.scope === 'draft-class').length,
      };
    }).sort((a, b) => b.score - a.score || b.total - a.total || a.teamId.localeCompare(b.teamId));
  }
  root.DraftCareer = { SEASONS, SERVICE_LABELS: M.SERVICE_LABELS, create, advance, history, totalStats, review, standings, serviceOptions, sangmuChance };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DraftCareer;
})(typeof window !== 'undefined' ? window : globalThis);
