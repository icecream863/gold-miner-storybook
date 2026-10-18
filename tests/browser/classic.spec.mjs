import {test,expect} from "./fixtures.mjs";
import playthrough,{boot,state,advance,fireAt,returned,earn,collect,firstAt} from "../../scripts/classic-automation.mjs";
// 图形与音频完整流程在普通开发机上需要更长执行预算，断言不放宽。
test.setTimeout(360000);

test("smoke 经典六关、五次商店、真实采集结算和整局重开",async({page})=>{
 const result=await playthrough(page);expect(result.complete).toBe(true);expect(result.route).toHaveLength(6);expect(result.checks.every(c=>c.pass)).toBe(true);
});

test("问号袋揭晓、经典五商品实际效果、手掌握柄、移动动物和TNT",async({page})=>{
 await boot(page);let s=await state(page);
 // 先清理挡住袋子的石头，再收袋；没有设置金币或直接标记物品状态。
 const bag=s.items.find(i=>i.kind==="bag");
 for(let attempt=0;attempt<4;attempt++){s=await state(page);const angle=Math.atan2(bag.x-s.world.pivot.x,bag.y-s.world.pivot.y);const obstacle=firstAt(s,angle);if(obstacle.id===bag.id)break;await collect(page,obstacle.id);}
 const before=(await state(page)).money;const hit=await fireAt(page,bag.id);expect(hit.carried.kind).toBe("bag");await expect(page.locator("#status")).toContainText("金额待揭晓");
 await advance(page,170);const holding=await state(page);expect(holding.rig.grip).toBe(1);expect(Math.hypot(holding.rig.hand.x-holding.rig.knob.x,holding.rig.hand.y-holding.rig.knob.y)).toBeLessThan(2);
 await page.screenshot({path:"output/playwright/classic-grip.png",animations:"disabled"});
 await page.keyboard.press("P");await advance(page,30);const paused=await state(page);await advance(page,1000);const frozen=await state(page);expect(frozen.rig).toEqual(paused.rig);expect(frozen.cargo).toEqual(paused.cargo);expect(frozen.items).toEqual(paused.items);expect(frozen.remaining).toBe(paused.remaining);expect(frozen.audio.voices).toBe(0);
 await page.getByRole("button",{name:"继续挖矿 →",exact:true}).click();await returned(page);expect((await state(page)).money-before).toBe(hit.carried.value);
 await earn(page,1700);await page.locator('[data-action="finish"]').click();await page.getByRole("button",{name:"去补给铺 →",exact:true}).click();
 const wallet=(await state(page)).money;let cost=0;
 for(const id of ["bomb","strength","rockBook","lucky","diamondPolish"]){s=await state(page);cost+=s.offers[id].price;await page.locator(`[data-action="buy-${id}"]`).dblclick();await expect(page.locator(`[data-action="buy-${id}"]`)).toBeDisabled();}
 s=await state(page);expect(s.money).toBe(wallet-cost);expect(s.bombs).toBe(1);await page.screenshot({path:"output/playwright/classic-shop.png",animations:"disabled"});
 await page.getByRole("button",{name:/收好行囊/}).click();s=await state(page);expect(s.remaining).toBeLessThanOrEqual(60);expect(s.remaining).toBeGreaterThan(59);expect(s.strength&&s.rockBook&&s.lucky&&s.diamondPolish).toBe(true);
 expect(s.items.filter(i=>i.kind==="rock").every(i=>i.value===45)).toBe(true);expect(s.items.filter(i=>i.kind==="diamond").every(i=>i.value===975)).toBe(true);
 const rock=s.items.find(i=>i.kind==="rock");let grabbed=await fireAt(page,rock.id);expect(grabbed.carried.kind).toBe("rock");const l0=grabbed.length;await advance(page,160);s=await state(page);expect(s.rig.grip).toBe(1);expect(s.rig.gripError).toBeLessThan(2);expect(l0-s.length).toBeCloseTo(420*1.5/(1+7.5*.75)*.16,0);
 const cash=s.money;await returned(page);expect((await state(page)).money-cash).toBe(45);
 grabbed=await fireAt(page,(await state(page)).items.find(i=>i.kind==="diamond").id);expect(grabbed.carried.value).toBe(975);await page.keyboard.press("ArrowUp");await advance(page,40);s=await state(page);expect(s.carried).toBeNull();expect(s.bombs).toBe(0);await returned(page);
 for(let level=1;level<=4;level++){
  s=await state(page);
  if(level===2){const mole=s.items.find(i=>i.kind==="mole");const old=mole.x;await advance(page,200);expect((await state(page)).items.find(i=>i.id===mole.id).x).not.toBe(old);await collect(page,mole.id);}
  if(level===3){const before=await state(page);await fireAt(page,before.items.find(i=>i.kind==="tnt").id);const after=await state(page);expect(after.carried).toBeNull();expect(after.money).toBe(before.money);expect(after.bombs).toBe(before.bombs);expect(after.items.filter(i=>i.kind==="tnt"&&i.taken).length).toBe(2);await page.screenshot({path:"output/playwright/classic-tnt.png",animations:"disabled"});await returned(page);}
  if(level===4){const carrier=s.items.find(i=>i.kind==="diamondMole");const hit=await fireAt(page,carrier.id);expect(hit.carried.kind).toBe("diamondMole");await returned(page);break;}
  await earn(page,(await state(page)).target);await page.locator('[data-action="finish"]').click();await page.getByRole("button",{name:"去补给铺 →",exact:true}).click();s=await state(page);expect(s.strength||s.rockBook||s.lucky||s.diamondPolish).toBe(false);await page.getByRole("button",{name:/收好行囊/}).click();
 }
});

