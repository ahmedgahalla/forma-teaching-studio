// Run from the project root: node --experimental-strip-types scripts/audit-teaching-cases.mjs
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

registerHooks({ resolve(specifier, context, next) { return next(specifier.startsWith('.') && !path.extname(specifier) ? `${specifier}.ts` : specifier, context); } });
const load = name => import(pathToFileURL(path.resolve(`src/lib/${name}.ts`)));
const { dentalCaseFromAsset } = await load('anatomy-assets');
const { createTeachingCase, sampleCaseDemonstration, TEACHING_CASES, CASE_REFERENCE_SHIFT } = await load('teaching-cases');
const { findSurfaceIntersections } = await load('analysis');
const sourceBytes = readFileSync('src/lib/teaching-cases.ts');
const assetFile = 'public/models/forma-teaching-v1.glb', metadataFile = 'public/models/forma-teaching-v1.json';
const bytes = readFileSync(assetFile), rawMetadata = readFileSync(metadataFile);
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const base = dentalCaseFromAsset(gltf.scene, JSON.parse(rawMetadata.toString('utf8')));
const reference = createTeachingCase(base, 'reference-occlusion').model;
const rootModel = model => ({ ...model, teeth: model.teeth.map(tooth => ({ ...tooth, geometry: tooth.rootGeometry })) });
const references = { crowns: findSurfaceIntersections(reference, {}), roots: findSurfaceIntersections(rootModel(reference), {}) };
const pairKey = pair => `${pair.a}/${pair.b}`;
const cache = new Map();

// Unchanged pairs have exactly their registered reference poses. Reuse their
// measured result; still run the same exact triangle test for every changed pair.
function intersections(model, transforms, component) {
  const teeth = (component === 'roots' ? rootModel(model) : model).teeth;
  const present = new Set(teeth.map(tooth => tooth.id));
  const changed = new Set(Object.entries(transforms).filter(([, value]) => [...value.translation, ...value.rotation].some(n => Math.abs(n) > 1e-12)).map(([id]) => id));
  const cacheKey = JSON.stringify([component, [...present], transforms]);
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const pairs = references[component].filter(pair => present.has(pair.a) && present.has(pair.b) && !changed.has(pair.a) && !changed.has(pair.b));
  for (let i = 0; i < teeth.length; i++) for (let j = i + 1; j < teeth.length; j++) {
    if (!changed.has(teeth[i].id) && !changed.has(teeth[j].id)) continue;
    pairs.push(...findSurfaceIntersections({ ...model, teeth: [teeth[i], teeth[j]] }, transforms));
  }
  pairs.sort((a, b) => pairKey(a).localeCompare(pairKey(b))); cache.set(cacheKey, pairs); return pairs;
}

const samples = [0, .125, .25, .375, .5, .625, .75, .875, 1], cases = {};
try {
  console.log(JSON.stringify({ reference: references }));
  for (const definition of TEACHING_CASES) {
    const prepared = createTeachingCase(base, definition.id);
    const baseline = { crownPairs: intersections(prepared.model, prepared.transforms, 'crowns'), rootPairs: intersections(prepared.model, prepared.transforms, 'roots') };
    const variants = {};
    for (const variant of definition.variants) {
      const progressSamples = [...new Set([...samples, ...variant.keyframes.map(item => item.progress)])].sort((a, b) => a - b);
      const frames = progressSamples.map(progress => {
        const transforms = sampleCaseDemonstration(definition.id, variant.id, progress);
        const crownPairs = intersections(prepared.model, transforms, 'crowns'), rootPairs = intersections(prepared.model, transforms, 'roots');
        return { progress, crownPairs, rootPairs,
          newCrownPairs: crownPairs.filter(pair => !baseline.crownPairs.some(initial => pairKey(initial) === pairKey(pair))),
          newRootPairs: rootPairs.filter(pair => !baseline.rootPairs.some(initial => pairKey(initial) === pairKey(pair))),
        };
      });
      variants[variant.id] = { sampleCount: frames.length, frames };
      console.log(JSON.stringify({ case: definition.id, variant: variant.id, counts: frames.map(item => ({ progress: item.progress, crowns: item.crownPairs.length, roots: item.rootPairs.length, newCrowns: item.newCrownPairs.length, newRoots: item.newRootPairs.length })) }));
    }
    cases[definition.id] = { baseline, variants };
  }
  const sha256 = data => createHash('sha256').update(data).digest('hex');
  const report = {
    version: 1, asset: { file: assetFile, sha256: sha256(bytes), metadataSha256: sha256(rawMetadata) },
    caseSourceSha256: sha256(sourceBytes), referenceShiftMm: CASE_REFERENCE_SHIFT,
    method: 'Exact triangle-surface intersections at nine uniformly spaced poses plus every authored keyframe; unchanged pairs reuse their measured registered-reference result.',
    limitation: 'Not swept collision detection. Crossings between samples, enclosed volumes, crown–root pairs, gingiva, bone and biological limits are not assessed. Empty pairs do not validate a movement or bite.',
    samples, reference: { crownPairs: references.crowns, rootPairs: references.roots }, cases,
  };
  if (!sourceBytes.equals(readFileSync('src/lib/teaching-cases.ts'))) throw new Error('Teaching cases changed during the audit; rerun before publishing.');
  writeFileSync('src/lib/teaching-case-audit.json', `${JSON.stringify(report, null, 2)}\n`);
} finally {
  base.teeth.forEach(tooth => { tooth.geometry.dispose(); tooth.rootGeometry?.dispose(); }); base.gums.forEach(gum => gum.geometry.dispose());
  gltf.scene.traverse(object => { if (object.isMesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose()); } });
}
