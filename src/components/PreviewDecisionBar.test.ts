import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PreviewDecisionBar, type PreviewDecisionBarProps } from './PreviewDecisionBar';

function props(overrides: Partial<PreviewDecisionBarProps> = {}): PreviewDecisionBarProps {
  return {
    pending: {
      summary: 'Translate upper front teeth 1 mm',
      collision: 'clear',
      checkedSteps: 9,
      canApply: true,
    },
    affectedCount: 6,
    onApply: vi.fn(),
    onDiscard: vi.fn(),
    onModify: vi.fn(),
    ...overrides,
  };
}
const render = (value: PreviewDecisionBarProps) =>
  renderToStaticMarkup(createElement(PreviewDecisionBar, value));
function button(html: string, label: string) {
  const match = html.match(
    new RegExp(`<button\\b[^>]*>(?:(?!</button>)[\\s\\S])*${label}</button>`),
  );
  expect(match, `Button ${label} should be present`).not.toBeNull();
  return match![0];
}

describe('persistent preview decision bar', () => {
  it('renders nothing without a candidate, and never applies on render', () => {
    const value = props({ pending: null });
    expect(render(value)).toBe('');
    expect(value.onApply).not.toHaveBeenCalled();
    expect(value.onDiscard).not.toHaveBeenCalled();
    expect(value.onModify).not.toHaveBeenCalled();
  });

  it('announces the proposed edit and sampled result without claiming collision safety', () => {
    const html = render(props());
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Preview · not applied');
    expect(html).toContain('Translate upper front teeth 1 mm');
    expect(html).toContain('6 teeth affected');
    expect(html).toContain('No new intersections detected');
    expect(html).toContain('9 sampled positions');
    expect(html).not.toMatch(/collision.free|safe to apply/i);
    expect(button(html, 'Apply')).not.toContain('disabled');
  });

  it('keeps Apply disabled when the shared lock eligibility rejects an otherwise clear path', () => {
    const value = props();
    value.pending!.canApply = false;
    const html = render(value);
    expect(button(html, 'Apply')).toContain('disabled');
    expect(button(html, 'Modify')).not.toContain('disabled');
    expect(button(html, 'Discard')).not.toContain('disabled');
  });

  it.each([
    ['blocked', 'New intersections detected'],
    ['limited', 'Path check reached its sample limit'],
    ['checking', 'Checking the movement path'],
    ['unchecked', 'Movement path not checked'],
  ] as const)(
    'preserves shared eligibility and accurately reports %s paths',
    (collision, message) => {
      const value = props();
      value.pending = { ...value.pending!, collision, canApply: false };
      const html = render(value);
      expect(html).toContain(message);
      expect(button(html, 'Apply')).toContain('disabled');
    },
  );

  it('only enables an explicitly unrestricted crossing when shared eligibility permits it', () => {
    const value = props({ unrestricted: true, affectedCount: 1 });
    value.pending = { ...value.pending!, collision: 'blocked', checkedSteps: 1, collisions: 1 };
    let html = render(value);
    expect(html).toContain('Unrestricted illustration · locks still apply');
    expect(html).toContain('1 tooth affected');
    expect(html).toContain('1 sampled position');
    expect(html).toContain('1 intersecting pair');
    expect(button(html, 'Apply')).not.toContain('disabled');
    value.pending.canApply = false;
    html = render(value);
    expect(button(html, 'Apply')).toContain('disabled');
  });

  it('disables every decision during an in-flight operation, including unrestricted Apply', () => {
    const html = render(props({ busy: true, unrestricted: true }));
    for (const label of ['Apply', 'Discard', 'Modify'])
      expect(button(html, label)).toContain('disabled');
  });

  it('does not invent an affected count when the host has not supplied one', () => {
    const html = render(props({ affectedCount: undefined }));
    expect(html).not.toContain('affected');
    expect(html).toContain('9 sampled positions');
  });
});
