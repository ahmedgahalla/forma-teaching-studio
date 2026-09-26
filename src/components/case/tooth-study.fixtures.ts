import { afterAll, vi } from 'vitest';
import { BoxGeometry } from 'three';
import type { DentalCase } from '@/lib/geometry';
import type { TeachingContext } from '@/lib/classroom';
import type { TeachingHost } from '@/lib/teaching-runtime';
import { createTryState } from '@/lib/try-mode';
import type { ViewerCamera, ViewerHandle } from '../viewer/Viewer';
import { createClassroomActions } from './actions-classroom';
import { createLessonActions } from './actions-lesson';
import { createCasePreflight } from './preflight';
import { createTeachingDispatch } from './teaching-dispatch';
import type { CaseRefs, CaseStudioApi } from './api';
import type { ClassroomSnapshot } from './types';

const geometry = new BoxGeometry(8, 20, 8);
afterAll(() => geometry.dispose());
const model: DentalCase = {
  name: 'Synthetic study fixture',
  demo: true,
  gums: [],
  teeth: ['11', '16', '46'].map(id => ({
    id,
    name: id,
    calibrated: true,
    position: [0, 0, 0],
    buccal: [0, 0, 1],
    mesial: [1, 0, 0],
    occlusal: [0, -1, 0],
    geometry,
    rootGeometry: geometry,
  })),
};

export function setupToothStudy() {
  let camera: ViewerCamera = {
    position: [34, 45, 120],
    target: [5, 6, 7],
    up: [0, 0, 1],
    view: 'left',
    far: 900,
    maxDistance: 550,
  };
  // State setters emulate React updates; the real factories own capture, restore and dispatch.
  const values: Record<string, unknown> = {
    model,
    selected: '11',
    selectedIds: ['11', '46'],
    isolated: false,
    roots: false,
    gums: true,
    labels: true,
    arch: 'lower',
    view: 'left',
    anatomy: { bone: true, ligament: true, cutaway: true, opacity: 0.37 },
    toothStudy: null,
    playing: false,
    plan: { current: {}, past: [], future: [] },
    sandbox: createTryState(),
    lessonId: '',
    lessonStep: -1,
    stage: 10,
    stages: 10,
    mechanics: null,
    scenario: null,
    wirePreset: 'round-niti',
    magnification: 10,
    predictResponse: false,
    responseRevealed: true,
    forceVectors: true,
    pointed: null,
    mechanicsFocus: {},
    applianceDisplay: { preset: 'none', progress: 0, palate: false },
    workflowOrigin: null,
    comparisonName: null,
    traces: false,
    curveVisible: false,
    reverse: false,
    checkpoints: [],
    playbackSpeed: 1,
    bracketStyle: 'metal',
    ligatureColor: '#3298bb',
    lecture: false,
    tool: 'orbit',
    measureTo: '',
    measureMode: false,
    landmarks: [],
    ghost: false,
    braces: false,
    attachments: false,
    grid: false,
    opening: 0,
    note: vi.fn(),
    busy: false,
  };
  const api = new Proxy(values, {
    get(target, key) {
      if (key === 'tryState') return target.sandbox;
      if (typeof key === 'string' && key.startsWith('set')) {
        const field = key[3].toLowerCase() + key.slice(4);
        return (value: unknown) => {
          target[field] = value;
        };
      }
      return target[String(key)];
    },
  }) as unknown as CaseStudioApi;
  const viewer: ViewerHandle = {
    getCamera: () => structuredClone(camera),
    restoreCamera: next => {
      camera = next;
    },
    setView: vi.fn(),
    fit: vi.fn(),
    focus: vi.fn(),
    snapshot: vi.fn(),
    whenRendered: async () => {},
  };
  const refs: CaseRefs = {
    viewer: { current: viewer },
    pendingCamera: { current: null },
    pendingView: { current: null },
    caseInput: { current: null },
    commandInput: { current: null },
    contactTimer: { current: null },
    importAbort: { current: null },
    returnWorkspace: { current: null },
    lessonSnapshots: { current: [] },
  };
  values.dispatch = (action: { value: unknown; past: unknown[]; future: unknown[] }) => {
    values.plan = { current: action.value, past: action.past, future: action.future };
  };
  Object.assign(
    values,
    createLessonActions(api, refs),
    createClassroomActions(api, refs),
    createTeachingDispatch(api, refs),
  );
  const preflight = createCasePreflight(api, refs);
  const settle = async () => {
    if (refs.pendingCamera.current) {
      camera = refs.pendingCamera.current;
      refs.pendingCamera.current = null;
    }
  };
  const context = (): TeachingContext => ({
    mode: 'case',
    workflowId: null,
    stepIndex: 0,
    synthetic: api.model.demo,
    selected: api.selected,
    selectedIds: api.selectedIds,
    availableIds: model.teeth.map(tooth => tooth.id),
    revision: 0,
    view: api.view,
    arch: api.arch,
    speed: 1,
    stage: api.stage,
    stages: api.stages,
    ...(api.toothStudy
      ? { toothStudy: { tooth: api.toothStudy.tooth, view: api.toothStudy.view } }
      : {}),
  });
  const host: TeachingHost<ClassroomSnapshot> = {
    context,
    capture: api.captureClassroom,
    restore: api.restoreClassroom,
    preflight,
    settle,
    apply: action => {
      if (!api.applyTeaching(action)) throw new Error('Dispatch rejected the action.');
      // A rendered camera is independently observed and included in request history.
      if (action.kind === 'tooth-study' && ['open', 'view'].includes(action.action))
        camera = { ...camera, position: [12, 0, 42], up: [0, 1, 0] };
    },
    pause: () => api.setPlaying(false),
    narration: () => 'Synthetic tooth explanation.',
    speak: async () => {},
    interpret: vi.fn(),
    publish: vi.fn(),
  };
  return { api, refs, preflight, settle, host, camera: () => camera };
}
