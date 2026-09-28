import { getGlossaryEntry, GLOSSARY_DISCLAIMER } from '@/lib/glossary';
import { glossaryActionsForStudy } from '@/lib/glossary/plan';
import type { ToothStudyContext } from '@/lib/tooth-study/types';
import type { CaseStudioApi } from './api';
import './GlossaryCard.css';
import { BiologyIllustration } from '../lecture-builder/RemodelingDiagram';

type GlossaryCardApi = Pick<CaseStudioApi, 'glossaryId'> & {
  toothStudy: Pick<ToothStudyContext, 'tooth' | 'view'> | null;
  teaching: Pick<CaseStudioApi['teaching'], 'execute'>;
};

export function GlossaryCard({ api }: { api: GlossaryCardApi }) {
  const entry = api.glossaryId ? getGlossaryEntry(api.glossaryId) : undefined;
  if (!entry) return null;
  return (
    <aside className="glossary-card" aria-labelledby="glossary-title">
      <header>
        <span>Ask Forma</span>
        <button
          type="button"
          onClick={() =>
            void api.teaching.execute([{ kind: 'glossary', id: null }], 'Close the definition')
          }
        >
          Close definition
        </button>
      </header>
      <div className="glossary-details">
        <h2 id="glossary-title">{entry.term}</h2>
        <p>{entry.definition}</p>
        {entry.biology && <BiologyIllustration view={entry.biology} />}
        <nav aria-label="Related glossary terms">
          {entry.related.map(id => {
            const related = getGlossaryEntry(id)!;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  void api.teaching.execute(
                    glossaryActionsForStudy(id, api.toothStudy ?? undefined),
                    `Explain ${related.term}`,
                  )
                }
              >
                {related.term}
              </button>
            );
          })}
        </nav>
        <p className="glossary-disclaimer">{GLOSSARY_DISCLAIMER}</p>
      </div>
    </aside>
  );
}
