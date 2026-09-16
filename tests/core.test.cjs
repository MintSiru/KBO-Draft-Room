const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('../src/engine.js'),R=C.rules,P=C.press;
const clone=x=>JSON.parse(JSON.stringify(x));
function finish(g){if(g.phase==='preview')C.beginDraft(g);while(g.phase==='draft')C.addPick(g,C.aiChoice(g).id);return g;}
test('default normal preview precedes any pick and produces fixed two-outlet legal mock drafts',()=>{
 for(const local of [false,true]){
  const g=C.createGame('lg',local,'mock-legal');assert.equal(g.difficulty,'normal');assert.equal(g.phase,'preview');assert.equal(g.picks.length,0);assert(C.validate(g));assert.throws(()=>C.addPick(g,C.PLAYERS[0].id));assert.equal(C.advanceToUser(g).length,0);
  for(const f of g.forecasts){assert.equal(f.picks.length,local?20:10);assert.equal(new Set(f.picks.map(s=>s.playerId)).size,f.picks.length);for(const s of f.picks)if(s.round===0)assert(C.eligible(C.getPlayer(g,s.playerId),C.teamById[s.teamId]));}
  const before=clone(g.forecasts);finish(g);assert.deepEqual(g.forecasts,before);assert.deepEqual(C.createGame('lg',local,'mock-legal','hard').forecasts,before);
  assert.notDeepEqual(g.forecasts[0].picks,g.forecasts[1].picks);
 }
});
test('all ten clubs × regional OFF/ON × three difficulties complete every phase and validated reload',()=>{
 for(const difficulty of Object.keys(R.DIFFICULTIES))for(const t of C.TEAMS)for(const local of [false,true]){
  const g=C.createGame(t.id,local,'flow-'+t.id+'-'+local,difficulty);C.beginDraft(g);C.advanceToUser(g);C.addPick(g,C.aiChoice(g).id);C.advanceToUser(g);assert(C.validate(clone(g)),difficulty+t.id);finish(g);
  assert.equal(g.picks.length,local?60:50);assert.equal(C.myPicks(g).length,local?6:5);assert.equal(new Set(g.picks.map(s=>s.playerId)).size,g.picks.length);assert.equal(g.news.length,local?20:10);assert.equal(C.fanState(g).timeline.length,local?3:2);assert.throws(()=>C.runSeason(g));
  C.chooseGM(g,{easy:'immediate',normal:'development',hard:'needs'}[difficulty]);assert.throws(()=>C.chooseGM(g,'needs'));const s=clone(C.runSeason(g));const fan=clone(C.fanState(g));C.runSeason(g);assert.deepEqual(g.season,s);assert.deepEqual(C.fanState(g),fan);assert(C.validate(clone(g)));g.phase='owner';assert(C.validate(g));assert(Math.abs(g.owner.score-g.owner.baseScore)<=4);assert(fan.score>=0&&fan.score<=100);
 }
});
test('AI, forecasts, news and advice do not read hidden ability, risk or future results',()=>{
 const g=C.createGame('kiwoom',false,'public-only');C.beginDraft(g);const pool=C.poolFor(g).players;const before=C.aiChoice(g).id,forecasts=clone(g.forecasts),descriptors=[];
 for(const p of pool){for(const key of ['trueReady','upside','risk','lateDevelopment']){descriptors.push([p,key,Object.getOwnPropertyDescriptor(p,key)]);Object.defineProperty(p,key,{configurable:true,get(){throw Error('private access '+key);}});}}
 try{assert.equal(C.aiChoice(g).id,before);assert.deepEqual(P.forecast(C.publicPool(g),C.TEAMS,false,g.seed),forecasts);C.scoutAdvice(pool[0],g);C.addPick(g,before);assert.equal(g.news.length,1);assert.equal(Object.keys(R.project(pool[0])).some(k=>['trueReady','upside','risk','lateDevelopment'].includes(k)),false);}finally{for(const [p,key,d]of descriptors)Object.defineProperty(p,key,d);}
});
test('difficulty changes assistance and AI decisions but never a player or the rookie roll',()=>{
 const games=Object.keys(R.DIFFICULTIES).map(d=>C.createGame('kiwoom',false,'same-players',d));const p=C.getPlayer(games[0],'p001'),s={playerId:p.id,teamId:'kiwoom',round:1,label:'1R'};
 for(const g of games){assert.deepEqual(C.getPlayer(g,p.id),p);assert.deepEqual(C.simulatePlayer(p,s,g),C.simulatePlayer(p,s,games[0]));C.beginDraft(g);}
 const lengths=games.map(g=>C.scoutAdvice(p,g).lines.length);assert(lengths[0]>lengths[1]&&lengths[1]>lengths[2]);
 let different=0;for(let i=0;i<30;i++){const a=C.createGame('kiwoom',false,'difficulty-'+i,'easy'),b=C.createGame('kiwoom',false,'difficulty-'+i,'hard');C.beginDraft(a);C.beginDraft(b);different+=C.aiChoice(a).id!==C.aiChoice(b).id;}assert(different>10,different);
});
test('22 board sorts work in both directions, put non-applicable values last, retain zero, and do not mutate input',()=>{
 const g=C.createGame('kiwoom',false,'sorting'),players=C.poolFor(g).players,ids=players.map(p=>p.id),t=C.teamById.kiwoom;assert.equal(Object.keys(R.SORTS).length,22);
 for(const key of Object.keys(R.SORTS))for(const dir of ['asc','desc']){const sorted=R.sortPlayers(players,key,dir,t);let nullSeen=false,last=null;for(const p of sorted){const n=R.sortValue(p,key,t);if(n===null)nullSeen=true;else {assert(!nullSeen,key);if(last!==null)assert(dir==='asc'?n>=last:n<=last,key);last=n;}}assert.deepEqual(players.map(p=>p.id),ids);}
 const p=players.find(p=>p.record.kind==='pitcher'),h=players.find(p=>p.record.kind==='hitter');const zero={...p,id:'zero',record:{...p.record,era:0,outs:32}},next={...p,id:'next',record:{...p.record,era:2,outs:33}};
 assert.deepEqual(R.sortPlayers([h,next,zero],'era','asc',t).map(p=>p.id),['zero','next',h.id]);assert.deepEqual(R.sortPlayers([next,zero],'outs','asc',t).map(p=>p.id),['zero','next']);assert.equal(C.innings(32),'10.2');assert.equal(R.sortValue(h,'velocity',t),null);assert.throws(()=>R.sortPlayers(players,'unknown','asc',t));
});
test('news is contextual, first-round only, immutable after subsequent picks, and never double-counted',()=>{
 const g=C.createGame('kiwoom',true,'news-history');C.beginDraft(g);while(g.cursor<20)C.addPick(g,C.aiChoice(g).id);const news=clone(g.news),fans=clone(C.fanState(g));assert.equal(news.length,20);assert.equal(new Set(news.map(n=>n.id)).size,20);for(const n of news){assert.equal(n.comments.length,3);assert(n.comments.some(c=>c.tone==='신중'));assert(n.body.includes(C.getPlayer(g,n.playerId).school));}
 finish(g);assert.deepEqual(g.news,news);assert.deepEqual(C.fanState(g),fans);C.chooseGM(g,'development');C.runSeason(g);assert.deepEqual(g.news,news);assert(C.validate(g));
});
test('all interview promises use explicit thresholds, no-debut development can succeed, and no replay farming',()=>{
 const g=finish(C.createGame('kiwoom',false,'promises')),ps=C.myPicks(g).map(s=>R.project(C.getPlayer(g,s.playerId))),t=C.teamById.kiwoom;
 const season=ps.map(p=>({playerId:p.id,stats:{games:0},planScore:80}));assert.equal(P.accountability('development',ps,season,t).bonus,3);assert.equal(P.accountability('immediate',ps,season,t).bonus,-4);
 season[0].stats.games=1;assert.equal(P.accountability('immediate',ps,season,t).bonus,0);season[1].stats.games=1;assert.equal(P.accountability('immediate',ps,season,t).bonus,4);
 C.chooseGM(g,'development');const f=clone(C.fanState(g));assert.throws(()=>C.chooseGM(g,'development'));assert.deepEqual(C.fanState(g),f);
});
test('save validation rejects old versions, invalid difficulty, edited forecasts/news/promises and malformed picks without throwing',()=>{
 const g=finish(C.createGame('kiwoom',true,'tamper'));C.chooseGM(g,'needs');C.runSeason(g);assert(C.validate(g));
 for(const change of [x=>x.version=3,x=>x.difficulty='constructor',x=>x.teamId='__proto__',x=>x.gmChoice='anything',x=>x.news[0].delta+=100,x=>x.forecasts[0].picks[0].playerId='fake',x=>x.picks[0]=null,x=>x.season[0].stats.games+=20,x=>x.owner.score+=5,x=>x.news.pop(),x=>x.gmChoice=null]){const bad=clone(g);change(bad);assert.equal(C.validate(bad),false);}
 assert.equal(C.validate(null),false);assert.equal(C.validate({}),false);
});
test('50 v0.3 reference hashes still match physical players and public records; v0.3 saves are explicitly rejected',()=>{
 const baseline=require('./fixtures/v03-baseline.json'),stable=require('./stable-player-fields.cjs');
 for(const row of baseline.poolHashes){const ps=C.poolFor(row.seed).players;assert.equal(crypto.createHash('sha256').update(JSON.stringify(stable(ps))).digest('hex'),row.sha256);}
 for(const row of baseline.saves)assert.equal(C.validate(row.game),false);
});
