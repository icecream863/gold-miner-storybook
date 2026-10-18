# 黄金矿工 · 经典六关版

> **[点击直接试玩](https://icecream863.github.io/gold-miner-storybook/)**，无需安装。完整版包含六关、五种商店商品与已确认的矿工动画，保留原矿洞、矿物、界面和声音。[HR提交说明](docs/PUBLIC-DELIVERY.md)汇总三个交付入口；[动画整合报告](docs/ANIMATION-INTEGRATION.md)和[第一关样片](docs/sample/CLASSIC-MOTION.md)保留迭代证据。


以经典单人 Gold Miner 的操作、构图和商店为参考，用 TypeScript 与 Phaser 实现的浏览器小游戏。摆钩、抓金、拉回入账，购买补给挑战六关累计目标。数值和关卡为本项目适配，不是原版文件移植或逐像素复刻。

**提交版本：1.3.0 经典六关版＋已确认动画。** 下列为固定提交入口；线上实际提交、源码摘要与 Session 截止时间见游戏目录的 [build-info.json](https://icecream863.github.io/gold-miner-storybook/build-info.json)。本地迭代报告保留历史，当前发布与验收范围见 [提交说明](docs/PUBLIC-DELIVERY.md)。

- [运行游戏](https://icecream863.github.io/gold-miner-storybook/)
- [GitHub 工程](https://github.com/icecream863/gold-miner-storybook)
- [完整 AI 协作 Session](https://icecream863.github.io/gold-miner-storybook/session/)（可下载 JSONL、Markdown，注明截止与脱敏规则）
- [最新动画与声音打磨](docs/POLISH.md)、[经典版实现与验收](docs/CLASSIC-REMAKE.md)、[素材许可](docs/ASSETS.md)、[交付状态](docs/SUBMISSION.md)

## 玩法与操作

| 操作 | 键盘 | 鼠标／触屏 |
| --- | --- | --- |
| 出钩 | Space / ↓ | 点击矿洞 |
| 销毁所抓物品 | ↑ | 炸药按钮 |
| 暂停／继续 | P / Esc | 暂停／继续按钮 |
| 提前结算 | — | 结束本关；未达标会失败 |
| 静音 | — | 音符按钮 |

每关 60 秒，只按**累计钱包余额**判断是否达标。金钱跨关保留，消费扣钱包；物品回到地面才入账，截止未回收、炸毁或提前结束时仍在钩上的物品都不计钱。失败只能整局重开，初始炸药为零。暂停和切出页面不会消耗游戏时间。手机主要推荐横屏，画面保持 1100×800 的经典构图比例。

| 关卡 | 累计目标 | 内容 |
| --- | ---: | --- |
| 初入金矿 | $650 | 黄金、石头、问号袋 |
| 钻石矿层 | $1800 | 钻石、骨头、头骨 |
| 鼹鼠出没 | $3400 | 普通移动动物、袋子 |
| 危险矿道 | $5500 | TNT 与遮挡矿物 |
| 追逐宝光 | $8000 | 携钻移动动物与重金块 |
| 黄金大满贯 | $11000 | 全部元素的综合挑战 |

黄金 $100／250／500，石头 $15，钻石与携钻动物 $650。骨头 $10、头骨 $20、普通动物 $10。袋子重量固定为 3，回收后揭晓 $50／100／250／500／800。TNT 被钩中时引爆中心 110 世界像素内的物品，并引爆相邻 TNT，销毁物品不发钱。

载物回收速度为 `420 / (1 + 重量 × 0.75)`，力量药水使分子提高至 630；空钩为 600，伸钩为 560 世界像素／秒。重物能多赚，也会耗费更多时间。

## 动画与声音

矿工采用已确认的连续矢量轮廓：出钩时落柄并前探，出绳期间保持低手位，回收时随实际收绳距离摇柄，入账后复位。手掌和手柄共用坐标，靴底固定，卷筒随收放绳转动。减少动态仍保留功能动作；暂停冻结，重新开始清理姿态。六关保留原地层配色，炸药、胜负仍有原场景与声音反馈；不叠加旧人物的额外反应动作。

声音设置可独立调整音乐和音效，默认20%／70%，保存在本机。首次操作后解锁音频；暂停、帮助和离开页面停止声音，继续时从原音乐位置恢复。音乐加载失败不会阻止游戏，可在设置里重试，OGG解码失败会尝试MP3。音乐和音效均随工程提供，运行时不连接素材网站。

## 经典补给铺

| 商品 | 本店报价范围 | 下一关效果／库存 |
| --- | ---: | --- |
| 炸药 | $60–140 | 一枚主动消耗品，余量跨关保留 |
| 力量药水 | $120–240 | 载物回收速度 ×1.5 |
| 石头收藏书 | $15–45 | 石头 $15→$45，骨头不受影响 |
| 幸运草 | $50–150 | 提高袋子开出高额金币的概率，非保底 |
| 钻石抛光剂 | $150–350 | 钻石及携钻动物 $650→$975 |

报价在进入本店时一次生成，购买和重绘不会重抽；每店每种限购一次。四种强化可组合，只对下一关生效，关末清除。正常袋子五档概率为 35／30／20／10／5%，幸运草改为 10／15／30／25／20%。地图固定，动物规则运动；仅袋子和商店报价使用可复现随机数。价格、概率及六关目标都是本项目的适配数值。

本版移除了此前的共振水晶、连锁采集、增幅器、沙漏、石头抛光剂、双目标和关内重试，不保留双模式。历史开发报告与 Session 保留原样，不回写成此前已完成经典版。

## 本地运行

需要 Node.js 22.18+，推荐 24。运行不需要后端、账号、密钥或外部素材网站。

```bash
npm ci
npm run dev
```

开发地址 `http://127.0.0.1:5173/`。生产预览：

```bash
npm run build
npm run preview
```

生产地址 `http://127.0.0.1:4173/`。构建入口先执行类型检查和全部单元／规则测试，再打包并生成 `dist/build-info.json`，记录版本、规范化源码摘要、编译资源摘要、Git 状态和 Session 来源。

```bash
npm run test:browser
npm run test:browser:smoke
```

浏览器测试默认使用 Windows 已安装的 Edge；Linux 先运行 `npx playwright install --with-deps chromium`。可通过 `PW_CHANNEL` 选择已安装通道。结果位于 `output/browser-report/`，失败保留截图与 trace。规则路线、虚拟时钟浏览器测试、正常速度脚本和实际 Agent 试玩分别说明，不将它们当作人类通过率。

## 工程结构

- `src/core/model.ts`：三态钩爪、相对运动扫掠、单件快照、动物、TNT、关卡与结算。
- `src/core/shop.ts`：五商品配置、固定本店报价、强化类型、袋子权重及可复现随机数。
- `src/core/clock.ts`：单调活动时间，排除暂停、菜单和商店停留。
- `src/main.ts`：Phaser 场景、输入、界面、载物和事件反馈；动画不承担计分。
- `src/approved-miner.ts`：已确认动画到正式场景的统一坐标映射。
- `src/sample/motion.ts`、`src/sample/art.ts`：正式场景和保留样片共用的矢量矿工动作与绘制。
- `src/presentation.ts`：手臂几何、载物、反馈、动物步态等纯表现工具；旧角色动作实现作为历史保留，正式入口已停用。
- `src/audio.ts`：独立音乐／音效、偏好保存、暂停续播、采样音效与合成反馈，音频不可用时保留玩法。
- `tests/classic-*.test.ts`、`tests/browser/classic.spec.mjs`：规则、六关路线、动画和生产浏览器验证。

`?qa=1` 只提供克隆后的只读观察快照，没有修改金钱、时间、矿物或关卡的接口。它供调试和自动瞄准验证，不等同于防作弊系统。

## 演示、Session 与交付

演示及最新验收范围以 [动画整合报告](docs/ANIMATION-INTEGRATION.md) 为准，旧 [打磨报告](docs/POLISH.md) 保留历史。录制使用正常时钟和真实按键、只读状态辅助瞄准，混入真实游戏音乐和音效，不录麦克风；不能称为人类试玩。保持生产预览运行，设置完整 FFmpeg 的 `FFMPEG_PATH`，执行 `npm run demo:record`；设置 `RECORDING_NAME=integrated` 可另存本轮报告，避免覆盖旧报告。

Session 原始快照与脱敏审阅候选均保存在被 Git 忽略的 `session/private/`，不会自动公开。导出保留公开对话、工具操作、失败尝试和图片，自动续作单独标记；平台推理与内部控制数据不属于公开对话导出。

```bash
npm run session:export -- <原始JSONL快照路径>
node scripts/audit-session.mjs <同一快照路径> session/private/review
```

默认输出离线 HTML、Markdown、JSONL、附件和截止说明。文本隐私脱敏，图片保持原样，需要提交者审阅。后续对话不自动进入已有快照。

**推送 main 会触发 CI 和 Pages 部署，因此推送、更新线上、公开脱敏 Session 均须先获明确授权。** 发布后用最终提交及构建标识执行只读验收：

```bash
npm run verify:delivery -- --base https://icecream863.github.io/gold-miner-storybook/ --commit <最终提交SHA> --expected dist/build-info.json
```

代码与本版原创 SVG 使用 [MIT](LICENSE)。Adventure UI、采样音效（Kenney）和西部器乐（Julie Damsgaard / Spring Spring）按 CC0 使用；原始作者、来源、加工与摘要见 [素材说明](docs/ASSETS.md)。旧版第三方资源记录继续保存。本作品用于学习和招聘测试，与原版开发者无关联。
