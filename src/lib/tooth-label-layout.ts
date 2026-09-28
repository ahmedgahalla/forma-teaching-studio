export type ToothLabelAnchor = {
  id: string;
  x: number;
  y: number;
  depth: number;
  selected: boolean;
  locked: boolean;
};

const priority = (a: ToothLabelAnchor, b: ToothLabelAnchor) =>
  Number(b.selected) - Number(a.selected) || a.id.localeCompare(b.id);

/** Fixed model anchors and output slots are reused as the camera or selection changes. */
export function createToothLabelLayout(anchors: ToothLabelAnchor[]) {
  const ordered = [...anchors];
  const placed = anchors.map(anchor => ({ ...anchor, width: 0, height: 22 }));
  const layout = {
    placed,
    count: 0,
    update(width: number, height: number) {
      layout.count = 0;
      ordered.sort(priority);
      for (const anchor of ordered) {
        const w = anchor.locked ? 77 : 32,
          h = 22;
        if (
          !Number.isFinite(anchor.x) ||
          !Number.isFinite(anchor.y) ||
          !Number.isFinite(anchor.depth) ||
          anchor.depth <= -1 ||
          anchor.depth >= 1 ||
          anchor.x - w / 2 < 6 ||
          anchor.x + w / 2 > width - 6 ||
          anchor.y - h / 2 < 6 ||
          anchor.y + h / 2 > height - 6
        )
          continue;
        let overlaps = false;
        for (let i = 0; i < layout.count; i++) {
          const other = placed[i];
          if (
            Math.abs(other.x - anchor.x) < (other.width + w) / 2 + 4 &&
            Math.abs(other.y - anchor.y) < (other.height + h) / 2 + 3
          ) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        const out = placed[layout.count++];
        Object.assign(out, anchor);
        out.width = w;
        out.height = h;
      }
    },
  };
  return layout;
}

/** Snapshot helper for callers outside the renderer. */
export function layoutToothLabels(anchors: ToothLabelAnchor[], width: number, height: number) {
  const layout = createToothLabelLayout(anchors);
  layout.update(width, height);
  return layout.placed.slice(0, layout.count);
}
