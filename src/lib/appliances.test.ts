import { afterAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createApplianceKit, orderedArchIds, toothArch } from './appliances';
import { createOrthodonticDemo } from './demo';
import type { DentalTooth } from './geometry';

const model = createOrthodonticDemo();
afterAll(() => {
  model.teeth.forEach(t => { t.geometry.dispose(); t.rootGeometry?.dispose(); });
  model.gums.forEach(g => g.geometry.dispose());
});

describe('fixed-appliance display geometry', () => {
  it('attaches every demo bracket to its buccal surface with a right-handed anatomical orientation', () => {
    const kit = createApplianceKit(), material = new THREE.MeshBasicMaterial();
    for (const tooth of model.teeth) {
      const bracket = kit.bracket(tooth)!;
      expect(bracket).toBeInstanceOf(THREE.Group);
      expect(bracket.position.toArray()).toEqual(tooth.bracketPosition);
      const buccal = new THREE.Vector3(...tooth.buccal), occlusal = new THREE.Vector3(...tooth.occlusal!);
      expect(new THREE.Vector3(0, 0, 1).applyQuaternion(bracket.quaternion).distanceTo(buccal)).toBeLessThan(1e-10);
      expect(new THREE.Vector3(0, 1, 0).applyQuaternion(bracket.quaternion).distanceTo(occlusal)).toBeLessThan(1e-10);
      bracket.updateMatrixWorld(true);
      expect(bracket.matrixWorld.determinant()).toBeCloseTo(1, 10);
      // Cast toward the real mesh at the attachment centre, not its bounding box.
      const crown = new THREE.Mesh(tooth.geometry, material);
      const ray = new THREE.Raycaster(bracket.position.clone().addScaledVector(buccal, 10), buccal.clone().negate());
      const hit = ray.intersectObject(crown)[0];
      expect(hit, `Buccal surface missing for ${tooth.id}`).toBeDefined();
      const attachmentGap = bracket.position.clone().sub(hit.point).dot(buccal);
      // The .55 mm bonding base extends .275 mm inward from the attachment point.
      expect(attachmentGap, `Bracket floats away from ${tooth.id}`).toBeLessThan(.275);
      expect(attachmentGap, `Bracket is buried in ${tooth.id}`).toBeGreaterThan(0);
    }
    material.dispose(); kit.dispose();
  });

  it('keeps the archwire anchor attached when a crown is translated, rotated and the lower jaw opened', () => {
    const kit = createApplianceKit();
    for (const id of ['11', '26', '34', '47']) {
      const tooth = model.teeth.find(t => t.id === id)!, bracket = kit.bracket(tooth)!;
      const group = new THREE.Group(); group.add(bracket);
      group.position.fromArray(tooth.position).add(new THREE.Vector3(2.3, -1.4, 3.7));
      if (toothArch(id) === 'lower') group.position.y -= 9;
      group.quaternion.setFromEuler(new THREE.Euler(.37, -.46, .22));
      group.updateMatrixWorld(true);
      const wireAnchor = group.localToWorld((bracket.userData.anchor as THREE.Vector3).clone());
      const bracketSlot = bracket.localToWorld(new THREE.Vector3(0, 0, .67));
      expect(wireAnchor.distanceTo(bracketSlot)).toBeLessThan(1e-10);
      const originalAnchor = new THREE.Vector3(...tooth.bracketPosition!).addScaledVector(new THREE.Vector3(...tooth.buccal), .67);
      const expected = originalAnchor.applyQuaternion(group.quaternion).add(group.position);
      expect(wireAnchor.distanceTo(expected)).toBeLessThan(1e-10);
    }
    kit.dispose();
  });

  it('orders partial and complete arches continuously from patient right posterior through the midline', () => {
    const ids = model.teeth.map(t => t.id), original = [...ids];
    expect(orderedArchIds(ids, 'upper')).toEqual(['17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27']);
    expect(orderedArchIds(ids, 'lower')).toEqual(['47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37']);
    expect(orderedArchIds(['23', '11', '31', '16', '21', '41'], 'upper')).toEqual(['16', '11', '21', '23']);
    expect(ids).toEqual(original);
  });

  it('withholds appliances until an imported tooth has a calibrated frame', () => {
    const kit = createApplianceKit();
    const geometry = new THREE.BoxGeometry(6, 8, 4);
    const tooth: DentalTooth = { id: '11', name: 'Imported crown', calibrated: false, geometry, position: [4, 6, 8], buccal: [0, 0, 1], mesial: [1, 0, 0], occlusal: [0, -1, 0] };
    expect(kit.bracket(tooth)).toBeNull();
    const bracket = kit.bracket({ ...tooth, calibrated: true })!;
    expect(bracket.position.x).toBe(0);
    expect(bracket.position.y).toBe(0);
    expect(bracket.position.z).toBeCloseTo(2.28);
    expect(new THREE.Vector3(0, 0, 1).applyQuaternion(bracket.quaternion).toArray()).toEqual([0, 0, 1]);
    geometry.dispose(); kit.dispose();
  });

  it('changes the bracket finish and ligature colour while retaining the metallic wire and recessed slot', () => {
    const kit = createApplianceKit(), bracket = kit.bracket(model.teeth[0])!;
    const meshes = bracket.children as THREE.Mesh[];
    const slotMaterial = meshes[5].material, initialMetal = meshes[0].material as THREE.MeshStandardMaterial, initialWire = kit.wireMaterial;
    expect(initialWire).not.toBe(initialMetal);
    expect(initialWire.metalness).toBeGreaterThan(.8);
    expect(initialWire.roughness).toBeLessThan(initialMetal.roughness);
    kit.update('ceramic', '#e965ab');
    for (const mesh of meshes.slice(0, 5)) expect(mesh.material).not.toBe(initialMetal);
    expect(meshes[5].material).toBe(slotMaterial);
    expect((meshes[6].material as THREE.MeshStandardMaterial).color.getHexString()).toBe('e965ab');
    expect(kit.wireMaterial).toBe(initialWire);
    kit.update('metal', '#21a59a');
    for (const mesh of meshes.slice(0, 5)) expect(mesh.material).toBe(initialMetal);
    kit.dispose();
  });

  it('shares and disposes appliance mesh resources once across all tooth attachments', () => {
    const kit = createApplianceKit();
    const brackets = model.teeth.map(tooth => kit.bracket(tooth)!);
    const geometries = new Set(brackets.flatMap(bracket => (bracket.children as THREE.Mesh[]).map(mesh => mesh.geometry)));
    expect(geometries.size).toBe(4);
    const disposeSpies = [...geometries].map(geometry => vi.spyOn(geometry, 'dispose'));
    const wireDispose = vi.spyOn(kit.wireMaterial, 'dispose');
    kit.dispose(); [...disposeSpies, wireDispose].forEach(spy => expect(spy).toHaveBeenCalledOnce());
  });

  it('shows a narrow tie-wing neck while preserving the wire channel and seven-part bracket', () => {
    const kit = createApplianceKit(), bracket = kit.bracket(model.teeth[0])!;
    expect(bracket.children).toHaveLength(7);
    const wings = bracket.children.slice(1, 5) as THREE.Mesh[];
    const positions = wings[0].geometry.getAttribute('position');
    const widthAt = (predicate: (z: number) => boolean) => {
      const xs = Array.from({ length: positions.count }, (_, i) => i).filter(i => predicate(positions.getZ(i))).map(i => positions.getX(i));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(widthAt(z => z < -.2)).toBeLessThan(widthAt(z => z > .2) * .8);
    for (const wing of wings) {
      wing.geometry.computeBoundingBox(); const bounds = wing.geometry.boundingBox!.clone().translate(wing.position);
      // The 0.4 mm round display wire remains clear of both occlusal and gingival wings.
      expect(bounds.min.y > .2 || bounds.max.y < -.2).toBe(true);
      expect(Array.from(wing.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    }
    kit.dispose();
  });
});
