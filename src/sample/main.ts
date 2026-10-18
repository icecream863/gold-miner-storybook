import { WORLD, ITEM_NAMES } from '../core/model.ts';
import type { GameEvent } from '../core/model.ts';
import { ActiveClock } from '../core/clock.ts';
import { SampleAnimator, jawOpening } from './motion.ts';
import { drawGround, drawMiner, drawOre, SAMPLE_LAYOUT } from './art.ts';
import { SampleAudio } from './audio.ts';
import { SampleModel } from './model.ts';
import './style.css';

const base = import.meta.env.BASE_URL;
const slowLarge = new URLSearchParams(location.search).get('pace') === 'heavy';
const model = new SampleModel(slowLarge), animator = new SampleAnimator(), audio = new SampleAudio(base + 'assets/audio/');
const clock = new ActiveClock();
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main><header><h1>黄金矿工 <small>${slowLarge ? '大金块慢回收对照' : '第一关样片'}</small></h1><a href="http://127.0.0.1:4175/gold-miner-storybook/" target="_blank" rel="noopener">查看上一版</a></header>
<section class="board" aria-label="矿洞"><canvas width="1100" height="850" tabindex="0" aria-label="按空格、下方向键或点击矿洞出钩"></canvas><div class="hud left"><div>金钱 <strong id="money">$0</strong></div><div>目标 <strong>$650</strong></div></div><div class="hud right"><div>时间 <strong id="time">60</strong></div><div>第一关</div></div><div class="overlay" id="overlay"></div></section>
<section class="controls"><p id="status" role="status">正在准备矿洞…</p><nav><button data-action="launch">出钩 ↓</button><button data-action="pause" id="pause">暂停</button><button data-action="mute" id="mute">静音</button><button data-action="settings">声音</button><button data-action="restart">重开</button><button data-action="finish">结束本关</button></nav></section><footer><span>Space / ↓ 出钩 · P 暂停 · 手机推荐横屏</span><span>本次只验收第一关</span></footer></main>`;
const canvas = app.querySelector('canvas')!, ctx = canvas.getContext('2d')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const moneyEl = document.querySelector('#money')!, timeEl = document.querySelector('#time')!, statusEl = document.querySelector('#status')!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let visual = 0, caughtAt = -Infinity, deposited: { value: number; at: number } | null = null;
let ready = false, error = false, settings = false;
let lastModal = '', lastStatus = '';
let frame = animator.sample(0, WORLD.rest, 'swinging', 0);
const shifted = (y: number) => y + SAMPLE_LAYOUT.offsetY;
function setText(el: Element, value: string) { if (el.textContent !== value) el.textContent = value; }
function active() { return model.phase === 'playing' && !settings && !document.hidden; }
function advance() {
  // 隐藏事件到达时先结清此前的活动时间，再把模型暂停。
  const dt = clock.sample(performance.now(), model.phase === 'playing' && !settings);
  visual += Math.min(dt, model.remaining);
  model.update(dt);
  audio.setActive(active());
  for (const event of model.events.splice(0)) feedback(event);
  // 输入会先结清少量活动时间；同步更新姿态，避免暂停后的首帧又向前跳一次。
  frame = animator.sample(visual,model.length,model.hook,model.carried?.weight ?? 0,reduced.matches);
}
function feedback(event: GameEvent) {
  if (event.type === 'launch') { animator.notify('launch', visual); audio.play('launch'); }
  if (event.type === 'grab') { caughtAt = visual; audio.play('grab'); }
  if (event.type === 'bank') { animator.notify('bank', visual); deposited = { value: event.item.value, at: visual }; audio.play('bank'); }
  if (event.type === 'end') audio.setReel(false, 0, visual);
}
function restart() {
  advance(); model.start(); visual = 0; caughtAt = -Infinity; deposited = null;
  animator.reset(model.length); settings = false; lastModal = ''; audio.reset();
}
function launch() { advance(); if (!ready || settings) return; audio.unlock(); if(model.launch())advance(); }
function pause() {
  advance(); if (model.phase === 'playing') model.pause(); else if (model.phase === 'paused' && !settings) model.resume();
  audio.setActive(active());
}
function openSettings() { advance(); if (model.phase === 'playing') model.pause(); settings = true; lastModal = ''; audio.setActive(false); }
app.addEventListener('click', e => {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'start' || action === 'restart') { if (ready) { audio.unlock(); restart(); } }
  if (action === 'launch') launch();
  if (action === 'pause' || action === 'resume') pause();
  if (action === 'settings') openSettings();
  if (action === 'mute') { audio.configure({muted: !audio.settings.muted}); audio.unlock(); }
  if (action === 'close-settings') { settings = false; lastModal = ''; }
  if (action === 'retry-audio') audio.retry();
  if (action === 'retry-art') location.reload();
  if (action === 'finish') { advance(); model.finish(); }
  target.blur();
  sync();
});
app.addEventListener('input', e => {
  const input = e.target as HTMLInputElement;
  if (!input.dataset.audio) return;
  const key = input.dataset.audio;
  if (key === 'musicEnabled' || key === 'effectsEnabled') audio.configure({ [key]: input.checked });
  if (key === 'musicVolume' || key === 'effectsVolume') audio.configure({ [key]: Number(input.value) / 100 });
  const output = input.parentElement?.querySelector('output'); if (output) output.textContent = `${input.value}%`;
  audio.unlock();
});
canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.focus({ preventScroll: true }); launch(); });
document.addEventListener('keydown', e => {
  if ((e.target as HTMLElement).matches('input') || e.repeat) return;
  if (['Space', 'ArrowDown', 'KeyP', 'Escape', 'ArrowUp'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' || e.code === 'ArrowDown') launch();
  if (e.code === 'ArrowUp') { advance(); model.useBomb(); }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (settings) { settings = false; lastModal = ''; } else pause(); }
});
function loseFocus() { advance(); if (model.phase === 'playing') model.pause(); audio.setActive(false); }
document.addEventListener('visibilitychange', () => { if (document.hidden) loseFocus(); });
window.addEventListener('blur', loseFocus);
function sync() {
  setText(moneyEl, `$${model.run.money.toLocaleString('en-US')}`);
  setText(timeEl, String(Math.ceil(model.remaining)));
  timeEl.classList.toggle('urgent', model.remaining <= 10);
  setText(document.querySelector('#pause')!, model.phase === 'paused' ? '继续' : '暂停');
  setText(document.querySelector('#mute')!, audio.settings.muted ? '开声音' : '静音');
  const status = model.carried ? `${ITEM_NAMES[model.carried.kind]} · ${model.carried.weight >= 5 ? '重物' : '轻物'} · 拉回地面才入账` : model.hook === 'returning' ? '空钩回收' : '看准方向，按空格或点击矿洞';
  if (status !== lastStatus) { setText(statusEl, status); lastStatus = status; }
  const key = `${model.phase}/${settings}/${ready}/${error}`;
  if (key === lastModal) return;
  lastModal = key;
  overlay.hidden = model.phase === 'playing' && !settings;
  if (settings) {
    const s = audio.settings;
    overlay.innerHTML = `<article><h2>声音</h2><p>关内音乐默认关闭，可自行开启。已有明确保存的选择会继续沿用。</p><label><input type="checkbox" data-audio="musicEnabled" ${s.musicEnabled ? 'checked' : ''}/>背景音乐</label><label>音乐音量 <output>${Math.round(s.musicVolume * 100)}%</output><input aria-label="音乐音量" data-audio="musicVolume" type="range" min="0" max="100" value="${s.musicVolume * 100}"/></label><label><input type="checkbox" data-audio="effectsEnabled" ${s.effectsEnabled ? 'checked' : ''}/>游戏音效</label><label>音效音量 <output>${Math.round(s.effectsVolume * 100)}%</output><input aria-label="音效音量" data-audio="effectsVolume" type="range" min="0" max="100" value="${s.effectsVolume * 100}"/></label><p id="audio-state"></p><button data-action="retry-audio">重试声音加载</button><button data-action="close-settings">返回</button></article>`;
  } else if (!ready) overlay.innerHTML = `<article><h2>${error ? '素材加载失败' : '准备矿洞…'}</h2><p>${error ? '可以重试，进度不会被消耗。' : '稍等片刻'}</p>${error ? '<button data-action="retry-art">重新加载</button>' : ''}</article>`;
  else if (model.phase === 'menu') overlay.innerHTML = `<article><p class="eyebrow">GOLD MINER</p><h2>黄金矿工</h2><p>看准时机，满载而归。</p><p>60秒 · 目标 $650</p><button class="primary" data-action="start">开始样片</button><p class="fine">${slowLarge ? '试验对照：仅大金块回收速度为原来的70%。' : '先比较人物动作、抓取与声音。'}</p></article>`;
  else if (model.phase === 'paused') overlay.innerHTML = `<article><h2>已暂停</h2><p>钩爪、倒计时和声音均已暂停。</p><button class="primary" data-action="resume">继续</button><button data-action="settings">声音</button><button data-action="restart">重开</button></article>`;
  else overlay.innerHTML = `<article><h2>${model.success ? '达到目标！' : '再来一趟'}</h2><p>金钱 $${model.run.money} / $650</p><p>本次样片到第一关结束。</p><button class="primary" data-action="restart">再玩第一关</button></article>`;
}
function render() {
  drawGround(ctx);
  if (ready) {
    drawMiner(ctx, frame);
    for (const item of model.items) if (!item.taken || model.carried?.itemId === item.id) {
      const carried = model.carried?.itemId === item.id;
      drawOre(ctx,item,carried ? model.tip.x+model.carried!.offset.x : item.x,shifted(carried ? model.tip.y+model.carried!.offset.y : item.y));
    }
  }
  const tip = model.tip;
  ctx.strokeStyle = '#575341'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(SAMPLE_LAYOUT.ropeExit.x,SAMPLE_LAYOUT.ropeExit.y); ctx.lineTo(tip.x,shifted(tip.y)); ctx.stroke();
  ctx.save(); ctx.translate(tip.x,shifted(tip.y)); ctx.rotate(-model.angle);
  const open = jawOpening(visual,caughtAt,!!model.carried);
  for (const sign of [-1,1]) {
    ctx.beginPath(); ctx.moveTo(sign*3,-8); ctx.lineTo(sign*open,7); ctx.lineTo(sign*6,20); ctx.lineWidth = 7; ctx.strokeStyle = '#45483e'; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#d7dcce'; ctx.stroke();
  }
  ctx.restore();
  if (deposited && visual-deposited.at < .65) {
    const p = (visual-deposited.at)/.65; ctx.globalAlpha = 1-p; ctx.textAlign = 'center'; ctx.font = 'bold 29px Arial'; ctx.fillStyle = '#38622b'; ctx.fillText(`+$${deposited.value}`,620,220-p*20); ctx.globalAlpha = 1;
  }
  sync();
  const state = document.querySelector('#audio-state'); if (state) setText(state, audio.snapshot.error ? '部分声音未加载，可以重试；玩法不受影响。' : '关闭设置后，按继续恢复。');
}
function loop() {
  advance();
  audio.setReel(model.phase === 'playing' && model.hook === 'returning', model.carried?.weight ?? 0, visual);
  render(); requestAnimationFrame(loop);
}
if (new URLSearchParams(location.search).get('qa') === '1') Object.defineProperty(window,'__goldMiner',{get:()=>structuredClone({world:WORLD,phase:model.phase,level:model.levelIndex,angle:model.angle,direction:model.direction,hook:model.hook,length:model.length,money:model.run.money,remaining:model.remaining,strength:model.run.strength,items:model.items,carried:model.carried,frame,audio:audio.snapshot,visual,settings,slowLarge})});
// 角色、机械和矿物均为本地矢量轮廓，开始游戏不再等待生成图下载。
ready=true;
requestAnimationFrame(loop);
