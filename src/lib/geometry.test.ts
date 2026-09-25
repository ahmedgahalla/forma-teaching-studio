import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { exportSTL, importSTLs, loadCase, saveCase, type DentalCase } from './geometry';
import { resolveMovement, type Vec3 } from './model';
import { historyReducer, stageTransforms, type CaseSession } from './planning';
import { createAttachmentGeometry, type AttachmentSpec } from './attachments';

const triangle: Vec3[] = [
  [10, 20, 30],
  [14, 20, 30],
  [10, 26, 32],
];

function asciiFile(name: string, vertices: Vec3[] = triangle): File {
  const contents = `solid tooth\nfacet normal 0 0 1\nouter loop\n${vertices.map(v => `vertex ${v.join(' ')}`).join('\n')}\nendloop\nendfacet\nendsolid tooth`;
  return new File([contents], name, { type: 'model/stl' });
}

function binaryBuffer(vertices: Vec3[] = triangle): ArrayBuffer {
  const buffer = new ArrayBuffer(134);
  const view = new DataView(buffer);
  view.setUint32(80, 1, true);
  vertices.flat().forEach((value, index) => view.setFloat32(96 + index * 4, value, true));
  return buffer;
}

function binaryFile(name: string, vertices: Vec3[] = triangle): File {
  return new File([binaryBuffer(vertices)], name, { type: 'model/stl' });
}

function verticesOf(geometry: THREE.BufferGeometry, position: Vec3 = [0, 0, 0]): number[][] {
  const attribute = geometry.getAttribute('position');
  return Array.from({ length: attribute.count }, (_, i) => [
    attribute.getX(i) + position[0],
    attribute.getY(i) + position[1],
    attribute.getZ(i) + position[2],
  ]);
}

function triangleVerticesOf(
  geometry: THREE.BufferGeometry,
  position: Vec3 = [0, 0, 0],
): number[][] {
  const vertices = verticesOf(geometry, position);
  return geometry.index ? Array.from(geometry.index.array, index => vertices[index]) : vertices;
}

function expectVertices(actual: number[][], expected: number[][]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((vertex, i) =>
    vertex.forEach((value, axis) => expect(value).toBeCloseTo(expected[i][axis], 5)),
  );
}

function mesh(vertices: Vec3[]): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices.flat(), 3),
  );
}

function sampleCase(): DentalCase {
  return {
    name: 'Registration study',
    demo: false,
    teeth: [
      {
        id: '11',
        name: 'Central incisor',
        position: [10, 20, 30],
        buccal: [0, 0, 1],
        mesial: [-1, 0, 0],
        calibrated: false,
        geometry: mesh([
          [-1, -2, 0],
          [1, -2, 0],
          [-1, 2, 0],
        ]),
      },
    ],
    gums: [
      {
        id: 'upper_gum.stl',
        position: [-5, 4, 3],
        geometry: mesh([
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ]),
      },
    ],
  };
}

function serializedCase() {
  const model = sampleCase();
  const encode = (part: DentalCase['teeth'][number] | DentalCase['gums'][number]) => {
    const { geometry, ...metadata } = part;
    const vertices = Array.from(geometry.getAttribute('position').array);
    geometry.dispose();
    return { ...metadata, vertices };
  };
  return {
    version: 1,
    units: 'mm',
    model: { ...model, teeth: model.teeth.map(encode), gums: model.gums.map(encode) },
    transforms: { '11': { translation: [1, 2, 3], rotation: [0, 5, 0] } },
  };
}

function caseFile(data: unknown): File {
  return new File([JSON.stringify(data)], 'case.json', { type: 'application/json' });
}

function captureDownloads() {
  vi.useFakeTimers();
  const blobs: Blob[] = [];
  const anchor = { href: '', download: '', click: vi.fn() };
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
    blobs.push(blob as Blob);
    return 'blob:test-download';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
  return { blobs, anchor };
}

