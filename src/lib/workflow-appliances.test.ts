import { afterAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createOrthodonticDemo } from './demo';
import {
  createWorkflowAppliances,
  workflowFixedVisibility,
  type WorkflowViewState,
} from './workflow-appliances';
import type { Transforms } from './model';
import { getWorkflowFrame, WORKFLOWS } from './workflows';
import { anatomicalFrame } from './model';
import { toothMatrix } from './analysis';

const model = createOrthodonticDemo();
afterAll(() => {
  model.teeth.forEach(t => {
    t.geometry.dispose();
    t.rootGeometry?.dispose();
  });
  model.gums.forEach(g => g.geometry.dispose());
});
const workflow = (override: Partial<WorkflowViewState> = {}): WorkflowViewState => ({
  appliance: 'palatal-expander',
  phase: 'wire',
  progress: 0,
  arrows: false,
  palate: false,
  ...override,
});
const meshes = (group: THREE.Group) =>
  group.children.filter(child => child instanceof THREE.Mesh) as THREE.Mesh[];
const names = (group: THREE.Group) => group.children.map(child => child.name);

describe('staged fixed-appliance visibility', () => {
  it.each(['braces', 'archwire-expansion'] as const)(
    'separates bracket installation, wire engagement and retention for %s',
    appliance => {
      expect(workflowFixedVisibility(workflow({ appliance, phase: 'assessment' }))).toEqual({
        brackets: false,
        wires: false,
        ligatures: false,
      });
      expect(workflowFixedVisibility(workflow({ appliance, phase: 'brackets' }))).toEqual({
        brackets: true,
        wires: false,
        ligatures: false,
      });
      for (const phase of ['wire', 'forces', 'movement'] as const)
        expect(workflowFixedVisibility(workflow({ appliance, phase }))).toEqual({
          brackets: true,
          wires: true,
          ligatures: true,
        });
      expect(workflowFixedVisibility(workflow({ appliance, phase: 'retention' }))).toEqual({
        brackets: false,
        wires: false,
        ligatures: false,
      });
    },
  );

  it('never overlays ordinary braces in a palatal-expander workflow', () => {
    for (const phase of [
      'assessment',
      'brackets',
      'wire',
      'forces',
      'movement',
      'retention',
    ] as const)
      expect(workflowFixedVisibility(workflow({ phase }))).toEqual({
        brackets: false,
        wires: false,
        ligatures: false,
      });
  });

  it('restores normal wire and ligature visibility when leaving bracket-only instruction', () => {
    expect(
      workflowFixedVisibility(workflow({ appliance: 'braces', phase: 'brackets' }), true).ligatures,
    ).toBe(false);
    expect(workflowFixedVisibility(undefined, true)).toEqual({
      brackets: true,
      wires: true,
      ligatures: true,
    });
    expect(workflowFixedVisibility(undefined, false)).toEqual({
      brackets: false,
      wires: false,
      ligatures: false,
    });
  });

  it('respects an explicit hide-braces command during each appliance installation phase', () => {
    for (const phase of ['brackets', 'wire', 'forces', 'movement'] as const)
      expect(workflowFixedVisibility(workflow({ appliance: 'braces', phase }), false)).toEqual({
        brackets: false,
        wires: false,
        ligatures: false,
      });
  });
});

