/* App controller: UI state, rendering, event delegation, autosave, JSON import/export and the PNG card. */
(function () {
  'use strict';
  const C = window.DraftCore,
    UI = window.DraftUI;
  const $ = (s) => document.querySelector(s);
  const STORE = 'draft-room-kbo-v6-scouting'; // unchanged since V0.6 so existing saves keep loading
  const STEPS = ['구단 선택', '예상·추천', '드래프트', '입단', '5시즌', '평가'];
  const PHASE_STEP = { preview: 2, scouting: 2, draft: 3, signing: 4, interviews: 4, season: 5, owner: 6 };

  const newSeed = () => Date.now() + '-' + Math.random();
  const defaultView = () => ({ query: '', sort: 'rank', sortDir: 'asc', role: 'ALL', pathway: 'ALL', tier: 'ALL', pickType: 'ALL', onlyStars: false });

  const state = {
    game: null,
    setup: { selectedTeam: 'kiwoom', difficulty: 'normal', local: false, rounds: C.ROUNDS, seed: newSeed() },
    dev: { chosen: new Set(), role: 'ALL' }, // development-contract picks before they are confirmed
    view: defaultView(), // draft-board filters
    selected: null, // player shown in the draft profile
    stars: new Set(),
    recordsOpen: false,
    records: { team: 'ALL', scope: 'origin', year: 'all', level: 'stats', sort: 'rank' },
    yearIndex: 0,
    modal: null,
    storageOK: true,
    notice: null, // shown above the setup screen, e.g. when an old save could not be continued
  };
  let lastFocus = null,
    toastTimer = null,
    lastAdvance = 0;

  // ---------- persistence ----------
  function adopt(game, stars = []) {
    state.game = game;
    Object.assign(state.setup, { selectedTeam: game.teamId, local: game.local, difficulty: game.difficulty, rounds: game.rounds });
    state.dev = { chosen: new Set(), role: 'ALL' };
    state.stars = new Set(stars.filter((id) => typeof id === 'string' && C.getPlayer(game, id)));
    state.yearIndex = (game.career?.years.length || 1) - 1;
    if (game.phase === 'draft') C.advanceToUser(game);
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) {
      if (Object.hasOwn(C.rules.DIFFICULTIES, saved.difficulty)) state.setup.difficulty = saved.difficulty;
      if (Object.hasOwn(C.teamById, saved.selectedTeam)) state.setup.selectedTeam = saved.selectedTeam;
      state.setup.local = saved.local === true;
      if (C.ROUND_OPTIONS.includes(saved.rounds)) state.setup.rounds = saved.rounds;
      const stored = saved.save ?? saved.game; // `game` is the v0.6.0 layout
      const loaded = stored ? C.loadSave(stored) : {};
      if (loaded.game) adopt(loaded.game, Array.isArray(saved.stars) ? saved.stars : []);
      else if (loaded.error === 'sim') {
        // Keep the old save instead of overwriting it with the next autosave.
        localStorage.setItem(`${STORE}-sim-${loaded.sim}`, JSON.stringify(saved));
        state.notice = `이전 규칙(v${loaded.sim})으로 진행하던 게임은 이 버전에서 이어 할 수 없어 따로 보관했습니다. 새 게임을 시작해 주세요.`;
      }
    }
    localStorage.setItem(STORE + '-check', '1');
    localStorage.removeItem(STORE + '-check');
  } catch (e) {
    state.storageOK = false;
  }
  function save() {
    const { selectedTeam, local, difficulty, rounds } = state.setup;
    try {
      const save = state.game ? C.toSave(state.game) : null;
      localStorage.setItem(STORE, JSON.stringify({ selectedTeam, local, difficulty, rounds, save, stars: [...state.stars] }));
    } catch (e) {
      state.storageOK = false;
    }
  }

  // ---------- rendering ----------
  const g = () => state.game;
  const team = () => (g() ? C.teamFor(g()) : { ...C.teamById[state.setup.selectedTeam], ...C.scouting.plans(state.setup.seed, C.TEAMS)[state.setup.selectedTeam] });
  const step = () => (g() ? PHASE_STEP[g().phase] : 1);

  function ensureSelection() {
    if (!g() || g().phase !== 'draft') return;
    const list = UI.filterPlayers(g(), state.view, state.stars, team());
    if (!C.available(g()).some((p) => p.id === state.selected)) state.selected = list[0]?.id || C.available(g())[0]?.id || null;
  }

  function screen() {
    const game = g();
    if (!game) return UI.setup(state.setup, team());
    if (state.recordsOpen) return UI.room(game, state.records);
    switch (game.phase) {
      case 'preview': return UI.forecasts(game);
      case 'scouting': return UI.briefing(game);
      case 'draft': return UI.board(game, state.view, state.stars, state.selected);
      case 'signing': return UI.signing(game, state.dev.chosen, state.dev.role);
      case 'interviews': return UI.interviews(game);
      case 'season': return UI.season(game, state.yearIndex);
      default: return UI.review(game);
    }
  }

  function render() {
    ensureSelection();
    document.documentElement.style.setProperty('--club', team().color);
    const now = step();
    $('#steps').innerHTML = STEPS.map(
      (name, i) => `<li class="${now === i + 1 ? 'now' : now > i + 1 ? 'done' : ''}" ${now === i + 1 ? 'aria-current="step"' : ''}><b>${i + 1}</b>${name}</li>`,
    ).join('');
    $('#reset-game').hidden = !g();
    if (g()) state.notice = null;
    $('#main').innerHTML = (state.notice ? `<p class="callout">${UI.esc(state.notice)}</p>` : '') + (g() ? UI.gameBar(g()) : '') + screen();
    $('#storage-status').textContent = state.storageOK ? '진행 상황은 이 브라우저에 자동 저장됩니다.' : '이 환경에서는 자동 저장을 쓸 수 없습니다. 진행 파일 저장을 이용하세요.';
    save();
  }

  /** Re-renders only the candidate list and profile (keeps focus and scroll while filtering). */
  function refreshBoard() {
    const roster = $('#roster');
    if (!roster) return render();
    ensureSelection();
    const t = team(),
      list = UI.filterPlayers(g(), state.view, state.stars, t),
      y = roster.scrollTop;
    roster.innerHTML = UI.rows(g(), list, state.view, state.stars, t, state.selected);
    roster.scrollTop = y;
    $('#candidate-count').textContent = list.length + '명';
    $('#profile').innerHTML = UI.profile(g(), state.selected && C.getPlayer(g(), state.selected), state.stars, t);
    for (const b of document.querySelectorAll('[data-action=role],[data-action=pick-type]'))
      b.setAttribute('aria-pressed', String(b.dataset.id === state.view[b.dataset.action === 'role' ? 'role' : 'pickType']));
    document.querySelector('[data-action=only-stars]')?.setAttribute('aria-pressed', String(state.view.onlyStars));
    const dir = document.querySelector('[data-action=sort-direction]');
    if (dir) dir.textContent = state.view.sortDir === 'asc' ? '오름차순' : '내림차순';
    save();
  }

  function notify(text) {
    clearTimeout(toastTimer);
    $('#toast').textContent = text;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => ($('#toast').hidden = true), 3200);
  }
  function toTop() {
    try {
      window.scrollTo({ top: 0 });
    } catch (e) {}
  }

  // ---------- modal ----------
  function showModal(kind, data = {}) {
    lastFocus = document.activeElement;
    state.modal = { kind, ...data };
    const { title, body, wide } = UI.dialogs[kind](g(), data);
    $('#modal-root').innerHTML = `<div class="overlay" data-action="overlay-close"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head"><h2 id="modal-title">${title}</h2><button class="btn quiet small" data-action="close-modal">닫기</button></div>
      <div class="modal-body">${body}</div></section></div>`;
    for (const id of ['#main', '#page-header', '#page-footer']) $(id).inert = true;
    ($('.modal-body .btn.primary') || $('.modal button'))?.focus();
  }
  function closeModal() {
    state.modal = null;
    $('#modal-root').innerHTML = '';
    for (const id of ['#main', '#page-header', '#page-footer']) $(id).inert = false;
    if (lastFocus?.isConnected) lastFocus.focus();
  }

  // ---------- files ----------
  function download(name, href) {
    const a = document.createElement('a');
    a.download = name;
    a.href = href;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function exportSave() {
    if (!g()) return;
    const blob = new Blob([JSON.stringify({ ...C.toSave(g()), stars: [...state.stars] }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    download(`draft-room-${g().teamId}-${g().career?.years.at(-1)?.year || 'draft'}.json`, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('진행 파일을 내려받았습니다.');
  }
  async function importSave(file) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw Error('too large');
      const data = JSON.parse(await file.text());
      const loaded = C.loadSave(data);
      if (loaded.error === 'sim') return notify(`이전 규칙(v${loaded.sim})으로 만든 진행 파일이라 이 버전에서는 이어 할 수 없습니다.`);
      if (!loaded.game) throw Error('invalid');
      showModal('import', { game: loaded.game, stars: Array.isArray(data.stars) ? data.stars : [] });
    } catch (err) {
      notify('불러올 수 없는 파일입니다. 드래프트 룸 진행 파일(JSON)인지 확인해 주세요.');
    } finally {
      $('#import-file').value = '';
    }
  }

  /** First-season summary card as a PNG. */
  function downloadCard() {
    const game = g(),
      t = team(),
      o = game.owner;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 380 + game.season.length * 150;
    const x = canvas.getContext('2d');
    if (!x) return notify('이 브라우저는 이미지 저장을 지원하지 않습니다.');
    const font = "'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
    const text = (s, left, top, size, color = '#1c1c1a', weight = 700) => {
      x.fillStyle = color;
      x.font = `${weight} ${size}px ${font}`;
      x.fillText(s, left, top, 960);
    };
    x.fillStyle = '#f4f2ec';
    x.fillRect(0, 0, canvas.width, canvas.height);
    x.fillStyle = t.color;
    x.fillRect(0, 0, canvas.width, 14);
    text(`${t.name} · ${C.ENTRY_YEAR} 신인 드래프트`, 60, 90, 44);
    text(`${C.rules.DIFFICULTIES[game.difficulty].name} · 지역 1차 ${game.local ? '있음' : '없음'} · 팬심 ${C.fanState(game).score}`, 60, 136, 24, '#6f6d66', 500);
    text(`첫해 평가 ${o.grade} (${o.score}점)`, 60, 210, 36, t.color);
    text(`보강 ${o.needScore} · 첫해 계획 ${o.production} · 미래 가치 ${o.future} · 약속 ${UI.signed(o.pledge.bonus)}`, 60, 254, 22, '#45443f', 500);
    x.fillStyle = '#1c1c1a';
    x.fillRect(60, 290, 960, 2);
    let y = 340;
    for (const s of game.season) {
      const p = C.getPlayer(game, s.playerId),
        v = s.stats;
      text(`${s.label}  ${p.name}  ${C.ROLES[p.role]} · ${s.routeLabel}`, 60, y, 28);
      const line = !v.games
        ? `1군 출전 없음 · 퓨처스 ${s.futures.games}경기`
        : v.kind === 'pitcher'
          ? `1군 ${v.games}경기 ${C.innings(v.outs)}이닝 ERA ${v.era.toFixed(2)} · ${v.wins}승`
          : `1군 ${v.games}경기 타율 ${UI.rate(v.avg)} OPS ${UI.rate(v.ops)} · ${v.hr}홈런`;
      text(`${line} · ${s.growthLabel} · 계획 이행 ${s.planScore}`, 60, y + 40, 22, '#45443f', 500);
      x.fillStyle = '#d8d4c8';
      x.fillRect(60, y + 70, 960, 1);
      y += 150;
    }
    text('드래프트 룸 · 가상 선수와 기록을 사용한 팬메이드 게임', 60, canvas.height - 40, 18, '#6f6d66', 500);
    try {
      download(`draft-room-first-year-${t.id}-${o.grade}.png`, canvas.toDataURL('image/png'));
      notify('결과 이미지를 내려받았습니다.');
    } catch (e) {
      notify('이 환경에서는 이미지를 저장할 수 없습니다.');
    }
  }

  // ---------- events ----------
  const actions = {
    'import-save': () => $('#import-file').click(),
    'export-save': exportSave,
    'confirm-import': () => {
      if (!state.modal?.game) return;
      const { game, stars } = state.modal;
      closeModal();
      adopt(game, stars);
      Object.assign(state, { recordsOpen: false, selected: null, view: defaultView() });
      render();
      toTop();
      notify('진행 파일을 불러왔습니다.');
    },
    records: () => ((state.recordsOpen = true), render(), toTop()),
    'team-records': (id) => (Object.assign(state.records, { team: id, scope: 'origin' }), actions.records()),
    'records-close': () => ((state.recordsOpen = false), render(), toTop()),
    'career-player': (id) => showModal('career', { id }),
    'view-year': (_, btn) => ((state.yearIndex = Number(btn.dataset.index)), render(), toTop()),
    'next-season': () => {
      if (Date.now() - lastAdvance < 900) return; // guards against double taps
      lastAdvance = Date.now();
      C.nextSeason(g());
      state.yearIndex = g().career.years.length - 1;
      state.recordsOpen = false;
      render();
      toTop();
    },
    team: (id) => ((state.setup.selectedTeam = id), render()),
    difficulty: (id) => {
      if (g()) return;
      state.setup.difficulty = id;
      render();
      document.querySelector(`[data-action="difficulty"][data-id="${id}"]`)?.focus();
    },
    start: () => {
      const { selectedTeam, local, seed, difficulty, rounds } = state.setup;
      Object.assign(state, { recordsOpen: false, yearIndex: 0, selected: null, view: defaultView(), stars: new Set() });
      lastAdvance = 0;
      state.game = C.createGame(selectedTeam, local, seed, difficulty, rounds);
      state.dev = { chosen: new Set(), role: 'ALL' };
      render();
      toTop();
    },
    rounds: (id) => {
      if (g()) return;
      state.setup.rounds = Number(id);
      render();
      document.querySelector(`[data-action="rounds"][data-id="${id}"]`)?.focus();
    },
    'dev-toggle': (id) => {
      const c = state.dev.chosen;
      if (c.has(id)) c.delete(id);
      else if (c.size < C.tuning.devContracts.max) c.add(id);
      render();
    },
    'dev-role': (id) => ((state.dev.role = id), render()),
    'dev-confirm': () => {
      C.signDevelopment(g(), [...state.dev.chosen]);
      state.dev = { chosen: new Set(), role: 'ALL' };
      render();
      toTop();
    },
    'scout-briefing': () => (C.openScouting(g()), render(), toTop()),
    'begin-draft': () => (C.beginDraft(g()), C.advanceToUser(g()), render(), toTop()),
    'scout-archive': () => showModal('scout'),
    'mock-archive': () => showModal('mock'),
    'news-room': () => showModal('news'),
    'fan-history': () => showModal('fans'),
    'gm-choice': (id) => {
      C.chooseGM(g(), id);
      render();
      document.querySelector('.gm-section')?.scrollIntoView({ block: 'start' });
    },
    'sort-direction': () => ((state.view.sortDir = state.view.sortDir === 'asc' ? 'desc' : 'asc'), refreshBoard()),
    'pick-type': (id) => ((state.view.pickType = id), refreshBoard()),
    role: (id) => ((state.view.role = id), refreshBoard()),
    'only-stars': () => ((state.view.onlyStars = !state.view.onlyStars), refreshBoard()),
    'clear-filters': () => ((state.view = defaultView()), render()),
    player: (id) => {
      state.selected = id;
      refreshBoard();
      if (window.innerWidth <= 960) $('#profile')?.scrollIntoView({ block: 'start' });
    },
    star: (id) => (state.stars.has(id) ? state.stars.delete(id) : state.stars.add(id), refreshBoard()),
    pick: (id) => g()?.phase === 'draft' && showModal('confirm', { id }),
    'confirm-pick': (id) => {
      if (state.modal?.kind !== 'confirm' || g()?.phase !== 'draft') return;
      closeModal();
      const selection = C.addPick(g(), id),
        name = C.getPlayer(g(), id).name;
      C.advanceToUser(g());
      state.selected = null;
      state.view = { ...defaultView(), sort: state.view.sort, sortDir: state.view.sortDir };
      render();
      toTop();
      if (selection.round <= 1) showModal('interview', { selection });
      else notify(`${name} 지명 완료`);
    },
    simulate: () => {
      C.runSeason(g());
      state.yearIndex = g().career.years.length - 1;
      state.recordsOpen = false;
      render();
      toTop();
    },
    owner: () => ((g().phase = 'owner'), (state.recordsOpen = false), render(), toTop()),
    season: () => ((g().phase = 'season'), (state.recordsOpen = false), render(), toTop()),
    interviews: () => ((g().phase = 'interviews'), render(), toTop()),
    rules: () => showModal('rules'),
    catalog: () => showModal('catalog'),
    reset: () => showModal('reset'),
    'confirm-reset': () => {
      closeModal();
      Object.assign(state, { game: null, recordsOpen: false, yearIndex: 0, selected: null, view: defaultView(), stars: new Set() });
      state.setup.seed = newSeed();
      render();
      toTop();
    },
    'close-modal': closeModal,
    'overlay-close': (_, btn, e) => e.target === btn && closeModal(),
    download: downloadCard,
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const fn = actions[btn.dataset.action];
    if (!fn) return;
    try {
      fn(btn.dataset.id, btn, e);
    } catch (err) {
      console.error(err);
      notify('처리 중 문제가 생겼습니다. 다시 시도해 주세요.');
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'search') {
      state.view.query = e.target.value;
      refreshBoard();
    }
  });
  document.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'import-file') return importSave(e.target.files[0]);
    if (id.startsWith('record-')) {
      state.records[id.slice(7)] = e.target.value;
      return render();
    }
    if (id === 'local-toggle') {
      state.setup.local = e.target.checked;
      render();
      return $('#local-toggle')?.focus();
    }
    if (id === 'sort') {
      state.view.sort = e.target.value;
      state.view.sortDir = C.rules.SORTS[state.view.sort].direction;
    }
    if (id === 'pathway') state.view.pathway = e.target.value;
    if (id === 'tier') state.view.tier = e.target.value;
    if (['sort', 'pathway', 'tier'].includes(id)) refreshBoard();
  });
  document.addEventListener('keydown', (e) => {
    if (!state.modal) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
    if (e.key === 'Tab') {
      const els = [...document.querySelectorAll('.modal button,.modal input,.modal select,.modal summary,.modal [tabindex="0"]')].filter((x) => !x.disabled);
      const first = els[0],
        last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  render();
})();
