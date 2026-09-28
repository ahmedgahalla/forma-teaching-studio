import { MathUtils, Vector3, type Camera } from 'three';
import type { AnatomyLabel } from './teaching-anatomy';

type PlacedAnatomyLabel = AnatomyLabel & {
  anchorX: number;
  anchorY: number;
  depth: number;
  x: number;
  y: number;
  width: number;
};

/** Bounded columns share preallocated projection and sorting slots across frames. */
export function createAnatomyLabelLayout(capacity: number) {
  const point = new Vector3();
  const placed: PlacedAnatomyLabel[] = Array.from({ length: capacity }, () => ({
    name: '',
    color: '',
    position: point,
    side: 'left',
    anchorX: 0,
    anchorY: 0,
    depth: 0,
    x: 0,
    y: 0,
    width: 0,
  }));
  const left = new Array<PlacedAnatomyLabel>(capacity),
    right = new Array<PlacedAnatomyLabel>(capacity);
  const column = (
    items: PlacedAnatomyLabel[],
    count: number,
    top: number,
    bottom: number,
    row: number,
  ) => {
    for (let i = 1; i < count; i++) {
      const item = items[i];
      let j = i - 1;
      while (j >= 0 && items[j].anchorY > item.anchorY) {
        items[j + 1] = items[j];
        j--;
      }
      items[j + 1] = item;
    }
    for (let i = 0; i < count; i++)
      items[i].y = MathUtils.clamp(
        items[i].anchorY - 14,
        top + i * row,
        bottom - (count - i) * row,
      );
    for (let i = 1; i < count; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + row);
  };
  const layout = {
    placed,
    count: 0,
    update(labels: AnatomyLabel[], camera: Camera, width: number, height: number) {
      const labelWidth = Math.min(width < 520 ? 121 : 170, Math.max(70, width * 0.3));
      const top = Math.min(96, height * 0.25),
        bottom = Math.max(top + 1, height - 48),
        row = Math.min(42, (bottom - top) / 3);
      let leftCount = 0,
        rightCount = 0;
      layout.count = labels.length;
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i],
          out = placed[i];
        point.copy(label.position).project(camera);
        Object.assign(out, label);
        out.anchorX = ((point.x + 1) * width) / 2;
        out.anchorY = ((1 - point.y) * height) / 2;
        out.depth = point.z;
        out.x = label.side === 'left' ? 9 : width - labelWidth - 9;
        out.y = 0;
        out.width = labelWidth;
        if (label.side === 'left') left[leftCount++] = out;
        else right[rightCount++] = out;
      }
      column(left, leftCount, top, bottom, row);
      column(right, rightCount, top, bottom, row);
    },
  };
  return layout;
}

/** Snapshot helper for callers outside the renderer. */
export function layoutAnatomyLabels(
  labels: AnatomyLabel[],
  camera: Camera,
  width: number,
  height: number,
) {
  const layout = createAnatomyLabelLayout(labels.length);
  layout.update(labels, camera, width, height);
  return layout.placed;
}
