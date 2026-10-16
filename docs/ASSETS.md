# 美术与音效来源

采用现成网络素材优先的方案，选用同一游戏资源系列统一背景与矿物风格，再补齐少量动态部件与角色。

## 第三方图片

来源：[GlitchAssets](https://github.com/ThirdPartyNinjas/GlitchAssets)，原始作品 Glitch / Tiny Speck，PNG 转换者 ThirdPartyNinjas。仓库说明这些游戏美术已发布到公共领域；随项目保留了 [来源说明原文](licenses/GlitchAssets-README.txt)。

| 项目文件 | 原资源 | 用途 |
| --- | --- | --- |
| `cave-wall.png` | `Locations/ilmenskie/cave_bckg_wall_1.png` | 矿洞两侧岩壁 |
| `cave-hill.png` | `Locations/ilmenskie/cave_background_hill_1.png` | 地下远景层 |
| `ground.png` | `Locations/ilmenskie/ground_1.png` | 场景资源备用 |
| `mountains.png` | `Locations/groddle/mountain_blue_trees_1.png` | 地表山峦 |
| `ore.png` | `Items/harvestable_resources/rock_sparkly/rock_sparkly_1/rock_sparkly_1.png` | 黄金轮廓，运行时调整色调 |
| `rock.png` | `Items/misc/petrified_rock_base/petrified_rock_large/petrified_rock_large.png` | 低价值石头 |
| `diamond.png` | `Items/misc/gem_diamond/gem_diamond.png` | 钻石 |
| `ruby.png` / `amber.png` | `Items/misc/gem_ruby/`、`Items/misc/gem_amber/` | 配套物品图标 |

每个下载文件的完整原地址、作者、许可标注与 SHA-256 位于 [asset-manifest.json](asset-manifest.json)。可用 `node scripts/fetch-assets.mjs` 重新获取；日常构建直接使用已经提交的图片，不依赖下载网站可达性。

## 本项目制作

- `miner-original.svg`：原创矿工矢量插画，MIT。
- 绳索、钩爪、绞盘、灯光、粒子、界面图标与背景补充纹理：代码绘制，MIT。
- 音效：Web Audio 程序合成，不含第三方录音。
- 字体：使用访问设备的系统字体，不从外部字体服务加载。

本次实际采用的资源不包含付费素材、原版游戏截取图片或 AI 生成图片。
