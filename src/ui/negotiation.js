/* Screen 3½: signing-bonus negotiations with our picks, then counter-offers. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, tag, player, playerLink } = UI;

  /** 245 → "2억 4500만 원" (amounts are in 백만 원). */
  function won(n) {
    const eok = Math.floor(n / 100),
      man = (n % 100) * 100;
    return n <= 0 ? '0원' : `${eok ? `${eok}억` : ''}${eok && man ? ' ' : ''}${man ? `${man.toLocaleString('ko-KR')}만` : ''} 원`;
  }
  const RATIOS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
  const step = () => C.tuning.contracts.step;
  const offerOptions = (ask) => [...new Set(RATIOS.map((k) => Math.max(step(), Math.round((ask * k) / step()) * step())))];
  const chanceLabel = (x) => (x >= 0.85 ? '높음' : x >= 0.6 ? '보통' : x >= 0.3 ? '낮음' : '매우 낮음');
  const boostPct = (g, left) => Math.round(C.contracts.growthBoost(left, g.budgets[g.teamId]) * 100);

  function budgetBox(g, committed, note) {
    const budget = g.budgets[g.teamId],
      left = budget - committed,
      dev = C.tuning.contracts.devCost;
    return `<aside class="box budget-box">
      <h3>${esc(UI.teamName(g.teamId))} 신인 예산</h3>
      <dl class="facts">
        <dt>예산</dt><dd>${won(budget)}</dd>
        <dt>${esc(note)}</dt><dd>${won(committed)}</dd>
        <dt>남는 돈</dt><dd class="${left < 0 ? 'warn' : ''}">${left < 0 ? '−' + won(-left) : won(left)}</dd>
      </dl>
      <p class="note">남는 돈으로 육성선수를 1명에 ${won(dev)}씩 계약합니다. 그러고도 남은 돈은 육성 지원금이 되어, 우리가 뽑은 선수들의 첫 ${C.tuning.contracts.growthBoost.seasons}시즌 성장 속도를 높입니다(지금 기준 +${boostPct(g, Math.max(0, left))}%, 최대 +${Math.round(C.tuning.contracts.growthBoost.max * 100)}%).</p>
    </aside>`;
  }

  function firstOffers(g, offers) {
    const asks = C.asks(g),
      defaults = C.defaultOffers(g), // every ask, scaled down evenly if they do not fit the budget
      total = asks.reduce((n, a) => n + (offers[a.playerId] ?? defaults[a.playerId]), 0),
      over = total > g.budgets[g.teamId];
    const rows = asks
      .map((a) => {
        const p = player(g, a.playerId),
          offer = offers[a.playerId] ?? defaults[a.playerId],
          chance = offer ? C.contracts.publicChance(p, offer, a.ask, g.difficulty) : 0;
        const opts = [...new Set([...offerOptions(a.ask), defaults[a.playerId]])]
          .sort((x, y) => x - y)
          .map((v) => `<option value="${v}" ${v === offer ? 'selected' : ''}>${won(v)} (${Math.round((v / a.ask) * 100)}%)</option>`)
          .join('');
        return `<tr>
          <td>${esc(a.label)}</td>
          <td>${playerLink(p.id, p.name)}<small>${C.ROLES[p.role]} · ${esc(p.pathway)} · FV ${p.scoutCeiling}${p.intent ? ` · <b class="warn">${C.contracts.INTENT_LABELS[p.intent]}</b>` : ''}</small></td>
          <td class="n">${won(a.ask)}</td>
          <td><select data-offer="${esc(p.id)}" aria-label="${esc(p.name)} 제시액"><option value="0" ${offer === 0 ? 'selected' : ''}>계약 포기</option>${opts}</select></td>
          <td>${offer ? esc(chanceLabel(chance)) : '<span class="warn">포기</span>'}</td>
        </tr>`;
      })
      .join('');
    return `
    <div class="page-head">
      <h1>계약 협상</h1>
      <p>지명한 선수마다 계약금을 한 번 제시합니다. 선수는 받아들이거나, 금액을 올려 다시 요구하거나, 계약을 거부합니다. 거부한 선수는 대학이나 해외로 떠나고, 지명권은 돌려받지 못합니다.</p>
    </div>
    <div class="cols">
      <section>
        <div class="table-scroll"><table class="t">
          <thead><tr><th>지명</th><th>선수</th><th class="n">요구액</th><th>제시액</th><th>첫 제시 수락</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${asks.reduce((n, a) => n + a.ask, 0) > g.budgets[g.teamId] ? '<p class="callout">요구액을 모두 들어주면 예산을 넘습니다. 기본 제시액은 요구액을 같은 비율로 깎은 금액입니다.</p>' : ''}
        <p class="note">수락 가능성은 공개된 정보만으로 본 추정입니다. 어릴 때 응원한 팀이면 요구액이 낮고 협상도 잘 풀리지만, 그 정보는 요구액에만 드러납니다. 진학 희망·해외 구단 관심 선수는 요구액이 높고 협상이 틀어지기 쉽습니다.</p>
      </section>
      <div>
        ${budgetBox(g, total, '제시액 합계')}
        <div class="actions">
          <button class="btn primary wide" data-action="offer-confirm" ${over ? 'disabled' : ''}>이 금액으로 제시</button>
          ${over ? '<span class="note warn">제시액 합계가 예산을 넘습니다.</span>' : ''}
        </div>
      </div>
    </div>`;
  }

  function counters(g, accepted) {
    const mine = g.talks.filter((t) => t.teamId === g.teamId),
      open = mine.filter((t) => t.result === 'counter'),
      committed = C.spent(g) + open.filter((t) => accepted.has(t.playerId)).reduce((n, t) => n + t.counter, 0),
      over = committed > g.budgets[g.teamId];
    const done = mine
      .filter((t) => t.result !== 'counter')
      .map((t) => `<li><b>${esc(player(g, t.playerId).name)}</b> ${t.result === 'signed' ? `${won(t.bonus)}에 계약` : '<span class="warn">계약 거부</span>'}</li>`)
      .join('');
    const rows = open
      .map((t) => {
        const p = player(g, t.playerId),
          on = accepted.has(t.playerId);
        return `<tr class="${on ? 'mine' : ''}">
          <td>${playerLink(p.id, p.name)}<small>${C.ROLES[p.role]} · FV ${p.scoutCeiling}${p.intent ? ` · ${C.contracts.INTENT_LABELS[p.intent]}` : ''}</small></td>
          <td class="n">${won(t.offer)}</td><td class="n"><b>${won(t.counter)}</b></td>
          <td><button class="btn small ${on ? 'primary' : 'quiet'}" data-action="counter-toggle" data-id="${esc(p.id)}" aria-pressed="${on}">${on ? '수락' : '거절'}</button></td>
        </tr>`;
      })
      .join('');
    return `
    <div class="page-head">
      <h1>재협상</h1>
      <p>${open.length}명이 금액을 올려 다시 요구했습니다. 이번에 받아들이면 바로 계약하고, 거절하면 선수는 떠납니다.</p>
    </div>
    <div class="cols">
      <section>
        <div class="table-scroll"><table class="t">
          <thead><tr><th>선수</th><th class="n">우리 제시</th><th class="n">선수 요구</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <h3 style="margin-top:14px">첫 제시 결과</h3>
        <ul class="event-list">${done}</ul>
      </section>
      <div>
        ${budgetBox(g, committed, '계약금 합계')}
        <div class="actions">
          <button class="btn primary wide" data-action="counter-confirm" ${over ? 'disabled' : ''}>결정</button>
          ${over ? '<span class="note warn">예산을 넘습니다.</span>' : ''}
        </div>
      </div>
    </div>`;
  }

  function negotiation(g, offers, accepted) {
    return (g.offers ? counters(g, accepted) : firstOffers(g, offers)) + UI.pickLog(g);
  }

  /** Contract results, shown once negotiations close. */
  function contractResults(g) {
    const mine = g.talks.filter((t) => t.teamId === g.teamId),
      others = C.refusals(g).filter((t) => t.teamId !== g.teamId);
    const line = (t) => {
      const p = player(g, t.playerId),
        s = g.picks.find((x) => x.playerId === t.playerId);
      return t.result === 'signed'
        ? `<li>${esc(s.label)} <b>${esc(p.name)}</b> ${won(t.bonus)}</li>`
        : `<li>${esc(s.label)} <b>${esc(p.name)}</b> ${tag('계약 거부', 'warn')} <small>${esc(t.path)}</small></li>`;
    };
    return `<h2 class="rule">계약 결과 <small>계약금 합계 ${won(mine.reduce((n, t) => n + t.bonus, 0))}</small></h2>
      <ul class="event-list">${mine.map(line).join('')}</ul>
      ${others.length ? `<details><summary>다른 구단 지명 거부 ${others.length}건</summary><ul class="event-list">${others.map((t) => `<li>${esc(UI.teamName(t.teamId))} ${esc(g.picks.find((x) => x.playerId === t.playerId).label)} <b>${esc(player(g, t.playerId).name)}</b> <small>${esc(t.path)}</small></li>`).join('')}</ul></details>` : ''}`;
  }

  Object.assign(UI, { negotiation, contractResults, won, budgetBox });
})(typeof window !== 'undefined' ? window : globalThis);
