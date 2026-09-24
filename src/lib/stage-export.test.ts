import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { strFromU8, unzipSync } from 'fflate';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { createAttachmentGeometry, type AttachmentSpec } from './attachments';
import { download, type DentalCase } from './geometry';
import { buildStageSTL, exportStage, exportStageSequence } from './stage-export';
import type { Transforms, Vec3 } from './model';
import { createTryState, previewPose, transitionTryMode } from './try-mode';

vi.mock('./geometry', async importOriginal => ({ ...await importOriginal<typeof import('./geometry')>(), download: vi.fn() }));

const spec: AttachmentSpec = { shape: 'rectangle', width: 1, height: 2, depth: .5, offsetMesial: 0, offsetOcclusal: 0, rotation: 0 };
const meshes: THREE.BufferGeometry[] = [];
function mesh(vertices: number[], indices?: number[]) {
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  if (indices) geometry.setIndex(indices);
  meshes.push(geometry); return geometry;
}
function sampleCase(): DentalCase {
  return {
    name: 'Lecture demo', demo: true,
    teeth: [{ id: '11', name: 'Central incisor', position: [10, 20, 30], buccal: [0, 0, 1], mesial: [1, 0, 0], occlusal: [0, -1, 0], calibrated: true,
      geometry: mesh([-1, -2, 0, 1, -2, 0, -1, 2, 0]), rootGeometry: mesh([0, 3, 0, 1, 3, 0, 0, 15, 0]) }],
    gums: [{ id: 'upper-gum', position: [-5, 4, 3], geometry: mesh([0, 0, 0, 1, 0, 0, 0, 1, 0]) }],
  };
}
function vertices(bytes: Uint8Array): number[][] {
  const geometry = new STLLoader().parse(bytes.slice().buffer), position = geometry.getAttribute('position');
  const result = Array.from({ length: position.count }, (_, index) => [position.getX(index), position.getY(index), position.getZ(index)]);
  geometry.dispose(); return result;
}
function triangleVertices(geometry: THREE.BufferGeometry): number[][] {
  const position = geometry.getAttribute('position');
  return Array.from({ length: geometry.index?.count ?? position.count }, (_, index) => {
    const vertex = geometry.index ? geometry.index.getX(index) : index;
    return [position.getX(vertex), position.getY(vertex), position.getZ(vertex)];
  });
}
function expectVertices(actual: number[][], expected: number[][]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, i) => point.forEach((n, axis) => expect(n).toBeCloseTo(expected[i][axis], 5)));
}
const pose = (translation: Vec3, rotation: Vec3 = [0, 0, 0]) => ({ translation, rotation });
async function downloadedBytes() {
  expect(download).toHaveBeenCalledOnce();
  return new Uint8Array(await new Blob([vi.mocked(download).mock.calls[0][1]]).arrayBuffer());
}

afterEach(() => { vi.restoreAllMocks(); vi.mocked(download).mockClear(); meshes.splice(0).forEach(geometry => geometry.dispose()); });

