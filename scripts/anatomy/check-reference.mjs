// Read-only geometric check of candidate display registrations after a sculpt pass.
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return next(`${specifier}.ts`, context); throw error; }
} });
const { dentalCaseFromAsset } = await import('../../src/lib/anatomy-assets.ts');
const { findSurfaceIntersections } = await import('../../src/lib/analysis.ts');
const bytes = readFileSync('public/models/forma-teaching-v1.glb');
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const model = dentalCaseFromAsset(gltf.scene, JSON.parse(readFileSync('public/models/forma-teaching-v1.json', 'utf8')));
const roots = { ...model, teeth: model.teeth.map(tooth => ({ ...tooth, geometry: tooth.rootGeometry })) };
for (const shift of [1.6, 1.5, 1.4, 1.3, 1.2]) {
  const poses = Object.fromEntries(model.teeth.map(tooth => [tooth.id, { translation: [0, Number(tooth.id[0]) < 3 ? -shift : shift, 0], rotation: [0, 0, 0] }]));
  console.log(JSON.stringify({ shift, crowns: findSurfaceIntersections(model, poses), roots: findSurfaceIntersections(roots, poses) }));
}
