import test from "node:test";
import assert from "node:assert/strict";
import {
  MinerModel,
  LEVELS,
  WORLD,
  sweepCircle,
  GOODS,
} from "../src/core/model.ts";
import type { Item } from "../src/core/model.ts";

function tick(model: MinerModel, seconds: number): void {
  model.update(seconds);
}
function makeItem(
  id: string,
  x: number,
  y: number,
  kind: Item["kind"] = "small",
): Item {
  return { id, x, y, kind, ...GOODS[kind], taken: false };
}
function fireStraight(model: MinerModel, item: Item): void {
  model.angle = 0;
  model.items = [item];
  assert.equal(model.launch(), true);
}

test("连续发射只接受一次；菜单和暂停不接受玩法输入", () => {
  const m = new MinerModel();
  assert.equal(m.launch(), false);
  m.start();
  assert.equal(m.launch(), true);
  assert.equal(m.launch(), false);
  m.pause();
  assert.equal(m.launch(), false);
  assert.equal(m.useBomb(), false);
});

test("扫掠能抓住两端都在圆外的高速穿越，并处理切线、零位移与初始重叠", () => {
  assert.ok(
    Math.abs(
      sweepCircle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 2)! - 0.48,
    ) < 1e-9,
  );
  assert.equal(
    sweepCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 1 }, 1),
    0.5,
  );
  assert.equal(
    sweepCircle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, 1),
    null,
  );
  assert.equal(
    sweepCircle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 1),
    0,
  );
  assert.equal(
    sweepCircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 2 }, 1),
    null,
  );
});

test("最近碰撞不依赖物品数组顺序，也不会抓到绳索两旁的物品", () => {
  const m = new MinerModel();
  m.start();
  m.angle = 0;
  m.items = [
    makeItem("far", 560, 350),
    makeItem("near", 560, 270),
    makeItem("aside", 700, 220),
  ];
  m.launch();
  tick(m, 0.2);
  assert.equal(m.carried?.id, "near");
  assert.equal(m.run.money, 0);
});

test("只有回到绞盘才入账，继续更新不会重复计分", () => {
  const m = new MinerModel();
  m.start();
  fireStraight(m, makeItem("gold", 560, 270));
  tick(m, 0.22);
  assert.equal(m.carried?.id, "gold");
  assert.equal(m.run.money, 0);
  tick(m, 1);
  assert.equal(m.run.money, 100);
  assert.equal(m.earned, 100);
  tick(m, 2);
  assert.equal(m.run.money, 100);
  assert.equal(m.events.filter((e) => e.type === "bank").length, 1);
});

test("空钩碰到边界后回收，不会越界或卡住", () => {
  const m = new MinerModel();
  m.start();
  m.items = [];
  m.angle = -1.18;
  m.launch();
  tick(m, 2);
  assert.equal(m.hook, "swinging");
  assert.equal(m.length, WORLD.rest);
  assert.equal(m.run.money, 0);
});

test("重量决定回收速度；力量只提升载物回收，空钩速度不变", () => {
  const m = new MinerModel();
  m.start();
  const empty = m.returnSpeed;
  m.carried = makeItem("heavy", 500, 500, "large");
  const heavy = m.returnSpeed;
  m.carried = makeItem("light", 500, 500, "diamond");
  assert.ok(m.returnSpeed > heavy);
  m.carried = makeItem("heavy", 500, 500, "large");
  m.run.strength = true;
  assert.ok(Math.abs(m.returnSpeed / heavy - 1.5) < 1e-9);
  m.carried = null;
  assert.equal(m.returnSpeed, empty);
});

test("炸药只在载物时消耗；销毁物品且不计钱；无法重复炸同一物品", () => {
  const m = new MinerModel();
  m.start();
  assert.equal(m.useBomb(), false);
  assert.equal(m.run.bombs, 1);
  fireStraight(m, makeItem("rock", 560, 270, "rock"));
  tick(m, 0.2);
  assert.equal(m.useBomb(), true);
  assert.equal(m.run.bombs, 0);
  assert.equal(m.carried, null);
  assert.equal(m.useBomb(), false);
  tick(m, 1);
  assert.equal(m.run.money, 0);
  assert.equal(m.items[0].taken, true);
  assert.equal(m.hook, "swinging");
});

test("暂停同时冻结金钱、位置与时间；恢复后接着运动", () => {
  const m = new MinerModel();
  m.start();
  m.launch();
  tick(m, 0.1);
  m.pause();
  const before = JSON.stringify({
    t: m.remaining,
    l: m.length,
    a: m.angle,
    money: m.run.money,
  });
  tick(m, 120);
  assert.equal(
    JSON.stringify({
      t: m.remaining,
      l: m.length,
      a: m.angle,
      money: m.run.money,
    }),
    before,
  );
  m.resume();
  tick(m, 0.1);
  assert.ok(m.remaining < 59.9);
  assert.ok(m.length > WORLD.rest);
});

test("到期只结算一次，挂在绳上的矿物不补发金钱", () => {
  const m = new MinerModel();
  m.start();
  fireStraight(m, makeItem("large", 560, 270, "large"));
  tick(m, 0.2);
  m.remaining = 0.01;
  tick(m, 1);
  assert.equal(m.phase, "result");
  assert.equal(m.run.money, 0);
  assert.equal(m.carried, null);
  tick(m, 100);
  assert.equal(m.events.filter((e) => e.type === "end").length, 1);
});

