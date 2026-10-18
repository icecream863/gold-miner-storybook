import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const ffmpeg=process.env.FFMPEG_PATH||path.resolve('.cache/media-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const out='public/assets/sample/audio';await fs.mkdir(out,{recursive:true});
function run(args){const r=spawnSync(ffmpeg,args,{encoding:null,windowsHide:true,maxBuffer:8e6});if(r.status!==0)throw Error(r.stderr.toString());return r.stdout;}
function wav(samples){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);return b;}
const inputs={winch:'.cache/sample-assets/winch/winch - Marker #9.wav',launch:'.cache/polish-assets/impact/Audio/impactWood_light_001.ogg',grab:'.cache/polish-assets/impact/Audio/impactMetal_light_003.ogg',bank:'.cache/sample-assets/coin-source.ogg'};
const only=process.env.SAMPLE_AUDIO_ONLY;
const report=only?await fs.readFile('docs/sample/audio-assets.json','utf8').then(JSON.parse).catch(()=>[]):[];
for(const [name,input] of Object.entries(inputs)){
  if(only&&only!==name)continue;
  const duration=name==='winch'?1.2:name==='bank'?.42:name==='grab'?.19:.14;
  const pcm=run(['-v','error','-ss',name==='winch'?'1.2':'0','-i',input,'-t',String(duration),'-af',`highpass=f=${name==='winch'?130:80},lowpass=f=${name==='winch'?2600:6500}${name==='winch'?',acompressor=threshold=0.018:ratio=4:attack=2:release=45:makeup=1':''}`,'-f','s16le','-ac','1','-ar','44100','-']);
  let samples=Array.from({length:pcm.length/2},(_,i)=>pcm.readInt16LE(i*2)/32768);
  const overlap=Math.round(44100*.065);
  if(name==='winch'){
    const n=samples.length,m=overlap;
    samples=[...samples.slice(m,n-m),...Array.from({length:m},(_,i)=>samples[n-m+i]*Math.cos(i/(m-1)*Math.PI/2)+samples[i]*Math.sin(i/(m-1)*Math.PI/2))];
  }else{
    for(let i=0;i<samples.length;i++){const fade=Math.min(1,i/220,(samples.length-1-i)/440);samples[i]*=Math.max(0,fade);}
  }
  const peak=samples.reduce((a,x)=>Math.max(a,Math.abs(x)),0),rms=Math.sqrt(samples.reduce((a,x)=>a+x*x,0)/samples.length);
  const gain=Math.min((name==='winch'?.14:.18)/(rms||1),(name==='winch'?.5:.65)/(peak||1));samples=samples.map(x=>x*gain);
  const file=`.cache/sample-assets/${name}-processed.wav`;await fs.writeFile(file,wav(samples));
  run(['-v','error','-y','-i',file,'-c:a','libvorbis','-q:a','4',`${out}/${name}.ogg`]);
  const bytes=await fs.readFile(`${out}/${name}.ogg`);
  const old=report.findIndex(r=>r.name===name);if(old>=0)report.splice(old,1);
  report.push({name,file:`assets/sample/audio/${name}.ogg`,sourceFile:path.basename(input),sourceSha256:crypto.createHash('sha256').update(await fs.readFile(input)).digest('hex'),seconds:samples.length/44100,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),processing:'mono, high/low pass, normalized; winch selected continuous segment/compression/65ms equal-power tail-head overlap, one-shots5ms attack/10ms release'});
}
await fs.writeFile('docs/sample/audio-assets.json',JSON.stringify(report,null,2));console.log(report);
