/* DRAFT ROOM v0.5 — quota-safe draft, deterministic five-year careers and replay validation. */
(function(root){
'use strict';
const D=root.DraftData||(typeof require!=='undefined'?require('./data.js'):null);
const TEAMS=root.DraftClubs||(typeof require!=='undefined'?require('./clubs.js'):null);
const M=root.DraftSeason||(typeof require!=='undefined'?require('./season.js'):null);
const Career=root.DraftCareer||(typeof require!=='undefined'?require('./career.js'):null);
const R=root.DraftRules||(typeof require!=='undefined'?require('./rules04.js'):null);
const Press=root.DraftPress||(typeof require!=='undefined'?require('./press.js'):null);
const {ROLES,REGIONS,rng,pick,clamp,round}=D;
const K=D.ko,Bio=D.bio;
// V0.5 has its own save namespace and deterministic model; V0.4 remains untouched.
const RELEASE='0.5.0',VERSION=5,ROUNDS=7,POOL_SIZE=200;
const CONFIG=Object.freeze({nationalRounds:ROUNDS,seasonCount:Career.SEASONS,collegeQuota:1,earlyCountsForQuota:false});
const teamById=Object.fromEntries(TEAMS.map(t=>[t.id,t]));
let activePool=null;const cache=new Map();
function poolFor(g){const seed=String(typeof g==='string'?g:g.seed);if(!cache.has(seed)){cache.set(seed,D.generatePool(seed));if(cache.size>3)cache.delete(cache.keys().next().value);}activePool=cache.get(seed);return activePool;}
function getPlayer(g,id){return poolFor(g).byId[id];}
function innings(outs){return `${Math.floor(outs/3)}.${outs%3}`;}
function fit(p,t){const i=t.needs.indexOf(p.role);return i===0?100:i===1?80:i===2?60:25;}
function fitLabel(p,t){return fit(p,t)>=80?'핵심 보강':fit(p,t)>=60?'뎁스 보강':'여유 자원';}
function outlook(p){return p.ready>=66?'1군 경쟁 후보':p.ready>=54?'적응 후 도전':'퓨처스 육성 우선';}
function upsideLabel(p){return p.scoutCeiling>=86?'주축 성장 기대':p.scoutCeiling>=74?'주전 성장 기대':'역할 확보 기대';}
function makeSchedule(local){const a=[];if(local)for(const t of TEAMS)a.push({teamId:t.id,round:0,label:'지역 1차'});for(let round=1;round<=ROUNDS;round++)for(const t of TEAMS)a.push({teamId:t.id,round,label:round+'R'});return a;}
function publicPool(g){return poolFor(g).players.map(R.project);}
function createGame(teamId,local=false,seed='default',difficulty='normal'){
 if(!Object.hasOwn(teamById,teamId)||!Object.hasOwn(R.DIFFICULTIES,difficulty))throw Error('구단 또는 난이도를 확인해야 합니다.');
 const g={version:VERSION,teamId,local:!!local,seed:String(seed),difficulty,draftDate:Bio.DRAFT_DATE,phase:'preview',schedule:makeSchedule(local),cursor:0,picks:[],news:[],gmChoice:null,season:null,owner:null,career:null};
 g.forecasts=Press.forecast(publicPool(g),TEAMS,g.local,g.seed);return g;
}
function beginDraft(g){if(g.phase!=='preview'||g.cursor!==0)throw Error('이미 시작한 드래프트입니다.');g.phase='draft';return g;}
function quotaStatus(g,teamId=g.teamId){const byId=poolFor(g).byId;const count=g.picks.filter(s=>s.teamId===teamId&&byId[s.playerId]?.quotaEligible).length;const remaining=g.schedule.slice(g.cursor).filter(s=>s.teamId===teamId&&s.round>0).length;return {count,required:CONFIG.collegeQuota,missing:Math.max(0,CONFIG.collegeQuota-count),remaining};}
function available(g,slot=g.schedule[g.cursor]){
 if(!slot)return [];const used=new Set(g.picks.map(s=>s.playerId));let list=poolFor(g).players.filter(p=>!used.has(p.id));
 if(slot.round===0)return list.filter(p=>Bio.eligible(p,teamById[slot.teamId]));
 const q=quotaStatus(g,slot.teamId),demand=TEAMS.reduce((n,t)=>n+quotaStatus(g,t.id).missing,0),supply=list.filter(p=>p.quotaEligible).length;
 if(q.missing&&q.remaining<=q.missing)list=list.filter(p=>p.quotaEligible);
 else if(!q.missing&&supply<=demand)list=list.filter(p=>!p.quotaEligible);
 return list;
}
function addPick(g,id){if(g.phase!=='draft')throw Error('드래프트 진행 중에만 지명할 수 있습니다.');const slot=g.schedule[g.cursor];if(!slot||!available(g,slot).some(p=>p.id===id))throw Error('현재 순서에서 지명할 수 없는 선수입니다.');const p=getPlayer(g,id);const s={...slot,playerId:id,overall:g.cursor+1,fit:fit(p,teamById[slot.teamId])};if(s.round<=1)g.news.push(Press.news(publicPool(g),TEAMS,s,g.picks,g.forecasts,g.seed));g.picks.push(s);g.cursor++;if(g.cursor===g.schedule.length)g.phase='interviews';return s;}
function aiChoice(g){const slot=g.schedule[g.cursor];if(!slot||g.phase!=='draft')return null;const t=teamById[slot.teamId];const prior=g.picks.filter(s=>s.teamId===t.id).map(s=>R.project(getPlayer(g,s.playerId)));const ranked=R.aiScores(available(g).map(R.project),t,prior,g.difficulty,g.seed+'-ai-'+g.cursor);return ranked.length?getPlayer(g,ranked[0].id):null;}
function advanceToUser(g){const out=[];while(g.phase==='draft'&&g.cursor<g.schedule.length&&g.schedule[g.cursor].teamId!==g.teamId){const p=aiChoice(g);if(!p)throw Error('후보 부족');out.push(addPick(g,p.id));}return out;}
const myPicks=g=>g.picks.filter(s=>s.teamId===g.teamId);
function interview(p,s,g,context='live'){
 const t=teamById[s.teamId||g.teamId],r=rng(g.seed+'-voice-'+p.id+'-'+context),fav=TEAMS[p.favoriteTeam].id===t.id;
 const actual=(s.round-1)*10+TEAMS.findIndex(x=>x.id===t.id)+1;
 let openings;
 if(s.round===0)openings=[`${p.region}에서 야구를 배운 선수로서 이 선택이 더 뜻깊습니다.`,`${p.school}에서 함께 땀 흘린 친구들이 먼저 떠오릅니다.`,`연고 지역을 대표한다는 책임감을 느낍니다.`];
 else if(p.pathway==='독립구단')openings=[`${K.p(p.history.at(-2).name,'을/를')} 거쳐 ${p.school}에서 다시 기회를 준비했습니다.`,'다시 불릴 수 있다고 믿고 버텼습니다. 기다려 준 가족들에게 고맙습니다.','훈련을 마치고 혼자 돌아가던 날들이 생각납니다. 이제 새로운 출발입니다.'];
 else if(p.pathway==='대학 얼리')openings=[`${p.school} 2학년으로 조기 도전에 나섰습니다. 배움의 자세로 시작하겠습니다.`,'졸업 전에 선택한 도전인 만큼 책임감을 가지고 준비하겠습니다.','대학에서 배운 것을 바탕으로 프로의 긴 시즌에 적응하겠습니다.'];
 else if(p.pathway==='대졸')openings=[`${K.p(p.highSchoolName,'을/를')} 거쳐 ${p.school}에서 준비한 시간이 떠오릅니다.`,`대학 무대에서 제 부족한 점을 배우고 보완했습니다.`,`고교 졸업 후 ${K.p(p.school,'을/를')} 선택한 것은 제 야구를 다지는 기회였습니다.`];
 else if(p.pathway==='해외파')openings=['멀리서 쌓은 경험을 이제 이 무대에서 보여드리고 싶습니다.',`${p.school}에서 익힌 것을 한국 야구에 맞게 다듬겠습니다.`,'새로운 환경에 적응하는 데 주저하지 않겠습니다.'];
 else if(p.rank<actual-12)openings=['이름이 불릴 때까지 긴장을 많이 했습니다. 이제 출발선은 같다고 생각합니다.','기다린 시간이 길었지만 유니폼을 입는 순간만 생각하고 있었습니다.','예상보다 늦게 불렸지만, 앞으로 보여드릴 것이 더 중요합니다.'];
 else if(p.rank>actual+12)openings=['생각보다 일찍 불러 주셔서 놀랐습니다. 믿어 주신 만큼 더 준비하겠습니다.','제 가능성을 높게 봐주신 것 같아 책임감이 큽니다.','기대 이상의 순서로 불렸습니다. 제 장점을 확실히 살리겠습니다.'];
 else openings=[`${t.short}의 선택을 받아 정말 기쁩니다.`,`${p.school}에서 함께 준비한 동료들과 이 기쁨을 나누고 싶습니다.`,'야구를 시작했을 때부터 기다려 온 순간입니다.','끝까지 응원해 주신 가족과 지도자분들께 감사드립니다.'];
 const ends=p.ready>=66?['1군 경쟁부터 부딪쳐 보겠습니다. 맡겨 주시는 역할을 해내겠습니다.','바로 통할 것이라고 단정하지는 않겠습니다. 캠프에서 하나씩 증명하겠습니다.','첫 시즌부터 팀에 보탬이 되도록 준비하겠습니다.']:['첫해를 서두르지 않겠습니다. 퓨처스에서 기본기를 다지겠습니다.',`${p.focus}에 먼저 집중하겠습니다. 매달 달라지는 모습을 보여드리겠습니다.`,'조급해하지 않고 몸과 기술을 프로 수준으로 끌어올리겠습니다.','경기에 나서지 못하는 날에도 배울 것을 찾겠습니다.'];
 const personality={
  '차분한 노력파':'말보다 훈련으로 보여드리고 싶습니다.','승부욕 강한 도전자':'같은 포지션 선배들에게도 당당하게 도전하겠습니다.','밝은 분위기 메이커':'먼저 인사하고 많이 묻는 신인이 되겠습니다.','분석을 즐기는 연구형':'제 경기 영상을 보면서 개선점을 찾고 있습니다.','책임감 강한 리더':'함께 성장하는 동료가 되겠습니다.','말보다 행동하는 실천형':'매일 정해 둔 훈련부터 지키겠습니다.','꾸준함을 믿는 성실형':'하루의 작은 차이가 쌓인다고 믿습니다.','큰 무대를 즐기는 대담형':'관중 앞에서 제 야구를 보여드릴 날이 기다려집니다.'
 };
 return [pick(openings,r),fav?`응원하던 ${t.short}의 유니폼이라 더 특별합니다.`:personality[p.personality],pick(ends,r)].join(' ');
}
function coach(p,g){const t=teamById[g.teamId],r=rng(g.seed+'-coach-'+p.id);
 const start=fit(p,t)>=60?pick([`${ROLES[p.role]} 자원을 넓히려는 방향에 맞는 선택입니다.`,`우리 팀이 준비해 온 ${ROLES[p.role]} 보강 계획에 들어맞습니다.`,`필요했던 ${ROLES[p.role]} 자리에서 경쟁을 만들어 줄 선수입니다.`],r):pick(['당장의 빈자리보다 이 선수만의 장점을 먼저 봤습니다.','포지션이 겹치더라도 경쟁력 있는 재능은 확보할 가치가 있습니다.','지금 전력에 없는 유형을 더해 보고 싶었습니다.'],r);
 const end=p.ready>=66?pick(['캠프에서 경쟁할 기회를 주겠습니다. 첫해의 자리는 스스로 만들어야 합니다.','당장 기여할 가능성을 봤지만, 프로 적응 과정을 면밀하게 지켜보겠습니다.','보직을 미리 약속하지는 않겠습니다. 준비한 만큼 기회를 주겠습니다.'],r):pick([`${K.p(p.focus,'을/를')} 중심으로 육성 계획을 세우겠습니다. 첫해 1군 성적을 서두르지 않겠습니다.`,'퓨처스 코치진과 차근차근 준비시키겠습니다. 빠른 데뷔보다 좋은 습관이 먼저입니다.','프로의 훈련량과 긴 시즌에 적응하는 것이 우선입니다. 기다려 줄 가치가 있다고 봅니다.','첫해에는 결과보다 몸과 기술이 어떻게 달라지는지 보겠습니다.'],r);
 return start+' '+p.strength+' '+end;
}
function scoutAdvice(p,g){const t=teamById[g.teamId],mine=myPicks(g),byId=poolFor(g).byId,owned=mine.filter(s=>byId[s.playerId].role===p.role).length;
 const candidates=available(g),similar=candidates.filter(q=>q.role===p.role&&q.rank<=p.rank+15).length;
 const missing=t.needs.filter(role=>!mine.some(s=>byId[s.playerId].role===role));
 const lines=[];
 lines.push(p.ready>=66?'캠프에서 1군 경쟁에 도전할 준비도는 보입니다. 다만 자리를 보장받을 수준으로 단정하면 안 됩니다.':p.ready>=54?'기본기는 있지만 프로 공에 적응할 시간이 필요합니다. 짧은 콜업보다 꾸준한 육성도 괜찮은 첫해입니다.':'첫해는 퓨처스 중심으로 보는 편이 안전합니다. 지금 성적보다 육성 과제를 감당할 수 있는지 판단해야 합니다.');
 if(owned>0)lines.push(`이미 ${ROLES[p.role]} ${owned}명을 지명했습니다. ${missing.length?'아직 채우지 못한 '+ROLES[missing[0]]+' 자리도 함께 살펴볼 필요가 있습니다.':'중복 지명을 해도 보강 점수가 더 올라가지는 않습니다.'}`);
 else lines.push(fit(p,t)>=60?`${K.p(ROLES[p.role],'은/는')} 우리 팀의 ${t.needs.indexOf(p.role)+1}순위 보강 과제입니다. 이 선수의 장점을 쓸 자리는 있습니다.`:'우선 보강 포지션은 아닙니다. 다른 자리를 포기하고도 이 재능을 택할지 판단해야 합니다.');
 lines.push(`현재 지명 가능한 ${ROLES[p.role]} 중 이 선수 순위 +15위 이내 후보는 ${similar}명입니다. ${similar<=2?'선택지가 적지만, 서두른 지명이 늘 정답은 아닙니다.':'비슷한 후보의 강점과 준비도를 비교할 필요가 있습니다.'}`);
 if(p.awards.length)lines.push('대표팀·대회 경력은 경험의 단서입니다. 경기 수준과 표본 크기까지 고려해야 합니다.');
 else if(p.record.kind==='pitcher'&&p.record.outs<90)lines.push('시즌 투구 표본이 작은 편입니다. 좋은 평균자책점만으로 안정성을 확신하기는 어렵습니다.');
 else lines.push(`${K.p(p.focus,'이/가')} 육성의 주요 과제입니다. 스카우팅 평가는 예측이며 숨겨진 재능을 확정하는 정보가 아닙니다.`);
 if(p.schoolTier)lines.push(p.schoolTier==='명문'?'명문 야구부의 훈련 환경은 장점입니다. 하지만 학교 평판이 개인의 성장 한계를 보장하지는 않습니다.':p.schoolTier==='약소'?'야구부 평판은 약소로 분류되지만, 개인의 잠재력을 제한하는 조건은 아닙니다. 선수 자체의 장점을 확인해야 합니다.':`현재 소속의 야구부 평판은 ${p.schoolTier}입니다. 과거 출신 학교와 현재 소속을 구분해서 평가해야 합니다.`);
 if(g.difficulty==='hard')return {title:p.name+'에 대한 스카우트 팀장의 조언',lines:[p.strength,p.weakness,'하드 난이도에서는 비교 후보와 보강 권고를 제공하지 않습니다. 공개 기록과 구단 과제를 직접 비교해야 합니다.']};
 if(g.difficulty==='easy'){const alternatives=candidates.filter(q=>q.id!==p.id).sort((a,b)=>(b.publicScore+fit(b,t)*.12)-(a.publicScore+fit(a,t)*.12)).slice(0,2);lines.push('비교 후보는 '+alternatives.map(q=>q.name+' · '+ROLES[q.role]+' · 공개 '+q.rank+'위').join(', ')+'입니다. 공개 평가에 따른 참고이며 정답은 아닙니다.');}
 return {title:p.name+'에 대한 스카우트 팀장의 조언',lines};
}
function simulatePlayer(p,s,g){return M.simulatePlayer(p,s,g,teamById[s.teamId||g.teamId],fit(p,teamById[s.teamId||g.teamId]));}
function gmOptions(g){return Press.gmOptions(myPicks(g).map(s=>R.project(getPlayer(g,s.playerId))),teamById[g.teamId]);}
function chooseGM(g,choice){if(g.phase!=='interviews'||g.cursor!==g.schedule.length||g.gmChoice||g.season||!Press.GM_CHOICES.some(c=>c.id===choice))throw Error('인터뷰 답변은 드래프트 종료 후 한 번만 선택할 수 있습니다.');g.gmChoice=choice;return gmOptions(g).find(c=>c.id===choice);}
function fanState(g){
 const timeline=[{label:'시작 전',delta:0,score:50}];let score=50;
 function entry(label,delta){score=clamp(score+delta,0,100);timeline.push({label,delta,score});}
 for(const n of g.news.filter(n=>n.teamId===g.teamId))entry(n.reason,n.delta);
 if(g.gmChoice){const c=gmOptions(g).find(c=>c.id===g.gmChoice);entry('단장 인터뷰 · '+c.title,c.delta);}
 if(g.season){const a=Press.accountability(g.gmChoice,myPicks(g).map(s=>R.project(getPlayer(g,s.playerId))),g.season,teamById[g.teamId]);entry('시즌 후 · '+a.status,a.bonus);}
 return {score,label:score>=65?'기대 우세':score>=45?'관망':score>=30?'우려 우세':'신뢰 회복 필요',timeline};
}
function evaluate(g,season){const players=myPicks(g).map(s=>getPlayer(g,s.playerId)),base=M.evaluate(g,season,players,teamById[g.teamId]);const pledge=Press.accountability(g.gmChoice,players.map(R.project),season,teamById[g.teamId]);const score=clamp(base.score+pledge.bonus,0,100);return {...base,baseScore:base.score,score,grade:score>=89?'A':score>=77?'B':score>=63?'C':'D',pledge};}
function runSeason(g){if(g.cursor!==g.schedule.length||!g.gmChoice)throw Error('드래프트와 단장 인터뷰를 먼저 완료해야 합니다.');const {byId}=poolFor(g);if(!g.career){g.career=Career.create(g.picks,byId);Career.advance(g.career,g.picks,byId,g.seed);g.season=g.career.years[0].records.filter(s=>s.teamId===g.teamId);g.owner=evaluate(g,g.season);}g.phase='season';return g.season;}
function nextSeason(g){if(!g.career||!['season','owner'].includes(g.phase))throw Error('첫 시즌을 먼저 진행해야 합니다.');const result=Career.advance(g.career,g.picks,poolFor(g).byId,g.seed);g.phase='season';return result;}
function careerReview(g){return g.career?Career.review(g.career,g.picks,poolFor(g).byId):[];}
function validate(g){try {
 if(!g||g.version!==VERSION||!Object.hasOwn(R.DIFFICULTIES,g.difficulty)||!Object.hasOwn(teamById,g.teamId)||g.draftDate!==Bio.DRAFT_DATE||typeof g.seed!=='string'||!g.seed.length||g.seed.length>200||typeof g.local!=='boolean'||!['preview','draft','interviews','season','owner'].includes(g.phase)||!Array.isArray(g.picks)||g.picks.length>80)return false;
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),replay=createGame(g.teamId,g.local,g.seed,g.difficulty);
 if(g.cursor!==g.picks.length||!same(g.schedule,replay.schedule)||!same(g.forecasts,replay.forecasts))return false;
 if(g.phase==='preview'){return g.cursor===0&&same(g.news,[])&&g.gmChoice===null&&g.season===null&&g.owner===null&&g.career===null;}
 beginDraft(replay);for(const s of g.picks){if(!s)return false;const expected=addPick(replay,s.playerId);if(!same(s,expected))return false;}
 if((g.phase==='draft')!==(g.cursor<g.schedule.length)||!same(g.news,replay.news))return false;
 if(g.gmChoice!==null)chooseGM(replay,g.gmChoice);
 if(g.career!==null){if(!g.career||!Array.isArray(g.career.years)||g.career.years.length<1||g.career.years.length>Career.SEASONS)return false;runSeason(replay);while(replay.career.years.length<g.career.years.length)nextSeason(replay);}
 if(['season','owner'].includes(g.phase)&&!g.career)return false;
 return same(g.career,replay.career)&&same(g.season,replay.season)&&same(g.owner,replay.owner);
 }catch(_){return false;}
}
const api={CONFIG,Career,quotaStatus,nextSeason,careerReview,ko:K,bio:Bio,catalog:D.catalog,eligible:Bio.eligible,DRAFT_DATE:Bio.DRAFT_DATE,ENTRY_YEAR:Bio.ENTRY_YEAR,RELEASE,VERSION,rules:R,press:Press,publicPool,beginDraft,gmOptions,chooseGM,fanState,ROUNDS,POOL_SIZE,TEAMS,REGIONS,ROLES,teamById,poolFor,getPlayer,innings,fit,fitLabel,outlook,upsideLabel,makeSchedule,createGame,available,addPick,aiChoice,advanceToUser,myPicks,interview,coach,scoutAdvice,simulatePlayer,runSeason,evaluate,validate,rng,clamp};
Object.defineProperties(api,{PLAYERS:{get:()=> (activePool||poolFor('preview')).players},playerById:{get:()=> (activePool||poolFor('preview')).byId}});
root.DraftCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
