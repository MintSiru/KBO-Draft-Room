/* Five-year draft-class careers. Pure deterministic transitions; no live roster dependency. */
(function(root){
'use strict';
const D=root.DraftData||(typeof require!=='undefined'?require('./data.js'):null);
const M=root.DraftSeason||(typeof require!=='undefined'?require('./season.js'):null);
const TEAMS=root.DraftClubs||(typeof require!=='undefined'?require('./clubs.js'):null);
const byTeam=Object.fromEntries(TEAMS.map(t=>[t.id,t]));
const {rng,normal,clamp,round,mean}=D;
const S=root.DraftScouting||(typeof require!=='undefined'?require('./scouting06.js'):null);
const SEASONS=5;
const fit=(p,t)=>S.fit(p,t);
function create(picks,byId,seed=''){return {seed,years:[],players:Object.fromEntries(picks.map(s=>{const p=byId[s.playerId];return [p.id,{playerId:p.id,originTeamId:s.teamId,currentTeamId:s.teamId,status:'active',ability:p.trueReady,tools:{...p.trueTools},publicTools:{...p.tools},scoutReady:p.ready,route:null,limited:false,age:p.age}];})),events:[]};}
function totalStats(records,key='stats'){
 const first=records[0]?.[key];if(!first)return null;
 const out={kind:first.kind};
 const keys=first.kind==='pitcher'?['games','gs','qs','outs','er','k','bb','wins','holds','saves']:['games','ab','pa','hits','bb','k','hr','doubles','triples','rbi','sb'];
 for(const k of keys)out[k]=records.reduce((n,x)=>n+(x[key]?.[k]||0),0);
 if(out.kind==='pitcher')out.era=out.outs?round(out.er*27/out.outs,2):null;
 else {out.avg=out.ab?round(out.hits/out.ab,3):null;out.ops=out.ab?round((out.hits+out.bb)/(out.ab+out.bb)+(out.hits+out.doubles+2*out.triples+3*out.hr)/out.ab,3):null;}
 return out;
}
function standings(seed,year,records){
 const ratings={},table=TEAMS.map(t=>({teamId:t.id,wins:0,losses:0,games:144,rookieContribution:records.filter(x=>x.teamId===t.id).reduce((a,x)=>a+x.contribution,0)}));
 for(const t of TEAMS){const r=rng(seed+'-background-'+year+'-'+t.id);ratings[t.id]=50+(11-t.rank)*2.2+normal(r)*12+Math.min(9,table.find(x=>x.teamId===t.id).rookieContribution/35);}
 const r=rng(seed+'-schedule-'+year);
 for(let i=0;i<10;i++)for(let j=i+1;j<10;j++)for(let n=0;n<16;n++){
  const a=table[i],b=table[j],chance=1/(1+Math.exp((ratings[b.teamId]-ratings[a.teamId])/23));
  const [w,l]=r()<chance?[a,b]:[b,a];w.wins++;l.losses++;
 }
 table.sort((a,b)=>b.wins-a.wins||ratings[b.teamId]-ratings[a.teamId]||a.teamId.localeCompare(b.teamId));
 table.forEach((x,i)=>x.rank=i+1);
 const post=rng(seed+'-postseason-'+year),series=[];
 function play(a,b,need,label,advantage=0){let aw=advantage,bw=0;while(aw<need&&bw<need){if(post()<1/(1+Math.exp((ratings[b.teamId]-ratings[a.teamId])/23)))aw++;else bw++;}const winner=aw>bw?a:b;series.push({label,home:a.teamId,away:b.teamId,homeWins:aw,awayWins:bw,winner:winner.teamId});return winner;}
 let winner=play(table[3],table[4],2,'와일드카드',1);
 winner=play(table[2],winner,3,'준플레이오프');winner=play(table[1],winner,3,'플레이오프');winner=play(table[0],winner,4,'한국시리즈');
 return {table,champion:winner.teamId,series};
}
function awards(year,records,league){
 const out=[];
 function best(kind,title,min,score){const list=records.filter(x=>x.stats.kind===kind&&min(x.stats)).map(x=>({x,score:score(x.stats)})).sort((a,b)=>b.score-a.score||a.x.playerId.localeCompare(b.x.playerId));if(list[0]){const x=list[0].x;out.push({id:year+'-'+kind,title,scope:'draft-class',year,playerId:x.playerId,teamId:x.teamId});}}
 best('hitter','드래프트 동기 올해의 타자',s=>s.pa>=60,s=>s.pa*.055+(s.ops-.65)*50+s.hr*.7);
 best('pitcher','드래프트 동기 올해의 투수',s=>s.outs>=60,s=>s.outs*.12+(5.5-s.era)*6+s.k*.05);
 for(const x of records.filter(x=>x.teamId===league.champion&&x.stats.games>0))out.push({id:year+'-champion-'+x.playerId,title:'한국시리즈 우승 멤버',scope:'team',year,playerId:x.playerId,teamId:x.teamId});
 return out;
}
function offseason(seed,yearIndex,career,records,byId,picks){
 const events=[];if(yearIndex<1||yearIndex>=SEASONS-1)return events;
 const year=D.bio.ENTRY_YEAR+yearIndex,states=Object.values(career.players).sort((a,b)=>a.playerId.localeCompare(b.playerId));
 const counts=Object.fromEntries(TEAMS.map(t=>[t.id,states.filter(s=>s.status==='active'&&s.currentTeamId===t.id).length]));
 const touched=new Set();
 for(const s of states){if(s.status!=='active'||counts[s.currentTeamId]<=4)continue;const p=byId[s.playerId],rec=records.find(x=>x.playerId===s.playerId),r=rng(seed+'-release-'+year+'-'+p.id);
  const old=career.years.at(-1)?.records.find(x=>x.playerId===s.playerId);
  const stalled=yearIndex>=2&&s.age>=23&&s.scoutReady<40&&rec.stats.games===0&&old?.stats.games===0;
  const chance=stalled?clamp(.07+(40-s.scoutReady)*.014+Math.max(0,s.age-23)*.012,0,.24):0;
  if(r()<chance){const from=s.currentTeamId;events.push({id:year+'-release-'+p.id,type:'release',year,fromTeamId:from,toTeamId:null,playerIds:[p.id],reason:'만 23세 이상, 2년 연속 1군 기록 없음과 현재 공개 기량 40 미만을 함께 고려한 방출입니다.'});counts[from]--;s.status='released';s.currentTeamId=null;touched.add(p.id);}
 }
 const rr=rng(seed+'-trade-'+year);
 if(rr()<.68){
  const active=states.filter(s=>s.status==='active'&&!touched.has(s.playerId)&&!records.some(x=>x.playerId===s.playerId&&x.route==='regular'&&x.contribution>=50)),pairs=[];
  const plans=S.plans(seed,TEAMS);
  const publicValue=s=>s.scoutReady*.65+byId[s.playerId].scoutCeiling*.25-Math.max(0,s.age-22)*1.1+(records.find(x=>x.playerId===s.playerId)?.contribution||0)*.08;
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j],pa=byId[a.playerId],pb=byId[b.playerId];if(a.currentTeamId===b.currentTeamId||pa.role===pb.role)continue;
   const ta={...byTeam[a.currentTeamId],...plans[a.currentTeamId]},tb={...byTeam[b.currentTeamId],...plans[b.currentTeamId]},gainA=fit(pb,ta)-fit(pa,ta),gainB=fit(pa,tb)-fit(pb,tb);
   if(gainA<0||gainB<0||gainA+gainB<30||Math.abs(publicValue(a)-publicValue(b))>8)continue;
   pairs.push({a,b,score:gainA+gainB-Math.abs(publicValue(a)-publicValue(b))*2+rr()*25});
  }
  pairs.sort((a,b)=>b.score-a.score||a.a.playerId.localeCompare(b.a.playerId));
  if(pairs[0]){const {a,b}=pairs[0],from=a.currentTeamId,to=b.currentTeamId;events.push({id:year+'-trade-'+a.playerId+'-'+b.playerId,type:'trade',year,fromTeamId:from,toTeamId:to,playerIds:[a.playerId,b.playerId],reason:'서로 필요한 포지션을 보완하고 공개 평가 가치가 비슷한 자원을 교환했습니다.'});a.currentTeamId=to;b.currentTeamId=from;}
 }
 return events;
}
function advance(career,picks,byId,seed){
 const yearIndex=career.years.length;if(yearIndex>=SEASONS)throw Error('5시즌이 모두 끝났습니다.');
 const year=D.bio.ENTRY_YEAR+yearIndex,plans=S.plans(seed,TEAMS),rankings={};
 for(const t of TEAMS)for(const role of Object.keys(D.ROLES)){rankings[t.id+'-'+role]=Object.values(career.players).filter(s=>s.status==='active'&&s.currentTeamId===t.id&&byId[s.playerId].role===role).sort((a,b)=>(b.ability+(b.route==='regular'?5:0))-(a.ability+(a.route==='regular'?5:0))||a.playerId.localeCompare(b.playerId)).map(s=>s.playerId);}
 const records=picks.map(sel=>{
  const p=byId[sel.playerId],state=career.players[p.id];
  if(state.status!=='active')return {playerId:p.id,label:sel.label,year,teamId:null,age:D.bio.ageAt(p.birthday,year+'-12-31'),route:'released',routeLabel:'방출 · 무소속',stats:M.emptyStats(p),futures:M.emptyStats(p),growth:0,growthLabel:'프로 기록 없음',developmentNote:'방출 이전 경력은 보존됩니다. 재계약·독립리그 경력은 이번 버전의 범위 밖입니다.',note:'현재 무소속으로 추가 프로 성적을 생성하지 않습니다.',limited:false,contribution:0,planScore:0,target:'경력 보존',scoutReady:state.scoutReady};
  const t={...byTeam[state.currentTeamId],...plans[state.currentTeamId]},rank=rankings[t.id+'-'+p.role].indexOf(p.id),capacity={SP:5,RP:7,C:2,IF:4,OF:3}[p.role];
  const rec=M.simulatePlayer(p,sel,{seed},t,fit(p,t),yearIndex?state:null,yearIndex,{blockedRegular:rank>=capacity,closer:p.role==='RP'&&rank===0&&state.ability>=48&&yearIndex>=1});
  Object.assign(state,rec.endState);return rec;
 });
 const league=standings(seed,year,records),honors=awards(year,records,league);
 const events=offseason(seed,yearIndex,career,records,byId,picks);
 const row={year,records,league,awards:honors,events};career.years.push(row);career.events.push(...events);return row;
}
function history(career,id){return career.years.map(y=>y.records.find(s=>s.playerId===id)).filter(Boolean);}
function review(career,picks,byId){
 return TEAMS.map(t=>{
  const own=picks.filter(s=>s.teamId===t.id),ids=new Set(own.map(s=>s.playerId)),records=career.years.flatMap(y=>y.records.filter(r=>ids.has(r.playerId)));
  const total=records.reduce((n,r)=>n+r.contribution,0),atHome=records.filter(r=>r.teamId===t.id).reduce((n,r)=>n+r.contribution,0);
  const debut=own.filter(s=>history(career,s.playerId).some(r=>r.stats.games>0)).length;
  const established=own.filter(s=>history(career,s.playerId).some(r=>r.route==='regular')).length;
  const development=mean(own.map(s=>{const h=history(career,s.playerId);return (h.at(-1)?.scoutReady??byId[s.playerId].ready)-byId[s.playerId].ready;}));
  const club={...t,...S.plans(career.seed,TEAMS)[t.id]};
  const needs=t.needs.reduce((n,role,i)=>{const candidates=own.map(s=>byId[s.playerId]).filter(p=>p.role===role);return n+(candidates.length?[50,30,20][i]*Math.max(...candidates.map(p=>fit(p,club)))/[100,80,60][i]:0);},0);
  const production=clamp(total/(own.length*Math.max(1,career.years.length)*30)*100,0,100);
  const growth=clamp(development*3.5+35,0,100);
  const score=round(needs*.2+production*.5+growth*.3);
  return {teamId:t.id,count:own.length,total:round(total),atHome:round(atHome),debut,established,development:round(development,1),score,grade:score>=85?'A':score>=70?'B':score>=55?'C':'D',pending:own.filter(s=>{const st=career.players[s.playerId];return st.status==='active'&&st.age<=24&&st.scoutReady<byId[s.playerId].scoutCeiling;}).length,released:own.filter(s=>career.players[s.playerId].status==='released').length,awards:career.years.flatMap(y=>y.awards).filter(a=>ids.has(a.playerId)&&a.scope==='draft-class').length};
 }).sort((a,b)=>b.score-a.score||b.total-a.total||a.teamId.localeCompare(b.teamId));
}
root.DraftCareer={SEASONS,create,advance,history,totalStats,review,standings};if(typeof module!=='undefined'&&module.exports)module.exports=root.DraftCareer;
})(typeof window!=='undefined'?window:globalThis);
