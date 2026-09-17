/* Real Chromium UI + offline file smoke. CHROMIUM_BIN may override the executable. */
const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const base=path.resolve(__dirname,'..'),out=path.join(__dirname,'screenshots'),KEY='draft-room-kbo-v5-five-years';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const reports=[];
try{
 for(const cfg of [{name:'desktop-normal-on',width:1440,height:1000,difficulty:'normal',local:true,team:'lg'},{name:'mobile-hard-off',width:390,height:844,difficulty:'hard',local:false,team:'kiwoom'},{name:'tablet-easy-on',width:820,height:1180,difficulty:'easy',local:true,team:'samsung'}]){
  const ctx=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},acceptDownloads:true});const page=await ctx.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(pathToFileURL(path.join(base,'index.html')).href);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,cfg.name+'-setup.png')});
  const overflow=async()=>page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));const setupSize=await overflow();assert(setupSize.body<=setupSize.viewport+1,JSON.stringify({cfg:cfg.name,setupSize}));
  await page.locator(`[data-action=team][data-id=${cfg.team}]`).click();await page.locator(`[data-action=difficulty][data-id=${cfg.difficulty}]`).click();if(cfg.local)await page.locator('#local-toggle').check();await page.locator('[data-action=start]').click();await page.locator('[data-action=begin-draft]').click();
  const capture=async name=>{await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(200);await page.screenshot({path:path.join(out,cfg.name+'-'+name+'.png')});};
  const get=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);let game=(await get()).game;
  while(game.phase==='draft'){
   if(game.picks.filter(s=>s.teamId===game.teamId).length===0)await capture('draft');
   await page.locator('[data-action=pick]').click();await page.locator('[data-action=confirm-pick]').click();if(await page.locator('[role=dialog]').count())await page.locator('[data-action=close-modal]').first().click();game=(await get()).game;
  }
  assert.equal(game.picks.length,cfg.local?80:70);await page.locator('[data-action=gm-choice][data-id=development]').click();await page.locator('[data-action=simulate]').click();await capture('season');
  await page.locator('[data-action=records]').first().click();await page.locator('#record-team').selectOption('ALL');assert.equal(await page.locator('.record-table tbody tr').count(),cfg.local?80:70);await page.locator('#record-level').selectOption('futures');await page.locator('#record-sort').selectOption('era');await page.locator('.record-table [data-action=career-player]').first().click();await page.screenshot({path:path.join(out,cfg.name+'-profile.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('[role=dialog]').count(),0);
  const roomSize=await overflow();assert(roomSize.body<=roomSize.viewport+1,JSON.stringify({cfg:cfg.name,roomSize}));await capture('records');if(cfg.width<700){const scroller=page.locator('.table-scroll').first();await scroller.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);assert(await scroller.evaluate(el=>el.scrollLeft>0),'mobile table keyboard scroll');}await page.locator('[data-action=records-close]').click();
  for(let i=1;i<5;i++){await page.waitForTimeout(950);await page.locator('[data-action=next-season]').click();assert.equal((await get()).game.career.years.length,i+1);await page.reload();assert.equal((await get()).game.career.years.length,i+1);}
  await page.locator('[data-action=owner]').first().click();assert.equal(await page.locator('.record-table tbody tr').count(),10);assert.equal(await page.locator('[data-action=next-season]').count(),0);await capture('review');
  const finalSize=await overflow();assert(finalSize.body<=finalSize.viewport+1,JSON.stringify({cfg:cfg.name,finalSize}));const final=(await get()).game;assert(await page.evaluate(key=>DraftCore.validate(JSON.parse(localStorage.getItem(key)).game),KEY));
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=export-save]').first().click();const download=await downloadPromise,saveFile=path.join(__dirname,cfg.name+'-save.json');await download.saveAs(saveFile);assert(fs.statSync(saveFile).size<2000000);
  await page.locator('[data-action=reset]').click();await page.locator('[data-action=confirm-reset]').click();await page.locator('#import-file').setInputFiles(saveFile);await page.locator('[data-action=confirm-import]').click();assert.deepEqual((await get()).game,final);
  const imagePromise=page.waitForEvent('download');await page.locator('[data-action=download]').click();const image=await imagePromise;await image.saveAs(path.join(out,cfg.name+'-first-year.png'));
  assert.deepEqual(errors,[]);reports.push({case:cfg.name,offline:true,picks:final.picks.length,seasons:final.career.years.length,exportImport:true,firstYearImage:true,horizontalOverflow:false,errors});await ctx.close();
 }
 fs.writeFileSync(path.join(__dirname,'v05-browser-results.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports,null,2));console.log('PASS real Chromium offline smoke');
}finally{await browser.close();}})().catch(err=>{console.error(err);process.exit(1);});
