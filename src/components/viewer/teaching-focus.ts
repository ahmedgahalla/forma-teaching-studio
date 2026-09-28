import type { Material, Mesh } from 'three';
import { toothArch } from '@/lib/appliances';
import type { ViewerProps } from './viewer-types';

type FocusState = Pick<
  ViewerProps,
  'selectedIds' | 'selected' | 'arch' | 'teachingFocus' | 'isolateSelection' | 'toothStudy'
>;

// Leave room for neighboring teeth while enlarging the selected crown and visible root.
export const TEACHING_FOCUS_MARGIN = 1.55;

export function isTeachingSelected(props: FocusState, id: string): boolean {
  return props.selectedIds.length ? props.selectedIds.includes(id) : props.selected === id;
}

export function teachingFocusActive(props: FocusState, cutaway = false): boolean {
  if (!props.teachingFocus || props.toothStudy || cutaway) return false;
  if (!props.selectedIds.length)
    return props.arch === 'both' || toothArch(props.selected) === props.arch;
  for (const id of props.selectedIds)
    if (props.arch === 'both' || toothArch(id) === props.arch) return true;
  return false;
}

/** Only selection and presentation changes refit; animation and comparison poses do not. */
export function createSelectionFramingKey() {
  let previous: readonly string[] = [],
    previousSelected = '',
    key = 'all';
  let previousIsolation = false,
    previousFocus = false;
  return (props: FocusState) => {
    if (!props.isolateSelection && !props.teachingFocus) return 'all';
    const ids = props.selectedIds;
    let sameSelection = ids.length === previous.length;
    for (let i = 0; sameSelection && i < ids.length; i++) sameSelection = ids[i] === previous[i];
    if (
      !!props.isolateSelection !== previousIsolation ||
      !!props.teachingFocus !== previousFocus ||
      props.selected !== previousSelected ||
      !sameSelection
    ) {
      previous = [...ids];
      previousSelected = props.selected;
      previousIsolation = !!props.isolateSelection;
      previousFocus = !!props.teachingFocus;
      key = `${previousIsolation}/${previousFocus}/${(ids.length ? [...ids] : [props.selected]).sort().join(',')}`;
    }
    return key;
  };
}

/** Own only the faded clones; source materials, textures and mesh geometry remain caller-owned. */
export function createTeachingFocusMaterials(sources: readonly Material[]) {
  const faded = new Map(sources.map(source => [source, source.clone()]));
  const sync = () => {
    for (const [source, material] of faded) {
      material.copy(source);
      material.transparent = true;
      material.opacity = source.opacity * 0.24;
      material.depthWrite = false;
    }
  };
  sync();
  return {
    sync,
    apply(mesh: Mesh, source: Material, fade: boolean) {
      mesh.material = fade ? faded.get(source)! : source;
      mesh.castShadow = !fade;
    },
    dispose() {
      for (const material of faded.values()) material.dispose();
      faded.clear();
    },
  };
}
