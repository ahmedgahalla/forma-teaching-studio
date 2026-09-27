// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { DentalCase } from '@/lib/geometry';
import { useExplanationState } from './explanation-state';

it('restores the definition against the snapshot model during a batched model change', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const original: DentalCase = { name: 'Original', demo: true, teeth: [], gums: [] };
  const loaded: DentalCase = { ...original, name: 'Prepared case' };
  let state!: ReturnType<typeof useExplanationState>;
  let changeModel!: (model: DentalCase) => void;
  function Harness() {
    const [model, setModel] = useState(original);
    state = useExplanationState(model);
    changeModel = setModel;
    return <span>{state.glossaryId}</span>;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    act(() => root.render(<Harness />));
    act(() => state.setGlossaryId('mesial'));
    expect(host.textContent).toBe('mesial');
    act(() => changeModel(loaded));
    expect(host.textContent).toBe('');
    act(() => state.setGlossaryId('torque'));
    expect(host.textContent).toBe('torque');
    // Restore calls setters in the same React batch as the model switch.
    act(() => {
      state.setGlossaryId('mesial', original);
      changeModel(original);
    });
    expect(host.textContent).toBe('mesial');
    act(() => {
      state.setGlossaryId('torque', loaded);
      changeModel(loaded);
    });
    expect(host.textContent).toBe('torque');
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
