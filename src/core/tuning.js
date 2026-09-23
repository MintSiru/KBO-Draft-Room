/* Balance knobs for seasons, careers and evaluations, in one place.
   These are fictional tuning values, not an empirical KBO model.

   Changing any number here changes simulated results, which changes what old saves replay into.
   After a change: bump SIM_VERSION in engine.js, then re-record tests/golden.cjs with --write.

   Conventions: a `[base, span]` pair means base + floor(r() * span); `byYear` arrays are indexed by
   pro year (0 = rookie season) and the last entry applies to every later year. */
(function (root) {
  'use strict';
  const freeze = (o) => (Object.values(o).forEach((v) => v && typeof v === 'object' && freeze(v)), Object.freeze(o));

  const TUNING = {
    generation: {
      // Pitchers get an arm-strength roll (mean 0, sd 1). It lifts stuff (potential and current) and velocity;
      // command and breaking balls do not depend on it, so a hard thrower with poor command still grades low.
      // Top velocity = base + (true stuff - pivot) × perStuff + arm × perArm (+ adultBonus if not a high-schooler).
      // Share of players whose childhood favourite is a club from the region they grew up in.
      localFavorite: 0.45,
      velocity: { base: 146, pivot: 40, perStuff: 0.35, perArm: 3.2, armToStuff: 4, adultBonus: 1, noise: 1.5, min: 132, max: 161 },
    },

    // Development ("육성") contracts after the draft. They cannot hold a regular role in their first season.
    devContracts: { max: 5, cpuMin: 3, cpuMax: 5 },

    health: {
      longInjuryShare: 0.22, // share of injuries that are long
      longDays: [65, 66],
      shortDays: [7, 28],
      rehabDays: 105, // this many lost days means the season is spent in rehab
      playingDays: 165, // games played scale by (1 - daysLost / playingDays)
      growthDays: 210, // growth scales by (1 - daysLost / growthDays)
      heavyInjuryDays: 100,
      heavyInjuryGrowthPenalty: 0.6,
      planPenaltyDays: 60,
      planPenalty: 4,
    },

    roles: {
      impactNoise: 3, // season-to-season noise on the ability used for role decisions
      // Extra call-up chance for early picks: byRound (round 0/1, 2, 3; later rounds get 0) × byYear.
      draftInvestment: { byRound: [0.18, 0.18, 0.1, 0.04], byYear: [1, 0.2, 0] },
      // Last year's regular keeps the job with base + (ability - pivot) × perAbility + form × perForm.
      retention: { base: 0.87, pivot: 48, perAbility: 0.009, perForm: 0.018, min: 0.66, max: 0.97 },
      // A regular who loses the job drops to the futures only when both ability and form are this low.
      demotion: { maxAbility: 38, maxForm: -0.8, poorForm: -0.5 },
      // Call-up: base + sigmoid((ability - pivot) / scale) × weight + bonuses.
      callUp: { base: 0.025, pivot: 40, scale: 3.6, weight: 0.83, afterBackup: 0.08, needFit: 80, needBonus: 0.045, min: 0.015, max: 0.98 },
      // Once called up, the chance the role is a regular one.
      regular: { pivotByYear: [47, 45], scale: 3.6, weightByYear: [0.68, 0.86], afterBackup: 0.08, min: 0.01, max: 0.95 },
      // Otherwise backup rather than a short cameo: clamp((ability - pivot) / scale).
      backupOverCameo: { pivot: 30, scale: 25, min: 0.2, max: 0.83 },
      core: { minAbility: 55, fromYear: 1 }, // "핵심" regulars
      // Regular slots per club and position among this draft class; beyond it a regular becomes backup.
      cohortCapacity: { SP: 5, RP: 7, C: 2, IF: 4, OF: 3 },
      closer: { minAbility: 48, fromYear: 1 },
    },

    games: {
      regular: {
        SP: { baseByYear: [20, 24, 26], spanByYear: [5, 5, 6] },
        RP: { baseByYear: [44], spanByYear: [21] },
        hitter: { baseByYear: [88, 105, 120], spanByYear: [25, 25, 21] },
      },
      backup: { SP: [9, 11], RP: [22, 19], hitter: [40, 36] },
      cameo: { pitcher: [2, 7], hitter: [5, 15] },
      // Futures games alongside each role; the development route gets a [base, span] range.
      futures: { regular: { pitcher: 2, hitter: 5 }, backup: { pitcher: 9, hitter: 35 }, development: { pitcher: [20, 8], hitter: [80, 25] } },
      hitterSeasonCap: 144, // first-team + futures games for a hitter
    },

    hitting: {
      paPerGame: { core: 4.25, regular: 3.95, futures: 3.6, cameo: 1.8, bench: 2.55 },
      avg: { base: 0.2, pivot: 30, perContact: 0.0027, futuresBonus: 0.035, noise: 0.018, min: 0.16, max: 0.355 },
      hr: { base: 0.007, pivot: 32, perPower: 0.00145, futuresBonus: 0.004, min: 0.001, max: 0.085 },
      walk: { base: 0.04, pivot: 30, perEye: 0.002, min: 0.025, max: 0.16 },
      strikeout: { base: 0.3, pivot: 30, perContact: 0.003, min: 0.1, max: 0.36, minNonHitShare: 0.5 },
      hitShare: { min: 0.08, max: 0.38 }, // per-AB non-HR hit chance bounds
      triple: { pivot: 30, perSpeed: 0.0009, max: 0.035 },
      double: { base: 0.18, pivot: 40, perPower: 0.0025 },
      rbi: { perHit: 0.32, perHR: 1.65 },
      steal: { pivot: 25, gamesPerUnit: 205, base: 0.6, spread: 0.6 },
    },

    pitching: {
      era: { base: 7.75, perStuff: 0.025, perCommand: 0.029, perBreaking: 0.016, futuresBonus: 0.95, noise: 0.45, min: 1.9, max: 8.5 },
      startIP: { base: 3.45, perStamina: 0.047, regular: 0.05, other: -0.45, noise: 1.1, min: 2.5, max: 7.6 },
      reliefIP: { base: 0.85, noise: 0.7, min: 0.33, max: 2 },
      spotStartShare: 0.65, // share of a non-regular SP's games that are starts
      k9: { base: 1.0, pivot: 20, perStuff: 0.22, perBreaking: 0.02, min: 3.5, max: 13 },
      bb9: { base: 6.2, perCommand: 0.066, min: 1.1, max: 5.6 },
      qualityStart: { minOuts: 18, maxRuns: 3 },
      // Starter win: at least minOuts, then base + (pivotRuns - runs) × perRun + team strength, then bullpen holds.
      startWin: { minOuts: 15, base: 0.3, pivotRuns: 5, perRun: 0.075, rankPivot: 11, perRank: 0.01, defaultRank: 6, min: 0.08, max: 0.78, bullpenHold: 0.86 },
      relief: { win: 0.045, save: 0.57, hold: 0.29 }, // cumulative thresholds on one roll
    },

    growth: {
      rateByCurve: {
        early: { start: 0.43, perYear: 0.045, min: 0.2 },
        late: { firstYears: 0.14, later: 0.44, switchYear: 2 },
        normal: 0.32,
      },
      speedShare: 0.6, // speed closes its gap more slowly
      noise: 0.65,
      minGain: -2.5,
      maxGain: 8,
      agingFrom: { speed: 26, other: 29 },
      agingPerYear: { speed: 0.38, other: 0.28 },
    },

    // Descriptive only: each season's top velocity follows the change in true stuff
    // (same slope as generation.velocity.perStuff).
    velocity: { noise: 0.8, min: 128, max: 163 },

    scores: {
      // Last season's form, fed into next year's retention.
      performance: { eraPivot: 4.5, eraScale: 1.3, opsPivot: 0.72, opsScale: 0.12, limit: 2 },
      // 0–100 first-team contribution index (not WAR).
      contribution: { perInning: 0.42, eraPivot: 4.7, perEra: 7, perPA: 0.095, opsPivot: 0.7, perOps: 45, defensePivot: 45, perDefense: 0.15 },
      // Plan score: base + progress × perProgress + bonuses; progress = growth / expected growth.
      plan: { base: 28, perProgress: 43, played: 8, regular: 8, min: 10, max: 100 },
      expectedGrowth: { min: 0.65, share: 0.2, projectShare: 0.13, projectGap: 20, projectYears: 2 },
      progress: { nearCeiling: 2, max: 1.3 },
      growthLabels: [[3, '뚜렷한 성장'], [1.4, '꾸준한 발전'], [0.3, '기술 발전'], [0, '완성도 유지']],
    },

    firstYear: {
      weights: { need: 0.4, plan: 0.25, future: 0.35 },
      future: { base: 50, fvPivot: 45, perFV: 3, perGrowth: 4 },
      gradeCuts: [89, 77, 63], // A, B, C; below is D
    },

    league: {
      gamesPerPair: 16, // 9 opponents × 16 = 144 games
      rating: { base: 50, rankPivot: 11, perRank: 2.2, noise: 12, rookieScale: 35, rookieMax: 9 },
      logisticScale: 23, // win chance = 1 / (1 + exp(ratingGap / scale))
    },

    awards: {
      hitter: { minPA: 60, perPA: 0.055, opsPivot: 0.65, perOps: 50, perHR: 0.7 },
      pitcher: { minOuts: 60, perOut: 0.12, eraPivot: 5.5, perEra: 6, perK: 0.05 },
    },

    offseason: {
      release: { minClubSize: 4, fromYear: 2, minAge: 23, maxGrade: 40, base: 0.07, perGrade: 0.014, perAge: 0.012, max: 0.24 },
      trade: {
        chance: 0.68,
        protectContribution: 50, // regulars at or above this are never traded
        minCombinedGain: 30,
        maxValueGap: 8,
        value: { perReady: 0.65, perFV: 0.25, agePivot: 22, perAge: 1.1, perContribution: 0.08 },
        gapWeight: 2,
        noise: 25,
      },
    },

    review: {
      weights: { need: 0.2, production: 0.5, growth: 0.3 },
      contributionPerSeason: 30, // per player-season, for 100 production points
      growth: { base: 35, perPoint: 3.5 },
      gradeCuts: [85, 70, 55],
      pendingMaxAge: 24,
    },
  };

  /** Value for pro year `yearIndex` from a byYear array (the last entry covers later years). */
  const byYear = (list, yearIndex) => list[Math.min(yearIndex, list.length - 1)];
  const letter = (score, cuts) => (score >= cuts[0] ? 'A' : score >= cuts[1] ? 'B' : score >= cuts[2] ? 'C' : 'D');

  const api = { TUNING: freeze(TUNING), byYear, letter };
  root.DraftTuning = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
