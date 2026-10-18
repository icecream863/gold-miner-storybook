// 只处理公开对话与工具记录。原始 JSONL 另存本地，不改写平台推理或控制数据。
export function exportable(row) {
  if (row.type !== "response_item") return false;
  const p = row.payload;
  if (p.type === "message") {
    if (p.role === "user") return true;
    const phase = p.phase ?? p.channel;
    return p.role === "assistant" && [undefined, null, "commentary", "final", "final_answer"].includes(phase);
  }
  return ["function_call", "function_call_output", "custom_tool_call", "custom_tool_call_output"].includes(p.type);
}

export function automatedUser(record) {
  return record.type === "message" && record.role === "user" &&
    /^\s*<codex_internal_context\b/.test((record.content ?? []).map(p => p.text ?? "").join("\n"));
}

// 保护图片的原始二进制编码，不能把像素中的数字误当手机号脱敏。
const imagePattern = () => /(data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+|(?:iVBORw0KGgo|\/9j\/|UklGR)[A-Za-z0-9+/=]{20,})/g;
export function imageTokens(text) {
  return [...String(text).matchAll(imagePattern())].map(match => {
    const token = match[0];
    const data = token.startsWith("data:") ? token.slice(token.indexOf(",") + 1) : token;
    const bytes = Buffer.from(data, "base64");
    const format = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "png"
      : bytes[0] === 255 && bytes[1] === 216 ? "jpg"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;
    return { token, bytes, format };
  }).filter(image => image.format);
}

export function redact(text, { root, stats = {} } = {}) {
  const replace = (value, expression, marker, category) => value.replace(expression, () => {
    stats[category] = (stats[category] ?? 0) + 1;
    return marker;
  });
  const images = new Set([...String(text).matchAll(imagePattern())].map(m => m[0]));
  return String(text).split(imagePattern()).map(part => {
    if (images.has(part)) return part;
    let value = part;
    value = replace(value, /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,})/g, "[凭据已脱敏]", "credential");
    value = replace(value, /\bBearer\s+[A-Za-z0-9_.-]{20,}/gi, "Bearer [凭据已脱敏]", "credential");
    value = replace(value, /[A-Za-z]:\\+Users\\+[^\\/\s"'|<>(){}\[\],;:]+|[A-Za-z]:\/Users\/[^/\\\s"'|<>(){}\[\],;:]+/g, "%USERPROFILE%", "userDirectory");
    value = replace(value, /\b[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\\{0,4}\.[A-Z0-9-]+)*\\{0,4}\.[A-Z]{2,}\b/gi, "[邮箱已脱敏]", "email");
    value = replace(value, /(?<![A-Za-z0-9])1[3-9][0-9]{9}(?![A-Za-z0-9])/g, "[手机号已脱敏]", "phone");
    // 工具错误可能回显 Session 元数据；保留开发会话 ID，但隐藏平台个人账户 ID。
    value = value.replace(/(creator_(?:user|account)_id\\*"\s*:\s*\\*")([^"\\\s]+)/g, (match, prefix) => {
      stats.accountIdentifier = (stats.accountIdentifier ?? 0) + 1;
      return prefix + "[账户标识已脱敏]";
    });
    if (root) {
      const variants = [...new Set([root.replaceAll("\\", "/"), ...[1,2,4,8,16].map(count => root.replaceAll("\\", "\\".repeat(count)))])].sort((a,b) => b.length - a.length);
      for (const variant of variants) {
        const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        value = replace(value, new RegExp(escaped, "gi"), "%PROJECT_ROOT%", "projectDirectory");
      }
    }
    return value;
  }).join("");
}
