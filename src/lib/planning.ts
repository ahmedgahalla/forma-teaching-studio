import { Euler, MathUtils, Quaternion } from 'three';
import { emptyPose, isPose, type Transforms, type Vec3 } from './model';
import { validateTrySession, type TrySession } from './try-mode';
import { validateApplianceDisplay, type ApplianceDisplay } from './appliance-display';

export type HistoryEntry = { value: Transforms; label: string };
export type Plan = { current: Transforms; past: HistoryEntry[]; future: HistoryEntry[] };
export type PlanAction = { type: 'commit'; value: Transforms; label: string } | { type: 'load'; value: Transforms; past?: HistoryEntry[]; future?: HistoryEntry[] } | { type: 'undo' | 'redo' };
export type Checkpoint = { id: string; name: string; transforms: Transforms };
export type CaseSession = { stages: number; checkpoints: Checkpoint[]; past: HistoryEntry[]; future: HistoryEntry[]; braces: boolean; roots: boolean; bracketStyle: 'metal' | 'ceramic'; ligatureColor: string; attachments?: boolean; tryMode?: TrySession; applianceDisplay?: ApplianceDisplay };

export function historyReducer(state: Plan, action: PlanAction): Plan {
  if (action.type === 'load') return { current: action.value, past: action.past || [], future: action.future || [] };
  if (action.type === 'commit') return { current: action.value, past: [...state.past, { value: state.current, label: action.label }], future: [] };
  if (action.type === 'undo') { const last = state.past.at(-1); return last ? { current: last.value, past: state.past.slice(0, -1), future: [...state.future, { value: state.current, label: last.label }] } : state; }
  const next = state.future.at(-1); return next ? { current: next.value, future: state.future.slice(0, -1), past: [...state.past, { value: state.current, label: next.label }] } : state;
}

export function interpolateTransforms(from: Transforms, to: Transforms, fraction: number): Transforms {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error('Preview fraction must be between 0 and 1.');
  if (fraction === 0) return from;
  if (fraction === 1) return to;
  const result: Transforms = {};
  for (const id of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const a = from[id] || emptyPose(), b = to[id] || emptyPose();
    const qa = new Quaternion().setFromEuler(new Euler(...a.rotation.map(MathUtils.degToRad) as Vec3));
    const qb = new Quaternion().setFromEuler(new Euler(...b.rotation.map(MathUtils.degToRad) as Vec3));
    const euler = new Euler().setFromQuaternion(qa.slerp(qb, fraction), 'XYZ');
    result[id] = { translation: a.translation.map((value, i) => value + (b.translation[i] - value) * fraction) as Vec3, rotation: [euler.x, euler.y, euler.z].map(MathUtils.radToDeg) as Vec3 };
  }
  return result;
}

/** Equal-duration segments follow user-captured positions, not an inferred treatment sequence. */
export function stageTransforms(final: Transforms, checkpoints: Checkpoint[], stage: number, count: number): Transforms {
  if (!Number.isInteger(count) || count < 2 || count > 50 || !Number.isFinite(stage) || stage < 0 || stage > count) throw new Error('Invalid stage.');
  const nodes: Transforms[] = [{}, ...checkpoints.map(p => p.transforms), final];
  if (stage === count) return final;
  const progress = stage / count * (nodes.length - 1);
  const segment = Math.floor(progress);
  return interpolateTransforms(nodes[segment], nodes[segment + 1], progress - segment);
}

export function validTransforms(value: unknown, ids: Set<string>): value is Transforms {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([id, pose]) => ids.has(id) && isPose(pose) && [...pose.translation, ...pose.rotation].every(n => Math.abs(n) <= 100000));
}

export function validateSession(value: unknown, ids: Set<string>): CaseSession | undefined {
  if (value === undefined) return undefined;
  const s = value as CaseSession;
  if (s?.attachments !== undefined && typeof s.attachments !== 'boolean') throw new Error('Invalid saved attachment visibility.');
  const history = (v: unknown): v is HistoryEntry[] => Array.isArray(v) && v.length <= 5000 && v.every(e => !!e && typeof e.label === 'string' && e.label.length < 300 && validTransforms(e.value, ids));
  if (!s || !Number.isInteger(s.stages) || s.stages < 2 || s.stages > 50 || !Array.isArray(s.checkpoints) || s.checkpoints.length > 20 || !s.checkpoints.every(c => !!c && typeof c.id === 'string' && typeof c.name === 'string' && c.name.length <= 60 && validTransforms(c.transforms, ids)) || !history(s.past) || !history(s.future) || typeof s.braces !== 'boolean' || typeof s.roots !== 'boolean' || !['metal', 'ceramic'].includes(s.bracketStyle) || !/^#[0-9a-f]{6}$/i.test(s.ligatureColor)) throw new Error('Invalid saved planning session.');
  if (new Set(s.checkpoints.map(c => c.id)).size !== s.checkpoints.length) throw new Error('Duplicate checkpoint identifiers.');
  return { ...s, ...(s.tryMode === undefined ? {} : { tryMode: validateTrySession(s.tryMode, [...ids]) }), ...(s.applianceDisplay === undefined ? {} : { applianceDisplay: validateApplianceDisplay(s.applianceDisplay) }) };
}
