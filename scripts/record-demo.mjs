import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {state,earn,collect,fireAt,returned} from './classic-automation.mjs';
const ffmpeg=process.env.FFMPEG_PATH||path.resolve('.cache/media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
// 历史录像默认仍用 polish；整合验收另存报告，避免覆盖此前失败/成功证据。
const recordingName=process.env.RECORDING_NAME||'polish';
if(!/^[a-z0-9-]+$/.test(recordingName))throw Error('invalid recording name');
await fs.access(ffmpeg);await fs.mkdir('output/recording',{recursive:true});
const browser=await chromium.launch({channel:process.env.PW_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
let context,video,audio,videoEnd,page;
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms)})]);}finally{clearTimeout(timer);}}const log=[],errors=[];let completed=false;
try{
 context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:'output/recording',size:{width:1280,height:900}}});
 context.setDefaultTimeout(25000);console.log('record: context ready');
 await context.addInitScript(()=>{
  const Native=window.AudioContext,destinations=new WeakMap(),connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...args){const result=connect.call(this,destination,...args);const tap=destinations.get(this.context);if(tap&&destination===this.context.destination)connect.call(this,tap);return result;};
  window.AudioContext=class extends Native{constructor(...args){super(...args);const destination=this.createMediaStreamDestination();destinations.set(this,destination);
   const recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[],started=Date.now();
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(250);
   window.__stopRecordingAudio=()=>new Promise(resolve=>{recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks,{type:'audio/webm'}).arrayBuffer());let binary='';for(let n=0;n<bytes.length;n+=32768)binary+=String.fromCharCode(...bytes.subarray(n,n+32768));resolve({base64:btoa(binary),started,stopped:Date.now()});};recorder.stop();});
  }};
 });
 page=await bounded(context.newPage(),45000,"create recording page");console.log("record: page ready");video=page.video();page.on('pageerror',e=>errors.push(e.message));
 const url=new URL(process.env.GAME_URL||'http://127.0.0.1:4173/');url.searchParams.set('qa','1');await page.goto(url.href);
 await page.getByRole('button',{name:'第一次玩？查看规则',exact:true}).click();await page.waitForFunction(()=>window.__goldMiner.audio.music.duration>0,undefined,{timeout:20000});console.log('record: music ready');await page.getByRole('button',{name:'返回游戏',exact:true}).click();await page.waitForTimeout(500);await page.getByRole('button',{name:'开始挖矿 →',exact:true}).click();
 for(let level=0;level<6;level++){
  let s=await state(page);
  if(level===1){const hit=await fireAt(page,s.items.find(i=>i.kind==='rock').id,{virtual:false});log.push({stage:'heavy-rock',carried:hit.carried,rig:(await state(page)).rig});await returned(page,{virtual:false});}
  if(level===3){const before=await state(page);await collect(page,before.items.find(i=>i.kind==='tnt').id,{virtual:false});log.push({stage:'TNT',moneyBefore:before.money,moneyAfter:(await state(page)).money});}
  const shots=await earn(page,s.target,{virtual:false});s=await state(page);log.push({stage:'round',level:level+1,money:s.money,earned:s.earned,remaining:s.remaining,shots});console.log('record: round '+(level+1)+' money '+s.money);
  if(level===0){await page.keyboard.press('P');await page.waitForTimeout(700);await page.getByRole('button',{name:'继续挖矿 →',exact:true}).click();}
  await page.locator('[data-action="finish"]').click();await page.waitForTimeout(700);if(level===5)break;
  await page.getByRole('button',{name:'去补给铺 →',exact:true}).click();const before=(await state(page)).money;
  for(const id of level===0?['diamondPolish','strength','rockBook']:['diamondPolish','strength']){s=await state(page);if(s.money>=s.offers[id].price)await page.locator(`[data-action="buy-${id}"]`).click();}
  log.push({stage:'shop',level:level+1,before,after:(await state(page)).money});await page.waitForTimeout(800);await page.getByRole('button',{name:/收好行囊/}).click();
 }
 if((await state(page)).phase!=='complete'||errors.length)throw Error('录像未完整通过六关');
 await page.waitForTimeout(1500);await page.screenshot({path:`output/playwright/${recordingName}-recording-complete.png`});audio=await page.evaluate(()=>window.__stopRecordingAudio());videoEnd=Date.now();completed=true;
 }catch(error){await page?.screenshot({path:`output/recording/${recordingName}-failure.png`}).catch(()=>{});await fs.writeFile(`output/recording/${recordingName}-failure.json`,JSON.stringify({error:error.message,log,state:page?await state(page).catch(()=>null):null},null,2));throw error;}finally{if(context)await bounded(context.close(),15000,"close context").catch(()=>{});await bounded(browser.close(),15000,"close browser");}
if(completed){
 const rawVideo=await video.path(),rawAudio=`output/recording/${recordingName}-audio.webm`;await fs.writeFile(rawAudio,Buffer.from(audio.base64,'base64'));
 const duration=file=>{const r=spawnSync(ffmpeg,['-hide_banner','-i',file,'-f','null','-'],{encoding:'utf8',windowsHide:true,maxBuffer:5*1024*1024});if(r.status!==0)throw Error(r.stderr);const m=r.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)||[...r.stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)].at(-1);if(!m)throw Error('无法读取媒体时长: '+r.stderr);return +m[1]*3600 + +m[2]*60 + +m[3];};
 await fs.writeFile(`output/recording/${recordingName}-capture.json`,JSON.stringify({rawVideo,rawAudio,videoEnd,audio:{started:audio.started,stopped:audio.stopped},log,errors},null,2));
 const videoDuration=duration(rawVideo),audioDuration=duration(rawAudio),offset=Math.max(0,videoDuration-audioDuration-(videoEnd-audio.stopped)/1000-.05);
 const mux=spawnSync(ffmpeg,['-y','-hide_banner','-i',rawVideo,'-i',rawAudio,'-filter_complex',`[1:a]adelay=${Math.round(offset*1000)}:all=1[a]`,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','libopus','-b:a','96k','-shortest','public/demo.webm'],{encoding:'utf8',windowsHide:true,maxBuffer:5*1024*1024});if(mux.status!==0)throw Error(mux.stderr);
 const report={mode:'normal-clock-readonly-QA-assisted-full-six-rounds',audio:true,coverage:'六关、五次商店、重石实际回收、TNT连爆、暂停与最终结算；非人类试玩',videoDuration,audioDuration,audioOffsetSeconds:offset,bytes:(await fs.stat('public/demo.webm')).size,log,errors};await fs.writeFile(`docs/verification/${recordingName}-recording.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
