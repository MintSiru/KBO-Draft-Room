/* v0.4 public-information boundary: scouting, AI, mock drafts and sorting.
   No reader in this module consults trueReady, upside, risk or lateDevelopment. */
(function(root){
'use strict';
const D=root.DraftData||(typeof require!=='undefined'?require('./data.js'):null);
const {rng,clamp,round}=D;
const DIFFICULTIES={
 easy:{id:'easy',label:'이지',noise:0,jitter:18,fitWeight:.035,duplicate:.8,description:'추가 관찰 오차가 작고, 경쟁 구단의 보강 판단이 단순합니다.'},
 normal:{id:'normal',label:'노말',noise:4,jitter:7,fitWeight:.085,duplicate:3.8,description:'공개 평가에 관찰 오차가 있으며, AI가 보강과 중복 지명을 고려합니다.'},
 hard:{id:'hard',label:'하드',noise:9,jitter:1.5,fitWeight:.15,duplicate:5,description:'관찰 오차가 크고, AI가 남은 보강 과제와 포지션별 후보 수까지 고려합니다.'}
};
const PUBLIC_KEYS=['id','name','familyName','givenName','birthday','age','birthRegion','birthplace','cohort','highSchoolId','highSchoolName','highSchoolRegion','highSchoolGradYear','currentInstitutionId','school','schoolTier','pathText','qualification','regionalEligible','regionalRegion','regionalReason','region','pathway','schoolStyle','role','type','archetype','strength','weakness','focus','height','weight','throwHand','batHand','velocity','personality','favoriteTeam','confidence'];
function publicPool(players,seed,difficulty='normal'){
 const config=DIFFICULTIES[difficulty];if(!config)throw Error('알 수 없는 난이도입니다.');
 const views=players.map(p=>{
  const r=rng(seed+'-public-v4-'+p.id),noise=()=>round((r()*2-1)*config.noise);
  const ready=clamp(p.ready+noise(),20,90),scoutCeiling=clamp(p.scoutCeiling+noise(),35,99);
  const v=Object.fromEntries(PUBLIC_KEYS.map(k=>[k,p[k]]));
  Object.assign(v,{ready,scoutCeiling,publicScore:round(p.publicScore+(ready-p.ready)*.6+(scoutCeiling-p.scoutCeiling)*.4,1),control:clamp(p.control+noise(),20,99),power:clamp(p.power+noise(),20,99),speed:clamp(p.speed+noise(),20,99),defense:clamp(p.defense+noise(),20,99),currentInstitution:{...p.currentInstitution},history:p.history.map(h=>({...h})),record:{...p.record},awards:[...p.awards],schoolTournament:p.schoolTournament?{...p.schoolTournament}:null,scoutingDifficulty:difficulty});
  return v;
 });
 views.sort((a,b)=>b.publicScore-a.publicScore||a.id.localeCompare(b.id));views.forEach((p,i)=>p.rank=i+1);
 return {players:views,byId:Object.fromEntries(views.map(p=>[p.id,p]))};
}
const fit=(p,t)=>{const n=t.needs.indexOf(p.role);return n===0?100:n===1?80:n===2?60:25;};
function aiPick(candidates,team,prior,context){
 const c=DIFFICULTIES[context.difficulty];if(!c)throw Error('알 수 없는 난이도입니다.');
 const counts=Object.fromEntries(Object.keys(D.ROLES).map(role=>[role,candidates.filter(p=>p.role===role).length]));
 return candidates.map(p=>{
  const duplicate=prior.filter(role=>role===p.role).length;
  const missing=team.needs.includes(p.role)&&!duplicate;
  const urgency=c.id==='hard'&&missing?Math.max(0,4-context.remaining)*2:0;
  const scarcity=c.id==='hard'&&missing?Math.min(3,12/Math.max(1,counts[p.role])):0;
  const noise=(rng(context.seed+'-ai-v4-'+context.cursor+'-'+p.id)()-.5)*c.jitter;
  return {p,score:p.publicScore*.85+fit(p,team)*c.fitWeight+(team.bias>.6?p.ready:p.scoutCeiling)*.065-duplicate*c.duplicate+urgency+scarcity+noise};
 }).sort((a,b)=>b.score-a.score||a.p.rank-b.p.rank||a.p.id.localeCompare(b.p.id))[0]?.p||null;
}
const OUTLETS=[
 {id:'baseball-report',name:'베이스볼 리포트',style:'즉시전력 중심',intro:'준비도와 현재 성적, 구단의 보강 과제를 먼저 살펴봅니다.',readyWeight:.64,ceilingWeight:.26,fitWeight:.10},
 {id:'future-focus',name:'퓨처스 포커스',style:'성장 기대·보강 중심',intro:'공개 성장 기대와 포지션 수요를 중심으로 다른 가능성을 제시합니다.',readyWeight:.28,ceilingWeight:.55,fitWeight:.17}
];
function mockDraft(players,teams,context,eligible){
 // Never takes live picks, an AI future schedule result or a simulated season as input.
 return OUTLETS.map(outlet=>{
  const used=new Set(),rows=[];
  for(const roundNumber of (context.local?[0,1]:[1]))for(const [i,t]of teams.entries()){
   const candidates=players.filter(p=>!used.has(p.id)&&(roundNumber!==0||eligible(p,t)));
   const prior=rows.filter(s=>s.teamId===t.id).map(s=>players.find(p=>p.id===s.playerId).role);
   const selected=candidates.map(p=>({p,score:p.ready*outlet.readyWeight+p.scoutCeiling*outlet.ceilingWeight+fit(p,t)*outlet.fitWeight-(prior.includes(p.role)?4:0)+(rng(context.seed+'-mock-v4-'+outlet.id+'-'+roundNumber+'-'+t.id+'-'+p.id)()-.5)*8})).sort((a,b)=>b.score-a.score||a.p.rank-b.p.rank)[0]?.p;
   if(!selected)throw Error('모의 지명 후보가 부족합니다.');used.add(selected.id);
   const need=t.needs.includes(selected.role);
   const reason=(roundNumber===0?'현재 고교·고교 연령 클럽의 연고 자격을 갖췄습니다. ':'')+(need?`${D.ROLES[selected.role]} 보강 수요에 맞는 후보입니다. `:'당장의 빈자리보다 공개 평가상의 재능을 우선했습니다. ')+(outlet.id==='baseball-report'?'즉시전력 준비도와 지명 전 기록을 높게 평가합니다.':'성장 기대와 다음 주축의 가능성에 주목합니다.');
   rows.push({teamId:t.id,round:roundNumber,order:i+1,playerId:selected.id,scoutRank:selected.rank,reason});
  }
  return {id:outlet.id,name:outlet.name,style:outlet.style,intro:outlet.intro,rows};
 });
}
const SORTS=[
 {id:'rank',label:'스카우트 순위',group:'공개 평가',direction:'asc'},
 {id:'fit',label:'우리 팀 적합도',group:'공개 평가',direction:'desc'},
 {id:'ready',label:'즉시전력 준비도',group:'공개 평가',direction:'desc'},
 {id:'scoutCeiling',label:'성장 기대',group:'공개 평가',direction:'desc'},
 ...[['hr','홈런'],['avg','타율'],['rbi','타점'],['ops','OPS'],['hits','안타'],['runs','득점'],['sb','도루'],['pa','타석']].map(([id,label])=>({id,label,group:'타자 기록',kind:'hitter',field:id,direction:'desc'})),
 ...[['velocity','최고 구속','desc'],['era','ERA','asc'],['outs','이닝','desc'],['k','탈삼진','desc'],['bb','볼넷 허용','asc'],['wins','승리','desc']].map(([id,label,direction])=>({id,label,group:'투수 기록',kind:'pitcher',field:id,direction})),
 ...[['control','제구 평가','pitcher'],['power','장타력 평가','hitter'],['speed','주력 평가','hitter'],['defense','수비 평가','hitter']].map(([id,label,kind])=>({id,label,kind,group:'공개 도구 평가',direction:'desc'}))
];
const sortById=Object.fromEntries(SORTS.map(s=>[s.id,s]));
function sortValue(p,id,team){const s=sortById[id];if(!s)return null;if(s.kind&&p.record.kind!==s.kind)return null;const v=id==='fit'?fit(p,team):s.field&&id!=='velocity'?p.record[s.field]:p[id];return Number.isFinite(v)?v:null;}
function sortPlayers(players,id='rank',direction,team){const spec=sortById[id]||sortById.rank;const dir=direction==='asc'||direction==='desc'?direction:spec.direction;
 return [...players].sort((a,b)=>{const x=sortValue(a,spec.id,team),y=sortValue(b,spec.id,team);if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;return (x!==null&&y!==null?(x-y)*(dir==='asc'?1:-1):0)||a.rank-b.rank||a.id.localeCompare(b.id);});
}
const api={DIFFICULTIES,PUBLIC_KEYS,publicPool,aiPick,OUTLETS,mockDraft,SORTS,sortById,sortValue,sortPlayers};
root.DraftScouting=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
