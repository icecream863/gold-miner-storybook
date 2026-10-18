import test from "node:test";
import assert from "node:assert/strict";
import { MinerModel, LEVELS } from "../src/core/model.ts";
import { runRoute } from "./classic-route.ts";
test("六关最低入口余额，各有两条无需问号袋好运且预留两次空钩的路线", () => {
    const results = [];
    for (let level = 0; level < 6; level++) {
        const paths = [];
        for (const policy of [0, 1]) {
            const m = new MinerModel({ seed: 42 });
            m.start();
            m.levelIndex = level;
            m.run.money = level ? LEVELS[level - 1].target : 0;
            m.enterLevel();
            const route = runRoute(m, policy);
            results.push({ level: level + 1, policy, ...route });
            assert.ok(route.success, JSON.stringify(results.at(-1)));
            assert.equal(route.shots[0].id, null);
            assert.equal(route.shots[1].id, null);
            assert.ok(route.remaining > 0);
            paths.push(route.shots.map(s => s.id));
        }
        assert.notDeepEqual(paths[0], paths[1], `第${level + 1}关路线应不同`);
    }
    console.log("CLASSIC_MINIMUM_ROUTES", JSON.stringify(results));
});
test("不同种子下正常六关流程、五次购物、最终胜利及重开", () => {
    for (const seed of [1, 42, 2026])
        for (const strategy of ["none", "strength", "diamondPolish"] as const) {
            const m = new MinerModel({ seed });
            m.start();
            const rounds = [];
            for (let level = 0; level < 6; level++) {
                const route = runRoute(m, 0);
                rounds.push({ level: level + 1, money: route.money, remaining: route.remaining });
                assert.ok(route.success, JSON.stringify({ seed, strategy, rounds, route }));
                m.finish();
                if (level < 5) {
                    assert.ok(m.openShop());
                    if (strategy !== "none" && m.run.money >= m.offers[strategy]!.price)
                        assert.ok(m.buy(strategy));
                    assert.ok(m.next());
                }
            }
            assert.equal(m.phase, "complete");
            console.log("CLASSIC_SIX_ROUNDS", JSON.stringify({ seed, strategy, rounds }));
            m.start();
            assert.equal(m.levelIndex, 0);
            assert.equal(m.run.money, 0);
        }
});
test("乱买消耗钱包且可能失败，不会回退已过关或降低下一关目标", () => {
    const m = new MinerModel({ seed: 42 });
    m.start();
    m.run.money = 650;
    m.finish();
    assert.ok(m.openShop());
    const before = m.run.money;
    m.buy("bomb");
    m.buy("strength");
    m.buy("lucky");
    assert.ok(m.run.money < before);
    m.next();
    assert.equal(m.level.target, 1800);
    m.finish();
    assert.equal(m.success, false);
    assert.equal(m.phase, "result");
});
