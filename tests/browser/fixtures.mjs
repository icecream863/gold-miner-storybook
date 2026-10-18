import { test as base, expect } from "@playwright/test";

// 每个场景均检查真实页面错误；图片阻断用例仅豁免其明确阻断的黄金请求。
export const test = base.extend({
  runtimeAudit: [async ({ page }, use, info) => {
    const errors = [], expected = [];
    page.on("pageerror", error => errors.push({ kind: "pageerror", message: error.message }));
    page.on("console", message => {
      if (message.type() !== "error") return;
      const entry = { kind: "console", message: message.text(), url: message.location().url };
      const intentionalOreFailure = info.title.includes("关键素材加载失败")
        && /\/assets\/classic\/gold\.svg(?:\?|$)/.test(entry.url)
        && /Failed to load resource/.test(entry.message);
      (intentionalOreFailure ? expected : errors).push(entry);
    });
    await use();
    if (errors.length || expected.length) await info.attach("runtime-audit", {
      body: JSON.stringify({ errors, expected }, null, 2), contentType: "application/json",
    });
    expect(errors, "未预期的页面或控制台异常").toEqual([]);
  }, { auto: true }],
});
export { expect };
