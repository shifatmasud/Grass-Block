import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createWindNoiseTexture, createBlueNoiseTexture, createDensityTexture } from '../../src/utils/textures';
import { createGrassGeometry } from './GrassBlade';

// --- SHADER CODE ---
const grassVertexShader = `
  uniform float uTime;
  uniform vec3 uWindDir;
  uniform float uWindSpeed;
  uniform float uWindStrength;
  uniform float uNoiseScale;
  uniform float uNoiseSpeed;
  uniform vec3 uSunPosition;
  uniform vec3 uCameraPosition;
  uniform sampler2D uWindNoise;
  uniform sampler2D uDensityMap;
  uniform sampler2D uBlueNoise;
  uniform float uGridSize;
  uniform float uWorldSize;

  attribute float aInstanceIndex;
  attribute vec3 aInstanceColor;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec3 vInstanceColor;
  varying float vDistance;
  varying float vVisibility;

  // Simple hash for variation
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    vUv = uv;
    vHeight = position.y;
    vInstanceColor = aInstanceColor;

    // Calculate grid position from instance index
    float x = mod(aInstanceIndex, uGridSize);
    float z = floor(aInstanceIndex / uGridSize);
    
    // Normalize to 0-1 range for texture sampling
    vec2 gridUV = vec2(x, z) / uGridSize;
    
    // Jitter position for organic feel
    float jitter = hash(aInstanceIndex) * 0.8 - 0.4;
    float jitter2 = hash(aInstanceIndex + 100.0) * 0.8 - 0.4;
    
    // Convert to grid-relative coordinates
    vec2 gridPos = (gridUV - 0.5) * uWorldSize;
    gridPos += vec2(jitter, jitter2) * (uWorldSize / uGridSize);
    
    // Sample density map (R channel)
    float density = texture2D(uDensityMap, gridUV).r;
    
    // Calculate world position of the blade base for distance checks
    vec4 baseWorldPos = modelMatrix * vec4(gridPos.x, 0.0, gridPos.y, 1.0);
    
    // Distance calculation (XZ plane only for consistent density)
    vec2 camXZ = uCameraPosition.xz;
    vec2 posXZ = baseWorldPos.xz;
    vDistance = length(posXZ - camXZ);
    
    float blueNoise = texture2D(uBlueNoise, gridUV * 10.0).r;
    
    // Distance-based thinning and removal
    float minFadeDist = 15.0;
    float maxFadeDist = 45.0;
    
    // Stochastic kill: randomly remove blades based on distance
    float keepProb = 1.0 - smoothstep(minFadeDist, maxFadeDist, vDistance);
    
    if (blueNoise > keepProb || density < 0.1) {
       gl_Position = vec4(0.0);
       return;
    }

    // Thinning: reduce height and width as distance increases
    // We make thinning more aggressive to maintain visual density without cost
    float thinning = mix(1.0, 0.1, smoothstep(minFadeDist, maxFadeDist, vDistance));
    vec3 localPos = position;
    localPos.x *= thinning;
    localPos.y *= thinning * (0.8 + hash(aInstanceIndex + 200.0) * 0.4);

    // Apply rotation
    float rotY = hash(aInstanceIndex + 300.0) * 3.14159 * 2.0;
    float s = sin(rotY);
    float c = cos(rotY);
    mat2 rot = mat2(c, -s, s, c);
    localPos.xz = rot * localPos.xz;

    // Final world position
    vec4 worldPos = modelMatrix * vec4(vec3(gridPos.x, 0.0, gridPos.y) + localPos, 1.0);
    vWorldPosition = worldPos.xyz;

    // Wind calculation from global noise texture
    vec2 windUV = worldPos.xz * 0.05 + uWindDir.xz * uTime * uWindSpeed * 0.1;
    vec4 windSample = texture2D(uWindNoise, windUV);
    float windNoise = (windSample.r + windSample.g * 0.5) - 0.5;

    float bendFactor = pow(vHeight, 1.5);
    vec3 windDisplacement = uWindDir * windNoise * uWindStrength * bendFactor;
    
    // Add some high-frequency sway
    float sway = sin(uTime * 3.0 + worldPos.x * 0.5 + worldPos.z * 0.5) * 0.05 * bendFactor;
    windDisplacement.x += sway;
    windDisplacement.z += sway;

    worldPos.xyz += windDisplacement;
    vNormal = normalize(vec3(0.0, 1.0, 0.0));

    gl_Position = projectionMatrix * viewMatrix * worldPos;
    vVisibility = keepProb;
  }
`;

