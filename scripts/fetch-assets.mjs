import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// 只下载实际使用的公共领域资源，避免把整个第三方素材库装进工程。
const root = path.resolve(import.meta.dirname, '..');
const destination = path.join(root, 'public/assets/art');
await fs.mkdir(destination, { recursive: true });
await fs.mkdir(path.join(root, 'docs/licenses'), { recursive: true });
const base = 'https://raw.githubusercontent.com/ThirdPartyNinjas/GlitchAssets/master/';
const entries = [
  ['cave-wall.png', 'Locations/ilmenskie/cave_bckg_wall_1.png'],
  ['cave-hill.png', 'Locations/ilmenskie/cave_background_hill_1.png'],
  ['ground.png', 'Locations/ilmenskie/ground_1.png'],
  ['mountains.png', 'Locations/groddle/mountain_blue_trees_1.png'],
  ['ore.png', 'Items/harvestable_resources/rock_sparkly/rock_sparkly_1/rock_sparkly_1.png'],
  ['rock.png', 'Items/misc/petrified_rock_base/petrified_rock_large/petrified_rock_large.png'],
  ['diamond.png', 'Items/misc/gem_diamond/gem_diamond.png'],
  ['ruby.png', 'Items/misc/gem_ruby/gem_ruby.png'],
  ['amber.png', 'Items/misc/gem_amber/gem_amber.png'],
];
const manifest = [];
for (const [file, sourcePath] of entries) {
  const url = base + sourcePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(path.join(destination, file), bytes);
  manifest.push({ file: `assets/art/${file}`, source: url, author: 'Tiny Speck / Glitch; PNG conversion by ThirdPartyNinjas', license: 'Public Domain / CC0', sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  console.log(`${file}: ${bytes.length} bytes`);
}
const license = await (await fetch(base + 'README.txt')).text();
await fs.writeFile(path.join(root, 'docs/licenses/GlitchAssets-README.txt'), license);
await fs.writeFile(path.join(root, 'docs/asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
