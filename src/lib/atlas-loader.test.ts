import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { getTeachingAssetCase, loadTeachingAsset } from './anatomy-assets';

afterEach(() => vi.unstubAllGlobals());

describe('default atlas loading', () => {
  it('requests the local atlas files and clones metadata while sharing immutable surface geometry', async () => {
    const bytes = readFileSync('public/models/forma-atlas-v1.glb');
    const metadata = readFileSync('public/models/forma-atlas-v1.json', 'utf8');
    const fetch = vi.fn(async (url: string) => {
      if (url === '/models/forma-atlas-v1.json') return new Response(metadata);
      if (url === '/models/forma-atlas-v1.glb') return new Response(new Uint8Array(bytes));
      throw new Error(`Unexpected asset request: ${url}`);
    });
    vi.stubGlobal('fetch', fetch);
    await loadTeachingAsset();
    const first = getTeachingAssetCase()!,
      second = getTeachingAssetCase()!;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(first.asset).toBe('claude-atlas-v1');
    expect(first.teeth).toHaveLength(28);
    first.teeth[0].position[0] += 10;
    expect(first.teeth[0].position).not.toEqual(second.teeth[0].position);
    expect(first.teeth[0].geometry).toBe(second.teeth[0].geometry);
    expect(first.teeth[0].geometry.hasAttribute('dentalData')).toBe(true);
    await loadTeachingAsset();
    expect(fetch).toHaveBeenCalledTimes(2);
    first.teeth.forEach(tooth => {
      tooth.geometry.dispose();
      tooth.rootGeometry?.dispose();
    });
    first.gums.forEach(gum => gum.geometry.dispose());
  });
});
