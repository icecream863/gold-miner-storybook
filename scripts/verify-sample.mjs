import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {state,fireAt,returned} from './classic-automation.mjs';
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
const base=process.env.SAMPLE_URL||'http://127.0.0.1:4176/sample.html',checks=[],errors=[];let current;
await fs.mkdir('output/playwright/sample',{recursive:true});
async function check(name,run){if(process.env.SAMPLE_CHECK&&!name.includes(process.env.SAMPLE_CHECK))return;console.log('检查: '+name);await run();checks.push({name,passed:true});}
async function boot({virtual=true,init,route,viewport={width:1280,height:900},touch=false,pace,reducedMotion='no-preference'}={}){
 const context=await browser.newContext({viewport,hasTouch:touch,isMobile:touch,reducedMotion});current=await context.newPage();const page=current;
 page.on('pageerror',e=>errors.push(e.message));if(init)await context.addInitScript(init);if(route)await route(page);
 const url=new URL(base);url.searchParams.set('qa','1');if(pace)url.searchParams.set('pace',pace);
 if(virtual)await page.clock.install();await page.goto(url.href);await page.getByRole('button',{name:'开始样片',exact:true}).waitFor();
 if(virtual){await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+50)));await page.clock.runFor(50);}
 await page.getByRole('button',{name:'开始样片',exact:true}).click();if(virtual)await page.clock.runFor(16);
 return {context,page};
}
try{
 for(const reducedMotion of ['no-preference','reduce'])await check(`参考经典的下落放绳姿态、关节连续 ${reducedMotion}`,async()=>{
  const {context,page}=await boot({reducedMotion});
  // 将摆钩自然运行至空钩方向，保证整个0.56秒动作都在出绳阶段，不能靠改模型延长。
  for(let i=0;i<150;i++){const s=await state(page);if(Math.abs(s.angle-.35)<.012)break;await page.clock.runFor(12);}
  const initial=await state(page);assert.ok(Math.abs(initial.angle-.35)<.012);
  const start=initial.visual;await page.keyboard.press('ArrowDown');assert.equal((await state(page)).frame.action,'release');
  const samples=[];
  for(const ms of [0,60,100,160,300,680]){
    const now=await state(page);await page.clock.runFor(Math.max(0,ms-(now.visual-start)*1000));
    const s=await state(page);assert.equal(s.hook,'extending');assert.equal(s.frame.action,'release');
    const pixels=await page.locator('canvas').evaluate((c,f)=>{
      const ctx=c.getContext('2d'),d=ctx.getImageData(600,100,110,82).data;let hash=2166136261;
      for(const v of d)hash=Math.imul(hash^v,16777619);
      const joint=ctx.getImageData(Math.round(f.elbow.x),Math.round(f.elbow.y),1,1).data;
      return {hash:hash>>>0,joint:[...joint]};
    },s.frame);
    assert.notDeepEqual(pixels.joint.slice(0,3),[255,231,139],'肘部中心不能露出背景');
    const box=await page.locator('canvas').boundingBox(),scale=box.width/1100;
    await page.screenshot({path:`output/playwright/sample/launch-${reducedMotion}-${ms}.png`,clip:{x:box.x+520*scale,y:box.y+25*scale,width:215*scale,height:178*scale}});
    samples.push({ms,frame:s.frame,...pixels});
    if(ms===160){await page.keyboard.press('P');const paused=await state(page);await page.clock.runFor(1000);assert.deepEqual((await state(page)).frame,paused.frame);await page.keyboard.press('P');}
    if(ms===300){await page.keyboard.press('Space');assert.equal((await state(page)).hook,'extending');}
  }
  assert.ok(new Set(samples.map(s=>s.hash)).size>=3,'出钩下落时实际人物区域必须变化');
  assert.ok(Math.max(...samples.map(s=>s.frame.hand.y))-Math.min(...samples.map(s=>s.frame.hand.y))>25);
  assert.ok(samples[3].frame.hand.y-samples[0].frame.hand.y>30);
  assert.deepEqual(samples[5].frame.hand,samples[3].frame.hand);
  assert.equal(samples[5].frame.angle,samples[3].frame.angle);
  assert.ok(samples[5].frame.drum<samples[3].frame.drum);
  await fs.writeFile(`docs/sample/launch-${reducedMotion}.json`,JSON.stringify(samples,null,2));
  await returned(page);await page.getByRole('button',{name:'重开',exact:true}).click();await page.clock.runFor(16);
  assert.equal((await state(page)).frame.action,'idle');await context.close();
 });
 await check('真实模型抓取、单次结算、暂停姿态与绞盘短音生命周期',async()=>{
  const {context,page}=await boot();for(let i=0;i<30&&!(await state(page)).audio.ready;i++)await page.clock.runFor(100);
  assert.equal((await state(page)).audio.ready,true);assert.equal((await state(page)).audio.settings.musicEnabled,false);
  await page.getByRole('button',{name:'重开',exact:true}).click();await page.clock.runFor(16);
  const hit=await fireAt(page,'0-1');assert.equal(hit.carried?.itemId,'0-1');assert.equal(hit.money,0);
  await page.clock.runFor(200);const pulling=await state(page);assert.equal(pulling.audio.reelActive,true);assert.equal(pulling.frame.action,'light');
  await page.screenshot({path:'output/playwright/sample/light.png'});
  await page.keyboard.press('P');const before=await state(page);await page.clock.runFor(8000);const after=await state(page);
  assert.equal(after.remaining,before.remaining);assert.equal(after.length,before.length);assert.deepEqual(after.frame,before.frame);assert.equal(after.audio.voices,0);assert.equal(after.audio.loopSources,0);
  await page.keyboard.press('P');await returned(page);assert.equal((await state(page)).money,250);await page.clock.runFor(1000);assert.equal((await state(page)).money,250);
  await page.screenshot({path:'output/playwright/sample/playing.png'});
  await page.getByRole('button',{name:'重开',exact:true}).click();await page.clock.runFor(16);assert.equal((await state(page)).money,0);
  const stone=await fireAt(page,'0-8');assert.equal(stone.carried?.kind,'rock');await page.clock.runFor(400);assert.equal((await state(page)).frame.action,'heavy');assert.equal((await state(page)).audio.reelActive,true);
  await page.screenshot({path:'output/playwright/sample/heavy.png'});
  await page.getByRole('button',{name:'结束本关',exact:true}).click();assert.equal((await state(page)).money,0);
  await page.getByRole('button',{name:'再玩第一关',exact:true}).click();await page.clock.runFor(54000);
  const late=await fireAt(page,'0-8');assert.equal(late.carried?.kind,'rock');
  const returnSeconds=(late.length-late.world.rest)/(420/(1+late.carried.weight*.75));assert.ok(late.remaining<returnSeconds,'截止前确实来不及回收');await page.clock.runFor(61000);
  const end=await state(page);assert.equal(end.phase,'result');assert.equal(end.carried,null);assert.equal(end.money,0);assert.equal(end.audio.loopSources,0);
  await page.getByRole('button',{name:'再玩第一关',exact:true}).click();await page.clock.runFor(16);const reset=await state(page);assert.equal(reset.money,0);assert.ok(reset.items.every(i=>!i.taken));
  await context.close();
 });
 await check('保存的音乐偏好沿用、静音后空格发射、设置暂停与音效关闭',async()=>{
  const {context,page}=await boot({init:()=>localStorage.setItem('gold-miner.audio.v1',JSON.stringify({musicEnabled:true,effectsEnabled:true,musicVolume:.2,effectsVolume:.3,muted:true}))});
  let s=await state(page);assert.equal(s.audio.settings.musicEnabled,true);assert.equal(s.audio.settings.muted,true);
  await page.getByRole('button',{name:'开声音',exact:true}).click();await page.keyboard.press('Space');await page.clock.runFor(16);assert.notEqual((await state(page)).hook,'swinging');
  await page.getByRole('button',{name:'声音',exact:true}).click();const paused=await state(page);await page.clock.runFor(4000);assert.equal((await state(page)).remaining,paused.remaining);
  await page.getByRole('checkbox',{name:'游戏音效',exact:true}).uncheck();await page.getByRole('button',{name:'返回',exact:true}).click();await page.locator('#overlay').getByRole('button',{name:'继续',exact:true}).click();await page.clock.runFor(1000);
  s=await state(page);assert.equal(s.audio.settings.effectsEnabled,false);assert.equal(s.audio.voices,0);assert.equal(s.audio.loopSources,0);await context.close();
 });
 await check('音频失败不阻塞、暂停时晚到资源不播放、重试能恢复',async()=>{
  let broken=true;const {context,page}=await boot({route:async p=>p.route('**/assets/audio/*.ogg',async r=>{if(broken)await r.fulfill({status:200,contentType:'audio/ogg',body:'invalid'});else await r.continue();})});
  for(let i=0;i<10;i++)await page.clock.runFor(100);assert.equal((await state(page)).audio.error,true);
  await fireAt(page,'0-1');await returned(page);assert.equal((await state(page)).money,250);
  await page.getByRole('button',{name:'声音',exact:true}).click();broken=false;await page.getByRole('button',{name:'重试声音加载',exact:true}).click();
  for(let i=0;i<40&&!(await state(page)).audio.ready;i++)await page.clock.runFor(100);
  assert.equal((await state(page)).audio.ready,true);assert.equal((await state(page)).audio.loopSources,0);assert.equal((await state(page)).audio.voices,0);await context.close();
 });
 await check('可选音乐损坏后能在暂停中重试，恢复前不播放',async()=>{
  let broken=true;const {context,page}=await boot({init:()=>localStorage.setItem('gold-miner.audio.v1',JSON.stringify({musicEnabled:true})),route:async p=>p.route('**/western.mp3',async r=>{if(broken)await r.fulfill({status:200,contentType:'audio/mpeg',body:'invalid'});else await r.continue();})});
  for(let i=0;i<40&&!(await state(page)).audio.error;i++)await page.clock.runFor(100);assert.equal((await state(page)).audio.error,true);
  await page.getByRole('button',{name:'声音',exact:true}).click();broken=false;await page.getByRole('button',{name:'重试声音加载',exact:true}).click();await page.clock.runFor(400);assert.equal((await state(page)).audio.musicPlaying,false);
  await page.getByRole('button',{name:'返回',exact:true}).click();await page.locator('#overlay').getByRole('button',{name:'继续',exact:true}).click();
  for(let i=0;i<50&&!(await state(page)).audio.musicPlaying;i++)await page.clock.runFor(100);assert.equal((await state(page)).audio.musicPlaying,true);
  await page.keyboard.press('P');assert.equal((await state(page)).audio.musicPlaying,false);await context.close();
 });
 for(const reducedMotion of ['no-preference','reduce'])await check(`可见的完整回收圆周、握柄与暂停像素冻结 ${reducedMotion}`,async()=>{
  const {context,page}=await boot({reducedMotion});await fireAt(page,'0-8');await page.clock.runFor(150);
  const samples=[];
  for(let i=0;i<24;i++){
   await page.clock.runFor(100);const s=await state(page);
   assert.equal(s.frame.action,'heavy');assert.ok(Math.hypot(s.frame.hand.x-s.frame.knob.x,s.frame.hand.y-s.frame.knob.y)<.001);
   const hash=await page.locator('canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(560,100,165,102).data;let h=2166136261;for(const v of d)h=Math.imul(h^v,16777619);return h>>>0;});
   samples.push({phase:s.frame.phase,hand:s.frame.hand,hash});
   if(i%3===0)await page.locator('canvas').screenshot({path:`output/playwright/sample/${reducedMotion}-pose-${Math.floor(i/3)}.png`});
  }
  assert.ok(new Set(samples.map(s=>s.hash)).size>=16,'实际人物区域必须有可见像素变化');
  assert.ok(Math.max(...samples.map(s=>s.hand.x))-Math.min(...samples.map(s=>s.hand.x))>40);
  assert.ok(Math.max(...samples.map(s=>s.hand.y))-Math.min(...samples.map(s=>s.hand.y))>40);
  await page.keyboard.press('P');await page.clock.runFor(16);
  const before=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.clock.runFor(1500);
  assert.equal(await page.locator('canvas').evaluate(c=>c.toDataURL()),before);
  assert.equal((await state(page)).audio.voices,0);assert.equal((await state(page)).audio.reelActive,false);
  await fs.writeFile(`docs/sample/motion-${reducedMotion}.json`,JSON.stringify(samples,null,2));await context.close();
 });
 await check('弃用的生成帧图和链条音频不再请求，所有画面离线可绘制',async()=>{
  let requests=[];const {context,page}=await boot({route:async p=>{p.on('request',r=>{if(r.url().includes('/assets/sample/'))requests.push(r.url());});}});
  await fireAt(page,'0-1');await returned(page);assert.equal((await state(page)).money,250);assert.deepEqual(requests,[]);await context.close();
 });
 for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390}])await check(`布局与触屏 ${viewport.width}×${viewport.height}`,async()=>{
  const {context,page}=await boot({viewport,touch:true});const bounds=await page.evaluate(()=>({w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({text:b.textContent,h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width}))}));
  assert.ok(bounds.scrollW<=bounds.w+1);assert.ok(bounds.buttons.every(b=>b.h>=44));
  const box=await page.locator('canvas').boundingBox();await page.touchscreen.tap(box.x+box.width*.4,box.y+box.height*.5);await page.clock.runFor(16);assert.notEqual((await state(page)).hook,'swinging');
  await page.screenshot({path:`output/playwright/sample/${viewport.width}.png`});await context.close();
 });
 await check('独立大金块慢回收对照有实际效果且只入账一次',async()=>{
  const {context,page}=await boot({pace:'heavy'});assert.equal((await state(page)).slowLarge,true);await page.getByText('大金块慢回收对照',{exact:true}).waitFor();
  const hit=await fireAt(page,'0-2');assert.equal(hit.carried?.kind,'large');
  const normalSeconds=(hit.length-hit.world.rest)/(420/(1+hit.carried.weight*.75));await page.clock.runFor(normalSeconds*1000+50);assert.equal((await state(page)).money,0);assert.equal((await state(page)).carried?.kind,'large');
  await returned(page);assert.equal((await state(page)).money,500);await page.clock.runFor(1000);assert.equal((await state(page)).money,500);await context.close();
 });
 assert.ok(checks.length);assert.deepEqual(errors,[]);
}catch(error){errors.push(error.message);await current?.screenshot({path:'output/playwright/sample/failure.png'}).catch(()=>{});console.error(error.stack);process.exitCode=1;}finally{await browser.close();await fs.writeFile(process.env.SAMPLE_CHECK?'docs/sample/browser-pace.json':'docs/sample/browser.json',JSON.stringify({base,checks,errors,mode:'真实按键/触屏，虚拟时钟规则专项；不等于人类试玩或正常速度录像'},null,2));console.log(JSON.stringify({checks:checks.length,errors}));}