test("只有达到门槛才能进入商店，余额不足不会扣款", () => {
  const m = new MinerModel();
  m.start();
  m.finish();
  assert.equal(m.openShop(), false);
  m.start();
  m.run.money = 650;
  m.finish();
  assert.equal(m.openShop(), true);
  m.run.money = 99;
  assert.equal(m.buy("bomb"), false);
  assert.equal(m.buy("strength"), false);
  assert.equal(m.run.money, 99);
});

test("购买每件限一次、跨关扣款；力量药水到下个商店失效", () => {
  const m = new MinerModel();
  m.start();
  m.run.money = 900;
  m.finish();
  m.openShop();
  assert.equal(m.buy("strength"), true);
  assert.equal(m.buy("strength"), false);
  assert.equal(m.buy("bomb"), true);
  assert.equal(m.run.money, 650);
  assert.equal(m.run.bombs, 2);
  m.next();
  assert.equal(m.levelIndex, 1);
  assert.equal(m.run.strength, true);
  m.run.money = 3300;
  m.finish();
  m.openShop();
  assert.equal(m.run.strength, false);
  assert.equal(m.purchases.strength, false);
});

test("失败重试恢复本关入口快照，包括花过的道具和力量", () => {
  const m = new MinerModel();
  m.start();
  m.run.money = 900;
  m.finish();
  m.openShop();
  m.buy("strength");
  m.buy("bomb");
  m.next();
  const entry = { ...m.run };
  m.run.money += 100;
  m.run.bombs = 0;
  m.items[0].taken = true;
  m.finish();
  assert.equal(m.retry(), true);
  assert.deepEqual(m.run, entry);
  assert.equal(m.remaining, 60);
  assert.ok(m.items.every((i) => !i.taken));
});

test("30/60/144Hz 下摆动与倒计时一致，无效时间输入不污染状态", () => {
  const results = [30, 60, 144].map((fps) => {
    const m = new MinerModel();
    m.start();
    for (let i = 0; i < fps * 8; i++) m.update(1 / fps);
    return m;
  });
  for (const m of results) {
    assert.ok(Math.abs(m.remaining - 52) < 1e-6);
    assert.ok(Math.abs(m.angle - results[0].angle) < 1e-6);
  }
  const m = results[0];
  const remaining = m.remaining;
  m.update(NaN);
  m.update(Infinity);
  m.update(-1);
  assert.equal(m.remaining, remaining);
});

test("重新开始整局清空升级、购买和上局金钱", () => {
  const m = new MinerModel();
  m.start();
  m.levelIndex = 2;
  m.run = { money: 3500, bombs: 7, strength: true };
  m.menu();
  m.start();
  assert.equal(m.levelIndex, 0);
  assert.deepEqual(m.run, { money: 0, bombs: 1, strength: false });
  assert.equal(m.items.length, LEVELS[0].items.length);
});

// 用实际运动、瞄准等待与抓取规则验证每关能过关；没有直接发钱或跳过回收。
for (const buyStrength of [true, false])
  test(`固定三关真实路线可通关（${buyStrength ? "购买药水" : "不购买任何商品"}）`, () => {
    const m = new MinerModel();
    m.start();
    const route: { level: number; money: number }[] = [];
    let chosen: number | null = null;
    const limit = 1.18,
      rate = 0.76,
      dt = 1 / 120;
    for (let i = 0; i < 60 * 120 * 3 + 100; i++) {
      if (m.phase === "complete") break;
      if (m.phase === "result") {
        route.push({ level: m.levelIndex + 1, money: m.run.money });
        assert.equal(m.success, true, JSON.stringify(route));
        m.openShop();
        if (buyStrength) m.buy("strength");
        m.next();
        chosen = null;
      }
      if (m.hook === "swinging") {
        if (chosen === null) {
          const candidates = m.items
            .filter((i) => !i.taken)
            .map((item) => {
              const angle = Math.atan2(item.x - 560, item.y - 148);
              const distance = Math.hypot(item.x - 560, item.y - 148);
              const wait =
                m.direction > 0
                  ? (angle >= m.angle
                      ? angle - m.angle
                      : 2 * limit - m.angle - angle) / rate
                  : (angle <= m.angle
                      ? m.angle - angle
                      : 2 * limit + m.angle + angle) / rate;
              const time =
                wait +
                distance / 560 +
                distance /
                  ((m.run.strength ? 630 : 420) / (1 + item.weight * 0.75));
              return { angle, score: item.value / time };
            })
            .filter((i) => Math.abs(i.angle) < limit)
            .sort((a, b) => b.score - a.score);
          chosen = candidates[0]?.angle ?? null;
        }
        if (chosen !== null && Math.abs(m.angle - chosen) <= rate * dt * 1.1) {
          m.launch();
          chosen = null;
        }
      }
      m.update(dt);
    }
    route.push({ level: m.levelIndex + 1, money: m.run.money });
    assert.equal(m.phase, "complete", JSON.stringify(route));
    assert.ok(m.run.money >= 4800);
    console.log("PLAYABLE_ROUTE", JSON.stringify(route));
  });
