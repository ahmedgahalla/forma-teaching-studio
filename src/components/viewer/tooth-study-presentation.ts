import { Vector3, type PerspectiveCamera } from 'three';
import type { DentalCase } from '@/lib/geometry';
import type { Transforms } from '@/lib/model';
import { displayedToothBounds } from '@/lib/viewer-presentation';
import { getToothAnatomy, TOOTH_ANATOMY_DISCLAIMER } from '@/lib/tooth-anatomy';
import {
  getToothStudyCamera,
  transformedToothFrame,
  type ToothStudyCamera,
} from '@/lib/tooth-study/camera';
import {
  createSurfaceLabels,
  placeSurfaceLabel,
  surfaceLabelShown,
} from '@/lib/tooth-study/surface-labels';
import type { ViewerToothStudy } from './viewer-types';
import type { PublicSurfaceLabel } from './public-overlays';

/** Snapshot restoration wins over reframing, including on the following frame. */
export function createStudyCameraGate() {
  let previous: ViewerToothStudy | null | undefined;
  return (next: ViewerToothStudy | null | undefined, restoring: boolean) => {
    const changed =
      next?.tooth !== previous?.tooth ||
      next?.view !== previous?.view ||
      next?.revision !== previous?.revision;
    previous = next;
    return !!next && changed && !restoring;
  };
}

/** Owns projected DOM labels; all vectors and placement outputs are reused in RAF. */
export function createToothStudyPresentation(
  model: DentalCase,
  host: HTMLElement,
  camera: PerspectiveCamera,
  moveCamera: (next: ToothStudyCamera) => void,
) {
  const overlay = document.createElement('div');
  overlay.className = 'tooth-study-labels';
  overlay.hidden = true;
  const caption = document.createElement('p');
  caption.className = 'tooth-study-model-caption';
  caption.textContent = TOOTH_ANATOMY_DISCLAIMER;
  overlay.appendChild(caption);
  host.appendChild(overlay);
  const publicLabels: PublicSurfaceLabel[] = [];
  const labels = Array.from({ length: 6 }, () => {
    const element = document.createElement('span');
    element.className = 'tooth-study-surface-label';
    overlay.appendChild(element);
    const label: PublicSurfaceLabel = { text: '', x: 0, y: 0, visible: false };
    publicLabels.push(label);
    return {
      element,
      label,
      direction: new Vector3(),
      point: new Vector3(),
      screen: { x: 0, y: 0 },
    };
  });
  const center = new Vector3(),
    projectedCenter = new Vector3(),
    toCamera = new Vector3(),
    projected = new Vector3(),
    size = new Vector3();
  const shouldFrame = createStudyCameraGate();
  let lastTooth: string | undefined,
    lastTransforms: Transforms | undefined,
    lastOpening = NaN;
  let active = false;
  let labelWidth = 0,
    labelHeight = 0,
    captionBottom = 0;
  return {
    labels: publicLabels,
    get caption() {
      return active ? TOOTH_ANATOMY_DISCLAIMER : null;
    },
    prepare(
      study: ViewerToothStudy | null | undefined,
      transforms: Transforms,
      opening: number,
      restoring: boolean,
    ) {
      active = !!study;
      overlay.hidden = !active;
      if (!active) for (const label of publicLabels) label.visible = false;
      const reframe = shouldFrame(study, restoring);
      if (!study) {
        lastTooth = undefined;
        labelWidth = 0;
        return;
      }
      if (
        lastTooth === study.tooth &&
        lastTransforms === transforms &&
        lastOpening === opening &&
        !reframe
      )
        return;
      const tooth = model.teeth.find(item => item.id === study.tooth);
      const anatomy = getToothAnatomy(study.tooth);
      if (!tooth || !anatomy) {
        active = false;
        overlay.hidden = true;
        for (const label of publicLabels) label.visible = false;
        return;
      }
      const bounds = displayedToothBounds(model, transforms, [study.tooth], true, opening);
      bounds.getCenter(center);
      bounds.getSize(size);
      const descriptions = createSurfaceLabels(
        anatomy,
        transformedToothFrame(tooth, transforms[tooth.id]),
      );
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        label.element.textContent = descriptions[i].text;
        label.label.text = descriptions[i].text;
        label.direction.fromArray(descriptions[i].direction);
        const reach =
          (Math.abs(label.direction.x) * size.x +
            Math.abs(label.direction.y) * size.y +
            Math.abs(label.direction.z) * size.z) /
          2;
        label.point.copy(center).addScaledVector(label.direction, reach + 2);
      }
      if (reframe) {
        const next = getToothStudyCamera(
          tooth,
          transforms[tooth.id],
          bounds,
          study.view,
          camera.fov,
          camera.aspect,
        );
        moveCamera(next);
      }
      lastTooth = study.tooth;
      lastTransforms = transforms;
      lastOpening = opening;
    },
    render(width: number, height: number) {
      if (!active) return;
      if (width !== labelWidth || height !== labelHeight) {
        captionBottom = caption.offsetTop + caption.offsetHeight + 8;
        labelWidth = width;
        labelHeight = height;
      }
      projectedCenter.copy(center).project(camera);
      const cx = ((projectedCenter.x + 1) * width) / 2;
      const cy = ((1 - projectedCenter.y) * height) / 2;
      toCamera.copy(camera.position).sub(center).normalize();
      for (const label of labels) {
        projected.copy(label.point).project(camera);
        const shown =
          surfaceLabelShown(label.direction.dot(toCamera)) && projected.z > -1 && projected.z < 1;
        const placed =
          shown &&
          placeSurfaceLabel(
            cx,
            cy,
            ((projected.x + 1) * width) / 2,
            ((1 - projected.y) * height) / 2,
            width,
            height,
            label.screen,
            72,
            captionBottom,
          );
        label.element.hidden = !placed;
        label.label.visible = placed;
        if (!placed) continue;
        label.label.x = label.screen.x;
        label.label.y = label.screen.y;
        label.element.style.left = `${label.screen.x}px`;
        label.element.style.top = `${label.screen.y}px`;
      }
    },
    dispose() {
      overlay.remove();
    },
  };
}
