import Phaser from "phaser";
import { MinerModel, LEVELS, WORLD } from "./core/model.ts";
import type { GameEvent, Phase } from "./core/model.ts";
import { GameAudio } from "./audio.ts";
import "./style.css";

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
const svg = {
  gem: '<svg viewBox="0 0 32 32" fill="none"><path d="m5 11 6-7h10l6 7-11 17Z" fill="#ddb760" stroke="#8e7846" stroke-width="1.4"/><path d="m5 11 11 17 11-17H5Zm6-7 5 24 5-24M5 11h22" stroke="#fff0b1" stroke-width="1.4"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="13" r="8"/><path d="M9 2h6m-3 3v-3m0 6v5l3 2"/></svg>',
  bomb: '<svg viewBox="0 0 48 48" fill="none"><path d="M29 13q-1-8 10-7" stroke="#765c34" stroke-width="3"/><path d="m37 3 3 5 4-3m-5 3 2 5" stroke="#e7b95b" stroke-width="2"/><rect x="10" y="16" width="25" height="25" rx="5" transform="rotate(-15 22 28)" fill="#b75b43"/><path d="m13 28 21-6m-18 15 21-6" stroke="#e4a17c" stroke-width="3"/><path d="m18 16 7 24" stroke="#745644" stroke-width="4"/></svg>',
  potion:
    '<svg viewBox="0 0 48 48" fill="none"><path d="M19 5h10v13c17 18 11 25-5 25S2 36 19 18Z" fill="#d7e3b5" stroke="#536f45" stroke-width="2"/><path d="M11 28h27q9 13-14 13T11 28" fill="#7b9c55"/><rect x="17" y="4" width="14" height="6" rx="2" fill="#9e7641"/><path d="m26 21-7 10h6l-3 8 10-12h-7Z" fill="#f3e3a0"/></svg>',
};

const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `<main class="page">
  <header class="masthead"><div class="brand"><div class="brand-icon">${svg.gem}</div><div><h1>黄金矿工<span class="sr-only"> · 矿山手记</span></h1><p>THE MINER’S JOURNAL · 矿山手记</p></div></div><div class="edition"><span></span> 三段旅程，一钩好运</div></header>
  <section class="frame" aria-label="黄金矿工游戏"><div class="board">
    <div id="game" aria-label="矿洞游戏区域，按空格或方向下出钩"></div>
    <div class="hud hidden"><div class="hud-left"><div class="hud-card hud-level"><span class="hud-label" id="level-number">第一站 / 03</span><strong id="level-name">晨光矿谷</strong></div><div class="hud-card"><span class="hud-label">我的金库</span><strong class="money" id="money">$0</strong></div><div class="hud-card"><span class="hud-label">本关目标</span><strong class="goal-text" id="goal">$650</strong><div class="progress"><span id="progress"></span></div></div></div><div class="hud-left"><div class="timer" id="timer">${svg.clock}<strong id="seconds">60</strong><span style="font-size:10px">秒</span></div><div class="hud-tools"><button class="icon-btn" data-action="mute" title="切换声音" aria-label="静音" id="mute">♪</button><button class="icon-btn" data-action="pause" title="暂停 P / Esc" aria-label="暂停游戏">Ⅱ</button></div></div></div>
    <div class="play-controls hidden"><div class="status-chip" id="status">看准方向，按空格出钩</div><button class="bomb-btn" data-action="bomb" id="bomb">${svg.bomb}<span>炸药 × <b id="bomb-count">1</b></span><kbd>↑</kbd></button></div>
    <div class="modal-layer" id="modal"></div><div class="toast" id="toast" role="status"></div>
    <div class="loading" id="loading"><div>正在点亮矿灯…<small>装好绞盘，我们就出发</small></div></div>
  </div></section>
  <div class="below"><div class="control-legend"><span><kbd>Space</kbd> / <kbd>↓</kbd> 出钩</span><span><kbd>↑</kbd> 炸掉所抓物品</span><span><kbd>P</kbd> 暂停</span><span>也可点击矿洞出钩</span></div><button data-action="help">玩法手记 ↗</button></div>
  <p class="mobile-hint">横屏游玩，看得更宽，也瞄得更准。</p>
  <footer class="bottom-line"><span>愿每一次出钩，都有满载而归的惊喜。</span><div class="bottom-links"><button class="text-btn" data-action="credits" style="padding:0;font-size:10px">素材鸣谢</button><a href="${import.meta.env.BASE_URL}session/" target="_blank" rel="noopener">AI 协作记录 ↗</a><a href="https://github.com/icecream863/gold-miner-storybook" target="_blank" rel="noopener">工程源码 ↗</a></div></footer>
</main>`;

