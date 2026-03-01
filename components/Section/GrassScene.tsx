import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import * as THREE from 'three';
import GrassSystem from './GrassSystem';
import { useControls } from 'leva';
import { createDensityTexture } from '../../src/utils/textures';

const GrassScene = () => {
  const {
    density,
    baseColor,
    tipColor,
    windSpeed,
    windStrength,
    noiseScale,
    noiseSpeed,
    sunPosition
  } = useControls({
    density: { value: 100, min: 10, max: 500, step: 10 },
    baseColor: '#2d5a27',
    tipColor: '#8fb339',
    windSpeed: { value: 1.5, min: 0, max: 5, step: 0.1 },
    windStrength: { value: 0.3, min: 0, max: 1, step: 0.01 },
    noiseScale: { value: 0.5, min: 0.1, max: 2, step: 0.1 },
    noiseSpeed: { value: 0.2, min: 0, max: 1, step: 0.01 },
    sunPosition: { value: [20, 40, 20], step: 1 }
  });

  const densityTex = useMemo(() => createDensityTexture(), []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 10, 20], fov: 60 }} shadows>
        <color attach="background" args={['#87CEEB']} />
        
        <Sky sunPosition={new THREE.Vector3(...sunPosition)} />
        <Environment preset="city" />
        
        <ambientLight intensity={1.2} />
        <directionalLight
          castShadow
          position={sunPosition}
          intensity={3.5}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={100}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />

        {/* Terrain Base with Baked Density */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20, 64, 64]} />
          <meshStandardMaterial 
            color="#2d1e16" 
            roughness={0.9} 
            map={densityTex}
          />
        </mesh>

        <Suspense fallback={null}>
          <GrassSystem
            size={20}
            density={density}
            baseColor={baseColor}
            tipColor={tipColor}
            windDir={[1, 0, 1]}
            windSpeed={windSpeed}
            windStrength={windStrength}
            noiseScale={noiseScale}
            noiseSpeed={noiseSpeed}
            sunPosition={sunPosition}
          />
        </Suspense>

        <OrbitControls
          maxPolarAngle={Math.PI / 2 - 0.05} // Don't go below ground
          minDistance={2}
          maxDistance={30}
        />
      </Canvas>
    </div>
  );
};

export default GrassScene;