function fullSession(): CaseSession {
  return {
    stages: 6,
    checkpoints: [
      {
        id: 'alignment',
        name: 'Initial alignment',
        transforms: { '11': { translation: [0.5, 0, 1], rotation: [0, 4, 0] } },
      },
      {
        id: 'detailing',
        name: 'Detailing',
        transforms: { '11': { translation: [1, 0.5, 2], rotation: [1, 8, 0] } },
      },
    ],
    past: [
      { value: {}, label: 'Initial movement' },
      {
        value: { '11': { translation: [0.5, 0, 1], rotation: [0, 4, 0] } },
        label: 'Detailing movement',
      },
    ],
    future: [
      {
        value: { '11': { translation: [2, 1, 3], rotation: [2, 15, 0] } },
        label: 'Next adjustment',
      },
    ],
    braces: true,
    roots: true,
    bracketStyle: 'ceramic',
    ligatureColor: '#D758A9',
  };
}

function versionTwoCase() {
  const legacy = serializedCase();
  return {
    ...legacy,
    version: 2,
    session: fullSession(),
    model: {
      ...legacy.model,
      teeth: legacy.model.teeth.map(t => ({
        ...t,
        calibrated: true,
        occlusal: [0, -1, 0],
        bracketPosition: [0, 0.5, 2],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        root: { vertices: [-1, 2, 0, 1, 2, 0, 0, 12, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1] },
      })),
      gums: legacy.model.gums.map(g => ({ ...g, arch: 'upper' })),
    },
  };
}

