import { getGlossaryEntry, GLOSSARY_DISCLAIMER } from '@/lib/glossary';
import { glossaryActions } from '@/lib/glossary/plan';
import type { CaseStudioApi } from './api';
import './GlossaryCard.css';

type GlossaryCardApi = Pick<CaseStudioApi, 'glossaryId'> & {
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
        <nav aria-label="Related glossary terms">
          {entry.related.map(id => {
            const related = getGlossaryEntry(id)!;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  void api.teaching.execute(glossaryActions(id), `Explain ${related.term}`)
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
