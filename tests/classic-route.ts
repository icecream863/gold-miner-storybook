import { MinerModel, WORLD, sweepCircle } from "../src/core/model.ts";
import type { Item } from "../src/core/model.ts";
export function aimWait(m: MinerModel, angle: number): number {
    return m.direction > 0 ? (angle >= m.angle ? angle - m.angle : 2.36 - m.angle - angle) / .76 : (angle <= m.angle ? m.angle - angle : 2.36 + m.angle + angle) / .76;
}
export function rayEnd(angle: number) {
    const s = Math.sin(angle), c = Math.cos(angle);
    const length = Math.min(Math.abs(s) < 1e-8 ? Infinity : (s < 0 ? WORLD.pivot.x - WORLD.left : WORLD.right - WORLD.pivot.x) / Math.abs(s), (WORLD.bottom - WORLD.pivot.y) / c);
    return { x: WORLD.pivot.x + s * length, y: WORLD.pivot.y + c * length, length };
}
export function firstAt(m: MinerModel, angle: number): Item | undefined {
    const from = { x: WORLD.pivot.x + Math.sin(angle) * WORLD.rest, y: WORLD.pivot.y + Math.cos(angle) * WORLD.rest }, to = rayEnd(angle);
    return m.items.filter(i => !i.taken).map(i => ({ item: i, t: sweepCircle(from, to, i, i.radius + 6) })).filter(a => a.t !== null).sort((a, b) => a.t! - b.t!)[0]?.item;
}
export function choose(m: MinerModel, policy = 0) {
    return m.items.filter(i => !i.taken && i.kind !== "bag" && i.kind !== "tnt" && i.value >= 100 && !i.patrol).map(i => {
        const angle = Math.max(-1.175, Math.min(1.175, Math.atan2(i.x - WORLD.pivot.x, i.y - WORLD.pivot.y)));
        const distance = Math.max(0, Math.hypot(i.x - WORLD.pivot.x, i.y - WORLD.pivot.y) - i.radius - 6 - WORLD.rest);
        const speed = Math.min(600, 420 * (m.run.strength ? 1.5 : 1) / (1 + i.weight * .75));
        const time = aimWait(m, angle) + distance / 560 + distance / speed + .2;
        return { item: i, angle, score: i.value / time * (policy === 0 ? 1 : i.x < 300 ? 3 : i.x < 550 ? 1.5 : .5) };
    }).filter(c => firstAt(m, c.angle)?.id === c.item.id).sort((a, b) => b.score - a.score)[0];
}
export function fire(m: MinerModel, angle: number) {
    let guard = 0;
    while (m.phase === "playing" && m.hook === "swinging" && Math.abs(m.angle - angle) > .006 && guard++ < 1000)
        m.update(Math.max(1 / 240, Math.min(1 / 60, aimWait(m, angle))));
    if (m.phase !== "playing")
        return null;
    const before = m.earned;
    m.launch();
    let id: string | null = null;
    while (m.phase === "playing" && m.hook !== "swinging" && guard++ < 15000) {
        m.update(1 / 120);
        if (m.carried)
            id = m.carried.itemId;
    }
    return { id, value: m.earned - before };
}
export function runRoute(m: MinerModel, policy = 0, misses = 2) {
    const shots: {
        id: string | null;
        value: number;
    }[] = [];
    for (let n = 0; n < misses; n++) {
        const empty = Array.from({ length: 121 }, (_, i) => -1.175 + i * 2.35 / 120).filter(a => {
            const from = { x: WORLD.pivot.x + Math.sin(a) * WORLD.rest, y: WORLD.pivot.y + Math.cos(a) * WORLD.rest };
            return m.items.filter(i => !i.taken).every(i => sweepCircle(from, rayEnd(a), i, i.radius + 6 + (i.patrol ? 55 : 0)) === null);
        }).sort((a, b) => aimWait(m, a) - aimWait(m, b))[0];
        if (empty === undefined)
            throw new Error("地图没有空钩路线");
        const shot = fire(m, empty);
        if (shot)
            shots.push(shot);
    }
    for (let n = 0; n < 600 && m.phase === "playing" && m.run.money < m.level.target; n++) {
        if (policy === 1) {
            // 第二条策略先等移动动物让出左侧高价值通道，而非照抄第一条路线的抓取顺序。
            for (let wait = 0; wait < 12; wait++) {
                const left = m.items.find(i => !i.taken && i.value >= 500 && !i.patrol && i.x < 300);
                if (!left)
                    break;
                const a = Math.max(-1.175, Math.min(1.175, Math.atan2(left.x - WORLD.pivot.x, left.y - WORLD.pivot.y)));
                if (!firstAt(m, a)?.patrol)
                    break;
                m.update(.25);
            }
        }
        const target = choose(m, policy);
        if (!target) {
            m.update(.25);
            continue;
        }
        const shot = fire(m, target.angle);
        if (shot)
            shots.push(shot);
    }
    return { success: m.run.money >= m.level.target, money: m.run.money, earned: m.earned, remaining: m.remaining, shots };
}
