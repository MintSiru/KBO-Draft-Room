/* Fictional educational histories. Current qualification != birthplace or old school. */
(function(root){
'use strict';
const Cat=root.DraftCatalog||(typeof require!=='undefined'?require('./catalog.js'):null);
const DRAFT_DATE='2026-09-16',DRAFT_YEAR=2026,ENTRY_YEAR=2027;
const REGIONS=['서울','경남','대전·충청·전북','부산·울산','인천','경기·강원','대구·경북','광주·전남·제주'];
const CITIES={'서울':['서울 종로구','서울 강동구','서울 은평구','서울 동작구','서울 강서구'],'경남':['창원','진주','김해','거제','사천'],'대전·충청·전북':['대전','천안','청주','세종','전주','익산'],'부산·울산':['부산 동래구','부산 영도구','부산 해운대구','울산 남구','울산 중구'],'인천':['인천 미추홀구','인천 연수구','인천 서구','인천 강화군'],'경기·강원':['수원','평택','고양','성남','하남','강릉','춘천','동해'],'대구·경북':['대구','포항','경주','안동','구미'],'광주·전남·제주':['광주','목포','여수','순천','제주','서귀포']};
const TIERS={'명문':{ready:4,weight:1.8,team:.82},'강호':{ready:1,weight:1.3,team:.68},'중견':{ready:-1,weight:1,team:.52},'약소':{ready:-4,weight:.7,team:.36}};
const pick=(xs,r)=>xs[Math.floor(r()*xs.length)];
function choose(xs,r){let n=r()*xs.reduce((s,x)=>s+(x.weight||TIERS[x.tier]?.weight||1),0);for(const x of xs){n-=x.weight||TIERS[x.tier]?.weight||1;if(n<0)return x;}return xs.at(-1);}
function ageAt(birth,date=DRAFT_DATE){const [y,m,d]=birth.split('-').map(Number),[cy,cm,cd]=date.split('-').map(Number);return cy-y-((cm<m||(cm===m&&cd<d))?1:0);}
const iso=(y,m,d=1)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
function makeBiography(r,region,pathway){
 const hs=choose(Cat.institutions.filter(s=>['high-school','hs-club'].includes(s.kind)&&s.region===region),r),high=pathway==='고졸';
 let current=hs,hsGrad=ENTRY_YEAR,withCollege=false;
 if(['대졸','대학 얼리'].includes(pathway)){current=choose(Cat.institutions.filter(s=>s.kind==='college'),r);hsGrad=ENTRY_YEAR-(pathway==='대학 얼리'?2:4);}
 if(pathway==='해외파'){current=choose(Cat.institutions.filter(s=>s.kind==='overseas-college'),r);hsGrad=DRAFT_YEAR-4;}
 if(pathway==='독립구단'){current=pick(Cat.institutions.filter(s=>s.kind==='independent'),r);withCollege=r()<.55;hsGrad=withCollege?2019+Math.floor(r()*3):2021+Math.floor(r()*5);}
 const birthYear=hsGrad-19,month=1+Math.floor(r()*12),day=1+Math.floor(r()*new Date(Date.UTC(birthYear,month,0)).getUTCDate());
 const birthday=iso(birthYear,month,day),birthRegion=r()<.78?region:pick(REGIONS.filter(x=>x!==region),r),birthplace=pick(CITIES[birthRegion],r);
 const history=[{institutionId:hs.id,name:hs.name,kind:hs.kind,region:hs.region,tier:hs.tier,start:iso(hsGrad-3,3),end:iso(hsGrad,2,28),status:hs.kind==='hs-club'?(high?'활동 종료 예정':'활동 종료'):(high?'졸업 예정':'졸업'),note:hs.kind==='hs-club'?'고교 시절 클럽 활동입니다. 별도 학적 학교는 모델링하지 않습니다.':''}];
 if(['대졸','대학 얼리'].includes(pathway))history.push({institutionId:current.id,name:current.name,kind:current.kind,region:current.region,tier:current.tier,start:iso(hsGrad,3),end:pathway==='대학 얼리'?null:iso(ENTRY_YEAR,2,28),status:pathway==='대학 얼리'?'2학년 재학 · 얼리 참가':'졸업 예정',note:pathway==='대학 얼리'?'졸업 전 조기 참가입니다. 대졸 의무지명에는 포함하지 않습니다.':'게임에서는 4년제 과정으로 단순화합니다.'});
 if(pathway==='해외파')history.push({institutionId:current.id,name:current.name,kind:current.kind,region:current.country,tier:null,start:iso(hsGrad,current.academicStartMonth),end:iso(DRAFT_YEAR,current.academicEndMonth,28),status:'졸업',note:'지명 전 해외 대학 4년 과정을 마친 최종 소속입니다. 실제 지원 자격의 세부 예외는 재현하지 않습니다.'});
 if(pathway==='독립구단'){
  let independentStart=hsGrad;
  if(withCollege){const college=choose(Cat.institutions.filter(s=>s.kind==='college'),r);independentStart=hsGrad+4;history.push({institutionId:college.id,name:college.name,kind:college.kind,region:college.region,tier:college.tier,start:iso(hsGrad,3),end:iso(independentStart,2,28),status:'졸업',note:''});}
  history.push({institutionId:current.id,name:current.name,kind:current.kind,region:current.region,tier:null,start:iso(independentStart,3),end:null,status:'활동 중',note:'졸업 이후 독립구단에서 다시 기회를 준비했습니다.'});
 }
 return {entryCategory:high?'high-school':pathway==='대졸'?'college-graduate':pathway==='대학 얼리'?'college-early':pathway==='독립구단'?'independent':'overseas',collegeYear:pathway==='대졸'?4:pathway==='대학 얼리'?2:null,quotaEligible:pathway==='대졸',birthday,age:ageAt(birthday),birthRegion,birthplace,cohort:birthYear,highSchoolId:hs.id,highSchoolName:hs.name,highSchoolRegion:hs.region,highSchoolGradYear:hsGrad,currentInstitutionId:current.id,currentInstitution:current,school:current.name,schoolTier:current.tier,history,pathText:history.map(h=>h.name).join(' → '),qualification:high?'고교 졸업 예정':pathway==='대졸'?'대학 졸업 예정':pathway==='대학 얼리'?'대학 2학년 얼리 참가':pathway==='독립구단'?'독립구단 지원':'해외 대학 졸업',regionalEligible:high,regionalRegion:high?hs.region:null,regionalReason:high?(hs.kind==='hs-club'?'고교 연령 클럽도 고졸 지원자로 허용하는 게임용 규칙입니다.':'현재 고교 졸업 예정자로서 소속 지역 기준으로 판정합니다.'):'과거 고교와 출생 지역에 관계없이 현재 지원 구분상 지역 1차 지명에서 제외합니다.'};
}
function eligible(p,team){const s=Cat.byId[p.currentInstitutionId];return p.pathway==='고졸'&&p.qualification==='고교 졸업 예정'&&p.highSchoolGradYear===ENTRY_YEAR&&s&&['high-school','hs-club'].includes(s.kind)&&s.id===p.highSchoolId&&s.region===team.region&&!p.history.some(h=>['college','independent','overseas-college'].includes(h.kind));}
const api={DRAFT_DATE,DRAFT_YEAR,ENTRY_YEAR,REGIONS,CITIES,TIERS,ageAt,makeBiography,eligible};root.DraftBio=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
