import Phaser from "phaser";
import { MinerModel, LEVELS, WORLD, ITEM_NAMES } from "./core/model.ts";
import type { GameEvent, Phase } from "./core/model.ts";
import { SHOP, PRODUCT_IDS } from "./core/shop.ts";
import type { ProductId } from "./core/shop.ts";
import { ActiveClock } from "./core/clock.ts";
import { GameAudio } from "./audio.ts";
import { EFFECT_LIMIT, progress, pulse, cameraKick, loadLabel, cargoMotion, walkCycle } from "./presentation.ts";
import { SampleAnimator } from "./sample/motion.ts";
import { drawMiner } from "./sample/art.ts";
import { APPROVED_MINER_LAYER, approvedPoint, approvedRig } from "./approved-miner.ts";
import "./style.css";
const asset = (name: string) => `${import.meta.env.BASE_URL}assets/classic/${name}.svg`;
const model = new MinerModel(), audio = new GameAudio(`${import.meta.env.BASE_URL}assets/audio/`), clock = new ActiveClock(), visualClock = new ActiveClock();
let activeSeconds = 0, visualSeconds = 0, pageFocused = true, scene: MiningScene | undefined, lastPhase: Phase | null = null, help: "help" | "credits" | "settings" | null = null;
const icon = (name: string) => `<img class="control-icon" src="${asset(`icon-${name}`)}" alt=""/>`;
const root = document.querySelector<HTMLDivElement>("#app")!;
root.innerHTML = `<main class="page"><header class="masthead"><h1>黄金矿工 <span>经典六关版</span></h1><nav><button data-action="settings" aria-label="声音设置">${icon("settings")}</button><button data-action="help">玩法说明</button></nav></header>
<section class="game-shell" aria-label="黄金矿工游戏"><div class="board"><div id="game" tabindex="-1" aria-label="矿洞游戏区域，按空格或方向下出钩"></div>
<div class="hud hidden"><div class="hud-left"><div>金钱 <strong id="money">$0</strong></div><div>目标 <strong id="goal">$650</strong></div></div><div class="hud-right"><div>时间 <strong id="seconds">60</strong></div><div>关卡 <strong id="level-number">1 / 6</strong></div></div></div>
<div class="loading" id="loading"><strong>正在装好卷扬机…</strong><small>资源随工程提供，不需连接素材网站</small></div></div></section>
<div class="play-controls hidden"><p id="status" role="status">看准方向，按空格或点击矿洞出钩</p><div class="actions"><button data-action="bomb" id="bomb" title="销毁所抓物品，不获得金钱"><img src="${asset("shop-bomb")}" alt="炸药"/> <span id="bomb-count">0</span> <kbd>↑</kbd></button><button data-action="finish" id="finish" title="提前结算；未达到目标会失败，所抓物品不补钱">结束本关</button><button data-action="mute" id="mute" aria-label="静音"><img id="mute-image" class="control-icon" src="${asset("icon-volume")}" alt=""/></button><button data-action="settings" aria-label="声音设置">${icon("settings")}</button><button data-action="pause" aria-label="暂停游戏">${icon("pause")}</button></div></div>
<p class="upgrade-summary hidden" id="upgrades"></p><div class="below"><span><kbd>Space</kbd> / <kbd>↓</kbd> 出钩 · <kbd>↑</kbd> 炸药 · <kbd>P</kbd> / <kbd>Esc</kbd> 暂停</span><span class="mobile-hint">手机推荐横屏</span></div>
<footer><button data-action="credits">素材与许可</button><a href="${import.meta.env.BASE_URL}session/" target="_blank" rel="noopener">AI 协作记录</a><a href="https://github.com/icecream863/gold-miner-storybook" target="_blank" rel="noopener">工程源码</a><span>经典玩法的六关适配，非原版精确移植</span></footer>
<div id="modal" class="modal-layer"></div><div id="toast" role="status"></div></main>`;
const nodes = new Map<string, HTMLElement>();
function $(id: string): HTMLElement { let node = nodes.get(id); if (!node) {
    node = document.getElementById(id)!;
    nodes.set(id, node);
} return node; }
function text(id: string, value: string) { const n = $(id); if (n.textContent !== value)
    n.textContent = value; }
