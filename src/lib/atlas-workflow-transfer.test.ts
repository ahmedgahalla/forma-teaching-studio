import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAtlas } from './atlas-assets';
import { supportsTeachingAnatomy } from './anatomy-capability';
import { initialWorkflowScene, workflowSceneStep } from './workflow-scene';
import { workflowAnatomyModel } from './workflow-anatomy-model';
import { assertPreparedWorkflowCompatible, captureWorkflowArrangement } from './workflow-transfer';
import { createTeachingCase } from './teaching-cases';
import { solveMechanics, validateMechanicsExperiment } from './mechanics';
import { MECHANICS_EXAMPLES } from './mechanics-examples/catalog';
import { createMechanicsExample } from './mechanics-examples/factory';
import type { DentalCase } from './geometry';
import type { Transforms } from './model';

let atlas: DentalCase;
beforeAll(async () => {
  const bytes = readFileSync('public/models/forma-atlas-v1.glb');
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  atlas = dentalCaseFromAtlas(
    scene,
    JSON.parse(readFileSync('public/models/forma-atlas-v1.json', 'utf8')),
  );
  scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material =>
      material.dispose(),
    );
  });
});
afterAll(() => {
  for (const model of [atlas, workflowAnatomyModel(atlas, 'anatomy')]) {
    model.teeth.forEach(tooth => {
      tooth.geometry.dispose();
      tooth.rootGeometry?.dispose();
    });
    model.gums.forEach(gum => gum.geometry.dispose());
  }
});

describe('atlas workflow transfers', () => {
  it.each(['fixed-braces', 'palatal-expansion', 'archwire-expansion'])(
    'keeps atlas materials, support limitations and registration when transferring %s',
    id => {
      const scene = workflowSceneStep(initialWorkflowScene(atlas, id), 4, atlas);
      const transferred = captureWorkflowArrangement({ ...scene, progress: 0.4 }, atlas);
      expect(transferred.model.asset).toBe('claude-atlas-v1');
      expect(supportsTeachingAnatomy(transferred.model)).toBe(false);
      expect(transferred.model.teeth[0].geometry).toBe(atlas.teeth[0].geometry);
      expect(transferred.model.teeth[0].geometry.hasAttribute('dentalData')).toBe(true);
      expect(
        createTeachingCase(transferred.model, 'reference-occlusion').model.teeth[0].position,
      ).toEqual(atlas.teeth[0].position);
      expect(() => assertPreparedWorkflowCompatible(transferred.model, atlas)).not.toThrow();
    },
  );

  it('transfers the separate schematic anatomy lesson against its own canonical geometry', () => {
    const scene = workflowSceneStep(initialWorkflowScene(atlas, 'anatomy'), 2, atlas);
    const transferred = captureWorkflowArrangement({ ...scene, progress: 0.5 }, atlas);
    expect(transferred.model.asset).toBeUndefined();
    expect(transferred.model.name).toBe('Schematic tooth and socket teaching model');
    expect(transferred.model.teeth[0].geometry).toBe(scene.model.teeth[0].geometry);
    expect(transferred.model.teeth[0].geometry).not.toBe(atlas.teeth[0].geometry);
    expect(supportsTeachingAnatomy(transferred.model)).toBe(true);
    expect(transferred.display.anatomy).toMatchObject({
      bone: true,
      ligament: true,
      cutaway: true,
    });
    expect(transferred.source.workflowId).toBe('anatomy');
    expect(transferred.transforms['11'].rotation.some(value => value !== 0)).toBe(true);
  });

  it('rejects an atlas setup with a lost asset identity before it can be transferred', () => {
    const scene = initialWorkflowScene(atlas);
    expect(() =>
      captureWorkflowArrangement({ ...scene, model: { ...atlas, asset: undefined } }, atlas),
    ).toThrow(/prepared workflow geometry/);
  });
});

describe('mechanics examples on the actual atlas geometry', () => {
  it.each(
    MECHANICS_EXAMPLES.flatMap(example =>
      example.variants.map(variant => [example.id, variant.id] as const),
    ),
  )('validates and solves %s / %s with real atlas attachments', (id, variant) => {
    const baseline: Transforms = {
      '46': { translation: [0.2, -0.1, 0.3], rotation: [8, 12, 4] },
    };
    const { experiment, targets } = createMechanicsExample(atlas, baseline, '46', {
      kind: 'mechanics-example',
      id,
      variant,
    });
    const ids = atlas.teeth.map(tooth => tooth.id);
    const { config } = experiment;
    expect(atlas.teeth.every(tooth => !tooth.rootAnatomy)).toBe(true);
    expect(validateMechanicsExperiment(experiment, atlas).config).toEqual(config);
    const toothReferences = [
      ...targets,
      ...Object.keys(config.brackets),
      ...config.fixedTeeth,
      ...config.wires.flatMap(wire => wire.teeth),
      ...config.expanders.flatMap(expander => [...expander.left, ...expander.right]),
    ];
    for (const elastic of config.elastics) {
      for (const endpoint of [elastic.from, elastic.to]) {
        if (endpoint.kind === 'tooth') toothReferences.push(endpoint.tooth);
        else expect(config.tads.map(tad => tad.id)).toContain(endpoint.id);
      }
    }
    expect(toothReferences.every(tooth => ids.includes(tooth))).toBe(true);
    const original = structuredClone(experiment);
    const response = solveMechanics(experiment);
    expectFiniteNumbers(response);
    expect(response.diagnostics.residual).toBeLessThan(1e-6);
    expect(Object.keys(response.transforms)).toEqual(ids);
    expect(response.teeth.map(tooth => tooth.id)).toEqual(ids);
    expect(solveMechanics(experiment)).toEqual(response);
    expect(experiment).toEqual(original);
    expect(experiment.reference.transforms['46']).toEqual(baseline['46']);
  });
});

function expectFiniteNumbers(value: unknown) {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (value && typeof value === 'object') Object.values(value).forEach(expectFiniteNumbers);
}
