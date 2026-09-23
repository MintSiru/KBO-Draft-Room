/* Screen 2: the media's mock drafts, then the scout director's three recommendations. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, tag, player } = UI;

  function mockTable(g, outlet, round) {
    const rows = outlet.picks
      .filter((s) => s.round === round)
      .map((s, i) => {
        const p = player(g, s.playerId),
          actual = g.picks.find((x) => x.round === round && x.teamId === s.teamId);
        const result = !actual
          ? ''
          : actual.playerId === p.id
            ? '<span class="hit">적중</span>'
            : `<small>실제: ${esc(player(g, actual.playerId).name)}</small>`;
        return `<tr class="${s.teamId === g.teamId ? 'mine' : ''}" data-player-id="${p.id}">
          <td class="n">${i + 1}</td><td>${UI.teamDot(s.teamId)}${UI.teamName(s.teamId)}</td>
          <td><b>${esc(p.name)}</b> <small>${C.ROLES[p.role]} · ${esc(p.school)}</small></td><td>${result}</td></tr>`;
      })
      .join('');
    return `<table class="t"><thead><tr><th class="n">#</th><th>구단</th><th>선수</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function forecasts(g, archive = false) {
    const rounds = g.local ? [0, 1] : [1];
    return `
    ${archive ? '' : `<div class="page-head"><h1>언론의 1라운드 예상</h1>
      <p>두 매체가 같은 공개 자료로 서로 다른 모의 지명을 냈습니다. 드래프트가 시작되면 예상은 바뀌지 않습니다.</p></div>`}
    <div class="cols even">${g.forecasts
      .map(
        (f) => `<section class="outlet">
          <h2>${esc(f.name)}</h2><p>${esc(f.style)} 중심</p>
          ${rounds
            .map((round) => `${g.local ? `<h3 style="margin:10px 0 4px">${round === 0 ? '지역 1차' : '전국 1라운드'}</h3>` : ''}${mockTable(g, f, round)}`)
            .join('')}
        </section>`,
      )
      .join('')}</div>
    ${archive ? '' : `<div class="actions"><button class="btn primary" data-action="scout-briefing">스카우트 팀장 추천 보기</button></div>`}`;
  }

  function briefing(g, archive = false) {
    const t = C.teamFor(g),
      report = g.scoutReport;
    const cards = report.candidates
      .map((c, i) => {
        const p = player(g, c.playerId),
          gone = g.picks.find((s) => s.playerId === p.id);
        // c.lines[0] and [2] restate the grades shown in the grade row; [1] is the club-need reasoning.
        return `<article class="box recommendation ${i === 0 ? 'primary' : ''}">
          <span class="kicker">${i === 0 ? '1순위 추천' : '대안 ' + i} · ${esc(c.angle)}</span>
          <h3>${esc(p.name)}</h3>
          <p class="muted">${C.ROLES[p.role]} · ${esc(p.school)} · ${esc(p.pathway)} · 공개 순위 ${p.rank}위</p>
          ${gone ? `<p>${tag(`${UI.teamName(gone.teamId)} ${gone.label} 지명`, 'solid')}</p>` : ''}
          <div class="grade-row"><div><b>${p.ready}</b>현재</div><div><b>${p.scoutCeiling}</b>미래 가치</div><div><b>${p.floorGrade}</b>플로어</div><div><b>${p.ceilingGrade}</b>실링</div></div>
          <div class="tags">${p.pickTags.map((x) => tag(x)).join('')}${tag('불확실성 ' + p.uncertainty)}</div>
          <p style="margin-top:10px">${esc(c.lines[1])}</p>
          <p style="margin-top:6px"><b>우려</b> ${esc(p.weakness)}</p>
        </article>`;
      })
      .join('');
    return `
    ${archive ? '' : `<div class="page-head"><h1>스카우트 팀장 추천</h1>
      <p>${esc(t.short)} ${report.scope} 지명을 앞두고 팀장이 고른 세 명입니다. 앞 순번 구단이 먼저 데려갈 수 있고, 다른 선수를 뽑아도 불이익은 없습니다.</p></div>`}
    ${archive ? '' : UI.clubPanel(t)}
    <div class="cols three">${cards}</div>
    ${archive ? '' : `<div class="actions"><button class="btn primary" data-action="begin-draft">드래프트 시작</button></div>`}`;
  }

  Object.assign(UI, { forecasts, briefing });
})(typeof window !== 'undefined' ? window : globalThis);
