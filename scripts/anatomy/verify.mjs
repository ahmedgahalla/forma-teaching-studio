// Verify the delivered GLB using the same Three.js loader as the browser.
// node scripts/anatomy/verify.mjs
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; }
} });
const { createOrthodonticDemo } = await import('../../src/lib/demo.ts');
const { createWorkflowAppliances } = await import('../../src/lib/workflow-appliances.ts');
const { createTeachingAnatomy } = await import('../../src/lib/teaching-anatomy.ts');
const { createAttachmentGeometry } = await import('../../src/lib/attachments.ts');
const { createApplianceKit } = await import('../../src/lib/appliances.ts');
const { createRemovableRetainer } = await import('../../src/lib/removable-retainer.ts');
const { findSurfaceIntersections } = await import('../../src/lib/analysis.ts');
const { validateAnatomyMetadata } = await import('../../src/lib/anatomy-assets.ts');
const { CASE_REFERENCE_SHIFT } = await import('../../src/lib/teaching-cases.ts');
const meta = JSON.parse(readFileSync(resolve('public/models/forma-teaching-v1.json'), 'utf8'));
validateAnatomyMetadata(meta);
const bytes = readFileSync(resolve('public/models/forma-teaching-v1.glb'));
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
gltf.scene.updateMatrixWorld(true);
const original = createOrthodonticDemo();
const meshes = []; gltf.scene.traverse(node => { if (node.isMesh) meshes.push(node); });
assert.equal(meshes.length, 58); assert.equal(meta.teeth.length, 28); assert.equal(meta.gums.length, 2);
const report = { units: 'mm', revision: meta.assetInfo.revision, meshes: meshes.length, triangles: 0, closedSurfaces: 0, maxBoundingBoxChangeMm: 0, maxRootBoundingBoxChangeMm: 0, minBracketClearanceMm: Infinity, maxBracketClearanceMm: -Infinity, rootsByTooth: {}, rootConnectedComponents: {}, applianceChecks: [], cutawayChecks: [], removableRetainerPockets: 0, originalCrownCrossings: [], referenceShiftMm: CASE_REFERENCE_SHIFT, referenceOcclusionCrossings: [] };
function geometry(name, position) {
  const node = gltf.scene.getObjectByName(name); assert.ok(node?.isMesh, name);
  const g = node.geometry.clone().applyMatrix4(node.matrixWorld).translate(-position[0], -position[1], -position[2]);
  const vertices = g.attributes.position, normals = g.attributes.normal;
  assert.ok(Array.from(vertices.array).every(Number.isFinite), `${name} finite vertices`);
  assert.equal(normals.count, vertices.count, `${name} normals`);
  assert.ok(Array.from(normals.array).every(Number.isFinite), `${name} finite normals`);
  assert.ok(g.index && g.index.count % 3 === 0, `${name} triangles`);
  const indices = g.index.array; report.triangles += indices.length / 3;
  const edges = new Map(), parent = Array.from({ length: vertices.count }, (_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const p = new THREE.Vector3(), q = new THREE.Vector3(), r = new THREE.Vector3(); let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const tri = Array.from(indices.slice(i, i + 3));
    p.fromBufferAttribute(vertices, tri[0]); q.fromBufferAttribute(vertices, tri[1]); r.fromBufferAttribute(vertices, tri[2]);
    volume += p.dot(q.cross(r)) / 6;
    for (let j = 0; j < 3; j++) { const a = tri[j], b = tri[(j + 1) % 3]; const edge = a < b ? `${a}/${b}` : `${b}/${a}`; edges.set(edge, (edges.get(edge) || 0) + 1); parent[find(a)] = find(b); }
  }
  assert.ok([...edges.values()].every(value => value === 2), `${name} closed indexed surface`);
  assert.ok(volume > .1, `${name} outward winding`); report.closedSurfaces++;
  if (name.startsWith('root_')) {
    const id = name.slice(5), count = new Set(parent.map((_, i) => find(i))).size;
    report.rootConnectedComponents[id] = count;
    report.rootsByTooth[id] = meta.teeth.find(tooth => tooth.id === id).rootAnatomy?.branches.length || count;
    assert.equal(count, 1, `${id} continuous root trunk`);
  }
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
const model = { name: meta.name, demo: true, teeth: meta.teeth.map(tooth => ({ ...tooth, geometry: geometry(tooth.crownMesh, tooth.position), rootGeometry: geometry(tooth.rootMesh, tooth.position) })), gums: meta.gums.map(gum => ({ ...gum, geometry: geometry(gum.mesh, gum.position) })) };
const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
for (const tooth of model.teeth) {
  const base = original.teeth.find(t => t.id === tooth.id);
  for (const key of ['position', 'buccal', 'mesial', 'occlusal', 'bracketPosition']) assert.ok(tooth[key].every((value, i) => value === base[key][i]), `${tooth.id} ${key} registration`);
  base.geometry.computeBoundingBox();
  const change = Math.max(tooth.geometry.boundingBox.min.distanceTo(base.geometry.boundingBox.min), tooth.geometry.boundingBox.max.distanceTo(base.geometry.boundingBox.max));
  assert.ok(change < .65, `${tooth.id} calibrated scale and bounded crown refinement (${change})`); report.maxBoundingBoxChangeMm = Math.max(report.maxBoundingBoxChangeMm, change);
  base.rootGeometry.computeBoundingBox();
  report.maxRootBoundingBoxChangeMm = Math.max(report.maxRootBoundingBoxChangeMm, tooth.rootGeometry.boundingBox.min.distanceTo(base.rootGeometry.boundingBox.min), tooth.rootGeometry.boundingBox.max.distanceTo(base.rootGeometry.boundingBox.max));
  const outward = new THREE.Vector3(...tooth.buccal), anchor = new THREE.Vector3(...tooth.bracketPosition);
  const mesh = new THREE.Mesh(tooth.geometry, probeMaterial); mesh.updateMatrixWorld(true);
  const hit = new THREE.Raycaster(anchor.clone().addScaledVector(outward, 15), outward.clone().negate()).intersectObject(mesh)[0];
  assert.ok(hit, `${tooth.id} bracket raycast`); const clearance = anchor.clone().sub(hit.point).dot(outward);
  assert.ok(clearance > .1 && clearance < .34, `${tooth.id} bracket contact`);
  report.minBracketClearanceMm = Math.min(report.minBracketClearanceMm, clearance); report.maxBracketClearanceMm = Math.max(report.maxBracketClearanceMm, clearance);
  const attachment = createAttachmentGeometry(tooth, { shape: 'beveled', width: 2.5, height: 3.5, depth: 1, offsetMesial: 0, offsetOcclusal: 0, rotation: 0 }); attachment.dispose();
}
assert.equal(report.triangles, meta.assetInfo.triangles.total);
assert.ok(report.triangles <= 250000, 'Browser triangle budget');
report.originalCrownCrossings = findSurfaceIntersections(model, {});
report.referenceOcclusionCrossings = findSurfaceIntersections(model, Object.fromEntries(model.teeth.map(tooth => [tooth.id, { translation: [0, Number(tooth.id[0]) < 3 ? -CASE_REFERENCE_SHIFT : CASE_REFERENCE_SHIFT, 0], rotation: [0, 0, 0] }])));
const fixed = createApplianceKit(); for (const tooth of model.teeth) assert.ok(fixed.bracket(tooth), `${tooth.id} fixed bracket`); fixed.dispose();
const overlay = createWorkflowAppliances(model);
for (const appliance of ['braces', 'palatal-expander', 'archwire-expansion']) for (const phase of ['brackets', 'wire', 'retention']) {
  overlay.update({}, { appliance, phase, progress: .5, arrows: false, palate: false });
  report.applianceChecks.push(`${appliance}/${phase}`);
}
overlay.dispose();
const removable = createRemovableRetainer(model); removable.update({}, { visible: true });
removable.group.traverse(object => { if (object.name.startsWith('clear-pocket-')) { assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite)); report.removableRetainerPockets++; } });
assert.equal(report.removableRetainerPockets, 28); removable.dispose();
const anatomy = createTeachingAnatomy(model);
for (const selected of ['11', '13', '14', '16', '31', '36']) {
  anatomy.update({}, { bone: true, opacity: .3, cutaway: true, ligament: true }, { selected, roots: true, gums: true });
  assert.ok(!anatomy.bounds.isEmpty()); assert.ok(anatomy.labels.length >= 4); report.cutawayChecks.push(selected);
}
anatomy.dispose(); probeMaterial.dispose();
for (const item of [model, original]) { item.teeth.forEach(t => { t.geometry.dispose(); t.rootGeometry?.dispose(); }); item.gums.forEach(g => g.geometry.dispose()); }
for (const mesh of meshes) mesh.geometry.dispose();
writeFileSync(resolve('assets/anatomy/verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
