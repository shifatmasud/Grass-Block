import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import GrassPatch from './GrassPatch';

interface GrassSystemProps {
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

const GrassSystem: React.FC<GrassSystemProps> = ({
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
  return (
    <GrassPatch
      position={[0, 0, 0]}
      size={size}
      density={density}
      baseColor={baseColor}
      tipColor={tipColor}
      windDir={windDir}
      windSpeed={windSpeed}
      windStrength={windStrength}
      noiseScale={noiseScale}
      noiseSpeed={noiseSpeed}
      sunPosition={sunPosition}
    />
  );
};

export default GrassSystem;
