'use client';
import type { CaseStudioApi } from './api';
import { LectureConsole } from '../lecture/LectureConsole';

export function CaseLectureOverlay({ api }: { api: CaseStudioApi }) {
  return (
    <>
      {api.lecture && (
        <LectureConsole
          compact={!api.caseVariant}
          collapsible={!!api.caseVariant}
          showPlayback={false}
          title={api.caseVariant?.title || 'Explore and explain'}
          objective={
            api.caseDefinition?.learningGoal ||
            'Select a group, preview a geometric change, and invite students to compare it with the starting arrangement.'
          }
          question={api.caseVariant?.question}
          answer={api.caseVariant?.answer}
          answerVisible={api.scenario?.answerVisible ?? false}
          onToggleAnswer={() =>
            void api.teaching.execute(
              [{ kind: 'question', visible: !api.scenario?.answerVisible }],
              'Toggle the prepared answer',
            )
          }
          playing={api.playing}
          progress={api.stage / api.stages}
          speed={api.playbackSpeed}
          canPlay={api.prepared || !!api.demonstration || api.moved > 0}
          disabled={api.busy}
          onPlayPause={() =>
            void api.teaching.execute(
              [
                api.playing
                  ? { kind: 'stop' }
                  : api.prepared
                    ? { kind: 'case', action: 'play' }
                    : { kind: 'dental', command: { type: 'play' } },
              ],
              api.playing ? 'Pause demonstration' : 'Play demonstration',
            )
          }
          onRestart={() =>
            void api.teaching.execute(
              [
                { kind: 'progress', value: 0 },
                ...(api.scenario ? [{ kind: 'question' as const, visible: false }] : []),
              ],
              'Return to the starting arrangement',
            )
          }
          onHalf={() =>
            void api.teaching.execute([{ kind: 'progress', value: 0.5 }], 'Pause at 50 percent')
          }
          onProgress={progress =>
            void api.teaching.execute(
              [{ kind: 'progress', value: progress }],
              'Set demonstration progress',
            )
          }
          onSpeed={value =>
            void api.teaching.execute(
              [{ kind: 'speed', value: value as 0.5 | 1 | 2 }],
              'Set presentation speed',
            )
          }
          variants={
            api.prepared
              ? api.caseDefinition?.variants.map(item => ({ id: item.id, label: item.title }))
              : undefined
          }
          variantId={api.scenario?.variantId}
          onVariant={id =>
            void api.teaching.execute(
              [{ kind: 'case', action: 'variant', id }],
              'Compare an authored demonstration from its start',
            )
          }
          explorationAction={
            api.scenario
              ? {
                  label: api.prepared ? 'Try this arrangement' : 'Return to prepared case',
                  onClick: () =>
                    void api.teaching.execute(
                      [{ kind: 'case', action: api.prepared ? 'explore' : 'return' }],
                      api.prepared
                        ? 'Explore the displayed arrangement'
                        : 'Return to the prepared case',
                    ),
                }
              : undefined
          }
          note={
            api.scenario
              ? undefined
              : 'Geometric illustration · playback speed is presentation speed · no biological prediction'
          }
        >
          <div className="lecture-quick-layers">
            <button
              aria-pressed={api.roots}
              onClick={() => void api.teaching.runControl(api.roots ? 'hide roots' : 'show roots')}
            >
              Roots
            </button>
            <button
              aria-pressed={api.gums}
              onClick={() => void api.teaching.runControl(api.gums ? 'hide gums' : 'show gums')}
            >
              Gingiva
            </button>
            <button
              aria-pressed={api.labels}
              onClick={() =>
                void api.teaching.runControl(api.labels ? 'hide labels' : 'show labels')
              }
            >
              Tooth numbers
            </button>
            <button
              aria-pressed={api.ghost}
              disabled={!!api.sandbox.pending}
              onClick={() =>
                void api.teaching.execute(
                  [{ kind: 'comparison', mode: api.ghost ? 'off' : 'overlay' }],
                  'Toggle original overlay',
                )
              }
            >
              Original overlay
            </button>
            {api.scenario && (
              <button onClick={() => void api.teaching.runControl('explain this step')}>
                Explain aloud
              </button>
            )}
            {api.tryActive && api.demonstration && (
              <button
                onClick={() =>
                  void api.teaching.execute(
                    [{ kind: 'try-playback', direction: 'reverse' }],
                    'Reverse the geometric edit',
                  )
                }
              >
                Reverse edit
              </button>
            )}
          </div>
        </LectureConsole>
      )}
    </>
  );
}