const model = new MinerModel();
const audio = new GameAudio();
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const modal = $("#modal");
let helpOpen: "help" | "credits" | null = null;
let previousPhase: Phase | null = null;
let scene: MiningScene;
let toastTimer = 0;

function toast(text: string): void {
  $("#toast").textContent = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    $("#toast").textContent = "";
  }, 1900);
}

function showModal(): void {
  if (helpOpen) {
    modal.innerHTML = `<article class="paper"><p class="eyebrow">THE MINER’S JOURNAL</p><h2>${helpOpen === "help" ? "出发前，翻翻手记" : "感谢每一份创造"}</h2>${
      helpOpen === "help"
        ? `
      <ul class="help-list"><li>钩爪会自动摆动，按 <kbd>Space</kbd>、<kbd>↓</kbd> 或点击矿洞出钩；回收时等待下一次机会。</li><li>黄金越大越值钱，也越重。钻石价值高、回收快，但需要瞄准；石头会拖慢节奏。</li><li>抓到不想要的物品时，按 <kbd>↑</kbd> 或点炸药按钮，炸掉它让空钩快速返回。</li><li>每关 60 秒，时间到时金库达到目标即可过关。物品拉回才入账，挂在绳上不算。</li><li>金钱跨关累计，商店购买会扣钱。力量药水只提升下一关的载物回收速度。</li><li>按 <kbd>P</kbd> 暂停。切走页面会自动暂停；失败重试会恢复本关开始时的钱与道具。</li></ul>
      <div class="legend-items"><div class="legend-item"><img src="${asset("art/amber.png")}" alt="黄金"/>黄金 $100–500</div><div class="legend-item"><img src="${asset("art/diamond.png")}" alt="钻石"/>钻石 $650</div><div class="legend-item"><img src="${asset("art/rock.png")}" alt="石头"/>石头 $15</div></div>`
        : `
      <ul class="help-list"><li>场景、山峦、矿物与宝石：Glitch / Tiny Speck，公共领域素材。PNG 转换：ThirdPartyNinjas。</li><li>矿工插画、绞盘、钩爪与界面：本项目原创绘制。声音由程序合成。</li><li>游戏框架：Phaser，MIT 许可。完整来源与许可记录随工程一并提供。</li><li>本作品为学习与招聘测试中的经典玩法复刻，与原作没有关联。</li></ul>`
    }<button class="primary" data-action="close-help">${model.phase === "paused" ? "返回暂停界面" : "合上手记"}</button></article>`;
    return;
  }
  if (model.phase === "playing") {
    modal.innerHTML = "";
    return;
  }
  if (model.phase === "menu") {
    modal.innerHTML = `<article class="paper"><p class="eyebrow">A LITTLE ADVENTURE UNDERGROUND</p><div class="ornament">✦</div><h2>一钩金光，满载而归</h2><p class="lead">戴好矿灯，去山谷深处找找好运。<br/>瞄准、出钩，让沉甸甸的宝藏回到金库。</p><button class="primary start-button" data-action="start">开始寻金 <span aria-hidden="true">→</span></button><div class="keys"><kbd>Space</kbd> / <kbd>↓</kbd> 出钩 <span>·</span><kbd>↑</kbd> 使用炸药 <span>·</span> 点击也能玩</div><div class="menu-facts"><span><strong>03</strong> 座矿洞</span><span><strong>60</strong> 秒 / 关</span><span>黄金 · 钻石 · 好运</span></div><button class="text-btn" data-action="help">第一次来？看看玩法手记</button></article>`;
  } else if (model.phase === "paused") {
    modal.innerHTML = `<article class="paper"><p class="eyebrow">TAKE A LITTLE BREATH</p><div class="ornament">☼</div><h2>矿灯还亮着</h2><p class="lead">先歇一会儿，时间和钩爪都停在这里。<br/>准备好后，再继续这一趟旅程。</p><div class="modal-actions"><button class="secondary" data-action="menu">返回首页</button><button class="primary" data-action="resume">继续寻金 →</button></div><button class="text-btn" data-action="help">翻翻玩法手记</button></article>`;
  } else if (model.phase === "shop") {
    modal.innerHTML = `<article class="paper shop-paper"><p class="eyebrow">A SMALL STOP BEFORE THE NEXT JOURNEY</p><div class="shop-heading"><h2 style="margin:0">山间补给铺</h2><div class="shop-balance">可用金钱<strong>$${model.run.money.toLocaleString()}</strong></div></div><div class="shop-grid"><section class="product"><div class="product-icon">${svg.potion}</div><h3>力量药水</h3><p>下一关载物回收速度提升 50%。<br/>大金块，也能拉得轻松些。</p><button class="buy-btn" data-action="buy-strength" ${model.purchases.strength || model.run.money < 150 ? "disabled" : ""}>${model.purchases.strength ? "已装进行囊 ✓" : "购买 · $150"}</button></section><section class="product"><div class="product-icon">${svg.bomb}</div><h3>一枚炸药</h3><p>炸掉所抓的物品，空钩快速返回。<br/>给不值得的等待，留个退路。</p><button class="buy-btn" data-action="buy-bomb" ${model.purchases.bomb || model.run.money < 100 ? "disabled" : ""}>${model.purchases.bomb ? "已装进行囊 ✓" : "购买 · $100"}</button></section></div><p class="shop-note">购买会扣除金库余额；每件限购一次，也可以直接出发。<br/>下一关：${LEVELS[model.levelIndex + 1].name} · 累计目标 $${LEVELS[model.levelIndex + 1].target.toLocaleString()}</p><div class="modal-actions"><button class="primary" data-action="next">收好行囊，继续出发 →</button></div></article>`;
  } else {
    const won = model.success;
    const complete = model.phase === "complete";
    modal.innerHTML = `<article class="paper"><p class="eyebrow">${complete ? "EVERY JOURNEY HAS ITS TREASURE" : won ? "A GOOD DAY IN THE MINE" : "THE MOUNTAIN WILL WAIT"}</p><div class="ornament">${won ? "✦" : "☾"}</div><h2>${complete ? "满载星光，回家吧" : won ? "这一趟，收获不错" : "差一点，再试一次"}</h2><p class="lead">${complete ? "三段矿山旅程，已全部完成。<br/>那些看准时机的瞬间，都是你的宝藏。" : won ? `${model.level.name}的目标已达成。<br/>到补给铺歇歇脚，再去下一座矿洞。` : `金库还差 $${(model.level.target - model.run.money).toLocaleString()}。<br/>试试优先瞄准钻石，或用炸药甩掉石头。`}</p><div class="result-grid"><div class="result-stat"><span>我的金库</span><strong class="gold">$${model.run.money.toLocaleString()}</strong></div><div class="result-stat"><span>${complete ? "完成旅程" : "本关目标"}</span><strong>${complete ? "03 / 03" : "$" + model.level.target.toLocaleString()}</strong></div></div><div class="modal-actions"><button class="secondary" data-action="menu">返回首页</button><button class="primary" data-action="${complete ? "start" : won ? "shop" : "retry"}">${complete ? "再寻一次金 →" : won ? "去补给铺 →" : "再试一次 →"}</button></div></article>`;
  }
}

