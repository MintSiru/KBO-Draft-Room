/* Game engine: draft order, legal picks, CPU picks, phase flow, seasons and save restore.
   A game is plain JSON. Everything except the user's own choices is derived from the seed. */
(function (root) {
  'use strict';
  const D = root.DraftData || (typeof require !== 'undefined' ? require('./prospects.js') : null);
  const TEAMS = root.DraftClubs || (typeof require !== 'undefined' ? require('./clubs.js') : null);
  const M = root.DraftSeason || (typeof require !== 'undefined' ? require('./season.js') : null);
  const Career = root.DraftCareer || (typeof require !== 'undefined' ? require('./career.js') : null);
  const R = root.DraftRules || (typeof require !== 'undefined' ? require('./draft-ai.js') : null);
  const Press = root.DraftPress || (typeof require !== 'undefined' ? require('./press.js') : null);
  const { ROLES, REGIONS, rng, clamp } = D;
  const K = D.ko,
    Bio = D.bio;
  const Voices = root.DraftVoices || (typeof require !== 'undefined' ? require('./voices.js') : null);
  const S = root.DraftScouting || (typeof require !== 'undefined' ? require('./scouting.js') : null);
  // Save format version. V0.6 changed the grade scale and career model, so V0.5 saves do not load.
  const RELEASE = '0.6.1',
    VERSION = 6,
    ROUNDS = 7,
    POOL_SIZE = 200;
  const CONFIG = Object.freeze({
    nationalRounds: ROUNDS,
    seasonCount: Career.SEASONS,
    collegeQuota: 1,
    earlyCountsForQuota: false,
  });
  const teamById = Object.fromEntries(TEAMS.map((t) => [t.id, t]));
  // Pools are regenerated from the seed on demand; keep the few most recent.
  const cache = new Map();
  function poolFor(g) {
    const seed = String(typeof g === 'string' ? g : g.seed);
    if (!cache.has(seed)) {
      cache.set(seed, D.generatePool(seed));
      if (cache.size > 3) cache.delete(cache.keys().next().value);
    }
    return cache.get(seed);
  }
  function getPlayer(g, id) {
    return poolFor(g).byId[id];
  }
  function innings(outs) {
    return `${Math.floor(outs / 3)}.${outs % 3}`;
  }
  function teamFor(g, id = g.teamId) {
    return { ...teamById[id], ...g.clubPlans[id] };
  }
  function fit(p, t) {
    return S.fit(p, t);
  }
  function fitLabel(p, t) {
    return fit(p, t) >= 80 ? '핵심 보강' : fit(p, t) >= 60 ? '뎁스 보강' : '여유 자원';
  }
  function outlook(p) {
    return p.ready >= 45 ? '1군 경쟁 후보' : p.ready >= 35 ? '적응 후 도전' : '퓨처스 육성 우선';
  }
  function upsideLabel(p) {
    return p.scoutCeiling >= 60
      ? '상위 주전 전망'
      : p.scoutCeiling >= 50
        ? '평균 주전 전망'
        : p.scoutCeiling >= 40
          ? '역할 확보 전망'
          : '추가 육성 필요';
  }
  function makeSchedule(local) {
    const a = [];
    if (local) for (const t of TEAMS) a.push({ teamId: t.id, round: 0, label: '지역 1차' });
    for (let round = 1; round <= ROUNDS; round++)
      for (const t of TEAMS) a.push({ teamId: t.id, round, label: round + 'R' });
    return a;
  }
  /** Public (scouting-only) view of the pool, used by the CPU clubs, the media and the scout. */
  function publicPool(g) {
    const pool = poolFor(g);
    pool.publicPlayers ??= pool.players.map(R.project);
    return pool.publicPlayers;
  }
  function createGame(teamId, local = false, seed = 'default', difficulty = 'normal') {
    if (!Object.hasOwn(teamById, teamId) || !Object.hasOwn(R.DIFFICULTIES, difficulty))
      throw Error('구단 또는 난이도를 확인해야 합니다.');
    const g = {
      version: VERSION,
      teamId,
      local: !!local,
      seed: String(seed),
      difficulty,
      draftDate: Bio.DRAFT_DATE,
      phase: 'preview',
      schedule: makeSchedule(local),
      cursor: 0,
      picks: [],
      news: [],
      gmChoice: null,
      season: null,
      owner: null,
      career: null,
    };
    g.clubPlans = S.plans(g.seed, TEAMS);
    g.forecasts = Press.forecast(
      publicPool(g),
      TEAMS.map((t) => teamFor(g, t.id)),
      g.local,
      g.seed,
    );
    g.scoutReport = S.recommend(publicPool(g), teamFor(g), g.local);
    return g;
  }
  function openScouting(g) {
    if (g.phase !== 'preview' || g.cursor !== 0) throw Error('언론 예상 다음에 추천을 확인합니다.');
    g.phase = 'scouting';
    return g.scoutReport;
  }
  function beginDraft(g) {
    if (g.phase !== 'scouting' || g.cursor !== 0) throw Error('이미 시작한 드래프트입니다.');
    g.phase = 'draft';
    return g;
  }
  function quotaStatus(g, teamId = g.teamId) {
    const byId = poolFor(g).byId;
    const count = g.picks.filter((s) => s.teamId === teamId && byId[s.playerId]?.quotaEligible).length;
    const remaining = g.schedule.slice(g.cursor).filter((s) => s.teamId === teamId && s.round > 0).length;
    return {
      count,
      required: CONFIG.collegeQuota,
      missing: Math.max(0, CONFIG.collegeQuota - count),
      remaining,
    };
  }
  function available(g, slot = g.schedule[g.cursor]) {
    if (!slot) return [];
    const used = new Set(g.picks.map((s) => s.playerId));
    let list = poolFor(g).players.filter((p) => !used.has(p.id));
    if (slot.round === 0) return list.filter((p) => Bio.eligible(p, teamFor(g, slot.teamId)));
    const q = quotaStatus(g, slot.teamId),
      demand = TEAMS.reduce((n, t) => n + quotaStatus(g, t.id).missing, 0),
      supply = list.filter((p) => p.quotaEligible).length;
    if (q.missing && q.remaining <= q.missing) list = list.filter((p) => p.quotaEligible);
    else if (!q.missing && supply <= demand) list = list.filter((p) => !p.quotaEligible);
    return list;
  }
  function addPick(g, id) {
    if (g.phase !== 'draft') throw Error('드래프트 진행 중에만 지명할 수 있습니다.');
    const slot = g.schedule[g.cursor];
    if (!slot || !available(g, slot).some((p) => p.id === id))
      throw Error('현재 순서에서 지명할 수 없는 선수입니다.');
    const p = getPlayer(g, id);
    const s = { ...slot, playerId: id, overall: g.cursor + 1, fit: fit(p, teamFor(g, slot.teamId)) };
    if (s.round <= 1)
      g.news.push(
        Press.news(
          publicPool(g),
          TEAMS.map((t) => teamFor(g, t.id)),
          s,
          g.picks,
          g.forecasts,
          g.seed,
        ),
      );
    g.picks.push(s);
    g.cursor++;
    if (g.cursor === g.schedule.length) g.phase = 'interviews';
    return s;
  }
  function aiChoice(g) {
    const slot = g.schedule[g.cursor];
    if (!slot || g.phase !== 'draft') return null;
    const t = teamFor(g, slot.teamId);
    const prior = g.picks.filter((s) => s.teamId === t.id).map((s) => R.project(getPlayer(g, s.playerId)));
    const ranked = R.aiScores(
      available(g).map(R.project),
      t,
      prior,
      g.difficulty,
      g.seed + '-ai-' + g.cursor,
    );
    return ranked.length ? getPlayer(g, ranked[0].id) : null;
  }
  function advanceToUser(g) {
    const out = [];
    while (g.phase === 'draft' && g.cursor < g.schedule.length && g.schedule[g.cursor].teamId !== g.teamId) {
      const p = aiChoice(g);
      if (!p) throw Error('후보 부족');
      out.push(addPick(g, p.id));
    }
    return out;
  }
  const myPicks = (g) => g.picks.filter((s) => s.teamId === g.teamId);
  function simulatePlayer(p, s, g) {
    return M.simulatePlayer(
      p,
      s,
      g,
      teamFor(g, s.teamId || g.teamId),
      fit(p, teamFor(g, s.teamId || g.teamId)),
    );
  }
  function gmOptions(g) {
    return Press.gmOptions(
      myPicks(g).map((s) => R.project(getPlayer(g, s.playerId))),
      teamFor(g),
    );
  }
  function chooseGM(g, choice) {
    if (
      g.phase !== 'interviews' ||
      g.cursor !== g.schedule.length ||
      g.gmChoice ||
      g.season ||
      !Press.GM_CHOICES.some((c) => c.id === choice)
    )
      throw Error('인터뷰 답변은 드래프트 종료 후 한 번만 선택할 수 있습니다.');
    g.gmChoice = choice;
    return gmOptions(g).find((c) => c.id === choice);
  }
  function fanState(g) {
    const timeline = [{ label: '시작 전', delta: 0, score: 50 }];
    let score = 50;
    function entry(label, delta) {
      score = clamp(score + delta, 0, 100);
      timeline.push({ label, delta, score });
    }
    for (const n of g.news.filter((n) => n.teamId === g.teamId)) entry(n.reason, n.delta);
    if (g.gmChoice) {
      const c = gmOptions(g).find((c) => c.id === g.gmChoice);
      entry('단장 인터뷰 · ' + c.title, c.delta);
    }
    if (g.season) {
      const a = Press.accountability(
        g.gmChoice,
        myPicks(g).map((s) => R.project(getPlayer(g, s.playerId))),
        g.season,
        teamFor(g),
      );
      entry('시즌 후 · ' + a.status, a.bonus);
    }
    return {
      score,
      label: score >= 65 ? '기대 우세' : score >= 45 ? '관망' : score >= 30 ? '우려 우세' : '신뢰 회복 필요',
      timeline,
    };
  }
  function evaluate(g, season) {
    const players = myPicks(g).map((s) => getPlayer(g, s.playerId)),
      base = M.evaluate(g, season, players, teamFor(g));
    const pledge = Press.accountability(g.gmChoice, players.map(R.project), season, teamFor(g));
    const score = clamp(base.score + pledge.bonus, 0, 100);
    return {
      ...base,
      baseScore: base.score,
      score,
      grade: score >= 89 ? 'A' : score >= 77 ? 'B' : score >= 63 ? 'C' : 'D',
      pledge,
    };
  }
  function runSeason(g) {
    if (g.cursor !== g.schedule.length || !g.gmChoice)
      throw Error('드래프트와 단장 인터뷰를 먼저 완료해야 합니다.');
    const { byId } = poolFor(g);
    if (!g.career) {
      g.career = Career.create(g.picks, byId, g.seed);
      Career.advance(g.career, g.picks, byId, g.seed);
      g.season = g.career.years[0].records.filter((s) => s.teamId === g.teamId);
      g.owner = evaluate(g, g.season);
    }
    g.phase = 'season';
    return g.season;
  }
  function nextSeason(g) {
    if (!g.career || !['season', 'owner'].includes(g.phase)) throw Error('첫 시즌을 먼저 진행해야 합니다.');
    const result = Career.advance(g.career, g.picks, poolFor(g).byId, g.seed);
    g.phase = 'season';
    return result;
  }
  function careerReview(g) {
    return g.career ? Career.review(g.career, g.picks, poolFor(g).byId) : [];
  }
  const PHASES = ['preview', 'scouting', 'draft', 'interviews', 'season', 'owner'];

  /**
   * Rebuilds a saved game from its inputs (club, seed, settings, picks, GM answer, seasons played).
   * Every derived field in the save (news, records, evaluations...) is ignored and recomputed,
   * so editing a save cannot change results and text fixes never invalidate old saves.
   * Returns the rebuilt game, or null if the inputs are invalid or do not replay.
   */
  function restore(saved) {
    try {
      const g0 = saved;
      if (
        !g0 ||
        g0.version !== VERSION ||
        !Object.hasOwn(R.DIFFICULTIES, g0.difficulty) ||
        !Object.hasOwn(teamById, g0.teamId) ||
        g0.draftDate !== Bio.DRAFT_DATE ||
        typeof g0.seed !== 'string' ||
        !g0.seed.length ||
        g0.seed.length > 200 ||
        typeof g0.local !== 'boolean' ||
        !PHASES.includes(g0.phase) ||
        !Array.isArray(g0.picks) ||
        g0.cursor !== g0.picks.length
      )
        return null;
      const g = createGame(g0.teamId, g0.local, g0.seed, g0.difficulty);
      if (g0.picks.length > g.schedule.length) return null;
      if (g0.phase === 'preview') return g0.picks.length ? null : g;
      openScouting(g);
      if (g0.phase === 'scouting') return g0.picks.length ? null : g;
      beginDraft(g);
      for (const s of g0.picks) {
        const slot = g.schedule[g.cursor];
        if (!s || s.teamId !== slot.teamId) return null;
        // CPU picks are deterministic, so a save cannot rewrite what another club did.
        if (s.teamId !== g.teamId && aiChoice(g)?.id !== s.playerId) return null;
        addPick(g, s.playerId);
      }
      if ((g0.phase === 'draft') !== (g.phase === 'draft')) return null;
      if (g0.gmChoice != null) chooseGM(g, g0.gmChoice);
      const seasons = g0.career?.years?.length ?? 0;
      if (seasons > Career.SEASONS || (g0.career != null && !seasons)) return null;
      if (['season', 'owner'].includes(g0.phase) && !seasons) return null;
      if (seasons) {
        runSeason(g);
        while (g.career.years.length < seasons) nextSeason(g);
      }
      if (g.phase !== 'draft') g.phase = g0.phase; // e.g. revisiting interviews after season 1
      return g;
    } catch (_) {
      return null;
    }
  }
  const validate = (g) => restore(g) !== null;
  const api = {
    scouting: S,
    grades: D.grades,
    teamFor,
    openScouting,
    CONFIG,
    Career,
    quotaStatus,
    nextSeason,
    careerReview,
    ko: K,
    bio: Bio,
    catalog: D.catalog,
    eligible: Bio.eligible,
    DRAFT_DATE: Bio.DRAFT_DATE,
    ENTRY_YEAR: Bio.ENTRY_YEAR,
    RELEASE,
    VERSION,
    rules: R,
    press: Press,
    publicPool,
    beginDraft,
    gmOptions,
    chooseGM,
    fanState,
    ROUNDS,
    POOL_SIZE,
    TEAMS,
    REGIONS,
    ROLES,
    teamById,
    poolFor,
    getPlayer,
    innings,
    fit,
    fitLabel,
    outlook,
    upsideLabel,
    makeSchedule,
    createGame,
    available,
    addPick,
    aiChoice,
    advanceToUser,
    myPicks,
    simulatePlayer,
    runSeason,
    evaluate,
    validate,
    restore,
    rng,
    clamp,
  };
  Voices.install(api);
  root.DraftCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
