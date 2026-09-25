import type { WorkflowViewState } from './workflow-appliances';

/** Display settings only; these never prescribe or change tooth poses. */
export type ApplianceDisplay = {
  preset: 'none' | 'brackets' | 'braces' | 'expander-bands' | 'palatal-expander' | 'retainer';
  progress: number;
  palate: boolean;
};

export const DEFAULT_APPLIANCE_DISPLAY: ApplianceDisplay = {
  preset: 'braces',
  progress: 0,
  palate: false,
};
const PRESETS = [
  'none',
  'brackets',
  'braces',
  'expander-bands',
  'palatal-expander',
  'retainer',
] as const;

export function validateApplianceDisplay(raw: unknown): ApplianceDisplay {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Invalid appliance display settings.');
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).length !== 3 ||
    !['preset', 'progress', 'palate'].every(key => Object.hasOwn(value, key))
  )
    throw new Error('Unexpected or missing appliance display fields.');
  if (!PRESETS.includes(value.preset as ApplianceDisplay['preset']))
    throw new Error('Choose a supported appliance display.');
  if (
    typeof value.progress !== 'number' ||
    !Number.isFinite(value.progress) ||
    value.progress < 0 ||
    value.progress > 1
  )
    throw new Error('Appliance illustration progress must be between 0 and 1.');
  if (typeof value.palate !== 'boolean') throw new Error('The palate display must be on or off.');
  return {
    preset: value.preset as ApplianceDisplay['preset'],
    progress: value.progress,
    palate: value.palate,
  };
}

/** The caller also hides ordinary brackets/wires for the `none` preset. */
export function applianceView(display: ApplianceDisplay): WorkflowViewState | undefined {
  const value = validateApplianceDisplay(display);
  if (value.preset === 'none') return undefined;
  const expander = value.preset === 'expander-bands' || value.preset === 'palatal-expander';
  return {
    appliance: expander ? 'palatal-expander' : 'braces',
    phase:
      value.preset === 'retainer'
        ? 'retention'
        : value.preset === 'brackets' || value.preset === 'expander-bands'
          ? 'brackets'
          : 'wire',
    progress: value.progress,
    arrows: false,
    palate: expander && value.palate,
  };
}

/** Retain the hardware appearance while removing the authored lesson's arrows. */
export function mapWorkflowAppliance(view?: WorkflowViewState, visible = true): ApplianceDisplay {
  let preset: ApplianceDisplay['preset'];
  // Workflow expander/retainer overlays do not use its ordinary-braces toggle.
  if (view?.phase === 'assessment') preset = 'none';
  else if (!view) preset = visible ? 'braces' : 'none';
  else if (view.appliance === 'palatal-expander')
    preset = view.phase === 'brackets' ? 'expander-bands' : 'palatal-expander';
  else
    preset =
      view.phase === 'retention'
        ? 'retainer'
        : !visible
          ? 'none'
          : view.phase === 'brackets'
            ? 'brackets'
            : 'braces';
  return validateApplianceDisplay({
    preset,
    progress: view?.progress ?? 0,
    palate: view?.palate ?? false,
  });
}
