import test from "node:test";
import assert from "node:assert/strict";
import { MinerModel, WORLD, GOODS, LEVELS, sweepCircle, TNT_RADIUS } from "../src/core/model.ts";
import type { Item, ItemKind } from "../src/core/model.ts";
import { ActiveClock } from "../src/core/clock.ts";
import { SHOP, PRODUCT_IDS, BAG_VALUES, BAG_WEIGHTS, bagValue, seededRandom, emptyUpgrades } from "../src/core/shop.ts";
const make = (id: string, x: number, y: number, kind: ItemKind = "small"): Item => ({ id, x, y, kind, ...GOODS[kind], taken: false });
const game = () => { const m = new MinerModel({ seed: 42 }); m.start(); return m; };
function caught(kind: ItemKind = "small") { const m = game(); m.items = [make("a", 550, 300, kind)]; m.angle = 0; m.launch(); m.update(.5); assert.ok(m.carried); return m; }
function shop() { const m = game(); m.run.money = 2000; m.finish(); assert.ok(m.openShop()); return m; }
test("活动时钟保留长帧，排除暂停与倒退", () => { const c = new ActiveClock(); c.sample(0, false); assert.equal(c.sample(1200, true), 1.2); assert.equal(c.sample(9000, false), 0); assert.equal(c.sample(8000, true), 0); assert.equal(c.sample(9016, true), .016); });
test("扫掠处理穿越、切线、零位移与初始重叠", () => { assert.equal(sweepCircle({ x: -10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, 2), .4); assert.equal(sweepCircle({ x: -2, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 0 }, 1), .5); assert.equal(sweepCircle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 1), 0); assert.equal(sweepCircle({ x: 2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0 }, 1), null); });
test("三态输入、初始零炸药、普通抓取只抓一个，接触偏移连续", () => {
    const m = game();
    assert.equal(m.run.bombs, 0);
    m.items = [make("far", 550, 450), make("near", 550, 300)];
    m.angle = 0;
    assert.ok(m.launch());
    assert.equal(m.launch(), false);
    while (!m.carried)
        m.update(1 / 120);
    assert.equal(m.carried?.itemId, "near");
    assert.equal(m.items.filter(i => i.taken).length, 1);
    assert.ok(Math.abs(m.tip.y + m.carried!.offset.y - 300) < 1e-8);
    assert.equal(m.run.money, 0);
    m.update(5);
    assert.equal(m.run.money, 100);
    assert.equal(m.earned, 100);
    assert.equal(m.carried, null);
    m.update(5);
    assert.equal(m.run.money, 100);
});
test("碰撞顺序不依赖数组，回收中不捕获第二件", () => { const m = game(); m.items = [make("far", 550, 400), make("near", 550, 270)]; m.angle = 0; m.launch(); m.update(3); assert.equal(m.items[0].taken, false); assert.equal(m.run.money, 100); });
test("重量和力量只影响载物回收，接触快照不受物品后续改动影响", () => {
    const m = caught("large"), base = m.returnSpeed;
    m.run.strength = true;
    assert.ok(Math.abs(m.returnSpeed - base * 1.5) < 1e-8);
    const snapshot = m.carried!;
    m.items[0].value = 999;
    m.items[0].weight = 999;
    assert.equal(m.carried, snapshot);
    assert.equal(m.carried.value, 500);
    m.update(10);
    assert.equal(m.run.money, 500);
    assert.equal(m.returnSpeed, 600);
    assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.isFrozen(snapshot.offset));
});
test("暂停冻结位置、动物、计时与货物；超时不补发，重复结束不领奖", () => {
    const m = caught();
    m.items.push({ ...make("moving", 800, 400, "mole"), patrol: { left: 750, right: 850, speed: 24, direction: 1 } });
    m.pause();
    const before = JSON.stringify(m);
    m.update(10);
    assert.equal(JSON.stringify(m), before);
    assert.equal(m.useBomb(), false);
    assert.equal(m.launch(), false);
    m.resume();
    m.remaining = .001;
    m.update(1);
    assert.equal(m.run.money, 0);
    assert.equal(m.carried, null);
    assert.equal(m.finish(), false);
});
test("截止前到达入账，恰逢截止优先结束", () => { for (const [remaining, expected] of [[.02, 100], [.001, 0]]) {
    const m = caught();
    m.length = WORLD.rest + .1;
    m.remaining = remaining;
    m.update(.03);
    assert.equal(m.run.money, expected);
} });
test("累计金额单目标允许零采集过关，手动不足即失败，失败只能整局重开", () => {
    const m = game();
    m.run.money = 650;
    assert.ok(m.finish());
    assert.ok(m.success);
    assert.equal(m.earned, 0);
    assert.ok(m.openShop());
    m.buy("strength");
    m.next();
    m.finish();
    assert.equal(m.success, false);
    m.start();
    assert.equal(m.levelIndex, 0);
    assert.equal(m.run.money, 0);
    assert.equal(m.run.bombs, 0);
    assert.deepEqual(m.run, { money: 0, bombs: 0, ...emptyUpgrades() });
});
test("炸药仅载物时消耗，销毁不入账，不能重复炸", () => { const m = caught(); m.run.bombs = 1; assert.ok(m.useBomb()); assert.equal(m.run.bombs, 0); assert.equal(m.useBomb(), false); assert.equal(m.returnSpeed, 600); m.update(2); assert.equal(m.run.money, 0); });
test("移动动物按规则步长反射，抓住后停止移动", () => {
    const m = game();
    m.items = [{ ...make("moving", 560, 300, "diamondMole"), patrol: { left: 500, right: 600, speed: 100, direction: -1 } }];
    m.angle = 0;
    m.launch();
    m.update(.35);
    assert.equal(m.carried?.kind, "diamondMole");
    const x = m.items[0].x;
    m.update(.1);
    assert.equal(m.items[0].x, x);
    m.update(5);
    assert.equal(m.run.money, 650);
});
test("相对运动扫掠捕捉单步穿过钩尖的高速动物", () => {
    const m = game();
    m.angle = 0;
    m.length = 150;
    m.hook = "extending";
    m.items = [{ ...make("fast", 500, 282, "mole"), patrol: { left: 400, right: 700, speed: 12000, direction: 1 } }];
    m.update(1 / 120);
    assert.equal(m.carried?.itemId, "fast");
});
test("TNT 按中心半径连爆且去重，金币和袋子销毁不入账，圈外物品保留", () => {
    const m = game();
    m.items = [make("a", 550, 300, "tnt"), make("b", 640, 300, "tnt"), make("c", 730, 300, "tnt"), make("gold", 640, 380, "large"), make("bag", 730, 410, "bag"), make("safe", 900, 500, "diamond")];
    m.angle = 0;
    m.launch();
    m.update(1);
    const event = m.events.find(e => e.type === "explosion");
    assert.ok(event && event.type === "explosion");
    assert.equal(event.centers.length, 3);
    assert.equal(new Set(event.ids).size, event.ids.length);
    assert.equal(event.ids.length, 5);
    assert.equal(m.items.at(-1)!.taken, false);
    assert.equal(m.carried, null);
    assert.equal(m.run.money, 0);
    assert.equal(m.run.bombs, 0);
    assert.equal(TNT_RADIUS, 110);
    m.update(10);
    assert.equal(m.events.filter(e => e.type === "explosion").length, 1);
});
test("30/60/144Hz 与一次长帧，移动位置和实际抓取结算一致", () => {
    const results = [30, 60, 144, 1].map(fps => { const m = game(); m.items = [make("gold", 550, 400, "medium"), { ...make("moving", 800, 500, "mole"), patrol: { left: 740, right: 860, speed: 24, direction: 1 } }]; m.angle = 0; m.launch(); for (let i = 0; i < fps * 5; i++)
        m.update(1 / fps); return { money: m.run.money, x: m.items[1].x, remaining: m.remaining }; });
    for (const r of results) {
        assert.equal(r.money, 250);
        assert.ok(Math.abs(r.x - results[0].x) < 1e-6);
        assert.ok(Math.abs(r.remaining - 55) < 1e-6);
    }
});
test("无效时间不会污染状态，回首页与重开清理旧事件和货物", () => { const m = caught(); for (const dt of [NaN, Infinity, -1, 0]) {
    const old = JSON.stringify(m);
    m.update(dt);
    assert.equal(JSON.stringify(m), old);
} m.menu(); assert.equal(m.phase, "menu"); assert.equal(m.carried, null); assert.deepEqual(m.events, []); assert.equal(m.launch(), false); });
test("袋子五档权重边界与幸运分布正确，随机内容不逐帧重抽", () => {
    assert.deepEqual(BAG_VALUES, [50, 100, 250, 500, 800]);
    assert.equal(BAG_WEIGHTS.normal.reduce((a, b) => a + b, 0), 100);
    for (const lucky of [false, true]) {
        const counts = new Map<number, number>();
        for (let i = 0; i < 100; i++) {
            const value = bagValue(() => (i + .5) / 100, lucky);
            counts.set(value, (counts.get(value) || 0) + 1);
        }
        assert.deepEqual([...counts.values()], BAG_WEIGHTS[lucky ? "lucky" : "normal"]);
    }
    const a = game(), b = game();
    assert.deepEqual(a.items, b.items);
    const bags = a.items.filter(i => i.kind === "bag").map(i => i.value);
    a.update(20);
    assert.deepEqual(a.items.filter(i => i.kind === "bag").map(i => i.value), bags);
    const r = seededRandom(42), s = seededRandom(42);
    for (let i = 0; i < 100; i++)
        assert.equal(r(), s());
});
for (const id of PRODUCT_IDS)
    test(`${SHOP[id].name}：报价冻结、余额不足、刚好足够、重复扣费拦截`, () => {
        const m = shop(), offer = m.offers[id]!;
        assert.ok(offer.price >= SHOP[id].minPrice && offer.price <= SHOP[id].maxPrice);
        const quotes = JSON.stringify(m.offers);
        assert.equal(m.openShop(), false);
        assert.equal(JSON.stringify(m.offers), quotes);
        m.run.money = offer.price - 1;
        const before = JSON.stringify(m.run);
        assert.equal(m.buy(id), false);
        assert.equal(JSON.stringify(m.run), before);
        m.run.money = offer.price;
        assert.ok(m.buy(id));
        assert.equal(m.run.money, 0);
        assert.equal(m.buy(id), false);
        assert.ok(m.purchases[id]);
    });
