> 当前矢量纠偏样片见 [CORRECTION.md](CORRECTION.md)：生成PNG和下述链条/金币采样已停用，保留历史。现用角色、机械、矿石与袋子为项目原创矢量轮廓；声音恢复1.3的四个采样，许可沿用 `docs/ASSETS.md` 与 `docs/licenses/`。

# 样片素材与制作记录

没有提取经典Gold Miner的商业图片或音效。原版截图仅用于研究对照，不进入样片构建。

| 素材 | 来源与作者 | 使用方式 |
| --- | --- | --- |
| 绞盘 | [Chain winch sounds](https://opengameart.org/content/chain-winch-sounds)，bart，CC0 | `winch - Marker #9.wav`的1.2～2.4秒片段，单声道、滤波、压缩、65ms尾首交叠、归一化；作者原作为合成编排，并非现场录音 |
| 入账 | [Coin Splash](https://opengameart.org/content/coin-splash)，LordTomorrow，CC0 | 一次短采样，裁剪/滤波/渐隐；无额外音阶 |
| 出钩、抓取 | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)，CC0 | wood light 001、metal light 003，剪短与处理；原许可保留在 `docs/licenses/Kenney-impact-CC0.txt` |
| 可选音乐 | [Spaghetti Western](https://opengameart.org/content/spaghetti-western)，Julie Damsgaard / Spring Spring，CC0 | 沿用1.3提供的MP3，新会话默认关闭 |
| 问号袋 | 项目既有SVG，MIT | 第一关沿用，不在本次重绘范围 |
| 角色帧图 | 内置imagegen生成，项目专用原创设计 | 见下方三张实际采用文件；不是外部素材包或原版角色 |
| 黄金、石块、导轮、HUD | 本次程序绘制 | 与核心碰撞和计分分离 |

音频文件、原文件摘要、处理时长与最终摘要见 `audio-assets.json`。制作脚本 `scripts/prepare-sample-audio.mjs` 需要完整FFmpeg，原始下载缓存在 `.cache/sample-assets/`；成品音频已经随工程提供，游戏不向上游网站取音频。

角色制作使用内置imagegen模式，不需要API密钥。采用文件：

- `public/assets/sample/miner-light.png`：1774×887 RGBA，4列2行。
- `public/assets/sample/miner-heavy.png`：同规格，重载姿势。
- `public/assets/sample/miner-poses.png`：同规格，待机/放手/入账。

实际网格边界为小数像素，运行时按图片宽高等分读取，不把它误当作整数448px切片。原PNG和alpha保留，未使用位移扭曲制造骨骼动画。当前往复循环只采用每张回收图中连续的前五个关键姿势；八拍会重复回程姿势，未使用不连续的下半圈。

先检索了 [Mining Pixel Game Asset](https://opengameart.org/content/mining-pixel-game-asset)（CC0）与Kenney角色目录；像素风和现成角色动作不匹配，未下载投入本次场景。没有把“网络素材优先”理解成混用不相容素材。

最终提示词及参考图链见 [PROMPTS.md](PROMPTS.md)。未采用的早期图保留在生成工具与会话历史中，未覆盖原1.3资产。