function disposeCase(model: DentalCase) {
  model.teeth.forEach(tooth => {
    tooth.geometry.dispose();
    tooth.rootGeometry?.dispose();
  });
  model.gums.forEach(gum => gum.geometry.dispose());
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('STL import geometry and registration', () => {
  it.each([asciiFile, binaryFile])(
    'imports a real STL triangle without changing its world coordinates',
    async makeFile => {
      const result = await importSTLs([makeFile('11.stl')], 1);
      const tooth = result.teeth[0];
      expect(tooth.position).toEqual([12, 23, 31]);
      expectVertices(verticesOf(tooth.geometry, tooth.position), triangle);
      tooth.geometry.computeBoundingBox();
      expect(tooth.geometry.boundingBox!.getCenter(new THREE.Vector3()).length()).toBeCloseTo(0);
      expect(result.demo).toBe(false);
    },
  );

  it('preserves relative positions across tooth and gum files and applies one shared unit conversion', async () => {
    const shifted = triangle.map(v => [v[0] + 20, v[1], v[2]] as Vec3);
    const result = await importSTLs(
      [binaryFile('21.stl', shifted), asciiFile('11.stl'), asciiFile('upper_gum.stl')],
      10,
    );
    expect(result.teeth.map(t => t.id)).toEqual(['11', '21']);
    expect(result.teeth[1].position[0] - result.teeth[0].position[0]).toBeCloseTo(200);
    expectVertices(
      verticesOf(result.teeth[0].geometry, result.teeth[0].position),
      triangle.map(v => v.map(n => n * 10)),
    );
    expectVertices(
      verticesOf(result.teeth[1].geometry, result.teeth[1].position),
      shifted.map(v => v.map(n => n * 10)),
    );
    expectVertices(
      verticesOf(result.gums[0].geometry, result.gums[0].position),
      triangle.map(v => v.map(n => n * 10)),
    );
  });

  it('does not invent an anatomical calibration for imported teeth', async () => {
    const result = await importSTLs([asciiFile('11.stl'), binaryFile('12.stl')], 1);
    for (const tooth of result.teeth) {
      expect(tooth.calibrated).toBe(false);
      expect(() => resolveMovement(tooth, 'buccal', 1)).toThrow(/calibrated/);
      expect(resolveMovement(tooth, 'x', 1)).toEqual([1, 0, 0]);
    }
  });

  it('rejects duplicate tooth identities even when filenames differ', async () => {
    await expect(importSTLs([asciiFile('11.stl'), binaryFile('tooth_11.stl')], 1)).rejects.toThrow(
      /Duplicate/,
    );
  });

  it.each(['scan.stl', '99.stl', '111.stl', '11.obj'])(
    'rejects unrecognized tooth filenames: %s',
    async name => {
      await expect(importSTLs([asciiFile(name)], 1)).rejects.toThrow();
    },
  );

  it('requires a numbered tooth and supported units', async () => {
    await expect(importSTLs([], 1)).rejects.toThrow();
    await expect(importSTLs([asciiFile('upper_gum.stl')], 1)).rejects.toThrow(/tooth/);
    await expect(importSTLs([asciiFile('11.stl')], 3)).rejects.toThrow(/unit/);
  });

  it('rejects empty, truncated, nonfinite, and zero-sized STL data', async () => {
    const truncated = binaryBuffer().slice(0, 100);
    const nonfinite: Vec3[] = [
      [NaN, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ];
    for (const file of [
      new File([new ArrayBuffer(0)], '11.stl'),
      new File([truncated], '11.stl'),
      binaryFile('11.stl', nonfinite),
      asciiFile('11.stl', [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ]),
    ]) {
      await expect(importSTLs([file], 1)).rejects.toThrow();
    }
  });

  it('rejects finite source vertices that overflow after converting units', async () => {
    const vertices: Vec3[] = [
      [3e38, 0, 0],
      [3e38, 1, 0],
      [3e38, 0, 1],
    ];
    await expect(importSTLs([binaryFile('11.stl', vertices)], 1000)).rejects.toThrow();
  });
});

describe('case-file validation and round trips', () => {
  it('loads fabricated case data with mesh coordinates, gum placement, and movement preserved', async () => {
    const serialized = serializedCase();
    const result = await loadCase(caseFile(serialized));
    expect(result.model.name).toBe('Registration study');
    expect(result.model.demo).toBe(false);
    expect(result.model.teeth[0].calibrated).toBe(false);
    expect(result.model.teeth[0].position).toEqual([10, 20, 30]);
    expect(verticesOf(result.model.teeth[0].geometry)).toEqual([
      [-1, -2, 0],
      [1, -2, 0],
      [-1, 2, 0],
    ]);
    expect(verticesOf(result.model.gums[0].geometry, result.model.gums[0].position)).toEqual([
      [-5, 4, 3],
      [-4, 4, 3],
      [-5, 5, 3],
    ]);
    expect(result.transforms).toEqual(serialized.transforms);
  });

  it('saves and reloads both indexed mesh geometry and poses', async () => {
    const model = sampleCase();
    model.teeth[0].geometry.setIndex([2, 1, 0]);
    const transforms = { '11': { translation: [1, 2, 3] as Vec3, rotation: [0, 0, 12] as Vec3 } };
    const { blobs, anchor } = captureDownloads();
    saveCase(model, transforms);
    expect(anchor.download).toBe('forma-case.json');
    expect(anchor.click).toHaveBeenCalledOnce();
    const result = await loadCase(new File([blobs[0]], 'saved.json'));
    expect(result.transforms).toEqual(transforms);
    expect(result.model.teeth[0].position).toEqual(model.teeth[0].position);
    expect(triangleVerticesOf(result.model.teeth[0].geometry)).toEqual([
      [-1, 2, 0],
      [1, -2, 0],
      [-1, -2, 0],
    ]);
    expect(Array.from(result.model.teeth[0].geometry.index!.array)).toEqual([2, 1, 0]);
    expect(verticesOf(result.model.gums[0].geometry)).toEqual(verticesOf(model.gums[0].geometry));
    expect(model.teeth[0].geometry.index?.array).toEqual(new Uint16Array([2, 1, 0]));
  });

  it.each([
    ['unsupported version', { version: 99 }],
    ['unsupported units', { units: 'cm' }],
    ['array transforms', { transforms: [] }],
    [
      'unavailable transform tooth',
      { transforms: { '12': { translation: [0, 0, 0], rotation: [0, 0, 0] } } },
    ],
    ['malformed pose', { transforms: { '11': { translation: [0, 0], rotation: [0, 0, 0] } } }],
    [
      'nonfinite pose',
      { transforms: { '11': { translation: [Infinity, 0, 0], rotation: [0, 0, 0] } } },
    ],
  ])('rejects invalid saved-case metadata: %s', async (_label, override) => {
    await expect(loadCase(caseFile({ ...serializedCase(), ...override }))).rejects.toThrow();
  });

  it('rejects duplicate tooth IDs and malformed mesh buffers in saved cases', async () => {
    const duplicated = serializedCase();
    duplicated.model.teeth.push({ ...duplicated.model.teeth[0] });
    await expect(loadCase(caseFile(duplicated))).rejects.toThrow(/metadata/);
    for (const vertices of [
      [0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 1, NaN],
    ]) {
      const malformed = serializedCase();
      malformed.model.teeth[0].vertices = vertices;
      await expect(loadCase(caseFile(malformed))).rejects.toThrow(/mesh/);
    }
  });
});

describe('final STL export', () => {
  it("bakes a tooth's translation and centroid rotation and includes unchanged gums", async () => {
    const model = sampleCase();
    const original = verticesOf(model.teeth[0].geometry);
    const { blobs, anchor } = captureDownloads();
    exportSTL(model, { '11': { translation: [2, -1, 3], rotation: [0, 0, 90] } });
    expect(anchor.download).toBe('forma-final-arch.stl');
    expect(blobs[0].type).toBe('model/stl');
    const result = new STLLoader().parse(await blobs[0].arrayBuffer());
    expectVertices(verticesOf(result), [
      [14, 18, 33],
      [14, 20, 33],
      [10, 18, 33],
      [-5, 4, 3],
      [-4, 4, 3],
      [-5, 5, 3],
    ]);
    expect(verticesOf(model.teeth[0].geometry)).toEqual(original);
    expect(model.teeth[0].position).toEqual([10, 20, 30]);
  });
});

describe('version 2 geometry and planning persistence', () => {
  it('round-trips indexed crowns, roots and authored smooth normals without changing local registration', async () => {
    const model = sampleCase(),
      tooth = model.teeth[0];
    tooth.calibrated = true;
    tooth.occlusal = [0, -1, 0];
    tooth.bracketPosition = [0.2, -0.4, 2.3];
    tooth.geometry.setIndex([2, 0, 1]);
    tooth.geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute([0, 0.6, 0.8, 0.6, 0, 0.8, 0.8, 0.6, 0], 3),
    );
    tooth.rootGeometry = mesh([
      [-1, 2, 0],
      [1, 2, 0],
      [0, 12, 0],
    ]).setIndex([1, 0, 2]);
    tooth.rootGeometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute([0, 1, 0, 1, 0, 0, 0, 0, 1], 3),
    );
    model.gums[0].arch = 'upper';
    model.gums.push({
      id: 'lower_gum',
      position: [5, -6, 3],
      arch: 'lower',
      geometry: mesh([
        [0, 0, 0],
        [2, 0, 0],
        [0, 2, 0],
      ]),
    });
    const { blobs } = captureDownloads();
    saveCase(model, { '11': { translation: [1, 0.5, 2], rotation: [1, 8, 0] } }, fullSession());
    const encoded = JSON.parse(await blobs[0].text());
    expect(encoded.version).toBe(2);
    expect(encoded.model.teeth[0].geometry).toBeUndefined();
    expect(encoded.model.teeth[0].rootGeometry).toBeUndefined();
    expect(encoded.model.teeth[0].root.vertices).toEqual([-1, 2, 0, 1, 2, 0, 0, 12, 0]);
    expect(encoded.model.teeth[0].root.indices).toEqual([1, 0, 2]);
    const loaded = await loadCase(new File([blobs[0]], 'roundtrip.json')),
      restored = loaded.model.teeth[0];
    expect(restored.position).toEqual(tooth.position);
    expect(restored.occlusal).toEqual([0, -1, 0]);
    expect(restored.bracketPosition).toEqual(tooth.bracketPosition);
    expect(restored.calibrated).toBe(true);
    expectVertices(triangleVerticesOf(restored.geometry, restored.position), [
      [9, 22, 30],
      [9, 18, 30],
      [11, 18, 30],
    ]);
    expectVertices(triangleVerticesOf(restored.rootGeometry!, restored.position), [
      [11, 22, 30],
      [9, 22, 30],
      [10, 32, 30],
    ]);
    const crownNormals = restored.geometry.getAttribute('normal');
    expectVertices(
      Array.from({ length: crownNormals.count }, (_, i) => [
        crownNormals.getX(i),
        crownNormals.getY(i),
        crownNormals.getZ(i),
      ]),
      [
        [0, 0.6, 0.8],
        [0.6, 0, 0.8],
        [0.8, 0.6, 0],
      ],
    );
    expect(Array.from(restored.rootGeometry!.getAttribute('normal').array)).toEqual([
      0, 1, 0, 1, 0, 0, 0, 0, 1,
    ]);
    expect(loaded.model.gums.map(g => [g.arch, g.position])).toEqual([
      ['upper', [-5, 4, 3]],
      ['lower', [5, -6, 3]],
    ]);
    expect(tooth.geometry.index!.array).toEqual(new Uint16Array([2, 0, 1]));
    expect(tooth.rootGeometry!.index!.array).toEqual(new Uint16Array([1, 0, 2]));
    disposeCase(model);
    disposeCase(loaded.model);
  });

  it('restores session display choices, checkpoint paths and working undo/redo history', async () => {
    const data = versionTwoCase(),
      loaded = await loadCase(caseFile(data));
    expect(loaded.session).toEqual(data.session);
    const { session } = loaded;
    const restored = historyReducer(
      { current: {}, past: [], future: [] },
      { type: 'load', value: loaded.transforms, past: session!.past, future: session!.future },
    );
    const undone = historyReducer(restored, { type: 'undo' });
    expect(undone.current).toEqual(session!.past.at(-1)!.value);
    expect(historyReducer(undone, { type: 'redo' })).toEqual(restored);
    expect(historyReducer(restored, { type: 'redo' }).current).toEqual(
      session!.future.at(-1)!.value,
    );
    expect(stageTransforms(loaded.transforms, session!.checkpoints, 2, session!.stages)).toEqual(
      session!.checkpoints[0].transforms,
    );
    expect(stageTransforms(loaded.transforms, session!.checkpoints, 4, session!.stages)).toEqual(
      session!.checkpoints[1].transforms,
    );
    const { blobs } = captureDownloads();
    saveCase(loaded.model, loaded.transforms, session);
    const second = await loadCase(new File([blobs[0]], 'session-resaved.json'));
    expect(second.session).toEqual(session);
    expect(second.transforms).toEqual(loaded.transforms);
    disposeCase(loaded.model);
    disposeCase(second.model);
  });

  it('retains version 1 extrusion semantics and rebuilds omitted normals without inventing roots or session data', async () => {
    const data = serializedCase();
    Object.assign(data.model.teeth[0], { calibrated: true });
    const legacy = await loadCase(caseFile(data)),
      tooth = legacy.model.teeth[0];
    expect(legacy.session).toBeUndefined();
    expect(tooth.occlusal).toBeUndefined();
    expect(tooth.bracketPosition).toBeUndefined();
    expect(tooth.rootGeometry).toBeUndefined();
    expect(tooth.attachment).toBeUndefined();
    expect(resolveMovement(tooth, 'extrude', 1)).toEqual([0, 1, 0]);
    expect(Array.from(tooth.geometry.getAttribute('normal').array)).toEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
    const { blobs } = captureDownloads();
    saveCase(legacy.model, legacy.transforms);
    const upgraded = await loadCase(new File([blobs[0]], 'legacy-upgraded.json'));
    expect(resolveMovement(upgraded.model.teeth[0], 'extrude', 1)).toEqual([0, 1, 0]);
    expect(upgraded.session).toBeUndefined();
    disposeCase(legacy.model);
    disposeCase(upgraded.model);
  });

  it.each([
    ['stages', 1],
    ['stages', 10.5],
    ['braces', 'true'],
    ['roots', null],
    ['bracketStyle', 'plastic'],
    ['ligatureColor', 'red'],
    [
      'checkpoints',
      [
        {
          id: 'a',
          name: 'First',
          transforms: { '31': { translation: [0, 0, 1], rotation: [0, 0, 0] } },
        },
      ],
    ],
    [
      'checkpoints',
      [
        { id: 'a', name: 'First', transforms: {} },
        { id: 'a', name: 'Duplicate', transforms: {} },
      ],
    ],
    [
      'past',
      [{ label: 'Bad prior pose', value: { '11': { translation: [0, 0], rotation: [0, 0, 0] } } }],
    ],
    [
      'future',
      [
        {
          label: 'Unavailable tooth',
          value: { '41': { translation: [0, 0, 0], rotation: [0, 0, 0] } },
        },
      ],
    ],
    [
      'past',
      [
        {
          label: 'Excessive pose',
          value: { '11': { translation: [100001, 0, 0], rotation: [0, 0, 0] } },
        },
      ],
    ],
  ])(
    'rejects invalid persisted session field %s before allocating geometry',
    async (field, value) => {
      const data = versionTwoCase();
      Object.assign(data.session, { [field as string]: value });
      const allocation = vi.spyOn(THREE.BufferGeometry.prototype, 'setAttribute');
      allocation.mockClear();
      await expect(loadCase(caseFile(data))).rejects.toThrow(/session|checkpoint/i);
      expect(allocation).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['normals', [0, 0, 1]],
    ['normals', [0, 0, 3, 0, 0, 1, 0, 0, 1]],
    ['bracketPosition', [0, 0]],
    ['bracketPosition', [0, Infinity, 0]],
    ['occlusal', [0, 0, 0]],
    ['occlusal', [0, -1, 1]],
    ['root', { vertices: [0, 0, 0] }],
    ['root', { vertices: [-1, 2, 0, 1, 2, 0, 0, 12, null] }],
    ['root', { vertices: [-1, 2, 0, 1, 2, 0, 0, 12, 0], normals: [0, 0, 1] }],
  ])('rejects malformed new tooth metadata: %s', async (field, value) => {
    const data = versionTwoCase();
    Object.assign(data.model.teeth[0], { [field as string]: value });
    await expect(loadCase(caseFile(data))).rejects.toThrow();
  });

  it.each([null, {}, [], 42, undefined].map(name => ({ name })))(
    'rejects non-text case and tooth names before React can receive them: $name',
    async ({ name }) => {
      const invalidCase = versionTwoCase();
      Object.assign(invalidCase.model, { name });
      await expect(loadCase(caseFile(invalidCase))).rejects.toThrow(/name|metadata/i);
      const invalidTooth = versionTwoCase();
      Object.assign(invalidTooth.model.teeth[0], { name });
      await expect(loadCase(caseFile(invalidTooth))).rejects.toThrow(/name|metadata/i);
    },
  );

  it('validates optional gum names while allowing existing unnamed gum records', async () => {
    const invalid = versionTwoCase();
    Object.assign(invalid.model.gums[0], { name: { label: 'Gingiva' } });
    await expect(loadCase(caseFile(invalid))).rejects.toThrow(/name|metadata/i);
    const valid = await loadCase(caseFile(versionTwoCase()));
    expect(valid.model.gums[0].id).toBe('upper_gum.stl');
    disposeCase(valid.model);
  });

  it('preserves shared vertices, triangle indices and normals on indexed crowns, roots and gums', async () => {
    const source = sampleCase();
    const quad = () =>
      mesh([
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ]).setIndex([0, 1, 2, 0, 2, 3]);
    source.teeth[0].geometry.dispose();
    source.teeth[0].geometry = quad();
    source.teeth[0].rootGeometry = quad();
    source.gums[0].geometry.dispose();
    source.gums[0].geometry = quad();
    for (const g of [
      source.teeth[0].geometry,
      source.teeth[0].rootGeometry,
      source.gums[0].geometry,
    ])
      g.computeVertexNormals();
    const { blobs } = captureDownloads();
    saveCase(source, {});
    const encoded = JSON.parse(await blobs[0].text());
    const restored = await loadCase(new File([blobs[0]], 'indexed.json'));
    for (const stored of [
      encoded.model.teeth[0],
      encoded.model.teeth[0].root,
      encoded.model.gums[0],
    ]) {
      expect(stored.vertices).toHaveLength(12);
      expect(stored.indices).toEqual([0, 1, 2, 0, 2, 3]);
    }
    for (const g of [
      restored.model.teeth[0].geometry,
      restored.model.teeth[0].rootGeometry!,
      restored.model.gums[0].geometry,
    ]) {
      expect(g.getAttribute('position').count).toBe(4);
      expect(g.getAttribute('normal').count).toBe(4);
      expect(Array.from(g.index!.array)).toEqual([0, 1, 2, 0, 2, 3]);
      expect(triangleVerticesOf(g)).toEqual([
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ]);
    }
    disposeCase(source);
    disposeCase(restored.model);
  });

  it('computes normals using restored indexed topology when no normals were saved', async () => {
    const data = versionTwoCase();
    Object.assign(data.model.teeth[0], {
      vertices: [0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0],
      indices: [0, 1, 2, 0, 2, 3],
      normals: [],
    });
    const restored = await loadCase(caseFile(data));
    expect(Array.from(restored.model.teeth[0].geometry.getAttribute('normal').array)).toEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
    disposeCase(restored.model);
  });

  it.each(
    [
      null,
      '0,1,2',
      [],
      [0, 1],
      [0, 1, 3],
      [0, -1, 2],
      [0, 1.5, 2],
      [0, '1', 2],
      [0, Infinity, 2],
    ].map(indices => ({ indices })),
  )('rejects malformed crown/root/gum indices: $indices', async ({ indices }) => {
    for (const target of ['crown', 'root', 'gum']) {
      const data = versionTwoCase();
      Object.assign(
        target === 'root'
          ? data.model.teeth[0].root
          : target === 'gum'
            ? data.model.gums[0]
            : data.model.teeth[0],
        { indices },
      );
      await expect(loadCase(caseFile(data))).rejects.toThrow(/mesh/i);
    }
  });

  it('rejects incomplete coordinate triples even when triangle indices exist', async () => {
    const data = versionTwoCase();
    Object.assign(data.model.teeth[0], {
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0, 8],
      indices: [0, 1, 2],
      normals: [],
    });
    await expect(loadCase(caseFile(data))).rejects.toThrow(/mesh/i);
  });

  it('retains empty string names through save/load consistently', async () => {
    const source = sampleCase();
    source.name = '';
    source.teeth[0].name = '';
    const { blobs } = captureDownloads();
    saveCase(source, {});
    const restored = await loadCase(new File([blobs[0]], 'unnamed.json'));
    expect(restored.model.name).toBe('');
    expect(restored.model.teeth[0].name).toBe('');
    disposeCase(source);
    disposeCase(restored.model);
  });

  it.each(['mandible', 'UPPER', null, {}, 1].map(arch => ({ arch })))(
    'rejects an unsupported gum arch: $arch',
    async ({ arch }) => {
      const data = versionTwoCase();
      Object.assign(data.model.gums[0], { arch });
      await expect(loadCase(caseFile(data))).rejects.toThrow(/gum arch/i);
    },
  );

  it('limits STL imports to the four gums that saved cases can restore', async () => {
    const files = [
      asciiFile('11.stl'),
      ...Array.from({ length: 4 }, (_, i) => asciiFile(`upper_gum_${i}.stl`)),
    ];
    await expect(importSTLs([...files, asciiFile('lower_gum_extra.stl')], 1)).rejects.toThrow(
      /4 gum/,
    );
    const imported = await importSTLs(files, 1);
    expect(imported.gums).toHaveLength(4);
    const { blobs } = captureDownloads();
    saveCase(imported, {});
    const restored = await loadCase(new File([blobs[0]], 'four-gums.json'));
    expect(restored.model.gums).toHaveLength(4);
    disposeCase(imported);
    disposeCase(restored.model);
  });

  it('refuses a serialized case exceeding the loader limit before offering an unreadable download', () => {
    const source = sampleCase(),
      { anchor, blobs } = captureDownloads();
    vi.spyOn(Blob.prototype, 'size', 'get').mockReturnValue(100 * 1024 * 1024 + 1);
    expect(() => saveCase(source, {})).toThrow(/exceeds 100 MB/i);
    expect(anchor.click).not.toHaveBeenCalled();
    expect(blobs).toHaveLength(0);
    disposeCase(source);
  });

  it('persists attachment specifications and reconstructs the same crown-local geometry after reload', async () => {
    const source = sampleCase(),
      target = source.teeth[0];
    target.geometry.dispose();
    target.geometry = new THREE.BoxGeometry(6, 10, 4);
    target.calibrated = true;
    target.occlusal = [0, -1, 0];
    target.attachment = {
      shape: 'beveled',
      width: 3,
      height: 2,
      depth: 0.7,
      offsetMesial: 0.4,
      offsetOcclusal: -0.3,
      rotation: 17,
    };
    const before = createAttachmentGeometry(target, target.attachment);
    const { blobs } = captureDownloads();
    saveCase(source, {});
    const saved = JSON.parse(await blobs[0].text());
    expect(saved.model.teeth[0].attachment).toEqual(target.attachment);
    const loaded = await loadCase(new File([blobs[0]], 'attachments.json'));
    expect(loaded.model.teeth[0].attachment).toEqual(target.attachment);
    const after = createAttachmentGeometry(
      loaded.model.teeth[0],
      loaded.model.teeth[0].attachment!,
    );
    expectVertices(
      triangleVerticesOf(after, loaded.model.teeth[0].position),
      triangleVerticesOf(before, target.position),
    );
    before.dispose();
    after.dispose();
    disposeCase(source);
    disposeCase(loaded.model);
  });

  it.each(
    [
      null,
      {},
      { shape: 'force' },
      { width: 0 },
      { depth: Infinity },
      { offsetMesial: 5.1 },
      { rotation: 181 },
    ].map(override => ({ override })),
  )('rejects malformed saved attachment settings: $override', async ({ override }) => {
    const spec: AttachmentSpec = {
      shape: 'rectangle',
      width: 3,
      height: 2,
      depth: 1,
      offsetMesial: 0,
      offsetOcclusal: 0,
      rotation: 0,
    };
    const data = versionTwoCase();
    const attachment =
      override === null || Object.keys(override).length === 0 ? override : { ...spec, ...override };
    Object.assign(data.model.teeth[0], { attachment });
    await expect(loadCase(caseFile(data))).rejects.toThrow(/attachment/i);
  });

  it('rejects attachment metadata on uncalibrated teeth', async () => {
    const data = versionTwoCase();
    Object.assign(data.model.teeth[0], {
      calibrated: false,
      attachment: {
        shape: 'rectangle',
        width: 3,
        height: 2,
        depth: 1,
        offsetMesial: 0,
        offsetOcclusal: 0,
        rotation: 0,
      },
    });
    await expect(loadCase(caseFile(data))).rejects.toThrow(/attachment requires a calibrated/i);
  });
});