describe('schematic palatal expander', () => {
  it('starts without hardware and installs only the two molar bands in the band phase', () => {
    const kit = createWorkflowAppliances(model);
    kit.update({}, workflow({ phase: 'assessment' }));
    expect(kit.group.visible).toBe(false);
    expect(kit.group.children).toHaveLength(0);
    kit.update({}, workflow({ phase: 'brackets' }));
    expect(names(kit.group).sort()).toEqual(['molar-band-16', 'molar-band-26']);
    expect(kit.group.visible).toBe(true);
    kit.dispose();
  });

  it('shows bands, four tooth-anchored arms, paired guide rails and a transverse jackscrew', () => {
    const kit = createWorkflowAppliances(model);
    kit.update({}, workflow());
    const present = names(kit.group);
    expect(present.filter(name => name.startsWith('molar-band'))).toHaveLength(2);
    expect(present.filter(name => name.startsWith('palatal-arm'))).toHaveLength(4);
    expect(present.filter(name => name.startsWith('guide-rail'))).toHaveLength(2);
    expect(present).toContain('jackscrew-shaft');
    expect(present).toContain('jackscrew-thread');
    for (const item of meshes(kit.group))
      expect(Array.from(item.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(
        true,
      );
    expect(kit.group.userData.schematic).toBe(true);
    kit.dispose();
  });

  it('makes closed, outward band meshes without altering any source crown coordinates', () => {
    const source = model.teeth.find(t => t.id === '16')!,
      before = Array.from(source.geometry.getAttribute('position').array);
    const kit = createWorkflowAppliances(model);
    kit.update({}, workflow({ phase: 'brackets' }));
    for (const band of meshes(kit.group)) {
      const vertices = band.geometry.getAttribute('position'),
        index = band.geometry.index!,
        edges = new Map<string, number>();
      let volume = 0;
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(vertices, ids[0]);
        b.fromBufferAttribute(vertices, ids[1]);
        c.fromBufferAttribute(vertices, ids[2]);
        volume += a.dot(b.cross(c)) / 6;
        for (let side = 0; side < 3; side++) {
          const edge = [ids[side], ids[(side + 1) % 3]].sort((a, b) => a - b).join(':');
          edges.set(edge, (edges.get(edge) || 0) + 1);
        }
      }
      expect(volume).toBeGreaterThan(1);
      expect([...edges.values()].every(count => count === 2)).toBe(true);
    }
    expect(Array.from(source.geometry.getAttribute('position').array)).toEqual(before);
    kit.dispose();
  });

  it('keeps each arm end registered to its molar under combined tooth translation and rotation', () => {
    const kit = createWorkflowAppliances(model);
    kit.update({}, workflow());
    const first = kit.group.getObjectByName('palatal-arm-16-1')!;
    const original = new THREE.Vector3().fromArray(first.userData.endpoints[1]);
    const tooth = model.teeth.find(t => t.id === '16')!,
      translation = new THREE.Vector3(1.2, -0.7, 2.3);
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0.25, -0.2));
    const transforms: Transforms = {
      '16': {
        translation: translation.toArray(),
        rotation: [0.15, 0.25, -0.2].map(THREE.MathUtils.radToDeg) as [number, number, number],
      },
    };
    kit.update(transforms, workflow({ progress: 0.4 }));
    const moved = new THREE.Vector3().fromArray(
      kit.group.getObjectByName('palatal-arm-16-1')!.userData.endpoints[1],
    );
    const expected = original
      .sub(new THREE.Vector3(...tooth.position))
      .applyQuaternion(quaternion)
      .add(new THREE.Vector3(...tooth.position))
      .add(translation);
    expect(moved.distanceTo(expected)).toBeLessThan(1e-8);
    expect(
      kit.group
        .getObjectByName('molar-band-16')!
        .position.distanceTo(new THREE.Vector3(...tooth.position).add(translation)),
    ).toBeLessThan(1e-8);
    kit.dispose();
  });

  it('separates the two screw blocks and illustrative palate halves without modifying dental meshes', () => {
    const kit = createWorkflowAppliances(model);
    kit.update({}, workflow({ palate: true }));
    const initialBlockGap =
      kit.group.getObjectByName('screw-block-26')!.position.x -
      kit.group.getObjectByName('screw-block-16')!.position.x;
    const originalCenters = model.teeth.map(t => [...t.position]);
    kit.update({}, workflow({ progress: 1, palate: true }));
    const finalBlockGap =
      kit.group.getObjectByName('screw-block-26')!.position.x -
      kit.group.getObjectByName('screw-block-16')!.position.x;
    expect(finalBlockGap).toBeGreaterThan(initialBlockGap);
    const right = kit.group.getObjectByName('schematic-palate-right')!,
      left = kit.group.getObjectByName('schematic-palate-left')!;
    expect(right.position.x).toBeLessThan(0);
    expect(left.position.x).toBeGreaterThan(0);
    expect(model.teeth.map(t => t.position)).toEqual(originalCenters);
    kit.dispose();
  });

  it('shows opposing transverse arrows during explanation/movement, and none during passive retention', () => {
    const kit = createWorkflowAppliances(model);
    kit.update({}, workflow({ phase: 'forces', arrows: true }));
    expect(kit.group.getObjectByName('expansion-direction--1-shaft')!.userData.direction).toEqual([
      -1, 0, 0,
    ]);
    expect(kit.group.getObjectByName('expansion-direction-1-shaft')!.userData.direction).toEqual([
      1, 0, 0,
    ]);
    kit.update({}, workflow({ phase: 'retention', progress: 1, arrows: true }));
    expect(names(kit.group).some(name => name.startsWith('expansion-direction'))).toBe(false);
    expect(names(kit.group)).toContain('jackscrew-shaft');
    kit.dispose();
  });
});

