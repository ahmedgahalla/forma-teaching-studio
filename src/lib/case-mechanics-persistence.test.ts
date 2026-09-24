import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry } from 'three';
import { loadCase, saveCase, type DentalCase } from './geometry';
import { validateLectureSetup, type CaseSession } from './planning';
import type { Transforms, Vec3 } from './model';
import { createTryState, serializeTrySession } from './try-mode';
import { attachMechanicsResult, createMechanicsExperiment, experimentWithoutTad, solveMechanics, transitionMechanics } from './mechanics';

const models: DentalCase[] = [];
type Saved = { version: number; units: string; model: { name: string; demo: boolean; teeth: { id: string; position: Vec3; vertices: number[] }[] }; transforms: Transforms; session: CaseSession };
const asFile = (data: unknown) => new File([JSON.stringify(data)], 'lecture.forma.json', { type: 'application/json' });
function fixture() {
  const model: DentalCase = { name: 'Saved mechanics lecture', demo: true, gums: [], teeth: ['11', '21'].map((id, i) => ({ id, name: id, position: [i ? 5 : -5, 0, 0], geometry: new BoxGeometry(2, 2, 2), rootGeometry: new BoxGeometry(.5, 12, .5).translate(0, -6, 0), bracketPosition: [0, 0, 1.6], buccal: [0, 0, 1], mesial: [1, 0, 0], occlusal: [0, 1, 0], calibrated: true })) };
  models.push(model);
  const baseline: Transforms = { '11': { translation: [.2, .1, 0], rotation: [0, 5, 0] } };
  let mechanics = createMechanicsExperiment(model, baseline);
  mechanics = transitionMechanics(mechanics, { type: 'brackets', teeth: ['11', '21'], installed: true });
  mechanics = transitionMechanics(mechanics, { type: 'wire', id: 'wire-1', teeth: ['11', '21'], material: 'beta-titanium', section: { shape: 'round', diameterMm: .014 * 25.4 }, expansionMm: .1 });
  mechanics = transitionMechanics(mechanics, { type: 'tad', id: 'tad-1', position: [-5, 2, 5] });
  mechanics = transitionMechanics(mechanics, { type: 'elastic', id: 'elastic-1', from: { kind: 'tad', id: 'tad-1' }, to: { kind: 'tooth', tooth: '11', local: [0, 0, 1.6] }, law: { kind: 'constant', forceN: .1 } });
  mechanics = transitionMechanics(mechanics, { type: 'expander', id: 'expander-1', left: ['21'], right: ['11'], activationMm: .1, stiffnessNPerMm: 2, palateStiffnessNPerMm: 100 });
  mechanics = transitionMechanics(mechanics, { type: 'save-stage', label: 'First activation' });
  mechanics = transitionMechanics(mechanics, { type: 'support', preset: 'soft' });
  mechanics = transitionMechanics(mechanics, { type: 'save-stage', label: 'Compare support' });
  mechanics = transitionMechanics(mechanics, { type: 'stage', index: 0 });
  const result = solveMechanics(mechanics);
  mechanics = attachMechanicsResult(mechanics, result);
  mechanics = attachMechanicsResult(mechanics, solveMechanics(experimentWithoutTad(mechanics, 'tad-1')), true);
  mechanics.applied = result;
  const session: CaseSession = {
    stages: 8, checkpoints: [{ id: 'baseline', name: 'Reference arrangement', transforms: baseline }], past: [{ label: 'Initial response', value: baseline }], future: [], braces: true, roots: true, bracketStyle: 'metal', ligatureColor: '#3298bb', attachments: false,
    tryMode: serializeTrySession({ ...createTryState(result.transforms), lockedIds: ['21'] }), applianceDisplay: { preset: 'none', progress: 0, palate: false }, mechanics,
    lectureSetup: { camera: { position: [20, 30, 70], target: [0, 0, 0], up: [0, 1, 0], view: 'left', far: 10000, maxDistance: 3000 }, selectedIds: ['11', '21'], arch: 'both', view: 'left', gums: false, labels: true, grid: false, stage: 3.5, opening: 7.5, anatomy: { bone: true, opacity: .25, cutaway: false, ligament: true }, magnification: 10, forceVectors: true, mechanicsResponse: true, responseRevealed: false, predictResponse: true, playbackSpeed: .5, reverse: true, wirePreset: { material: 'beta-titanium', section: { shape: 'round', diameterMm: .014 * 25.4 } } },
  };
  return { model, session, transforms: result.transforms };
}
async function serialized() {
  vi.useFakeTimers();
  const { model, session, transforms } = fixture(); let blob: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(value => { blob = value as Blob; return 'blob:case'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const anchor = { href: '', download: '', click: vi.fn() }; vi.stubGlobal('document', { createElement: () => anchor });
  saveCase(model, transforms, session);
  expect(anchor.click).toHaveBeenCalledOnce(); expect(anchor.download).toBe('forma-case.json');
  return { raw: JSON.parse(await blob!.text()) as Saved, model, session, transforms };
}
async function restored(data: unknown) { const result = await loadCase(asFile(data)); models.push(result.model); return result; }
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); models.splice(0).forEach(model => { model.teeth.forEach(tooth => { tooth.geometry.dispose(); tooth.rootGeometry?.dispose(); }); model.gums.forEach(gum => gum.geometry.dispose()); }); });

