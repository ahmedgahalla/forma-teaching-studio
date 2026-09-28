import metadata from '../../public/models/forma-atlas-v1.json';

export const ATLAS_DIAGRAM_HEIGHT = 21;

export type AtlasToothDiagram = Readonly<{
  md: number;
  crown: string;
  roots: readonly string[];
}>;

type ToothDimensions = {
  crownMD: number;
  cervixMD: number;
  crownHeight: number;
  rootLength: number;
  cls: string;
};

// Adapted from Claude's Dentition Atlas web/src/app/ui.js glyphPaths.
// All drawings use the upper orientation; the chart reflects lower teeth vertically.
function glyphPaths(t: ToothDimensions): AtlasToothDiagram {
  const md = t.crownMD || 7,
    cmd = t.cervixMD || md * 0.72,
    hc = Math.min(t.crownHeight || 8, 11.5);
  const lr = (t.rootLength || 13) * 0.56;
  const cx = md / 2,
    yo = ATLAS_DIAGRAM_HEIGHT,
    yc = ATLAS_DIAGRAM_HEIGHT - hc,
    yr = Math.max(0.2, yc - lr),
    cw = cmd / 2;
  const cls = t.cls;
  const number = Number(cls[1]);
  const type = number < 3 ? 'incisor' : number === 3 ? 'canine' : number < 6 ? 'premolar' : 'molar';
  const P = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  let crown: string;
  const sideY = yc + hc * 0.5;
  if (type === 'incisor') {
    crown =
      `M${P(cx - cw, yc)} C${P(cx - cw - 0.2, yc + hc * 0.25)} ${P(0.15, sideY - hc * 0.1)} ${P(0.12, yo - hc * 0.2)}` +
      ` L${P(0.25, yo - 0.35)} Q${P(0.35, yo)} ${P(1.0, yo)} L${P(md - 1.0, yo)} Q${P(md - 0.35, yo)} ${P(md - 0.25, yo - 0.45)}` +
      ` L${P(md - 0.12, yo - hc * 0.2)} C${P(md - 0.15, sideY - hc * 0.1)} ${P(cx + cw + 0.2, yc + hc * 0.25)} ${P(cx + cw, yc)} Z`;
  } else if (type === 'canine') {
    crown =
      `M${P(cx - cw, yc)} C${P(cx - cw - 0.3, yc + hc * 0.3)} ${P(0.1, sideY - hc * 0.05)} ${P(0.2, yo - hc * 0.3)}` +
      ` L${P(cx, yo)} L${P(md - 0.2, yo - hc * 0.3)} C${P(md - 0.1, sideY - hc * 0.05)} ${P(cx + cw + 0.3, yc + hc * 0.3)} ${P(cx + cw, yc)} Z`;
  } else if (type === 'premolar') {
    crown =
      `M${P(cx - cw, yc)} C${P(cx - cw - 0.4, yc + hc * 0.3)} ${P(0.05, sideY - hc * 0.1)} ${P(0.25, yo - hc * 0.32)}` +
      ` Q${P(cx - md * 0.2, yo - 0.3)} ${P(cx, yo)} Q${P(cx + md * 0.2, yo - 0.3)} ${P(md - 0.25, yo - hc * 0.32)}` +
      ` C${P(md - 0.05, sideY - hc * 0.1)} ${P(cx + cw + 0.4, yc + hc * 0.3)} ${P(cx + cw, yc)} Z`;
  } else {
    crown =
      `M${P(cx - cw, yc)} C${P(cx - cw - 0.5, yc + hc * 0.25)} ${P(0.05, sideY - hc * 0.15)} ${P(0.2, yo - hc * 0.3)}` +
      ` Q${P(md * 0.2, yo + 0.1)} ${P(md * 0.3, yo)} Q${P(cx - 0.3, yo - 0.2)} ${P(cx, yo - 0.9)} Q${P(cx + 0.3, yo - 0.2)} ${P(md * 0.7, yo)}` +
      ` Q${P(md * 0.8, yo + 0.1)} ${P(md - 0.2, yo - hc * 0.3)} C${P(md - 0.05, sideY - hc * 0.15)} ${P(cx + cw + 0.5, yc + hc * 0.25)} ${P(cx + cw, yc)} Z`;
  }
  const root = (x0: number, x1: number, apexX: number, apexY: number) =>
    `M${P(x0, yc)} Q${P(x0 + (apexX - x0) * 0.25, yc - (yc - apexY) * 0.65)} ${P(apexX, apexY)} Q${P(x1 + (apexX - x1) * 0.25, yc - (yc - apexY) * 0.65)} ${P(x1, yc)}`;
  const roots: string[] = [];
  const nRoots =
    cls === 'U6' || cls === 'U7'
      ? 3
      : cls === 'U4' || (cls[0] === 'L' && /[678]/.test(cls[1]))
        ? 2
        : 1;
  if (cls === 'U8') roots.push(root(cx - cw * 0.9, cx + cw * 0.9, cx, yc - lr * 0.8));
  else if (nRoots === 1) roots.push(root(cx - cw * 0.92, cx + cw * 0.92, cx, yr));
  else if (nRoots === 2 && cls === 'U4') {
    roots.push(root(cx - cw * 0.9, cx + cw * 0.1, cx - cw * 0.42, yr));
    roots.push(root(cx - cw * 0.1, cx + cw * 0.9, cx + cw * 0.42, yr + lr * 0.06));
  } else if (nRoots === 2) {
    roots.push(root(cx - cw * 0.95, cx - cw * 0.05, cx - cw * 0.62, yr));
    roots.push(root(cx + cw * 0.05, cx + cw * 0.95, cx + cw * 0.62, yr + lr * 0.07));
  } else {
    roots.push(root(cx - cw * 0.95, cx - cw * 0.2, cx - cw * 0.85, yr + lr * 0.06));
    roots.push(root(cx - cw * 0.35, cx + cw * 0.35, cx, yr));
    roots.push(root(cx + cw * 0.2, cx + cw * 0.95, cx + cw * 0.85, yr + lr * 0.1));
  }
  return Object.freeze({ md, crown, roots: Object.freeze(roots) });
}

export const ATLAS_TOOTH_DIAGRAMS: Readonly<Record<string, AtlasToothDiagram>> = Object.freeze(
  Object.fromEntries(Object.entries(metadata.teeth).map(([id, tooth]) => [id, glyphPaths(tooth)])),
);
