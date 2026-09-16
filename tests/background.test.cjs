const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/engine.js'),D=require('../src/data.js'),B=require('../src/biography.js'),K=require('../src/ko.js'),N=require('../src/names.js'),Cat=require('../src/catalog.js');
const create=C.createGame;C.createGame=(...args)=>{const g=create(...args);C.beginDraft(g);return g;};
const fs=require('node:fs'),path=require('node:path');
const req=JSON.parse(fs.readFileSync(path.join(__dirname,'../audit/requested-catalog.json'),'utf8'));
const ren={...JSON.parse(fs.readFileSync(path.join(__dirname,'../audit/renames.json'),'utf8')).names,...JSON.parse(fs.readFileSync(path.join(__dirname,'../audit/user-renames-v031.json'),'utf8')).names};
const isoValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
test('all 132 requested institutions remain present with original region/tier and documented renames',()=>{
 assert.equal(Cat.institutions.length,132);assert.equal(new Set(Cat.institutions.map(s=>s.id)).size,132);assert.equal(new Set(Cat.institutions.map(s=>s.name)).size,132);
 for(const [tier,regions]of Object.entries(req.highSchools))for(const [region,names]of Object.entries(regions))for(const name of names){const s=Cat.institutions.find(x=>x.original===name);assert(s);assert.equal(s.name,ren[name]||name);assert.equal(s.region,region);assert.equal(s.tier,tier);}
 assert.equal(Cat.institutions.filter(s=>s.kind==='hs-club').length,16);
 assert.deepEqual(Cat.institutions.filter(s=>s.kind==='independent').map(s=>s.name),req.independents);
 const check=JSON.parse(fs.readFileSync(path.join(__dirname,'../audit/neis-name-check.json')));for(const row of check.results.filter(r=>r.matches.length))assert(ren[row.requested]);
 const replacements=JSON.parse(fs.readFileSync(path.join(__dirname,'../audit/replacement-check.json')));assert(!replacements.some(r=>r.matches.length));
});
test('complete given names avoid arbitrary syllables, duplicate full names and repeated adjacent syllables',()=>{
 const given=new Set(N.givenNames.map(x=>x.name));assert(given.size>=300);
 for(let i=0;i<50;i++){const ps=D.generatePool('names-v3-'+i).players;assert.equal(new Set(ps.map(p=>p.name)).size,200);for(const p of ps){assert(given.has(p.givenName));assert.equal(p.name,p.familyName+p.givenName);assert(!/(.)\1/u.test(p.name));assert.notEqual(p.name,'이우우');}}
});
test('birthday, international age, educational chronology and start of rookie season agree',()=>{
 assert.equal(B.ageAt('2008-09-16'),18);assert.equal(B.ageAt('2008-09-17'),17);assert.equal(B.ageAt('2008-02-29'),18);
 let threeStages=0,moved=0,bc=0;
 for(let i=0;i<80;i++)for(const p of D.generatePool('history-'+i).players){
  assert(isoValid(p.birthday));assert.equal(B.ageAt(p.birthday),p.age);assert(p.age>=17&&p.age<=26);assert.equal(p.cohort,Number(p.birthday.slice(0,4)));
  assert.equal(p.history[0].institutionId,p.highSchoolId);assert.equal(p.history.at(-1).institutionId,p.currentInstitutionId);assert.equal(p.pathText,p.history.map(h=>h.name).join(' → '));
  assert.equal(p.highSchoolGradYear,p.cohort+19);
  for(let j=0;j<p.history.length;j++){const h=p.history[j];assert(Cat.byId[h.institutionId]);assert(isoValid(h.start));if(h.end){assert(isoValid(h.end));assert(h.start<h.end);}assert(h.start<=B.DRAFT_DATE);if(j)assert(p.history[j-1].end<h.start);if(h.status==='졸업')assert(h.end<B.DRAFT_DATE);if(h.status==='졸업 예정')assert(h.end>B.DRAFT_DATE&&h.end<'2027-03-01');}
  if(p.pathway==='고졸'){assert.equal(p.cohort,2008);assert.equal(p.history.length,1);assert(p.regionalEligible);if(p.currentInstitution.kind==='hs-club')bc++;}
  if(p.pathway==='대졸'){assert.equal(p.history.length,2);assert.equal(p.history[1].kind,'college');assert(!p.regionalEligible);}
  if(p.pathway==='해외파'){assert.equal(p.history[1].kind,'overseas-college');assert(p.history[1].end<B.DRAFT_DATE);assert.equal(p.history[1].status,'졸업');assert(!p.regionalEligible);}
  if(p.pathway==='독립구단'){assert(p.history.length===2||p.history.length===3);threeStages+=p.history.length===3;assert(!p.regionalEligible);}
  moved+=p.birthRegion!==p.highSchoolRegion;
 }
 assert(threeStages>100);assert(moved>1000);assert(bc>100);
});
test('regional eligibility is current high-school qualification, never birthplace or old school',()=>{
 const g=C.createGame('kiwoom',true,'eligibility-v3'),ps=C.PLAYERS;
 const high=ps.find(p=>p.pathway==='고졸'&&p.region==='서울');assert(C.eligible(high,C.teamById.kiwoom));
 const moved={...high,birthRegion:'경남',birthplace:'김해'};assert(C.eligible(moved,C.teamById.kiwoom));
 for(const p of ps.filter(p=>p.pathway!=='고졸'))for(const t of C.TEAMS)assert(!C.eligible({...p,birthRegion:t.region,regionalEligible:true,regionalRegion:t.region},t));
 const foreignSchool={...high,currentInstitutionId:ps.find(p=>p.pathway==='대졸').currentInstitutionId};assert(!C.eligible(foreignSchool,C.teamById.kiwoom));
 const actual=C.available(g);assert(actual.every(p=>p.pathway==='고졸'&&C.eligible(p,C.teamById.kiwoom)));
 const college=ps.find(p=>p.pathway==='대졸'&&p.highSchoolRegion==='서울');assert(college);assert.throws(()=>C.addPick(g,college.id));
});
test('school reputation shifts preparation but weak programs retain elite potential and shared team honors',()=>{
 const tiers=Object.fromEntries(Object.keys(B.TIERS).map(t=>[t,{ready:[],upside:[],avg:[],era:[]}]));let rareForeign=0,foreign=0;
 for(let i=0;i<150;i++){
  const ps=D.generatePool('tier-test-'+i).players,schools=new Map();
  for(const p of ps){if(p.schoolTier&&p.pathway==='고졸'){const t=tiers[p.schoolTier];t.ready.push(p.ready);t.upside.push(p.upside);if(p.record.kind==='hitter')t.avg.push(p.record.avg);else t.era.push(p.record.era);}
   if(p.pathway==='해외파'){foreign++;rareForeign+=['일본','대만'].includes(p.currentInstitution.country);}
   if(schools.has(p.currentInstitutionId))assert.deepEqual(p.schoolTournament,schools.get(p.currentInstitutionId));else schools.set(p.currentInstitutionId,p.schoolTournament);
  }
 }
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 assert(mean(tiers.명문.ready)-mean(tiers.약소.ready)>4);
 assert(Math.max(...tiers.약소.upside)>=90);assert(Math.min(...tiers.명문.upside)<70);
 assert(mean(tiers.명문.avg)>mean(tiers.약소.avg));assert(mean(tiers.명문.era)<mean(tiers.약소.era));
 assert(rareForeign>0&&rareForeign/foreign<.12);
 console.log('Tier readiness means',Object.fromEntries(Object.entries(tiers).map(([t,v])=>[t,mean(v.ready).toFixed(2)])),'rare overseas',rareForeign+'/'+foreign);
});
test('Korean particles cover final consonants, vowels, rieul exceptions, clubs, numerals and Latin initials',()=>{
 for(const [word,pair,expected]of [['김지훈','은/는','김지훈은'],['이시우','은/는','이시우는'],['김태민','이/가','김태민이'],['하준서','이/가','하준서가'],['구속 유지','이/가','구속 유지가'],['회복 루틴','을/를','회복 루틴을'],['폼 안정화','을/를','폼 안정화를'],['서울','으로/로','서울로'],['인천','으로/로','인천으로'],['김포BC','은/는','김포BC는'],['LG','은/는','LG는'],['NC','이/가','NC가'],['1','으로/로','1로'],['3','으로/로','3으로'],['포수','과/와','포수와'],['선발투수','을/를','선발투수를']])assert.equal(K.p(word,pair),expected);
});
test('generated reports, coach comments, interviews and development prose use formal endings',()=>{
 const disallowed=/(?:한다|된다|있다|없다|갖춰졌다|보인다|과제다|필요하다|좋다|세요|어요|합시다)\./;
 for(let i=0;i<20;i++){const g=C.createGame('kiwoom',false,'language-'+i);const ps=C.PLAYERS;
 for(const p of ps.slice(0,30)){const s={teamId:'kiwoom',round:1,label:'1R'};const season=C.simulatePlayer(p,s,g);const texts=[p.strength,p.weakness,C.coach(p,g),C.interview(p,s,g),...C.scoutAdvice(p,g).lines,season.note,season.developmentNote,p.regionalReason];for(const text of texts){assert(!disallowed.test(text),text);assert(text.endsWith('니다.'),text);}}
 }
});
