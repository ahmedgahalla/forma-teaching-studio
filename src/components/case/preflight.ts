import type { TeachingAction } from '@/lib/lecture';
import { assertTryRestoreUnlocked, assertTryUnlocked, transitionTryMode } from '@/lib/try-mode';
import { createMechanicsExperiment, transitionMechanics } from '@/lib/mechanics';
import { applyDentalCommand } from '@/lib/model';
import { LESSONS, parseTeachingCommand } from '@/lib/lecture';
import { getTeachingCase, sampleCaseDemonstration } from '@/lib/teaching-cases';
import { validateApplianceDisplay } from '@/lib/appliance-display';
import type { CaseRefs, CaseStudioApi } from './api';
import type { ClassroomSnapshot } from './types';
import type { Command } from '@/lib/commands';

export function createCasePreflight(api: CaseStudioApi, refs: CaseRefs) {
  const preflight = (actions: TeachingAction[], from?: unknown) =>
    ((actions, from) => {
      const saved = from as ClassroomSnapshot | undefined;
      let transforms = saved?.history.current || api.plan.current,
        previewStage = saved?.lesson.stage ?? api.stage,
        count = saved?.lesson.stages ?? api.stages,
        index = saved?.lessonStep ?? api.lessonStep;
      const source = saved?.lesson.model || api.model,
        teeth = source.teeth;
      let lesson = LESSONS.find(item => item.id === (saved?.lessonId ?? api.lessonId));
      let candidate = { ...(saved?.sandbox || api.sandbox), current: transforms };
      const requireEndpoint = () => {
        if (
          candidate.active &&
          !lesson &&
          !candidate.pending &&
          candidate.lastEdit &&
          previewStage !== count
        )
          throw new Error(
            'Choose “show after” before starting a new edit or saving an arrangement. The visible model is partway through the last edit.',
          );
      };
      let mechanicsCandidate = saved ? saved.mechanics : api.mechanics;
      let mechanicsHasResult = !!mechanicsCandidate?.result,
        plannedSolve = false;
      const sourceScenario = saved ? saved.scenario : api.scenario;
      const sourcePrepared = sourceScenario && !sourceScenario.exploring;
      for (const action of actions) {
        if (action.kind === 'dental-arrangement') {
          if (candidate.pending || api.busy)
            throw new Error(
              'Apply or discard the preview and finish the import before changing the starting arrangement.',
            );
          if (actions.length !== 1)
            throw new Error('Load the dental arrangement first, then give the next instruction.');
        }
        if (action.kind === 'mechanics') {
          if (sourcePrepared)
            throw new Error('Choose Explore this arrangement before building an experiment.');
          if (candidate.pending)
            throw new Error('Apply or discard the geometric preview before changing appliances.');
          const previous = mechanicsCandidate || createMechanicsExperiment(source, transforms);
          if (action.action.type === 'explain') {
            if (!mechanicsHasResult) throw new Error('Calculate an initial response first.');
          } else {
            mechanicsCandidate = transitionMechanics(previous, action.action);
            if (action.action.type === 'solve') {
              mechanicsHasResult = true;
              plannedSolve = true;
            } else if (action.action.type === 'compare-without-tad' && !mechanicsHasResult)
              throw new Error('Calculate the original setup before comparing its anchorage.');
            else if (mechanicsCandidate.revision !== previous.revision) {
              mechanicsHasResult = false;
              assertTryRestoreUnlocked(candidate, mechanicsCandidate.reference.transforms);
            }
          }
        }
        if (
          plannedSolve &&
          (action.kind === 'try' ||
            (action.kind === 'dental' &&
              ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
                action.command.type,
              )))
        )
          throw new Error(
            'Finish the mechanical calculation first, then give the geometric editing instruction. This keeps the complete request verifiable before movement.',
          );
        if (
          sourcePrepared &&
          ((action.kind === 'try' && action.action.type !== 'enter') ||
            (action.kind === 'dental' &&
              ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
                action.command.type,
              )))
        )
          throw new Error('Choose Explore this arrangement before editing the prepared model.');
        if (action.kind === 'case') {
          if (action.action !== 'pause' && (api.busy || candidate.pending))
            throw new Error(
              'Finish any import and Apply or Discard the preview before changing the case.',
            );
          if (action.action === 'load') getTeachingCase(action.id);
          else if (!sourceScenario) throw new Error('Choose a prepared case first.');
          else if (action.action === 'variant')
            sampleCaseDemonstration(sourceScenario.caseId, action.id, 0);
        }
        if (action.kind === 'progress') previewStage = action.value * count;
        if (action.kind === 'question' && !sourceScenario)
          throw new Error('Choose a prepared teaching case first.');
        if (action.kind === 'workspace') {
          if (candidate.pending || api.busy)
            throw new Error(
              'Apply or discard the current preview and finish any import before changing workspaces.',
            );
          if (
            action.action === 'restore' &&
            !(saved ? saved.returnWorkspace : refs.returnWorkspace.current)
          )
            throw new Error('There is no saved workspace to restore.');
          if (action.action === 'lesson' && !(saved ? saved.workflowOrigin : api.workflowOrigin))
            throw new Error('There is no source lesson to return to.');
        }
        if (action.kind === 'appliance-display') {
          if (!source.demo && !['none', 'braces'].includes(action.preset))
            throw new Error('Use the synthetic model for these teaching appliances.');
          if (action.preset === 'braces' && teeth.some(tooth => !tooth.calibrated))
            throw new Error('Calibrate the imported tooth directions before placing braces.');
          validateApplianceDisplay({
            preset: action.preset,
            progress: action.progress ?? 0,
            palate: action.palate ?? false,
          });
        }
        if (action.kind === 'try') {
          if (
            ['preview', 'preview-original', 'preview-snapshot', 'save-snapshot'].includes(
              action.action.type,
            )
          )
            requireEndpoint();
          if (action.action.type === 'compare-snapshot' && candidate.pending)
            throw new Error('Apply or discard the preview before changing the comparison overlay.');
          candidate = transitionTryMode(source, candidate, action.action);
          transforms = candidate.current;
          if (action.action.type === 'apply' && mechanicsCandidate) {
            mechanicsCandidate = {
              ...createMechanicsExperiment(source, candidate.current),
              config: mechanicsCandidate.config,
              stages: mechanicsCandidate.stages,
              revision: mechanicsCandidate.revision + 1,
            };
            mechanicsHasResult = false;
          }
          if (action.action.type === 'enter') lesson = undefined;
          // The executor awaits playback after Apply, so subsequent edits start at its endpoint.
          if (action.action.type === 'apply' || action.action.type === 'cancel')
            previewStage = count;
          else if (candidate.pending) previewStage = 0;
        }
        if (action.kind === 'dental') {
          if (
            ['move', 'move_group', 'rotate', 'rotate_group', 'orthodontic', 'reset'].includes(
              action.command.type,
            )
          ) {
            const command = action.command as Extract<
              Command,
              { type: 'move' | 'move_group' | 'rotate' | 'rotate_group' | 'orthodontic' | 'reset' }
            >;
            assertTryUnlocked(candidate, 'teeth' in command ? command.teeth : [command.tooth]);
            if (candidate.active && !lesson) {
              requireEndpoint();
              candidate = transitionTryMode(source, candidate, {
                type: 'preview',
                edit: { type: 'dental', command },
              });
              previewStage = 0;
            } else {
              transforms = applyDentalCommand(transforms, teeth, command);
              candidate = { ...candidate, current: transforms };
            }
          }
          if (action.command.type === 'stages') {
            count = action.command.count;
            previewStage = count;
          }
        }
        if (action.kind === 'stage') {
          previewStage =
            action.action === 'exact'
              ? action.stage
              : Math.round(previewStage) + (action.action === 'next' ? 1 : -1);
          if (previewStage < 0 || previewStage > count)
            throw new Error(`Choose a stage from 0 to ${count}.`);
        }
        if (action.kind === 'comparison') {
          if (candidate.pending && action.mode === 'overlay')
            throw new Error('Apply or discard the preview before changing the comparison overlay.');
          if (action.mode === 'before') previewStage = 0;
          else if (action.mode === 'after' || (action.mode === 'overlay' && !sourceScenario))
            previewStage = count;
        }
        if (
          action.kind === 'try-playback' ||
          (action.kind === 'dental' && action.command.type === 'play')
        )
          previewStage =
            action.kind === 'try-playback' && action.direction === 'reverse' ? 0 : count;
        if (
          action.kind === 'toggle' &&
          action.target === 'roots' &&
          action.visible &&
          !teeth.some(tooth => tooth.rootGeometry)
        )
          throw new Error('This case has no root geometry.');
        if (action.kind === 'anatomy' && !source.demo)
          throw new Error(
            'Generated supporting anatomy is available only in the synthetic classroom.',
          );
        if (
          action.kind === 'attachment' &&
          action.action === 'add' &&
          action.teeth.some(id => !teeth.find(tooth => tooth.id === id)?.calibrated)
        )
          throw new Error('Calibrate tooth directions before placing an attachment.');
        if (action.kind === 'lesson-step') {
          if (!lesson) throw new Error('Choose a prepared lesson first.');
          if (action.action === 'next') {
            index++;
            const next = lesson.steps[index];
            if (!next) throw new Error('This lesson is complete.');
            const parsed = parseTeachingCommand(
              next.command,
              saved?.lesson.selected || api.selected,
              teeth.map(tooth => tooth.id),
              saved?.lesson.selectedIds || api.selectedIds,
            );
            if (parsed.kind === 'dental') {
              const target = applyDentalCommand(transforms, teeth, parsed.command);
              assertTryRestoreUnlocked(candidate, target);
              transforms = target;
            }
          } else {
            const target = (saved?.lessonSnapshots || refs.lessonSnapshots.current)[
              action.action === 'restart' ? 0 : index
            ];
            if (target) {
              assertTryRestoreUnlocked(candidate, target.transforms);
              transforms = target.transforms;
            }
            index = action.action === 'restart' ? -1 : Math.max(-1, index - 1);
          }
          candidate = { ...candidate, current: transforms, pending: null, lastEdit: null };
        }
        if (action.kind === 'return-lesson') {
          const target = (saved?.lessonSnapshots || refs.lessonSnapshots.current)[
            Math.max(0, index)
          ];
          if (!target)
            throw new Error('Advance the lesson before returning to its prepared setup.');
          assertTryRestoreUnlocked(candidate, target.transforms);
          transforms = target.transforms;
          candidate = { ...candidate, current: transforms, pending: null, lastEdit: null };
        }
      }
    })(actions, from);
  return preflight;
}