describe('arch-specific workflow overlays and cleanup', () => {
  it('accepts every authored teaching frame, including moving and final endpoints', () => {
    const kit = createWorkflowAppliances(model);
    for (const definition of WORKFLOWS)
      for (const [index, step] of definition.steps.entries())
        for (const progress of step.phase === 'movement' ? [0, 0.5, 1] : [0]) {
          const frame = getWorkflowFrame(definition, index, progress, model.teeth);
          expect(() => kit.update(frame.transforms, frame, { arch: step.arch })).not.toThrow();
          for (const item of meshes(kit.group))
            expect(Array.from(item.matrixWorld.elements).every(Number.isFinite)).toBe(true);
          if (frame.appliance === 'palatal-expander' && frame.phase !== 'assessment')
            expect(kit.group.getObjectByName('molar-band-16')).toBeDefined();
        }
    kit.update({}, undefined);
    expect(kit.group.children).toHaveLength(0);
    expect(kit.group.visible).toBe(false);
    kit.dispose();
  });

  it('shows a schematic lingual retainer after removing braces, with lower jaw display opening applied once', () => {
    const kit = createWorkflowAppliances(model);
    const retention = workflow({ appliance: 'braces', phase: 'retention' });
    kit.update({}, retention, { arch: 'lower', opening: 0 });
    expect(names(kit.group).filter(name => name.startsWith('lingual-retainer'))).toEqual([
      'lingual-retainer-lower',
    ]);
    const original = kit.group.getObjectByName('retainer-pad-31')!.position.clone();
    kit.update({}, retention, { arch: 'lower', opening: 8 });
    expect(
      kit.group
        .getObjectByName('retainer-pad-31')!
        .position.distanceTo(original.add(new THREE.Vector3(0, -8, 0))),
    ).toBeLessThan(1e-8);
    expect(names(kit.group).filter(name => name.startsWith('retainer-pad'))).toHaveLength(6);
    kit.dispose();
  });

  it('keeps flattened composite bonds on the lingual surface and around the wire under movement', () => {
    const kit = createWorkflowAppliances(model),
      opening = 5;
    const transforms: Transforms = {
      '11': { translation: [1, 0.5, -0.7], rotation: [12, -8, 3] },
      '31': { translation: [-0.6, 1, 0.8], rotation: [-7, 9, -4] },
    };
    kit.update(transforms, workflow({ appliance: 'braces', phase: 'retention' }), { opening });
    const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    for (const arch of ['upper', 'lower'] as const) {
      const wire = kit.group.getObjectByName(
        `lingual-retainer-${arch}`,
      ) as THREE.Mesh<THREE.TubeGeometry>;
      const anchors = (wire.geometry.parameters.path as THREE.CatmullRomCurve3).points;
      const ids =
        arch === 'upper'
          ? ['13', '12', '11', '21', '22', '23']
          : ['43', '42', '41', '31', '32', '33'];
      ids.forEach((id, i) => {
        const tooth = model.teeth.find(t => t.id === id)!,
          frame = anatomicalFrame(tooth),
          matrix = toothMatrix(tooth, transforms);
        const pad = kit.group.getObjectByName(`retainer-pad-${id}`) as THREE.Mesh<
          THREE.SphereGeometry,
          THREE.MeshPhysicalMaterial
        >;
        const inward = new THREE.Vector3(...frame.buccal).negate(),
          normal = inward.clone().transformDirection(matrix);
        expect(
          new THREE.Vector3(0, 0, 1).applyQuaternion(pad.quaternion).distanceTo(normal),
        ).toBeLessThan(1e-8);
        expect(
          new THREE.Vector3(0, 1, 0)
            .applyQuaternion(pad.quaternion)
            .distanceTo(new THREE.Vector3(...frame.occlusal).transformDirection(matrix)),
        ).toBeLessThan(1e-8);
        expect(pad.material.metalness).toBe(0);
        expect(pad.scale.z).toBeLessThan(pad.scale.x);
        expect(pad.worldToLocal(anchors[i].clone()).length()).toBeLessThan(
          pad.geometry.parameters.radius,
        );
        const local = pad.position.clone();
        if (arch === 'lower') local.y += opening;
        local.applyMatrix4(matrix.clone().invert());
        const crown = new THREE.Mesh(tooth.geometry, probeMaterial);
        crown.updateMatrixWorld(true);
        const hit = new THREE.Raycaster(
          local.clone().addScaledVector(inward, 20),
          inward.clone().negate(),
        ).intersectObject(crown)[0];
        expect(hit).toBeDefined();
        const gap = local.sub(hit.point).dot(inward);
        expect(gap).toBeGreaterThan(0);
        expect(gap).toBeLessThan(pad.geometry.parameters.radius * pad.scale.z);
      });
    }
    probeMaterial.dispose();
    kit.dispose();
  });

  it('keeps archwire expansion dental-only and directs its four arrows buccally', () => {
    const kit = createWorkflowAppliances(model);
    kit.update(
      {},
      workflow({ appliance: 'archwire-expansion', phase: 'forces', arrows: true, palate: true }),
    );
    expect(names(kit.group).some(name => /palate|screw|band/.test(name))).toBe(false);
    for (const id of ['14', '16', '24', '26']) {
      const arrow = kit.group.getObjectByName(`tooth-direction-${id}-shaft`)!;
      expect(
        new THREE.Vector3(...arrow.userData.direction).distanceTo(
          new THREE.Vector3(...model.teeth.find(t => t.id === id)!.buccal),
        ),
      ).toBeLessThan(1e-10);
    }
    kit.dispose();
  });

  it('uses actual correction direction for crowded-incisor teaching arrows', () => {
    const kit = createWorkflowAppliances(model);
    kit.update(
      { '11': { translation: [1, 0, 2], rotation: [0, 0, 0] } },
      workflow({ appliance: 'braces', phase: 'forces', arrows: true }),
    );
    const direction = new THREE.Vector3(
      ...kit.group.getObjectByName('tooth-direction-11-shaft')!.userData.direction,
    );
    expect(direction.distanceTo(new THREE.Vector3(-1, 0, -2).normalize())).toBeLessThan(1e-10);
    kit.dispose();
  });

  it('never invents expander overlays for imported models or a lower-only view', () => {
    const imported = createWorkflowAppliances({ ...model, demo: false });
    imported.update({}, workflow({ palate: true }));
    expect(imported.group.children).toHaveLength(0);
    expect(imported.group.visible).toBe(false);
    imported.dispose();
    const kit = createWorkflowAppliances(model);
    kit.update({}, workflow({ palate: true }), { arch: 'lower' });
    expect(kit.group.children).toHaveLength(0);
    kit.dispose();
  });

  it('disposes replaced dynamic geometry and all remaining owned resources exactly once', () => {
    const kit = createWorkflowAppliances(model);
    kit.update({}, workflow({ palate: true }));
    const first = meshes(kit.group),
      staticGeometry = new Set(
        first.filter(m => /molar-band|schematic-palate/.test(m.name)).map(m => m.geometry),
      );
    const replaced = [...new Set(first.map(m => m.geometry))]
      .filter(g => !staticGeometry.has(g))
      .map(g => vi.spyOn(g, 'dispose'));
    const stable = [...staticGeometry].map(g => vi.spyOn(g, 'dispose'));
    const sourceDispose = vi.spyOn(model.teeth[0].geometry, 'dispose');
    kit.update({}, workflow({ phase: 'movement', progress: 0.5, palate: true, arrows: true }));
    replaced.forEach(spy => expect(spy).toHaveBeenCalledOnce());
    stable.forEach(spy => expect(spy).not.toHaveBeenCalled());
    const current = meshes(kit.group),
      dynamic = [...new Set(current.map(m => m.geometry))]
        .filter(g => !staticGeometry.has(g))
        .map(g => vi.spyOn(g, 'dispose'));
    const materials = [
      ...new Set(current.flatMap(m => (Array.isArray(m.material) ? m.material : [m.material]))),
    ].map(m => vi.spyOn(m, 'dispose'));
    kit.dispose();
    kit.dispose();
    [...replaced, ...stable, ...dynamic, ...materials].forEach(spy =>
      expect(spy).toHaveBeenCalledOnce(),
    );
    expect(sourceDispose).not.toHaveBeenCalled();
    sourceDispose.mockRestore();
  });

  it.each([-1, 1.01, NaN, Infinity])(
    'rejects invalid progress %s without leaving old overlays behind',
    progress => {
      const kit = createWorkflowAppliances(model);
      kit.update({}, workflow());
      expect(() => kit.update({}, workflow({ progress }))).toThrow(/progress/);
      expect(kit.group.children).toHaveLength(0);
      kit.dispose();
    },
  );
});
