# 发布CI启动时序修复

首次发布提交 `e9fa169` 的 Ubuntu CI 已通过安装、类型检查、58项测试与生产构建，但浏览器冒烟在开始游戏前失败：`clock.pauseAt: Cannot fast-forward to the past`。失败运行：[39111805655](https://github.com/icecream863/gold-miner-storybook/actions/runs/39111805655)。日志和浏览器 trace 保留在该运行的 `browser-failure` 附件。

问题在测试适配器：先读取页面 `Date.now()+100`，再跨进程调用 `clock.pauseAt`；CI协议延迟超过100ms时目标时间已经过去。Windows本地冒烟通过不能证明这个窗口在CI也可靠。

修复只涉及自动化启动，不改变游戏：安装固定日期的时钟，让菜单正常加载，再暂停到两小时后的固定测试时刻。窗口超过测试的整个超时预算，且暂停发生在开始游戏之前；点击开始仍由原规则清零活动时间、从60秒开始。正式游戏不加载此适配器，普通正常时钟试玩与录像保持原样。

独立样片验收同样移除50ms窗口，复用固定时刻。新增浏览器回归主动将暂停调用延迟450ms，检查页面加载、立即出钩、60秒与暂停冻结。CI仍执行六关、五次购物及真实结算，保留失败诊断，不通过移除测试或修改金额来通过。

此用法与已安装Playwright类型文档及[Clock.pauseAt官方说明](https://playwright.dev/docs/api/class-clock#clock-pause-at)一致：安装时间早于最终测试时刻，加载后再暂停。源实现会拒绝向过去跳转，不能靠增加重试掩盖问题。

修复后本地2/2冒烟通过，包含完整六关／五次购物／结算重开和450ms延迟回归。日志见 [publication-clock-smoke.log](verification/publication-clock-smoke.log)。游戏构建身份仍为 `1.3.0+603be84b9669`，只修改测试适配器与验收材料。
