import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const out='.cache/classic-sample-dist',sha=b=>crypto.createHash('sha256').update(b).digest('hex');

await fs.mkdir(path.join(out,'assets/audio'),{recursive:true});for(const name of ['western.mp3','launch.ogg','grab.ogg','bank.ogg','reel.ogg'])await fs.copyFile('public/assets/audio/'+name,path.join(out,'assets/audio',name));
await fs.copyFile(path.join(out,'sample.html'),path.join(out,'index.html'));
const files=['sample.html','vite.sample.config.mjs','src/sample/main.ts','src/sample/art.ts','src/sample/motion.ts','src/sample/audio.ts','src/sample/model.ts','src/sample/style.css','src/core/model.ts','src/core/shop.ts','src/core/clock.ts',...['launch','grab','bank','reel'].map(n=>`public/assets/audio/${n}.ogg`),'public/assets/audio/western.mp3'];
async function fingerprint(file){const bytes=await fs.readFile(file);return sha(/\.(ts|css|html|mjs|svg)$/.test(file)?bytes.toString('utf8').replaceAll('\r\n','\n'):bytes);}
const sources={};for(const f of files)sources[f]=await fingerprint(f);
const previous=JSON.parse(await fs.readFile('docs/sample/preserved-baseline-lf.json','utf8'));
const integratedSceneChanges=[];
for(const [file,hash] of Object.entries(previous))if(await fingerprint(file)!==hash){
  // 用户已明确要求把确认的动作接回六关入口；原始基线仍保留，不伪报入口未改变。
  if(file==='src/main.ts')integratedSceneChanges.push(file);else throw Error('非场景基线模块被改变: '+file);
}
const report={candidate:'vector-correction+'+sha(JSON.stringify(sources)).slice(0,12),builtAt:new Date().toISOString(),sources,preservedModulesMatch:integratedSceneChanges.length===0,preservedNonSceneModulesMatch:true,integratedSceneChanges,scope:'第一关样片保留；六关入口按用户要求接入同一动画，规则/商店/音频/样式未改；未发布'};
await fs.writeFile(path.join(out,'sample-build.json'),JSON.stringify(report,null,2));await fs.writeFile('docs/sample/build.json',JSON.stringify(report,null,2));
for(const name of ['before.png','after.png','rejected-sample.png','compare.html'])await fs.copyFile('docs/sample/'+name,path.join(out,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});
for(const name of ['sample-demo.webm','sample-motion-loop.webm','sample-arm-demo.webm'])await fs.copyFile('public/'+name,path.join(out,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});
console.log(report.candidate);
