import { describe, expect, it } from 'vitest';
import { applianceView, DEFAULT_APPLIANCE_DISPLAY, mapWorkflowAppliance, validateApplianceDisplay, type ApplianceDisplay } from './appliance-display';
import { workflowFixedVisibility, type WorkflowViewState } from './workflow-appliances';

const view = (appliance: WorkflowViewState['appliance'], phase: WorkflowViewState['phase']): WorkflowViewState => ({ appliance, phase, progress: .37, palate: appliance === 'palatal-expander', arrows: true });

describe('shared appliance display', () => {
  it('defaults to the existing ordinary brackets, wires and ligatures', () => {
    expect(mapWorkflowAppliance()).toEqual(DEFAULT_APPLIANCE_DISPLAY);
    expect(workflowFixedVisibility(applianceView(DEFAULT_APPLIANCE_DISPLAY))).toEqual({ brackets: true, wires: true, ligatures: true });
  });

  it.each(['brackets', 'braces', 'expander-bands', 'palatal-expander', 'retainer'] as const)('round trips %s without adding lesson arrows or changing illustration progress', preset => {
    const original: ApplianceDisplay = { preset, progress: .37, palate: preset === 'expander-bands' || preset === 'palatal-expander' };
    const copied = { ...original }, result = applianceView(original)!;
    expect(result.arrows).toBe(false);
    expect(mapWorkflowAppliance(result)).toEqual(original);
    expect(original).toEqual(copied);
  });

  it('requires the caller to hide ordinary braces when choosing no hardware', () => {
    expect(applianceView({ preset: 'none', progress: .7, palate: true })).toBeUndefined();
    expect(workflowFixedVisibility(undefined, false)).toEqual({ brackets: false, wires: false, ligatures: false });
  });

  for (const appliance of ['braces', 'archwire-expansion', 'palatal-expander'] as const) {
    it.each(['assessment', 'brackets', 'wire', 'forces', 'movement', 'retention'] as const)(`preserves ${appliance} hardware at the %s lesson step`, phase => {
      const source = view(appliance, phase), before = { ...source }, result = mapWorkflowAppliance(source);
      const expected = phase === 'assessment' ? 'none' : appliance === 'palatal-expander' ? phase === 'brackets' ? 'expander-bands' : 'palatal-expander' : phase === 'brackets' ? 'brackets' : phase === 'retention' ? 'retainer' : 'braces';
      expect(result).toEqual({ preset: expected, progress: .37, palate: appliance === 'palatal-expander' });
      if (result.preset !== 'none') {
        expect(applianceView(result)?.arrows).toBe(false);
        expect(workflowFixedVisibility(applianceView(result))).toEqual(workflowFixedVisibility(source));
      }
      expect(source).toEqual(before);
    });
  }

  it('hides ordinary hardware when its lesson toggle is off', () => {
    expect(mapWorkflowAppliance(view('braces', 'movement'), false)).toEqual({ preset: 'none', progress: .37, palate: false });
    expect(mapWorkflowAppliance(view('archwire-expansion', 'brackets'), false).preset).toBe('none');
    expect(mapWorkflowAppliance(undefined, false)).toEqual({ preset: 'none', progress: 0, palate: false });
  });

  it('preserves visible expander and retainer overlays even with the ordinary-braces toggle off', () => {
    expect(mapWorkflowAppliance(view('palatal-expander', 'movement'), false)).toEqual({ preset: 'palatal-expander', progress: .37, palate: true });
    expect(mapWorkflowAppliance(view('palatal-expander', 'brackets'), false).preset).toBe('expander-bands');
    expect(mapWorkflowAppliance(view('braces', 'retention'), false).preset).toBe('retainer');
    expect(mapWorkflowAppliance(view('archwire-expansion', 'retention'), false).preset).toBe('retainer');
    expect(mapWorkflowAppliance(view('palatal-expander', 'assessment'), false).preset).toBe('none');
  });

  it('does not leak dormant palate settings into a fixed-appliance display', () => {
    expect(applianceView({ preset: 'braces', progress: .4, palate: true })?.palate).toBe(false);
  });
});

describe('saved appliance display validation', () => {
  it.each([0, 1])('accepts and copies valid display settings at progress %s', progress => {
    const raw = { preset: 'palatal-expander', progress, palate: true };
    const validated = validateApplianceDisplay(raw);
    expect(validated).toEqual(raw); expect(validated).not.toBe(raw);
  });

  it.each([null, undefined, false, [], 'braces', {}, { preset: 'braces' }, { ...DEFAULT_APPLIANCE_DISPLAY, arrows: true }, { ...DEFAULT_APPLIANCE_DISPLAY, preset: 'force-simulation' }, { ...DEFAULT_APPLIANCE_DISPLAY, palate: 1 }, { ...DEFAULT_APPLIANCE_DISPLAY, progress: '0.5' }, { ...DEFAULT_APPLIANCE_DISPLAY, progress: NaN }, { ...DEFAULT_APPLIANCE_DISPLAY, progress: Infinity }, { ...DEFAULT_APPLIANCE_DISPLAY, progress: -.01 }, { ...DEFAULT_APPLIANCE_DISPLAY, progress: 1.01 }])('rejects malformed or unsupported saved settings: %j', raw => {
    expect(() => validateApplianceDisplay(raw)).toThrow();
  });
});