describe('v3 mechanics and lecture case persistence', () => {
  it('round trips all appliance families, stages, lecture view and actual committed poses', async () => {
    const { raw, session, transforms, model } = await serialized(); expect(raw.version).toBe(3); expect(raw.units).toBe('mm');
    const loaded = await restored(raw), mechanics = loaded.session!.mechanics!;
    expect(loaded.transforms).toEqual(transforms); expect(loaded.session!.lectureSetup).toEqual(session.lectureSetup);
    expect(loaded.session!.tryMode).toEqual(session.tryMode); expect(loaded.session!.checkpoints).toEqual(session.checkpoints); expect(loaded.session!.past).toEqual(session.past);
    expect(mechanics.config).toEqual(session.mechanics!.config); expect(mechanics.reference).toEqual(session.mechanics!.reference); expect(mechanics.stages).toEqual(session.mechanics!.stages); expect(mechanics.stageIndex).toBe(0);
    expect(mechanics.result).toBeNull(); expect(mechanics.applied).toBeNull(); expect(mechanics.comparison).toBeNull();
    expect(solveMechanics(mechanics).transforms).toEqual(transforms);
    loaded.model.teeth.forEach((tooth, index) => { expect(Array.from(tooth.geometry.getAttribute('position').array)).toEqual(Array.from(model.teeth[index].geometry.getAttribute('position').array)); expect(Array.from(tooth.rootGeometry!.getAttribute('position').array)).toEqual(Array.from(model.teeth[index].rootGeometry!.getAttribute('position').array)); });
  });
  it('discards tampered cached results and independently recalculates from valid configuration', async () => {
    const { raw, transforms } = await serialized();
    raw.session.mechanics!.result!.transforms['11'].translation = [999, 0, 0];
    raw.session.mechanics!.applied!.teeth[0].forceN[0] = NaN;
    raw.session.mechanics!.comparison!.diagnostics.maxDisplacementMm = 500;
    const loaded = await restored(raw), mechanics = loaded.session!.mechanics!;
    expect(mechanics.result).toBeNull(); expect(mechanics.applied).toBeNull(); expect(mechanics.comparison).toBeNull();
    expect(loaded.transforms).toEqual(transforms); expect(solveMechanics(mechanics).transforms).toEqual(transforms);
  });
  it('valid changed inputs invalidate the previous response rather than trusting saved output', async () => {
    const { raw, transforms } = await serialized(); raw.session.mechanics!.config.elastics[0].law = { kind: 'constant', forceN: .2 };
    const loaded = await restored(raw); expect(loaded.session!.mechanics!.result).toBeNull();
    expect(solveMechanics(loaded.session!.mechanics!).transforms).not.toEqual(transforms);
  });
  it('normalizes missing response playback flags from earlier v3 files without trusting a cached result', async () => {
    const { raw } = await serialized(), lecture = raw.session.lectureSetup!;
    for (const key of ['mechanicsResponse', 'responseRevealed', 'predictResponse', 'playbackSpeed', 'reverse'] as const) delete lecture[key];
    const loaded = await restored(raw);
    expect(loaded.session!.lectureSetup).toMatchObject({ stage: 3.5, magnification: 10, mechanicsResponse: false, responseRevealed: true, predictResponse: false, playbackSpeed: 1, reverse: false });
    expect(loaded.session!.mechanics!.result).toBeNull();
  });
  it.each(['mechanicsResponse', 'responseRevealed', 'predictResponse', 'reverse'] as const)('rejects nonboolean response flag %s', async key => {
    const { raw } = await serialized(); Object.assign(raw.session.lectureSetup!, { [key]: 'true' });
    await expect(restored(raw)).rejects.toThrow(/response playback/);
  });
  it.each([0, .25, 1.5, 3, NaN, Infinity, null, '1'])('rejects unsupported or nonfinite playback speed %s', value => {
    const { session } = fixture(), invalid = { ...session.lectureSetup, playbackSpeed: value };
    expect(() => validateLectureSetup(invalid, new Set(['11', '21']), 8)).toThrow(/response playback/);
  });
  it.each([.5, 1, 2])('preserves supported playback speed %s and explicit false switches', speed => {
    const { session } = fixture();
    expect(validateLectureSetup({ ...session.lectureSetup, playbackSpeed: speed, mechanicsResponse: false, responseRevealed: false, predictResponse: false, reverse: false }, new Set(['11', '21']), 8)).toMatchObject({ playbackSpeed: speed, mechanicsResponse: false, responseRevealed: false, predictResponse: false, reverse: false });
  });
  it('rejects absent appliance targets and a reference that does not match the saved model', async () => {
    const { raw } = await serialized(), absent = structuredClone(raw); absent.session.mechanics!.config.wires[0].teeth.push('31');
    await expect(restored(absent)).rejects.toThrow(/teeth present/);
    const movedModel = structuredClone(raw); movedModel.model.teeth[0].position[0] += 1;
    await expect(restored(movedModel)).rejects.toThrow(/reference does not match/);
    const invalid = structuredClone(raw); invalid.session.mechanics!.config.tads[0].position[0] = Infinity;
    await expect(restored(invalid)).rejects.toThrow(/finite mechanics/);
  });
  it.each(['magnification', 'stage', 'camera', 'selection', 'section'] as const)('rejects invalid saved lecture %s', async field => {
    const { raw } = await serialized(), lecture = raw.session.lectureSetup!;
    if (field === 'magnification') lecture.magnification = 100;
    if (field === 'stage') lecture.stage = 8.1;
    if (field === 'camera') lecture.camera!.up = [0, 0, 0];
    if (field === 'selection') lecture.selectedIds = ['31'];
    if (field === 'section') lecture.wirePreset.section = { shape: 'round', diameterMm: .7 };
    await expect(restored(raw)).rejects.toThrow();
  });
  it.each([1, 2])('keeps version %s cases without mechanics or lecture metadata compatible', async version => {
    const { raw, transforms } = await serialized(); raw.version = version;
    delete raw.session.mechanics; delete raw.session.lectureSetup;
    if (version === 1) Reflect.deleteProperty(raw, 'session');
    const loaded = await restored(raw); expect(loaded.transforms).toEqual(transforms); expect(loaded.session?.mechanics).toBeUndefined(); expect(loaded.session?.lectureSetup).toBeUndefined();
    if (version === 2) expect(loaded.session!.stages).toBe(8);
  });
});
