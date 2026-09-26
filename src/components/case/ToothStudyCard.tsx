'use client';
import { getToothAnatomy, TOOTH_ANATOMY_DISCLAIMER } from '@/lib/tooth-anatomy';
import { toothSideName } from '@/lib/tooth-study/surface-labels';
import { TOOTH_STUDY_VIEWS } from '@/lib/tooth-study/types';
import type { CaseStudioApi } from './api';
import './ToothStudyCard.css';

type ToothStudyCardApi = Pick<CaseStudioApi, 'toothStudy'> & {
  teaching: Pick<CaseStudioApi['teaching'], 'execute'>;
};

export function ToothStudyCard({ api }: { api: ToothStudyCardApi }) {
  const study = api.toothStudy;
  const tooth = study && getToothAnatomy(study.tooth);
  if (!study || !tooth) return null;
  return (
    <aside className="tooth-study-card" aria-labelledby="tooth-study-title">
      <header>
        <p className="tooth-study-number">Individual tooth study · FDI {tooth.id}</p>
        <h2 id="tooth-study-title">{tooth.name}</h2>
        <p className="tooth-study-disclaimer">{TOOTH_ANATOMY_DISCLAIMER}</p>
      </header>
      <div className="tooth-study-sides" role="group" aria-label="Tooth surface views">
        {TOOTH_STUDY_VIEWS.map(view => (
          <button
            key={view}
            aria-pressed={study.view === view}
            onClick={() =>
              void api.teaching.execute(
                [{ kind: 'tooth-study', action: 'view', view }],
                `View ${toothSideName(tooth, view).toLowerCase()}`,
              )
            }
          >
            {toothSideName(tooth, view)}
          </button>
        ))}
      </div>
      <div className="tooth-study-details">
        <p>
          <strong>Roots in this model: {tooth.rootCount}.</strong> {tooth.roots.join(', ')}.
        </p>
        <p>
          <strong>Crown:</strong> {tooth.cusps}
        </p>
        <ul aria-label="Key morphology">
          {tooth.features.map(feature => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <p>
          <strong>Orthodontic relevance:</strong> {tooth.orthodontics}
        </p>
        {study.explanationVisible && <p className="tooth-study-explanation">{tooth.explanation}</p>}
      </div>
      <div className="tooth-study-actions">
        <button
          onClick={() =>
            void api.teaching.execute(
              [{ kind: 'tooth-study', action: 'explain' }],
              'Explain this tooth',
            )
          }
        >
          Explain aloud
        </button>
        <button
          onClick={() =>
            void api.teaching.execute(
              [{ kind: 'tooth-study', action: 'close' }],
              'Back to the full mouth',
            )
          }
        >
          Back to full mouth
        </button>
      </div>
    </aside>
  );
}
