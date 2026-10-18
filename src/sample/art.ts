import type { Item, Point } from '../core/model.ts';
import { WORLD } from '../core/model.ts';
import type { SampleFrame } from './motion.ts';
import { WINCH } from './motion.ts';
export const SAMPLE_LAYOUT={offsetY:50,ropeExit:{x:WORLD.pivot.x,y:WORLD.pivot.y+50}} as const;

// 同一套手绘矢量轮廓、两级明暗和圆角描边。关节使用有体积的衣袖/皮肤形状。
const INK='#573b29', GOLD='#ffd32c', SHADE='#e6a623', SKIN='#f0b579';
type Ctx = CanvasRenderingContext2D;
const paths=new Map<string,Path2D>();
function shape(c:Ctx,d:string,fill:string,line=INK,width=2.6) {
  let p=paths.get(d);
  if(!p) {
    p=new Path2D(d);
    // 静态轮廓复用；手臂长度变化的轮廓也有容量限制，连续运行不积累对象。
    if(paths.size>=384)paths.delete(paths.keys().next().value!);
    paths.set(d,p);
  }
  c.fillStyle=fill; c.fill(p);
  if(line){c.strokeStyle=line;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke(p);}
}
function oval(c:Ctx,x:number,y:number,rx:number,ry:number,fill:string,line=INK,width=2.5) {
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();
  if(line){c.strokeStyle=line;c.lineWidth=width;c.stroke();}
}
// 一条连续轮廓连接肩、肘、腕和手掌。袖口只作衣料分界，不把关节各自封口。
function arm(c:Ctx,s:Point,e:Point,h:Point,shirt:string,shade:string) {
  const unit=(a:Point,b:Point)=>{const d=Math.max(.001,Math.hypot(b.x-a.x,b.y-a.y));return{x:(b.x-a.x)/d,y:(b.y-a.y)/d};};
  const u=unit(s,e),v=unit(e,h),n={x:-u.y,y:u.x},m={x:-v.y,y:v.x};
  const sum=Math.max(.001,Math.hypot(n.x+m.x,n.y+m.y)),j={x:(n.x+m.x)/sum,y:(n.y+m.y)/sum};
  const p=(a:Point,d:Point,k:number)=>({x:a.x+d.x*k,y:a.y+d.y*k}),xy=(a:Point)=>`${a.x} ${a.y}`;
  const sp=p(s,n,11),sn=p(s,n,-11),ep=p(e,j,10),en=p(e,j,-10);
  const wrist=p(h,v,-7),wp=p(wrist,m,6.5),wn=p(wrist,m,-6.5);
  const tip=p(h,v,9),top=p(p(h,v,6),m,7),bottom=p(p(h,v,6),m,-7);
  const mid={x:(s.x+e.x)/2,y:(s.y+e.y)/2};
  shape(c,`M ${xy(sp)} Q ${xy(p(mid,n,13))} ${xy(ep)} Q ${xy(p(e,m,10))} ${xy(wp)} C ${xy(top)} ${xy(top)} ${xy(tip)} Q ${xy(bottom)} ${xy(wn)} Q ${xy(p(e,m,-10))} ${xy(en)} Q ${xy(p(mid,n,-11))} ${xy(sn)}`,SKIN);
  // 袖子覆盖上臂，肩根留开口融入躯干；没有“胶囊端面”式的深色截断线。
  const cuff=p(e,u,-6),cp=p(cuff,n,9.5),cn=p(cuff,n,-9.5);
  shape(c,`M ${xy(sp)} Q ${xy(p(mid,n,13))} ${xy(cp)} Q ${xy(p(cuff,u,4))} ${xy(cn)} Q ${xy(p(mid,n,-11))} ${xy(sn)}`,shirt);
  shape(c,`M ${xy(p(s,n,-6))} Q ${xy(p(mid,n,-7))} ${xy(p(cuff,n,-6))} L ${xy(cn)} Q ${xy(p(mid,n,-11))} ${xy(sn)}`,shade,'');
  // 手指短线只画在掌面，腕部沿同一外轮廓自然收窄。
  const finger=p(h,v,3),a1=p(finger,m,-3.5),a2=p(finger,m,3.5);
  shape(c,`M ${xy(a1)} Q ${xy(p(finger,v,1.5))} ${xy(a2)}`,SKIN,INK,1.3);
}

