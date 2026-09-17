/* Reproducible tuning audit, not empirical KBO statistics. */
const C=require('../src/engine.js'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const perDifficulty=Number(process.env.BALANCE_SEEDS||200),results=[];
const pct=(a,b)=>+(a*100/(b||1)).toFixed(2);
for(const difficulty of ['easy','normal','hard']){
 const rounds=Array.from({length:8},(_,round)=>({round,n:0,debut:0,regular:0})),yearRows=Array.from({length:5},(_,i)=>({year:2027+i,n:0,debut:0,regular:0}));
 let trade=0,release=0,early=0,scores=0,teams=0,fan=0,firstScore=0;
 for(let i=0;i<perDifficulty;i++){
  const g=C.createGame('kiwoom',i%2===0,'balance05-'+i,difficulty);C.beginDraft(g);while(g.phase==='draft')C.addPick(g,C.aiChoice(g).id);C.chooseGM(g,['immediate','development','needs'][i%3]);C.runSeason(g);
  for(const s of g.picks){const rec=g.career.years[0].records.find(x=>x.playerId===s.playerId),r=rounds[s.round];r.n++;r.debut+=rec.stats.games>0;r.regular+=rec.route==='regular';early+=C.getPlayer(g,s.playerId).pathway==='대학 얼리';}
  while(g.career.years.length<5)C.nextSeason(g);
  for(let j=0;j<5;j++)for(const rec of g.career.years[j].records){const r=yearRows[j];r.n++;r.debut+=rec.stats.games>0;r.regular+=rec.route==='regular';}
  trade+=g.career.events.filter(x=>x.type==='trade').length;release+=g.career.events.filter(x=>x.type==='release').length;
  for(const t of C.careerReview(g)){scores+=t.score;teams++;}
  fan+=C.fanState(g).score;firstScore+=g.owner.score;
 }
 const summary=r=>({round:r.round,year:r.year,sample:r.n,debutPercent:pct(r.debut,r.n),regularPercent:pct(r.regular,r.n)});
 const row={difficulty,drafts:perDifficulty,rounds:rounds.map(summary),years:yearRows.map(summary),earlyPicked:early,meanTradesPerDraft:+(trade/perDifficulty).toFixed(2),meanReleasesPerDraft:+(release/perDifficulty).toFixed(2),meanFinalScore:+(scores/teams).toFixed(2),meanFirstYearScore:+(firstScore/perDifficulty).toFixed(2),meanFanScore:+(fan/perDifficulty).toFixed(2)};
 console.log('TUNING',difficulty,JSON.stringify({first:row.rounds[1],score:row.meanFinalScore,years:row.years}));
 assert(row.rounds[1].debutPercent>=60&&row.rounds[1].debutPercent<=90,'first round debut tuning');assert(row.rounds[1].regularPercent>=5&&row.rounds[1].regularPercent<=25,'first round regular tuning');assert(row.rounds[1].debutPercent>row.rounds[7].debutPercent);assert(yearRows[4].regular/yearRows[4].n>yearRows[0].regular/yearRows[0].n);assert(trade>0&&release>0);assert(row.meanFinalScore>=50&&row.meanFinalScore<=90,'final review balance');results.push(row);
}
const report={notice:'V0.5 all-AI synthetic tuning audit. NOT real-world KBO data.',drafts:perDifficulty*3,results};
fs.writeFileSync(path.join(__dirname,'v05-balance-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));console.log('PASS V0.5 balance checks');