function syncHUD(): void {
  const active = ["playing", "paused"].includes(model.phase);
  $(".hud").classList.toggle("hidden", !active);
  $(".play-controls").classList.toggle("hidden", !active);
  $("#money").textContent = `$${model.run.money.toLocaleString()}`;
  $("#goal").textContent = `$${model.level.target.toLocaleString()}`;
  $("#seconds").textContent = String(Math.ceil(model.remaining)).padStart(
    2,
    "0",
  );
  $("#timer").classList.toggle("low", model.remaining <= 10);
  $("#progress").style.width =
    `${Math.min(100, (model.run.money / model.level.target) * 100)}%`;
  $("#level-number").textContent =
    `第 ${String(model.levelIndex + 1).padStart(2, "0")} 站 / 03`;
  $("#level-name").textContent = model.level.name;
  $("#bomb-count").textContent = String(model.run.bombs);
  $<HTMLButtonElement>("#bomb").disabled =
    !model.carried || model.run.bombs === 0 || model.phase !== "playing";
  $("#mute").textContent = audio.muted ? "♫̸" : "♪";
  $("#mute").setAttribute("aria-label", audio.muted ? "开启声音" : "静音");
  const names = {
    small: "小金块",
    medium: "金块",
    large: "大金块",
    rock: "石头",
    diamond: "钻石",
  };
  $("#status").textContent = model.carried
    ? `${names[model.carried.kind]} · $${model.carried.value}  正在回收${model.run.strength ? " · 力量加持" : ""}`
    : model.hook === "swinging"
      ? "看准方向，按空格或点击矿洞出钩"
      : model.hook === "extending"
        ? "钩爪正在寻找宝藏…"
        : "空钩回收中，马上就好";
  if (previousPhase !== model.phase) {
    previousPhase = model.phase;
    showModal();
  }
}

