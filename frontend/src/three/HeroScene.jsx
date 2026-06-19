import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

// Butterfly DNA Helix — twisted torus knot pulsing with neon light
function HelixCore() {
  const ref = useRef();
  const ref2 = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.x = t * 0.15;
      ref.current.rotation.y = t * 0.25;
    }
    if (ref2.current) {
      ref2.current.rotation.x = -t * 0.18;
      ref2.current.rotation.y = -t * 0.22;
      const s = 1 + Math.sin(t * 1.4) * 0.04;
      ref2.current.scale.set(s, s, s);
    }
  });
  return (
    <group>
      <mesh ref={ref}>
        <torusKnotGeometry args={[1.15, 0.28, 256, 32, 2, 5]} />
        <meshStandardMaterial
          color="#00F0FF"
          emissive="#00F0FF"
          emissiveIntensity={1.2}
          roughness={0.2}
          metalness={0.7}
          wireframe={false}
        />
      </mesh>
      <mesh ref={ref2}>
        <torusKnotGeometry args={[1.45, 0.04, 256, 16, 3, 7]} />
        <meshBasicMaterial color="#FF007F" wireframe transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function StarField() {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) {
      const r = 6 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = state.clock.elapsedTime * 0.01;
    }
  });
  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.025}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function NeonRings() {
  const g = useRef();
  useFrame((state) => {
    if (g.current) g.current.rotation.z = state.clock.elapsedTime * 0.1;
  });
  return (
    <group ref={g}>
      {[2.4, 3.0, 3.7].map((r, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.2, 0, 0]}>
          <torusGeometry args={[r, 0.008, 16, 200]} />
          <meshBasicMaterial color={i % 2 ? "#FF007F" : "#00F0FF"} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 5.5], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 8, 18]} />
      <ambientLight intensity={0.15} />
      <pointLight position={[5, 5, 5]} intensity={2.4} color="#00F0FF" />
      <pointLight position={[-5, -3, 4]} intensity={2.2} color="#FF007F" />
      <pointLight position={[0, 4, -3]} intensity={1.6} color="#F4D03F" />
      <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.2}>
        <HelixCore />
      </Float>
      <NeonRings />
      <StarField />
    </Canvas>
  );
}
