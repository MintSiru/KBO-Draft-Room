const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core/engine.js'),D=require('../src/core/prospects.js'),M=require('../src/core/season.js'),S=require('../src/core/scouting.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function draft(seed='unit06',team='lg',local=true,difficulty='normal'){const g=C.createGame(team,local,seed,difficulty);C.openScouting(g);C.beginDraft(g);while(g.phase==='draft')C.addPick(g,C.aiChoice(g).id);C.signAll(g);C.signDevelopment(g,C.undrafted(g).slice(3,3+Math.min(2,Math.floor(C.budgetLeft(g)/C.tuning.contracts.devCost))).map(p=>p.id));C.chooseGM(g,'development');return g;}
function finish(g){C.runSeason(g);while(g.career.years.length<C.Career.SEASONS)C.nextSeason(g);return g;}
function checkStats(s){assert(s.games>=0);if(s.kind==='pitcher'){assert(s.k<=s.outs);assert(s.qs<=s.gs&&s.gs<=s.games);assert(s.wins+s.holds+s.saves<=s.games);assert.equal(s.era,s.outs?D.round(s.er*27/s.outs,2):null);}else{assert(s.hr+s.doubles+s.triples<=s.hits&&s.hits<=s.ab);assert(s.k<=s.ab-s.hits);assert.equal(s.pa,s.ab+s.bb);assert.equal(s.avg,s.ab?D.round(s.hits/s.ab,3):null);assert.equal(s.ops,s.ab?D.round((s.hits+s.bb)/s.pa+(s.hits+s.doubles+2*s.triples+3*s.hr)/s.ab,3):null);}}
test('V6 namespace, strict phase order, round options and schedule sizes',()=>{const g=C.createGame('lg',true,'phase');assert.equal(C.VERSION,6);assert.equal(g.rounds,11);assert.equal(g.schedule.length,120);assert.equal(C.makeSchedule(false).length,110);assert.equal(C.createGame('lg',false,'r5','normal',5).schedule.length,50);assert.equal(C.createGame('lg',true,'r8','normal',8).schedule.length,90);assert.throws(()=>C.createGame('lg',false,'r7','normal',7));assert.throws(()=>C.beginDraft(g));assert(C.validate(g));C.openScouting(g);assert(C.validate(g));C.beginDraft(g);assert(C.validate(g));assert.throws(()=>C.openScouting(g));});
test('400 candidates: composition, quota supply and rare pathways',()=>{for(let i=0;i<20;i++){const p=D.generatePool('pool07-'+i).players;const n=(f)=>p.filter(f).length;assert.equal(p.length,400);assert.equal(n(p=>p.quotaEligible),80);assert.equal(n(p=>p.pathway==='대졸'),56);assert.equal(n(p=>p.pathway==='2년제'),24);assert.equal(n(p=>p.pathway==='고졸')+n(p=>p.pathway==='야구 유학'),264);assert(n(p=>p.pathway==='야구 유학')<=1);assert.equal(n(p=>p.entryCategory==='overseas-return'),14);assert.equal(n(p=>p.pathway==='대학 얼리'),24);assert(n(p=>['MLB 경험 복귀','해외리그 복귀'].includes(p.pathway))<=1);for(const region of D.REGIONS)assert.equal(n(p=>['고졸','야구 유학'].includes(p.pathway)&&p.region===region),33);}});
test('all public ability grades use 20–80 by fives; FV differs from ceiling',()=>{const p=D.generatePool('grades06').players;for(const x of p){for(const n of [x.ready,x.scoutCeiling,x.floorGrade,x.ceilingGrade,...Object.values(x.tools),...Object.values(x.futureTools)])assert(Number.isInteger(n)&&n>=20&&n<=80&&n%5===0);assert(x.floorGrade<=x.scoutCeiling&&x.scoutCeiling<=x.ceilingGrade);for(const k of Object.keys(x.trueTools))assert(x.trueTools[k]<=x.potentialTools[k]);}assert(p.some(x=>x.ceilingGrade>x.scoutCeiling));assert(p.filter(x=>x.scoutCeiling>=60).length<25);assert(p.some(x=>x.pickTags.length>1));});
test('domestic/overseas biographies and catalog preserve chronology and eligibility',()=>{assert.equal(C.catalog.length,243);assert.equal(new Set(C.catalog.map(x=>x.id)).size,243);assert.equal(new Set(C.catalog.map(x=>x.name)).size,243);for(let i=0;i<10;i++)for(const p of D.generatePool('bio06-'+i).players){assert.equal(D.bio.ageAt(p.birthday),p.age);for(let n=0;n<p.history.length;n++){const h=p.history[n];assert(!h.end||h.start<h.end);if(n)assert(p.history[n-1].end<=h.start);}if(p.proExperience){assert.equal(p.proExperience.domesticPro,false);assert(!p.quotaEligible&&!p.regionalEligible);assert(p.history.at(-1).end<C.DRAFT_DATE);assert.equal(p.proExperience.level,p.currentInstitution.level);}if(p.pathway==='대학 얼리'){assert.equal(p.collegeYear,2);assert(!p.quotaEligible);}if(p.pathway==='2년제'){assert.equal(p.collegeYear,2);assert(p.quotaEligible);assert.equal(p.currentInstitution.kind,'college2');assert.equal(p.age,p.history.length&&D.bio.ageAt(p.birthday));}if(p.pathway==='야구 유학'){assert(!p.regionalEligible&&!p.quotaEligible);assert.equal(p.currentInstitution.kind,'overseas-hs');}}});
test('AI, media and recommendations cannot read hidden talent or preferences',()=>{const g=C.createGame('lg',true,'public06');const forbidden=new Set(['trueTools','potentialTools','trueReady','upside','growthCurve','developmentRate','observerBias','favoriteTeam','lateDevelopment']);const safe=C.poolFor(g).players.map(p=>C.rules.project(new Proxy(p,{get(target,key){if(forbidden.has(key))throw Error('Hidden read: '+key);return target[key];}})));const t=C.teamFor(g);assert.equal(S.recommend(safe,t,true).candidates.length,3);assert(C.rules.aiScores(safe,t,[],'hard','audit').length);assert(C.press.forecast(safe,C.TEAMS.map(t=>C.teamFor(g,t.id)),true,'audit').length);for(const p of safe)for(const key of forbidden)assert(!Object.hasOwn(p,key));});
test('club plans vary by seed, reproduce exactly and respect positions',()=>{const a=S.plans('clubA',C.TEAMS),b=S.plans('clubB',C.TEAMS);assert.deepEqual(a,S.plans('clubA',C.TEAMS));assert.notDeepEqual(a,b);for(const t of C.TEAMS){assert.deepEqual(a[t.id].detailedNeeds.map(n=>n.role),t.needs);assert(S.STYLES[a[t.id].staff.style]);}});
test('same seed and player talent are independent of difficulty and chosen club',()=>{const a=C.createGame('lg',false,'equal06','easy'),pa=clone(C.poolFor(a).players),b=C.createGame('kia',true,'equal06','hard');assert.deepEqual(C.poolFor(b).players,pa);assert.deepEqual(a.clubPlans,b.clubPlans);const p=pa[0],s={round:1,label:'1R',teamId:'lg'};assert.deepEqual(C.simulatePlayer(p,s,a),C.simulatePlayer(p,s,{...a,difficulty:'hard'}));});
test('quota last-pick and global-supply safeguards survive adversarial selection',()=>{for(const local of [true,false]){const g=C.createGame('lg',local,'adversarial06');C.openScouting(g);C.beginDraft(g);while(g.phase==='draft'){const slot=g.schedule[g.cursor],list=C.available(g);assert(list.length);const q=C.quotaStatus(g,slot.teamId);if(slot.round>0&&q.missing&&q.remaining===1)assert(list.every(p=>p.quotaEligible));const p=slot.teamId==='lg'?(list.find(p=>!p.quotaEligible)||list[0]):(list.find(p=>p.quotaEligible)||list[0]);C.addPick(g,p.id);}for(const t of C.TEAMS)assert(C.quotaStatus(g,t.id).count>=1);}});
test('regional and recommendation candidates are eligible, unique, and immutable',()=>{const g=C.createGame('lg',true,'local06'),original=clone(g.scoutReport),forecast=clone(g.forecasts);for(const r of g.scoutReport.candidates)assert(C.eligible(C.getPlayer(g,r.playerId),C.teamFor(g)));C.openScouting(g);C.beginDraft(g);while(g.phase==='draft'){const p=C.aiChoice(g),slot=g.schedule[g.cursor];if(slot.round===0)assert(C.eligible(p,C.teamFor(g,slot.teamId)));C.addPick(g,p.id);}assert.deepEqual(g.scoutReport,original);assert.deepEqual(g.forecasts,forecast);});
test('all 60 club × local × difficulty combinations finish and replay every phase/year',()=>{for(const t of C.TEAMS)for(const local of [false,true])for(const diff of ['easy','normal','hard']){const g=draft('flow06-'+t.id+'-'+local+'-'+diff,t.id,local,diff);assert(C.validate(g));const p=clone(C.poolFor(g).players),news=clone(g.news),forecast=clone(g.forecasts);C.runSeason(g);const first=clone(g.season),owner=clone(g.owner),fans=clone(C.fanState(g).timeline);for(let n=1;n<=C.Career.SEASONS;n++){if(n===1||n===C.Career.SEASONS||(t.id==='lg'&&!local))assert(C.validate(clone(g)));assert.equal(g.career.years.length,n);if(n<C.Career.SEASONS)C.nextSeason(g);}assert.throws(()=>C.nextSeason(g));assert.deepEqual(g.season,first);assert.deepEqual(g.owner,owner);assert.deepEqual(C.fanState(g).timeline.slice(0,fans.length-1),fans.slice(0,-1));assert.equal(C.fanState(g).timeline.length,fans.length+C.Career.SEASONS-1);assert.deepEqual(g.news,news);assert.deepEqual(g.forecasts,forecast);assert.deepEqual(C.poolFor(g).players,p);for(const club of C.TEAMS)assert(C.quotaStatus(g,club.id).count>=1);assert.equal(C.careerReview(g).length,10);}});
test('counting stats, cumulative rates, team schedules and season affiliations reconcile',()=>{const g=finish(draft('records06'));for(const y of g.career.years){assert.equal(y.records.length,C.signed(g).length);assert.equal(y.league.table.reduce((n,x)=>n+x.wins,0),720);for(const t of y.league.table)assert.equal(t.wins+t.losses,144);for(const r of y.records){checkStats(r.stats);checkStats(r.futures);if(r.stats.kind==='hitter')assert(r.stats.games+r.futures.games<=144);}for(const a of y.awards){const rec=y.records.find(r=>r.playerId===a.playerId);assert.equal(a.teamId,rec.teamId);if(a.scope!=='national')assert(rec.stats.games>0);}}for(const s of C.signedPicks(g)){const h=C.Career.history(g.career,s.playerId);for(const key of ['stats','futures']){const total=C.Career.totalStats(h,key);checkStats(total);assert.equal(total.games,h.reduce((n,r)=>n+r[key].games,0));}const out=r=>['released','retired'].includes(r.route);for(let i=1;i<h.length;i++)if(!out(h[i])&&!out(h[i-1]))assert.equal(h[i].startGrade,h[i-1].scoutReady);}});
test('healthy established players do not randomly disappear into the futures',()=>{const g=C.createGame('lg',false,'retention06'),p=C.poolFor(g).players.find(p=>p.role==='SP'),sel={label:'1R',round:1},tools=Object.fromEntries(Object.keys(p.trueTools).map(k=>[k,52]));let healthy=0,retained=0;for(let i=0;i<1000;i++){const rec=M.simulatePlayer({...p,trueTools:tools,potentialTools:Object.fromEntries(Object.keys(tools).map(k=>[k,60]))},sel,{seed:'retention-'+i},C.teamFor(g),90,{tools,route:'regular',scoutReady:50,publicTools:tools,performance:.3},2);if(!rec.limited){healthy++;retained+=rec.route==='regular';assert(rec.stats.games>0);assert.notEqual(rec.route,'futures');}}assert(retained/healthy>.8&&retained/healthy<.99);});
test('tool interventions affect relevant statistics without using overall-point shortcuts',()=>{const r=seed=>D.rng(seed),p={role:'OF'},base={contact:50,power:50,speed:50,defense:50,eye:50};const sum=(kind,key,delta,stat)=>{let s=0;for(let i=0;i<400;i++){const tools={...kind};tools[key]+=delta;s+=M.statsFor(p,130,tools,'regular',r('tool-'+i))[stat];}return s;};assert(sum(base,'power',15,'hr')>sum(base,'power',-10,'hr')*2);assert(sum(base,'contact',15,'hits')>sum(base,'contact',-10,'hits'));assert(sum(base,'speed',15,'sb')>sum(base,'speed',-10,'sb'));assert(sum(base,'eye',15,'bb')>sum(base,'eye',-10,'bb'));const sp={role:'SP'},tb={stuff:50,command:50,breaking:50,stamina:50};let lowBB=0,highBB=0,lowIP=0,highIP=0,lowK=0,highK=0;for(let i=0;i<400;i++){lowBB+=M.statsFor(sp,28,{...tb,command:35},'regular',r('sp-'+i)).bb;highBB+=M.statsFor(sp,28,{...tb,command:65},'regular',r('sp-'+i)).bb;lowIP+=M.statsFor(sp,28,{...tb,stamina:35},'regular',r('ip-'+i)).outs;highIP+=M.statsFor(sp,28,{...tb,stamina:65},'regular',r('ip-'+i)).outs;lowK+=M.statsFor(sp,28,{...tb,stuff:35},'regular',r('k-'+i)).k;highK+=M.statsFor(sp,28,{...tb,stuff:65},'regular',r('k-'+i)).k;}assert(highBB<lowBB);assert(highIP>lowIP);assert(highK>lowK);});
test('mature starter wins and slugger home runs have no V5 artificial caps',()=>{let maxW=0,maxHR=0,maxIP=0;for(let i=0;i<300;i++){const a=M.statsFor({role:'SP'},30,{stuff:65,command:65,breaking:60,stamina:60},'regular',D.rng('starP-'+i));const b=M.statsFor({role:'OF'},135,{contact:55,power:65,speed:45,defense:45,eye:50},'regular',D.rng('starH-'+i));maxW=Math.max(maxW,a.wins);maxIP=Math.max(maxIP,a.outs/3);maxHR=Math.max(maxHR,b.hr);checkStats(a);checkStats(b);}assert(maxW>=15);assert(maxIP>=160);assert(maxHR>=30);});
test('trait-specific development carries tools forward and is not four identical boosts',()=>{const g=finish(draft('growth06'));assert(g.career.years.flatMap(y=>y.records).some(r=>r.growth>2));const p=C.getPlayer(g,C.signedPicks(g)[0].playerId),s=g.career.players[p.id];const changes=Object.keys(p.trueTools).map(k=>D.round(s.tools[k]-p.trueTools[k],1));assert(new Set(changes).size>1);for(const sel of C.signedPicks(g)){const p=C.getPlayer(g,sel.playerId),s=g.career.players[p.id];for(const k of Object.keys(s.tools))assert(s.tools[k]<=p.potentialTools[k]+.001);}});
test('restore rebuilds derived data from inputs and rejects edited inputs',()=>{const g=finish(draft('tamper06'));const honest=JSON.stringify(g);
 // Derived data is never trusted: edits are discarded and the honest game is rebuilt.
 for(const change of [x=>x.scoutReport.candidates[0].playerId='p999',x=>x.clubPlans.lg.staff.style='other',x=>x.forecasts[0].picks[0].playerId='p999',x=>x.career.years[0].records[0].stats.games++,x=>x.career.players[x.picks[0].playerId].tools={},x=>x.owner.score++,x=>x.news[0].headline='edited']){const bad=clone(g);change(bad);assert.equal(JSON.stringify(C.restore(bad)),honest);}
 // Inputs are checked: wrong version, a CPU pick the AI would not make, an illegal pick, too many seasons, unknown GM answer.
 const cpu=g.picks.findIndex(s=>s.teamId!=='lg'),mine=g.picks.findIndex(s=>s.teamId==='lg');
 for(const change of [x=>x.version=5,x=>x.picks[cpu].playerId=x.picks.at(-1).playerId,x=>x.picks[mine].playerId='p999',x=>x.career.years.push(...x.career.years),x=>x.gmChoice='other',x=>x.seed='',x=>x.cursor=3]){const bad=clone(g);change(bad);assert.equal(C.restore(bad),null);assert(!C.validate(bad));}
 assert(!C.validate(null));assert(!C.validate({}));});
