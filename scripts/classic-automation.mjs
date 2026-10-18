// 只读取 QA 快照，再发出真实按键；不注入钱包、关卡、矿物或模型方法。
import { sweepCircle } from "../src/core/model.ts";
export const state=page=>page.evaluate(()=>window.__goldMiner);
export const advance=(page,ms,virtual=true)=>virtual?page.clock.runFor(ms):page.waitForTimeout(ms);
export function aimWait(s,a){return s.direction>0?(a>=s.angle?a-s.angle:2.36-s.angle-a)/.76:(a<=s.angle?s.angle-a:2.36+s.angle+a)/.76;}
export function firstAt(s,a){
 const w=s.world,sin=Math.sin(a),cos=Math.cos(a),length=Math.min(Math.abs(sin)<1e-8?Infinity:(sin<0?w.pivot.x-w.left:w.right-w.pivot.x)/Math.abs(sin),(w.bottom-w.pivot.y)/cos);
 const from={x:w.pivot.x+sin*w.rest,y:w.pivot.y+cos*w.rest},to={x:w.pivot.x+sin*length,y:w.pivot.y+cos*length};
 return s.items.filter(i=>!i.taken).map(i=>({item:i,t:sweepCircle(from,to,i,i.radius+6)})).filter(i=>i.t!==null).sort((a,b)=>a.t-b.t)[0]?.item;
}
export function choose(s){
 return s.items.filter(i=>!i.taken&&!i.patrol&&i.kind!=="bag"&&i.kind!=="tnt"&&i.value>=100).map(i=>{
  const a=Math.max(-1.175,Math.min(1.175,Math.atan2(i.x-s.world.pivot.x,i.y-s.world.pivot.y)));
  const d=Math.max(0,Math.hypot(i.x-s.world.pivot.x,i.y-s.world.pivot.y)-i.radius-6-s.world.rest);
  const speed=Math.min(600,420*(s.strength?1.5:1)/(1+i.weight*.75));return {id:i.id,angle:a,score:i.value/(aimWait(s,a)+d/560+d/speed+.2)};
 }).filter(c=>firstAt(s,c.angle)?.id===c.id).sort((a,b)=>b.score-a.score)[0];
}
export async function boot(page,{baseURL="http://127.0.0.1:4173/",virtual=true}={}){
 if(virtual)await page.clock.install();const url=new URL(baseURL);url.searchParams.set("qa","1");await page.goto(url.href);
 await page.waitForFunction(()=>!!window.__goldMiner);
 if(virtual){await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));await page.clock.runFor(100);}
 await page.getByRole("button",{name:"开始挖矿 →",exact:true}).click();await advance(page,180,virtual);
}
export async function fireAt(page,id,{virtual=true}={}){
 for(let attempt=0;attempt<300;attempt++){
  const s=await state(page),item=s.items.find(i=>i.id===id);if(s.phase!=="playing"||!item||item.taken)return s;
  let x=item.x;
  if(item.patrol){const p=item.patrol,flight=Math.max(0,Math.hypot(item.x-s.world.pivot.x,item.y-s.world.pivot.y)-item.radius-6-s.world.rest)/560;x+=p.direction*p.speed*flight;if(x>p.right)x=2*p.right-x;if(x<p.left)x=2*p.left-x;}
  const angle=Math.max(-1.175,Math.min(1.175,Math.atan2(x-s.world.pivot.x,item.y-s.world.pivot.y)));
  // 正常时钟有协议与显示帧延迟，容差取目标实际角宽的一部分；虚拟时钟保留精确瞄准。
  const tolerance=virtual ? .012 : Math.min(.055,(item.radius+6)/Math.hypot(x-s.world.pivot.x,item.y-s.world.pivot.y)*.65);
  if(s.hook==="swinging"&&Math.abs(s.angle-angle)<tolerance){await page.keyboard.press("Space");
   for(let f=0;f<120;f++){await advance(page,16,virtual);const hit=await state(page);if(hit.hook==="returning"||hit.phase!=="playing")return hit;}
   throw new Error(`出钩未返回：${id}`);
  }
  await advance(page,Math.max(8,Math.min(150,(aimWait(s,angle)-.006)*1000)),virtual);
 }
 throw new Error(`瞄准超时：${id}`);
}
export async function returned(page,{virtual=true}={}){
 for(let f=0;f<150;f++){const s=await state(page);if(s.hook==="swinging"||s.phase!=="playing")return s;
  const speed=s.carried?Math.min(600,420*(s.strength?1.5:1)/(1+s.carried.weight*.75)):600;
  await advance(page,Math.max(16,Math.min(450,(s.length-s.world.rest)/speed*1000+35)),virtual);
 }throw new Error("回收超时");
}
export async function collect(page,id,options={}){const hit=await fireAt(page,id,options);await returned(page,options);return hit;}
export async function earn(page,target,{virtual=true}={}){
 let shots=0;
 for(let i=0;i<500;i++){
  const s=await state(page);if(s.money>=target)return shots;if(s.phase!=="playing")throw new Error(`第${s.level+1}关收入不足：${s.money}/${target}`);
  if(s.hook!=="swinging"){await returned(page,{virtual});continue;}
  const next=choose(s);if(!next){await advance(page,250,virtual);continue;}
  await collect(page,next.id,{virtual});shots++;
 }throw new Error("采集路线无法完成");
}
export default async function playthrough(page,{baseURL="http://127.0.0.1:4173/",virtual=true}={}){
 await boot(page,{baseURL,virtual});const checks=[],route=[];let shots=0,peakEffects=0,peakVoices=0;
 const check=(name,pass)=>{checks.push({name,pass:Boolean(pass)});if(!pass)throw new Error(name);};
 for(let level=0;level<6;level++){
  let s=await state(page);shots+=await earn(page,level===0?1600:s.target,{virtual});s=await state(page);
  peakEffects=Math.max(peakEffects,s.effects.length);peakVoices=Math.max(peakVoices,s.audio.voices);
  await page.locator('[data-action="finish"]').click();s=await state(page);check(`第${level+1}关真实出钩及金额结算`,s.money>=s.target&&s.phase===(level===5?"complete":"result"));
  route.push({level:level+1,money:s.money,earned:s.earned});if(level===5)break;
  await page.getByRole("button",{name:"去补给铺 →",exact:true}).click();s=await state(page);
  const before=s.money;let cost=0;const products=level===0?["bomb","strength","rockBook","lucky","diamondPolish"]:["strength","diamondPolish"];
  for(const id of products){s=await state(page);const price=s.offers[id].price;if(s.money>=price){await page.locator(`[data-action="buy-${id}"]`).click();cost+=price;}}
  s=await state(page);check(`第${level+1}家商店报价与实际扣款一致`,s.money===before-cost);check("本店报价不会因购买重抽",Object.keys(s.offers).length===5);
  await page.getByRole("button",{name:/收好行囊/}).click();s=await state(page);check("下一关60秒、物品与强化真实继承",s.level===level+1&&s.remaining>59&&s.remaining<=60&&s.items.some(i=>i.kind==="bag"));
 }
 const final=await state(page);check("六关完整通关",final.phase==="complete"&&final.level===5);check("手掌在握柄期间与手柄一致",final.rig.grip<.999||final.rig.gripError<2);check("反馈预算有界",peakEffects<=40&&peakVoices<=16);
 await page.screenshot({path:"output/playwright/classic-complete.png",fullPage:true,animations:"disabled"});
 await page.getByRole("button",{name:"重新开始整局 →",exact:true}).click();const reset=await state(page);
 check("整局重开清空钱包、炸药和强化",reset.level===0&&reset.money===0&&reset.bombs===0&&!reset.strength&&!reset.lucky&&!reset.rockBook&&!reset.diamondPolish&&reset.carried===null);
 await page.keyboard.press("P");if(virtual)await page.clock.resume();
 return {complete:true,realtime:!virtual,shots,bombsUsed:0,peakEffects,peakVoices,route,checks};
}