export function drawGround(c:Ctx) {
  c.clearRect(0,0,1100,850);
  c.fillStyle='#ffe78b';c.fillRect(0,0,1100,200);
  c.fillStyle='#bd793f';c.fillRect(0,200,1100,650);
  c.fillStyle='#cc8c4d';c.fillRect(0,210,1100,320);
  shape(c,'M 0 520 Q 210 495 460 545 T 1100 522 L 1100 850 L 0 850 Z','#b77740','');
  shape(c,'M 0 202 L 1100 202 L 1100 215 Q 900 211 780 218 T 350 215 T 0 218 Z','#a76535','');
  c.strokeStyle=INK;c.lineWidth=3;c.beginPath();c.moveTo(0,201);c.lineTo(1100,201);c.stroke();
  // 只在边缘留少量岩层标记，不用密集纹理抢矿物对比度。
  for(const [x,y] of [[38,313],[1048,375],[63,689],[1031,770]]) {
    shape(c,`M ${x-8} ${y} l 9 -3 12 3 -9 2 Z`,'#995f36','');
  }
}

export function drawOre(c:Ctx,item:Item,x:number,y:number) {
  c.save();c.translate(x,y);c.scale(item.radius/32,item.radius/32);
  const outline=2.6*32/item.radius;
  if(item.kind==='bag') {
    shape(c,'M -13 -20 L -19 -31 L -3 -27 L 13 -31 L 8 -19 Q 28 0 25 17 Q 24 30 0 30 Q -25 29 -26 16 Q -27 0 -13 -20 Z','#e7c489',INK,outline);
    shape(c,'M 4 -16 Q 25 6 20 18 Q 13 26 -8 25 Q 9 16 4 -16 Z','#cba267','');
    shape(c,'M -13 -18 Q -3 -15 9 -18','#e7c489',INK,outline);
    c.font='bold 31px Georgia';c.fillStyle=INK;c.textAlign='center';c.fillText('?',0,19);
  } else if(item.kind==='rock') {
    shape(c,'M -30 -7 Q -29 -22 -15 -25 L 7 -29 Q 23 -25 30 -10 L 29 12 Q 19 25 2 29 L -20 24 Q -32 12 -30 -7 Z','#a8a294',INK,outline);
    shape(c,'M 8 -27 L 13 -8 L 26 3 L 27 12 Q 15 27 1 28 L -20 23 L -9 13 L 2 12 L -3 0 Z','#878779','');
    shape(c,'M -23 -9 L -14 -18 L -2 -21','#a8a294','#c9c4b2',outline);
  } else {
    // 不规则矿块，保留碰撞半径；切面共享轮廓，不再画成五瓣花。
    shape(c,'M -29 -9 L -17 -25 L 3 -28 L 12 -22 L 24 -23 L 31 -6 L 25 4 L 28 15 L 10 28 L -5 25 L -19 29 L -30 11 L -25 1 Z',GOLD,INK,outline);
    shape(c,'M 12 -21 L 8 -3 L 20 4 L 25 15 L 9 27 L -5 24 L -19 28 L -26 15 L -8 10 L 1 -2 Z',SHADE,'');
    shape(c,'M -22 -10 L -12 -20 L 0 -22 L -5 -10 L -15 -2 Z','#fff19c','');
    shape(c,'M 8 -3 L 19 4 L 13 12',GOLD,'#c48823',1.7*32/item.radius);
  }
  c.restore();
}

