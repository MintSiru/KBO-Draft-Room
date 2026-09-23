/* Screens 5–6: the season hub, the all-club records room, a player's career and the draft review. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, tag, num, rate, teamName, player, playerLink } = UI;

  /** One row per drafted player, with stats for one season or the career total. */
  function rows(g, year = 'all', teamId = 'ALL', scope = 'origin', sort = 'rank', level = 'stats') {
    const years = g.career?.years || [],
      chosen = year === 'all' ? null : years.find((y) => String(y.year) === String(year)) || years.at(-1);
    const out = C.signed(g)
      .map((s) => {
        const p = player(g, s.playerId),
          state = g.career?.players[p.id],
          hist = g.career ? C.Career.history(g.career, p.id) : [];
        const rec = chosen ? chosen.records.find((r) => r.playerId === p.id) : null;
        return {
          p, s, state, rec,
          stats: chosen ? rec?.stats : C.Career.totalStats(hist),
          futures: chosen ? rec?.futures : C.Career.totalStats(hist, 'futures'),
          teamId: scope === 'origin' ? s.teamId : state ? state.currentTeamId : s.teamId,
          contribution: chosen ? rec?.contribution || 0 : hist.reduce((n, r) => n + r.contribution, 0),
          // Top velocity that season; for career totals, the latest one.
          velocity: chosen ? rec?.velocity ?? null : hist.findLast((r) => r.velocity)?.velocity ?? p.velocity ?? null,
          honors: years.flatMap((y) => y.awards).filter((a) => a.playerId === p.id && (!chosen || a.year === chosen.year)).length,
        };
      })
      .filter((x) => teamId === 'ALL' || x.teamId === teamId);
    const value = (x) => {
      const st = x[level];
      const only = (kind, v) => (st?.kind === kind ? v : null);
      switch (sort) {
        case 'rank': return x.s.overall;
        case 'contribution': return x.contribution;
        case 'games': return st?.games ?? null;
        case 'hr': return only('hitter', st?.hr);
        case 'ops': return only('hitter', st?.ops);
        case 'wins': return only('pitcher', st?.wins);
        case 'era': return only('pitcher', st?.era);
        case 'outs': return only('pitcher', st?.outs);
        default: return x.honors;
      }
    };
    const ascending = sort === 'rank' || sort === 'era';
    return out.sort((a, b) => {
      const av = value(a), bv = value(b);
      if (av == null && bv != null) return 1;
      if (bv == null && av != null) return -1;
      return (av == null ? 0 : (av - bv) * (ascending ? 1 : -1)) || a.s.overall - b.s.overall;
    });
  }

  function recordTable(g, list, level = 'stats') {
    if (!list.length) return '<p class="empty">해당하는 선수가 없습니다.</p>';
    const mixed = list.some((x) => x.s.teamId !== g.teamId);
    return ['hitter', 'pitcher']
      .map((kind) => {
        const group = list.filter((x) => x.p.record.kind === kind);
        if (!group.length) return '';
        const labels = kind === 'hitter' ? ['G', 'PA', 'AVG', 'OPS', 'HR', 'RBI', 'SB'] : ['G', 'GS', 'IP', 'ERA', 'W', 'HLD', 'SV', 'K', 'BB', 'QS', '구속'];
        const body = group
          .map((x) => {
            const s = x[level];
            const values = !s
              ? labels.map((l) => (l === '구속' && x.velocity ? x.velocity : '—'))
              : kind === 'hitter'
                ? [s.games, s.pa, rate(s.avg), rate(s.ops), s.hr, s.rbi, s.sb]
                : [s.games, s.gs, C.innings(s.outs), num(s.era, 2), s.wins, s.holds, s.saves, s.k, s.bb, s.qs, x.velocity ?? '—'];
            const now = x.state ? x.state.currentTeamId : x.s.teamId;
            const moved = x.state?.status === 'released' ? '방출' : now !== x.s.teamId ? `→ ${teamName(now)}` : '';
            return `<tr class="${mixed && x.s.teamId === g.teamId ? 'mine' : ''}">
              <td>${playerLink(x.p.id, x.p.name)}<small>${teamName(x.s.teamId)} ${esc(x.s.label)} · ${C.ROLES[x.p.role]}</small></td>
              <td>${moved ? `<span class="warn">${moved}</span>` : ''}</td>
              ${values.map((v) => `<td class="n">${esc(v)}</td>`).join('')}
              <td class="n">${level === 'stats' ? x.contribution : '—'}</td></tr>`;
          })
          .join('');
        return `<h3 style="margin:16px 0 6px">${kind === 'hitter' ? '야수' : '투수'} <small class="muted">${group.length}명</small></h3>
          <div class="table-scroll" tabindex="0" aria-label="${kind === 'hitter' ? '야수' : '투수'} 기록 (가로 스크롤)">
          <table class="t record-table"><thead><tr><th>선수</th><th>이적</th>${labels.map((l) => `<th class="n">${l}</th>`).join('')}<th class="n">기여</th></tr></thead>
          <tbody>${body}</tbody></table></div>`;
      })
      .join('');
  }

  function development(g, year) {
    const own = new Set(C.mySigned(g).map((s) => s.playerId));
    const cards = year.records
      .filter((r) => own.has(r.playerId))
      .map((r) => {
        const p = player(g, r.playerId);
        const from = r.startGrade ?? r.scoutReady;
        return `<article>
          <div style="display:flex;justify-content:space-between;gap:6px">${playerLink(p.id, p.name)}${tag(r.routeLabel, r.route === 'regular' ? 'good' : '')}</div>
          <p class="move">${from} → ${r.scoutReady} <small>현재 기량 · 지명 당시 FV ${p.scoutCeiling}</small></p>
          ${r.velocity ? `<p class="note">최고 구속 ${r.velocity}km/h (${UI.velocityChange(g, r)})</p>` : ''}
          <p>${esc(r.note)}</p>
          <p class="note">${esc(r.growthLabel)} · 계획 이행 ${r.planScore}점</p>
        </article>`;
      })
      .join('');
    return `<h2 class="rule">보직과 성장 <small>시즌 시작 → 종료 평가</small></h2>
      <div class="development-grid">${cards}</div>
      <p class="note">1군 콜업은 시즌 시작 기량으로 정하고, 종료 평가는 그해 성장을 반영합니다. 등급이 그대로여도 5점 단위 안에서 변화가 쌓입니다.</p>`;
  }

  function events(g, items) {
    if (!items.length) return '<p class="note">선수 이동이 없었습니다.</p>';
    return `<ul class="event-list">${items
      .map(
        (ev) => `<li><b>${ev.type === 'trade' ? `트레이드 · ${teamName(ev.fromTeamId)} ↔ ${teamName(ev.toTeamId)}` : `방출 · ${teamName(ev.fromTeamId)}`}</b>
          ${ev.playerIds.map((id) => playerLink(id, player(g, id).name)).join(' ↔ ')}
          <small>${esc(ev.reason)} (${ev.year}시즌 종료 후)</small></li>`,
      )
      .join('')}</ul>`;
  }

  function season(g, index) {
    const years = g.career.years,
      y = years[Math.min(index, years.length - 1)] || years.at(-1),
      yearNo = y.year - C.ENTRY_YEAR + 1,
      own = y.records.filter((r) => r.teamId === g.teamId),
      mine = rows(g, String(y.year), g.teamId, 'origin', 'rank'),
      standing = y.league.table.find((t) => t.teamId === g.teamId);
    const classAwards = y.awards.filter((a) => a.scope === 'draft-class'),
      champs = y.awards.filter((a) => a.scope === 'team');
    return `
    <div class="page-head">
      <span class="kicker">${yearNo}년 차 / 5</span>
      <h1>${y.year} 시즌 결과</h1>
      <p>${esc(teamName(g.teamId))} 정규시즌 ${standing.rank}위 (${standing.wins}승 ${standing.losses}패) · 한국시리즈 우승 ${esc(teamName(y.league.champion))}</p>
    </div>
    <nav class="year-tabs" aria-label="시즌 선택">${years
      .map((s, i) => `<button data-action="view-year" data-index="${i}" aria-pressed="${s.year === y.year}">${s.year}</button>`)
      .join('')}</nav>
    <div class="summary-strip">
      <div><b>${own.length}</b>우리 팀 소속 동기</div>
      <div><b>${own.filter((r) => r.stats.games > 0).length}</b>1군 출전</div>
      <div><b>${own.filter((r) => r.route === 'regular').length}</b>1군 주전급</div>
      <div><b>${standing.rank}위</b>정규시즌</div>
    </div>
    <h2 class="rule">우리가 지명한 선수 <button class="btn quiet small" data-action="records">전체 구단 기록실</button></h2>
    <p class="note">원지명 기준입니다. 다른 팀으로 옮긴 선수도 계속 보여 줍니다. 이름을 누르면 경력 전체를 볼 수 있습니다.</p>
    ${recordTable(g, mine)}
    ${development(g, y)}
    <div class="cols even" style="margin-top:8px">
      <section>
        <h2 class="rule">동기 개인상 <small>이번 드래프트 출신끼리 비교</small></h2>
        ${classAwards.length ? `<ul class="event-list">${classAwards.map((a) => `<li><b>${esc(a.title.replace('드래프트 동기 ', ''))}</b> ${playerLink(a.playerId, player(g, a.playerId).name)} <span class="muted">${teamName(a.teamId)}</span></li>`).join('')}</ul>` : '<p class="note">최소 출전 기준을 넘긴 선수가 없습니다.</p>'}
        <p class="note">우승 멤버: ${champs.map((a) => playerLink(a.playerId, player(g, a.playerId).name)).join(', ') || '없음'}</p>
        <h2 class="rule">${y.year} 비시즌</h2>
        ${events(g, y.events)}
      </section>
      <section>
        <h2 class="rule">순위표</h2>
        <table class="t standings"><tbody>${y.league.table
          .map((t) => `<tr class="${t.teamId === g.teamId ? 'mine' : ''}"><td class="n">${t.rank}</td><td>${UI.teamDot(t.teamId)}${teamName(t.teamId)}${t.teamId === y.league.champion ? ' ' + tag('우승', 'solid') : ''}</td><td class="n">${t.wins}승 ${t.losses}패</td></tr>`)
          .join('')}</tbody></table>
        <details style="margin-top:8px"><summary>포스트시즌</summary>${y.league.series
          .map((s) => `<p class="note">${s.label}: ${teamName(s.home)} ${s.homeWins}–${s.awayWins} ${teamName(s.away)} → ${teamName(s.winner)}</p>`)
          .join('')}</details>
      </section>
    </div>
    <div class="actions">
      ${years.length < 5 ? `<button class="btn primary" data-action="next-season">${years.at(-1).year + 1} 시즌 진행</button>` : '<button class="btn primary" data-action="owner">5년 최종 평가 보기</button>'}
      ${years.length < 5 ? '<button class="btn" data-action="owner">중간 평가</button>' : ''}
      <button class="btn quiet" data-action="interviews">입단 소감 다시 보기</button>
    </div>`;
  }

  function room(g, f) {
    const years = g.career?.years || [],
      list = rows(g, f.year, f.team, f.scope, f.sort, f.level);
    const opt = (v, label, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${label}</option>`;
    const sorts = { rank: '지명 순서', contribution: '1군 기여', games: '경기 수', hr: '홈런', wins: '승수', ops: 'OPS', era: 'ERA (낮은 순)', outs: '이닝', awards: '수상 수' };
    return `
    <div class="page-head"><h1>전체 구단 기록실</h1>
      <p>10개 구단이 이번 드래프트에서 뽑은 선수 모두의 기록입니다. 이름을 누르면 경력 전체를 볼 수 있습니다.</p>
      <div class="actions" style="margin-top:10px"><button class="btn" data-action="records-close">돌아가기</button></div></div>
    <div class="record-filters">
      <label class="field">구단<select id="record-team">${opt('ALL', '전체', f.team)}${C.TEAMS.map((t) => opt(t.id, t.short, f.team)).join('')}</select></label>
      <label class="field">구단 기준<select id="record-scope">${opt('origin', '원지명 구단', f.scope)}${opt('current', '현재 소속', f.scope)}</select></label>
      <label class="field">시즌<select id="record-year">${opt('all', '통산', f.year)}${years.map((y) => opt(y.year, `${y.year} (${y.year - C.ENTRY_YEAR + 1}년 차)`, f.year)).join('')}</select></label>
      <label class="field">리그<select id="record-level">${opt('stats', '1군', f.level)}${opt('futures', '퓨처스', f.level)}</select></label>
      <label class="field">정렬<select id="record-sort">${Object.entries(sorts).map(([k, l]) => opt(k, l, f.sort)).join('')}</select></label>
    </div>
    <p class="note">${list.length}명. 기여는 1군 성적으로 만든 게임 내 지수입니다(WAR 아님).${years.length ? '' : ' 아직 시즌을 진행하지 않았습니다.'}</p>
    ${recordTable(g, list, f.level)}`;
  }

  function profile(g, id) {
    const p = player(g, id),
      sel = C.signed(g).find((s) => s.playerId === id);
    if (!p || !sel) return '<p>지명 선수를 찾을 수 없습니다.</p>';
    const hist = g.career ? C.Career.history(g.career, id) : [],
      state = g.career?.players[id];
    const honors = (g.career?.years || []).flatMap((y) => y.awards).filter((a) => a.playerId === id),
      evs = (g.career?.events || []).filter((a) => a.playerIds.includes(id));
    const now = state ? state.currentTeamId : sel.teamId;
    const pending = state?.status === 'active' && hist.length === 5 && hist.at(-1).age <= 24 && state.scoutReady < p.scoutCeiling;
    const r = p.record;
    return `<div class="career-profile">
      <span class="kicker">${teamName(sel.teamId)} ${esc(sel.label)} ${sel.dev ? '계약' : '지명'}${now !== sel.teamId ? ` · 현재 ${teamName(now)}` : ''}</span>
      <h2>${esc(p.name)}</h2>
      <p>${C.ROLES[p.role]} · ${esc(p.pathway)}${p.quotaEligible ? ' (대졸 의무 대상)' : ''} · ${UI.hand(p)} · ${p.height}cm ${p.weight}kg</p>
      <p class="muted">${esc(p.pathText)} · ${p.birthday} 출생 · 지명 당시 만 ${p.age}세${hist.length ? `, ${hist.at(-1).year}년 말 만 ${hist.at(-1).age}세` : ''}</p>
      <p>강점: ${esc(p.strength)} 과제: ${esc(p.weakness)}</p>
      ${pending ? '<p class="callout">아직 성장 중인 젊은 선수입니다. 5년만으로 평가를 끝내기 이릅니다.</p>' : ''}
      <h3>지명 당시 평가</h3>
      ${UI.toolTable(p)}
      ${state ? UI.toolSnapshot(p, state.publicTools, `현재 세부 기량 · 종합 ${state.scoutReady}`) : ''}
      <p class="note">지명 전 시즌: ${r.kind === 'pitcher' ? `${r.games}경기 ${C.innings(r.outs)}이닝 ERA ${num(r.era, 2)} ${r.k}삼진` : `${r.games}경기 ${r.pa}타석 타율 ${rate(r.avg)} OPS ${rate(r.ops)} ${r.hr}홈런`}</p>
      <h3>연도별 기록</h3>
      ${hist.length
        ? hist
            .map(
              (y) => `<article class="year-report">
                <header><b>${y.year} · ${teamName(y.teamId)}</b>${tag(y.routeLabel, y.route === 'regular' ? 'good' : '')}</header>
                <p>1군: ${UI.statLine(y.stats)}</p>
                <p class="muted">퓨처스: ${UI.statLine(y.futures)}</p>
                <p>${esc(y.note)}</p>
                <p class="note">${esc(y.growthLabel)} · 현재 기량 ${y.startGrade ?? y.scoutReady} → ${y.scoutReady} · 계획 이행 ${y.planScore}${y.velocity ? ` · 최고 구속 ${y.velocity}km/h (${UI.velocityChange(g, y)})` : ''}</p>
                ${y.publicTools ? UI.toolSnapshot(p, y.publicTools, '시즌 종료 세부 기량') : ''}
              </article>`,
            )
            .join('') +
          `<p><b>1군 통산</b> ${UI.statLine(C.Career.totalStats(hist))}</p><p class="muted"><b>퓨처스 통산</b> ${UI.statLine(C.Career.totalStats(hist, 'futures'))}</p>`
        : '<p class="note">아직 프로 시즌을 치르지 않았습니다.</p>'}
      <h3>수상</h3>
      ${honors.length ? honors.map((a) => `<p>${a.year} · ${esc(a.title)} (${teamName(a.teamId)})</p>`).join('') : '<p class="note">없음</p>'}
      <h3>이적·방출</h3>
      ${events(g, evs)}
    </div>`;
  }

  function pledge(g) {
    const o = g.owner,
      c = C.press.GM_CHOICES.find((x) => x.id === g.gmChoice);
    return `<section class="box pledge-review">
      <h3>기자회견 약속: ${esc(c.title)} — ${esc(o.pledge.status)} (${UI.signed(o.pledge.bonus)}점)</h3>
      <p>${esc(o.pledge.detail)}. 첫해 평가 ${o.baseScore}점 ${UI.signed(o.pledge.bonus)} = ${o.score}점 (${o.grade}).</p>
    </section>`;
  }

  function review(g) {
    const all = C.careerReview(g),
      mine = all.find((t) => t.teamId === g.teamId),
      n = g.career.years.length,
      first = g.owner;
    const bar = (label, v) => `<div>${label} <b class="num">${Math.round(v)}%</b><span><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span></div>`;
    return `
    <div class="page-head">
      <span class="kicker">${n === 5 ? '최종 평가' : `중간 평가 · ${n}시즌 경과`}</span>
      <h1>${n === 5 ? '다섯 시즌 뒤 돌아본 드래프트' : `${n}시즌까지의 드래프트 평가`}</h1>
      <p>원지명 선수가 어디서 뛰었든 전체 경력으로 평가하고, 우리 팀에서 낸 기여는 따로 셉니다.</p>
    </div>
    <div class="cols">
      <section class="box">
        <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
          <div class="grade-card"><div class="letter">${mine.grade}</div><div class="score">${mine.score} / 100</div></div>
          <div class="score-bars" style="flex:1;min-width:220px">
            ${bar('1군에 데뷔한 비율', (mine.debut / mine.count) * 100)}
            ${bar('주전급으로 자리 잡은 비율', (mine.established / mine.count) * 100)}
            ${bar('기여 중 우리 팀에서 낸 비율', mine.total ? (mine.atHome / mine.total) * 100 : 0)}
          </div>
        </div>
        <dl class="facts" style="margin-top:14px">
          <dt>1군 출전</dt><dd>${mine.debut}/${mine.count}명 · 주전급 경험 ${mine.established}명</dd>
          <dt>기여 합계</dt><dd>${mine.total} (우리 팀에서 ${mine.atHome})</dd>
          <dt>기량 변화</dt><dd>지명 당시 대비 평균 ${UI.signed(mine.development)}</dd>
          <dt>기타</dt><dd>동기 개인상 ${mine.awards}회 · 방출 ${mine.released}명 · 성장 중 ${mine.pending}명</dd>
        </dl>
        <p class="note">점수 = 보강 적합 20% + 기여(인원·시즌 보정) 50% + 기량 발전 30%.</p>
      </section>
      <aside>
        <section class="box"><h3>첫해 구단주 평가</h3>
          <p style="font-size:28px;font-weight:800">${first.grade} <small class="muted">${first.score}점</small></p>
          <p class="note">보강 ${first.needScore} · 첫해 계획 ${first.production} · 미래 가치 ${first.future}</p>
        </section>
        ${pledge(g)}
      </aside>
    </div>
    <h2 class="rule">10개 구단 비교</h2>
    <div class="table-scroll" tabindex="0"><table class="t record-table">
      <thead><tr><th>구단</th><th class="n">순위</th><th class="n">평가</th><th class="n">1군 출전</th><th class="n">주전급</th><th class="n">전체 기여</th><th class="n">원구단 기여</th><th class="n">개인상</th></tr></thead>
      <tbody>${all
        .map((x, i) => `<tr class="${x.teamId === g.teamId ? 'mine' : ''}"><td><button class="link" data-action="team-records" data-id="${x.teamId}">${teamName(x.teamId)}</button></td><td class="n">${i + 1}</td><td class="n">${x.grade} ${x.score}</td><td class="n">${x.debut}/${x.count}</td><td class="n">${x.established}</td><td class="n">${x.total}</td><td class="n">${x.atHome}</td><td class="n">${x.awards}</td></tr>`)
        .join('')}</tbody>
    </table></div>
    <div class="actions">
      ${n < 5 ? `<button class="btn primary" data-action="next-season">${C.ENTRY_YEAR + n} 시즌 진행</button>` : ''}
      <button class="btn" data-action="season">시즌별 기록</button>
      <button class="btn" data-action="records">전체 구단 기록실</button>
      <button class="btn quiet" data-action="export-save">진행 파일 저장</button>
      <button class="btn quiet" data-action="download">첫해 결과 이미지</button>
    </div>`;
  }

  Object.assign(UI, { recordRows: rows, recordTable, development, season, room, careerProfile: profile, review, pledge });
})(typeof window !== 'undefined' ? window : globalThis);
