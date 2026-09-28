import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createOrthodonticDemo } from './demo';
import { createMechanicsVisuals } from './mechanics-view';
import { createMechanicsExperiment } from './mechanics/state';
import { solveMechanics } from './mechanics/solver';
import { createRemovableRetainer } from './removable-retainer';
import { createWorkflowAppliances, type WorkflowViewState } from './workflow-appliances';
import { createTeachingAnatomy, DEFAULT_ANATOMY } from './teaching-anatomy';
import type { Transforms, Vec3 } from './model';

const model = createOrthodonticDemo();
// Independent copy of the original Claude setJaw construction, not the production helper.
const rotation = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  (Math.PI * 14) / 180,
);
const hinge = new THREE.Vector3(0, 39.2, -77.8);
const opened = (point: THREE.Vector3, separation = 0) =>
  point
    .clone()
    .sub(hinge)
    .applyQuaternion(rotation)
    .add(hinge)
    .add(new THREE.Vector3(0, -separation, 0));
const vertex = (object: THREE.Object3D, index = 0) =>
  new THREE.Vector3()
    .fromBufferAttribute((object as THREE.Mesh).geometry.getAttribute('position'), index)
    .applyMatrix4(object.matrixWorld);
const close = (a: THREE.Vector3, b: THREE.Vector3, tolerance = 1e-8) =>
  expect(a.distanceTo(b)).toBeLessThan(tolerance);
