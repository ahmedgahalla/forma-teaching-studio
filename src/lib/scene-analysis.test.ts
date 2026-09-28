import { describe, expect, it } from 'vitest';
import { sceneAnalysisContext, validateSceneAnalysis, type SceneAnalysis } from './scene-analysis';
import type { MechanicsExperiment, MechanicsResult } from './mechanics/types';
import type { Transforms } from './model';

function fixture() {
  const transforms: Transforms = { '11': { translation: [1, 0.5, 0], rotation: [0, 5, 0] } };
  const result: MechanicsResult = {
    revision: 7,
    transforms: { '11': { translation: [0.01, 0, 0], rotation: [0, 0.2, 0] } },
    teeth: [],
    wires: [],
    elastics: [],
    expanders: [],
    tads: [],
    diagnostics: {
      iterations: 3,
      residual: 1e-12,
      maxDisplacementMm: 0.0116,
      maxRotationDeg: 0.2,
      assumptions: ['Initial elastic response only.'],
      warnings: ['No remodeling.'],
    },
  };
  const mechanics: MechanicsExperiment = {
    version: 1,
    revision: 7,
    reference: { teeth: [], transforms: {} },
    stages: [],
    stageIndex: -1,
    config: {
      brackets: { '11': [0, 0, 1], '21': [0, 0, 1] },
      wires: [
        {
          id: 'wire-private-name',
          teeth: ['11', '21'],
          material: 'stainless-steel',
          section: { shape: 'round', diameterMm: 0.4064 },
          expansionMm: 0.5,
          torqueDeg: 0,
        },
      ],
      tads: [{ id: 'anchor-private-name', position: [1, 2, 3] }],
      elastics: [
        {
          id: 'elastic-private-name',
          from: { kind: 'tad', id: 'anchor-private-name' },
          to: { kind: 'tooth', tooth: '11', local: [0, 0, 2] },
          law: { kind: 'constant', forceN: 0.2 },
        },
        {
          id: 'spring-private-name',
          from: { kind: 'tooth', tooth: '11', local: [1, 0, 2] },
          to: { kind: 'tooth', tooth: '21', local: [-1, 0, 2] },
          law: { kind: 'spring', stiffnessNPerMm: 0.4, restLengthMm: 10 },
        },
      ],
      expanders: [
        {
          id: 'expander-private-name',
          left: ['21'],
          right: ['11'],
          activationMm: 0.5,
          stiffnessNPerMm: 5,
          palateStiffnessNPerMm: 100,
        },
      ],
      support: 'standard',
      fixedTeeth: ['21'],
    },
    result,
    applied: null,
    comparison: null,
  };
  return {
    synthetic: true,
    ids: ['11', '21'],
    transforms,
    selectedIds: ['11'],
    arch: 'upper' as const,
    roots: true,
    gums: false,
    bone: true,
    lockedIds: ['21'],
    mechanics,
    revealResult: true,
    lesson: { title: 'Tipping and translation', explanation: 'Compare the authored paths.' },
  };
}

const answer = (): SceneAnalysis => ({
  observations: 'Upper incisors are selected.',
  explanation: 'The supplied edits are geometric changes.',
  limitations: 'This is a teaching illustration.',
  studentQuestion: 'What would you compare next?',
  model: 'openai/gpt-6-luna',
});

