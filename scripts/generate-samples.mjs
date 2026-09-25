// Run with Node 22.6+: node --experimental-strip-types scripts/generate-samples.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Mesh } from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { createOrthodonticDemo } from '../src/lib/demo.ts';
const target = fileURLToPath(new URL('../sample-models/', import.meta.url));
mkdirSync(target, { recursive: true });
const model = createOrthodonticDemo(),
  exporter = new STLExporter();
for (const piece of [...model.teeth, ...model.gums]) {
  const mesh = new Mesh(piece.geometry);
  mesh.position.fromArray(piece.position);
  mesh.updateMatrixWorld(true);
  const output = exporter.parse(mesh, { binary: true });
  writeFileSync(`${target}${piece.id}.stl`, new Uint8Array(output.buffer));
}
console.log(
  `Wrote ${model.teeth.length} separate synthetic crown STLs and ${model.gums.length} gum STLs in sample-models. Schematic roots and braces are excluded.`,
);
