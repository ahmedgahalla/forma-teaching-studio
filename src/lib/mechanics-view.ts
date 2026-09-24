import * as THREE from 'three';
import type { DentalCase } from './geometry';
import type { Transforms, Vec3 } from './model';
import type { MechanicsEndpoint, MechanicsExperiment } from './mechanics/types';
import { toothMatrix } from './analysis';
import { toothArch } from './appliances';

type Display = { arch: 'upper' | 'lower' | 'both'; opening: number; forces: boolean; revealed: boolean; visible: (id: string) => boolean };

/** Appliance graphics follow actual attachment transforms; forces do not drive rendering. */
export function createMechanicsVisuals(model: DentalCase) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#b7c8d8', metalness: .8, roughness: .24 });
  const titanium = new THREE.MeshStandardMaterial({ color: '#9693a9', metalness: .72, roughness: .3 });
  const anchorMaterial = new THREE.MeshStandardMaterial({ color: '#61c3ce', metalness: .6, roughness: .3 });
  const elasticMaterial = new THREE.MeshStandardMaterial({ color: '#eac283', roughness: .45 });
  const forceColor = new THREE.Color('#e9a149'), momentColor = new THREE.Color('#b998e8');
  const geometries: THREE.BufferGeometry[] = [], transientMaterials: THREE.Material[] = [];
  const clear = () => { group.clear(); geometries.splice(0).forEach(geometry => geometry.dispose()); transientMaterials.splice(0).forEach(material => material.dispose()); };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position?: THREE.Vector3) => {
    geometries.push(geometry); const object = new THREE.Mesh(geometry, material); if (position) object.position.copy(position); object.castShadow = true; group.add(object); return object;
  };
  const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material, smooth = false) => {
    if (points.length < 2 || points[0].distanceToSquared(points.at(-1)!) < 1e-12) return;
    const curve = smooth && points.length > 2 ? new THREE.CatmullRomCurve3(points, false, 'centripetal') : new THREE.CurvePath<THREE.Vector3>();
    if (curve instanceof THREE.CurvePath) for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
    mesh(new THREE.TubeGeometry(curve, Math.max(12, points.length * 8), radius, 8, false), material);
  };
  const update = (experiment: MechanicsExperiment | null | undefined, poses: Transforms, display: Display) => {
    clear(); if (!experiment) return;
    const { config, reference } = experiment;
    const world = (id: string, local: Vec3) => {
      const tooth = model.teeth.find(item => item.id === id); if (!tooth) return new THREE.Vector3();
      const point = new THREE.Vector3(...local).applyMatrix4(toothMatrix(tooth, poses));
      if (toothArch(id) === 'lower') point.y -= display.opening; return point;
    };
    const anchor = (id: string) => world(id, config.brackets[id] || reference.teeth.find(tooth => tooth.id === id)!.bracketLocal);
    const nearest = (point: Vec3) => reference.teeth.reduce((best, tooth) => new THREE.Vector3(...tooth.position).distanceToSquared(new THREE.Vector3(...point)) < new THREE.Vector3(...best.position).distanceToSquared(new THREE.Vector3(...point)) ? tooth : best);
    const tadPosition = (id: string) => {
      const tad = config.tads.find(item => item.id === id)!;
      const point = new THREE.Vector3(...tad.position); if (toothArch(nearest(tad.position).id) === 'lower') point.y -= display.opening; return point;
    };
    const endpoint = (end: MechanicsEndpoint) => end.kind === 'tooth' ? world(end.tooth, end.local) : tadPosition(end.id);
    const endpointVisible = (end: MechanicsEndpoint) => end.kind === 'tooth' ? display.visible(end.tooth) : display.visible(nearest(config.tads.find(item => item.id === end.id)!.position).id);
    for (const wire of config.wires) {
      const points = wire.teeth.filter(display.visible).map(anchor); if (points.length < 2) continue;
      const material = wire.material === 'stainless-steel' ? metal : titanium;
      if (wire.section.shape === 'round') tube(points, wire.section.diameterMm / 2, material, true);
      else {
        // A swept rectangle preserves the selected section rather than depicting every wire as round.
        const halfW = wire.section.widthMm / 2, halfH = wire.section.heightMm / 2, shape = new THREE.Shape();
        shape.moveTo(-halfW, -halfH); shape.lineTo(halfW, -halfH); shape.lineTo(halfW, halfH); shape.lineTo(-halfW, halfH); shape.closePath();
        mesh(new THREE.ExtrudeGeometry(shape, { steps: Math.max(12, points.length * 8), bevelEnabled: false, extrudePath: new THREE.CatmullRomCurve3(points, false, 'centripetal') }), material);
      }
    }
    for (const tad of config.tads) {
      const tooth = nearest(tad.position); if (!display.visible(tooth.id)) continue;
      const position = tadPosition(tad.id), direction = new THREE.Vector3(...tooth.buccal).normalize();
      const shaft = mesh(new THREE.CylinderGeometry(.32, .18, 3, 12), metal, position.clone().addScaledVector(direction, -1.5));
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      mesh(new THREE.SphereGeometry(.62, 16, 10), anchorMaterial, position);
      for (let i = 1; i <= 5; i++) { const ring = mesh(new THREE.TorusGeometry(.28 - i * .016, .065, 5, 12), metal, position.clone().addScaledVector(direction, -i * .45)); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction); }
    }
    for (const elastic of config.elastics) if (endpointVisible(elastic.from) && endpointVisible(elastic.to)) {
      const from = endpoint(elastic.from), to = endpoint(elastic.to); tube([from, to], .13, elasticMaterial);
      mesh(new THREE.SphereGeometry(.25, 10, 6), elasticMaterial, from); mesh(new THREE.SphereGeometry(.25, 10, 6), elasticMaterial, to);
    }
    for (const expander of config.expanders) {
      if (![...expander.left, ...expander.right].some(display.visible)) continue;
      const mean = (ids: string[]) => ids.map(anchor).reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / ids.length);
      const left = mean(expander.left), right = mean(expander.right), center = left.clone().add(right).multiplyScalar(.5);
      // The chassis sits palatally and connects to the explicitly chosen teeth.
      center.z -= 4; center.y += 1.5;
      mesh(new THREE.BoxGeometry(4.2, 1.5, 3.2), anchorMaterial, center);
      const screw = mesh(new THREE.CylinderGeometry(.4, .4, 5, 12), metal, center); screw.rotation.z = Math.PI / 2;
      for (const id of [...expander.left, ...expander.right]) if (display.visible(id)) tube([anchor(id), center.clone().add(new THREE.Vector3(id.startsWith('2') ? 2.4 : -2.4, 0, 0))], .38, metal);
    }
    if (display.forces && display.revealed && experiment.result) {
      const maximum = Math.max(.001, ...experiment.result.teeth.map(tooth => Math.hypot(...tooth.forceN)));
      for (const tooth of experiment.result.teeth) {
        if (!display.visible(tooth.id)) continue;
        const direction = new THREE.Vector3(...tooth.forceN), magnitude = direction.length(), origin = anchor(tooth.id);
        if (magnitude > 1e-7) {
          const arrow = new THREE.ArrowHelper(direction.normalize(), origin, 3 + 6 * magnitude / maximum, forceColor, 1.3, .7); group.add(arrow);
          // ArrowHelper owns its materials but shares global geometries with other arrows.
          transientMaterials.push(arrow.line.material as THREE.Material, arrow.cone.material as THREE.Material);
        }
        const moment = new THREE.Vector3(...tooth.momentNmm); if (moment.length() > 1e-6) {
          const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), moment.normalize());
          const points = Array.from({ length: 20 }, (_, i) => { const angle = i / 19 * Math.PI * 1.4; return new THREE.Vector3(Math.cos(angle) * 2, Math.sin(angle) * 2, 0).applyQuaternion(orientation).add(origin); });
          const geometry = new THREE.BufferGeometry().setFromPoints(points), material = new THREE.LineBasicMaterial({ color: momentColor }); geometries.push(geometry); transientMaterials.push(material); group.add(new THREE.Line(geometry, material));
        }
      }
    }
  };
  return { group, update, dispose: () => { clear(); [metal, titanium, anchorMaterial, elasticMaterial].forEach(material => material.dispose()); } };
}
