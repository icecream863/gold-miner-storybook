// 浏览器活动时间不使用 Phaser 平滑后的 delta，卡顿也必须真实消耗时间。
// 每次输入前取样，精确排除暂停、商店和结算停留；运动与倒计时仍使用同一时间。
export class ActiveClock {
  private previous: number | null = null;

  sample(now: number, active: boolean): number {
    if (!Number.isFinite(now)) return 0;
    if (this.previous === null) {
      this.previous = now;
      return 0;
    }
    const elapsed = Math.max(0, now - this.previous) / 1000;
    this.previous = Math.max(this.previous, now);
    return active ? elapsed : 0;
  }
}
