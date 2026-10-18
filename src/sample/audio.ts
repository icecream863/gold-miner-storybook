export interface SampleAudioSettings { musicEnabled: boolean; effectsEnabled: boolean; musicVolume: number; effectsVolume: number }
export const SAMPLE_AUDIO_DEFAULTS = Object.freeze({ musicEnabled: false, effectsEnabled: true, musicVolume: .2, effectsVolume: .7 });
export function readSampleSettings(storage: Pick<Storage, 'getItem'> | null): SampleAudioSettings & { muted: boolean } {
  const result: SampleAudioSettings & { muted: boolean } = { ...SAMPLE_AUDIO_DEFAULTS, muted: false };
  try {
    const saved = JSON.parse(storage?.getItem('gold-miner.audio.v1') ?? '{}');
    for (const key of ['musicEnabled', 'effectsEnabled', 'muted'] as const) if (typeof saved[key] === 'boolean') result[key] = saved[key];
    for (const key of ['musicVolume', 'effectsVolume'] as const) if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) result[key] = Math.max(0, Math.min(1, saved[key]));
  } catch { /* 没有存储也能开始。 */ }
  return result;
}
type OneShot = 'launch' | 'grab' | 'bank';
export class SampleAudio {
  settings: SampleAudioSettings & { muted: boolean };
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<AudioScheduledSourceNode, GainNode>();
  private nextReel = 0;
  private loading: Promise<void> | null = null;
  private active = false;
  private wantedReel = false;
  private weight = 0;
  private music: HTMLAudioElement | null = null;
  private loadError = false;
  private base: string;
  constructor(base: string) {
    this.base = base;
    let storage: Storage | null = null;
    try { storage = localStorage; } catch { /* 隐私设置。 */ }
    this.settings = readSampleSettings(storage);
  }
  unlock() {
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        this.silence();
        this.ctx = new AudioContext(); this.bus = this.ctx.createGain();
        const limit = this.ctx.createDynamicsCompressor(); limit.threshold.value = -6; limit.ratio.value = 20;
        limit.knee.value=0;limit.attack.value=.003;limit.release.value=.18;
        this.bus.connect(limit); limit.connect(this.ctx.destination);
      }
      const context = this.ctx;
      void context.resume().catch(() => {});
      if (!this.loading && this.buffers.size < 4) this.loading = this.load();
      this.volume(); this.syncMusic();
    } catch { /* 音频不可用时玩法照常。 */ }
  }
  private async load() {
    const ctx = this.ctx!;
    this.loadError = false;
    await Promise.all(['launch', 'grab', 'bank', 'reel'].map(async name => {
      try {
        const response = await fetch(this.base + name + '.ogg', { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw Error('audio');
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        if (ctx === this.ctx) this.buffers.set(name, buffer);
      } catch { this.loadError = true; }
    }));
    this.loading = null;
  }
  configure(patch: Partial<SampleAudioSettings & { muted: boolean }>) {
    for (const key of ['musicEnabled', 'effectsEnabled', 'muted'] as const) if (typeof patch[key] === 'boolean') this.settings[key] = patch[key];
    for (const key of ['musicVolume', 'effectsVolume'] as const) if (typeof patch[key] === 'number' && Number.isFinite(patch[key])) this.settings[key] = Math.max(0, Math.min(1, patch[key]));
    try { localStorage.setItem('gold-miner.audio.v1', JSON.stringify(this.settings)); } catch { /* 可禁用存储。 */ }
    this.volume(); if (!this.allowed()) this.silence(); this.syncMusic();
  }
  private volume() { if (this.ctx && this.bus) this.bus.gain.setTargetAtTime(this.settings.effectsVolume, this.ctx.currentTime, .015); }
  private allowed() { return this.active && !this.settings.muted && this.settings.effectsEnabled && this.ctx?.state === 'running'; }
  setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    if (!active) this.silence();
    this.syncMusic();
  }
  setReel(wanted: boolean, weight: number, now: number) {
    this.wantedReel = wanted; this.weight = weight;
    if (!wanted || !this.allowed()) { this.nextReel = now; return; }
    // 回到A版短促的街机绞盘声，保持原来的轻/重间隔，不再使用样片的链条循环。
    if (now >= this.nextReel) { this.playEffect('reel'); this.nextReel = now+(weight>=5 ? .28 : .16); }
  }
  private voice(buffer: AudioBuffer, gainValue: number, loop = false) {
    if (!this.ctx || !this.bus) return null;
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = buffer; source.loop = loop; gain.gain.value = loop ? 0 : gainValue;
    source.connect(gain); gain.connect(this.bus); this.voices.set(source, gain);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
    if (loop) gain.gain.linearRampToValueAtTime(gainValue, this.ctx.currentTime + .035);
    return source;
  }
  play(name: OneShot) {
    this.playEffect(name);
  }
  private playEffect(name: OneShot | 'reel') {
    if (!this.allowed() || !this.ctx || !this.bus || this.voices.size>=16) return;
    const buffer=this.buffers.get(name);
    // 文件、增益、音阶和包络沿用1.3；用户已选择A版，而非只模仿一个相似音色。
    if (buffer) {
      const source=this.voice(buffer,name==='reel' ? .16 : .5);
      if(source) {source.playbackRate.value=name==='reel' ? Math.max(.65,1.1-this.weight*.035) : 1;source.start();}
      if(name!=='bank') return;
    }
    const notes={launch:[240,160],grab:[330,260],bank:[660,880,1100],reel:[Math.max(55,130-this.weight*4)]}[name];
    const duration=name==='reel' ? .055 : .2;
    for(const [i,hz] of notes.entries()) {
      if(this.voices.size>=16)break;
      const source=this.ctx.createOscillator(),gain=this.ctx.createGain(),at=this.ctx.currentTime+i*.075;
      source.type=name==='reel' ? 'triangle' : 'sine';source.frequency.setValueAtTime(hz,at);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(name==='reel' ? .009 : .065,at+.008);
      gain.gain.exponentialRampToValueAtTime(.001,at+duration-.01);
      source.connect(gain);gain.connect(this.bus);this.voices.set(source,gain);
      source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};
      source.start(at);source.stop(at+duration);
    }
  }
  private silence() {
    for (const [source, gain] of this.voices) { try { source.stop(); } catch { /* 已停止。 */ } source.disconnect(); gain.disconnect(); }
    this.voices.clear();
  }
  private syncMusic() {
    const enabled = this.active && !this.settings.muted && this.settings.musicEnabled;
    if (!enabled) { this.music?.pause(); return; }
    if (!this.music) {
      this.music = new Audio(new URL('western.mp3', new URL(this.base, location.href)).href);
      this.music.loop = true;
    }
    this.music.volume = this.settings.musicVolume;
    void this.music.play().then(() => { if (!this.active || !this.settings.musicEnabled || this.settings.muted) this.music?.pause(); }).catch(() => { this.loadError = true; });
  }
  retry() { this.loadError = false; if (this.music?.error) this.music.load(); this.unlock(); }
  reset() { this.wantedReel = false; this.nextReel=0; this.silence(); this.music?.pause(); if (this.music) this.music.currentTime = 0; }
  get snapshot() { return { settings: { ...this.settings }, voices: this.voices.size, loopSources: 0, reelActive: this.wantedReel && !!this.allowed(), ready: this.buffers.size === 4, error: this.loadError, musicPlaying: !!this.music && !this.music.paused }; }
}
