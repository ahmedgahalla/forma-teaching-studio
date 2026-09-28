import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshStandardMaterial, Texture } from 'three';
import { createDentalMaterials } from '@/lib/viewer-materials';
import { isToothVisible } from '@/lib/viewer-presentation';
import {
  createSelectionFramingKey,
  createTeachingFocusMaterials,
  isTeachingSelected,
  teachingFocusActive,
} from './teaching-focus';

const selection = {
  selected: '11',
  selectedIds: ['11'],
  arch: 'upper' as const,
  teachingFocus: true,
};

describe('teaching focus', () => {
  it('defaults off, respects the visible arch and lets explicit study/cutaway take priority', () => {
    expect(teachingFocusActive({ ...selection, teachingFocus: undefined })).toBe(false);
    expect(teachingFocusActive(selection)).toBe(true);
    expect(teachingFocusActive({ ...selection, arch: 'lower' })).toBe(false);
    expect(teachingFocusActive({ ...selection, selectedIds: ['31', '11'] })).toBe(true);
    expect(teachingFocusActive({ ...selection, selectedIds: [] })).toBe(true);
    expect(
      teachingFocusActive({
        ...selection,
        toothStudy: {
          tooth: '11',
          view: 'buccal',
          revision: 1,
        },
      }),
    ).toBe(false);
    expect(teachingFocusActive(selection, true)).toBe(false);
    expect(isTeachingSelected({ ...selection, selectedIds: [] }, '11')).toBe(true);
    expect(isTeachingSelected(selection, '12')).toBe(false);
    expect(isToothVisible('12', selection)).toBe(true);
    expect(isToothVisible('12', { ...selection, isolateSelection: true })).toBe(false);
  });

  it('reframes changes in focus and selection, but keeps comparison poses and selection order stable', () => {
    const key = createSelectionFramingKey();
    const both = { ...selection, selectedIds: ['11', '12'] };
    const focused = key(both);
    expect(key({ ...both, selectedIds: ['12', '11'] })).toBe(focused);
    const comparison = { ...both, transforms: { '11': { translation: [2, 0, 0] } } };
    expect(key(comparison)).toBe(focused);
    expect(key({ ...both, selected: '12' })).toBe(focused);
    expect(key({ ...both, selectedIds: ['12'] })).not.toBe(focused);
    const isolated = key({ ...both, isolateSelection: true });
    expect(isolated).not.toBe(focused);
    expect(key({ ...both, teachingFocus: false })).toBe('all');
    expect(key(both)).toBe(focused);
    expect(key({ ...both, selectedIds: [], selected: '12' })).not.toBe(focused);
  });

  it('reuses faded status materials and restores full visibility without hiding context', () => {
    const base = createDentalMaterials(true, 'clinical');
    const sources = [base.enamel, base.rootMaterial, base.lockedMaterial, base.contactMaterial];
    const focus = createTeachingFocusMaterials(sources);
    const geometry = new BoxGeometry(1, 1, 1);
    const mesh = new Mesh(geometry, base.enamel);
    for (const source of sources) {
      focus.apply(mesh, source, true);
      const faded = mesh.material;
      expect(faded).not.toBe(source);
      expect(faded.color.equals(source.color)).toBe(true);
      expect(faded.opacity).toBeGreaterThan(0);
      expect(faded.opacity).toBeLessThan(0.5);
      expect(faded.transparent).toBe(true);
      expect(faded.depthWrite).toBe(false);
      expect(mesh.visible).toBe(true);
      expect(mesh.castShadow).toBe(false);
      focus.apply(mesh, source, true);
      expect(mesh.material).toBe(faded);
      focus.apply(mesh, source, false);
      expect(mesh.material).toBe(source);
      expect(mesh.castShadow).toBe(true);
      expect(source.opacity).toBe(1);
      expect(source.transparent).toBe(false);
    }
    focus.dispose();
    Object.values(base).forEach(material => material.dispose());
    geometry.dispose();
  });

  it('retains atlas shaders and live uniforms through focus and theme copies without owning bump textures', () => {
    const base = createDentalMaterials(true, 'midnight', { value: 1 });
    const sources = [base.enamel, base.rootMaterial, base.lockedMaterial, base.contactMaterial];
    const focus = createTeachingFocusMaterials(sources);
    const geometry = new BoxGeometry(1, 1, 1);
    const mesh = new Mesh(geometry, base.enamel);
    const disposeTexture = vi.spyOn(base.enamel.bumpMap!, 'dispose');
    for (const source of sources) {
      focus.apply(mesh, source, true);
      const faded = mesh.material;
      expect(faded.onBeforeCompile).toBe(source.onBeforeCompile);
      expect(faded.customProgramCacheKey).toBe(source.customProgramCacheKey);
      expect(faded.userData.tissue).toBe(source.userData.tissue);
      source.color.set('#eeeecc');
      focus.sync();
      expect(faded.color.equals(source.color)).toBe(true);
      expect(faded.onBeforeCompile).toBe(source.onBeforeCompile);
      expect(faded.userData.tissue).toBe(source.userData.tissue);
    }
    focus.dispose();
    expect(disposeTexture).not.toHaveBeenCalled();
    Object.values(base).forEach(material => material.dispose());
    expect(disposeTexture).toHaveBeenCalledOnce();
    geometry.dispose();
  });

  it('refreshes theme colors and disposes only owned clones, once', () => {
    const texture = new Texture(),
      source = new MeshStandardMaterial({ map: texture });
    const focus = createTeachingFocusMaterials([source]);
    const geometry = new BoxGeometry(1, 1, 1),
      mesh = new Mesh(geometry, source);
    focus.apply(mesh, source, true);
    const faded = mesh.material;
    const disposeClone = vi.fn(),
      disposeSource = vi.fn(),
      disposeTexture = vi.fn();
    faded.addEventListener('dispose', disposeClone);
    source.addEventListener('dispose', disposeSource);
    texture.addEventListener('dispose', disposeTexture);
    source.color.set(0xff3366);
    focus.sync();
    expect(faded.color.equals(source.color)).toBe(true);
    expect(faded.map).toBe(texture);
    expect(faded.transparent).toBe(true);
    expect(faded.depthWrite).toBe(false);
    expect(faded.opacity).toBeLessThan(source.opacity);
    focus.dispose();
    focus.dispose();
    expect(disposeClone).toHaveBeenCalledTimes(1);
    expect(disposeSource).not.toHaveBeenCalled();
    expect(disposeTexture).not.toHaveBeenCalled();
    source.dispose();
    texture.dispose();
    geometry.dispose();
  });
});
