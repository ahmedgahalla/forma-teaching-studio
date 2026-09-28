// Run after an atlas snapshot or influence algorithm change. Keep the producer assets unchanged.
import { register } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

register(
  `data:text/javascript,${encodeURIComponent(`
  import path from 'node:path';
  export async function resolve(specifier, context, next) {
    return next(specifier.startsWith('.') && !path.extname(specifier) ? specifier + '.ts' : specifier, context);
  }
`)}`,
  import.meta.url,
);
const load = name => import(pathToFileURL(path.resolve(`src/lib/${name}.ts`)));
const { dentalCaseFromAtlas } = await load('atlas-assets');
const { gumInfluences } = await load('gum-influences');
const {
  GUM_BINDING_MAGIC,
  GUM_BINDING_VERSION,
  GUM_BINDING_INPUTS,
  gumBindingDescriptor,
  gumBindingChecksum,
} = await load('atlas-gum-bindings');
const asset = readFileSync('public/models/forma-atlas-v1.glb'),
  metadata = readFileSync('public/models/forma-atlas-v1.json');
const gltf = await new GLTFLoader().parseAsync(
  asset.buffer.slice(asset.byteOffset, asset.byteOffset + asset.byteLength),
  '',
);
const model = dentalCaseFromAtlas(gltf.scene, JSON.parse(metadata.toString('utf8')));
const arches = gumBindingDescriptor(model);
const payload = Buffer.alloc(arches.reduce((sum, arch) => sum + arch.vertices * 15, 0));
let offset = 0;
for (const arch of arches) {
  const teeth = arch.teeth.map(item => model.teeth.find(tooth => tooth.id === item.id));
  const binding = gumInfluences(
    model.gums.find(gum => gum.id === arch.id),
    teeth,
  );
  for (let j = 0; j < binding.indices.length; j++, offset += 5) {
    payload.writeUInt8(binding.indices[j], offset);
    payload.writeFloatLE(binding.weights[j], offset + 1);
  }
}
const sha = value => createHash('sha256').update(value).digest('hex');
const generator = sha(Buffer.concat(GUM_BINDING_INPUTS.map(name => readFileSync(name))));
const header = Buffer.from(
  JSON.stringify({
    version: GUM_BINDING_VERSION,
    asset: sha(asset),
    metadata: sha(metadata),
    generator,
    payload: sha(payload),
    checksums: {
      asset: gumBindingChecksum(asset),
      metadata: gumBindingChecksum(metadata),
      payload: gumBindingChecksum(payload),
    },
    arches,
  }),
);
const prefix = Buffer.alloc(12);
prefix.write(GUM_BINDING_MAGIC);
prefix.writeUInt32LE(header.length, 8);
const file = 'public/models/forma-atlas-gums-v1.bin';
writeFileSync(file, Buffer.concat([prefix, header, payload]));
console.log(
  `Generated ${file}: ${prefix.length + header.length + payload.length} bytes for ${arches.length} bindings.`,
);
