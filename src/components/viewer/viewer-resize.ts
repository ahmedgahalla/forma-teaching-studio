import { Vector3, type PerspectiveCamera, type WebGLRenderer } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';

/** Preserve orbit/relative zoom as the actual canvas region changes, including study layout. */
export function createViewerResize(
  container: HTMLElement,
  camera: PerspectiveCamera,
  controls: OrbitControls,
  renderer: WebGLRenderer,
  composer: EffectComposer,
  finishCamera: () => void,
  fitFrame: (direction: Vector3, aspect: number) => { target: Vector3; distance: number } | null,
) {
  let width = 0,
    height = 0;
  const resize = () => {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height || (width === rect.width && height === rect.height)) return;
    finishCamera();
    const direction = camera.position.clone().sub(controls.target),
      next = rect.width / rect.height;
    if (direction.lengthSq() && next !== camera.aspect) {
      const before = fitFrame(direction, camera.aspect),
        after = fitFrame(direction, next);
      if (before && after) {
        const pan = controls.target.clone().sub(before.target);
        controls.target.copy(after.target).add(pan);
        camera.position
          .copy(controls.target)
          .addScaledVector(direction, after.distance / before.distance);
        controls.maxDistance = Math.max(3000, after.distance * 2);
        camera.far = Math.max(10000, after.distance * 4);
      }
    }
    camera.aspect = next;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height);
    composer.setSize(rect.width, rect.height);
    camera.lookAt(controls.target);
    width = rect.width;
    height = rect.height;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  return {
    resize,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    dispose: () => observer.disconnect(),
  };
}
