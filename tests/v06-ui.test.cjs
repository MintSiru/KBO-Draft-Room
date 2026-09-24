const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function boot(){const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(html,{url:'https://draftroom.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};}});return {dom,w:dom.window,d:dom.window.document,errors};}
const action=(d,name,id)=>{const b=d.querySelector(`[data-action="${name}"]${id?`[data-id="${id}"]`:''}`);assert(b,`${name} button`);b.click();};
test('DOM: new guide and all catalog groups open with no undefined names',()=>{const {dom,d,errors}=boot();try{assert.match(d.title,/v0\.8/);action(d,'rules');assert.match(d.querySelector('.modal-body').textContent,/20–80/);assert.match(d.querySelector('.modal-body').textContent,/V0.5.*호환/);action(d,'close-modal');action(d,'catalog');assert.equal(d.querySelectorAll('.catalog-list details').length,9);assert(!d.querySelector('.modal-body').textContent.includes('undefined'));assert.match(d.querySelector('#modal-title').textContent,/243/);assert.deepEqual(errors,[]);}finally{dom.window.close();}});
test('DOM: scouting phase persists, recommends three candidates, profile shows public tools and filters',()=>{const {dom,w,d,errors}=boot();try{action(d,'start');action(d,'scout-briefing');assert.equal(d.querySelectorAll('.recommendation').length,3);assert.equal(JSON.parse(w.localStorage.getItem('draft-room-kbo-v6-scouting')).save.phase,'scouting');action(d,'begin-draft');assert.equal(d.querySelectorAll('.tool-grade-table tbody tr').length,4);assert.equal(d.querySelectorAll('.favorite-note').length,0);for(const type of ['즉전감','실링','플로어']){action(d,'pick-type',type);const g=JSON.parse(w.localStorage.getItem('draft-room-kbo-v6-scouting')).save;for(const row of d.querySelectorAll('.player-row'))assert(w.DraftCore.getPlayer(g,row.dataset.id).pickTags.includes(type));}action(d,'pick-type','ALL');const sel=d.querySelector('#pathway');sel.value='마이너 복귀';sel.dispatchEvent(new w.Event('change',{bubbles:true}));assert(d.querySelectorAll('.player-row').length>0);d.querySelector('.player-row').click();assert.match(d.querySelector('.profile-body').textContent,/국내 프로 미입단자/);assert.match(d.querySelector('.profile-body').textContent,/AA|AAA|A/);assert.deepEqual(errors,[]);}finally{dom.window.close();}});
test('DOM: easy-only favorite team and complete mobile-friendly grade markup',()=>{const {dom,w,d,errors}=boot();try{action(d,'difficulty','easy');action(d,'start');action(d,'scout-briefing');action(d,'begin-draft');assert.equal(d.querySelectorAll('.favorite-note').length,1);const g=JSON.parse(w.localStorage.getItem('draft-room-kbo-v6-scouting')).save,p=w.DraftCore.getPlayer(g,d.querySelector('[data-action=pick]').dataset.id);const rows=[...d.querySelectorAll('.tool-grade-table tbody tr')];assert.equal(rows.length,4);w.DraftCore.grades.keys(p.role).forEach((k,i)=>assert.equal(+rows[i].querySelector('td b').textContent,p.tools[k]));assert(d.querySelector('#steps [aria-current=step]'));assert(!d.querySelector('.tool-estimates').textContent.includes('100점'));assert.deepEqual(errors,[]);}finally{dom.window.close();}});
test('renderers only expose public current tools and preserve original scouting snapshot',()=>{const {dom,w,d,errors}=boot();try{const C=w.DraftCore,g=C.createGame('lg',true,'render06');C.openScouting(g);C.beginDraft(g);while(g.phase==='draft')C.addPick(g,C.aiChoice(g).id);C.signDevelopment(g,C.undrafted(g).slice(0,2).map(p=>p.id));C.chooseGM(g,'development');C.runSeason(g);C.nextSeason(g);const sel=g.picks[0],state=g.career.players[sel.playerId],before=JSON.stringify(g),content=w.DraftUI.careerProfile(g,sel.playerId);assert.match(content,/20–80/);assert.match(content,/시즌 종료 세부 기량/);assert(!/undefined|NaN/.test(content));assert(!content.includes('trueTools')&&!content.includes('potentialTools'));assert.equal(JSON.stringify(g),before);d.querySelector('#main').innerHTML=w.DraftUI.season(g,1);assert.equal(d.querySelectorAll('.development-grid article').length,C.mySigned(g).length);assert(!/undefined|NaN/.test(d.querySelector('#main').textContent));assert.deepEqual(errors,[]);}finally{dom.window.close();}});

test('DOM: a save from another simulation version is kept aside, not overwritten', () => {
  const KEY = 'draft-room-kbo-v6-scouting';
  const old = { selectedTeam: 'kia', local: false, difficulty: 'hard', save: { format: 'draft-room-save', version: 2, sim: '0.5', teamId: 'kia', local: false, seed: 's', difficulty: 'hard', phase: 'season', picks: [], gmChoice: 'needs', seasons: 2 }, stars: [] };
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'https://draftroom.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.scrollTo = () => {}; w.localStorage.setItem(KEY, JSON.stringify(old)); } });
  try {
    const w = dom.window, d = w.document;
    assert.match(d.querySelector('#main .callout').textContent, /v0\.5/);
    assert.deepEqual(JSON.parse(w.localStorage.getItem(KEY + '-sim-0.5')), old);
    assert.equal(JSON.parse(w.localStorage.getItem(KEY)).save, null); // back on the setup screen
    assert.equal(d.querySelector('[data-action=start]') !== null, true);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test('DOM: ten seasons with service choices, records and review render cleanly', () => {
  const { dom, w, d, errors } = boot();
  const clean = (where) => assert(!/undefined|NaN|\[object/.test(d.querySelector('#main').textContent), where);
  try {
    const C = w.DraftCore;
    action(d, 'start');
    action(d, 'scout-briefing');
    action(d, 'begin-draft');
    const g = () => C.loadSave(JSON.parse(w.localStorage.getItem('draft-room-kbo-v6-scouting')).save).game;
    // Draft through the app: always take the first candidate on the board.
    for (let guard = 0; d.querySelector('[data-action=pick]') && guard < 20; guard++) {
      action(d, 'pick', d.querySelector('[data-action=pick]').dataset.id);
      action(d, 'confirm-pick', d.querySelector('[data-action=confirm-pick]').dataset.id);
      if (d.querySelector('[data-action=close-modal]')) action(d, 'close-modal');
    }
    action(d, 'dev-confirm');
    action(d, 'gm-choice', 'development');
    action(d, 'simulate');
    clean('first season');
    let chose = 0;
    w.Date.now = ((t) => () => (t += 1000))(Date.now()); // step past the double-tap guard
    for (let n = 1; n < C.Career.SEASONS; n++) {
      const select = d.querySelector('select[data-service]');
      if (select && !chose) {
        select.value = 'army';
        select.dispatchEvent(new w.Event('change', { bubbles: true }));
        chose = 1;
      }
      action(d, 'next-season');
      clean('season ' + (n + 1));
    }
    const game = g();
    assert.equal(game.career.years.length, C.Career.SEASONS);
    assert.equal(game.serviceOrders.length, chose);
    assert(d.querySelector('[data-action=owner]'));
    action(d, 'owner');
    clean('review');
    assert.match(d.querySelector('#main').textContent, /WAR/);
    action(d, 'records');
    const sort = d.querySelector('#record-sort');
    sort.value = 'war';
    sort.dispatchEvent(new w.Event('change', { bubbles: true }));
    clean('records');
    assert.equal(d.querySelectorAll('.record-table tbody tr').length, C.signed(game).length);
    // A player who served: the profile shows the service season.
    const served = game.career.events.find((e) => e.type === 'enlist');
    assert(served);
    action(d, 'career-player', served.playerIds[0]);
    assert.match(d.querySelector('.modal-body').textContent, /복무|상무|사회복무/);
    assert(!/undefined|NaN/.test(d.querySelector('.modal-body').textContent));
    action(d, 'close-modal');
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
