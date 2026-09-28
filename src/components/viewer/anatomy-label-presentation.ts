import type { Camera } from 'three';
import type { AnatomyLabel } from '@/lib/teaching-anatomy';
import { createAnatomyLabelLayout } from '@/lib/anatomy-label-layout';
import type { PublicAnatomyLabel } from './public-overlays';

const TISSUES = ['Crown', 'Root', 'Gingiva', 'Periodontal ligament', 'Supporting bone'];
const CAPTION = 'Schematic section · support tissues stay fixed';
const PDL_CAPTION = 'Schematic section · PDL enlarged for visibility · support tissues stay fixed';

/** Presenter DOM/SVG and public tissue annotations share one projected layout. */
export function createAnatomyLabelPresentation(host: HTMLElement, camera: Camera) {
  const overlay = document.createElement('div');
  overlay.className = 'anatomy-overlay';
  overlay.hidden = true;
  host.appendChild(overlay);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  overlay.appendChild(svg);
  const caption = document.createElement('p');
  caption.className = 'anatomy-caption';
  caption.textContent = PDL_CAPTION;
  overlay.appendChild(caption);
  const publicLabels: PublicAnatomyLabel[] = [];
  const records = TISSUES.map(text => {
    const element = document.createElement('div');
    element.className = 'anatomy-label';
    element.textContent = text;
    element.hidden = true;
    overlay.appendChild(element);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'),
      dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '2.5');
    line.style.display = dot.style.display = 'none';
    svg.append(line, dot);
    const label: PublicAnatomyLabel = {
      text,
      x: 0,
      y: 0,
      width: 0,
      side: 'left',
      color: '',
      anchorX: 0,
      anchorY: 0,
      visible: false,
    };
    publicLabels.push(label);
    return { element, line, dot, label };
  });
  const byName = new Map(records.map(record => [record.label.text, record]));
  const layout = createAnatomyLabelLayout(TISSUES.length);
  let publicCaption: string | null = null;
  return {
    labels: publicLabels,
    get caption() {
      return publicCaption;
    },
    render(
      shown: boolean,
      labels: AnatomyLabel[],
      ligament: boolean,
      width: number,
      height: number,
    ) {
      overlay.hidden = !shown;
      const text = ligament ? PDL_CAPTION : CAPTION;
      if (caption.textContent !== text) caption.textContent = text;
      publicCaption = shown ? text : null;
      for (const item of records) {
        item.element.hidden = true;
        item.line.style.display = item.dot.style.display = 'none';
        item.label.visible = false;
      }
      if (!shown) return;
      layout.update(labels, camera, width, height);
      for (let i = 0; i < layout.count; i++) {
        const label = layout.placed[i],
          item = byName.get(label.name)!;
        const visible = label.depth > -1 && label.depth < 1;
        item.element.hidden = !visible;
        item.line.style.display = item.dot.style.display = visible ? '' : 'none';
        item.element.style.cssText = `left:${label.x}px;top:${label.y}px;width:${label.width}px;--tissue:${label.color}`;
        item.line.setAttribute(
          'x1',
          String(label.side === 'left' ? label.x + label.width : label.x),
        );
        item.line.setAttribute('y1', String(label.y + 14));
        item.line.setAttribute('x2', String(label.anchorX));
        item.line.setAttribute('y2', String(label.anchorY));
        item.line.setAttribute('stroke', label.color);
        item.dot.setAttribute('cx', String(label.anchorX));
        item.dot.setAttribute('cy', String(label.anchorY));
        item.dot.setAttribute('fill', label.color);
        const out = item.label;
        out.x = label.x;
        out.y = label.y;
        out.width = label.width;
        out.side = label.side;
        out.color = label.color;
        out.anchorX = label.anchorX;
        out.anchorY = label.anchorY;
        out.visible = visible;
      }
    },
    dispose() {
      overlay.remove();
    },
  };
}