export function drawMiner(c:Ctx,f:SampleFrame) {
  // 靴底不参与躯干变形。后脚、后臂先画，前手最后覆盖手柄。
  oval(c,662,198,65,3,'#c49b50','');
  shape(c,'M 690 158 L 712 160 L 713 184 L 695 187 L 684 174 Z','#557389');
  shape(c,'M 693 181 Q 711 177 719 188 L 723 197 L 686 197 Q 682 190 693 181 Z','#805137');
  shape(c,'M 655 158 L 682 157 L 678 184 L 657 187 L 648 174 Z','#658297');
  shape(c,'M 654 181 L 674 181 L 675 197 L 636 197 Q 632 187 654 181 Z','#935e3b');
  shape(c,'M 637 193 L 674 193 M 688 193 L 721 193','#935e3b',INK,2);
  arm(c,f.backShoulder,f.backElbow,f.support,'#bd8239','#9e652f');

  c.save();c.translate(680,166);c.rotate(f.lean);c.translate(-680,-166);
  shape(c,'M 651 108 Q 672 102 688 115 Q 703 133 702 160 L 683 171 L 654 165 Q 640 145 644 123 Z','#d89940');
  shape(c,'M 683 116 Q 699 135 700 160 L 682 168 L 672 161 Q 681 142 675 119 Z','#b47733','');
  shape(c,'M 652 135 L 676 140 L 694 136 L 699 162 L 682 171 L 653 165 Z','#638497');
  shape(c,'M 654 114 L 660 113 L 670 147 L 664 150 Z','#426477',INK,1.6);
  oval(c,665,143,2.1,2.1,'#ebcb67','');
  shape(c,'M 679 148 L 689 146 L 690 159 L 679 161 Z','#7698a9',INK,1.5);

  // 侧脸：一个轮廓里连接后脑、鼻子与下巴；胡须不遮眼睛和工作朝向。
  c.save();c.translate(0,-f.lift*1.5);
  shape(c,'M 675 65 Q 670 47 651 46 Q 635 46 628 60 L 626 75 Q 610 76 611 85 Q 612 94 630 93 L 635 106 L 661 112 L 678 95 Q 687 81 675 65 Z',SKIN);
  shape(c,'M 674 65 Q 689 65 686 77 L 679 85 L 671 78 Z','#e6a36b');
  shape(c,'M 671 83 Q 667 94 657 93 L 645 89 Q 636 93 626 89 L 626 100 L 619 96 L 624 111 L 619 112 Q 631 137 653 133 Q 677 127 679 100 L 676 86 Z','#f7eccf');
  shape(c,'M 674 103 Q 670 126 651 130 L 639 127 Q 658 120 661 106 Z','#dfd2ac','');
  shape(c,'M 628 88 Q 639 81 649 88 L 646 97 L 637 94 L 629 98 L 622 92 Z','#fff2d6');
  shape(c,'M 638 101 Q 644 105 650 101','#f7eccf',INK,1.5);
  if(f.blink) shape(c,'M 628 70 L 636 70',SKIN,INK,2);
  else {oval(c,632,70,3,5,'#fff7df',INK,1.2);oval(c,630.8,71,1.35,2.8,INK,'');}
  shape(c,'M 626 61 Q 633 57 639 61',SKIN,INK,2.7);
  // 灯帽与衣袖使用相同的黄色/棕色，不添加渐变材质。
  shape(c,'M 623 56 Q 622 36 646 33 Q 669 30 680 52 L 685 58 L 674 64 Q 644 57 618 64 L 610 60 Z','#eac24f');
  shape(c,'M 653 35 Q 670 34 677 53 L 666 55 Q 662 41 653 35 Z','#c89a36','');
  shape(c,'M 620 57 Q 644 51 680 57','#eac24f',INK,2.1);
  oval(c,625,49,8,9,'#938f78');oval(c,624,48,5.3,6.2,'#fff2a7',INK,1.6);
  c.restore();c.restore();

  // 卷扬机：机架、轴、卷筒和前面板分层。辐条是真正的旋转几何。
  shape(c,'M 541 141 L 527 198 L 541 198 L 556 151 Z','#a8753c');
  shape(c,'M 585 143 L 601 198 L 616 198 L 600 139 Z','#b88243');
  shape(c,'M 523 196 L 620 196 L 621 201 L 523 201 Z','#8f653a');
  shape(c,'M 543 127 L 587 127 L 587 165 L 543 165 Z','#d6b16d');
  for(let n=0;n<8;n++) {
    const x=546+n*5;
    shape(c,`M ${x} 128 Q ${x-5} 145 ${x} 164`,'#d6b16d','#a98149',1.6);
  }
  oval(c,542,146,10,25,'#6e7062');oval(c,590,147,13,28,'#828475');
  for(const angle of [f.drum,f.drum+Math.PI/2]) {
    const dx=Math.cos(angle)*10,dy=Math.sin(angle)*22;
    shape(c,`M ${WINCH.x-dx} ${WINCH.y-dy} L ${WINCH.x+dx} ${WINCH.y+dy}`,'#828475','#b9b6a0',2.5);
  }
  oval(c,590,147,5,5,'#494b44');
  shape(c,`M 590 147 L ${f.knob.x} ${f.knob.y}`,'#828475',INK,5);
  oval(c,f.knob.x,f.knob.y,7,7,'#67472d');
  // 可见导轮就是模型的摆动支点，避免导轮下方再出现一段无支撑的折线。
  const exit=SAMPLE_LAYOUT.ropeExit;
  shape(c,`M 548 163 L ${exit.x} ${exit.y}`,'#b88243',INK,3);
  oval(c,exit.x,exit.y,6,6,'#777866',INK,2);

  arm(c,f.shoulder,f.elbow,f.hand,'#d89940','#b47733');
}
