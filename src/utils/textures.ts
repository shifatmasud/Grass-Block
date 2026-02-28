import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// Simple seeded random function
function seededRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function createWindNoiseTexture(size = 256) {
  const noise2D = createNoise2D(seededRandom(123));
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = i / size;
      const y = j / size;
      const n = (noise2D(x * 5, y * 5) + 1) / 2; // 0 to 1
      const n2 = (noise2D(x * 10 + 100, y * 10 + 100) + 1) / 2;
      
      const idx = (i * size + j) * 4;
      data[idx] = n * 255;     // R: Primary wind
      data[idx + 1] = n2 * 255; // G: Secondary gust
      data[idx + 2] = 0;        // B
      data[idx + 3] = 255;      // A
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createBlueNoiseTexture(size = 64) {
  const rng = seededRandom(456);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i++) {
    data[i] = rng() * 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createDensityTexture(size = 512) {
  const noise2D = createNoise2D(seededRandom(789));
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const x = i / size;
      const y = j / size;
      
      // Create some clearings and clusters
      let n = noise2D(x * 3, y * 3);
      n += noise2D(x * 8, y * 8) * 0.5;
      n = Math.max(0, n);
      
      // Edge fade
      const distToEdge = Math.min(x, 1 - x, y, 1 - y);
      const edgeFade = Math.max(0, Math.min(1, distToEdge / 0.1));
      n *= edgeFade;

      const idx = (i * size + j) * 4;
      // R channel stores density for the grass shader
      data[idx] = n * 255;
      // G and B can store some color variation for the terrain
      data[idx + 1] = (0.2 + n * 0.3) * 255; // Greenish
      data[idx + 2] = (0.1 + n * 0.1) * 255; // Brownish
      data[idx + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
