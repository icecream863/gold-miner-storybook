# 当前动画整合

六关正式入口复用 `src/sample/art.ts` 中已确认的项目原创矢量矿工／卷扬机，MIT；`src/approved-miner.ts` 只做场景尺寸映射，未从经典游戏提取商业素材。旧身体和表情 SVG 仍留在工程中对应历史，但正式场景不再加载。其余 56 个现有资源（包括矿物、商品、UI、音乐和音效）未修改，逐文件证据见 [整合保留检查](verification/integrated-preservation.json)。下方为此前素材制作的历史记录。

# 1.3.0 动画与声音素材（历史）

- 矿工分层身体、四种头部表情、矿物、动物、TNT、商品与控制SVG：基于本项目原创设计重绘，MIT。生成源码为 scripts/create-polish-art.mjs。
- 面板与按钮：Kenney UI Pack – Adventure，CC0，原版SVG在CSS中九宫格缩放。来源 https://kenney.nl/assets/ui-pack-adventure 。
- 采样音效：Kenney Interface Sounds / Impact Sounds，CC0。使用原OGG并在运行时混音；必要时降级为合成音。
- 背景音乐：Spaghetti Western，Julie Damsgaard / Spring Spring，CC0。来源 https://opengameart.org/content/spaghetti-western 。全曲减5dB、首尾80ms交叉处理，提供OGG与MP3；不是本项目原创音乐。素材试听经提交者明确确认采用。
- 38项本轮资产的来源、作者、加工与SHA见 [当前清单](polish-asset-manifest.json)。原许可副本保存在 licenses/Kenney-*-CC0.txt 与 [音乐说明](licenses/Spaghetti-Western-CC0.md)。
- 音频处理和演示录制所用FFmpeg为本机工具，不随游戏加载，也不新增运行依赖。下方1.2及更早素材说明仅保留历史，当时的图片哈希不代表重绘后的当前文件。

---

# 经典六关版素材说明

1.2.0 的运行场景只加载 `public/assets/classic/` 下 10 张本项目原创 SVG：黄金、石头、钻石、袋子、骨头、头骨、两类鼹鼠、TNT 和分层矿工身体。手臂、机械和橙色土层由程序绘制。它们使用项目 MIT 许可，清单与摘要见 [classic-asset-manifest.json](classic-asset-manifest.json)。

分层身体基于此前原创矿工移除固定手臂；未复制参考 Gold Miner 的商业图片。商店图标是系统 Emoji，无网络字体或外部音频。声音由程序合成。

以下保留旧版 Glitch 素材的历史来源与授权；这些 PNG 不在经典场景加载列表中，文件与许可继续保留以对应真实历史。

---

# 美术与音效来源

采用现成网络素材优先的方案，选用同一游戏资源系列统一背景与矿物风格，再补齐少量动态部件与角色。

## 第三方图片

来源：[GlitchAssets](https://github.com/ThirdPartyNinjas/GlitchAssets)，原始作品 Glitch / Tiny Speck，PNG 转换者 ThirdPartyNinjas。仓库说明这些游戏美术已发布到公共领域；随项目保留了 [来源说明原文](licenses/GlitchAssets-README.txt)。

2026-10-17 补查原作者仓库：[Glitch Locations](https://github.com/tinyspeck/glitch-locations/blob/master/README.md) 与 [Glitch Items](https://github.com/tinyspeck/glitch-items/blob/master/README.md) 明确采用 CC0 1.0 Universal；保留 [场景许可原文](licenses/Glitch-locations-README.md) 和 [物品许可原文](licenses/Glitch-items-README.md)。许可不包含 Glitch 的 logo 和商标，本项目未使用它们。转换仓库曾链接的 `www.glitchthegame.com/public-domain-game-art/` 本轮返回 404，因此补充上述官方仓库作为可访问来源，不把失效页面当作重新验证成功。

| 项目文件 | 原资源 | 用途 |
| --- | --- | --- |
| `cave-wall.png` | `Locations/ilmenskie/cave_bckg_wall_1.png` | 矿洞两侧岩壁 |
| `cave-hill.png` | `Locations/ilmenskie/cave_background_hill_1.png` | 地下远景层 |
| `ground.png` | `Locations/ilmenskie/ground_1.png` | 场景资源备用，不参与运行时预加载 |
| `mountains.png` | `Locations/groddle/mountain_blue_trees_1.png` | 地表山峦 |
| `ore.png` | `Items/harvestable_resources/rock_sparkly/rock_sparkly_1/rock_sparkly_1.png` | 黄金轮廓，运行时调整色调 |
| `rock.png` | `Items/misc/petrified_rock_base/petrified_rock_large/petrified_rock_large.png` | 低价值石头 |
| `diamond.png` | `Items/misc/gem_diamond/gem_diamond.png` | 钻石 |
| `ruby.png` | `Items/misc/gem_ruby/gem_ruby.png` | 共振水晶底图，运行时调整色调并添加光环与连线 |
| `amber.png` | `Items/misc/gem_amber/gem_amber.png` | 玩法帮助中的黄金图标 |

每个下载文件的完整原地址、作者、许可标注与 SHA-256 位于 [asset-manifest.json](asset-manifest.json)。可用 `node scripts/fetch-assets.mjs` 重新获取；日常构建直接使用已经提交的图片，不依赖下载网站可达性。

## 本项目制作

- `miner-original.svg`：原创矿工矢量插画，MIT。
- 绳索、钩爪、绞盘、灯光、粒子、界面图标与背景补充纹理：代码绘制，MIT。
- 音效：Web Audio 程序合成，不含第三方录音。
- 字体：使用访问设备的系统字体，不从外部字体服务加载。

本次实际采用的资源不包含付费素材、原版游戏截取图片或 AI 生成图片。

## 第五阶段的复用与修改

- 九张第三方 PNG 保持原始文件不变；金矿在加载时生成 256×256 的本地调色纹理，按亮度映射为金色、棕色阴影与浅金高光，保留透明轮廓。水晶继续由 ruby 生成小型调色纹理。
- 继续使用同系列山峦、岩壁和地下远景；只调整叠放与透明度，不引入第二套风格不同的素材。
- 新增的宽岩层、两侧木架、铆钉、地表断面和底部轨道使用 Canvas / Phaser 图形绘制，不下载额外位图；静态背景纹理在场景创建时生成。
- 原创矿工 SVG 保持 170×210 viewBox 与原有形状，只统一蓝青工装、金色矿帽和描边；沿用第四阶段的绞盘动作、载物姿态和动画生命周期。
- 商品图标继续复用本项目的五枚 SVG，统一图标底板、价格、卡片间距与状态配色；没有生成整套新素材或增加外部字体服务。
