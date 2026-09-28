import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { dentalCaseFromAtlas } from './atlas-assets';
import {
  GUM_BINDING_INPUTS,
  gumBindingChecksum,
  gumBindingDescriptor,
  primeAtlasGumBindings,
} from './atlas-gum-bindings';
import { gumInfluences } from './gum-influences';
import { cachedGumBinding, type GumBinding } from './gum-binding-cache';
import { createDentalArrangement, DENTAL_ARRANGEMENTS } from './dental-arrangements';
import { createTeachingCase } from './teaching-cases';
import { toothArch } from './appliances';
import type { DentalCase } from './geometry';

const read = (file: string) => new Uint8Array(readFileSync(`public/models/${file}`)).buffer;
const source = { asset: read('forma-atlas-v1.glb'), metadata: read('forma-atlas-v1.json') };
const bytes = read('forma-atlas-gums-v1.bin');
type Header = {
  version: number;
  asset: string;
  metadata: string;
  payload: string;
  generator: string;
  checksums: { asset: string; metadata: string; payload: string };
  arches: ReturnType<typeof gumBindingDescriptor>;
};
const length = new DataView(bytes).getUint32(8, true);
const header: Header = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 12, length)));
const payload = new Uint8Array(bytes, 12 + length);
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const bindingHash = (binding: GumBinding) =>
  sha(Buffer.concat([binding.indices, new Uint8Array(binding.weights.buffer)]));
let model: DentalCase, computed: string[];

beforeAll(async () => {
  const gltf = await new GLTFLoader().parseAsync(source.asset, '');
  model = dentalCaseFromAtlas(gltf.scene, JSON.parse(new TextDecoder().decode(source.metadata)));
  gltf.scene.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(value =>
      value.dispose(),
    );
  });
  // Compute before canonical priming, so parity cannot accidentally use the shipped cache.
  computed = gumBindingDescriptor(model).map(arch =>
    bindingHash(
      gumInfluences(
        model.gums.find(gum => gum.id === arch.id)!,
        arch.teeth.map(tooth => model.teeth.find(item => item.id === tooth.id)!),
      ),
    ),
  );
  await primeAtlasGumBindings(model, bytes, source);
}, 60_000);
afterAll(() => {
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
});

function rewrite(change: (copy: Header, data: Uint8Array) => void) {
  const copy = structuredClone(header),
    data = payload.slice();
  change(copy, data);
  copy.checksums.payload = gumBindingChecksum(data);
  const json = new TextEncoder().encode(JSON.stringify(copy));
  const result = new Uint8Array(12 + json.length + data.length);
  result.set(new Uint8Array(bytes, 0, 8));
  new DataView(result.buffer).setUint32(8, json.length, true);
  result.set(json, 12);
  result.set(data, 12 + json.length);
  return result.buffer;
}

it('pins the source and generator hashes and matches actual influence computation', () => {
  expect(header.asset).toBe(sha(new Uint8Array(source.asset)));
  expect(header.metadata).toBe(sha(new Uint8Array(source.metadata)));
  expect(header.payload).toBe(sha(payload));
  expect(header.generator).toBe(
    sha(Buffer.concat(GUM_BINDING_INPUTS.map(path => readFileSync(path)))),
  );
  expect(header.arches).toEqual(gumBindingDescriptor(model));
  header.arches.forEach((arch, i) => {
    const binding = cachedGumBinding(
      model.gums.find(gum => gum.id === arch.id)!,
      arch.teeth.map(tooth => model.teeth.find(item => item.id === tooth.id)!),
    );
    expect(binding).toBeDefined();
    expect(bindingHash(binding!)).toBe(computed[i]);
  });
});

it('reuses bindings for actual rigid dental arrangements and the extraction lecture', () => {
  const baseline = new Map(
    model.gums.map(gum => [
      gum.id,
      cachedGumBinding(
        gum,
        model.teeth.filter(tooth => toothArch(tooth.id) === gum.arch),
      ),
    ]),
  );
  for (const definition of DENTAL_ARRANGEMENTS) {
    const arranged = createDentalArrangement(model, definition.id).model;
    for (const gum of arranged.gums)
      expect(
        cachedGumBinding(
          gum,
          arranged.teeth.filter(tooth => toothArch(tooth.id) === gum.arch),
        ),
      ).toBe(baseline.get(gum.id));
  }
  const extraction = createTeachingCase(model, 'anchorage-space-closure').model;
  expect(extraction.teeth).toHaveLength(26);
  for (const gum of extraction.gums)
    expect(
      cachedGumBinding(
        gum,
        extraction.teeth.filter(tooth => toothArch(tooth.id) === gum.arch),
      ),
    ).toBeDefined();
}, 30_000);

it.each(['asset', 'metadata'] as const)('rejects stale %s source bytes', async part => {
  const changed = source[part].slice(0);
  new Uint8Array(changed)[changed.byteLength - 1] ^= 1;
  await expect(primeAtlasGumBindings(model, bytes, { ...source, [part]: changed })).rejects.toThrow(
    /model files/,
  );
});

it('rejects corrupt payloads, truncation and malformed headers', async () => {
  const changed = bytes.slice(0);
  new Uint8Array(changed)[changed.byteLength - 1] ^= 1;
  for (const invalid of [changed, bytes.slice(0, -1), new ArrayBuffer(0), new ArrayBuffer(20)])
    await expect(primeAtlasGumBindings(model, invalid, source)).rejects.toThrow(/model files/);
});

it.each([
  (copy: Header) => {
    copy.version++;
  },
  (copy: Header) => {
    copy.arches[0].vertices--;
  },
  (copy: Header) => {
    copy.arches[0].teeth[0].id = '18';
  },
  (_: Header, data: Uint8Array) => {
    data[0] = 255;
  },
  (_: Header, data: Uint8Array) => {
    new DataView(data.buffer).setFloat32(1, NaN, true);
  },
  (_: Header, data: Uint8Array) => {
    new DataView(data.buffer).setFloat32(1, -0.1, true);
  },
  (_: Header, data: Uint8Array) => {
    new DataView(data.buffer).setFloat32(1, 1.1, true);
  },
  (_: Header, data: Uint8Array) => {
    const view = new DataView(data.buffer);
    view.setFloat32(1, 0.6, true);
    view.setFloat32(6, 0.6, true);
  },
])('rejects incompatible descriptors and invalid decoded weights %#', async change => {
  await expect(primeAtlasGumBindings(model, rewrite(change), source)).rejects.toThrow(
    /model files/,
  );
});