test('every new sort handles mixed positions and nulls in both directions',()=>{const g=C.createGame('lg',false,'sort06'),ps=C.poolFor(g).players,t=C.teamFor(g);for(const key of Object.keys(C.rules.SORTS))for(const dir of ['asc','desc']){const sorted=C.rules.sortPlayers(ps,key,dir,t);let seenNull=false,last=null;for(const p of sorted){const v=C.rules.sortValue(p,key,t);if(v==null)seenNull=true;else{assert(!seenNull);if(last!=null)assert(dir==='asc'?v>=last:v<=last);last=v;}}}});

test('compact saves replay identically in every phase and stay tiny', () => {
  const roundTrip = (g) => {
    const save = JSON.parse(JSON.stringify(C.toSave(g)));
    assert(JSON.stringify(save).length < 1400, 'compact save');
    assert.equal(save.sim, C.SIM_VERSION);
    const back = C.loadSave(save).game;
    assert.deepEqual(clone(back), clone(g));
  };
  const g = C.createGame('doosan', true, 'compact06', 'hard');
  roundTrip(g);
  C.openScouting(g);
  roundTrip(g);
  C.beginDraft(g);
  C.advanceToUser(g);
  roundTrip(g);
  while (g.phase === 'draft') {
    C.addPick(g, C.available(g).at(-1).id); // deliberately unusual picks
    C.advanceToUser(g);
    roundTrip(g);
  }
  assert.equal(g.phase, 'negotiation');
  // Lowball the first two picks so counter-offers are likely, and give up on the last one.
  const offers = C.defaultOffers(g),
    ids = Object.keys(offers);
  offers[ids[0]] = Math.max(5, Math.round((offers[ids[0]] * 0.8) / 5) * 5);
  offers[ids[1]] = Math.max(5, Math.round((offers[ids[1]] * 0.8) / 5) * 5);
  offers[ids.at(-1)] = 0;
  C.negotiate(g, offers);
  roundTrip(g);
  if (g.phase === 'negotiation') {
    C.settleCounters(g, C.affordableCounters(g).slice(0, 1));
    roundTrip(g);
  }
  assert.equal(g.phase, 'signing');
  assert(g.picks.find((s) => s.playerId === ids.at(-1)).refused, 'no offer means no contract');
  assert(!C.signed(g).some((s) => s.playerId === ids.at(-1)));
  C.signDevelopment(g, C.undrafted(g).slice(0, 3).map((p) => p.id));
  assert.equal(g.devSigns.filter((s) => s.teamId === 'doosan').length, 3);
  roundTrip(g);
  C.chooseGM(g, 'needs');
  roundTrip(g);
  C.runSeason(g);
  roundTrip(g);
  let ordered = 0;
  while (g.career.years.length < C.Career.SEASONS) {
    // Send our first eligible player to Sangmu (or the army) and hold the next one back, when allowed.
    const opts = C.serviceOptions(g),
      orders = {};
    if (opts[0]) orders[opts[0].playerId] = opts[0].sangmu ? 'sangmu' : 'army';
    if (opts[1] && !opts[1].must) orders[opts[1].playerId] = 'defer';
    ordered += Object.keys(orders).length;
    C.nextSeason(g, orders);
    roundTrip(g);
  }
  assert(ordered > 0 && g.serviceOrders.length === ordered);
  assert(g.career.events.some((e) => e.type === 'enlist' && e.fromTeamId === 'doosan'));
  g.phase = 'owner';
  roundTrip(g);
  g.phase = 'interviews'; // revisiting interviews keeps every season
  roundTrip(g);
});

