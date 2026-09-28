import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { toothArch } from '@/lib/appliances';
import { dentalStagePalette } from '@/lib/dental-surface';
import type { MovementTrail } from '@/lib/movement-trails';
import type { Vec3 } from '@/lib/model';
import type { ViewerProps } from './viewer-types';
import { createMovementTrailLabel } from './movement-trail-label';

type TrailDisplay = Pick<
  ViewerProps,
  'movementTrail' | 'trailProgress' | 'selected' | 'roots' | 'opening'
>;

function createPath(color: string, root: boolean) {
  const material = new LineMaterial({
    color,
    linewidth: 2.6,
    dashed: root,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const line = new Line2(new LineGeometry(), material);
  // The composer uses a device-pixel target. Keep the supplied CSS resolution so
  // line width matches marker/label sizing at every device pixel ratio.
  line.onBeforeRender = () => {};
  line.frustumCulled = false;
  line.renderOrder = 6;
  const marker = new THREE.Mesh(
    root ? new THREE.CircleGeometry(1, 4) : new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, toneMapped: false }),
  );
  marker.renderOrder = 7;
  const label = createMovementTrailLabel(root ? 'Root point' : 'Crown point', color);
  const group = new THREE.Group();
  group.name = root ? 'root-movement-trail' : 'crown-movement-trail';
  group.add(line, marker, label.sprite);
  let positions: Float32Array | null = null;
  let lastEnd = -1;
  let moving = false;
  let distances = new Float32Array();
  const endpoint = new THREE.Vector3(),
    cameraPoint = new THREE.Vector3(),
    right = new THREE.Vector3(),
    up = new THREE.Vector3();
  function restoreEndpoint() {
    if (!positions || lastEnd < 0) return;
    const offset = (lastEnd + 1) * 3;
    const ends = line.geometry.getAttribute('instanceEnd') as THREE.InterleavedBufferAttribute;
    ends.setXYZ(lastEnd, positions[offset], positions[offset + 1], positions[offset + 2]);
    const lengths = line.geometry.getAttribute('instanceDistanceEnd');
    lengths.setX(lastEnd, distances[lastEnd + 1]);
    lastEnd = -1;
  }
  return {
    group,
    setColor(color: string) {
      material.color.set(color);
      marker.material.color.set(color);
    },
    setPoints(points: Float32Array | null) {
      positions = points;
      lastEnd = -1;
      group.visible = !!points;
      line.geometry.dispose();
      line.geometry = new LineGeometry();
      if (!points) return;
      line.geometry.setPositions(points);
      line.computeLineDistances();
      const starts = line.geometry.getAttribute(
        'instanceStart',
      ) as THREE.InterleavedBufferAttribute;
      const lengths = line.geometry.getAttribute(
        'instanceDistanceStart',
      ) as THREE.InterleavedBufferAttribute;
      starts.data.setUsage(THREE.DynamicDrawUsage);
      lengths.data.setUsage(THREE.DynamicDrawUsage);
      distances = new Float32Array(points.length / 3);
      const ends = line.geometry.getAttribute('instanceDistanceEnd');
      for (let i = 0; i < ends.count; i++) distances[i + 1] = ends.getX(i);
      moving = distances[distances.length - 1] > 1e-7;
      line.geometry.instanceCount = 0;
    },
    update(
      localPoint: Vec3,
      tooth: THREE.Object3D,
      segments: number,
      opening: number,
      camera: THREE.PerspectiveCamera,
      width: number,
      height: number,
    ) {
      restoreEndpoint();
      endpoint.fromArray(localPoint).applyMatrix4(tooth.matrixWorld);
      cameraPoint.copy(endpoint).applyMatrix4(camera.matrixWorldInverse);
      group.visible = cameraPoint.z < -camera.near && height > 0 && width > 0;
      if (!group.visible) return;
      const unitsPerPixel = (-2 * cameraPoint.z) / (camera.projectionMatrix.elements[5] * height);
      // The tooth matrix already includes lower-arch separation; path samples do not.
      endpoint.y += opening;
      marker.position.copy(endpoint);
      marker.quaternion.copy(camera.quaternion);
      marker.scale.setScalar((root ? 6 : 4.5) * unitsPerPixel);
      label.sprite.position.copy(endpoint);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      label.sprite.position.addScaledVector(right, 10 * unitsPerPixel);
      label.sprite.position.addScaledVector(up, (root ? -20 : 20) * unitsPerPixel);
      label.sprite.scale.set(112 * unitsPerPixel, 28 * unitsPerPixel, 1);
      material.resolution.set(width, height);
      material.dashSize = 6 * unitsPerPixel;
      material.gapSize = 4 * unitsPerPixel;
      line.geometry.instanceCount = moving ? segments : 0;
      line.visible = moving && segments > 0;
      if (line.visible) {
        const index = segments - 1;
        const starts = line.geometry.getAttribute(
          'instanceStart',
        ) as THREE.InterleavedBufferAttribute;
        const ends = line.geometry.getAttribute('instanceEnd') as THREE.InterleavedBufferAttribute;
        const lengthEnds = line.geometry.getAttribute(
          'instanceDistanceEnd',
        ) as THREE.InterleavedBufferAttribute;
        ends.setXYZ(index, endpoint.x, endpoint.y, endpoint.z);
        lengthEnds.setX(
          index,
          distances[index] +
            Math.hypot(
              endpoint.x - starts.getX(index),
              endpoint.y - starts.getY(index),
              endpoint.z - starts.getZ(index),
            ),
        );
        ends.data.needsUpdate = true;
        lengthEnds.data.needsUpdate = true;
        lastEnd = index;
      }
    },
    dispose() {
      group.removeFromParent();
      line.geometry.dispose();
      material.dispose();
      marker.geometry.dispose();
      marker.material.dispose();
      label.dispose();
    },
  };
}

