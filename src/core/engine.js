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
  const { TUNING } = root.DraftTuning || (typeof require !== 'undefined' ? require('./tuning.js') : null);
  const Voices = root.DraftVoices || (typeof require !== 'undefined' ? require('./voices.js') : null);
  const S = root.DraftScouting || (typeof require !== 'undefined' ? require('./scouting.js') : null);
  // Save format version. V0.6 changed the grade scale and career model, so V0.5 saves do not load.
  const RELEASE = '0.7.0',
    VERSION = 6,
    ROUND_OPTIONS = [5, 8, 11], // national rounds the player can choose; 11 is the current KBO format
    ROUNDS = 11,
    POOL_SIZE = D.POOL_SIZE;
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
  function makeSchedule(local, rounds = ROUNDS) {
    const a = [];
    if (local) for (const t of TEAMS) a.push({ teamId: t.id, round: 0, label: '지역 1차' });
    for (let round = 1; round <= rounds; round++)
      for (const t of TEAMS) a.push({ teamId: t.id, round, label: round + 'R' });
    return a;
  }
  /** Public (scouting-only) view of the pool, used by the CPU clubs, the media and the scout. */
  function publicPool(g) {
    const pool = poolFor(g);
    pool.publicPlayers ??= pool.players.map(R.project);
    return pool.publicPlayers;
  }
  function createGame(teamId, local = false, seed = 'default', difficulty = 'normal', rounds = ROUNDS) {
    if (!Object.hasOwn(teamById, teamId) || !Object.hasOwn(R.DIFFICULTIES, difficulty) || !ROUND_OPTIONS.includes(rounds))
      throw Error('구단, 난이도, 라운드 수를 확인해야 합니다.');
    const g = {
      version: VERSION,
      teamId,
      local: !!local,
      seed: String(seed),
      difficulty,
      rounds,
      draftDate: Bio.DRAFT_DATE,
      phase: 'preview',
      schedule: makeSchedule(local, rounds),
      cursor: 0,
      picks: [],
      devSigns: [],
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
    if (g.cursor === g.schedule.length) g.phase = 'signing';
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
  // ---------------------------------------------------------------- development contracts

  /** Every player tied to a club this class: draft picks, then development contracts. */
  const signed = (g) => [...g.picks, ...(g.devSigns || [])];
  const mySigned = (g) => signed(g).filter((s) => s.teamId === g.teamId);
  /** Pool players nobody drafted or signed, best public rank first. */
  function undrafted(g) {
    const taken = new Set(signed(g).map((s) => s.playerId));
    return poolFor(g).players.filter((p) => !taken.has(p.id));
  }
  function devEntry(g, teamId, playerId) {
    const k = (g.devSigns || []).length;
    return { teamId, round: g.rounds + 1, label: '육성', dev: true, playerId, overall: g.schedule.length + k + 1, fit: fit(getPlayer(g, playerId), teamFor(g, teamId)) };
  }
  /**
   * The user signs up to `max` undrafted players; then each CPU club, in draft order, signs cpuMin–cpuMax more.
   * CPU clubs take turns one player at a time and only see public information.
   */
  function signDevelopment(g, ids = []) {
    const D_ = TUNING.devContracts;
    if (g.phase !== 'signing') throw Error('육성선수 계약은 드래프트가 끝난 뒤에 합니다.');
    if (!Array.isArray(ids) || ids.length > D_.max || new Set(ids).size !== ids.length) throw Error('육성선수는 최대 ' + D_.max + '명입니다.');
    const free = new Set(undrafted(g).map((p) => p.id));
    if (!ids.every((id) => free.has(id))) throw Error('계약할 수 없는 선수입니다.');
    g.devSigns = [];
    for (const id of ids) g.devSigns.push(devEntry(g, g.teamId, id));
    const order = g.schedule.filter((s) => s.round === 1 && s.teamId !== g.teamId).map((s) => s.teamId);
    const quota = Object.fromEntries(order.map((id) => [id, D_.cpuMin + Math.floor(rng(g.seed + '-dev-count-' + id)() * (D_.cpuMax - D_.cpuMin + 1))]));
    for (let turn = 0; turn < D_.cpuMax; turn++)
      for (const teamId of order) {
        if (turn >= quota[teamId]) continue;
        const t = teamFor(g, teamId),
          mine = signed(g).filter((s) => s.teamId === teamId).map((s) => R.project(getPlayer(g, s.playerId)));
        const ranked = R.aiScores(undrafted(g).map(R.project), t, mine, g.difficulty, `${g.seed}-dev-${teamId}-${turn}`);
        if (ranked[0]) g.devSigns.push(devEntry(g, teamId, ranked[0].id));
      }
    g.phase = 'interviews';
    return g.devSigns;
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
      g.career = Career.create(signed(g), byId, g.seed);
      Career.advance(g.career, signed(g), byId, g.seed);
      // First-year evaluation covers this club's draft picks (development contracts are judged over five years).
      const drafted = new Set(myPicks(g).map((s) => s.playerId));
      g.season = g.career.years[0].records.filter((s) => s.teamId === g.teamId && drafted.has(s.playerId));
      g.owner = evaluate(g, g.season);
    }
    g.phase = 'season';
    return g.season;
  }
  function nextSeason(g) {
    if (!g.career || !['season', 'owner'].includes(g.phase)) throw Error('첫 시즌을 먼저 진행해야 합니다.');
    const result = Career.advance(g.career, signed(g), poolFor(g).byId, g.seed);
    g.phase = 'season';
    return result;
  }
  function careerReview(g) {
    return g.career ? Career.review(g.career, signed(g), poolFor(g).byId) : [];
  }
  const PHASES = ['preview', 'scouting', 'draft', 'signing', 'interviews', 'season', 'owner'];

  /*
   * Saves
   * -----
   * A save holds only the inputs of a game: settings, seed, the user's own picks, the GM answer and how
   * many seasons were played. Everything else is recomputed by replaying, which is fast (<0.2 s for five
   * seasons) and means a save cannot be edited into a different result.
   *
   * Replaying is only faithful while the simulation behaves exactly as it did when the save was made.
   * SIM_VERSION names that behaviour: bump it whenever a change alters any simulated number or pick
   * (tests/golden.cjs fails until you do). A save from another SIM_VERSION is refused, never silently
   * replayed into a different history.
   */
  const SIM_VERSION = '0.7',
    SAVE_FORMAT = 'draft-room-save',
    SAVE_VERSION = 2;

  /** The compact save for a game. */
  function toSave(g) {
    return {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      sim: SIM_VERSION,
      teamId: g.teamId,
      local: g.local,
      seed: g.seed,
      difficulty: g.difficulty,
      rounds: g.rounds,
      phase: g.phase,
      picks: myPicks(g).map((s) => s.playerId),
      dev: (g.devSigns || []).filter((s) => s.teamId === g.teamId).map((s) => s.playerId),
      gmChoice: g.gmChoice,
      seasons: g.career?.years.length ?? 0,
    };
  }

  /**
   * Replays a game from compact-save inputs. Returns null if they are invalid or do not replay.
   * CPU clubs pick up to the user's next turn, as the app does; `stopAt` instead stops at that overall pick
   * (used for v0.6.0 saves, which may have been stored mid-way through CPU picks).
   */
  function replay(s, stopAt = null) {
    try {
      if (
        !s ||
        !Object.hasOwn(R.DIFFICULTIES, s.difficulty) ||
        !Object.hasOwn(teamById, s.teamId) ||
        !ROUND_OPTIONS.includes(s.rounds) ||
        typeof s.seed !== 'string' ||
        !s.seed.length ||
        s.seed.length > 200 ||
        typeof s.local !== 'boolean' ||
        !PHASES.includes(s.phase) ||
        !Array.isArray(s.picks) ||
        !s.picks.every((id) => typeof id === 'string') ||
        !Number.isInteger(s.seasons) ||
        s.seasons < 0 ||
        s.seasons > Career.SEASONS
      )
        return null;
      const g = createGame(s.teamId, s.local, s.seed, s.difficulty, s.rounds);
      const pristine = !s.picks.length && s.gmChoice == null && !s.seasons;
      if (s.phase === 'preview') return pristine ? g : null;
      openScouting(g);
      if (s.phase === 'scouting') return pristine ? g : null;
      beginDraft(g);
      const cpuPicks = () => {
        while (g.phase === 'draft' && g.schedule[g.cursor].teamId !== g.teamId && (stopAt == null || g.cursor < stopAt))
          addPick(g, aiChoice(g).id);
      };
      for (const id of s.picks) {
        cpuPicks();
        if (g.phase !== 'draft' || g.schedule[g.cursor].teamId !== g.teamId) return null; // more picks than turns
        addPick(g, id); // throws on an illegal pick
      }
      cpuPicks();
      if ((s.phase === 'draft') !== (g.phase === 'draft')) return null;
      if (s.phase === 'signing') return s.gmChoice == null && !s.seasons && !(s.dev || []).length ? g : null;
      if (g.phase === 'signing') signDevelopment(g, s.dev || []);
      if (s.gmChoice != null) chooseGM(g, s.gmChoice);
      if (['season', 'owner'].includes(s.phase) && !s.seasons) return null;
      if (s.seasons) {
        runSeason(g); // requires the GM answer
        while (g.career.years.length < s.seasons) nextSeason(g);
      }
      if (g.phase !== 'draft') g.phase = s.phase; // e.g. revisiting interviews after season 1
      return g;
    } catch (_) {
      return null;
    }
  }

  /**
   * Rebuilds a v0.6.0 save, which stored the whole game object. Derived fields are ignored; the inputs
   * are replayed and the stored pick list must match the replay exactly (so CPU picks cannot be edited).
   */
  function restore(g0) {
    if (!g0 || g0.version !== VERSION || g0.draftDate !== Bio.DRAFT_DATE || !Array.isArray(g0.picks)) return null;
    if (g0.cursor !== g0.picks.length || !g0.picks.every((p) => p && typeof p.playerId === 'string')) return null;
    const seasons = g0.career == null ? 0 : g0.career.years?.length;
    if (g0.career != null && !seasons) return null;
    const g = replay(
      {
        rounds: 7,
        ...g0,
        picks: g0.picks.filter((p) => p.teamId === g0.teamId).map((p) => p.playerId),
        dev: (g0.devSigns || []).filter((p) => p.teamId === g0.teamId).map((p) => p.playerId),
        seasons,
      },
      g0.picks.length,
    );
    if (!g) return null;
    const ids = (list) => list.map((p) => p.teamId + ':' + p.playerId).join();
    return ids(g.picks) === ids(g0.picks) ? g : null;
  }

  /**
   * Loads any supported save: a compact save, a v0.6.0 export ({format:'draft-room-v06', game}) or a bare
   * v0.6.0 game object. Returns { game } or { error: 'sim' | 'invalid', sim }.
   */
  function loadSave(data) {
    if (data?.format === SAVE_FORMAT) {
      if (data.version !== SAVE_VERSION) return { error: 'invalid' };
      if (data.sim !== SIM_VERSION) return { error: 'sim', sim: String(data.sim) };
      const game = replay(data);
      return game ? { game } : { error: 'invalid' };
    }
    // v0.6.0 saves predate SIM_VERSION; their simulation is the one named '0.6'.
    const legacy = data?.format === 'draft-room-v06' ? data.game : data;
    if (legacy?.version === VERSION && SIM_VERSION !== '0.6') return { error: 'sim', sim: '0.6' };
    const game = restore(legacy);
    return game ? { game } : { error: 'invalid' };
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
    ROUND_OPTIONS,
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
    signDevelopment,
    tuning: TUNING,
    undrafted,
    signed,
    mySigned,
    replay,
    toSave,
    loadSave,
    SIM_VERSION,
    SAVE_FORMAT,
    rng,
    clamp,
  };
  Voices.install(api);
  root.DraftCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
