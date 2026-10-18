import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { automatedUser, exportable, imageTokens, redact as redactText } from "./session-utils.mjs";

const source = process.argv[2];
if (!source)
  throw new Error(
    "用法：npm run session:export -- <原始 JSONL 路径> [--output <审阅目录>]。默认仅写入被 Git 忽略的本地审阅目录。",
  );
const root = path.resolve(import.meta.dirname, "..");
const outputFlag = process.argv.indexOf("--output");
if (outputFlag >= 0 && !process.argv[outputFlag + 1]) throw new Error("--output 缺少目录");
const output = outputFlag >= 0 ? path.resolve(process.argv[outputFlag + 1]) : path.join(root, "session/private/review");
if (output === root || path.resolve(source) === path.join(output, "session.jsonl"))
  throw new Error("导出目录不能覆盖工程入口或原始记录");
const raw = await fs.readFile(source, "utf8");
const rows = raw
  .trim()
  .split(/\r?\n/)
  .map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`记录第 ${i + 1} 行不是有效 JSON，停止导出。`);
    }
  });
const selection = rows.filter(exportable);
const redactions = {};
const redact = text => redactText(text, { root, stats: redactions });
const records = selection.map((row, i) => ({
  index: i + 1,
  timestamp: row.timestamp,
  ...JSON.parse(
    redact(
      JSON.stringify(row.payload, (key, value) =>
        key === "internal_chat_message_metadata_passthrough"
          ? undefined
          : value,
      ),
    ),
  ),
}));
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const textOf = (record) =>
  record.type === "message"
    ? (record.content ?? [])
        .map(
          (part) =>
            part.text ??
            (part.type?.includes("image")
              ? "[图片附件，见原始工具记录与项目截图]"
              : JSON.stringify(part)),
        )
        .join("\n")
    : (record.input ??
      record.arguments ??
      (typeof record.output === "string"
        ? record.output
        : JSON.stringify(record.output, null, 2)));
const label = (r) =>
  r.type === "message"
    ? r.role === "user"
      ? automatedUser(r) ? "自动续作 · 非人工输入" : "用户输入"
      : `AI${(r.phase ?? r.channel) ? " · " + (r.phase ?? r.channel) : ""}`
    : `${r.type.includes("output") ? "工具结果" : "工具调用"}${r.name ? " · " + r.name : ""}`;
const readableTexts = new Map();
const recordImages = new Map();
const recordAudio = new Map();
const readableText = (record) =>
  readableTexts.get(record.index) ?? String(textOf(record) ?? "");
