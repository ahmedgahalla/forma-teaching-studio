import { useState } from 'react';
import type { TeachingAction } from '@/lib/lecture';
import type { DentalCase } from '@/lib/geometry';
import type { AnatomyViewState } from '@/lib/teaching-anatomy';
import { toothArch } from '@/lib/appliances';
import { getToothAnatomy } from '@/lib/tooth-anatomy';
import type { ToothStudyAction, ToothStudyView } from '@/lib/tooth-study/types';
import type { ArchView, ViewerCamera, ViewName } from '../viewer/Viewer';
import type { CaseRefs, CaseStudioApi } from './api';

export type ToothStudyPrior = {
  camera: ViewerCamera | null;
  selected: string;
  selectedIds: string[];
  isolated: boolean;
  roots: boolean;
  gums: boolean;
  labels: boolean;
  arch: ArchView;
  view: ViewName;
  anatomy: AnatomyViewState;
};
export type ToothStudyState = {
  tooth: string;
  view: ToothStudyView;
  revision: number;
  explanationVisible: boolean;
  model: DentalCase;
  prior: ToothStudyPrior;
};

export function useToothStudyState(model: DentalCase) {
  const [stored, setToothStudy] = useState<ToothStudyState | null>(null);
  const toothStudy = stored?.model === model ? stored : null;
  return { toothStudy, setToothStudy };
}

/** Reject unsupported models before any part of a request changes the display. */
export function assertStudyTooth(model: DentalCase, id: string) {
  const tooth = model.teeth.find(item => item.id === id);
  if (!model.demo || !tooth?.calibrated || !tooth.rootGeometry)
    throw new Error('Tooth study needs a calibrated tooth with roots on the synthetic model.');
  getToothAnatomy(id);
  return tooth;
}

export function applyToothStudy(
  api: CaseStudioApi,
  refs: Pick<CaseRefs, 'viewer' | 'pendingCamera' | 'pendingView'>,
  action: ToothStudyAction,
): boolean {
  const study = api.toothStudy;
  if (action.action === 'close') {
    if (!study) return true;
    const prior = study.prior;
    api.setSelected(prior.selected);
    api.setSelectedIds([...prior.selectedIds]);
    api.setIsolated(prior.isolated);
    api.setRoots(prior.roots);
    api.setGums(prior.gums);
    api.setLabels(prior.labels);
    api.setArch(prior.arch);
    api.setView(prior.view);
    api.setAnatomy({ ...prior.anatomy });
    api.setToothStudy(null);
    refs.pendingView.current = null;
    refs.pendingCamera.current = prior.camera;
    api.note('Prior mouth view restored.');
    return true;
  }
  if (action.action === 'open' || (action.action === 'explain' && !study)) {
    const id = action.action === 'open' ? action.tooth : api.selectedIds[0];
    if (action.action === 'explain' && api.selectedIds.length !== 1)
      throw new Error(
        'Select one tooth, or say “show tooth 16”, before asking for an explanation.',
      );
    assertStudyTooth(api.model, id);
    const prior: ToothStudyPrior = study?.prior ?? {
      camera: refs.viewer.current?.getCamera() ?? null,
      selected: api.selected,
      selectedIds: [...api.selectedIds],
      isolated: api.isolated,
      roots: api.roots,
      gums: api.gums,
      labels: api.labels,
      arch: api.arch,
      view: api.view,
      anatomy: { ...api.anatomy },
    };
    api.setSelectedIds([id]);
    api.setSelected(id);
    api.setIsolated(true);
    api.setRoots(true);
    api.setGums(false);
    api.setLabels(false);
    api.setArch(toothArch(id));
    api.setAnatomy({ ...api.anatomy, bone: false, ligament: false, cutaway: false });
    api.setPlaying(false);
    api.setToothStudy({
      tooth: id,
      view: action.action === 'open' ? (action.view ?? 'buccal') : 'buccal',
      revision: (study?.revision ?? 0) + 1,
      explanationVisible: action.action === 'explain',
      model: api.model,
      prior,
    });
    api.note(`Studying tooth ${id}. Teaching draft — pending educator review · synthetic model`);
    return true;
  }
  if (!study) throw new Error('Open a tooth first, for example “show tooth 16”.');
  api.setToothStudy(
    action.action === 'view'
      ? { ...study, view: action.view, revision: study.revision + 1 }
      : { ...study, explanationVisible: true },
  );
  return true;
}

/** Simulate study targets across a multi-clause request without mutating the scene. */
export function preflightToothStudy(
  actions: TeachingAction[],
  model: DentalCase,
  selected: string[],
  studied?: string,
) {
  if (
    actions.slice(0, -1).some(action => action.kind === 'tooth-study' && action.action === 'close')
  )
    throw new Error(
      'Close tooth study as the final action, then give commands for the restored view.',
    );
  let selectedIds = selected,
    tooth = studied;
  for (const action of actions) {
    if (action.kind === 'select') selectedIds = action.teeth;
    if (action.kind === 'focus') selectedIds = [action.tooth];
    if (action.kind !== 'tooth-study') continue;
    if (action.action === 'close') {
      tooth = undefined;
      continue;
    }
    const id = action.action === 'open' ? action.tooth : tooth;
    const target =
      id ?? (action.action === 'explain' && selectedIds.length === 1 ? selectedIds[0] : undefined);
    if (!target) throw new Error('Select one tooth or say "show tooth 16" first.');
    assertStudyTooth(model, target);
    tooth = target;
    selectedIds = [target];
  }
}
