/* Seeded fictional prospects. Public scouting estimates are separate from hidden ability. */
(function(root){
'use strict';
const ROLES={SP:'선발투수',RP:'불펜투수',C:'포수',IF:'내야수',OF:'외야수'};
const Cat=root.DraftCatalog||(typeof require!=='undefined'?require('./catalog.js'):null);
const Bio=root.DraftBio||(typeof require!=='undefined'?require('./biography.js'):null);
const Names=root.DraftNames||(typeof require!=='undefined'?require('./names.js'):null);
const Ko=root.DraftKo||(typeof require!=='undefined'?require('./ko.js'):null);
const G=root.DraftGrades||(typeof require!=='undefined'?require('./grades06.js'):null);
const REGIONS=Bio.REGIONS;
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function rng(seed){let a=hash(seed);return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const round=(n,p=0)=>{const v=Math.round(n*10**p)/10**p;return Object.is(v,-0)?0:v;};
const mean=xs=>xs.reduce((s,x)=>s+x,0)/(xs.length||1);
const pick=(xs,r)=>xs[Math.floor(r()*xs.length)];
function shuffle(xs,r){const out=[...xs];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const normal=r=>(r()+r()+r()-1.5)/1.5;
const SCHOOLS=Object.fromEntries(REGIONS.map(region=>[region,Cat.institutions.filter(x=>['high-school','hs-club'].includes(x.kind)&&x.region===region).map(x=>x.name)]));
const SCHOOL_STYLES=['투수 육성','수비 기본기','타격 중심','기동력 야구'];
const COLLEGES=Cat.institutions.filter(x=>x.kind==='college').map(x=>x.name);
const INDEPENDENTS=Cat.institutions.filter(x=>x.kind==='independent').map(x=>x.name);
const OVERSEAS=Cat.institutions.filter(x=>x.kind==='overseas-college').map(x=>x.name);
const PERSONALITIES=['차분한 노력파','승부욕 강한 도전자','밝은 분위기 메이커','분석을 즐기는 연구형','책임감 강한 리더','말보다 행동하는 실천형','꾸준함을 믿는 성실형','큰 무대를 즐기는 대담형'];
// name, strength, development task, dominant tool
const ARCHETYPES={
 SP:[['강속구 선발','높은 타점의 빠른 공으로 헛스윙을 유도한다.','긴 이닝에서 릴리스 포인트가 흔들린다.','구속 유지'],['커맨드형 선발','스트라이크 선점과 경기 운영이 안정적이다.','타순이 한 바퀴 돈 뒤 결정구가 필요하다.','변화구 완성'],['체인지업 좌완','좌우 타자 모두에게 체인지업을 던질 수 있다.','빠른 공의 평균 구속을 높여야 한다.','체력 보강'],['땅볼 유도형 선발','투심의 움직임과 낮은 코스 공략이 좋다.','주자가 있을 때 투구 템포가 빨라진다.','주자 관리'],['장신 커브볼러','낙차 큰 커브와 투구 각도가 매력적이다.','상하체 타이밍을 일정하게 맞춰야 한다.','폼 안정화']],
 RP:[['파워 불펜','짧은 이닝에서 강한 빠른 공과 슬라이더가 돋보인다.','연투 시 회복 루틴을 정립해야 한다.','회복 루틴'],['제구형 불펜','과감한 몸쪽 승부로 유리한 카운트를 만든다.','몰린 실투가 장타로 이어지는 편이다.','실투 관리'],['좌완 스페셜리스트','좌타자 바깥쪽으로 달아나는 공이 위력적이다.','우타자에게 쓸 구종이 하나 더 필요하다.','구종 확장'],['낮은 팔각도 불펜','낯선 투구 각도로 타자의 타이밍을 뺏는다.','좌우 타자 상대 편차를 줄여야 한다.','상대별 대응'],['포크볼 불펜','결정구의 낙차와 헛스윙 유도 능력이 좋다.','불리한 카운트에서도 포크볼에 의존한다.','빠른 공 제구']],
 C:[['수비형 포수','블로킹과 송구 동작이 간결하다.','빠른 공에 밀리는 타격을 보완해야 한다.','배트 스피드'],['공격형 포수','강한 타구와 코스별 대응력이 돋보인다.','포구와 후반 체력 관리가 과제다.','포구 안정'],['균형형 포수','기본기와 선구안이 균형 있게 갖춰졌다.','한 가지 확실한 주전 경쟁력이 필요하다.','체력 보강'],['강견 포수','빠른 송구와 주자 견제 능력이 좋다.','변화구 블로킹 때 자세가 높아진다.','블로킹'],['리더형 포수','투수와의 소통과 경기 흐름 읽기가 좋다.','장타를 늘리려면 하체 힘이 필요하다.','타구 질']],
 IF:[['공수형 내야수','타구 판단과 송구 정확성이 안정적이다.','강한 공을 당겨 치는 힘이 부족하다.','타구 질'],['거포 코너 내야수','실투를 장타로 연결하는 힘이 있다.','변화구 대처와 수비 범위가 과제다.','변화구 대응'],['기동형 유격수','첫발과 넓은 수비 범위가 돋보인다.','프로 일정에 버틸 체력을 늘려야 한다.','체력 보강'],['선구안형 내야수','유인구를 참아내며 긴 승부를 만든다.','빠른 타구에 대한 수비 반응을 보완해야 한다.','수비 반응'],['멀티 내야수','여러 내야 위치에서 기본기를 보여준다.','주 포지션에서 확실한 무기가 필요하다.','주 포지션 정착']],
 OF:[['중견수 유망주','빠른 첫발과 넓은 수비 범위를 갖췄다.','타석에서 공격 범위가 넓은 편이다.','선구안'],['장타형 외야수','높은 타구 속도와 담장을 넘길 힘이 있다.','삼진을 줄이고 코너 수비를 다져야 한다.','변화구 대응'],['콘택트 외야수','배트 컨트롤과 반대 방향 타격이 좋다.','장타를 늘리기 위한 근력이 부족하다.','타구 질'],['강견 외야수','정확한 장거리 송구로 주자를 묶는다.','낮게 떨어지는 공에 배트가 따라간다.','선구안'],['기동형 외야수','주루 판단과 번트, 작전 수행이 좋다.','강한 타구를 꾸준히 만드는 것이 과제다.','타격 중심 이동']]
};
function schoolHonors(seed){
 const map={};const groups=[...REGIONS.map(region=>({label:region+' 고교대회',list:Cat.institutions.filter(x=>['high-school','hs-club'].includes(x.kind)&&x.region===region)})),{label:'전국 대학대회',list:Cat.institutions.filter(x=>x.kind==='college')}];
 for(const group of groups){const r=rng(seed+'-school-event-'+group.label);const ranks=group.list.map(s=>({s,score:Bio.TIERS[s.tier].team*60+r()*55})).sort((a,b)=>b.score-a.score);ranks.forEach(({s},i)=>map[s.id]={event:group.label,result:i===0?'우승':i===1?'준우승':i<4?'4강':i<8?'8강':'예선',award:i<2?group.label+' '+(i===0?'우승':'준우승'):null});}
 return map;
}
function generatePool(seed){
 const r=rng(seed+'-pool-v6'),usedNames=new Set(),players=[],honors=schoolHonors(seed);
 const rareMLB=rng(seed+'-rare-mlb')()<.12;
 const otherPaths=shuffle([...Array(30).fill('대졸'),...Array(16).fill('대학 얼리'),...Array(6).fill('독립구단'),...Array(4).fill('해외파'),...Array(5).fill('마이너 복귀'),rareMLB?'MLB 경험 복귀':'마이너 복귀',...Array(2).fill('해외독립 복귀')],r);
 const bands=shuffle([...Array(110).fill(0),...Array(56).fill(1),...Array(24).fill(2),...Array(8).fill(3),...Array(2).fill(4)],rng(seed+'-talent-bands'));
 for(let i=0;i<200;i++){
  const region=REGIONS[Math.floor(i/25)],j=i%25,pathway=j<17?'고졸':otherPaths[Math.floor(i/25)*8+j-17],high=pathway==='고졸';
  const identity=Names.makeName(r,usedNames),bio=Bio.makeBiography(r,region,pathway),{name}=identity,{school,age}=bio;
  const schoolStyle=SCHOOL_STYLES[hash(bio.currentInstitutionId)%SCHOOL_STYLES.length];
  const reputation=Bio.TIERS[bio.schoolTier]||{ready:0,team:.52};
  const schoolTournament=honors[bio.currentInstitutionId]||null;
  const roll=r(),role=roll<.32?'SP':roll<.49?'RP':roll<.58?'C':roll<.81?'IF':'OF',pitcher=['SP','RP'].includes(role);
  const type=Math.floor(r()*5),a=ARCHETYPES[role][type];
  const talent=G.make(role,type,bio,bands[i],r);
  const {ready,trueReady,upside,scoutCeiling,publicScore,control,power,speed,defense}=talent;
  const throwHand=pitcher?(type===2?'좌':r()<.21?'좌':'우'):(role==='OF'&&r()<.25?'좌':'우');
  const batHand=r()<.015?'양':r()<.43?'좌':'우';
  const velocity=pitcher?round(clamp(139+(talent.tools.stuff-35)*.48+normal(r)*3,131,162)):null;
  const height=type===4&&role==='SP'?190+Math.floor(r()*7):174+Math.floor(r()*19),weight=round(68+(height-174)*.6+r()*15+(type===1&&!pitcher?7:0));
  const awards=[];
  if(high&&ready>=45&&r()<.35)awards.push('U-18 대표팀');
  if(['대졸','대학 얼리'].includes(pathway)&&ready>=45&&r()<.25)awards.push('대학 대표팀');
  // Shared school results: school reputation affects team success, not a direct AVG/ERA multiplier.
  if(schoolTournament?.award)awards.push(schoolTournament.award);
  if(ready>=45&&r()<.25)awards.push(pitcher?'소속 대회 우수투수상':'소속 대회 타격상');
  const record=amateurRecord({role,ready,control,power,speed,schoolTier:bio.schoolTier,teamSupport:.85+reputation.team*.4},r);
  if(bio.proExperience){const level=bio.proExperience.level,mult=level==='MLB'?.33:level==='AAA'?.84:level==='AA'?.94:1.05;record.games=level==='MLB'?4+Math.floor(r()*12):record.games+15;
   if(pitcher){record.outs=level==='MLB'?9+Math.floor(r()*70):record.outs+100;record.er=Math.max(1,round(record.outs/27*(5.9-(ready-35)*.085+(level==='MLB'?1:0))));record.era=round(record.er*27/record.outs,2);record.k=round(record.outs/3*(.5+talent.tools.stuff/110));record.bb=round(record.outs/3*Math.max(.15,.75-control/105));record.wins=Math.floor(record.games*.3*r());}
   else{record.ab=level==='MLB'?12+Math.floor(r()*48):record.games*3;record.hits=round(record.ab*clamp((.23+(ready-35)*.002)*mult+(level==='MLB'?.14:0),.12,.39));record.bb=round(record.ab*.08);record.pa=record.ab+record.bb;record.hr=Math.min(record.hits,round(record.ab*clamp((power-25)*.0008,.002,.06)));record.doubles=Math.min(record.hits-record.hr,round(record.hits*.2));record.triples=0;record.avg=round(record.hits/record.ab,3);record.ops=round((record.hits+record.bb)/record.pa+(record.hits+record.doubles+3*record.hr)/record.ab,3);record.rbi=round(record.hits*.4+record.hr);record.runs=round((record.hits+record.bb)*.35);record.sb=round(record.games*Math.max(0,speed-30)/500*r());}
  }
  players.push({id:'p'+String(i+1).padStart(3,'0'),...identity,...bio,...talent,region,pathway,school,schoolStyle,schoolTournament,role,type,archetype:a[0],strength:Ko.formal(a[1]),weakness:Ko.formal(a[2]),focus:a[3],age,height,weight,throwHand,batHand,ready,trueReady,upside,scoutCeiling,publicScore,velocity,control,power,speed,defense,awards,record,risk:.05+r()*.11,personality:pick(PERSONALITIES,r),favoriteTeam:Math.floor(r()*10),lateDevelopment:talent.growthCurve==='late',confidence:record.games>=25?'보통':'관찰 표본 적음'});
 }
 players.sort((a,b)=>b.publicScore-a.publicScore||a.id.localeCompare(b.id));players.forEach((p,i)=>p.rank=i+1);
 return {players,byId:Object.fromEntries(players.map(p=>[p.id,p])),seed:String(seed)};
}
function amateurRecord(p,r){
 if(['SP','RP'].includes(p.role)){
  const exposure=p.schoolTier==='명문'&&p.ready<53?.80:1;
  const games=Math.max(5,round((9+Math.floor(r()*15))*exposure)),outs=round((p.role==='SP'?24+r()*45:12+r()*23)*3*exposure),ip=outs/3;
  const er=Math.max(2,round(ip*(7.3-p.ready*.090+normal(r)*.8)/9));
  return {kind:'pitcher',games,outs,er,era:round(er*9/ip,2),k:round(ip*(.6+p.ready/105)),bb:round(ip*(.67-p.control/170)),wins:Math.min(games,round(games*Math.max(.05,(7-er*9/ip)/20)*p.teamSupport))};
 }
 const exposure=p.schoolTier==='명문'&&p.ready<53?.80:1;
 const games=round((20+Math.floor(r()*22))*exposure),ab=games*(3+Math.floor(r()*2));
 const hits=round(ab*clamp(.20+p.ready*.0026+normal(r)*.045,.21,.455)),bb=round(ab*(.07+p.control/1000));
 const hr=Math.min(hits,round(ab*Math.max(.001,(p.power-25)/850)*r())),doubles=Math.min(hits-hr,round(hits*.18)),triples=Math.min(hits-hr-doubles,Math.floor(r()*3));
 const avg=round(hits/ab,3),ops=round((hits+bb)/(ab+bb)+(hits+doubles+2*triples+3*hr)/ab,3);
 return {kind:'hitter',games,ab,pa:ab+bb,hits,bb,hr,doubles,triples,avg,ops,sb:round(Math.max(0,p.speed-25)*games/140*r()),rbi:round((hits*.3+hr)*p.teamSupport),runs:round((hits+bb)*.4*p.teamSupport)};
}
const api={grades:G,catalog:Cat.institutions,schoolHonors,bio:Bio,ko:Ko,names:Names,ROLES,REGIONS,SCHOOLS,SCHOOL_STYLES,COLLEGES,INDEPENDENTS,OVERSEAS,PERSONALITIES,ARCHETYPES,hash,rng,clamp,round,mean,pick,shuffle,normal,generatePool};
root.DraftData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