function handleAction(action: string): void {
  audio.unlock();
  if (action === "start") {
    helpOpen = null;
    model.start();
    scene.resetItems();
  }
  if (action === "retry" && model.retry()) scene.resetItems();
  if (action === "next" && model.next()) scene.resetItems();
  if (action === "menu") {
    helpOpen = null;
    model.menu();
  }
  if (action === "pause") model.pause();
  if (action === "resume") model.resume();
  if (action === "shop") model.openShop();
  if (action === "bomb" && !model.useBomb())
    toast(
      model.run.bombs === 0 ? "行囊里没有炸药了" : "抓住物品后才能使用炸药",
    );
  if (action === "mute") audio.toggle();
  if (action === "help" || action === "credits") {
    model.pause();
    helpOpen = action;
    showModal();
  }
  if (action === "close-help") {
    helpOpen = null;
    showModal();
  }
  if (action === "buy-bomb" || action === "buy-strength") {
    if (model.buy(action === "buy-bomb" ? "bomb" : "strength")) {
      audio.play("buy");
      showModal();
    }
  }
  syncHUD();
}

root.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>(
    "[data-action]",
  );
  if (button && !button.disabled) handleAction(button.dataset.action!);
});
window.addEventListener("keydown", (event) => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (
    ["Space", "ArrowDown", "ArrowUp", "KeyP", "Escape"].includes(event.code)
  ) {
    if (
      event.code === "Space" &&
      (event.target as HTMLElement).tagName === "BUTTON"
    )
      return;
    event.preventDefault();
    audio.unlock();
    if (event.code === "Space" || event.code === "ArrowDown") model.launch();
    if (event.code === "ArrowUp") model.useBomb();
    if (event.code === "KeyP" || event.code === "Escape") {
      if (helpOpen) {
        helpOpen = null;
        showModal();
      } else if (model.phase === "playing") model.pause();
      else if (model.phase === "paused") model.resume();
    }
    syncHUD();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    model.pause();
    syncHUD();
  }
});
window.addEventListener("blur", () => {
  model.pause();
  syncHUD();
});

class MiningScene extends Phaser.Scene {
  private itemSprites = new Map<string, Phaser.GameObjects.Image>();
  private rope!: Phaser.GameObjects.Graphics;
  private crank!: Phaser.GameObjects.Graphics;
  private dust!: Phaser.GameObjects.Graphics;
  private miner!: Phaser.GameObjects.Image;
  private renderedLevel = -1;

  constructor() {
    super("Mining");
  }
  preload(): void {
    for (const name of [
      "cave-wall",
      "cave-hill",
      "ground",
      "mountains",
      "ore",
      "rock",
      "diamond",
      "ruby",
      "amber",
    ])
      this.load.image(name, asset(`art/${name}.png`));
    this.load.svg("miner", asset("art/miner-original.svg"), {
      width: 170,
      height: 210,
    });
    this.load.on("loaderror", () => {
      $("#loading").innerHTML =
        '<div>矿灯暂时没点亮<small>有素材加载失败，请刷新页面再试。</small><button class="primary" style="margin-top:18px" onclick="location.reload()">重新加载</button></div>';
    });
  }

