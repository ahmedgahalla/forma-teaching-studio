import { expect, it, vi } from 'vitest';
import { getTeachingCase } from '@/lib/teaching-cases';
import { setupToothStudy } from './tooth-study.fixtures';

it.each([false, true])(
  'returns from exploration to the pre-study mouth and camera (batched snapshot: %s)',
  async batched => {
    const { api, refs, settle, camera } = setupToothStudy();
    const definition = getTeachingCase('reference-occlusion');
    const variant = definition.variants[0];
    Object.assign(api, {
      scenario: {
        caseId: definition.id,
        variantId: variant.id,
        model: api.model,
        returnProgress: 0,
        exploring: false,
        answerVisible: false,
      },
      caseDefinition: definition,
      caseVariant: variant,
      stage: 4,
    });
    const before = api.snapshot();
    expect(api.applyTeaching({ kind: 'tooth-study', action: 'open', tooth: '16' })).toBe(true);
    refs.viewer.current!.restoreCamera({ ...camera(), position: [12, 0, 42], up: [0, 1, 0] });
    // React's snapshot closure still observes the study until the next render.
    if (batched) {
      const studied = api.snapshot();
      api.snapshot = vi.fn(() => studied);
    }
    expect(api.applyTeaching({ kind: 'case', action: 'explore' })).toBe(true);
    expect(api.toothStudy).toBeNull();
    expect(api.scenario?.returnDisplay).toMatchObject({
      lesson: {
        selected: before.selected,
        selectedIds: before.selectedIds,
        arch: before.arch,
        view: before.view,
        roots: before.roots,
        gums: before.gums,
        labels: before.labels,
        isolated: before.isolated,
        toothStudy: null,
      },
      anatomy: before.anatomy,
      camera: before.camera,
    });
    await settle();
    expect(camera()).toEqual(before.camera);
    api.setRoots(true);
    api.setGums(false);
    refs.viewer.current!.restoreCamera({ ...camera(), position: [100, 30, 40] });
    expect(api.applyTeaching({ kind: 'case', action: 'return' })).toBe(true);
    await settle();
    expect(api).toMatchObject({
      toothStudy: null,
      isolated: before.isolated,
      selected: before.selected,
      selectedIds: before.selectedIds,
      roots: before.roots,
      gums: before.gums,
      labels: before.labels,
      arch: before.arch,
      view: before.view,
      anatomy: before.anatomy,
      stage: 4,
    });
    expect(camera()).toEqual(before.camera);
  },
);
