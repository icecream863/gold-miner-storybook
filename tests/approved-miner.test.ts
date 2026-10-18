import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/core/model.ts';
import { approvedPoint,approvedRig,APPROVED_MINER_LAYER } from '../src/approved-miner.ts';
import { SAMPLE_LAYOUT } from '../src/sample/art.ts';
import { SampleAnimator } from '../src/sample/motion.ts';

test('动画接入六关：可见导轮严格对齐模型支点，靴底在原木台上',()=>{
  assert.deepEqual(approvedPoint(SAMPLE_LAYOUT.ropeExit),WORLD.pivot);
  const feet=approvedPoint({x:675,y:201});assert.ok(Math.abs(feet.y-145)<1);
  const top=approvedPoint({x:650,y:33});assert.ok(top.y>0);
  assert.ok(approvedPoint({x:APPROVED_MINER_LAYER.sourceX+APPROVED_MINER_LAYER.width,y:0}).x<700);
});
test('动画世界映射保留握柄精度和暂停姿态，不把样片坐标当成六关坐标',()=>{
  const a=new SampleAnimator();a.reset(600);
  for(let i=0;i<150;i++) {
    const source=a.sample(i/60,600-i,'returning',7.5,true),world=approvedRig(source);
    assert.deepEqual(world.hand,world.knob);assert.equal(world.gripError,0);
    assert.ok(Math.abs(Math.hypot(world.elbow.x-world.hand.x,world.elbow.y-world.hand.y)-54*.72)<.001);
  }
  const before=approvedRig(a.sample(3,450,'returning',7.5,true));
  assert.deepEqual(approvedRig(a.sample(3,450,'returning',7.5,true)),before);
});
