/* Screen 1: choose a club, difficulty and the regional first-round option. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, tag } = UI;

  /** Scout director tendencies and this game's detailed needs for a club. */
  function clubPanel(t) {
    const label = (key) => C.grades.LABELS[key] || { ready: '현재 기량', scoutCeiling: '미래 가치', floorGrade: '플로어' }[key];
    return `<section class="scouting-club">
      <h3>스카우트 팀장 · ${esc(t.staff.label)} <small class="muted">(${esc(t.staff.preference)} 선호)</small></h3>
      <ul>${t.detailedNeeds
        .map((n) => `<li><b>${esc(n.label)}</b> <small class="muted">${esc(label(n.key))} ${n.target}+</small><span>${esc(n.reason)}</span></li>`)
        .join('')}</ul>
      <p class="note">팀장 성향과 세부 수요는 게임마다 새로 정해집니다.</p>
    </section>`;
  }

  function setup({ selectedTeam, difficulty, local }, t) {
    const clubs = C.TEAMS.map(
      (club, i) => `<tr aria-selected="${club.id === selectedTeam}">
        <td class="n">${i + 1}</td>
        <td><button class="pick-btn" data-action="team" data-id="${club.id}" aria-pressed="${club.id === selectedTeam}">${UI.teamDot(club.id)}<span class="hide-narrow">${esc(club.name)}</span><span class="show-narrow">${esc(club.short)}</span></button></td>
        <td class="hide-narrow">${club.rank}위 <small>${club.record}</small></td>
        <td>${club.needs.map((r) => C.ROLES[r]).join(' · ')}</td>
      </tr>`,
    ).join('');
    const diff = C.rules.DIFFICULTIES;
    return `
    <div class="page-head">
      <h1>${C.ENTRY_YEAR} KBO 신인 드래프트</h1>
      <p>구단을 맡아 7라운드 지명을 하고, 뽑은 선수들이 ${C.ENTRY_YEAR}–${C.ENTRY_YEAR + 4} 다섯 시즌 동안 어떻게 자라는지 지켜봅니다. 후보 200명은 게임마다 새로 만들어집니다.</p>
    </div>
    <div class="cols">
      <div>
        <h2 class="rule">구단 <small>지난 시즌 역순으로 지명</small></h2>
        <div class="table-scroll"><table class="t club-table">
          <thead><tr><th class="n">순번</th><th>구단</th><th class="hide-narrow">지난 시즌</th><th>보강 우선순위</th></tr></thead>
          <tbody>${clubs}</tbody>
        </table></div>
      </div>
      <aside>
        <div class="box club-sheet">
          <h2>${UI.teamDot(t.id)}${esc(t.name)}</h2>
          <p class="muted">${esc(t.region)} · 지난 시즌 ${t.rank}위 (${t.record})</p>
          <dl class="facts" style="margin-top:10px">
            <dt>강점</dt><dd>${esc(t.strong)}</dd>
            <dt>약점</dt><dd>${esc(t.weak)}</dd>
            <dt>보강</dt><dd>${t.needs.map((r, i) => `${i + 1}. ${C.ROLES[r]}`).join('&nbsp; ')}</dd>
          </dl>
          ${clubPanel(t)}
        </div>
        <div class="box">
          <div class="settings-row">
            <b>난이도</b>
            <div class="seg" role="group" aria-label="난이도">${Object.entries(diff)
              .map(([id, c]) => `<button data-action="difficulty" data-id="${id}" aria-pressed="${difficulty === id}">${c.name}</button>`)
              .join('')}</div>
            <p>${esc(diff[difficulty].hint)}. 선수 능력과 성장 확률은 난이도와 무관합니다.</p>
          </div>
          <div class="settings-row">
            <label class="check" for="local-toggle"><input type="checkbox" id="local-toggle" ${local ? 'checked' : ''}> <b>지역 1차 지명</b></label>
            <p>${local ? '켜짐: 각 구단이 연고 지역 고졸 선수 1명을 먼저 지명한 뒤 전국 7라운드를 진행합니다. 총 8명.' : '꺼짐: 전국 7라운드만 진행합니다. 총 7명.'} 과거 연고지 제도를 단순화한 규칙입니다.</p>
          </div>
          <button class="btn primary wide" data-action="start">${esc(C.ko.p(t.short, "으로/로"))} 시작</button>
        </div>
      </aside>
    </div>`;
  }

  Object.assign(UI, { clubPanel, setup });
})(typeof window !== 'undefined' ? window : globalThis);