describe('stage STL geometry', () => {
  it('bakes translation and rotation in the crown pose, preserves gums, and excludes roots', () => {
    const model = sampleCase(), before = triangleVertices(model.teeth[0].geometry);
    const data = buildStageSTL(model, { '11': pose([2, -1, 3], [0, 0, 90]) }, false);
    expect(data.byteLength).toBe(84 + 2 * 50);
    expect(new TextDecoder().decode(data.subarray(0, 80))).toContain('units mm');
    expectVertices(vertices(data), [[14, 18, 33], [14, 20, 33], [10, 18, 33], [-5, 4, 3], [-4, 4, 3], [-5, 5, 3]]);
    expect(triangleVertices(model.teeth[0].geometry)).toEqual(before);
    expect(model.teeth[0].position).toEqual([10, 20, 30]);
  });

  it('honors indexed triangle ordering and an absent identity pose', () => {
    const model = sampleCase(); model.teeth[0].geometry.setIndex([2, 0, 1]);
    expectVertices(vertices(buildStageSTL(model, {}, false)).slice(0, 3), [[9, 22, 30], [9, 18, 30], [11, 18, 30]]);
  });

  it('inserts each configured attachment after its crown with exactly the same pose, without mutating or disposing source geometry', () => {
    const model = sampleCase();
    model.teeth[0].geometry = mesh([-2, -3, 1, 2, -3, 1, 2, 3, 1, -2, 3, 1], [0, 1, 2, 0, 2, 3]);
    model.teeth[0].attachment = spec;
    model.teeth.push({ ...model.teeth[0], id: '21', attachment: undefined, position: [-10, 20, 30] });
    const sourceDispose = vi.spyOn(model.teeth[0].geometry, 'dispose');
    const attachment = createAttachmentGeometry(model.teeth[0], spec); meshes.push(attachment);
    const local = triangleVertices(attachment), transforms = { '11': pose([2, -1, 3], [0, 0, 90]) };
    const withAttachments = vertices(buildStageSTL(model, transforms, true));
    const withoutAttachments = vertices(buildStageSTL(model, transforms, false));
    expectVertices(withAttachments.slice(6, 6 + local.length), local.map(([x, y, z]) => [12 - y, 19 + x, 33 + z]));
    expectVertices(withAttachments.slice(0, 6), withoutAttachments.slice(0, 6));
    expectVertices(withAttachments.slice(6 + local.length), withoutAttachments.slice(6));
    expect(withAttachments.length - withoutAttachments.length).toBe(36);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(model.teeth[0].attachment).toEqual(spec);
  });

  it('fails the whole export for an invalid attachment and releases earlier temporary attachments', () => {
    const model = sampleCase(); model.teeth[0].attachment = spec;
    model.teeth[0].geometry = mesh([-2, -3, 1, 2, -3, 1, 2, 3, 1, -2, 3, 1], [0, 1, 2, 0, 2, 3]);
    model.teeth.push({ ...model.teeth[0], id: '21', calibrated: false });
    const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    expect(() => buildStageSTL(model, {}, true)).toThrow(/Calibrate tooth 21/);
    expect(dispose).toHaveBeenCalledOnce();
    expect(() => buildStageSTL(model, {}, false)).not.toThrow();
  });

  it.each<Transforms>([ { '21': pose([0, 0, 0]) }, { '11': pose([Infinity, 0, 0]) }, { '11': pose([100001, 0, 0]) } ])('rejects invalid poses before writing %j', transforms => {
    expect(() => buildStageSTL(sampleCase(), transforms, false)).toThrow(/transforms/);
    expect(download).not.toHaveBeenCalled();
  });

  it('downloads one indexed stage with its units-preserving coordinates', async () => {
    const model = sampleCase(); exportStage(model, { '11': pose([1, 0, 0]) }, 3, false);
    expect(vi.mocked(download).mock.calls[0][0]).toBe('forma-stage-003.stl');
    expect(vi.mocked(download).mock.calls[0][2]).toBe('model/stl');
    expectVertices(vertices(await downloadedBytes()).slice(0, 3), [[10, 18, 30], [12, 18, 30], [10, 22, 30]]);
  });

  it.each([-1, .5, 51, NaN, Infinity])('rejects invalid single-stage index %s', index => {
    expect(() => exportStage(sampleCase(), {}, index, false)).toThrow(/Stage index/);
    expect(download).not.toHaveBeenCalled();
  });
});

