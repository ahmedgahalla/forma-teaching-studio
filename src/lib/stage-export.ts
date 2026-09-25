import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { strToU8, zip as zipAsync } from 'fflate';
import { createAttachmentGeometry } from './attachments';
import { download, type DentalCase } from './geometry';
import {
  interpolateTransforms,
  stageTransforms,
  validTransforms,
  type Checkpoint,
} from './planning';
import type { Transforms, Vec3 } from './model';
import { previewPose, type TryPreview } from './try-mode';

const MAX_BATCH_BYTES = 250 * 1024 * 1024;
const stageName = (index: number) => `stage-${String(index).padStart(3, '0')}.stl`;
const purpose =
  'Educational geometric demonstration only. These meshes are not clinically validated treatment stages or manufacturing-ready aligner models.';
export type InitialResponsePath = { from: Transforms; to: Transforms; assumptions: string[] };

function requireTransforms(model: DentalCase, transforms: Transforms) {
  if (!validTransforms(transforms, new Set(model.teeth.map(tooth => tooth.id))))
    throw new Error('Invalid stage transforms.');
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  const count = (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3;
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error('Cannot export an invalid triangle mesh.');
  return count;
}

function requireBatchSize(bytesPerStage: number, stages: number) {
  if (!Number.isSafeInteger(bytesPerStage) || bytesPerStage * stages > MAX_BATCH_BYTES) {
    throw new Error(
      'The stage sequence exceeds 250 MB of raw STL data. Reduce the stage count or mesh size, or export individual stages.',
    );
  }
}

/** Borrow crown/gum geometry; only generated attachment geometry belongs to this export. */
function prepareScene(model: DentalCase, includeAttachments: boolean, stages = 1) {
  const baseTriangles = [...model.teeth, ...model.gums].reduce(
    (count, part) => count + triangleCount(part.geometry),
    0,
  );
  requireBatchSize(84 + baseTriangles * 50, stages);
  const group = new THREE.Group(),
    material = new THREE.MeshBasicMaterial();
  const attachments: THREE.BufferGeometry[] = [];
  const teeth = model.teeth.map(tooth => ({ tooth, group: new THREE.Group() }));
  const dispose = () => {
    attachments.forEach(geometry => geometry.dispose());
    material.dispose();
  };
  try {
    for (const entry of teeth) {
      entry.group.add(new THREE.Mesh(entry.tooth.geometry, material));
      if (includeAttachments && entry.tooth.attachment) {
        const geometry = createAttachmentGeometry(entry.tooth, entry.tooth.attachment);
        attachments.push(geometry);
        entry.group.add(new THREE.Mesh(geometry, material));
      }
      group.add(entry.group);
    }
    for (const gum of model.gums) {
      const mesh = new THREE.Mesh(gum.geometry, material);
      mesh.position.fromArray(gum.position);
      group.add(mesh);
    }
    const bytesPerStage =
      84 +
      (baseTriangles + attachments.reduce((sum, geometry) => sum + triangleCount(geometry), 0)) *
        50;
    requireBatchSize(bytesPerStage, stages);
    return { group, teeth, dispose, bytesPerStage };
  } catch (error) {
    dispose();
    throw error;
  }
}

function encodeStage(
  scene: ReturnType<typeof prepareScene>,
  transforms: Transforms,
): Uint8Array<ArrayBuffer> {
  for (const { tooth, group } of scene.teeth) {
    const pose = transforms[tooth.id];
    group.position.fromArray(tooth.position);
    if (pose) group.position.add(new THREE.Vector3(...pose.translation));
    group.rotation.set(
      ...((pose?.rotation || [0, 0, 0]).map(THREE.MathUtils.degToRad) as Vec3),
      'XYZ',
    );
  }
  scene.group.updateMatrixWorld(true);
  const output = new STLExporter().parse(scene.group, { binary: true });
  const bytes = new Uint8Array(output.buffer as ArrayBuffer, output.byteOffset, output.byteLength);
  // STL has no unit metadata. Preserve a readable hint in its otherwise unused header.
  bytes.set(
    strToU8('Forma educational geometric stage; units mm; not for clinical manufacture.').subarray(
      0,
      80,
    ),
  );
  return bytes;
}

/** Crown surfaces and static gums, with optional separate attachment surfaces; no Boolean union. */
export function buildStageSTL(
  model: DentalCase,
  transforms: Transforms,
  includeAttachments: boolean,
): Uint8Array<ArrayBuffer> {
  requireTransforms(model, transforms);
  const scene = prepareScene(model, includeAttachments);
  try {
    return encodeStage(scene, transforms);
  } finally {
    scene.dispose();
  }
}

export function exportStage(
  model: DentalCase,
  transforms: Transforms,
  stageIndex: number,
  includeAttachments: boolean,
): void {
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 50)
    throw new Error('Stage index must be an integer between 0 and 50.');
  download(
    `forma-${stageName(stageIndex)}`,
    buildStageSTL(model, transforms, includeAttachments),
    'model/stl',
  );
}

