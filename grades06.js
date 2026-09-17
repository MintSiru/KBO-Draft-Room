/* V0.6 grades: continuous 20–80 mechanics; five-point public scouting grades. */
(function(root){'use strict';
const clamp=(n,a=20,b=80)=>Math.max(a,Math.min(b,n));
const grade=n=>clamp(Math.round(n/5)*5);
const LABELS={stuff:'구위',command:'커맨드',breaking:'변화구',stamina:'체력',contact:'컨택',power:'장타력',speed:'주력',defense:'수비',eye:'선구안'};
const WEIGHTS={SP:{stuff:.30,command:.25,breaking:.25,stamina:.20},RP:{stuff:.40,command:.25,breaking:.30,stamina:.05},C:{contact:.28,power:.20,speed:.04,defense:.48},IF:{contact:.34,power:.26,speed:.10,defense:.30},OF:{contact:.32,power:.35,speed:.14,defense:.19}};
const keys=role=>Object.keys(WEIGHTS[role]);
const overall=(tools,role)=>Object.entries(WEIGHTS[role]).reduce((a,[k,w])=>a+tools[k]*w,0);
const normal=r=>(r()+r()+r()-1.5)/1.5;
function make(role,type,bio,band,r){
 const pitcher=role==='SP'||role==='RP',high=bio.entryCategory==='high-school',early=bio.entryCategory==='college-early';
 const ranges=[[34,43],[43,49],[49,56],[56,62],[63,69]],range=ranges[band],base=range[0]+r()*(range[1]-range[0]);
 const shape=pitcher?[{stuff:11,command:-6,breaking:1,stamina:-2},{stuff:-5,command:12,breaking:-2,stamina:3},{stuff:-3,command:2,breaking:10,stamina:0},{stuff:0,command:7,breaking:2,stamina:2},{stuff:3,command:-5,breaking:10,stamina:5}][type]:[{contact:0,power:-7,speed:5,defense:10},{contact:-2,power:15,speed:-8,defense:-5},{contact:10,power:-6,speed:6,defense:1},{contact:3,power:-4,speed:0,defense:6},{contact:0,power:-5,speed:12,defense:4}][type];
 const center=overall(shape,role),potentialTools={},trueTools={},tools={};
 const curveRoll=r(),growthCurve=curveRoll<.20?'early':curveRoll<.78?'normal':'late';
 const rawProject=high&&band>=2&&r()<.12;
 const gap=(high?10+r()*8:early?7+r()*6:bio.proExperience?3+r()*6:4+r()*6)+(growthCurve==='late'?2:0)+(rawProject?8+r()*5:0);
 const observerBias=(r()-.5)*(high?7:5),uncertainty=high?'높음':early?'보통':bio.proExperience?.level==='MLB'?'보통':'낮음';
 for(const k of keys(role)){potentialTools[k]=clamp(base+shape[k]-center+normal(r)*3);trueTools[k]=clamp(potentialTools[k]-gap*(k==='speed'?.4:.8+r()*.4)+(bio.schoolTier==='명문'?.6:0));trueTools[k]=Math.min(trueTools[k],potentialTools[k]);tools[k]=grade(trueTools[k]+observerBias+normal(r)*4);}
 if(!pitcher){potentialTools.eye=clamp(base+(type===3?10:normal(r)*10));trueTools.eye=clamp(potentialTools.eye-gap*.8);tools.eye=grade(trueTools.eye+observerBias+normal(r)*4);}
 const trueReady=overall(trueTools,role),upside=overall(potentialTools,role),ready=grade(overall(tools,role));
 const scoutCeiling=Math.max(ready,grade(upside*(rawProject?.65:.83)+trueReady*(rawProject?.35:.17)+observerBias*.6+normal(r)*4));
 const ceilingGrade=Math.max(scoutCeiling,grade(upside+observerBias+normal(r)*4));
 const floorGrade=Math.min(scoutCeiling,Math.max(ready-5,grade(scoutCeiling-(uncertainty==='높음'?12:uncertainty==='보통'?9:6))));
 const futureTools=Object.fromEntries(Object.entries(tools).map(([k,v])=>[k,Math.max(v,grade(potentialTools[k]*(rawProject?.65:.83)+trueTools[k]*(rawProject?.35:.17)+observerBias*.6))]));
 const pickTags=[];if(ready>=45)pickTags.push('즉전감');if(floorGrade>=40&&uncertainty!=='높음')pickTags.push('플로어');if(ceilingGrade>=55&&ceilingGrade-ready>=10)pickTags.push('실링');if(!pickTags.length)pickTags.push(scoutCeiling-ready>=10?'육성형':'역할형');
 return {ready,trueReady,upside,scoutCeiling,ceilingGrade,floorGrade,tools,futureTools,trueTools,potentialTools,uncertainty,pickTags,growthCurve,developmentRate:rawProject?.38+r()*.65:r()<.18?.42:.85+r()*.3,observerBias,publicScore:Math.round((ready*.43+scoutCeiling*.57+normal(r)*1.5)*10)/10,control:tools.command??tools.eye,power:tools.power??30,speed:tools.speed??30,defense:tools.defense??30};
}
function observe(trueTools,role,p,yearIndex,r){const error=(p.observerBias||0)/(1+yearIndex*.8),tools=Object.fromEntries(Object.entries(trueTools).map(([k,v])=>[k,grade(v+error+normal(r)*(4/(1+yearIndex*.7)))]));return {tools,ready:grade(overall(tools,role))};}
const api={grade,clamp,keys,LABELS,WEIGHTS,overall,make,observe};root.DraftGrades=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
