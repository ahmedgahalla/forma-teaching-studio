import { DoubleSide, Euler, MathUtils, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3 } from 'three';
import type { DentalCase, DentalTooth } from '../geometry';
import { anatomicalFrame, emptyPose, isPose, type Transforms, type Vec3 } from '../model';
import type { MechanicsAction, MechanicsConfig, MechanicsExperiment, MechanicsResult, MechanicsTooth } from './types';
import { validateMechanicsAction } from './validation';
import { MECHANICS_LIMITS as LIMIT } from './presets';
const clone = <T>(value: T): T => structuredClone(value);
const quaternion = (rotation: Vec3) => new Quaternion().setFromEuler(new Euler(...rotation.map(MathUtils.degToRad) as Vec3));
export const rotateLocal = (value: Vec3, rotation: Vec3): Vec3 => new Vector3(...value).applyQuaternion(quaternion(rotation)).toArray() as Vec3;

/** Match createApplianceKit: bracketPosition is its base; mechanics attaches at its slot. */
function bracketSlotLocal(tooth: DentalTooth, buccal: Vec3): Vec3 {
  const outward = new Vector3(...buccal);
  let base = tooth.bracketPosition ? new Vector3(...tooth.bracketPosition) : null;
  if (!base) {
    tooth.geometry.computeBoundingBox();
    const radius = tooth.geometry.boundingBox!.getSize(new Vector3()).length(), material = new MeshBasicMaterial({ side: DoubleSide });
    try {
      const probe = new Mesh(tooth.geometry, material); probe.updateMatrixWorld(true);
      const hit = new Raycaster(outward.clone().multiplyScalar(radius + 1), outward.clone().negate()).intersectObject(probe, false)[0];
      if (hit) base = hit.point.addScaledVector(outward, .28);
    } finally { material.dispose(); }
  }
  if (!base) throw new Error(`Tooth ${tooth.id} has no buccal surface for the schematic bracket.`);
  const slot = base.addScaledVector(outward, .67).toArray() as Vec3;
  if (slot.some(value => !Number.isFinite(value) || Math.abs(value) > LIMIT.localPointMm)) throw new Error('The bracket slot is outside the mechanical attachment domain.');
  return slot;
}

