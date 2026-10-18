import {test,expect} from './fixtures.mjs';
import {boot,state,advance,CLOCK_PAUSE} from '../../scripts/classic-automation.mjs';

test('smoke CI启动：暂停调用延迟450ms仍可加载、出钩和冻结，关卡仍为60秒',async({page})=>{
 const pauseAt=page.clock.pauseAt.bind(page.clock);
 // 故意让协议往返超过旧实现的100ms窗口，重现CI触发条件；不放宽业务断言。
 page.clock.pauseAt=async time=>{expect(time).toBe(CLOCK_PAUSE);await new Promise(resolve=>setTimeout(resolve,450));return pauseAt(time);};
 await boot(page);
 const started=await state(page);expect(started.phase).toBe('playing');expect(started.money).toBe(0);
 expect(started.remaining).toBeGreaterThan(59);expect(started.remaining).toBeLessThanOrEqual(60);
 await page.keyboard.press('Space');expect((await state(page)).hook).toBe('extending');
 await advance(page,200);await page.keyboard.press('P');const paused=await state(page);
 await advance(page,800);expect((await state(page)).remaining).toBe(paused.remaining);expect((await state(page)).rig).toEqual(paused.rig);
});
