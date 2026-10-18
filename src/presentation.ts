import type { HookState, Point } from "./core/model.ts";
export const EFFECT_LIMIT = 40;
export const RIG = Object.freeze({ root: { x: 620, y: 145 }, hub: { x: 550, y: 100 }, handleRadius: 12,
    shoulder: { x: -25, y: -58 }, backShoulder: { x: 18, y: -55 }, head: { x: 0, y: -43 },
    bodySize: { width: 100, height: 128 }, headSize: { width: 72, height: 84 },
    upperArm: 38, forearm: 38, spoolRadius: 22, gear: .18 });
export const progress = (now: number, start: number, duration: number) => Math.max(0, Math.min(1, (now - start) / duration));
export function pulse(now: number, start: number, duration: number): number {
    const age = now - start;
    return age >= 0 && age < duration ? 1 - age / duration : 0;
}
export const impact = (weight: number) => Math.max(0, Math.min(1, weight / 12));
export function loadLabel(weight: number): "轻" | "中" | "重" { return weight >= 7 ? "重" : weight > 3 ? "中" : "轻"; }
export function cameraKick(now: number, start: number, reduced: boolean) {
    const p = reduced ? 0 : pulse(now, start, .12);
    return { x: Math.sin((now - start) * 125) * 1.6 * p || 0, y: Math.sin((now - start) * 93) * .9 * p || 0 };
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function twoBoneArm(shoulder: Point, hand: Point, upper: number, fore: number, bend = 1) {
    const dx = hand.x - shoulder.x, dy = hand.y - shoulder.y, raw = Math.hypot(dx, dy);
    const distance = Math.max(.001, Math.min(upper + fore - .001, raw));
    const ux = raw > .001 ? dx / raw : 1, uy = raw > .001 ? dy / raw : 0;
    const along = (upper * upper - fore * fore + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    const elbow = { x: shoulder.x + ux * along + uy * height * bend, y: shoulder.y + uy * along - ux * height * bend };
    return { elbow, hand: { x: shoulder.x + ux * distance, y: shoulder.y + uy * distance }, reachable: raw <= upper + fore && raw >= Math.abs(upper - fore) };
}
export type MinerAction = "idle" | "release" | "haul-light" | "haul-heavy" | "bank" | "bomb" | "win" | "lose";
type Gesture = "launch" | "bank" | "bomb" | "win" | "lose";
const GESTURE_SECONDS = { launch: .12, bank: .28, bomb: .18, win: .65, lose: .65 };
export function minerPose(angle: number, grip: number, effort: number, reduced = false,
    options: { time?: number; gesture?: Gesture; gestureProgress?: number; spoolAngle?: number } = {}) {
    const time = options.time ?? 0, gesture = options.gesture;
    const envelope = reduced ? 0 : Math.sin(Math.PI * (options.gestureProgress ?? 0));
    const rotation = reduced ? 0 : (effort === 0 ? 0 : -effort * .035) + (gesture === "bomb" ? .035 * envelope : 0);
    const c = Math.cos(rotation), s = Math.sin(rotation), local = RIG.shoulder;
    const shoulder = { x: RIG.root.x + local.x * c - local.y * s, y: RIG.root.y + local.x * s + local.y * c };
    // 同一 knob 同时供手掌和手柄绘制，不能在场景里再写第二份圆周坐标。
    const knob = { x: RIG.hub.x + Math.cos(angle) * RIG.handleRadius, y: RIG.hub.y + Math.sin(angle) * RIG.handleRadius };
    // 准备姿态的手放在卷扬机旁，避免前臂折到胡须和胸前。
    const rest = { x: 560 + (gesture === "launch" ? 10 * envelope : 0), y: 122 + (gesture === "lose" ? 5 * envelope : gesture === "launch" ? -8 * envelope : 0) };
    const target = { x: lerp(rest.x, knob.x, grip), y: lerp(rest.y, knob.y, grip) };
    const arm = twoBoneArm(shoulder, target, RIG.upperArm, RIG.forearm);
    const transform = (p: Point) => ({ x: RIG.root.x + p.x * c - p.y * s, y: RIG.root.y + p.x * s + p.y * c });
    const backShoulder = transform(RIG.backShoulder);
    const support = { x: 578, y: 123 }, relaxed = transform({ x: 27, y: -17 });
    const backTarget = { x: lerp(relaxed.x, support.x, effort) + (gesture === "win" ? Math.sin(time * 16) * 4 * envelope : 0), y: lerp(relaxed.y, support.y, effort) - (gesture === "win" ? envelope * 75 : gesture === "bomb" ? envelope * 6 : 0) };
    const backArm = twoBoneArm(backShoulder, backTarget, 35, 36, -1);
    const head = transform(RIG.head);
    const headRotation = reduced ? 0 : rotation * .6 + Math.sin(time * 2.1) * .012 + (gesture === "bank" ? envelope * .1 : gesture === "lose" ? envelope * .15 : -effort * .035);
    const expression = gesture === "win" || gesture === "bank" ? "happy" : gesture === "lose" ? "sad" : effort > .3 || gesture === "bomb" ? "effort" : "neutral";
    const action: MinerAction = gesture === "launch" ? "release" : gesture ?? (grip > .01 ? effort > .35 ? "haul-heavy" : "haul-light" : "idle");
    return { root: { ...RIG.root }, rotation, shoulder, knob, elbow: arm.elbow, hand: arm.hand, grip, effort, reachable: arm.reachable,
        backShoulder, backElbow: backArm.elbow, backHand: backArm.hand, head, headRotation, expression, action, spoolAngle: options.spoolAngle ?? 0,
        gripError: Math.hypot(arm.hand.x - knob.x, arm.hand.y - knob.y) };
}
export function cargoMotion(now: number, caughtAt: number, weight: number, reduced = false) {
    const settle = reduced ? 0 : pulse(now, caughtAt, .16);
    return { rotation: reduced ? 0 : Math.sin(now * 4.5) * .07 / (1 + weight), scale: 1 + settle * .035 };
}
export function walkCycle(distance: number, carried: boolean, reduced = false) {
    return carried || reduced ? 0 : Math.sin(distance / 5);
}
export class MinerAnimator {
    angle = .7;
    private previousLength = 34;
    private targetGrip = 0;
    private fromGrip = 0;
    private gripStart = 0;
    private targetEffort = 0;
    private fromEffort = 0;
    private effortStart = 0;
    private gesture: Gesture | undefined;
    private gestureAt = 0;
    private spoolAngle = 0;
    notify(gesture: Gesture, now: number) { this.gesture = gesture; this.gestureAt = now; }
    reset(now: number, length: number) { this.angle = .7; this.spoolAngle = 0; this.previousLength = length; this.targetGrip = this.fromGrip = 0; this.targetEffort = this.fromEffort = 0; this.gripStart = this.effortStart = now; this.gesture = undefined; }
    sample(now: number, length: number, hook: HookState, weight: number, reduced = false) {
        const turn = (this.previousLength - length) / RIG.spoolRadius;
        this.spoolAngle += turn;
        this.angle += turn * RIG.gear;
        this.previousLength = length;
        let grip = lerp(this.fromGrip, this.targetGrip, smooth(progress(now, this.gripStart, .12)));
        let effort = lerp(this.fromEffort, this.targetEffort, smooth(progress(now, this.effortStart, .12)));
        const desiredGrip = hook === "returning" ? 1 : 0, desiredEffort = weight > 0 ? impact(weight) : 0;
        if (desiredGrip !== this.targetGrip) {
            this.fromGrip = grip;
            this.targetGrip = desiredGrip;
            this.gripStart = now;
        }
        if (desiredEffort !== this.targetEffort) {
            this.fromEffort = effort;
            this.targetEffort = desiredEffort;
            this.effortStart = now;
        }
        if (reduced) {
            grip = this.targetGrip;
            effort = this.targetEffort;
        }
        let gestureProgress = 0;
        if (this.gesture) {
            gestureProgress = progress(now, this.gestureAt, GESTURE_SECONDS[this.gesture]);
            if (gestureProgress >= 1) this.gesture = undefined;
        }
        return minerPose(this.angle, grip, effort, reduced, { time: now, gesture: this.gesture, gestureProgress, spoolAngle: this.spoolAngle });
    }
}
