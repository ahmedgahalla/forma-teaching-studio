'use client';
import type { CaseStudioApi } from './api';
import { CaseScenarioPanel } from '../StudioExperience';

export function InspectorScenario({ api }: { api: CaseStudioApi }) {
  const { scenario, caseDefinition, caseVariant } = api;
  return (
    <>
      {api.panel === 'move' && scenario && caseDefinition && caseVariant && (
        <>
          <CaseScenarioPanel
            showPlayback={false}
            title={caseDefinition.title}
            description={caseDefinition.description}
            category={caseDefinition.category}
            observe={caseDefinition.learningGoal}
            question={caseVariant.question}
            answer={caseVariant.answer}
            answerVisible={scenario.answerVisible}
            onToggleAnswer={() =>
              void api.teaching.execute(
                [{ kind: 'question', visible: !scenario.answerVisible }],
                scenario.answerVisible ? 'Hide answer' : 'Reveal answer',
              )
            }
            variants={caseDefinition.variants.map(item => ({
              id: item.id,
              label: item.title,
              description: item.description,
            }))}
            variantId={scenario.variantId}
            onVariantChange={id =>
              void api.teaching.execute(
                [{ kind: 'case', action: 'variant', id }],
                'Choose case demonstration',
              )
            }
            progress={scenario.exploring ? scenario.returnProgress : api.stage / api.stages}
            playing={api.playing}
            speed={api.playbackSpeed}
            compare={api.ghost}
            onProgressChange={value =>
              void api.teaching.execute(
                [{ kind: 'case', action: 'progress', value }],
                'Set demonstration progress',
              )
            }
            onSpeedChange={value =>
              void api.teaching.execute([{ kind: 'speed', value }], 'Set playback speed')
            }
            onTogglePlaying={() =>
              void api.teaching.execute(
                [{ kind: 'case', action: api.playing ? 'pause' : 'play' }],
                api.playing ? 'Pause case' : 'Play case',
              )
            }
            onReset={() =>
              void api.teaching.execute([{ kind: 'case', action: 'reset' }], 'Reset prepared case')
            }
            onCompare={() =>
              void api.teaching.execute(
                [{ kind: 'comparison', mode: api.ghost ? 'off' : 'overlay' }],
                'Compare the case start',
              )
            }
            onExplore={() =>
              void api.teaching.execute(
                [{ kind: 'case', action: 'explore' }],
                'Explore this arrangement',
              )
            }
            onReturn={() =>
              void api.teaching.execute(
                [{ kind: 'case', action: 'return' }],
                'Return to prepared case',
              )
            }
            edited={scenario.exploring}
            disabled={!!api.sandbox.pending || api.busy}
          />
          <details className="case-sources">
            <summary>Assumptions & reading · educator review pending</summary>
            <ul>
              {[...caseDefinition.assumptions, ...caseVariant.assumptions].map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <div>
              {caseVariant.sources.map(source => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ))}
            </div>
          </details>
        </>
      )}
    </>
  );
}
