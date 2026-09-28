import type { TeachingAction } from '@/lib/lecture';
import { createMechanicsExample } from '@/lib/mechanics-examples/factory';
import { assertTryRestoreUnlocked, assertTryUnlocked } from '@/lib/try-mode';
import type { CaseStudioApi } from './api';
import type { ClassroomSnapshot } from './types';

export function prepareMechanicsExample(
  api: CaseStudioApi,
  action: Extract<TeachingAction, { kind: 'mechanics-example' }>,
  saved?: ClassroomSnapshot,
) {
  const sandbox = saved?.sandbox ?? api.tryState;
  const scenario = saved ? saved.scenario : api.scenario;
  if (sandbox.pending || api.dragPreview || api.busy)
    throw new Error(
      'Apply or discard the preview and finish the import before loading an example.',
    );
  if (scenario && !scenario.exploring)
    throw new Error('Choose Explore this arrangement before loading a mechanics example.');
  if ((saved ? saved.toothStudy : api.toothStudy) || (saved?.lessonId ?? api.lessonId))
    throw new Error('Return to the mouth and close the guided lesson before loading an example.');
  const mechanics = saved ? saved.mechanics : api.mechanics;
  const stage = saved?.lesson.stage ?? api.stage,
    stages = saved?.lesson.stages ?? api.stages;
  if (!mechanics?.result && stage !== stages)
    throw new Error('Choose Show after before loading an example from this arrangement.');
  const baseline = mechanics?.reference.transforms ?? saved?.history.current ?? api.plan.current;
  const next = createMechanicsExample(
    saved?.lesson.model ?? api.model,
    baseline,
    saved?.lesson.selected ?? api.selected,
    action,
  );
  assertTryRestoreUnlocked(sandbox, baseline);
  assertTryUnlocked(sandbox, next.targets);
  next.experiment.revision = (mechanics?.revision ?? 0) + 1;
  return next;
}

export function preflightMechanicsExample(
  api: CaseStudioApi,
  actions: TeachingAction[],
  saved?: ClassroomSnapshot,
) {
  const example = actions.find(action => action.kind === 'mechanics-example');
  if (!example) return false;
  if (actions.length !== 1) throw new Error('Load a mechanics example as a separate request.');
  prepareMechanicsExample(api, example, saved);
  return true;
}
