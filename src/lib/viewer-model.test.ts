import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { DentalCase } from './geometry';
import { sameViewerGeometry } from './viewer-model';

const crown = new THREE.BoxGeometry(5, 8, 4),
  root = new THREE.BoxGeometry(3, 12, 3),
  gum = new THREE.BoxGeometry(20, 6, 10);
const model: DentalCase = {
  name: 'Study',
  demo: true,
  teeth: [
    {
      id: '11',
      name: 'Incisor',
      geometry: crown,
      rootGeometry: root,
      position: [-4, 6, 12],
      buccal: [0, 0, 1],
      mesial: [1, 0, 0],
      occlusal: [0, -1, 0],
      calibrated: true,
    },
    {
      id: '21',
      name: 'Incisor',
      geometry: crown,
      rootGeometry: root,
      position: [4, 6, 12],
      buccal: [0, 0, 1],
      mesial: [-1, 0, 0],
      occlusal: [0, -1, 0],
      calibrated: true,
    },
  ],
  gums: [{ id: 'upper', geometry: gum, position: [0, 12, 0], arch: 'upper' }],
};
afterAll(() => {
  crown.dispose();
  root.dispose();
  gum.dispose();
});

describe('camera preservation across model updates', () => {
  it('preserves a user view through attachment edits, renamed cases and calibration metadata', () => {
    const next: DentalCase = {
      ...model,
      name: 'Renamed',
      teeth: model.teeth.map(t => ({
        ...t,
        name: 'Updated label',
        buccal: [0, 0, -1],
        attachment: {
          shape: 'beveled',
          width: 3,
          height: 2,
          depth: 1,
          offsetMesial: 0,
          offsetOcclusal: 0,
          rotation: 0,
        },
      })),
    };
    expect(sameViewerGeometry(model, next)).toBe(true);
    expect(sameViewerGeometry(next, model)).toBe(true);
  });

  it('uses IDs and placement values so harmless collection or position-array copies retain the view', () => {
    const next: DentalCase = {
      ...model,
      teeth: [...model.teeth].reverse().map(t => ({ ...t, position: [...t.position] })),
      gums: model.gums.map(g => ({ ...g, position: [...g.position] })),
    };
    expect(sameViewerGeometry(model, next)).toBe(true);
  });

  it('fits fresh for newly loaded geometry, even when its coordinates are identical', () => {
    for (const kind of ['crown', 'root', 'gum']) {
      const replacement = (kind === 'crown' ? crown : kind === 'root' ? root : gum).clone();
      const next: DentalCase = {
        ...model,
        teeth: model.teeth.map(t => ({
          ...t,
          ...(kind === 'crown'
            ? { geometry: replacement }
            : kind === 'root'
              ? { rootGeometry: replacement }
              : {}),
        })),
        gums: model.gums.map(g => ({ ...g, ...(kind === 'gum' ? { geometry: replacement } : {}) })),
      };
      expect(sameViewerGeometry(model, next)).toBe(false);
      replacement.dispose();
    }
  });

  it('fits fresh when original placements, IDs, roots, or mesh inventory change', () => {
    const changes: DentalCase[] = [
      { ...model, teeth: [{ ...model.teeth[0], position: [-4, 7, 12] }, model.teeth[1]] },
      { ...model, teeth: [{ ...model.teeth[0], id: '12' }, model.teeth[1]] },
      { ...model, teeth: [{ ...model.teeth[0], rootGeometry: undefined }, model.teeth[1]] },
      { ...model, teeth: [model.teeth[0]] },
      { ...model, gums: [] },
      { ...model, gums: [{ ...model.gums[0], position: [0, 13, 0] }] },
    ];
    changes.forEach(next => expect(sameViewerGeometry(model, next)).toBe(false));
  });
});
