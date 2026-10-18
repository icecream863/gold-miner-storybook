import { WORLD } from './core/model.ts';
import type { Point } from './core/model.ts';
import { SAMPLE_LAYOUT } from './sample/art.ts';
import type { SampleFrame } from './sample/motion.ts';

// 只缩放已确认的矿工/机器这一组。绳出口对齐六关模型支点，靴底落在原木台上。
export const APPROVED_MINER_LAYER={sourceX:500,sourceY:0,width:240,height:210,scale:.72} as const;
export function approvedPoint(p:Point):Point {
  return {x:WORLD.pivot.x+(p.x-SAMPLE_LAYOUT.ropeExit.x)*APPROVED_MINER_LAYER.scale,
    y:WORLD.pivot.y+(p.y-SAMPLE_LAYOUT.ropeExit.y)*APPROVED_MINER_LAYER.scale};
}
export function approvedRig(f:SampleFrame) {
  const hand=approvedPoint(f.hand),knob=approvedPoint(f.knob);
  const head={x:680+(650-680)*Math.cos(f.lean)-(85-f.lift*1.5-166)*Math.sin(f.lean),
    y:166+(650-680)*Math.sin(f.lean)+(85-f.lift*1.5-166)*Math.cos(f.lean)};
  return {...f,root:approvedPoint({x:680,y:166}),rotation:f.lean,
    shoulder:approvedPoint(f.shoulder),elbow:approvedPoint(f.elbow),hand,knob,
    backShoulder:approvedPoint(f.backShoulder),backElbow:approvedPoint(f.backElbow),
    backHand:approvedPoint(f.support),head:approvedPoint(head),spoolAngle:f.drum,
    gripError:Math.hypot(hand.x-knob.x,hand.y-knob.y)};
}