test("提前失败、超时货物不补发、没有关内重试，整局重开清理",async({page})=>{
 await boot(page);await page.locator('[data-action="finish"]').click();await expect(page.getByRole("heading",{name:"这趟没挖够",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:/再试一次/})).toHaveCount(0);
 await page.getByRole("button",{name:"重新开始整局 →",exact:true}).click();await advance(page,180);
 const fresh=await state(page);await advance(page,(fresh.remaining-8)*1000);const hit=await fireAt(page,(await state(page)).items.find(i=>i.kind==="rock").id);expect(hit.carried?.kind).toBe("rock");expect(hit.remaining).toBeLessThan((hit.length-hit.world.rest)/(420/(1+7.5*.75)));const before=hit.money;await page.clock.fastForward(10000);const ended=await state(page);expect(ended.phase).toBe("result");expect(ended.money).toBe(before);expect(ended.carried).toBeNull();
 await page.getByRole("button",{name:"重新开始整局 →",exact:true}).click();await advance(page,180);const reset=await state(page);expect(reset.money).toBe(0);expect(reset.bombs).toBe(0);expect(reset.rig.grip).toBe(1);expect(reset.rig.action).toBe('idle');expect(reset.rig.hand).toEqual(reset.rig.knob);expect(reset.camera).toEqual({x:0,y:0});expect(reset.effects).toEqual([]);
});

test("真实活动时钟不丢长帧，工具栏后空格正常，暂停和恢复不消耗停留时间",async({page})=>{
 await page.goto("/?qa=1");await page.waitForFunction(()=>!!window.__goldMiner);await page.getByRole("button",{name:"开始挖矿 →",exact:true}).click();await page.locator("#mute").click();await page.keyboard.press("Space");await page.waitForTimeout(30);expect((await state(page)).hook).not.toBe("swinging");const before=await state(page);
 await page.evaluate(()=>{const start=performance.now();while(performance.now()-start<1150){};});await page.waitForTimeout(60);const after=await state(page);expect(before.remaining-after.remaining).toBeGreaterThan(1.05);
 await page.keyboard.press("P");const paused=await state(page);await page.waitForTimeout(700);const frozen=await state(page);expect(frozen.remaining).toBe(paused.remaining);expect(frozen.rig).toEqual(paused.rig);await page.getByRole("button",{name:"继续挖矿 →",exact:true}).click();await page.waitForTimeout(80);expect((await state(page)).remaining).toBeLessThan(paused.remaining);
});

