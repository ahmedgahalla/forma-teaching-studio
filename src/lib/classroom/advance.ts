import type { TeachingAction } from '../lecture';
import { advanceMechanicsContext } from '../mechanics-commands';
import { WORKFLOWS } from '../workflows';
import { TEACHING_CASES } from '../teaching-cases';
import { copyContext, DEMO_IDS, type TeachingContext } from './types';

type Overrides = { arch: boolean; view: boolean; selection: boolean };
/** Advance a private preflight context; no scene, mesh, or caller state is changed. */
export function advance(context: TeachingContext, action: TeachingAction, overrides: Overrides) {
  const workflow = () => {
    if (context.mode === 'workflow' && context.workflowId === 'anatomy')
      return {
        retentionStepIndex: -1,
        steps: ['assessment', 'movement', 'movement', 'comparison'].map(phase => ({
          phase,
          arch: 'upper' as const,
          view: context.view,
        })),
      };
    const definition = WORKFLOWS.find(
      w => context.mode === 'workflow' && w.id === context.workflowId,
    );
    if (!definition) throw new Error('Start a teaching workflow first.');
    return definition;
  };
  const step = (index: number) => {
    const definition = workflow(),
      next = definition.steps[index];
    if (!next) throw new Error('That step is outside the current workflow.');
    context.stepIndex = index;
    if (!overrides.arch) context.arch = next.arch;
    if (!overrides.view) context.view = next.view;
    context.playing = false;
  };
  const select = (ids: string[]) => {
    context.selectedIds = [...ids];
    context.selected = ids[0];
    overrides.selection = true;
  };
  const previewSelection = (ids: string[]) => {
    const locked = ids.filter(id => context.lockedIds?.includes(id));
    if (locked.length) throw new Error(`Unlock ${locked.join(', ')} before changing its pose.`);
    select(ids);
    context.tryLastIds = [...ids];
    context.stage = 0;
  };
  if (action.kind === 'dental-arrangement') {
    if (context.mode === 'case' && context.tryPreview)
      throw new Error('Apply or discard the preview before loading a dental arrangement.');
    context.mode = 'case';
    context.synthetic = true;
    context.availableIds = [...DEMO_IDS];
    context.workflowId = null;
    context.playing = false;
  } else if (action.kind === 'mechanics') {
    advanceMechanicsContext(context, action.action);
  } else if (action.kind === 'case') {
    if (action.action !== 'pause' && context.tryPreview)
      throw new Error('Apply or discard the preview before changing the prepared case.');
    if (action.action === 'load') {
      const definition = TEACHING_CASES.find(item => item.id === action.id);
      if (!definition) throw new Error('Choose a supported prepared teaching case.');
      context.mode = 'case';
      context.workflowId = null;
      context.caseId = definition.id;
      context.caseVariantId = definition.variants[0].id;
      context.caseExploring = false;
      context.playing = false;
      return;
    }
    const definition =
      context.mode === 'case' && TEACHING_CASES.find(item => item.id === context.caseId);
    if (!definition) throw new Error('Load a prepared teaching case first.');
    if (action.action === 'variant' && !definition.variants.some(item => item.id === action.id))
      throw new Error(
        `Choose an authored variation: ${definition.variants.map(item => item.title).join('; ')}.`,
      );
    if (context.caseExploring && ['variant', 'play', 'reset', 'progress'].includes(action.action))
      throw new Error('Return to the prepared case before changing its variation or playback.');
    if (action.action === 'variant') {
      context.caseVariantId = action.id;
      context.playing = false;
    }
    if (action.action === 'play') context.playing = true;
    if (action.action === 'pause' || action.action === 'reset' || action.action === 'progress')
      context.playing = false;
    if (action.action === 'explore') {
      if (context.caseExploring)
        throw new Error('This arrangement is already open for free exploration.');
      context.caseExploring = true;
      context.playing = false;
    }
    if (action.action === 'return') {
      context.caseExploring = false;
      context.playing = false;
    }
  } else if (action.kind === 'workspace') {
    if (context.mode === 'case' && context.tryPreview)
      throw new Error('Apply or discard the preview before changing workspaces.');
    if (action.action === 'explore' && context.mode !== 'workflow')
      throw new Error('Open a teaching workflow before exploring its setup.');
    if (action.action === 'restore' && !context.canRestoreWorkspace)
      throw new Error('There is no saved workspace to restore.');
    if (action.action === 'lesson' && (context.mode !== 'case' || !context.hasWorkflowOrigin))
      throw new Error('This workspace has no source lesson to return to.');
    // Transfers are standalone: the host restores the destination model and its context.
  } else if (action.kind === 'appliance-display') {
    if (context.mode !== 'case')
      throw new Error('Explore this setup in your workspace before placing a teaching appliance.');
    if (!context.synthetic && !['none', 'braces'].includes(action.preset))
      throw new Error(
        'This teaching appliance preset requires a synthetic model. Imported cases support braces or no appliance.',
      );
  } else if (action.kind === 'try-display' || action.kind === 'try-playback') {
    if (context.mode !== 'case' || !context.tryMode)
      throw new Error('Enter Try Mode in your case before using its display controls.');
    if (action.kind === 'try-playback') {
      context.playing = true;
      context.stage = action.direction === 'reverse' ? 0 : (context.stages ?? 10);
    }
  } else if (action.kind === 'try') {
    if (context.mode !== 'case') throw new Error('Return to your case before using Try Mode.');
    const edit = action.action;
    if (edit.type === 'enter') {
      context.tryMode = true;
      return;
    }
    if (!context.tryMode) throw new Error('Enter Try Mode before using this command.');
    if (edit.type === 'exit') {
      if (context.tryPreview)
        throw new Error('Apply or discard the preview before leaving Try Mode.');
      context.tryMode = false;
      return;
    }
    if (edit.type === 'apply' || edit.type === 'cancel') {
      if (!context.tryPreview) throw new Error('Create a preview first.');
      context.tryPreview = false;
      context.stage = context.stages ?? 10;
      if (edit.type === 'apply' && context.tryLastIds?.some(id => context.lockedIds?.includes(id)))
        throw new Error('Unlock the previewed teeth before applying their movement.');
    } else if (edit.type === 'lock') {
      const locked = new Set(context.lockedIds);
      edit.teeth.forEach(id => (edit.locked ? locked.add(id) : locked.delete(id)));
      context.lockedIds = [...locked];
    } else if (edit.type === 'set-arch') {
      context.tryArchTargets![edit.arch] = { width: edit.width, depth: edit.depth };
      context.arch = edit.arch;
    } else if (edit.type === 'save-snapshot') {
      if (context.tryPreview)
        throw new Error('Apply or discard the preview before saving an arrangement.');
      if (!context.savedArrangementNames!.includes(edit.name))
        context.savedArrangementNames!.push(edit.name);
    } else if (edit.type === 'delete-snapshot') {
      if (!context.savedArrangementNames!.includes(edit.name))
        throw new Error('Name a saved arrangement in this case.');
      context.savedArrangementNames = context.savedArrangementNames!.filter(
        name => name !== edit.name,
      );
    } else if (edit.type === 'compare-snapshot') {
      if (edit.name !== null && !context.savedArrangementNames!.includes(edit.name))
        throw new Error('Name a saved arrangement in this case.');
    } else if (edit.type === 'preview-snapshot' || edit.type === 'preview-original') {
      if (edit.type === 'preview-snapshot' && !context.savedArrangementNames!.includes(edit.name))
        throw new Error('Name a saved arrangement in this case.');
      if (context.tryPreview)
        throw new Error('Apply or discard the current preview before making another.');
      context.tryPreview = true;
      context.tryLastMovement = false;
      previewSelection(context.availableIds);
    } else if (edit.type === 'revise') {
      if (!context.tryLastMovement)
        throw new Error('Preview a numeric movement before changing its amount.');
      context.tryPreview = true;
      if (context.tryLastIds) previewSelection(context.tryLastIds);
    } else if (edit.type === 'preview') {
      if (context.tryPreview)
        throw new Error('Apply or discard the current preview before making another.');
      if (
        edit.edit.type === 'fit-arch' &&
        (!context.synthetic || !context.tryArchTargets?.[edit.edit.arch])
      )
        throw new Error(
          'Arch fitting requires a synthetic model and an explicit arch width and depth.',
        );
      context.tryPreview = true;
      const operation = edit.edit;
      const ids =
        operation.type === 'dental'
          ? 'teeth' in operation.command
            ? operation.command.teeth
            : [operation.command.tooth]
          : operation.type === 'poses'
            ? Object.keys(operation.poses)
            : operation.type === 'close-gap' && operation.rule !== 'equal'
              ? [operation.teeth[operation.rule === 'first' ? 0 : 1]]
              : operation.teeth;
      previewSelection(ids);
      context.tryLastMovement =
        operation.type === 'dental'
          ? 'amount' in operation.command
          : ['segment-translate', 'segment-rotate', 'change-width'].includes(operation.type);
    }
  } else if (action.kind === 'workflow') {
    if (action.action === 'start') {
      context.mode = 'workflow';
      context.workflowId = action.id;
      context.synthetic = true;
      context.availableIds = [...DEMO_IDS];
      context.canReturnToLesson = true;
      if (overrides.selection) {
        if (!context.selectedIds.length || context.selectedIds.some(id => !DEMO_IDS.includes(id)))
          throw new Error('The selected teeth do not exist in the synthetic workflow.');
        context.selected = context.selectedIds[0];
      } else {
        context.selectedIds = ['11'];
        context.selected = '11';
      }
      step(0);
      return;
    }
    const definition = workflow();
    if (action.action === 'exit') {
      context.mode = 'case';
      context.workflowId = null;
      context.playing = false;
      return;
    }
    if (action.action === 'phase')
      step(
        action.phase === 'retention'
          ? definition.retentionStepIndex
          : definition.steps.findIndex(s => s.phase === action.phase),
      );
    if (action.action === 'next') step(context.stepIndex + 1);
    if (action.action === 'previous') step(context.stepIndex - 1);
    if (action.action === 'restart') step(0);
    if (action.action === 'play') {
      if (definition.steps[context.stepIndex].phase !== 'movement')
        step(definition.steps.findIndex(s => s.phase === 'movement'));
      context.playing = true;
    }
    if (action.action === 'pause') context.playing = false;
  } else if (action.kind === 'anatomy-lesson') {
    context.mode = 'workflow';
    context.workflowId = 'anatomy';
    context.stepIndex = action.action === 'start' ? 0 : action.action === 'translation' ? 1 : 2;
    context.synthetic = true;
    context.availableIds = [...DEMO_IDS];
    context.lessonActive = true;
    context.canReturnToLesson = true;
    select(['11']);
    context.arch = 'upper';
    context.playing = false;
  } else if (action.kind === 'anatomy') {
    if (!context.synthetic && (action.action === 'opacity' || action.visible))
      throw new Error(
        'Anatomy layers require a synthetic teaching model. Imported cases have no reconstructed bone or ligament.',
      );
    if (action.action === 'opacity') context.boneOpacity = action.value;
    else context.layers![action.action] = action.visible;
  } else if (action.kind === 'select') select(action.teeth);
  else if (action.kind === 'focus') select([action.tooth]);
  else if (action.kind === 'arch') {
    context.arch = action.arch;
    overrides.arch = true;
  } else if (action.kind === 'view') {
    context.view = action.view;
    overrides.view = true;
  } else if (action.kind === 'speed') context.speed = action.value;
  else if (action.kind === 'toggle') context.layers![action.target] = action.visible;
  else if (action.kind === 'stop') context.playing = false;
  else if (action.kind === 'progress') {
    if (context.mode === 'workflow') {
      const definition = workflow();
      if (definition.steps[context.stepIndex].phase !== 'movement')
        step(definition.steps.findIndex(item => item.phase === 'movement'));
    }
    context.stage = action.value * (context.stages ?? 10);
    context.playing = false;
  } else if (action.kind === 'question') {
    if (context.mode !== 'workflow' && !context.caseId)
      throw new Error(
        'Open a prepared teaching case or workflow with an authored question before revealing or hiding its answer.',
      );
  } else if (action.kind === 'narrate') {
    if (context.mode !== 'workflow' && !context.lessonActive)
      throw new Error('Start a lesson or workflow before asking for its explanation.');
  } else if (action.kind === 'return-lesson') {
    if (!context.canReturnToLesson && context.mode !== 'workflow')
      throw new Error('There is no saved lesson to return to.');
  } else if (action.kind === 'replay') {
    if (context.mode !== 'workflow' && !context.lastActions?.length)
      throw new Error('There is no completed demonstration to repeat.');
    if (action.slower) context.speed = 0.5;
  } else if (action.kind === 'lesson-step') {
    if (context.mode === 'workflow')
      step(
        action.action === 'restart' ? 0 : context.stepIndex + (action.action === 'next' ? 1 : -1),
      );
    else if (!context.lessonActive) throw new Error('Start a lesson before navigating its steps.');
  } else if (action.kind === 'stage') {
    if (context.mode === 'workflow') throw new Error('Use workflow steps in this demonstration.');
    const next =
      action.action === 'exact'
        ? action.stage
        : (context.stage ?? context.stages ?? 10) + (action.action === 'next' ? 1 : -1);
    if (next < 0 || next > (context.stages ?? 10))
      throw new Error('That stage is outside the current demonstration.');
    context.stage = next;
  } else if (action.kind === 'attachment') {
    if (context.mode === 'workflow') context.canReturnToLesson = true;
  } else if (action.kind === 'dental') {
    const command = action.command;
    if (
      context.mode === 'case' &&
      context.tryMode &&
      ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
        command.type,
      )
    ) {
      if (context.tryPreview)
        throw new Error('Apply or discard the current preview before making another.');
      context.tryPreview = true;
      context.tryLastMovement = 'amount' in command;
      previewSelection(
        'teeth' in command ? command.teeth : 'tooth' in command ? [command.tooth] : [],
      );
    }
    if (context.mode === 'workflow' && command.type === 'stages')
      throw new Error('Use workflow steps in this demonstration.');
    if (
      context.mode === 'workflow' &&
      ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
        command.type,
      )
    )
      context.canReturnToLesson = true;
    if ('teeth' in command) select(command.teeth);
    else if ('tooth' in command) select([command.tooth]);
    if (command.type === 'stages') {
      context.stages = command.count;
      context.stage = command.count;
    }
    if (command.type === 'play') {
      if (context.mode === 'workflow') {
        const definition = workflow();
        if (definition.steps[context.stepIndex].phase !== 'movement')
          step(definition.steps.findIndex(s => s.phase === 'movement'));
      }
      context.playing = true;
    }
  }
}
