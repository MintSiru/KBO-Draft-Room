// Presentation fields allowed to change in the name-only patch. Everything else must match v0.3.
const omitted=new Set(['school','highSchoolName','currentInstitution','history','pathText','regionalReason']);
module.exports=players=>players.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>!omitted.has(key))));