export function createMechanicsExperiment(model: DentalCase, baseline: Transforms = {}): MechanicsExperiment {
  if (!model.demo || !model.teeth.length || model.teeth.length > LIMIT.teeth || model.teeth.some(t => !t.calibrated || !/^[1-4][1-8]$/.test(t.id))) throw new Error('Mechanics requires a calibrated synthetic teaching model.');
  if (Object.entries(baseline).some(([id, pose]) => !model.teeth.some(t => t.id === id) || !isPose(pose) || [...pose.translation, ...pose.rotation].some(n => Math.abs(n) > 10000))) throw new Error('The mechanics reference poses are invalid.');
  const transforms: Transforms = {}, teeth: MechanicsTooth[] = model.teeth.map(tooth => {
    const pose = baseline[tooth.id] || emptyPose(), frame = anatomicalFrame(tooth); transforms[tooth.id] = clone(pose);
    if (!Array.isArray(tooth.position) || tooth.position.length !== 3 || tooth.position.some(n => !Number.isFinite(n)) || tooth.bracketPosition?.some(n => !Number.isFinite(n) || Math.abs(n) > LIMIT.localPointMm)) throw new Error('The mechanics reference has invalid point coordinates.');
    const vertices = tooth.rootGeometry?.getAttribute('position'); let low = Infinity, high = -Infinity;
    if (vertices) for (let i = 0; i < vertices.count; i++) { const p = vertices.getX(i) * frame.occlusal[0] + vertices.getY(i) * frame.occlusal[1] + vertices.getZ(i) * frame.occlusal[2]; low = Math.min(low, p); high = Math.max(high, p); }
    const rootLengthMm = vertices ? high - low : 12;
    if (!(rootLengthMm >= 2 && rootLengthMm <= 40)) throw new Error('The authored root extent is outside the teaching model domain.');
    return { id: tooth.id, position: tooth.position.map((v, i) => v + pose.translation[i]) as Vec3, rotation: [...pose.rotation], buccal: rotateLocal(frame.buccal, pose.rotation), occlusal: rotateLocal(frame.occlusal, pose.rotation), bracketLocal: bracketSlotLocal(tooth, frame.buccal), supportLocal: frame.occlusal.map(n => -n * rootLengthMm * .5) as Vec3, rootLengthMm };
  });
  if (new Set(teeth.map(t => t.id)).size !== teeth.length) throw new Error('The mechanics model contains duplicate tooth identifiers.');
  return { version: 1, revision: 0, reference: { teeth, transforms }, config: { brackets: {}, wires: [], tads: [], elastics: [], expanders: [], support: 'standard', fixedTeeth: [] }, stages: [], stageIndex: -1, result: null, applied: null, comparison: null };
}
const arch = (id: string) => Number(id[0]) <= 2 ? 'upper' : 'lower';
const wireOrder = (ids: string[]) => { const first = arch(ids[0]) === 'upper' ? '1' : '4'; return [...ids.filter(id => id[0] === first).sort().reverse(), ...ids.filter(id => id[0] !== first).sort()]; };
function requireObject<T extends { id: string }>(items: T[], id: string): T { const value = items.find(item => item.id === id); if (!value) throw new Error(`There is no appliance named ${id}.`); return value; }
function put<T extends { id: string }>(items: T[], value: T, max: number) { const index = items.findIndex(item => item.id === value.id); if (index >= 0) items[index] = value; else { if (items.length >= max) throw new Error(`This teaching model allows at most ${max} objects of this type.`); items.push(value); } }
function validateConfig(config: MechanicsConfig, ids: string[]) {
  for (const wire of config.wires) {
    validateMechanicsAction({ type: 'wire', ...wire }, ids);
    if (wire.teeth.length < 2 || wire.teeth.some(id => arch(id) !== arch(wire.teeth[0]) || !config.brackets[id])) throw new Error('A wire needs at least two installed brackets on one arch.');
    if (wire.section.shape === 'round' && wire.torqueDeg !== 0) throw new Error('Round-wire torque is unsupported; choose a rectangular section.');
  }
  for (const elastic of config.elastics) {
    validateMechanicsAction({ type: 'elastic', ...elastic }, ids);
    if (JSON.stringify(elastic.from) === JSON.stringify(elastic.to)) throw new Error('An elastic needs two different attachment points.');
    for (const end of [elastic.from, elastic.to]) if (end.kind === 'tad') requireObject(config.tads, end.id);
  }
  for (const expander of config.expanders) {
    validateMechanicsAction({ type: 'expander', ...expander }, ids);
    if ([...expander.left, ...expander.right].some(id => arch(id) !== 'upper') || expander.left.some(id => expander.right.includes(id))) throw new Error('A palatal actuator needs distinct upper teeth on its two sides.');
    if (new Set(expander.left.map(id => id[0])).size !== 1 || new Set(expander.right.map(id => id[0])).size !== 1 || expander.left[0][0] === expander.right[0][0]) throw new Error('Place each expander attachment group on one side of the upper arch, opposite the other group.');
  }
}
export function validateMechanicsConfiguration(state: MechanicsExperiment) { validateConfig(state.config, state.reference.teeth.map(t => t.id)); }
/** A configuration reducer only: solves are performed explicitly, preferably in a worker. */
export function transitionMechanics(previous: MechanicsExperiment, input: MechanicsAction): MechanicsExperiment {
  const ids = previous.reference.teeth.map(t => t.id), action = validateMechanicsAction(input, ids);
  const state = clone(previous), config = state.config;
  if (action.type === 'solve') {
    validateConfig(config, ids);
    if (!config.wires.some(w => w.expansionMm !== 0 || w.torqueDeg !== 0) && !config.elastics.some(e => e.law.kind === 'spring' || e.law.forceN > 0) && !config.expanders.some(e => e.activationMm > 0)) throw new Error('Add a wire activation, elastic load, or expander activation before showing the initial response.');
    return state;
  }
  if (action.type === 'explain') { if (!state.result && !state.applied) throw new Error('Calculate an initial response before asking for its explanation.'); return state; }
  if (action.type === 'apply') { if (!state.result || state.result.revision !== state.revision) throw new Error('Calculate a fresh response before applying it.'); state.applied = state.result; state.result = null; return state; }
  if (action.type === 'discard') { state.result = null; state.comparison = null; return state; }
  if (action.type === 'compare-without-tad') { requireObject(config.tads, action.id); return state; }
  if (action.type === 'save-stage') { if (state.stages.length >= LIMIT.stages) throw new Error(`Save at most ${LIMIT.stages} activation stages.`); state.stages.push({ label: action.label, config: clone(config) }); state.stageIndex = state.stages.length - 1; return state; }
  if (action.type === 'stage') { if (!state.stages[action.index]) throw new Error('Choose a saved activation stage.'); state.config = clone(state.stages[action.index].config); state.stageIndex = action.index; }
  else if (action.type === 'brackets') {
    if (!action.installed && config.wires.some(w => w.teeth.some(id => action.teeth.includes(id)))) throw new Error('Remove the connected wire before removing its brackets.');
    for (const id of action.teeth) if (action.installed) config.brackets[id] = clone(state.reference.teeth.find(t => t.id === id)!.bracketLocal); else delete config.brackets[id];
  } else if (action.type === 'bracket-position') { if (!config.brackets[action.tooth]) throw new Error('Install the bracket before positioning it.'); config.brackets[action.tooth] = clone(action.local); }
  else if (action.type === 'wire') put(config.wires, { id: action.id, teeth: wireOrder(action.teeth), material: action.material, section: clone(action.section), expansionMm: action.expansionMm ?? 0, torqueDeg: action.torqueDeg ?? 0 }, LIMIT.wires);
  else if (action.type === 'wire-material') requireObject(config.wires, action.id).material = action.material;
  else if (action.type === 'wire-section') requireObject(config.wires, action.id).section = clone(action.section);
  else if (action.type === 'wire-activation') { const wire = requireObject(config.wires, action.id); wire.expansionMm = action.expansionMm; if (action.torqueDeg !== undefined) wire.torqueDeg = action.torqueDeg; }
  else if (action.type === 'tad') put(config.tads, { id: action.id, position: clone(action.position) }, LIMIT.tads);
  else if (action.type === 'elastic') put(config.elastics, { id: action.id, from: clone(action.from), to: clone(action.to), law: clone(action.law) }, LIMIT.elastics);
  else if (action.type === 'expander') { const { type: _type, ...expander } = action; put(config.expanders, expander, LIMIT.expanders); }
  else if (action.type === 'support') config.support = action.preset;
  else if (action.type === 'anchor') config.fixedTeeth = action.fixed ? [...new Set([...config.fixedTeeth, ...action.teeth])] : config.fixedTeeth.filter(id => !action.teeth.includes(id));
  else if (action.type === 'remove') {
    const key = ({ wire: 'wires', tad: 'tads', elastic: 'elastics', expander: 'expanders' } as const)[action.kind];
    requireObject(config[key] as { id: string }[], action.id); (config[key] as { id: string }[]) = config[key].filter(item => item.id !== action.id);
    if (action.kind === 'tad') config.elastics = config.elastics.filter(elastic => ![elastic.from, elastic.to].some(end => end.kind === 'tad' && end.id === action.id));
  }
  validateConfig(state.config, ids); state.revision++; state.result = null; state.comparison = null;
  if (action.type !== 'stage') state.stageIndex = -1;
  return state;
}
export function experimentWithoutTad(state: MechanicsExperiment, id: string) {
  const alternate = transitionMechanics(state, { type: 'remove', kind: 'tad', id }); alternate.revision = state.revision;
  return alternate;
}
export function attachMechanicsResult(previous: MechanicsExperiment, result: MechanicsResult, comparison = false): MechanicsExperiment {
  if (result.revision !== previous.revision) throw new Error('The calculation is stale; calculate the current configuration.');
  const ids = previous.reference.teeth.map(t => t.id);
  const finiteData = (value: unknown): boolean => typeof value === 'number' ? Number.isFinite(value) : Array.isArray(value) ? value.every(finiteData) : value && typeof value === 'object' ? Object.values(value).every(finiteData) : true;
  if (Object.keys(result.transforms).length !== ids.length || ids.some(id => !isPose(result.transforms[id])) || !Array.isArray(result.teeth) || result.teeth.length !== ids.length || new Set(result.teeth.map(t => t.id)).size !== ids.length || result.teeth.some(t => !ids.includes(t.id)) || !finiteData(result) || !(result.diagnostics.residual >= 0 && result.diagnostics.residual < 1e-6)) throw new Error('The mechanics result is invalid.');
  return { ...previous, [comparison ? 'comparison' : 'result']: clone(result) };
}
/** Restore only validated inputs. Saved numerical results are not trusted and must be recalculated. */
export function validateMechanicsExperiment(raw: unknown, model: DentalCase): MechanicsExperiment {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid saved mechanics experiment.');
  const value = raw as MechanicsExperiment;
  if (value.version !== 1 || !value.reference || !value.reference.transforms || !Array.isArray(value.stages) || value.stages.length > LIMIT.stages) throw new Error('Unsupported saved mechanics experiment.');
  let state = createMechanicsExperiment(model, value.reference.transforms);
  if (JSON.stringify(state.reference.teeth) !== JSON.stringify(value.reference.teeth)) throw new Error('The saved mechanics reference does not match this model.');
  const restore = (config: MechanicsConfig) => {
    if (!config || typeof config !== 'object' || Object.keys(config).sort().join(',') !== 'brackets,elastics,expanders,fixedTeeth,support,tads,wires' || !config.brackets || typeof config.brackets !== 'object' || Array.isArray(config.brackets) || ![config.wires, config.tads, config.elastics, config.expanders, config.fixedTeeth].every(Array.isArray)) throw new Error('Invalid saved mechanics configuration.');
    for (const [items, max] of [[config.wires, LIMIT.wires], [config.tads, LIMIT.tads], [config.elastics, LIMIT.elastics], [config.expanders, LIMIT.expanders]] as const) if (items.length > max || items.some(item => !item || typeof item !== 'object' || 'type' in item) || new Set(items.map(item => item.id)).size !== items.length) throw new Error('Invalid or duplicate saved mechanics appliance.');
    let next = createMechanicsExperiment(model, value.reference.transforms);
    for (const [id, local] of Object.entries(config.brackets)) { next = transitionMechanics(next, { type: 'brackets', teeth: [id], installed: true }); next = transitionMechanics(next, { type: 'bracket-position', tooth: id, local }); }
    next = transitionMechanics(next, { type: 'support', preset: config.support });
    if (config.fixedTeeth.length) next = transitionMechanics(next, { type: 'anchor', teeth: config.fixedTeeth, fixed: true });
    for (const wire of config.wires) next = transitionMechanics(next, { type: 'wire', ...wire });
    for (const tad of config.tads) next = transitionMechanics(next, { type: 'tad', ...tad });
    for (const elastic of config.elastics) next = transitionMechanics(next, { type: 'elastic', ...elastic });
    for (const expander of config.expanders) next = transitionMechanics(next, { type: 'expander', ...expander });
    return next.config;
  };
  state.config = restore(value.config);
  state.stages = value.stages.map(stage => { if (!stage || typeof stage !== 'object' || Object.keys(stage).sort().join(',') !== 'config,label') throw new Error('Invalid saved mechanics stage.'); validateMechanicsAction({ type: 'save-stage', label: stage.label }); return { label: stage.label, config: restore(stage.config) }; });
  if (!Number.isInteger(value.stageIndex) || value.stageIndex < -1 || value.stageIndex >= state.stages.length || !Number.isInteger(value.revision) || value.revision < 0 || value.revision > 1e9) throw new Error('Invalid saved mechanics stage or revision.');
  state = { ...state, stageIndex: value.stageIndex, revision: value.revision };
  return state;
}
