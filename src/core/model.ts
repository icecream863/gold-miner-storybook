export type ItemKind = "small" | "medium" | "large" | "rock" | "diamond";
export type HookState = "swinging" | "extending" | "returning";
export type Phase =
  | "menu"
  | "playing"
  | "paused"
  | "result"
  | "shop"
  | "complete";
export interface Point {
  x: number;
  y: number;
}
export interface Item extends Point {
  id: string;
  kind: ItemKind;
  radius: number;
  value: number;
  weight: number;
  taken: boolean;
}
export interface LevelConfig {
  name: string;
  subtitle: string;
  target: number;
  seconds: number;
  color: number;
  items: readonly [ItemKind, number, number][];
}
export interface RunState {
  money: number;
  bombs: number;
  strength: boolean;
}
export type GameEvent = {
  type: "launch" | "grab" | "bank" | "bomb" | "end";
  item?: Item;
  x?: number;
  y?: number;
  success?: boolean;
};

export const WORLD = {
  width: 1120,
  height: 680,
  pivot: { x: 560, y: 148 },
  rest: 34,
  left: 34,
  right: 1086,
  bottom: 635,
};
export const GOODS = {
  small: { radius: 18, value: 100, weight: 1 },
  medium: { radius: 27, value: 250, weight: 2.8 },
  large: { radius: 39, value: 500, weight: 5.8 },
  rock: { radius: 29, value: 15, weight: 7.5 },
  diamond: { radius: 17, value: 650, weight: 0.55 },
} satisfies Record<ItemKind, { radius: number; value: number; weight: number }>;

export const LEVELS: readonly LevelConfig[] = [
  {
    name: "晨光矿谷",
    subtitle: "第一站 · 找回出钩的节奏",
    target: 650,
    seconds: 60,
    color: 0x87613b,
    items: [
      ["small", 405, 294],
      ["small", 710, 300],
      ["medium", 250, 373],
      ["large", 553, 465],
      ["rock", 819, 387],
      ["rock", 363, 470],
      ["diamond", 915, 518],
      ["small", 147, 500],
      ["medium", 743, 565],
      ["small", 442, 594],
      ["large", 180, 596],
    ],
  },
  {
    name: "琥珀回廊",
    subtitle: "第二站 · 分清重量与价值",
    target: 2600,
    seconds: 60,
    color: 0x765740,
    items: [
      ["rock", 465, 300],
      ["small", 695, 285],
      ["medium", 836, 364],
      ["large", 275, 450],
      ["diamond", 545, 532],
      ["rock", 666, 407],
      ["small", 157, 389],
      ["diamond", 946, 552],
      ["large", 747, 578],
      ["medium", 388, 589],
      ["rock", 1000, 402],
    ],
  },
  {
    name: "星辉深井",
    subtitle: "最后一站 · 带着宝藏回家",
    target: 4800,
    seconds: 60,
    color: 0x55564f,
    items: [
      ["rock", 540, 300],
      ["medium", 760, 321],
      ["diamond", 355, 381],
      ["large", 154, 495],
      ["rock", 423, 484],
      ["diamond", 644, 514],
      ["rock", 850, 459],
      ["small", 953, 332],
      ["large", 945, 589],
      ["diamond", 246, 605],
      ["medium", 530, 603],
    ],
  },
];

