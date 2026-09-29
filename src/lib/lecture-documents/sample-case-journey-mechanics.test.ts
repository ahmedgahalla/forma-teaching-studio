import { readFileSync } from 'node:fs';
import { Mesh, TubeGeometry, ExtrudeGeometry, Vector3, type CatmullRomCurve3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { getTeachingAssetCase } from '../anatomy-assets';
import { dentalCaseFromAtlas } from '../atlas-assets';
import type { DentalCase } from '../geometry';
import { findSurfaceIntersections } from '../analysis';
import { interpolateTransforms } from '../planning';
import { solveMechanics, transitionMechanics, validateMechanicsExperiment } from '../mechanics';
import { rotateLocal } from '../mechanics/state';
import { createMechanicsVisuals } from '../mechanics-view';
import { createWorkflowAppliances } from '../workflow-appliances';
import { applianceView } from '../appliance-display';
import { caseJourneyScenes } from './sample-case-journey-scenes';

vi.mock('../anatomy-assets', async importOriginal => ({
  ...(await importOriginal<typeof import('../anatomy-assets')>()),
  getTeachingAssetCase: vi.fn(),
}));
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
  vi.mocked(getTeachingAssetCase).mockReturnValue(atlas);
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
  atlas.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  atlas.gums.forEach(gum => gum.geometry.dispose());
});

it('keeps passive full-upper wire neutral and produces a bounded nonzero active response on actual Atlas', () => {
  const { passiveWire, activeWire } = caseJourneyScenes();
  const passive = validateMechanicsExperiment(passiveWire.mechanics!, atlas);
  const active = validateMechanicsExperiment(activeWire.mechanics!, atlas);
  expect(passive.config.wires[0].teeth).toHaveLength(14);
  expect(passive.reference.transforms).toEqual(passiveWire.transforms);
  expect(active.reference).toEqual(passive.reference);
  expect(passive.config.wires[0].expansionMm).toBe(0);
  expect(active.config.wires[0]).toMatchObject({
    material: 'stainless-steel',
    section: { shape: 'round', diameterMm: 0.35 },
    expansionMm: 0.15,
    torqueDeg: 0,
  });
  const before = structuredClone(active);
  expect(solveMechanics(passive).diagnostics.maxDisplacementMm).toBe(0);
  expect(() => transitionMechanics(passive, { type: 'solve' })).toThrow(/activation/);
  expect(() => transitionMechanics(active, { type: 'solve' })).not.toThrow();
  const response = solveMechanics(active);
  expect(response.diagnostics.maxDisplacementMm).toBeGreaterThan(1e-5);
  expect(response.diagnostics.maxDisplacementMm).toBeLessThan(0.1);
  expect(response.wires[0].maxStrain).toBeGreaterThan(0);
  expect(
    response.teeth
      .filter(tooth => Number(tooth.id[0]) > 2)
      .every(tooth => tooth.displacementMm.every(value => value === 0)),
  ).toBe(true);
  const existing = new Set(
    findSurfaceIntersections(atlas, active.reference.transforms).map(pair => `${pair.a}/${pair.b}`),
  );
  for (let sample = 1; sample <= 6; sample++) {
    const pairs = findSurfaceIntersections(
      atlas,
      interpolateTransforms(active.reference.transforms, response.transforms, sample / 6),
    );
    expect(pairs.filter(pair => !existing.has(`${pair.a}/${pair.b}`))).toEqual([]);
  }
  expect(active).toEqual(before);
  expect(activeWire.mechanics!.result).toBeNull();
});

it('renders round and rectangular scene wires through their declared Atlas bracket slots', () => {
  const scenes = caseJourneyScenes();
  for (const name of ['passiveWire', 'activeWire', 'review'] as const) {
    const scene = scenes[name];
    const experiment = scene.mechanics!;
    const wire = experiment.config.wires[0];
    expect(scene.setup.wirePreset).toEqual({ material: wire.material, section: wire.section });
    const kit = createMechanicsVisuals(atlas);
    try {
      kit.update(experiment, scene.transforms, {
        arch: scene.setup.arch,
        opening: 0,
        jawOpen: scene.setup.jawOpen,
        forces: false,
        revealed: false,
        visible: () => true,
      });
      expect(kit.group.children).toHaveLength(1);
      const geometry = (kit.group.children[0] as Mesh).geometry as TubeGeometry | ExtrudeGeometry;
      const path =
        geometry instanceof TubeGeometry
          ? (geometry.parameters.path as CatmullRomCurve3)
          : (geometry.parameters.options.extrudePath as CatmullRomCurve3);
      expect(path.points).toHaveLength(14);
      for (const [index, id] of wire.teeth.entries()) {
        const tooth = experiment.reference.teeth.find(item => item.id === id)!;
        const expected = new Vector3(...rotateLocal(tooth.bracketLocal, tooth.rotation)).add(
          new Vector3(...tooth.position),
        );
        expect(path.points[index].distanceTo(expected)).toBeLessThan(1e-9);
      }
      if (name === 'review') {
        expect(geometry).toBeInstanceOf(ExtrudeGeometry);
        expect(wire.section).toEqual({ shape: 'rectangle', widthMm: 0.635, heightMm: 0.432 });
        const rectangle = (geometry as ExtrudeGeometry).parameters.shapes;
        expect(Array.isArray(rectangle)).toBe(false);
        if (!Array.isArray(rectangle)) {
          const points = rectangle.getPoints();
          const xs = points.map(point => point.x),
            ys = points.map(point => point.y);
          expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.635, 12);
          expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.432, 12);
        }
        expect(solveMechanics(experiment).diagnostics.maxDisplacementMm).toBe(0);
      } else {
        expect(geometry).toBeInstanceOf(TubeGeometry);
        expect((geometry as TubeGeometry).parameters.radius).toBe(0.175);
      }
    } finally {
      kit.dispose();
    }
  }
});

it('shows bands, then the actual expander assembly, and finally only upper retention hardware', () => {
  const scenes = caseJourneyScenes();
  const kit = createWorkflowAppliances(atlas);
  try {
    const show = (name: 'bands' | 'expander' | 'retention' | 'debond') => {
      const scene = scenes[name];
      kit.update(scene.transforms, applianceView(scene.applianceDisplay), {
        arch: scene.setup.arch,
        jawOpen: scene.setup.jawOpen,
      });
      return kit.group.children.map(object => object.name);
    };
    expect(show('bands').sort()).toEqual(['molar-band-16', 'molar-band-26']);
    const expanded = show('expander');
    expect(expanded).toContain('jackscrew-shaft');
    expect(expanded).toContain('jackscrew-thread');
    expect(expanded.filter(name => name.startsWith('palatal-arm'))).toHaveLength(4);
    expect(show('debond')).toEqual([]);
    const retained = show('retention');
    expect(retained).toContain('lingual-retainer-upper');
    expect(retained.filter(name => name.startsWith('retainer-pad-'))).toHaveLength(6);
    expect(retained.every(name => !name.includes('lower') && !name.includes('jackscrew'))).toBe(
      true,
    );
  } finally {
    kit.dispose();
  }
});
