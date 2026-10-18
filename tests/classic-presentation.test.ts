import test from "node:test";
import assert from "node:assert/strict";
import { MinerAnimator, minerPose, RIG, twoBoneArm, pulse, cameraKick } from "../src/presentation.ts";
test("完整手柄圆周及轻重负载：肩肘腕长度成立，握柄误差小于2像素", () => {
    for (const effort of [0, .1, .5, 1])
        for (let i = 0; i < 360; i++) {
            const p = minerPose(i * Math.PI / 180, 1, effort);
            assert.ok(p.reachable);
            assert.ok(p.gripError < .001);
            assert.ok(Math.abs(Math.hypot(p.elbow.x - p.shoulder.x, p.elbow.y - p.shoulder.y) - RIG.upperArm) < 1e-8);
            assert.ok(Math.abs(Math.hypot(p.hand.x - p.elbow.x, p.hand.y - p.elbow.y) - RIG.forearm) < 1e-8);
            assert.deepEqual(p.root, RIG.root);
        }
});
test("两段手臂对不可达或重合目标返回有限坐标", () => { for (const hand of [{ x: 1000, y: 1000 }, { x: 0, y: 0 }]) {
    const p = twoBoneArm({ x: 0, y: 0 }, hand, 38, 38);
    for (const value of Object.values(p.elbow))
        assert.ok(Number.isFinite(value));
} });
test("120ms握柄与放手平滑过渡，暂停按相同活动时间取样不会漂移", () => {
    const a = new MinerAnimator();
    a.reset(0, 100);
    const start = a.sample(0, 100, "returning", 7.5);
    assert.equal(start.grip, 0);
    const mid = a.sample(.06, 90, "returning", 7.5);
    assert.ok(mid.grip > 0 && mid.grip < 1);
    const end = a.sample(.12, 80, "returning", 7.5);
    assert.equal(end.grip, 1);
    assert.ok(end.gripError < 2);
    for (let i = 0; i < 100; i++)
        assert.deepEqual(a.sample(.12, 80, "returning", 7.5), end);
    a.sample(.13, 80, "swinging", 0);
    const relax = a.sample(.25, 80, "swinging", 0);
    assert.equal(relax.grip, 0);
    assert.equal(relax.rotation, 0);
});
test("手柄角度只按收放绳距离，30/60/144Hz最终姿态一致，重置回原点", () => {
    const samples = [30, 60, 144].map(fps => { const a = new MinerAnimator(); a.reset(0, 600); let pose = minerPose(.7, 0, 0); for (let i = 0; i <= fps; i++)
        pose = a.sample(i / fps, 600 - 500 * i / fps, "returning", 5.8); return { a, pose }; });
    for (const { a, pose } of samples) {
        assert.ok(Math.abs(a.angle - (.7 + 500 / 22 * .18)) < 1e-10);
        assert.ok(pose.gripError < 2);
        a.reset(0, 34);
        assert.deepEqual(a.sample(0, 34, "swinging", 0), minerPose(.7, 0, 0));
    }
});
test("低动态取消身体倾斜与镜头晃动，未来时间戳不会造成后坐力", () => {
    const a = new MinerAnimator();
    a.reset(0, 100);
    const p = a.sample(.01, 90, "returning", 12, true);
    assert.equal(p.rotation, 0);
    assert.equal(p.grip, 1);
    assert.ok(p.gripError < 2);
    for (const start of [-Infinity, 0, 30]) {
        const p = pulse(1, start, .12);
        assert.ok(p >= 0 && p <= 1);
    }
    assert.deepEqual(cameraKick(.1, 0, true), { x: 0, y: 0 });
});

test("前后手臂连续、头部与身体分层，动作打断和重置不保留旧姿态",()=>{
 const a=new MinerAnimator();a.reset(0,34);a.notify("bank",0);let pose=a.sample(.1,34,"swinging",0);assert.equal(pose.action,"bank");assert.equal(pose.expression,"happy");assert.notEqual(pose.headRotation,0);
 a.notify("launch",.1);pose=a.sample(.1,35,"extending",0);assert.equal(pose.action,"release");assert.equal(pose.expression,"neutral");const release=a.sample(.16,60,"extending",0);assert.ok(Math.hypot(release.hand.x-pose.hand.x,release.hand.y-pose.hand.y)>4);pose=a.sample(.4,100,"extending",0);assert.equal(pose.action,"idle");
 for(const event of ["bomb","win","lose"] as const){a.notify(event,1);const p=a.sample(1.2,100,"swinging",0);assert.deepEqual(p.root,RIG.root);assert.ok([p.backElbow.x,p.backElbow.y,p.head.x,p.head.y].every(Number.isFinite));}
 a.reset(0,34);assert.deepEqual(a.sample(0,34,"swinging",0),minerPose(.7,0,0));
});

test("支撑手全负载骨长正确，肘部轨迹和绞盘没有逐帧跳变",()=>{
 for(const effort of [0,.25,.5,.75,1]){let previous;for(let frame=0;frame<720;frame++){const p=minerPose(frame*Math.PI/360,1,effort);assert.ok(Math.abs(Math.hypot(p.backElbow.x-p.backShoulder.x,p.backElbow.y-p.backShoulder.y)-35)<1e-6);assert.ok(Math.abs(Math.hypot(p.backHand.x-p.backElbow.x,p.backHand.y-p.backElbow.y)-36)<1e-6);if(previous)assert.ok(Math.hypot(p.elbow.x-previous.elbow.x,p.elbow.y-previous.elbow.y)<2);previous=p;}}
});
