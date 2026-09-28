import { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ATLAS_ASSET_URL, ATLAS_METADATA_URL, dentalCaseFromAtlas } from './atlas-assets';
import { ATLAS_GUM_BINDINGS_URL, primeAtlasGumBindings } from './atlas-gum-bindings';

export async function loadAtlasModel() {
  const signal = AbortSignal.timeout(15000);
  const responses = await Promise.all(
    [ATLAS_METADATA_URL, ATLAS_ASSET_URL, ATLAS_GUM_BINDINGS_URL].map(url =>
      fetch(url, { signal }),
    ),
  );
  if (responses.some(response => !response.ok))
    throw new Error('The refined teaching model could not be downloaded.');
  const [metadata, asset, bindings] = await Promise.all(
    responses.map(response => response.arrayBuffer()),
  );
  if (asset.byteLength > 30 * 1024 * 1024)
    throw new Error('The teaching model exceeds the display asset budget.');
  const gltf = await new GLTFLoader().parseAsync(asset, '/models/');
  try {
    const model = dentalCaseFromAtlas(gltf.scene, JSON.parse(new TextDecoder().decode(metadata)));
    try {
      await primeAtlasGumBindings(model, bindings, { asset, metadata });
    } catch (error) {
      model.teeth.forEach(tooth => {
        tooth.geometry.dispose();
        tooth.rootGeometry?.dispose();
      });
      model.gums.forEach(gum => gum.geometry.dispose());
      throw error;
    }
    return model;
  } finally {
    gltf.scene.traverse(object => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material =>
        material.dispose(),
      );
    });
  }
}
