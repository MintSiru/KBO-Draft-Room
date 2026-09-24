/* Screen 4: the GM's press conference promise and the rookies' first interviews. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, signed, player } = UI;

  /** The press conference: three questions, each answered once, then confirmed together. */
  function gm(g, answers = {}) {
    const qs = C.gmQuestions(g);
    if (g.gmChoice) {
      const chosen = qs.map((q) => ({ q, o: q.options.find((o) => o.id === (q.id === 'pledge' ? g.gmChoice : g.gmAnswers?.[q.id])) })).filter((x) => x.o);
      const pledge = chosen.find((x) => x.q.id === 'pledge').o;
      return `<section class="box gm-section">
        <h2>단장 기자회견 <small class="muted">답변 확정</small></h2>
        ${chosen
          .map(({ q, o }) => `<div style="margin-top:10px"><p class="note">${esc(q.question)}</p><blockquote style="margin:4px 0">${esc(o.answer)}</blockquote><p class="note">팬심 ${signed(o.delta)}${o.pledge ? ` · 약속: ${esc(o.pledge)}` : ''}</p></div>`)
          .join('')}
        <p><b>첫해 약속</b> ${esc(pledge.promise)}</p>
        <p class="note">${esc(pledge.reaction)} 약속은 정해진 시즌이 끝나면 평가합니다.</p>
      </section>`;
    }
    const ready = qs.every((q) => answers[q.id]);
    return `<section class="box gm-section">
      <h2>단장 기자회견</h2>
      <p>기자 질문 ${qs.length}개에 답합니다. 답변은 팬심에 반영되고, 약속한 것은 나중에 평가받습니다. 선수 성장에는 영향이 없습니다.</p>
      ${qs
        .map(
          (q, i) => `<h3 style="margin-top:14px">${i + 1}. ${esc(q.question)}</h3>
          <div class="options">${q.options
            .map((o) => {
              const on = answers[q.id] === o.id;
              return `<div class="${on ? 'chosen' : ''}">
                <h3>${esc(o.title)}</h3>
                <blockquote>${esc(o.answer)}</blockquote>
                ${o.promise ? `<p><b>평가 기준</b><br>${esc(o.promise)}</p>` : o.pledge ? `<p><b>약속</b> ${esc(o.pledge)}</p>` : ''}
                ${o.reaction ? `<p class="note">${esc(o.reaction)}</p>` : ''}
                <button class="btn ${on ? 'primary' : ''}" data-action="gm-answer" data-q="${q.id}" data-id="${o.id}" aria-pressed="${on}">${on ? '선택함' : '이 답변'} (팬심 ${signed(o.delta)})</button>
              </div>`;
            })
            .join('')}</div>`,
        )
        .join('')}
      <div class="actions"><button class="btn primary" data-action="gm-confirm" ${ready ? '' : 'disabled'}>답변 확정</button>${ready ? '' : '<span class="note">모든 질문에 답하면 확정할 수 있습니다.</span>'}</div>
    </section>`;
  }

  function devList(g) {
    const dev = (g.devSigns || []).filter((s) => s.teamId === g.teamId);
    if (!dev.length) return '';
    return `<h2 class="rule">육성선수 계약 <small>${dev.length}명</small></h2>
      <ul class="event-list">${dev
        .map((s) => {
          const p = player(g, s.playerId);
          return `<li><b>${esc(p.name)}</b> ${C.ROLES[p.role]} · ${esc(p.school)} · ${esc(p.pathway)} <small>${esc(p.strength)}</small></li>`;
        })
        .join('')}</ul>`;
  }

  function interviews(g, answers, plans = {}) {
    const quotes = C.mySignedPicks(g)
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
      <p>${esc(C.teamFor(g).short)}의 신인 ${C.mySignedPicks(g).length}명이 계약했습니다${C.refusals(g, g.teamId).length ? `(지명 거부 ${C.refusals(g, g.teamId).length}명)` : ''}. 기자회견을 마치면 ${C.ENTRY_YEAR} 시즌을 시작할 수 있습니다.</p></div>
    ${gm(g, answers)}
    <h2 class="rule">입단 소감</h2>
    <div class="quotes">${quotes}</div>
    ${devList(g)}
    ${g.gmChoice && !g.career ? UI.planPanel(g, plans, `${C.ENTRY_YEAR} 시즌 육성 계획`) : ''}
    ${UI.pickLog(g)}
    <div class="actions">
      <button class="btn primary" data-action="simulate" ${g.gmChoice ? '' : 'disabled'}>${g.career ? '시즌 화면으로 돌아가기' : `${C.ENTRY_YEAR} 시즌 진행`}</button>
      ${g.gmChoice ? '' : '<span class="note">먼저 기자회견 답변을 확정하세요.</span>'}
    </div>`;
  }

  Object.assign(UI, { gm, interviews });
})(typeof window !== 'undefined' ? window : globalThis);
