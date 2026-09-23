// Original procedural source -> Blender interchange, no patient or third-party meshes.
// node scripts/anatomy/bootstrap.mjs <temporary-source.json>
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const { createOrthodonticDemo } = await import('../../src/lib/demo.ts');
const model = createOrthodonticDemo();
const encode = geometry => ({ vertices: Array.from(geometry.attributes.position.array), indices: Array.from(geometry.index.array) });
const metadata = {
  version: 1, name: 'Forma Blender teaching anatomy', units: 'mm', coordinateSystem: '+X left,+Y superior,+Z anterior',
  teeth: model.teeth.map(({ geometry, rootGeometry, ...tooth }) => ({ ...tooth, crownMesh: `crown_${tooth.id}`, rootMesh: `root_${tooth.id}` })),
  gums: model.gums.map(gum => ({ id: gum.id, arch: gum.arch, position: gum.position, mesh: `gum_${gum.arch}` })),
};
const meshes = model.teeth.flatMap(tooth => [
  { name: `crown_${tooth.id}`, kind: 'crown', tooth: tooth.id, position: tooth.position, ...encode(tooth.geometry) },
  { name: `root_${tooth.id}`, kind: 'root', tooth: tooth.id, position: tooth.position, ...encode(tooth.rootGeometry) },
]).concat(model.gums.map(gum => ({ name: `gum_${gum.arch}`, kind: 'gum', position: gum.position, ...encode(gum.geometry) })));
const target = resolve(process.argv[2] || 'assets/anatomy/bootstrap.json');
mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, JSON.stringify({ metadata, meshes }));
console.log(`Bootstrap: ${meshes.length} separate meshes, ${meshes.reduce((n,m) => n + m.indices.length / 3, 0)} triangles -> ${target}`);
