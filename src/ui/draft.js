/* Screen 3: the draft board, the selected prospect's profile and the pick log. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, tag, player, hand } = UI;

  const PATHWAYS = ['고졸', '대졸', '대학 얼리', '2년제', '독립구단', '해외파', '야구 유학', '마이너 복귀', '해외독립 복귀', '해외리그 복귀', 'MLB 경험 복귀'];
  const TIERS = ['명문', '강호', '중견', '약소', '미분류'];
  const PICK_TYPES = ['즉전감', '플로어', '실링', '육성형', '역할형'];
  const roundLabel = (slot) => (slot?.round === 0 ? '지역 1차' : `${slot?.round || 1}라운드`);

  function filterPlayers(g, v, stars, team) {
    const q = v.query.trim();
    const list = C.available(g).filter(
      (p) =>
        (v.pickType === 'ALL' || p.pickTags.includes(v.pickType)) &&
        (v.role === 'ALL' || p.role === v.role) &&
        (v.pathway === 'ALL' || p.pathway === v.pathway) &&
        (v.tier === 'ALL' || (p.schoolTier || '미분류') === v.tier) &&
        (!v.onlyStars || stars.has(p.id)) &&
        (!q || `${p.name} ${p.pathText} ${p.region} ${p.birthplace}`.includes(q)),
    );
    return C.rules.sortPlayers(list, v.sort, v.sortDir, team);
  }

  function sortValue(p, key, team) {
    if (key === 'rank') return `${p.ready} / ${p.scoutCeiling}`;
    const n = C.rules.sortValue(p, key, team);
    if (n == null) return '—';
    if (key === 'outs') return C.innings(n);
    if (key === 'era') return n.toFixed(2);
    if (key === 'avg' || key === 'ops') return UI.rate(n);
    return String(n);
  }

  const columnLabel = (sort) => (sort === 'rank' ? '현재 / 미래' : C.rules.SORTS[sort].label);

  function sortOptions(selected) {
    const groups = [...new Set(Object.values(C.rules.SORTS).map((s) => s.group))];
    return groups
      .map(
        (group) =>
          `<optgroup label="${group}">${Object.entries(C.rules.SORTS)
            .filter(([, s]) => s.group === group)
            .map(([id, s]) => `<option value="${id}" ${selected === id ? 'selected' : ''}>${s.label}</option>`)
            .join('')}</optgroup>`,
      )
      .join('');
  }

  function rows(g, list, v, stars, team, selected) {
    if (!list.length)
      return `<div class="empty">조건에 맞는 후보가 없습니다. <button class="link" data-action="clear-filters">필터 초기화</button></div>`;
    const label = columnLabel(v.sort);
    return list
      .map((p) => {
        const fit = C.fit(p, team);
        return `<button class="player-row" data-action="player" data-id="${p.id}" aria-pressed="${selected === p.id}">
          <span class="rk">${p.rank}</span>
          <span><span class="nm">${stars.has(p.id) ? '★ ' : ''}${esc(p.name)}<small>${hand(p)}</small></span>
            <span class="meta">${C.ROLES[p.role]} · ${esc(p.school)} · ${esc(p.pathway)}</span></span>
          <span class="val">${sortValue(p, v.sort, team)}<small>${esc(label)}</small></span>
          <span class="fit ${fit >= 80 ? 'core' : ''}">${C.fitLabel(p, team)}</span>
        </button>`;
      })
      .join('');
  }

  function amateurLine(p) {
    const r = p.record;
    const where =
      p.pathway === '고졸' ? '고교 대회' : p.pathway === '야구 유학' ? '해외 고교 대회' : ['대졸', '대학 얼리', '2년제'].includes(p.pathway) ? '대학 리그' : p.pathway === '독립구단' ? '독립리그' : '해외 리그';
    const main =
      r.kind === 'pitcher'
        ? `<span><b>${r.era.toFixed(2)}</b>ERA</span><span><b>${C.innings(r.outs)}</b>이닝</span><span><b>${r.k}</b>삼진</span><span><b>${r.bb}</b>볼넷</span>`
        : `<span><b>${UI.rate(r.avg)}</b>타율</span><span><b>${UI.rate(r.ops)}</b>OPS</span><span><b>${r.hr}</b>홈런</span><span><b>${r.sb}</b>도루</span>`;
    const extra = r.kind === 'pitcher' ? `${r.wins}승` : `${r.pa}타석 ${r.rbi}타점 ${r.runs}득점`;
    return `<div class="stat-line">${main}</div><p class="note">${where} ${r.games}경기 · ${extra}</p>`;
  }

  function profile(g, p, stars, team) {
    if (!p) return '<div class="box empty">왼쪽 목록에서 선수를 고르세요.</div>';
    const fit = C.fit(p, team);
    const advice = C.scoutAdvice(p, g).lines;
    return `<article class="box profile-body">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div>
          <h2>${esc(p.name)}</h2>
          <p class="sub">${C.ROLES[p.role]} · ${esc(p.archetype)} · ${hand(p)} · ${p.height}cm ${p.weight}kg</p>
          <p class="sub">${esc(p.school)} · ${esc(p.pathway)} · 만 ${p.age}세 · 공개 순위 ${p.rank}위</p>
        </div>
        <button class="btn quiet small" data-action="star" data-id="${p.id}" aria-pressed="${stars.has(p.id)}">${stars.has(p.id) ? '★ 관심' : '☆ 관심'}</button>
      </div>
      ${g.difficulty === 'easy' ? `<p class="favorite-note note">어릴 때 응원한 구단: ${C.TEAMS[p.favoriteTeam].short} (이지 난이도에서만 공개)</p>` : ''}
      <section>${UI.toolTable(p)}</section>
      <section>
        <h4>지명 전 시즌 기록</h4>
        ${amateurLine(p)}
        ${p.proExperience ? `<p class="note">${esc(p.proExperience.recordScope)} · 해외 ${p.proExperience.seasons}시즌. 국내 프로 미입단자의 복귀 지원이며, 리그 수준이 달라 국내 기록과 바로 비교하기 어렵습니다.</p>` : ''}
        ${p.awards.length ? `<div class="tags">${p.awards.map((x) => tag(x)).join('')}</div>` : ''}
        ${p.velocity ? `<p class="note">최고 구속 ${p.velocity}km/h</p>` : ''}
      </section>
      <section>
        <h4>스카우팅 리포트</h4>
        <dl class="facts"><dt>강점</dt><dd>${esc(p.strength)}</dd><dt>과제</dt><dd>${esc(p.weakness)}</dd>
        <dt>${esc(team.short)} 적합</dt><dd>${C.fitLabel(p, team)}${fit >= 60 ? ` · 보강 ${team.needs.indexOf(p.role) + 1}순위 포지션` : ''}</dd>
        <dt>첫해 전망</dt><dd>${C.outlook(p)} · ${C.upsideLabel(p)}</dd></dl>
      </section>
      <section class="advice">
        <h4>팀장 의견</h4>
        <ul>${advice.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      </section>
      <section>
        <details><summary>배경 · 이력</summary>
          <dl class="facts">
            <dt>생년월일</dt><dd>${p.birthday}</dd><dt>출생지</dt><dd>${esc(p.birthplace)}</dd>
            <dt>야구부 평판</dt><dd>${esc(p.schoolTier || '해당 없음')}${p.schoolTier ? ` · ${esc(p.schoolStyle)}` : ''}</dd>
            ${p.schoolTournament ? `<dt>대회 성적</dt><dd>${esc(p.schoolTournament.event)} ${esc(p.schoolTournament.result)}${p.schoolTournament.national ? `<br>${esc(p.schoolTournament.national.event)} ${esc(p.schoolTournament.national.result)}` : ''}</dd>` : ''}
            <dt>지역 1차</dt><dd>${p.regionalEligible ? esc(p.regionalRegion) + ' 대상' : '대상 아님'}</dd>
            <dt>성격</dt><dd>${esc(p.personality)}</dd>
          </dl>
          <ol class="history">${p.history
            .map((h) => `<li>${esc(h.name)} <span class="muted">${h.start.slice(0, 7)} – ${h.end ? h.end.slice(0, 7) : '현재'} · ${esc(h.status)}</span>${h.note ? `<small>${esc(h.note)}</small>` : ''}</li>`)
            .join('')}</ol>
        </details>
      </section>
      <div class="actions"><button class="btn primary wide" data-action="pick" data-id="${p.id}">${esc(p.name)} 지명</button></div>
    </article>`;
  }

  function myPicks(g) {
    const mine = C.myPicks(g),
      total = g.rounds + (g.local ? 1 : 0);
    return `<section class="box">
      <h3>${UI.teamName(g.teamId)} 지명 <small class="muted">${mine.length}/${total}</small></h3>
      ${mine.length
        ? `<ul class="mine-list">${mine
            .map((s) => {
              const p = player(g, s.playerId);
              return `<li><span>${esc(s.label)}</span><b>${esc(p.name)}</b><span>${C.ROLES[p.role]}</span></li>`;
            })
            .join('')}</ul>`
        : '<p class="note">아직 지명한 선수가 없습니다.</p>'}
    </section>`;
  }

  function log(g) {
    return `<details class="box" style="margin-top:14px"><summary>전체 지명 기록 (${g.picks.length})</summary>
      ${g.picks.length
        ? `<div class="log-list">${g.picks
            .map((s) => {
              const p = player(g, s.playerId);
              return `<div${s.teamId === g.teamId ? ' class="good"' : ''}>${s.overall}. ${UI.teamName(s.teamId)} ${esc(s.label)} · ${esc(p.name)} <span class="muted">${C.ROLES[p.role]}</span></div>`;
            })
            .join('')}</div>`
        : '<p class="note">아직 지명이 없습니다.</p>'}
    </details>`;
  }

  function quota(g) {
    const q = C.quotaStatus(g);
    if (!q.missing) return `<p class="callout ok">대졸 의무 지명 충족 (${q.count}/1).</p>`;
    return `<p class="callout">${
      q.remaining <= q.missing
        ? '<b>마지막 전국 지명권입니다.</b> 국내 대학 졸업예정자만 지명할 수 있습니다.'
        : '<b>대졸 의무 지명 0/1</b> · 국내 4년제·2년제 대학 졸업예정자를 1명 이상 뽑아야 합니다(대학 얼리 제외).'
    }</p>`;
  }

  function board(g, v, stars, selectedId) {
    const t = C.teamFor(g),
      slot = g.schedule[g.cursor],
      mine = C.myPicks(g).length,
      total = g.rounds + (g.local ? 1 : 0);
    const list = filterPlayers(g, v, stars, t);
    const selected = selectedId && C.available(g).some((p) => p.id === selectedId) ? player(g, selectedId) : null;
    const strip = C.TEAMS.map((club) => {
      const picked = g.picks.find((s) => s.round === slot.round && s.teamId === club.id);
      const you = club.id === g.teamId;
      return `<div class="${you ? 'you' : ''}"><b>${club.short}</b><span>${picked ? esc(player(g, picked.playerId).name) : you ? '지명 차례' : '—'}</span></div>`;
    }).join('');
    const chip = (action, id, label, on) => `<button class="chip" data-action="${action}" data-id="${id}" aria-pressed="${on}">${label}</button>`;
    return `
    <div class="on-clock">
      <div><span class="kicker">${roundLabel(slot)} · 전체 ${g.cursor + 1}번째</span><h1>${esc(t.short)}의 지명 차례</h1></div>
      <p class="count"><b>${mine}</b> / ${total}명 지명</p>
    </div>
    <div class="round-strip" aria-label="이번 라운드 지명 현황">${strip}</div>
    ${slot.round === 0 ? `<p class="callout">지역 1차 지명: ${esc(t.region)} 지역 고졸 후보만 보입니다.</p>` : quota(g)}
    <div class="cols">
      <div>
        <section class="box">
          <div class="board-tools">
            <div class="line">
              <label class="sr-only" for="search">선수·학교 검색</label>
              <input id="search" type="search" placeholder="이름·학교·지역 검색" value="${esc(v.query)}" autocomplete="off">
              <label class="sr-only" for="sort">정렬</label><select id="sort">${sortOptions(v.sort)}</select>
              <button class="btn quiet small" data-action="sort-direction" aria-label="정렬 방향 바꾸기">${v.sortDir === 'asc' ? '오름차순' : '내림차순'}</button>
            </div>
            <div class="chips">${[['ALL', '전체'], ...Object.entries(C.ROLES)].map(([id, name]) => chip('role', id, name, v.role === id)).join('')}${`<button class="chip" data-action="only-stars" aria-pressed="${v.onlyStars}">★ 관심</button>`}</div>
            <div class="chips">${[['ALL', '유형 전체'], ...PICK_TYPES.map((x) => [x, x])].map(([id, name]) => chip('pick-type', id, name, v.pickType === id)).join('')}</div>
            <div class="line">
              <label class="sr-only" for="pathway">출신</label><select id="pathway">${['ALL', ...PATHWAYS].map((x) => `<option value="${x}" ${v.pathway === x ? 'selected' : ''}>${x === 'ALL' ? '출신 전체' : x}</option>`).join('')}</select>
              <label class="sr-only" for="tier">야구부 평판</label><select id="tier">${['ALL', ...TIERS].map((x) => `<option value="${x}" ${v.tier === x ? 'selected' : ''}>${x === 'ALL' ? '평판 전체' : x}</option>`).join('')}</select>
              <span class="note" id="candidate-count" style="margin-left:auto">${list.length}명</span>
            </div>
          </div>
          <div class="roster-head"><span>순위</span><span>선수</span><span>${esc(columnLabel(v.sort))}</span><span>적합</span></div>
          <div class="roster" id="roster">${rows(g, list, v, stars, t, selectedId)}</div>
        </section>
        ${log(g)}
      </div>
      <div><div id="profile" class="profile">${profile(g, selected, stars, t)}</div><div style="margin-top:14px">${myPicks(g)}</div></div>
    </div>`;
  }

  Object.assign(UI, { board, rows, profile, filterPlayers, myPicksBox: myPicks, pickLog: log, roundLabel });
})(typeof window !== 'undefined' ? window : globalThis);
