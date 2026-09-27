import * as THREE from 'three';
import { dentalStagePalette, type DentalStageTheme } from './dental-surface';
import { selectionContourMaterial } from './viewer-presentation';

/** Shared display materials, created once per scene and disposed by its owner. */
export function createDentalMaterials(demo: boolean, theme: DentalStageTheme) {
  const palette = dentalStagePalette[theme];
  const enamel = new THREE.MeshPhysicalMaterial({
    color: demo ? 0xf8f3e8 : 0xe4dbc6,
    vertexColors: demo,
    roughness: 0.53,
    metalness: 0,
    ior: 1.46,
    specularIntensity: 0.65,
    clearcoat: 0.035,
    clearcoatRoughness: 0.64,
  });
  const lockedMaterial = enamel.clone();
  lockedMaterial.color.set(palette.locked);
  const contactMaterial = enamel.clone();
  contactMaterial.color.set(palette.contact);
  return {
    enamel,
    lockedMaterial,
    contactMaterial,
    contourMaterial: selectionContourMaterial(palette.selected),
    rootMaterial: new THREE.MeshStandardMaterial({
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
    gumMaterial: new THREE.MeshPhysicalMaterial({
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
