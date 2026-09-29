'use client';
import type { CaseStudioApi } from './api';
import StageBar from '../shared/StageBar';
import { hasMechanicsMovement } from '@/lib/mechanics-presentation';

export function CaseStageDock({
  api,
  hideExplore = false,
  authored = false,
  canCalculate = false,
}: {
  api: CaseStudioApi;
  hideExplore?: boolean;
  authored?: boolean;
  canCalculate?: boolean;
}) {
  if (canCalculate && api.mechanics && !api.mechanics.result) {
    const busy = api.teaching.runtime.phase !== 'idle';
    return (
      <div className="lecture-calculation" aria-live="polite">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void api.teaching.execute(
              [{ kind: 'mechanics', action: { type: 'solve' } }],
              'Calculate response',
            )
          }
        >
          {busy ? 'Calculating response...' : 'Calculate response'}
        </button>
        <span>Initial elastic response</span>
      </div>
    );
  }
  return (
    <>
      {(api.prepared ||
        !!api.demonstration ||
        api.moved > 0 ||
        !!api.sandbox.pending ||
        !!api.mechanics?.result) && (
        <StageBar
          label={
            api.mechanics
              ? api.mechanics.result
                ? 'Calculated initial response'
                : 'Appliance setup · calculate to see a response'
              : api.prepared || authored
                ? 'Authored demonstration'
                : api.sandbox.pending
                  ? 'Geometric preview'
                  : 'Geometric movement'
          }
          progress={api.stage / api.stages}
          stages={api.stages}
          playing={api.playing}
          speed={api.playbackSpeed}
          canPlay={
            api.mechanics
              ? !!api.mechanics.result && hasMechanicsMovement(api.mechanics.result.diagnostics)
              : api.prepared || !!api.demonstration || api.moved > 0
          }
          onPlay={() =>
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
          onProgress={value => {
            api.teaching.interact();
            api.setPlaying(false);
            api.setStage(value * api.stages);
          }}
          onSpeed={value => api.setPlaybackSpeed(value as 0.5 | 1 | 2)}
          onStages={value => {
            api.setStages(value);
            api.setStage((api.stage / api.stages) * value);
          }}
          onReverse={() =>
            void api.teaching.execute(
              [{ kind: 'try-playback', direction: 'reverse' }],
              'Play in reverse',
            )
          }
          revealed={api.mechanics?.result ? api.responseRevealed : undefined}
          onReveal={() => {
            api.setResponseRevealed(true);
            api.setReverse(false);
            api.setStage(0);
            api.setPlaying(
              !!api.mechanics?.result && hasMechanicsMovement(api.mechanics.result.diagnostics),
            );
          }}
          onExplore={
            api.prepared && !hideExplore
              ? () =>
                  void api.teaching.execute(
                    [{ kind: 'case', action: 'explore' }],
                    'Explore this arrangement',
                  )
              : undefined
          }
        />
      )}
    </>
  );
}