const money = (value: number) => `$${value.toLocaleString("en-US")}`;
let toastHandle = 0, toastMessage = "";
function renderToast() { const inline = document.querySelector(".shop-feedback"); if (inline) inline.textContent = toastMessage || "量力购买，消费会增加下一关的目标差额。"; text("toast", model.phase === "shop" ? "" : toastMessage); }
function clearToast() { clearTimeout(toastHandle); toastMessage = ""; renderToast(); }
function toast(message: string) { toastMessage = message; renderToast(); clearTimeout(toastHandle); toastHandle = window.setTimeout(clearToast, 2200); }
function advance() { const elapsed = clock.sample(performance.now(), model.phase === "playing"); activeSeconds += Math.min(elapsed, model.remaining); model.update(elapsed); }
function showModal() {
    const modal = $("modal");
    modal.classList.toggle("open", help !== null || model.phase !== "playing");
    if (help === "settings") {
        const a = audio.snapshot;
        modal.innerHTML = `<article class="paper settings-paper"><p class="eyebrow">SOUND & MUSIC</p><h2>矿洞的声音</h2><p>音乐与音效分别调整，偏好保存在这台设备。</p><label class="sound-toggle"><input type="checkbox" data-audio="musicEnabled" ${a.settings.musicEnabled ? "checked" : ""}/>背景音乐</label><label class="sound-range">音乐音量 <output id="music-volume">${Math.round(a.settings.musicVolume * 100)}%</output><input aria-label="音乐音量" data-audio="musicVolume" type="range" min="0" max="100" value="${a.settings.musicVolume * 100}"/></label><label class="sound-toggle"><input type="checkbox" data-audio="effectsEnabled" ${a.settings.effectsEnabled ? "checked" : ""}/>游戏音效</label><label class="sound-range">音效音量 <output id="effects-volume">${Math.round(a.settings.effectsVolume * 100)}%</output><input aria-label="音效音量" data-audio="effectsVolume" type="range" min="0" max="100" value="${a.settings.effectsVolume * 100}"/></label><p id="music-state" role="status"></p><button data-action="retry-music">重新加载音乐</button><p class="fine">Spaghetti Western · Spring Spring / Julie Damsgaard · CC0<br>音效与部分界面素材：Kenney · CC0</p><button class="primary" data-action="close-help">返回${model.phase === "paused" ? "暂停界面" : "游戏"}</button></article>`;
        return;
    }
    if (help) {
        modal.innerHTML = `<article class="paper"><p class="eyebrow">GOLD MINER · CLASSIC</p><h2>${help === "help" ? "出钩之前" : "素材与许可"}</h2>${help === "help" ? `<ul><li>看准摆动方向，按空格、↓ 或点击矿洞出钩。一次只抓一件，拉回地面才入账。</li><li>大金块更重，钻石又轻又值钱；问号袋回收后才揭晓金额。</li><li>鼹鼠会移动，携钻鼹鼠有钻石价值。骨头和石头容易浪费时间。</li><li>碰到 TNT 会引爆附近 110 像素内的物品，并引爆相邻 TNT。被炸掉的东西没有收益。</li><li>↑ 或炸药按钮销毁所抓物品。炸药从商店购买，余量跨关保留。</li><li>每关 60 秒，累计金钱达到目标即可通关。可提前结束本关；未达标会失败，挂在钩上的物品不补钱。</li><li>五件商品每店各限一次，报价进入商店时固定。四种强化只在下一关生效，可以组合。</li><li>P / Esc 暂停；切走页面自动暂停。失败整局重开，六关后最终结算。</li></ul>` : `<ul><li>经典版矿物、袋子、动物、TNT：本项目原创 SVG，MIT 许可。</li><li>矿工与卷扬机采用已确认的原创矢量动作；其余矿物、动物和界面沿用六关版。</li><li>音乐 Spaghetti Western：Julie Damsgaard / Spring Spring，CC0；音效与 Adventure UI：Kenney，CC0。项目原创角色与矿物为 MIT 许可。</li><li>旧版 Glitch / Tiny Speck 公共领域素材及来源记录保留在工程中，经典场景不加载这些旧图片。</li><li>以可访问的经典 Gold Miner 为行为和构图参考，数值为六关重新适配；没有复制原版商业图片。</li></ul>`}<button class="primary" data-action="close-help">返回${model.phase === "paused" ? "暂停界面" : "游戏"}</button></article>`;
        return;
    }
    if (model.phase === "playing") {
        modal.innerHTML = "";
        return;
    }
    if (model.phase === "menu") {
        modal.innerHTML = `<article class="paper menu-paper"><p class="eyebrow">GOLD MINER · CLASSIC</p><h2>黄金矿工</h2><div class="menu-gold" aria-hidden="true"><img src="${asset("gold")}" alt=""/></div><p class="lead">看准时机，放下钩爪。<br>六层金矿，金钱累计，满载而归。</p><button class="primary" data-action="start">开始挖矿 →</button><p class="keys">Space / ↓ 出钩 · ↑ 使用炸药 · P 暂停</p><button data-action="help">第一次玩？查看规则</button><p class="fine">六关适配 · 原创美术 · 无需账号</p></article>`;
        return;
    }
    if (model.phase === "paused") {
        modal.innerHTML = `<article class="paper"><p class="eyebrow">PAUSED</p><h2>休息一下</h2><p>时间、钩爪和动物都停在这里。</p><div class="modal-actions"><button data-action="menu">返回首页</button><button class="primary" data-action="resume">继续挖矿 →</button></div></article>`;
        return;
    }
    if (model.phase === "shop") {
        const scroll = modal.querySelector<HTMLElement>(".shop-paper")?.scrollTop ?? 0;
        const target = LEVELS[model.levelIndex + 1];
        modal.innerHTML = `<article class="paper shop-paper"><p class="eyebrow">THE MINER’S SHOP</p><div class="shop-header"><h2>矿工补给铺</h2><strong>钱包 ${money(model.run.money)}</strong></div><p class="shop-feedback" role="status">${toastMessage || "量力购买，消费会增加下一关的目标差额。"}</p><p>准备进入第 ${model.levelIndex + 2} 关：${target.name}。每店每种限购一次，强化只在下一关生效。</p><div class="shop-grid">${PRODUCT_IDS.map(id => {
            const spec = SHOP[id], offer = model.offers[id]!, block = model.purchaseBlock(id), bought = model.purchases[id];
            return `<section class="shop-card ${bought ? "bought" : ""}"><span class="shop-icon" aria-hidden="true"><img src="${asset(`shop-${id}`)}" alt=""/></span><h3>${spec.name}</h3><strong class="price">${money(offer.price)}</strong><p>${spec.description}</p><small>${spec.kind === "level" ? "关卡强化 · 下一关有效" : "主动消耗 · 库存跨关保留"}</small><button data-action="buy-${id}" ${block ? "disabled" : ""}>${bought ? "已购买 ✓" : block ?? `购买 · ${money(offer.price)}`}</button></section>`;
        }).join("")}</div><p class="shop-goal">下一关累计目标 <b>${money(target.target)}</b>，按当前余额还需赚取 <b>${money(Math.max(0, target.target - model.run.money))}</b>。消费会增加缺口。</p><button class="primary" data-action="next">收好行囊，进入第 ${model.levelIndex + 2} 关 →</button></article>`;
        modal.querySelector<HTMLElement>(".shop-paper")!.scrollTop = scroll;
        return;
    }
    const complete = model.phase === "complete";
    modal.innerHTML = `<article class="paper result-paper"><p class="eyebrow">${complete ? "SIX ROUNDS COMPLETE" : model.success ? "LEVEL CLEAR" : "GAME OVER"}</p><h2>${complete ? "六关完成，满载而归！" : model.success ? "达成目标！" : "这趟没挖够"}</h2><p>${complete ? "你完成了全部六关经典矿山挑战。" : model.success ? `第 ${model.levelIndex + 1} 关 ${model.level.name} 已完成。` : `累计金钱还差 ${money(Math.max(0, model.level.target - model.run.money))}。失败后需要整局重开。`}</p><div class="result-values"><div>最终金钱<strong>${money(model.run.money)}</strong></div><div>本关累计目标<strong>${money(model.level.target)}</strong></div></div><p class="fine">本关实际采集 ${money(model.earned)} · 所有收益均已回收到地面</p><div class="modal-actions"><button data-action="menu">返回首页</button><button class="primary" data-action="${model.success && !complete ? "shop" : "start"}">${model.success && !complete ? "去补给铺 →" : "重新开始整局 →"}</button></div></article>`;
}
let lastUpgradeText = "";
function sync() {
    if (root.dataset.phase !== model.phase) root.dataset.phase = model.phase;
    const active = model.phase === "playing" || model.phase === "paused";
    document.querySelector(".hud")!.classList.toggle("hidden", !active);
    document.querySelector(".play-controls")!.classList.toggle("hidden", !active);
    text("money", money(model.run.money));
    text("goal", money(model.level.target));
    text("seconds", String(Math.ceil(model.remaining)));
    $("seconds").classList.toggle("urgent", model.remaining <= 10);
    text("level-number", `${model.levelIndex + 1} / ${LEVELS.length}`);
    text("bomb-count", String(model.run.bombs));
    ($("bomb") as HTMLButtonElement).disabled = model.phase !== "playing" || !model.carried || model.run.bombs <= 0;
    const muteSrc = asset(audio.muted ? "icon-mute" : "icon-volume"); if ($("mute-image").getAttribute("src") !== muteSrc) $("mute-image").setAttribute("src", muteSrc);
    const muteLabel = audio.muted ? "取消静音" : "静音";
    if ($("mute").getAttribute("aria-label") !== muteLabel) $("mute").setAttribute("aria-label", muteLabel);
    let status = "看准方向，按空格或点击矿洞出钩";
    if (model.carried) {
        const item = model.carried;
        status = `${ITEM_NAMES[item.kind]} · ${item.kind === "bag" ? "金额待揭晓" : money(item.value)} · ${loadLabel(item.weight)}物 · 约 ${Math.max(0, (model.length - WORLD.rest) / model.returnSpeed).toFixed(1)} 秒回收`;
    }
    else if (model.hook === "extending")
        status = "钩爪正在寻找黄金…";
    else if (model.hook === "returning")
        status = "空钩返回中…";
    else if (model.run.money >= model.level.target)
        status = "目标已达成，可继续采集或结束本关结算。";
    text("status", status);
    text("finish", model.run.money >= model.level.target ? "达标结算 →" : "结束本关");
    const upgraded = PRODUCT_IDS.filter(id => SHOP[id].kind === "level" && model.run[(SHOP[id] as {
        upgrade: keyof typeof model.run;
    }).upgrade]).map(id => SHOP[id].name).join(" · ");
    if (upgraded !== lastUpgradeText) {
        text("upgrades", upgraded ? `本关强化：${upgraded}` : "");
        lastUpgradeText = upgraded;
    }
    $("upgrades").classList.toggle("hidden", !active || !upgraded);
    audio.setEnvironment(model.phase, !!help || document.hidden || !pageFocused);
    const statusNode = document.getElementById("music-state"); if (statusNode) statusNode.textContent = audio.snapshot.music.error ? "音乐加载失败，游戏仍可继续。请重试。" : audio.snapshot.music.state === "loading" ? "正在加载音乐…" : audio.muted ? "总静音已开启，可通过工具栏音量按钮恢复。" : "设置界面暂停声音，关闭并继续游戏后生效。";
    if (model.phase !== lastPhase) {
        if (model.phase === "paused")
            audio.silence();
        lastPhase = model.phase;
        showModal();
    }
}
function action(id: string) {
    if (!scene?.ready && id !== "reload")
        return;
    advance();
    if (!document.hidden) pageFocused = true;
    audio.unlock();
    if (id === "start") {
        model.start();
        activeSeconds = visualSeconds = 0;
        clearToast();
        scene?.resetLevel();
        help = null;
    }
    else if (id === "menu") {
        model.menu();
        activeSeconds = 0;
        scene?.resetLevel();
        help = null;
    }
    else if (id === "launch")
        model.launch();
    else if (id === "bomb")
        model.useBomb();
    else if (id === "finish")
        model.finish();
    else if (id === "pause")
        model.pause();
    else if (id === "resume")
        model.resume();
    else if (id === "mute")
        audio.toggle();
    else if (id === "shop")
        model.openShop();
    else if (id === "retry-music") audio.retryMusic();
    else if (id === "next") {
        clearToast();
        if (model.next())
            scene?.resetLevel();
    }
    else if (id.startsWith("buy-")) {
        const product = id.slice(4) as ProductId;
        if (model.buy(product)) {
            audio.play("buy");
            toast(`${SHOP[product].name}已购买${SHOP[product].kind === "level" ? "，下一关生效" : "，已补充库存"}`);
            showModal();
            renderToast();
        }
        else
            toast(model.purchaseBlock(product) ?? "购买失败");
    }
    else if (id === "help" || id === "credits" || id === "settings") {
        model.pause();
        audio.silence();
        help = id;
        showModal();
    }
    else if (id === "close-help") {
        help = null;
        showModal();
    }
    else if (id === "reload")
        location.reload();
    clock.sample(performance.now(), false);
    visualClock.sample(performance.now(), false);
    scene?.flushPresentation();
    sync();
}
document.addEventListener("click", event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]"); if (button && !button.disabled) {
    button.blur();
    action(button.dataset.action!);
} });
document.addEventListener("keydown", event => {
    if (event.repeat)
        return;
    if ((event.code === "Space" || event.code === "ArrowDown") && model.phase === "playing") {
        event.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        action("launch");
    }
    else if (event.code === "ArrowUp" && model.phase === "playing") {
        event.preventDefault();
        action("bomb");
    }
    else if (event.code === "KeyP" || event.code === "Escape") {
        event.preventDefault();
        if (help) {
            help = null;
            showModal();
        }
        else if (model.phase === "playing")
            action("pause");
        else if (model.phase === "paused")
            action("resume");
    }
});
function loseFocus() { pageFocused = false; audio.setEnvironment(model.phase, true); if (model.phase === "playing")
    action("pause"); }
