import type { LectureDocument } from '@/lib/lecture-documents';
import type { SceneAnalysisContext } from '@/lib/scene-analysis';
import type { LectureSession } from './session';

const comparisons = {
  start: 'the shared authored starting position',
  translation: 'the authored translation endpoint',
  tip: 'the authored tipping endpoint',
  finish: 'the authored finished arrangement',
};

/** Match the single learner view, retaining actual scene facts and omitting reference notes. */
export function lectureAnalysisContext(
  context: SceneAnalysisContext,
  document: LectureDocument | undefined,
  session: LectureSession,
): SceneAnalysisContext {
  if (!document || session.screen !== 'lecture' || session.exploring) return context;
  const step = document.steps[session.index];
  return {
    ...context,
    lesson: {
      title: document.title,
      explanation: [
        `Lecture step ${session.index + 1} of ${document.steps.length}: ${step.title}`,
        session.comparison
          ? `Comparison is active: the displayed model shows ${comparisons[session.comparison]}. The takeaway belongs to the walkthrough step, while the model shows this comparison.`
          : step.scene.mechanics
            ? 'This step supplies appliance inputs for an initial elastic response. Only a supplied result establishes that a calculation has run; there is no biological timeline.'
            : step.demo || step.motion
              ? 'This step has an authored movement demonstration. The supplied tooth transforms describe the current pose; this description does not specify playback progress.'
              : 'This step shows a static authored pose with no animation attached.',
        ...(session.comparison ? [] : [`Visible step takeaway: ${step.answer}`]),
      ].join('\n\n'),
    },
  };
}

export function lectureNarration(document: LectureDocument, session: LectureSession) {
  return session.comparison
    ? `Comparison: ${comparisons[session.comparison]}. Close comparison to resume this step.`
    : document.steps[session.index].answer || document.steps[session.index].title;
}