test('compact saves refuse other simulation versions and invalid inputs', () => {
  const g = finish(draft('refuse06'));
  const save = C.toSave(g);
  assert.deepEqual(C.loadSave({ ...save, sim: '0.5' }), { error: 'sim', sim: '0.5' });
  const invalid = [
    { version: 1 },
    { picks: [...save.picks, 'p001'] }, // more picks than slots
    { picks: ['p999', ...save.picks.slice(1)] }, // not a player
    { picks: [save.picks[1], save.picks[0], ...save.picks.slice(2)] }, // order changes who is available
    { seasons: C.Career.SEASONS + 1 },
    { service: 'sangmu' },
    { service: [[0, save.picks[0], 'army']] }, // no service choice before the second season
    { service: [[1, 'p999', 'army']] }, // not one of our players
    { service: [[1, save.picks[0], 'marines']] },
    { gmChoice: null }, // seasons need a GM answer
    { gmChoice: 'other' },
    { phase: 'draft' },
    { rounds: 7 },
    { dev: C.undrafted(g).slice(0, 6).map((p) => p.id) },
    { dev: [save.picks[0]] }, // already drafted
    { phase: 'nope' },
    { seed: '' },
    { teamId: 'nowhere' },
  ];
  for (const change of invalid) {
    const result = C.loadSave({ ...save, ...change });
    if (change.picks?.[1] === save.picks[0]) {
      // Swapping two picks can be legal; it must then produce a different, consistent game.
      if (result.game) assert.notDeepEqual(result.game.picks, g.picks);
      continue;
    }
    assert.deepEqual(result, { error: 'invalid' }, JSON.stringify(change));
  }
  assert.equal(C.loadSave({ ...save, phase: 'owner', seasons: 0 }).error, 'invalid');
  assert.equal(C.loadSave(null).error, 'invalid');
});

