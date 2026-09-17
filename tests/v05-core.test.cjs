const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/engine.js'),D=require('../src/data.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function finish(team='kiwoom',local=false,seed='test',difficulty='normal'){const g=C.createGame(team,local,seed,difficulty);C.beginDraft(g);while(g.phase==='draft')C.addPick(g,C.aiChoice(g).id);C.chooseGM(g,'development');return g;}
function years(g,n=5){C.runSeason(g);while(g.career.years.length<n)C.nextSeason(g);return g;}
test('200 candidates: 144 HS, 30 graduates, 16 early, 6 independent, 4 overseas; eligibility and chronology',()=>{
 for(let i=0;i<40;i++){const pool=C.poolFor('bio05-'+i).players;const counts=Object.fromEntries(['고졸','대졸','대학 얼리','독립구단','해외파'].map(k=>[k,pool.filter(p=>p.pathway===k).length]));assert.deepEqual(counts,{'고졸':144,'대졸':30,'대학 얼리':16,'독립구단':6,'해외파':4});assert.equal(new Set(pool.map(p=>p.name)).size,200);
  for(const region of C.REGIONS)assert.equal(pool.filter(p=>p.pathway==='고졸'&&p.highSchoolRegion===region).length,18);
  for(const p of pool){assert.equal(p.age,C.bio.ageAt(p.birthday));assert.equal(p.quotaEligible,p.pathway==='대졸');assert(p.history.every((h,j)=>!j||p.history[j-1].end<=h.start));if(p.pathway==='대학 얼리'){assert.equal(p.collegeYear,2);assert.equal(p.highSchoolGradYear,2025);assert.equal(p.history.at(-1).end,null);assert.match(p.qualification,/2학년/);assert.equal(p.quotaEligible,false);}for(const t of C.TEAMS)if(C.eligible(p,t)){assert.equal(p.pathway,'고졸');assert.equal(p.highSchoolRegion,t.region);}}
 }
 assert.equal(C.catalog.length,132);
});
test('all 10 clubs x regional ON/OFF x 3 difficulties: legal 7R draft, quotas, 5 seasons and reload',()=>{
 for(const t of C.TEAMS)for(const local of [false,true])for(const diff of ['easy','normal','hard']){
  const g=finish(t.id,local,'flow05-'+t.id+'-'+local,diff);assert.equal(g.picks.length,local?80:70);assert.equal(new Set(g.picks.map(s=>s.playerId)).size,g.picks.length);assert.equal(C.myPicks(g).length,local?8:7);for(const team of C.TEAMS)assert(C.quotaStatus(g,team.id).count>=1);assert.equal(g.news.length,local?20:10);assert(C.validate(g));years(g);assert.equal(g.career.years.length,5);assert.deepEqual(g.career.years.map(y=>y.year),[2027,2028,2029,2030,2031]);assert(g.career.years.every(y=>y.records.length===g.picks.length));assert(C.validate(clone(g)),t.id+' '+diff);assert.throws(()=>C.nextSeason(g));
 }
});
test('early does not count; last pick legally restricts humans and CPUs, direct illegal picks rejected',()=>{
 const g=C.createGame('kiwoom',false,'quota-last');C.beginDraft(g);
 const early=C.available(g).find(p=>p.pathway==='대학 얼리');C.addPick(g,early.id);assert.equal(C.quotaStatus(g).count,0);
 while(g.cursor<60){const legal=C.available(g),p=legal.find(p=>!p.quotaEligible);assert(p);C.addPick(g,p.id);}
 const available=C.available(g);assert(available.length);assert(available.every(p=>p.quotaEligible));const used=new Set(g.picks.map(x=>x.playerId)),bad=C.poolFor(g).players.find(p=>!p.quotaEligible&&!used.has(p.id));assert.throws(()=>C.addPick(g,bad.id));while(g.phase==='draft')C.addPick(g,C.aiChoice(g).id);for(const t of C.TEAMS)assert.equal(C.quotaStatus(g,t.id).count,1);assert(C.validate(g));
});
test('global quota supply cannot be exhausted by already satisfied teams',()=>{
 const g=C.createGame('kiwoom',false,'supply');C.beginDraft(g);const pool=C.poolFor(g).players,graduates=pool.filter(p=>p.quotaEligible),previous=graduates.map(p=>[p,p.quotaEligible]);
 try {graduates.slice(10).forEach(p=>p.quotaEligible=false);C.addPick(g,C.available(g).find(p=>p.quotaEligible).id);while(g.cursor<10)C.addPick(g,C.available(g).find(p=>!p.quotaEligible).id);assert(C.available(g).every(p=>!p.quotaEligible));while(g.phase==='draft')C.addPick(g,C.aiChoice(g).id);for(const t of C.TEAMS)assert(C.quotaStatus(g,t.id).count>=1);}finally{for(const [p,v]of previous)p.quotaEligible=v;}
});
test('first-year promise, news and forecasts are immutable through all five seasons and repeated viewing',()=>{
 const g=finish('lg',true,'immutable05'),news=clone(g.news),forecasts=clone(g.forecasts);C.runSeason(g);const season=clone(g.season),owner=clone(g.owner),fan=clone(C.fanState(g));for(let i=1;i<5;i++)C.nextSeason(g);C.runSeason(g);assert.deepEqual(g.season,season);assert.deepEqual(g.owner,owner);assert.deepEqual(C.fanState(g),fan);assert.deepEqual(g.news,news);assert.deepEqual(g.forecasts,forecasts);g.phase='interviews';assert(C.validate(g));assert.throws(()=>C.chooseGM(g,'needs'));
});
test('difficulty and observing team do not reroll physical player careers when selections are the same',()=>{
 const a=finish('lg',true,'observer05','normal'),b=C.createGame('nc',true,a.seed,'hard');C.beginDraft(b);for(const s of a.picks)C.addPick(b,s.playerId);C.chooseGM(b,'immediate');years(a);years(b);assert.deepEqual(a.career,b.career);
});
test('yearly growth persists, stays under hidden ceiling, ages advance; past ownership stays frozen',()=>{
 for(let i=0;i<20;i++){const g=years(finish('lg',true,'state05-'+i));for(const pick of g.picks){const p=C.getPlayer(g,pick.playerId),h=C.Career.history(g.career,p.id);for(let y=0;y<5;y++){const r=h[y];assert.equal(r.age,C.bio.ageAt(p.birthday,r.year+'-12-31'));if(r.route!=='released'){assert(r.endState.ability<=p.upside);assert(r.endState.ability>=20);const prior=y?h[y-1].endState.ability:p.trueReady;assert.equal(r.endState.ability,prior+r.growth);}}}
  for(const ev of g.career.events){assert(ev.year>=2028&&ev.year<=2030);const old=g.career.years.find(y=>y.year===ev.year),next=g.career.years.find(y=>y.year===ev.year+1);assert.equal(old.records.find(r=>r.playerId===ev.playerIds[0]).teamId,ev.fromTeamId);assert.equal(next.records.find(r=>r.playerId===ev.playerIds[0]).teamId,ev.toTeamId);if(ev.type==='trade'){assert.notEqual(ev.fromTeamId,ev.toTeamId);assert.equal(old.records.find(r=>r.playerId===ev.playerIds[1]).teamId,ev.toTeamId);assert.equal(next.records.find(r=>r.playerId===ev.playerIds[1]).teamId,ev.fromTeamId);}else{assert(g.career.years.filter(y=>y.year>ev.year).every(y=>y.records.find(r=>r.playerId===ev.playerIds[0]).stats.games===0));}}
 }
});
test('144-game standings balance, postseason has one champion, cohort award eligibility and historical team',()=>{
 const g=years(finish('kia',true,'awards05'));for(const y of g.career.years){assert.equal(y.league.table.reduce((n,t)=>n+t.wins,0),720);assert.equal(y.league.table.reduce((n,t)=>n+t.losses,0),720);assert(y.league.table.every(t=>t.wins+t.losses===144));assert.equal(y.league.series.at(-1).winner,y.league.champion);assert.equal(new Set(y.awards.map(a=>a.id)).size,y.awards.length);for(const a of y.awards){const r=y.records.find(r=>r.playerId===a.playerId);assert.equal(a.teamId,r.teamId);if(a.scope==='team'){assert(r.stats.games>0);assert.equal(a.teamId,y.league.champion);}else assert(r.stats.kind==='hitter'?r.stats.pa>=60:r.stats.outs>=60);}}
});
test('cumulative rates are derived from raw totals, not average rates; non-appearance remains null',()=>{
 const g=years(finish('ssg',false,'totals05'));for(const pick of g.picks){const h=C.Career.history(g.career,pick.playerId);for(const key of ['stats','futures']){const s=C.Career.totalStats(h,key);assert.equal(s.games,h.reduce((n,r)=>n+r[key].games,0));if(s.kind==='pitcher')assert.equal(s.era,s.outs?D.round(s.er*27/s.outs,2):null);else {assert.equal(s.avg,s.ab?D.round(s.hits/s.ab,3):null);assert.equal(s.ops,s.ab?D.round((s.hits+s.bb)/(s.ab+s.bb)+(s.hits+s.doubles+2*s.triples+3*s.hr)/s.ab,3):null);}}}
 assert.equal(C.Career.totalStats([]),null);const p=C.poolFor(g).players[0],zero=require('../src/season.js').emptyStats(p);assert.equal(C.Career.totalStats([{stats:zero}]).games,0);
});
test('reload after every season continues identically to uninterrupted run; corrupted saves rejected',()=>{
 const a=finish('kt',true,'reload05'),b=clone(a);years(a);C.runSeason(b);for(let i=1;i<5;i++){assert(C.validate(clone(b)));C.nextSeason(b);}assert.deepEqual(a,b);
 for(const change of [x=>x.version=4,x=>x.difficulty='__proto__',x=>x.seed=null,x=>x.picks[0]=null,x=>x.picks[0].round=7,x=>x.news[0].delta+=1,x=>x.forecasts[0].picks[0].playerId='fake',x=>x.gmChoice=null,x=>x.owner.score++,x=>x.career.years[0].records[0].stats.games++,x=>x.career.players[x.picks[0].playerId].currentTeamId='fake',x=>x.career.years.push(x.career.years[0]),x=>x.career.years[0].league.champion='fake']){const bad=clone(a);change(bad);assert.equal(C.validate(bad),false);}
});
test('AI, media, advice use public projections only; 22 sorts keep non-applicable values last',()=>{
 const g=C.createGame('kiwoom',true,'private05');C.beginDraft(g);const ps=C.poolFor(g).players,ds=[];for(const p of ps)for(const k of ['trueReady','upside','risk','lateDevelopment']){ds.push([p,k,Object.getOwnPropertyDescriptor(p,k)]);Object.defineProperty(p,k,{configurable:true,get(){throw Error('private '+k);}});}
 try{C.aiChoice(g);C.scoutAdvice(C.available(g)[0],g);C.press.forecast(C.publicPool(g),C.TEAMS,true,g.seed);C.addPick(g,C.aiChoice(g).id);}finally{for(const [p,k,d]of ds)Object.defineProperty(p,k,d);}
 for(const key of Object.keys(C.rules.SORTS))for(const dir of ['asc','desc']){let seen=false,last=null;for(const p of C.rules.sortPlayers(ps,key,dir,C.teamById.kiwoom)){const n=C.rules.sortValue(p,key,C.teamById.kiwoom);if(n===null)seen=true;else{assert(!seen);if(last!==null)assert(dir==='asc'?n>=last:n<=last);last=n;}}}
});