test("关键素材加载失败保留重试，解除阻断后正常开始",async({page})=>{
 await page.route("**/assets/classic/gold.svg",r=>r.abort());await page.goto("/");await expect(page.getByText("矿灯没点亮：资源加载失败",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"重新加载",exact:true})).toBeVisible();
 await page.unroute("**/assets/classic/gold.svg");await page.getByRole("button",{name:"重新加载",exact:true}).click();await page.getByRole("button",{name:"开始挖矿 →",exact:true}).click();await expect(page.locator("#seconds")).toBeVisible();await page.screenshot({path:"output/playwright/classic-loading-recovery.png",animations:"disabled"});
});

test("桌面与手机尺寸：HUD 不遮矿物，按钮与六关菜单可访问",async({page})=>{
 await boot(page);
 for(const viewport of [{width:1280,height:900},{width:1366,height:768},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(viewport);await advance(page,50);
  const geometry=await page.evaluate(()=>{const canvas=document.querySelector("canvas").getBoundingClientRect(),controls=document.querySelector(".play-controls").getBoundingClientRect();const hudBottom=Math.max(...[...document.querySelectorAll(".hud-left,.hud-right")].map(e=>e.getBoundingClientRect().bottom));const oreTop=Math.min(...window.__goldMiner.items.filter(i=>!i.taken).map(i=>canvas.top+(i.y-i.radius)*canvas.height/800));const tapButtons=[...document.querySelectorAll("button")].map(b=>b.getBoundingClientRect()).filter(b=>b.width>0&&b.height>0).map(b=>({width:b.width,height:b.height}));return {tapButtons,hudBottom,oreTop,width:document.documentElement.scrollWidth,viewport:innerWidth,canvas:{top:canvas.top,bottom:canvas.bottom,height:canvas.height},controls:{top:controls.top,bottom:controls.bottom},buttons:[...document.querySelectorAll(".actions button")].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))};});
  if(viewport.width<=650||viewport.height<=500)expect(geometry.tapButtons.every(b=>b.width>=44&&b.height>=44)).toBe(true);expect(geometry.hudBottom).toBeLessThan(geometry.oreTop);expect(geometry.width).toBeLessThanOrEqual(viewport.width+1);expect(geometry.controls.top).toBeGreaterThanOrEqual(geometry.canvas.bottom);expect(geometry.buttons.every(b=>b.width>=29&&b.height>=31)).toBe(true);
  if(viewport.width===390||viewport.width===844)await page.screenshot({path:`output/playwright/classic-${viewport.width}.png`,animations:"disabled",fullPage:true});
 }
 await page.keyboard.press("P");await expect(page.getByRole("button",{name:"继续挖矿 →",exact:true})).toBeVisible();
});

test("低动态与音频禁用时仍可抓取，握柄和静音降级不干扰游戏",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});await page.addInitScript(()=>{window.AudioContext=class{constructor(){throw new Error("blocked for test")}};});await boot(page);
 const s=await state(page);await fireAt(page,s.items.find(i=>i.kind==="medium").id);await advance(page,50);const hit=await state(page);expect(hit.minerAnimation.reduced).toBe(true);expect(hit.rig.gripError).toBeLessThan(2);expect(hit.audio.voices).toBe(0);await advance(page,120);expect((await state(page)).rig.angle).not.toBe(hit.rig.angle);await returned(page);expect((await state(page)).money).toBeGreaterThan(0);
});

test("手机商店原生触摸可滚动到第五商品并购买",async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await boot(page);await earn(page,1200);await page.locator('[data-action="finish"]').click();await page.getByRole("button",{name:"去补给铺 →",exact:true}).click();
 const cdp=await context.newCDPSession(page);await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
 const box=await page.locator(".shop-paper").boundingBox();const x=Math.round(box.x+box.width/2),start=Math.round(box.y+box.height*.8),end=Math.round(box.y+box.height*.25);
 for(let n=0;n<3;n++){await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y:start}]});for(let i=1;i<=10;i++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:Math.round(start+(end-start)*i/10)}]});await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});}
 await expect(page.locator('[data-action="buy-diamondPolish"]')).toBeInViewport();const before=await state(page);await page.locator('[data-action="buy-diamondPolish"]').click();expect((await state(page)).money).toBe(before.money-before.offers.diamondPolish.price);await expect(page.getByRole("button",{name:/收好行囊/})).toBeInViewport();await page.screenshot({path:"output/playwright/classic-shop-mobile.png",animations:"disabled"});await cdp.detach();
});