describe('geometric stage ZIP', () => {
  it('exports a saved nonzero baseline through checkpoints and freezes it before yielding', async () => {
    const model = sampleCase(), original = { '11': pose([3, 2, 0], [0, 0, 20]) }, baseline = structuredClone(original);
    const checkpoints = [{ id: 'a', name: 'Middle', transforms: { '11': pose([5, 4, 0], [0, 0, 40]) } }], final = { '11': pose([9, 6, 0], [0, 0, 80]) };
    const pending = exportStageSequence(model, final, checkpoints, 4, false, null, undefined, original);
    original['11'].translation[0] = 99; await pending;
    const archive = unzipSync(await downloadedBytes()), manifest = JSON.parse(strFromU8(archive['manifest.json']));
    expect(manifest.original).toEqual(baseline); expect(manifest.interpolation).toMatch(/saved original arrangement/);
    expectVertices(vertices(archive['stage-000.stl']), vertices(buildStageSTL(model, baseline, false)));
    expectVertices(vertices(archive['stage-001.stl']), vertices(buildStageSTL(model, { '11': pose([4, 3, 0], [0, 0, 30]) }, false)));
    expectVertices(vertices(archive['stage-002.stl']), vertices(buildStageSTL(model, checkpoints[0].transforms, false)));
    expectVertices(vertices(archive['stage-004.stl']), vertices(buildStageSTL(model, final, false)));
  });
  it('rejects an invalid baseline before encoding or downloading a sequence', async () => {
    const encode = vi.spyOn(STLExporter.prototype, 'parse');
    await expect(exportStageSequence(sampleCase(), {}, [], 2, false, null, undefined, { '11': pose([Infinity, 0, 0]) })).rejects.toThrow(/transforms/);
    expect(encode).not.toHaveBeenCalled(); expect(download).not.toHaveBeenCalled();
  });
  it('exports un-magnified initial response from its own fixed reference and freezes its assumptions', async () => {
    const model = sampleCase(), from = { '11': pose([2, 0, 0]) }, to = { '11': pose([2.04, .02, 0], [0, 0, 2]) };
    const expectedFrom = structuredClone(from), expectedTo = structuredClone(to), assumptions = ['Virtual support; no remodeling.'];
    const pending = exportStageSequence(model, { '11': pose([50, 0, 0]) }, [{ id: 'unrelated', name: 'Unrelated geometric path', transforms: { '11': pose([20, 0, 0]) } }], 2, false, null, { from, to, assumptions }, { '11': pose([60, 0, 0]) });
    from['11'].translation[0] = 80; to['11'].translation[0] = 90; assumptions[0] = 'Changed later';
    await pending;
    const archive = unzipSync(await downloadedBytes()), manifest = JSON.parse(strFromU8(archive['manifest.json']));
    expect(manifest.initialResponse).toMatchObject({ model: 'reduced-initial-elastic-response', progress: 'presentation-only', magnification: 1, biologicalTime: false, from: expectedFrom, to: expectedTo, assumptions: ['Virtual support; no remodeling.'] });
    expect(manifest.checkpoints).toEqual([]); expect(manifest.trajectory).toBeUndefined();
    expect(manifest.interpolation).toMatch(/not separately solved equilibria/);
    expect(manifest.excluded).toEqual(expect.arrayContaining(['brackets', 'wires', 'TADs', 'elastics', 'expanders', 'display magnification']));
    expectVertices(vertices(archive['stage-000.stl']), vertices(buildStageSTL(model, expectedFrom, false)));
    expectVertices(vertices(archive['stage-001.stl']), vertices(buildStageSTL(model, { '11': pose([2.02, .01, 0], [0, 0, 1]) }, false)));
    expectVertices(vertices(archive['stage-002.stl']), vertices(buildStageSTL(model, expectedTo, false)));
  });

  it('rejects invalid or competing initial-response paths before encoding', async () => {
    const model = sampleCase(), preview = transitionTryMode(model, createTryState(), { type: 'preview', edit: { type: 'segment-translate', teeth: ['11'], axis: 'x', amount: 1 } }).pending!;
    const encode = vi.spyOn(STLExporter.prototype, 'parse');
    await expect(exportStageSequence(model, {}, [], 2, false, null, { from: {}, to: { '11': pose([Infinity, 0, 0]) }, assumptions: [] })).rejects.toThrow(/transforms/);
    await expect(exportStageSequence(model, {}, [], 2, false, null, { from: {}, to: {}, assumptions: [''] })).rejects.toThrow(/assumptions/);
    await expect(exportStageSequence(model, {}, [], 2, false, preview, { from: {}, to: {}, assumptions: [] })).rejects.toThrow(/one geometric path/);
    expect(encode).not.toHaveBeenCalled(); expect(download).not.toHaveBeenCalled();
  });

  it('exports the displayed rigid segment arc, including a non-original start and exact intermediate manifest poses', async () => {
    const model = sampleCase();
    model.teeth.push({ ...model.teeth[0], id: '21', position: [-10, 20, 30] });
    const start = { '11': pose([1, 2, 3]), '21': pose([1, 2, 3]) };
    const preview = transitionTryMode(model, createTryState(start), { type: 'preview', edit: { type: 'segment-rotate', teeth: ['11', '21'], axis: 'z', amount: 90 } }).pending!;
    const sourceGeometry = triangleVertices(model.teeth[0].geometry);
    const samples = [0, .5, 1].map(fraction => previewPose(preview, fraction));
    const exporting = exportStageSequence(model, preview.to, [{ id: 'unused', name: 'Unrelated checkpoint', transforms: { '11': pose([9, 0, 0]) } }], 2, false, preview);
    // The export owns one frozen path even if the live demonstration is later revised.
    preview.from['11'].translation[0] = 50;
    preview.to['11'].translation[0] = 50;
    if (preview.motion.type === 'rigid') preview.motion.amount = 5;
    await exporting;
    const archive = unzipSync(await downloadedBytes()), manifest = JSON.parse(strFromU8(archive['manifest.json']));
    expect(manifest.checkpoints).toEqual([]);
    expect(manifest.interpolation).toMatch(/shared segment centre/);
    expect(manifest.trajectory.motion.amount).toBe(90);
    expect(manifest.stages.map((stage: { transforms: Transforms }) => stage.transforms)).toEqual(JSON.parse(JSON.stringify(samples)));
    samples.forEach((sample, index) => expectVertices(vertices(archive[`stage-00${index}.stl`]), vertices(buildStageSTL(model, sample, false))));
    expectVertices(vertices(archive['stage-000.stl']).slice(0, 1), [[10, 20, 33]]);
    expectVertices(vertices(archive['stage-001.stl']).slice(0, 1), [[1 + 11 / Math.SQRT2, 22 + 7 / Math.SQRT2, 33]]);
    expectVertices(vertices(archive['stage-002.stl']).slice(0, 1), [[3, 31, 33]]);
    // A chord between endpoints would shorten the span at the midpoint.
    const centres = model.teeth.map(tooth => new THREE.Vector3(...tooth.position).add(new THREE.Vector3(...samples[1][tooth.id].translation)));
    expect(centres[0].distanceTo(centres[1])).toBeCloseTo(20, 10);
    expect(triangleVertices(model.teeth[0].geometry)).toEqual(sourceGeometry);
  });

  it('rejects invalid trajectory samples before encoding or downloading any stage', async () => {
    const model = sampleCase(), preview = transitionTryMode(model, createTryState(), { type: 'preview', edit: { type: 'segment-translate', teeth: ['11'], axis: 'x', amount: 1 } }).pending!;
    preview.to['11'].translation[0] = Infinity;
    const encode = vi.spyOn(STLExporter.prototype, 'parse');
    await expect(exportStageSequence(model, {}, [], 2, false, preview)).rejects.toThrow();
    expect(encode).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it('exports stage 0, every interval and the final with checkpoint order and a clear manifest', async () => {
    const model = sampleCase();
    const checkpoints = [
      { id: 'a', name: 'Move laterally', transforms: { '11': pose([4, 0, 0]) } },
      { id: 'b', name: 'Move vertically', transforms: { '11': pose([4, 6, 0]) } },
    ];
    await exportStageSequence(model, { '11': pose([10, 8, 0]) }, checkpoints, 6, false);
    expect(vi.mocked(download).mock.calls[0][0]).toBe('forma-educational-stages.zip');
    expect(vi.mocked(download).mock.calls[0][2]).toBe('application/zip');
    const archive = unzipSync(await downloadedBytes());
    expect(Object.keys(archive).sort()).toEqual(['manifest.json', ...Array.from({ length: 7 }, (_, i) => `stage-00${i}.stl`)]);
    const expectedDeltas = [[0, 0, 0], [2, 0, 0], [4, 0, 0], [4, 3, 0], [4, 6, 0], [7, 7, 0], [10, 8, 0]];
    expectedDeltas.forEach((delta, stage) => {
      const points = vertices(archive[`stage-00${stage}.stl`]);
      expectVertices(points.slice(0, 1), [[9 + delta[0], 18 + delta[1], 30 + delta[2]]]);
      expectVertices(points.slice(-3), [[-5, 4, 3], [-4, 4, 3], [-5, 5, 3]]);
    });
    const manifest = JSON.parse(strFromU8(archive['manifest.json']));
    expect(manifest).toMatchObject({ units: 'mm', stageIntervals: 6, stlFiles: 7, includeAttachments: false, checkpoints });
    expect(manifest.purpose).toMatch(/Educational.*not clinically validated/);
    expect(manifest.surfaceNote).toMatch(/without Boolean union/);
    expect(manifest.stages.map((s: { index: number }) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('uses the quaternion interpolation path at the midpoint', async () => {
    const model = sampleCase();
    await exportStageSequence(model, { '11': pose([0, 0, 0], [0, 0, 90]) }, [], 2, false);
    const archive = unzipSync(await downloadedBytes()), root2 = Math.sqrt(2);
    expectVertices(vertices(archive['stage-001.stl']).slice(0, 1), [[10 + 1 / root2, 20 - 3 / root2, 30]]);
  });

  it('accepts the upper interval boundary and names all 51 stage files in order', async () => {
    await exportStageSequence(sampleCase(), { '11': pose([2, 0, 0]) }, [], 50, false);
    const archive = unzipSync(await downloadedBytes());
    expect(Object.keys(archive)).toHaveLength(52);
    expect(Object.keys(archive).filter(name => name.endsWith('.stl'))).toEqual(Array.from({ length: 51 }, (_, i) => `stage-${String(i).padStart(3, '0')}.stl`));
    expectVertices(vertices(archive['stage-050.stl']).slice(0, 1), [[11, 18, 30]]);
  });

  it('freezes the requested path across asynchronous yields', async () => {
    const model = sampleCase(), final = { '11': pose([2, 0, 0]) };
    const pending = exportStageSequence(model, final, [], 2, false);
    final['11'].translation[0] = 50;
    await pending;
    expectVertices(vertices(unzipSync(await downloadedBytes())['stage-002.stl']).slice(0, 1), [[11, 18, 30]]);
  });

  it('includes attachment surfaces at every stage with the exact final pose', async () => {
    const model = sampleCase();
    model.teeth[0].geometry = mesh([-2, -3, 1, 2, -3, 1, 2, 3, 1, -2, 3, 1], [0, 1, 2, 0, 2, 3]);
    model.teeth[0].attachment = spec;
    const final = { '11': pose([1, 2, 3], [45, 30, 60]) };
    await exportStageSequence(model, final, [], 2, true);
    const archive = unzipSync(await downloadedBytes());
    for (let i = 0; i <= 2; i++) expect(vertices(archive[`stage-00${i}.stl`])).toHaveLength(45);
    expectVertices(vertices(archive['stage-002.stl']), vertices(buildStageSTL(model, final, true)));
    expect(JSON.parse(strFromU8(archive['manifest.json'])).includeAttachments).toBe(true);
  });

  it.each([1, 51, 2.5, NaN, Infinity])('rejects invalid interval count %s before exporting', async count => {
    await expect(exportStageSequence(sampleCase(), {}, [], count, false)).rejects.toThrow(/Invalid stage/);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects too many or invalid checkpoints without starting a download', async () => {
    const model = sampleCase();
    await expect(exportStageSequence(model, {}, Array.from({ length: 21 }, (_, i) => ({ id: String(i), name: 'Example', transforms: {} })), 2, false)).rejects.toThrow(/20 checkpoints/);
    await expect(exportStageSequence(model, {}, [{ id: 'a', name: 'Example', transforms: { '21': pose([1, 0, 0]) } }], 2, false)).rejects.toThrow(/transforms/);
    expect(download).not.toHaveBeenCalled();
  });

  it('guards raw batch size before allocating STL buffers while still allowing an individual stage', async () => {
    const model = sampleCase();
    model.teeth[0].geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(330000).map((_, i) => i % 3), 1));
    const encode = vi.spyOn(STLExporter.prototype, 'parse');
    await expect(exportStageSequence(model, {}, [], 50, false)).rejects.toThrow(/250 MB.*individual stages/);
    expect(encode).not.toHaveBeenCalled(); expect(download).not.toHaveBeenCalled();
    expect(buildStageSTL(model, {}, false).byteLength).toBe(84 + 110001 * 50);
  });
});
