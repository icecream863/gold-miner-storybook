export type SoundKind = "launch" | "grab" | "bank" | "bomb" | "win" | "complete" | "lose" | "buy" | "heavy" | "bag" | "ready" | "reel";
export const VOICE_LIMIT = 16;
export interface AudioSettings { musicEnabled: boolean; effectsEnabled: boolean; musicVolume: number; effectsVolume: number }
export const AUDIO_DEFAULTS: Readonly<AudioSettings> = Object.freeze({ musicEnabled: true, effectsEnabled: true, musicVolume: .2, effectsVolume: .7 });
const STORAGE_KEY = "gold-miner.audio.v1";
const SAMPLES: Partial<Record<SoundKind, string>> = { launch: "launch", grab: "grab", heavy: "heavy", reel: "reel", buy: "buy", bank: "bank", bomb: "bomb", ready: "ready" };
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export class GameAudio {
  muted = false;
  private settings: { musicEnabled: boolean; effectsEnabled: boolean; musicVolume: number; effectsVolume: number } = { ...AUDIO_DEFAULTS };
  private voices = new Map<AudioScheduledSourceNode, GainNode>();
  private context: AudioContext | null = null;
  private effectsBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private lastSound: SoundKind | null = null;
  private samples = new Map<SoundKind, AudioBuffer>();
  private samplesLoading = false;
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicLoading: Promise<void> | null = null;
  private musicError = false;
  private musicOffset = 0;
  private musicStarted = 0;
  private phase = "menu";
  private blocked = false;
  private duckUntil = 0;
  private base: string;

  constructor(base = "assets/audio/") {
    this.base = base;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      for (const key of ["musicEnabled", "effectsEnabled"] as const) if (typeof saved[key] === "boolean") this.settings[key] = saved[key];
      for (const key of ["musicVolume", "effectsVolume"] as const) if (typeof saved[key] === "number" && Number.isFinite(saved[key])) this.settings[key] = clamp(saved[key]);
      this.muted = saved.muted === true;
    } catch { /* 隐私模式或损坏的偏好不能阻断开始游戏。 */ }
  }
  configure(patch: Partial<AudioSettings>): void {
    for (const key of ["musicEnabled", "effectsEnabled"] as const) if (typeof patch[key] === "boolean") this.settings[key] = patch[key];
    for (const key of ["musicVolume", "effectsVolume"] as const) if (typeof patch[key] === "number" && Number.isFinite(patch[key])) this.settings[key] = clamp(patch[key]);
    this.persist(); this.volumes();
    if (!this.settings.effectsEnabled) this.silence();
    this.syncMusic();
  }
  private persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.settings, muted: this.muted })); } catch { /* 可禁用存储。 */ } }
  unlock(): void {
    try {
      if (this.context?.state === "closed") {
        this.silence(); this.stopMusic(); this.context = null; this.effectsBus = this.musicBus = null;
      }
      if (!this.context) {
        this.context = new AudioContext();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20;
        limiter.attack.value = .003; limiter.release.value = .18; limiter.connect(this.context.destination);
        this.effectsBus = this.context.createGain(); this.effectsBus.connect(limiter);
        this.musicBus = this.context.createGain(); this.musicBus.connect(limiter);
        this.volumes();
      }
      if (this.context.state !== "running") void this.context.resume().then(() => this.syncMusic()).catch(() => {});
      this.syncMusic(); this.loadSamples();
    } catch { /* 没有音频权限仍可玩。 */ }
  }
  toggle(): void {
    this.muted = !this.muted; this.persist(); this.volumes();
    if (this.muted) { this.silence(); this.stopMusic(); } else this.unlock();
  }
  // 场景、帮助和页面可见性在这一处统一决定音乐生命周期。
  setEnvironment(phase: string, blocked = false): void {
    const changed = phase !== this.phase || blocked !== this.blocked;
    this.phase = phase; this.blocked = blocked;
    if (blocked || phase === "paused") this.silence();
    if (changed) { this.volumes(); this.syncMusic(); }
  }
  silence(): void {
    for (const [source, gain] of this.voices) {
      try { source.stop(); } catch { /* 已结束。 */ }
      source.disconnect(); gain.disconnect();
    }
    this.voices.clear();
  }
  private volumes() {
    const ctx = this.context; if (!ctx) return;
    this.effectsBus?.gain.setTargetAtTime(this.muted ? 0 : this.settings.effectsVolume, ctx.currentTime, .015);
    const duck = ctx.currentTime < this.duckUntil ? .45 : 1;
    this.musicBus?.gain.setTargetAtTime(this.muted ? 0 : this.settings.musicVolume * (this.phase === "shop" || this.phase === "menu" ? .7 : 1) * duck, ctx.currentTime, .035);
  }
  private canMusic() { return !this.muted && this.settings.musicEnabled && this.settings.musicVolume > 0 && !this.blocked && ["menu", "playing", "shop"].includes(this.phase) && this.context?.state === "running"; }
  private stopMusic() {
    if (!this.musicSource) return;
    const src = this.musicSource; this.musicOffset = this.offset(); this.musicSource = null;
    try { src.stop(); } catch { /* 取消时刻可能已结束。 */ }
    src.disconnect();
  }
  private offset() {
    const duration = this.musicBuffer?.duration ?? 0;
    return duration > 0 ? ((this.musicSource && this.context ? this.context.currentTime - this.musicStarted : this.musicOffset) % duration + duration) % duration : 0;
  }
  private syncMusic() {
    if (!this.canMusic()) { this.stopMusic(); return; }
    if (!this.musicBuffer) { if (!this.musicError) void this.loadMusic(); return; }
    if (this.musicSource || !this.context || !this.musicBus) return;
    const src = this.context.createBufferSource(); src.buffer = this.musicBuffer; src.loop = true;
    src.connect(this.musicBus); this.musicSource = src; this.musicStarted = this.context.currentTime - this.musicOffset;
    src.onended = () => { src.disconnect(); if (this.musicSource === src) this.musicSource = null; };
    src.start(0, this.musicOffset); this.volumes();
  }
  private async decoded(file: string): Promise<AudioBuffer> {
    if (!this.context) throw new Error("locked");
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(this.base + file, { signal: controller.signal });
      if (!response.ok) throw new Error("音频资源不可用");
      return await this.context.decodeAudioData(await response.arrayBuffer());
    } finally { clearTimeout(timeout); }
  }
  private loadMusic(): Promise<void> {
    if (this.musicLoading) return this.musicLoading;
    this.musicLoading = (async () => {
      try {
        // 两种编码共享同一首音乐，加载/解码都失败时才进入可重试状态。
        try { this.musicBuffer = await this.decoded("western.ogg"); }
        catch { this.musicBuffer = await this.decoded("western.mp3"); }
        this.musicError = false; this.musicOffset = 0;
      } catch { this.musicError = true; }
      finally { this.musicLoading = null; }
      // 加载期间可能已经暂停、静音或结算；必须重新检查，不能在旧回调里自动开播。
      if (!this.musicError) this.syncMusic();
    })();
    return this.musicLoading;
  }
  retryMusic(): void {
    this.musicError = false; this.unlock();
    // 设置面板会阻止播放，但不能因此阻止用户主动重试下载。
    if (this.context && !this.musicBuffer) void this.loadMusic();
  }
  private loadSamples(): void {
    if (this.samplesLoading) return;
    this.samplesLoading = true;
    for (const [kind, file] of Object.entries(SAMPLES)) void this.decoded(file + ".ogg").then(b => this.samples.set(kind as SoundKind, b)).catch(() => {});
  }
  get snapshot() {
    return { muted: this.muted, state: this.context?.state ?? "locked", voices: this.voices.size, lastSound: this.lastSound,
      settings: { ...this.settings }, samples: this.samples.size,
      music: { state: this.musicError ? "error" : this.musicLoading ? "loading" : this.musicSource ? "playing" : !this.settings.musicEnabled || this.muted ? "off" : this.musicBuffer ? "paused" : "locked",
        sources: this.musicSource ? 1 : 0, offset: this.offset(), duration: this.musicBuffer?.duration ?? 0, error: this.musicError } };
  }
  play(kind: SoundKind, weight = 0): void {
    const ctx = this.context;
    if (this.muted || !this.settings.effectsEnabled || !ctx || ctx.state !== "running" || this.blocked || this.phase === "paused") return;
    this.lastSound = kind;
    if (["bank", "bomb", "bag", "win", "complete", "lose"].includes(kind) && this.musicBus) {
      this.duckUntil = ctx.currentTime + .6; const g = this.musicBus.gain;
      g.cancelScheduledValues(ctx.currentTime); g.setTargetAtTime(this.settings.musicVolume * .45, ctx.currentTime, .02);
      g.setTargetAtTime(this.settings.musicVolume, this.duckUntil, .15);
    }
    const sample = this.samples.get(kind);
    if (sample && this.voices.size < VOICE_LIMIT) {
      const source = ctx.createBufferSource(), gain = ctx.createGain(); source.buffer = sample;
      source.playbackRate.value = kind === "reel" ? Math.max(.65, 1.1 - weight * .035) : 1;
      gain.gain.value = kind === "reel" ? .16 : kind === "bomb" ? .42 : .5;
      this.voice(source, gain); source.start();
      if (kind !== "bank") return;
    }
    const notes = { launch:[240,160], grab:[330,260], bank:[660,880,1100], bomb:[95,55,35], win:[440,550,660,880], complete:[440,550,660,880,1100,1320], lose:[330,260,196], buy:[520,780], heavy:[140,105], bag:[440,660,880,1320], ready:[180,240], reel:[Math.max(55,130-weight*4)] }[kind];
    const duration = kind === "reel" ? .055 : kind === "ready" ? .11 : .2;
    for (const [index, frequency] of notes.entries()) {
      if (this.voices.size >= VOICE_LIMIT) break;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + index * .075;
      oscillator.type = kind === "bomb" ? "sawtooth" : kind === "reel" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(kind === "reel" ? .009 : .065, start + .008);
      gain.gain.exponentialRampToValueAtTime(.001, start + duration - .01);
      this.voice(oscillator, gain); oscillator.start(start); oscillator.stop(start + duration);
    }
  }
  private voice(source: AudioScheduledSourceNode, gain: GainNode) {
    source.connect(gain); gain.connect(this.effectsBus!); this.voices.set(source, gain);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); };
  }
}
