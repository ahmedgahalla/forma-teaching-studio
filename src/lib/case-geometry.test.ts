import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, Float32BufferAttribute } from 'three';
import { makeGeometry, serialGeometry, serializedMeshSize, validMesh } from './case-geometry';
import { loadCase, saveCase, type DentalCase } from './geometry';

function atlasGeometry() {
  const geometry = new BoxGeometry(4, 6, 3),
    count = geometry.getAttribute('position').count;
  geometry.setAttribute(
    'color',
    new Float32BufferAttribute(new Float32Array(count * 3).fill(0.75), 3),
  );
  geometry.setAttribute(
    'dentalData',
    new BufferAttribute(new Uint16Array(count * 4).fill(32768), 4, true),
  );
  geometry.setAttribute('color_1', geometry.getAttribute('dentalData'));
  return geometry;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('baked atlas surface persistence', () => {
  it('decodes normalized integer data and preserves texture coordinates, colors and normals', () => {
    const geometry = atlasGeometry(),
      data = serialGeometry(geometry),
      restored = makeGeometry(data);
    expect(validMesh(data)).toBe(true);
    expect(data.attributes!.dentalData![0]).toBeCloseTo(32768 / 65535, 8);
    expect(serializedMeshSize(data)).toBe(
      data.vertices.length +
        data.normals!.length +
        data.indices!.length +
        data.attributes!.color!.length +
        data.attributes!.dentalData!.length +
        data.attributes!.uv!.length,
    );
    for (const name of ['normal', 'color', 'uv'])
      expect(Array.from(restored.getAttribute(name).array)).toEqual(
        Array.from(geometry.getAttribute(name).array),
      );
    expect(restored.getAttribute('dentalData').getX(0)).toBeCloseTo(
      geometry.getAttribute('dentalData').getX(0),
      7,
    );
    expect(restored.getAttribute('color_1')).toBe(restored.getAttribute('dentalData'));
    geometry.dispose();
    restored.dispose();
  });

  it.each([
    { color: [1, 1, 1] },
    { dentalData: [1, 1, 1, 1] },
    { uv: [NaN, 0] },
    { color: 'incorrect' },
    { unexpected: [] },
  ])('rejects malformed surface data before allocating geometry: %j', attributes => {
    const geometry = atlasGeometry(),
      data = serialGeometry(geometry);
    expect(validMesh({ ...data, attributes } as typeof data)).toBe(false);
    geometry.dispose();
  });

  it.each(['color', 'dentalData', 'uv'] as const)(
    'rejects nonfinite %s values with otherwise valid lengths',
    name => {
      const geometry = atlasGeometry(),
        data = serialGeometry(geometry);
      data.attributes![name]![0] = NaN;
      expect(validMesh(data)).toBe(false);
      if (name !== 'uv') {
        data.attributes![name]![0] = 1.01;
        expect(validMesh(data)).toBe(false);
      }
      geometry.dispose();
    },
  );

  it('round-trips crown, root and gum materials with the fitted asset identity', async () => {
    vi.useFakeTimers();
    const geometry = atlasGeometry();
    const model: DentalCase = {
      name: 'Atlas fixture',
      demo: true,
      asset: 'claude-atlas-v1',
      teeth: [
        {
          id: '11',
          name: 'Central incisor',
          position: [1, 2, 3],
          buccal: [0, 0, 1],
          mesial: [1, 0, 0],
          occlusal: [0, -1, 0],
          calibrated: true,
          geometry,
          rootGeometry: geometry.clone(),
        },
      ],
      gums: [{ id: 'gum_upper', arch: 'upper', position: [0, 0, 0], geometry: geometry.clone() }],
    };
    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(value => {
      blob = value as Blob;
      return 'blob:atlas';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('document', { createElement: () => ({ click: () => {} }) });
    saveCase(model, {});
    const data = JSON.parse(await blob!.text());
    expect(data.version).toBe(3);
    const result = await loadCase(new File([JSON.stringify(data)], 'atlas.json'));
    expect(result.model.asset).toBe(model.asset);
    for (const part of [
      result.model.teeth[0].geometry,
      result.model.teeth[0].rootGeometry!,
      result.model.gums[0].geometry,
    ]) {
      expect(part.getAttribute('color').getX(0)).toBe(0.75);
      expect(part.getAttribute('dentalData').getX(0)).toBeCloseTo(32768 / 65535, 7);
      expect(part.getAttribute('uv').count).toBe(geometry.getAttribute('position').count);
      part.dispose();
    }
    for (const part of [data.model.teeth[0], data.model.teeth[0].root, data.model.gums[0]]) {
      const attributes = part.attributes;
      delete part.attributes;
      await expect(loadCase(new File([JSON.stringify(data)], 'incomplete.json'))).rejects.toThrow(
        /atlas is missing/,
      );
      part.attributes = attributes;
    }
    data.model.asset = 'untrusted-source';
    await expect(loadCase(new File([JSON.stringify(data)], 'bad.json'))).rejects.toThrow(
      /anatomy asset/,
    );
    geometry.dispose();
    model.teeth[0].rootGeometry!.dispose();
    model.gums[0].geometry.dispose();
    vi.unstubAllGlobals();
  });
});