afterAll(() => {
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

describe('hinged lower-jaw teaching overlays', () => {
  it('keeps fixed lingual wires and bond orientations on posed teeth, leaving the upper arch unchanged', () => {
    const kit = createWorkflowAppliances(model),
      workflow: WorkflowViewState = {
        appliance: 'braces',
        phase: 'retention',
        progress: 1,
        arrows: false,
        palate: false,
      },
      poses: Transforms = { '31': { translation: [1, 2, -1], rotation: [12, -8, 5] } };
    kit.update(poses, workflow);
    const pad = kit.group.getObjectByName('retainer-pad-31')!,
      before = pad.position.clone(),
      orientation = pad.quaternion.clone(),
      upper = kit.group.getObjectByName('retainer-pad-11')!.position.clone(),
      wire = kit.group.getObjectByName('lingual-retainer-lower') as THREE.Mesh<THREE.TubeGeometry>,
      points = (wire.geometry.parameters.path as THREE.CatmullRomCurve3).points.map(point =>
        point.clone(),
      );
    kit.update(poses, workflow, { jawOpen: true, opening: 5 });
    const moved = kit.group.getObjectByName('retainer-pad-31')!,
      movedWire = kit.group.getObjectByName(
        'lingual-retainer-lower',
      ) as THREE.Mesh<THREE.TubeGeometry>;
    close(moved.position, opened(before, 5));
    expect(1 - Math.abs(moved.quaternion.dot(rotation.clone().multiply(orientation)))).toBeLessThan(
      1e-12,
    );
    close(kit.group.getObjectByName('retainer-pad-11')!.position, upper);
    (movedWire.geometry.parameters.path as THREE.CatmullRomCurve3).points.forEach((point, i) =>
      close(point, opened(points[i], 5)),
    );
    kit.update(poses, workflow, { jawOpen: false });
    close(kit.group.getObjectByName('retainer-pad-31')!.position, before);
    kit.dispose();
  });

  it('moves clear-retainer pockets and joining ribbons together without replacing their buffers', () => {
    const kit = createRemovableRetainer(model),
      poses: Transforms = { '36': { translation: [1, 2, -1], rotation: [12, -8, 5] } };
    kit.update(poses, { visible: true });
    const names = ['clear-pocket-36', 'clear-margin-36', 'clear-joins-lower', 'clear-border-lower'];
    const entries = names.map(name => {
      const object = kit.group.getObjectByName(name)!;
      return { object, point: vertex(object), geometry: (object as THREE.Mesh).geometry };
    });
    const upper = vertex(kit.group.getObjectByName('clear-pocket-16')!);
    kit.update(poses, { visible: true, jawOpen: true, opening: 7 });
    entries.forEach(({ object, point, geometry }) => {
      close(vertex(object), opened(point, 7), 1e-5);
      expect((object as THREE.Mesh).geometry).toBe(geometry);
    });
    close(vertex(kit.group.getObjectByName('clear-pocket-16')!), upper);
    kit.dispose();
  });

  it('keeps cutaway tissues, labels and crop planes rigid while tooth poses stay independent', () => {
    const kit = createTeachingAnatomy(model),
      state = { ...DEFAULT_ANATOMY, bone: true, ligament: true, cutaway: true },
      poses: Transforms = { '31': { translation: [1, 2, -1], rotation: [12, -8, 5] } };
    kit.update(poses, state, { selected: '31' });
    const labels = kit.labels.map(label => label.position.clone()),
      point = vertex(kit.group.getObjectByName('bone-31-0')!),
      planes = kit.gumPlanes.map(plane => plane.clone());
    kit.update(poses, state, { selected: '31', jawOpen: true, opening: 6 });
    close(vertex(kit.group.getObjectByName('bone-31-0')!), opened(point, 6));
    kit.labels.forEach((label, i) => close(label.position, opened(labels[i], 6)));
    kit.gumPlanes.forEach((plane, i) => {
      close(plane.normal, planes[i].normal.clone().applyQuaternion(rotation));
      expect(
        Math.abs(plane.distanceToPoint(opened(planes[i].coplanarPoint(new THREE.Vector3()), 6))),
      ).toBeLessThan(1e-10);
    });
    for (const mesh of kit.group.children) {
      const positions = (mesh as THREE.Mesh).geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++)
        expect(kit.bounds.containsPoint(vertex(mesh, i))).toBe(true);
    }
    const referenceLabels = kit.labels.slice(2).map(label => label.position.clone());
    kit.update({}, state, { selected: '31', jawOpen: true, opening: 6 });
    kit.labels.slice(2).forEach((label, i) => close(label.position, referenceLabels[i]));
    close(vertex(kit.group.getObjectByName('bone-31-0')!), opened(point, 6));
    kit.dispose();
  });

  it('rotates mechanics wires, TAD axes and force/moment illustrations without changing the experiment', () => {
    const kit = createMechanicsVisuals(model),
      experiment = createMechanicsExperiment(model),
      lower = experiment.reference.teeth.find(tooth => tooth.id === '31')!,
      poses: Transforms = { '31': { translation: [1, 2, -1], rotation: [12, -8, 5] } };
    experiment.config.wires.push({
      id: 'lower',
      teeth: ['42', '41', '31'],
      material: 'stainless-steel',
      section: { shape: 'round', diameterMm: 0.4 },
      expansionMm: 0,
      torqueDeg: 0,
    });
    for (const id of ['42', '41', '31'])
      experiment.config.brackets[id] = experiment.reference.teeth.find(
        tooth => tooth.id === id,
      )!.bracketLocal;
    experiment.config.tads.push({
      id: 'lower-tad',
      position: new THREE.Vector3(...lower.position)
        .addScaledVector(new THREE.Vector3(...lower.buccal), 2)
        .toArray() as Vec3,
    });
    experiment.config.elastics.push({
      id: 'cross-arch',
      from: { kind: 'tooth', tooth: '11', local: [0, 0, 0] },
      to: { kind: 'tooth', tooth: '31', local: [0, 0, 0] },
      law: { kind: 'constant', forceN: 0.1 },
    });
    experiment.result = solveMechanics(experiment);
    experiment.result.teeth.forEach(tooth => {
      tooth.forceN = tooth.id === '31' ? [0.2, 0.5, 0.3] : [0, 0, 0];
      tooth.momentNmm = tooth.id === '31' ? [0.4, -0.3, 0.1] : [0, 0, 0];
    });
    const original = structuredClone(experiment),
      display = {
        arch: 'both' as const,
        opening: 0,
        forces: true,
        revealed: true,
        visible: () => true,
      };
    kit.update(experiment, poses, display);
    const find = <T extends THREE.Object3D>(predicate: (object: THREE.Object3D) => boolean) =>
      kit.group.children.find(predicate) as T;
    const tube = () =>
        find<THREE.Mesh<THREE.TubeGeometry>>(
          object => (object as THREE.Mesh).geometry instanceof THREE.TubeGeometry,
        ),
      shaft = () =>
        find<THREE.Mesh<THREE.CylinderGeometry>>(
          object => (object as THREE.Mesh).geometry instanceof THREE.CylinderGeometry,
        ),
      arrow = () => find<THREE.ArrowHelper>(object => object instanceof THREE.ArrowHelper),
      arc = () => find<THREE.Line>(object => object instanceof THREE.Line),
      elastic = () =>
        find<THREE.Mesh<THREE.TubeGeometry>>(
          object =>
            (object as THREE.Mesh<THREE.TubeGeometry>).geometry?.parameters?.path instanceof
            THREE.CurvePath,
        );
    const wirePoints = (tube().geometry.parameters.path as THREE.CatmullRomCurve3).points.map(
        point => point.clone(),
      ),
      shaftPosition = shaft().position.clone(),
      shaftAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(shaft().quaternion),
      forcePosition = arrow().position.clone(),
      forceAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow().quaternion),
      momentPoint = vertex(arc()),
      upperElastic = elastic().geometry.parameters.path.getPoint(0),
      lowerElastic = elastic().geometry.parameters.path.getPoint(1);
    kit.update(experiment, poses, { ...display, jawOpen: true, opening: 4 });
    (tube().geometry.parameters.path as THREE.CatmullRomCurve3).points.forEach((point, i) =>
      close(point, opened(wirePoints[i], 4)),
    );
    close(shaft().position, opened(shaftPosition, 4));
    close(
      new THREE.Vector3(0, 1, 0).applyQuaternion(shaft().quaternion),
      shaftAxis.applyQuaternion(rotation),
    );
    close(arrow().position, opened(forcePosition, 4));
    close(
      new THREE.Vector3(0, 1, 0).applyQuaternion(arrow().quaternion),
      forceAxis.applyQuaternion(rotation),
    );
    close(vertex(arc()), opened(momentPoint, 4), 1e-5);
    close(elastic().geometry.parameters.path.getPoint(0), upperElastic);
    close(elastic().geometry.parameters.path.getPoint(1), opened(lowerElastic, 4));
    expect(experiment).toEqual(original);
    kit.dispose();
  });
});
