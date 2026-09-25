import type { CaseRefs, CaseStudioApi } from './api';
import type { DentalCase } from '@/lib/geometry';
import type { Transforms } from '@/lib/model';
import type { CaseSession } from '@/lib/planning';
import type { ViewName } from '../Viewer';
import { errorText } from './constants';
import { toothArch } from '@/lib/appliances';
import { DEFAULT_APPLIANCE_DISPLAY } from '@/lib/appliance-display';
import { assertTryRestoreUnlocked, createTryState } from '@/lib/try-mode';
import { DEFAULT_ANATOMY } from '@/lib/teaching-anatomy';
import { download, importSTLs, loadCase } from '@/lib/geometry';
import { calculateMechanics } from '@/lib/mechanics-client';
import { attachMechanicsResult } from '@/lib/mechanics';
import { findSurfaceIntersections, movementRows } from '@/lib/analysis';
import { sampleCaseDemonstration } from '@/lib/teaching-cases';

export function createIoActions(api: CaseStudioApi, refs: CaseRefs) {
  const load = (next: DentalCase, transforms: Transforms = {}, saved?: CaseSession) => {
    if (
      !next.demo &&
      saved?.applianceDisplay &&
      !['none', 'braces'].includes(saved.applianceDisplay.preset)
    )
      throw new Error(
        'Imported cases support ordinary braces only. Use a synthetic model for the teaching appliance presets.',
      );
    api.setMechanics(saved?.mechanics || null);
    api.setPointed(null);
    api.setMechanicsFocus({});
    api.setResponseRevealed(true);
    refs.returnWorkspace.current = null;
    api.setWorkflowOrigin(null);
    api.setScenario(null);
    api.setApplianceDisplay(saved?.applianceDisplay || { ...DEFAULT_APPLIANCE_DISPLAY });
    api.setSandbox({ ...createTryState(transforms), ...saved?.tryMode });
    api.setComparisonName(saved?.tryMode?.comparisonName || null);
    api.setCurveVisible(false);
    api.setTraces(false);
    api.setReverse(false);
    api.setCommand('');
    api.setModel(next);
    api.dispatch({ type: 'load', value: transforms, past: saved?.past, future: saved?.future });
    api.teaching.cancel();
    api.teaching.resetHistory();
    api.setAnatomy({ ...DEFAULT_ANATOMY });
    api.setLessonId('');
    api.setLessonStep(-1);
    refs.lessonSnapshots.current = [];
    api.setDragPreview(null);
    api.setTool('orbit');
    api.setAttachments(saved?.attachments ?? false);
    api.setSelected(next.teeth[0].id);
    api.setSelectedIds([next.teeth[0].id]);
    api.setMeasureTo('');
    api.setLandmarks([]);
    api.setMeasureMode(false);
    api.setContacts(null);
    api.setStages(saved?.stages || 10);
    api.setStage(saved?.stages || 10);
    api.setCheckpoints(saved?.checkpoints || []);
    api.setPlaying(false);
    api.setView('perspective');
    api.setArch('both');
    api.setOpening(0);
    api.setDirection(next.demo ? 'buccal' : 'x');
    api.setGhost(false);
    api.setRoots(saved?.roots || false);
    api.setBraces(saved?.braces ?? false);
    api.setBracketStyle(saved?.bracketStyle || 'metal');
    api.setLigatureColor(saved?.ligatureColor || '#299f9b');
    api.setModal(null);
    if (saved?.lectureSetup) {
      const setup = saved.lectureSetup;
      api.setSelectedIds(setup.selectedIds);
      api.setSelected(setup.selectedIds[0]);
      api.setArch(setup.arch);
      api.setView(setup.view);
      api.setGums(setup.gums);
      api.setLabels(setup.labels);
      api.setGrid(setup.grid);
      api.setStage(setup.stage);
      api.setOpening(setup.opening);
      api.setAnatomy(setup.anatomy);
      api.setMagnification(setup.magnification);
      api.setForceVectors(setup.forceVectors);
      api.setWirePreset(setup.wirePreset);
      api.setResponseRevealed(setup.responseRevealed ?? true);
      api.setPredictResponse(setup.predictResponse ?? false);
      api.setPlaybackSpeed(setup.playbackSpeed ?? 1);
      api.setReverse(setup.reverse ?? false);
      refs.pendingCamera.current = setup.camera;
    }
    api.note(
      saved
        ? 'Case, movement history, and checkpoints restored.'
        : next.demo
          ? 'Synthetic orthodontic study loaded.'
          : 'Imported shared coordinates preserved. Calibrate anatomical axes before named movements or braces.',
    );
  };
  const importFiles = async () => {
    api.setBusy(true);
    api.setImportError('');
    try {
      load(await importSTLs(api.files, Number(api.scale)));
      api.setFiles([]);
    } catch (e) {
      api.setImportError(errorText(e));
    } finally {
      api.setBusy(false);
    }
  };
  const importCase = async (file?: File) => {
    if (!file) return;
    api.teaching.cancel();
    refs.importAbort.current?.abort();
    const controller = new AbortController();
    refs.importAbort.current = controller;
    api.setBusy(true);
    try {
      const saved = await loadCase(file);
      if (saved.session?.mechanics && saved.session.lectureSetup?.mechanicsResponse) {
        api.note('Restoring the experiment by recalculating its saved configuration…');
        const result = await calculateMechanics(saved.session.mechanics, controller.signal);
        saved.session.mechanics = {
          ...attachMechanicsResult(saved.session.mechanics, result),
          applied: result,
        };
        assertTryRestoreUnlocked(
          { current: saved.transforms, lockedIds: saved.session.tryMode?.lockedIds || [] },
          result.transforms,
        );
        saved.transforms = result.transforms;
      }
      if (!controller.signal.aborted) load(saved.model, saved.transforms, saved.session);
    } catch (e) {
      if (!controller.signal.aborted) api.note(errorText(e), true);
    } finally {
      if (refs.importAbort.current === controller) {
        refs.importAbort.current = null;
        api.setBusy(false);
      }
      if (refs.caseInput.current) refs.caseInput.current.value = '';
    }
  };
  const setCamera = (next: ViewName) => {
    if (next === 'occlusal' && api.arch === 'both') api.setArch(toothArch(api.selected));
    api.setView(next);
    refs.viewer.current?.setView(next);
  };
  const addCheckpoint = () => {
    if (api.prepared) {
      api.note('Explore the arrangement before saving free-edit checkpoints.', true);
      return;
    }
    if (api.checkpoints.length >= 20) {
      api.note('Use at most 20 checkpoints per case.', true);
      return;
    }
    const name = api.checkpointName.trim() || `Checkpoint ${api.checkpoints.length + 1}`;
    api.setCheckpoints([
      ...api.checkpoints,
      {
        id: crypto.randomUUID(),
        name: name.slice(0, 60),
        transforms: structuredClone(api.actualShown),
      },
    ]);
    api.setCheckpointName('');
    api.setStage(api.stages);
    api.setPlaying(false);
    api.note(
      `Captured the shown position as “${name}”. Subsequent movements update the final target.`,
    );
  };
  const scanContacts = () => {
    if (api.sandbox.pending) {
      api.note(
        'Use the preview path report, or Apply or Discard before checking committed surfaces.',
        true,
      );
      return;
    }
    api.setChecking(true);
    api.setStage(api.stages);
    api.setPlaying(false);
    refs.contactTimer.current = setTimeout(() => {
      try {
        const found = findSurfaceIntersections(
          api.model,
          api.prepared
            ? sampleCaseDemonstration(api.scenario!.caseId, api.scenario!.variantId, 1)
            : api.plan.current,
        );
        api.setContacts(found);
        api.note(
          `${found.length} crown-surface intersection pair${found.length === 1 ? '' : 's'} at the final pose. This checks surfaces, not biological clearance.`,
        );
      } catch (e) {
        api.note(errorText(e), true);
      } finally {
        api.setChecking(false);
      }
    }, 30);
  };
  const openCalibration = () => {
    api.setBAxis('+Z');
    api.setMAxis(['1', '4'].includes(api.selected[0]) ? '+X' : '-X');
    api.setOAxis(toothArch(api.selected) === 'upper' ? '-Y' : '+Y');
    api.setModal('calibrate');
  };
  const csv = () => {
    const rows = movementRows(
      api.model,
      api.prepared ? api.shown : api.plan.current,
      api.prepared ? api.caseStart : api.sandbox.original,
    );
    const lines = [
      'Tooth,Name,X_mm,Y_mm,Z_mm,Displacement_mm,Orientation_change_deg',
      ...rows.map(r =>
        [
          r.id,
          `"${r.name.replaceAll('"', '""')}"`,
          r.x.toFixed(4),
          r.y.toFixed(4),
          r.z.toFixed(4),
          r.displacement.toFixed(4),
          r.orientationChange.toFixed(4),
        ].join(','),
      ),
    ];
    download('forma-movement-summary.csv', lines.join('\n'), 'text/csv');
    api.note(
      'Movement summary download started. Orientation is the net angle from the original pose.',
    );
  };

  return {
    load,
    importFiles,
    importCase,
    setCamera,
    addCheckpoint,
    scanContacts,
    openCalibration,
    csv,
  };
}