test("未知商品和原型名不能扣款，非商店不能买", () => { const m = shop(); const old = JSON.stringify(m.run); for (const id of ["toString", "__proto__", "hourglass", "amplifier"]) {
    assert.equal(m.buy(id as any), false);
} assert.equal(JSON.stringify(m.run), old); m.next(); assert.equal(m.buy("bomb"), false); });
test("强化真实应用、关末清理，炸药跨关保留且每店重新限购", () => {
    const m = shop();
    m.run.money = 5000;
    for (const id of PRODUCT_IDS)
        assert.ok(m.buy(id));
    const money = m.run.money;
    assert.ok(m.next());
    assert.equal(m.remaining, 60);
    assert.equal(m.run.bombs, 1);
    assert.ok(m.run.strength && m.run.rockBook && m.run.lucky && m.run.diamondPolish);
    assert.ok(m.items.filter(i => i.kind === "rock").every(i => i.value === 45));
    assert.ok(m.items.filter(i => i.kind === "diamond").every(i => i.value === 975));
    assert.ok(m.items.filter(i => i.kind === "bone").every(i => i.value === 10));
    assert.equal(m.run.money, money);
    m.run.money = 6000;
    m.finish();
    assert.deepEqual({ ...m.run, money: 0, bombs: 0 }, { money: 0, bombs: 0, ...emptyUpgrades() });
    assert.ok(m.openShop());
    assert.ok(PRODUCT_IDS.every(id => !m.purchases[id]));
    assert.equal(m.run.bombs, 1);
    m.next();
    assert.ok(m.items.filter(i => i.kind === "diamond").every(i => i.value === 650));
});
test("抛光和收藏书在普通回收时真实入账，炸毁仍无收入", () => {
    for (const [kind, flag, value] of [["rock", "rockBook", 45], ["diamond", "diamondPolish", 975], ["diamondMole", "diamondPolish", 975]] as const) {
        const m = shop();
        m.run.money = 5000;
        m.buy(flag);
        m.next();
        const item = m.items.find(i => i.kind === kind) ?? { ...make("extra", 550, 320, kind), value };
        m.items = [{ ...item, x: 550, y: 320, patrol: undefined }];
        m.angle = 0;
        const before = m.run.money;
        m.launch();
        m.update(15);
        assert.equal(m.run.money - before, value);
    }
});
test("第六关最终结算没有无效商店，重开清空全部六关状态", () => { const m = game(); m.levelIndex = 5; m.enterLevel(); m.run.money = 11000; m.run.bombs = 3; m.run.lucky = true; assert.ok(m.finish()); assert.equal(m.phase, "complete"); assert.equal(m.openShop(), false); assert.equal(m.next(), false); m.start(); assert.equal(m.levelIndex, 0); assert.equal(m.run.money, 0); assert.equal(m.run.bombs, 0); assert.equal(m.phase, "playing"); assert.equal(Object.keys(m.offers).length, 0); });
test("六关 60 秒与目标递增，初始碰撞体不重叠、静态及巡逻边界在场内", () => {
    assert.deepEqual(LEVELS.map(l => l.target), [650, 1800, 3400, 5500, 8000, 11000]);
    const m = game();
    for (let l = 0; l < 6; l++) {
        m.levelIndex = l;
        m.enterLevel();
        assert.equal(m.remaining, 60);
        assert.ok(m.items.length <= 24);
        for (const a of m.items) {
            assert.ok(a.x - a.radius > WORLD.left && a.x + a.radius < WORLD.right);
            assert.ok(a.y - a.radius > 180 && a.y + a.radius < WORLD.bottom);
            if (a.patrol)
                assert.ok(a.patrol.left - a.radius > WORLD.left && a.patrol.right + a.radius < WORLD.right);
            for (const b of m.items)
                if (a.id < b.id)
                    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius, `${l + 1}: ${a.id}/${b.id}`);
        }
        if (l > 0)
            for (const kind of ["bag", "rock", "diamond"])
                assert.ok(m.items.some(i => i.kind === kind));
    }
});
