/* Screen 4: the GM's press conference promise and the rookies' first interviews. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, signed, player } = UI;

  function gm(g) {
    const opts = C.gmOptions(g),
      chosen = opts.find((c) => c.id === g.gmChoice);
    if (chosen)
      return `<section class="box gm-section">
        <h2>단장 기자회견 <small class="muted">답변 확정</small></h2>
        <h3 style="margin-top:8px">${esc(chosen.title)}</h3>
        <blockquote style="margin:8px 0">${esc(chosen.answer)}</blockquote>
        <p><b>약속</b> ${esc(chosen.promise)} · 팬심 ${signed(chosen.delta)}</p>
        <p class="note">${esc(chosen.reaction)} 첫 시즌이 끝나면 약속을 지켰는지 평가합니다.</p>
      </section>`;
    return `<section class="box gm-section">
      <h2>단장 기자회견</h2>
      <p>“이번 지명으로 첫해에 무엇을 보여 주실 겁니까?” 답변은 한 번만 고를 수 있고, 팬심과 첫해 평가에 반영됩니다. 선수 성장에는 영향이 없습니다.</p>
      <div class="options">${opts
        .map(
          (c) => `<div>
            <h3>${esc(c.title)}</h3>
            <blockquote>${esc(c.answer)}</blockquote>
            <p><b>평가 기준</b><br>${esc(c.promise)}</p>
            <p class="note">${esc(c.reaction)}</p>
            <button class="btn" data-action="gm-choice" data-id="${c.id}">이 답변 선택 (팬심 ${signed(c.delta)})</button>
          </div>`,
        )
        .join('')}</div>
    </section>`;
  }

  function interviews(g) {
    const quotes = C.myPicks(g)
      .map((s) => {
        const p = player(g, s.playerId);
        return `<article class="box quote">
          <span class="kicker">${esc(s.label)} · ${C.ROLES[p.role]}</span>
          <h3>${esc(p.name)} <small class="muted">${esc(p.school)}</small></h3>
          <blockquote>${esc(C.interview(p, s, g, 'ceremony'))}</blockquote>
          <p class="note">${C.outlook(p)} · ${esc(p.personality)}</p>
        </article>`;
      })
      .join('');
    return `
    <div class="page-head"><h1>드래프트 종료</h1>
      <p>${esc(C.teamFor(g).short)}의 신인 ${C.myPicks(g).length}명이 정해졌습니다. 단장 답변을 고르면 ${C.ENTRY_YEAR} 시즌을 시작할 수 있습니다.</p></div>
    ${gm(g)}
    <h2 class="rule">입단 소감</h2>
    <div class="quotes">${quotes}</div>
    ${UI.pickLog(g)}
    <div class="actions">
      <button class="btn primary" data-action="simulate" ${g.gmChoice ? '' : 'disabled'}>${g.career ? '시즌 화면으로 돌아가기' : `${C.ENTRY_YEAR} 시즌 진행`}</button>
      ${g.gmChoice ? '' : '<span class="note">먼저 기자회견 답변을 고르세요.</span>'}
    </div>`;
  }

  Object.assign(UI, { gm, interviews });
})(typeof window !== 'undefined' ? window : globalThis);