document.addEventListener("visibilitychange", () => { if (document.hidden)
    loseFocus(); });
window.addEventListener("blur", loseFocus);
window.addEventListener("focus", () => { pageFocused = true; audio.setEnvironment(model.phase, !!help || document.hidden); });
document.addEventListener("input", event => { const input = event.target as HTMLInputElement; const key = input.dataset.audio; if (!key) return; audio.unlock(); audio.configure({ [key]: input.type === "checkbox" ? input.checked : Number(input.value) / 100 }); const output = document.getElementById(key === "musicVolume" ? "music-volume" : "effects-volume"); if (input.type === "range" && output) output.textContent = `${input.value}%`; });
type EffectNode = Phaser.GameObjects.Text | Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
interface Effect {
    node: EffectNode;
    start: number;
    duration: number;
    from: {
        x: number;
        y: number;
    };
    to: {
        x: number;
        y: number;
    };
    scale: number;
    size?: { width: number; height: number };
    kind: "score" | "ring" | "spark" | "cargo";
}
class MiningScene extends Phaser.Scene {
    ready = false;
    private failed = false;
    private itemSprites = new Map<string, Phaser.GameObjects.Image>();
    private rope!: Phaser.GameObjects.Graphics;
    private animalLegs!: Phaser.GameObjects.Graphics;
    private glints!: Phaser.GameObjects.Graphics;
    private backdrop!: Phaser.GameObjects.Graphics;
    private minerTexture!: Phaser.Textures.CanvasTexture;
    private walks = new Map<string, { x: number; distance: number }>();
    private animator = new SampleAnimator();
    private rig = this.animator.sample(0, WORLD.rest, 'swinging', 0);
    private effects: Effect[] = [];
    private renderedLevel = -1;
    private captureAt = -Infinity;
    private scoreAt = -Infinity;
    private shakeAt = -Infinity;
    private reelSound = -Infinity;
    private reduced = matchMedia("(prefers-reduced-motion: reduce)");
    private paintedAt = -Infinity;
    private paintedLength = -Infinity;
    constructor() { super("ClassicMining"); }
    preload() {
        for (const name of ["gold", "rock", "diamond", "bag", "bone", "skull", "mole", "diamondMole", "tnt"])
            this.load.svg(name, asset(name), { width:128, height:128 });
        this.load.on("loaderror", () => { this.failed = true; $("loading").innerHTML = '<strong>矿灯没点亮：资源加载失败</strong><button class="primary" data-action="reload">重新加载</button>'; });
    }
    create() {
        scene = this;
        if (this.failed) {
            this.scene.pause();
            return;
        }
        this.background();
        this.rope = this.add.graphics().setDepth(6);
        this.animalLegs = this.add.graphics().setDepth(3);
        this.glints = this.add.graphics().setDepth(5);
        const layer=APPROVED_MINER_LAYER,origin=approvedPoint({x:layer.sourceX,y:layer.sourceY});
        this.minerTexture=this.textures.createCanvas('approved-miner',layer.width,layer.height)!;
        this.add.image(origin.x,origin.y,'approved-miner').setOrigin(0,0)
            .setDisplaySize(layer.width*layer.scale,layer.height*layer.scale).setDepth(8);
        this.input.on("pointerdown", () => action("launch"));
        $("loading").remove();
        model.menu();
        clock.sample(performance.now(), false);
        this.ready = true;
        this.resetLevel();
        sync();
        if (new URLSearchParams(location.search).has("qa"))
            Object.defineProperty(window, "__goldMiner", { get: () => structuredClone({
                    phase: model.phase, level: model.levelIndex, levelName: model.level.name, money: model.run.money, target: model.level.target, earned: model.earned,
                    remaining: model.remaining, angle: model.angle, direction: model.direction, hook: model.hook, length: model.length, tip: model.tip, world: WORLD,
                    bombs: model.run.bombs, strength: model.run.strength, rockBook: model.run.rockBook, lucky: model.run.lucky, diamondPolish: model.run.diamondPolish,
                    offers: model.offers, purchases: model.purchases, items: model.items, carried: model.carried, runSeed: model.runSeed, rig: approvedRig(this.rig), reelAngle: this.rig.angle, minerAnimation:this.rig, minerRenderer:'approved-vector',
                    cargo: model.carried ? { id: model.carried.itemId, x: this.itemSprites.get(model.carried.itemId)?.x, y: this.itemSprites.get(model.carried.itemId)?.y } : null,
                    visualTime: visualSeconds, audio: audio.snapshot, theme: model.levelIndex, effects: this.effects.map(e => ({ kind: e.kind, x: e.node.x, y: e.node.y, alpha: e.node.alpha })),
                    camera: { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY }, displayObjects: this.children.length,
                }) });
    }
    private background() {
        const g = this.backdrop ??= this.add.graphics().setDepth(0); g.clear();
        const palettes = [
            [0xdba65f,0xca9453,0xb77f43,0xa66e39], [0xd1a771,0xb89669,0xa07e58,0x8b6a48],
            [0xcb9e69,0xb88958,0xa77a4f,0x926b47], [0xc89563,0xb28258,0x996b4b,0x855c43],
            [0xc7a06c,0xb18c5e,0x99774f,0x846445], [0xd3ac68,0xbb985c,0xa5834f,0x927144],
        ];
        const colors = palettes[model.levelIndex];
        g.fillStyle(0xf2d390).fillRect(0, 0, WORLD.width, 150);
        g.fillStyle(0xffe7ac, .6).fillRect(0, 0, WORLD.width, 10);
        g.fillStyle(0xb28349).fillRect(0, 134, WORLD.width, 18);
        g.lineStyle(4, 0x705032).lineBetween(0, 151, WORLD.width, 151);
        for (let band = 0; band < 4; band++) {
            g.fillStyle(colors[band]);
            g.beginPath();
            g.moveTo(0, 152 + band * 162);
            for (let x = 0; x <= WORLD.width; x += 25)
                g.lineTo(x, 152 + band * 162 + (band ? Math.sin(x * .011 + band) * 20 : 0));
            g.lineTo(WORLD.width, WORLD.height);
            g.lineTo(0, WORLD.height);
            g.closePath();
            g.fillPath();
            if (band) {
                g.lineStyle(2, 0xf2d3a0, .55);
                g.beginPath();
                for (let x = 0; x <= WORLD.width; x += 25) {
                    const y = 152 + band * 162 + Math.sin(x * .011 + band) * 20;
                    if (x === 0)
                        g.moveTo(x, y);
                    else
                        g.lineTo(x, y);
                }
                g.strokePath();
            }
        }
        // 角色和机械都集中在 HUD 两侧之间；地表是脚底固定参照。
        // 装饰沿边缘布置，不进入矿物的可抓取区域。
        for (let n = 0; n < 18; n++) {
            const y = 177 + n * 33, x = n % 2 ? 1085 : 12;
            g.lineStyle(2, 0x684b34, .22).lineBetween(x - 9, y, x + 8, y + 14);
        }
        g.fillStyle(0x5c4d37).beginPath().moveTo(450, 150).arc(575, 150, 120, Math.PI, Math.PI * 2, false).closePath().fillPath();
        g.lineStyle(10, 0x9f7643).beginPath().arc(575, 150, 122, Math.PI, Math.PI * 2, false).strokePath();
        for (const x of [470, 680]) { g.fillStyle(0xb28a51).fillRect(x, 72, 9, 75); g.fillStyle(0x524533).fillCircle(x + 4, 87, 3); }
        g.lineStyle(3, 0xc6ab72, .4).lineBetween(493, 63, 655, 63);
        g.fillStyle(0xb17535).fillRect(475, 145, 230, 7);
    }
    private clearEffects() { for (const effect of this.effects)
        effect.node.destroy(); this.effects = []; this.captureAt = this.scoreAt = this.shakeAt = this.reelSound = -Infinity; this.cameras.main.setScroll(0, 0); audio.silence(); }
    resetLevel() {
        if (!this.ready)
            return;
        this.clearEffects();
        this.background(); this.walks.clear();
        this.animator.reset(model.length);
        this.rig=this.animator.sample(visualSeconds,model.length,model.hook,0,this.reduced.matches);
        this.paintedAt=this.paintedLength=-Infinity;
        this.paintRig();
        for (const sprite of this.itemSprites.values())
            sprite.destroy();
        this.itemSprites.clear();
        for (const item of model.items) {
            const key = ["small", "medium", "large"].includes(item.kind) ? "gold" : item.kind;
            const sprite = this.add.image(item.x, item.y, key).setDisplaySize(item.radius * 2.2, item.radius * 2.2).setDepth(4);
            if (item.patrol)
                sprite.setDisplaySize(62, 48);
            this.itemSprites.set(item.id, sprite);
        }
        this.renderedLevel = model.levelIndex;
    }
    private effect(node: EffectNode, to: {
        x: number;
        y: number;
    }, duration: number, scale: number, kind: Effect["kind"]) {
        if (this.effects.length >= EFFECT_LIMIT)
            this.effects.shift()!.node.destroy();
        this.effects.push({ node, start: visualSeconds, duration, from: { x: node.x, y: node.y }, to, scale, kind,
            size: node instanceof Phaser.GameObjects.Image ? { width: node.displayWidth, height: node.displayHeight } : undefined });
    }
    private feedback(event: GameEvent) {
        if (event.type === "end") {
            this.clearEffects();
            audio.play(event.success ? model.phase === "complete" ? "complete" : "win" : "lose");
            return;
        }
        if (event.type === "launch") {
            this.animator.notify("launch", visualSeconds);
            audio.play("launch");
            return;
        }
        if (event.type === "explosion") {
            audio.play("bomb");
            this.shakeAt = visualSeconds;
            for (const c of event.centers) {
                const ring = this.add.circle(c.x, c.y, 18, 0xffd042, .25).setStrokeStyle(3, 0xfff3ae).setDepth(11);
                this.effect(ring, c, .4, 6, "ring");
            }
            return;
        }
        if (event.type === "grab") {
            if (model.carried?.itemId !== event.item.itemId)
                return;
            this.captureAt = visualSeconds;
            audio.play(event.item.weight > 5 ? "heavy" : "grab");
            const ring = this.add.circle(event.x, event.y, 12, 0xffed85, .22).setStrokeStyle(2, 0xffe552).setDepth(11);
            this.effect(ring, { x: event.x, y: event.y }, .25, 2, "ring");
            return;
        }
        if (event.type === "bomb") {
            audio.play("bomb");
            this.shakeAt = visualSeconds;
            const ring = this.add.circle(event.x, event.y, 18, 0xffa52e, .5).setDepth(11);
            this.effect(ring, { x: event.x, y: event.y }, .35, 3, "ring");
            return;
        }
        this.scoreAt = visualSeconds;
        this.animator.notify("bank", visualSeconds);
        audio.play(event.item.kind === "bag" ? "bag" : "bank");
        const texture = ["small", "medium", "large"].includes(event.item.kind) ? "gold" : event.item.kind;
        const original = this.itemSprites.get(event.item.itemId);
        if (original && !this.reduced.matches) {
            const deposited = this.add.image(event.x + event.item.offset.x, event.y + event.item.offset.y, texture).setDisplaySize(original.displayWidth, original.displayHeight).setDepth(5);
            this.effect(deposited, { x: WORLD.pivot.x + 30, y: 146 }, .28, .2, "cargo");
        }
        const score = this.add.text(WORLD.pivot.x, 180, `+${money(event.item.value)}${event.item.kind === "bag" ? "  问号袋揭晓！" : ""}`, { fontFamily: "Microsoft YaHei", fontSize: "26px", fontStyle: "bold", color: "#fff14c", stroke: "#70441e", strokeThickness: 4 }).setOrigin(.5).setDepth(12);
        this.effect(score, { x: WORLD.pivot.x, y: 145 }, .85, 1.05, "score");
        if (!this.reduced.matches)
            for (let i = 0; i < 3; i++) {
                const coin = this.add.circle(WORLD.pivot.x, 170, 4, 0xffdc25).setStrokeStyle(1, 0x9c6a22).setDepth(11);
                this.effect(coin, { x: WORLD.pivot.x + (i - 1) * 25, y: 135 - i % 2 * 13 }, .5, .4, "spark");
            }
    }
    update() {
        if (!this.ready)
            return;
        visualSeconds += visualClock.sample(performance.now(), model.phase !== "paused" && !help && !document.hidden && pageFocused);
        advance();
        this.flushPresentation();
    }
    // 输入会先推进规则时间；同一入口同步整帧表现，暂停时不留下一帧旧姿势。
    flushPresentation() {
        if (!this.ready) return;
        if (this.renderedLevel !== model.levelIndex)
            this.resetLevel();
        if (this.paintedAt === visualSeconds && this.paintedLength === model.length && model.events.length === 0) { sync(); return; }
        this.paintedAt = visualSeconds; this.paintedLength = model.length;
        for (const event of model.events.splice(0))
            this.feedback(event);
        this.rig = this.animator.sample(visualSeconds, model.length, model.hook, model.carried?.weight ?? 0, this.reduced.matches);
        this.animalLegs.clear(); this.glints.clear();
        for (const item of model.items) {
            const sprite = this.itemSprites.get(item.id)!;
            const carried = model.carried?.itemId === item.id;
            sprite.setVisible(!item.taken || carried);
            if (carried) {
                const offset = model.carried!.offset;
                const motion = cargoMotion(visualSeconds, this.captureAt, item.weight, this.reduced.matches);
                sprite.setPosition(model.tip.x + offset.x, model.tip.y + offset.y).setRotation(motion.rotation);
                sprite.setDisplaySize((item.patrol ? 62 : item.radius * 2.2) * motion.scale, (item.patrol ? 48 : item.radius * 2.2) * motion.scale);
            }
            else {
                sprite.setDisplaySize(item.patrol ? 62 : item.radius * 2.2, item.patrol ? 48 : item.radius * 2.2);
                sprite.setPosition(item.x, item.y).setRotation(0);
                if (item.patrol)
                    sprite.setFlipX(item.patrol.direction < 0);
            }
            if (item.patrol && (!item.taken || carried)) {
                const walk = this.walks.get(item.id) ?? { x: item.x, distance: 0 };
                if (!carried) walk.distance += Math.abs(item.x - walk.x);
                walk.x = item.x; this.walks.set(item.id, walk);
                const gait = walkCycle(walk.distance, carried, this.reduced.matches);
                const legs = this.animalLegs.lineStyle(5, 0x65452e);
                for (const sign of [-1, 1]) legs.lineBetween(sprite.x + sign * 13, sprite.y + 6, sprite.x + sign * 15 + sign * gait * 4, sprite.y + 19);
            }
            if ((item.kind === "diamond" || item.kind === "diamondMole") && !item.taken && !this.reduced.matches) {
                const glint = Math.max(0, Math.sin(visualSeconds * 1.7 + item.x));
                this.glints.lineStyle(2, 0xf0ffff, glint * .8).lineBetween(item.x - 5, item.y - 4, item.x + 3, item.y - 4).lineBetween(item.x - 1, item.y - 8, item.x - 1, item.y);
            }
        }
        this.paintHook();
        this.paintRig();
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const e = this.effects[i], t = progress(visualSeconds, e.start, e.duration);
            if (t >= 1) {
                e.node.destroy();
                this.effects.splice(i, 1);
                continue;
            }
            const ease = 1 - (1 - t) ** 3;
            e.node.setPosition(e.from.x + (e.to.x - e.from.x) * ease, e.from.y + (e.to.y - e.from.y) * ease);
            // Image 的原始缩放包含世界尺寸，不能像文字一样重置为 1。
            if (e.size && e.node instanceof Phaser.GameObjects.Image) e.node.setDisplaySize(e.size.width * (1 + (e.scale - 1) * ease), e.size.height * (1 + (e.scale - 1) * ease));
            else e.node.setScale(1 + (e.scale - 1) * ease);
            e.node.setAlpha(1 - t);
        }
        const kick = cameraKick(visualSeconds, this.shakeAt, this.reduced.matches);
        this.cameras.main.setScroll(kick.x, kick.y);
        $("money").style.transform = this.reduced.matches ? "" : `scale(${1 + pulse(visualSeconds, this.scoreAt, .28) * .07})`;
        if (model.phase === "playing" && model.hook === "returning" && visualSeconds - this.reelSound > (model.carried && model.carried.weight > 5 ? .28 : .16)) {
            audio.play("reel", model.carried?.weight ?? 0);
            this.reelSound = visualSeconds;
        }
        sync();
    }
    private paintRig() {
        const layer=APPROVED_MINER_LAYER,context=this.minerTexture.context;
        context.clearRect(0,0,layer.width,layer.height);
        context.save();context.translate(-layer.sourceX,-layer.sourceY);
        drawMiner(context,this.rig);context.restore();
        this.minerTexture.refresh();
    }
    private paintHook() {
        const g = this.rope.clear(), tip = model.tip, a = model.angle;
        g.lineStyle(3, 0x584830).lineBetween(WORLD.pivot.x, WORLD.pivot.y, tip.x, tip.y);
        const transform = (x: number, y: number) => ({ x: tip.x + x * Math.cos(a) + y * Math.sin(a), y: tip.y - x * Math.sin(a) + y * Math.cos(a) });
        const open = model.carried ? 12 - 6 * progress(visualSeconds, this.captureAt, .12) : 12;
        for (const sign of [-1, 1]) {
            const p = transform(sign * 3, -5), q = transform(sign * open, 7), r = transform(sign * 5, 17);
            g.lineStyle(7, 0x4b473c).beginPath().moveTo(p.x, p.y).lineTo(q.x, q.y).lineTo(r.x, r.y).strokePath();
            g.lineStyle(3, 0xc6c6b9).beginPath().moveTo(p.x, p.y).lineTo(q.x, q.y).lineTo(r.x, r.y).strokePath();
        }
    }
}
new Phaser.Game({ type: Phaser.AUTO, parent: "game", width: WORLD.width, height: WORLD.height, backgroundColor: "#d69b4f", render: { antialias: true, roundPixels: false }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: MiningScene, audio: { noAudio: true } });
