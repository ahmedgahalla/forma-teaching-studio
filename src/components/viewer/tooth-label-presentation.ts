import { Vector3, type Group, type Camera } from 'three';
import type { DentalCase } from '@/lib/geometry';
import { toothArch } from '@/lib/appliances';
import { createToothLabelLayout, type ToothLabelAnchor } from '@/lib/tooth-label-layout';
import type { PublicToothLabel } from './public-overlays';

/** Clickable presenter labels and public IDs use the same visibility/collision decision. */
export function createToothLabelPresentation(
  model: DentalCase,
  groups: Map<string, Group>,
  host: HTMLElement,
  camera: Camera,
  select: (id: string, additive: boolean) => void,
) {
  const projected = new Vector3();
  const anchors: ToothLabelAnchor[] = [];
  const publicLabels: PublicToothLabel[] = [];
  const records = model.teeth.map(tooth => {
    const element = document.createElement('button');
    element.className = 'tooth-label';
    element.textContent = tooth.id;
    element.setAttribute('aria-label', `Select tooth ${tooth.id}`);
    element.onclick = event => select(tooth.id, event.shiftKey || event.ctrlKey || event.metaKey);
    host.appendChild(element);
    const anchor: ToothLabelAnchor = {
      id: tooth.id,
      x: 0,
      y: 0,
      depth: 0,
      selected: false,
      locked: false,
    };
    const label: PublicToothLabel = { id: tooth.id, x: 0, y: 0, visible: false, selected: false };
    anchors.push(anchor);
    publicLabels.push(label);
    return {
      element,
      anchor,
      label,
      group: groups.get(tooth.id)!,
      offsetY: toothArch(tooth.id) === 'lower' ? -6 : 6,
      lockedText: `${tooth.id} · locked`,
    };
  });
  const byId = new Map(records.map(record => [record.anchor.id, record]));
  const layout = createToothLabelLayout(anchors);
  return {
    labels: publicLabels,
    render(
      shown: boolean,
      selected: string[],
      locked: string[] | undefined,
      width: number,
      height: number,
    ) {
      for (const record of records) {
        const { element, anchor, label, group } = record;
        anchor.selected = label.selected = selected.includes(anchor.id);
        anchor.locked = !!locked?.includes(anchor.id);
        const text = anchor.locked ? record.lockedText : anchor.id;
        if (element.textContent !== text) element.textContent = text;
        element.classList.toggle('selected', anchor.selected);
        element.style.display = 'none';
        label.visible = false;
        anchor.depth = Infinity;
        if (!shown || !group.visible) continue;
        projected.copy(group.position);
        projected.y += record.offsetY;
        projected.z += 2;
        projected.project(camera);
        anchor.x = ((projected.x + 1) * width) / 2;
        anchor.y = ((1 - projected.y) * height) / 2;
        anchor.depth = projected.z;
      }
      if (!shown) return;
      layout.update(width, height);
      for (let i = 0; i < layout.count; i++) {
        const placement = layout.placed[i],
          record = byId.get(placement.id)!;
        record.element.style.display = 'block';
        record.element.style.transform = `translate(-50%, -50%) translate(${placement.x}px,${placement.y}px)`;
        record.label.x = placement.x;
        record.label.y = placement.y;
        record.label.visible = true;
      }
    },
    dispose() {
      for (const record of records) record.element.remove();
    },
  };
}
