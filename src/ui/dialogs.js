/* Modal contents and the in-game toolbar. Each dialog returns { title, body, wide? }. */
(function (root) {
  'use strict';
  const C = root.DraftCore,
    UI = root.DraftUI;
  const { esc, tag, signed, player } = UI;

  /** Bar under the steps: difficulty, fan mood and the archives that stay reachable all game. */
  function gameBar(g) {
    const fan = C.fanState(g);
    return `<div class="actions" style="margin:0 0 18px;padding-bottom:12px;border-bottom:1px solid var(--rule)">
      ${tag(C.rules.DIFFICULTIES[g.difficulty].name, 'solid')}
      <button class="btn quiet small" data-action="fan-history">팬심 <b class="num">${fan.score}</b> · ${esc(fan.label)}</button>
      <button class="btn quiet small" data-action="mock-archive">언론 예상</button>
      <button class="btn quiet small" data-action="scout-archive">팀장 추천</button>
      <button class="btn quiet small" data-action="news-room">뉴스 ${g.news.length}</button>
      <button class="btn quiet small" data-action="records">기록실</button>
      <button class="btn quiet small" data-action="export-save">진행 파일 저장</button>
      <span class="note" style="margin-left:auto">${g.career ? `${g.career.years.length}/${C.Career.SEASONS} 시즌` : `대졸 의무 1명 · ${C.Career.SEASONS}시즌 추적`}</span>
    </div>`;
  }

  function newsCard(n) {
    return `<article class="news-article" data-news-id="${n.id}">
      <span class="kicker">${esc(n.label)}</span>
      <h3>${esc(n.headline)}</h3>
      <p>${esc(n.body)}</p>
      <div class="comments">${n.comments.map((c) => `<p><b>${esc(c.handle)}</b> <span class="muted">${esc(c.tone)}</span><br>${esc(c.text)}</p>`).join('')}</div>
    </article>`;
  }

  const catalogKinds = {
    'high-school': '고교', 'hs-club': '고교 연령 클럽', college: '국내 대학 (4년제)', college2: '국내 대학 (2년제)', independent: '독립구단',
    'overseas-hs': '해외 고교 (야구 유학)', 'overseas-college': '해외 대학', 'overseas-pro': '해외 프로 구단', 'overseas-independent': '해외 독립 구단',
  };

  const dialogs = {
    confirm(g, { id }) {
      const p = player(g, id),
        slot = g.schedule[g.cursor],
        t = C.teamFor(g);
      return {
        title: `${UI.roundLabel(slot)} 지명 확정`,
        body: `<h3>${esc(p.name)}</h3><p class="muted">${C.ROLES[p.role]} · ${esc(p.school)} · ${UI.hand(p)}</p>
          <p style="margin-top:8px">${C.fitLabel(p, t)} · ${C.outlook(p)}. 확정하면 되돌릴 수 없고, 다음 우리 차례까지 다른 구단 지명이 자동으로 진행됩니다.</p>
          <div class="actions"><button class="btn primary" data-action="confirm-pick" data-id="${p.id}">지명 확정</button><button class="btn quiet" data-action="close-modal">취소</button></div>`,
      };
    },
    interview(g, { selection }) {
      const p = player(g, selection.playerId),
        t = C.teamFor(g);
      return {
        title: `${selection.round === 0 ? '지역 1차' : '1라운드'} 지명 · ${esc(t.short)}`,
        body: `<h3>${esc(p.name)} <small class="muted">${C.ROLES[p.role]} · ${esc(p.school)}</small></h3>
          <p style="margin-top:10px"><b>감독</b> ${esc(C.coach(p, g))}</p>
          <p style="margin-top:8px"><b>${esc(p.name)}</b> ${esc(C.interview(p, selection, g))}</p>
          ${newsCard(g.news.find((n) => n.overall === selection.overall))}
          <div class="actions"><button class="btn primary" data-action="close-modal">계속</button></div>`,
      };
    },
    scout: (g) => ({ title: '지명 전 팀장 추천', body: UI.briefing(g, true), wide: true }),
    mock: (g) => ({ title: '지명 전 언론 예상', body: UI.forecasts(g, true), wide: true }),
    news: (g) => ({
      title: '드래프트 뉴스',
      body: g.news.length ? [...g.news].reverse().map(newsCard).join('') : '<p class="empty">지역 1차·1라운드 지명 뒤 기사가 올라옵니다.</p>',
    }),
    fans(g) {
      const f = C.fanState(g);
      return {
        title: `팬심 ${f.score} · ${f.label}`,
        body: `<ol class="fan-timeline">${f.timeline
          .map((x) => `<li><span>${esc(x.label)}</span><span class="num">${signed(x.delta)}</span><span class="num">${x.score}</span></li>`)
          .join('')}</ol><p class="note">팬심은 지명 반응과 기자회견 약속으로 움직이며, 구단주 평가 점수에는 더하지 않습니다.</p>`,
      };
    },
    reset: () => ({
      title: '새 게임',
      body: `<p>지금 진행 중인 드래프트와 시즌 기록이 지워집니다. 남겨 두려면 먼저 진행 파일을 저장하세요.</p>
        <div class="actions"><button class="btn primary" data-action="confirm-reset">지우고 새로 시작</button><button class="btn quiet" data-action="close-modal">취소</button></div>`,
    }),
    import: () => ({
      title: '진행 파일 불러오기',
      body: `<p>파일을 확인했습니다. 불러오면 지금 진행 중인 게임을 대신합니다.</p>
        <div class="actions"><button class="btn primary" data-action="confirm-import">불러오기</button><button class="btn quiet" data-action="close-modal">취소</button></div>`,
    }),
    catalog: () => ({
      title: `가상 소속 명단 · ${C.catalog.length}개`,
      body: `<p class="note">학교·구단은 모두 가상이며, 평판은 게임 속 야구부 전력입니다.</p>
        <div class="catalog-list">${Object.entries(catalogKinds)
          .map(([kind, label]) => {
            const list = C.catalog.filter((s) => s.kind === kind);
            return `<details><summary>${label} (${list.length})</summary><ul>${list
              .map((s) => `<li>${esc(s.name)}<span>${esc(s.region || s.country)}${s.tier ? ' · ' + esc(s.tier) : s.level ? ' · ' + esc(s.level) : ''}</span></li>`)
              .join('')}</ul></details>`;
          })
          .join('')}</div>`,
    }),
    career: (g, { id }) => ({ title: '선수 경력', body: UI.careerProfile(g, id), wide: true }),
    rules: () => ({ title: '플레이 가이드', body: guide(), wide: true }),
    changelog: () => ({
      title: '업데이트 기록',
      body: `<div class="changelog">${UI.releases()
        .map((r, i) => `<details ${i === 0 ? 'open' : ''}><summary>${UI.esc(r.title)}</summary>${UI.markdown(r.body)}</details>`)
        .join('')}</div>`,
      wide: true,
    }),
  };

  function guide() {
    return `<div class="guide">
      <h3>진행 순서</h3>
      <ol>
        <li>구단·난이도·지역 1차 지명 여부를 고릅니다. 지명 순서는 지난 시즌 성적의 역순이며 매 라운드 같습니다.</li>
        <li>후보 ${C.POOL_SIZE}명: 고졸, 4년제 대졸·얼리, 2년제, 독립구단, 해외 대학, 해외 리그 복귀, 드물게 야구 유학파까지 있습니다. 언론 두 곳의 1라운드 예상과 스카우트 팀장의 추천 3명을 봅니다.</li>
        <li>전국 ${C.ROUND_OPTIONS.join('·')}라운드 중 하나를 골라 지명합니다(지역 1차를 켜면 연고 지역 고졸 1명 추가). 구단마다 국내 4년제·2년제 대학 졸업예정자를 1명 이상 뽑아야 하며, 대학 얼리 참가자는 포함되지 않습니다.</li>
        <li><b>계약 협상</b>: 구단마다 신인 예산이 있습니다. 지명한 선수에게 계약금을 한 번 제시하면, 선수는 받아들이거나 금액을 올려 다시 요구하거나 거부합니다. 진학 희망·해외 구단 관심을 밝힌 선수는 요구액이 높고 거부하기 쉽습니다. 어릴 때 응원한 팀이 지명하면 요구액이 낮고 협상이 잘 풀립니다. 거부한 선수는 대학이나 해외로 떠나고 지명권은 사라집니다.</li>
        <li>남은 예산으로 미지명 선수 중 최대 ${C.tuning.devContracts.max}명과 육성선수 계약(1명 ${UI.won(C.tuning.contracts.devCost)})을 합니다. 육성선수는 첫 시즌에 1군 주전이 될 수 없습니다. 그러고도 남은 돈은 육성 지원금이 되어 첫 ${C.tuning.contracts.growthBoost.seasons}시즌 동안 우리 선수의 성장 속도를 최대 ${Math.round(C.tuning.contracts.growthBoost.max * 100)}% 높입니다.</li>
        <li>단장 기자회견에서 기자 질문 세 개에 답합니다. 첫 지명 선수와 계약 결과에 대한 답, 그리고 약속이 팬심에 반영되고, 약속은 정해진 시즌이 끝난 뒤 평가받습니다.</li>
        <li>${C.ENTRY_YEAR}–${C.ENTRY_YEAR + C.Career.SEASONS - 1} ${C.Career.SEASONS}시즌을 한 해씩 진행합니다. 보직·기록·성장·건강이 다음 해로 이어지고, 2년 차가 끝난 뒤부터 트레이드, 3년 차가 끝난 뒤부터 방출이 생길 수 있습니다. 방출된 선수는 다른 팀에 입단하거나 은퇴합니다. 1군 기회가 오지 않거나 기량이 떨어진 선수는 스스로 은퇴하기도 합니다.</li>
        <li><b>병역</b>: 2년 차부터 비시즌마다 병역을 마치지 않은 우리 선수의 입대를 정할 수 있습니다(구단 판단·상무 지원·현역 입대·미루기). 상무는 퓨처스리그에서 뛰며 성장하고, 현역·사회복무요원은 야구를 쉬어 기량이 조금 떨어집니다. 만 ${C.tuning.service.mustAge}세가 되는 해에는 입대해야 합니다.</li>
        <li><b>국가대표</b>: ${C.tuning.international.map((e) => `${e.year} ${e.name}`).join(', ')}. 선발되어 아시안게임 금메달이나 올림픽 메달을 따면 병역 특례(예술체육요원)를 받습니다.</li>
        <li>${C.Career.SEASONS}시즌이 끝나면 10개 구단의 드래프트를 WAR·주전 배출·기량 발전으로 비교 평가합니다. 중간 평가는 언제든 볼 수 있습니다.</li>
      </ol>
      <h3>능력치 읽는 법 (20–80)</h3>
      <ol>
        <li>모든 공개 능력치는 20–80 척도, 5점 단위입니다. 개별 툴 50이 1군 평균, 80은 최상급입니다.</li>
        <li><b>현재</b>는 지금 기량, <b>미래 가치(FV)</b>는 성장 후 예상 역할, <b>플로어·실링</b>은 나쁘게·잘 풀렸을 때의 전망입니다.</li>
        <li>투수: 구위·커맨드·변화구는 투구 성적, 체력은 소화 이닝에 반영됩니다. 야수: 컨택·장타력·주력·수비와 보조 항목 선구안.</li>
        <li>스카우팅에는 관측 오차가 있고, 고졸일수록 큽니다. 프로에서 뛰는 해가 늘면 평가가 정확해집니다.</li>
        <li>난이도는 조언의 양과 CPU 구단의 판단 방식만 바꿉니다. 선수 능력과 성장은 같습니다. 쉬움 난이도에서만 선수가 어릴 때 응원한 구단이 보입니다(효과 없음).</li>
      </ol>
      <h3>저장</h3>
      <ol>
        <li>진행 상황은 이 브라우저에 자동 저장됩니다. ‘진행 파일 저장’으로 JSON을 받아 다른 기기에서 불러올 수 있습니다.</li>
        <li>진행 파일에는 설정과 지명 같은 선택만 들어 있고, 불러올 때 나머지를 다시 계산합니다. 그래서 파일이 아주 작고, 고쳐도 결과가 바뀌지 않습니다. 게임 규칙이 바뀐 버전에서는 이전 진행 파일을 이어 할 수 없다고 알려 줍니다.</li>
        <li>V0.6 진행 파일만 불러올 수 있습니다. V0.5와는 능력치 체계가 달라 호환되지 않습니다.</li>
      </ol>
      <p class="note">구단명을 뺀 선수·학교·기록·기사는 모두 가상이며, 지역 1차·의무 지명·포스트시즌은 게임용으로 단순화한 규칙입니다. 실제 KBO 규정이나 선수 평가를 재현하지 않습니다.</p>
    </div>`;
  }

  Object.assign(UI, { gameBar, newsCard, dialogs, guide });
})(typeof window !== 'undefined' ? window : globalThis);
