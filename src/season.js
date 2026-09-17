/* V0.5 yearly development. All coefficients are fictional game tuning, not KBO statistics.
   Draft investment adds a temporary opportunity bonus, never hidden talent. */
(function(root){
'use strict';
const D=root.DraftData||(typeof require!=='undefined'?require('./data.js'):null);
const {rng,clamp,round,mean,pick,normal,ROLES}=D;
const K=D.ko;
const sigmoid=x=>1/(1+Math.exp(-x));
function emptyStats(p){return ['SP','RP'].includes(p.role)?{kind:'pitcher',games:0,outs:0,er:0,era:null,k:0,bb:0,wins:0,holds:0,saves:0}:{kind:'hitter',games:0,ab:0,pa:0,hits:0,bb:0,hr:0,doubles:0,triples:0,avg:null,ops:null,rbi:0,sb:0};}
function hittingStats(p,games,ability,level,r){
 const regular=level==='major-regular',futures=level==='futures';
 const ab=Math.max(1,round(games*(regular?3.35:futures?2.9:1.5+r())));
 const target=clamp((futures?.175:.13)+ability*(futures?.0018:.0018)+normal(r)*.025,.155,.355);
 // Small samples have wider variation, while all displayed rates derive from counting stats.
 let hits=0;for(let i=0;i<ab;i++)if(r()<target)hits++;
 const bb=Math.max(0,round(ab*(.035+p.control/1500)+normal(r)*3));
 const hr=Math.min(hits,Math.max(0,round(ab*(Math.max(0,p.power-32)/2600)*(futures?1.15:.75)*(.5+r()))));
 const doubles=Math.min(hits-hr,round(hits*(.10+p.power/900))),triples=Math.min(hits-hr-doubles,Math.floor(games*p.speed/4000*r()));
 const avg=round(hits/ab,3),ops=round((hits+bb)/(ab+bb)+(hits+doubles+2*triples+3*hr)/ab,3);
 return {kind:'hitter',games,ab,pa:ab+bb,hits,bb,hr,doubles,triples,avg,ops,rbi:round((hits*.30+hr)*(.75+r()*.5)),sb:round(games*(p.speed-30)/650*r())};
}
function pitchingStats(p,games,ability,level,r){
 const futures=level==='futures',regular=level==='major-regular';
 const perGame=p.role==='SP'?(futures?3.3:regular?4.3:1.9):(.7+r()*.45);
 const outs=Math.max(games,round(games*perGame*3)),ip=outs/3;
 const target=clamp((futures?7.4:8.4)-ability*.05+normal(r)*1.1,2.0,10.0);
 const er=Math.max(0,round(target*ip/9+normal(r)*Math.sqrt(ip)*.45)),era=round(er*27/outs,2);
 const k=round(ip*(.44+ability/175)),bb=round(ip*Math.max(.15,.69-p.control/170));
 const wins=Math.min(games,Math.max(0,Math.floor(games*(p.role==='SP'?.24:.07)*r())));
 const holds=p.role==='RP'&&!futures?Math.floor(games*.26*r()):0;
 const saves=p.role==='RP'&&regular?Math.floor(Math.max(0,games-wins-holds)*.1*r()):0;
 return {kind:'pitcher',games,outs,er,era,k,bb,wins,holds,saves};
}
function statsFor(p,games,ability,level,r){if(games===0)return emptyStats(p);return ['SP','RP'].includes(p.role)?pitchingStats(p,games,ability,level,r):hittingStats(p,games,ability,level,r);}
function simulatePlayer(original,selection,g,team,fit,previous=null,yearIndex=0){
 const abilityBefore=previous?.ability??original.trueReady;
 const toolDelta=(abilityBefore-original.trueReady)*.55;
 const p={...original,trueReady:abilityBefore,ready:previous?.scoutReady??original.ready,power:clamp(original.power+toolDelta,20,96),control:clamp(original.control+toolDelta,20,96),defense:clamp(original.defense+toolDelta,20,96)};
 const r=rng(g.seed+'-performance-v5-'+yearIndex+'-'+p.id+'-'+team.id);
 const healthR=rng(g.seed+'-health-v5-'+yearIndex+'-'+p.id),growR=rng(g.seed+'-growth-v5-'+yearIndex+'-'+p.id);
 const limited=healthR()<clamp(p.risk+(previous?.limited?.045:0),.03,.3),adaptation=normal(r)*(yearIndex===0?9:6);
 // A rare unanticipated technical leap. Scouts do not know this outcome in advance.
 const leap=r()<.024&&p.trueReady>=42;
 const impact=clamp(p.trueReady+adaptation+(leap?19+r()*8:0)-(limited?9:0),20,94);
 const investment=selection.round===0?.26:selection.round===1?.27:selection.round===2?.17:selection.round===3?.07:0;
 const opportunity=investment*(yearIndex===0?1:yearIndex===1?.3:0);
 const continuity=previous?.route==='regular'?.18:previous?.route==='backup'?.08:0;
 const debutChance=clamp((.025+sigmoid((impact-61)/7)*.78)*(fit>=80?1.08:fit>=60?1:.90)+opportunity+continuity+(yearIndex>0?.025:0)-(limited?.06:0),.01,.98);
 const debut=r()<debutChance;
 const regularChance=clamp(sigmoid((impact-(yearIndex===0?70:67))/7)*(yearIndex===0?.60:.67)+(previous?.route==='regular'?.12:0),.005,.88);
 let route='futures';
 if(debut){route=r()<regularChance?'regular':r()<clamp((impact-40)/60,.08,.58)?'backup':'cameo';}
 if(limited&&route==='regular')route='backup';
 const pitcher=['SP','RP'].includes(p.role);
 let games=0;
 if(route==='cameo')games=pitcher?1+Math.floor(r()*5):2+Math.floor(r()*10);
 if(route==='backup')games=pitcher?(p.role==='SP'?6+Math.floor(r()*7):12+Math.floor(r()*15)):18+Math.floor(r()*30);
 if(route==='regular')games=pitcher?(p.role==='SP'?16+Math.floor(r()*9):34+Math.floor(r()*22)):65+Math.floor(r()*45);
 const stats=statsFor(p,games,impact,route==='regular'?'major-regular':'major',r);
 const contribution=!debut?0:stats.kind==='pitcher'?clamp(stats.outs/3*.64+(5.5-stats.era)*4,0,100):clamp(stats.pa*.12+(stats.ops-.65)*22,0,100);
 const age=D.bio.ageAt(p.birthday,`${D.bio.ENTRY_YEAR+yearIndex}-12-31`);
 const rawGrowth=(p.upside-p.trueReady)*(.10+growR()*.04)+normal(growR)*4+(p.lateDevelopment&&yearIndex>=2?3:0)+(leap?3:0)-(limited?4:0)-Math.max(0,age-25)*.75;
 const abilityAfter=round(clamp(p.trueReady+clamp(rawGrowth,-6,12),20,p.upside));
 const growth=abilityAfter-p.trueReady;
 const growthLabel=growth>=9?'뚜렷한 성장':growth>=5?'꾸준한 발전':growth>=2?'기술 발전':growth>=0?'성장 정체':'컨디션·기량 후퇴';
 let futuresGames=pitcher?(p.role==='SP'?13+Math.floor(r()*8):23+Math.floor(r()*17)):63+Math.floor(r()*28);
 if(route==='regular')futuresGames=pitcher?3+Math.floor(r()*5):10+Math.floor(r()*13);
 if(route==='backup')futuresGames=round(futuresGames*.72);
 if(limited)futuresGames=Math.max(3,round(futuresGames*.56));
 if(!pitcher)futuresGames=Math.min(futuresGames,Math.max(0,135-games));
 const futures=statsFor(p,futuresGames,clamp(p.trueReady+growth*.6+normal(r)*5,25,90),'futures',r);
 const routeLabel={futures:'퓨처스 육성',cameo:'짧은 1군 경험',backup:'백업·보조 역할',regular:'1군 안착'}[route];
 let note=pick({
  futures:['첫해는 퓨처스에서 보냈습니다. 1군 미데뷔가 곧 실패를 뜻하지는 않습니다.','콜업보다 기본기와 프로의 훈련 리듬을 익히는 데 집중했습니다.','퓨처스 실전과 기술 훈련을 병행하며 다음 기회를 준비했습니다.'],
  cameo:['잠깐의 콜업으로 프로의 속도를 경험한 뒤 퓨처스로 돌아갔습니다.','1군의 공과 수비 템포를 확인했습니다. 아직 적응 시간이 필요합니다.','짧은 기회에서 과제를 발견했습니다. 작은 표본의 성적은 신중하게 해석해야 합니다.'],
  backup:['제한된 보직에서 경험을 쌓으며 1·2군을 오갔습니다.','주어진 역할을 소화했지만, 자리를 굳히려면 경쟁력을 더 키워야 합니다.','주전 뒤에서 기회를 받으며 프로 무대에서의 활용법을 찾았습니다.'],
  regular:['신인으로서는 드물게 1군에서 꾸준한 역할을 얻었습니다.','경쟁을 이겨내고 첫해부터 1군의 한 자리를 맡았습니다.','주어진 기회를 놓치지 않았습니다. 이제 이 성과를 유지하는 것이 과제입니다.']
 }[route],r);
 if(yearIndex>0)note=pick({futures:['퓨처스에서 기술을 다듬으며 다음 기회를 준비했습니다.','1군 자리를 얻지 못했지만 퓨처스에서 실전을 이어갔습니다.'],cameo:['짧은 콜업에서 가능성과 보완 과제를 함께 확인했습니다.','제한적인 1군 기회를 받은 뒤 퓨처스에서 경험을 쌓았습니다.'],backup:['1·2군을 오가며 백업과 보조 역할을 맡았습니다.','제한된 기회 속에서 맡은 보직을 소화했습니다.'],regular:['1군에서 꾸준한 역할을 소화했습니다. 이제 유지가 과제입니다.','경쟁을 이겨내고 1군의 한 자리를 지켰습니다.']}[route],r);
 if(limited)note+=' 컨디션 문제로 훈련과 출전이 일부 줄었습니다.';
 const developmentNote=growth>=10?`${p.focus}에서 분명한 개선이 관찰됐습니다. 다음 단계의 훈련을 준비합니다.`:growth>=6?`${p.focus} 과제를 반복하며 안정적인 동작이 늘었습니다.`:growth>=3?`${K.p(p.focus,'을/를')} 아직 다지는 중입니다. 일정한 수행 능력을 만드는 것이 목표입니다.`:`${p.focus}의 개선 속도가 기대보다 느렸습니다. 훈련 방식과 목표를 재점검합니다.`;
 // Evaluate the plan stated BEFORE the draft: developmental players are not punished for zero MLB-equivalent appearances.
 const expectedGrowth=clamp((p.upside-p.trueReady)*.075+3.8,5,9);
 const progress=clamp(growth/expectedGrowth,0,1.25);
 const target=p.ready>=66?'1군 경쟁 도전':'퓨처스 적응·기술 발전';
 const planScore=round(clamp(p.ready>=66?30+progress*24+(debut?15:0)+Math.min(26,contribution*.4):30+progress*48+(debut?4:0)-(limited?3:0),10,100));
 const reportR=rng(g.seed+'-report-v5-'+yearIndex+'-'+p.id);
 const scoutReady=round(clamp(abilityAfter+normal(reportR)*8,20,95));
 return {playerId:p.id,label:selection.label,year:D.bio.ENTRY_YEAR+yearIndex,teamId:team.id,age,route,routeLabel,stats,futures,growth,growthLabel,developmentNote,note,limited,contribution:round(contribution),planScore,target,unexpected:route==='regular'&&leap,scoutReady,endState:{ability:abilityAfter,scoutReady,route,limited,age}};
}
function evaluate(g,season,players,team){
 const roles=new Set(players.map(p=>p.role));
 const needScore=team.needs.reduce((s,role,i)=>s+(roles.has(role)?[50,30,20][i]:0),0);
 const production=round(mean(season.map(s=>s.planScore)));
 const future=round(clamp((mean(players.map(p=>p.upside))-40)*1.2+mean(season.map(s=>s.growth))*2.1,0,100));
 const score=round(needScore*.4+production*.25+future*.35);
 const grade=score>=89?'A':score>=77?'B':score>=63?'C':'D';
 const majorCount=season.filter(s=>s.stats.games>0).length,regularCount=season.filter(s=>s.route==='regular').length;
 const text=grade==='A'?'보강 방향과 육성의 실행이 함께 보입니다. 성급한 콜업보다 각 선수의 다음 단계를 잘 준비해야 합니다.':grade==='B'?'좋은 출발입니다. 첫해 숫자에 흔들리지 말고, 선수마다 세운 육성 계획을 이어가야 합니다.':grade==='C'?'가능성은 남아 있습니다. 채우지 못한 자리와 성장 속도를 점검하고 훈련 계획을 더 구체화해야 합니다.':'선택과 활용 계획을 다시 맞춰볼 필요가 있습니다. 선수를 포기하기보다 보강 방향과 육성 목표부터 재점검해야 합니다.';
 const planMessage=`1군 경험 ${majorCount}명 · 퓨처스 전념 ${season.length-majorCount}명. 첫해 계획 이행은 사전 준비도에 따라 1군 도전 또는 퓨처스 기술 발전을 평가합니다. 미데뷔만으로 감점하지 않습니다.`;
 return {score,grade,needScore,production,future,text,missing:team.needs.filter(role=>!roles.has(role)).map(role=>ROLES[role]),majorCount,regularCount,developmentCount:season.length-majorCount,planMessage};
}
const api={simulatePlayer,evaluate,emptyStats};root.DraftSeason=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
