async (page) => {
  const realtime = page.url().includes('record=1');
  try { await page.clock.resume(); } catch { /* 没有虚拟时钟时直接使用真实时钟。 */ }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:5173/?qa=1${realtime ? '&record=1' : ''}`);
  await page.waitForFunction(() => !!window.__goldMiner);
  const state = () => page.evaluate(() => window.__goldMiner);
  if (!realtime) { await page.clock.install(); await page.clock.runFor(100); }
  const checks = [], route = [];
  const check = (name, pass) => { checks.push({ name, pass: Boolean(pass) }); if (!pass) throw new Error(JSON.stringify({ checks, route, reason: name })); };
  await page.getByRole('button', { name: '开始寻金', exact: true }).click();
  let chosen = null, shots = 0, bombsUsed = 0, complete = false;
  const startedAt = Date.now();
  for (let iteration = 0; iteration < 1600; iteration++) {
    const s = await state();
    if (realtime && Date.now() - startedAt > 75000) break;
    if (s.phase === 'complete') { complete = true; route.push({ level: s.level + 1, money: s.money }); break; }
    if (s.phase === 'paused') { await page.getByRole('button', { name: /继续寻金/ }).click(); continue; }
    if (s.phase === 'result') {
      route.push({ level: s.level + 1, money: s.money });
      check(`第 ${s.level + 1} 关真实出钩通关`, s.money >= s.target);
      await page.getByRole('button', { name: /^去补给铺/ }).click();
      check('通过关卡进入商店', (await state()).phase === 'shop');
      const before = (await state()).money;
      await page.getByRole('button', { name: '购买 · $150', exact: true }).click();
      check('浏览器中购买实际扣款', (await state()).money === before - 150);
      check('已购买商品禁用', await page.getByRole('button', { name: '已装进行囊 ✓', exact: true }).isDisabled());
      if (s.level === 0) await page.screenshot({ path: 'output/playwright/shop.png', fullPage: true });
      await page.getByRole('button', { name: /收好行囊，继续出发/ }).click();
      check('下一关正确继承药水', (await state()).strength === true && (await state()).level === s.level + 1);
      chosen = null;
      continue;
    }
    let advance = 500;
    if (s.hook === 'swinging') {
      if (chosen === null) {
        const candidates = s.items.filter(i => !i.taken).map(item => {
          const angle = Math.atan2(item.x - 560, item.y - 148), distance = Math.hypot(item.x - 560, item.y - 148);
          const wait = s.direction > 0 ? (angle >= s.angle ? angle - s.angle : 2.36 - s.angle - angle) / .76 : (angle <= s.angle ? s.angle - angle : 2.36 + s.angle + angle) / .76;
          const speed = (s.strength ? 630 : 420) / (1 + item.weight * .75);
          return { angle, score: item.value / (wait + distance / 560 + distance / speed) };
        }).filter(c => Math.abs(c.angle) < 1.18).sort((a, b) => b.score - a.score);
        chosen = candidates[0]?.angle ?? null;
      }
      if (chosen !== null) {
        const wait = s.direction > 0 ? (chosen >= s.angle ? chosen - s.angle : 2.36 - s.angle - chosen) / .76 : (chosen <= s.angle ? s.angle - chosen : 2.36 + s.angle + chosen) / .76;
        if (Math.abs(s.angle - chosen) < .026) { await page.keyboard.press('Space'); shots++; chosen = null; advance = 150; }
        else advance = Math.max(16, Math.min(400, (wait - .012) * 1000));
      }
    } else if (s.carried === 'rock' && s.bombs > 0 && bombsUsed === 0) {
      await page.keyboard.press('ArrowUp'); bombsUsed++;
      check('浏览器中使用炸药消耗一枚', (await state()).bombs === s.bombs - 1 && (await state()).carried === null);
    }
    if (realtime) await page.waitForTimeout(Math.min(advance, 140));
    else await page.clock.runFor(advance);
  }
  if (!realtime) {
    check('三关在真实浏览器中全部完成', complete);
    check('最终通关界面可见', await page.getByRole('heading', { name: '满载星光，回家吧' }).isVisible());
    await page.screenshot({ path: 'output/playwright/complete.png', fullPage: true });
    await page.getByRole('button', { name: /^再寻一次金/ }).click();
    const reset = await state();
    check('通关后重新开始清空上一局', reset.phase === 'playing' && reset.level === 0 && reset.money === 0 && reset.bombs === 1 && !reset.strength);
    await page.keyboard.press('P');
  }
  await page.clock.resume();
  return { realtime, complete, shots, bombsUsed, route, checks, elapsedWallSeconds: (Date.now() - startedAt) / 1000 };
}
