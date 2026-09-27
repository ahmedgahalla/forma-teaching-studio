import { getGlossaryEntry } from '@/lib/glossary';
import { explainMechanics } from '@/lib/mechanics-presentation';
import { spokenToothExplanation } from '@/lib/tooth-anatomy';
import type { TeachingNarrationTarget } from '@/lib/teaching-narration';
import type { CaseStudioApi } from './api';

export function caseNarration(api: CaseStudioApi, target: TeachingNarrationTarget): string {
  if (target === 'glossary') {
    const entry = api.glossaryId ? getGlossaryEntry(api.glossaryId) : undefined;
    if (!entry) throw new Error('Choose an authored glossary term first.');
    return `${entry.term}. ${entry.definition}`;
  }
  if (target === 'tooth') {
    const id = api.toothStudy?.tooth;
    if (!id) throw new Error('Open a tooth before asking for its explanation.');
    return spokenToothExplanation(id);
  }
  if (target === 'mechanics') {
    if (!api.mechanics) throw new Error('Calculate an initial response first.');
    return explainMechanics(api.mechanics);
  }
  const { caseDefinition, caseVariant, scenario, workflowOrigin, currentLesson, lessonStep } = api;
  if (caseDefinition && caseVariant)
    return target === 'answer'
      ? caseVariant.answer
      : `${caseVariant.description} ${caseDefinition.learningGoal} ${scenario?.exploring ? 'This arrangement is now a free experiment.' : ''}`;
  if (workflowOrigin)
    return target === 'answer'
      ? workflowOrigin.setup.source.answer
      : `Source lesson: ${workflowOrigin.setup.source.explanation} Your current edits are a free geometric variation, not the authored result.`;
  if (target === 'answer')
    return 'Use the lesson explanation to discuss the geometry with your class.';
  return (
    currentLesson?.steps[Math.max(0, lessonStep)]?.caption ||
    'Select a prepared lesson or open the anatomy classroom to hear its explanation.'
  );
}
