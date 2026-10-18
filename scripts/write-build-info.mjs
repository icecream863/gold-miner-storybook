import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
async function files(directory) {
  const entries = await fs.readdir(path.join(root, directory), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(relative));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const sourceFiles = ["index.html", "package.json", "package-lock.json", "vite.config.mjs", ...await files("src"), ...await files("public/assets")].sort();
const sources = {};
for (const file of sourceFiles) {
  const bytes = await fs.readFile(path.join(root, file));
  // 与 .gitattributes 的 LF 规则一致，避免 Windows 工作区和 CI 换行不同导致误报。
  const canonical = /\.(ts|css|html|json|mjs|svg)$/i.test(file)
    ? Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n")) : bytes;
  sources[file] = sha(canonical);
}
const gameSourceSha256 = sha(JSON.stringify(sources));
const packageInfo = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const git = args => spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
const head = git(["rev-parse", "HEAD"]);
const commit = process.env.GITHUB_SHA || (head.status === 0 ? head.stdout.trim() : null);
const status = git(["status", "--porcelain=v1", "--untracked-files=normal"]);
const assets = {};
for (const file of (await files("dist/assets")).filter(f => /\.(js|css)$/.test(f)).sort()) {
  assets[file.replace(/^dist\//, "")] = sha(await fs.readFile(path.join(root, file)));
}
const session = await fs.readFile(path.join(root, "dist/session/manifest.json"), "utf8").then(JSON.parse).catch(() => null);
// 早期 Session 清单没有 JSONL 摘要；从实际随包文件生成，不把缺失当成通过。
const sessionJsonlSha256 = session ? sha(await fs.readFile(path.join(root, "dist/session/session.jsonl"))) : null;
if (session?.jsonlSha256 && session.jsonlSha256 !== sessionJsonlSha256)
  throw new Error("Session 清单与随包 JSONL 不一致，停止生成构建身份");
const info = {
  version: packageInfo.version,
  candidate: `${packageInfo.version}+${gameSourceSha256.slice(0,12)}`,
  builtAt: new Date().toISOString(),
  gitCommit: commit && /^[a-f0-9]{40}$/i.test(commit) ? commit : null,
  gitDirty: status.status === 0 ? status.stdout.trim().length > 0 : null,
  gameSourceSha256, sourceNormalization: "UTF-8 text CRLF to LF; binary unchanged", sources, assets,
  session: session ? { records: session.records, through: session.sourceRecordThrough, sourceSha256: session.sourceSha256,
    jsonlSha256: sessionJsonlSha256, manifestJsonlSha256: session.jsonlSha256 ?? null } : null,
};
await fs.writeFile(path.join(root, "dist/build-info.json"), JSON.stringify(info, null, 2) + "\n");
console.log(`Build identity: ${info.candidate}; commit ${info.gitCommit ?? "unavailable"}; dirty ${info.gitDirty}`);
