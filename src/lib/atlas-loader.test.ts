import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DentalCase } from './geometry';

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockAssetFetch(bindings = () => readFileSync('public/models/forma-atlas-gums-v1.bin')) {
  const bytes = readFileSync('public/models/forma-atlas-v1.glb');
  const metadata = readFileSync('public/models/forma-atlas-v1.json', 'utf8');
  const fetch = vi.fn(async (url: string) => {
    if (url === '/models/forma-atlas-v1.json') return new Response(metadata);
    if (url === '/models/forma-atlas-v1.glb') return new Response(new Uint8Array(bytes));
    if (url === '/models/forma-atlas-gums-v1.bin') return new Response(new Uint8Array(bindings()));
    throw new Error(`Unexpected asset request: ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function geometries(model: DentalCase) {
  return [
    ...model.teeth.flatMap(tooth => [
      tooth.geometry,
      ...(tooth.rootGeometry ? [tooth.rootGeometry] : []),
    ]),
    ...model.gums.map(gum => gum.geometry),
  ];
}

describe('default atlas loading', () => {
  it('loads all three local files and primes gum bindings before sharing immutable geometry', async () => {
    const { getTeachingAssetCase, loadTeachingAsset } = await import('./anatomy-assets');
    const { cachedGumBinding } = await import('./gum-binding-cache');
    const { gumInfluences } = await import('./gum-influences');
    const { toothArch } = await import('./appliances');
    const fetch = mockAssetFetch();
    const loading = loadTeachingAsset();
    expect(getTeachingAssetCase()).toBeUndefined();
    await loading;
    const first = getTeachingAssetCase()!,
      second = getTeachingAssetCase()!;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(first.asset).toBe('claude-atlas-v1');
    expect(first.teeth).toHaveLength(28);
    for (const gum of first.gums) {
      const teeth = first.teeth.filter(tooth => toothArch(tooth.id) === gum.arch);
      const subsets =
        gum.arch === 'upper'
          ? [teeth, teeth.filter(tooth => !['14', '24'].includes(tooth.id))]
          : [teeth];
      for (const subset of subsets) {
        const binding = cachedGumBinding(gum, subset);
        expect(binding).toBeDefined();
        expect(gumInfluences(gum, subset)).toBe(binding);
        const clonedGum = second.gums.find(item => item.id === gum.id)!;
        const clonedTeeth = subset.map(tooth => second.teeth.find(item => item.id === tooth.id)!);
        expect(cachedGumBinding(clonedGum, clonedTeeth)).toBe(binding);
      }
    }
    first.teeth[0].position[0] += 10;
    expect(first.teeth[0].position).not.toEqual(second.teeth[0].position);
    expect(first.teeth[0].geometry).toBe(second.teeth[0].geometry);
    expect(first.teeth[0].geometry.hasAttribute('dentalData')).toBe(true);
    await loadTeachingAsset();
    expect(fetch).toHaveBeenCalledTimes(3);
    geometries(first).forEach(geometry => geometry.dispose());
  });

  it('disposes a model with a stale sidecar, publishes nothing, and permits a complete retry', async () => {
    const { BufferGeometry } = await import('three');
    const atlas = await import('./atlas-assets');
    const converted = vi.spyOn(atlas, 'dentalCaseFromAtlas');
    const disposed = vi.spyOn(BufferGeometry.prototype, 'dispose');
    const { getTeachingAssetCase, loadTeachingAsset } = await import('./anatomy-assets');
    const good = readFileSync('public/models/forma-atlas-gums-v1.bin');
    const stale = Buffer.from(good);
    stale[stale.length - 1] ^= 1;
    let bindings = stale;
    const fetch = mockAssetFetch(() => bindings);
    await expect(loadTeachingAsset()).rejects.toThrow(/model files do not match/i);
    expect(getTeachingAssetCase()).toBeUndefined();
    expect(converted).toHaveBeenCalledTimes(1);
    const failed = converted.mock.results[0].value as DentalCase;
    const disposedGeometry = new Set(disposed.mock.contexts);
    for (const geometry of geometries(failed)) expect(disposedGeometry.has(geometry)).toBe(true);

    bindings = good;
    const retry = loadTeachingAsset();
    expect(getTeachingAssetCase()).toBeUndefined();
    await retry;
    const model = getTeachingAssetCase()!;
    expect(model.teeth).toHaveLength(28);
    expect(model.teeth[0].geometry).not.toBe(failed.teeth[0].geometry);
    expect(fetch).toHaveBeenCalledTimes(6);
    await loadTeachingAsset();
    expect(fetch).toHaveBeenCalledTimes(6);
    geometries(model).forEach(geometry => geometry.dispose());
  });
});