/** Fixed sampled paths; playback only changes draw counts and the exact displayed endpoint. */
export function createMovementTrailRenderer(camera: THREE.PerspectiveCamera) {
  const crown = createPath(dentalStagePalette.midnight.selected, false),
    root = createPath(dentalStagePalette.midnight.trace, true);
  const group = new THREE.Group();
  group.name = 'movement-trails';
  group.visible = false;
  group.add(crown.group, root.group);
  let trail: MovementTrail | null | undefined;
  return {
    group,
    setPalette(palette: { selected: string; trace: string }) {
      crown.setColor(palette.selected);
      root.setColor(palette.trace);
    },
    setTrail(next: MovementTrail | null | undefined) {
      if (trail === next) return;
      trail = next;
      group.visible = false;
      crown.setPoints(next?.crown ?? null);
      root.setPoints(next?.root ?? null);
    },
    update(
      display: TrailDisplay,
      tooth: THREE.Object3D | undefined,
      width: number,
      height: number,
      hidden = false,
    ) {
      group.visible =
        !!trail &&
        display.movementTrail === trail &&
        display.selected === trail.toothId &&
        !!tooth?.visible &&
        !hidden;
      if (!group.visible || !trail || !tooth) return;
      const progress = Math.max(0, Math.min(1, display.trailProgress ?? 0));
      let segments = 0;
      // Strictly earlier samples plus the live endpoint avoid drawing any future segment.
      while (segments < trail.progress.length - 1 && trail.progress[segments] < progress)
        segments++;
      const opening = toothArch(trail.toothId) === 'lower' ? display.opening : 0;
      group.position.y = -opening;
      crown.update(trail.crownPoint, tooth, segments, opening, camera, width, height);
      root.group.visible = display.roots && !!trail.rootPoint && !!trail.root;
      if (root.group.visible)
        root.update(trail.rootPoint!, tooth, segments, opening, camera, width, height);
    },
    dispose() {
      group.removeFromParent();
      crown.dispose();
      root.dispose();
    },
  };
}
