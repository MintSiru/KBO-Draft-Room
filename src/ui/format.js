/* Shared HTML helpers for the UI. Every view is a pure function (state -> HTML string).
   Views may only show public scouting data: never trueTools, potentialTools or endState. */
(function (root) {
  'use strict';
  const C = root.DraftCore;
  const UI = (root.DraftUI = root.DraftUI || {});

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const tag = (text, cls = '') => `<span class="tag ${cls}">${esc(text)}</span>`;
  const signed = (n) => (n > 0 ? '+' : '') + n;
  const num = (n, dp = 0) => (n == null ? '—' : dp ? n.toFixed(dp) : String(n));
  /** Batting average style: .312 */
  const rate = (n) => (n == null ? '—' : n.toFixed(3).replace(/^0/, ''));
  const teamName = (id) => C.teamById[id]?.short || '무소속';
  const teamDot = (id) => (C.teamById[id] ? `<i class="team-dot" style="background:${C.teamById[id].color}"></i>` : '');
  const player = (g, id) => C.getPlayer(g, id);
  const playerLink = (id, name) =>
    `<button class="link" data-action="career-player" data-id="${esc(id)}">${esc(name)}</button>`;
  const hand = (p) => `${p.throwHand}투${p.batHand}타`;
  /** Colour class for a 20–80 grade. */
  const gradeClass = (n) => 'g' + Math.max(30, Math.min(70, Math.floor(n / 10) * 10));
  const grade = (n) => `<span class="g ${gradeClass(n)}">${n}</span>`;

  function statLine(s) {
    if (!s || !s.games) return '출전 기록 없음';
    return s.kind === 'pitcher'
      ? `${s.games}경기 ${s.gs}선발 · ${C.innings(s.outs)}이닝 · ERA ${num(s.era, 2)} · ${s.wins}승 ${s.holds}홀드 ${s.saves}세이브 · ${s.k}K ${s.bb}BB`
      : `${s.games}경기 ${s.pa}타석 · 타율 ${rate(s.avg)} · OPS ${rate(s.ops)} · ${s.hr}홈런 ${s.rbi}타점 ${s.sb}도루`;
  }

  /** Current / future grade table for one player (the scouting card used everywhere). */
  function toolTable(p) {
    const rows = C.grades
      .keys(p.role)
      .map(
        (k) =>
          `<tr><th>${C.grades.LABELS[k]}</th><td><b class="g ${gradeClass(p.tools[k])}">${p.tools[k]}</b><span class="bar"><i style="width:${((p.tools[k] - 20) / 60) * 100}%"></i></span></td><td>${p.futureTools[k]}</td></tr>`,
      )
      .join('');
    return `<section class="tool-estimates">
      <h4>스카우팅 평가 (20–80)</h4>
      <div class="overall">
        <div><b>${p.ready}</b>현재</div><div><b>${p.scoutCeiling}</b>미래 가치</div>
        <div><b>${p.floorGrade}</b>플로어</div><div><b>${p.ceilingGrade}</b>실링</div>
      </div>
      <table class="tool-grade-table"><thead><tr><th>툴</th><th>현재</th><th>미래</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="note">${p.tools.eye != null ? `선구안 ${p.tools.eye} · ` : ''}${p.pickTags.join(' · ')} · 불확실성 ${p.uncertainty}</p>
    </section>`;
  }

  /** Compact public tool grades at one point in time. */
  function toolSnapshot(p, tools, title) {
    return `<section class="tool-snapshot"><h4>${esc(title)}</h4><div>${C.grades
      .keys(p.role)
      .map((k) => `<span>${C.grades.LABELS[k]}<b>${tools?.[k] ?? '—'}</b></span>`)
      .join('')}</div></section>`;
  }

  /** "+2" style change in top velocity against the previous season (or the draft-day reading). */
  function velocityChange(g, rec) {
    const hist = g.career ? C.Career.history(g.career, rec.playerId) : [];
    const i = hist.findIndex((r) => r.year === rec.year);
    const before = i > 0 ? hist[i - 1].velocity : C.getPlayer(g, rec.playerId).velocity;
    const d = rec.velocity - before;
    return d ? (d > 0 ? '+' : '') + d : '변화 없음';
  }

  Object.assign(UI, {
    velocityChange,
    esc, tag, signed, num, rate, teamName, teamDot, player, playerLink, hand, grade, gradeClass,
    statLine, toolTable, toolSnapshot,
  });
})(typeof window !== 'undefined' ? window : globalThis);
