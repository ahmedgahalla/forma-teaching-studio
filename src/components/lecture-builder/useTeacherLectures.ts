'use client';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { CaseRefs, CaseStudioApi } from '../case/api';
import type { ClassroomSnapshot } from '../case/types';
import type { PresentationAction } from '@/lib/classroom/presentation';
import {
  createLectureDocument,
  createLectureStep,
  duplicateLectureStep,
  createLectureSample,
  type LectureStep,
  type LectureDocument,
} from '@/lib/lecture-documents';
import { getTeachingCase, sampleCaseDemonstration } from '@/lib/teaching-cases';
import { DEFAULT_ANATOMY } from '@/lib/teaching-anatomy';
import { useLectureLibrary } from './useLectureLibrary';
import { captureLectureScene } from './scene-bridge';
import {
  createLectureSessionActions,
  EMPTY_LECTURE_SESSION,
  type LectureSourceRef,
} from './session';

export function useTeacherLectures(api: CaseStudioApi, refs: CaseRefs) {
  const library = useLectureLibrary();
  const [session, setSession] = useState(EMPTY_LECTURE_SESSION);
  const [error, setError] = useState('');
  const original = useRef<ClassroomSnapshot | null>(null),
    paused = useRef<ClassroomSnapshot | null>(null);
  const source = useRef<LectureSourceRef['current']>(null);
  const captureScene = () =>
    captureLectureScene(
      api,
      source.current?.model === api.model ? source.current.source : undefined,
    );
  const document = library.documents.find(item => item.id === session.documentId);
  /* eslint-disable react-hooks/refs -- factory only closes over these return-point refs; reads occur in runtime callbacks, never during rendering */
  const actions = createLectureSessionActions(
    api,
    refs,
    session,
    setSession,
    library.get,
    document,
    original,
    paused,
    source,
  );
  /* eslint-enable react-hooks/refs */
  const guard = () => {
    if (api.sandbox.pending || api.dragPreview || api.busy)
      throw new Error(
        'Apply or discard the preview and finish loading before editing lecture steps.',
      );
    api.teaching.interact();
  };
  const attempt = (fn: () => void | Promise<void>) => {
    setError('');
    try {
      const result = fn();
      if (result)
        void result.catch(cause =>
          setError(cause instanceof Error ? cause.message : 'The lecture could not be updated.'),
        );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The lecture could not be updated.');
    }
  };
  const send = (action: PresentationAction) => {
    setError('');
    void api.teaching.execute([action], 'Update lecture');
  };
  const edit = (change: (doc: LectureDocument) => LectureDocument, index?: number) =>
    attempt(() => {
      guard();
      if (!document) return;
      flushSync(() => {
        library.put(change(document));
        if (index !== undefined) setSession({ ...session, index });
      });
      if (index !== undefined) api.teaching.resetHistory();
      if (index !== undefined) send({ kind: 'presentation', action: 'go', index });
    });
  const patchStep = (patch: Partial<LectureStep>, reload = false) =>
    edit(
      doc => ({
        ...doc,
        steps: doc.steps.map((step, i) => (i === session.index ? { ...step, ...patch } : step)),
      }),
      reload ? session.index : undefined,
    );
  const create = (sample: boolean) =>
    attempt(() => {
      guard();
      const scene = captureScene();
      const next = sample ? createLectureSample(scene) : createLectureDocument(scene);
      flushSync(() => library.put(next));
      send({ kind: 'presentation', action: 'open', id: next.id });
    });
  return {
    session,
    document,
    decorate: actions.decorate,
    error,
    active: session.screen !== 'explore',
    send,
    showLibrary: () => send({ kind: 'presentation', action: 'library' }),
    exit: () => send({ kind: 'presentation', action: 'exit' }),
    libraryProps: {
      documents: library.documents,
      error: library.error,
      onCreate: () => create(false),
      onSample: () => create(true),
      onOpen: (id: string) => send({ kind: 'presentation', action: 'open', id }),
      onDelete: (id: string) =>
        attempt(() => {
          guard();
          library.remove(id);
        }),
      onImport: (file: File) =>
        attempt(async () => {
          guard();
          await library.importFile(file);
        }),
    },
    navigationProps: {
      mode: session.mode,
      index: session.index,
      count: document?.steps.length ?? 0,
      exploring: session.exploring,
      onMode: (mode: 'prepare' | 'rehearse' | 'teach') =>
        send({ kind: 'presentation', action: mode }),
      onPrevious: () => send({ kind: 'presentation', action: 'previous' }),
      onNext: () => send({ kind: 'presentation', action: 'next' }),
      onExplore: () => send({ kind: 'presentation', action: 'explore' }),
      onReturn: () => send({ kind: 'presentation', action: 'return' }),
      onLibrary: () => send({ kind: 'presentation', action: 'library' }),
    },
    panelProps: document
      ? {
          document,
          index: session.index,
          mode: session.mode,
          answerVisible: session.answerVisible,
          notesVisible: session.notesVisible,
          saveStatus: library.saveStatus,
          onTitle: (title: string) => edit(doc => ({ ...doc, title })),
          onPatchStep: (
            patch: Partial<Pick<LectureStep, 'title' | 'notes' | 'question' | 'answer'>>,
          ) => patchStep(patch),
          onCapture: () =>
            attempt(() => {
              guard();
              patchStep({ scene: captureScene(), demo: undefined });
            }),
          onAdd: () =>
            attempt(() => {
              guard();
              const step = createLectureStep(captureScene(), `Step ${document.steps.length + 1}`);
              edit(doc => ({ ...doc, steps: [...doc.steps, step] }), document.steps.length);
            }),
          onDuplicate: () =>
            edit(
              doc => ({
                ...doc,
                steps: [
                  ...doc.steps.slice(0, session.index + 1),
                  duplicateLectureStep(doc.steps[session.index]),
                  ...doc.steps.slice(session.index + 1),
                ],
              }),
              session.index + 1,
            ),
          onDelete: () => {
            if (document.steps.length === 1) {
              setError('Keep at least one step in a lecture.');
              return;
            }
            edit(
              doc => ({ ...doc, steps: doc.steps.filter((_, i) => i !== session.index) }),
              Math.max(0, session.index - 1),
            );
          },
          onMove: (direction: -1 | 1) => {
            const index = session.index + direction;
            if (index < 0 || index >= document.steps.length) return;
            edit(doc => {
              const steps = [...doc.steps];
              [steps[index], steps[session.index]] = [steps[session.index], steps[index]];
              return { ...doc, steps };
            }, index);
          },
          onAttachDemo: (caseId: string, variantId: string) =>
            attempt(() => {
              guard();
              const definition = getTeachingCase(caseId),
                variant = definition.variants.find(item => item.id === variantId);
              if (!variant) throw new Error('Choose an available demonstration.');
              const scene = document.steps[session.index].scene;
              patchStep(
                {
                  demo: { caseId, variantId },
                  scene: {
                    ...scene,
                    source: { kind: 'case', id: caseId },
                    transforms: sampleCaseDemonstration(caseId, variantId, 0),
                    mechanics: undefined,
                    toothStudy: undefined,
                    isolated: false,
                    attachmentsByTooth: {},
                    setup: {
                      ...scene.setup,
                      camera: null,
                      selectedIds: definition.selectedIds,
                      view: definition.view,
                      arch: definition.arch,
                      stage: 0,
                      opening: 0,
                      anatomy: { ...DEFAULT_ANATOMY },
                      gums: true,
                      labels: false,
                      grid: false,
                    },
                    roots: caseId === 'movement-types',
                    braces: variant.appliance.preset !== 'none' || !!variant.removableRetainer,
                    applianceDisplay: variant.appliance,
                  },
                },
                true,
              );
            }),
          onDetachDemo: () => patchStep({ demo: undefined }, true),
          onGo: (index: number) => send({ kind: 'presentation', action: 'go', index }),
          onReveal: () =>
            send({
              kind: 'presentation',
              action: session.answerVisible ? 'hide-answer' : 'reveal',
            }),
          onNotes: () =>
            send({ kind: 'presentation', action: session.notesVisible ? 'hide-notes' : 'notes' }),
          onExport: () => attempt(() => library.exportFile(document)),
        }
      : null,
  };
}
export type TeacherLectures = ReturnType<typeof useTeacherLectures>;