  create(): void {
    scene = this;
    this.paintBackground();
    const gold = document.createElement("canvas");
    gold.width = 256;
    gold.height = 256;
    const context = gold.getContext("2d")!;
    context.filter = "sepia(1) saturate(2.9) hue-rotate(350deg)";
    context.drawImage(
      this.textures.get("ore").getSourceImage() as HTMLImageElement,
      0,
      0,
      256,
      256,
    );
    this.textures.addCanvas("gold", gold);
    this.rope = this.add.graphics().setDepth(6);
    this.crank = this.add.graphics().setDepth(9);
    this.dust = this.add.graphics().setDepth(10);
    this.miner = this.add
      .image(509, 184, "miner")
      .setOrigin(0.5, 1)
      .setDisplaySize(97, 120)
      .setDepth(8);
    this.input.on("pointerdown", () => {
      audio.unlock();
      model.launch();
    });
    $("#loading").remove();
    // 首页也展示真实矿洞布局，开始后由模型重新创建，避免首页误扣时间。
    model.items = LEVELS[0].items.map(([kind, x, y], i) => ({
      id: `preview-${i}`,
      kind,
      x,
      y,
      radius:
        kind === "large"
          ? 39
          : kind === "medium"
            ? 27
            : kind === "rock"
              ? 29
              : 18,
      weight: 1,
      value: 0,
      taken: false,
    }));
    this.resetItems();
    syncHUD();
    if (new URLSearchParams(location.search).has("qa")) {
      Object.defineProperty(window, "__goldMiner", {
        get: () => ({
          phase: model.phase,
          level: model.levelIndex,
          money: model.run.money,
          target: model.level.target,
          bombs: model.run.bombs,
          strength: model.run.strength,
          remaining: model.remaining,
          angle: model.angle,
          direction: model.direction,
          hook: model.hook,
          length: model.length,
          tip: { ...model.tip },
          carried: model.carried?.kind ?? null,
          items: model.items.map((i) => ({ ...i })),
        }),
      });
    }
  }

