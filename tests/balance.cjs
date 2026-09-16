/* Deterministic all-AI experiments. These are game-model targets, NOT actual KBO statistics. */
const C=require('../src/engine.js'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const percent=(a,b)=>+(100*a/b).toFixed(2),results=[];
for(const difficulty of ['easy','normal','hard']){
 const rounds=Array.from({length:6},()=>({count:0,debut:0,regular:0}));let picks=0,noDebut=0,hs=0,metPlan=0,base=0,final=0,fans=0,teams=0,publicScore=0;
 for(let i=0;i<200;i++){
  const g=C.createGame('kiwoom',i%2===0,'balance-v04-'+i,difficulty);C.beginDraft(g);while(g.phase==='draft')C.addPick(g,C.aiChoice(g).id);
  for(const s of g.picks){const p=C.getPlayer(g,s.playerId),o=C.simulatePlayer(p,s,g),row=rounds[s.round];row.count++;row.debut+=o.stats.games>0;row.regular+=o.route==='regular';picks++;hs+=p.pathway==='고졸';publicScore+=p.publicScore;if(!o.stats.games){noDebut++;metPlan+=o.planScore>=70;}}
  for(const t of C.TEAMS){const copy={...g,teamId:t.id,gmChoice:null,season:null,owner:null};C.chooseGM(copy,['immediate','development','needs'][i%3]);C.runSeason(copy);base+=copy.owner.baseScore;final+=copy.owner.score;fans+=C.fanState(copy).score;teams++;}
 }
 const late=rounds[4].regular+rounds[5].regular,lateCount=rounds[4].count+rounds[5].count;
 assert(noDebut/picks>.55);assert(rounds[1].debut/rounds[1].count>rounds[5].debut/rounds[5].count);assert(late>0&&late/lateCount<.025);assert(hs/picks>.65);assert(metPlan/noDebut>.35);
 results.push({difficulty,drafts:200,picks,noDebutPercent:percent(noDebut,picks),highSchoolPercent:percent(hs,picks),developmentMetPlanPercent:percent(metPlan,noDebut),lateRegularPercent:percent(late,lateCount),averagePublicScore:+(publicScore/picks).toFixed(2),averageBaseOwnerScore:+(base/teams).toFixed(2),averageFinalOwnerScore:+(final/teams).toFixed(2),averageFanScore:+(fans/teams).toFixed(2),rounds:rounds.map((r,i)=>({round:i,sample:r.count,debutPercent:percent(r.debut,r.count),regularPercent:percent(r.regular,r.count)}))});
}
const report={notice:'각 난이도에서 AI가 모든 구단을 지명한 게임용 실험입니다. 사람 플레이 난이도 순위를 증명하거나 실제 KBO 통계를 재현한 결과가 아닙니다.',drafts:600,picks:results.reduce((s,r)=>s+r.picks,0),results};
fs.writeFileSync(path.join(__dirname,'balance-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));console.log('PASS all three difficulty balance checks.');
