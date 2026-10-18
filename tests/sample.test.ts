import test from 'node:test';import assert from 'node:assert/strict';
import { SampleAnimator,jawOpening } from '../src/sample/motion.ts';
import {readSampleSettings} from '../src/sample/audio.ts';
import {SampleModel} from '../src/sample/model.ts';

test('样片音乐默认关闭，已有明确偏好不覆盖，损坏/越界偏好可恢复',()=>{
  assert.equal(readSampleSettings(null).musicEnabled,false);
  assert.equal(readSampleSettings({getItem:()=>'{oops'}).musicEnabled,false);
  const saved=readSampleSettings({getItem:()=>JSON.stringify({musicEnabled:true,effectsEnabled:false,musicVolume:3,effectsVolume:-1,muted:true})});
  assert.deepEqual(saved,{musicEnabled:true,effectsEnabled:false,musicVolume:1,effectsVolume:0,muted:true});
});
test('回收动作在普通及减少动态设置下均完整转动，握柄和手掌共用坐标',()=>{
  for(const reduced of [false,true]){
    const a=new SampleAnimator();a.reset(600);const phases=new Set<number>();
    for(let i=0;i<=150;i++){
      const f=a.sample(i/60,600-i,'returning',2.8,reduced);phases.add(f.frame);
      if(i>=8){assert.ok(Math.hypot(f.hand.x-f.knob.x,f.hand.y-f.knob.y)<1e-9);}
    }
    assert.equal(phases.size,8);
    assert.equal(a.sample(3,449,'returning',7.5,reduced).action,'heavy');
  }
});
test('没有活动时间及收绳变化时，完整姿态保持；重置无残留',()=>{
  const a=new SampleAnimator();a.reset(600);a.sample(.2,580,'returning',7.5);
  const before=a.sample(.3,570,'returning',7.5);
  assert.deepEqual(a.sample(.3,570,'returning',7.5),before);
  a.reset();assert.equal(a.sample(0,34,'swinging',0).grip,1);
});
test('经典姿态：待机握柄、出绳只落柄一次，卷筒继续放绳而手柄不空转',()=>{
  const a=new SampleAnimator();a.reset();const idle=a.sample(0,34,'swinging',0);
  assert.deepEqual(idle.hand,idle.knob);a.notify('launch',0);
  const released=a.sample(.2,120,'extending',0),later=a.sample(.8,400,'extending',0);
  assert.ok(released.hand.y-idle.hand.y>30);assert.ok(Math.abs(released.hand.x-idle.hand.x)<2);
  assert.equal(later.angle,released.angle);assert.ok(later.drum<released.drum);
  assert.deepEqual(later.hand,later.knob);
  const pull=a.sample(1,380,'returning',2.8);assert.ok(pull.angle>later.angle);assert.ok(pull.drum>later.drum);
});
test('经典放钩轨迹单向下落后稳定，不抬手挥臂；减少动态保留同一功能动作',()=>{
  for(const reduced of [false,true]) {
    const a=new SampleAnimator();a.reset();a.notify('launch',0);const poses=[];
    for(let i=0;i<=35;i++) {
      const t=i*.02,f=a.sample(t,34+t*400,'extending',0,reduced);poses.push(f);
      assert.equal(f.action,'release');
      assert.ok(Math.abs(Math.hypot(f.elbow.x-f.shoulder.x,f.elbow.y-f.shoulder.y)-44)<.001);
      assert.ok(Math.abs(Math.hypot(f.hand.x-f.elbow.x,f.hand.y-f.elbow.y)-54)<.001);
      if(i>0)assert.ok(f.hand.y>=poses[i-1].hand.y-.001);
      if(i>7)assert.deepEqual(f.hand,poses[7].hand);
    }
    assert.ok(poses[7].hand.y-poses[0].hand.y>30);
    const paused=a.sample(.7,314,'extending',0,reduced);
    assert.deepEqual(a.sample(.7,314,'extending',0,reduced),paused);
  }
});
test('落柄转回收从最后柄位开始转动，不瞬移回待机手位',()=>{
  const a=new SampleAnimator();a.reset();a.notify('launch',0);
  a.sample(0,34,'extending',0);const out=a.sample(.39,245,'extending',0),contact=a.sample(.39,245,'returning',2.8);
  assert.deepEqual(contact.hand,out.hand);
  const held=a.sample(.52,230,'returning',2.8);
  assert.equal(held.grip,1);assert.deepEqual(held.hand,held.knob);
});
test('完整圆周的衣袖和前臂保持比例，关键姿势交界连续',()=>{
  for(const weight of [0,2.8,7.5]) {
    const a=new SampleAnimator();a.reset(1000);let last;
    for(let n=0;n<1000;n++) {
      const f=a.sample(n/60,1000-n*.3,'returning',weight);
      if(f.grip===1) {
        const upper=Math.hypot(f.elbow.x-f.shoulder.x,f.elbow.y-f.shoulder.y);
        const fore=Math.hypot(f.hand.x-f.elbow.x,f.hand.y-f.elbow.y);
        assert.ok(upper>39 && upper<46);assert.ok(fore>52 && fore<56);
        if(last?.grip===1)assert.ok(Math.hypot(f.elbow.x-last.elbow.x,f.elbow.y-last.elbow.y)<2);
      }
      last=f;
    }
  }
});
test('入账动作可立即被下一次出钩打断，重置清理动作，抓取收紧无周期漂移',()=>{
  const a=new SampleAnimator();a.notify('bank',1);assert.equal(a.sample(1.1,34,'swinging',0).action,'deposit');
  a.notify('launch',1.1);assert.equal(a.sample(1.1,34,'extending',0).action,'release');
  a.reset();assert.equal(a.sample(1.1,34,'swinging',0).action,'idle');
  assert.equal(jawOpening(1,1,true),15);assert.equal(jawOpening(2,1,true),7);assert.equal(jawOpening(20,1,true),7);assert.equal(jawOpening(20,1,false),15);
});
test('同样的收绳轨迹在30/60/144Hz得到一致的动作相位',()=>{
  const ends=[];for(const hz of [30,60,144]){const a=new SampleAnimator();a.reset(600);let f;for(let i=0;i<=hz*2;i++)f=a.sample(i/hz,600-i/hz*100,'returning',2.8);ends.push(f?.angle.toFixed(9));}assert.equal(new Set(ends).size,1);
});
test('大金块慢速对照仅作用于指定物品，保留其他速度、价值、结算与默认规则',()=>{
  const normal=new SampleModel(),slow=new SampleModel(true);normal.start();slow.start();
  const item={itemId:'test',kind:'large' as const,value:500,weight:5.8,offset:{x:0,y:0}};
  normal.carried=item;slow.carried=item;assert.equal(slow.returnSpeed,normal.returnSpeed*.7);
  normal.hook=slow.hook='returning';normal.length=slow.length=60;normal.update(1);slow.update(1);assert.equal(normal.run.money,500);assert.equal(slow.run.money,500);
  for(const kind of ['rock','medium','small'] as const){normal.carried={...item,kind};slow.carried={...item,kind};assert.equal(normal.returnSpeed,slow.returnSpeed);}
});
