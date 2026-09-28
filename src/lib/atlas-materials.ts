import * as THREE from 'three';
import { patchAtlasMaterial, type DentalFarAO } from './atlas-shader';
import { makePerikymataTexture, makeStipplingTexture } from './atlas-textures';

/** Textures belong to the original material, never to status or teaching-focus clones. */
function ownBumpTexture(material: THREE.MeshPhysicalMaterial) {
  const texture = material.bumpMap!;
  const dispose = () => {
    material.removeEventListener('dispose', dispose);
    texture.dispose();
  };
  material.addEventListener('dispose', dispose);
  return material;
}

export function createAtlasMaterials(farAO: DentalFarAO) {
  const enamel = ownBumpTexture(
    patchAtlasMaterial(
      new THREE.MeshPhysicalMaterial({
        name: 'enamel',
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.28,
        metalness: 0,
        ior: 1.63,
        clearcoat: 0.35,
        clearcoatRoughness: 0.1,
        bumpMap: makePerikymataTexture(),
        bumpScale: 0.08,
      }),
      'enamel',
      farAO,
      {
        wrap: 0.2,
        scatterColor: 0xd9b48a,
        transColor: 0xffb070,
        transScale: 0.35,
        transPower: 4,
        transDistortion: 0.2,
        aoDirect: 0.5,
      },
    ),
  );
  const rootMaterial = patchAtlasMaterial(
    new THREE.MeshPhysicalMaterial({
      name: 'cementum',
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.65,
      metalness: 0,
      ior: 1.5,
    }),
    'cementum',
    farAO,
    { wrap: 0.15, scatterColor: 0xc8a070, transScale: 0, aoDirect: 0.3 },
  );
  const gumMaterial = ownBumpTexture(
    patchAtlasMaterial(
      new THREE.MeshPhysicalMaterial({
        name: 'gingiva',
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.5,
        metalness: 0,
        ior: 1.4,
        clearcoat: 0.35,
        clearcoatRoughness: 0.2,
        bumpMap: makeStipplingTexture(),
        bumpScale: 0.45,
        // Retain Forma's existing translucent root/cutaway layer controls.
        transparent: true,
        side: THREE.DoubleSide,
      }),
      'gum',
      farAO,
      {
        wrap: 0.35,
        scatterColor: 0x701818,
        transColor: 0xff3a30,
        transScale: 1,
        transPower: 3,
      },
    ),
  );
  return { enamel, rootMaterial, gumMaterial };
}
