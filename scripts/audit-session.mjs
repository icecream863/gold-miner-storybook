import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { automatedUser, exportable, imageTokens, redact } from "./session-utils.mjs";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error("用法：node scripts/audit-session.mjs <原始快照> <审阅目录>");
const root = path.resolve(import.meta.dirname, "..");
const output = path.resolve(destination);
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const raw = await fs.readFile(source, "utf8");
const selected = raw.trim().split(/\r?\n/).map(JSON.parse).filter(exportable);
const records = (await fs.readFile(path.join(output, "session.jsonl"), "utf8")).trim().split(/\r?\n/).map(JSON.parse);
const manifest = JSON.parse(await fs.readFile(path.join(output, "manifest.json"), "utf8"));
const fail = message => { throw new Error(message); };
if (manifest.sourceSha256 !== sha(raw)) fail("原始快照摘要不一致");
if (manifest.records !== records.length || selected.length !== records.length) fail("记录条数不一致");
if (manifest.jsonlSha256 !== sha(await fs.readFile(path.join(output, "session.jsonl")))) fail("导出JSONL摘要不一致");
const sourceImages = new Set(), exportedImages = new Set();
let changedRecords = 0;
for (let i = 0; i < selected.length; i++) {
  const sourceJson = JSON.stringify(selected[i].payload, (key, value) => key === "internal_chat_message_metadata_passthrough" ? undefined : value);
  const clean = redact(sourceJson, { root });
  const expected = { index: i + 1, timestamp: selected[i].timestamp, ...JSON.parse(clean) };
  if (JSON.stringify(expected) !== JSON.stringify(records[i])) fail(`第${i + 1}条与原始顺序或脱敏规则不一致`);
  if (clean !== sourceJson) changedRecords++;
  for (const image of imageTokens(sourceJson)) sourceImages.add(sha(image.bytes));
  for (const image of imageTokens(JSON.stringify(records[i]))) exportedImages.add(sha(image.bytes));
}
if (JSON.stringify([...sourceImages].sort()) !== JSON.stringify([...exportedImages].sort())) fail("图片编码被改变或遗漏");
const attachmentHashes = new Set();
let attachmentBytes = 0;
for (const entry of manifest.attachments) {
  const absolute = path.resolve(output, entry.file);
  if (!absolute.startsWith(output + path.sep) || path.dirname(entry.file) !== "attachments") fail("附件路径越界");
  const bytes = await fs.readFile(absolute);
  if (sha(bytes) !== entry.sha256) fail(`附件摘要不一致：${entry.file}`);
  attachmentHashes.add(entry.sha256);
  attachmentBytes += bytes.length;
}
for (const hash of sourceImages) if (!attachmentHashes.has(hash)) fail("可读版缺少原始图片附件");
const hits = { credential: 0, userDirectory: 0, email: 0, phone: 0, accountIdentifier: 0 };
for (const record of records) {
  let text = JSON.stringify(record);
  for (const image of imageTokens(text)) text = text.replaceAll(image.token, "[图片]");
  hits.credential += (text.match(/(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|Bearer\s+[A-Za-z0-9_.-]{20,})/g) ?? []).length;
  hits.userDirectory += (text.match(/[A-Za-z]:\\+Users\\+[^\\/\s"']+|[A-Za-z]:\/Users\/[^/\\\s"']+/g) ?? []).length;
  hits.email += (text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\\{0,4}\.[A-Z0-9-]+)*\\{0,4}\.[A-Z]{2,}\b/gi) ?? []).length;
  hits.phone += (text.match(/(?<![A-Za-z0-9])1[3-9][0-9]{9}(?![A-Za-z0-9])/g) ?? []).length;
  hits.accountIdentifier += (text.match(/creator_(?:user|account)_id\\*"\s*:\s*\\*"(?:user-[A-Za-z0-9_-]+|[a-f0-9]{8}-[a-f0-9-]{27,})/gi) ?? []).length;
}
const report = {
  records: records.length, automaticUserMessages: records.filter(automatedUser).length,
  sourceOrderAndContentMatch: true, changedRecords, redactions: manifest.redactions,
  sourceImages: sourceImages.size, sourceImagesUnchanged: true,
  attachments: manifest.attachments.length, attachmentBytes, attachmentHashesMatch: true,
  jsonlSha256: manifest.jsonlSha256, sourceSha256: manifest.sourceSha256,
  through: manifest.sourceRecordThrough, pendingToolCallsAtCutoff: manifest.pendingToolCallsAtCutoff,
  remainingTextPatternHits: hits,
  limitation: "只验证已知文本格式，不能证明不存在所有敏感内容；图片保持原样，须人工检查。原始快照不属于公开材料。",
};
await fs.writeFile(path.join(output, "audit.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (Object.values(hits).some(count => count > 0)) process.exitCode = 1;
