import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const source = process.argv[2];
if (!source) throw new Error('用法：npm run session:export -- <本次对话的原始 JSONL 绝对路径>');
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'public/session');
const raw = await fs.readFile(source, 'utf8');
const rows = raw.trim().split(/\r?\n/).map((line, i) => { try { return JSON.parse(line); } catch { throw new Error(`记录第 ${i + 1} 行不是有效 JSON，停止导出。`); } });
const selection = rows.filter(row => row.type === 'response_item' && (
  (row.payload.type === 'message' && ['user', 'assistant'].includes(row.payload.role)) ||
  ['function_call', 'function_call_output', 'custom_tool_call', 'custom_tool_call_output'].includes(row.payload.type)
));
function redact(text) {
  return String(text)
    .replace(/(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,})/g, '[凭据已脱敏]')
    .replace(/(?:C:\\\\Users\\\\DELL|C:\\Users\\DELL|C:\/Users\/DELL)/g, '%USERPROFILE%')
    .replace(/642738243@qq\.com/g, '[Git 配置邮箱已脱敏]');
}
const records = selection.map((row, i) => ({
  index: i + 1, timestamp: row.timestamp, ...JSON.parse(redact(JSON.stringify(row.payload))),
}));
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const textOf = record => record.type === 'message' ? (record.content ?? []).map(part => part.text ?? (part.type?.includes('image') ? '[图片附件，见原始工具记录与项目截图]' : JSON.stringify(part))).join('\n') : record.input ?? record.arguments ?? (typeof record.output === 'string' ? record.output : JSON.stringify(record.output, null, 2));
const label = r => r.type === 'message' ? (r.role === 'user' ? '用户' : `AI${r.channel ? ' · ' + r.channel : ''}`) : `${r.type.includes('output') ? '工具结果' : '工具调用'}${r.name ? ' · ' + r.name : ''}`;
const metadata = {
  title: '黄金矿工 · 完整 AI 协作记录', exportedAt: new Date().toISOString(), sourceFile: path.basename(source),
  sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'), records: records.length,
  userMessages: records.filter(r => r.type === 'message' && r.role === 'user').length,
  assistantMessages: records.filter(r => r.type === 'message' && r.role === 'assistant').length,
  toolRecords: records.filter(r => r.type !== 'message').length,
  policy: '按原顺序保留可导出的用户输入、助手消息、工具调用和工具结果。仅对凭据、本机用户目录及 Git 配置邮箱脱敏。平台内部控制元数据与未公开推理不属于人机对话导出。原始文件保留在本机，不覆盖。',
  limitations: '工具返回内容若原本截断，导出保留截断标记，不补写缺失内容。关键构建日志与实际截图另见 docs/verification 与 docs/screenshots。导出为当前时点快照；后续对话需要重新导出。',
};
await fs.mkdir(output, { recursive: true });
const attachmentDir = path.join(output, 'attachments');
await fs.mkdir(attachmentDir, { recursive: true });
const attachments = [];
const folders = [
  ['game', path.join(root, '.playwright-cli')],
  ['qa', path.join(root, 'output/playwright')],
  ['setup', path.join(process.env.TEMP ?? '', 'gold-miner-feasibility-3cef7d506d9e48e99ff495787598687e/.playwright-cli')],
];
for (const [category, directory] of folders) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isFile() || !entry.name.endsWith('.png')) continue;
    const file = `${category}-${entry.name}`;
    await fs.copyFile(path.join(directory, entry.name), path.join(attachmentDir, file));
    attachments.push({ file: `attachments/${file}`, originalFile: entry.name, category });
  }
}
metadata.attachments = attachments;
await fs.writeFile(path.join(output, 'attachments.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 协作过程截图</title><style>body{max-width:1050px;margin:30px auto;padding:20px;background:#f5f4eb;color:#304b39;font:14px/1.8 sans-serif}figure{margin:25px 0;padding:15px;background:white;border:1px solid #d8ddcc;border-radius:12px}img{display:block;max-width:100%;max-height:750px;margin:auto}figcaption{margin-top:12px;overflow-wrap:anywhere}a{color:#3a6b48}</style><a href="./">← 返回完整记录</a><h1>开发、调试与验收过程截图</h1><p>共 ${attachments.length} 张，包含早期模板、调试失败和最终画面。文件名可与工具记录中的截图名称对应。最终作品见游戏主页与 README。</p>${attachments.map(a => `<figure><a href="${escape(a.file)}" target="_blank"><img loading="lazy" src="${escape(a.file)}" alt="${escape(a.originalFile)}"></a><figcaption>${escape(a.category)} · ${escape(a.originalFile)}</figcaption></figure>`).join('')}</html>`);
await fs.writeFile(path.join(output, 'session.jsonl'), records.map(r => JSON.stringify(r)).join('\n') + '\n');
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
await fs.writeFile(path.join(output, 'transcript.md'), `# ${metadata.title}\n\n导出时间：${metadata.exportedAt}\n\n${metadata.policy}\n\n${metadata.limitations}\n\n` + records.map(r => `## ${r.index}. ${label(r)} · ${r.timestamp}\n\n\`\`\`text\n${textOf(r)}\n\`\`\`\n`).join('\n'));
const sections = records.map(r => `<section class="entry"><details ${r.type === 'message' ? 'open' : ''}><summary><b>${r.index}. ${escape(label(r))}</b><time>${escape(r.timestamp)}</time></summary><pre>${escape(textOf(r) ?? '')}</pre></details></section>`).join('\n');
await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${metadata.title}</title><style>body{max-width:1080px;margin:0 auto;padding:32px 22px;background:#f7f7f1;color:#293e32;font:14px/1.8 "Microsoft YaHei",sans-serif}header{margin-bottom:24px}h1{font-size:26px}p{color:#63715e}.links{display:flex;gap:18px;flex-wrap:wrap}a{color:#3c7050}input{box-sizing:border-box;width:100%;padding:13px;border:1px solid #bdc9b7;border-radius:9px;margin:20px 0;background:#fff}.entry{border:1px solid #d6ddce;border-radius:10px;margin-bottom:12px;background:#fff}summary{cursor:pointer;padding:12px 16px;display:flex;justify-content:space-between;gap:12px}time{font-size:11px;color:#8b9385}pre{font:12px/1.8 Consolas,"Microsoft YaHei",monospace;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;margin:0;border-top:1px solid #e5e9de;color:#39443b}small{color:#8b9385}.note{background:#eaf0df;padding:15px;border-radius:10px}.hidden{display:none}@media(max-width:650px){summary{display:block}time{display:block}}</style><header><a href="../">← 返回游戏</a><h1>${metadata.title}</h1><p>${metadata.records} 条记录 · ${metadata.userMessages} 条用户消息 · ${metadata.assistantMessages} 条助手消息 · ${metadata.toolRecords} 条工具记录</p><p class="note">${escape(metadata.policy)}<br>${escape(metadata.limitations)}</p><div class="links"><a href="session.jsonl" download>下载结构化记录 JSONL</a><a href="transcript.md" download>下载可读记录 Markdown</a><a href="manifest.json" download>下载导出说明</a></div><small>导出时间 ${metadata.exportedAt} · 来源 ${escape(metadata.sourceFile)}</small><input id="search" placeholder="搜索全部记录，例如：碰撞、素材、测试、发布" aria-label="搜索记录"></header>${sections}<script>document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.entry').forEach(n=>{n.classList.toggle('hidden',!n.textContent.toLowerCase().includes(q));if(q&&!n.classList.contains('hidden'))n.querySelector('details').open=true})})</script></html>`);
const indexPath = path.join(output, 'index.html');
await fs.writeFile(indexPath, (await fs.readFile(indexPath, 'utf8')).replace('<div class="links">', '<div class="links"><a href="attachments.html">查看过程截图附件</a>'));
console.log(JSON.stringify({ output, ...metadata }, null, 2));
