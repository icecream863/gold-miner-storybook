import {chromium} from '@playwright/test';import fs from 'node:fs/promises';import path from 'node:path';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {state,fireAt,returned,aimWait} from './classic-automation.mjs';
const ff=process.env.FFMPEG_PATH||path.resolve('.cache/media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const folder='output/playwright/sample-recording';await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined}),context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',recordVideo:{dir:folder,size:{width:1280,height:900}}});
await context.addInitScript(()=>{
 const Native=AudioContext,destinations=new WeakMap(),connect=AudioNode.prototype.connect;
 AudioNode.prototype.connect=function(destination,...args){const result=connect.call(this,destination,...args);const tap=destinations.get(this.context);if(tap&&destination===this.context.destination)connect.call(this,tap);return result;};
 window.AudioContext=class extends Native{constructor(...args){super(...args);const dest=this.createMediaStreamDestination();destinations.set(this,dest);const recorder=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[],started=Date.now();recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(250);window.__sampleStopAudio=()=>new Promise(resolve=>{recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));resolve({base64:btoa(str),started,stopped:Date.now()});};recorder.stop();});}};
});
const page=await context.newPage(),video=page.video(),errors=[],actions=[];let audio,ended,final,start;
let lastLaunch=0;const press=page.keyboard.press.bind(page.keyboard);page.keyboard.press=async(key,...args)=>{if(key==='Space'||key==='ArrowDown')lastLaunch=Date.now();return press(key,...args);};
page.on('pageerror',e=>errors.push(e.message));
try{
 const url=new URL(process.env.SAMPLE_URL||'http://127.0.0.1:4176/sample.html');url.searchParams.set('qa','1');await page.goto(url.href);await page.getByRole('button',{name:'开始样片',exact:true}).click();start=Date.now();console.log('录像：开始');
 // 空钩角度由只读状态选取；发射仍是实际按键，不修改规则或余额。
 for(let i=0;i<300;i++){const s=await state(page);if(Math.abs(s.angle-.35)<.025)break;await page.waitForTimeout(Math.max(8,Math.min(80,(aimWait(s,.35)-.01)*1000)));}
 await page.keyboard.press('ArrowDown');while((await state(page)).hook==='extending')await page.waitForTimeout(20);const emptyContact=Date.now();await returned(page,{virtual:false});assert.equal((await state(page)).money,0);actions.push({action:'empty',seconds:(Date.now()-start)/1000,extendSeconds:(emptyContact-lastLaunch)/1000,returnSeconds:(Date.now()-emptyContact)/1000});console.log('录像：空钩完成');
 for(const [id,name] of [['0-1','light-gold'],['0-8','heavy-rock'],['0-2','large-gold']]){
  const hit=await fireAt(page,id,{virtual:false});const contactAt=Date.now();assert.equal(hit.carried?.itemId,id);
  if(name==='heavy-rock') {await page.waitForTimeout(700);const heavy=await state(page);assert.equal(heavy.audio.reelActive,true);assert.equal(heavy.audio.loopSources,0);await page.screenshot({path:'docs/sample/heavy-live.png'});}
  await returned(page,{virtual:false});const s=await state(page);actions.push({action:name,seconds:(Date.now()-start)/1000,extendSeconds:(contactAt-lastLaunch)/1000,returnSeconds:(Date.now()-contactAt)/1000,money:s.money,frame:s.frame,audio:s.audio});console.log('录像：'+name+' $'+s.money);
  if(name==='light-gold'){await page.screenshot({path:'docs/sample/playing-live.png'});await page.keyboard.press('P');const paused=await state(page);await page.waitForTimeout(600);const after=await state(page);assert.equal(after.remaining,paused.remaining);assert.equal(after.audio.voices,0);await page.keyboard.press('P');actions.push({action:'pause-resume',seconds:(Date.now()-start)/1000});}
 }
 await page.getByRole('button',{name:'结束本关',exact:true}).click();await page.waitForTimeout(800);final=await state(page);assert.equal(final.money,765);assert.equal(final.phase,'result');assert.equal(final.audio.loopSources,0);assert.equal(final.audio.musicPlaying,false);assert.deepEqual(errors,[]);
 await page.screenshot({path:'docs/sample/result-live.png'});audio=await page.evaluate(()=>window.__sampleStopAudio());ended=Date.now();
}catch(error){await page.screenshot({path:folder+'/failure.png'}).catch(()=>{});await fs.writeFile('docs/sample/recording-failure.json',JSON.stringify({message:error.message,actions,state:await state(page).catch(()=>null)},null,2));throw error;}finally{await context.close();await browser.close();}
const rawVideo=await video.path(),rawAudio=folder+'/audio.webm';await fs.writeFile(rawAudio,Buffer.from(audio.base64,'base64'));
const capture={rawVideo,rawAudio,ended,audioStarted:audio.started,audioStopped:audio.stopped,actions,final,errors};await fs.writeFile(folder+'/capture.json',JSON.stringify(capture,null,2));
function duration(file){const r=spawnSync(ff,['-hide_banner','-i',file,'-f','null','-'],{encoding:'utf8',windowsHide:true,maxBuffer:5e6});if(r.status)throw Error(r.stderr);const m=r.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)||[...r.stderr.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)].at(-1);if(!m)throw Error('时长缺失');return +m[1]*3600 + +m[2]*60 + +m[3];}
const vd=duration(rawVideo),ad=duration(rawAudio),offset=Math.max(0,vd-ad-(ended-audio.stopped)/1000-.03);
const mux=spawnSync(ff,['-y','-hide_banner','-i',rawVideo,'-i',rawAudio,'-filter_complex',`[1:a]adelay=${Math.round(offset*1000)}:all=1[a]`,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','libopus','-b:a','96k','-shortest','public/sample-demo.webm'],{encoding:'utf8',windowsHide:true,maxBuffer:5e6});await fs.writeFile('docs/sample/mux.log',mux.stderr);if(mux.status)throw Error(mux.stderr);
const build=JSON.parse(await fs.readFile('.cache/classic-sample-dist/sample-build.json','utf8'));
const report={candidate:build.candidate,mode:'减少动态开启、正常时钟、只读状态辅助瞄准、真实按键；未剪辑加速，非人类试玩',videoSeconds:vd,gameplaySeconds:(ended-start)/1000,audioSeconds:ad,audioOffsetSeconds:offset,syncMethod:'按媒体结束位置估算延迟，非逐帧同步校准',bytes:(await fs.stat('public/sample-demo.webm')).size,actions,finalMoney:final.money,errors};await fs.writeFile('docs/sample/recording.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
