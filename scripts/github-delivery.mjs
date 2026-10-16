import { spawnSync } from 'node:child_process';

const owner = 'icecream863';
const repo = 'gold-miner-storybook';
// 凭据仅存在于本进程内存中，不写入文件、参数、日志或 Git remote。
const credential = spawnSync('git', ['credential', 'fill'], {
  input: `protocol=https\nhost=github.com\nusername=${owner}\n\n`, encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
});
if (credential.status !== 0) throw new Error('无法读取现有 GitHub 登录凭据；请在本机完成 GitHub 登录。');
const fields = Object.fromEntries(credential.stdout.trim().split(/\r?\n/).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
if (!fields.password) throw new Error('现有登录未提供可用的 GitHub 凭据。');
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method, headers: { Authorization: `Bearer ${fields.password}`, Accept: 'application/vnd.github+json', 'User-Agent': 'gold-miner-delivery', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: response.ok, status: response.status, data };
}
const user = await api('/user');
if (!user.ok || user.data.login !== owner) throw new Error('GitHub 登录账号与预期账号不一致。');
const action = process.argv[2];
if (action === 'ensure') {
  let result = await api(`/repos/${owner}/${repo}`);
  if (result.status === 404) result = await api('/user/repos', 'POST', { name: repo, description: '黄金矿工 · 矿山手记 | A storybook Gold Miner browser game with complete AI collaboration records.', private: false, auto_init: false, homepage: `https://${owner}.github.io/${repo}/` });
  if (!result.ok) throw new Error(`创建或查询仓库失败：HTTP ${result.status} ${result.data?.message}`);
  console.log(JSON.stringify({ url: result.data.html_url, clone: result.data.clone_url, empty: result.data.size === 0, private: result.data.private }));
} else if (action === 'pages') {
  let result = await api(`/repos/${owner}/${repo}/pages`);
  if (result.status === 404) result = await api(`/repos/${owner}/${repo}/pages`, 'POST', { build_type: 'workflow' });
  else if (result.ok && result.data.build_type !== 'workflow') result = await api(`/repos/${owner}/${repo}/pages`, 'PUT', { build_type: 'workflow' });
  if (!result.ok) throw new Error(`Pages 配置失败：HTTP ${result.status} ${result.data?.message}`);
  console.log(JSON.stringify({ status: result.status, url: result.data?.html_url, buildType: result.data?.build_type }));
} else if (action === 'status') {
  const pages = await api(`/repos/${owner}/${repo}/pages`);
  const runs = await api(`/repos/${owner}/${repo}/actions/runs?per_page=3`);
  console.log(JSON.stringify({ pages: { status: pages.status, url: pages.data?.html_url, state: pages.data?.status }, runs: runs.data?.workflow_runs?.map(r => ({ id: r.id, status: r.status, conclusion: r.conclusion, url: r.html_url, sha: r.head_sha })) }, null, 2));
} else throw new Error('用法：node scripts/github-delivery.mjs ensure|pages|status');
