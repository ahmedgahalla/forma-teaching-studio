import { describe, expect, it } from 'vitest';
import { parseTeachingPlan, validateTeachingPlan, type TeachingContext } from '../classroom';
import { DEMO_IDS } from '../classroom/types';
import { getTeachingCase } from '../teaching-cases';
import {
  GLOSSARY,
  GLOSSARY_DISCLAIMER,
  GLOSSARY_REVIEW_STATUS,
  findGlossaryEntry,
  getGlossaryEntry,
  normalizeGlossaryTerm,
} from '.';

const context: TeachingContext = {
  mode: 'case',
  workflowId: null,
  stepIndex: -1,
  selected: '11',
  selectedIds: ['11'],
  availableIds: [...DEMO_IDS],
  synthetic: true,
  revision: 1,
  view: 'perspective',
  arch: 'both',
  speed: 1,
  tryMode: true,
  playing: false,
  layers: { gums: true },
};

describe('authored teaching glossary', () => {
  it('covers the requested forty terms with unique ids and a shared draft status', () => {
    expect(GLOSSARY).toHaveLength(40);
    expect(new Set(GLOSSARY.map(entry => entry.id)).size).toBe(GLOSSARY.length);
    expect(GLOSSARY_DISCLAIMER).toContain('synthetic model');
    for (const entry of GLOSSARY) {
      expect(entry.status, entry.id).toBe(GLOSSARY_REVIEW_STATUS);
      expect(entry.term.trim(), entry.id).not.toBe('');
      expect(entry.aliases.length, entry.id).toBeGreaterThan(0);
      expect(entry.definition.length, entry.id).toBeGreaterThan(25);
      expect(
        entry.definition.split(/[.!?]+/).filter(text => text.trim()).length,
      ).toBeLessThanOrEqual(2);
    }
  });

  it('keeps spoken aliases, display terms and ids unambiguous across entries', () => {
    const owners = new Map<string, string>();
    for (const entry of GLOSSARY)
      for (const text of [entry.id, entry.term, ...entry.aliases]) {
        const normalized = normalizeGlossaryTerm(text);
        expect(owners.get(normalized) ?? entry.id, text).toBe(entry.id);
        owners.set(normalized, entry.id);
        expect(findGlossaryEntry(text)?.id, text).toBe(entry.id);
      }
  });

  it('links only to other authored terms', () => {
    for (const entry of GLOSSARY) {
      expect(entry.related.length, entry.id).toBeGreaterThan(0);
      expect(new Set(entry.related).size, entry.id).toBe(entry.related.length);
      for (const id of entry.related) {
        expect(getGlossaryEntry(id), `${entry.id} → ${id}`).toBeDefined();
        expect(id).not.toBe(entry.id);
      }
    }
  });

  it.each(GLOSSARY.filter(entry => entry.show))(
    'validates the $id visual from the free workspace',
    entry => {
      const plan = { actions: entry.show, summary: entry.term, clarification: null };
      expect(validateTeachingPlan(plan, context, { allowLocalActions: true }).actions).toEqual(
        entry.show,
      );
    },
  );

  it.each(GLOSSARY.filter(entry => entry.show))(
    'parses and validates the $id explanation after an earlier tooth study',
    entry => {
      const studying: TeachingContext = {
        ...context,
        toothStudy: { tooth: '16', view: 'lingual' },
        glossaryId: 'cusp-of-carabelli',
      };
      const plan = parseTeachingPlan(`what is ${entry.term}`, studying);
      expect(plan.clarification).toBeNull();
      expect(plan.actions).toEqual([...entry.show!, { kind: 'glossary', id: entry.id }]);
      expect(validateTeachingPlan(plan, studying, { allowLocalActions: true }).actions).toEqual(
        plan.actions,
      );
    },
  );

  it('opens each prepared visual on an authored variant, paused at its starting frame', () => {
    for (const entry of GLOSSARY) {
      const show = entry.show;
      if (show?.[0]?.kind !== 'case' || show[0].action !== 'load') continue;
      const definition = getTeachingCase(show[0].id);
      if (show.some(action => action.kind !== 'case')) {
        expect(definition.id, entry.id).toBe('reference-occlusion');
        continue;
      }
      expect(show).toHaveLength(4);
      const selected = show[1];
      expect(selected.kind).toBe('case');
      if (selected.kind !== 'case' || selected.action !== 'variant') throw new Error(entry.id);
      expect(
        definition.variants.some(variant => variant.id === selected.id),
        entry.id,
      ).toBe(true);
      expect(show.slice(2)).toEqual([
        { kind: 'case', action: 'pause' },
        { kind: 'case', action: 'progress', value: 0 },
      ]);
    }
    for (const [id, variant] of [
      ['translation', 'translation'],
      ['tipping', 'tip'],
      ['torque', 'torque'],
      ['rotation', 'axial-rotation'],
    ])
      expect(getGlossaryEntry(id)?.show?.slice(0, 2)).toEqual([
        { kind: 'case', action: 'load', id: 'movement-types' },
        { kind: 'case', action: 'variant', id: variant },
      ]);
  });

  it('opens the full reference mouth before showing layers hidden by tooth study', () => {
    for (const id of ['periodontal-ligament', 'alveolar-bone']) {
      const show = getGlossaryEntry(id)?.show;
      expect(show?.slice(0, 3)).toEqual([
        { kind: 'case', action: 'load', id: 'reference-occlusion' },
        { kind: 'toggle', target: 'roots', visible: true },
        { kind: 'toggle', target: 'gums', visible: false },
      ]);
      expect(
        validateTeachingPlan(
          { actions: show, summary: id, clarification: null },
          { ...context, toothStudy: { tooth: '16', view: 'lingual' } },
          { allowLocalActions: true },
        ).actions,
      ).toEqual(show);
    }
  });

  it('finds bounded spelling variants without guessing an unknown concept', () => {
    expect(findGlossaryEntry('  CUSP OF KARABELLI  ')?.id).toBe('cusp-of-carabelli');
    expect(findGlossaryEntry('cemento-enamel junction')?.id).toBe('cervical-line');
    expect(findGlossaryEntry('angle class two')?.id).toBe('angle-class-ii');
    expect(findGlossaryEntry('f d i numbering')?.id).toBe('fdi-numbering');
    expect(findGlossaryEntry('carabellix')).toBeUndefined();
    expect(getGlossaryEntry('missing')).toBeUndefined();
  });
});
