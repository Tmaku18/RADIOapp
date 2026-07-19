'use client';

import { useRef, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Float, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';

function AlbumCube({ texture }: { texture: THREE.Texture }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.4;
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[2.2, 2.2, 0.25]} />
      <meshStandardMaterial
        map={texture}
        emissive="#00F0FF"
        emissiveIntensity={0.08}
        metalness={0.5}
        roughness={0.35}
      />
    </mesh>
  );
}

function Album({ imgUrl }: { imgUrl: string }) {
  const tex = useLoader(TextureLoader, imgUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  return <AlbumCube texture={tex} />;
}

export function FloatingAlbum({ imgUrl }: { imgUrl: string }) {
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 5], fov: 40 }}
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} intensity={2.4} color="#00F0FF" />
      <pointLight position={[-3, -2, 2]} intensity={1.6} color="#FF007F" />
      <Suspense fallback={null}>
        <PresentationControls
          global
          polar={[-0.3, 0.3]}
          azimuth={[-0.6, 0.6]}
          config={{ mass: 1, tension: 170, friction: 26 }}
        >
          <Float speed={1.6} rotationIntensity={0.4} floatIntensity={0.8}>
            <Album imgUrl={imgUrl} />
          </Float>
        </PresentationControls>
      </Suspense>
    </Canvas>
  );
}
