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

  const obp = (s) => (s?.pa ? (s.hits + s.bb) / s.pa : null);
  const slg = (s) => (s?.ab ? (s.hits + s.doubles + 2 * s.triples + 3 * s.hr) / s.ab : null);
  const per9 = (n, outs) => (outs ? ((n * 27) / outs).toFixed(1) : '—');

  function statLine(s) {
    if (!s || !s.games) return '출전 기록 없음';
    return s.kind === 'pitcher'
      ? `${s.games}경기 ${s.gs}선발 · ${C.innings(s.outs)}이닝 · ERA ${num(s.era, 2)} · ${s.wins}승 ${s.holds}홀드 ${s.saves}세이브 · ${s.k}K ${s.bb}BB (9이닝당 ${per9(s.k, s.outs)}K ${per9(s.bb, s.outs)}BB)`
      : `${s.games}경기 ${s.pa}타석 · ${rate(s.avg)}/${rate(obp(s))}/${rate(slg(s))} (타율/출루율/장타율) · ${s.hr}홈런 ${s.rbi}타점 ${s.sb}도루`;
  }

  /** Where a signed player is now: '' if still with the club that signed him. */
  function statusLabel(state, originTeamId) {
    if (!state) return '';
    if (state.status === 'released') return '방출';
    if (state.status === 'retired') return '은퇴';
    const moved = state.currentTeamId !== originTeamId ? `→ ${teamName(state.currentTeamId)}` : '';
    return [moved, state.service ? '군 복무 중' : ''].filter(Boolean).join(' · ');
  }
  function serviceStatus(state) {
    if (state.exempt) return `면제 (${state.exempt} 병역 특례)`;
    if (state.service) return `복무 중 · ${C.Career.SERVICE_LABELS?.[state.service.type] ?? ''}`.trim();
    if (state.served) return '마침';
    return '미필';
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

  /** Minimal Markdown for the update log: headings, nested lists, bold, inline code and paragraphs. */
  function markdown(md) {
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    let html = '',
      depth = 0;
    const close = (to) => {
      while (depth > to) (html += '</ul>'), depth--;
    };
    for (const line of md.split('\n')) {
      const item = line.match(/^(\s*)- (.*)$/);
      if (item) {
        const level = Math.floor(item[1].length / 2) + 1;
        while (depth < level) (html += '<ul>'), depth++;
        close(level);
        html += `<li>${inline(item[2])}</li>`;
        continue;
      }
      close(0);
      const h = line.match(/^(#{1,3}) (.*)$/);
      if (h) html += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`;
      else if (line.trim()) html += `<p>${inline(line)}</p>`;
    }
    close(0);
    return html;
  }
  /** The update log split by version: [{ title, body }], newest first. */
  function releases() {
    const md = root.DraftChangelog || '';
    return md
      .split(/^## /m)
      .slice(1)
      .map((part) => {
        const [title, ...rest] = part.split('\n');
        return { title: title.trim(), body: rest.join('\n').trim() };
      });
  }

  Object.assign(UI, {
    markdown,
    releases,
    velocityChange,
    esc, tag, signed, num, rate, teamName, teamDot, player, playerLink, hand, grade, gradeClass,
    statLine, toolTable, toolSnapshot, obp, slg, statusLabel, serviceStatus,
  });
})(typeof window !== 'undefined' ? window : globalThis);