  private paintBackground(): void {
    const texture = this.textures.createCanvas(
      "landscape",
      WORLD.width,
      WORLD.height,
    )!;
    const ctx = texture.context;
    const sky = ctx.createLinearGradient(0, 0, 0, 200);
    sky.addColorStop(0, "#c9dece");
    sky.addColorStop(1, "#e8e5bc");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1120, 220);
    const cave = ctx.createLinearGradient(0, 180, 0, 680);
    cave.addColorStop(0, "#284a43");
    cave.addColorStop(0.42, "#243c37");
    cave.addColorStop(1, "#142f2e");
    ctx.fillStyle = cave;
    ctx.fillRect(0, 184, 1120, 496);
    // 确定性的纹理粒子，重试不会改变布局，也不依赖外部字体或在线纹理。
    let seed = 731;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 2900; i++) {
      const x = random() * 1120,
        y = random() * 680,
        a = random() * 0.1;
      ctx.fillStyle =
        y < 190 ? `rgba(255,255,230,${a})` : `rgba(166,178,125,${a})`;
      ctx.fillRect(x, y, random() * 2 + 0.4, random() * 2 + 0.4);
    }
    texture.refresh();
    this.add.image(0, 0, "landscape").setOrigin(0).setDepth(0);
    this.add
      .image(110, 99, "mountains")
      .setDisplaySize(460, 196)
      .setAlpha(0.48)
      .setDepth(1);
    this.add
      .image(978, 112, "mountains")
      .setDisplaySize(540, 220)
      .setFlipX(true)
      .setAlpha(0.38)
      .setDepth(1);
    for (const [x, y, w, h] of [
      [33, 433, 220, 620],
      [1092, 455, 220, 610],
      [244, 453, 170, 560],
      [882, 470, 180, 570],
    ])
      this.add
        .image(x, y, "cave-wall")
        .setDisplaySize(w, h)
        .setTint(0x969a75)
        .setAlpha(0.15)
        .setDepth(1);
    this.add
      .image(570, 660, "cave-hill")
      .setDisplaySize(1120, 390)
      .setAlpha(0.15)
      .setDepth(1);
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x223c32);
    g.fillRect(0, 176, 1120, 24);
    g.fillStyle(0x56744c);
    g.fillRect(0, 175, 1120, 6);
    g.fillStyle(0x8c9560);
    g.fillRect(0, 175, 1120, 2);
    for (let x = 0; x < 1120; x += 30) {
      g.fillStyle(0x577245, 0.65);
      g.fillTriangle(x, 176, x + 4, 164 - (x % 11), x + 10, 177);
    }
    g.fillStyle(0x9e7947);
    g.fillRoundedRect(456, 175, 156, 12, 3);
    g.lineStyle(2, 0x5e4f32);
    g.strokeRoundedRect(456, 175, 156, 12, 3);
    g.lineStyle(10, 0x6b5535);
    g.beginPath();
    g.moveTo(541, 179);
    g.lineTo(560, 102);
    g.lineTo(591, 179);
    g.strokePath();
    g.lineStyle(4, 0xb49155);
    g.beginPath();
    g.moveTo(539, 179);
    g.lineTo(558, 103);
    g.lineTo(588, 179);
    g.strokePath();
    g.lineStyle(8, 0x665138);
    g.lineBetween(542, 126, 589, 126);
    g.fillStyle(0x584b37);
    g.fillCircle(560, 148, 17);
    g.lineStyle(4, 0xc6aa67);
    g.strokeCircle(560, 148, 15);
    g.lineStyle(3, 0xe5d09c);
    g.strokeCircle(560, 148, 9);
    for (const x of [72, 1044]) {
      g.lineStyle(5, 0x766440);
      g.lineBetween(x, 184, x, 254);
      g.fillStyle(0xd9bb64);
      g.fillRoundedRect(x - 9, 248, 18, 25, 3);
      g.lineStyle(2, 0x695a3c);
      g.strokeRoundedRect(x - 10, 247, 20, 27, 3);
      g.fillStyle(0xffe0a0, 0.1);
      g.fillCircle(x, 260, 43);
      g.fillStyle(0xffdf98, 0.04);
      g.fillCircle(x, 260, 78);
    }
    this.add
      .text(38, 621, "✧  地下的每一点光，都值得等待", {
        fontFamily: "Microsoft YaHei",
        fontSize: "10px",
        color: "#839887",
      })
      .setAlpha(0.5)
      .setDepth(2);
  }

  resetItems(): void {
    for (const sprite of this.itemSprites.values()) sprite.destroy();
    this.itemSprites.clear();
    for (const item of model.items) {
      const key =
        item.kind === "diamond"
          ? "diamond"
          : item.kind === "rock"
            ? "rock"
            : "gold";
      const size = item.radius * 2.5;
      const sprite = this.add
        .image(item.x, item.y, key)
        .setDisplaySize(size, size)
        .setDepth(4);
      if (item.kind === "diamond")
        sprite.setDisplaySize(43, 44).setTint(0xbbf4e9);
      if (item.kind === "rock")
        sprite.setDisplaySize(size * 1.1, size * 0.85).setTint(0xb2b7a2);
      this.itemSprites.set(item.id, sprite);
    }
    this.renderedLevel = model.levelIndex;
  }

  update(time: number, delta: number): void {
    model.update(Math.min(delta / 1000, 0.25));
    for (const event of model.events.splice(0)) this.feedback(event);
    if (this.renderedLevel !== model.levelIndex) this.resetItems();
    for (const item of model.items) {
      const sprite = this.itemSprites.get(item.id);
      if (!sprite) continue;
      const carried = model.carried?.id === item.id;
      sprite.setVisible(!item.taken || carried);
      if (carried) {
        const p = model.tip;
        sprite.setPosition(p.x, p.y + item.radius * 0.65);
        sprite.setRotation(Math.sin(time * 0.004) * 0.04);
      }
    }
    this.miner.setY(
      184 +
        (model.carried && model.phase === "playing"
          ? Math.sin(time * 0.013) * 1.6
          : Math.sin(time * 0.0016) * 0.5),
    );
    this.paintHook(time);
    syncHUD();
  }

  private paintHook(time: number): void {
    const tip = model.tip,
      angle = model.angle;
    const active = model.phase !== "menu";
    const g = this.rope.clear();
    const end = active
      ? tip
      : {
          x: WORLD.pivot.x + Math.sin(Math.sin(time * 0.0007) * 0.65) * 38,
          y: WORLD.pivot.y + 35,
        };
    g.lineStyle(5, 0x142d29, 0.6);
    g.lineBetween(562, 150, end.x + 2, end.y + 2);
    g.lineStyle(3, 0xbfa779);
    g.lineBetween(560, 148, end.x, end.y);
    g.lineStyle(1, 0xead7aa, 0.65);
    g.lineBetween(559, 148, end.x - 1, end.y);
    const a = active ? angle : 0;
    const transform = (x: number, y: number) => ({
      x: end.x + x * Math.cos(a) + y * Math.sin(a),
      y: end.y - x * Math.sin(a) + y * Math.cos(a),
    });
    const open = model.carried ? 6 : 12;
    for (const sign of [-1, 1]) {
      const p1 = transform(sign * 3, -5),
        p2 = transform(sign * open, 6),
        p3 = transform(sign * 5, 15);
      g.lineStyle(6, 0x1b2e2c);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.strokePath();
      g.lineStyle(3, 0xc1c5aa);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.strokePath();
    }
    g.fillStyle(0xd4c49b);
    g.fillCircle(end.x, end.y - 3, 4);
    const crankAngle =
      model.phase === "playing" && model.hook !== "swinging"
        ? time * 0.009
        : 0.5;
    this.crank
      .clear()
      .lineStyle(3, 0xd7bb78)
      .lineBetween(
        575,
        125,
        575 + Math.cos(crankAngle) * 13,
        125 + Math.sin(crankAngle) * 13,
      );
    this.crank
      .fillStyle(0x735a3c)
      .fillCircle(
        575 + Math.cos(crankAngle) * 13,
        125 + Math.sin(crankAngle) * 13,
        4,
      );
    const dust = this.dust.clear();
    for (let i = 0; i < 16; i++) {
      const x = ((i * 137 + Math.sin(time * 0.0003 + i) * 24) % 1080) + 20;
      const y = 235 + ((i * 53) % 340) + Math.sin(time * 0.0004 + i) * 8;
      dust.fillStyle(0xffdea1, 0.05 + (Math.sin(time * 0.001 + i) + 1) * 0.055);
      dust.fillCircle(x, y, i % 3 === 0 ? 1.7 : 1);
    }
    for (const item of model.items)
      if (item.kind === "diamond" && !item.taken) {
        const alpha = 0.2 + (Math.sin(time * 0.003 + item.x) + 1) * 0.2;
        dust.lineStyle(1, 0xd5fff2, alpha);
        dust.lineBetween(item.x + 17, item.y - 14, item.x + 17, item.y - 4);
        dust.lineBetween(item.x + 12, item.y - 9, item.x + 22, item.y - 9);
      }
  }

  private feedback(event: GameEvent): void {
    if (event.type === "end") {
      audio.play(event.success ? "win" : "lose");
      return;
    }
    audio.play(event.type);
    if (event.type === "bank") {
      const text = this.add
        .text(WORLD.pivot.x, 202, `+$${event.item!.value}`, {
          fontFamily: "Georgia",
          fontSize: "25px",
          fontStyle: "bold",
          color: "#ffe3a0",
          stroke: "#294335",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(12);
      this.tweens.add({
        targets: text,
        y: 150,
        alpha: 0,
        duration: 1000,
        onComplete: () => text.destroy(),
      });
    }
    if (event.type === "grab" || event.type === "bomb") {
      const count = event.type === "bomb" ? 17 : 8;
      for (let i = 0; i < count; i++) {
        const sparkle = this.add
          .circle(
            event.x!,
            event.y!,
            (i % 3) + 1.5,
            event.type === "bomb" ? 0xeeb365 : 0xffd77a,
          )
          .setDepth(11);
        const angle = (i * Math.PI * 2) / count;
        this.tweens.add({
          targets: sparkle,
          x: event.x! + Math.cos(angle) * (event.type === "bomb" ? 65 : 27),
          y: event.y! + Math.sin(angle) * 42 + 10,
          alpha: 0,
          duration: 420 + i * 12,
          onComplete: () => sparkle.destroy(),
        });
      }
      if (
        event.type === "bomb" &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        this.cameras.main.shake(100, 0.002);
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: "#23433b",
  render: { antialias: true, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: MiningScene,
  audio: { noAudio: true },
});
