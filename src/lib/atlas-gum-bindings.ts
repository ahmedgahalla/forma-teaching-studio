import type { DentalCase } from './geometry';
import { toothArch } from './appliances';
import { cacheGumBinding, makeGumBinding } from './gum-binding-cache';

export const ATLAS_GUM_BINDINGS_URL = '/models/forma-atlas-gums-v1.bin';
export const GUM_BINDING_VERSION = 1;
export const GUM_BINDING_MAGIC = 'FRMGUM01';
export const GUM_BINDING_INPUTS = [
  'src/lib/atlas-assets.ts',
  'src/lib/gum-influences.ts',
  'src/lib/gum-surface-distance.ts',
  'src/lib/gum-binding-cache.ts',
  'src/lib/atlas-gum-bindings.ts',
  'scripts/generate-atlas-gum-bindings.mjs',
];
export const gumBindingDescriptor = (model: DentalCase) =>
  model.gums.flatMap(gum => {
    const teeth = model.teeth.filter(tooth => toothArch(tooth.id) === gum.arch);
    const describe = (selected: typeof teeth) => ({
      id: gum.id,
      arch: gum.arch,
      position: gum.position,
      vertices: gum.geometry.getAttribute('position').count,
      teeth: selected.map(tooth => ({ id: tooth.id, position: tooth.position })),
    });
    // The ready-made space-closure lecture omits upper first premolars.
    return gum.arch === 'upper'
      ? [describe(teeth), describe(teeth.filter(tooth => !['14', '24'].includes(tooth.id)))]
      : [describe(teeth)];
  });
const invalid = () => new Error('The model files do not match. Reload the app to try again.');
// Corruption/staleness check, not a security signature. Works on offline LAN HTTP too.
export function gumBindingChecksum(bytes: Uint8Array) {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
  return `${bytes.byteLength}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
export async function primeAtlasGumBindings(
  model: DentalCase,
  bytes: ArrayBuffer,
  source: { asset: ArrayBuffer; metadata: ArrayBuffer },
) {
  if (bytes.byteLength < 12 || bytes.byteLength > 4_000_000) throw invalid();
  const view = new DataView(bytes),
    decoder = new TextDecoder();
  if (decoder.decode(new Uint8Array(bytes, 0, 8)) !== GUM_BINDING_MAGIC) throw invalid();
  const headerLength = view.getUint32(8, true),
    start = 12 + headerLength;
  if (headerLength > 16_384 || start > bytes.byteLength) throw invalid();
  let header;
  try {
    header = JSON.parse(decoder.decode(new Uint8Array(bytes, 12, headerLength)));
  } catch {
    throw invalid();
  }
  const descriptors = gumBindingDescriptor(model);
  if (
    !header ||
    header.version !== GUM_BINDING_VERSION ||
    model.asset !== 'claude-atlas-v1' ||
    JSON.stringify(header.arches) !== JSON.stringify(descriptors) ||
    start + descriptors.reduce((sum, arch) => sum + arch.vertices * 15, 0) !== bytes.byteLength
  )
    throw invalid();
  if (
    header.checksums?.asset !== gumBindingChecksum(new Uint8Array(source.asset)) ||
    header.checksums?.metadata !== gumBindingChecksum(new Uint8Array(source.metadata)) ||
    header.checksums?.payload !== gumBindingChecksum(new Uint8Array(bytes, start))
  )
    throw invalid();
  let offset = start;
  const decoded = descriptors.map(arch => {
    const indices = new Uint8Array(arch.vertices * 3),
      weights = new Float32Array(indices.length);
    for (let i = 0; i < indices.length; i++, offset += 5) {
      indices[i] = view.getUint8(offset);
      weights[i] = view.getFloat32(offset + 1, true);
      if (
        indices[i] >= arch.teeth.length ||
        !Number.isFinite(weights[i]) ||
        weights[i] < 0 ||
        weights[i] > 1
      )
        throw invalid();
      if (i % 3 === 2 && weights[i] + weights[i - 1] + weights[i - 2] > 1.000001) throw invalid();
    }
    return makeGumBinding(indices, weights, arch.teeth.length);
  });
  descriptors.forEach((arch, i) =>
    cacheGumBinding(
      model.gums.find(gum => gum.id === arch.id)!,
      arch.teeth.map(item => model.teeth.find(tooth => tooth.id === item.id)!),
      decoded[i],
      true,
    ),
  );
}
