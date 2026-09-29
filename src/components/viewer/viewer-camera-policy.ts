import type { DentalCase } from '@/lib/geometry';
import { sameViewerGeometry } from '@/lib/viewer-model';
import type { ViewerProps } from './viewer-types';

type FitState = Pick<
  ViewerProps,
  'arch' | 'roots' | 'gums' | 'opening' | 'jawOpen' | 'teachingFocus' | 'preserveCamera'
>;

/** Learning-step model replacements keep the user's view; other scenes retain geometry checks. */
export function canRestoreViewerCamera(previous: DentalCase, next: DentalCase, preserve = false) {
  return preserve || sameViewerGeometry(previous, next);
}

/** Track changes even while holding the camera so they cannot trigger a delayed refit on exit. */
export function createViewerAutoFit(initial: FitState, anatomyKey: string, selectionKey: string) {
  let arch = initial.arch,
    roots = initial.roots,
    gums = initial.gums;
  let opening = initial.opening,
    jaw = initial.jawOpen,
    focus = !!initial.teachingFocus;
  let anatomy = anatomyKey,
    selection = selectionKey;
  return (next: FitState, nextAnatomy: string, nextSelection: string) => {
    const focusChanged = focus !== !!next.teachingFocus;
    const changed =
      arch !== next.arch ||
      roots !== next.roots ||
      gums !== next.gums ||
      opening !== next.opening ||
      jaw !== next.jawOpen ||
      anatomy !== nextAnatomy ||
      selection !== nextSelection ||
      focusChanged;
    arch = next.arch;
    roots = next.roots;
    gums = next.gums;
    opening = next.opening;
    jaw = next.jawOpen;
    focus = !!next.teachingFocus;
    anatomy = nextAnatomy;
    selection = nextSelection;
    // Focus/context is an explicit request. A new step's selected IDs are not.
    return changed && (!next.preserveCamera || focusChanged);
  };
}
