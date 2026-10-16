export class GameAudio {
  muted = false;
  private context: AudioContext | null = null;

  unlock(): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* 音频不可用时，玩法与输入仍然正常工作。 */ }
  }

  toggle(): void { this.muted = !this.muted; if (!this.muted) this.unlock(); }

  play(kind: 'launch' | 'grab' | 'bank' | 'bomb' | 'win' | 'lose' | 'buy'): void {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const notes = {
      launch: [240, 160], grab: [330, 260], bank: [660, 880, 1100], bomb: [95, 55, 35],
      win: [440, 550, 660, 880], lose: [330, 260, 196], buy: [520, 780],
    }[kind];
    const ctx = this.context;
    notes.forEach((frequency, i) => {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.075;
      oscillator.type = kind === 'bomb' ? 'sawtooth' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(kind === 'bomb' ? 0.04 : 0.065, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(start); oscillator.stop(start + 0.2);
    });
  }
}
