import test from "node:test";
import assert from "node:assert/strict";
import { GameAudio, VOICE_LIMIT } from "../src/audio.ts";
import type { SoundKind } from "../src/audio.ts";

class FakeNode {
  onended: (() => void) | null = null;
  disconnected = false;
  started = 0;
  ended = 0;
  frequency = { setValueAtTime: (value: number) => { this.frequencyValue = value; } };
  frequencyValue = 0;
  type = "sine";
  gain = {
    value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {},
  };
  connect() {}
  disconnect() { this.disconnected = true; }
  start() { this.started++; }
  stop() { this.ended++; }
}
class FakeContext {
  static instances: FakeContext[] = [];
  state = "suspended";
  currentTime = 0;
  destination = {};
  oscillators: FakeNode[] = [];
  gains: FakeNode[] = [];
  buffers: (FakeNode & { buffer: unknown; loop: boolean; playbackRate: { value: number } })[] = [];
  constructor() { FakeContext.instances.push(this); }
  resume() { this.state = "running"; return Promise.resolve(); }
  createOscillator() { const node = new FakeNode(); this.oscillators.push(node); return node; }
  createDynamicsCompressor() { const p = () => ({ value: 0 }); return { threshold:p(),knee:p(),ratio:p(),attack:p(),release:p(),connect(){} }; }
  decodeAudioData() { return Promise.resolve({ duration: 5 }); }
  createBufferSource() { const n=Object.assign(new FakeNode(),{buffer:null as unknown,loop:false,playbackRate:{value:1}});this.buffers.push(n);return n; }
  createGain() { const node = new FakeNode(); this.gains.push(node); return node; }
}

test("音频需先解锁；所有关键提示可播放，静音、结束与暂停清理声部", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  Object.defineProperty(globalThis, "AudioContext", { value: FakeContext, configurable: true });
  try {
    const audio = new GameAudio();
    audio.play("launch");
    assert.equal(FakeContext.instances.length, 0);
    assert.equal(audio.snapshot.state, "locked");
    audio.unlock();
    assert.equal(audio.snapshot.state, "running");
    const ctx = FakeContext.instances[0];
    const kinds: SoundKind[] = ["launch", "grab", "heavy", "bag", "reel", "ready", "bank", "buy", "bomb", "lose", "win", "complete"];
    const noteCounts = new Map<SoundKind, number>();
    for (const kind of kinds) {
      const previous = ctx.oscillators.length;
      audio.play(kind, 11);
      noteCounts.set(kind, ctx.oscillators.length - previous);
      assert.ok(audio.snapshot.voices > 0);
      for (const node of ctx.oscillators.slice(previous)) node.onended?.();
      assert.equal(audio.snapshot.voices, 0);
    }
    assert.ok(noteCounts.get("complete")! > noteCounts.get("win")!);
    assert.ok(ctx.gains.slice(2).every((gain) => gain.disconnected));
    audio.play("reel", .55);
    const lightFrequency = ctx.oscillators.at(-1)!.frequencyValue;
    audio.silence();
    audio.play("reel", 14);
    assert.ok(ctx.oscillators.at(-1)!.frequencyValue < lightFrequency);
    audio.toggle();
    assert.equal(audio.snapshot.voices, 0);
    const before = ctx.oscillators.length;
    audio.play("bank");
    assert.equal(ctx.oscillators.length, before);
    audio.toggle();
    for (let i = 0; i < 1000; i++) audio.play("bank");
    assert.equal(audio.snapshot.voices, VOICE_LIMIT);
    audio.silence();
    assert.equal(audio.snapshot.voices, 0);
    assert.ok(ctx.oscillators.every((node) => node.disconnected));
    audio.play("bank");
    ctx.state = "closed";
    audio.unlock();
    assert.equal(FakeContext.instances.length, 2);
    assert.equal(audio.snapshot.voices, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

test("音频构造被禁用或恢复被拒绝时，游戏调用不抛异常", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  try {
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: class { constructor() { throw new Error("blocked"); } },
    });
    const blocked = new GameAudio();
    assert.doesNotThrow(() => { blocked.unlock(); blocked.play("launch"); blocked.silence(); });
    assert.equal(blocked.snapshot.state, "locked");
    Object.defineProperty(globalThis, "AudioContext", {
      configurable: true,
      value: class extends FakeContext { resume() { return Promise.reject(new Error("denied")); } },
    });
    const denied = new GameAudio();
    denied.unlock();
    await Promise.resolve();
    denied.play("bank");
    assert.equal(denied.snapshot.voices, 0);
    assert.equal(denied.snapshot.state, "suspended");
  } finally {
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  }
});

