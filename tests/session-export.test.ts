import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { automatedUser, exportable, imageTokens, redact } from "../scripts/session-utils.mjs";

test("Session保留公开消息和工具顺序，区分自动续作，排除平台推理与内部摘要", () => {
  const row = (payload: object) => ({ type: "response_item", payload });
  assert.equal(exportable(row({ type: "message", role: "assistant", phase: "final_answer" })), true);
  assert.equal(exportable(row({ type: "message", role: "assistant", phase: "commentary" })), true);
  assert.equal(exportable(row({ type: "message", role: "assistant", channel: "analysis" })), false);
  assert.equal(exportable(row({ type: "message", role: "assistant", channel: "summary" })), false);
  assert.equal(exportable(row({ type: "reasoning" })), false);
  assert.equal(exportable(row({ type: "message", role: "developer" })), false);
  assert.equal(exportable(row({ type: "custom_tool_call_output" })), true);
  assert.equal(automatedUser({ type: "message", role: "user", content: [{ text: '<codex_internal_context source="goal">继续</codex_internal_context>' }] }), true);
});

test("Session脱敏不破坏JSON、图片编码和可验证附件", () => {
  const binary = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.from("image-fixture-13800138000")]);
  const image = `data:image/png;base64,${binary.toString("base64")}`;
  const value = JSON.stringify({ email: "student@example.test", escapedEmail: "student@example\\.test", phone: "13800138000", profile: "C:\\Users\\Student\\notes", token: "github_pat_" + "x".repeat(32), image });
  const stats = {};
  const clean = redact(value, { stats });
  const parsed = JSON.parse(clean);
  assert.equal(parsed.image, image);
  assert.equal(imageTokens(clean)[0].bytes.equals(binary), true);
  for (const text of ["student@", "13800138000", "Student", "github_pat_"]) assert.equal(clean.includes(text), false);
  assert.ok(Object.keys(stats).length >= 4);
  for (const original of [JSON.stringify({ creator_user_id: "user-example", creator_account_id: "00000000-0000-0000-0000-000000000000" }), JSON.stringify(JSON.stringify({ creator_user_id: "user-example" }))]) {
    const masked = redact(original);
    assert.doesNotThrow(() => JSON.parse(masked));
    assert.equal(masked.includes("user-example"), false);
    assert.equal(masked.includes("00000000-0000-0000-0000-000000000000"), false);
  }
});

test("Session CLI完整导出到本地审阅目录，保留调用结果且不覆盖原始记录", async () => {
  const root = path.resolve(import.meta.dirname, "..");
  const folder = path.join(root, ".cache", "session-export-test");
  await fs.mkdir(folder, { recursive: true });
  const source = path.join(folder, "source.jsonl"), output = path.join(folder, "review");
  const payloads = [
    { type: "message", role: "user", content: [{ type: "input_text", text: "测试原始要求 student@example.test" }] },
    { type: "function_call", name: "test_tool", call_id: "call-1", arguments: "{}" },
    { type: "function_call_output", call_id: "call-1", output: "真实失败结果，不删除" },
    { type: "message", role: "assistant", phase: "final_answer", content: [{ type: "output_text", text: "失败如实保留" }] },
    { type: "message", role: "user", content: [{ type: "input_text", text: '<codex_internal_context source="goal">继续</codex_internal_context>' }] },
    { type: "message", role: "assistant", phase: "analysis", content: [{ text: "private-internal-fixture" }] },
  ];
  const raw = payloads.map(payload => JSON.stringify({ timestamp: "2026-10-17T00:00:00Z", type: "response_item", payload })).join("\n") + "\n";
  await fs.writeFile(source, raw);
  execFileSync(process.execPath, ["scripts/export-session.mjs", source, "--output", output], { cwd: root, stdio: "pipe" });
  const manifest = JSON.parse(await fs.readFile(path.join(output, "manifest.json"), "utf8"));
  const records = (await fs.readFile(path.join(output, "session.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(records.length, 5);
  assert.equal(manifest.records, records.length);
  assert.equal(manifest.automatedUserMessages, 1);
  assert.deepEqual(records.map(r => r.index), [1,2,3,4,5]);
  assert.equal(records[2].output, "真实失败结果，不删除");
  assert.equal((await fs.readFile(path.join(output, "index.html"), "utf8")).includes("private-internal-fixture"), false);
  assert.equal(await fs.readFile(source, "utf8"), raw);
});

test("Session导出拒绝覆盖工程入口", async () => {
  const root = path.resolve(import.meta.dirname, "..");
  const before = await fs.readFile(path.join(root, "index.html"), "utf8");
  const result = spawnSync(process.execPath, ["scripts/export-session.mjs", "missing.jsonl", "--output", root], { cwd: root, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /不能覆盖/);
  assert.equal(await fs.readFile(path.join(root, "index.html"), "utf8"), before);
});