test('v0.6.0 saves are refused as another simulation version, bare or wrapped', () => {
  // Their rules (200 players, 7 rounds) differ from SIM_VERSION 0.7, so replaying them would change history.
  const demo = require('./fixtures/legacy-v060-save.json');
  for (const data of [demo, demo.game]) assert.deepEqual(C.loadSave(data), { error: 'sim', sim: '0.6' });
});

test('tuning values are finite numbers and frozen', () => {
  const { TUNING } = require('../src/core/tuning.js');
  const walk = (o, path) => {
    assert(Object.isFrozen(o), path + ' is frozen');
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') walk(v, path + '.' + k);
      else if (typeof v !== 'string' && v !== null) assert(Number.isFinite(v), `${path}.${k} is a finite number`);
    }
  };
  walk(TUNING, 'TUNING');
  assert.throws(() => {
    'use strict';
    TUNING.roles.retention.base = 1;
  });
});

test('season steps: role rules, growth ceiling and plan score bounds', () => {
  const { TUNING } = require('../src/core/tuning.js');
  const always = () => 0, // every chance roll succeeds
    never = () => 0.999999; // every chance roll fails
  const base = { impact: 60, previous: null, yearIndex: 1, round: 1, fit: 100, daysLost: 0, blockedRegular: false };
  assert.equal(M.decideRole({ ...base, daysLost: TUNING.health.rehabDays }, always).route, 'rehab');
  assert.equal(M.decideRole(base, always).route, 'regular');
  assert.equal(M.decideRole(base, always).core, true);
  assert.deepEqual(
    [M.decideRole({ ...base, blockedRegular: true }, always).route, M.decideRole({ ...base, blockedRegular: true }, always).reason],
    ['backup', 'cohort-competition'],
  );
  assert.equal(M.decideRole(base, never).route, 'futures');
  const lastYearRegular = { route: 'regular', performance: 0 };
  assert.equal(M.decideRole({ ...base, previous: lastYearRegular }, always).reason, 'role-retained');
  assert.equal(M.decideRole({ ...base, previous: lastYearRegular }, never).route, 'backup');
  assert.equal(M.decideRole({ ...base, impact: 30, previous: { route: 'regular', performance: -2 } }, never).route, 'futures');

  const p = D.generatePool('steps06').players.find((x) => x.role === 'IF');
  const atCeiling = { ...p.potentialTools };
  const grown = M.developTools({ ...p, growthCurve: 'early', developmentRate: 1.2 }, atCeiling, 0, 20, 0, D.rng('g'));
  // Tools are rounded to 3 decimals after clamping, so they can sit up to 0.0005 above the ceiling.
  for (const k of Object.keys(grown)) assert(grown[k] <= p.potentialTools[k] + 0.0005, 'growth never passes the hidden ceiling');

  for (const growth of [-5, 0, 2, 50])
    for (const route of ['regular', 'futures', 'rehab']) {
      const s = M.planScoreOf(p, { startGrade: 40, growth, yearIndex: 0, games: route === 'regular' ? 100 : 0, route, daysLost: 0 });
      assert(s >= TUNING.scores.plan.min && s <= TUNING.scores.plan.max);
    }
});