function fenced(record) {
  const body = readableText(record);
  const longest = Math.max(
    2,
    ...(body.match(/`+/g) ?? []).map((part) => part.length),
  );
  const fence = String.fromCharCode(96).repeat(longest + 1);
  const images = (recordImages.get(record.index) ?? [])
    .map((image) => `![工具返回图片](${image.file})`)
    .join("\n\n");
  const audio = (recordAudio.get(record.index) ?? []).map(a => `[试听音频](${a.file})`).join("\n");
  return `${fence}text\n${body}\n${fence}\n\n${images}\n${audio}\n`;
}
const metadata = {
  title: "黄金矿工 · 完整 AI 协作记录",
  exportedAt: new Date().toISOString(),
  sourceFile: path.basename(source),
  sourceSessionId: rows.find(row => row.type === "session_meta")?.payload?.id ?? null,
  sourceRows: rows.length,
  sourceRecordThrough: selection.at(-1)?.timestamp,
  gameVersion: JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  ).version,
  sourceSha256: crypto.createHash("sha256").update(raw).digest("hex"),
  records: records.length,
  userMessages: records.filter((r) => r.type === "message" && r.role === "user")
    .length,
  automatedUserMessages: records.filter(automatedUser).length,
  assistantMessages: records.filter(
    (r) => r.type === "message" && r.role === "assistant",
  ).length,
  toolRecords: records.filter((r) => r.type !== "message").length,
  redactions,
  policy:
    "按原顺序保留全部可导出的用户输入、公开助手消息、工具调用和工具结果，自动续作单独标记。仅对凭据、平台个人账户标识、本机用户与工程目录、邮箱及手机号脱敏，图片编码不改写。平台控制元数据、内部摘要与未公开推理不属于公开人机对话导出。原始快照保留在本机，不覆盖。",
  limitations:
    "工具返回内容若原本截断，导出保留截断标记，不补写缺失内容。可读版将内嵌图像保存为附件显示，JSONL保留完整可导出内容；离线阅读需保留attachments目录。关键构建日志与实际截图另见docs。导出为当前时点快照，后续对话需要重新导出。",
};
const pendingCalls = new Map();
for (const record of records) {
  if (record.type === "function_call" || record.type === "custom_tool_call")
    pendingCalls.set(record.call_id, { callId: record.call_id, name: record.name, record: record.index });
  else if (record.type === "function_call_output" || record.type === "custom_tool_call_output")
    pendingCalls.delete(record.call_id);
}
metadata.pendingToolCallsAtCutoff = [...pendingCalls.values()];
await fs.mkdir(output, { recursive: true });
const attachmentDir = path.join(output, "attachments");
await fs.mkdir(attachmentDir, { recursive: true });
const attachments = [];
const knownHashes = new Set();
// 保留上一次导出的截图；同名截图更新时另存内容哈希，避免覆盖早期与失败画面。
const previous = await fs
  .readFile(path.join(output, "manifest.json"), "utf8")
  .then(JSON.parse)
  .catch(() => ({}));
for (const entry of previous.attachments ?? []) {
  if (path.dirname(entry.file) !== "attachments") continue;
  const bytes = await fs
    .readFile(path.join(output, entry.file))
    .catch(() => null);
  if (!bytes) continue;
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  attachments.push({ ...entry, sha256 });
  knownHashes.add(sha256);
}
const folders = [
  ["game", path.join(root, ".playwright-cli")],
  ["qa", path.join(root, "output/playwright")],
  ["history", path.join(root, "public/session/attachments")],
  ["evidence", path.join(root, "docs/screenshots")],
];
for (const [category, directory] of folders) {
  for (const entry of await fs
    .readdir(directory, { withFileTypes: true })
    .catch(() => [])) {
    if (!entry.isFile() || !/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) continue;
    const bytes = await fs.readFile(path.join(directory, entry.name));
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    if (knownHashes.has(sha256)) continue;
    const extension = path.extname(entry.name);
    const file = `${category}-${path.basename(entry.name, extension)}-${sha256.slice(0, 12)}${extension}`;
    await fs.writeFile(path.join(attachmentDir, file), bytes);
    attachments.push({
      file: `attachments/${file}`,
      originalFile: entry.name,
      category,
      sha256,
      archivedAt: metadata.exportedAt,
    });
    knownHashes.add(sha256);
  }
}
// 本轮对话中实际提供的试听片段：只从已知本地路径归档，不读取任意外部路径。
const previewPath = path.join(root, ".cache/polish-assets/western-preview.mp3");
const previewBytes = await fs.readFile(previewPath).catch(() => null);
if (previewBytes) {
 const digest = crypto.createHash("sha256").update(previewBytes).digest("hex");
 let entry = attachments.find(a => a.sha256 === digest);
 if (!entry) { entry = { file: "attachments/audio-preview-" + digest.slice(0,12) + ".mp3", originalFile: "western-preview.mp3", category: "audio", sha256: digest, archivedAt: metadata.exportedAt }; await fs.writeFile(path.join(output, entry.file), previewBytes); attachments.push(entry); knownHashes.add(digest); }
 for (const record of records) if (record.type === "message" && record.role === "assistant" && String(textOf(record)).includes("western-preview.mp3")) recordAudio.set(record.index, [entry]);
}
// 可读版显示图片，不把几兆字节的 Base64 当文字堆在对话里；原始 JSONL 不截断。
for (const record of records) {
  let body = String(textOf(record) ?? "");
  const wire =
    record.type === "message" ? JSON.stringify(record.content) : body;
  const images = [];
  for (const embedded of imageTokens(wire)) {
    const bytes = embedded.bytes;
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    let image = attachments.find((entry) => entry.sha256 === sha256);
    if (!image) {
      const file = `attachments/tool-image-${sha256.slice(0, 16)}.${embedded.format}`;
      await fs.writeFile(path.join(output, file), bytes);
      image = {
        file,
        originalFile: `record-${record.index}`,
        category: "tool",
        sha256,
        archivedAt: metadata.exportedAt,
      };
      attachments.push(image);
      knownHashes.add(sha256);
    }
    body = body.replaceAll(embedded.token, `[图片附件：${image.file}]`);
    if (!images.includes(image)) images.push(image);
  }
  readableTexts.set(record.index, body);
  recordImages.set(record.index, images);
}
metadata.attachments = attachments;
metadata.audioRecords = recordAudio.size;
metadata.imageRecords = [...recordImages.values()].filter(
  (images) => images.length > 0,
).length;
await fs.writeFile(
  path.join(output, "attachments.html"),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 协作过程截图</title><style>body{max-width:1050px;margin:30px auto;padding:20px;background:#f5f4eb;color:#304b39;font:14px/1.8 sans-serif}figure{margin:25px 0;padding:15px;background:white;border:1px solid #d8ddcc;border-radius:12px}img{display:block;max-width:100%;max-height:750px;margin:auto}figcaption{margin-top:12px;overflow-wrap:anywhere}a{color:#3a6b48}</style><a href="./">← 返回完整记录</a><h1>开发、调试与验收过程截图</h1><p>共 ${attachments.length} 项，包含早期模板、调试失败、最终画面与本轮试听音频。文件名可与工具记录中的截图名称对应。最终作品见游戏主页与 README。</p>${attachments.map((a) => `<figure>${a.category === "audio" ? `<audio controls preload="none" src="${escape(a.file)}"></audio>` : `<a href="${escape(a.file)}" target="_blank"><img loading="lazy" src="${escape(a.file)}" alt="${escape(a.originalFile)}"></a>`}<figcaption>${escape(a.category)} · ${escape(a.originalFile)}</figcaption></figure>`).join("")}</html>`,
);
const exportedJsonl = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
metadata.jsonlSha256 = crypto.createHash("sha256").update(exportedJsonl).digest("hex");
await fs.writeFile(path.join(output, "session.jsonl"), exportedJsonl);
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(metadata, null, 2) + "\n",
);
const transcript =
  `# ${metadata.title}\n\n导出时间：${metadata.exportedAt}\n\n${metadata.policy}\n\n${metadata.limitations}\n\n` +
  records
    .map((r) => `## ${r.index}. ${label(r)} · ${r.timestamp}\n\n${fenced(r)}`)
    .join("\n");
await fs.writeFile(
  path.join(output, "transcript.md"),
  transcript.trimEnd() + "\n",
);
const sections = records
  .map(
    (r) =>
      `<section class="entry"><details ${r.type === "message" ? "open" : ""}><summary><b>${r.index}. ${escape(label(r))}</b><time>${escape(r.timestamp)}</time></summary><pre>${escape(readableText(r))}</pre>${(recordImages.get(r.index) ?? []).map((image) => `<figure><a href="${escape(image.file)}" target="_blank"><img loading="lazy" style="display:block;max-width:100%;height:auto" src="${escape(image.file)}" alt="工具返回图片"></a></figure>`).join("")}${(recordAudio.get(r.index) ?? []).map(a => `<figure><audio controls preload="none" src="${escape(a.file)}"></audio><figcaption>本轮素材试听片段</figcaption></figure>`).join("")}</details></section>`,
  )
  .join("\n");
await fs.writeFile(
  path.join(output, "index.html"),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${metadata.title}</title><style>body{max-width:1080px;margin:0 auto;padding:32px 22px;background:#f7f7f1;color:#293e32;font:14px/1.8 "Microsoft YaHei",sans-serif}header{margin-bottom:24px}h1{font-size:26px}p{color:#63715e}.links{display:flex;gap:18px;flex-wrap:wrap}a{color:#3c7050}input{box-sizing:border-box;width:100%;padding:13px;border:1px solid #bdc9b7;border-radius:9px;margin:20px 0;background:#fff}.entry{border:1px solid #d6ddce;border-radius:10px;margin-bottom:12px;background:#fff}summary{cursor:pointer;padding:12px 16px;display:flex;justify-content:space-between;gap:12px}time{font-size:11px;color:#8b9385}pre{font:12px/1.8 Consolas,"Microsoft YaHei",monospace;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;margin:0;border-top:1px solid #e5e9de;color:#39443b}small{color:#8b9385}.note{background:#eaf0df;padding:15px;border-radius:10px}.hidden{display:none}@media(max-width:650px){summary{display:block}time{display:block}}</style><header><a href="../">← 返回游戏</a><h1>${metadata.title}</h1><p>${metadata.records} 条记录 · ${metadata.userMessages} 条用户消息 · ${metadata.assistantMessages} 条助手消息 · ${metadata.toolRecords} 条工具记录</p><p class="note">${escape(metadata.policy)}<br>${escape(metadata.limitations)}</p><div class="links"><a href="session.jsonl" download>下载结构化记录 JSONL</a><a href="transcript.md" download>下载可读记录 Markdown</a><a href="manifest.json" download>下载导出说明</a></div><small>导出时间 ${metadata.exportedAt} · 记录截止 ${metadata.sourceRecordThrough} · 来源 ${escape(metadata.sourceFile)}</small><input id="search" placeholder="搜索全部记录，例如：碰撞、素材、测试、发布" aria-label="搜索记录"></header>${sections}<script>document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.entry').forEach(n=>{n.classList.toggle('hidden',!n.textContent.toLowerCase().includes(q));if(q&&!n.classList.contains('hidden'))n.querySelector('details').open=true})})</script></html>`,
);
const indexPath = path.join(output, "index.html");
await fs.writeFile(
  indexPath,
  (await fs.readFile(indexPath, "utf8")).replace(
    '<div class="links">',
    '<div class="links"><a href="attachments.html">查看过程截图附件</a>',
  ),
);
console.log(JSON.stringify({ output, records: metadata.records, userMessages: metadata.userMessages,
  automatedUserMessages: metadata.automatedUserMessages, assistantMessages: metadata.assistantMessages,
  toolRecords: metadata.toolRecords, attachments: attachments.length,
  sourceRecordThrough: metadata.sourceRecordThrough, sourceSha256: metadata.sourceSha256, redactions }, null, 2));
