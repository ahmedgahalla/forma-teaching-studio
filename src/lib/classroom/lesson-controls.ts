import { CommandValidationError } from '../commands';
import { LESSONS } from '../lessons';
import { normalizeSpeechCommand, parseTeachingCommand, type TeachingAction } from '../lecture';
import { advanceToothStudy } from './advance-tooth-study';
import { parseToothStudyClause } from './parse-tooth-study';
import { fields, oneOf, type TeachingContext } from './types';

export type LessonAction =
  { kind: 'lesson'; action: 'start'; id: string } | { kind: 'lesson'; action: 'close' };

export function parseLessonControl(text: string): LessonAction | undefined {
  if (/^(?:start|open) (?:the )?tooth (?:anatomy )?tour$/.test(text))
    return { kind: 'lesson', action: 'start', id: 'tooth-anatomy-tour' };
  if (/^(?:close|end|exit|finish) (?:the )?(?:tooth (?:anatomy )?tour|lesson)$/.test(text))
    return { kind: 'lesson', action: 'close' };
}

export function validateLessonAction(action: Record<string, unknown>): LessonAction {
  if (action.action === 'start') {
    fields(action, ['kind', 'action', 'id']);
    return {
      kind: 'lesson',
      action: 'start',
      id: oneOf(
        action.id,
        LESSONS.map(item => item.id),
      ),
    };
  }
  fields(action, ['kind', 'action']);
  return { kind: 'lesson', action: oneOf(action.action, ['close'] as const) };
}

/** Authored steps contain exactly one existing command; no interpreter participates. */
export function parseLessonCommand(
  command: string,
  selected: string,
  availableIds: string[],
  selectedIds: string[],
  toothStudy?: TeachingContext['toothStudy'],
): TeachingAction {
  const context: TeachingContext = {
    mode: 'case',
    workflowId: null,
    stepIndex: 0,
    selected,
    selectedIds,
    availableIds,
    synthetic: true,
    revision: 0,
    view: 'perspective',
    arch: 'both',
    speed: 1,
    toothStudy,
  };
  const source = normalizeSpeechCommand(command);
  const study = parseToothStudyClause(source, context);
  if (!study) return parseTeachingCommand(source, selected, availableIds, selectedIds);
  if (!Array.isArray(study))
    throw new CommandValidationError(study.clarification || 'Open a tooth first.');
  if (study.length !== 1)
    throw new CommandValidationError('A lesson step needs one authored action.');
  return study[0];
}

export function advanceLessonControl(context: TeachingContext, action: LessonAction): void {
  if (context.mode !== 'case' || context.caseId || context.hasWorkflowOrigin)
    throw new CommandValidationError(
      'Return to your free workspace before starting or closing a short lesson.',
    );
  if (context.tryPreview)
    throw new CommandValidationError('Apply or discard the preview before changing lessons.');
  context.glossaryId = null;
  if (action.action === 'close') {
    context.lessonActive = false;
    context.canReturnToLesson = false;
    context.toothStudy = undefined;
    context.arch = 'both';
    context.view = 'perspective';
    return;
  }
  const lesson = LESSONS.find(item => item.id === action.id);
  if (!lesson) throw new CommandValidationError('Choose an available short lesson.');
  context.lessonActive = true;
  context.canReturnToLesson = true;
  context.playing = false;
  if (lesson.id === 'tooth-anatomy-tour') {
    if (
      !context.synthetic ||
      ['11', '13', '14', '16', '46'].some(id => !context.availableIds.includes(id))
    )
      throw new CommandValidationError(
        'The tooth anatomy tour needs the complete synthetic teaching model.',
      );
    const tooth = advanceToothStudy(context, { kind: 'tooth-study', action: 'open', tooth: '11' });
    context.selected = tooth!;
    context.selectedIds = [tooth!];
  }
}
