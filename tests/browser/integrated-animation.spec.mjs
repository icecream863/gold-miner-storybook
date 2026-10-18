import {test,expect} from './fixtures.mjs';
import {boot,state,advance,fireAt,returned} from '../../scripts/classic-automation.mjs';

for(const reduced of [false,true])test(`原六关接入已确认动画：${reduced?'减少动态':'普通动态'}仍有可见出钩动作与连续回收`,async({page})=>{
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  await boot(page);
  let s=await state(page);
  expect(s.minerRenderer).toBe('approved-vector');
  expect(s.level).toBe(0);expect(s.target).toBe(650);expect(s.bombs).toBe(0);
  expect(s.rig.hand).toEqual(s.rig.knob);
  const box=await page.locator('canvas').boundingBox();
  const clip={x:box.x+514/1100*box.width,y:box.y+1/800*box.height,
    width:173/1100*box.width,height:150/800*box.height};
  const idle=await page.screenshot({clip});
  await page.keyboard.press('Space');
  // 有效输入当场进入发射状态，动画不增加等待。
  expect((await state(page)).hook).toBe('extending');
  await advance(page,80);s=await state(page);
  expect(s.minerAnimation.action).toBe('release');
  expect(s.minerAnimation.angle).toBeGreaterThan(-.75);
  const dropping=await page.screenshot({clip});
  expect(dropping.equals(idle),'真正渲染的矿工区域必须变化，不能只有快照帧号变化').toBe(false);
  await advance(page,100);s=await state(page);
  expect(s.minerAnimation.angle).toBeCloseTo(.75,5);
  await page.keyboard.press('P');const paused=await state(page);
  await advance(page,750);expect((await state(page)).rig).toEqual(paused.rig);
  expect((await state(page)).remaining).toBe(paused.remaining);
  await page.getByRole('button',{name:'继续挖矿 →',exact:true}).click();await returned(page);
  // 再用真实输入抓一件重物，回收的转柄、计费仍由原模型驱动。
  const target=(await state(page)).items.find(i=>i.kind==='large'&&!i.taken);
  const hit=await fireAt(page,target.id);expect(hit.carried?.itemId).toBe(target.id);
  const money=hit.money,angle=hit.rig.angle;
  await advance(page,200);s=await state(page);
  expect(s.rig.action).toBe('heavy');expect(s.rig.angle).not.toBe(angle);
  expect(s.rig.gripError).toBeLessThan(2);expect(s.money).toBe(money);
  await page.screenshot({path:`output/playwright/integrated-heavy-${reduced?'reduced':'normal'}.png`});
  await returned(page);expect((await state(page)).money).toBe(money+hit.carried.value);
});
