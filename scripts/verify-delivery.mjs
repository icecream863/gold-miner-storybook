import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import playthrough from "./browser-playthrough.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const base = new URL(option("--base", "https://icecream863.github.io/gold-miner-storybook/"));
if (!["http:", "https:"].includes(base.protocol)) throw new Error("只支持 HTTP(S) 验收网址");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const expected = JSON.parse(await fs.readFile(option("--expected", "dist/build-info.json"), "utf8"));
const local = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true });
const expectedCommit = option("--commit", local ? null : head.status === 0 ? head.stdout.trim() : null);
if (!local && !expectedCommit) throw new Error("公网验收需要 --commit 指定最终提交");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const checks = [], errors = [], badResponses = [];
const check = (name, success) => {
  checks.push({ name, success: Boolean(success) });
  if (!success) throw new Error(`验收失败：${name}`);
};
await fs.mkdir("output/delivery", { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || (process.platform === "win32" ? "msedge" : undefined) });
let build, manifest, gameplay;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: { "Cache-Control": "no-cache" } });
  context.on("page", page => {
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push({ message: message.text(), location: message.location() }); });
    page.on("response", response => { if (new URL(response.url()).origin === base.origin && response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  });
  const request = context.request;
  const info = await request.get(new URL("build-info.json", base).href);
  check("构建身份文件可读", info.status() === 200);
  build = await info.json();
  check("游戏源码摘要与本地候选一致", build.gameSourceSha256 === expected.gameSourceSha256);
  check("版本一致", build.version === expected.version);
  if (expectedCommit) {
    check("线上提交就是最终提交", build.gitCommit === expectedCommit);
    check("线上构建来自干净提交", build.gitDirty === false);
  }
  // CI 平台可能生成不同的文件名；以同源摘要和最终提交确认源码，再核对实际部署资源。
  for (const [file, digest] of Object.entries(build.assets)) {
    const response = await request.get(new URL(file, base).href);
    check(`构建资源摘要 ${file}`, response.status() === 200 && sha(await response.body()) === digest);
  }
  const page = await context.newPage();
  const response = await page.goto(base.href);
  check("新浏览器会话首页200", response.status() === 200);
  const html = await response.text();
  const references = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+\.(?:js|css))"/g)].map(match => match[1]);
  check("首页引用当前构建资源", references.length > 0 && references.every(file => Object.hasOwn(build.assets, file)));
  await page.getByRole("button", { name: "开始挖矿 →", exact: true }).waitFor();
  gameplay = await playthrough(page, { baseURL: base.href });
  check("实际出钩、购物继承、六关结算与整局重开", gameplay.complete && gameplay.checks.every(c => c.pass));
  const session = await context.newPage();
  const sessionURL = new URL("session/", base);
  const sessionResponse = await session.goto(sessionURL.href);
  check("Session新会话可读", sessionResponse.status() === 200);
  await session.getByRole("heading", { name: "黄金矿工 · 完整 AI 协作记录", exact: true }).waitFor();
  const metadata = await request.get(new URL("manifest.json", sessionURL).href);
  manifest = await metadata.json();
  check("Session对应候选截止与来源", manifest.sourceSha256 === expected.session.sourceSha256 && manifest.sourceRecordThrough === expected.session.through);
  const jsonlResponse = await request.get(new URL("session.jsonl", sessionURL).href, { timeout: 120000 });
  const jsonl = await jsonlResponse.body();
  check("JSONL下载摘要与候选一致，清单声明存在时同时核对", jsonlResponse.status() === 200
    && !!expected.session.jsonlSha256 && sha(jsonl) === expected.session.jsonlSha256
    && (!manifest.jsonlSha256 || manifest.jsonlSha256 === expected.session.jsonlSha256));
  const records = jsonl.toString("utf8").trim().split(/\r?\n/).map(JSON.parse);
  check("JSONL条数与页面一致", records.length === manifest.records && await session.locator(".entry").count() === manifest.records);
  check("下载链接存在", await session.getByRole("link", { name: /下载结构化记录/ }).isVisible() && await session.getByRole("link", { name: /下载可读记录/ }).isVisible());
  // 旧版记录不一定含本轮动画词汇，取页面实际正文作为搜索词并核对准确结果数。
  const entryTexts = await session.locator(".entry").allTextContents();
  const query = (await session.locator(".entry pre").first().innerText()).trim().slice(0, 16);
  const expectedShown = entryTexts.filter(text => text.toLowerCase().includes(query.toLowerCase())).length;
  await session.locator("#search").fill(query);
  const shown = await session.locator(".entry:not(.hidden)").count();
  check("Session搜索有效", !!query && expectedShown > 0 && expectedShown < records.length && shown === expectedShown);
  const markdown = await request.get(new URL("transcript.md", sessionURL).href);
  check("Markdown可下载", markdown.status() === 200 && (await markdown.text()).includes("工具"));
  // 分批核对全部附件，避免一次性保留全部图片响应。
  for (let index = 0; index < manifest.attachments.length; index += 8) {
    await Promise.all(manifest.attachments.slice(index, index + 8).map(async attachment => {
      const image = await request.get(new URL(attachment.file, sessionURL).href);
      if (image.status() !== 200 || sha(await image.body()) !== attachment.sha256) throw new Error(`附件损坏：${attachment.file}`);
    }));
  }
  check("全部Session附件可读取且摘要一致", true);
  const video = await request.get(new URL("demo.webm", base).href, { timeout: 120000 });
  check("最新演示可访问", video.status() === 200 && (await video.body()).length > 1000000);
  if (!local) {
    const remote = await request.get("https://api.github.com/repos/icecream863/gold-miner-storybook/commits/main");
    check("GitHub主分支与发布提交一致", remote.status() === 200 && (await remote.json()).sha === expectedCommit);
  }
  check("控制台无异常且项目资源无4xx", errors.length === 0 && badResponses.length === 0);
  await session.screenshot({ path: "output/delivery/session.png", fullPage: false });
  await context.close();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  const report = { base: base.href, candidate: build?.candidate ?? null, expectedCommit, checks, errors, badResponses,
    gameplay, session: manifest ? { records: manifest.records, through: manifest.sourceRecordThrough, attachments: manifest.attachments.length, jsonlSha256: manifest.jsonlSha256 } : null };
  await fs.writeFile(option("--report", "output/delivery/report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