describe('read-only scene fact projection', () => {
  it('sends actual geometric values, visible layers, locks and supplied result facts only', () => {
    const facts = sceneAnalysisContext(fixture());
    expect(facts.teeth).toEqual([
      { id: '11', translationMm: [1, 0.5, 0], rotationDeg: [0, 5, 0], locked: false },
      { id: '21', translationMm: [0, 0, 0], rotationDeg: [0, 0, 0], locked: true },
    ]);
    expect(facts.layers).toEqual({ roots: true, gingiva: false, bone: true });
    expect(facts.visibleArch).toBe('upper');
    expect(facts.result).toEqual({
      maxDisplacementMm: 0.0116,
      maxRotationDeg: 0.2,
      assumptions: ['Initial elastic response only.'],
      warnings: ['No remodeling.'],
    });
    expect(facts.appliances.tadCount).toBe(1);
    expect(facts.appliances.wires[0]).toEqual({
      teeth: ['11', '21'],
      material: 'stainless-steel',
      section: { shape: 'round', diameterMm: 0.4064 },
      expansionMm: 0.5,
      torqueDeg: 0,
    });
  });

  it('does not leak mesh data, patient metadata, keys or appliance names, including nested extra fields', () => {
    const source = Object.assign(fixture(), {
      patientName: 'PRIVATE_PATIENT',
      apiKey: 'PRIVATE_KEY',
      mesh: { vertices: ['PRIVATE_MESH'] },
    });
    Object.assign(source.lesson, { patientName: 'PRIVATE_LESSON_METADATA' });
    Object.assign(source.mechanics.config.wires[0].section, { apiKey: 'PRIVATE_SECTION_KEY' });
    Object.assign(source.mechanics.config.tads[0], { patientName: 'PRIVATE_ANCHOR' });
    Object.assign(source.mechanics.config.elastics[0].from, { mesh: 'PRIVATE_ENDPOINT' });
    Object.assign(source.mechanics.config.elastics[0].law, { apiKey: 'PRIVATE_LAW' });
    Object.assign(source.mechanics.config.expanders[0], { patientName: 'PRIVATE_EXPANDER' });
    const wire = sceneAnalysisContext(source);
    const serialized = JSON.stringify(wire);
    expect(serialized).not.toMatch(/PRIVATE_|private-name|mesh|apiKey|patientName/);
    expect(wire.lesson).toEqual({
      title: source.lesson.title,
      explanation: source.lesson.explanation,
    });
    expect(Object.keys(wire.appliances.wires[0].section).sort()).toEqual(['diameterMm', 'shape']);
  });

  it('copies nested facts so response preparation cannot mutate the source setup', () => {
    const source = fixture(),
      before = JSON.stringify(source),
      facts = sceneAnalysisContext(source);
    facts.selectedIds.push('21');
    facts.teeth[0].translationMm[0] = 100;
    facts.teeth[0].rotationDeg[0] = 90;
    facts.appliances.bracketTeeth.pop();
    facts.appliances.wires[0].teeth.pop();
    if (facts.appliances.wires[0].section.shape === 'round')
      facts.appliances.wires[0].section.diameterMm = 0.5;
    facts.appliances.support!.translationNPerMm = 999;
    facts.appliances.fixedTeeth.length = 0;
    facts.appliances.tads[0].position[0] = 99;
    facts.appliances.tads[0].id = 'tad-8';
    const target = facts.appliances.elastics[0].to;
    if (target.kind === 'tooth') target.local[0] = 20;
    const law = facts.appliances.elastics[0].law;
    if (law.kind === 'constant') law.forceN = 1;
    facts.appliances.expanders[0].left.length = 0;
    facts.appliances.expanders[0].right.push('12');
    facts.result!.assumptions.push('extra');
    facts.result!.warnings.length = 0;
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
    expect(facts.result).toBeNull();
    expect(facts.lesson).toBeNull();
    expect(facts.appliances).toEqual({
      support: null,
      fixedTeeth: [],
      bracketTeeth: [],
      wires: [],
      tads: [],
      elastics: [],
      expanders: [],
      tadCount: 0,
      elasticCount: 0,
      expanderCount: 0,
    });
    expect(facts.teeth[0].translationMm).toEqual(source.transforms['11'].translation);
  });

  it('projects both permitted rectangular section dimensions explicitly', () => {
    const source = fixture();
    source.mechanics.config.wires[0].section = {
      shape: 'rectangle',
      widthMm: 0.635,
      heightMm: 0.4826,
    };
    Object.assign(source.mechanics.config.wires[0].section, { patientName: 'PRIVATE' });
    expect(sceneAnalysisContext(source).appliances.wires[0].section).toEqual({
      shape: 'rectangle',
      widthMm: 0.635,
      heightMm: 0.4826,
    });
  });

  it('distinguishes mechanical anchorage and support changes from editing locks', () => {
    const source = fixture();
    source.mechanics.config.fixedTeeth = [];
    const before = sceneAnalysisContext(source);
    source.mechanics.config.fixedTeeth = ['11'];
    source.mechanics.config.support = 'firm';
    const after = sceneAnalysisContext(source);
    expect(after.teeth).toEqual(before.teeth);
    expect(after.appliances.fixedTeeth).toEqual(['11']);
    expect(after.appliances.support).toEqual({
      preset: 'firm',
      translationNPerMm: 200,
      rotationNmmPerRad: 2000,
    });
    expect(before.appliances.support).toEqual({
      preset: 'standard',
      translationNPerMm: 100,
      rotationNmmPerRad: 1000,
    });
    const locked = sceneAnalysisContext({ ...source, lockedIds: ['11'] });
    expect(locked.appliances).toEqual(after.appliances);
    expect(locked.teeth[0].locked).toBe(true);
    expect(after.teeth[0].locked).toBe(false);
  });

  it('includes the soft virtual support coefficients without claiming a result', () => {
    const source = fixture();
    source.mechanics.config.support = 'soft';
    source.mechanics.result = null;
    const facts = sceneAnalysisContext(source);
    expect(facts.appliances.support).toEqual({
      preset: 'soft',
      translationNPerMm: 50,
      rotationNmmPerRad: 500,
    });
    expect(facts.result).toBeNull();
  });

  it('projects exact configured load laws and coordinates with consistent anonymous anchors', () => {
    const facts = sceneAnalysisContext(fixture()).appliances;
    expect(facts.tads).toEqual([{ id: 'tad-1', position: [1, 2, 3] }]);
    expect(facts.elastics).toEqual([
      {
        from: { kind: 'tad', id: 'tad-1' },
        to: { kind: 'tooth', tooth: '11', local: [0, 0, 2] },
        law: { kind: 'constant', forceN: 0.2 },
      },
      {
        from: { kind: 'tooth', tooth: '11', local: [1, 0, 2] },
        to: { kind: 'tooth', tooth: '21', local: [-1, 0, 2] },
        law: { kind: 'spring', stiffnessNPerMm: 0.4, restLengthMm: 10 },
      },
    ]);
    expect(facts.expanders).toEqual([
      {
        left: ['21'],
        right: ['11'],
        activationMm: 0.5,
        stiffnessNPerMm: 5,
        palateStiffnessNPerMm: 100,
      },
    ]);
    expect([facts.tadCount, facts.elasticCount, facts.expanderCount]).toEqual([1, 2, 1]);
  });

  it('does not expose anchor names when they resemble aliases or change between experiments', () => {
    const source = fixture();
    source.mechanics.config.tads.unshift({ id: 'tad-1', position: [-1, 3, 2] });
    const first = sceneAnalysisContext(source).appliances;
    expect(first.tads.map(tad => tad.id)).toEqual(['tad-1', 'tad-2']);
    expect(first.elastics[0].from).toEqual({ kind: 'tad', id: 'tad-2' });
    source.mechanics.config.tads[1].id = 'different-private-name';
    source.mechanics.config.elastics[0].from = { kind: 'tad', id: 'different-private-name' };
    expect(sceneAnalysisContext(source).appliances).toEqual(first);
  });

  it('keeps configured loads available while hiding stale, unrevealed and alternate results', () => {
    const source = fixture();
    const inputs = sceneAnalysisContext(source).appliances;
    source.mechanics.applied = source.mechanics.result;
    source.mechanics.comparison = source.mechanics.result;
    for (const input of [
      { ...source, revealResult: false },
      { ...source, synthetic: false },
      { ...source, mechanics: { ...source.mechanics, revision: 8 } },
      { ...source, mechanics: { ...source.mechanics, result: null } },
    ]) {
      const facts = sceneAnalysisContext(input);
      expect(facts.result).toBeNull();
      expect(facts.appliances).toEqual(inputs);
    }
  });

  it('represents an absent palate spring explicitly without inventing a coefficient', () => {
    const source = fixture();
    delete source.mechanics.config.expanders[0].palateStiffnessNPerMm;
    expect(sceneAnalysisContext(source).appliances.expanders[0].palateStiffnessNPerMm).toBeNull();
  });
});

describe('read-only AI response validation', () => {
  it('accepts the explanatory contract without creating editor actions', () => {
    expect(validateSceneAnalysis(answer())).toEqual(answer());
  });

  it.each([
    null,
    [],
    {},
    { ...answer(), actions: [{ kind: 'select', teeth: ['11'] }] },
    { ...answer(), command: { type: 'move', amount: 1 } },
    { ...answer(), explanation: '' },
    { ...answer(), observations: '   ' },
    { ...answer(), model: 123 },
    { ...answer(), studentQuestion: null },
    { ...answer(), limitations: 'x'.repeat(5001) },
  ])('rejects incomplete or expanded provider contracts', value => {
    expect(() => validateSceneAnalysis(value)).toThrow(/explanation was incomplete/i);
  });
});
