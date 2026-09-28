import { CommandValidationError } from '../commands';
import {
  MECHANICS_EXAMPLES,
  mechanicsExample,
  mechanicsExampleTargets,
} from '../mechanics-examples/catalog';
import type { TeachingAction } from './actions';
import type { TeachingContext, TeachingPlan } from './types';
import { validateTeachingPlan } from './plan-validate';
import { advancePresentation } from './presentation';

export function advanceLocalSceneControl(context: TeachingContext, action: TeachingAction) {
  return advancePresentation(context, action) || advanceMechanicsExample(context, action);
}

export function advanceMechanicsExample(context: TeachingContext, action: TeachingAction) {
  if (action.kind !== 'mechanics-example') return false;
  mechanicsExample(action.id, action.variant);
  if (context.mode !== 'case' || !context.synthetic)
    throw new Error('Open the synthetic model in Explore before loading a mechanics example.');
  if (context.tryPreview)
    throw new Error('Apply or discard the preview before loading a mechanics example.');
  if (
    (context.caseId && !context.caseExploring) ||
    (context.presentation && !context.presentation.exploring)
  )
    throw new Error(
      'Choose Explore this question or Explore this arrangement before loading an example.',
    );
  if (context.toothStudy || context.lessonActive)
    throw new Error('Return to the mouth and close the guided lesson before loading an example.');
  const targets = mechanicsExampleTargets(action.id, context.selected, context.availableIds);
  if (targets.some(id => context.lockedIds?.includes(id)))
    throw new Error('Unlock the example teeth before loading this force system.');
  context.selected = targets[0];
  context.selectedIds = targets;
  context.playing = false;
  return true;
}

/** Complete visible labels are deliberately local, including invalid/compound requests. */
export function parseMechanicsExamplePlan(
  source: string,
  context: TeachingContext,
): TeachingPlan | undefined {
  if (!/\bmechanics example\b/.test(source)) return;
  try {
    const name = source
      .replace(/^(?:load|show|open) (?:the )?mechanics example\s*/, '')
      .replace(/-/g, ' ');
    for (const example of MECHANICS_EXAMPLES) {
      for (const variant of example.variants) {
        const title = example.title.toLowerCase().replace(/-/g, ' '),
          label = variant.label.toLowerCase().replace(/-/g, ' ');
        if (name === `${title} ${label}` || (name === title && variant === example.variants[0]))
          return validateTeachingPlan(
            {
              actions: [{ kind: 'mechanics-example', id: example.id, variant: variant.id }],
              summary: `${example.title} · ${variant.label}`,
              clarification: null,
            },
            context,
            { allowLocalActions: true },
          );
      }
    }
    throw new CommandValidationError(
      'Name a mechanics example and its displayed variation as a separate request.',
    );
  } catch (error) {
    return {
      actions: [],
      summary: '',
      clarification: error instanceof Error ? error.message : 'Choose a mechanics example.',
    };
  }
}
