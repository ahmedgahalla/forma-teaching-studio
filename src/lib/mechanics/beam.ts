import type { WireSection, WireMaterial } from './types';
import { MATERIAL_PRESETS } from './presets';
import { matrix } from './math';

export function sectionProperties(section: WireSection) {
  if (section.shape === 'round') { const d = section.diameterMm; return { area: Math.PI * d * d / 4, iy: Math.PI * d ** 4 / 64, iz: Math.PI * d ** 4 / 64, j: Math.PI * d ** 4 / 32, y: d / 2, z: d / 2 }; }
  // Local beam Y is occlusal (height); Z is buccal (width). Saint-Venant rectangle torsion approximation.
  const h = section.heightMm, w = section.widthMm, a = Math.max(h, w), b = Math.min(h, w);
  return { area: h * w, iy: h * w ** 3 / 12, iz: w * h ** 3 / 12, j: a * b ** 3 * (1 / 3 - .21 * b / a * (1 - b ** 4 / (12 * a ** 4))), y: h / 2, z: w / 2 };
}
/** Relative twist clearance of a rectangular wire in an ideal sharp-corner slot. */
export function slotPlayRadians(section: WireSection, slotHeight = .022 * 25.4, slotWidth = .028 * 25.4) {
  if (section.shape === 'round') return Math.PI;
  const { widthMm: w, heightMm: h } = section;
  if (h > slotHeight + 1e-10 || w > slotWidth + 1e-10) throw new Error('The wire section does not fit the ideal 0.022 × 0.028 inch slot.');
  const fits = (angle: number) => h * Math.cos(angle) + w * Math.sin(angle) <= slotHeight && w * Math.cos(angle) + h * Math.sin(angle) <= slotWidth;
  let low = 0, high = Math.PI / 4;
  for (let i = 0; i < 45; i++) { const middle = (low + high) / 2; if (fits(middle)) low = middle; else high = middle; }
  return low;
}
/** 12-DOF beam bending matrix [u,v,w,rx,ry,rz] per node. Axial sliding and twist are handled separately. */
export function beamBendingMatrix(length: number, material: WireMaterial, section: WireSection): number[][] {
  if (!(length >= .5 && length <= 60)) throw new Error('Wire bracket spans must be between 0.5 and 60 mm.');
  const k = matrix(12), p = sectionProperties(section), e = MATERIAL_PRESETS[material].youngNPerMm2;
  const insert = (ids: number[], rigidity: number, sign: number) => {
    const l = length, base = [[12, 6 * l * sign, -12, 6 * l * sign], [6 * l * sign, 4 * l * l, -6 * l * sign, 2 * l * l], [-12, -6 * l * sign, 12, -6 * l * sign], [6 * l * sign, 2 * l * l, -6 * l * sign, 4 * l * l]];
    ids.forEach((row, i) => ids.forEach((col, j) => { k[row][col] += base[i][j] * rigidity / l ** 3; }));
  };
  insert([1, 5, 7, 11], e * p.iz, 1); insert([2, 4, 8, 10], e * p.iy, -1);
  return k;
}
