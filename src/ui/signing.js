/* Screen 3½: development ("육성") contracts with undrafted players, right after the draft. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, tag, hand } = UI;

  /** How many development contracts the club can still afford (at most the league limit). */
  const devLimit = (g) => Math.min(C.tuning.devContracts.max, Math.floor(C.budgetLeft(g) / C.tuning.contracts.devCost));

  function signing(g, chosen, role) {
    const max = devLimit(g),
      t = C.teamFor(g);
    const list = C.undrafted(g).filter((p) => role === 'ALL' || p.role === role).slice(0, 80);
    const chip = (id, name) => `<button class="chip" data-action="dev-role" data-id="${id}" aria-pressed="${role === id}">${name}</button>`;
    const rows = list
      .map((p) => {
        const on = chosen.has(p.id),
          full = !on && chosen.size >= max;
        return `<tr class="${on ? 'mine' : ''}">
          <td class="n">${p.rank}</td>
          <td><b>${esc(p.name)}</b> <small>${C.ROLES[p.role]} · ${esc(p.school)} · ${esc(p.pathway)} · ${hand(p)}${p.velocity ? ` · ${p.velocity}km/h` : ''}</small></td>
          <td class="n">${p.ready} / ${p.scoutCeiling}</td>
          <td class="hide-narrow">${esc(p.strength)}</td>
          <td><button class="btn small ${on ? 'primary' : 'quiet'}" data-action="dev-toggle" data-id="${p.id}" aria-pressed="${on}" ${full ? 'disabled' : ''}>${on ? '선택됨' : '선택'}</button></td>
        </tr>`;
      })
      .join('');
    const picked = [...chosen].map((id) => C.getPlayer(g, id));
    return `
    <div class="page-head">
      <h1>육성선수 계약</h1>
      <p>드래프트에서 지명되지 않은 선수와 육성선수 계약을 맺습니다. 1명에 ${UI.won(C.tuning.contracts.devCost)}이고, 지금 예산으로 ${max}명까지 가능합니다(리그 한도 ${C.tuning.devContracts.max}명). 육성선수는 첫 시즌에는 1군 주전이 될 수 없고, 이후에는 지명 선수와 똑같이 경쟁합니다. 우리가 먼저 고르고, 이어서 다른 구단들이 계약합니다.</p>
    </div>
    ${UI.contractResults(g)}
    <div class="cols">
      <section>
        <div class="chips" style="margin-bottom:8px">${[['ALL', '전체'], ...Object.entries(C.ROLES)].map(([id, name]) => chip(id, name)).join('')}</div>
        <div class="table-scroll"><table class="t">
          <thead><tr><th class="n">순위</th><th>선수</th><th class="n">현재 / 미래</th><th class="hide-narrow">스카우트 노트</th><th></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="empty">남은 선수가 없습니다.</td></tr>'}</tbody>
        </table></div>
        <p class="note">미지명 선수 중 공개 순위 상위 80명까지 보여 줍니다.</p>
      </section>
      <aside class="box">
        <h3>${esc(t.short)} 육성선수 <small class="muted">${chosen.size}/${max}</small></h3>
        ${picked.length ? `<ul class="mine-list">${picked.map((p) => `<li><span>육성</span><b>${esc(p.name)}</b><span>${C.ROLES[p.role]}</span></li>`).join('')}</ul>` : '<p class="note">아직 고른 선수가 없습니다.</p>'}
        ${UI.budgetBox(g, C.spent(g) + chosen.size * C.tuning.contracts.devCost, '계약금 + 육성선수')}
        <div class="actions">
          <button class="btn primary wide" data-action="dev-confirm">${chosen.size ? `${chosen.size}명과 계약` : '계약 없이 넘어가기'}</button>
        </div>
      </aside>
    </div>
    ${UI.pickLog(g)}`;
  }

  Object.assign(UI, { signing, devLimit });
})(typeof window !== 'undefined' ? window : globalThis);
