import { SHOP, emptyPurchases, emptyUpgrades, makeOffers, bagValue, seededRandom } from "./shop.ts";
import type { LevelUpgrades, ProductId, ShopOffer } from "./shop.ts";
export { SHOP } from "./shop.ts";
export type { ProductId } from "./shop.ts";
export interface Point {
    x: number;
    y: number;
}
export type ItemKind = "small" | "medium" | "large" | "rock" | "diamond" | "bag" | "bone" | "skull" | "mole" | "diamondMole" | "tnt";
export type HookState = "swinging" | "extending" | "returning";
export type Phase = "menu" | "playing" | "paused" | "result" | "shop" | "complete";
export interface Patrol {
    left: number;
    right: number;
    speed: number;
    direction: number;
}
export interface Item extends Point {
    id: string;
    kind: ItemKind;
    radius: number;
    value: number;
    weight: number;
    taken: boolean;
    patrol?: Patrol;
}
export interface LevelConfig {
    name: string;
    subtitle: string;
    target: number;
    seconds: number;
    items: readonly (readonly [
        ItemKind,
        number,
        number
    ])[];
}
export interface RunState extends LevelUpgrades {
    money: number;
    bombs: number;
}
export interface CatchSnapshot {
    readonly itemId: string;
    readonly kind: ItemKind;
    readonly value: number;
    readonly weight: number;
    readonly offset: Readonly<Point>;
}
export type GameEvent = {
    type: "launch";
} | ({
    type: "grab" | "bank" | "bomb";
    item: CatchSnapshot;
} & Point) | {
    type: "explosion";
    ids: readonly string[];
    centers: readonly Point[];
} | {
    type: "end";
    success: boolean;
};
export const WORLD = { width: 1100, height: 800, pivot: { x: 550, y: 130 }, rest: 34, left: 30, right: 1070, bottom: 765 };
export const TNT_RADIUS = 110;
export const ITEM_NAMES: Record<ItemKind, string> = {
    small: "小金块", medium: "金块", large: "大金块", rock: "石头", diamond: "钻石", bag: "问号袋",
    bone: "骨头", skull: "头骨", mole: "小鼹鼠", diamondMole: "携钻鼹鼠", tnt: "TNT 炸药桶",
};
export const GOODS = {
    small: { radius: 18, value: 100, weight: 1 }, medium: { radius: 27, value: 250, weight: 2.8 },
    large: { radius: 39, value: 500, weight: 5.8 }, rock: { radius: 29, value: 15, weight: 7.5 },
    diamond: { radius: 17, value: 650, weight: .55 }, bag: { radius: 22, value: 50, weight: 3 },
    bone: { radius: 20, value: 10, weight: 1 }, skull: { radius: 23, value: 20, weight: 2 },
    mole: { radius: 22, value: 10, weight: 1 }, diamondMole: { radius: 23, value: 650, weight: 1.5 },
    tnt: { radius: 25, value: 0, weight: 0 },
} satisfies Record<ItemKind, {
    radius: number;
    value: number;
    weight: number;
}>;
// 固定地图，不随机决定可达性；随机只影响袋子内容与下一家店的报价。
export const LEVELS: readonly LevelConfig[] = [
    { name: "初入金矿", subtitle: "金块越大越沉，拉回地面才入账", target: 650, seconds: 60, items: [
            ["small", 200, 270], ["medium", 380, 330], ["large", 790, 420], ["large", 220, 530], ["medium", 650, 570],
            ["small", 930, 260], ["small", 520, 420], ["rock", 850, 600], ["rock", 430, 570], ["bag", 910, 710], ["small", 130, 720], ["medium", 530, 710],
        ] },
    { name: "钻石矿层", subtitle: "钻石轻而值钱；看看补给是否值得买", target: 1800, seconds: 60, items: [
            ["diamond", 250, 300], ["diamond", 860, 360], ["large", 150, 580], ["large", 740, 600], ["large", 450, 680],
            ["medium", 500, 400], ["medium", 960, 650], ["small", 690, 280], ["rock", 350, 460], ["rock", 950, 490],
            ["bone", 120, 360], ["skull", 610, 540], ["bag", 270, 710], ["small", 800, 740],
        ] },
    { name: "鼹鼠出没", subtitle: "看准移动方向，问号袋未必总有好运", target: 3400, seconds: 60, items: [
            ["diamond", 200, 320], ["diamond", 890, 440], ["diamond", 600, 600], ["large", 370, 450], ["large", 950, 660], ["large", 240, 680],
            ["mole", 540, 300], ["mole", 780, 530], ["bag", 120, 550], ["bag", 760, 740], ["rock", 430, 630], ["rock", 1000, 300],
            ["medium", 700, 390], ["bone", 330, 290], ["skull", 520, 740], ["small", 850, 280],
        ] },
    { name: "危险矿道", subtitle: "碰到 TNT 会炸掉周围矿物，清路也会损失金币", target: 5500, seconds: 60, items: [
            ["diamond", 200, 300], ["diamond", 880, 340], ["diamond", 450, 520], ["diamond", 780, 650],
            ["large", 250, 600], ["large", 590, 720], ["large", 990, 650], ["tnt", 560, 330], ["tnt", 650, 355],
            ["bag", 725, 290], ["bag", 130, 710], ["rock", 400, 370], ["rock", 930, 490], ["medium", 700, 510],
            ["bone", 130, 450], ["skull", 420, 720], ["small", 960, 240], ["mole", 320, 260],
        ] },
    { name: "追逐宝光", subtitle: "携钻鼹鼠值得等待，重金块需要留足回收时间", target: 8000, seconds: 60, items: [
            ["diamondMole", 350, 280], ["diamondMole", 850, 520], ["diamond", 200, 350], ["diamond", 750, 380], ["diamond", 500, 620],
            ["large", 300, 550], ["large", 960, 680], ["large", 650, 710], ["large", 120, 680], ["medium", 980, 280],
            ["bag", 440, 430], ["bag", 760, 730], ["tnt", 610, 350], ["tnt", 560, 430], ["rock", 160, 490], ["rock", 870, 370],
            ["mole", 420, 730], ["bone", 740, 550], ["skull", 1010, 530],
        ] },
    { name: "黄金大满贯", subtitle: "最后一关：选好路线，带着财富回家", target: 11000, seconds: 60, items: [
            ["diamond", 140, 300], ["diamond", 350, 340], ["diamond", 700, 300], ["diamond", 950, 420], ["diamond", 580, 530],
            ["diamondMole", 420, 250], ["diamondMole", 870, 590], ["large", 120, 600], ["large", 400, 700], ["large", 880, 710],
            ["medium", 760, 530], ["medium", 250, 490], ["rock", 500, 630], ["rock", 1010, 640], ["tnt", 550, 300], ["tnt", 610, 355],
            ["bag", 240, 720], ["bag", 710, 730], ["bone", 80, 430], ["skull", 1000, 260], ["mole", 560, 740],
        ] },
];
export function sweepCircle(from: Point, to: Point, center: Point, radius: number): number | null {
    const dx = to.x - from.x, dy = to.y - from.y, ox = from.x - center.x, oy = from.y - center.y;
    const c = ox * ox + oy * oy - radius * radius;
    if (c <= 0)
        return 0;
    const a = dx * dx + dy * dy;
    if (a === 0)
        return null;
    const b = 2 * (ox * dx + oy * dy), d = b * b - 4 * a * c;
    if (d < 0)
        return null;
    const t = (-b - Math.sqrt(d)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
}
export class MinerModel {
    phase: Phase = "menu";
    levelIndex = 0;
    run: RunState = { money: 0, bombs: 0, ...emptyUpgrades() };
    purchases = emptyPurchases();
    offers: Readonly<Partial<Record<ProductId, ShopOffer>>> = Object.freeze({});
    items: Item[] = [];
    remaining = 60;
    angle = -.85;
    direction = 1;
    length = WORLD.rest;
    hook: HookState = "swinging";
    carried: CatchSnapshot | null = null;
    earned = 0;
    success = false;
    events: GameEvent[] = [];
    runSeed = 0;
    private serial = 0;
    private seed: number;
    private random = seededRandom(1);
    constructor(options: {
        seed?: number;
    } = {}) {
        this.seed = (options.seed ?? (Date.now() ^ Math.floor(Math.random() * 4294967296))) >>> 0;
    }
    get level(): LevelConfig { return LEVELS[this.levelIndex]; }
    get tip(): Point { return { x: WORLD.pivot.x + Math.sin(this.angle) * this.length, y: WORLD.pivot.y + Math.cos(this.angle) * this.length }; }
    get returnSpeed(): number {
        return this.carried ? Math.min(600, 420 * (this.run.strength ? 1.5 : 1) / (1 + this.carried.weight * .75)) : 600;
    }
    start(): void {
        this.runSeed = (this.seed + this.serial++ * 2654435761) >>> 0;
        this.random = seededRandom(this.runSeed);
        this.levelIndex = 0;
        this.run = { money: 0, bombs: 0, ...emptyUpgrades() };
        this.purchases = emptyPurchases();
        this.offers = Object.freeze({});
        this.enterLevel();
    }
    menu(): void { this.start(); this.phase = "menu"; }
    enterLevel(): void {
        this.items = this.level.items.map(([kind, x, y], i) => {
            let value = GOODS[kind].value;
            if (kind === "bag")
                value = bagValue(this.random, this.run.lucky);
            if (kind === "rock" && this.run.rockBook)
                value *= 3;
            if ((kind === "diamond" || kind === "diamondMole") && this.run.diamondPolish)
                value *= 1.5;
            return { id: `${this.levelIndex}-${i}`, kind, x, y, ...GOODS[kind], value, taken: false,
                ...((kind === "mole" || kind === "diamondMole") ? { patrol: { left: x - 55, right: x + 55, speed: kind === "mole" ? 24 : 28, direction: i % 2 ? 1 : -1 } } : {}) };
        });
        this.remaining = this.level.seconds;
        this.angle = -.85;
        this.direction = 1;
        this.length = WORLD.rest;
        this.hook = "swinging";
        this.carried = null;
        this.earned = 0;
        this.success = false;
        this.events = [];
        this.phase = "playing";
    }
    launch(): boolean {
        if (this.phase !== "playing" || this.hook !== "swinging")
            return false;
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
    pause(): void { if (this.phase === "playing")
        this.phase = "paused"; }
    resume(): void { if (this.phase === "paused")
        this.phase = "playing"; }
    finish(): boolean {
        if (this.phase !== "playing")
            return false;
        this.remaining = 0;
        this.success = this.run.money >= this.level.target;
        this.run = { ...this.run, ...emptyUpgrades() };
        this.carried = null;
        this.phase = this.success && this.levelIndex === LEVELS.length - 1 ? "complete" : "result";
        this.events.push({ type: "end", success: this.success });
        return true;
    }
    openShop(): boolean {
        if (this.phase !== "result" || !this.success || this.levelIndex === LEVELS.length - 1)
            return false;
        this.purchases = emptyPurchases();
        this.offers = makeOffers(this.random);
        this.phase = "shop";
        return true;
    }
    purchaseBlock(id: ProductId): string | null {
        if (!Object.hasOwn(SHOP, id))
            return "商品不存在";
        if (this.phase !== "shop")
            return "商店尚未营业";
        if (this.purchases[id])
            return "本店已购买";
        if (!this.offers[id] || this.run.money < this.offers[id]!.price)
            return "金钱不足";
        return null;
    }
    buy(id: ProductId): boolean {
        if (this.purchaseBlock(id) !== null)
            return false;
        const spec = SHOP[id], next = { ...this.run, money: this.run.money - this.offers[id]!.price };
        if (spec.kind === "consumable")
            next.bombs += spec.quantity;
        else
            next[spec.upgrade] = true;
        this.run = next;
        this.purchases = { ...this.purchases, [id]: true };
        return true;
    }
    next(): boolean { if (this.phase !== "shop")
        return false; this.levelIndex++; this.enterLevel(); return true; }
    update(seconds: number): void {
        if (this.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0)
            return;
        let available = seconds;
        while (available > 1e-8 && this.phase === "playing") {
            const dt = Math.min(available, 1 / 120, this.remaining);
            this.remaining = Math.max(0, this.remaining - dt);
            // 截止优先：挂在钩上的物品不会由表现回调补发收益。
            if (this.remaining <= 1e-8) {
                this.finish();
                break;
            }
            this.step(dt);
            available -= dt;
        }
    }
    private step(dt: number): void {
        const origins = new Map<string, Point>();
        for (const item of this.items) {
            if (item.taken)
                continue;
            origins.set(item.id, { x: item.x, y: item.y });
            if (item.patrol) {
                const p = item.patrol;
                item.x += p.direction * p.speed * dt;
                if (item.x > p.right) {
                    item.x = 2 * p.right - item.x;
                    p.direction = -1;
                }
                if (item.x < p.left) {
                    item.x = 2 * p.left - item.x;
                    p.direction = 1;
                }
            }
        }
        if (this.hook === "swinging") {
            const limit = 1.18;
            this.angle += this.direction * .76 * dt;
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
        const from = this.tip, sin = Math.sin(this.angle), cos = Math.cos(this.angle);
        const horizontal = Math.abs(sin) < 1e-8 ? Infinity : (sin < 0 ? WORLD.pivot.x - WORLD.left : WORLD.right - WORLD.pivot.x) / Math.abs(sin);
        const maxLength = Math.min(horizontal, (WORLD.bottom - WORLD.pivot.y) / cos);
        this.length = Math.min(maxLength, this.length + 560 * dt);
        const to = this.tip;
        let first: Item | null = null, firstTime = Infinity;
        for (const item of this.items) {
            if (item.taken)
                continue;
            const old = origins.get(item.id)!;
            // 相对运动扫掠：钩爪和动物均在同一个规则步长内运动，不能只检测动物最终位置。
            const t = sweepCircle({ x: from.x - old.x, y: from.y - old.y }, { x: to.x - item.x, y: to.y - item.y }, { x: 0, y: 0 }, item.radius + 6);
            if (t !== null && (t < firstTime || (t === firstTime && item.id < (first?.id ?? "~")))) {
                first = item;
                firstTime = t;
            }
        }
        if (first) {
            this.length = Math.hypot(from.x + (to.x - from.x) * firstTime - WORLD.pivot.x, from.y + (to.y - from.y) * firstTime - WORLD.pivot.y);
            const old = origins.get(first.id)!;
            first.x = old.x + (first.x - old.x) * firstTime;
            first.y = old.y + (first.y - old.y) * firstTime;
            this.hook = "returning";
            if (first.kind === "tnt") {
                this.explode(first);
                return;
            }
            first.taken = true;
            this.carried = Object.freeze({ itemId: first.id, kind: first.kind, value: first.value, weight: first.weight,
                offset: Object.freeze({ x: first.x - this.tip.x, y: first.y - this.tip.y }) });
            this.events.push({ type: "grab", item: this.carried, ...this.tip });
        }
        else if (this.length >= maxLength)
            this.hook = "returning";
    }
    private explode(trigger: Item): void {
        const queue = [trigger], detonated = new Set<string>(), destroyed = new Set<string>(), centers: Point[] = [];
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const bomb = queue[cursor];
            if (detonated.has(bomb.id))
                continue;
            detonated.add(bomb.id);
            destroyed.add(bomb.id);
            bomb.taken = true;
            centers.push({ x: bomb.x, y: bomb.y });
            for (const item of this.items) {
                if (item.taken || Math.hypot(item.x - bomb.x, item.y - bomb.y) > TNT_RADIUS)
                    continue;
                if (item.kind === "tnt") {
                    if (!detonated.has(item.id) && !queue.some(b => b.id === item.id))
                        queue.push(item);
                }
                else {
                    item.taken = true;
                    destroyed.add(item.id);
                }
            }
        }
        this.events.push({ type: "explosion", ids: Object.freeze([...destroyed]), centers: Object.freeze(centers) });
    }
}
