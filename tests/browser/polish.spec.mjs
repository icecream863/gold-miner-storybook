import {test,expect} from './fixtures.mjs';
import {boot,state,advance,earn} from '../../scripts/classic-automation.mjs';
// 图形与音频完整流程在普通开发机上需要更长执行预算，断言不放宽。
test.setTimeout(360000);

async function nativeBoot(page){await page.goto('/?qa=1');await page.getByRole('button',{name:'开始挖矿 →',exact:true}).click();await page.waitForFunction(()=>window.__goldMiner?.audio.music.state==='playing');}

test('音乐实际加载、暂停续播、独立音量偏好、设置不消耗时间',async({page})=>{
 await nativeBoot(page);await page.waitForTimeout(450);let s=await state(page);expect(s.audio.music.sources).toBe(1);expect(s.audio.settings).toEqual({musicEnabled:true,effectsEnabled:true,musicVolume:.2,effectsVolume:.7});
 await page.getByRole('button',{name:'声音设置',exact:true}).click();s=await state(page);expect(s.phase).toBe('paused');expect(s.audio.music.sources).toBe(0);const offset=s.audio.music.offset;
 await page.waitForTimeout(400);expect((await state(page)).remaining).toBe(s.remaining);expect((await state(page)).audio.music.offset).toBe(offset);
 await page.getByRole('slider',{name:'音乐音量',exact:true}).press('Home');await page.getByRole('slider',{name:'音乐音量',exact:true}).press('ArrowRight');
 await page.getByRole('checkbox',{name:'游戏音效',exact:true}).uncheck();expect((await state(page)).audio.settings.effectsEnabled).toBe(false);
 await page.screenshot({path:'output/playwright/polish-settings.png'});
 await page.getByRole('button',{name:'返回暂停界面',exact:true}).click();await page.getByRole('button',{name:'继续挖矿 →',exact:true}).click();await page.waitForTimeout(100);s=await state(page);expect(s.audio.music.sources).toBe(1);expect(s.audio.music.offset).toBeGreaterThanOrEqual(offset);expect(s.audio.settings.musicVolume).toBe(.01);
 await page.keyboard.press('Space');await page.waitForTimeout(30);expect((await state(page)).hook).not.toBe('swinging');expect((await state(page)).audio.voices).toBe(0);
 await page.reload();await page.waitForFunction(()=>!!window.__goldMiner);s=await state(page);expect(s.audio.settings.musicVolume).toBe(.01);expect(s.audio.settings.effectsEnabled).toBe(false);expect(s.audio.music.sources).toBe(0);
});

test('音乐慢加载不阻塞发射，暂停后加载完成不偷播，恢复不重复循环',async({page})=>{
 let release;const gate=new Promise(r=>release=r);await page.route('**/assets/audio/western.ogg',async route=>{await gate;await route.continue();});
 await page.goto('/?qa=1');await page.getByRole('button',{name:'开始挖矿 →',exact:true}).click();await page.keyboard.press('Space');await page.waitForTimeout(50);expect((await state(page)).hook).not.toBe('swinging');
 await page.keyboard.press('P');release();await page.waitForFunction(()=>window.__goldMiner.audio.music.duration>0);expect((await state(page)).audio.music.sources).toBe(0);
 await page.getByRole('button',{name:'继续挖矿 →',exact:true}).click();for(let n=0;n<4;n++){await page.keyboard.press('P');await page.getByRole('button',{name:'继续挖矿 →',exact:true}).click();}expect((await state(page)).audio.music.sources).toBe(1);
});

test('OGG解码失败自动使用MP3，音乐失败可重试且不影响玩法',async({page})=>{
 await page.route('**/assets/audio/western.*',route=>route.fulfill({status:200,contentType:'audio/ogg',body:'invalid-audio-for-test'}));
 await page.goto('/?qa=1');await page.getByRole('button',{name:'开始挖矿 →',exact:true}).click();await page.waitForFunction(()=>window.__goldMiner.audio.music.error);await page.keyboard.press('Space');expect((await state(page)).hook).not.toBe('swinging');
 await page.getByRole('button',{name:'声音设置',exact:true}).click();await expect(page.locator('#music-state')).toContainText('加载失败');await page.unroute('**/assets/audio/western.*');
 await page.route('**/assets/audio/western.ogg',route=>route.fulfill({status:200,contentType:'audio/ogg',body:'invalid-ogg-for-test'}));let mp3=false;page.on('response',r=>{if(r.url().endsWith('/western.mp3')&&r.status()===200)mp3=true;});
 await page.getByRole('button',{name:'重新加载音乐',exact:true}).click();await page.waitForFunction(()=>window.__goldMiner.audio.music.duration>0);expect(mp3).toBe(true);expect((await state(page)).audio.music.sources).toBe(0);
 await page.getByRole('button',{name:'返回暂停界面',exact:true}).click();await page.getByRole('button',{name:'继续挖矿 →',exact:true}).click();expect((await state(page)).audio.music.sources).toBe(1);
});

test('商店图标统一、购买提示不遮挡，下一关不残留购买文案，六关主题均可用',async({page})=>{
 await boot(page);for(let level=0;level<6;level++){
  let s=await state(page);expect(s.theme).toBe(level);expect(s.rig.backShoulder).toBeDefined();expect(s.rig.head).toBeDefined();
  await page.screenshot({path:`output/playwright/polish-level-${level+1}.png`,animations:'disabled'});
  await earn(page,s.target+(level===0?400:0));await page.locator('[data-action="finish"]').click();if(level===5)break;
  await page.getByRole('button',{name:'去补给铺 →',exact:true}).click();expect(await page.locator('.shop-icon img').count()).toBe(5);await page.locator('[data-action="buy-rockBook"]').click();await expect(page.locator('.shop-feedback')).toContainText('已购买');await expect(page.locator('#toast')).toBeEmpty();
  if(level===0)await page.screenshot({path:'output/playwright/polish-shop.png',fullPage:true});
  await page.getByRole('button',{name:/收好行囊/}).click();await advance(page,30);await expect(page.locator('#toast')).toBeEmpty();expect((await state(page)).audio.music.sources).toBeLessThanOrEqual(1);
 }
});