// 返回接触时刻 t（0..1）。比较 t 才能选中最先撞到的物品，不能依赖数组顺序。
export function sweepCircle(
  from: Point,
  to: Point,
  center: Point,
  radius: number,
): number | null {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const ox = from.x - center.x,
    oy = from.y - center.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (ox * dx + oy * dy),
    d = b * b - 4 * a * c;
  if (d < 0) return null;
  const t = (-b - Math.sqrt(d)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export class MinerModel {
  phase: Phase = "menu";
  levelIndex = 0;
  run: RunState = { money: 0, bombs: 1, strength: false };
  entry: RunState = { ...this.run };
  items: Item[] = [];
  remaining = 60;
  angle = -0.85;
  direction = 1;
  length = WORLD.rest;
  hook: HookState = "swinging";
  carried: Item | null = null;
  success = false;
  earned = 0;
  purchases = { bomb: false, strength: false };
  events: GameEvent[] = [];

  get level(): LevelConfig {
    return LEVELS[this.levelIndex];
  }
  get tip(): Point {
    return {
      x: WORLD.pivot.x + Math.sin(this.angle) * this.length,
      y: WORLD.pivot.y + Math.cos(this.angle) * this.length,
    };
  }
  get returnSpeed(): number {
    return this.carried
      ? Math.min(
          600,
          (this.run.strength ? 630 : 420) / (1 + this.carried.weight * 0.75),
        )
      : 600;
  }

  start(): void {
    this.levelIndex = 0;
    this.run = { money: 0, bombs: 1, strength: false };
    this.enterLevel();
  }

  enterLevel(): void {
    this.entry = { ...this.run };
    this.items = this.level.items.map(([kind, x, y], i) => ({
      id: `${this.levelIndex}-${i}`,
      kind,
      x,
      y,
      ...GOODS[kind],
      taken: false,
    }));
    this.remaining = this.level.seconds;
    this.angle = -0.85;
    this.direction = 1;
    this.length = WORLD.rest;
    this.hook = "swinging";
    this.carried = null;
    this.earned = 0;
    this.success = false;
    this.events = [];
    this.phase = "playing";
  }

  retry(): boolean {
    if (this.phase !== "result" || this.success) return false;
    this.run = { ...this.entry };
    this.enterLevel();
    return true;
  }

  launch(): boolean {
    if (this.phase !== "playing" || this.hook !== "swinging") return false;
    this.hook = "extending";
    this.events.push({ type: "launch" });
    return true;
  }

  useBomb(): boolean {
    if (this.phase !== "playing" || !this.carried || this.run.bombs <= 0)
      return false;
    this.run.bombs--;
    this.events.push({ type: "bomb", item: this.carried, ...this.tip });
    this.carried = null;
    return true;
  }

  pause(): void {
    if (this.phase === "playing") this.phase = "paused";
  }
  resume(): void {
    if (this.phase === "paused") this.phase = "playing";
  }
  menu(): void {
    this.phase = "menu";
    this.carried = null;
    this.events = [];
  }

  openShop(): boolean {
    if (
      this.phase !== "result" ||
      !this.success ||
      this.levelIndex === LEVELS.length - 1
    )
      return false;
    // 力量药水只作用于已经结束的这一关，下一关需要重新购买。
    this.run.strength = false;
    this.purchases = { bomb: false, strength: false };
    this.phase = "shop";
    return true;
  }

  buy(product: "bomb" | "strength"): boolean {
    const cost = product === "bomb" ? 100 : 150;
    if (
      this.phase !== "shop" ||
      this.purchases[product] ||
      this.run.money < cost
    )
      return false;
    this.run.money -= cost;
    this.purchases[product] = true;
    if (product === "bomb") this.run.bombs++;
    else this.run.strength = true;
    return true;
  }

  next(): boolean {
    if (this.phase !== "shop") return false;
    this.levelIndex++;
    this.enterLevel();
    return true;
  }

  finish(): void {
    if (this.phase !== "playing") return;
    this.remaining = 0;
    this.success = this.run.money >= this.level.target;
    this.phase =
      this.success && this.levelIndex === LEVELS.length - 1
        ? "complete"
        : "result";
    this.carried = null;
    this.events.push({ type: "end", success: this.success });
  }

  update(seconds: number): void {
    if (this.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0)
      return;
    // 小步长同时驱动运动和计时，避免低帧率、重试或暂停使两个系统使用不同的时间。
    let available = seconds;
    while (available > 1e-8 && this.phase === "playing") {
      const dt = Math.min(available, 1 / 120, this.remaining);
      this.remaining = Math.max(0, this.remaining - dt);
      // 到期优先结算：截止时仍挂在绳上的物品不会在动画回调里补发奖金。
      if (this.remaining <= 1e-8) {
        this.finish();
        break;
      }
      this.step(dt);
      available -= dt;
    }
  }

  private step(dt: number): void {
    if (this.hook === "swinging") {
      const limit = 1.18;
      this.angle += this.direction * 0.76 * dt;
      if (this.angle > limit) {
        this.angle = 2 * limit - this.angle;
        this.direction = -1;
      }
      if (this.angle < -limit) {
        this.angle = -2 * limit - this.angle;
        this.direction = 1;
      }
      return;
    }
    if (this.hook === "returning") {
      this.length = Math.max(WORLD.rest, this.length - this.returnSpeed * dt);
      if (this.length === WORLD.rest) {
        if (this.carried) {
          this.run.money += this.carried.value;
          this.earned += this.carried.value;
          this.events.push({ type: "bank", item: this.carried, ...this.tip });
        }
        this.carried = null;
        this.hook = "swinging";
      }
      return;
    }
    const from = this.tip;
    const sin = Math.sin(this.angle),
      cos = Math.cos(this.angle);
    const horizontalLimit =
      Math.abs(sin) < 1e-8
        ? Infinity
        : (sin < 0 ? WORLD.pivot.x - WORLD.left : WORLD.right - WORLD.pivot.x) /
          Math.abs(sin);
    const maxLength = Math.min(
      horizontalLimit,
      (WORLD.bottom - WORLD.pivot.y) / cos,
    );
    this.length = Math.min(maxLength, this.length + 560 * dt);
    const to = this.tip;
    let first: Item | null = null,
      firstTime = Infinity;
    for (const item of this.items) {
      if (item.taken) continue;
      const t = sweepCircle(from, to, item, item.radius + 6);
      if (t !== null && t < firstTime) {
        first = item;
        firstTime = t;
      }
    }
    if (first) {
      this.length = Math.hypot(
        from.x + (to.x - from.x) * firstTime - WORLD.pivot.x,
        from.y + (to.y - from.y) * firstTime - WORLD.pivot.y,
      );
      first.taken = true;
      this.carried = first;
      this.hook = "returning";
      this.events.push({ type: "grab", item: first, ...this.tip });
    } else if (this.length >= maxLength) this.hook = "returning";
  }
}