/** Stage 0 is the trajectory start (otherwise original); count + 1 STLs include both endpoints. */
export async function exportStageSequence(
  model: DentalCase,
  final: Transforms,
  checkpoints: Checkpoint[],
  count: number,
  includeAttachments: boolean,
  trajectory?: TryPreview | null,
  initialResponse?: InitialResponsePath,
  original: Transforms = {},
): Promise<void> {
  requireTransforms(model, final);
  requireTransforms(model, original);
  if (initialResponse) {
    if (trajectory)
      throw new Error('Choose one geometric path or one initial-response path to export.');
    requireTransforms(model, initialResponse.from);
    requireTransforms(model, initialResponse.to);
    if (
      !Array.isArray(initialResponse.assumptions) ||
      initialResponse.assumptions.length > 30 ||
      initialResponse.assumptions.some(
        value => typeof value !== 'string' || !value.trim() || value.length > 2000,
      )
    )
      throw new Error('Invalid initial-response assumptions.');
  }
  if (!Array.isArray(checkpoints) || checkpoints.length > 20)
    throw new Error('Use at most 20 checkpoints.');
  for (const checkpoint of checkpoints) requireTransforms(model, checkpoint.transforms);
  stageTransforms(final, checkpoints, 0, count, original); // Validate the same 2–50 interval limit as the viewer.
  // Snapshot the small pose maps before yielding; edits during export cannot mix stage paths.
  const path = structuredClone({ final, checkpoints, trajectory, initialResponse, original });
  const stages = Array.from({ length: count + 1 }, (_, index) => ({
    index,
    file: stageName(index),
    fraction: index / count,
    transforms: path.initialResponse
      ? interpolateTransforms(path.initialResponse.from, path.initialResponse.to, index / count)
      : path.trajectory
        ? previewPose(path.trajectory, index / count)
        : stageTransforms(path.final, path.checkpoints, index, count, path.original),
  }));
  for (const stage of stages) requireTransforms(model, stage.transforms);
  const scene = prepareScene(model, includeAttachments, stages.length);
  const files: Record<string, Uint8Array> = {};
  try {
    files['manifest.json'] = strToU8(
      JSON.stringify(
        {
          format: 'forma-educational-stages',
          version: 1,
          units: 'mm',
          purpose: path.initialResponse
            ? `Reduced initial elastic response under defined teaching assumptions. ${purpose}`
            : purpose,
          stageIntervals: count,
          stlFiles: stages.length,
          includeAttachments,
          included: [
            'crowns',
            'static gums',
            ...(includeAttachments ? ['configured attachments'] : []),
          ],
          excluded: [
            'roots',
            'brackets',
            'wires',
            ...(path.initialResponse
              ? ['TADs', 'elastics', 'expanders', 'force arrows', 'display magnification']
              : []),
          ],
          interpolation: path.initialResponse
            ? 'Presentation progress from the unchanged unloaded reference to the un-magnified calculated initial response; linear translation and shortest-path quaternion rotation. Intermediate frames are display interpolation, not separately solved equilibria. No biological time or remodeling is implied.'
            : path.trajectory
              ? path.trajectory.motion.type === 'rigid'
                ? 'The displayed Try Mode edit from its saved starting arrangement; rigid rotation about the shared segment centre and case axis at equal angular intervals.'
                : 'The displayed Try Mode edit from its saved starting arrangement; linear translation and shortest-path quaternion rotation.'
              : 'Equal-duration segments through the saved original arrangement, checkpoints and final pose; linear translation and shortest-path quaternion rotation. Checkpoints may lie between sampled stages.',
          surfaceNote: `Meshes are collected in one STL without Boolean union. Gums remain static. The same attachment layout follows each crown in every stage. ${path.initialResponse ? 'The export uses an existing reduced-model response; it does not solve new mechanics, tissue remodeling, shell thickness, or manufacturing validation.' : 'No shell thickness, material, force, biological response, or fabrication validation is calculated.'}`,
          checkpoints: path.trajectory || path.initialResponse ? [] : path.checkpoints,
          original: path.trajectory || path.initialResponse ? undefined : path.original,
          trajectory: path.trajectory
            ? {
                label: path.trajectory.label,
                edit: path.trajectory.edit,
                from: path.trajectory.from,
                to: path.trajectory.to,
                motion: path.trajectory.motion,
              }
            : undefined,
          initialResponse: path.initialResponse
            ? {
                model: 'reduced-initial-elastic-response',
                progress: 'presentation-only',
                magnification: 1,
                biologicalTime: false,
                ...path.initialResponse,
              }
            : undefined,
          stages,
        },
        null,
        2,
      ),
    );
    requireBatchSize(scene.bytesPerStage * stages.length + files['manifest.json'].byteLength, 1);
    for (const stage of stages) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      files[stage.file] = encodeStage(scene, stage.transforms);
    }
  } finally {
    scene.dispose();
  }
  const archive = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    zipAsync(files, { level: 1, consume: true }, (error, data) =>
      error ? reject(error) : resolve(data),
    );
  });
  download('forma-educational-stages.zip', archive, 'application/zip');
}
