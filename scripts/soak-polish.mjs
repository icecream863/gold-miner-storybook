import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
import {state} from './classic-automation.mjs';
const candidate=await fetch('http://127.0.0.1:4173/build-info.json').then(r=>r.json());
const verificationName=process.env.VERIFICATION_NAME||'polish';
if(!/^[a-z0-9-]+$/.test(verificationName))throw Error('invalid verification name');
const duration=600000,browser=await chromium.launch({channel:process.env.PW_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],samples=[];let report;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:4173/?qa=1');await page.getByRole('button',{name:'第一次玩？查看规则',exact:true}).click();await page.getByRole('button',{name:'返回游戏',exact:true}).click();
 await page.waitForFunction(()=>window.__goldMiner?.audio.music.state==='playing');
 await page.evaluate(()=>{window.__frameSamples=[];let old=performance.now();function frame(now){window.__frameSamples.push(now-old);if(window.__frameSamples.length>36000)window.__frameSamples.shift();old=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 const start=Date.now(),baseline=(await state(page)).displayObjects;let cycles=0,nextSample=0;
 while(Date.now()-start<duration){
  const elapsed=Date.now()-start;
  if(elapsed>=nextSample){const s=await state(page);samples.push({seconds:+(elapsed/1000).toFixed(1),phase:s.phase,objects:s.displayObjects,effects:s.effects.length,voices:s.audio.voices,music:s.audio.music});nextSample+=30000;await fs.writeFile(`.cache/${verificationName}-soak-final-progress.json`,JSON.stringify({elapsedMs:elapsed,cycles,last:samples.at(-1)},null,2));console.log('soak '+Math.round(elapsed/1000)+'s, cycles '+cycles);}
  if(elapsed<135000){await page.waitForTimeout(3000);continue;}
  await page.getByRole('button',{name:'开始挖矿 →',exact:true}).click();await page.keyboard.press('Space');await page.waitForTimeout(800);
  await page.getByRole('button',{name:'声音设置',exact:true}).click();await page.waitForTimeout(50);const frozen=await state(page);await page.waitForTimeout(150);
  const paused=await state(page);if(paused.remaining!==frozen.remaining||paused.audio.music.sources!==0||JSON.stringify(paused.rig)!==JSON.stringify(frozen.rig))throw Error('暂停不完整');
  await page.getByRole('button',{name:'返回暂停界面',exact:true}).click();await page.getByRole('button',{name:'继续挖矿 →',exact:true}).click();await page.waitForTimeout(6500);
  await page.locator('[data-action="finish"]').click();await page.getByRole('button',{name:'返回首页',exact:true}).click();cycles++;
  const reset=await state(page);if(reset.displayObjects!==baseline||reset.effects.length||reset.carried||reset.money||reset.bombs||reset.audio.music.sources>1)throw Error('重开残留');
 }
 const frames=await page.evaluate(()=>window.__frameSamples);const sorted=frames.slice(1).sort((a,b)=>a-b);
 report={passed:errors.length===0,candidate:candidate.candidate,mode:'normal-clock-10-minute-soak',durationMs:Date.now()-start,cycles,baselineObjects:baseline,samples,frames:{count:sorted.length,mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)]},errors};
 if(samples.some(s=>s.music.sources>1||s.voices>16||s.effects>40||s.objects>baseline+44))throw Error('资源预算越界');
}catch(e){report={passed:false,error:e.message,samples,errors};process.exitCode=1;}finally{await browser.close();await fs.writeFile(`docs/verification/${verificationName}-soak-final.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
