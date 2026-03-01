import * as THREE from 'three';

export function createGrassGeometry() {
  const width = 0.08;
  const height = 1.0;
  const segments = 4;

  const geometry = new THREE.PlaneGeometry(width, height, 1, segments);
  geometry.translate(0, height / 2, 0);

  const positions = geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const taper = 1.0 - Math.pow(y / height, 1.2); 
    positions[i] = x * taper;
    const bend = Math.pow(y / height, 2) * 0.15;
    positions[i + 2] -= bend;
  }
  
  geometry.computeVertexNormals();
  return geometry;
}

const GrassBlade = () => {
  return null; // This is a utility file for geometry, but we can export a component if needed
};

export default GrassBlade;
