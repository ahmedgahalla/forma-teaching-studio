import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { createToothLabelLayout } from './tooth-label-layout';
import { createAnatomyLabelLayout } from './anatomy-label-layout';
import type { AnatomyLabel } from './teaching-anatomy';

it('reuses tooth layout storage while selection, lock width and clipping change', () => {
  const anchors = [
    { id: '11', x: 50, y: 50, depth: 0.5, selected: false, locked: false },
    { id: '21', x: 56, y: 52, depth: 0.5, selected: true, locked: false },
    { id: '31', x: 150, y: 50, depth: 0.5, selected: false, locked: true },
    { id: '41', x: 155, y: 60, depth: 0.5, selected: false, locked: false },
    { id: '42', x: 0, y: 5, depth: 0.5, selected: false, locked: false },
    { id: '43', x: 240, y: 50, depth: 2, selected: true, locked: false },
  ];
  const layout = createToothLabelLayout(anchors),
    slots = [...layout.placed];
  const original = structuredClone(anchors);
  layout.update(300, 180);
  expect(layout.count).toBe(2);
  expect(layout.placed.slice(0, layout.count)).toEqual([
    { ...anchors[1], width: 32, height: 22 },
    { ...anchors[2], width: 77, height: 22 },
  ]);
  expect(anchors).toEqual(original);
  anchors[0].selected = true;
  anchors[1].selected = false;
  anchors[2].depth = Infinity;
  layout.update(300, 180);
  expect(layout.placed.slice(0, layout.count).map(label => label.id)).toEqual(['11', '41']);
  expect(layout.placed.every((slot, i) => slot === slots[i])).toBe(true);
  layout.update(30, 30);
  expect(layout.count).toBe(0);
});

// Independent pre-extraction placement equations pin the renderer's existing layout.
function reference(
  labels: AnatomyLabel[],
  camera: PerspectiveCamera,
  width: number,
  height: number,
) {
  const labelWidth = Math.min(width < 520 ? 121 : 170, Math.max(70, width * 0.3));
  const top = Math.min(96, height * 0.25),
    bottom = Math.max(top + 1, height - 48),
    row = Math.min(42, (bottom - top) / 3);
  const placed = labels.map(label => {
    const point = label.position.clone().project(camera);
    return {
      ...label,
      anchorX: ((point.x + 1) * width) / 2,
      anchorY: ((1 - point.y) * height) / 2,
      depth: point.z,
      x: label.side === 'left' ? 9 : width - labelWidth - 9,
      y: 0,
      width: labelWidth,
    };
  });
  for (const side of ['left', 'right']) {
    const column = placed
      .filter(label => label.side === side)
      .sort((a, b) => a.anchorY - b.anchorY);
    column.forEach((label, i) => {
      label.y = Math.max(
        top + i * row,
        Math.min(bottom - (column.length - i) * row, label.anchorY - 14),
      );
    });
    for (let i = 1; i < column.length; i++)
      column[i].y = Math.max(column[i].y, column[i - 1].y + row);
  }
  return placed;
}

it.each([
  [320, 260],
  [480, 430],
  [1280, 720],
])(
  'preserves tissue placement at %sx%s and reuses slots after camera/visibility changes',
  (width, height) => {
    const labels: AnatomyLabel[] = [
      { name: 'Crown', color: '#eee', side: 'left', position: new Vector3(0, 3, 0) },
      { name: 'Root', color: '#ddd', side: 'left', position: new Vector3(0, -1, 0) },
      { name: 'Gingiva', color: '#fcc', side: 'right', position: new Vector3(1, 1, 0) },
      {
        name: 'Periodontal ligament',
        color: '#fc0',
        side: 'right',
        position: new Vector3(2, -1, 0),
      },
      { name: 'Supporting bone', color: '#ccc', side: 'right', position: new Vector3(3, -1, 0) },
    ];
    const layout = createAnatomyLabelLayout(5),
      slots = [...layout.placed];
    const camera = new PerspectiveCamera(34, width / height, 0.1, 1000);
    for (const x of [0, 5, -5]) {
      camera.position.set(x, 3, 60);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      layout.update(labels, camera, width, height);
      expect(layout.placed).toEqual(reference(labels, camera, width, height));
      expect(layout.placed.every((slot, i) => slot === slots[i])).toBe(true);
    }
    layout.update(labels.slice(0, 2), camera, width, height);
    expect(layout.count).toBe(2);
    expect(layout.placed.slice(0, layout.count)).toEqual(
      reference(labels.slice(0, 2), camera, width, height),
    );
    layout.update([], camera, width, height);
    expect(layout.count).toBe(0);
  },
);