const grassFragmentShader = `
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uSunPosition;
  uniform vec3 uTerrainColor;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying float vHeight;
  varying vec3 vInstanceColor;
  varying float vDistance;
  varying float vVisibility;

  void main() {
    vec3 baseColor = uBaseColor * vInstanceColor;
    vec3 color = mix(baseColor, uTipColor, vHeight);
    
    vec3 lightDir = normalize(uSunPosition);
    vec3 normal = normalize(vNormal);
    normal.y += 0.5;
    normal = normalize(normal);
    
    float diff = abs(dot(normal, lightDir)) * 0.7 + 0.3;
    float translucency = pow(max(dot(normal, -lightDir), 0.0), 2.0) * vHeight * 0.8;
    vec3 ambient = vec3(0.6);
    vec3 sss = vec3(0.1, 0.2, 0.0) * (1.0 - vHeight) * 0.4;
    
    vec3 finalColor = color * (diff * 1.5 + ambient + translucency) + sss;

    // Blend into terrain color at far distance
    float blendFactor = 1.0 - vVisibility;
    vec3 blendedColor = mix(finalColor, uTerrainColor, blendFactor * 0.8);

    gl_FragColor = vec4(blendedColor, 1.0);
    
    // Simple alpha test
    if (vVisibility < 0.01) discard;
  }
`;

// --- GRASS PATCH COMPONENT ---
interface GrassPatchProps {
  position: [number, number, number];
  size: number;
  density: number;
  baseColor: string;
  tipColor: string;
  windDir: [number, number, number];
  windSpeed: number;
  windStrength: number;
  noiseScale: number;
  noiseSpeed: number;
  sunPosition: [number, number, number];
}

const GrassPatch: React.FC<GrassPatchProps> = ({
  position,
  size,
  density,
  baseColor,
  tipColor,
  windDir,
  windSpeed,
  windStrength,
  noiseScale,
  noiseSpeed,
  sunPosition
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  // Textures
  const windNoiseTex = useMemo(() => createWindNoiseTexture(), []);
  const blueNoiseTex = useMemo(() => createBlueNoiseTexture(), []);
  const densityTex = useMemo(() => createDensityTexture(), []);

  const { geometry, instanceCount } = useMemo(() => {
    const baseGeo = createGrassGeometry();
    const geo = new THREE.InstancedBufferGeometry();
    
    // Copy attributes from base geometry
    geo.index = baseGeo.index;
    geo.attributes.position = baseGeo.attributes.position;
    geo.attributes.normal = baseGeo.attributes.normal;
    geo.attributes.uv = baseGeo.attributes.uv;
    
    // Total number of possible blades in the grid
    const gridSize = Math.floor(Math.sqrt(density * size * size));
    const count = gridSize * gridSize;
    
    const indices = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      indices[i] = i;
      const brightness = 0.8 + Math.random() * 0.4;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness;
    }
    
    geo.setAttribute('aInstanceIndex', new THREE.InstancedBufferAttribute(indices, 1));
    geo.setAttribute('aInstanceColor', new THREE.InstancedBufferAttribute(colors, 3));
    
    return { geometry: geo, instanceCount: count, gridSize };
  }, [size, density]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(baseColor) },
    uTipColor: { value: new THREE.Color(tipColor) },
    uWindDir: { value: new THREE.Vector3(...windDir).normalize() },
    uWindSpeed: { value: windSpeed },
    uWindStrength: { value: windStrength },
    uNoiseScale: { value: noiseScale },
    uNoiseSpeed: { value: noiseSpeed },
    uSunPosition: { value: new THREE.Vector3(...sunPosition) },
    uCameraPosition: { value: new THREE.Vector3() },
    uTerrainColor: { value: new THREE.Color('#2d1e16') },
    uWindNoise: { value: windNoiseTex },
    uDensityMap: { value: densityTex },
    uBlueNoise: { value: blueNoiseTex },
    uGridSize: { value: Math.sqrt(instanceCount) },
    uWorldSize: { value: size }
  }), [baseColor, tipColor, windDir, windSpeed, windStrength, noiseScale, noiseSpeed, sunPosition, windNoiseTex, densityTex, blueNoiseTex, instanceCount, size]);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      if (material && material.uniforms) {
        material.uniforms.uTime.value = state.clock.elapsedTime;
        material.uniforms.uCameraPosition.value.copy(state.camera.position);
      }
    }
  });

  return (
    <mesh
      ref={meshRef as any}
      args={[geometry, undefined]}
      position={position}
      frustumCulled={false}
    >
      <shaderMaterial
        vertexShader={grassVertexShader}
        fragmentShader={grassFragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent={false} // We use discard instead of transparency for better performance
        depthWrite={true}
      />
    </mesh>
  );
};

export default GrassPatch;
