import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { DentalCase, DentalTooth } from './geometry';
import { anatomicalFrame, type Transforms } from './model';
import { toothMatrix } from './analysis';
import { toothArch } from './appliances';

export type WorkflowViewState = {
  appliance: 'braces' | 'palatal-expander' | 'archwire-expansion';
  phase: 'assessment' | 'brackets' | 'wire' | 'forces' | 'movement' | 'retention';
  progress: number;
  arrows: boolean;
  palate: boolean;
};
type ViewOptions = { arch?: 'both' | 'upper' | 'lower'; opening?: number };

export function workflowFixedVisibility(workflow?: WorkflowViewState, normalBraces = true) {
  if (!workflow || !normalBraces)
    return { brackets: normalBraces, wires: normalBraces, ligatures: normalBraces };
  const brackets =
    workflow.appliance !== 'palatal-expander' &&
    workflow.phase !== 'assessment' &&
    workflow.phase !== 'retention';
  return {
    brackets,
    wires: brackets && workflow.phase !== 'brackets',
    ligatures: brackets && workflow.phase !== 'brackets',
  };
}

/**
 * Original schematic teaching overlays, ONLY for the synthetic demo. The visible
 * screw travel, arrows and palate gap are illustrative choreography, not screw
 * activation, force magnitude, a bone model, or a prediction of suture response.
 * No overlay geometry is added to the persisted/exported dental model.
 */
