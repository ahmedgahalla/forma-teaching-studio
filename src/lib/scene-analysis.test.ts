import { describe, expect, it } from 'vitest';
import { sceneAnalysisContext, validateSceneAnalysis, type SceneAnalysis } from './scene-analysis';
import type { MechanicsExperiment, MechanicsResult } from './mechanics/types';
import type { Transforms } from './model';

function fixture() {
  const transforms: Transforms = { '11': { translation: [1, .5, 0], rotation: [0, 5, 0] } };
  const result: MechanicsResult = {
    revision: 7, transforms: { '11': { translation: [.01, 0, 0], rotation: [0, .2, 0] } },
    teeth: [], wires: [], elastics: [], expanders: [], tads: [],
    diagnostics: { iterations: 3, residual: 1e-12, maxDisplacementMm: .0116, maxRotationDeg: .2, assumptions: ['Initial elastic response only.'], warnings: ['No remodeling.'] },
  };
  const mechanics: MechanicsExperiment = {
    version: 1, revision: 7, reference: { teeth: [], transforms: {} }, stages: [], stageIndex: -1,
    config: {
      brackets: { '11': [0, 0, 1], '21': [0, 0, 1] },
      wires: [{ id: 'wire-private-name', teeth: ['11', '21'], material: 'stainless-steel', section: { shape: 'round', diameterMm: .4064 }, expansionMm: .5, torqueDeg: 0 }],
      tads: [{ id: 'anchor-private-name', position: [1, 2, 3] }], elastics: [], expanders: [], support: 'standard', fixedTeeth: ['21'],
    }, result, applied: null, comparison: null,
  };
  return { synthetic: true, ids: ['11', '21'], transforms, selectedIds: ['11'], arch: 'upper' as const, roots: true, gums: false, bone: true, lockedIds: ['21'], mechanics, revealResult: true, lesson: { title: 'Tipping and translation', explanation: 'Compare the authored paths.' } };
}

const answer = (): SceneAnalysis => ({ observations: 'Upper incisors are selected.', explanation: 'The supplied edits are geometric changes.', limitations: 'This is a teaching illustration.', studentQuestion: 'What would you compare next?', model: 'openai/gpt-6-luna' });

describe('read-only scene fact projection', () => {
  it('sends actual geometric values, visible layers, locks and supplied result facts only', () => {
    const facts = sceneAnalysisContext(fixture());
    expect(facts.teeth).toEqual([
      { id: '11', translationMm: [1, .5, 0], rotationDeg: [0, 5, 0], locked: false },
      { id: '21', translationMm: [0, 0, 0], rotationDeg: [0, 0, 0], locked: true },
    ]);
    expect(facts.layers).toEqual({ roots: true, gingiva: false, bone: true });
    expect(facts.visibleArch).toBe('upper');
    expect(facts.result).toEqual({ maxDisplacementMm: .0116, maxRotationDeg: .2, assumptions: ['Initial elastic response only.'], warnings: ['No remodeling.'] });
    expect(facts.appliances.tadCount).toBe(1);
    expect(facts.appliances.wires[0]).toEqual({ teeth: ['11', '21'], material: 'stainless-steel', section: { shape: 'round', diameterMm: .4064 }, expansionMm: .5, torqueDeg: 0 });
  });

  it('does not leak mesh data, patient metadata, keys or appliance names, including nested extra fields', () => {
    const source = Object.assign(fixture(), { patientName: 'PRIVATE_PATIENT', apiKey: 'PRIVATE_KEY', mesh: { vertices: ['PRIVATE_MESH'] } });
    Object.assign(source.lesson, { patientName: 'PRIVATE_LESSON_METADATA' });
    Object.assign(source.mechanics.config.wires[0].section, { apiKey: 'PRIVATE_SECTION_KEY' });
    const wire = sceneAnalysisContext(source);
    const serialized = JSON.stringify(wire);
    expect(serialized).not.toMatch(/PRIVATE_|private-name|mesh|apiKey|patientName/);
    expect(wire.lesson).toEqual({ title: source.lesson.title, explanation: source.lesson.explanation });
    expect(Object.keys(wire.appliances.wires[0].section).sort()).toEqual(['diameterMm', 'shape']);
  });

  it('copies nested facts so response preparation cannot mutate the source setup', () => {
    const source = fixture(), before = JSON.stringify(source), facts = sceneAnalysisContext(source);
    facts.selectedIds.push('21'); facts.teeth[0].translationMm[0] = 100; facts.teeth[0].rotationDeg[0] = 90;
    facts.appliances.bracketTeeth.pop(); facts.appliances.wires[0].teeth.pop();
    if (facts.appliances.wires[0].section.shape === 'round') facts.appliances.wires[0].section.diameterMm = .5;
    facts.result!.assumptions.push('extra'); facts.result!.warnings.length = 0;
    facts.lesson!.explanation = 'Changed outside the scene';
    expect(JSON.stringify(source)).toBe(before);
  });

  it('never exposes the hidden answer or a stale mechanics result', () => {
    const source = fixture();
    expect(sceneAnalysisContext({ ...source, revealResult: false }).result).toBeNull();
    expect(sceneAnalysisContext({ ...source, synthetic: false }).result).toBeNull();
    source.mechanics.revision++;
    expect(sceneAnalysisContext(source).result).toBeNull();
  });

  it('represents absent mechanics and authored lesson independently without inventing a result', () => {
    const source = fixture();
    const facts = sceneAnalysisContext({ ...source, mechanics: null, lesson: null });
    expect(facts.result).toBeNull(); expect(facts.lesson).toBeNull();
    expect(facts.appliances).toEqual({ bracketTeeth: [], wires: [], tadCount: 0, elasticCount: 0, expanderCount: 0 });
    expect(facts.teeth[0].translationMm).toEqual(source.transforms['11'].translation);
  });

  it('projects both permitted rectangular section dimensions explicitly', () => {
    const source = fixture();
    source.mechanics.config.wires[0].section = { shape: 'rectangle', widthMm: .635, heightMm: .4826 };
    Object.assign(source.mechanics.config.wires[0].section, { patientName: 'PRIVATE' });
    expect(sceneAnalysisContext(source).appliances.wires[0].section).toEqual({ shape: 'rectangle', widthMm: .635, heightMm: .4826 });
  });
});

describe('read-only AI response validation', () => {
  it('accepts the explanatory contract without creating editor actions', () => {
    expect(validateSceneAnalysis(answer())).toEqual(answer());
  });

  it.each([
    null, [], {}, { ...answer(), actions: [{ kind: 'select', teeth: ['11'] }] },
    { ...answer(), command: { type: 'move', amount: 1 } }, { ...answer(), explanation: '' },
    { ...answer(), observations: '   ' }, { ...answer(), model: 123 },
    { ...answer(), studentQuestion: null }, { ...answer(), limitations: 'x'.repeat(5001) },
  ])('rejects incomplete or expanded provider contracts', value => {
    expect(() => validateSceneAnalysis(value)).toThrow(/explanation was incomplete/i);
  });
});
