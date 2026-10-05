import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = [...(await readdir('dist/assets')).map((name) => `/assets/${name}`), '/NotoSans-Regular.ttf'];
await writeFile('dist/offline-assets.json', JSON.stringify(assets));
const version = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12);
const sw = await readFile('dist/sw.js', 'utf8');
await writeFile('dist/sw.js', sw.replace('bb-v4', `bb-${version}`));