export function createWorkflowAppliances(model: DentalCase) {
  const group = new THREE.Group();
  group.name = 'workflow-appliances';
  group.visible = false;
  const ownedGeometries = new Set<THREE.BufferGeometry>(),
    dynamicGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownMaterial = <T extends THREE.Material>(material: T): T => {
    ownedMaterials.add(material);
    return material;
  };
  const steel = ownMaterial(
    new THREE.MeshStandardMaterial({ color: '#c7cdd2', metalness: 0.92, roughness: 0.24 }),
  );
  const satinSteel = ownMaterial(
    new THREE.MeshStandardMaterial({ color: '#b8c0c7', metalness: 0.9, roughness: 0.34 }),
  );
  const resin = ownMaterial(
    new THREE.MeshPhysicalMaterial({
      color: '#dcd8ca',
      roughness: 0.34,
      metalness: 0,
      clearcoat: 0.22,
      clearcoatRoughness: 0.3,
    }),
  );
  const gold = ownMaterial(
    new THREE.MeshStandardMaterial({
      color: '#f0b55d',
      roughness: 0.35,
      emissive: '#7a4c15',
      emissiveIntensity: 0.2,
    }),
  );
  const palateMaterial = ownMaterial(
    new THREE.MeshPhysicalMaterial({
      color: '#63a6bb',
      transparent: true,
      opacity: 0.23,
      roughness: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const probeMaterial = ownMaterial(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const teeth = new Map(model.teeth.map(tooth => [tooth.id, tooth]));
  const surfacePoints = new Map<string, THREE.Vector3>(),
    bands = new Map<string, THREE.BufferGeometry>();
  let palateGeometry: THREE.BufferGeometry | undefined,
    disposed = false;
  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T, dynamic = true): T => {
    ownedGeometries.add(geometry);
    if (dynamic) dynamicGeometries.add(geometry);
    return geometry;
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    parent: THREE.Object3D = group,
  ) => {
    const result = new THREE.Mesh(geometry, material);
    result.name = name;
    result.castShadow = material !== palateMaterial;
    parent.add(result);
    return result;
  };
  const tube = (
    points: THREE.Vector3[],
    radius: number,
    name: string,
    material: THREE.Material = steel,
  ) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const result = mesh(
      ownGeometry(
        new THREE.TubeGeometry(curve, Math.max(40, points.length * 2), radius, 12, false),
      ),
      material,
      name,
    );
    result.userData.endpoints = [points[0].toArray(), points[points.length - 1].toArray()];
    return result;
  };
  const cylinder = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    name: string,
    material: THREE.Material = steel,
  ) => {
    const direction = end.clone().sub(start),
      result = mesh(
        ownGeometry(new THREE.CylinderGeometry(radius, radius, direction.length(), 16)),
        material,
        name,
      );
    result.position.copy(start).add(end).multiplyScalar(0.5);
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return result;
  };
  const arrow = (origin: THREE.Vector3, direction: THREE.Vector3, length: number, name: string) => {
    const axis = direction.clone().normalize(),
      tip = origin.clone().addScaledVector(axis, length);
    const shaft = cylinder(
      origin,
      tip.clone().addScaledVector(axis, -0.9),
      0.13,
      `${name}-shaft`,
      gold,
    );
    shaft.userData.direction = axis.toArray();
    const head = mesh(ownGeometry(new THREE.ConeGeometry(0.55, 1.15, 16)), gold, `${name}-head`);
    head.position.copy(tip).addScaledVector(axis, -0.575);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  };
  function surface(
    tooth: DentalTooth,
    direction: THREE.Vector3,
    offset: THREE.Vector3,
    key: string,
  ): THREE.Vector3 {
    const cacheKey = `${tooth.id}/${key}`;
    const cached = surfacePoints.get(cacheKey);
    if (cached) return cached.clone();
    tooth.geometry.computeBoundingBox();
    const reach = tooth.geometry.boundingBox!.getSize(new THREE.Vector3()).length() + 1;
    const probe = new THREE.Mesh(tooth.geometry, probeMaterial);
    probe.updateMatrixWorld(true);
    const hit = new THREE.Raycaster(
      offset.clone().addScaledVector(direction, reach),
      direction.clone().negate(),
    ).intersectObject(probe, false)[0];
    if (!hit) throw new Error(`The schematic appliance cannot attach to demo tooth ${tooth.id}.`);
    surfacePoints.set(cacheKey, hit.point.clone());
    return hit.point;
  }
  function bandGeometry(tooth: DentalTooth) {
    const cached = bands.get(tooth.id);
    if (cached) return cached;
    const frame = anatomicalFrame(tooth),
      up = new THREE.Vector3(...frame.occlusal),
      outward = new THREE.Vector3(...frame.buccal);
    const right = new THREE.Vector3().crossVectors(up, outward).normalize(),
      sides = 48;
    const points: number[] = [],
      indices: number[] = [];
    // A closed rounded-edge strip follows the actual molar, including its inner face.
    const profile = [
      [-1.25, 0.08],
      [-1.25, 0.22],
      [-1.15, 0.3],
      [1.15, 0.3],
      [1.25, 0.22],
      [1.25, 0.08],
      [1.15, 0.06],
      [-1.15, 0.06],
    ];
    for (const [height, thickness] of profile) {
      for (let k = 0; k < sides; k++) {
        const angle = (k / sides) * Math.PI * 2,
          radial = right
            .clone()
            .multiplyScalar(Math.cos(angle))
            .addScaledVector(outward, Math.sin(angle));
        points.push(
          ...surface(tooth, radial, up.clone().multiplyScalar(height), `band/${height}/${k}`)
            .addScaledVector(radial, thickness)
            .toArray(),
        );
      }
    }
    for (let ring = 0; ring < profile.length; ring++)
      for (let k = 0; k < sides; k++) {
        const current = ring * sides,
          next = ((ring + 1) % profile.length) * sides,
          after = (k + 1) % sides;
        indices.push(
          current + k,
          next + k,
          current + after,
          current + after,
          next + k,
          next + after,
        );
      }
    const geometry = ownGeometry(new THREE.BufferGeometry(), false);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    bands.set(tooth.id, geometry);
    return geometry;
  }
  function makePalate() {
    if (palateGeometry) return palateGeometry;
    const outline = new THREE.Shape();
    outline.moveTo(0.35, -17);
    outline.lineTo(16, -17);
    outline.quadraticCurveTo(24, -10, 22, 2);
    outline.quadraticCurveTo(20, 15, 8, 19);
    outline.quadraticCurveTo(4, 21, 0.35, 21);
    outline.closePath();
    const geometry = ownGeometry(
      new THREE.ExtrudeGeometry(outline, {
        depth: 0.8,
        steps: 1,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.16,
        bevelThickness: 0.12,
        curveSegments: 18,
      }),
      false,
    );
    geometry.rotateX(Math.PI / 2);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++)
      positions.setY(
        i,
        positions.getY(i) + 11.5 + 3.5 * Math.max(0, 1 - Math.pow(positions.getX(i) / 25, 2)),
      );
    geometry.computeVertexNormals();
    palateGeometry = geometry;
    return geometry;
  }
  const clearDynamic = () => {
    group.clear();
    dynamicGeometries.forEach(geometry => {
      geometry.dispose();
      ownedGeometries.delete(geometry);
    });
    dynamicGeometries.clear();
  };
  function update(transforms: Transforms, workflow?: WorkflowViewState, options: ViewOptions = {}) {
    if (disposed) return;
    clearDynamic();
    group.visible = false;
    if (!model.demo || !workflow) return;
    if (!Number.isFinite(workflow.progress) || workflow.progress < 0 || workflow.progress > 1)
      throw new Error('Workflow progress must be between 0 and 1.');
    const arch = options.arch || 'both',
      opening = options.opening || 0;
    const visible = (tooth: DentalTooth) => arch === 'both' || toothArch(tooth.id) === arch;
    const world = (tooth: DentalTooth, local: THREE.Vector3) => {
      const point = local.applyMatrix4(toothMatrix(tooth, transforms));
      if (toothArch(tooth.id) === 'lower') point.y -= opening;
      return point;
    };
    const inwardAnchor = (tooth: DentalTooth, mesialOffset = 0) => {
      const frame = anatomicalFrame(tooth),
        inward = new THREE.Vector3(...frame.buccal).negate();
      return world(
        tooth,
        surface(
          tooth,
          inward,
          new THREE.Vector3(...frame.mesial).multiplyScalar(mesialOffset),
          `lingual/${mesialOffset}`,
        ).addScaledVector(inward, 0.4),
      );
    };
    group.userData = { schematic: true, appliance: workflow.appliance, phase: workflow.phase };
    if (workflow.appliance === 'palatal-expander') {
      if (arch === 'lower') return;
      if (workflow.palate)
        for (const side of [-1, 1]) {
          const half = mesh(
            makePalate(),
            palateMaterial,
            `schematic-palate-${side < 0 ? 'right' : 'left'}`,
          );
          half.scale.x = side;
          half.position.x = side * workflow.progress * 2.2;
          half.renderOrder = 1;
        }
      if (workflow.phase !== 'assessment') {
        const right = teeth.get('16'),
          left = teeth.get('26');
        if (right && left) {
          for (const tooth of [right, left])
            mesh(bandGeometry(tooth), steel, `molar-band-${tooth.id}`).applyMatrix4(
              toothMatrix(tooth, transforms),
            );
          if (workflow.phase !== 'brackets') {
            const center = inwardAnchor(right)
              .add(inwardAnchor(left))
              .multiplyScalar(0.5)
              .add(new THREE.Vector3(0, -0.4, 1.2));
            const separation = 2.1 + workflow.progress * 2.2;
            for (const [tooth, side] of [
              [right, -1],
              [left, 1],
            ] as const) {
              const block = mesh(
                ownGeometry(new RoundedBoxGeometry(3.4, 2.4, 6, 3, 0.38)),
                satinSteel,
                `screw-block-${tooth.id}`,
              );
              block.position.copy(center).add(new THREE.Vector3(side * separation, 0, 0));
              for (const end of [-1, 1]) {
                const anchor = inwardAnchor(tooth, end * 1.2),
                  start = block.position.clone().add(new THREE.Vector3(side * 1.6, 0, end * 1.7));
                const bend = start
                  .clone()
                  .lerp(anchor, 0.55)
                  .add(new THREE.Vector3(0, -0.5, 0));
                tube([start, bend, anchor], 0.43, `palatal-arm-${tooth.id}-${end}`);
              }
            }
            for (const side of [-1, 1])
              cylinder(
                center.clone().add(new THREE.Vector3(-separation - 1.1, 0, side * 2)),
                center.clone().add(new THREE.Vector3(separation + 1.1, 0, side * 2)),
                0.25,
                `guide-rail-${side}`,
              );
            cylinder(
              center.clone().add(new THREE.Vector3(-separation - 0.4, 0, 0)),
              center.clone().add(new THREE.Vector3(separation + 0.4, 0, 0)),
              0.4,
              'jackscrew-shaft',
            );
            const helix = Array.from({ length: 97 }, (_, i) => {
              const t = i / 96,
                angle = t * Math.PI * 12;
              return center
                .clone()
                .add(
                  new THREE.Vector3(
                    (t * 2 - 1) * separation,
                    Math.cos(angle) * 0.48,
                    Math.sin(angle) * 0.48,
                  ),
                );
            });
            tube(helix, 0.1, 'jackscrew-thread');
            if (workflow.arrows && ['forces', 'movement'].includes(workflow.phase))
              for (const side of [-1, 1])
                arrow(
                  center.clone().add(new THREE.Vector3(side * (separation + 2.4), -2.3, 0)),
                  new THREE.Vector3(side, 0, 0),
                  5,
                  `expansion-direction-${side}`,
                );
          }
        }
      }
    } else if (workflow.phase === 'retention') {
      for (const ids of [
        ['13', '12', '11', '21', '22', '23'],
        ['43', '42', '41', '31', '32', '33'],
      ]) {
        const retained = ids
          .map(id => teeth.get(id))
          .filter((tooth): tooth is DentalTooth => !!tooth && visible(tooth));
        const anchors = retained.map(tooth => inwardAnchor(tooth));
        if (anchors.length > 1)
          tube(anchors, 0.22, `lingual-retainer-${toothArch(retained[0].id)}`);
        anchors.forEach((anchor, i) => {
          const tooth = retained[i],
            frame = anatomicalFrame(tooth),
            matrix = toothMatrix(tooth, transforms);
          const inward = new THREE.Vector3(...frame.buccal).negate().transformDirection(matrix),
            up = new THREE.Vector3(...frame.occlusal).transformDirection(matrix);
          const pad = mesh(
            ownGeometry(new THREE.SphereGeometry(0.68, 16, 10)),
            resin,
            `retainer-pad-${tooth.id}`,
          );
          pad.scale.set(1, 1.15, 0.45);
          pad.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(up.clone().cross(inward).normalize(), up, inward),
          );
          // The flattened bond intersects the lingual crown and encloses the existing wire centre.
          pad.position.copy(anchor).addScaledVector(inward, -0.22);
        });
      }
    } else if (workflow.arrows && ['forces', 'movement'].includes(workflow.phase)) {
      const ids =
        workflow.appliance === 'archwire-expansion'
          ? ['14', '16', '24', '26']
          : ['11', '12', '21', '22'];
      for (const id of ids) {
        const tooth = teeth.get(id);
        if (!tooth || !visible(tooth)) continue;
        const outward = new THREE.Vector3(...tooth.buccal).transformDirection(
          toothMatrix(tooth, transforms),
        );
        const position = world(tooth, new THREE.Vector3()),
          origin = position.clone().addScaledVector(outward, 6);
        const direction =
          workflow.appliance === 'archwire-expansion'
            ? outward
            : new THREE.Vector3(...tooth.position).sub(position);
        if (direction.lengthSq() > 0.0001) arrow(origin, direction, 4.5, `tooth-direction-${id}`);
      }
    }
    group.visible = group.children.length > 0;
    group.updateMatrixWorld(true);
  }
  return {
    group,
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.clear();
      group.visible = false;
      ownedGeometries.forEach(geometry => geometry.dispose());
      ownedMaterials.forEach(material => material.dispose());
      ownedGeometries.clear();
      dynamicGeometries.clear();
      ownedMaterials.clear();
      surfacePoints.clear();
      bands.clear();
    },
  };
}
