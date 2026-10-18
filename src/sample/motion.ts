import type { HookState, Point } from '../core/model.ts';
import { twoBoneArm } from '../presentation.ts';

export type SampleAction = 'idle' | 'release' | 'light' | 'heavy' | 'deposit';
export const WINCH = { x:590, y:147, radius:23 } as const;
const REST_ANGLE=-.75, DROP_ANGLE=.75, TAU=Math.PI*2;
const smooth=(p:number)=>{const t=Math.max(0,Math.min(1,p));return t*t*(3-2*t);};
const shortest=(a:number,b:number)=>((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;
export interface SampleFrame {
  action:SampleAction; frame:number; phase:number; angle:number; drum:number;
  grip:number; lean:number; shoulder:Point; elbow:Point; hand:Point;
  knob:Point; support:Point; backShoulder:Point; backElbow:Point;
  blink:boolean; lift:number; reduced:boolean;
}

/** 参考实际经典版：待机手在机器旁，放绳落柄并保持，收绳才循环摇柄。
 *  这里只读取钩爪和绳长，不改变发射、速度或结算，也不让动作阻挡输入。
 */
export class SampleAnimator {
  private previousLength=34;
  private angle=REST_ANGLE;
  private drum=0;
  private hook:HookState='swinging';
  private stateAt=0;
  private entryAngle=REST_ANGLE;
  private entryLean=-.015;
  private lean=-.015;
  private gesture:'release'|'deposit'|null=null;
  private started=0;
  reset(length=34) {
    this.previousLength=length;this.angle=REST_ANGLE;this.drum=0;
    this.hook='swinging';this.stateAt=0;this.entryAngle=REST_ANGLE;
    this.entryLean=this.lean=-.015;this.gesture=null;
  }
  notify(action:'launch'|'bank',now:number) {
    this.gesture=action==='launch'?'release':'deposit';this.started=now;
  }
  sample(now:number,length:number,hook:HookState,weight:number,reduced=false):SampleFrame {
    const pulled=Math.max(0,this.previousLength-length),released=Math.max(0,length-this.previousLength);
    this.previousLength=length;
    if(hook!==this.hook) {
      this.hook=hook;this.stateAt=hook==='extending' && this.gesture==='release'?Math.min(now,this.started):now;
      this.entryAngle=this.angle;this.entryLean=this.lean;
    }
    // 放绳时只让手柄下落一次，不按绳长不断甩动手柄。卷筒与手柄在放绳阶段解耦。
    if(hook==='extending')this.angle=this.entryAngle+shortest(this.entryAngle,DROP_ANGLE)*smooth((now-this.stateAt)/.14);
    if(hook==='returning')this.angle+=pulled/(weight>0?145:330)*TAU;
    if(hook==='swinging')this.angle=this.entryAngle+shortest(this.entryAngle,REST_ANGLE)*smooth((now-this.stateAt)/.18);
    this.drum+=(pulled-released)/19;
    const phase=((this.angle/TAU%1)+1)%1*8;
    let action:SampleAction=hook==='extending'?'release':hook==='returning'?weight>=5?'heavy':'light':'idle';
    let lift=0;
    if(this.gesture==='deposit' && hook==='swinging') {
      const p=(now-this.started)/.28;
      if(p<1){action='deposit';lift=Math.sin(Math.max(0,p)*Math.PI);}else this.gesture=null;
    } else if(hook!=='extending')this.gesture=null;
    const effort=reduced?0:(1-Math.cos(this.angle*2))*.5;
    const targetLean=hook==='extending'?-.075:hook==='returning'?weight>=5?-.085-effort*.045:-.035:-.015;
    this.lean=this.entryLean+(targetLean-this.entryLean)*smooth((now-this.stateAt)/.14);
    const lean=this.lean;
    const torso=(x:number,y:number)=>({x:680+(x-680)*Math.cos(lean)-(y-166)*Math.sin(lean),y:166+(x-680)*Math.sin(lean)+(y-166)*Math.cos(lean)});
    const shoulder=torso(660,120),backShoulder=torso(680,121);
    const knob={x:WINCH.x+Math.cos(this.angle)*WINCH.radius,y:WINCH.y+Math.sin(this.angle)*WINCH.radius};
    // 手的控制点始终是柄头，包括向下落柄、回收第一帧和回收后复位。
    const hand={...knob},elbow=twoBoneArm(shoulder,hand,44,54,1).elbow;
    const support=torso(700,145),backElbow=twoBoneArm(backShoulder,support,24,28,1).elbow;
    return {action,frame:Math.floor(phase),phase,angle:this.angle,drum:this.drum,grip:1,lean,
      shoulder,elbow,hand,knob,support,backShoulder,backElbow,
      blink:!reduced && now%4.7>4.54,lift,reduced};
  }
}

export function jawOpening(now:number,caughtAt:number,carrying:boolean) {
  return carrying?15-8*Math.min(1,Math.max(0,now-caughtAt)/.09):15;
}
