const CONTROLS = [
  '.glossary-card',
  '.tooth-study-card',
  '.teaching-command-bar',
  '.case-scenario-panel',
  '.case-stage-toolbar',
  '.mobile-studio-dock',
  '.mobile-panel-heading',
  '.opening-command-controls',
  '.opening-view-menu',
  '.opening-menu',
  '.studio-theme-toggle',
  '.preview-decision-bar',
  '.lecture-console',
  '.lecture-view-tools',
  '.lecture-pointer',
  '.viewport',
  '.tooth-chart',
  '.atlas-camera-rail',
  '.atlas-odontogram',
  '.atlas-tooth-inspector',
  '.selection-groups',
  '.mechanics-panel',
].join(', ');

export function isWorkspaceInteraction(target: EventTarget): boolean {
  return target instanceof Element && !target.closest(CONTROLS);
}