test('contracts: budgets hold, refusals leave the class, bad offers are refused', () => {
  let refusedTotal = 0,
    abroadRefused = 0;
  for (let i = 0; i < 12; i++) {
    const g = C.createGame(C.TEAMS[i % 10].id, i % 2 === 0, 'deal-' + i, ['easy', 'normal', 'hard'][i % 3]);
    assert.deepEqual(g.budgets, C.createGame('lg', i % 2 === 0, 'deal-' + i).budgets, 'budgets come from the seed');
    C.openScouting(g);
    C.beginDraft(g);
    while (g.phase === 'draft') C.addPick(g, C.aiChoice(g).id);
    assert.equal(g.phase, 'negotiation');
    const offers = C.defaultOffers(g),
      ids = Object.keys(offers);
    assert.equal(ids.length, C.myPicks(g).length);
    assert(Object.values(offers).reduce((n, v) => n + v, 0) <= g.budgets[g.teamId]);
    assert.throws(() => C.negotiate(g, { ...offers, [ids[0]]: g.budgets[g.teamId] })); // over budget
    assert.throws(() => C.negotiate(g, { ...offers, [ids[0]]: 7 })); // not a 500만 step
    assert.throws(() => C.negotiate(g, Object.fromEntries(ids.slice(1).map((id) => [id, offers[id]])))); // missing a pick
    C.negotiate(g, offers);
    assert.throws(() => C.negotiate(g, offers));
    if (g.phase === 'negotiation') {
      assert.throws(() => C.settleCounters(g, ['p999']));
      C.settleCounters(g, C.affordableCounters(g));
    }
    C.signDevelopment(g, C.undrafted(g).slice(0, Math.min(2, Math.floor(C.budgetLeft(g) / C.tuning.contracts.devCost))).map((p) => p.id));
    for (const t of C.TEAMS) assert(C.spent(g, t.id) <= g.budgets[t.id], 'no club goes over budget: ' + t.id);
    const refused = C.refusals(g);
    refusedTotal += refused.length;
    for (const t of refused) {
      const p = C.getPlayer(g, t.playerId);
      assert(t.path && !C.signed(g).some((s) => s.playerId === t.playerId));
      assert(!C.undrafted(g).some((q) => q.id === t.playerId), 'a refused pick cannot be signed as a development player');
      if (p.intent === 'abroad') abroadRefused++, assert.match(t.path, /미국/);
    }
    const lost = C.refusals(g, g.teamId).length,
      entry = C.fanState(g).timeline.find((x) => x.label.startsWith('계약 협상'));
    assert.equal(entry.delta, lost * C.tuning.contracts.refusalFan || 0);
    C.chooseGM(g, 'development');
    C.runSeason(g);
    for (const t of C.TEAMS) {
      const b = g.career.boosts[t.id];
      assert(b >= 0 && b <= C.tuning.contracts.growthBoost.max);
    }
    assert.equal(C.careerReview(g).find((x) => x.teamId === g.teamId).refused, lost);
  }
  assert(refusedTotal > 0 && abroadRefused >= 0);
  // Edited saves: offers over budget, counters that were never made.
  const g = draft('deal-save');
  const save = C.toSave(g);
  assert(C.loadSave(save).game);
  const big = save.offers.map(([id, v], i) => [id, i ? v : g.budgets.lg]);
  assert.equal(C.loadSave({ ...save, offers: big }).error, 'invalid');
  assert.equal(C.loadSave({ ...save, counters: ['p999'] }).error, 'invalid');
  assert.equal(C.loadSave({ ...save, gm: { first: 'nope' } }).error, 'invalid');
});