const settle = () => new Promise(resolve => setImmediate(resolve));
async function audioFixture(run: (audio: GameAudio, ctx: FakeContext) => Promise<void>, fetcher: typeof fetch = async () => new Response(new Uint8Array([1,2,3]))) {
  const context = Object.getOwnPropertyDescriptor(globalThis,"AudioContext"), storage = Object.getOwnPropertyDescriptor(globalThis,"localStorage"), originalFetch = globalThis.fetch;
  const values = new Map<string,string>();
  Object.defineProperty(globalThis,"AudioContext",{value:FakeContext,configurable:true});
  Object.defineProperty(globalThis,"localStorage",{value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)},configurable:true});
  globalThis.fetch=fetcher;
  const audio=new GameAudio();audio.unlock();const ctx=FakeContext.instances.at(-1)!;
  try{await run(audio,ctx);}finally{audio.setEnvironment("paused");audio.silence();globalThis.fetch=originalFetch;if(context)Object.defineProperty(globalThis,"AudioContext",context);else Reflect.deleteProperty(globalThis,"AudioContext");if(storage)Object.defineProperty(globalThis,"localStorage",storage);else Reflect.deleteProperty(globalThis,"localStorage");}
}

test("音乐默认20%、音效70%，暂停/帮助/切页保存位置，重复环境同步不重复开播",async()=>{
 await audioFixture(async(audio,ctx)=>{await settle();audio.setEnvironment("playing");assert.equal(audio.snapshot.music.sources,1);assert.equal(audio.snapshot.settings.musicVolume,.2);assert.equal(audio.snapshot.settings.effectsVolume,.7);
 ctx.currentTime=2;audio.setEnvironment("paused");assert.equal(audio.snapshot.music.offset,2);assert.equal(audio.snapshot.music.sources,0);
 ctx.currentTime=20;audio.setEnvironment("playing");assert.equal(audio.snapshot.music.offset,2);assert.equal(audio.snapshot.music.sources,1);
 const starts=ctx.buffers.length;for(let i=0;i<100;i++)audio.setEnvironment("playing");assert.equal(ctx.buffers.length,starts);
 audio.setEnvironment("playing",true);assert.equal(audio.snapshot.music.sources,0);audio.setEnvironment("shop");assert.equal(audio.snapshot.music.sources,1);audio.setEnvironment("result");assert.equal(audio.snapshot.music.sources,0);
 });
});

test("音乐音效独立关闭、总静音与音量边界、保存偏好后重开生效",async()=>{
 await audioFixture(async(audio)=>{await settle();audio.configure({musicEnabled:false});assert.equal(audio.snapshot.music.sources,0);audio.play("grab");assert.ok(audio.snapshot.voices>0);audio.silence();
 audio.configure({effectsEnabled:false,musicEnabled:true,musicVolume:5,effectsVolume:-5});assert.equal(audio.snapshot.settings.musicVolume,1);assert.equal(audio.snapshot.settings.effectsVolume,0);audio.play("grab");assert.equal(audio.snapshot.voices,0);assert.equal(audio.snapshot.music.sources,1);
 const next=new GameAudio();assert.deepEqual(next.snapshot.settings,audio.snapshot.settings);audio.toggle();assert.equal(audio.snapshot.music.sources,0);audio.toggle();assert.equal(audio.snapshot.music.sources,1);
 });
});

test("音乐慢加载后若已暂停不能偷播，恢复只创建一个循环音源",async()=>{
 let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve);
 await audioFixture(async(audio)=>{audio.setEnvironment("paused");release();await settle();assert.equal(audio.snapshot.music.sources,0);audio.setEnvironment("playing");assert.equal(audio.snapshot.music.sources,1);},async(input)=>{if(String(input).includes('western'))await wait;return new Response(new Uint8Array([1]));});
});

test("音乐两种编码加载失败可重试，关闭音乐及连续暂停重开均释放音源",async()=>{
 let failed=true;
 await audioFixture(async(audio,ctx)=>{await settle();assert.equal(audio.snapshot.music.state,"error");assert.equal(audio.snapshot.music.sources,0);failed=false;audio.setEnvironment("paused");audio.retryMusic();await settle();assert.equal(audio.snapshot.music.state,"paused");audio.setEnvironment("playing");assert.equal(audio.snapshot.music.state,"playing");
 for(let i=0;i<100;i++){audio.setEnvironment("paused");audio.setEnvironment("playing");}assert.equal(audio.snapshot.music.sources,1);assert.equal(ctx.buffers.filter(n=>n.loop&&n.ended===0).length,1);audio.configure({musicEnabled:false});assert.equal(ctx.buffers.filter(n=>n.loop&&n.ended===0).length,0);
 },async()=>{if(failed)throw Error("network");return new Response(new Uint8Array([1]));});
});
