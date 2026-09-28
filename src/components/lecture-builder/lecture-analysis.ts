import type { LectureDocument } from '@/lib/lecture-documents';
import type { SceneAnalysisContext } from '@/lib/scene-analysis';
import type { LectureSession } from './session';

const comparisons = {
  start: 'the shared authored starting position',
  translation: 'the authored translation endpoint',
  tip: 'the authored tipping endpoint',
};

/** Add public lecture context without replacing the actual scene or exposing private notes. */
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
          ? `Comparison is active: the displayed model shows ${comparisons[session.comparison]}. The question and answer belong to the lecture step, while the model shows this comparison.`
          : step.demo
            ? 'This step has an authored movement demonstration. The supplied tooth transforms describe the current pose; this description does not specify playback progress.'
            : 'This step shows a static authored pose with no animation attached.',
        `Student question: ${step.question}`,
        session.answerVisible
          ? `Revealed lecture answer: ${step.answer}`
          : 'The prepared lecture answer is hidden; do not reveal it. No answer text is supplied.',
      ].join('\n\n'),
    },
  };
}
