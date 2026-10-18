# 黄金矿工 · HR 提交说明

本次提交为 **1.3.0 经典六关版＋已确认矿工动画**。以经典 Gold Miner 为参考，使用 TypeScript、Phaser、Vite 实现；关卡、经济和美术为本项目适配，不宣称逐像素或原版精确数值还原。

- 运行网址：https://icecream863.github.io/gold-miner-storybook/
- 原始工程：https://github.com/icecream863/gold-miner-storybook
- 完整 AI 协作记录：https://icecream863.github.io/gold-miner-storybook/session/
- 30 秒原速带声演示：https://icecream863.github.io/gold-miner-storybook/integrated-preview.webm
- 发布身份与 Session 截止：https://icecream863.github.io/gold-miner-storybook/build-info.json

## 可体验内容

六关累计目标、按重量回收、黄金／石头／钻石、问号袋、移动鼹鼠及携钻鼹鼠、TNT 连爆。五种商店商品为炸药、力量药水、石头收藏书、幸运草和钻石抛光剂。消费扣累计钱包，强化下一关生效并在关末清理；炸药余量跨关。失败整局重开，六关有最终结算。

Space／↓ 或点击矿洞出钩，↑ 使用炸药，P／Esc 暂停。所有物品成功回到地面才结算；超时未回收或炸毁不发钱。支持触屏，手机推荐横屏。音乐／音效可独立调整，暂停和离开页面停止声音，首次有效操作后解锁。

## 验收范围

动画整合候选已通过类型检查、58 项单元／规则测试、14 项浏览器场景、18 项本机子路径交付检查，以及约 10 分钟、53 轮暂停与重开检查。正常时钟带声录像完成六关及五次购物，最终 $11,965。详细日志与失败过程见 [动画整合报告](ANIMATION-INTEGRATION.md)。发布候选另执行构建及 CI 冒烟；不将重复运行次数累计成更多测试。

自动精确瞄准、Agent 正常操作与提交者本人试玩分别报告；没有把脚本结果称为人类通过率，没有代填真实手机／Safari 或主观听感结论。素材来源、作者及许可见 [ASSETS](ASSETS.md)。

## Session 完整性

记录页保留截至发布快照的公开用户输入、助手回复、工具调用、工具结果、失败尝试及附件；文本做隐私脱敏，自动续作单独标记。HTML、Markdown、JSONL 和导出清单均可下载。清单注明记录截止、来源摘要、附件摘要及未完成调用，后续发布／验收和最终回复不伪装成已包含在快照中。平台内部推理和控制数据不属于公开人机对话。

本次公开快照共 **2,542 条记录、299 个附件（含 1 项试听音频）**，截止北京时间 **2026-10-18 16:20:16**。顺序、文本脱敏、附件和JSONL摘要已核对；298张图片经缩略图总览检查，内容为游戏迭代、素材及经典参考。该检查不等于穷尽所有可能的隐私形式。

原始平台 JSONL、凭据、`.cache/`、`node_modules/` 和 `session/private/` 不提交。公开快照的校验结果见 `verification/publication-session-audit.json` 和 `verification/publication-session-package.json`。

## 本地复现

```bash
npm ci
npm run build
npm run preview
```

打开 http://127.0.0.1:4173/ ，保留服务窗口；Windows 也可双击根目录的 `启动试玩.cmd`。完整浏览器测试为 `npm run test:browser`。本地预览停止不影响独立托管的公网版本。

源码与当前发布提交以仓库 main 及线上 `build-info.json` 为准，GitHub Actions 成功部署后再进行公网核对。历史阶段报告原样保留；其中旧版本的“未发布”等状态只代表当时阶段。
