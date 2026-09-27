import { describe, expect, it, vi } from 'vitest';
import { observePixelRatio } from './pixel-ratio';

function display(ratio: number) {
  const queries: { value: string; listeners: Set<() => void> }[] = [];
  const source = {
    devicePixelRatio: ratio,
    matchMedia: (value: string) => {
      const listeners = new Set<() => void>();
      queries.push({ value, listeners });
      return {
        addEventListener: (_: 'change', listener: () => void) => listeners.add(listener),
        removeEventListener: (_: 'change', listener: () => void) => listeners.delete(listener),
      };
    },
  };
  return {
    source,
    queries,
    move: (next: number) => {
      source.devicePixelRatio = next;
      [...queries.at(-1)!.listeners].forEach(listener => listener());
    },
  };
}

describe('display pixel ratio observer', () => {
  it('applies the starting ratio, follows display changes and removes the old listener', () => {
    const screen = display(1),
      apply = vi.fn();
    const stop = observePixelRatio(screen.source, apply);
    expect(apply.mock.calls).toEqual([[1]]);
    expect(screen.queries[0].value).toBe('(resolution: 1dppx)');
    screen.move(1.5);
    expect(screen.queries[0].listeners.size).toBe(0);
    expect(screen.queries[1].value).toBe('(resolution: 1.5dppx)');
    screen.move(2);
    expect(apply.mock.calls).toEqual([[1], [1.5], [2]]);
    expect(screen.queries.at(-1)!.listeners.size).toBe(1);
    stop();
  });

  it('re-arms above the cap without rebuilding identical targets, then returns to DPR 1', () => {
    const screen = display(3),
      apply = vi.fn();
    const stop = observePixelRatio(screen.source, apply);
    expect(apply.mock.calls).toEqual([[2]]);
    screen.move(4);
    expect(screen.queries[1].value).toBe('(resolution: 4dppx)');
    expect(screen.queries[0].listeners.size).toBe(0);
    expect(apply.mock.calls).toEqual([[2]]);
    screen.move(1);
    expect(apply.mock.calls).toEqual([[2], [1]]);
    stop();
  });

  it('cleans up on teardown and ignores a queued notification after disposal', () => {
    const screen = display(2),
      apply = vi.fn();
    const stop = observePixelRatio(screen.source, apply);
    const queued = [...screen.queries[0].listeners][0];
    stop();
    stop();
    expect(screen.queries.every(query => query.listeners.size === 0)).toBe(true);
    screen.source.devicePixelRatio = 1;
    queued();
    expect(apply.mock.calls).toEqual([[2]]);
    expect(screen.queries).toHaveLength(1);
  });
});
