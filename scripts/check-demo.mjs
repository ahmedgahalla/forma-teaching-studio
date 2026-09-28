import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../out/', import.meta.url));
const assets = [
  'index.html',
  'favicon.svg',
  'audience.css',
  'fonts/DM-Sans-Variable.ttf',
  'fonts/DM-Sans-OFL.txt',
  'fonts/Manrope-Variable.ttf',
  'fonts/Manrope-OFL.txt',
  'models/forma-teaching-v1.glb',
  'models/forma-teaching-v1.json',
  'workers/mechanics.js',
];
for (const asset of assets) {
  const path = resolve(root, asset);
  if (!existsSync(path) || !statSync(path).size)
    throw new Error(`Demo asset missing: ${asset}. Run npm run build first.`);
}
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const links = [...html.matchAll(/href="([^"?#]+\.css)(?:\?[^"#]*)?"/g)].map(match => match[1]);
if (!links.length) throw new Error('No application stylesheet found in the exported page.');
for (const link of links) {
  if (!link.startsWith('/') || link.startsWith('//') || link.includes('..'))
    throw new Error('The demo stylesheet must be a local build asset.');
  const css = readFileSync(resolve(root, `.${link}`), 'utf8');
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(css))
    throw new Error('The demo still depends on an external font service.');
}
console.log('Demo files ready: page, styles, fonts, icon, model and mechanics worker are local.');
console.log('Serve with npm start. Speech recognition and optional AI may still need a network.');
