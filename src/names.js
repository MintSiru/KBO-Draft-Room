/* Curated complete Korean given names, NOT a crawled 2000–2007 birth-ranking database. */
(function(root){
'use strict';
const groups=[
 {weight:5,names:'민준 서준 도윤 예준 시우 하준 주원 지호 지후 준우 준서 건우 현우 지훈 우진 선우 민재 현준 연우 정우 승우 승현 준혁 지환 승민 유준 준영 진우 성민 태현 동현 수빈 재윤 민성 성현 태민 준호 재현 지민 정민 재민 현수 민수 성훈 상현 동건 동훈 준수 수현 승준 경민 정훈 영준 민규 승훈'.split(' ')},
 {weight:3,names:'성준 진호 태준 동혁 상민 병찬 정현 기현 태훈 재훈 석현 현빈 태영 상훈 영훈 도현 재영 정윤 재원 준원 태원 동욱 승환 재환 진영 성진 우성 성빈 종현 종민 창민 창현 효준 강민 규민 대현 경수 경훈 종훈 원준 성우 진수 동우 민우 지웅 태웅 정빈 주형 준형 동준 성원 정호 재호 윤호 상우 동민 현성 규현 주호 명준 경준 태호 지수 윤성 승호 도훈 석준 영민'.split(' ')},
 {weight:1,names:'도겸 도하 건희 건호 건형 건영 건준 건율 기범 기훈 기태 기성 기욱 규빈 규원 규호 규태 대영 대호 대훈 대윤 동규 동균 동완 동영 동원 동윤 동진 동찬 명재 명진 명호 문수 민석 민찬 민혁 민형 민호 범수 범준 범진 병규 병민 병수 병우 병진 병현 병훈 상규 상원 상준 상진 상혁 상호 서우 서원 서윤 서진 선규 선민 선재 선호 선혁 성규 성균 성재 성호 세민 세준 세진 세현 수민 수영 수원 승규 승빈 승원 승윤 승재 승진 승찬 시온 시윤 시현 신우 영규 영빈 영서 영수 영우 영재 영진 영찬 영호 용민 용준 용진 우빈 우석 우영 우주 우찬 우혁 원빈 원석 원영 원우 원재 원호 유민 유빈 유성 유찬 유현 윤규 윤재 윤준 윤혁 윤후 은성 은우 은찬 은호 의찬 이준 인규 인성 인우 인호 재경 재균 재서 재성 재우 재준 재찬 재혁 재형 정규 정수 정원 정준 정환 종규 종원 종찬 주영 주찬 준경 준규 준기 준민 준빈 준석 준성 준승 준용 준재 준찬 준현 준후 지안 지완 지원 지유 지율 지한 지현 진규 진서 진성 진석 진원 진혁 진현 찬규 찬민 찬우 찬영 찬용 찬원 찬준 찬혁 창규 창수 창우 창준 창훈 채민 채운 태경 태규 태균 태성 태수 태양 태연 태욱 태윤 태인 태진 태찬 태혁 태환 하람 하민 하성 하영 하윤 한결 한빈 한솔 한준 해성 혁준 현규 현기 현민 현석 현승 현욱 현진 현찬 형민 형준 형진 호준 호진 호영 홍준 환희 효민 효빈 효성 효진 휘준 휘성 희성 희준 희찬'.split(' ')}
];
const seen=new Set();const givenNames=[];for(const group of groups)for(const name of group.names)if(!seen.has(name)){seen.add(name);givenNames.push({name,weight:group.weight});}
const surnames=[['김',21],['이',15],['박',9],['최',5],['정',5],['강',3],['조',3],['윤',3],['장',2],['임',2],['한',2],['오',2],['서',2],['신',2],['권',2],['황',1],['안',1],['송',1],['전',1],['홍',1],['유',1],['고',1],['문',1],['양',1],['손',1],['배',1],['백',1],['허',1],['남',1],['심',1],['노',1],['하',1],['곽',1],['성',1],['차',1],['주',1],['민',1],['류',1],['진',1],['지',1]].map(([name,weight])=>({name,weight}));
function weighted(list,r){let n=r()*list.reduce((s,x)=>s+x.weight,0);for(const x of list){n-=x.weight;if(n<0)return x.name;}return list.at(-1).name;}
function makeName(r,used){for(let i=0;i<5000;i++){const family=weighted(surnames,r),given=weighted(givenNames,r),name=family+given;if(given[0]===given[1]||family===given[0]||used.has(name))continue;used.add(name);return {name,familyName:family,givenName:given};}throw Error('선수 이름 생성 후보가 부족합니다.');}
const api={givenNames,surnames,makeName,sourceNote:'완성형 이름 검수 목록과 게임용 가중치입니다. 출생연도별 실제 통계가 아닙니다.'};root.DraftNames=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
