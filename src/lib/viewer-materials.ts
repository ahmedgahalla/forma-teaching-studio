import * as THREE from 'three';
import { dentalStagePalette, type DentalStageTheme } from './dental-surface';
import { createAtlasMaterials } from './atlas-materials';
import { preserveMaterialProgram, type DentalFarAO } from './atlas-shader';

/** Shared display materials, created once per scene and disposed by its owner. */
export function createDentalMaterials(demo: boolean, theme: DentalStageTheme, farAO?: DentalFarAO) {
  const palette = dentalStagePalette[theme];
  const atlas = farAO ? createAtlasMaterials(farAO) : null;
  const enamel =
    atlas?.enamel ??
    new THREE.MeshPhysicalMaterial({
      color: demo ? 0xf8f3e8 : 0xe4dbc6,
      vertexColors: demo,
      roughness: 0.53,
      metalness: 0,
      ior: 1.46,
      specularIntensity: 0.65,
      clearcoat: 0.035,
      clearcoatRoughness: 0.64,
    });
  const lockedMaterial = preserveMaterialProgram(enamel.clone(), enamel);
  lockedMaterial.color.set(palette.locked);
  const contactMaterial = preserveMaterialProgram(enamel.clone(), enamel);
  contactMaterial.color.set(palette.contact);
  return {
    enamel,
    lockedMaterial,
    contactMaterial,
    rootMaterial:
      atlas?.rootMaterial ??
      new THREE.MeshStandardMaterial({
        color: demo ? 0xfff4df : 0xccb08b,
        vertexColors: demo,
        roughness: 0.69,
        metalness: 0,
      }),
    ghostMaterial: new THREE.MeshBasicMaterial({
      color: palette.ghost,
      opacity: palette.ghostOpacity,
      transparent: true,
      depthWrite: false,
    }),
    gumMaterial:
      atlas?.gumMaterial ??
      new THREE.MeshPhysicalMaterial({
        color: demo ? 0xf9eeee : 0xb8757b,
        vertexColors: demo,
        roughness: 0.83,
        metalness: 0,
        specularIntensity: 0.3,
        clearcoat: 0,
        transparent: true,
        side: THREE.DoubleSide,
      }),
    attachmentMaterial: new THREE.MeshStandardMaterial({ color: 0xf1b762, roughness: 0.4 }),
  };
}
