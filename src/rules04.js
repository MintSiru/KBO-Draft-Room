/* v0.4 public-information-only AI, difficulty assistance, and null-safe board sorting. */
(function(root){
'use strict';
const D=root.DraftData||(typeof require!=='undefined'?require('./data.js'):null);
const DIFFICULTIES={
 easy:{name:'이지',hint:'상세 조언과 비교 후보 · 단순한 AI',noise:18},
 normal:{name:'노말',hint:'기존 수준의 조언 · 균형형 AI',noise:5},
 hard:{name:'하드',hint:'핵심 관찰만 제공 · 보강·중복·희소성을 따지는 AI',noise:1.5}
};
function project(p){return {id:p.id,name:p.name,role:p.role,pathway:p.pathway,quotaEligible:p.quotaEligible===true,entryCategory:p.entryCategory,school:p.school,region:p.highSchoolRegion,ready:p.ready,scoutCeiling:p.scoutCeiling,publicScore:p.publicScore,rank:p.rank,schoolTier:p.schoolTier,regionalEligible:!!D.bio.eligible(p,{region:p.highSchoolRegion})};}
function fit(p,t){const n=t.needs.indexOf(p.role);return n===0?100:n===1?80:n===2?60:25;}
function aiScores(candidates,team,prior,difficulty,seed){
 const cfg=DIFFICULTIES[difficulty];if(!cfg)throw Error('알 수 없는 난이도입니다.');
 const r=D.rng(seed),top=[...candidates].sort((a,b)=>b.publicScore-a.publicScore).slice(0,30);
 return candidates.map(p=>{
  const owned=prior.filter(x=>x.role===p.role).length,f=fit(p,team),scarcity=6-Math.min(6,top.filter(x=>x.role===p.role).length);
  let score=difficulty==='easy'?p.publicScore*.85+f*.045-owned*1.5:difficulty==='hard'?p.publicScore*.83+f*.12+(team.bias>.6?p.ready:p.scoutCeiling)*.05-owned*6+(owned===0&&f>=60?scarcity*1.25:0):p.publicScore*.85+f*.085+(team.bias>.6?p.ready:p.scoutCeiling)*.065-owned*3.8;
  return {id:p.id,score:score+(r()-.5)*cfg.noise};
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
const SORTS={
 rank:{label:'스카우트 순위',group:'종합',direction:'asc'},fit:{label:'우리 팀 적합도',group:'종합',direction:'desc'},
 ready:{label:'준비도 추정',group:'능력 추정',direction:'desc'},scoutCeiling:{label:'성장 기대 추정',group:'능력 추정',direction:'desc'},
 power:{label:'장타력 추정',group:'능력 추정',direction:'desc'},control:{label:'제구 추정',group:'능력 추정',direction:'desc'},speed:{label:'주력 추정',group:'능력 추정',direction:'desc'},defense:{label:'수비 추정',group:'능력 추정',direction:'desc'},
 hr:{label:'홈런',group:'타격 기록',direction:'desc'},avg:{label:'타율',group:'타격 기록',direction:'desc'},rbi:{label:'타점',group:'타격 기록',direction:'desc'},ops:{label:'OPS',group:'타격 기록',direction:'desc'},sb:{label:'도루',group:'타격 기록',direction:'desc'},hits:{label:'안타',group:'타격 기록',direction:'desc'},pa:{label:'타석',group:'타격 기록',direction:'desc'},
 velocity:{label:'최고 구속',group:'투구 기록',direction:'desc'},era:{label:'ERA',group:'투구 기록',direction:'asc'},outs:{label:'이닝',group:'투구 기록',direction:'desc'},k:{label:'탈삼진',group:'투구 기록',direction:'desc'},bb:{label:'허용 볼넷',group:'투구 기록',direction:'asc'},wins:{label:'승리',group:'투구 기록',direction:'desc'},games:{label:'경기',group:'공통 기록',direction:'desc'}
};
function sortValue(p,key,team){
 if(!SORTS[key])throw Error('알 수 없는 정렬 항목입니다.');
 const pitcher=p.record.kind==='pitcher';
 if(key==='fit')return fit(p,team);
 if(['rank','ready','scoutCeiling'].includes(key))return p[key];
 if(['power','speed','defense'].includes(key))return pitcher?null:p[key];
 if(['control','velocity'].includes(key))return pitcher?p[key]:null;
 if(['hr','avg','rbi','ops','sb','hits','pa'].includes(key)&&pitcher)return null;
 if(['era','outs','k','bb','wins'].includes(key)&&!pitcher)return null;
 return Number.isFinite(p.record[key])?p.record[key]:null;
}
function sortPlayers(players,key,dir,team){
 if(!['asc','desc'].includes(dir))throw Error('잘못된 정렬 방향입니다.');
 return [...players].sort((a,b)=>{const av=sortValue(a,key,team),bv=sortValue(b,key,team);if(av==null&&bv!=null)return 1;if(bv==null&&av!=null)return -1;return (av==null?0:(av-bv)*(dir==='asc'?1:-1))||a.rank-b.rank||a.id.localeCompare(b.id);});
}
const api={DIFFICULTIES,SORTS,project,fit,aiScores,sortValue,sortPlayers};root.DraftRules=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
