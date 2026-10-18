# 公开提交入口

2026-10-18 用户已授权检查并推送最终版，推送 main 会触发 Pages。HR 所需三个入口、功能、复现和记录边界统一见 [PUBLIC-DELIVERY.md](PUBLIC-DELIVERY.md)。发布提交与实际部署状态以线上 `build-info.json`、GitHub Actions 和本轮公网核对为准。

下方保留发布前本地验收与私有封存的历史状态，不能把旧的“尚未授权”理解为当前仍未授权，也不把预发布检查当成公网已上线证据。

---

# 发布前本地最终整合：原六关版＋已确认动画

**当前候选 `1.3.0+fbcb125872ee` 已完成本地整合，没有执行提交、推送或部署。** 矿洞、矿物、界面、商店、音效与规则沿用原六关版，只接入确认后的矿工／卷扬机动作并修复输入后的表现同步。此前报告保留在下方，不能混作本轮证据。

- [当前可玩入口](http://127.0.0.1:4173/)；[子路径独立副本](http://127.0.0.1:4174/gold-miner-storybook/)；二者只在本机可访问。
- [30秒原速带声节选](../public/integrated-preview.webm)、[94.64秒完整六关录像](../public/demo.webm)。正常时钟、实际按键、只读状态辅助瞄准，不是提交者本人试玩。
- 类型检查、58/58测试、生产构建、14/14浏览器场景、18/18子路径交付核对通过。当前候选609.7秒、53轮暂停／恢复／重开检查通过，异常0。
- [完整差异和证据边界](ANIMATION-INTEGRATION.md)、[实际运行画面](screenshots/integrated-heavy.png)、[原模块与56资源保留检查](verification/integrated-preservation.json)。
- 新记录仅封存到被Git忽略的私有目录，具体截止与文件摘要以 `verification/integrated-session-package.json` 为准。运行页仍指向明确标为历史的Session，本轮没有将新对话放进公开目录。只给历史记录页补了空图标声明，旧正文、JSONL和附件未重写。

公网游戏和远端源码尚未执行本轮更新；本机地址不能当成招聘方要求的公网交付。公开记录、推送与部署仍按此前约定等待明确授权。提交者本人自然度／音色／难度复核及真实手机、Safari结果不由自动测试代填。

---

# 历史本地交付状态：1.3.0 动画与声音打磨

**候选 1.3.0+71cf23c3acf9 已实现，未提交、推送、部署或公开新版 Session。** 规则、关卡经济和商店源码与1.2.0基线一致，证据见 [不变性检查](verification/polish-rule-invariance.json)。

- 本机游戏：[独立生产副本](http://127.0.0.1:4175/gold-miner-storybook/)（仅本机，最终完整性见下方独立验收报告）；根预览4173用于开发。
- [带真实游戏声音的演示](../public/demo.webm)：87.32秒，六关、五次购物、重石、TNT、暂停、最终结算；只读状态辅助瞄准，非人类试玩。最终余额$11,485。音轨均值−27.0dB、峰值−4.2dB。原始录音无Duration头，已从解码进度恢复；按结束位置估算影音偏移，未逐帧校准同步。见 [录像记录](verification/polish-recording.json) 和 [音频审计](verification/polish-demo-audio.log)。
- 类型检查、46/46测试、生产构建通过：[构建日志](verification/polish-build-final.log)。12/12浏览器场景通过：[日志](verification/polish-browser-final-serial.log)；最终仅改移动端页脚按钮44px后，原布局场景单独重跑1/1，不合计为13个不同场景：[布局补验](verification/polish-layout-final.log)。
- 正常时钟连续603.084秒，51次暂停/重开，重开对象回到21，音乐最多一个源，错误0：[长期检查](verification/polish-soak-final.json)。其候选为d4b5bd6bc239；最终71cf23c3acf9仅CSS不同、JS字节相同：[一致性证明](verification/polish-component-identity.json)。不是完整内存泄漏证明或所有设备FPS保证。
- 新版无QA界面Agent实测抓取并入账$250，音乐/音效设置显示20%/70%，设置暂停，控制台错误与警告0：[实际界面](screenshots/polish-playing-native.jpg)。只完成局部操作，不是整局人工通关。
- [完整实现与失败记录](POLISH.md)、[前后截图](screenshots/polish-grip-before.png)、[新版截图](screenshots/polish-grip.png)、[声音设置](screenshots/polish-settings-native.jpg)。旧版报告与旧ZIP保留，不覆盖历史。

私有Session封存与附件摘要见 verification/polish-session-package.json；新离线审阅包位于 session/private/gold-miner-polish-session-review-20261017.zip。本次封存1,778条记录、207个附件（含1项试听音频），截止2026-10-17 18:16:18北京时间；ZIP约75.51MB。新的试听MP3随审阅包保留，原始平台记录只在本机。快照截止后的打包/交付验证及最终回复不在此包内，不宣称包含未来记录。

独立安装、构建和子路径检查结果见 verification/polish-clean-install.log、verification/polish-clean-build.log、verification/polish-delivery.json；现已完成：独立安装、46/46测试与构建通过，18/18交付检查通过，控制台异常及资源4xx为0。现有公网游戏和公开232条Session仍是历史版本，本轮没有替换。

仍待提交者本人至少两局体验、完整混音主观听感及真实手机/Safari确认。已获得的是音乐试听片段方向认可，不能据此宣称整套混音和所有环境均通过。

---

以下保留上一阶段记录，版本与数字以其当时状态为准。

# 当前本地交付状态：经典六关版

**1.2.0+8b2f89d5902e 已完成本地实现，尚未推送、部署或公开新版 Session。现有公网仍为历史版本。** 基线f536181897e1115b82c4482c7df714d6468e7f19，当前有未提交差异，最终提交SHA尚未产生。

| 材料 | 当前本地入口 | 公开入口状态 |
| --- | --- | --- |
| 浏览器游戏 | [根路径预览](http://127.0.0.1:4173/)；[独立生产副本](http://127.0.0.1:4174/gold-miner-storybook/)（仅本机） | [既有公开游戏](https://icecream863.github.io/gold-miner-storybook/) 尚未替换 |
| GitHub原始工程 | 当前工作区，未暂存/提交/推送 | [既有仓库](https://github.com/icecream863/gold-miner-storybook) 未更新 |
| 演示 | [demo.webm](../public/demo.webm)，52.24秒、无音轨 | 现有公网录像不是本版验收依据 |
| 完整协作记录 | session/private/review/ 离线审阅；新ZIP与原始快照均在被Git忽略的session/private/ | [既有Session](https://icecream863.github.io/gold-miner-storybook/session/) 为232条历史记录，不自动公开新版 |

## 验收证据

- 类型检查、39/39当前单元与规则测试、生产构建通过：[构建日志](verification/classic-build.log)。
- 生产Edge 8/8不同场景通过：[浏览器日志](verification/classic-browser-final.log)；HUD新增几何断言的专项再验也通过：[布局补验](verification/classic-hud-final.log)。不合计为9个不同场景。
- 12条含两次空钩的分关路线、9条不同种子/消费策略的完整六关路线通过，不依赖袋子好运。
- 正常时钟只读辅助脚本完成六关和五次购物，17次出钩，最终$11835，异常0：[完整记录](verification/classic-normal-route.json)。两个此前失败记录保留，不能只展示成功样本。
- 正常速度界面Agent在无QA/虚拟时钟下完成第一关$750并在第二关收回$975钻石，另有空钩，未完成整局，不能代替本人试玩。
- 原创10张SVG摘要一致，运行源码已无共振专用状态。传统单件、累计目标与整局重开生效。
- 独立副本全新安装21个依赖包成功：[安装日志](verification/classic-clean-install.log)。独立类型检查、39项测试、生产构建再次通过，源码指纹一致：[独立构建](verification/classic-clean-build.log)。子路径交付结果见单独报告，不提前视为公网成功。

完整规则、修改模块、失败原因和验证边界见 [经典版报告](CLASSIC-REMAKE.md)，素材授权见 [ASSETS](ASSETS.md)。

## 私有Session与最终发布

新版Session保留从开始到封存时点的可导出公开对话、工具调用/结果、失败和图片；文本脱敏，图片不改写，自动续作单列，平台内部推理不属于公开对话。原始快照只在本机。条数、截止、文件SHA和ZIP原始记录排除检查以 verification/classic-session-package.json 为准；独立副本完整性以 verification/classic-delivery.json 为准。封存后的打包/交付验证及最终回复不在该快照内，未来发布记录需要再次追加导出。

当前仍需提交者本人至少两局试玩与图片隐私审阅；真实手机、Safari、人耳听感及长期性能未完成。历史阶段报告保留旧功能与旧数字，不是当前经典版证据。

按此前约定，**推送main（会触发Pages）、部署线上游戏、公开经审阅的脱敏Session** 都须明确授权。本轮没有执行这些动作。获得授权后，才将审阅Session复制到public/session，按最终提交生成构建并复核公网三项材料一致性；原始记录永不复制到公开目录。

## 本次私有审阅快照

记录 **1495条**、附件 **176个**，截止 **2026-10-17T08:09:35.969Z**（北京时间2026-10-17 16:09:35）。ZIP约68.82MB，位于被Git忽略的 session/private/gold-miner-classic-session-review-20261017.zip 。摘要和原始记录排除检查见 [封装清单](verification/classic-session-package.json)，顺序/图片/文本格式审计见 [审计JSON](verification/classic-session-audit.json)。此包只供本地审阅，未放入工作区public/session，未公开。

## 独立生产子路径最终结果

[本机验收入口](http://127.0.0.1:4174/gold-miner-storybook/) 的 **18/18交付检查通过**：[完整报告](verification/classic-delivery.json)。新浏览器20次出钩完成六关、五次商店、最终$11290及整局重开；Session 1495条、176附件全部下载与SHA一致，JSONL/Markdown下载和搜索通过，游戏资源错误与控制台异常均为0。该全流程使用虚拟时钟与只读自动瞄准；不是正常速度或人类通过率。仅提供本机回环服务，没有公开发布。
