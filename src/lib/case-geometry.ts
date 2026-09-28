import { BufferGeometry, Float32BufferAttribute } from 'three';

type SurfaceAttributes = { color?: number[]; dentalData?: number[]; uv?: number[] };
export type SerializedGeometry = {
  vertices: number[];
  normals?: number[];
  indices?: number[];
  attributes?: SurfaceAttributes;
};
const SIZES = { color: 3, dentalData: 4, uv: 2 } as const;
export function hasAtlasSurfaceData(value: SerializedGeometry): boolean {
  return !!(value.attributes?.color && value.attributes.dentalData && value.attributes.uv);
}

/** Attribute getters decode the atlas's normalized integer channels before writing JSON. */
export function serialGeometry(geometry: BufferGeometry): SerializedGeometry {
  const attributes: SurfaceAttributes = {};
  for (const name of Object.keys(SIZES) as (keyof SurfaceAttributes)[]) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    attributes[name] = Array.from({ length: attribute.count * SIZES[name] }, (_, i) =>
      attribute.getComponent(Math.floor(i / SIZES[name]), i % SIZES[name]),
    );
  }
  return {
    vertices: Array.from(geometry.getAttribute('position').array),
    normals: Array.from(geometry.getAttribute('normal')?.array || []),
    indices: geometry.index ? Array.from(geometry.index.array) : undefined,
    ...(Object.keys(attributes).length ? { attributes } : {}),
  };
}

export function validMesh(value: SerializedGeometry | undefined): boolean {
  if (
    !value ||
    !Array.isArray(value.vertices) ||
    value.vertices.length < 9 ||
    value.vertices.length % (value.indices === undefined ? 9 : 3) ||
    !value.vertices.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e5)
  )
    return false;
  const count = value.vertices.length / 3;
  if (
    value.indices !== undefined &&
    (!Array.isArray(value.indices) ||
      value.indices.length < 3 ||
      value.indices.length % 3 ||
      !value.indices.every(i => Number.isInteger(i) && i >= 0 && i < count))
  )
    return false;
  if (
    value.normals !== undefined &&
    (!Array.isArray(value.normals) ||
      (value.normals.length !== 0 && value.normals.length !== value.vertices.length) ||
      !value.normals.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 2))
  )
    return false;
  if (value.attributes !== undefined) {
    if (
      !value.attributes ||
      typeof value.attributes !== 'object' ||
      Array.isArray(value.attributes)
    )
      return false;
    for (const [name, values] of Object.entries(value.attributes)) {
      if (
        !(name in SIZES) ||
        !Array.isArray(values) ||
        values.length !== count * SIZES[name as keyof SurfaceAttributes] ||
        !values.every(
          n =>
            typeof n === 'number' &&
            Number.isFinite(n) &&
            (name === 'uv' ? Math.abs(n) < 1e5 : n >= 0 && n <= 1),
        )
      )
        return false;
    }
    if (value.attributes.dentalData && (!value.attributes.color || !value.attributes.uv))
      return false;
  }
  return true;
}

export function serializedMeshSize(value: SerializedGeometry): number {
  return (
    value.vertices.length +
    (value.normals?.length || 0) +
    (value.indices?.length || 0) +
    Object.values(value.attributes || {}).reduce((sum, values) => sum + values.length, 0)
  );
}

export function makeGeometry(value: SerializedGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(value.vertices, 3));
  if (value.indices) geometry.setIndex(value.indices);
  if (value.normals?.length)
    geometry.setAttribute('normal', new Float32BufferAttribute(value.normals, 3));
  else geometry.computeVertexNormals();
  for (const name of Object.keys(SIZES) as (keyof SurfaceAttributes)[]) {
    const values = value.attributes?.[name];
    if (values) geometry.setAttribute(name, new Float32BufferAttribute(values, SIZES[name]));
  }
  if (geometry.hasAttribute('dentalData'))
    geometry.setAttribute('color_1', geometry.getAttribute('dentalData'));
  return geometry;
}
