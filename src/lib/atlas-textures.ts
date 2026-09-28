import * as THREE from 'three';

function randomSequence(seed: number) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

function bumpTexture(data: Uint8ClampedArray, width: number, height: number) {
  const texture = new THREE.DataTexture(new Uint8Array(data.buffer), width, height);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** The atlas's seeded enamel bands: UV y=0 is the cervical junction. */
export function makePerikymataTexture(width = 256, height = 1024, bands = 70, seed = 3) {
  const random = randomSequence(seed),
    phase0 = random() * 6.283,
    phase1 = random() * 6.283,
    data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = y / height;
      const wobble =
        0.004 * Math.sin((x / width) * 12.566 + phase0) +
        0.002 * Math.sin((x / width) * 31.4 + phase1);
      const frequency = bands * Math.pow(Math.max(0, v + wobble), 0.8);
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(frequency * 6.283), 3);
      const fade = Math.min(1, v / 0.08) * (1 - Math.pow(v, 3));
      const index = (y * width + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = 128 + 60 * ridge * fade;
      data[index + 3] = 255;
    }
  }
  return bumpTexture(data, width, height);
}

/** Same seeded, periodically wrapped radial pits as the atlas, sampled at texel centres. */
export function makeStipplingTexture(size = 512, dots = 2600, seed = 7) {
  const random = randomSequence(seed),
    data = new Uint8ClampedArray(size * size * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = data[index + 1] = data[index + 2] = 128;
    data[index + 3] = 255;
  }
  for (let dot = 0; dot < dots; dot++) {
    const cx = random() * size,
      cy = random() * size,
      radius = 2 + random() * 4;
    for (let y = Math.floor(cy - radius); y < cy + radius; y++) {
      for (let x = Math.floor(cx - radius); x < cx + radius; x++) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (distance >= radius) continue;
        const index = ((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4;
        const value = data[index] * (1 - 0.55 * (1 - distance / radius));
        data[index] = data[index + 1] = data[index + 2] = value;
      }
    }
  }
  const texture = bumpTexture(data, size, size);
  texture.flipY = true;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
