// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import type { DentalCase } from '@/lib/geometry';
import type { AnatomyLabel } from '@/lib/teaching-anatomy';
import { createToothLabelPresentation } from './tooth-label-presentation';
import { createAnatomyLabelPresentation } from './anatomy-label-presentation';

function view() {
  const camera = new PerspectiveCamera(34, 1.4, 0.1, 1000);
  camera.position.set(0, 0, 70);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

it('publishes only visible tooth IDs at presenter coordinates while retaining private lock text and selection clicks', () => {
  const model = {
    teeth: [{ id: '11' }, { id: '21' }, { id: '31' }, { id: '41' }],
  } as unknown as DentalCase;
  const groups = new Map(model.teeth.map(tooth => [tooth.id, new Group()]));
  groups.get('41')!.visible = false;
  const camera = view(),
    host = document.createElement('div'),
    select = vi.fn();
  const presentation = createToothLabelPresentation(model, groups, host, camera, select);
  const labels = [...presentation.labels],
    nodes = [...host.querySelectorAll<HTMLButtonElement>('button')];
  presentation.render(true, ['21'], ['21'], 1000, 700);
  expect(presentation.labels.filter(label => label.visible).map(label => label.id)).toEqual([
    '21',
    '31',
  ]);
  expect(nodes[1].textContent).toBe('21 · locked');
  expect(nodes[1].classList.contains('selected')).toBe(true);
  for (const label of presentation.labels) {
    const node = nodes.find(
      item => item.getAttribute('aria-label') === `Select tooth ${label.id}`,
    )!;
    expect(node.style.display === 'block').toBe(label.visible);
    if (label.visible)
      expect(node.style.transform).toBe(
        `translate(-50%, -50%) translate(${label.x}px,${label.y}px)`,
      );
    expect(Object.keys(label).sort()).toEqual(['id', 'selected', 'visible', 'x', 'y']);
  }
  expect(JSON.stringify(presentation.labels)).not.toContain('locked');
  nodes[1].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
  expect(select).toHaveBeenLastCalledWith('21', true);
  nodes[1].click();
  expect(select).toHaveBeenLastCalledWith('21', false);
  camera.position.set(10, 0, 70);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  presentation.render(true, ['11'], [], 1000, 700);
  expect(nodes[1].textContent).toBe('21');
  expect(presentation.labels.every((label, i) => label === labels[i])).toBe(true);
  expect([...host.querySelectorAll('button')]).toEqual(nodes);
  presentation.render(false, [], undefined, 1000, 700);
  expect(presentation.labels.every(label => !label.visible)).toBe(true);
  expect(nodes.every(node => node.style.display === 'none')).toBe(true);
  presentation.render(true, [], undefined, 10, 10);
  expect(presentation.labels.every(label => !label.visible)).toBe(true);
  presentation.dispose();
  expect(host.childElementCount).toBe(0);
});

it('shares tissue positions, leader lines, depth visibility and public captions without allocating new nodes', () => {
  const host = document.createElement('div'),
    camera = view();
  const presentation = createAnatomyLabelPresentation(host, camera);
  const labels: AnatomyLabel[] = [
    { name: 'Crown', color: '#eeeeee', side: 'left', position: new Vector3(0, 3, 0) },
    { name: 'Root', color: '#dddddd', side: 'left', position: new Vector3(0, -2, 0) },
    {
      name: 'Periodontal ligament',
      color: '#ffee00',
      side: 'right',
      position: new Vector3(2, -2, 0),
    },
  ];
  const slots = [...presentation.labels],
    nodes = [...host.querySelectorAll<HTMLElement>('.anatomy-label')];
  const lines = [...host.querySelectorAll<SVGLineElement>('line')];
  presentation.render(true, labels, true, 1000, 700);
  expect(presentation.caption).toContain('PDL enlarged for visibility');
  expect(presentation.caption).toContain('support tissues stay fixed');
  expect(host.querySelector('.anatomy-caption')!.textContent).toBe(presentation.caption);
  for (const [i, label] of presentation.labels.entries()) {
    expect(nodes[i].hidden).toBe(!label.visible);
    if (!label.visible) continue;
    expect(parseFloat(nodes[i].style.left)).toBe(label.x);
    expect(parseFloat(nodes[i].style.top)).toBe(label.y);
    expect(parseFloat(nodes[i].style.width)).toBe(label.width);
    expect(Number(lines[i].getAttribute('x1'))).toBe(
      label.side === 'left' ? label.x + label.width : label.x,
    );
    expect(Number(lines[i].getAttribute('y1'))).toBe(label.y + 14);
    expect(Number(lines[i].getAttribute('x2'))).toBe(label.anchorX);
    expect(Number(lines[i].getAttribute('y2'))).toBe(label.anchorY);
  }
  labels[0].position.set(0, 0, 100);
  presentation.render(true, labels, false, 480, 430);
  expect(presentation.labels[0].visible).toBe(false);
  expect(nodes[0].hidden).toBe(true);
  expect(presentation.caption).not.toContain('PDL enlarged');
  expect(presentation.labels.every((label, i) => label === slots[i])).toBe(true);
  expect([...host.querySelectorAll('.anatomy-label')]).toEqual(nodes);
  presentation.render(false, labels, true, 480, 430);
  expect(presentation.caption).toBeNull();
  expect(presentation.labels.every(label => !label.visible)).toBe(true);
  expect(host.querySelector<HTMLElement>('.anatomy-overlay')!.hidden).toBe(true);
  presentation.dispose();
  expect(host.childElementCount).toBe(0);
});
