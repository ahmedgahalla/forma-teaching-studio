import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({ absWorkingDir: root, entryPoints: ['src/workers/mechanics.worker.ts'], outfile: 'public/workers/mechanics.js', bundle: true, platform: 'browser', format: 'iife', target: ['es2020'], minify: true, legalComments: 'eof' });
console.log('Bundled the shared mechanics engine for its browser worker.');
